"""Index original source strings without granting general marketing SKU applicability."""
import hashlib

from app.contracts.evidence import Evidence


def source_id(item_key: str, location: str, text: str) -> str:
    digest = hashlib.sha256((location + '\0' + text).encode()).hexdigest()[:20]
    return f'{item_key}:source:{digest}'


def build_evidence_index(listing: dict, variant: dict) -> dict[str, Evidence]:
    item_key = f"{listing['listing_id']}:{variant['variant_id']}"
    evidence = {}

    def add(source_type: str, text: str, location: str, variant_id: str | None):
        evidence_id = source_id(item_key, location, text)
        evidence[evidence_id] = Evidence(id=evidence_id, item_key=item_key, source_type=source_type,
            source_text=text, source_location=location, variant_id=variant_id)

    add('title', listing['title'], 'title', None)
    add('variant', variant['label'], f"variants/{variant['variant_id']}/label", variant['variant_id'])
    for number, attribute in enumerate(variant['attributes']):
        add('attribute', attribute['text'], f"variants/{variant['variant_id']}/attributes/{number}", variant['variant_id'])
    for number, attribute in enumerate(listing.get('attributes', [])):
        add('attribute', attribute['text'], f'attributes/{number}', attribute.get('variant_id'))
    for number, paragraph in enumerate(listing['description']):
        add('description', paragraph['text'], f'description/{number}', paragraph.get('variant_id'))
    return evidence
