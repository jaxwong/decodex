import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

import pytest
from eval.fixtures import SELECTIONS, build_sample_evidence
from openai import AsyncOpenAI
from openai.resources.live.sideband import AsyncSidebandConnection
from openai.types.live import DelegationCreatedEvent, LiveCreateResponse, ResponseEvent

from app.contracts.evidence import ComparisonSelection
from app.contracts.session import Preferences
from app.decision.comparisons import create_comparison, require_comparison
from app.decision.sessions import DemoSessionState, shutdown_demo_sessions
from app.decision.tools import apply_preferences
from app.openai.capability_smoke import build_live_audio_offer_sdp
from app.openai.live_agent import (
    LunaLiveProtocolError,
    LunaLiveUnavailable,
    run_live_sideband,
    start_live_session,
)


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
        build_evidence=build_sample_evidence,
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


def test_start_live_session_uses_one_create_and_zero_retry_sideband_attach(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.openai.live_agent")

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
        creation_logs = [
            record.message for record in caplog.records if "Created Live session" in record.message
        ]
        assert len(creation_logs) == 1
        assert "external_calls=2" in creation_logs[0]
        assert "elapsed_ms=" in creation_logs[0]

    asyncio.run(scenario())


def test_start_live_session_replaces_the_existing_comparison_relay() -> None:
    class BlockingSidebandConnection(FakeSidebandConnection):
        def __init__(self) -> None:
            super().__init__([])
            self.release = asyncio.Event()

        async def __aiter__(self) -> AsyncIterator[object]:
            await self.release.wait()
            yield closed_event()

    class SequencedSideband:
        def __init__(self, connections: dict[str, BlockingSidebandConnection]) -> None:
            self.connections = connections

        def connect(self, **request: Any) -> FakeSidebandManager:
            return FakeSidebandManager(self.connections[cast(str, request["session_id"])])

    class SequencedLive:
        def __init__(self, connections: dict[str, BlockingSidebandConnection]) -> None:
            self.sideband = SequencedSideband(connections)
            self.create_count = 0

        async def create(self, **request: Any) -> LiveCreateResponse:
            del request
            self.create_count += 1
            return LiveCreateResponse.model_validate(
                {
                    "session": {"id": f"live_{self.create_count}"},
                    "transport": {"type": "webrtc", "sdp": "provider-answer-sdp"},
                }
            )

    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        connections = {
            "live_1": BlockingSidebandConnection(),
            "live_2": BlockingSidebandConnection(),
        }
        fake_client = SimpleNamespace(live=SequencedLive(connections))

        first = await start_live_session(
            cast(AsyncOpenAI, fake_client),
            session_state,
            comparison_id=comparison_id,
            offer_sdp=build_live_audio_offer_sdp(),
            live_model="gpt-live-1",
            text_model="gpt-6-luna",
        )
        first_task = session_state.live_sessions[first.session.id].relay_task
        await asyncio.sleep(0)

        second = await start_live_session(
            cast(AsyncOpenAI, fake_client),
            session_state,
            comparison_id=comparison_id,
            offer_sdp=build_live_audio_offer_sdp(),
            live_model="gpt-live-1",
            text_model="gpt-6-luna",
        )
        await asyncio.sleep(0)

        assert first_task.cancelled()
        assert connections["live_1"].closed is True
        assert set(session_state.live_sessions) == {second.session.id}

        await shutdown_demo_sessions({"test": session_state})

        assert connections["live_2"].closed is True

    asyncio.run(scenario())


def test_sideband_executes_only_completed_calls_and_supports_second_correction() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        first_call = function_call_item(
            "call_first",
            "apply_preferences",
            {
                "comparison_id": comparison_id,
                "preferences": {
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
                "preferences": {
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
                "preferences": {
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


def test_sideband_rejects_empty_call_id_without_sending_an_unroutable_result() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        call = function_call_item("", "get_comparison", {"comparison_id": comparison_id})
        connection = FakeSidebandConnection(
            [
                delegation_event("delegation_one", "resp_one"),
                response_event(
                    "delegation_one",
                    nested_type="response.output_item.done",
                    item=call,
                ),
            ]
        )

        with pytest.raises(LunaLiveProtocolError, match="omitted its call identifier"):
            await run_live_sideband(
                cast(AsyncSidebandConnection, connection),
                session_state,
                session_id="live_test",
                comparison_id=comparison_id,
                text_model="gpt-6-luna",
            )

        assert connection.sent == []
        assert connection.closed is True

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
                "message": "The tool request was invalid or outside this comparison.",
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


def test_live_create_failure_leaves_no_sideband_or_live_state() -> None:
    class FailingLive:
        def __init__(self, connection: FakeSidebandConnection) -> None:
            self.sideband = FakeSideband(connection)
            self.requests: list[dict[str, Any]] = []

        async def create(self, **request: Any) -> LiveCreateResponse:
            self.requests.append(request)
            raise OSError("provider unavailable")

    class FailingClient:
        def __init__(self, connection: FakeSidebandConnection) -> None:
            self.live = FailingLive(connection)

    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        connection = FakeSidebandConnection([])
        fake_client = FailingClient(connection)

        with pytest.raises(LunaLiveUnavailable):
            await start_live_session(
                cast(AsyncOpenAI, fake_client),
                session_state,
                comparison_id=comparison_id,
                offer_sdp=build_live_audio_offer_sdp(),
                live_model="gpt-live-1",
                text_model="gpt-6-luna",
            )

        assert len(fake_client.live.requests) == 1
        assert fake_client.live.sideband.requests == []
        assert session_state.live_sessions == {}
        assert connection.closed is False

    asyncio.run(scenario())


def test_sideband_returns_stale_error_when_concurrent_correction_wins() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        winning_update = apply_preferences(
            session_state,
            comparison_id,
            preferences=Preferences(
                max_price_minor=7000,
                min_output_w=65,
                priorities=["price_minor"],
            ),
            expected_revision=0,
        )
        stale_call = function_call_item(
            "call_stale",
            "apply_preferences",
            {
                "comparison_id": comparison_id,
                "preferences": {
                    "max_price_minor": 8000,
                    "min_output_w": 65,
                    "priorities": ["weight_g"],
                },
                "expected_revision": 0,
            },
        )
        connection = FakeSidebandConnection(
            [
                delegation_event("delegation_stale", "resp_stale"),
                response_event(
                    "delegation_stale",
                    nested_type="response.output_item.done",
                    item=stale_call,
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
        assert json.loads(output_event["item"]["output"]) == {
            "ok": False,
            "error": {
                "code": "STALE_COMPARISON",
                "message": "The comparison changed; refresh before applying this correction.",
                "retryable": False,
                "current_revision": 1,
            },
        }
        comparison = require_comparison(session_state, comparison_id)
        assert comparison.revision == winning_update.ui_patch.new_revision == 1
        assert comparison.preferences.max_price_minor == 7000
        assert comparison.preferences.priorities == ["price_minor"]
        assert [event["type"] for event in connection.sent] == [
            "response.item.create",
            "response.create",
        ]

    asyncio.run(scenario())


def test_sideband_protocol_error_closes_connection_without_fallback() -> None:
    async def scenario() -> None:
        session_state, comparison_id = await create_comparison_state()
        connection = FakeSidebandConnection([SimpleNamespace(type="error")])

        with pytest.raises(LunaLiveProtocolError):
            await run_live_sideband(
                cast(AsyncSidebandConnection, connection),
                session_state,
                session_id="live_test",
                comparison_id=comparison_id,
                text_model="gpt-6-luna",
            )

        assert connection.sent == []
        assert connection.closed is True
        assert require_comparison(session_state, comparison_id).revision == 0

    asyncio.run(scenario())
