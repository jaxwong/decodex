"""Run and validate B's bounded real-model shopping-agent benchmark."""

import argparse
import asyncio
import hashlib
import json
import logging
import os
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import median
from time import perf_counter
from typing import Any, Literal

from dotenv import load_dotenv
from eval.live import RequestLimitExceeded, token_summary
from eval.metrics import ratio
from openai import AsyncOpenAI
from openai.types.responses import Response, ResponseFunctionToolCall
from pydantic import BaseModel, ConfigDict

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection
from app.contracts.session import Preferences
from app.decision.comparisons import create_comparison, require_comparison
from app.decision.sessions import DemoSessionState
from app.decision.tools import RevisionConflict, apply_preferences
from app.openai.runtime import OPENAI_REQUEST_TIMEOUT_SECONDS, CreateModelResponse
from app.openai.text_agent import (
    MAX_PROVIDER_CALLS,
    ConversationComparisonMismatch,
    LunaAgentContractError,
    LunaAgentTimeout,
    LunaAgentUnavailable,
    LunaToolCallRejected,
    LunaToolLimitReached,
    run_luna,
)

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = ROOT / "data" / "sample_comparison_evidence.json"
AGENT_REPORT_PATH = ROOT / "eval" / "agent-results.json"
TEXT_AGENT_PATH = ROOT / "services" / "luna-api" / "app" / "openai" / "text_agent.py"
SCENARIO_SUITE_VERSION: Literal[1] = 1
MAX_AGENT_REQUESTS = 44
type ToolName = Literal[
    "get_comparison",
    "get_review_aspect",
    "apply_preferences",
    "inspect_evidence",
]
type CitationRule = Literal[
    "optional",
    "none",
    "heat_mentions",
    "warranty_conflict",
    "any_evidence",
]

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class AgentScenario:
    """One buyer utterance and its expected server-owned outcome."""

    scenario_id: str
    message: str
    setup_preferences: Preferences | None
    expected_request_revision: int
    expected_preferences: Preferences
    expected_revision: int
    expected_recommendation_item_key: str | None
    expected_excluded_item_keys: tuple[str, ...]
    expected_uncertain_item_keys: tuple[str, ...]
    required_tools: tuple[ToolName, ...]
    citation_rule: CitationRule
    is_state_correction: bool = False
    expects_stale_rejection: bool = False


def _preferences(
    *,
    max_price_minor: int | None = None,
    min_output_w: int | None = None,
    priorities: list[str] | None = None,
) -> Preferences:
    return Preferences.model_validate(
        {
            "max_price_minor": max_price_minor,
            "min_output_w": min_output_w,
            "priorities": priorities or [],
        }
    )


AGENT_SCENARIOS = (
    AgentScenario(
        scenario_id="budget_limit",
        message=(
            "Set my maximum budget to S$70. Keep minimum power unset and use no ranking priorities."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(max_price_minor=7000),
        expected_revision=1,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=("listingC:87w",),
        expected_uncertain_item_keys=(),
        required_tools=("apply_preferences",),
        citation_rule="optional",
    ),
    AgentScenario(
        scenario_id="power_threshold",
        message=("Require at least 87 watts. Keep the budget unset and use no ranking priorities."),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(min_output_w=87),
        expected_revision=1,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=("listingB:65w",),
        expected_uncertain_item_keys=(),
        required_tools=("apply_preferences",),
        citation_rule="optional",
    ),
    AgentScenario(
        scenario_id="priority_correction",
        message="Actually prioritize price only. Keep budget and minimum power unset.",
        setup_preferences=Preferences(priorities=["weight_g"]),
        expected_request_revision=1,
        expected_preferences=_preferences(priorities=["price_minor"]),
        expected_revision=2,
        expected_recommendation_item_key="listingA:100w",
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("apply_preferences",),
        citation_rule="optional",
        is_state_correction=True,
    ),
    AgentScenario(
        scenario_id="unclear_intent",
        message="Which one is best?",
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(),
        expected_revision=0,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("get_comparison",),
        citation_rule="optional",
    ),
    AgentScenario(
        scenario_id="review_query",
        message=(
            "What do the analyzed reviews mention about heat for all three items? "
            "Use review evidence and cite supporting review mention IDs."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(),
        expected_revision=0,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("get_review_aspect",),
        citation_rule="heat_mentions",
    ),
    AgentScenario(
        scenario_id="contradictory_claim",
        message=(
            "Why is listingC:87w warranty conflicting? Inspect the stored evidence and cite "
            "both conflicting source IDs."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(),
        expected_revision=0,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("inspect_evidence",),
        citation_rule="warranty_conflict",
    ),
    AgentScenario(
        scenario_id="missing_field",
        message=(
            "Does listingC:87w have a verified weight? Do not infer it. Cite evidence only "
            "if weight evidence exists."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(),
        expected_revision=0,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("get_comparison",),
        citation_rule="none",
    ),
    AgentScenario(
        scenario_id="stale_turn",
        message="Actually raise my maximum budget to S$80.",
        setup_preferences=Preferences(max_price_minor=7000),
        expected_request_revision=0,
        expected_preferences=_preferences(max_price_minor=7000),
        expected_revision=1,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=("listingC:87w",),
        expected_uncertain_item_keys=(),
        required_tools=(),
        citation_rule="optional",
        expects_stale_rejection=True,
    ),
    AgentScenario(
        scenario_id="invalid_item",
        message=("What is the maximum output of invented:999w? Do not substitute another item."),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(),
        expected_revision=0,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("get_comparison",),
        citation_rule="none",
    ),
    AgentScenario(
        scenario_id="no_survivors",
        message=(
            "Set my maximum budget to S$50. Keep minimum power unset and use no ranking priorities."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(max_price_minor=5000),
        expected_revision=1,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=("listingA:100w", "listingB:65w", "listingC:87w"),
        expected_uncertain_item_keys=(),
        required_tools=("apply_preferences",),
        citation_rule="optional",
    ),
    AgentScenario(
        scenario_id="no_comparable_winner",
        message=(
            "Prioritize review reliability only. If it cannot determine a winner, do not "
            "invent one."
        ),
        setup_preferences=None,
        expected_request_revision=0,
        expected_preferences=_preferences(priorities=["review_reliability"]),
        expected_revision=1,
        expected_recommendation_item_key=None,
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=(),
        required_tools=("apply_preferences",),
        citation_rule="optional",
    ),
    AgentScenario(
        scenario_id="why_recommendation",
        message=(
            "Why is the current recommendation best for portability? Use comparison facts "
            "and cite stored evidence."
        ),
        setup_preferences=Preferences(priorities=["weight_g"]),
        expected_request_revision=1,
        expected_preferences=_preferences(priorities=["weight_g"]),
        expected_revision=1,
        expected_recommendation_item_key="listingB:65w",
        expected_excluded_item_keys=(),
        expected_uncertain_item_keys=("listingC:87w",),
        required_tools=("get_comparison",),
        citation_rule="any_evidence",
    ),
)


class _ReportModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class Metric(_ReportModel):
    value: float | None
    numerator: int
    denominator: int


class AgentRequestAttempt(_ReportModel):
    scenario_id: str
    model: str


class AgentScenarioResult(_ReportModel):
    scenario_id: str
    message: str
    status: Literal["passed", "failed"]
    answer: str | None
    cited_ids: list[str]
    tool_names: list[str]
    provider_calls: int
    latency_ms: float
    revision: int
    preferences: Preferences
    recommendation_item_key: str | None
    excluded_item_keys: list[str]
    uncertain_item_keys: list[str]
    checks: dict[str, bool]
    error: str | None


class AgentBenchmarkReport(_ReportModel):
    schema_version: Literal[1]
    available: Literal[True]
    synthetic: Literal[True]
    status: Literal["completed", "partial"]
    executed_at_utc: str
    model: str
    response_models: list[str]
    scenario_count: int
    request_limit: int
    attempted_requests: int
    request_attempts: list[AgentRequestAttempt]
    evidence_sha256: str
    scenario_suite_sha256: str
    metrics: dict[str, Metric]
    latency_ms: dict[str, float | int | list[float]]
    tokens: dict[str, Any]
    scenarios: list[AgentScenarioResult]
    limitations: list[str]


EXPECTED_AGENT_FAILURES = (
    ConversationComparisonMismatch,
    LunaAgentContractError,
    LunaAgentTimeout,
    LunaAgentUnavailable,
    LunaToolCallRejected,
    LunaToolLimitReached,
)


def _evidence_sha256() -> str:
    return hashlib.sha256(EVIDENCE_PATH.read_bytes()).hexdigest()


def _scenario_suite_sha256() -> str:
    values = {
        "scenarios": [
            {
                "scenario_id": scenario.scenario_id,
                "message": scenario.message,
                "setup_preferences": (
                    scenario.setup_preferences.model_dump(mode="json")
                    if scenario.setup_preferences is not None
                    else None
                ),
                "expected_request_revision": scenario.expected_request_revision,
                "expected_preferences": scenario.expected_preferences.model_dump(mode="json"),
                "expected_revision": scenario.expected_revision,
                "expected_recommendation_item_key": scenario.expected_recommendation_item_key,
                "expected_excluded_item_keys": scenario.expected_excluded_item_keys,
                "expected_uncertain_item_keys": scenario.expected_uncertain_item_keys,
                "required_tools": scenario.required_tools,
                "citation_rule": scenario.citation_rule,
                "is_state_correction": scenario.is_state_correction,
                "expects_stale_rejection": scenario.expects_stale_rejection,
            }
            for scenario in AGENT_SCENARIOS
        ],
        "text_agent_sha256": hashlib.sha256(TEXT_AGENT_PATH.read_bytes()).hexdigest(),
    }
    return hashlib.sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


async def _build_sample_evidence(
    selections: Sequence[ComparisonSelection],
) -> ComparisonEvidence:
    evidence = ComparisonEvidence.model_validate_json(EVIDENCE_PATH.read_text(encoding="utf-8"))
    requested_item_keys = {
        f"{selection.listing_id}:{selection.variant_id}" for selection in selections
    }
    evidence_item_keys = {item.item_key for item in evidence.items}
    if requested_item_keys != evidence_item_keys:
        raise RuntimeError("Agent benchmark selections differ from sample_comparison_evidence.json")
    return evidence


async def _create_scenario_state(
    scenario: AgentScenario,
) -> tuple[DemoSessionState, str]:
    evidence = ComparisonEvidence.model_validate_json(EVIDENCE_PATH.read_text(encoding="utf-8"))
    selections = [
        ComparisonSelection(listing_id=item.listing_id, variant_id=item.variant_id)
        for item in evidence.items
    ]
    session_state = DemoSessionState(expires_at=datetime.max.replace(tzinfo=UTC))
    comparison = await create_comparison(
        session_state,
        selections,
        build_evidence=_build_sample_evidence,
    )
    if scenario.setup_preferences is not None:
        apply_preferences(
            session_state,
            comparison.comparison_id,
            preferences=scenario.setup_preferences,
            expected_revision=0,
        )
    return session_state, comparison.comparison_id


def _citation_check(
    scenario: AgentScenario,
    evidence: ComparisonEvidence,
    cited_ids: list[str],
) -> bool:
    known_ids = set(evidence.evidence) | set(evidence.review_mentions)
    if not set(cited_ids) <= known_ids:
        return False
    if scenario.citation_rule == "optional":
        return True
    if scenario.citation_rule == "none":
        return not cited_ids
    if scenario.citation_rule == "heat_mentions":
        heat_ids = {
            mention_id
            for mention_id, mention in evidence.review_mentions.items()
            if mention.aspect == "heat"
        }
        return bool(cited_ids) and bool(set(cited_ids) & heat_ids)
    if scenario.citation_rule == "warranty_conflict":
        warranty = next(
            fact
            for fact in evidence.facts_by_item["listingC:87w"]
            if fact.field_key == "warranty_months"
        )
        return set(warranty.evidence_ids) <= set(cited_ids)
    return bool(cited_ids) and bool(set(cited_ids) & set(evidence.evidence))


def _metric(numerator: int, denominator: int) -> Metric:
    return Metric.model_validate(ratio(numerator, denominator))


async def run_agent_benchmark(
    create_response: CreateModelResponse,
    *,
    model: str,
) -> AgentBenchmarkReport:
    """Execute each scenario once with no retry and score only server-visible outcomes."""
    if not model.strip():
        raise ValueError("Agent benchmark model must not be blank")

    attempted_requests: list[AgentRequestAttempt] = []
    usages: list[dict[str, Any] | None] = []
    response_models: set[str] = set()
    scenario_tools: dict[str, list[str]] = {}
    active_scenario_id = ""

    async def bounded_create_response(**request: Any) -> Response:
        if len(attempted_requests) >= MAX_AGENT_REQUESTS:
            raise RequestLimitExceeded("Approved agent benchmark request limit reached")
        request_model = request.get("model")
        if not isinstance(request_model, str):
            raise RuntimeError("Agent benchmark request omitted its model")
        attempted_requests.append(
            AgentRequestAttempt(scenario_id=active_scenario_id, model=request_model)
        )
        usages.append(None)
        logger.info(
            "Agent benchmark request %s/%s scenario_id=%s",
            len(attempted_requests),
            MAX_AGENT_REQUESTS,
            active_scenario_id,
        )
        response = await create_response(**request)
        usages[-1] = response.usage.model_dump() if response.usage is not None else None
        response_models.add(response.model)
        scenario_tools.setdefault(active_scenario_id, []).extend(
            output.name
            for output in response.output
            if isinstance(output, ResponseFunctionToolCall)
        )
        return response

    scenario_results: list[AgentScenarioResult] = []
    for scenario in AGENT_SCENARIOS:
        active_scenario_id = scenario.scenario_id
        session_state, comparison_id = await _create_scenario_state(scenario)
        before_calls = len(attempted_requests)
        started_at = perf_counter()
        answer: str | None = None
        cited_ids: list[str] = []
        failure_name: str | None = None
        stale_rejected = False
        try:
            response = await run_luna(
                session_state,
                comparison_id=comparison_id,
                conversation_id=f"benchmark-{scenario.scenario_id}",
                message=scenario.message,
                expected_revision=scenario.expected_request_revision,
                create_response=bounded_create_response,
                model=model,
            )
            answer = response.answer
            cited_ids = response.cited_ids
        except RevisionConflict:
            if not scenario.expects_stale_rejection:
                raise
            stale_rejected = True
        except EXPECTED_AGENT_FAILURES as failure:
            failure_name = type(failure).__name__

        comparison = require_comparison(session_state, comparison_id)
        provider_calls = len(attempted_requests) - before_calls
        tools = scenario_tools.get(scenario.scenario_id, [])
        state_matches = (
            comparison.revision == scenario.expected_revision
            and comparison.preferences == scenario.expected_preferences
            and comparison.recommendation.item_key == scenario.expected_recommendation_item_key
            and tuple(comparison.recommendation.excluded_item_keys)
            == scenario.expected_excluded_item_keys
            and tuple(comparison.recommendation.uncertain_item_keys)
            == scenario.expected_uncertain_item_keys
        )
        tool_matches = set(scenario.required_tools) <= set(tools)
        citation_matches = _citation_check(scenario, comparison.evidence, cited_ids)
        error_matches = (
            stale_rejected and failure_name is None and provider_calls == 0
            if scenario.expects_stale_rejection
            else failure_name is None and not stale_rejected and answer is not None
        )
        checks = {
            "state": state_matches,
            "tools": tool_matches,
            "citations": citation_matches,
            "expected_error": error_matches,
            "provider_call_limit": provider_calls <= MAX_PROVIDER_CALLS,
        }
        scenario_results.append(
            AgentScenarioResult(
                scenario_id=scenario.scenario_id,
                message=scenario.message,
                status="passed" if all(checks.values()) else "failed",
                answer=answer,
                cited_ids=cited_ids,
                tool_names=tools,
                provider_calls=provider_calls,
                latency_ms=(perf_counter() - started_at) * 1000,
                revision=comparison.revision,
                preferences=comparison.preferences,
                recommendation_item_key=comparison.recommendation.item_key,
                excluded_item_keys=comparison.recommendation.excluded_item_keys,
                uncertain_item_keys=comparison.recommendation.uncertain_item_keys,
                checks=checks,
                error=failure_name,
            )
        )

    tool_results = [
        result.checks["tools"]
        for scenario, result in zip(AGENT_SCENARIOS, scenario_results, strict=True)
        if scenario.required_tools
    ]
    citation_results = [
        result.checks["citations"]
        for scenario, result in zip(AGENT_SCENARIOS, scenario_results, strict=True)
        if scenario.citation_rule != "optional"
    ]
    correction_results = [
        result.status == "passed"
        for scenario, result in zip(AGENT_SCENARIOS, scenario_results, strict=True)
        if scenario.is_state_correction
    ]
    stale_results = [
        result.status == "passed"
        for scenario, result in zip(AGENT_SCENARIOS, scenario_results, strict=True)
        if scenario.expects_stale_rejection
    ]
    provider_latencies = [
        result.latency_ms for result in scenario_results if result.provider_calls > 0
    ]
    passed_count = sum(result.status == "passed" for result in scenario_results)
    report_status: Literal["completed", "partial"] = (
        "completed" if passed_count == len(scenario_results) else "partial"
    )
    return AgentBenchmarkReport(
        schema_version=SCENARIO_SUITE_VERSION,
        available=True,
        synthetic=True,
        status=report_status,
        executed_at_utc=datetime.now(UTC).isoformat(),
        model=model,
        response_models=sorted(response_models),
        scenario_count=len(AGENT_SCENARIOS),
        request_limit=MAX_AGENT_REQUESTS,
        attempted_requests=len(attempted_requests),
        request_attempts=attempted_requests,
        evidence_sha256=_evidence_sha256(),
        scenario_suite_sha256=_scenario_suite_sha256(),
        metrics={
            "scenario_success": _metric(passed_count, len(scenario_results)),
            "tool_success": _metric(sum(tool_results), len(tool_results)),
            "ui_outcome_success": _metric(
                sum(result.checks["state"] for result in scenario_results),
                len(scenario_results),
            ),
            "citation_behavior_success": _metric(sum(citation_results), len(citation_results)),
            "state_correction_success": _metric(sum(correction_results), len(correction_results)),
            "stale_turn_protection": _metric(sum(stale_results), len(stale_results)),
        },
        latency_ms={
            "samples": provider_latencies,
            "p50": median(provider_latencies),
            "p95_nearest_rank": max(provider_latencies),
            "sample_count": len(provider_latencies),
        },
        tokens=token_summary(usages, len(attempted_requests)),
        scenarios=scenario_results,
        limitations=[
            "Synthetic evidence and scripted utterances do not measure production shopping value.",
            "One real-model run per utterance; no retries, repair pass, or alternate model.",
            "The frozen fixture has no objective value tie; no_comparable_winner measures "
            "abstention when review reliability cannot produce an objective ranking.",
            "Latency is observed wall time for one run, not a production SLO.",
            "Cost is unavailable because no verified price table is configured.",
        ],
    )


def load_agent_benchmark(path: Path = AGENT_REPORT_PATH) -> AgentBenchmarkReport | None:
    """Load the paid artifact or reject it when evidence, scenarios, or agent changed."""
    if not path.exists():
        return None
    report = AgentBenchmarkReport.model_validate_json(path.read_text(encoding="utf-8"))
    if report.evidence_sha256 != _evidence_sha256():
        raise RuntimeError("Agent benchmark evidence hash is stale")
    if report.scenario_suite_sha256 != _scenario_suite_sha256():
        raise RuntimeError("Agent benchmark scenario suite or implementation hash is stale")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        required=True,
        help="Authorize at most 44 actual Responses calls",
    )
    parser.parse_args()
    load_dotenv(ROOT / ".env", override=False)
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_TEXT_MODEL")
    if api_key is None or not api_key.strip():
        parser.exit(2, "OPENAI_API_KEY missing: agent benchmark not executed.\n")
    if model is None or not model.strip():
        parser.exit(2, "OPENAI_TEXT_MODEL missing: agent benchmark not executed.\n")

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    async def execute() -> AgentBenchmarkReport:
        async with AsyncOpenAI(
            api_key=api_key,
            max_retries=0,
            timeout=OPENAI_REQUEST_TIMEOUT_SECONDS,
        ) as sdk:
            return await run_agent_benchmark(sdk.responses.create, model=model)

    report = asyncio.run(execute())
    AGENT_REPORT_PATH.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(AGENT_REPORT_PATH),
                "status": report.status,
                "scenario_success": report.metrics["scenario_success"].model_dump(),
                "attempted_requests": report.attempted_requests,
                "request_limit": report.request_limit,
            },
            indent=2,
        )
    )
    if report.status != "completed":
        parser.exit(2, "Agent benchmark was partial; measured artifact retained.\n")


if __name__ == "__main__":
    main()
