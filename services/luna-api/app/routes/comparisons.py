"""Own authenticated creation and retrieval of canonical comparison state."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, status

from app.contracts.session import ComparisonResponse, CreateComparisonRequest
from app.decision.comparisons import (
    BuildComparisonEvidence,
    create_comparison,
    require_comparison,
)
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.routes.session_auth import require_demo_session_state

router = APIRouter(prefix="/api", tags=["comparisons"])


@router.post(
    "/comparisons",
    response_model=ComparisonResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def post_comparison(
    comparison_request: CreateComparisonRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> ComparisonResponse:
    """Build evidence once and save the resulting comparison in the authorized session."""
    build_evidence = cast(BuildComparisonEvidence, request.app.state.build_comparison_evidence)
    return await create_comparison(
        session_state,
        comparison_request.items,
        build_evidence=build_evidence,
    )


@router.get(
    "/comparisons/{comparison_id}",
    response_model=ComparisonResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def get_comparison_response(
    comparison_id: str,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> ComparisonResponse:
    """Return the latest canonical state when it belongs to the authorized session."""
    return require_comparison(session_state, comparison_id)
