"""Own creation and lookup of session-scoped comparison state."""

import logging
import secrets
from collections.abc import Awaitable, Callable, Sequence
from http import HTTPStatus

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection
from app.contracts.session import (
    ComparisonResponse,
    Preferences,
)
from app.decision.ranking import rank_comparison
from app.decision.sessions import (
    DemoSessionState,
    release_comparison_reservation,
    reserve_comparison,
)
from app.errors import ApiFailure, ErrorCode

logger = logging.getLogger(__name__)

type BuildComparisonEvidence = Callable[
    [Sequence[ComparisonSelection]], Awaitable[ComparisonEvidence]
]


class ComparisonNotFound(ApiFailure):
    """Raised when a comparison is absent from the authorized demo session."""

    code = ErrorCode.COMPARISON_NOT_FOUND
    http_status = HTTPStatus.NOT_FOUND
    public_message = "The comparison was not found in this demo session."
    retryable = False


async def create_comparison(
    session_state: DemoSessionState,
    selections: Sequence[ComparisonSelection],
    *,
    build_evidence: BuildComparisonEvidence,
) -> ComparisonResponse:
    """Build evidence exactly once and save one canonical comparison response."""
    reserve_comparison(session_state)
    try:
        evidence = await build_evidence(selections)
    finally:
        release_comparison_reservation(session_state)
    requested_item_keys = {
        f"{selection.listing_id}:{selection.variant_id}" for selection in selections
    }
    evidence_item_keys = {item.item_key for item in evidence.items}
    if evidence_item_keys != requested_item_keys:
        raise RuntimeError(
            "Evidence builder returned different exact variants in create_comparison: "
            f"requested={sorted(requested_item_keys)!r}, returned={sorted(evidence_item_keys)!r}"
        )

    preferences = Preferences()
    comparison = ComparisonResponse(
        comparison_id=f"cmp_{secrets.token_urlsafe(18)}",
        revision=0,
        preferences=preferences,
        recommendation=rank_comparison(evidence, preferences),
        evidence=evidence,
    )
    session_state.comparisons[comparison.comparison_id] = comparison
    logger.info(
        "Created comparison comparison_id=%s item_keys=%s revision=0",
        comparison.comparison_id,
        sorted(requested_item_keys),
    )
    return comparison


def require_comparison(
    session_state: DemoSessionState,
    comparison_id: str,
) -> ComparisonResponse:
    """Return a comparison owned by the authorized session or raise without leaking ownership."""
    comparison = session_state.comparisons.get(comparison_id)
    if comparison is None:
        raise ComparisonNotFound("comparison not found in authorized session")
    return comparison
