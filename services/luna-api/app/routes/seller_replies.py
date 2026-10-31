"""Simulated seller question loop: draft a question, store a one-field seller answer."""

import logging
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Request, status

from app.contracts.session import (
    SellerQuestion,
    SellerQuestionRequest,
    SellerReply,
    SellerReplyRequest,
)
from app.decision.seller_questions import seller_question, seller_reply_text
from app.decision.sessions import DemoSessionState
from app.errors import ErrorResponse
from app.providers import CatalogError, CatalogProvider
from app.routes.session_auth import require_demo_session_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/listings", tags=["seller questions"])

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


async def _require_variant(
    provider: CatalogProvider, listing_id: str, variant_id: str
) -> dict[str, Any]:
    if await provider.get_listing(listing_id) is None:
        raise CatalogError("unknown_listing")
    variant = await provider.get_variant(listing_id, variant_id)
    if variant is None:
        raise CatalogError("unknown_variant")
    return variant


@router.post(
    "/{listing_id}/variants/{variant_id}/questions",
    response_model=SellerQuestion,
    responses=ERROR_RESPONSES,
)
async def post_seller_question(
    listing_id: str,
    variant_id: str,
    question_request: SellerQuestionRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> SellerQuestion:
    """Return a fixed-template question; no model call and nothing is stored."""
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    variant = await _require_variant(provider, listing_id, variant_id)
    return SellerQuestion(
        listing_id=listing_id,
        variant_id=variant_id,
        field_key=question_request.field_key,
        question=seller_question(question_request.field_key, variant["label"]),
    )


@router.post(
    "/{listing_id}/variants/{variant_id}/seller-replies",
    response_model=SellerReply,
    status_code=status.HTTP_201_CREATED,
    responses={**ERROR_RESPONSES, 409: {"model": ErrorResponse}},
)
async def post_seller_reply(
    listing_id: str,
    variant_id: str,
    reply_request: SellerReplyRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> SellerReply:
    """Store a parsable simulated seller answer as variant source text.

    The demo has no seller login, so any active demo session plays the seller. Open
    comparisons keep their evidence; only a comparison built afterwards cites the answer.
    """
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    await _require_variant(provider, listing_id, variant_id)
    text = seller_reply_text(reply_request.field_key, reply_request.answer)
    await provider.add_seller_reply(listing_id, variant_id, reply_request.field_key, text)
    logger.info(
        "Stored simulated seller reply listing_id=%s variant_id=%s field_key=%s",
        listing_id,
        variant_id,
        reply_request.field_key,
    )
    return SellerReply(
        listing_id=listing_id,
        variant_id=variant_id,
        field_key=reply_request.field_key,
        text=text,
    )
