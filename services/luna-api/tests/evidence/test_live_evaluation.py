"""Real SDK over in-memory HTTP: no live calls and no generated benchmark artifacts."""

import asyncio
import json
from collections import Counter
from pathlib import Path
from typing import Any

import httpx2
import pytest
from eval.live import RequestBudget, RequestLimitExceeded, free_form_specs, token_summary
from eval.run import evaluate, request_plan
from eval.smoke import check_smoke
from openai import AsyncOpenAI, DefaultAsyncHttpxClient

from app.contracts.evidence import ComparisonEvidence, Evidence
from app.evidence.validate import validate_facts
from app.providers import MockCatalogProvider
from tests.evidence.fakes import FakeModelClient
from tests.evidence.test_pipeline import comparison


def envelope(text: str, *, status: str = "completed") -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "resp_offline",
            "object": "response",
            "created_at": 0,
            "model": "gpt-6-luna",
            "status": status,
            "output": [
                {
                    "id": "msg_offline",
                    "type": "message",
                    "role": "assistant",
                    "status": "completed",
                    "content": [{"type": "output_text", "text": text, "annotations": []}],
                }
            ],
            "usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
        },
    )


class OfflineResponses:
    """Synthesize transport responses from sources using a test-only double."""

    def __init__(self, *, fail_request: int | None = None) -> None:
        self.requests: list[dict[str, Any]] = []
        self.fake = FakeModelClient()
        self.fail_request = fail_request

    async def handle(self, request: httpx2.Request) -> httpx2.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        if len(self.requests) == self.fail_request:
            return httpx2.Response(500, json={"error": {"message": "Injected offline failure"}})
        source = json.loads(body["input"][1]["content"])
        assert "ground_truth" not in json.dumps(source)
        assert "tools" not in body and body["store"] is False
        if "reviews" in source:
            return envelope((await self.fake.extract_reviews(source)).model_dump_json())
        candidates = await self.fake.extract_specs(source)
        if body.get("text", {}).get("format", {}).get("type") == "json_schema":
            return envelope(candidates.model_dump_json())
        # The mock server returns known-valid text. No runtime evaluator imports
        # the fake, and these test scores are never written as model measurements.
        evidence = {s["id"]: Evidence.model_validate(s) for s in source["seller_evidence"]}
        facts = validate_facts(candidates, evidence, source["item_key"], source["variant_id"])
        return envelope(json.dumps({"facts": [f.model_dump() for f in facts]}))


def test_smoke_checks_prescribed_acceptance_cases() -> None:
    assert check_smoke(comparison()) == []
    changed = comparison().model_dump()
    changed["facts_by_item"]["listingA:100w"][1]["value"] = 130
    failures = check_smoke(ComparisonEvidence.model_validate(changed))
    assert "listingA:100w:max_output_w" in failures


def test_smoke_checks_missing_and_conflicting_facts() -> None:
    changed = comparison().model_dump()
    changed["facts_by_item"]["listingC:87w"][3]["status"] = "unresolved"
    changed["facts_by_item"]["listingC:87w"][-1]["conflicting_values"] = ["12", "36"]
    failures = check_smoke(ComparisonEvidence.model_validate(changed))
    assert "missing_weight_abstains" in failures
    assert "warranty_conflict_preserved" in failures


@pytest.mark.parametrize(
    "change,expected",
    [
        ("weight", "listingA:100w:weight_g"),
        ("review_failure", "listingA:100w:review_analysis_completed"),
        ("no_denominator", "listingA:100w:exact_review_coverage"),
    ],
)
def test_smoke_rejects_completed_but_wrong_results(change: str, expected: str) -> None:
    changed = comparison().model_dump()
    if change == "weight":
        changed["facts_by_item"]["listingA:100w"][3]["value"] = 0.42
    elif change == "review_failure":
        changed["items"][0]["review_status"] = "unresolved"
    else:
        changed["items"][0]["review_coverage"]["exact_reviews_analyzed"] = 0
    assert expected in check_smoke(ComparisonEvidence.model_validate(changed))


def test_request_plan_matches_approved_36_calls() -> None:
    async def scenario() -> None:
        provider = MockCatalogProvider()
        selections = [
            {"listing_id": listing["listing_id"], "variant_id": v["variant_id"]}
            for listing in await provider.list_listings()
            for v in listing["variants"]
        ]
        assert await request_plan(provider, selections) == {
            "smoke": 6,
            "grounded": 18,
            "free_form": 12,
            "total": 36,
        }

    asyncio.run(scenario())


def test_budget_blocks_before_37th_transport_request() -> None:
    async def scenario() -> None:
        budget = RequestBudget()
        request = httpx2.Request(
            "POST", "https://api.openai.com/v1/responses", json={"model": "gpt-6-luna"}
        )
        for _ in range(36):
            await budget.track(request)
        with pytest.raises(RequestLimitExceeded):
            await budget.track(request)
        assert len(budget.attempts) == 36

    asyncio.run(scenario())


def test_full_live_runner_offline_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-key")
    server = OfflineResponses()
    read_text = Path.read_text

    def read_after_inference(path: Path, *args: Any, **kwargs: Any) -> str:
        if path.name == "ground_truth.json":
            assert len(server.requests) == 36
        return read_text(path, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", read_after_inference)
    report = asyncio.run(evaluate(live=True, transport=httpx2.MockTransport(server.handle)))
    assert report["live_run"]["status"] == "completed"
    assert report["live_run"]["attempted_requests"] == len(server.requests) == 36
    assert Counter(a["stage"] for a in report["live_run"]["attempts"]) == {
        "smoke": 6,
        "grounded": 18,
        "free_form": 12,
    }
    assert report["grounded_structured_outputs"]["tokens"]["complete"] is True
    assert report["ungrounded_free_form"]["tokens"]["complete"] is True
    assert "review_mention_recall" not in report["ungrounded_free_form"]["metrics"]
    assert report["grounded_structured_outputs"]["comparison_latency_ms"]["sample_count"] == 3
    assert report["grounded_structured_outputs"]["response_models"] == ["gpt-6-luna"]
    assert report["ungrounded_free_form"]["response_models"] == ["gpt-6-luna"]
    assert (
        len(
            ComparisonEvidence.model_validate(
                report["grounded_structured_outputs"]["prediction"]
            ).items
        )
        == 12
    )
    structured: dict[str, Any] = {}
    plain: dict[str, Any] = {}
    for request in server.requests:
        source = json.loads(request["input"][1]["content"])
        if "seller_evidence" in source:
            target = structured if "text" in request else plain
            target[source["item_key"]] = source
    assert structured == plain


def test_failed_smoke_stops_benchmarks_and_does_not_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-key")
    server = OfflineResponses(fail_request=1)
    report = asyncio.run(evaluate(live=True, transport=httpx2.MockTransport(server.handle)))
    assert report["live_run"]["status"] == "failed"
    assert len(server.requests) == report["live_run"]["attempted_requests"] == 6
    assert not report["grounded_structured_outputs"]["available"]
    assert not report["ungrounded_free_form"]["available"]


def test_partial_benchmark_reports_coverage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-key")
    server = OfflineResponses(fail_request=7)
    report = asyncio.run(evaluate(live=True, transport=httpx2.MockTransport(server.handle)))
    grounded = report["grounded_structured_outputs"]
    assert report["live_run"]["status"] == grounded["status"] == "partial"
    assert grounded["analysis_statuses"].count("unresolved") == 1
    assert grounded["tokens"]["complete"] is False
    assert grounded["tokens"]["responses_with_usage"] == 17
    assert report["live_run"]["attempted_requests"] == 36


@pytest.mark.parametrize(
    "text,status,expected",
    [
        ("not json", "completed", "invalid_output"),
        ('{"facts": []}', "completed", "invalid_output"),
        ('{"facts": []}', "incomplete", "incomplete"),
    ],
)
def test_free_form_rejects_malformed_without_repair(
    monkeypatch: pytest.MonkeyPatch, text: str, status: str, expected: str
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-key")
    calls = []

    async def scenario() -> None:
        def handle(request: httpx2.Request) -> httpx2.Response:
            calls.append(json.loads(request.content))
            return envelope(text, status=status)

        async with AsyncOpenAI(
            max_retries=0,
            http_client=DefaultAsyncHttpxClient(transport=httpx2.MockTransport(handle)),
        ) as sdk:
            result = await free_form_specs(sdk, "gpt-6-luna", "listingA:100w", {})
            assert result["status"] == expected and result["facts"] == []
        assert len(calls) == 1 and "text" not in calls[0]

    asyncio.run(scenario())


def test_missing_usage_stays_unknown() -> None:
    summary = token_summary([None], 1)
    assert summary["observed_totals"] == {
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
    }
    assert summary["complete"] is False
    assert token_summary([{"input_tokens": 3}], 1)["observed_totals"]["output_tokens"] is None
