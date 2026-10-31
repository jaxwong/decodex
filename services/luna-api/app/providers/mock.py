"""Local synthetic catalog with content-addressed snapshots and scoped cursors."""
import base64
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from .base import CatalogProvider

DATA_ROOT = Path(__file__).resolve().parents[4] / 'data'


class CatalogError(ValueError):
    """A public, stable error code for the API composition layer."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class MockCatalogProvider:
    def __init__(self, data_root: Path = DATA_ROOT):
        listings = json.loads((data_root / 'listings.json').read_text())['listings']
        self._listings = {listing['listing_id']: listing for listing in listings}
        self._reviews = json.loads((data_root / 'reviews.json').read_text())['reviews']

    async def list_listings(self, query: str | None = None) -> list[dict]:
        return [dict(id=listing['listing_id'], listing_id=listing['listing_id'],
                     title=listing['title'], synthetic=listing['synthetic'], image_url=None,
                     preview='Fabricated demo listing; exact variant selection required.',
                     variants=[dict(id=v['variant_id'], variant_id=v['variant_id'], label=v['label'],
                                    price_minor=v['price_minor'], currency=v['currency']) for v in listing['variants']])
                for listing in self._listings.values()
                if not query or query.casefold() in listing['title'].casefold()]

    async def get_listing(self, listing_id: str) -> dict | None:
        return deepcopy(self._listings.get(listing_id))

    async def get_variant(self, listing_id: str, variant_id: str) -> dict | None:
        listing = self._listings.get(listing_id)
        if listing is None:
            return None
        return deepcopy(next((v for v in listing['variants'] if v['variant_id'] == variant_id), None))

    async def get_snapshot_version(self, listing_id: str) -> str:
        if listing_id not in self._listings:
            raise CatalogError('unknown_listing')
        snapshot = {'listing': self._listings[listing_id],
                    'reviews': [r for r in self._reviews if r['listing_id'] == listing_id]}
        return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()

    async def get_reviews(self, listing_id: str, variant_id: str | None,
                          cursor: str | None = None, limit: int = 50) -> dict:
        """Return exact + unknown reviews; None explicitly requests all listing reviews.

        Unknown-variant reviews are returned with their original null tag, never relabelled.
        """
        version = await self.get_snapshot_version(listing_id)
        if variant_id is not None and await self.get_variant(listing_id, variant_id) is None:
            raise CatalogError('unknown_variant')
        if type(limit) is not int or not 1 <= limit <= 50:
            raise CatalogError('invalid_limit')
        scope = [listing_id, variant_id, version]
        offset = 0
        if cursor is not None:
            try:
                decoded = json.loads(base64.urlsafe_b64decode(cursor.encode()))
                offset = decoded['offset']
                if decoded['scope'] != scope or type(offset) is not int or offset < 0:
                    raise ValueError('Invalid cursor scope')
            except (ValueError, KeyError, TypeError, UnicodeError) as failure:
                raise CatalogError('invalid_cursor') from failure
        reviews = [r for r in self._reviews if r['listing_id'] == listing_id
                   and (variant_id is None or r['variant_id'] in (None, variant_id))]
        if offset > len(reviews):
            raise CatalogError('invalid_cursor')
        next_offset = offset + limit
        next_cursor = None if next_offset >= len(reviews) else base64.urlsafe_b64encode(
            json.dumps({'scope': scope, 'offset': next_offset}).encode()).decode()
        return {'reviews': deepcopy(reviews[offset:next_offset]), 'next_cursor': next_cursor,
                'snapshot_version': version}


def provider_factory(config: dict | None = None) -> CatalogProvider:
    """Construct the only available provider; reject unsupported integrations explicitly."""
    config = config or {}
    if config.get('provider', 'mock') != 'mock':
        raise CatalogError('unsupported_provider')
    return MockCatalogProvider(Path(config.get('data_root', DATA_ROOT)))
