"""Frozen v3.2 evidence wire contract. Session state belongs to the API owner."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Status = Literal['supported', 'missing', 'conflicting', 'unresolved']
SourceType = Literal['title', 'description', 'attribute', 'variant', 'review', 'image', 'external']


class _EvidenceModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')


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

    @model_validator(mode='after')
    def check_status(self):
        if self.status == 'supported' and (self.value is None or not self.evidence_ids):
            raise ValueError('Supported facts need a value and source evidence')
        if self.status != 'supported' and self.value is not None:
            raise ValueError('Only supported facts may assert a value')
        if self.status == 'conflicting' and (
            len(set(self.conflicting_values)) < 2 or len(set(self.evidence_ids)) < 2
        ):
            raise ValueError('Conflicts must preserve two values and sources')
        return self


class ReviewMention(_EvidenceModel):
    id: str
    review_id: str
    item_key: str
    aspect: Literal['heat', 'portability', 'charging', 'reliability', 'value', 'other']
    sentiment: Literal['positive', 'negative', 'neutral']
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
    items: list[dict]
    schema_fields: list[dict]
    facts_by_item: dict[str, list[Fact]]
    evidence: dict[str, Evidence]
    review_summaries: list[ReviewAspectSummary]
    review_mentions: dict[str, ReviewMention]

    @model_validator(mode='after')
    def check_relationships(self):
        items = {item['item_key']: item for item in self.items}
        if len(items) != len(self.items) or set(items) != set(self.facts_by_item):
            raise ValueError('Items must be unique and match fact groups')
        fields = {field['field_key'] for field in self.schema_fields}
        for key, item in items.items():
            if key != f"{item['listing_id']}:{item['variant_id']}":
                raise ValueError('Invalid exact-SKU identity')
            if type(item['price_minor']) is not int or item['price_minor'] < 0 or item['currency'] != 'SGD':
                raise ValueError('Prices require nonnegative integer SGD minor units')
            facts = self.facts_by_item[key]
            if len(facts) != len(fields) or {f.field_key for f in facts} != fields:
                raise ValueError('Every item must contain every schema field exactly once')
            for fact in facts:
                for source_id in fact.evidence_ids:
                    source = self.evidence.get(source_id)
                    if source is None or source.item_key != key:
                        raise ValueError('Unknown or wrong-item evidence reference')
                    if fact.status in ('supported', 'conflicting') and (
                        source.variant_id != item['variant_id'] or source.source_type in ('review', 'external', 'image')
                    ):
                        raise ValueError('Fact source must apply to the exact selected variant')
        for key, source in self.evidence.items():
            if source.id != key or source.item_key not in items:
                raise ValueError('Invalid evidence index')
        for key, mention in self.review_mentions.items():
            sources = [s for s in self.evidence.values() if s.review_id == mention.review_id and s.item_key == mention.item_key]
            if key != mention.id or not mention.excerpt or not any(
                s.source_type == 'review' and s.variant_id == items[mention.item_key]['variant_id']
                and mention.excerpt in s.source_text for s in sources
            ):
                raise ValueError('Review mentions require exact-SKU literal source excerpts')
        for summary in self.review_summaries:
            if summary.item_key not in items or min(summary.positive_count, summary.negative_count, summary.neutral_count, summary.analyzed_reviews) < 0:
                raise ValueError('Invalid review summary')
            mentions = [self.review_mentions.get(mid) for mid in summary.mention_ids]
            if len(set(summary.mention_ids)) != len(mentions) or any(
                m is None or m.item_key != summary.item_key or m.aspect != summary.aspect for m in mentions
            ):
                raise ValueError('Invalid summary mention reference')
            for sentiment in ('positive', 'negative', 'neutral'):
                count = len({m.review_id for m in mentions if m.sentiment == sentiment})
                if count != getattr(summary, sentiment + '_count') or count > summary.analyzed_reviews:
                    raise ValueError('Summary counts must count unique reviews')
        return self
