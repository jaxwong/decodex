"""Build the read-only seller projection from one authorized demo session."""

from app.contracts.session import (
    ExclusionReason,
    ListingBeatenBy,
    ListingGapField,
    ListingGapReport,
)
from app.decision.sessions import DemoSessionState


def build_gap_report(session_state: DemoSessionState, listing_id: str) -> ListingGapReport:
    """Project current evidence gaps and decision reasons without retaining new state."""
    comparisons = [
        comparison
        for comparison in session_state.comparisons.values()
        if any(item.listing_id == listing_id for item in comparison.evidence.items)
    ]
    gaps: dict[tuple[str, str, str], ListingGapField] = {}
    competitor_keys: dict[tuple[str, str], list[str]] = {}
    exclusion_counts: dict[ExclusionReason, int] = {}
    uncertainty_counts: dict[str, int] = {}

    for comparison in comparisons:
        evidence = comparison.evidence
        target_items = [item for item in evidence.items if item.listing_id == listing_id]
        for item in target_items:
            for fact in evidence.facts_by_item[item.item_key]:
                if fact.status == "supported":
                    continue
                gap = ListingGapField(
                    item_key=item.item_key,
                    field_key=fact.field_key,
                    status=fact.status,
                    conflicting_values=list(fact.conflicting_values),
                    evidence_ids=list(fact.evidence_ids),
                )
                gap_key = (item.item_key, fact.field_key, fact.status)
                existing_gap = gaps.get(gap_key)
                if existing_gap is not None and existing_gap != gap:
                    raise RuntimeError(
                        "Gap report requires stable facts within one demo session: "
                        f"listing_id={listing_id!r}, item_key={item.item_key!r}, "
                        f"field_key={fact.field_key!r}"
                    )
                gaps[gap_key] = gap

                field_competitors = competitor_keys.setdefault((item.item_key, fact.field_key), [])
                for competitor in evidence.items:
                    if competitor.item_key == item.item_key:
                        continue
                    competitor_fact = next(
                        candidate
                        for candidate in evidence.facts_by_item[competitor.item_key]
                        if candidate.field_key == fact.field_key
                    )
                    if (
                        competitor_fact.status == "supported"
                        and competitor.item_key not in field_competitors
                    ):
                        field_competitors.append(competitor.item_key)

            exclusion_reason = comparison.recommendation.exclusion_reasons.get(item.item_key)
            if exclusion_reason is not None:
                exclusion_counts[exclusion_reason] = exclusion_counts.get(exclusion_reason, 0) + 1
            for field_key in comparison.recommendation.uncertain_fields.get(item.item_key, []):
                uncertainty_counts[field_key] = uncertainty_counts.get(field_key, 0) + 1

    beaten_by = [
        ListingBeatenBy(
            item_key=item_key,
            field_key=field_key,
            competitor_item_keys=keys,
        )
        for (item_key, field_key), keys in competitor_keys.items()
        if keys
    ]
    return ListingGapReport(
        listing_id=listing_id,
        comparisons_count=len(comparisons),
        gaps=list(gaps.values()),
        beaten_by=beaten_by,
        exclusion_counts=exclusion_counts,
        uncertainty_counts=uncertainty_counts,
    )
