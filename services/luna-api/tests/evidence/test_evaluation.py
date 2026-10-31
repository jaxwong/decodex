import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from eval import run as evaluation_run
from eval.metrics import ratio, score

from app.providers import MockCatalogProvider
from tests.evidence.test_pipeline import SELECTIONS, comparison

ROOT = Path(__file__).resolve().parents[4]


def labels() -> dict[str, Any]:
    ground_truth: dict[str, Any] = json.loads((ROOT / "data/ground_truth.json").read_text())
    return ground_truth


def test_deterministic_evaluation_behavior() -> None:
    first, second = asyncio.run(evaluation_run.evaluate()), asyncio.run(evaluation_run.evaluate())
    assert first["conditions"] == second["conditions"]
    assert first["regex_keyword_baseline"]["metrics"] == second["regex_keyword_baseline"]["metrics"]
    metrics = first["regex_keyword_baseline"]["metrics"]
    assert metrics["supported_field_accuracy"] == ratio(55, 88)
    assert metrics["missing_field_recall"] == ratio(4, 4)
    assert metrics["contradiction_recall"] == ratio(0, 4)
    assert metrics["variant_leakage_rate"] == ratio(9, 12)
    assert not first["grounded_structured_outputs"]["available"]
    assert first["conditions"]["source_review_count"] == 60
    # The keyword baseline emits no disputes, so precision is unavailable, not zero.
    assert metrics["dispute_precision"] == ratio(0, 0)
    assert metrics["dispute_recall"] == ratio(0, 1)


def test_scorer_checks_hand_authored_expected_values() -> None:
    # This is scorer verification with test-only fake output, never a model benchmark.
    predictions = comparison().model_dump()
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics["supported_field_accuracy"] == ratio(22, 22)
    assert metrics["evidence_precision"] == ratio(24, 24)
    assert metrics["unsupported_claim_rate"] == ratio(0, 22)
    assert metrics["contradiction_recall"] == ratio(1, 1)
    assert metrics["review_mention_precision"] == ratio(53, 53)
    assert metrics["review_mention_recall"] == ratio(53, 53)
    assert metrics["dispute_precision"] == ratio(1, 1)
    assert metrics["dispute_recall"] == ratio(1, 1)


def test_scorer_rejects_wrong_source_even_if_value_correct() -> None:
    predictions = comparison().model_dump()
    changed = predictions["facts_by_item"]["listingA:100w"][0]
    changed["evidence_ids"] = ["unknown"]
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics["supported_field_accuracy"]["value"] == 1
    assert metrics["unsupported_claim_rate"] == ratio(1, 22)
    assert metrics["evidence_precision"] == ratio(23, 24)


def test_scorer_review_support_and_variant_exclusion() -> None:
    predictions = comparison().model_dump()
    next(iter(predictions["review_mentions"].values()))["excerpt"] = "Invented quotation"
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics["review_mention_precision"] == ratio(52, 53)
    assert metrics["review_mention_recall"] == ratio(52, 53)


def test_scorer_rejects_dispute_citing_an_unlabelled_review() -> None:
    predictions = comparison().model_dump()
    capacity = predictions["facts_by_item"]["listingA:100w"][0]
    capacity["disputing_mention_ids"] = sorted(
        mention_id
        for mention_id, mention in predictions["review_mentions"].items()
        if mention["item_key"] == "listingA:100w"
    )[:2]
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics["dispute_precision"] == ratio(1, 2)
    assert metrics["dispute_recall"] == ratio(1, 1)


def test_baseline_input_does_not_contain_labels() -> None:
    # Provider methods expose raw source only, not ground truth or expected mentions.
    catalog = asyncio.run(MockCatalogProvider().list_listings())
    assert all(
        not hasattr(variant, "attributes") and not hasattr(listing, "description")
        for listing in catalog
        for variant in listing.variants
    )
    assert "ground_truth" not in json.dumps(
        [listing.model_dump(mode="json") for listing in catalog]
    )


def test_unavailable_metric_has_no_guessed_zero() -> None:
    assert ratio(0, 0)["value"] is None


def test_explicit_live_evaluation_requires_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        asyncio.run(evaluation_run.evaluate(live=True))


def test_stale_agent_artifact_is_reported_as_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def reject_stale_artifact() -> None:
        raise RuntimeError("Agent benchmark implementation hash is stale")

    monkeypatch.setattr(evaluation_run, "load_agent_benchmark", reject_stale_artifact)

    result = asyncio.run(evaluation_run.evaluate())

    assert result["agent_output_evaluation"] == {
        "available": False,
        "reason": "Agent benchmark implementation hash is stale",
    }
