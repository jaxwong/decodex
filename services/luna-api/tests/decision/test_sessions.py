import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.decision.sessions import (
    MAX_DEMO_SESSIONS,
    DemoSessionCapacityReached,
    DemoSessionExpired,
    DemoSessionNotFound,
    DemoSessionState,
    DemoSessionStore,
    LiveSessionState,
    create_demo_session,
    require_active_demo_session,
    shutdown_demo_sessions,
)


def test_create_demo_session_uses_opaque_unique_tokens() -> None:
    session_store: DemoSessionStore = {}
    created_at = datetime(2026, 10, 31, 3, 0, tzinfo=UTC)

    first_session = create_demo_session(session_store, created_at=created_at)
    second_session = create_demo_session(session_store, created_at=created_at)

    assert first_session.token != second_session.token
    assert len(first_session.token) >= 32
    assert first_session.expires_at == created_at + timedelta(hours=1)
    assert session_store[first_session.token].expires_at == first_session.expires_at
    assert session_store[first_session.token].comparisons == {}


def test_require_active_demo_session_rejects_unknown_token() -> None:
    with pytest.raises(DemoSessionNotFound, match="unknown demo session token"):
        require_active_demo_session({}, token="missing", checked_at=datetime.now(UTC))


def test_require_active_demo_session_rejects_and_removes_expired_token() -> None:
    session_store: DemoSessionStore = {}
    created_at = datetime(2026, 10, 31, 3, 0, tzinfo=UTC)
    demo_session = create_demo_session(session_store, created_at=created_at)

    with pytest.raises(DemoSessionExpired, match="expired demo session token"):
        require_active_demo_session(
            session_store,
            token=demo_session.token,
            checked_at=demo_session.expires_at,
        )

    assert demo_session.token not in session_store


def test_create_demo_session_sweeps_expired_state_and_cancels_live_relays() -> None:
    async def scenario() -> None:
        checked_at = datetime(2026, 10, 31, 4, 0, tzinfo=UTC)
        relay_started = asyncio.Event()
        relay_closed = asyncio.Event()

        async def relay() -> None:
            relay_started.set()
            try:
                await asyncio.Event().wait()
            finally:
                relay_closed.set()

        relay_task = asyncio.create_task(relay())
        await relay_started.wait()
        expired_state = DemoSessionState(expires_at=checked_at)
        expired_state.live_sessions["live_expired"] = LiveSessionState(
            comparison_id="cmp_expired",
            relay_task=relay_task,
        )
        session_store: DemoSessionStore = {"expired": expired_state}

        created = create_demo_session(session_store, created_at=checked_at)
        with pytest.raises(asyncio.CancelledError):
            await relay_task

        assert relay_closed.is_set()
        assert "expired" not in session_store
        assert created.token in session_store

    asyncio.run(scenario())


def test_create_demo_session_rejects_capacity_after_expiry_sweep() -> None:
    created_at = datetime(2026, 10, 31, 3, 0, tzinfo=UTC)
    session_store = {
        f"token_{index}": DemoSessionState(expires_at=created_at + timedelta(hours=1))
        for index in range(MAX_DEMO_SESSIONS)
    }

    with pytest.raises(DemoSessionCapacityReached, match="capacity reached"):
        create_demo_session(session_store, created_at=created_at)

    assert len(session_store) == MAX_DEMO_SESSIONS


def test_shutdown_demo_sessions_cancels_and_joins_every_live_relay() -> None:
    async def scenario() -> None:
        relay_started = asyncio.Event()
        relay_closed = asyncio.Event()

        async def relay() -> None:
            relay_started.set()
            try:
                await asyncio.Event().wait()
            finally:
                relay_closed.set()

        relay_task = asyncio.create_task(relay())
        await relay_started.wait()
        session_state = DemoSessionState(expires_at=datetime.max.replace(tzinfo=UTC))
        session_state.live_sessions["live_active"] = LiveSessionState(
            comparison_id="cmp_active",
            relay_task=relay_task,
        )

        await shutdown_demo_sessions({"active": session_state})

        assert relay_task.cancelled()
        assert relay_closed.is_set()
        assert session_state.live_sessions == {}

    asyncio.run(scenario())
