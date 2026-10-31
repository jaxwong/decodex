"""Own B1's bounded OpenAI capability check, not runtime API behavior."""

import json
import os
import secrets
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict

MAX_EXTERNAL_CALLS = 2
REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CAPABILITY_REPORT_PATH = REPOSITORY_ROOT / "docs" / "capability-smoke.json"
OPENAI_REQUEST_TIMEOUT_SECONDS = 30.0


class CapabilitySmokeFailed(RuntimeError):
    """Raised when a provider response violates the expected capability contract."""


class CapabilityResult(BaseModel):
    """One capability check result without provider IDs or credentials."""

    model_config = ConfigDict(frozen=True)

    capability: Literal["responses_function_call", "gpt_live_session"]
    status: Literal["passed", "blocked", "failed"]
    model: str
    detail: str


class CapabilityReport(BaseModel):
    """The bounded B1 capability report written for team handoff."""

    model_config = ConfigDict(frozen=True)

    checked_at: datetime
    overall_status: Literal["passed", "blocked", "failed"]
    max_external_calls: int
    capabilities: list[CapabilityResult]


def smoke_responses_function_call(client: OpenAI, *, model: str) -> CapabilityResult:
    """Make one forced strict function call and validate its typed arguments."""
    response = client.responses.create(
        model=model,
        input="Call record_smoke_result with status set to ok.",
        tools=[
            {
                "type": "function",
                "name": "record_smoke_result",
                "description": "Records the result of this API capability check.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["ok"],
                        }
                    },
                    "required": ["status"],
                    "additionalProperties": False,
                },
            }
        ],
        tool_choice={"type": "function", "name": "record_smoke_result"},
        parallel_tool_calls=False,
    )
    function_calls = [
        output_item
        for output_item in response.output
        if output_item.type == "function_call" and output_item.name == "record_smoke_result"
    ]
    if len(function_calls) != 1:
        raise CapabilitySmokeFailed(
            "Responses expected exactly one record_smoke_result function call "
            f"but received {len(function_calls)}"
        )

    try:
        arguments = json.loads(function_calls[0].arguments)
    except (TypeError, json.JSONDecodeError) as failure:
        raise CapabilitySmokeFailed(
            "Responses returned invalid JSON arguments for record_smoke_result"
        ) from failure
    if arguments != {"status": "ok"}:
        raise CapabilitySmokeFailed(
            "Responses returned unexpected record_smoke_result arguments: "
            f"expected {{'status': 'ok'}}, received {arguments!r}"
        )

    return CapabilityResult(
        capability="responses_function_call",
        status="passed",
        model=model,
        detail="Forced strict function call returned validated arguments.",
    )


def build_live_audio_offer_sdp() -> str:
    """Build the audio-plus-data WebRTC offer required by the Live create endpoint."""
    session_id = secrets.randbits(63)
    ice_username = secrets.token_hex(8)
    ice_password = secrets.token_hex(16)
    fingerprint = ":".join(f"{byte:02X}" for byte in secrets.token_bytes(32))
    audio_source = secrets.randbits(32)
    stream_id = secrets.token_hex(8)
    lines = [
        "v=0",
        f"o=- {session_id} 2 IN IP4 127.0.0.1",
        "s=-",
        "t=0 0",
        "a=group:BUNDLE 0 1",
        f"a=msid-semantic: WMS {stream_id}",
        "m=audio 9 UDP/TLS/RTP/SAVPF 111 0 8",
        "c=IN IP4 0.0.0.0",
        f"a=ice-ufrag:{ice_username}",
        f"a=ice-pwd:{ice_password}",
        "a=ice-options:trickle",
        f"a=fingerprint:sha-256 {fingerprint}",
        "a=setup:actpass",
        "a=mid:0",
        "a=sendrecv",
        "a=rtcp-mux",
        "a=rtcp-rsize",
        "a=rtpmap:111 opus/48000/2",
        "a=fmtp:111 minptime=10;useinbandfec=1",
        "a=rtpmap:0 PCMU/8000",
        "a=rtpmap:8 PCMA/8000",
        f"a=msid:{stream_id} audio",
        f"a=ssrc:{audio_source} cname:{stream_id}",
        f"a=ssrc:{audio_source} msid:{stream_id} audio",
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
        "c=IN IP4 0.0.0.0",
        f"a=ice-ufrag:{ice_username}",
        f"a=ice-pwd:{ice_password}",
        "a=ice-options:trickle",
        f"a=fingerprint:sha-256 {fingerprint}",
        "a=setup:actpass",
        "a=mid:1",
        "a=sctp-port:5000",
        "a=max-message-size:262144",
    ]
    return "\r\n".join(lines) + "\r\n"


def smoke_live_session(client: OpenAI, *, model: str) -> CapabilityResult:
    """Make one Live create-session call using the official Python SDK request shape."""
    live_response = client.live.create(
        session={
            "model": model,
            "instructions": "Capability check only. Be concise.",
        },
        transport={"type": "webrtc", "sdp": build_live_audio_offer_sdp()},
    )
    if not live_response.session.id or not live_response.transport.sdp:
        raise CapabilitySmokeFailed(
            "GPT-Live expected a session ID and WebRTC SDP answer from live.create"
        )

    return CapabilityResult(
        capability="gpt_live_session",
        status="passed",
        model=model,
        detail="Live create-session returned a session and WebRTC SDP answer.",
    )


def run_capability_smoke(
    client: OpenAI,
    *,
    text_model: str,
    live_model: str,
) -> CapabilityReport:
    """Run two independent checks once each, recording failures without retry or fallback."""
    try:
        responses_result = smoke_responses_function_call(client, model=text_model)
    except (OpenAIError, CapabilitySmokeFailed) as failure:
        responses_result = CapabilityResult(
            capability="responses_function_call",
            status="failed",
            model=text_model,
            detail=f"{type(failure).__name__}: {failure}",
        )

    try:
        live_result = smoke_live_session(client, model=live_model)
    except (OpenAIError, CapabilitySmokeFailed) as failure:
        live_result = CapabilityResult(
            capability="gpt_live_session",
            status="failed",
            model=live_model,
            detail=f"{type(failure).__name__}: {failure}",
        )

    capability_results = [responses_result, live_result]

    return CapabilityReport(
        checked_at=datetime.now(UTC),
        overall_status=(
            "passed"
            if all(result.status == "passed" for result in capability_results)
            else "failed"
        ),
        max_external_calls=MAX_EXTERNAL_CALLS,
        capabilities=capability_results,
    )


def main() -> int:
    """Run B1 smoke checks, write their report, and return a machine-readable exit status."""
    text_model = os.environ.get("OPENAI_TEXT_MODEL")
    live_model = os.environ.get("OPENAI_LIVE_MODEL")
    missing_model_variables = [
        variable_name
        for variable_name, model in (
            ("OPENAI_TEXT_MODEL", text_model),
            ("OPENAI_LIVE_MODEL", live_model),
        )
        if model is None or not model.strip()
    ]
    if missing_model_variables:
        print(
            "Missing non-blank model configuration: " + ", ".join(missing_model_variables),
            file=sys.stderr,
        )
        return 2

    assert text_model is not None
    assert live_model is not None
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key is None or not api_key.strip():
        blocker_detail = "OPENAI_API_KEY is not set; no external call was attempted."
        report = CapabilityReport(
            checked_at=datetime.now(UTC),
            overall_status="blocked",
            max_external_calls=MAX_EXTERNAL_CALLS,
            capabilities=[
                CapabilityResult(
                    capability="responses_function_call",
                    status="blocked",
                    model=text_model,
                    detail=blocker_detail,
                ),
                CapabilityResult(
                    capability="gpt_live_session",
                    status="blocked",
                    model=live_model,
                    detail=blocker_detail,
                ),
            ],
        )
        CAPABILITY_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        CAPABILITY_REPORT_PATH.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
        print(report.model_dump_json(indent=2))
        return 2

    client = OpenAI(
        api_key=api_key,
        max_retries=0,
        timeout=OPENAI_REQUEST_TIMEOUT_SECONDS,
    )
    report = run_capability_smoke(client, text_model=text_model, live_model=live_model)
    CAPABILITY_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CAPABILITY_REPORT_PATH.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(report.model_dump_json(indent=2))
    return 0 if report.overall_status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
