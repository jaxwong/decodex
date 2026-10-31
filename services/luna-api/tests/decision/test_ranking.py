import pytest
from eval.fixtures import load_sample_evidence
from pydantic import ValidationError

from app.contracts.session import Preferences
from app.decision.ranking import rank_comparison


def test_budget_filter_validates_currency_minor() -> None:
    with pytest.raises(ValidationError):
        Preferences(max_price_minor=-1)


def test_ranking_applies_hard_constraints_before_priorities() -> None:
    recommendation = rank_comparison(
        load_sample_evidence(),
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
    assert recommendation.exclusion_reasons == {"listingC:87w": "over_budget"}
    assert recommendation.uncertain_fields == {}


def test_ranking_does_not_guess_missing_weight() -> None:
    recommendation = rank_comparison(
        load_sample_evidence(),
        Preferences(max_price_minor=8000, priorities=["weight_g", "price_minor"]),
    )

    assert recommendation.item_key == "listingB:65w"
    assert recommendation.ranked_item_keys == ["listingB:65w", "listingA:100w"]
    assert recommendation.excluded_item_keys == []
    assert recommendation.uncertain_item_keys == ["listingC:87w"]
    assert recommendation.exclusion_reasons == {}
    assert recommendation.uncertain_fields == {"listingC:87w": ["weight_g"]}
    assert recommendation.limitations == [
        "listingC:87w has no supported weight_g value and remains uncertain."
    ]


def test_ranking_records_minimum_output_exclusion_reason() -> None:
    recommendation = rank_comparison(
        load_sample_evidence(),
        Preferences(min_output_w=87),
    )

    assert recommendation.excluded_item_keys == ["listingB:65w"]
    assert recommendation.exclusion_reasons == {"listingB:65w": "below_min_output"}


def test_ranking_without_objective_priority_does_not_invent_winner() -> None:
    recommendation = rank_comparison(
        load_sample_evidence(),
        Preferences(priorities=["review_reliability"]),
    )

    assert recommendation.item_key is None
    assert recommendation.ranked_item_keys == []
    assert recommendation.limitations == [
        "Review reliability is explanatory evidence, not an objective ranking score."
    ]
