"""Attribute a buyer's pick to the first stated need that separates it from each rival."""

from dataclasses import dataclass

from app.contracts.evidence import ComparisonEvidence
from app.contracts.session import ExclusionReason, PickReason, Preferences
from app.decision.ranking import OBJECTIVE_PRIORITY_DIRECTIONS, priority_value, rank_comparison


@dataclass(frozen=True, slots=True)
class PickAttribution:
    """Why the picked item won against one rival; field_key names the deciding priority."""

    reason: PickReason
    field_key: str | None


def attribute_pick(
    evidence: ComparisonEvidence,
    preferences: Preferences,
    picked_item_key: str,
) -> dict[str, PickAttribution]:
    """Return, for every other item, the first stated need on which the picked item wins.

    Hard constraints come first, then the buyer's priorities in their order. A need on which
    the rival ties or wins falls through to the next one. When nothing stated separates them,
    the reason is no_stated_reason; it is never guessed from evidence the buyer did not ask for.
    """
    item_keys = [item.item_key for item in evidence.items]
    if picked_item_key not in item_keys:
        raise ValueError(
            f"attribute_pick requires a picked item from the comparison: {picked_item_key!r} "
            f"is not in {item_keys!r}"
        )
    exclusion_reasons = rank_comparison(evidence, preferences).exclusion_reasons
    return {
        item_key: _attribute(evidence, preferences, exclusion_reasons, picked_item_key, item_key)
        for item_key in item_keys
        if item_key != picked_item_key
    }


def _attribute(
    evidence: ComparisonEvidence,
    preferences: Preferences,
    exclusion_reasons: dict[str, ExclusionReason],
    picked_item_key: str,
    other_item_key: str,
) -> PickAttribution:
    other_exclusion = exclusion_reasons.get(other_item_key)
    if other_exclusion is not None and picked_item_key not in exclusion_reasons:
        return PickAttribution(reason=other_exclusion, field_key=None)
    for priority in preferences.priorities:
        picked_value = priority_value(evidence, picked_item_key, priority)
        if picked_value is None:
            continue
        other_value = priority_value(evidence, other_item_key, priority)
        if other_value is None:
            return PickAttribution(reason="not_stated", field_key=priority)
        direction = OBJECTIVE_PRIORITY_DIRECTIONS[priority]
        if picked_value * direction < other_value * direction:
            return PickAttribution(reason="beaten_on", field_key=priority)
    return PickAttribution(reason="no_stated_reason", field_key=None)
