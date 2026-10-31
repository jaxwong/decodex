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
            max_price_minor=8000,
            min_output_w=65,
            priorities=["weight_g", "price_minor"],
        ),
    )

    assert recommendation.item_key == "listingA:100w"
    assert recommendation.ranked_item_keys == ["listingA:100w"]
    assert recommendation.excluded_item_keys == ["listingB:65w"]
    assert recommendation.uncertain_item_keys == ["listingC:87w"]
    assert recommendation.exclusion_reasons == {"listingB:65w": "over_budget"}
    assert recommendation.uncertain_fields == {"listingC:87w": ["weight_g"]}


def test_ranking_does_not_guess_missing_weight() -> None:
    recommendation = rank_comparison(
        load_sample_evidence(),
        Preferences(max_price_minor=9000, priorities=["weight_g", "price_minor"]),
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


def test_price_priority_uses_landed_total_and_reverses_sticker_order() -> None:
    evidence = load_sample_evidence()

    assert [
        item.item_key for item in sorted(evidence.items, key=lambda item: item.price_minor)
    ] == [
        "listingA:100w",
        "listingB:65w",
        "listingC:87w",
    ]

    recommendation = rank_comparison(evidence, Preferences(priorities=["price_minor"]))

    assert recommendation.ranked_item_keys == [
        "listingC:87w",
        "listingA:100w",
        "listingB:65w",
    ]


def test_under_eighty_budget_excludes_item_only_after_delivery_costs() -> None:
    evidence = load_sample_evidence()
    listing_b = next(item for item in evidence.items if item.item_key == "listingB:65w")

    assert listing_b.price_minor < 8000
    assert listing_b.landed_price_minor > 8000

    recommendation = rank_comparison(evidence, Preferences(max_price_minor=8000))

    assert recommendation.exclusion_reasons == {"listingB:65w": "over_budget"}


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
