"""Own bearer-token parsing for protected Luna API routes."""

from datetime import UTC, datetime
from typing import Annotated, cast

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.decision.sessions import (
    DemoSessionRequired,
    DemoSessionState,
    DemoSessionStore,
    require_active_demo_session,
)

bearer_scheme = HTTPBearer(auto_error=False)


def require_demo_session_state(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> DemoSessionState:
    """Resolve one active server-owned demo session from the Authorization boundary."""
    if credentials is None:
        raise DemoSessionRequired("missing demo session bearer token")
    session_store = cast(DemoSessionStore, request.app.state.demo_sessions)
    return require_active_demo_session(
        session_store,
        token=credentials.credentials,
        checked_at=datetime.now(UTC),
    )
