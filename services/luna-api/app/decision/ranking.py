"""Own deterministic comparison filtering and explainable lexicographic ranking."""

from app.contracts.evidence import ComparisonEvidence
from app.contracts.session import ExclusionReason, Preferences, RankingPriority, Recommendation

OBJECTIVE_PRIORITY_DIRECTIONS: dict[RankingPriority, int] = {
    "weight_g": 1,
    "price_minor": 1,
    "max_output_w": -1,
}


def _item_keys(evidence: ComparisonEvidence) -> list[str]:
    return [item.item_key for item in evidence.items]


def _landed_price_minor(evidence: ComparisonEvidence, item_key: str) -> int:
    item = next(item for item in evidence.items if item.item_key == item_key)
    return item.landed_price_minor


def _supported_number(
    evidence: ComparisonEvidence,
    item_key: str,
    field_key: str,
) -> int | float | None:
    fact = next(
        (fact for fact in evidence.facts_by_item[item_key] if fact.field_key == field_key),
        None,
    )
    if fact is None or fact.status != "supported":
        return None
    if isinstance(fact.value, bool) or not isinstance(fact.value, (int, float)):
        raise RuntimeError(
            "Supported numeric ranking fact must contain a number in rank_comparison: "
            f"item_key={item_key!r}, field_key={field_key!r}, value={fact.value!r}"
        )
    return fact.value


def _priority_value(
    evidence: ComparisonEvidence,
    item_key: str,
    priority: RankingPriority,
) -> int | float | None:
    if priority == "price_minor":
        return _landed_price_minor(evidence, item_key)
    if priority == "review_reliability":
        return None
    return _supported_number(evidence, item_key, priority)


def rank_comparison(
    evidence: ComparisonEvidence,
    preferences: Preferences,
) -> Recommendation:
    """Apply hard constraints, separate uncertainty, and rank comparable candidates."""
    item_keys = _item_keys(evidence)
    exclusion_reasons: dict[str, ExclusionReason] = {}
    uncertain_fields: dict[str, list[str]] = {}
    limitations: list[str] = []

    def record_uncertainty(item_key: str, field_key: str) -> bool:
        fields = uncertain_fields.setdefault(item_key, [])
        if field_key in fields:
            return False
        fields.append(field_key)
        return True

    for item_key in item_keys:
        if (
            preferences.max_price_minor is not None
            and _landed_price_minor(evidence, item_key) > preferences.max_price_minor
        ):
            exclusion_reasons[item_key] = "over_budget"
            continue
        if preferences.min_output_w is not None:
            max_output_w = _supported_number(evidence, item_key, "max_output_w")
            if max_output_w is None:
                if record_uncertainty(item_key, "max_output_w"):
                    limitations.append(
                        f"{item_key} has no supported max_output_w value and cannot be verified."
                    )
            elif max_output_w < preferences.min_output_w:
                exclusion_reasons[item_key] = "below_min_output"

    objective_priorities = [
        priority for priority in preferences.priorities if priority != "review_reliability"
    ]
    if "review_reliability" in preferences.priorities:
        limitations.append(
            "Review reliability is explanatory evidence, not an objective ranking score."
        )

    eligible_item_keys = [item_key for item_key in item_keys if item_key not in exclusion_reasons]
    priority_values: dict[str, list[int | float]] = {
        item_key: [] for item_key in eligible_item_keys
    }
    for priority in objective_priorities:
        direction = OBJECTIVE_PRIORITY_DIRECTIONS[priority]
        for item_key in eligible_item_keys:
            value = _priority_value(evidence, item_key, priority)
            if value is None:
                if record_uncertainty(item_key, priority):
                    limitations.append(
                        f"{item_key} has no supported {priority} value and remains uncertain."
                    )
            else:
                priority_values[item_key].append(value * direction)

    comparable_item_keys = [
        item_key for item_key in eligible_item_keys if item_key not in uncertain_fields
    ]
    ranked_item_keys = (
        sorted(comparable_item_keys, key=lambda item_key: tuple(priority_values[item_key]))
        if objective_priorities
        else []
    )

    recommended_item_key: str | None = ranked_item_keys[0] if ranked_item_keys else None
    if len(ranked_item_keys) > 1:
        first_key = tuple(priority_values[ranked_item_keys[0]])
        second_key = tuple(priority_values[ranked_item_keys[1]])
        if first_key == second_key:
            recommended_item_key = None
            limitations.append("Top candidates are tied on every comparable priority.")

    return Recommendation(
        item_key=recommended_item_key,
        ranked_item_keys=ranked_item_keys,
        excluded_item_keys=[key for key in item_keys if key in exclusion_reasons],
        uncertain_item_keys=[key for key in item_keys if key in uncertain_fields],
        exclusion_reasons=exclusion_reasons,
        uncertain_fields=uncertain_fields,
        limitations=limitations,
    )
