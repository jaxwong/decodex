"""Seller question loop: a buyer sends one question, the seller answers it in Seller Centre."""

import logging
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Request, status

from app.contracts.session import (
    SellerQuestion,
    SellerQuestionRequest,
    SellerQuestionsResponse,
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

# One open question per variant field, so the inbox is bounded by catalog size times schema size.
type QuestionKey = tuple[str, str, str]
type SellerQuestionStore = dict[QuestionKey, SellerQuestion]


async def _require_variant(
    provider: CatalogProvider, listing_id: str, variant_id: str
) -> dict[str, Any]:
    if await provider.get_listing(listing_id) is None:
        raise CatalogError("unknown_listing")
    variant = await provider.get_variant(listing_id, variant_id)
    if variant is None:
        raise CatalogError("unknown_variant")
    return variant


def _question_store(request: Request) -> SellerQuestionStore:
    return cast(SellerQuestionStore, request.app.state.seller_questions)


@router.post(
    "/{listing_id}/variants/{variant_id}/questions",
    response_model=SellerQuestion,
    responses={**ERROR_RESPONSES, 409: {"model": ErrorResponse}},
)
async def post_seller_question(
    listing_id: str,
    variant_id: str,
    question_request: SellerQuestionRequest,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> SellerQuestion:
    """Open a fixed-template question for the seller; no model call.

    Asking the same field again returns the same open question. A field the seller has
    already answered is closed, so asking it is a conflict.
    """
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    variant = await _require_variant(provider, listing_id, variant_id)
    field_key = question_request.field_key
    if any(reply["field_key"] == field_key for reply in variant.get("seller_replies", [])):
        raise CatalogError("seller_reply_exists")
    store = _question_store(request)
    key = (listing_id, variant_id, field_key)
    if key not in store:
        store[key] = SellerQuestion(
            listing_id=listing_id,
            variant_id=variant_id,
            field_key=field_key,
            question=seller_question(field_key, variant["label"]),
        )
        logger.info(
            "Opened seller question listing_id=%s variant_id=%s field_key=%s",
            listing_id,
            variant_id,
            field_key,
        )
    return store[key]


@router.get(
    "/{listing_id}/questions",
    response_model=SellerQuestionsResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def get_seller_questions(
    listing_id: str,
    request: Request,
    session_state: Annotated[DemoSessionState, Depends(require_demo_session_state)],
) -> SellerQuestionsResponse:
    """Return the listing's unanswered buyer questions, oldest first.

    The demo has no seller login, so any active demo session may read any listing's inbox.
    Buyers use the same read to learn that their question has been answered.
    """
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    if await provider.get_listing(listing_id) is None:
        raise CatalogError("unknown_listing")
    return SellerQuestionsResponse(
        questions=[
            question
            for question in _question_store(request).values()
            if question.listing_id == listing_id
        ]
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
    """Store a parsable seller answer as variant source text and close the open question.

    The demo has no seller login, so any active demo session plays the seller. Open
    comparisons keep their evidence; only a comparison built afterwards cites the answer.
    """
    del session_state
    provider = cast(CatalogProvider, request.app.state.catalog_provider)
    await _require_variant(provider, listing_id, variant_id)
    text = seller_reply_text(reply_request.field_key, reply_request.answer)
    await provider.add_seller_reply(listing_id, variant_id, reply_request.field_key, text)
    _question_store(request).pop((listing_id, variant_id, reply_request.field_key), None)
    logger.info(
        "Stored seller reply listing_id=%s variant_id=%s field_key=%s",
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
