from fastapi import FastAPI

from app.decision.sessions import DemoSessionStore
from app.routes.demo_sessions import router as demo_sessions_router
from app.routes.health import router as health_router


def create_app(*, session_store: DemoSessionStore | None = None) -> FastAPI:
    """Create the Luna API with one application-owned demo session store."""
    app = FastAPI(title="Luna API", version="0.1.0")
    app.state.demo_sessions = session_store if session_store is not None else {}
    app.include_router(health_router)
    app.include_router(demo_sessions_router)
    return app


app = create_app()
