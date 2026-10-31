"""Build the read-only seller projection from buyer comparisons."""

from collections.abc import Iterable

from app.contracts.session import (
    ComparisonResponse,
    ExclusionReason,
    ListingBeatenBy,
    ListingGapField,
    ListingGapReport,
    ListingLostPick,
    PickReason,
)
from app.decision.pick_reasons import attribute_pick
from app.evidence.schema import SCHEMA_FIELDS


def build_gap_report(
    comparisons: Iterable[ComparisonResponse], listing_id: str
) -> ListingGapReport:
    """Project current evidence gaps and decision reasons without retaining new state."""
    matching = [
        comparison
        for comparison in comparisons
        if any(item.listing_id == listing_id for item in comparison.evidence.items)
    ]
    # Each comparison extracts the listing independently, so two buyers' comparisons can
    # disagree about the same field. Both findings are kept rather than one chosen.
    gaps: list[ListingGapField] = []
    competitor_keys: dict[tuple[str, str], list[str]] = {}
    exclusion_counts: dict[ExclusionReason, int] = {}
    uncertainty_counts: dict[str, int] = {}
    lost_pick_counts: dict[tuple[str, str, PickReason, str | None], int] = {}
    picked_count = 0

    for comparison in matching:
        evidence = comparison.evidence
        target_items = [item for item in evidence.items if item.listing_id == listing_id]
        # A pick of any of this listing's items is a win; a pick of a competitor is a loss for
        # each of this listing's items, attributed to the needs stated when the buyer picked.
        pick = comparison.pick
        if pick is not None and any(item.item_key == pick.item_key for item in target_items):
            picked_count += 1
        elif pick is not None:
            attributions = attribute_pick(evidence, pick.preferences, pick.item_key)
            for item in target_items:
                attribution = attributions[item.item_key]
                key = (item.item_key, pick.item_key, attribution.reason, attribution.field_key)
                lost_pick_counts[key] = lost_pick_counts.get(key, 0) + 1
        for item in target_items:
            for fact in evidence.facts_by_item[item.item_key]:
                if fact.status == "supported":
                    continue
                gap = ListingGapField(
                    item_key=item.item_key,
                    field_key=fact.field_key,
                    status=fact.status,
                    conflicting_values=list(fact.conflicting_values),
                    evidence=[evidence.evidence[source_id] for source_id in fact.evidence_ids],
                )
                if gap not in gaps:
                    gaps.append(gap)

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
        schema_fields=SCHEMA_FIELDS,
        comparisons_count=len(matching),
        gaps=gaps,
        beaten_by=beaten_by,
        exclusion_counts=exclusion_counts,
        uncertainty_counts=uncertainty_counts,
        lost_picks=[
            ListingLostPick(
                item_key=item_key,
                competitor_item_key=competitor_item_key,
                reason=reason,
                field_key=field_key,
                count=count,
            )
            for (item_key, competitor_item_key, reason, field_key), count in (
                lost_pick_counts.items()
            )
        ],
        picked_count=picked_count,
    )
