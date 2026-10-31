"""Own the frozen comparison evidence shared by offline evals and API tests."""

from collections.abc import Sequence
from pathlib import Path

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = REPOSITORY_ROOT / "data" / "sample_comparison_evidence.json"


def load_sample_evidence() -> ComparisonEvidence:
    """Load the frozen evidence handoff without invoking a model or provider."""
    return ComparisonEvidence.model_validate_json(EVIDENCE_PATH.read_text(encoding="utf-8"))


SELECTIONS = [
    {"listing_id": item.listing_id, "variant_id": item.variant_id}
    for item in load_sample_evidence().items
]


async def build_sample_evidence(
    selections: Sequence[ComparisonSelection],
) -> ComparisonEvidence:
    """Return frozen evidence only for its exact listing variants."""
    requested_item_keys = {
        f"{selection.listing_id}:{selection.variant_id}" for selection in selections
    }
    evidence = load_sample_evidence()
    evidence_item_keys = {item.item_key for item in evidence.items}
    if requested_item_keys != evidence_item_keys:
        raise RuntimeError(
            "Selections differ from sample_comparison_evidence.json: "
            f"requested={sorted(requested_item_keys)!r}, "
            f"expected={sorted(evidence_item_keys)!r}"
        )
    return evidence
