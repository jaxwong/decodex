import inspect
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest
from openai import OpenAI, OpenAIError

from app.openai import capability_smoke
from app.openai.capability_smoke import (
    CapabilitySmokeFailed,
    build_live_audio_offer_sdp,
    run_capability_smoke,
    smoke_live_session,
    smoke_responses_function_call,
)


class FakeResponses:
    def __init__(self, output: list[SimpleNamespace]) -> None:
        self.output = output
        self.requests: list[dict[str, Any]] = []

    def create(self, **request: Any) -> SimpleNamespace:
        self.requests.append(request)
        return SimpleNamespace(output=self.output)


class FakeLive:
    def __init__(self, failure: Exception | None = None) -> None:
        self.failure = failure
        self.requests: list[dict[str, Any]] = []

    def create(self, **request: Any) -> SimpleNamespace:
        self.requests.append(request)
        if self.failure is not None:
            raise self.failure
        return SimpleNamespace(
            session=SimpleNamespace(id="live_test"),
            transport=SimpleNamespace(type="webrtc", sdp="answer"),
        )


class FakeOpenAIClient:
    def __init__(
        self,
        response_output: list[SimpleNamespace],
        *,
        live_failure: Exception | None = None,
    ) -> None:
        self.responses = FakeResponses(response_output)
        self.live = FakeLive(live_failure)


def test_installed_sdk_exposes_required_b1_methods() -> None:
    client = OpenAI(api_key="test", max_retries=0)

    responses_parameters = inspect.signature(client.responses.create).parameters
    live_parameters = inspect.signature(client.live.create).parameters

    assert {"model", "input", "tools", "tool_choice", "parallel_tool_calls"} <= set(
        responses_parameters
    )
    assert {"session", "transport"} <= set(live_parameters)


def test_smoke_responses_forces_one_strict_function_call() -> None:
    client = FakeOpenAIClient(
        [
            SimpleNamespace(
                type="function_call",
                name="record_smoke_result",
                arguments='{"status":"ok"}',
            )
        ]
    )

    smoke_result = smoke_responses_function_call(cast(OpenAI, client), model="gpt-6-luna")

    assert smoke_result.status == "passed"
    assert smoke_result.model == "gpt-6-luna"
    assert len(client.responses.requests) == 1
    request = client.responses.requests[0]
    assert request["tool_choice"] == {"type": "function", "name": "record_smoke_result"}
    assert request["parallel_tool_calls"] is False
    assert request["tools"][0]["strict"] is True
    assert request["tools"][0]["parameters"]["additionalProperties"] is False


def test_smoke_responses_rejects_missing_function_call() -> None:
    client = FakeOpenAIClient([])

    with pytest.raises(CapabilitySmokeFailed, match="record_smoke_result"):
        smoke_responses_function_call(cast(OpenAI, client), model="gpt-6-luna")


def test_smoke_live_session_uses_current_python_sdk_shape() -> None:
    client = FakeOpenAIClient([])

    smoke_result = smoke_live_session(cast(OpenAI, client), model="gpt-live-1")

    assert smoke_result.status == "passed"
    assert smoke_result.model == "gpt-live-1"
    assert len(client.live.requests) == 1
    request = client.live.requests[0]
    assert request["session"]["model"] == "gpt-live-1"
    assert request["transport"]["type"] == "webrtc"
    assert "m=audio 9 UDP/TLS/RTP/SAVPF" in request["transport"]["sdp"]
    assert "m=application 9 UDP/DTLS/SCTP webrtc-datachannel" in request["transport"]["sdp"]


def test_live_audio_offer_contains_opus_and_bundled_data_channel() -> None:
    offer_sdp = build_live_audio_offer_sdp()

    assert offer_sdp.startswith("v=0\r\n")
    assert "a=group:BUNDLE 0 1\r\n" in offer_sdp
    assert "a=rtpmap:111 opus/48000/2\r\n" in offer_sdp
    assert "a=mid:0\r\na=sendrecv\r\n" in offer_sdp
    assert "a=mid:1\r\na=sctp-port:5000\r\n" in offer_sdp


def test_run_capability_smoke_records_typed_provider_failure_without_retry() -> None:
    client = FakeOpenAIClient(
        [
            SimpleNamespace(
                type="function_call",
                name="record_smoke_result",
                arguments='{"status":"ok"}',
            )
        ],
        live_failure=OpenAIError("Live access denied"),
    )

    report = run_capability_smoke(
        cast(OpenAI, client),
        text_model="gpt-6-luna",
        live_model="gpt-live-1",
    )

    assert report.overall_status == "failed"
    assert [capability.status for capability in report.capabilities] == ["passed", "failed"]
    assert len(client.responses.requests) == 1
    assert len(client.live.requests) == 1
    assert report.capabilities[1].detail == "OpenAIError: Live access denied"


def test_run_capability_smoke_does_not_catch_programmer_error() -> None:
    client = FakeOpenAIClient(
        [
            SimpleNamespace(
                type="function_call",
                name="record_smoke_result",
                arguments='{"status":"ok"}',
            )
        ],
        live_failure=RuntimeError("broken invariant"),
    )

    with pytest.raises(RuntimeError, match="broken invariant"):
        run_capability_smoke(
            cast(OpenAI, client),
            text_model="gpt-6-luna",
            live_model="gpt-live-1",
        )


def test_main_rejects_missing_model_configuration_before_writing_report(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    report_path = tmp_path / "capability-smoke.json"
    monkeypatch.setattr(capability_smoke, "CAPABILITY_REPORT_PATH", report_path)
    monkeypatch.delenv("OPENAI_TEXT_MODEL", raising=False)
    monkeypatch.setenv("OPENAI_LIVE_MODEL", "live-model")

    exit_code = capability_smoke.main()

    assert exit_code == 2
    assert not report_path.exists()
    assert capsys.readouterr().err == ("Missing non-blank model configuration: OPENAI_TEXT_MODEL\n")


def test_main_records_missing_api_key_without_external_call(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    report_path = tmp_path / "capability-smoke.json"
    monkeypatch.setattr(capability_smoke, "CAPABILITY_REPORT_PATH", report_path)
    monkeypatch.setenv("OPENAI_TEXT_MODEL", "text-model")
    monkeypatch.setenv("OPENAI_LIVE_MODEL", "live-model")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    exit_code = capability_smoke.main()

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert exit_code == 2
    assert report["overall_status"] == "blocked"
    assert [capability["status"] for capability in report["capabilities"]] == [
        "blocked",
        "blocked",
    ]
