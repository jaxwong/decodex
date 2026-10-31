"""One Responses Structured Outputs request per item or bounded review batch."""

import asyncio
import json
from typing import Any, Protocol, TypeVar

from openai import AsyncOpenAI, OpenAIError
from openai.types.shared import ReasoningEffort
from pydantic import BaseModel, ConfigDict

from app.contracts.evidence import Aspect, FieldKey, Sentiment, Status
from app.openai.runtime import OPENAI_REQUEST_TIMEOUT_SECONDS

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
    disputes_field_key: FieldKey | None


class ReviewCandidates(CandidateModel):
    mentions: list[CandidateMention]


class ModelClient(Protocol):
    async def extract_specs(self, request: dict[str, Any]) -> SpecCandidates: ...
    async def extract_reviews(self, request: dict[str, Any]) -> ReviewCandidates: ...


class ExtractionError(RuntimeError):
    """The model did not return usable validated extraction output."""


ParsedModel = TypeVar("ParsedModel", bound=BaseModel)


class OpenAIModelClient:
    """Evidence adapter for one process-owned SDK client and explicit model.

    Missing transport or model configuration is an explicit extraction failure. The
    caller owns client lifetime; this adapter never creates a connection pool.
    """

    def __init__(
        self,
        client: AsyncOpenAI | None = None,
        *,
        model: str | None = None,
        timeout_seconds: float = OPENAI_REQUEST_TIMEOUT_SECONDS,
        reasoning_effort: ReasoningEffort,
    ) -> None:
        if model is not None and not model.strip():
            raise ValueError("OpenAIModelClient model must not be blank")
        if timeout_seconds <= 0:
            raise ValueError("OpenAIModelClient timeout_seconds must be positive")
        self._client = client
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.reasoning_effort = reasoning_effort
        self.observations: list[dict[str, Any]] = []

    async def _parse(
        self, prompt: str, request: dict[str, Any], response_type: type[ParsedModel]
    ) -> ParsedModel:
        if self._client is None or self.model is None:
            raise ExtractionError("OpenAI evidence extraction is not configured")
        try:
            response = await asyncio.wait_for(
                self._client.responses.parse(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(request)},
                    ],
                    text_format=response_type,
                    reasoning={"effort": self.reasoning_effort},
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
