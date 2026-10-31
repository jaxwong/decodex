from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DemoSession(BaseModel):
    """An opaque, server-issued demo session with a fixed expiry."""

    model_config = ConfigDict(frozen=True)

    token: str
    expires_at: datetime
