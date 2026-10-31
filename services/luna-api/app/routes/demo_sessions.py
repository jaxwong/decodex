from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Request, status

from app.contracts.session import DemoSession
from app.decision.sessions import DemoSessionStore, create_demo_session

router = APIRouter(prefix="/api", tags=["sessions"])


@router.post(
    "/demo-sessions",
    response_model=DemoSession,
    status_code=status.HTTP_201_CREATED,
)
def issue_demo_session(request: Request) -> DemoSession:
    """Issue a server-owned one-hour demo session for the current API process."""
    session_store = cast(DemoSessionStore, request.app.state.demo_sessions)
    return create_demo_session(session_store, created_at=datetime.now(UTC))
