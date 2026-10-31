from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.contracts.evidence import ComparisonEvidence
from app.decision.sessions import DemoSessionStore, create_demo_session
from app.main import create_app
from app.providers import CatalogError, MockCatalogProvider
from tests.decision.fixtures import SELECTIONS, build_fixture_evidence


def create_authorized_client() -> tuple[TestClient, dict[str, str]]:
    """Create a test app and issue the bearer token used by protected routes."""
    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_fixture_evidence,
        )
    )
    session_response = client.post("/api/demo-sessions")
    token = session_response.json()["token"]
    return client, {"Authorization": f"Bearer {token}"}


def test_catalog_requires_active_session_and_returns_provider_projection() -> None:
    client, headers = create_authorized_client()

    unauthorized_response = client.get("/api/catalog")
    unknown_session_response = client.get(
        "/api/catalog",
        headers={"Authorization": "Bearer unknown-session-token"},
    )
    response = client.get("/api/catalog", headers=headers)

    assert unauthorized_response.status_code == 401
    assert unauthorized_response.json() == {
        "error": {
            "code": "SESSION_REQUIRED",
            "message": "A valid demo session bearer token is required.",
            "retryable": False,
        }
    }
    assert unknown_session_response.status_code == 401
    assert unknown_session_response.json() == unauthorized_response.json()
    assert "unknown-session-token" not in unknown_session_response.text
    assert response.status_code == 200
    assert len(response.json()["listings"]) == 3
    assert response.json()["listings"][0]["synthetic"] is True


def test_create_and_get_comparison_returns_canonical_session_state() -> None:
    client, headers = create_authorized_client()

    create_response = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    )
    comparison = create_response.json()
    get_response = client.get(
        f"/api/comparisons/{comparison['comparison_id']}",
        headers=headers,
    )

    assert create_response.status_code == 201
    assert comparison["revision"] == 0
    assert comparison["recommendation"]["item_key"] is None
    assert len(comparison["evidence"]["items"]) == 3
    assert get_response.status_code == 200
    assert get_response.json() == comparison


def test_comparison_is_not_visible_to_another_session() -> None:
    client, owner_headers = create_authorized_client()
    comparison = client.post(
        "/api/comparisons", headers=owner_headers, json={"items": SELECTIONS}
    ).json()
    other_token = client.post("/api/demo-sessions").json()["token"]

    response = client.get(
        f"/api/comparisons/{comparison['comparison_id']}",
        headers={"Authorization": f"Bearer {other_token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "COMPARISON_NOT_FOUND"
    assert comparison["comparison_id"] not in response.text


def test_expired_session_is_removed_and_rejected() -> None:
    session_store: DemoSessionStore = {}
    expired_session = create_demo_session(
        session_store,
        created_at=datetime.now(UTC) - timedelta(hours=2),
    )
    client = TestClient(create_app(session_store=session_store))

    response = client.get(
        "/api/catalog",
        headers={"Authorization": f"Bearer {expired_session.token}"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_EXPIRED"
    assert expired_session.token not in session_store
    assert expired_session.token not in response.text


def test_invalid_comparison_request_uses_stable_error_envelope() -> None:
    client, headers = create_authorized_client()

    response = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": [SELECTIONS[0], SELECTIONS[0]]},
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "INVALID_REQUEST",
            "message": "Request validation failed.",
            "retryable": False,
        }
    }


def test_catalog_identity_failure_is_mapped_without_fallback() -> None:
    async def reject_variant(
        selections: Sequence[dict[str, str]],
    ) -> ComparisonEvidence:
        del selections
        raise CatalogError("unknown_variant")

    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=reject_variant,
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]

    response = client.post(
        "/api/comparisons",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": SELECTIONS},
    )

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "UNKNOWN_VARIANT",
            "message": "The selected variant does not exist.",
            "retryable": False,
        }
    }


def test_openapi_exposes_bearer_auth_and_canonical_comparison_contract() -> None:
    client, _ = create_authorized_client()

    schema = client.get("/openapi.json").json()

    assert "/api/catalog" in schema["paths"]
    assert "/api/comparisons" in schema["paths"]
    assert "/api/comparisons/{comparison_id}" in schema["paths"]
    assert "HTTPBearer" in schema["components"]["securitySchemes"]
    assert "ComparisonResponse" in schema["components"]["schemas"]
