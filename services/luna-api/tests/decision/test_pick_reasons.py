import pytest
from eval.fixtures import load_sample_evidence

from app.contracts.evidence import ComparisonEvidence
from app.contracts.session import Preferences
from app.decision.pick_reasons import PickAttribution, attribute_pick

ATLAS = "listingA:100w"  # SGD 75.00 delivered, 420 g, 100 W
BREEZE = "listingB:65w"  # SGD 81.65 delivered, 310 g, 65 W
COMET = "listingC:87w"  # SGD 72.87 delivered, weight not stated, 87 W


def with_breeze_weight(evidence: ComparisonEvidence, weight_g: int) -> ComparisonEvidence:
    facts = [
        fact.model_copy(update={"value": weight_g}) if fact.field_key == "weight_g" else fact
        for fact in evidence.facts_by_item[BREEZE]
    ]
    return evidence.model_copy(update={"facts_by_item": {**evidence.facts_by_item, BREEZE: facts}})


def test_constraint_that_only_the_rival_fails_is_the_reason() -> None:
    over_budget = attribute_pick(load_sample_evidence(), Preferences(max_price_minor=8000), ATLAS)
    below_output = attribute_pick(load_sample_evidence(), Preferences(min_output_w=80), ATLAS)

    assert over_budget == {
        BREEZE: PickAttribution(reason="over_budget", field_key=None),
        COMET: PickAttribution(reason="no_stated_reason", field_key=None),
    }
    assert below_output == {
        BREEZE: PickAttribution(reason="below_min_output", field_key=None),
        COMET: PickAttribution(reason="no_stated_reason", field_key=None),
    }


def test_priorities_are_walked_in_order_and_a_rival_win_falls_through() -> None:
    attributions = attribute_pick(
        load_sample_evidence(),
        Preferences(priorities=["weight_g", "price_minor"]),
        ATLAS,
    )

    # Comet states no weight; Breeze is lighter, so price is the first need Atlas wins.
    assert attributions == {
        COMET: PickAttribution(reason="not_stated", field_key="weight_g"),
        BREEZE: PickAttribution(reason="beaten_on", field_key="price_minor"),
    }


def test_tie_on_a_priority_falls_through_to_the_next() -> None:
    attributions = attribute_pick(
        with_breeze_weight(load_sample_evidence(), 420),
        Preferences(priorities=["weight_g", "price_minor"]),
        ATLAS,
    )

    assert attributions[BREEZE] == PickAttribution(reason="beaten_on", field_key="price_minor")


def test_review_reliability_has_no_value_and_is_skipped() -> None:
    attributions = attribute_pick(
        load_sample_evidence(),
        Preferences(priorities=["review_reliability", "price_minor"]),
        ATLAS,
    )

    assert attributions[BREEZE] == PickAttribution(reason="beaten_on", field_key="price_minor")


def test_no_stated_need_or_nothing_separating_them_is_reported_not_guessed() -> None:
    no_needs = attribute_pick(load_sample_evidence(), Preferences(), ATLAS)
    rival_wins = attribute_pick(load_sample_evidence(), Preferences(priorities=["weight_g"]), ATLAS)

    assert no_needs == {
        BREEZE: PickAttribution(reason="no_stated_reason", field_key=None),
        COMET: PickAttribution(reason="no_stated_reason", field_key=None),
    }
    # Breeze is lighter than the picked Atlas, so the stated need does not explain the pick.
    assert rival_wins[BREEZE] == PickAttribution(reason="no_stated_reason", field_key=None)


def test_constraint_both_fail_is_not_a_reason() -> None:
    attributions = attribute_pick(
        load_sample_evidence(),
        Preferences(max_price_minor=7000, priorities=["weight_g"]),
        ATLAS,
    )

    assert attributions == {
        BREEZE: PickAttribution(reason="no_stated_reason", field_key=None),
        COMET: PickAttribution(reason="not_stated", field_key="weight_g"),
    }


def test_picked_item_must_be_in_the_comparison() -> None:
    with pytest.raises(ValueError, match="listingZ:1w"):
        attribute_pick(load_sample_evidence(), Preferences(), "listingZ:1w")
