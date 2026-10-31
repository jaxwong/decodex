import pytest
from pydantic import ValidationError

from app.contracts.session import Preferences
from app.decision.ranking import rank_comparison
from tests.decision.fixtures import load_comparison_evidence


def test_budget_filter_validates_currency_minor() -> None:
    with pytest.raises(ValidationError):
        Preferences(max_price_minor=-1)


def test_ranking_applies_hard_constraints_before_priorities() -> None:
    recommendation = rank_comparison(
        load_comparison_evidence(),
        Preferences(
            max_price_minor=7000,
            min_output_w=65,
            priorities=["weight_g", "price_minor"],
        ),
    )

    assert recommendation.item_key == "listingB:65w"
    assert recommendation.ranked_item_keys == ["listingB:65w", "listingA:100w"]
    assert recommendation.excluded_item_keys == ["listingC:87w"]
    assert recommendation.uncertain_item_keys == []


def test_ranking_does_not_guess_missing_weight() -> None:
    recommendation = rank_comparison(
        load_comparison_evidence(),
        Preferences(max_price_minor=8000, priorities=["weight_g", "price_minor"]),
    )

    assert recommendation.item_key == "listingB:65w"
    assert recommendation.ranked_item_keys == ["listingB:65w", "listingA:100w"]
    assert recommendation.excluded_item_keys == []
    assert recommendation.uncertain_item_keys == ["listingC:87w"]
    assert recommendation.limitations == [
        "listingC:87w has no supported weight_g value and remains uncertain."
    ]


def test_ranking_without_objective_priority_does_not_invent_winner() -> None:
    recommendation = rank_comparison(
        load_comparison_evidence(),
        Preferences(priorities=["review_reliability"]),
    )

    assert recommendation.item_key is None
    assert recommendation.ranked_item_keys == []
    assert recommendation.limitations == [
        "Review reliability is explanatory evidence, not an objective ranking score."
    ]
