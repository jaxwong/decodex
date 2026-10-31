"""Plain process-owned OpenAI transport and model configuration."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from openai import AsyncOpenAI
from openai.types.responses import Response

OPENAI_REQUEST_TIMEOUT_SECONDS = 30.0

type CreateModelResponse = Callable[..., Awaitable[Response]]


@dataclass(frozen=True, slots=True)
class OpenAIRuntime:
    """The one shared SDK client and resolved model names for an API process."""

    client: AsyncOpenAI | None
    create_response: CreateModelResponse | None
    text_model: str | None
    live_model: str | None
    owns_client: bool
