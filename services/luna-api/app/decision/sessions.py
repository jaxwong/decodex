import secrets
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.contracts.session import ComparisonResponse, DemoSession

DEMO_SESSION_LIFETIME = timedelta(hours=1)


@dataclass(slots=True)
class DemoSessionState:
    """Private process-local state owned by one opaque demo session token."""

    expires_at: datetime
    comparisons: dict[str, ComparisonResponse] = field(default_factory=dict)


type DemoSessionStore = dict[str, DemoSessionState]


class DemoSessionRequired(PermissionError):
    """Raised when a protected API request has no bearer token."""


class DemoSessionNotFound(LookupError):
    """Raised when a demo session token is not owned by this process."""


class DemoSessionExpired(PermissionError):
    """Raised when a known demo session has reached its server-owned expiry."""


def create_demo_session(
    session_store: DemoSessionStore,
    *,
    created_at: datetime | None = None,
) -> DemoSession:
    """Create and store a one-hour demo session with an opaque random token."""
    session_created_at = created_at or datetime.now(UTC)
    if session_created_at.tzinfo is None:
        raise ValueError("created_at must include timezone information")

    token = secrets.token_urlsafe(32)
    demo_session = DemoSession(
        token=token,
        expires_at=session_created_at + DEMO_SESSION_LIFETIME,
    )
    session_store[token] = DemoSessionState(expires_at=demo_session.expires_at)
    return demo_session


def require_active_demo_session(
    session_store: DemoSessionStore,
    *,
    token: str,
    checked_at: datetime | None = None,
) -> DemoSessionState:
    """Return an active demo session or raise a typed unknown/expired failure."""
    session_state = session_store.get(token)
    if session_state is None:
        raise DemoSessionNotFound("unknown demo session token")

    session_checked_at = checked_at or datetime.now(UTC)
    if session_checked_at.tzinfo is None:
        raise ValueError("checked_at must include timezone information")
    if session_checked_at >= session_state.expires_at:
        del session_store[token]
        raise DemoSessionExpired("expired demo session token")

    return session_state
