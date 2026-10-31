from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.contracts.evidence import (
    ComparisonEvidence,
    Evidence,
    Fact,
    ReviewAspectSummary,
    ReviewMention,
)

type RankingPriority = Literal["weight_g", "price_minor", "max_output_w", "review_reliability"]


class _SessionModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class DemoSession(_SessionModel):
    """An opaque, server-issued demo session with a fixed expiry."""

    token: str
    expires_at: datetime


class ComparisonSelection(_SessionModel):
    """One exact listing variant selected by its provider-owned identity."""

    listing_id: str = Field(min_length=1)
    variant_id: str = Field(min_length=1)


class CreateComparisonRequest(_SessionModel):
    """A bounded set of unique exact variants to compare."""

    items: list[ComparisonSelection] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def require_unique_exact_variants(self) -> "CreateComparisonRequest":
        item_keys = [(item.listing_id, item.variant_id) for item in self.items]
        if len(item_keys) != len(set(item_keys)):
            raise ValueError("items must not contain duplicate exact variants")
        return self


class Preferences(_SessionModel):
    """Explicit buyer constraints and ordered deterministic ranking priorities."""

    max_price_minor: int | None = Field(default=None, ge=0)
    min_output_w: int | None = Field(default=None, ge=0)
    priorities: list[RankingPriority] = Field(default_factory=list, max_length=4)

    @field_validator("priorities")
    @classmethod
    def require_unique_priorities(cls, priorities: list[RankingPriority]) -> list[RankingPriority]:
        if len(priorities) != len(set(priorities)):
            raise ValueError("priorities must not contain duplicates")
        return priorities


class PreferencePatch(_SessionModel):
    """Fields explicitly supplied by the buyer for one revision-safe update."""

    max_price_minor: int | None = Field(default=None, ge=0)
    min_output_w: int | None = Field(default=None, ge=0)
    priorities: list[RankingPriority] | None = Field(default=None, max_length=4)

    @field_validator("priorities")
    @classmethod
    def require_unique_priorities(
        cls, priorities: list[RankingPriority] | None
    ) -> list[RankingPriority] | None:
        if priorities is not None and len(priorities) != len(set(priorities)):
            raise ValueError("priorities must not contain duplicates")
        return priorities

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "PreferencePatch":
        if not self.model_fields_set:
            raise ValueError("preference patch must contain at least one field")
        if "priorities" in self.model_fields_set and self.priorities is None:
            raise ValueError("priorities must be a list; use an empty list to clear them")
        return self


class Recommendation(_SessionModel):
    """Explainable ranking output without an invented winner for uncertain input."""

    item_key: str | None
    ranked_item_keys: list[str]
    excluded_item_keys: list[str]
    uncertain_item_keys: list[str]
    limitations: list[str]


class UiPatch(_SessionModel):
    """A revision-guarded presentation update computed from saved server state."""

    base_revision: int = Field(ge=0)
    new_revision: int = Field(ge=1)
    focused_fields: list[str]
    excluded_item_keys: list[str]
    highlight_item_key: str | None
    active_tab: Literal["specs", "reviews"]


class ComparisonResponse(_SessionModel):
    """The canonical session-owned comparison state returned to the frontend."""

    comparison_id: str
    revision: int = Field(ge=0)
    preferences: Preferences
    recommendation: Recommendation
    ui_patch: UiPatch | None = None
    evidence: ComparisonEvidence


class ComparisonSnapshotItem(_SessionModel):
    """Compact normalized item data available to the decision tools."""

    item_key: str
    title: str
    variant_label: str
    price_minor: int = Field(ge=0)
    currency: str
    facts: list[Fact]


class ComparisonSnapshot(_SessionModel):
    """Compact decision-tool view without raw seller or review source text."""

    comparison_id: str
    revision: int
    preferences: Preferences
    recommendation: Recommendation
    items: list[ComparisonSnapshotItem]


class ReviewAspectResult(_SessionModel):
    """Bounded review aggregates and literal supporting mentions for one aspect."""

    aspect: str
    summaries: list[ReviewAspectSummary]
    mentions: list[ReviewMention]


class EvidenceInspection(_SessionModel):
    """Exact stored evidence requested by already-known citation IDs."""

    evidence: list[Evidence]


class PreferenceUpdate(_SessionModel):
    """The saved preference state and revision patch returned by its only mutating tool."""

    preferences: Preferences
    recommendation: Recommendation
    ui_patch: UiPatch


class AskComparisonRequest(_SessionModel):
    """One bounded buyer turn against an expected comparison revision."""

    conversation_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    message: str = Field(min_length=1, max_length=2000)
    expected_revision: int = Field(ge=0)

    @field_validator("message")
    @classmethod
    def require_nonblank_message(cls, message: str) -> str:
        if not message.strip():
            raise ValueError("message must contain non-whitespace text")
        return message


class AskComparisonResponse(_SessionModel):
    """Validated Luna answer plus only server-computed decision and UI state."""

    conversation_id: str
    request_id: str
    answer: str
    cited_ids: list[str]
    recommendation: Recommendation
    ui_patch: UiPatch | None


class LiveSessionRequest(_SessionModel):
    """One bounded WebRTC offer containing the required audio and event channels."""

    sdp: str = Field(min_length=1, max_length=131_072)

    @field_validator("sdp")
    @classmethod
    def require_audio_and_data_media(cls, sdp: str) -> str:
        media_lines = [line.strip() for line in sdp.splitlines() if line.startswith("m=")]
        if not any(line.startswith("m=audio ") for line in media_lines):
            raise ValueError("sdp must contain an audio media section")
        if not any(
            line.startswith("m=application ") and "webrtc-datachannel" in line
            for line in media_lines
        ):
            raise ValueError("sdp must contain a WebRTC data channel")
        return sdp


class LiveSessionReference(_SessionModel):
    """The unchanged provider session identity used by the browser transport."""

    id: str


class LiveSessionTransport(_SessionModel):
    """The unchanged provider WebRTC answer applied by the browser peer connection."""

    type: Literal["webrtc"]
    sdp: str


class LiveSessionResponse(_SessionModel):
    """The public subset of a created GPT-Live WebRTC session."""

    session: LiveSessionReference
    transport: LiveSessionTransport
