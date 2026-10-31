"""Own authenticated creation and retrieval of canonical comparison state."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, status

from app.contracts.session import (
    AskComparisonRequest,
    AskComparisonResponse,
    ComparisonResponse,
    CreateComparisonRequest,
    LiveSessionRequest,
    LiveSessionResponse,
    PickComparisonRequest,
)
from app.decision.comparisons import (
    BuildComparisonEvidence,
    create_comparison,
    record_pick,
    require_comparison,
)
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.openai.live_agent import start_live_session
from app.openai.runtime import OpenAIRuntime
from app.openai.text_agent import LunaAgentConfigurationError, run_luna
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


@router.post(
    "/comparisons/{comparison_id}/ask",
    response_model=AskComparisonResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def post_comparison_ask(
    comparison_id: str,
    ask_request: AskComparisonRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> AskComparisonResponse:
    """Run one bounded evidence-backed Luna turn for an authorized comparison."""
    runtime = cast(OpenAIRuntime, request.app.state.openai_runtime)
    if runtime.create_response is None or runtime.text_model is None:
        raise LunaAgentConfigurationError("Text model access is not configured in create_app")
    return await run_luna(
        session_state,
        comparison_id=comparison_id,
        conversation_id=ask_request.conversation_id,
        message=ask_request.message,
        expected_revision=ask_request.expected_revision,
        create_response=runtime.create_response,
        model=runtime.text_model,
    )


@router.post(
    "/comparisons/{comparison_id}/pick",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def post_comparison_pick(
    comparison_id: str,
    pick_request: PickComparisonRequest,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> None:
    """Record the item the buyer picked at the revision they saw; no model call, same revision."""
    record_pick(
        session_state,
        comparison_id,
        item_key=pick_request.item_key,
        expected_revision=pick_request.expected_revision,
    )


@router.post(
    "/comparisons/{comparison_id}/live/session",
    response_model=LiveSessionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def post_comparison_live_session(
    comparison_id: str,
    live_request: LiveSessionRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> LiveSessionResponse:
    """Create a comparison-bound GPT-Live WebRTC session with its sideband attached."""
    require_comparison(session_state, comparison_id)
    runtime = cast(OpenAIRuntime, request.app.state.openai_runtime)
    if runtime.client is None or runtime.live_model is None or runtime.text_model is None:
        raise LunaAgentConfigurationError("Live model access is not configured in create_app")
    live_response = await start_live_session(
        runtime.client,
        session_state,
        comparison_id=comparison_id,
        offer_sdp=live_request.sdp,
        live_model=runtime.live_model,
        text_model=runtime.text_model,
    )
    return LiveSessionResponse.model_validate(live_response.model_dump())
