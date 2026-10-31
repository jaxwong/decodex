"""Public evidence boundary. No comparison IDs, preferences, ranking or revisions."""

import asyncio
import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from pydantic import ValidationError

from app.contracts.evidence import (
    AnalyzedComparisonItem,
    ComparisonEvidence,
    ComparisonSelection,
    ReviewMention,
)
from app.providers import CatalogError, CatalogProvider

from .index import build_evidence_index
from .model import ExtractionError, ModelClient, ReviewCandidates, SpecCandidates
from .reviews import (
    aggregate_reviews,
    attach_disputes,
    review_batches,
    review_evidence,
    validate_review_mentions,
)
from .schema import SCHEMA_FIELDS
from .validate import unresolved_facts, validate_facts

logger = logging.getLogger(__name__)


class EvidenceBuilder:
    """Inject a CatalogProvider and ModelClient once at B's composition root.

    `await builder.build(selections)` and the module-level function return the same
    validated contract. Invalid identities/buckets raise CatalogError. Model and
    review failures preserve independent successfully analyzed items and fields.
    """

    def __init__(
        self, provider: CatalogProvider, model_client: ModelClient, *, timeout_seconds: float = 35
    ) -> None:
        self.provider = provider
        self.model_client = model_client
        self.timeout_seconds = timeout_seconds

    async def build(self, selections: Sequence[ComparisonSelection]) -> ComparisonEvidence:
        if not 2 <= len(selections) <= 4:
            raise CatalogError("invalid_bucket")
        keys = [(selection.listing_id, selection.variant_id) for selection in selections]
        if len(keys) != len(set(keys)):
            raise CatalogError("duplicate_selection")
        # Resolve all provider-owned identities and prices before any model requests.
        resolved = []
        for selection in selections:
            listing = await self.provider.get_listing(selection.listing_id)
            if listing is None:
                raise CatalogError("unknown_listing")
            variant = await self.provider.get_variant(selection.listing_id, selection.variant_id)
            if variant is None:
                raise CatalogError("unknown_variant")
            version = await self.provider.get_snapshot_version(selection.listing_id)
            resolved.append((listing, variant, version))
        analyses = await asyncio.gather(*(self._analyze(*source) for source in resolved))
        return ComparisonEvidence(
            items=[a["item"] for a in analyses],
            schema_fields=SCHEMA_FIELDS,
            facts_by_item={a["item"].item_key: a["facts"] for a in analyses},
            evidence={key: value for a in analyses for key, value in a["evidence"].items()},
            review_summaries=[summary for a in analyses for summary in a["summaries"]],
            review_mentions={key: value for a in analyses for key, value in a["mentions"].items()},
        )

    async def _analyze(
        self, listing: dict[str, Any], variant: dict[str, Any], version: str
    ) -> dict[str, Any]:
        key = f"{listing['listing_id']}:{variant['variant_id']}"
        evidence = build_evidence_index(listing, variant)
        item = {
            "item_key": key,
            "listing_id": listing["listing_id"],
            "variant_id": variant["variant_id"],
            "title": listing["title"],
            "variant_label": variant["label"],
            "price_minor": variant["price_minor"],
            "shop_voucher_minor": variant["shop_voucher_minor"],
            "shipping_minor": variant["shipping_minor"],
            "landed_price_minor": (
                variant["price_minor"] - variant["shop_voucher_minor"] + variant["shipping_minor"]
            ),
            "currency": variant["currency"],
            "snapshot_version": version,
            "synthetic": listing.get("synthetic", False),
        }
        request = {
            "item_key": key,
            "variant_id": variant["variant_id"],
            "schema_fields": [field.model_dump(mode="json") for field in SCHEMA_FIELDS],
            "seller_evidence": [source.model_dump() for source in evidence.values()],
        }
        try:
            response = await asyncio.wait_for(
                self.model_client.extract_specs(request), self.timeout_seconds
            )
            facts = validate_facts(
                SpecCandidates.model_validate(response), evidence, key, variant["variant_id"]
            )
            item["analysis_status"] = "completed"
        except (ExtractionError, TimeoutError, ValidationError) as failure:
            logger.warning(
                "Specification extraction unavailable for %s (%s)", key, type(failure).__name__
            )
            facts = unresolved_facts()
            item["analysis_status"] = "unresolved"
            item["analysis_error"] = type(failure).__name__
        reviews: list[dict[str, Any]] = []
        mentions: dict[str, ReviewMention] = {}
        disputes: dict[str, set[str]] = {}
        analyzed_ids: set[str] = set()
        review_status, rejected_count = "completed", 0
        try:
            cursor, seen = None, set()
            while True:
                page = await self.provider.get_reviews(
                    listing["listing_id"], None, cursor=cursor, limit=50
                )
                if page["snapshot_version"] != version:
                    raise CatalogError("snapshot_changed")
                reviews.extend(page["reviews"])
                cursor = page["next_cursor"]
                if cursor is None:
                    break
                if cursor in seen:
                    raise CatalogError("repeated_review_cursor")
                seen.add(cursor)
        except (CatalogError, OSError, TimeoutError) as failure:
            logger.warning("Review provider unavailable for %s (%s)", key, type(failure).__name__)
            reviews, review_status = [], "unresolved"
        evidence.update(review_evidence(key, reviews))
        exact_reviews = [r for r in reviews if r["variant_id"] == variant["variant_id"]]
        for batch in review_batches(exact_reviews):
            try:
                review_response = await asyncio.wait_for(
                    self.model_client.extract_reviews(
                        {"item_key": key, "variant_id": variant["variant_id"], "reviews": batch}
                    ),
                    self.timeout_seconds,
                )
                validated = validate_review_mentions(
                    ReviewCandidates.model_validate(review_response),
                    batch,
                    key,
                    variant["variant_id"],
                )
                mentions.update(validated.mentions)
                for field_key, mention_ids in validated.disputes.items():
                    disputes.setdefault(field_key, set()).update(mention_ids)
                rejected_count += validated.rejected_count
                analyzed_ids.update(r["review_id"] for r in batch)
            except (ExtractionError, TimeoutError, ValidationError) as failure:
                logger.warning("Review batch unavailable for %s (%s)", key, type(failure).__name__)
                review_status = "unresolved"
        facts = attach_disputes(facts, disputes, mentions)
        if any(fact.disputing_mention_ids for fact in facts):
            logger.info(
                "Review disputes attached for %s fields=%s",
                key,
                sorted(f.field_key for f in facts if f.disputing_mention_ids),
            )
        item["review_status"] = review_status
        item["review_coverage"] = {
            "exact_reviews_analyzed": len(analyzed_ids),
            "exact_reviews_available": len(exact_reviews),
            "unknown_variant_reviews_excluded": sum(r["variant_id"] is None for r in reviews),
            "sibling_variant_reviews_excluded": sum(
                r["variant_id"] not in (None, variant["variant_id"]) for r in reviews
            ),
            "rejected_mentions": rejected_count,
        }
        return {
            "item": AnalyzedComparisonItem.model_validate(item),
            "facts": facts,
            "evidence": evidence,
            "mentions": mentions,
            "summaries": aggregate_reviews(key, mentions, analyzed_ids),
        }


_builder: ContextVar[EvidenceBuilder | None] = ContextVar("evidence_builder", default=None)


@contextmanager
def evidence_dependencies(
    provider: CatalogProvider, model_client: ModelClient, *, timeout_seconds: float = 35
) -> Iterator[EvidenceBuilder]:
    """Task-local injection preserving `build_comparison_evidence(selections)`.

    Use around the awaited call. Concurrent requests may bind different providers
    without changing process globals. A bound EvidenceBuilder is also directly usable.
    """
    builder = EvidenceBuilder(provider, model_client, timeout_seconds=timeout_seconds)
    token = _builder.set(builder)
    try:
        yield builder
    finally:
        _builder.reset(token)


async def build_comparison_evidence(
    selections: Sequence[ComparisonSelection],
) -> ComparisonEvidence:
    """Build exact-variant evidence with injected or server-configured dependencies.

    The application composition root injects one process-owned builder. Direct callers
    must bind dependencies explicitly; this function never creates a second client.
    """
    builder = _builder.get()
    if builder is None:
        raise RuntimeError(
            "build_comparison_evidence requires evidence_dependencies at the call boundary"
        )
    return await builder.build(selections)
