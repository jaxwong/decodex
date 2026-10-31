"""Label-based scoring with explicit numerators/denominators and unavailable values.

This scorer reads independently stored fixture labels; it does not invoke the
extraction normalizer to decide whether a citation actually supports a claim.
"""

from collections import Counter
from typing import Any

from app.contracts.evidence import ComparisonSelection

# Metrics that need review extraction; specification-only baselines omit them.
REVIEW_METRIC_PREFIXES = ("review_", "dispute_")


def ratio(numerator: int, denominator: int) -> dict[str, Any]:
    return {
        "value": numerator / denominator if denominator else None,
        "numerator": numerator,
        "denominator": denominator,
    }


def values_equal(left: object, right: object) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    return left == right


def score(
    prediction: dict[str, Any],
    ground_truth: dict[str, Any],
    selections: list[ComparisonSelection],
) -> dict[str, Any]:
    selected_keys = {f"{selection.listing_id}:{selection.variant_id}" for selection in selections}
    predicted_items = {item["item_key"]: item for item in prediction["items"]}
    identity_correct = sum(
        predicted_items.get(key, {}).get("listing_id") == key.rsplit(":", 1)[0]
        and predicted_items.get(key, {}).get("variant_id") == key.rsplit(":", 1)[1]
        for key in selected_keys
    )
    counts: Counter[str] = Counter()
    for key in sorted(selected_keys):
        actual_facts = {
            fact["field_key"]: fact for fact in prediction["facts_by_item"].get(key, [])
        }
        for field, expected in ground_truth["items"][key].items():
            actual = actual_facts.get(field, {})
            status, value = actual.get("status"), actual.get("value")
            if expected["status"] == "supported":
                counts["supported_total"] += 1
                counts["supported_correct"] += status == "supported" and values_equal(
                    value, expected["value"]
                )
            if expected["status"] == "missing":
                counts["missing_total"] += 1
                counts["missing_correct"] += status == "missing" and value is None
            if expected["status"] == "conflicting":
                counts["conflict_total"] += 1
                counts["conflict_correct"] += status == "conflicting" and set(
                    actual.get("conflicting_values", [])
                ) == set(expected["conflicting_values"])
            cited_ids = actual.get("evidence_ids", [])
            supported_claim = status == "supported"
            conflicting_claim = status == "conflicting"
            if supported_claim:
                counts["emitted_supported"] += 1
            if supported_claim or conflicting_claim:
                # A conflict is one claim per distinct advertised alternative.
                asserted = [value] if supported_claim else actual.get("conflicting_values", [])
                all_supported = bool(asserted) and bool(cited_ids)
                for asserted_value in asserted:
                    counts["cited_claims"] += bool(cited_ids)
                    valid = False
                    for source_id in cited_ids:
                        source = prediction["evidence"].get(source_id, {})
                        label = ground_truth["source_claims"][key].get(
                            source.get("source_location"), {}
                        )
                        label_value = label.get("value")
                        matches_value = (
                            values_equal(asserted_value, label_value)
                            if supported_claim
                            else str(asserted_value) == str(label_value)
                        )
                        if (
                            source.get("item_key") == key
                            and source.get("variant_id") == key.rsplit(":", 1)[1]
                            and label.get("field_key") == field
                            and matches_value
                        ):
                            valid = True
                    counts["supported_cited_claims"] += bool(cited_ids) and valid
                    all_supported &= valid
                if supported_claim:
                    counts["unsupported_emitted"] += not all_supported
            if field == "max_output_w":
                counts["variant_sensitive_total"] += 1
                for sibling_key, sibling in ground_truth["items"].items():
                    if sibling_key.rsplit(":", 1)[0] != key.rsplit(":", 1)[0] or sibling_key == key:
                        continue
                    if (
                        status == "supported"
                        and value != expected["value"]
                        and value == sibling[field]["value"]
                    ):
                        counts["variant_leaks"] += 1
                        break
    # Gold support units are (item, review, aspect, sentiment). Different valid
    # literal excerpt spans may support the same unit; duplicate mentions don't boost score.
    gold: dict[tuple[str, str, str, str], list[str]] = {}
    for review in ground_truth["reviews"]:
        key = f"{review['listing_id']}:{review['variant_id']}"
        if key not in selected_keys:
            continue
        for mention in review["mentions"]:
            unit = (key, review["review_id"], mention["aspect"], mention["sentiment"])
            gold.setdefault(unit, []).append(mention["excerpt"])
    emitted, matched = set(), set()
    for mention in prediction["review_mentions"].values():
        unit = (
            mention["item_key"],
            mention["review_id"],
            mention["aspect"],
            mention["sentiment"],
        )
        emitted.add(unit)
        sources = [
            source
            for source in prediction["evidence"].values()
            if source.get("review_id") == mention["review_id"]
            and source["item_key"] == mention["item_key"]
        ]
        literal = bool(mention["excerpt"]) and any(
            mention["excerpt"] in source["source_text"]
            and source["variant_id"] == mention["item_key"].rsplit(":", 1)[1]
            for source in sources
        )
        if literal and any(quote in mention["excerpt"] for quote in gold.get(unit, [])):
            matched.add(unit)
    # Dispute units are (item, field). An emitted dispute matches only when every cited
    # mention comes from a review labelled as contradicting that same seller claim.
    labelled_disputes = {
        (key, field): set(review_ids)
        for key, fields in ground_truth["disputes"].items()
        if key in selected_keys
        for field, review_ids in fields.items()
    }
    emitted_disputes, matched_disputes = set(), set()
    for key in selected_keys:
        for fact in prediction["facts_by_item"].get(key, []):
            mention_ids = fact.get("disputing_mention_ids", [])
            if not mention_ids:
                continue
            dispute_unit = (key, fact["field_key"])
            emitted_disputes.add(dispute_unit)
            review_ids = {
                prediction["review_mentions"].get(mention_id, {}).get("review_id")
                for mention_id in mention_ids
            }
            if review_ids <= labelled_disputes.get(dispute_unit, set()):
                matched_disputes.add(dispute_unit)
    return {
        "exact_variant_accuracy": ratio(identity_correct, len(selected_keys)),
        "supported_field_accuracy": ratio(counts["supported_correct"], counts["supported_total"]),
        "evidence_precision": ratio(counts["supported_cited_claims"], counts["cited_claims"]),
        "unsupported_claim_rate": ratio(counts["unsupported_emitted"], counts["emitted_supported"]),
        "missing_field_recall": ratio(counts["missing_correct"], counts["missing_total"]),
        "contradiction_recall": ratio(counts["conflict_correct"], counts["conflict_total"]),
        "variant_leakage_rate": ratio(counts["variant_leaks"], counts["variant_sensitive_total"]),
        "review_mention_precision": ratio(len(matched), len(emitted)),
        "review_mention_recall": ratio(len(matched), len(gold)),
        "dispute_precision": ratio(len(matched_disputes), len(emitted_disputes)),
        "dispute_recall": ratio(len(matched_disputes), len(labelled_disputes)),
    }
