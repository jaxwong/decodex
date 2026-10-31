import asyncio
from datetime import UTC, datetime

from eval.fixtures import SELECTIONS, build_sample_evidence

from app.contracts.evidence import ComparisonSelection
from app.contracts.session import Preferences
from app.decision.comparisons import create_comparison
from app.decision.gap_report import build_gap_report
from app.decision.sessions import (
    DemoSessionState,
    DemoSessionStore,
    create_demo_session,
    require_active_demo_session,
)
from app.decision.tools import apply_preferences

CHECKED_AT = datetime(2026, 10, 31, 3, 0, tzinfo=UTC)


def create_comparison_state() -> tuple[DemoSessionState, str]:
    session_store: DemoSessionStore = {}
    demo_session = create_demo_session(session_store, created_at=CHECKED_AT)
    session_state = require_active_demo_session(
        session_store,
        token=demo_session.token,
        checked_at=CHECKED_AT,
    )
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    comparison = asyncio.run(
        create_comparison(session_state, selections, build_evidence=build_sample_evidence)
    )
    return session_state, comparison.comparison_id


def test_empty_session_returns_zero_report() -> None:
    session_store: DemoSessionStore = {}
    demo_session = create_demo_session(session_store, created_at=CHECKED_AT)
    session_state = require_active_demo_session(
        session_store,
        token=demo_session.token,
        checked_at=CHECKED_AT,
    )

    report = build_gap_report(session_state, "listingC")

    assert report.model_dump() == {
        "listing_id": "listingC",
        "comparisons_count": 0,
        "gaps": [],
        "beaten_by": [],
        "exclusion_counts": {},
        "uncertainty_counts": {},
    }


def test_report_projects_gaps_and_supported_competitors_idempotently() -> None:
    session_state, _ = create_comparison_state()

    first = build_gap_report(session_state, "listingC")
    second = build_gap_report(session_state, "listingC")

    gaps = {gap.field_key: gap for gap in first.gaps}
    beaten_by = {entry.field_key: entry for entry in first.beaten_by}
    assert first == second
    assert first.comparisons_count == 1
    assert set(gaps) == {"weight_g", "warranty_months"}
    assert gaps["weight_g"].status == "missing"
    assert gaps["warranty_months"].status == "conflicting"
    assert gaps["warranty_months"].conflicting_values == ["12", "24"]
    assert gaps["warranty_months"].evidence_ids == [
        "listingC:87w:attribute:6",
        "listingC:87w:description:warranty",
    ]
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

    report = build_gap_report(session_state, "listingC")

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

    report = build_gap_report(session_state, "listingC")

    assert report.exclusion_counts == {}
    assert report.uncertainty_counts == {"weight_g": 1}


def test_supported_listing_has_no_gaps_or_exclusions() -> None:
    session_state, _ = create_comparison_state()

    report = build_gap_report(session_state, "listingA")

    assert report.comparisons_count == 1
    assert report.gaps == []
    assert report.beaten_by == []
    assert report.exclusion_counts == {}
    assert report.uncertainty_counts == {}
