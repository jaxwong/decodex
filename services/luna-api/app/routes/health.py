from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/api", tags=["system"])


class HealthResponse(BaseModel):
    """A stable liveness response with no dependency checks."""

    model_config = ConfigDict(frozen=True)

    ok: Literal[True]


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Report that the API process is accepting requests."""
    return HealthResponse(ok=True)
