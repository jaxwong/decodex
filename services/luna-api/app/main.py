from fastapi import FastAPI

from app.decision.comparisons import BuildComparisonEvidence
from app.decision.sessions import DemoSessionStore
from app.errors import register_exception_handlers
from app.evidence import EvidenceBuilder, OpenAIModelClient
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
) -> FastAPI:
    """Compose the Luna API with one owner for sessions, provider, and evidence building."""
    app = FastAPI(title="Luna API", version="0.1.0")
    app.state.demo_sessions = session_store if session_store is not None else {}
    provider = catalog_provider if catalog_provider is not None else provider_factory()
    app.state.catalog_provider = provider
    app.state.build_comparison_evidence = (
        build_evidence
        if build_evidence is not None
        else EvidenceBuilder(provider, OpenAIModelClient()).build
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(demo_sessions_router)
    app.include_router(catalog_router)
    app.include_router(comparisons_router)
    return app


app = create_app()
