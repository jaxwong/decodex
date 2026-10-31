"""Index original source strings without granting general marketing SKU applicability."""

import hashlib
from typing import Any

from app.contracts.evidence import Evidence, SourceType


def source_id(item_key: str, location: str, text: str) -> str:
    digest = hashlib.sha256((location + "\0" + text).encode()).hexdigest()[:20]
    return f"{item_key}:source:{digest}"


def build_evidence_index(listing: dict[str, Any], variant: dict[str, Any]) -> dict[str, Evidence]:
    item_key = f"{listing['listing_id']}:{variant['variant_id']}"
    evidence = {}

    def add(source_type: SourceType, text: str, location: str, variant_id: str | None) -> None:
        evidence_id = source_id(item_key, location, text)
        evidence[evidence_id] = Evidence(
            id=evidence_id,
            item_key=item_key,
            source_type=source_type,
            source_text=text,
            source_location=location,
            variant_id=variant_id,
        )

    add("title", listing["title"], "title", None)
    add(
        "variant",
        variant["label"],
        f"variants/{variant['variant_id']}/label",
        variant["variant_id"],
    )
    for field, label in (
        ("price_minor", "List price"),
        ("shop_voucher_minor", "Shop voucher"),
        ("shipping_minor", "Shipping"),
    ):
        add(
            "variant",
            f"{label}: {variant['currency']} {variant[field] / 100:.2f}",
            f"variants/{variant['variant_id']}/{field}",
            variant["variant_id"],
        )
    for number, attribute in enumerate(variant["attributes"]):
        add(
            "attribute",
            attribute["text"],
            f"variants/{variant['variant_id']}/attributes/{number}",
            variant["variant_id"],
        )
    # A seller's answer is exact-variant seller text, extracted like any other attribute.
    for number, reply in enumerate(variant.get("seller_replies", [])):
        add(
            "attribute",
            reply["text"],
            f"variants/{variant['variant_id']}/seller_replies/{number}",
            variant["variant_id"],
        )
    for number, attribute in enumerate(listing.get("attributes", [])):
        add("attribute", attribute["text"], f"attributes/{number}", attribute.get("variant_id"))
    for number, paragraph in enumerate(listing["description"]):
        add("description", paragraph["text"], f"description/{number}", paragraph.get("variant_id"))
    return evidence
