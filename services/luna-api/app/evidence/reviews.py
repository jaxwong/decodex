"""Exact-SKU review citations and sample-limited, unique-review counts."""

import hashlib
from dataclasses import dataclass
from typing import Any

from app.contracts.evidence import Evidence, ReviewAspectSummary, ReviewMention

from .index import source_id
from .model import ReviewCandidates
from .schema import ASPECTS


@dataclass(frozen=True)
class ReviewValidation:
    mentions: dict[str, ReviewMention]
    rejected_count: int


def review_evidence(item_key: str, reviews: list[dict[str, Any]]) -> dict[str, Evidence]:
    evidence = {}
    for review in reviews:
        location = "reviews/" + review["review_id"]
        evidence_id = source_id(item_key, location, review["text"])
        evidence[evidence_id] = Evidence(
            id=evidence_id,
            item_key=item_key,
            source_type="review",
            source_text=review["text"],
            source_location=location,
            variant_id=review["variant_id"],
            review_id=review["review_id"],
        )
    return evidence


def validate_review_mentions(
    candidates: ReviewCandidates, reviews: list[dict[str, Any]], item_key: str, variant_id: str
) -> ReviewValidation:
    """Drop unknown IDs, sibling/unknown variants, and non-literal or empty quotes."""
    sources = {review["review_id"]: review for review in reviews}
    mentions = {}
    rejected_count = 0
    for candidate in candidates.mentions:
        review = sources.get(candidate.review_id)
        if (
            review is None
            or review["variant_id"] != variant_id
            or not candidate.excerpt.strip()
            or candidate.excerpt not in review["text"]
        ):
            rejected_count += 1
            continue
        digest = hashlib.sha256(
            "\0".join(
                [candidate.review_id, candidate.aspect, candidate.sentiment, candidate.excerpt]
            ).encode()
        ).hexdigest()[:20]
        mention_id = f"{item_key}:mention:{digest}"
        mentions[mention_id] = ReviewMention(
            id=mention_id, item_key=item_key, **candidate.model_dump()
        )
    return ReviewValidation(mentions, rejected_count)


def aggregate_reviews(
    item_key: str, mentions: dict[str, ReviewMention], analyzed_review_ids: set[str]
) -> list[ReviewAspectSummary]:
    """A mixed review counts once in EACH expressed sentiment, so sums may exceed N.

    N counts all successfully analyzed exact-SKU reviews, including no-mention ones.
    Failed batches and unknown/sibling variants never enter this denominator.
    """
    summaries = []
    for aspect in ASPECTS:
        selected = sorted(
            (
                mention
                for mention in mentions.values()
                if mention.item_key == item_key and mention.aspect == aspect
            ),
            key=lambda m: m.id,
        )
        if any(m.review_id not in analyzed_review_ids for m in selected):
            raise ValueError("Mention refers to an unanalyzed review")
        counts = {
            sentiment + "_count": len({m.review_id for m in selected if m.sentiment == sentiment})
            for sentiment in ("positive", "negative", "neutral")
        }
        summaries.append(
            ReviewAspectSummary(
                item_key=item_key,
                aspect=aspect,
                analyzed_reviews=len(analyzed_review_ids),
                mention_ids=[m.id for m in selected],
                **counts,
            )
        )
    return summaries


def review_batches(reviews: list[dict[str, Any]], maximum: int = 20) -> list[list[dict[str, Any]]]:
    """Balance batches to avoid a tiny trailing batch (e.g. 21 → 11 + 10)."""
    if not reviews:
        return []
    count = (len(reviews) + maximum - 1) // maximum
    size, remainder = divmod(len(reviews), count)
    batches, offset = [], 0
    for number in range(count):
        next_offset = offset + size + (number < remainder)
        batches.append(reviews[offset:next_offset])
        offset = next_offset
    return batches
