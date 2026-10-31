"""Own the four allowlisted Luna decision tools and their only state mutation."""

import logging
from http import HTTPStatus

from app.contracts.session import (
    DEFAULT_ACTIVE_TAB,
    ComparisonResponse,
    ComparisonSnapshot,
    ComparisonSnapshotItem,
    EvidenceInspection,
    Preferences,
    PreferenceUpdate,
    ReviewAspectResult,
    UiPatch,
)
from app.decision.comparisons import require_comparison
from app.decision.ranking import rank_comparison
from app.decision.sessions import DemoSessionState
from app.errors import ApiFailure, ErrorCode

logger = logging.getLogger(__name__)


class UnknownItem(ValueError):
    """Raised when a tool references an item outside the current comparison."""


class UnknownEvidence(ValueError):
    """Raised when a tool references evidence outside the current comparison."""


class UnknownReviewAspect(ValueError):
    """Raised when a tool references an aspect absent from the evidence contract."""


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


def get_comparison(
    session_state: DemoSessionState,
    comparison_id: str,
) -> ComparisonSnapshot:
    """Return normalized comparison facts without raw unbounded source text."""
    comparison = require_comparison(session_state, comparison_id)
    snapshot_items = [
        ComparisonSnapshotItem(
            item_key=item.item_key,
            title=item.title,
            variant_label=item.variant_label,
            price_minor=item.price_minor,
            currency=item.currency,
            facts=comparison.evidence.facts_by_item[item.item_key],
        )
        for item in comparison.evidence.items
    ]
    return ComparisonSnapshot(
        comparison_id=comparison.comparison_id,
        revision=comparison.revision,
        preferences=comparison.preferences,
        recommendation=comparison.recommendation,
        items=snapshot_items,
    )


def get_review_aspect(
    session_state: DemoSessionState,
    comparison_id: str,
    *,
    aspect: str,
    item_keys: list[str],
) -> ReviewAspectResult:
    """Return bounded review aggregates and literal mentions for known items and one aspect."""
    comparison = require_comparison(session_state, comparison_id)
    known_item_keys = {item.item_key for item in comparison.evidence.items}
    unknown_item_keys = set(item_keys) - known_item_keys
    if unknown_item_keys:
        raise UnknownItem(f"unknown item keys: {sorted(unknown_item_keys)!r}")

    known_aspects = {summary.aspect for summary in comparison.evidence.review_summaries}
    if aspect not in known_aspects:
        raise UnknownReviewAspect(f"unknown review aspect: {aspect!r}")

    summaries = [
        summary
        for summary in comparison.evidence.review_summaries
        if summary.item_key in item_keys and summary.aspect == aspect
    ]
    mention_ids = {mention_id for summary in summaries for mention_id in summary.mention_ids}
    mentions = [
        mention
        for mention_id, mention in comparison.evidence.review_mentions.items()
        if mention_id in mention_ids
    ]
    return ReviewAspectResult(aspect=aspect, summaries=summaries, mentions=mentions)


def inspect_evidence(
    session_state: DemoSessionState,
    comparison_id: str,
    *,
    evidence_ids: list[str],
) -> EvidenceInspection:
    """Return exact stored sources only when every requested citation ID is valid."""
    comparison = require_comparison(session_state, comparison_id)
    unknown_evidence_ids = set(evidence_ids) - comparison.evidence.evidence.keys()
    if unknown_evidence_ids:
        raise UnknownEvidence(f"unknown evidence IDs: {sorted(unknown_evidence_ids)!r}")
    return EvidenceInspection(
        evidence=[comparison.evidence.evidence[evidence_id] for evidence_id in evidence_ids]
    )


def _focused_fields(preferences: Preferences) -> list[str]:
    fields: list[str] = []
    if preferences.max_price_minor is not None:
        fields.append("price_minor")
    if preferences.min_output_w is not None:
        fields.append("max_output_w")
    for priority in preferences.priorities:
        if priority != "review_reliability" and priority not in fields:
            fields.append(priority)
    return fields


def apply_preferences(
    session_state: DemoSessionState,
    comparison_id: str,
    *,
    preferences: Preferences,
    expected_revision: int,
) -> PreferenceUpdate:
    """Replace preferences exactly once when expected revision is current."""
    comparison = require_comparison(session_state, comparison_id)
    if expected_revision != comparison.revision:
        raise RevisionConflict(comparison.revision)

    recommendation = rank_comparison(comparison.evidence, preferences)
    new_revision = comparison.revision + 1
    ui_patch = UiPatch(
        base_revision=comparison.revision,
        new_revision=new_revision,
        focused_fields=_focused_fields(preferences),
        excluded_item_keys=recommendation.excluded_item_keys,
        highlight_item_key=recommendation.item_key,
        active_tab=(
            "reviews"
            if preferences.priorities and preferences.priorities[0] == "review_reliability"
            else DEFAULT_ACTIVE_TAB
        ),
    )
    session_state.comparisons[comparison_id] = ComparisonResponse(
        comparison_id=comparison.comparison_id,
        revision=new_revision,
        preferences=preferences,
        recommendation=recommendation,
        ui_patch=ui_patch,
        evidence=comparison.evidence,
    )
    logger.info(
        "Applied preferences comparison_id=%s base_revision=%s new_revision=%s "
        "excluded_item_keys=%s uncertain_item_keys=%s",
        comparison_id,
        comparison.revision,
        new_revision,
        recommendation.excluded_item_keys,
        recommendation.uncertain_item_keys,
    )
    return PreferenceUpdate(
        preferences=preferences,
        recommendation=recommendation,
        ui_patch=ui_patch,
    )
