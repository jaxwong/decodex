"""Plain process-owned OpenAI transport and model configuration."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from openai import AsyncOpenAI
from openai.types.responses import Response
from openai.types.shared import ReasoningEffort

OPENAI_REQUEST_TIMEOUT_SECONDS = 30.0
# Evidence extraction is copy-and-cite work over supplied text; see D-22 for the measurements.
EVIDENCE_REASONING_EFFORT: ReasoningEffort = "low"

type CreateModelResponse = Callable[..., Awaitable[Response]]


@dataclass(frozen=True, slots=True)
class OpenAIRuntime:
    """The one shared SDK client and resolved model names for an API process."""

    client: AsyncOpenAI | None
    create_response: CreateModelResponse | None
    text_model: str | None
    live_model: str | None
    owns_client: bool
