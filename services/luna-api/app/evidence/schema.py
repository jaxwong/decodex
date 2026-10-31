"""Fixed power-bank dimensions; prices are provider-owned and never extracted."""

from typing import Any, Literal

FieldKey = Literal[
    "capacity_mah",
    "max_output_w",
    "usb_c_ports",
    "weight_g",
    "max_input_w",
    "pd_supported",
    "included_cable",
    "warranty_months",
]
Aspect = Literal["heat", "portability", "charging", "reliability", "value", "other"]
Sentiment = Literal["positive", "negative", "neutral"]
SCHEMA_FIELDS: list[dict[str, Any]] = [
    {"field_key": "capacity_mah", "label": "Capacity", "unit": "mAh"},
    {"field_key": "max_output_w", "label": "Max output (selected SKU)", "unit": "W"},
    {"field_key": "usb_c_ports", "label": "USB-C ports", "unit": None},
    {"field_key": "weight_g", "label": "Weight", "unit": "g"},
    {"field_key": "max_input_w", "label": "Max input", "unit": "W"},
    {"field_key": "pd_supported", "label": "USB PD", "unit": None},
    {"field_key": "included_cable", "label": "Included cable", "unit": None},
    {"field_key": "warranty_months", "label": "Warranty", "unit": "months"},
]
ASPECTS = ("heat", "portability", "charging", "reliability", "value", "other")
UNITS = {field["field_key"]: field["unit"] for field in SCHEMA_FIELDS}
