"""A4 report integration is offline; recorded failures and run history stay visible."""

import asyncio
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from typing import Any

import pytest
from eval import run as evaluation_run
from eval import scorecard
from eval.agent import AgentBenchmarkReport
from eval.metrics import REVIEW_METRIC_PREFIXES, score

from app.contracts.evidence import ComparisonSelection
from app.providers import MockCatalogProvider

ROOT = Path(__file__).resolve().parents[4]


def recorded_inputs() -> tuple[dict[str, Any], dict[str, Any], list[ComparisonSelection]]:
    recorded = json.loads((ROOT / "eval/live-results.json").read_text())
    labels = json.loads((ROOT / "data/ground_truth.json").read_text())
    selections = [
        ComparisonSelection(listing_id=key.rsplit(":", 1)[0], variant_id=key.rsplit(":", 1)[1])
        for key in labels["items"]
    ]
    return recorded, labels, selections


def currentized_recorded_inputs() -> tuple[
    dict[str, Any], dict[str, Any], list[ComparisonSelection]
]:
    """Upgrade a test-only copy; never rewrite or promote the paid artifact."""
    recorded, labels, selections = recorded_inputs()
    listings = json.loads((ROOT / "data/listings.json").read_text())["listings"]
    variants = {
        f"{listing['listing_id']}:{variant['variant_id']}": variant
        for listing in listings
        for variant in listing["variants"]
    }
    recorded["conditions"]["source_sha256"] = {
        name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest()
        for name in scorecard.SOURCE_NAMES
    }
    comparisons = [
        recorded["live_run"]["smoke"]["comparison"],
        recorded["grounded_structured_outputs"]["prediction"],
    ]
    for comparison in comparisons:
        for item in comparison["items"]:
            variant = variants[item["item_key"]]
            item["shop_voucher_minor"] = variant["shop_voucher_minor"]
            item["shipping_minor"] = variant["shipping_minor"]
            item["landed_price_minor"] = (
                item["price_minor"] - variant["shop_voucher_minor"] + variant["shipping_minor"]
            )
    # Later fixture labels and metric rows change scores, not the recorded predictions.
    recorded["grounded_structured_outputs"]["metrics"] = score(
        recorded["grounded_structured_outputs"]["prediction"], labels, selections
    )
    recorded["ungrounded_free_form"]["metrics"] = {
        k: v
        for k, v in score(
            recorded["ungrounded_free_form"]["prediction"], labels, selections
        ).items()
        if not k.startswith(REVIEW_METRIC_PREFIXES)
    }
    return recorded, labels, selections


def save_copy(tmp_path: Path, recorded: dict[str, Any]) -> Path:
    path = tmp_path / "recorded.json"
    path.write_text(json.dumps(recorded))
    return path


def load_copy(
    labels: dict[str, Any], selections: list[ComparisonSelection], path: Path
) -> dict[str, Any] | None:
    return asyncio.run(
        scorecard.load_recorded_evidence(
            labels,
            selections,
            MockCatalogProvider(),
            path,
        )
    )


@pytest.fixture
def partial_handoff() -> AgentBenchmarkReport:
    # Isolate consumer behavior from future paid runs or changes that legitimately
    # stale the real agent artifact. These test-only values are never persisted.
    report = json.loads((ROOT / "eval/agent-results.json").read_text())
    report["status"] = "partial"
    report["metrics"]["scenario_success"] = {"value": 10 / 12, "numerator": 10, "denominator": 12}
    failed = {"review_query", "no_comparable_winner"}
    for scenario in report["scenarios"]:
        scenario["status"] = "failed" if scenario["scenario_id"] in failed else "passed"
    return AgentBenchmarkReport.model_validate(report)


def test_scorecard_includes_recorded_evidence_and_partial_agent(
    monkeypatch: pytest.MonkeyPatch, partial_handoff: AgentBenchmarkReport
) -> None:
    live_before = (ROOT / "eval/live-results.json").read_bytes()
    agent_before = (ROOT / "eval/agent-results.json").read_bytes()
    monkeypatch.setattr(evaluation_run, "load_agent_benchmark", lambda: partial_handoff)
    result = asyncio.run(evaluation_run.evaluate())
    evidence = result["recorded_evidence_evaluation"]
    assert evidence == {
        "available": False,
        "reason": "Recorded evidence source/label hashes are stale",
    }
    agent = result["agent_output_evaluation"]
    assert agent["available"] is True and agent["status"] == "partial"
    assert agent["metrics"]["scenario_success"]["numerator"] == 10
    assert agent["metrics"]["scenario_success"]["denominator"] == 12
    assert {s["scenario_id"] for s in agent["scenarios"] if s["status"] == "failed"} == {
        "review_query",
        "no_comparable_winner",
    }
    assert result["friction_proxy"]["available"] is False
    assert result["prose_only_agent_baseline"]["available"] is False
    assert (ROOT / "eval/live-results.json").read_bytes() == live_before
    assert (ROOT / "eval/agent-results.json").read_bytes() == agent_before


@pytest.mark.parametrize(
    "damage",
    [
        "sources",
        "source_text",
        "citation",
        "metric",
        "requests",
        "selection",
        "free_form_output",
    ],
)
def test_recorded_evidence_rejects_stale_or_inconsistent_artifacts(
    tmp_path: Path, damage: str
) -> None:
    recorded, labels, selections = currentized_recorded_inputs()
    grounded = recorded["grounded_structured_outputs"]
    if damage == "sources":
        recorded["conditions"]["source_sha256"]["reviews.json"] = "changed"
    elif damage == "source_text":
        next(iter(grounded["prediction"]["evidence"].values()))["source_text"] += " invented claim"
    elif damage == "citation":
        grounded["prediction"]["facts_by_item"]["listingA:100w"][0]["evidence_ids"] = ["unknown"]
    elif damage == "metric":
        grounded["metrics"]["supported_field_accuracy"]["numerator"] = 87
    elif damage == "requests":
        recorded["live_run"]["attempted_requests"] = 35
    elif damage == "free_form_output":
        recorded["ungrounded_free_form"]["outputs"]["listingA:100w"]["facts"][0]["value"] = "fake"
    else:
        del recorded["ungrounded_free_form"]["prediction"]["facts_by_item"]["listingA:100w"]
    with pytest.raises(scorecard.RecordedEvidenceError):
        load_copy(labels, selections, save_copy(tmp_path, recorded))


def test_code_fingerprint_distinguishes_current_and_historical_runs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recorded, labels, selections = currentized_recorded_inputs()
    recorded["live_run"].update(
        implementation_sha256=scorecard.implementation_sha256(),
        pydantic_version=version("pydantic"),
    )
    path = save_copy(tmp_path, recorded)
    current = load_copy(labels, selections, path)
    assert current is not None and current["current_implementation_verified"] is True
    monkeypatch.setattr(scorecard, "implementation_sha256", lambda: "changed")
    historical = load_copy(labels, selections, path)
    assert historical is not None and historical["available"] is True
    assert historical["current_implementation_verified"] is False
    assert historical["implementation_status"] == "changed"


def test_legacy_evidence_is_not_claimed_as_current_runtime(tmp_path: Path) -> None:
    recorded, labels, selections = currentized_recorded_inputs()
    recorded["live_run"].pop("implementation_sha256", None)
    measured = load_copy(labels, selections, save_copy(tmp_path, recorded))
    assert measured is not None and measured["implementation_status"] == "not_recorded"
    assert measured["current_implementation_verified"] is False


def test_partial_recorded_predictions_are_not_promoted_to_success(tmp_path: Path) -> None:
    recorded, labels, selections = currentized_recorded_inputs()
    recorded["live_run"]["status"] = "partial"
    free_form = recorded["ungrounded_free_form"]
    free_form["outputs"]["listingA:100w"]["status"] = "invalid_output"
    free_form["outputs"]["listingA:100w"]["facts"] = []
    free_form["prediction"]["facts_by_item"]["listingA:100w"] = []
    free_form["metrics"] = {
        k: v
        for k, v in score(free_form["prediction"], labels, selections).items()
        if not k.startswith(REVIEW_METRIC_PREFIXES)
    }
    measured = load_copy(labels, selections, save_copy(tmp_path, recorded))
    assert measured is not None and measured["status"] == "partial"
    assert measured["ungrounded_free_form"]["metrics"]["supported_field_accuracy"]["numerator"] < 88


def test_offline_scorecard_never_constructs_a_model_client(
    monkeypatch: pytest.MonkeyPatch, partial_handoff: AgentBenchmarkReport
) -> None:
    def reject_network_client(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("Offline scorecard must not construct OpenAI clients")

    monkeypatch.setattr(evaluation_run, "AsyncOpenAI", reject_network_client)
    monkeypatch.setattr(evaluation_run, "load_agent_benchmark", lambda: partial_handoff)
    result = asyncio.run(evaluation_run.evaluate())
    text = scorecard.render_scorecard(result)
    assert "**partial**" in text and "10/12" in text
    assert "review_query" in text and "no_comparable_winner" in text
    assert "Recorded evidence unavailable" in text
    assert "source/label hashes are stale" in text
    assert "Server state outcomes do not prove browser" in text


def test_invalid_recorded_run_is_explicitly_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    async def reject_recorded(*args: Any, **kwargs: Any) -> None:
        raise scorecard.RecordedEvidenceError("Recorded source hashes are stale")

    monkeypatch.setattr(evaluation_run, "load_recorded_evidence", reject_recorded)
    result = asyncio.run(evaluation_run.evaluate())
    assert result["recorded_evidence_evaluation"] == {
        "available": False,
        "reason": "Recorded source hashes are stale",
    }
    text = scorecard.render_scorecard(result)
    assert "Recorded source hashes are stale" in text
    assert "88/88" not in text
