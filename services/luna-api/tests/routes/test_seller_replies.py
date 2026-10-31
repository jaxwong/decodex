import asyncio
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.contracts.evidence import FieldKey
from app.decision.seller_questions import SELLER_FIELD_LABELS, seller_reply_text
from app.errors import InvalidRequest
from app.evidence import EvidenceBuilder
from app.evidence.normalize import extract_source_values, normalize_value
from app.evidence.schema import SCHEMA_FIELDS
from app.main import create_app
from app.providers import MockCatalogProvider
from tests.evidence.fakes import FakeModelClient

SELECTIONS = [
    {"listing_id": "listingA", "variant_id": "100w"},
    {"listing_id": "listingC", "variant_id": "87w"},
]
QUESTIONS = "/api/listings/listingC/variants/87w/questions"
REPLIES = "/api/listings/listingC/variants/87w/seller-replies"


def create_pipeline_client() -> tuple[TestClient, dict[str, str], MockCatalogProvider]:
    """Build evidence through the real pipeline so stored replies reach new comparisons."""
    provider = MockCatalogProvider()
    client = TestClient(
        create_app(
            catalog_provider=provider,
            build_evidence=EvidenceBuilder(provider, FakeModelClient()).build,
        )
    )
    token = client.post("/api/demo-sessions").json()["token"]
    return client, {"Authorization": f"Bearer {token}"}, provider


def weight_fact(comparison: dict[str, Any], item_key: str) -> dict[str, Any]:
    facts = comparison["evidence"]["facts_by_item"][item_key]
    return next(fact for fact in facts if fact["field_key"] == "weight_g")


INBOX = "/api/listings/listingC/questions"


def test_seller_routes_require_active_session() -> None:
    client, _, _ = create_pipeline_client()

    assert client.post(QUESTIONS, json={"field_key": "weight_g"}).status_code == 401
    assert client.get(INBOX).status_code == 401
    reply = client.post(REPLIES, json={"field_key": "weight_g", "answer": "198"})
    assert reply.status_code == 401


def test_sent_question_waits_in_the_listing_inbox_until_answered() -> None:
    client, headers, _ = create_pipeline_client()
    assert client.get(INBOX, headers=headers).json() == {"questions": []}

    first = client.post(QUESTIONS, headers=headers, json={"field_key": "weight_g"})
    again = client.post(QUESTIONS, headers=headers, json={"field_key": "weight_g"})
    other = client.post(
        "/api/listings/listingA/variants/100w/questions",
        headers=headers,
        json={"field_key": "warranty_months"},
    )

    assert first.status_code == again.status_code == other.status_code == 200
    assert again.json() == first.json()
    assert client.get(INBOX, headers=headers).json() == {"questions": [first.json()]}
    assert client.get("/api/listings/listingA/questions", headers=headers).json() == {
        "questions": [other.json()]
    }

    reply = client.post(REPLIES, headers=headers, json={"field_key": "weight_g", "answer": "198"})

    assert reply.status_code == 201
    assert client.get(INBOX, headers=headers).json() == {"questions": []}
    closed = client.post(QUESTIONS, headers=headers, json={"field_key": "weight_g"})
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "SELLER_REPLY_EXISTS"


def test_rejected_answer_keeps_the_question_open() -> None:
    client, headers, _ = create_pipeline_client()
    question = client.post(QUESTIONS, headers=headers, json={"field_key": "weight_g"}).json()

    rejected = client.post(
        REPLIES, headers=headers, json={"field_key": "weight_g", "answer": "heavy"}
    )

    assert rejected.status_code == 422
    assert client.get(INBOX, headers=headers).json() == {"questions": [question]}


def test_inbox_rejects_unknown_listing() -> None:
    client, headers, _ = create_pipeline_client()

    response = client.get("/api/listings/listingZ/questions", headers=headers)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UNKNOWN_LISTING"


@pytest.mark.parametrize(
    ("field_key", "question"),
    [
        ("weight_g", "What is the Weight (g) of the 87W model?"),
        ("max_output_w", "What is the Max output (W) of the 87W model?"),
        ("pd_supported", "What is the USB PD of the 87W model?"),
    ],
)
def test_question_is_a_fixed_template_for_the_exact_variant(field_key: str, question: str) -> None:
    client, headers, _ = create_pipeline_client()

    response = client.post(QUESTIONS, headers=headers, json={"field_key": field_key})

    assert response.status_code == 200
    assert response.json() == {
        "listing_id": "listingC",
        "variant_id": "87w",
        "field_key": field_key,
        "question": question,
    }


@pytest.mark.parametrize(
    ("path", "body", "status", "code"),
    [
        (QUESTIONS, {"field_key": "colour"}, 422, "INVALID_REQUEST"),
        (
            "/api/listings/listingZ/variants/87w/questions",
            {"field_key": "weight_g"},
            400,
            "UNKNOWN_LISTING",
        ),
        (
            "/api/listings/listingC/variants/999w/seller-replies",
            {"field_key": "weight_g", "answer": "198"},
            400,
            "UNKNOWN_VARIANT",
        ),
        (REPLIES, {"field_key": "weight_g", "answer": "heavy"}, 422, "INVALID_REQUEST"),
        (REPLIES, {"field_key": "weight_g", "answer": "198 lb"}, 422, "INVALID_REQUEST"),
        (REPLIES, {"field_key": "weight_g", "answer": "198 g; Capacity: 5 mAh"}, 422, None),
        (REPLIES, {"field_key": "weight_g", "answer": "Capacity: 5 mAh"}, 422, None),
        (REPLIES, {"field_key": "weight_g", "answer": ""}, 422, None),
        (REPLIES, {"field_key": "weight_g", "answer": "198\nCapacity: 5 mAh"}, 422, None),
    ],
)
def test_invalid_question_or_reply_stores_nothing(
    path: str, body: dict[str, str], status: int, code: str | None
) -> None:
    client, headers, provider = create_pipeline_client()
    version_before = asyncio.run(provider.get_snapshot_version("listingC"))

    response = client.post(path, headers=headers, json=body)

    assert response.status_code == status
    assert response.json()["error"]["code"] == (code or "INVALID_REQUEST")
    assert asyncio.run(provider.get_snapshot_version("listingC")) == version_before


def test_reply_reaches_only_comparisons_built_afterwards() -> None:
    client, headers, _ = create_pipeline_client()
    before = client.post("/api/comparisons", headers=headers, json={"items": SELECTIONS}).json()
    assert weight_fact(before, "listingC:87w")["status"] == "missing"

    reply = client.post(REPLIES, headers=headers, json={"field_key": "weight_g", "answer": "198"})

    assert reply.status_code == 201
    assert reply.json() == {
        "listing_id": "listingC",
        "variant_id": "87w",
        "field_key": "weight_g",
        "text": "Weight: 198 g",
    }
    unchanged = client.get(f"/api/comparisons/{before['comparison_id']}", headers=headers).json()
    assert unchanged == before
    after = client.post("/api/comparisons", headers=headers, json={"items": SELECTIONS}).json()
    weight = weight_fact(after, "listingC:87w")
    assert weight["status"] == "supported" and weight["value"] == 198
    [evidence_id] = weight["evidence_ids"]
    source = after["evidence"]["evidence"][evidence_id]
    assert source["source_location"] == "variants/87w/seller_replies/0"
    assert source["source_text"] == "Weight: 198 g"


def test_second_reply_for_the_same_field_conflicts() -> None:
    client, headers, _ = create_pipeline_client()
    first = client.post(REPLIES, headers=headers, json={"field_key": "weight_g", "answer": "198"})
    second = client.post(REPLIES, headers=headers, json={"field_key": "weight_g", "answer": "199"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "SELLER_REPLY_EXISTS"


@pytest.mark.parametrize(
    ("field_key", "answer", "value"),
    [
        ("capacity_mah", "20000", 20000),
        ("capacity_mah", "20 Ah", 20000),
        ("max_output_w", "65", 65),
        ("usb_c_ports", "2", 2),
        ("weight_g", "0.2 kg", 200),
        ("max_input_w", "65 W", 65),
        ("pd_supported", "yes", True),
        ("included_cable", "no", False),
        ("warranty_months", "1 year", 12),
    ],
)
def test_every_seller_label_reads_back_as_its_own_field(
    field_key: FieldKey, answer: str, value: int | bool
) -> None:
    text = seller_reply_text(field_key, answer)

    assert text.startswith(SELLER_FIELD_LABELS[field_key] + ": ")
    [raw_value] = extract_source_values(field_key, text)
    assert normalize_value(field_key, raw_value) == value


def test_bare_number_without_a_unit_field_is_still_validated() -> None:
    with pytest.raises(InvalidRequest):
        seller_reply_text("pd_supported", "2")


def test_openapi_exposes_seller_question_routes() -> None:
    client, _, _ = create_pipeline_client()
    schema = client.get("/openapi.json").json()

    assert (
        QUESTIONS.replace("listingC", "{listing_id}").replace("87w", "{variant_id}")
        in schema["paths"]
    )
    assert (
        REPLIES.replace("listingC", "{listing_id}").replace("87w", "{variant_id}")
        in schema["paths"]
    )
    assert INBOX.replace("listingC", "{listing_id}") in schema["paths"]
    assert "SellerQuestionsResponse" in schema["components"]["schemas"]
    assert "SELLER_REPLY_EXISTS" in schema["components"]["schemas"]["ErrorCode"]["enum"]


def test_every_schema_field_has_a_seller_label() -> None:
    assert set(SELLER_FIELD_LABELS) == {field.field_key for field in SCHEMA_FIELDS}
