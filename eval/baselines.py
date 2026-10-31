"""Deliberately simple baselines, with no access to evaluation labels or LLM.

Regex baseline: first labelled number in description/attributes, ignores variant
scope and does no unit conversion or contradiction reconciliation. Keyword review
baseline: whole-review quotes, speculative language not understood. Outputs are raw
predictions, deliberately not passed through the grounded pipeline's validators.
"""

import re
from typing import Any

from app.evidence.index import build_evidence_index
from app.evidence.reviews import review_evidence
from app.evidence.schema import SCHEMA_FIELDS
from app.providers import CatalogProvider

LABEL_PATTERNS = {
    "capacity_mah": r"Capacity:\s*(\d+(?:\.\d+)?)",
    "max_output_w": r"Max output:\s*(\d+(?:\.\d+)?)",
    "usb_c_ports": r"USB-C ports:\s*(\d+)",
    "weight_g": r"Weight:\s*(\d+(?:\.\d+)?)",
    "max_input_w": r"Max input:\s*(\d+(?:\.\d+)?)",
    "pd_supported": r"USB PD:\s*(yes|no)",
    "included_cable": r"Included cable:\s*(yes|no)",
    "warranty_months": r"Warranty:\s*(\d+)",
}
KEYWORDS = [
    ("hot", "heat", "negative"),
    ("cool", "heat", "positive"),
    ("light", "portability", "positive"),
    ("heavy", "portability", "negative"),
    ("fast", "charging", "positive"),
    ("slowly", "charging", "negative"),
    ("stopped working", "reliability", "negative"),
    ("reliable", "reliability", "positive"),
    ("reliably", "reliability", "positive"),
    ("good value", "value", "positive"),
    ("poor value", "value", "negative"),
    ("blue", "other", "neutral"),
]


def parse_specs(evidence: dict[str, Any]) -> list[dict[str, Any]]:
    # A common baseline processes marketing copy before structured attributes.
    sources = sorted(evidence.values(), key=lambda s: 0 if s.source_type == "description" else 1)
    facts = []
    for field in SCHEMA_FIELDS:
        prediction = dict(
            field_key=field["field_key"],
            status="missing",
            value=None,
            evidence_ids=[],
            conflicting_values=[],
        )
        for source in sources:
            match = re.search(LABEL_PATTERNS[field["field_key"]], source.source_text, re.IGNORECASE)
            if match:
                raw = match[1].lower()
                value = (
                    raw == "yes" if raw in ("yes", "no") else float(raw) if "." in raw else int(raw)
                )
                prediction.update(status="supported", value=value, evidence_ids=[source.id])
                break
        facts.append(prediction)
    return facts


def parse_reviews(item_key: str, reviews: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    mentions = {}
    for review in reviews:
        for phrase, aspect, sentiment in KEYWORDS:
            if phrase in review["text"].lower():
                mention_id = f"{item_key}:baseline:{review['review_id']}:{aspect}:{sentiment}"
                mentions[mention_id] = dict(
                    id=mention_id,
                    item_key=item_key,
                    review_id=review["review_id"],
                    aspect=aspect,
                    sentiment=sentiment,
                    excerpt=review["text"],
                )
    return mentions


async def predict(provider: CatalogProvider, selections: list[dict[str, Any]]) -> dict[str, Any]:
    """Read catalog sources only. Ground truth is never an argument to this function."""
    predictions: dict[str, Any] = dict(items=[], facts_by_item={}, evidence={}, review_mentions={})
    for selection in selections:
        listing = await provider.get_listing(selection["listing_id"])
        variant = await provider.get_variant(selection["listing_id"], selection["variant_id"])
        if listing is None or variant is None:
            raise ValueError(f"Unknown evaluation selection: {selection}")
        key = f"{selection['listing_id']}:{selection['variant_id']}"
        evidence = build_evidence_index(listing, variant)
        page = await provider.get_reviews(selection["listing_id"], None)
        reviews = page["reviews"]
        while page["next_cursor"] is not None:
            page = await provider.get_reviews(
                selection["listing_id"], None, cursor=page["next_cursor"]
            )
            reviews.extend(page["reviews"])
        exact = [r for r in reviews if r["variant_id"] == selection["variant_id"]]
        predictions["items"].append(dict(item_key=key, **selection))
        predictions["facts_by_item"][key] = parse_specs(evidence)
        predictions["evidence"].update({k: s.model_dump() for k, s in evidence.items()})
        predictions["evidence"].update(
            {k: s.model_dump() for k, s in review_evidence(key, reviews).items()}
        )
        predictions["review_mentions"].update(parse_reviews(key, exact))
    return predictions
