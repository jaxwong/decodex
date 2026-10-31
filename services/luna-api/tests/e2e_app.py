"""Expose a deterministic test-only Luna API for both browser host journeys.

Evidence goes through the real EvidenceBuilder with the deterministic extraction double, so
provider changes such as a simulated seller reply reach the next comparison as they would live.
"""

import asyncio
import json
from typing import Any, cast

from openai.types.responses import Response

from app.evidence import EvidenceBuilder
from app.evidence.index import build_evidence_index
from app.main import create_app
from app.providers import MockCatalogProvider
from tests.evidence.fakes import FakeModelClient

CATALOG_PROVIDER = MockCatalogProvider()
REFERENCE_DATA_PREFIX = "Untrusted comparison reference data"


def _breeze_shipping_evidence_id() -> str:
    listing = asyncio.run(CATALOG_PROVIDER.get_listing("listingB"))
    variant = asyncio.run(CATALOG_PROVIDER.get_variant("listingB", "65w"))
    if listing is None or variant is None:
        raise RuntimeError("E2E fixture must contain listingB:65w")
    return next(
        evidence.id
        for evidence in build_evidence_index(listing, variant).values()
        if evidence.source_location == "variants/65w/shipping_minor"
    )


E2E_CITATION_ID = _breeze_shipping_evidence_id()


def _comparison_snapshot(model_input: list[dict[str, Any]]) -> dict[str, Any]:
    """Read the snapshot the text agent sends, so citations match the built evidence.

    The serialized snapshot omits server-only recommendation fields, so it stays plain JSON.
    """
    reference = next(
        str(message["content"])
        for message in model_input
        if str(message["content"]).startswith(REFERENCE_DATA_PREFIX)
    )
    return cast(dict[str, Any], json.loads(reference.split("\n", 1)[1]))


def _answer_response(response_id: str, *, answer: str, cited_ids: list[str]) -> Response:
    return _model_response(
        response_id,
        [
            {
                "id": f"msg_{response_id}",
                "type": "message",
                "status": "completed",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps({"answer": answer, "cited_ids": cited_ids}),
                        "annotations": [],
                    }
                ],
            }
        ],
    )


def _model_response(response_id: str, output: list[dict[str, object]]) -> Response:
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


async def create_scripted_response(**request: Any) -> Response:
    """Answer a disputed-claim question read-only, or apply one preference mutation."""
    if request.get("previous_response_id") is not None:
        return _answer_response(
            "resp_e2e_answer",
            answer=(
                "Budget applied to delivered prices; items over the "
                "delivered limit are excluded. Breeze is SGD 81.65 "
                "delivered; its listed shipping line is cited."
            ),
            cited_ids=[E2E_CITATION_ID],
        )

    model_input = cast(list[dict[str, Any]], request["input"])
    if "claim" in str(model_input[-1]["content"]).lower():
        breeze = next(
            item
            for item in _comparison_snapshot(model_input)["items"]
            if item["item_key"] == "listingB:65w"
        )
        capacity = next(fact for fact in breeze["facts"] if fact["field_key"] == "capacity_mah")
        return _answer_response(
            "resp_e2e_dispute",
            answer=(
                "The seller states 20,000 mAh for Breeze 65W. 2 of the 16 reviews analysed "
                "report lower real-world capacity, such as charging a phone only twice. "
                "Luna cannot verify the true figure, so the ranking is unchanged."
            ),
            cited_ids=[*capacity["evidence_ids"], *capacity["disputing_mention_ids"]],
        )

    tools = cast(list[dict[str, Any]], request["tools"])
    apply_tool = next(tool for tool in tools if tool["name"] == "apply_preferences")
    parameters = cast(dict[str, Any], apply_tool["parameters"])
    properties = cast(dict[str, dict[str, Any]], parameters["properties"])
    comparison_ids = cast(list[str], properties["comparison_id"]["enum"])
    revisions = cast(list[int], properties["expected_revision"]["enum"])
    if len(comparison_ids) != 1 or len(revisions) != 1:
        raise RuntimeError("E2E apply_preferences schema must bind one comparison and revision")

    request_text = json.dumps(request.get("input", ""), default=str).lower()
    priorities = (
        ["price_minor"] if "actually price first" in request_text else ["weight_g", "price_minor"]
    )
    max_price_minor = 7000 if "s$70" in request_text else 8000
    return _model_response(
        "resp_e2e_apply",
        [
            {
                "id": "fc_e2e_apply",
                "type": "function_call",
                "call_id": "call_e2e_apply",
                "name": "apply_preferences",
                "arguments": json.dumps(
                    {
                        "comparison_id": comparison_ids[0],
                        "preferences": {
                            "max_price_minor": max_price_minor,
                            "min_output_w": 65,
                            "priorities": priorities,
                        },
                        "expected_revision": revisions[0],
                    }
                ),
                "status": "completed",
            }
        ],
    )


app = create_app(
    catalog_provider=CATALOG_PROVIDER,
    build_evidence=EvidenceBuilder(CATALOG_PROVIDER, FakeModelClient()).build,
    create_model_response=create_scripted_response,
    text_model="gpt-6-luna",
)
