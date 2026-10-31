"""Conservative deterministic unit parsing. Unsupported dimensions abstain."""

import re
from decimal import Decimal

# Full matching prevents interpreting product IDs, multiple quantities, or
# instructions as measurements.
MEASUREMENT = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z-]*)")
LABELS = {
    "capacity_mah": r"(?:capacity|battery capacity)",
    "max_output_w": r"(?:max(?:imum)? output(?: power)?)",
    "usb_c_ports": r"(?:usb-c ports)",
    "weight_g": r"(?:weight|net weight)",
    "max_input_w": r"(?:max(?:imum)? input(?: power)?)",
    "pd_supported": r"(?:usb[ -]?pd|pd supported)",
    "included_cable": r"(?:included cable|cable included)",
    "warranty_months": r"(?:warranty)",
}
CONVERSIONS = {
    "capacity_mah": {"mah": 1, "ah": 1000},
    "max_output_w": {"w": 1},
    "usb_c_ports": {"": 1, "ports": 1},
    "weight_g": {"g": 1, "kg": 1000},
    "max_input_w": {"w": 1},
    "warranty_months": {"month": 1, "months": 1, "year": 12, "years": 12},
}
RANGES = {
    "capacity_mah": (1, 200000),
    "max_output_w": (1, 1000),
    "usb_c_ports": (0, 20),
    "weight_g": (1, 10000),
    "max_input_w": (1, 1000),
    "warranty_months": (1, 120),
}


def normalize_value(field_key: str, raw_value: str) -> int | float | bool:
    """Normalize a raw measurement or raise ValueError for unsupported units/ranges."""
    if field_key not in LABELS:
        raise ValueError("Unknown field")
    text = raw_value.strip().lower()
    if field_key in ("pd_supported", "included_cable"):
        if text in ("yes", "true", "supported", "included", "usb-pd", "pd"):
            return True
        if text in ("no", "false", "not supported", "not included"):
            return False
        raise ValueError("Unclear boolean")
    measurement = MEASUREMENT.fullmatch(text)
    if not measurement or measurement[2] not in CONVERSIONS[field_key]:
        raise ValueError("Unsupported measurement or unit")
    value = Decimal(measurement[1]) * CONVERSIONS[field_key][measurement[2]]
    minimum, maximum = RANGES[field_key]
    if not minimum <= value <= maximum:
        raise ValueError("Measurement out of range")
    if (
        field_key in ("capacity_mah", "usb_c_ports", "warranty_months")
        and value != value.to_integral()
    ):
        raise ValueError("Discrete quantity must be integral")
    return int(value) if value == value.to_integral() else float(value)


def extract_source_values(field_key: str, source_text: str) -> list[str]:
    """Accept explicitly labelled clauses only; unfamiliar prose remains unresolved.

    A model cannot attach an unrelated quoted number to a field. Each accepted raw
    value must follow a field-specific label and occupy the complete source clause.
    """
    values = []
    for clause in re.split(r"[;\n]", source_text):
        match = re.fullmatch(r"\s*" + LABELS[field_key] + r"\s*:\s*(.*?)\s*", clause, re.IGNORECASE)
        if match:
            values.append(match[1])
    return values
