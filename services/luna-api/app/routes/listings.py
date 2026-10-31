"""Expose session-scoped seller insights over canonical comparison state."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from app.contracts.session import ListingGapReport
from app.decision.gap_report import build_gap_report
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.providers import CatalogError, CatalogProvider
from app.routes.session_auth import require_demo_session_state

router = APIRouter(prefix="/api/listings", tags=["listings"])


@router.get(
    "/{listing_id}/gap-report",
    response_model=ListingGapReport,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def get_listing_gap_report(
    listing_id: str,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> ListingGapReport:
    """Return current-session counts without buyer identity or preference details."""
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    if await provider.get_listing(listing_id) is None:
        raise CatalogError("unknown_listing")
    return build_gap_report(session_state, listing_id)
