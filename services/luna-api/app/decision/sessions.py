import asyncio
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from http import HTTPStatus

from app.contracts.session import ComparisonResponse, DemoSession
from app.errors import ApiFailure, ErrorCode

DEMO_SESSION_LIFETIME = timedelta(hours=1)
MAX_DEMO_SESSIONS = 100
MAX_COMPARISONS_PER_SESSION = 10
MAX_CONVERSATIONS_PER_SESSION = 10


@dataclass(frozen=True, slots=True)
class ConversationTurn:
    """One successful buyer turn retained as bounded text-only model context."""

    user_message: str
    assistant_answer: str


@dataclass(slots=True)
class ConversationState:
    """A conversation permanently bound to one comparison in its demo session."""

    comparison_id: str
    turns: list[ConversationTurn] = field(default_factory=list)


@dataclass(slots=True)
class LiveSessionState:
    """One comparison-bound server sideband relay task."""

    comparison_id: str
    relay_task: asyncio.Task[None]


@dataclass(slots=True)
class DemoSessionState:
    """Private process-local state owned by one opaque demo session token."""

    expires_at: datetime
    comparisons: dict[str, ComparisonResponse] = field(default_factory=dict)
    conversations: dict[str, ConversationState] = field(default_factory=dict)
    live_sessions: dict[str, LiveSessionState] = field(default_factory=dict)
    pending_comparisons: int = 0
    pending_conversations: set[str] = field(default_factory=set)


type DemoSessionStore = dict[str, DemoSessionState]


class DemoSessionRequired(ApiFailure):
    """Raised when a protected API request has no bearer token."""

    code = ErrorCode.SESSION_REQUIRED
    http_status = HTTPStatus.UNAUTHORIZED
    public_message = "A valid demo session bearer token is required."
    retryable = False


class DemoSessionNotFound(ApiFailure):
    """Raised when a demo session token is not owned by this process."""

    code = ErrorCode.SESSION_REQUIRED
    http_status = HTTPStatus.UNAUTHORIZED
    public_message = "A valid demo session bearer token is required."
    retryable = False


class DemoSessionExpired(ApiFailure):
    """Raised when a known demo session has reached its server-owned expiry."""

    code = ErrorCode.SESSION_EXPIRED
    http_status = HTTPStatus.UNAUTHORIZED
    public_message = "The demo session expired; create a new session."
    retryable = False


class DemoSessionCapacityReached(ApiFailure):
    """Raised before allocating state beyond the process-owned session ceiling."""

    code = ErrorCode.SESSION_CAPACITY_REACHED
    http_status = HTTPStatus.SERVICE_UNAVAILABLE
    public_message = "The demo session service is at capacity; try again later."
    retryable = True


class ComparisonLimitReached(ApiFailure):
    """Raised before building evidence beyond one session's comparison ceiling."""

    code = ErrorCode.COMPARISON_LIMIT_REACHED
    http_status = HTTPStatus.CONFLICT
    public_message = "This demo session reached its comparison limit."
    retryable = False


class ConversationLimitReached(ApiFailure):
    """Raised before a model call beyond one session's conversation ceiling."""

    code = ErrorCode.CONVERSATION_LIMIT_REACHED
    http_status = HTTPStatus.CONFLICT
    public_message = "This demo session reached its conversation limit."
    retryable = False


class ConversationComparisonMismatch(ApiFailure):
    """Raised when a conversation ID is reused for another comparison."""

    code = ErrorCode.CONVERSATION_COMPARISON_MISMATCH
    http_status = HTTPStatus.CONFLICT
    public_message = "Start a new conversation for this comparison."
    retryable = False


class ConversationInProgress(ApiFailure):
    """Raised when concurrent turns try to create the same conversation."""

    code = ErrorCode.CONVERSATION_IN_PROGRESS
    http_status = HTTPStatus.CONFLICT
    public_message = "Another turn is already starting this conversation."
    retryable = True


def _require_aware(value: datetime, *, name: str) -> None:
    if value.tzinfo is None:
        raise ValueError(f"{name} must include timezone information")


def cancel_live_relays(
    session_state: DemoSessionState,
    *,
    comparison_id: str | None = None,
) -> list[asyncio.Task[None]]:
    """Remove and cancel retained relays, optionally for one comparison."""
    cancelled_tasks: list[asyncio.Task[None]] = []
    for session_id, live_session in list(session_state.live_sessions.items()):
        if comparison_id is not None and live_session.comparison_id != comparison_id:
            continue
        del session_state.live_sessions[session_id]
        if not live_session.relay_task.done():
            live_session.relay_task.cancel()
            cancelled_tasks.append(live_session.relay_task)
    return cancelled_tasks


def expire_demo_sessions(
    session_store: DemoSessionStore,
    *,
    checked_at: datetime,
) -> None:
    """Delete every expired session and cancel all work retained by it."""
    _require_aware(checked_at, name="checked_at")
    for token, session_state in list(session_store.items()):
        if checked_at < session_state.expires_at:
            continue
        cancel_live_relays(session_state)
        del session_store[token]


async def shutdown_demo_sessions(session_store: DemoSessionStore) -> None:
    """Cancel and join all active Live relay tasks during app shutdown."""
    relay_tasks: list[asyncio.Task[None]] = []
    for session_state in session_store.values():
        relay_tasks.extend(cancel_live_relays(session_state))
    for relay_task in relay_tasks:
        try:
            await relay_task
        except asyncio.CancelledError:
            continue


def reserve_comparison(session_state: DemoSessionState) -> None:
    """Reserve one comparison slot before evidence I/O begins."""
    if (
        len(session_state.comparisons) + session_state.pending_comparisons
        >= MAX_COMPARISONS_PER_SESSION
    ):
        raise ComparisonLimitReached("comparison capacity reached before evidence build")
    session_state.pending_comparisons += 1


def release_comparison_reservation(session_state: DemoSessionState) -> None:
    """Release a comparison slot after its evidence build terminates."""
    if session_state.pending_comparisons <= 0:
        raise RuntimeError("comparison reservation underflow in DemoSessionState")
    session_state.pending_comparisons -= 1


def reserve_conversation(
    session_state: DemoSessionState,
    *,
    conversation_id: str,
    comparison_id: str,
) -> bool:
    """Validate an existing conversation or reserve one new ID before model I/O."""
    conversation = session_state.conversations.get(conversation_id)
    if conversation is not None:
        if conversation.comparison_id != comparison_id:
            raise ConversationComparisonMismatch(
                "conversation is bound to another comparison in this demo session"
            )
        return False
    if conversation_id in session_state.pending_conversations:
        raise ConversationInProgress("conversation ID is already reserved by another turn")
    if (
        len(session_state.conversations) + len(session_state.pending_conversations)
        >= MAX_CONVERSATIONS_PER_SESSION
    ):
        raise ConversationLimitReached("conversation capacity reached before model call")
    session_state.pending_conversations.add(conversation_id)
    return True


def release_conversation_reservation(
    session_state: DemoSessionState,
    *,
    conversation_id: str,
) -> None:
    """Release a new conversation ID after its first model turn terminates."""
    if conversation_id not in session_state.pending_conversations:
        raise RuntimeError(
            f"conversation reservation missing in DemoSessionState: {conversation_id!r}"
        )
    session_state.pending_conversations.remove(conversation_id)


def create_demo_session(
    session_store: DemoSessionStore,
    *,
    created_at: datetime,
) -> DemoSession:
    """Create and store a one-hour demo session with an opaque random token."""
    _require_aware(created_at, name="created_at")
    expire_demo_sessions(session_store, checked_at=created_at)
    if len(session_store) >= MAX_DEMO_SESSIONS:
        raise DemoSessionCapacityReached("session capacity reached after expiry sweep")

    token = secrets.token_urlsafe(32)
    if token in session_store:
        raise RuntimeError("secrets.token_urlsafe returned an existing demo session token")
    demo_session = DemoSession(
        token=token,
        expires_at=created_at + DEMO_SESSION_LIFETIME,
    )
    session_store[token] = DemoSessionState(expires_at=demo_session.expires_at)
    return demo_session


def require_active_demo_session(
    session_store: DemoSessionStore,
    *,
    token: str,
    checked_at: datetime,
) -> DemoSessionState:
    """Return an active demo session or raise a typed unknown/expired failure."""
    session_state = session_store.get(token)
    if session_state is None:
        expire_demo_sessions(session_store, checked_at=checked_at)
        raise DemoSessionNotFound("unknown demo session token")

    _require_aware(checked_at, name="checked_at")
    if checked_at >= session_state.expires_at:
        expire_demo_sessions(session_store, checked_at=checked_at)
        raise DemoSessionExpired("expired demo session token")

    expire_demo_sessions(session_store, checked_at=checked_at)
    return session_state
