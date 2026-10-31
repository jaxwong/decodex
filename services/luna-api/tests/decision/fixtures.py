from collections.abc import Sequence
from pathlib import Path

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
FIXTURE_PATH = REPOSITORY_ROOT / "data" / "sample_comparison_evidence.json"

SELECTIONS = [
    {"listing_id": "listingA", "variant_id": "100w"},
    {"listing_id": "listingB", "variant_id": "65w"},
    {"listing_id": "listingC", "variant_id": "87w"},
]


def load_comparison_evidence() -> ComparisonEvidence:
    """Load A's frozen handoff fixture without invoking a model or provider."""
    return ComparisonEvidence.model_validate_json(FIXTURE_PATH.read_text(encoding="utf-8"))


async def build_fixture_evidence(
    selections: Sequence[ComparisonSelection],
) -> ComparisonEvidence:
    """Return the test-only frozen fixture after checking its exact selections."""
    requested_item_keys = {
        f"{selection.listing_id}:{selection.variant_id}" for selection in selections
    }
    evidence = load_comparison_evidence()
    fixture_item_keys = {item.item_key for item in evidence.items}
    if requested_item_keys != fixture_item_keys:
        raise AssertionError(
            "B2 test fixture requires the three frozen A1 selections: "
            f"requested {sorted(requested_item_keys)}, expected {sorted(fixture_item_keys)}"
        )
    return evidence
