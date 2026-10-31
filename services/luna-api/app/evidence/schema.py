"""Fixed power-bank dimensions; prices are provider-owned and never extracted."""

from app.contracts.evidence import Aspect, SchemaField

SCHEMA_FIELDS = [
    SchemaField(field_key="capacity_mah", label="Capacity", unit="mAh"),
    SchemaField(field_key="max_output_w", label="Max output (selected SKU)", unit="W"),
    SchemaField(field_key="usb_c_ports", label="USB-C ports", unit=None),
    SchemaField(field_key="weight_g", label="Weight", unit="g"),
    SchemaField(field_key="max_input_w", label="Max input", unit="W"),
    SchemaField(field_key="pd_supported", label="USB PD", unit=None),
    SchemaField(field_key="included_cable", label="Included cable", unit=None),
    SchemaField(field_key="warranty_months", label="Warranty", unit="months"),
]
# Distinct analysed reviews needed before a dispute attaches; one angry review never flips it.
DISPUTE_MIN_REVIEWS = 2
ASPECTS: tuple[Aspect, ...] = ("heat", "portability", "charging", "reliability", "value", "other")
UNITS = {field.field_key: field.unit for field in SCHEMA_FIELDS}
