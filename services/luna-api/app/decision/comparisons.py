"""Own creation and lookup of session-scoped comparison state."""

import logging
import secrets
from collections.abc import Awaitable, Callable, Sequence
from http import HTTPStatus

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection
from app.contracts.session import (
    ComparisonPick,
    ComparisonResponse,
    Preferences,
)
from app.decision.ranking import rank_comparison
from app.decision.sessions import (
    DemoSessionState,
    release_comparison_reservation,
    reserve_comparison,
)
from app.errors import ApiFailure, ErrorCode, InvalidRequest

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


class RevisionConflict(ApiFailure):
    """Raised before mutation when expected revision is not current."""

    code = ErrorCode.STALE_COMPARISON
    http_status = HTTPStatus.CONFLICT
    public_message = "The comparison changed; refresh before applying the newer intent."
    retryable = False

    def __init__(self, current_revision: int) -> None:
        super().__init__(
            f"stale comparison revision; current revision is {current_revision}",
            current_revision=current_revision,
        )


class PickedItemNotInComparison(InvalidRequest):
    """Raised when a pick names an item the comparison does not contain."""

    public_message = "The picked item is not in this comparison."


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


def record_pick(
    session_state: DemoSessionState,
    comparison_id: str,
    *,
    item_key: str,
    expected_revision: int,
) -> ComparisonResponse:
    """Save which item the buyer picked, with the needs stated at that revision.

    The revision does not change: a pick alters no preference or recommendation. A later pick
    replaces the earlier one, so one comparison contributes at most one pick to Seller Centre.
    """
    comparison = require_comparison(session_state, comparison_id)
    if expected_revision != comparison.revision:
        raise RevisionConflict(comparison.revision)
    if item_key not in {item.item_key for item in comparison.evidence.items}:
        raise PickedItemNotInComparison(
            f"pick names {item_key!r}, which is not in comparison {comparison_id}"
        )
    picked = comparison.model_copy(
        update={"pick": ComparisonPick(item_key=item_key, preferences=comparison.preferences)}
    )
    session_state.comparisons[comparison_id] = picked
    logger.info(
        "Recorded pick comparison_id=%s item_key=%s revision=%s",
        comparison_id,
        item_key,
        comparison.revision,
    )
    return picked
