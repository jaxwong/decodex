import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx2
from eval.fixtures import SELECTIONS, build_sample_evidence
from fastapi.testclient import TestClient
from openai import APITimeoutError
from openai.types.responses import Response

from app.contracts.evidence import ComparisonEvidence, ComparisonSelection
from app.decision.sessions import DemoSessionStore, create_demo_session
from app.main import create_app
from app.providers import CatalogError, MockCatalogProvider


def create_authorized_client() -> tuple[TestClient, dict[str, str]]:
    """Create a test app and issue the bearer token used by protected routes."""
    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
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
        selections: Sequence[ComparisonSelection],
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
    assert "/api/comparisons/{comparison_id}/ask" in schema["paths"]
    assert "HTTPBearer" in schema["components"]["securitySchemes"]
    assert "ComparisonResponse" in schema["components"]["schemas"]
    assert "ComparisonItem" in schema["components"]["schemas"]
    assert "ComparisonSelection" in schema["components"]["schemas"]
    assert "CatalogListing" in schema["components"]["schemas"]
    assert "AskComparisonRequest" in schema["components"]["schemas"]
    assert "AskComparisonResponse" in schema["components"]["schemas"]
    assert set(schema["components"]["schemas"]["ErrorCode"]["enum"]) >= {
        "INVALID_REQUEST",
        "SESSION_REQUIRED",
        "STALE_COMPARISON",
        "LUNA_INVALID_RESPONSE",
    }


def test_ask_without_composed_model_runtime_fails_explicitly() -> None:
    client, headers = create_authorized_client()
    comparison = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    ).json()

    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json={"conversation_id": "conv-1", "message": "Compare them.", "expected_revision": 0},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "LUNA_NOT_CONFIGURED"


def agent_response(response_id: str, output: list[dict[str, object]]) -> Response:
    """Build one concrete SDK response for the route boundary."""
    return Response.model_validate(
        {
            "id": response_id,
            "object": "response",
            "created_at": 0,
            "status": "completed",
            "model": "gpt-6-luna",
            "output": output,
            "parallel_tool_calls": False,
            "tool_choice": "auto",
            "tools": [],
        }
    )


def test_ask_returns_validated_answer_and_current_server_decision() -> None:
    provider_requests: list[dict[str, Any]] = []

    async def create_model_response(**request: Any) -> Response:
        provider_requests.append(request)
        cited_id = next(
            iter(
                json.loads(request["input"][-2]["content"].split("\n", maxsplit=1)[1])["items"][0][
                    "facts"
                ][0]["evidence_ids"]
            )
        )
        return agent_response(
            "resp_answer",
            [
                {
                    "id": "msg_answer",
                    "type": "message",
                    "status": "completed",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(
                                {
                                    "answer": "The table remains evidence-bound.",
                                    "cited_ids": [cited_id],
                                }
                            ),
                            "annotations": [],
                        }
                    ],
                }
            ],
        )

    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
            create_model_response=create_model_response,
            text_model="gpt-6-luna",
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    comparison = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    ).json()

    unauthorized_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        json={
            "conversation_id": "conv-1",
            "message": "Which facts are verified?",
            "expected_revision": 0,
        },
    )
    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json={
            "conversation_id": "conv-1",
            "message": "Which facts are verified?",
            "expected_revision": 0,
        },
    )

    assert unauthorized_response.status_code == 401
    assert response.status_code == 200
    assert response.json()["conversation_id"] == "conv-1"
    assert response.json()["request_id"].startswith("req_")
    assert response.json()["answer"] == "The table remains evidence-bound."
    assert response.json()["recommendation"]["item_key"] is None
    assert response.json()["ui_patch"] is None
    assert len(provider_requests) == 1


def test_timeout_after_update_preserves_mutation_and_prevents_retry() -> None:
    provider_call_count = 0

    async def create_model_response(**request: Any) -> Response:
        nonlocal provider_call_count
        del request
        provider_call_count += 1
        if provider_call_count == 1:
            return agent_response(
                "resp_apply",
                [
                    {
                        "id": "fc_apply",
                        "type": "function_call",
                        "call_id": "call_apply",
                        "name": "apply_preferences",
                        "arguments": json.dumps(
                            {
                                "comparison_id": comparison["comparison_id"],
                                "preferences": {
                                    "max_price_minor": 8000,
                                    "min_output_w": None,
                                    "priorities": ["price_minor"],
                                },
                                "expected_revision": 0,
                            }
                        ),
                        "status": "completed",
                    }
                ],
            )
        raise APITimeoutError(request=httpx2.Request("POST", "https://api.openai.com"))

    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
            create_model_response=create_model_response,
            text_model="gpt-6-luna",
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    comparison = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    ).json()
    request_body = {
        "conversation_id": "conv-1",
        "message": "Under S$80, prioritize price.",
        "expected_revision": 0,
    }

    timeout_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json=request_body,
    )
    retry_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json=request_body,
    )
    saved_comparison = client.get(
        f"/api/comparisons/{comparison['comparison_id']}",
        headers=headers,
    ).json()
    expected_timeout_message = "Preferences were applied, but Luna's reply timed out."
    expected_timeout_message += " Refresh the comparison."

    assert timeout_response.status_code == 503
    assert timeout_response.json() == {
        "error": {
            "code": "LUNA_TIMEOUT_AFTER_UPDATE",
            "message": expected_timeout_message,
            "retryable": False,
            "current_revision": 1,
        }
    }
    assert retry_response.status_code == 409
    assert retry_response.json()["error"]["code"] == "STALE_COMPARISON"
    assert saved_comparison["revision"] == 1
    assert saved_comparison["preferences"]["max_price_minor"] == 8000
    assert provider_call_count == 2


def test_invalid_answer_after_update_returns_committed_revision() -> None:
    provider_call_count = 0

    async def create_model_response(**request: Any) -> Response:
        nonlocal provider_call_count
        del request
        provider_call_count += 1
        if provider_call_count == 1:
            return agent_response(
                "resp_apply",
                [
                    {
                        "id": "fc_apply",
                        "type": "function_call",
                        "call_id": "call_apply",
                        "name": "apply_preferences",
                        "arguments": json.dumps(
                            {
                                "comparison_id": comparison["comparison_id"],
                                "preferences": {
                                    "max_price_minor": 8000,
                                    "min_output_w": None,
                                    "priorities": ["price_minor"],
                                },
                                "expected_revision": 0,
                            }
                        ),
                        "status": "completed",
                    }
                ],
            )
        return agent_response(
            "resp_invalid_answer",
            [
                {
                    "id": "msg_invalid_answer",
                    "type": "message",
                    "status": "completed",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "{}",
                            "annotations": [],
                        }
                    ],
                }
            ],
        )

    client = TestClient(
        create_app(
            catalog_provider=MockCatalogProvider(),
            build_evidence=build_sample_evidence,
            create_model_response=create_model_response,
            text_model="gpt-6-luna",
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    comparison = client.post(
        "/api/comparisons",
        headers=headers,
        json={"items": SELECTIONS},
    ).json()

    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json={
            "conversation_id": "conv-1",
            "message": "Under S$80, prioritize price.",
            "expected_revision": 0,
        },
    )
    saved_comparison = client.get(
        f"/api/comparisons/{comparison['comparison_id']}",
        headers=headers,
    ).json()

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "LUNA_INVALID_RESPONSE",
            "message": (
                "Luna returned an invalid tool request or answer. "
                "Refresh the comparison before retrying."
            ),
            "retryable": False,
            "current_revision": 1,
        }
    }
    assert saved_comparison["revision"] == 1
    assert saved_comparison["preferences"]["max_price_minor"] == 8000
    assert provider_call_count == 2
