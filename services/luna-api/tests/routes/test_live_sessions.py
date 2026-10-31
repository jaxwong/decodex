from typing import Any, cast

import pytest
from eval.fixtures import SELECTIONS, build_sample_evidence
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from openai.types.live import LiveCreateResponse

from app.main import create_app
from app.openai.capability_smoke import build_live_audio_offer_sdp
from app.providers import MockCatalogProvider


def create_comparison(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    comparison: dict[str, Any] = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    ).json()
    return comparison


def test_live_session_route_authenticates_and_returns_provider_projection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_request: dict[str, object] = {}

    async def fake_start_live_session(
        client: object,
        session_state: object,
        *,
        comparison_id: str,
        offer_sdp: str,
        live_model: str,
        text_model: str,
    ) -> LiveCreateResponse:
        captured_request.update(
            {
                "client": client,
                "session_state": session_state,
                "comparison_id": comparison_id,
                "offer_sdp": offer_sdp,
                "live_model": live_model,
                "text_model": text_model,
            }
        )
        return LiveCreateResponse.model_validate(
            {
                "session": {"id": "live_test"},
                "transport": {"type": "webrtc", "sdp": "provider-answer-sdp"},
            }
        )

    class FakeRuntimeClient:
        class Responses:
            async def create(self, **request: object) -> None:
                del request

        def __init__(self) -> None:
            self.responses = self.Responses()

    import app.routes.comparisons as comparison_routes

    monkeypatch.setattr(comparison_routes, "start_live_session", fake_start_live_session)
    runtime_client = FakeRuntimeClient()
    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
            openai_client=cast(AsyncOpenAI, runtime_client),
            text_model="gpt-6-luna",
            live_model="gpt-live-1",
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    comparison = create_comparison(client, headers)
    offer_sdp = build_live_audio_offer_sdp()

    unauthorized_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/live/session",
        json={"sdp": offer_sdp},
    )
    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/live/session",
        headers=headers,
        json={"sdp": offer_sdp},
    )

    assert unauthorized_response.status_code == 401
    assert response.status_code == 201
    assert response.json() == {
        "session": {"id": "live_test"},
        "transport": {"type": "webrtc", "sdp": "provider-answer-sdp"},
    }
    assert captured_request["comparison_id"] == comparison["comparison_id"]
    assert captured_request["client"] is runtime_client
    assert captured_request["offer_sdp"] == offer_sdp
    assert captured_request["live_model"] == "gpt-live-1"
    assert captured_request["text_model"] == "gpt-6-luna"


def test_live_session_request_rejects_missing_audio_or_data_channel() -> None:
    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    comparison = create_comparison(client, headers)

    missing_audio_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/live/session",
        headers=headers,
        json={"sdp": "v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n"},
    )
    missing_data_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/live/session",
        headers=headers,
        json={"sdp": "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"},
    )

    assert missing_audio_response.status_code == 422
    assert missing_audio_response.json()["error"]["code"] == "INVALID_REQUEST"
    assert missing_data_response.status_code == 422
    assert missing_data_response.json()["error"]["code"] == "INVALID_REQUEST"


def test_openapi_exposes_live_session_contract() -> None:
    client = TestClient(create_app())

    schema = client.get("/openapi.json").json()

    assert "/api/comparisons/{comparison_id}/live/session" in schema["paths"]
    assert "LiveSessionRequest" in schema["components"]["schemas"]
    assert "LiveSessionResponse" in schema["components"]["schemas"]
