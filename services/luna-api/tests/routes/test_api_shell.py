from typing import cast

import pytest
from fastapi.testclient import TestClient
from openai import AsyncOpenAI

import app.main as main_module
from app.main import create_app
from app.openai.runtime import CreateModelResponse, OpenAIRuntime


def test_health_returns_ok() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_create_demo_session_returns_server_owned_expiry() -> None:
    with TestClient(create_app()) as client:
        first_response = client.post("/api/demo-sessions")
        second_response = client.post("/api/demo-sessions")

    assert first_response.status_code == 201
    first_session = first_response.json()
    second_session = second_response.json()
    assert len(first_session["token"]) >= 32
    assert first_session["token"] != second_session["token"]
    assert first_session["expires_at"].endswith("Z")


def test_create_app_owns_one_runtime_client_and_closes_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponses:
        async def create(self, **request: object) -> None:
            del request

    class FakeClient:
        def __init__(self) -> None:
            self.responses = FakeResponses()
            self.closed = False

        async def close(self) -> None:
            self.closed = True

    fake_client = FakeClient()
    constructor_calls: list[dict[str, object]] = []

    def create_fake_client(**configuration: object) -> AsyncOpenAI:
        constructor_calls.append(configuration)
        return cast(AsyncOpenAI, fake_client)

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_TEXT_MODEL", "text-model")
    monkeypatch.setenv("OPENAI_LIVE_MODEL", "live-model")
    monkeypatch.setattr(main_module, "AsyncOpenAI", create_fake_client)

    application = create_app()
    runtime = cast(OpenAIRuntime, application.state.openai_runtime)
    monkeypatch.setenv("OPENAI_TEXT_MODEL", "changed-after-composition")

    with TestClient(application):
        assert runtime.client is cast(AsyncOpenAI, fake_client)
        assert runtime.text_model == "text-model"
        assert runtime.live_model == "live-model"
        assert len(constructor_calls) == 1

    assert fake_client.closed is True


def test_create_app_rejects_incomplete_or_ambiguous_injection() -> None:
    async def create_response(**request: object) -> None:
        del request

    with pytest.raises(ValueError, match="requires an explicit text_model"):
        create_app(create_model_response=cast(CreateModelResponse, create_response))
    with pytest.raises(ValueError, match="not both"):
        create_app(
            create_model_response=cast(CreateModelResponse, create_response),
            text_model="text-model",
            openai_client=cast(AsyncOpenAI, object()),
        )
