"""One Responses Structured Outputs request per item or bounded review batch."""

import asyncio
import json
import os
from typing import Any, Protocol, TypeVar

from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict

from app.contracts.evidence import Aspect, FieldKey, Sentiment, Status

from .prompt import REVIEW_PROMPT, SPEC_PROMPT


class CandidateModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Claim(CandidateModel):
    raw_value: str
    quote: str
    evidence_id: str
    variant_id: str | None


class CandidateFact(CandidateModel):
    field_key: FieldKey
    status: Status
    claims: list[Claim]


class SpecCandidates(CandidateModel):
    facts: list[CandidateFact]


class CandidateMention(CandidateModel):
    review_id: str
    aspect: Aspect
    sentiment: Sentiment
    excerpt: str


class ReviewCandidates(CandidateModel):
    mentions: list[CandidateMention]


class ModelClient(Protocol):
    async def extract_specs(self, request: dict[str, Any]) -> SpecCandidates: ...
    async def extract_reviews(self, request: dict[str, Any]) -> ReviewCandidates: ...


class ExtractionError(RuntimeError):
    """The model did not return usable validated extraction output."""


ParsedModel = TypeVar("ParsedModel", bound=BaseModel)


class OpenAIModelClient:
    """Lazy server-only SDK client. No retries, tools or hidden offline fallback.

    Inject an AsyncOpenAI-compatible SDK client for transport tests. Credentials are
    read by the SDK only when an actual request is made.
    """

    def __init__(
        self,
        client: AsyncOpenAI | None = None,
        *,
        model: str | None = None,
        timeout_seconds: float = 30,
    ) -> None:
        self._client = client
        self.model = model or os.environ.get("OPENAI_TEXT_MODEL", "gpt-6-luna")
        self.timeout_seconds = timeout_seconds
        self.observations: list[dict[str, Any]] = []

    async def _parse(
        self, prompt: str, request: dict[str, Any], response_type: type[ParsedModel]
    ) -> ParsedModel:
        try:
            if self._client is None:
                self._client = AsyncOpenAI(max_retries=0, timeout=self.timeout_seconds)
            response = await asyncio.wait_for(
                self._client.responses.parse(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(request)},
                    ],
                    text_format=response_type,
                    store=False,
                ),
                timeout=self.timeout_seconds,
            )
            parsed = response.output_parsed
            if parsed is None or getattr(response, "status", "completed") != "completed":
                raise ExtractionError("Refused, incomplete or missing parsed output")
            usage = getattr(response, "usage", None)
            self.observations.append(
                {
                    "response_id": getattr(response, "id", None),
                    "response_model": getattr(response, "model", None),
                    "usage": usage.model_dump() if usage is not None else None,
                }
            )
            return response_type.model_validate(parsed)
        except (OpenAIError, TimeoutError, ValueError) as failure:
            raise ExtractionError(type(failure).__name__) from failure

    async def extract_specs(self, request: dict[str, Any]) -> SpecCandidates:
        return await self._parse(SPEC_PROMPT, request, SpecCandidates)

    async def extract_reviews(self, request: dict[str, Any]) -> ReviewCandidates:
        return await self._parse(REVIEW_PROMPT, request, ReviewCandidates)
