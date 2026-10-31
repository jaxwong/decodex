"""Own the authenticated HTTP projection of A's catalog provider."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from app.contracts.evidence import CatalogResponse
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.providers import CatalogProvider
from app.routes.session_auth import require_demo_session_state

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get(
    "/catalog",
    response_model=CatalogResponse,
    responses={
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def get_catalog(
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> CatalogResponse:
    """Return the current provider catalog without exposing complete evidence."""
    del session_state
    catalog_provider = cast(CatalogProvider, request.app.state.catalog_provider)
    return CatalogResponse(listings=await catalog_provider.list_listings())
