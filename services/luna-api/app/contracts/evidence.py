"""Frozen v3.2 evidence, selection, and catalog wire contracts."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Status = Literal["supported", "missing", "conflicting", "unresolved"]
SourceType = Literal["title", "description", "attribute", "variant", "review", "image", "external"]
FieldKey = Literal[
    "capacity_mah",
    "max_output_w",
    "usb_c_ports",
    "weight_g",
    "max_input_w",
    "pd_supported",
    "included_cable",
    "warranty_months",
]
Aspect = Literal["heat", "portability", "charging", "reliability", "value", "other"]
Sentiment = Literal["positive", "negative", "neutral"]


class _EvidenceModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)


class ComparisonSelection(_EvidenceModel):
    """One exact listing variant selected by its provider-owned identity."""

    listing_id: str = Field(min_length=1)
    variant_id: str = Field(min_length=1)


class CatalogVariant(_EvidenceModel):
    """One exact provider variant selectable by the frontend."""

    id: str
    variant_id: str
    label: str
    price_minor: int = Field(ge=0)
    shop_voucher_minor: int = Field(ge=0)
    shipping_minor: int = Field(ge=0)
    currency: str


class CatalogListing(_EvidenceModel):
    """A bounded listing preview whose complete evidence remains server-side."""

    id: str
    listing_id: str
    title: str
    synthetic: bool
    image_url: str | None
    preview: str
    variants: list[CatalogVariant]


class CatalogResponse(_EvidenceModel):
    """The provider-backed catalog projection returned to authenticated hosts."""

    listings: list[CatalogListing]


class StorefrontVariant(CatalogVariant):
    """One exact variant with its specification lines exactly as the seller wrote them."""

    specifications: list[str]


class StorefrontDescription(_EvidenceModel):
    """One seller description paragraph; variant_id is None when it covers every variant."""

    text: str
    variant_id: str | None


class StorefrontReview(_EvidenceModel):
    """One buyer review as posted; variant_id is None when the buyer's variant is unknown."""

    review_id: str
    variant_id: str | None
    rating: int = Field(ge=1, le=5)
    text: str


class StorefrontListing(_EvidenceModel):
    """A listing page as shoppers see it: seller claims as written, not verified evidence."""

    listing_id: str
    title: str
    synthetic: bool
    image_url: str | None
    description: list[StorefrontDescription]
    variants: list[StorefrontVariant]
    reviews: list[StorefrontReview]


class ReviewCoverage(_EvidenceModel):
    """Exact-variant review inclusion and rejection counts for one analyzed item."""

    exact_reviews_analyzed: int = Field(ge=0)
    exact_reviews_available: int = Field(ge=0)
    unknown_variant_reviews_excluded: int = Field(ge=0)
    sibling_variant_reviews_excluded: int = Field(ge=0)
    rejected_mentions: int = Field(ge=0)


class ComparisonItem(_EvidenceModel):
    """Provider-owned identity and price for one exact compared variant."""

    listing_id: str
    variant_id: str
    item_key: str
    title: str
    variant_label: str
    price_minor: int = Field(ge=0)
    shop_voucher_minor: int = Field(ge=0)
    shipping_minor: int = Field(ge=0)
    landed_price_minor: int = Field(ge=0)
    currency: Literal["SGD"]
    snapshot_version: str
    synthetic: bool


class AnalyzedComparisonItem(ComparisonItem):
    """An exact comparison item plus the evidence pipeline's completed status."""

    analysis_status: Literal["completed", "unresolved"]
    analysis_error: str | None = Field(default=None, exclude_if=lambda value: value is None)
    review_status: Literal["completed", "unresolved"]
    review_coverage: ReviewCoverage


class SchemaField(_EvidenceModel):
    """One fixed normalized comparison dimension."""

    field_key: FieldKey
    label: str
    unit: str | None


class Evidence(_EvidenceModel):
    id: str
    item_key: str
    source_type: SourceType
    source_text: str
    source_location: str | None = None
    variant_id: str | None = None
    review_id: str | None = None


class Fact(_EvidenceModel):
    field_key: str
    status: Status
    value: str | int | float | bool | None = None
    unit: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    conflicting_values: list[str] = Field(default_factory=list)
    # Review mentions that contradict a consistent seller claim. The claim stays supported
    # with its value; ranking reads only status and value, so a dispute never reorders.
    disputing_mention_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_status(self) -> Self:
        if self.status == "supported" and (self.value is None or not self.evidence_ids):
            raise ValueError("Supported facts need a value and source evidence")
        if self.status != "supported" and self.value is not None:
            raise ValueError("Only supported facts may assert a value")
        if self.status == "conflicting" and (
            len(set(self.conflicting_values)) < 2 or len(set(self.evidence_ids)) < 2
        ):
            raise ValueError("Conflicts must preserve two values and sources")
        if self.disputing_mention_ids and self.status != "supported":
            raise ValueError("Only supported facts can be disputed")
        return self


class ReviewMention(_EvidenceModel):
    id: str
    review_id: str
    item_key: str
    aspect: Aspect
    sentiment: Sentiment
    excerpt: str


class ReviewAspectSummary(_EvidenceModel):
    item_key: str
    aspect: str
    positive_count: int
    negative_count: int
    neutral_count: int
    analyzed_reviews: int
    mention_ids: list[str]


class ComparisonEvidence(_EvidenceModel):
    items: list[ComparisonItem | AnalyzedComparisonItem]
    schema_fields: list[SchemaField]
    facts_by_item: dict[str, list[Fact]]
    evidence: dict[str, Evidence]
    review_summaries: list[ReviewAspectSummary]
    review_mentions: dict[str, ReviewMention]

    @model_validator(mode="after")
    def check_relationships(self) -> Self:
        items = {item.item_key: item for item in self.items}
        if len(items) != len(self.items) or set(items) != set(self.facts_by_item):
            raise ValueError("Items must be unique and match fact groups")
        fields = {field.field_key for field in self.schema_fields}
        for key, item in items.items():
            if key != f"{item.listing_id}:{item.variant_id}":
                raise ValueError("Invalid exact-SKU identity")
            if item.landed_price_minor != (
                item.price_minor - item.shop_voucher_minor + item.shipping_minor
            ):
                raise ValueError("Landed price must equal price minus shop voucher plus shipping")
            facts = self.facts_by_item[key]
            if len(facts) != len(fields) or {f.field_key for f in facts} != fields:
                raise ValueError("Every item must contain every schema field exactly once")
            for fact in facts:
                for source_id in fact.evidence_ids:
                    source = self.evidence.get(source_id)
                    if source is None or source.item_key != key:
                        raise ValueError("Unknown or wrong-item evidence reference")
                    if fact.status in ("supported", "conflicting") and (
                        source.variant_id != item.variant_id
                        or source.source_type in ("review", "external", "image")
                    ):
                        raise ValueError("Fact source must apply to the exact selected variant")
                for mention_id in fact.disputing_mention_ids:
                    mention = self.review_mentions.get(mention_id)
                    if mention is None or mention.item_key != key:
                        raise ValueError("Unknown or wrong-item disputing mention")
        for key, source in self.evidence.items():
            if source.id != key or source.item_key not in items:
                raise ValueError("Invalid evidence index")
        for key, mention in self.review_mentions.items():
            sources = [
                s
                for s in self.evidence.values()
                if s.review_id == mention.review_id and s.item_key == mention.item_key
            ]
            if (
                key != mention.id
                or not mention.excerpt
                or not any(
                    s.source_type == "review"
                    and s.variant_id == items[mention.item_key].variant_id
                    and mention.excerpt in s.source_text
                    for s in sources
                )
            ):
                raise ValueError("Review mentions require exact-SKU literal source excerpts")
        for summary in self.review_summaries:
            if (
                summary.item_key not in items
                or min(
                    summary.positive_count,
                    summary.negative_count,
                    summary.neutral_count,
                    summary.analyzed_reviews,
                )
                < 0
            ):
                raise ValueError("Invalid review summary")
            mentions = [self.review_mentions.get(mid) for mid in summary.mention_ids]
            if len(set(summary.mention_ids)) != len(mentions) or any(
                m is None or m.item_key != summary.item_key or m.aspect != summary.aspect
                for m in mentions
            ):
                raise ValueError("Invalid summary mention reference")
            for sentiment in ("positive", "negative", "neutral"):
                count = len(
                    {m.review_id for m in mentions if m is not None and m.sentiment == sentiment}
                )
                if (
                    count != getattr(summary, sentiment + "_count")
                    or count > summary.analyzed_reviews
                ):
                    raise ValueError("Summary counts must count unique reviews")
        return self
