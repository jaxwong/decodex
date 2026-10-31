import json
from typing import Any

from eval.fixtures import SELECTIONS, build_sample_evidence
from fastapi.testclient import TestClient
from openai.types.responses import Response

from app.main import create_app
from app.providers import MockCatalogProvider
from tests.routes.test_comparisons import agent_response, create_authorized_client


def test_gap_report_requires_active_session() -> None:
    client, _ = create_authorized_client()

    response = client.get("/api/listings/listingC/gap-report")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_REQUIRED"


def test_gap_report_rejects_unknown_listing() -> None:
    client, headers = create_authorized_client()

    response = client.get("/api/listings/listingZ/gap-report", headers=headers)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UNKNOWN_LISTING"


def test_gap_report_returns_zero_before_session_comparison() -> None:
    client, headers = create_authorized_client()

    response = client.get("/api/listings/listingC/gap-report", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "listing_id": "listingC",
        "comparisons_count": 0,
        "gaps": [],
        "beaten_by": [],
        "exclusion_counts": {},
        "uncertainty_counts": {},
    }


def test_openapi_exposes_gap_report_contract() -> None:
    client, _ = create_authorized_client()

    schema = client.get("/openapi.json").json()

    assert "/api/listings/{listing_id}/gap-report" in schema["paths"]
    assert "ListingGapReport" in schema["components"]["schemas"]


def test_gap_report_reflects_preference_update_through_public_routes() -> None:
    provider_calls = 0

    async def create_model_response(**request: Any) -> Response:
        nonlocal provider_calls
        provider_calls += 1
        assert "exclusion_reasons" not in json.dumps(request["input"])
        assert "uncertain_fields" not in json.dumps(request["input"])
        if provider_calls == 1:
            return agent_response(
                "resp_gap_apply",
                [
                    {
                        "id": "fc_gap_apply",
                        "type": "function_call",
                        "call_id": "call_gap_apply",
                        "name": "apply_preferences",
                        "arguments": json.dumps(
                            {
                                "comparison_id": comparison["comparison_id"],
                                "preferences": {
                                    "max_price_minor": 7000,
                                    "min_output_w": 65,
                                    "priorities": ["weight_g", "price_minor"],
                                },
                                "expected_revision": 0,
                            }
                        ),
                        "status": "completed",
                    }
                ],
            )
        return agent_response(
            "resp_gap_answer",
            [
                {
                    "id": "msg_gap_answer",
                    "type": "message",
                    "status": "completed",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps({"answer": "Preferences applied.", "cited_ids": []}),
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

    ask_response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/ask",
        headers=headers,
        json={
            "conversation_id": "gap-report",
            "message": "Under S$70, require 65W, prioritize portability then price.",
            "expected_revision": 0,
        },
    )
    report_response = client.get("/api/listings/listingC/gap-report", headers=headers)

    assert ask_response.status_code == 200
    assert provider_calls == 2
    assert report_response.status_code == 200
    assert report_response.json()["comparisons_count"] == 1
    assert report_response.json()["exclusion_counts"] == {"over_budget": 1}
