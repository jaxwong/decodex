from typing import Any

from eval.fixtures import SELECTIONS
from fastapi.testclient import TestClient

from tests.routes.test_comparisons import create_authorized_client


def create_comparison() -> tuple[TestClient, dict[str, str], dict[str, Any]]:
    client, headers = create_authorized_client()
    comparison = client.post("/api/comparisons", headers=headers, json={"items": SELECTIONS}).json()
    return client, headers, comparison


def pick_body(item_key: str, expected_revision: int = 0) -> dict[str, object]:
    return {"item_key": item_key, "expected_revision": expected_revision}


def test_pick_requires_active_session() -> None:
    client, _, comparison = create_comparison()

    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/pick", json=pick_body("listingA:100w")
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_REQUIRED"


def test_pick_rejects_unknown_comparison() -> None:
    client, headers, _ = create_comparison()

    response = client.post(
        "/api/comparisons/cmp_unknown/pick", headers=headers, json=pick_body("listingA:100w")
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "COMPARISON_NOT_FOUND"


def test_pick_rejects_stale_revision_with_the_current_one() -> None:
    client, headers, comparison = create_comparison()

    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/pick",
        headers=headers,
        json=pick_body("listingA:100w", expected_revision=1),
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "STALE_COMPARISON",
            "message": "The comparison changed; refresh before applying the newer intent.",
            "retryable": False,
            "current_revision": 0,
        }
    }


def test_pick_rejects_an_item_outside_the_comparison() -> None:
    client, headers, comparison = create_comparison()

    response = client.post(
        f"/api/comparisons/{comparison['comparison_id']}/pick",
        headers=headers,
        json=pick_body("listingC:100w"),
    )

    assert response.status_code == 422
    assert response.json()["error"] == {
        "code": "INVALID_REQUEST",
        "message": "The picked item is not in this comparison.",
        "retryable": False,
    }


def test_pick_is_recorded_once_per_comparison_and_never_serialized_to_buyers() -> None:
    client, headers, comparison = create_comparison()
    path = f"/api/comparisons/{comparison['comparison_id']}"

    first = client.post(f"{path}/pick", headers=headers, json=pick_body("listingA:100w"))
    second = client.post(f"{path}/pick", headers=headers, json=pick_body("listingB:65w"))
    current = client.get(path, headers=headers)
    atlas_report = client.get("/api/listings/listingA/gap-report", headers=headers).json()
    breeze_report = client.get("/api/listings/listingB/gap-report", headers=headers).json()

    assert first.status_code == 204
    assert first.content == b""
    assert second.status_code == 204
    assert current.json() == comparison
    assert "pick" not in current.text
    # The second pick replaced the first: Atlas no longer counts as picked, it lost to Breeze.
    assert atlas_report["picked_count"] == 0
    assert atlas_report["lost_picks"] == [
        {
            "item_key": "listingA:100w",
            "competitor_item_key": "listingB:65w",
            "reason": "no_stated_reason",
            "field_key": None,
            "count": 1,
        }
    ]
    assert breeze_report["picked_count"] == 1
    assert breeze_report["lost_picks"] == []


def test_openapi_exposes_pick_contract() -> None:
    client, _ = create_authorized_client()

    schema = client.get("/openapi.json").json()

    assert "/api/comparisons/{comparison_id}/pick" in schema["paths"]
    assert "PickComparisonRequest" in schema["components"]["schemas"]
    assert "pick" not in schema["components"]["schemas"]["ComparisonResponse"]["properties"]
