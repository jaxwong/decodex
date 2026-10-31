"""Own the authenticated HTTP projection of A's catalog provider."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Query, Request

from app.contracts.evidence import (
    CatalogResponse,
    StorefrontDescription,
    StorefrontListing,
    StorefrontReview,
    StorefrontVariant,
)
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.providers import CatalogError, CatalogProvider
from app.routes.session_auth import require_demo_session_state

router = APIRouter(prefix="/api", tags=["catalog"])

# The provider's largest review page. A storefront page shows every review in one provider
# call, so a listing with more reviews breaks that invariant instead of silently truncating.
STOREFRONT_REVIEW_LIMIT = 50


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
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> CatalogResponse:
    """Return the current provider catalog, optionally matching q against listing titles."""
    del session_state
    catalog_provider = cast(CatalogProvider, request.app.state.catalog_provider)
    return CatalogResponse(listings=await catalog_provider.list_listings(q))


@router.get(
    "/catalog/{listing_id}",
    response_model=StorefrontListing,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def get_storefront_listing(
    listing_id: str,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> StorefrontListing:
    """Return one listing page as shoppers see it. Two provider calls, no model call.

    This is the seller's unverified text for the host's product page; Luna's comparison
    evidence is still built only server-side from the provider.
    """
    del session_state
    catalog_provider = cast(CatalogProvider, request.app.state.catalog_provider)
    listing = await catalog_provider.get_listing(listing_id)
    if listing is None:
        raise CatalogError("unknown_listing")
    page = await catalog_provider.get_reviews(listing_id, None, limit=STOREFRONT_REVIEW_LIMIT)
    if page["next_cursor"] is not None:
        raise RuntimeError(
            f"Listing {listing_id!r} has more than {STOREFRONT_REVIEW_LIMIT} reviews; "
            "the storefront page shows all reviews from one provider page"
        )
    return StorefrontListing(
        listing_id=listing["listing_id"],
        title=listing["title"],
        synthetic=listing["synthetic"],
        image_url=listing.get("image_url"),
        description=[
            StorefrontDescription(text=paragraph["text"], variant_id=paragraph["variant_id"])
            for paragraph in listing["description"]
        ],
        variants=[
            StorefrontVariant(
                id=variant["variant_id"],
                variant_id=variant["variant_id"],
                label=variant["label"],
                price_minor=variant["price_minor"],
                shop_voucher_minor=variant["shop_voucher_minor"],
                shipping_minor=variant["shipping_minor"],
                currency=variant["currency"],
                # Listing-wide lines apply to every variant, as in the evidence index.
                specifications=[
                    attribute["text"]
                    for attribute in [*listing.get("attributes", []), *variant["attributes"]]
                ],
            )
            for variant in listing["variants"]
        ],
        reviews=[
            StorefrontReview(
                review_id=review["review_id"],
                variant_id=review["variant_id"],
                rating=review["rating"],
                text=review["text"],
            )
            for review in page["reviews"]
        ],
    )
