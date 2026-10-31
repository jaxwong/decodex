import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

from openai import AsyncOpenAI
from openai.resources.live.sideband import AsyncSidebandConnection
from openai.types.live import DelegationCreatedEvent, LiveCreateResponse, ResponseEvent

from app.contracts.session import ComparisonSelection
from app.decision.comparisons import create_comparison, require_comparison
from app.decision.sessions import DemoSessionState
from app.openai.capability_smoke import build_live_audio_offer_sdp
from app.openai.live_agent import run_live_sideband, start_live_session
from tests.decision.fixtures import SELECTIONS, build_fixture_evidence


class FakeSidebandConnection:
    """Record SDK-shaped sideband sends while yielding fixed server events."""

    def __init__(self, events: list[object]) -> None:
        self.events = events
        self.sent: list[dict[str, Any]] = []
        self.closed = False

    async def send(self, event: dict[str, Any]) -> None:
        self.sent.append(event)

    async def close(self) -> None:
        self.closed = True

    async def __aiter__(self) -> AsyncIterator[object]:
        for event in self.events:
            yield event


class FakeSidebandManager:
    def __init__(self, connection: FakeSidebandConnection) -> None:
        self.connection = connection

    async def enter(self) -> FakeSidebandConnection:
        return self.connection


class FakeSideband:
    def __init__(self, connection: FakeSidebandConnection) -> None:
        self.connection = connection
        self.requests: list[dict[str, Any]] = []

    def connect(self, **request: Any) -> FakeSidebandManager:
        self.requests.append(request)
        return FakeSidebandManager(self.connection)


class FakeLive:
    def __init__(self, connection: FakeSidebandConnection) -> None:
        self.sideband = FakeSideband(connection)
        self.requests: list[dict[str, Any]] = []

    async def create(self, **request: Any) -> LiveCreateResponse:
        self.requests.append(request)
        return LiveCreateResponse.model_validate(
            {
                "session": {"id": "live_test"},
                "transport": {"type": "webrtc", "sdp": "provider-answer-sdp"},
            }
        )


class FakeOpenAIClient:
    def __init__(self, connection: FakeSidebandConnection) -> None:
        self.live = FakeLive(connection)


async def create_comparison_state() -> tuple[DemoSessionState, str]:
    """Create one session-owned comparison over A's immutable fixture."""
    session_state = DemoSessionState(expires_at=datetime.max.replace(tzinfo=UTC))
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    comparison = await create_comparison(
        session_state,
        selections,
        build_evidence=build_fixture_evidence,
    )
    return session_state, comparison.comparison_id


def delegation_event(delegation_id: str, response_id: str) -> DelegationCreatedEvent:
    return DelegationCreatedEvent.model_validate(
        {
            "type": "session.delegation.created",
            "event_id": f"event_{delegation_id}",
            "offset_ms": 100,
            "delegation": {
                "id": delegation_id,
                "type": "delegation",
                "target": "responses",
                "response_id": response_id,
            },
        }
    )


def response_event(
    delegation_id: str,
    *,
    nested_type: str,
    item: dict[str, object] | None = None,
) -> ResponseEvent:
    nested_event: dict[str, object] = {
        "type": nested_type,
        "sequence_number": 1,
        "output_index": 0,
    }
    if item is not None:
        nested_event["item"] = item
    else:
        nested_event.update(
            {
                "item_id": "fc_delta",
                "delta": "{",
            }
        )
    return ResponseEvent.model_validate(
        {
            "type": "response.event",
            "event_id": f"event_{nested_type}",
            "delegation_id": delegation_id,
            "event": nested_event,
        }
    )


def function_call_item(
    call_id: str,
    name: str,
    arguments: dict[str, object],
) -> dict[str, object]:
    return {
        "id": f"fc_{call_id}",
        "type": "function_call",
        "call_id": call_id,
        "name": name,
        "arguments": json.dumps(arguments),
        "status": "completed",
    }


def closed_event() -> SimpleNamespace:
    return SimpleNamespace(type="session.closed")


def test_start_live_session_uses_one_create_and_zero_retry_sideband_attach() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        connection = FakeSidebandConnection([])
        fake_client = FakeOpenAIClient(connection)
        offer_sdp = build_live_audio_offer_sdp()

        response = await start_live_session(
            cast(AsyncOpenAI, fake_client),
            session_state,
            comparison_id=comparison_id,
            offer_sdp=offer_sdp,
            live_model="gpt-live-1",
            text_model="gpt-6-luna",
        )
        await asyncio.sleep(0)
        await asyncio.sleep(0)

        assert response.session.id == "live_test"
        assert response.transport.sdp == "provider-answer-sdp"
        assert len(fake_client.live.requests) == 1
        create_request = fake_client.live.requests[0]
        assert create_request["transport"] == {"type": "webrtc", "sdp": offer_sdp}
        session = create_request["session"]
        assert session["model"] == "gpt-live-1"
        assert "<|SpawnThinking|>" in session["instructions"]
        delegation = session["delegation"]
        assert delegation["type"] == "responses"
        backend = delegation["responses"]
        assert backend["model"] == "gpt-6-luna"
        assert backend["parallel_tool_calls"] is False
        assert {tool["name"] for tool in backend["tools"]} == {
            "get_comparison",
            "get_review_aspect",
            "apply_preferences",
            "inspect_evidence",
        }
        assert comparison_id in backend["instructions"]
        assert "untrusted" in backend["instructions"].lower()
        assert "source_text" not in backend["instructions"]
        apply_tool = next(tool for tool in backend["tools"] if tool["name"] == "apply_preferences")
        assert apply_tool["parameters"]["properties"]["expected_revision"]["enum"] == [0]
        assert fake_client.live.sideband.requests == [{"session_id": "live_test", "max_retries": 0}]
        assert connection.closed is True
        assert session_state.live_sessions == {}

    asyncio.run(scenario())


def test_sideband_executes_only_completed_calls_and_supports_second_correction() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        first_call = function_call_item(
            "call_first",
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
        )
        second_call = function_call_item(
            "call_second",
            "apply_preferences",
            {
                "comparison_id": comparison_id,
                "patch": {
                    "max_price_minor": 8000,
                    "min_output_w": 65,
                    "priorities": ["price_minor"],
                },
                "expected_revision": 1,
            },
        )
        connection = FakeSidebandConnection(
            [
                delegation_event("delegation_first", "resp_first"),
                response_event(
                    "delegation_first",
                    nested_type="response.function_call_arguments.delta",
                ),
                response_event(
                    "delegation_first",
                    nested_type="response.output_item.done",
                    item=first_call,
                ),
                delegation_event("delegation_second", "resp_second"),
                response_event(
                    "delegation_second",
                    nested_type="response.output_item.done",
                    item=second_call,
                ),
                closed_event(),
            ]
        )

        await run_live_sideband(
            cast(AsyncSidebandConnection, connection),
            session_state,
            session_id="live_test",
            comparison_id=comparison_id,
            text_model="gpt-6-luna",
        )

        comparison = require_comparison(session_state, comparison_id)
        assert comparison.revision == 2
        assert comparison.preferences.priorities == ["price_minor"]
        assert [event["type"] for event in connection.sent] == [
            "session.update",
            "response.item.create",
            "response.create",
            "session.update",
            "response.item.create",
            "response.create",
        ]
        update_events = [event for event in connection.sent if event["type"] == "session.update"]
        first_tools = update_events[0]["session"]["delegation"]["responses"]["tools"]
        second_tools = update_events[1]["session"]["delegation"]["responses"]["tools"]
        first_apply = next(tool for tool in first_tools if tool["name"] == "apply_preferences")
        second_apply = next(tool for tool in second_tools if tool["name"] == "apply_preferences")
        assert first_apply["parameters"]["properties"]["expected_revision"]["enum"] == [1]
        assert second_apply["parameters"]["properties"]["expected_revision"]["enum"] == [2]
        tool_outputs = [
            json.loads(event["item"]["output"])
            for event in connection.sent
            if event["type"] == "response.item.create"
        ]
        assert [output["result"]["ui_patch"]["new_revision"] for output in tool_outputs] == [
            1,
            2,
        ]
        assert connection.closed is True

    asyncio.run(scenario())


def test_sideband_deduplicates_call_id_before_second_execution() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        call = function_call_item(
            "call_duplicate",
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
        done = response_event(
            "delegation_one",
            nested_type="response.output_item.done",
            item=call,
        )
        connection = FakeSidebandConnection(
            [
                delegation_event("delegation_one", "resp_one"),
                done,
                done,
                closed_event(),
            ]
        )

        await run_live_sideband(
            cast(AsyncSidebandConnection, connection),
            session_state,
            session_id="live_test",
            comparison_id=comparison_id,
            text_model="gpt-6-luna",
        )

        assert require_comparison(session_state, comparison_id).revision == 1
        assert [event["type"] for event in connection.sent].count("response.item.create") == 1
        assert [event["type"] for event in connection.sent].count("response.create") == 1

    asyncio.run(scenario())


def test_sideband_returns_structured_tool_error_for_unknown_item() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        call = function_call_item(
            "call_unknown",
            "get_review_aspect",
            {
                "comparison_id": comparison_id,
                "aspect": "heat",
                "item_keys": ["invented:item"],
            },
        )
        connection = FakeSidebandConnection(
            [
                delegation_event("delegation_one", "resp_one"),
                response_event(
                    "delegation_one",
                    nested_type="response.output_item.done",
                    item=call,
                ),
                closed_event(),
            ]
        )

        await run_live_sideband(
            cast(AsyncSidebandConnection, connection),
            session_state,
            session_id="live_test",
            comparison_id=comparison_id,
            text_model="gpt-6-luna",
        )

        output_event = next(
            event for event in connection.sent if event["type"] == "response.item.create"
        )
        output = json.loads(output_event["item"]["output"])
        assert output == {
            "ok": False,
            "error": {
                "code": "INVALID_TOOL_ARGUMENTS",
                "message": "The tool referenced data outside this comparison.",
                "retryable": False,
            },
        }
        assert require_comparison(session_state, comparison_id).revision == 0
        assert [event["type"] for event in connection.sent].count("response.create") == 1

    asyncio.run(scenario())


def test_sideband_caps_tool_execution_at_three_rounds_per_delegation() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        events: list[object] = [delegation_event("delegation_one", "resp_one")]
        for call_number in range(1, 5):
            events.append(
                response_event(
                    "delegation_one",
                    nested_type="response.output_item.done",
                    item=function_call_item(
                        f"call_{call_number}",
                        "get_comparison",
                        {"comparison_id": comparison_id},
                    ),
                )
            )
        events.append(closed_event())
        connection = FakeSidebandConnection(events)

        await run_live_sideband(
            cast(AsyncSidebandConnection, connection),
            session_state,
            session_id="live_test",
            comparison_id=comparison_id,
            text_model="gpt-6-luna",
        )

        outputs = [
            json.loads(event["item"]["output"])
            for event in connection.sent
            if event["type"] == "response.item.create"
        ]
        assert [output["ok"] for output in outputs] == [True, True, True, False]
        assert outputs[-1]["error"]["code"] == "TOOL_ROUND_LIMIT"
        assert [event["type"] for event in connection.sent].count("response.create") == 4

    asyncio.run(scenario())
