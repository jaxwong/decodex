import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts.evidence import ComparisonEvidence, Fact

ROOT = Path(__file__).resolve().parents[4]


def test_shared_fixture_loads() -> None:
    payload = json.loads((ROOT / "data/sample_comparison_evidence.json").read_text())
    result = ComparisonEvidence.model_validate(payload)
    assert len(result.items) == 3
    assert len(result.schema_fields) == 8
    assert result.facts_by_item["listingA:100w"][3].value == 420
    assert result.facts_by_item["listingC:87w"][3].status == "missing"
    assert result.facts_by_item["listingC:87w"][-1].conflicting_values == ["12", "24"]
    assert result.model_dump(mode="json") == payload


def test_supported_requires_valid_evidence() -> None:
    with pytest.raises(ValidationError):
        Fact(field_key="weight_g", status="supported", value=420)


def test_fixture_unknown_evidence_rejected() -> None:
    payload = json.loads((ROOT / "data/sample_comparison_evidence.json").read_text())
    payload["facts_by_item"]["listingA:100w"][0]["evidence_ids"] = ["invented"]
    with pytest.raises(ValidationError):
        ComparisonEvidence.model_validate(payload)


def test_landed_price_arithmetic_must_match_components() -> None:
    payload = json.loads((ROOT / "data/sample_comparison_evidence.json").read_text())
    payload["items"][0]["landed_price_minor"] += 1

    with pytest.raises(
        ValidationError,
        match="Landed price must equal price minus shop voucher plus shipping",
    ):
        ComparisonEvidence.model_validate(payload)


def test_fixture_dispute_keeps_supported_seller_claim() -> None:
    payload = json.loads((ROOT / "data/sample_comparison_evidence.json").read_text())
    result = ComparisonEvidence.model_validate(payload)
    capacity = result.facts_by_item["listingB:65w"][0]
    assert capacity.status == "supported" and capacity.value == 20000
    assert capacity.disputing_mention_ids == [
        "listingB:65w:mention:listingB-r19:0",
        "listingB:65w:mention:listingB-r20:0",
    ]
    assert all(
        not fact.disputing_mention_ids
        for key, facts in result.facts_by_item.items()
        for fact in facts
        if (key, fact.field_key) != ("listingB:65w", "capacity_mah")
    )


def test_only_supported_facts_can_be_disputed() -> None:
    with pytest.raises(ValidationError, match="Only supported facts can be disputed"):
        Fact(field_key="weight_g", status="missing", disputing_mention_ids=["mention"])


@pytest.mark.parametrize(
    "mention_id", ["invented", "listingA:100w:mention:listingA-r01:0"], ids=["unknown", "wrong"]
)
def test_disputing_mention_must_belong_to_the_fact_item(mention_id: str) -> None:
    payload = json.loads((ROOT / "data/sample_comparison_evidence.json").read_text())
    payload["facts_by_item"]["listingB:65w"][0]["disputing_mention_ids"] = [mention_id]
    with pytest.raises(ValidationError, match="Unknown or wrong-item disputing mention"):
        ComparisonEvidence.model_validate(payload)
