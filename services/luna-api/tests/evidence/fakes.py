"""Test-only extraction double. Never import this in the shipped runtime or eval."""

from typing import Any

from app.contracts.evidence import Aspect, FieldKey, Sentiment
from app.evidence.model import (
    CandidateFact,
    CandidateMention,
    Claim,
    ReviewCandidates,
    SpecCandidates,
)
from app.evidence.normalize import extract_source_values
from app.evidence.schema import SCHEMA_FIELDS


class FakeModelClient:
    def __init__(self) -> None:
        self.spec_requests: list[dict[str, Any]] = []
        self.review_requests: list[dict[str, Any]] = []
        self.fail_items: set[str] = set()
        self.review_failure = False

    async def extract_specs(self, request: dict[str, Any]) -> SpecCandidates:
        self.spec_requests.append(request)
        if request["item_key"] in self.fail_items:
            raise TimeoutError("Injected timeout")
        facts = []
        for field in SCHEMA_FIELDS:
            claims = []
            for source in request["seller_evidence"]:
                if source["variant_id"] != request["variant_id"]:
                    continue
                for raw in extract_source_values(field.field_key, source["source_text"]):
                    claims.append(
                        Claim(
                            raw_value=raw,
                            quote=source["source_text"],
                            evidence_id=source["id"],
                            variant_id=source["variant_id"],
                        )
                    )
            facts.append(
                CandidateFact(
                    field_key=field.field_key,
                    status="supported" if claims else "missing",
                    claims=claims,
                )
            )
        return SpecCandidates(facts=facts)

    async def extract_reviews(self, request: dict[str, Any]) -> ReviewCandidates:
        self.review_requests.append(request)
        if self.review_failure:
            raise TimeoutError("Injected review timeout")
        mentions = []
        phrases: list[tuple[str, Aspect, Sentiment, FieldKey | None]] = [
            ("gets hot", "heat", "negative", None),
            ("stays cool", "heat", "positive", None),
            ("charges fast", "charging", "positive", None),
            ("charges slowly", "charging", "negative", None),
            ("feels light", "portability", "positive", None),
            ("feels heavy", "portability", "negative", None),
            ("stopped working", "reliability", "negative", None),
            ("works reliably", "reliability", "positive", None),
            ("good value", "value", "positive", None),
            ("poor value", "value", "negative", None),
            ("case is blue", "other", "neutral", None),
            (
                "Charges my phone twice, nowhere near 20000mAh",
                "charging",
                "negative",
                "capacity_mah",
            ),
            (
                "Only two phone charges per fill, not the 20000mAh claimed",
                "charging",
                "negative",
                "capacity_mah",
            ),
        ]
        for review in request["reviews"]:
            for phrase, aspect, sentiment, disputes_field_key in phrases:
                if phrase in review["text"]:
                    mentions.append(
                        CandidateMention(
                            review_id=review["review_id"],
                            aspect=aspect,
                            sentiment=sentiment,
                            excerpt=phrase,
                            disputes_field_key=disputes_field_key,
                        )
                    )
        return ReviewCandidates(mentions=mentions)
