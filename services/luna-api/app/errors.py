"""Own the Luna HTTP error envelope and its single typed exception boundary."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.decision.comparisons import ComparisonNotFound
from app.decision.sessions import (
    DemoSessionExpired,
    DemoSessionNotFound,
    DemoSessionRequired,
)
from app.decision.tools import RevisionConflict
from app.openai.text_agent import (
    ConversationComparisonMismatch,
    LunaAgentConfigurationError,
    LunaAgentContractError,
    LunaAgentTimeout,
    LunaAgentUnavailable,
    LunaToolCallRejected,
    LunaToolLimitReached,
)
from app.providers import CatalogError

CATALOG_ERROR_RESPONSES: dict[str, tuple[int, str, bool]] = {
    "duplicate_selection": (
        status.HTTP_400_BAD_REQUEST,
        "The same exact variant cannot be selected twice.",
        False,
    ),
    "invalid_bucket": (
        status.HTTP_400_BAD_REQUEST,
        "Select between two and four exact variants.",
        False,
    ),
    "provider_unavailable": (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Catalog evidence is temporarily unavailable.",
        True,
    ),
    "snapshot_changed": (
        status.HTTP_409_CONFLICT,
        "Catalog evidence changed while the comparison was built.",
        True,
    ),
    "unknown_listing": (
        status.HTTP_400_BAD_REQUEST,
        "The selected listing does not exist.",
        False,
    ),
    "unknown_variant": (
        status.HTTP_400_BAD_REQUEST,
        "The selected variant does not exist.",
        False,
    ),
    "unsupported_provider": (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "The configured catalog provider is unavailable.",
        False,
    ),
}


class ErrorDetail(BaseModel):
    """Stable machine code and safe buyer-facing description for one API failure."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str
    message: str
    retryable: bool
    current_revision: int | None = None


class ErrorResponse(BaseModel):
    """The error envelope returned by every handled HTTP boundary failure."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    error: ErrorDetail


def _error_response(
    *,
    http_status: int,
    code: str,
    message: str,
    retryable: bool,
    current_revision: int | None = None,
) -> JSONResponse:
    error = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            retryable=retryable,
            current_revision=current_revision,
        )
    )
    return JSONResponse(
        status_code=http_status,
        content=error.model_dump(mode="json", exclude_none=True),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register one HTTP decision point for typed session, comparison, and provider failures."""

    @app.exception_handler(DemoSessionRequired)
    async def handle_session_required(
        request: Request, failure: DemoSessionRequired
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_401_UNAUTHORIZED,
            code="SESSION_REQUIRED",
            message="A valid demo session bearer token is required.",
            retryable=False,
        )

    @app.exception_handler(DemoSessionNotFound)
    async def handle_session_not_found(
        request: Request, failure: DemoSessionNotFound
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_401_UNAUTHORIZED,
            code="SESSION_REQUIRED",
            message="A valid demo session bearer token is required.",
            retryable=False,
        )

    @app.exception_handler(DemoSessionExpired)
    async def handle_session_expired(request: Request, failure: DemoSessionExpired) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_401_UNAUTHORIZED,
            code="SESSION_EXPIRED",
            message="The demo session expired; create a new session.",
            retryable=False,
        )

    @app.exception_handler(ComparisonNotFound)
    async def handle_comparison_not_found(
        request: Request, failure: ComparisonNotFound
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_404_NOT_FOUND,
            code="COMPARISON_NOT_FOUND",
            message="The comparison was not found in this demo session.",
            retryable=False,
        )

    @app.exception_handler(RevisionConflict)
    async def handle_revision_conflict(request: Request, failure: RevisionConflict) -> JSONResponse:
        del request
        return _error_response(
            http_status=status.HTTP_409_CONFLICT,
            code="STALE_COMPARISON",
            message="The comparison changed; refresh before applying the newer intent.",
            retryable=False,
            current_revision=failure.current_revision,
        )

    @app.exception_handler(CatalogError)
    async def handle_catalog_error(request: Request, failure: CatalogError) -> JSONResponse:
        del request
        if failure.code not in CATALOG_ERROR_RESPONSES:
            raise RuntimeError(
                f"CatalogError code {failure.code!r} has no mapping in app.errors"
            ) from failure
        http_status, message, retryable = CATALOG_ERROR_RESPONSES[failure.code]
        return _error_response(
            http_status=http_status,
            code=failure.code.upper(),
            message=message,
            retryable=retryable,
        )

    @app.exception_handler(ConversationComparisonMismatch)
    async def handle_conversation_comparison_mismatch(
        request: Request, failure: ConversationComparisonMismatch
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_409_CONFLICT,
            code="CONVERSATION_COMPARISON_MISMATCH",
            message="Start a new conversation for this comparison.",
            retryable=False,
        )

    @app.exception_handler(LunaAgentConfigurationError)
    async def handle_luna_configuration(
        request: Request, failure: LunaAgentConfigurationError
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="LUNA_NOT_CONFIGURED",
            message="Luna text chat is not configured on this server.",
            retryable=False,
        )

    @app.exception_handler(LunaAgentTimeout)
    async def handle_luna_timeout(request: Request, failure: LunaAgentTimeout) -> JSONResponse:
        del request
        if failure.action_completed:
            return _error_response(
                http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="LUNA_TIMEOUT_AFTER_UPDATE",
                message=(
                    "Preferences were applied, but Luna's reply timed out. Refresh the comparison."
                ),
                retryable=False,
                current_revision=failure.current_revision,
            )
        return _error_response(
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="LUNA_TIMEOUT",
            message="Luna timed out; the comparison was not changed.",
            retryable=True,
        )

    @app.exception_handler(LunaAgentUnavailable)
    async def handle_luna_unavailable(
        request: Request, failure: LunaAgentUnavailable
    ) -> JSONResponse:
        del request
        if failure.action_completed:
            return _error_response(
                http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="LUNA_UNAVAILABLE_AFTER_UPDATE",
                message=(
                    "Preferences were applied, but Luna's reply failed. Refresh the comparison."
                ),
                retryable=False,
                current_revision=failure.current_revision,
            )
        return _error_response(
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="LUNA_UNAVAILABLE",
            message="Luna is temporarily unavailable; the comparison was not changed.",
            retryable=True,
        )

    @app.exception_handler(LunaToolLimitReached)
    async def handle_luna_tool_limit(
        request: Request, failure: LunaToolLimitReached
    ) -> JSONResponse:
        del request
        return _error_response(
            http_status=status.HTTP_502_BAD_GATEWAY,
            code="LUNA_TOOL_LIMIT",
            message="Luna could not finish within the three-round tool limit.",
            retryable=False,
            current_revision=(failure.current_revision if failure.action_completed else None),
        )

    @app.exception_handler(LunaToolCallRejected)
    @app.exception_handler(LunaAgentContractError)
    async def handle_luna_invalid_response(
        request: Request,
        failure: LunaToolCallRejected | LunaAgentContractError,
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_502_BAD_GATEWAY,
            code="LUNA_INVALID_RESPONSE",
            message=(
                "Luna returned an invalid tool request or answer. "
                "Refresh the comparison before retrying."
            ),
            retryable=False,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        request: Request, failure: RequestValidationError
    ) -> JSONResponse:
        del request, failure
        return _error_response(
            http_status=status.HTTP_422_UNPROCESSABLE_CONTENT,
            code="INVALID_REQUEST",
            message="Request validation failed.",
            retryable=False,
        )
