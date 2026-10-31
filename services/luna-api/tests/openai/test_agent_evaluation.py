"""Exercise B's agent evaluator without producing a benchmark artifact."""

import asyncio
import json
from pathlib import Path
from typing import Any, cast

import pytest
from eval.agent import (
    AGENT_SCENARIOS,
    AgentBenchmarkReport,
    load_agent_benchmark,
    run_agent_benchmark,
)
from openai.types.responses import Response


def model_response(response_id: str, output: list[dict[str, object]]) -> Response:
    return Response.model_validate(
        {
            "id": response_id,
            "object": "response",
            "created_at": 0,
            "status": "completed",
            "model": "gpt-6-luna",
            "output": output,
            "parallel_tool_calls": False,
            "tool_choice": "auto",
            "tools": [],
            "usage": {
                "input_tokens": 10,
                "input_tokens_details": {"cache_write_tokens": 0, "cached_tokens": 0},
                "output_tokens": 5,
                "output_tokens_details": {"reasoning_tokens": 0},
                "total_tokens": 15,
            },
        }
    )


def function_response(
    response_id: str,
    call_id: str,
    name: str,
    arguments: dict[str, object],
) -> Response:
    return model_response(
        response_id,
        [
            {
                "id": f"fc_{call_id}",
                "type": "function_call",
                "call_id": call_id,
                "name": name,
                "arguments": json.dumps(arguments),
                "status": "completed",
            }
        ],
    )


def answer_response(
    response_id: str,
    *,
    answer: str,
    cited_ids: list[str],
) -> Response:
    return model_response(
        response_id,
        [
            {
                "id": f"msg_{response_id}",
                "type": "message",
                "status": "completed",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps({"answer": answer, "cited_ids": cited_ids}),
                        "annotations": [],
                    }
                ],
            }
        ],
    )


def _comparison_id(request: dict[str, Any]) -> str:
    tool = next(tool for tool in request["tools"] if tool["name"] == "get_comparison")
    comparison_ids = tool["parameters"]["properties"]["comparison_id"]["enum"]
    return cast(str, comparison_ids[0])


def _expected_revision(request: dict[str, Any]) -> int:
    tool = next(tool for tool in request["tools"] if tool["name"] == "apply_preferences")
    revisions = tool["parameters"]["properties"]["expected_revision"]["enum"]
    return cast(int, revisions[0])


def _snapshot(request: dict[str, Any]) -> dict[str, Any]:
    reference = request["input"][0]["content"]
    return cast(dict[str, Any], json.loads(reference.split("\n", 1)[1]))


class ScriptedAgentResponses:
    """Return known-valid SDK responses for evaluator behavior tests only."""

    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []
        self.scenario_by_response_id: dict[str, str] = {}

    def _scenario_id(self, message: str) -> str:
        phrases = {
            "maximum budget to S$70": "budget_limit",
            "at least 87 watts": "power_threshold",
            "Actually prioritize price": "priority_correction",
            "Which one is best": "unclear_intent",
            "analyzed reviews": "review_query",
            "warranty conflicting": "contradictory_claim",
            "verified weight": "missing_field",
            "invented:999w": "invalid_item",
            "maximum budget to S$50": "no_survivors",
            "review reliability only": "no_comparable_winner",
            "current recommendation": "why_recommendation",
        }
        return next(scenario_id for phrase, scenario_id in phrases.items() if phrase in message)

    def _mutation_patch(self, scenario_id: str) -> dict[str, object]:
        patches: dict[str, dict[str, object]] = {
            "budget_limit": {
                "max_price_minor": 7000,
                "min_output_w": None,
                "priorities": [],
            },
            "power_threshold": {
                "max_price_minor": None,
                "min_output_w": 87,
                "priorities": [],
            },
            "priority_correction": {
                "max_price_minor": None,
                "min_output_w": None,
                "priorities": ["price_minor"],
            },
            "no_survivors": {
                "max_price_minor": 5000,
                "min_output_w": None,
                "priorities": [],
            },
            "no_comparable_winner": {
                "max_price_minor": None,
                "min_output_w": None,
                "priorities": ["review_reliability"],
            },
        }
        return patches[scenario_id]

    def _tool_response(self, request: dict[str, Any], scenario_id: str) -> Response:
        comparison_id = _comparison_id(request)
        response_id = f"resp_{scenario_id}_tool"
        self.scenario_by_response_id[response_id] = scenario_id
        if scenario_id in {
            "budget_limit",
            "power_threshold",
            "priority_correction",
            "no_survivors",
            "no_comparable_winner",
        }:
            return function_response(
                response_id,
                f"call_{scenario_id}",
                "apply_preferences",
                {
                    "comparison_id": comparison_id,
                    "preferences": self._mutation_patch(scenario_id),
                    "expected_revision": _expected_revision(request),
                },
            )
        if scenario_id == "review_query":
            return function_response(
                response_id,
                f"call_{scenario_id}",
                "get_review_aspect",
                {
                    "comparison_id": comparison_id,
                    "aspects": ["heat"],
                    "item_keys": ["listingA:100w", "listingB:65w", "listingC:87w"],
                },
            )
        if scenario_id == "contradictory_claim":
            snapshot = _snapshot(request)
            item = next(item for item in snapshot["items"] if item["item_key"] == "listingC:87w")
            warranty = next(
                fact for fact in item["facts"] if fact["field_key"] == "warranty_months"
            )
            return function_response(
                response_id,
                f"call_{scenario_id}",
                "inspect_evidence",
                {
                    "comparison_id": comparison_id,
                    "evidence_ids": warranty["evidence_ids"],
                },
            )
        return function_response(
            response_id,
            f"call_{scenario_id}",
            "get_comparison",
            {"comparison_id": comparison_id},
        )

    def _answer_citations(self, request: dict[str, Any], scenario_id: str) -> list[str]:
        tool_output = json.loads(request["input"][0]["output"])
        if scenario_id == "review_query":
            return [tool_output["mentions"][0]["id"]]
        if scenario_id == "contradictory_claim":
            return [evidence["id"] for evidence in tool_output["evidence"]]
        if scenario_id == "why_recommendation":
            item = next(item for item in tool_output["items"] if item["item_key"] == "listingB:65w")
            weight = next(fact for fact in item["facts"] if fact["field_key"] == "weight_g")
            return cast(list[str], weight["evidence_ids"])
        return []

    async def create(self, **request: Any) -> Response:
        self.requests.append(request)
        previous_response_id = request.get("previous_response_id")
        if isinstance(previous_response_id, str):
            scenario_id = self.scenario_by_response_id[previous_response_id]
            return answer_response(
                f"resp_{scenario_id}_answer",
                answer=f"Validated answer for {scenario_id}.",
                cited_ids=self._answer_citations(request, scenario_id),
            )
        message = request["input"][-1]["content"]
        return self._tool_response(request, self._scenario_id(message))


def test_agent_benchmark_scores_twelve_server_visible_outcomes() -> None:
    scripted = ScriptedAgentResponses()

    report = asyncio.run(run_agent_benchmark(scripted.create, model="gpt-6-luna"))

    assert report.status == "completed"
    assert report.scenario_count == len(AGENT_SCENARIOS) == 12
    assert report.attempted_requests == len(scripted.requests) == 22
    assert report.request_limit == 44
    assert report.response_models == ["gpt-6-luna"]
    assert all(metric.value == 1 for metric in report.metrics.values())
    assert report.tokens["complete"] is True
    assert report.tokens["observed_totals"] == {
        "input_tokens": 220,
        "output_tokens": 110,
        "total_tokens": 330,
    }
    stale = next(result for result in report.scenarios if result.scenario_id == "stale_turn")
    assert stale.provider_calls == 0
    assert stale.answer is None
    assert stale.checks["expected_error"] is True


def test_agent_benchmark_artifact_rejects_stale_or_invalid_input(tmp_path: Path) -> None:
    scripted = ScriptedAgentResponses()
    report = asyncio.run(run_agent_benchmark(scripted.create, model="gpt-6-luna"))
    report_path = tmp_path / "agent-results.json"
    report_path.write_text(report.model_dump_json(), encoding="utf-8")

    assert load_agent_benchmark(report_path) == report
    stale = report.model_dump(mode="json")
    stale["scenario_suite_sha256"] = "0" * 64
    report_path.write_text(json.dumps(stale), encoding="utf-8")
    with pytest.raises(RuntimeError, match="scenario suite or implementation hash is stale"):
        load_agent_benchmark(report_path)

    report_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError):
        load_agent_benchmark(report_path)
    assert load_agent_benchmark(tmp_path / "missing.json") is None


def test_agent_benchmark_report_forbids_unexpected_fields() -> None:
    with pytest.raises(ValueError):
        AgentBenchmarkReport.model_validate(
            {
                "schema_version": 1,
                "available": True,
                "synthetic": True,
                "status": "completed",
                "unexpected": "provider reasoning",
            }
        )
