"""Own the deterministic seller question and the source text of a seller's answer."""

import re

from app.contracts.evidence import FieldKey
from app.errors import InvalidRequest
from app.evidence.normalize import extract_source_values, normalize_value
from app.evidence.schema import SCHEMA_FIELDS, UNITS

# Seller-facing field names that the evidence parser accepts as a labelled clause. The
# schema's "Max output (selected SKU)" label is worded for buyers comparing SKUs.
SELLER_FIELD_LABELS: dict[FieldKey, str] = {
    "capacity_mah": "Capacity",
    "max_output_w": "Max output",
    "usb_c_ports": "USB-C ports",
    "weight_g": "Weight",
    "max_input_w": "Max input",
    "pd_supported": "USB PD",
    "included_cable": "Included cable",
    "warranty_months": "Warranty",
}
BARE_NUMBER = re.compile(r"[0-9]+(?:\.[0-9]+)?")


class UnreadableSellerReply(InvalidRequest):
    public_message = "Answer with one value in the unit the question asks for, for example 198."


def seller_question(field_key: FieldKey, variant_label: str) -> str:
    unit = UNITS[field_key]
    unit_text = f" ({unit})" if unit else ""
    return f"What is the {SELLER_FIELD_LABELS[field_key]}{unit_text} of the {variant_label} model?"


def seller_reply_text(field_key: FieldKey, answer: str) -> str:
    """Compose the labelled clause extraction reads; reject an answer it could not use.

    The question names the unit, so a bare number is an answer in that unit. Nothing is
    stored unless the clause parses to exactly one valid value for this field and no
    value for any other field.
    """
    value = answer.strip()
    unit = UNITS[field_key]
    if unit is not None and BARE_NUMBER.fullmatch(value):
        value = f"{value} {unit}"
    text = f"{SELLER_FIELD_LABELS[field_key]}: {value}"
    raw_values = extract_source_values(field_key, text)
    claims_other_field = any(
        extract_source_values(field.field_key, text)
        for field in SCHEMA_FIELDS
        if field.field_key != field_key
    )
    if len(raw_values) != 1 or claims_other_field:
        raise UnreadableSellerReply(f"seller reply for {field_key} is not one clause: {text!r}")
    try:
        normalize_value(field_key, raw_values[0])
    except ValueError as failure:
        raise UnreadableSellerReply(
            f"seller reply for {field_key} has no valid value: {text!r}"
        ) from failure
    return text
