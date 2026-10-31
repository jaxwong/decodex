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
