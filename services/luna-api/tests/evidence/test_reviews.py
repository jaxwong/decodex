from typing import Any

import pytest
from pydantic import ValidationError

from app.contracts.evidence import AnalyzedComparisonItem, ComparisonEvidence
from app.evidence.model import ReviewCandidates
from app.evidence.reviews import (
    ReviewValidation,
    aggregate_reviews,
    review_batches,
    validate_review_mentions,
)
from app.providers import CatalogError, MockCatalogProvider
from tests.evidence.fakes import FakeModelClient
from tests.evidence.test_pipeline import SELECTIONS, comparison, fact


def validate(
    review_id: str = "r1", excerpt: str = "gets hot", variant_id: str | None = "100w"
) -> ReviewValidation:
    reviews = [
        {"review_id": "r1", "variant_id": variant_id, "text": "It gets hot but charges fast."}
    ]
    candidates = ReviewCandidates.model_validate(
        {
            "mentions": [
                {
                    "review_id": review_id,
                    "aspect": "heat",
                    "sentiment": "negative",
                    "excerpt": excerpt,
                }
            ]
        }
    )
    return validate_review_mentions(candidates, reviews, "listingA:100w", "100w")


def test_review_quote_must_be_substring() -> None:
    assert validate(excerpt="dangerously overheats").mentions == {}
    assert validate().rejected_count == 0
    assert validate().mentions


@pytest.mark.parametrize("excerpt", ["", " ", "Gets hot", "gets HOT"])
def test_empty_or_case_changed_review_quotes_rejected(excerpt: str) -> None:
    assert validate(excerpt=excerpt).rejected_count == 1


def test_review_unknown_variant_not_exact_sku() -> None:
    assert validate(variant_id=None).mentions == {}
    result = comparison()
    assert all(
        isinstance(item, AnalyzedComparisonItem)
        and item.review_coverage.unknown_variant_reviews_excluded == 2
        for item in result.items
    )
    for mention in result.review_mentions.values():
        sources = [
            s
            for s in result.evidence.values()
            if s.item_key == mention.item_key and s.review_id == mention.review_id
        ]
        assert sources and all(s.variant_id == mention.item_key.split(":")[-1] for s in sources)


def test_sibling_review_not_exact_sku() -> None:
    assert validate(variant_id="130w").rejected_count == 1


def test_unknown_review_id_rejected() -> None:
    assert validate(review_id="invented").rejected_count == 1


def test_multi_aspect_review_extraction() -> None:
    result = comparison()
    mentions = [
        m
        for m in result.review_mentions.values()
        if m.item_key == "listingA:100w" and m.review_id == "listingA-r11"
    ]
    assert {(m.aspect, m.sentiment) for m in mentions} == {
        ("heat", "negative"),
        ("charging", "positive"),
    }


def test_mixed_sentiment_unique_review_aggregation() -> None:
    result = comparison()
    mentions = result.review_mentions
    summary = next(
        s for s in result.review_summaries if s.item_key == "listingA:100w" and s.aspect == "heat"
    )
    assert (summary.positive_count, summary.negative_count, summary.analyzed_reviews) == (2, 3, 14)
    mixed = [m for m in mentions.values() if m.review_id == "listingA-r12"]
    assert {m.sentiment for m in mixed} == {"positive", "negative"}
    duplicate = next(m for m in mixed if m.sentiment == "negative")
    repeated = dict(mentions, extra=duplicate.model_copy(update={"id": "extra", "excerpt": "hot"}))
    recomputed = aggregate_reviews(
        "listingA:100w", repeated, {f"listingA-r{n:02}" for n in range(1, 15)}
    )
    assert next(s for s in recomputed if s.aspect == "heat").negative_count == 3


def test_failed_review_batch_not_counted_as_analyzed() -> None:
    model = FakeModelClient()
    model.review_failure = True
    result = comparison(model)
    assert not result.review_mentions
    assert all(s.analyzed_reviews == 0 for s in result.review_summaries)
    assert all(
        isinstance(item, AnalyzedComparisonItem) and item.review_status == "unresolved"
        for item in result.items
    )
    assert fact(result, "listingA:100w", "weight_g").value == 420


def test_review_provider_failure_preserves_specs() -> None:
    class UnavailableReviewProvider(MockCatalogProvider):
        async def get_reviews(
            self,
            listing_id: str,
            variant_id: str | None,
            cursor: str | None = None,
            limit: int = 50,
        ) -> dict[str, Any]:
            raise CatalogError("provider_unavailable")

    result = comparison(provider=UnavailableReviewProvider())
    assert fact(result, "listingA:100w", "max_output_w").value == 100
    assert all(
        isinstance(item, AnalyzedComparisonItem) and item.review_status == "unresolved"
        for item in result.items
    )


def test_changed_snapshot_excludes_review_batch() -> None:
    class ChangedProvider(MockCatalogProvider):
        async def get_reviews(
            self,
            listing_id: str,
            variant_id: str | None,
            cursor: str | None = None,
            limit: int = 50,
        ) -> dict[str, Any]:
            page = await super().get_reviews(listing_id, variant_id, cursor=cursor, limit=limit)
            page["snapshot_version"] = "changed"
            return page

    result = comparison(provider=ChangedProvider())
    assert not result.review_mentions
    assert all(
        isinstance(item, AnalyzedComparisonItem) and item.review_status == "unresolved"
        for item in result.items
    )


def test_unknown_review_variant_classification_before_model() -> None:
    model = FakeModelClient()
    comparison(model)
    assert len(model.review_requests) == 3
    for request in model.review_requests:
        assert len(request["reviews"]) == 14
        assert all(r["variant_id"] == request["variant_id"] for r in request["reviews"])


def test_review_bounded_batch_sizes() -> None:
    assert [len(batch) for batch in review_batches([{}] * 21)] == [11, 10]
    assert [len(batch) for batch in review_batches([{}] * 54)] == [18, 18, 18]
    assert review_batches([]) == []
    for count in range(10, 101):
        batches = review_batches([{}] * count)
        assert sum(map(len, batches)) == count and all(10 <= len(batch) <= 20 for batch in batches)


def test_contract_rejects_hallucinated_review_quote() -> None:
    result = comparison().model_dump()
    next(iter(result["review_mentions"].values()))["excerpt"] = "fabricated dangerous defect"
    with pytest.raises(ValidationError):
        ComparisonEvidence.model_validate(result)


def test_contract_rejects_wrong_review_summary_counts() -> None:
    result = comparison().model_dump()
    result["review_summaries"][0]["negative_count"] = 999
    with pytest.raises(ValidationError):
        ComparisonEvidence.model_validate(result)


def test_malformed_review_output_abstains() -> None:
    class InvalidReviewClient(FakeModelClient):
        async def extract_reviews(self, request: dict[str, Any]) -> Any:
            # This test deliberately supplies a malformed external response.
            return {"mentions": [{"aspect": "explosion", "excerpt": "invented"}]}

    result = comparison(InvalidReviewClient())
    assert not result.review_mentions
    assert all(
        isinstance(item, AnalyzedComparisonItem) and item.review_status == "unresolved"
        for item in result.items
    )


def test_partially_failed_review_batches_keep_successful_denominator() -> None:
    class ManyReviewsProvider(MockCatalogProvider):
        async def get_reviews(
            self,
            listing_id: str,
            variant_id: str | None,
            cursor: str | None = None,
            limit: int = 50,
        ) -> dict[str, Any]:
            page = await super().get_reviews(listing_id, variant_id, cursor=cursor, limit=limit)
            if cursor is None:
                review = (
                    next(r for r in page["reviews"] if r["variant_id"] == SELECTIONS[0].variant_id)
                    if listing_id == "listingA"
                    else None
                )
                if review:
                    page["reviews"].extend(dict(review, review_id=f"extra-{i}") for i in range(10))
            return page

    class PartialReviewClient(FakeModelClient):
        async def extract_reviews(self, request: dict[str, Any]) -> ReviewCandidates:
            if any(r["review_id"] == "extra-9" for r in request["reviews"]):
                raise TimeoutError("Injected second-batch failure")
            return await super().extract_reviews(request)

    result = comparison(PartialReviewClient(), provider=ManyReviewsProvider())
    summary = next(
        s for s in result.review_summaries if s.item_key == "listingA:100w" and s.aspect == "heat"
    )
    assert summary.analyzed_reviews == 12
    first_item = result.items[0]
    assert isinstance(first_item, AnalyzedComparisonItem)
    assert first_item.review_status == "unresolved"
    assert first_item.review_coverage.exact_reviews_available == 24
