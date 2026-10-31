import asyncio
import json
from datetime import UTC, datetime
from typing import Any

import httpx2
import pytest
from openai import APITimeoutError
from openai.types.responses import Response

from app.contracts.session import ComparisonSelection
from app.decision.comparisons import create_comparison, require_comparison
from app.decision.sessions import DemoSessionState
from app.openai.text_agent import (
    ConversationComparisonMismatch,
    LunaAgentTimeout,
    LunaToolCallRejected,
    LunaToolLimitReached,
    run_luna,
)
from tests.decision.fixtures import SELECTIONS, build_fixture_evidence


def model_response(response_id: str, output: list[dict[str, object]]) -> Response:
    """Build a concrete SDK response without a provider call."""
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
        }
    )


def function_response(
    response_id: str,
    call_id: str,
    name: str,
    arguments: dict[str, object],
) -> Response:
    """Build one completed function call using the installed SDK shape."""
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


def answer_response(response_id: str, *, answer: str, cited_ids: list[str]) -> Response:
    """Build one completed structured answer using the installed SDK shape."""
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


async def create_comparison_state() -> tuple[DemoSessionState, str]:
    """Create one comparison over A's immutable fixture."""
    session_state = DemoSessionState(expires_at=datetime.max.replace(tzinfo=UTC))
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    comparison = await create_comparison(
        session_state,
        selections,
        build_evidence=build_fixture_evidence,
    )
    return session_state, comparison.comparison_id


def test_agent_executes_one_mutation_and_returns_only_valid_citations() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        comparison = require_comparison(session_state, comparison_id)
        evidence_id = next(iter(comparison.evidence.evidence))
        provider_responses = [
            function_response(
                "resp_tool",
                "call_apply",
                "apply_preferences",
                {
                    "comparison_id": comparison_id,
                    "patch": {
                        "max_price_minor": 8000,
                        "min_output_w": 65,
                        "priorities": ["weight_g", "price_minor"],
                    },
                    "expected_revision": 0,
                },
            ),
            answer_response(
                "resp_answer",
                answer="The verified comparison was updated.",
                cited_ids=[evidence_id],
            ),
        ]
        provider_requests: list[dict[str, Any]] = []

        async def create_response(**request: Any) -> Response:
            provider_requests.append(request)
            return provider_responses.pop(0)

        result = await run_luna(
            session_state,
            comparison_id=comparison_id,
            conversation_id="conv-1",
            message="Under S$80 and at least 65W; prioritize portability.",
            expected_revision=0,
            create_response=create_response,
            model="gpt-6-luna",
        )

        assert result.conversation_id == "conv-1"
        assert result.cited_ids == [evidence_id]
        assert result.ui_patch is not None
        assert result.ui_patch.new_revision == 1
        assert result.recommendation.item_key == "listingB:65w"
        assert require_comparison(session_state, comparison_id).revision == 1
        assert len(provider_requests) == 2
        assert provider_requests[0]["model"] == "gpt-6-luna"
        assert provider_requests[0]["parallel_tool_calls"] is False
        assert {tool["name"] for tool in provider_requests[0]["tools"]} == {
            "get_comparison",
            "get_review_aspect",
            "apply_preferences",
            "inspect_evidence",
        }
        assert "untrusted" in provider_requests[0]["instructions"].lower()
        assert provider_requests[1]["previous_response_id"] == "resp_tool"
        assert provider_requests[1]["input"][0]["type"] == "function_call_output"

    asyncio.run(scenario())


def test_correction_uses_bounded_history_and_changes_same_comparison() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        captured_requests: list[dict[str, Any]] = []
        provider_responses = [
            answer_response("resp_first", answer="What matters most?", cited_ids=[]),
            function_response(
                "resp_correction_tool",
                "call_correction",
                "apply_preferences",
                {
                    "comparison_id": comparison_id,
                    "patch": {
                        "max_price_minor": None,
                        "min_output_w": None,
                        "priorities": ["price_minor"],
                    },
                    "expected_revision": 0,
                },
            ),
            answer_response("resp_correction_answer", answer="Price is now first.", cited_ids=[]),
        ]

        async def create_response(**request: Any) -> Response:
            captured_requests.append(request)
            return provider_responses.pop(0)

        first = await run_luna(
            session_state,
            comparison_id=comparison_id,
            conversation_id="conv-1",
            message="Pick the best.",
            expected_revision=0,
            create_response=create_response,
            model="gpt-6-luna",
        )
        correction = await run_luna(
            session_state,
            comparison_id=comparison_id,
            conversation_id="conv-1",
            message="Actually prioritize price.",
            expected_revision=0,
            create_response=create_response,
            model="gpt-6-luna",
        )

        assert first.ui_patch is None
        assert correction.ui_patch is not None
        assert correction.ui_patch.new_revision == 1
        assert correction.recommendation.item_key == "listingA:100w"
        second_turn_input = captured_requests[1]["input"]
        assert second_turn_input[0] == {"role": "user", "content": "Pick the best."}
        assert second_turn_input[1] == {
            "role": "assistant",
            "content": "What matters most?",
        }

    asyncio.run(scenario())


def test_agent_replaces_unsupported_citation_with_conservative_answer() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()

        async def create_response(**request: Any) -> Response:
            del request
            return answer_response(
                "resp_invalid_citation",
                answer="Invented product claim.",
                cited_ids=["invented:evidence"],
            )

        result = await run_luna(
            session_state,
            comparison_id=comparison_id,
            conversation_id="conv-1",
            message="Which is best?",
            expected_revision=0,
            create_response=create_response,
            model="gpt-6-luna",
        )

        assert result.cited_ids == []
        assert "could not verify" in result.answer.lower()
        assert "Invented product claim" not in result.answer
        assert result.recommendation.item_key is None

    asyncio.run(scenario())


def test_agent_rejects_made_up_item_before_tool_execution() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()

        async def create_response(**request: Any) -> Response:
            del request
            return function_response(
                "resp_bad_item",
                "call_bad_item",
                "get_review_aspect",
                {
                    "comparison_id": comparison_id,
                    "aspect": "heat",
                    "item_keys": ["invented:item"],
                },
            )

        with pytest.raises(LunaToolCallRejected, match="get_review_aspect"):
            await run_luna(
                session_state,
                comparison_id=comparison_id,
                conversation_id="conv-1",
                message="What do reviews say about heat?",
                expected_revision=0,
                create_response=create_response,
                model="gpt-6-luna",
            )

        assert require_comparison(session_state, comparison_id).revision == 0

    asyncio.run(scenario())


def test_agent_caps_three_tool_rounds_and_four_provider_calls() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        provider_call_count = 0

        async def create_response(**request: Any) -> Response:
            nonlocal provider_call_count
            del request
            provider_call_count += 1
            return function_response(
                f"resp_{provider_call_count}",
                f"call_{provider_call_count}",
                "get_comparison",
                {"comparison_id": comparison_id},
            )

        with pytest.raises(LunaToolLimitReached):
            await run_luna(
                session_state,
                comparison_id=comparison_id,
                conversation_id="conv-1",
                message="Keep checking forever.",
                expected_revision=0,
                create_response=create_response,
                model="gpt-6-luna",
            )

        assert provider_call_count == 4

    asyncio.run(scenario())


def test_timeout_after_mutation_preserves_state_and_marks_action_complete() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        provider_call_count = 0

        async def create_response(**request: Any) -> Response:
            nonlocal provider_call_count
            del request
            provider_call_count += 1
            if provider_call_count == 1:
                return function_response(
                    "resp_apply",
                    "call_apply",
                    "apply_preferences",
                    {
                        "comparison_id": comparison_id,
                        "patch": {
                            "max_price_minor": 8000,
                            "min_output_w": None,
                            "priorities": ["price_minor"],
                        },
                        "expected_revision": 0,
                    },
                )
            raise APITimeoutError(request=httpx2.Request("POST", "https://api.openai.com"))

        with pytest.raises(LunaAgentTimeout) as timeout:
            await run_luna(
                session_state,
                comparison_id=comparison_id,
                conversation_id="conv-1",
                message="Under S$80, prioritize price.",
                expected_revision=0,
                create_response=create_response,
                model="gpt-6-luna",
            )

        assert timeout.value.action_completed is True
        assert timeout.value.current_revision == 1
        assert require_comparison(session_state, comparison_id).revision == 1

    asyncio.run(scenario())


def test_conversation_cannot_cross_comparisons() -> None:
    async def scenario() -> None:
        session_state, first_comparison_id = await create_comparison_state()
        selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
        second = await create_comparison(
            session_state,
            selections,
            build_evidence=build_fixture_evidence,
        )
        provider_responses = [
            answer_response("resp_first", answer="First comparison.", cited_ids=[]),
        ]

        async def create_response(**request: Any) -> Response:
            del request
            return provider_responses.pop(0)

        await run_luna(
            session_state,
            comparison_id=first_comparison_id,
            conversation_id="conv-1",
            message="Compare these.",
            expected_revision=0,
            create_response=create_response,
            model="gpt-6-luna",
        )

        with pytest.raises(ConversationComparisonMismatch):
            await run_luna(
                session_state,
                comparison_id=second.comparison_id,
                conversation_id="conv-1",
                message="Now compare these.",
                expected_revision=0,
                create_response=create_response,
                model="gpt-6-luna",
            )

    asyncio.run(scenario())
