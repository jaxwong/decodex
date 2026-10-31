"""Own the authenticated HTTP projection of A's catalog provider."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.providers import CatalogProvider
from app.routes.session_auth import require_demo_session_state

router = APIRouter(prefix="/api", tags=["catalog"])


class CatalogVariantResponse(BaseModel):
    """One exact provider variant selectable by the frontend."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    variant_id: str
    label: str
    price_minor: int = Field(ge=0)
    currency: str


class CatalogListingResponse(BaseModel):
    """A bounded listing preview whose complete evidence remains server-side."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    listing_id: str
    title: str
    synthetic: bool
    image_url: str | None
    preview: str
    variants: list[CatalogVariantResponse]


class CatalogResponse(BaseModel):
    """The provider-backed catalog projection returned to authenticated hosts."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    listings: list[CatalogListingResponse]


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
    return CatalogResponse.model_validate({"listings": await catalog_provider.list_listings()})
