import asyncio
from collections.abc import Sequence

import pytest

from app.contracts.evidence import ComparisonEvidence
from app.contracts.session import ComparisonSelection, PreferencePatch
from app.decision.comparisons import ComparisonNotFound, create_comparison
from app.decision.sessions import DemoSessionStore, create_demo_session, require_active_demo_session
from app.decision.tools import (
    RevisionConflict,
    UnknownEvidence,
    UnknownItem,
    apply_preferences,
    get_comparison,
    get_review_aspect,
    inspect_evidence,
)
from tests.decision.fixtures import SELECTIONS, build_fixture_evidence


def create_comparison_state() -> tuple[DemoSessionStore, str, str]:
    """Create one session-owned comparison over the frozen B2 fixture."""
    session_store: DemoSessionStore = {}
    demo_session = create_demo_session(session_store)
    session_state = require_active_demo_session(session_store, token=demo_session.token)
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    comparison = asyncio.run(
        create_comparison(session_state, selections, build_evidence=build_fixture_evidence)
    )
    return session_store, demo_session.token, comparison.comparison_id


def test_create_comparison_calls_evidence_builder_once() -> None:
    session_store: DemoSessionStore = {}
    demo_session = create_demo_session(session_store)
    session_state = require_active_demo_session(session_store, token=demo_session.token)
    selections = [ComparisonSelection.model_validate(selection) for selection in SELECTIONS]
    build_calls: list[list[dict[str, str]]] = []

    async def counting_builder(
        requested_selections: Sequence[dict[str, str]],
    ) -> ComparisonEvidence:
        build_calls.append(list(requested_selections))
        return await build_fixture_evidence(requested_selections)

    comparison = asyncio.run(
        create_comparison(session_state, selections, build_evidence=counting_builder)
    )

    assert comparison.revision == 0
    assert comparison.preferences.model_dump() == {
        "max_price_minor": None,
        "min_output_w": None,
        "priorities": [],
    }
    assert comparison.recommendation.item_key is None
    apply_preferences(
        session_state,
        comparison.comparison_id,
        patch=PreferencePatch(priorities=["price_minor"]),
        expected_revision=0,
    )
    assert build_calls == [SELECTIONS]


def test_get_comparison_returns_compact_normalized_snapshot() -> None:
    session_store, token, comparison_id = create_comparison_state()
    session_state = require_active_demo_session(session_store, token=token)

    snapshot = get_comparison(session_state, comparison_id)

    assert snapshot.comparison_id == comparison_id
    assert snapshot.revision == 0
    assert [item.item_key for item in snapshot.items] == [
        "listingA:100w",
        "listingB:65w",
        "listingC:87w",
    ]
    assert snapshot.items[0].facts[0].evidence_ids
    assert "source_text" not in snapshot.model_dump_json()


def test_get_review_aspect_returns_counts_and_literal_mentions() -> None:
    session_store, token, comparison_id = create_comparison_state()
    session_state = require_active_demo_session(session_store, token=token)

    result = get_review_aspect(
        session_state,
        comparison_id,
        aspect="heat",
        item_keys=["listingA:100w", "listingB:65w"],
    )

    assert len(result.summaries) == 2
    assert all(summary.aspect == "heat" for summary in result.summaries)
    assert {mention.item_key for mention in result.mentions} == {
        "listingA:100w",
        "listingB:65w",
    }
    assert all(mention.excerpt for mention in result.mentions)


def test_tool_call_rejects_unknown_item() -> None:
    session_store, token, comparison_id = create_comparison_state()
    session_state = require_active_demo_session(session_store, token=token)

    with pytest.raises(UnknownItem, match="unknown item keys"):
        get_review_aspect(
            session_state,
            comparison_id,
            aspect="heat",
            item_keys=["invented:item"],
        )


def test_inspect_evidence_rejects_unknown_id_without_partial_result() -> None:
    session_store, token, comparison_id = create_comparison_state()
    session_state = require_active_demo_session(session_store, token=token)
    snapshot = get_comparison(session_state, comparison_id)
    known_evidence_id = snapshot.items[0].facts[0].evidence_ids[0]

    with pytest.raises(UnknownEvidence, match="unknown evidence IDs"):
        inspect_evidence(
            session_state,
            comparison_id,
            evidence_ids=[known_evidence_id, "invented:evidence"],
        )


def test_preferences_revision_conflict_preserves_newer_correction() -> None:
    session_store, token, comparison_id = create_comparison_state()
    session_state = require_active_demo_session(session_store, token=token)

    first_update = apply_preferences(
        session_state,
        comparison_id,
        patch=PreferencePatch(max_price_minor=8000, priorities=["weight_g", "price_minor"]),
        expected_revision=0,
    )

    assert first_update.ui_patch.base_revision == 0
    assert first_update.ui_patch.new_revision == 1
    assert first_update.ui_patch.highlight_item_key == "listingB:65w"
    assert first_update.recommendation.uncertain_item_keys == ["listingC:87w"]

    correction = apply_preferences(
        session_state,
        comparison_id,
        patch=PreferencePatch(priorities=["price_minor"]),
        expected_revision=1,
    )

    assert correction.ui_patch.base_revision == 1
    assert correction.ui_patch.new_revision == 2
    assert correction.ui_patch.highlight_item_key == "listingA:100w"

    with pytest.raises(RevisionConflict) as stale_failure:
        apply_preferences(
            session_state,
            comparison_id,
            patch=PreferencePatch(priorities=["max_output_w"]),
            expected_revision=1,
        )

    assert stale_failure.value.current_revision == 2
    current = get_comparison(session_state, comparison_id)
    assert current.revision == 2
    assert current.preferences.priorities == ["price_minor"]


def test_comparison_id_is_private_to_owning_session() -> None:
    session_store, _, comparison_id = create_comparison_state()
    other_session = create_demo_session(session_store)
    other_session_state = require_active_demo_session(session_store, token=other_session.token)

    with pytest.raises(ComparisonNotFound, match="comparison not found"):
        get_comparison(other_session_state, comparison_id)
