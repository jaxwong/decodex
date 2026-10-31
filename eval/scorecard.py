"""Validate recorded measurements and render the A4 scorecard without model calls."""

import hashlib
import json
from collections import Counter
from importlib.metadata import version
from pathlib import Path
from typing import Any

from eval.live import FreeFormPrediction
from eval.metrics import REVIEW_METRIC_PREFIXES, score
from eval.smoke import check_smoke

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection, Evidence
from app.evidence.index import build_evidence_index
from app.evidence.reviews import review_evidence
from app.providers import CatalogProvider

ROOT = Path(__file__).resolve().parents[1]
LIVE_REPORT_PATH = ROOT / "eval/live-results.json"
SOURCE_NAMES = ("listings.json", "reviews.json", "ground_truth.json")


class RecordedEvidenceError(ValueError):
    """Recorded predictions cannot be safely projected against this source snapshot."""


def implementation_sha256() -> str:
    """Fingerprint extraction code; reporting-only edits do not invalidate a run."""
    app = ROOT / "services/luna-api/app"
    paths = [app / "contracts/evidence.py", app / "openai/runtime.py"]
    paths.extend((app / "evidence").glob("*.py"))
    paths.extend((app / "providers").glob("*.py"))
    hashes = {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(paths)
    }
    return hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()


async def _catalog_sources(
    provider: CatalogProvider, selections: list[ComparisonSelection]
) -> dict[str, Evidence]:
    sources = {}
    listing_reviews: dict[str, list[dict[str, Any]]] = {}
    for selection in selections:
        listing = await provider.get_listing(selection.listing_id)
        variant = await provider.get_variant(selection.listing_id, selection.variant_id)
        if listing is None or variant is None:
            raise RecordedEvidenceError("Recorded evidence selection is absent from catalog")
        sources.update(build_evidence_index(listing, variant))
        if selection.listing_id not in listing_reviews:
            listing_reviews[selection.listing_id] = []
            cursor = None
            while True:
                page = await provider.get_reviews(selection.listing_id, None, cursor=cursor)
                listing_reviews[selection.listing_id].extend(page["reviews"])
                cursor = page["next_cursor"]
                if cursor is None:
                    break
        key = f"{selection.listing_id}:{selection.variant_id}"
        sources.update(review_evidence(key, listing_reviews[selection.listing_id]))
    return sources


def _check_original_sources(prediction: dict[str, Any], sources: dict[str, Evidence]) -> None:
    for source_id, source in prediction["evidence"].items():
        original = sources.get(source_id)
        if original is None or original.model_dump(mode="json") != source:
            raise RecordedEvidenceError("Recorded source differs from original catalog evidence")


async def load_recorded_evidence(
    labels: dict[str, Any],
    selections: list[ComparisonSelection],
    provider: CatalogProvider,
    path: Path = LIVE_REPORT_PATH,
) -> dict[str, Any] | None:
    """Rescore stored predictions; never promote a legacy run to current runtime proof.

    Missing files return None. Changed sources, invalid graphs, mismatched metrics
    or request accounting raise RecordedEvidenceError. A missing/changed code
    fingerprint keeps a source-valid run available only as historical evidence.
    """
    if not path.exists():
        return None
    try:
        raw = path.read_bytes()
        report = json.loads(raw)
        expected_hashes = {
            name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest()
            for name in SOURCE_NAMES
        }
        if report["conditions"]["source_sha256"] != expected_hashes:
            raise RecordedEvidenceError("Recorded evidence source/label hashes are stale")
        sources = await _catalog_sources(provider, selections)
        run = report["live_run"]
        attempts = Counter(attempt["stage"] for attempt in run["attempts"])
        if (
            len(run["attempts"]) != run["attempted_requests"]
            or not 0 < run["attempted_requests"] <= run["request_limit"]
            or run["request_plan"]["total"] > run["request_limit"]
            or dict(attempts) != {k: v for k, v in run["request_plan"].items() if k != "total"}
        ):
            raise RecordedEvidenceError("Recorded evidence request accounting is inconsistent")
        smoke = ComparisonEvidence.model_validate(run["smoke"]["comparison"])
        _check_original_sources(run["smoke"]["comparison"], sources)
        if run["smoke"]["status"] != "passed" or check_smoke(smoke):
            raise RecordedEvidenceError("Recorded smoke does not pass acceptance checks")
        keys = {f"{s.listing_id}:{s.variant_id}" for s in selections}
        summaries = {}
        for name in ("grounded_structured_outputs", "ungrounded_free_form"):
            measured = report[name]
            prediction = measured["prediction"]
            _check_original_sources(prediction, sources)
            if (
                {item["item_key"] for item in prediction["items"]} != keys
                or len(prediction["items"]) != len(keys)
                or set(prediction["facts_by_item"]) != keys
            ):
                raise RecordedEvidenceError("Recorded evidence selections do not match the catalog")
            if name == "grounded_structured_outputs":
                ComparisonEvidence.model_validate(prediction)
            else:
                for key, facts in prediction["facts_by_item"].items():
                    if measured["outputs"][key]["facts"] != facts:
                        raise RecordedEvidenceError("Free-form output differs from scored facts")
                    if measured["outputs"][key]["status"] == "completed":
                        FreeFormPrediction.model_validate({"facts": facts})
                    elif facts:
                        raise RecordedEvidenceError("Failed free-form output asserted facts")
            rescored = score(prediction, labels, selections)
            if name == "ungrounded_free_form":
                rescored = {
                    k: v for k, v in rescored.items() if not k.startswith(REVIEW_METRIC_PREFIXES)
                }
            if rescored != measured["metrics"]:
                raise RecordedEvidenceError(
                    f"Recorded {name} metrics disagree with saved predictions"
                )
            summaries[name] = {
                k: v for k, v in measured.items() if k not in ("prediction", "outputs", "metrics")
            }
            summaries[name]["metrics"] = rescored
        recorded_hash = run.get("implementation_sha256")
        implementation_status = (
            "not_recorded"
            if recorded_hash is None
            else (
                "matches"
                if recorded_hash == implementation_sha256()
                and run["sdk_version"] == version("openai")
                and run.get("pydantic_version") == version("pydantic")
                else "changed"
            )
        )
        return {
            "available": True,
            "basis": "actual_live_predictions_rescored_offline",
            "status": run["status"],
            "executed_at_utc": run["executed_at_utc"],
            "model": run["model"],
            "artifact": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else path.name,
            "artifact_sha256": hashlib.sha256(raw).hexdigest(),
            "source_snapshot_verified": True,
            "smoke_revalidated": True,
            "implementation_status": implementation_status,
            "current_implementation_verified": implementation_status == "matches",
            "attempted_requests": run["attempted_requests"],
            "requests_by_stage": dict(attempts),
            "smoke_tokens": run["smoke"]["tokens"],
            **summaries,
        }
    except RecordedEvidenceError:
        raise
    except (OSError, ValueError, KeyError, TypeError) as failure:
        raise RecordedEvidenceError(
            f"Recorded evidence artifact is invalid ({type(failure).__name__})"
        ) from failure


def _ratio(section: dict[str, Any], key: str) -> str:
    metric = section.get("metrics", {}).get(key)
    if metric is None or metric["value"] is None:
        return "Unavailable"
    return f"{metric['numerator']}/{metric['denominator']}"


def _performance(section: dict[str, Any], latency_key: str) -> str:
    timing = section.get(latency_key, {})
    p50, p95 = timing.get("p50"), timing.get("p95_nearest_rank")
    count = timing.get("sample_count")
    if not all(type(value) in (int, float) for value in (p50, p95, count)):
        return "Unavailable"
    return f"p50 {p50 / 1000:.3f}s; nearest-rank p95 {p95 / 1000:.3f}s; {count} samples"


def _tokens(section: dict[str, Any]) -> str:
    usage = section.get("tokens", {})
    total = usage.get("observed_totals", {}).get("total_tokens")
    if type(total) is not int:
        return "Unavailable"
    coverage = "complete" if usage.get("complete") is True else "partial"
    return f"{total:,} observed tokens ({coverage} usage coverage)"


def render_scorecard(result: dict[str, Any]) -> str:
    """Render only measured ratios; preserve partial failures and unavailable work."""
    evidence = result["recorded_evidence_evaluation"]
    agent = result["agent_output_evaluation"]
    rows = [
        "# A4 evaluation scorecard",
        "",
        "Generated by `make eval` from recorded artifacts and an executed local baseline.",
        "All data and labels are synthetic; these results do not establish production quality.",
        "",
        "## Evidence measurements",
        "",
    ]
    grounded = evidence.get("grounded_structured_outputs", {})
    free_form = evidence.get("ungrounded_free_form", {})
    rows += [
        "| Metric | Regex/keyword | Recorded grounded | Recorded free-form specs |",
        "|---|---:|---:|---:|",
    ]
    for label, key in (
        ("Supported fields", "supported_field_accuracy"),
        ("Evidence precision", "evidence_precision"),
        ("Unsupported claims", "unsupported_claim_rate"),
        ("Missing recall", "missing_field_recall"),
        ("Exact normalized conflict recall", "contradiction_recall"),
        ("Variant leakage", "variant_leakage_rate"),
        ("Review precision", "review_mention_precision"),
        ("Review recall", "review_mention_recall"),
        ("Dispute precision", "dispute_precision"),
        ("Dispute recall", "dispute_recall"),
    ):
        values = [_ratio(s, key) for s in (result["regex_keyword_baseline"], grounded, free_form)]
        rows.append(f"| {label} | {' | '.join(values)} |")
    if evidence["available"]:
        rows += [
            "",
            f"Recorded evidence run: {evidence['executed_at_utc']} (UTC), "
            f"{evidence['model']}, {evidence['attempted_requests']} requests.",
            f"Source/label hashes and saved predictions were revalidated. "
            f"Runtime implementation verification: **{evidence['implementation_status']}**.",
        ]
        if not evidence["current_implementation_verified"]:
            rows += [
                "This is a historical executed run, not a new verification of current runtime code."
            ]
    else:
        rows += ["", f"Recorded evidence unavailable: {evidence['reason']}."]
    rows += [
        "",
        "The recorded free-form conflict score uses exact normalized alternatives;",
        "it does not independently measure semantic conflict recognition.",
        f"Grounded comparison timing: {_performance(grounded, 'comparison_latency_ms')}.",
        f"Grounded usage: {_tokens(grounded)}; free-form usage: {_tokens(free_form)}.",
        "Grounded includes reviews and concurrent calls; free-form covers specifications.",
        "",
        "## Agent handoff",
        "",
    ]
    if agent["available"]:
        rows += [
            f"Artifact status: **{agent['status']}**; "
            "evidence, scenario-suite and text-agent hashes validated.",
            f"Recorded at {agent['executed_at_utc']} (UTC); "
            f"{agent['attempted_requests']}/{agent['request_limit']} requests. No rerun was made.",
            "",
            "| Metric | Result |",
            "|---|---:|",
        ]
        for label, key in (
            ("Scenario success", "scenario_success"),
            ("Tool behavior", "tool_success"),
            ("Server state outcome", "ui_outcome_success"),
            ("Citation behavior", "citation_behavior_success"),
            ("State correction", "state_correction_success"),
            ("Stale-turn protection", "stale_turn_protection"),
        ):
            rows.append(f"| {label} | {_ratio(agent, key)} |")
        rows += [
            "",
            "Server state outcomes do not prove browser rendering or UI changes.",
            "This binding covers the producer's recorded hashes, not every application dependency.",
            f"Agent timing: {_performance(agent, 'latency_ms')}.",
            f"Agent usage: {_tokens(agent)}.",
            "These small latency samples do not establish production p95 or an SLO.",
            "",
            "Failed scenarios retained from the handoff:",
            "",
        ]
        for scenario in agent["scenarios"]:
            if scenario["status"] == "failed":
                failed = ", ".join(k for k, v in scenario["checks"].items() if not v)
                rows.append(
                    f"- `{scenario['scenario_id']}`: `{scenario['error']}`; "
                    f"failed checks: {failed}."
                )
    else:
        rows += [f"Unavailable: {agent['reason']}."]
    rows += [
        "",
        "## Explicitly unavailable",
        "",
        f"- Matched browser friction proxy: {result['friction_proxy']['reason']}.",
        f"- Prose-only agent baseline: {result['prose_only_agent_baseline']['reason']}.",
        "- Cost: no verified price table is configured.",
        "- Dual-host browser, microphone and deployment acceptance are not measured here.",
        "",
        "See [README.md](README.md) for metric definitions, denominators and limitations.",
        "Recorded raw outputs remain in [live-results.json](live-results.json) and",
        "[agent-results.json](agent-results.json); "
        "neither artifact is rewritten by this scorecard.",
    ]
    return "\n".join(rows) + "\n"
