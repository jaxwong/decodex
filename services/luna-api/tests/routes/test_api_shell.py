from fastapi.testclient import TestClient

from app.main import create_app


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
