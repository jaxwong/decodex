import asyncio
from collections.abc import Sequence
from datetime import UTC, datetime

from eval.fixtures import SELECTIONS, build_sample_evidence

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection
from app.contracts.session import ComparisonResponse, ListingLostPick, Preferences
from app.decision.comparisons import (
    BuildComparisonEvidence,
    create_comparison,
    record_pick,
)
from app.decision.gap_report import build_gap_report
from app.decision.sessions import (
    DemoSessionState,
    DemoSessionStore,
    create_demo_session,
    require_active_demo_session,
)
from app.decision.tools import apply_preferences
from app.evidence.schema import SCHEMA_FIELDS

CHECKED_AT = datetime(2026, 10, 31, 3, 0, tzinfo=UTC)


def create_comparison_state(
    session_store: DemoSessionStore | None = None,
    build_evidence: BuildComparisonEvidence = build_sample_evidence,
) -> tuple[DemoSessionState, str]:
    store: DemoSessionStore = {} if session_store is None else session_store
    demo_session = create_demo_session(store, created_at=CHECKED_AT)
    session_state = require_active_demo_session(
        store,
        token=demo_session.token,
        checked_at=CHECKED_AT,
    )
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    comparison = asyncio.run(
        create_comparison(session_state, selections, build_evidence=build_evidence)
    )
    return session_state, comparison.comparison_id


def every_comparison(session_store: DemoSessionStore) -> list[ComparisonResponse]:
    return [
        comparison
        for session_state in session_store.values()
        for comparison in session_state.comparisons.values()
    ]


async def build_reordered_warranty_evidence(
    selections: Sequence[ComparisonSelection],
) -> ComparisonEvidence:
    """Simulate a second extraction that lists listing C's warranty conflict the other way."""
    evidence = await build_sample_evidence(selections)
    facts = [
        fact.model_copy(
            update={
                "conflicting_values": fact.conflicting_values[::-1],
                "evidence_ids": fact.evidence_ids[::-1],
            }
        )
        if fact.field_key == "warranty_months"
        else fact
        for fact in evidence.facts_by_item["listingC:87w"]
    ]
    return evidence.model_copy(
        update={"facts_by_item": {**evidence.facts_by_item, "listingC:87w": facts}}
    )


def test_no_comparisons_returns_zero_report() -> None:
    report = build_gap_report([], "listingC")

    assert report.schema_fields == SCHEMA_FIELDS
    assert report.model_dump(exclude={"schema_fields"}) == {
        "listing_id": "listingC",
        "comparisons_count": 0,
        "gaps": [],
        "beaten_by": [],
        "exclusion_counts": {},
        "uncertainty_counts": {},
        "lost_picks": [],
        "picked_count": 0,
    }


def test_report_projects_gaps_and_supported_competitors_idempotently() -> None:
    session_state, _ = create_comparison_state()

    first = build_gap_report(session_state.comparisons.values(), "listingC")
    second = build_gap_report(session_state.comparisons.values(), "listingC")

    gaps = {gap.field_key: gap for gap in first.gaps}
    beaten_by = {entry.field_key: entry for entry in first.beaten_by}
    assert first == second
    assert first.comparisons_count == 1
    assert set(gaps) == {"weight_g", "warranty_months"}
    assert gaps["weight_g"].status == "missing"
    assert gaps["warranty_months"].status == "conflicting"
    assert gaps["warranty_months"].conflicting_values == ["12", "24"]
    assert [(source.id, source.source_text) for source in gaps["warranty_months"].evidence] == [
        ("listingC:87w:attribute:6", "Warranty: 1 year"),
        ("listingC:87w:description:warranty", "Warranty: 24 months"),
    ]
    assert gaps["weight_g"].evidence == []
    assert beaten_by["weight_g"].competitor_item_keys == [
        "listingA:100w",
        "listingB:65w",
    ]


def test_report_counts_current_exclusion_reason() -> None:
    session_state, comparison_id = create_comparison_state()
    apply_preferences(
        session_state,
        comparison_id,
        preferences=Preferences(
            max_price_minor=7000,
            min_output_w=65,
            priorities=["weight_g", "price_minor"],
        ),
        expected_revision=0,
    )

    report = build_gap_report(session_state.comparisons.values(), "listingC")

    assert report.exclusion_counts == {"over_budget": 1}
    assert report.uncertainty_counts == {}


def test_report_counts_current_uncertainty() -> None:
    session_state, comparison_id = create_comparison_state()
    apply_preferences(
        session_state,
        comparison_id,
        preferences=Preferences(
            max_price_minor=8000,
            priorities=["weight_g", "price_minor"],
        ),
        expected_revision=0,
    )

    report = build_gap_report(session_state.comparisons.values(), "listingC")

    assert report.exclusion_counts == {}
    assert report.uncertainty_counts == {"weight_g": 1}


def test_supported_listing_has_no_gaps_or_exclusions() -> None:
    session_state, _ = create_comparison_state()

    report = build_gap_report(session_state.comparisons.values(), "listingA")

    assert report.comparisons_count == 1
    assert report.gaps == []
    assert report.beaten_by == []
    assert report.exclusion_counts == {}
    assert report.uncertainty_counts == {}
    assert report.lost_picks == []
    assert report.picked_count == 0


def test_report_adds_up_comparisons_from_every_buyer_session() -> None:
    session_store: DemoSessionStore = {}
    over_budget_buyer, comparison_id = create_comparison_state(session_store)
    create_comparison_state(session_store)
    apply_preferences(
        over_budget_buyer,
        comparison_id,
        preferences=Preferences(max_price_minor=7000, priorities=["price_minor"]),
        expected_revision=0,
    )

    report = build_gap_report(every_comparison(session_store), "listingC")

    assert len(session_store) == 2
    assert report.comparisons_count == 2
    assert report.exclusion_counts == {"over_budget": 1}
    assert {gap.field_key for gap in report.gaps} == {"weight_g", "warranty_months"}
    assert len(report.gaps) == 2


def test_disagreeing_extractions_are_both_reported() -> None:
    session_store: DemoSessionStore = {}
    create_comparison_state(session_store)
    create_comparison_state(session_store, build_reordered_warranty_evidence)

    report = build_gap_report(every_comparison(session_store), "listingC")

    warranty_values = [
        gap.conflicting_values for gap in report.gaps if gap.field_key == "warranty_months"
    ]
    assert report.comparisons_count == 2
    assert warranty_values == [["12", "24"], ["24", "12"]]


def test_report_attributes_a_recorded_pick_to_each_losing_listing() -> None:
    session_state, comparison_id = create_comparison_state()
    apply_preferences(
        session_state,
        comparison_id,
        preferences=Preferences(
            max_price_minor=8000,
            min_output_w=65,
            priorities=["weight_g", "price_minor"],
        ),
        expected_revision=0,
    )
    record_pick(session_state, comparison_id, item_key="listingA:100w", expected_revision=1)

    comet = build_gap_report(session_state.comparisons.values(), "listingC")
    breeze = build_gap_report(session_state.comparisons.values(), "listingB")
    atlas = build_gap_report(session_state.comparisons.values(), "listingA")

    assert comet.picked_count == 0
    assert comet.lost_picks == [
        ListingLostPick(
            item_key="listingC:87w",
            competitor_item_key="listingA:100w",
            reason="not_stated",
            field_key="weight_g",
            count=1,
        )
    ]
    assert breeze.lost_picks == [
        ListingLostPick(
            item_key="listingB:65w",
            competitor_item_key="listingA:100w",
            reason="over_budget",
            field_key=None,
            count=1,
        )
    ]
    assert atlas.picked_count == 1
    assert atlas.lost_picks == []


def test_pick_is_attributed_to_the_needs_stated_when_it_was_made() -> None:
    session_store: DemoSessionStore = {}
    first_buyer, first_id = create_comparison_state(session_store)
    second_buyer, second_id = create_comparison_state(session_store)
    apply_preferences(
        first_buyer,
        first_id,
        preferences=Preferences(max_price_minor=8000),
        expected_revision=0,
    )
    record_pick(first_buyer, first_id, item_key="listingA:100w", expected_revision=1)
    # Changing needs after the pick neither drops it nor rewrites why it was made.
    apply_preferences(first_buyer, first_id, preferences=Preferences(), expected_revision=1)
    record_pick(second_buyer, second_id, item_key="listingA:100w", expected_revision=0)

    report = build_gap_report(every_comparison(session_store), "listingB")

    assert first_buyer.comparisons[first_id].revision == 2
    assert report.comparisons_count == 2
    assert report.lost_picks == [
        ListingLostPick(
            item_key="listingB:65w",
            competitor_item_key="listingA:100w",
            reason="over_budget",
            field_key=None,
            count=1,
        ),
        ListingLostPick(
            item_key="listingB:65w",
            competitor_item_key="listingA:100w",
            reason="no_stated_reason",
            field_key=None,
            count=1,
        ),
    ]
