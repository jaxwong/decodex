"""Execute reproducible baseline evaluation; --live separately invokes real Responses.

Run from repository root:
PYTHONPATH=services/luna-api python -m eval.run
PYTHONPATH=services/luna-api python -m eval.run --live --output eval/live-results.json
"""

import argparse
import asyncio
import hashlib
import json
import logging
import os
from collections import Counter
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from statistics import median
from time import perf_counter
from typing import Any

import httpx2
from dotenv import load_dotenv
from eval.agent import load_agent_benchmark
from eval.baselines import predict
from eval.live import MAX_LIVE_REQUESTS, RequestBudget, free_form_specs, token_summary
from eval.metrics import REVIEW_METRIC_PREFIXES, score
from eval.scorecard import (
    SOURCE_NAMES,
    RecordedEvidenceError,
    implementation_sha256,
    load_recorded_evidence,
    render_scorecard,
)
from eval.smoke import SMOKE_SELECTIONS, run_smoke
from openai import AsyncOpenAI, DefaultAsyncHttpxClient

from app.contracts.evidence import ComparisonSelection
from app.evidence import EvidenceBuilder, OpenAIModelClient
from app.evidence.index import build_evidence_index
from app.evidence.reviews import review_batches
from app.openai.runtime import OPENAI_REQUEST_TIMEOUT_SECONDS
from app.providers import CatalogProvider, MockCatalogProvider

ROOT = Path(__file__).resolve().parents[1]


def unavailable(reason: str) -> dict[str, Any]:
    return {"available": False, "reason": reason}


def merge_predictions(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = dict(
        items=[],
        schema_fields=predictions[0]["schema_fields"],
        facts_by_item={},
        evidence={},
        review_mentions={},
        review_summaries=[],
    )
    for prediction in predictions:
        merged["items"].extend(prediction["items"])
        merged["review_summaries"].extend(prediction["review_summaries"])
        for field in ("facts_by_item", "evidence", "review_mentions"):
            merged[field].update(prediction[field])
    return merged


async def request_plan(
    provider: CatalogProvider, selections: list[ComparisonSelection]
) -> dict[str, int]:
    """Calculate the full ceiling from immutable provider snapshots before spending."""
    reviews: dict[str, list[dict[str, Any]]] = {}
    for listing_id in {selection.listing_id for selection in selections}:
        cursor = None
        reviews[listing_id] = []
        while True:
            page = await provider.get_reviews(listing_id, None, cursor=cursor)
            reviews[listing_id].extend(page["reviews"])
            cursor = page["next_cursor"]
            if cursor is None:
                break

    def calls(items: list[ComparisonSelection]) -> int:
        return len(items) + sum(
            len(
                review_batches(
                    [
                        review
                        for review in reviews[selection.listing_id]
                        if review["variant_id"] == selection.variant_id
                    ]
                )
            )
            for selection in items
        )

    plan = {
        "smoke": calls(SMOKE_SELECTIONS),
        "grounded": calls(selections),
        "free_form": len(selections),
    }
    plan["total"] = sum(plan.values())
    if plan["total"] > MAX_LIVE_REQUESTS:
        raise RuntimeError("Fixture request plan exceeds the approved 36-request ceiling")
    return plan


async def live_predictions(
    provider: CatalogProvider,
    selections: list[ComparisonSelection],
    transport: httpx2.AsyncBaseTransport | None,
    *,
    model_name: str,
) -> dict[str, Any]:
    """Smoke first, then one grounded run and one text-only run; never repair/retry."""
    plan = await request_plan(provider, selections)
    budget = RequestBudget()
    report: dict[str, Any] = {
        "model": model_name,
        "request_plan": plan,
        "request_limit": budget.limit,
        "executed_at_utc": datetime.now(UTC).isoformat(),
        "sdk_version": version("openai"),
        "pydantic_version": version("pydantic"),
        "implementation_sha256": implementation_sha256(),
        "status": "failed",
        "grounded": None,
        "free_form": None,
    }
    async with AsyncOpenAI(
        max_retries=0,
        timeout=OPENAI_REQUEST_TIMEOUT_SECONDS,
        http_client=DefaultAsyncHttpxClient(
            transport=transport, event_hooks={"request": [budget.track]}
        ),
    ) as sdk:
        model = OpenAIModelClient(sdk, model=model_name)
        report["smoke"] = await run_smoke(provider, model)
        smoke_observations = list(model.observations)
        report["smoke"]["response_models"] = sorted(
            {o["response_model"] for o in smoke_observations if o["response_model"] is not None}
        )
        report["smoke"]["tokens"] = token_summary(
            [o["usage"] for o in smoke_observations], len(budget.attempts)
        )
        if report["smoke"]["status"] == "passed":
            budget.stage = "grounded"
            snapshots, latencies = [], []
            builder = EvidenceBuilder(provider, model)
            for offset in range(0, len(selections), 4):
                start = perf_counter()
                snapshot = await builder.build(selections[offset : offset + 4])
                latencies.append((perf_counter() - start) * 1000)
                snapshots.append(snapshot.model_dump(mode="json"))
            report["grounded"] = {
                "prediction": merge_predictions(snapshots),
                "review_statuses": [i["review_status"] for s in snapshots for i in s["items"]],
                "latency_samples_ms": latencies,
                "usages": [o["usage"] for o in model.observations[len(smoke_observations) :]],
                "response_models": sorted(
                    {
                        o["response_model"]
                        for o in model.observations[len(smoke_observations) :]
                        if o["response_model"] is not None
                    }
                ),
            }
            budget.stage = "free_form"
            predictions: dict[str, Any] = {
                "items": [],
                "facts_by_item": {},
                "evidence": {},
                "review_mentions": {},
            }
            outputs, timings = {}, []
            for selection in selections:
                listing = await provider.get_listing(selection.listing_id)
                variant = await provider.get_variant(selection.listing_id, selection.variant_id)
                if listing is None or variant is None:
                    raise ValueError("Evaluation source disappeared after preflight")
                key = f"{selection.listing_id}:{selection.variant_id}"
                evidence = build_evidence_index(listing, variant)
                start = perf_counter()
                output = await free_form_specs(sdk, model_name, key, evidence)
                timings.append((perf_counter() - start) * 1000)
                predictions["items"].append({"item_key": key, **selection.model_dump()})
                predictions["facts_by_item"][key] = output["facts"]
                predictions["evidence"].update({k: v.model_dump() for k, v in evidence.items()})
                outputs[key] = output
            report["free_form"] = {
                "prediction": predictions,
                "outputs": outputs,
                "latency_samples_ms": timings,
            }
            completed = all(
                i["analysis_status"] == "completed"
                for i in report["grounded"]["prediction"]["items"]
            )
            completed &= all(s == "completed" for s in report["grounded"]["review_statuses"])
            completed &= all(o["status"] == "completed" for o in outputs.values())
            report["status"] = "completed" if completed else "partial"
    report["attempts"] = budget.attempts
    report["attempted_requests"] = len(budget.attempts)
    return report


async def evaluate(
    *, live: bool = False, transport: httpx2.AsyncBaseTransport | None = None
) -> dict[str, Any]:
    model_name = None
    if live:
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is required for explicit --live evaluation")
        model_name = os.environ.get("OPENAI_TEXT_MODEL")
        if model_name is None or not model_name.strip():
            raise RuntimeError("OPENAI_TEXT_MODEL is required for explicit --live evaluation")
    provider = MockCatalogProvider()
    listings = await provider.list_listings()
    selections = [
        ComparisonSelection(listing_id=listing.listing_id, variant_id=variant.variant_id)
        for listing in listings
        for variant in listing.variants
    ]
    # Inference finishes before the scorer loads the held-out labels.
    start = perf_counter()
    baseline = await predict(provider, selections)
    elapsed_ms = (perf_counter() - start) * 1000
    measured = (
        await live_predictions(provider, selections, transport, model_name=model_name)
        if model_name is not None
        else None
    )
    labels = json.loads((ROOT / "data/ground_truth.json").read_text())
    try:
        recorded_evidence = await load_recorded_evidence(labels, selections, provider)
        evidence_reason = "No saved live evidence run exists"
    except RecordedEvidenceError as failure:
        recorded_evidence = None
        evidence_reason = str(failure)
    try:
        agent_benchmark = load_agent_benchmark()
        agent_unavailable_reason = "Developer B's paid agent benchmark has not been executed"
    except RuntimeError as failure:
        agent_benchmark = None
        agent_unavailable_reason = str(failure)
    result: dict[str, Any] = {
        "conditions": {
            "synthetic": True,
            "sku_count": len(selections),
            "field_count": 8,
            "source_review_count": len(labels["reviews"]),
            "label_provenance": (
                "Fabricated fixture labels authored in a separate file; "
                "no human adjudication claimed."
            ),
            "labels_supplied_to_extractor": False,
            "source_sha256": {
                name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest()
                for name in SOURCE_NAMES
            },
            "limitations": [
                "Synthetic fixtures do not demonstrate production shopping performance.",
                "Exact-variant accuracy measures ID preservation for explicit selections, "
                "not product recognition.",
                "Review support uses exact aspect/sentiment and literal label-span containment.",
                "One baseline corpus run; runtime is observed wall time, not model latency.",
                "Fixture generation and parsing rules were developed together; "
                "no independent human-labelled test set.",
            ],
        },
        "regex_keyword_baseline": {
            "metrics": score(baseline, labels, selections),
            "observed_corpus_latency_ms": elapsed_ms,
            "tokens": unavailable("No model called for deterministic baseline"),
            "cost": unavailable("No billable model request"),
        },
        "grounded_structured_outputs": unavailable(
            "No new extraction in this invocation; see recorded_evidence_evaluation"
        ),
        "ungrounded_free_form": unavailable(
            "No new extraction in this invocation; see recorded_evidence_evaluation"
        ),
        "recorded_evidence_evaluation": recorded_evidence or unavailable(evidence_reason),
        "friction_proxy": unavailable(
            "Matched manual and agent browser interaction counts have not been measured"
        ),
        "prose_only_agent_baseline": unavailable(
            "No prose-only assistant run on the same twelve scenarios was supplied"
        ),
        "agent_output_evaluation": (
            agent_benchmark.model_dump(mode="json")
            if agent_benchmark is not None
            else unavailable(agent_unavailable_reason)
        ),
    }
    if measured is not None:
        result["live_run"] = {
            k: v for k, v in measured.items() if k not in ("grounded", "free_form")
        }
        if measured["grounded"] is None:
            reason = "Live smoke failed; benchmarks were not attempted"
            result["grounded_structured_outputs"] = unavailable(reason)
            result["ungrounded_free_form"] = unavailable(reason)
            return result
        grounded = measured["grounded"]
        merged = grounded["prediction"]
        latencies = grounded["latency_samples_ms"]
        counts = Counter(a["stage"] for a in measured["attempts"])
        result["grounded_structured_outputs"] = {
            "available": True,
            "model": measured["model"],
            "response_models": grounded["response_models"],
            "status": "completed"
            if all(i["analysis_status"] == "completed" for i in merged["items"])
            and all(s == "completed" for s in grounded["review_statuses"])
            else "partial",
            "metrics": score(merged, labels, selections),
            "prediction": merged,
            "analysis_statuses": [i["analysis_status"] for i in merged["items"]],
            "review_statuses": grounded["review_statuses"],
            "comparison_latency_ms": {
                "samples": latencies,
                "p50": median(latencies),
                "p95_nearest_rank": max(latencies),
                "sample_count": len(latencies),
            },
            "tokens": token_summary(grounded["usages"], counts["grounded"]),
            "cost": unavailable(
                "No verified pricing configured; usage is reported without guessed cost"
            ),
        }
        free_form = measured["free_form"]
        result["ungrounded_free_form"] = {
            "available": True,
            "model": measured["model"],
            "response_models": sorted(
                {
                    o["response_model"]
                    for o in free_form["outputs"].values()
                    if o.get("response_model") is not None
                }
            ),
            "task": "specifications_only",
            "metrics": {
                k: v
                for k, v in score(free_form["prediction"], labels, selections).items()
                if not k.startswith(REVIEW_METRIC_PREFIXES)
            },
            "outputs": free_form["outputs"],
            "prediction": free_form["prediction"],
            "latency_per_item_ms": free_form["latency_samples_ms"],
            "tokens": token_summary(
                [o["usage"] for o in free_form["outputs"].values()], counts["free_form"]
            ),
            "cost": unavailable("No verified pricing configured"),
            "review_metrics": unavailable("Free-form baseline extracts specifications only"),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Spend API credits using real Structured Outputs",
    )
    parser.add_argument("--output", type=Path, default=ROOT / "eval/results.json")
    args = parser.parse_args()
    if args.live:
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        load_dotenv(ROOT / ".env", override=False)
    try:
        result = asyncio.run(evaluate(live=args.live))
    except RuntimeError as failure:
        parser.exit(2, str(failure) + "\n")
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    if args.output.resolve() == ROOT / "eval/results.json":
        (ROOT / "eval/SCORECARD.md").write_text(render_scorecard(result))
    print(
        json.dumps(
            {
                "output": str(args.output),
                "baseline": result["regex_keyword_baseline"]["metrics"],
                "live": result["grounded_structured_outputs"].get("available", False),
                "recorded_evidence": result["recorded_evidence_evaluation"]["available"],
                "agent": result["agent_output_evaluation"].get("available", False),
            },
            indent=2,
        )
    )
    if args.live and result["live_run"]["status"] != "completed":
        parser.exit(2, "Live run failed or was partial; measured artifact retained.\n")


if __name__ == "__main__":
    main()
