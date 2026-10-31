"""Expose seller insights aggregated over every active buyer session."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from app.contracts.session import ListingGapReport
from app.decision.gap_report import build_gap_report
from app.decision.sessions import DemoSessionState, DemoSessionStore
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
    """Return counts across all buyers without buyer identity or preference details.

    The demo has no seller login or listing ownership, so any active demo session may read
    any listing's report. The session dependency has already deleted expired sessions, and
    the read is bounded by MAX_DEMO_SESSIONS * MAX_COMPARISONS_PER_SESSION comparisons.
    """
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    if await provider.get_listing(listing_id) is None:
        raise CatalogError("unknown_listing")
    session_store = cast(DemoSessionStore, request.app.state.demo_sessions)
    return build_gap_report(
        (
            comparison
            for buyer_session in session_store.values()
            for comparison in buyer_session.comparisons.values()
        ),
        listing_id,
    )
