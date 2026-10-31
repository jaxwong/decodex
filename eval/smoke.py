"""Acceptance checks for the three synthetic demo variants, independent of gold labels."""

from typing import Any

from app.contracts.evidence import ComparisonEvidence
from app.evidence import EvidenceBuilder, ModelClient
from app.providers import CatalogProvider

SMOKE_SELECTIONS = [
    {"listing_id": "listingA", "variant_id": "100w"},
    {"listing_id": "listingB", "variant_id": "65w"},
    {"listing_id": "listingC", "variant_id": "87w"},
]


def check_smoke(comparison: ComparisonEvidence) -> list[str]:
    """Return failed spec acceptance checks; a completed request alone is insufficient."""
    failures = []
    expected = {f"{s['listing_id']}:{s['variant_id']}" for s in SMOKE_SELECTIONS}
    if {item["item_key"] for item in comparison.items} != expected:
        return ["exact_demo_selection"]
    for item in comparison.items:
        key = item["item_key"]
        if item.get("analysis_status") != "completed":
            failures.append(f"{key}:spec_analysis_completed")
        if item.get("review_status") != "completed":
            failures.append(f"{key}:review_analysis_completed")
        coverage = item.get("review_coverage", {})
        exact_ids = {
            source.review_id
            for source in comparison.evidence.values()
            if source.item_key == key
            and source.source_type == "review"
            and source.variant_id == item["variant_id"]
        }
        if not exact_ids or coverage.get("exact_reviews_analyzed") != len(exact_ids):
            failures.append(f"{key}:exact_review_coverage")
        summaries = [s for s in comparison.review_summaries if s.item_key == key]
        if len(summaries) != 6 or any(s.analyzed_reviews != len(exact_ids) for s in summaries):
            failures.append(f"{key}:review_denominators")
        aspects = {
            mention.aspect
            for mention in comparison.review_mentions.values()
            if mention.item_key == key
        }
        if not {"heat", "portability", "charging"} <= aspects:
            failures.append(f"{key}:comparable_review_aspects")
    facts = {
        key: {fact.field_key: fact for fact in group}
        for key, group in comparison.facts_by_item.items()
    }
    for key, field, value in (
        ("listingA:100w", "max_output_w", 100),
        ("listingA:100w", "weight_g", 420),
    ):
        fact = facts[key][field]
        if fact.status != "supported" or fact.value != value:
            failures.append(f"{key}:{field}")
    weight = facts["listingA:100w"]["weight_g"]
    if not any("0.42 kg" in comparison.evidence[e].source_text for e in weight.evidence_ids):
        failures.append("original_weight_source")
    missing = facts["listingC:87w"]["weight_g"]
    if missing.status != "missing" or missing.value is not None:
        failures.append("missing_weight_abstains")
    warranty = facts["listingC:87w"]["warranty_months"]
    if warranty.status != "conflicting" or set(warranty.conflicting_values) != {"12", "24"}:
        failures.append("warranty_conflict_preserved")
    # Revalidate the entire graph: known source IDs, exact variants, literal review
    # excerpts, and unique-review sentiment counts are canonical contract invariants.
    ComparisonEvidence.model_validate(comparison.model_dump())
    return failures


async def run_smoke(provider: CatalogProvider, model: ModelClient) -> dict[str, Any]:
    """Run the real builder; callers control credentials, transport and request budget."""
    result = await EvidenceBuilder(provider, model).build(SMOKE_SELECTIONS)
    failures = check_smoke(result)
    return {
        "status": "failed" if failures else "passed",
        "failed_checks": failures,
        "comparison": result.model_dump(mode="json"),
    }
