from datetime import UTC, datetime, timedelta

import pytest

from app.decision.sessions import (
    DemoSessionExpired,
    DemoSessionNotFound,
    DemoSessionStore,
    create_demo_session,
    require_active_demo_session,
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
