"""Own the Luna error contract and its single HTTP exception boundary."""

from enum import StrEnum
from http import HTTPStatus
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict


class ErrorCode(StrEnum):
    """Every machine-readable failure code exposed through API contracts."""

    SESSION_REQUIRED = "SESSION_REQUIRED"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    COMPARISON_NOT_FOUND = "COMPARISON_NOT_FOUND"
    STALE_COMPARISON = "STALE_COMPARISON"
    DUPLICATE_SELECTION = "DUPLICATE_SELECTION"
    INVALID_BUCKET = "INVALID_BUCKET"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    SNAPSHOT_CHANGED = "SNAPSHOT_CHANGED"
    UNKNOWN_LISTING = "UNKNOWN_LISTING"
    UNKNOWN_VARIANT = "UNKNOWN_VARIANT"
    UNSUPPORTED_PROVIDER = "UNSUPPORTED_PROVIDER"
    REPEATED_REVIEW_CURSOR = "REPEATED_REVIEW_CURSOR"
    INVALID_LIMIT = "INVALID_LIMIT"
    INVALID_CURSOR = "INVALID_CURSOR"
    CONVERSATION_COMPARISON_MISMATCH = "CONVERSATION_COMPARISON_MISMATCH"
    LUNA_NOT_CONFIGURED = "LUNA_NOT_CONFIGURED"
    LIVE_UNAVAILABLE = "LIVE_UNAVAILABLE"
    LIVE_INVALID_RESPONSE = "LIVE_INVALID_RESPONSE"
    LUNA_TIMEOUT_AFTER_UPDATE = "LUNA_TIMEOUT_AFTER_UPDATE"
    LUNA_TIMEOUT = "LUNA_TIMEOUT"
    LUNA_UNAVAILABLE_AFTER_UPDATE = "LUNA_UNAVAILABLE_AFTER_UPDATE"
    LUNA_UNAVAILABLE = "LUNA_UNAVAILABLE"
    LUNA_TOOL_LIMIT = "LUNA_TOOL_LIMIT"
    LUNA_INVALID_RESPONSE = "LUNA_INVALID_RESPONSE"
    INVALID_REQUEST = "INVALID_REQUEST"
    TOOL_ROUND_LIMIT = "TOOL_ROUND_LIMIT"
    INVALID_TOOL_ARGUMENTS = "INVALID_TOOL_ARGUMENTS"


class ErrorDetail(BaseModel):
    """Stable machine code and safe buyer-facing description for one failure."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    code: ErrorCode
    message: str
    retryable: bool
    current_revision: int | None = None


class ErrorResponse(BaseModel):
    """The error envelope returned by every handled HTTP boundary failure."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    error: ErrorDetail


class ToolErrorResponse(ErrorResponse):
    """The same error envelope marked as an unsuccessful Live tool result."""

    ok: Literal[False] = False


class ApiFailure(Exception):
    """A typed expected failure that owns its public HTTP representation."""

    code: ErrorCode
    http_status: HTTPStatus
    public_message: str
    retryable: bool

    def __init__(
        self,
        internal_message: str | None = None,
        *,
        current_revision: int | None = None,
    ) -> None:
        self.current_revision = current_revision
        super().__init__(internal_message or self.public_message)

    def detail(self) -> ErrorDetail:
        return ErrorDetail(
            code=self.code,
            message=self.public_message,
            retryable=self.retryable,
            current_revision=self.current_revision,
        )


class InvalidRequest(ApiFailure):
    code = ErrorCode.INVALID_REQUEST
    http_status = HTTPStatus.UNPROCESSABLE_ENTITY
    public_message = "Request validation failed."
    retryable = False


def register_exception_handlers(app: FastAPI) -> None:
    """Register one HTTP decision point for typed application and request failures."""

    @app.exception_handler(RequestValidationError)
    @app.exception_handler(ApiFailure)
    async def handle_api_failure(
        request: Request,
        failure: ApiFailure | RequestValidationError,
    ) -> JSONResponse:
        del request
        api_failure = (
            InvalidRequest("FastAPI rejected an invalid request")
            if isinstance(failure, RequestValidationError)
            else failure
        )
        return JSONResponse(
            status_code=api_failure.http_status,
            content=ErrorResponse(error=api_failure.detail()).model_dump(
                mode="json",
                exclude_none=True,
            ),
        )
