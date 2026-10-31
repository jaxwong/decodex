"""Validate candidates against source semantics and reconcile explicit contradictions."""

from app.contracts.evidence import Evidence, Fact, Status

from .model import CandidateFact, SpecCandidates
from .normalize import extract_source_values, normalize_value
from .schema import SCHEMA_FIELDS, UNITS


def unresolved_facts() -> list[Fact]:
    return [
        Fact(field_key=f["field_key"], status="unresolved", unit=f["unit"]) for f in SCHEMA_FIELDS
    ]


def validate_facts(
    candidates: SpecCandidates, evidence: dict[str, Evidence], item_key: str, variant_id: str
) -> list[Fact]:
    """Reject a questionable cell, preserve other cells, and never trust model conversion.

    Explicitly labelled source clauses form the deterministic acceptance boundary.
    Unfamiliar natural-language evidence is retained in the index but cannot become
    a supported value until its semantic interpretation has a tested parser.
    """
    by_field: dict[str, list[CandidateFact]] = {}
    for candidate in candidates.facts:
        by_field.setdefault(candidate.field_key, []).append(candidate)
    facts = []
    for field in SCHEMA_FIELDS:
        field_key = field["field_key"]
        matches = by_field.get(field_key, [])
        if len(matches) != 1:
            facts.append(Fact(field_key=field_key, status="unresolved", unit=UNITS[field_key]))
            continue
        facts.append(_validate_field(matches[0], evidence, item_key, variant_id))
    return facts


def _validate_field(
    candidate: CandidateFact, evidence: dict[str, Evidence], item_key: str, variant_id: str
) -> Fact:
    field_key = candidate.field_key

    def abstain(status: Status) -> Fact:
        return Fact(field_key=field_key, status=status, unit=UNITS[field_key])

    explicit_claims = []
    has_unclear_source = False
    for explicit_source in evidence.values():
        raw_values = extract_source_values(field_key, explicit_source.source_text)
        for raw_value in raw_values:
            if explicit_source.variant_id != variant_id or explicit_source.item_key != item_key:
                # A known sibling is excluded; unlabelled evidence remains uncertain.
                has_unclear_source |= explicit_source.variant_id is None
                continue
            try:
                explicit_claims.append((normalize_value(field_key, raw_value), explicit_source.id))
            except ValueError:
                has_unclear_source = True
    accepted = []
    for claim in candidate.claims:
        source = evidence.get(claim.evidence_id)
        if (
            source is None
            or source.item_key != item_key
            or source.variant_id != variant_id
            or claim.variant_id != variant_id
            or source.source_type in ("review", "external", "image")
            or not claim.quote
            or claim.quote not in source.source_text
            or claim.raw_value not in claim.quote
        ):
            return abstain("unresolved")
        try:
            normalized = normalize_value(field_key, claim.raw_value)
            source_values = [
                normalize_value(field_key, raw)
                for raw in extract_source_values(field_key, source.source_text)
            ]
            if normalized not in source_values:
                return abstain("unresolved")
        except ValueError:
            return abstain("unresolved")
        accepted.append((normalized, source.id))
    if candidate.status in ("missing", "unresolved"):
        if candidate.claims:
            return abstain("unresolved")
        # An extractor omission cannot silently erase a known contradictory claim.
        if candidate.status == "missing" and not explicit_claims and not has_unclear_source:
            return abstain("missing")
        return abstain("unresolved")
    if not accepted:
        return abstain("unresolved")
    # Reconcile all mechanically interpretable, explicitly scoped seller claims.
    # This prevents a model from hiding the 24-month claim by quoting only 12 months.
    accepted.extend(explicit_claims)
    unique_values = sorted({value for value, _ in accepted}, key=str)
    source_ids = sorted({source for _, source in accepted})
    if len(unique_values) > 1:
        return Fact(
            field_key=field_key,
            status="conflicting",
            unit=UNITS[field_key],
            evidence_ids=source_ids,
            conflicting_values=[str(v).lower() for v in unique_values],
        )
    if candidate.status == "conflicting" or has_unclear_source:
        return abstain("unresolved")
    return Fact(
        field_key=field_key,
        status="supported",
        value=unique_values[0],
        unit=UNITS[field_key],
        evidence_ids=source_ids,
    )
