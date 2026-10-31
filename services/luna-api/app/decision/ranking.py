"""Own deterministic comparison filtering and explainable lexicographic ranking."""

from app.contracts.evidence import ComparisonEvidence
from app.contracts.session import Preferences, RankingPriority, Recommendation

OBJECTIVE_PRIORITY_DIRECTIONS: dict[RankingPriority, int] = {
    "weight_g": 1,
    "price_minor": 1,
    "max_output_w": -1,
}


def _item_keys(evidence: ComparisonEvidence) -> list[str]:
    return [item.item_key for item in evidence.items]


def _price_minor(evidence: ComparisonEvidence, item_key: str) -> int:
    item = next(item for item in evidence.items if item.item_key == item_key)
    return item.price_minor


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
        return _price_minor(evidence, item_key)
    if priority == "review_reliability":
        return None
    return _supported_number(evidence, item_key, priority)


def rank_comparison(
    evidence: ComparisonEvidence,
    preferences: Preferences,
) -> Recommendation:
    """Apply hard constraints, separate uncertainty, and rank comparable candidates."""
    item_keys = _item_keys(evidence)
    excluded_item_keys: set[str] = set()
    uncertain_item_keys: set[str] = set()
    limitations: list[str] = []

    for item_key in item_keys:
        if (
            preferences.max_price_minor is not None
            and _price_minor(evidence, item_key) > preferences.max_price_minor
        ):
            excluded_item_keys.add(item_key)
            continue
        if preferences.min_output_w is not None:
            max_output_w = _supported_number(evidence, item_key, "max_output_w")
            if max_output_w is None:
                uncertain_item_keys.add(item_key)
                limitations.append(
                    f"{item_key} has no supported max_output_w value and cannot be verified."
                )
            elif max_output_w < preferences.min_output_w:
                excluded_item_keys.add(item_key)

    objective_priorities = [
        priority for priority in preferences.priorities if priority != "review_reliability"
    ]
    if "review_reliability" in preferences.priorities:
        limitations.append(
            "Review reliability is explanatory evidence, not an objective ranking score."
        )

    eligible_item_keys = [item_key for item_key in item_keys if item_key not in excluded_item_keys]
    priority_values: dict[str, list[int | float]] = {
        item_key: [] for item_key in eligible_item_keys
    }
    for priority in objective_priorities:
        direction = OBJECTIVE_PRIORITY_DIRECTIONS[priority]
        for item_key in eligible_item_keys:
            value = _priority_value(evidence, item_key, priority)
            if value is None:
                uncertain_item_keys.add(item_key)
                limitations.append(
                    f"{item_key} has no supported {priority} value and remains uncertain."
                )
            else:
                priority_values[item_key].append(value * direction)

    comparable_item_keys = [
        item_key for item_key in eligible_item_keys if item_key not in uncertain_item_keys
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
        excluded_item_keys=[key for key in item_keys if key in excluded_item_keys],
        uncertain_item_keys=[key for key in item_keys if key in uncertain_item_keys],
        limitations=limitations,
    )
