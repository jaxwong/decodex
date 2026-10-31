import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from openai import AsyncOpenAI

from app.decision.comparisons import BuildComparisonEvidence
from app.decision.sessions import DemoSessionStore
from app.errors import register_exception_handlers
from app.evidence import EvidenceBuilder, OpenAIModelClient
from app.openai.runtime import (
    OPENAI_REQUEST_TIMEOUT_SECONDS,
    CreateModelResponse,
    OpenAIRuntime,
)
from app.providers import CatalogProvider, provider_factory
from app.routes.catalog import router as catalog_router
from app.routes.comparisons import router as comparisons_router
from app.routes.demo_sessions import router as demo_sessions_router
from app.routes.health import router as health_router


def create_app(
    *,
    session_store: DemoSessionStore | None = None,
    catalog_provider: CatalogProvider | None = None,
    build_evidence: BuildComparisonEvidence | None = None,
    create_model_response: CreateModelResponse | None = None,
    text_model: str | None = None,
    live_model: str | None = None,
    openai_client: AsyncOpenAI | None = None,
) -> FastAPI:
    """Compose sessions, marketplace data, evidence building, and model transport once."""
    if create_model_response is not None and text_model is None:
        raise ValueError("create_model_response requires an explicit text_model")
    if create_model_response is not None and openai_client is not None:
        raise ValueError("configure create_model_response or openai_client, not both")

    def resolved_model(injected: str | None, environment_name: str) -> str | None:
        if injected is not None:
            if not injected.strip():
                raise ValueError(f"{environment_name} must not be blank")
            return injected
        environment_value = os.environ.get(environment_name)
        return (
            environment_value
            if environment_value is not None and environment_value.strip()
            else None
        )

    resolved_text_model = resolved_model(text_model, "OPENAI_TEXT_MODEL")
    resolved_live_model = resolved_model(live_model, "OPENAI_LIVE_MODEL")
    runtime_client = openai_client
    owns_client = False
    if runtime_client is None and create_model_response is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key is not None and api_key.strip():
            runtime_client = AsyncOpenAI(
                api_key=api_key,
                max_retries=0,
                timeout=OPENAI_REQUEST_TIMEOUT_SECONDS,
            )
            owns_client = True
    runtime = OpenAIRuntime(
        client=runtime_client,
        create_response=(
            create_model_response
            if create_model_response is not None
            else runtime_client.responses.create
            if runtime_client is not None
            else None
        ),
        text_model=resolved_text_model,
        live_model=resolved_live_model,
        owns_client=owns_client,
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        del application
        try:
            yield
        finally:
            if runtime.owns_client and runtime.client is not None:
                await runtime.client.close()

    app = FastAPI(title="Luna API", version="0.1.0", lifespan=lifespan)
    app.state.demo_sessions = session_store if session_store is not None else {}
    provider = catalog_provider if catalog_provider is not None else provider_factory()
    app.state.catalog_provider = provider
    app.state.build_comparison_evidence = (
        build_evidence
        if build_evidence is not None
        else EvidenceBuilder(
            provider,
            OpenAIModelClient(
                runtime.client,
                model=runtime.text_model,
                timeout_seconds=OPENAI_REQUEST_TIMEOUT_SECONDS,
            ),
        ).build
    )
    app.state.openai_runtime = runtime
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(demo_sessions_router)
    app.include_router(catalog_router)
    app.include_router(comparisons_router)
    return app


app = create_app()
