"""Local synthetic catalog with content-addressed snapshots and scoped cursors."""

import base64
import hashlib
import json
from copy import deepcopy
from http import HTTPStatus
from pathlib import Path
from typing import Any

from pydantic import ConfigDict, TypeAdapter, ValidationError

from app.contracts.evidence import CatalogListing, CatalogVariant, StorefrontReview
from app.errors import ApiFailure, ErrorCode

from .base import CatalogProvider

DATA_ROOT = Path(__file__).resolve().parents[4] / "data"


class FixtureReview(StorefrontReview):
    """One reviews.json row: a storefront review plus the listing it belongs to.

    `created_at` and `source` are provenance the API never reads, so they pass through.
    """

    model_config = ConfigDict(extra="ignore")

    listing_id: str


def validate_fixture_reviews(
    path: Path, reviews: list[dict[str, Any]], listings: dict[str, dict[str, Any]]
) -> None:
    """Reject a hand-edited review row when the fixture loads, not with HTTP 500 per request.

    Every route and the evidence builder index rows by these keys, so a missing or mistyped
    field would otherwise surface as a KeyError or response validation error mid-request.
    """
    try:
        rows = TypeAdapter(list[FixtureReview]).validate_python(reviews)
    except ValidationError as failure:
        problems = "; ".join(
            f"reviews[{error['loc'][0]}] {'.'.join(str(part) for part in error['loc'][1:])}: "
            f"{error['msg']}"
            for error in failure.errors()
        )
        raise ValueError(f"{path} has malformed reviews: {problems}") from failure
    seen: set[str] = set()
    for number, row in enumerate(rows):
        where = f"{path} reviews[{number}] {row.review_id!r}"
        listing = listings.get(row.listing_id)
        if listing is None:
            raise ValueError(f"{where} names unknown listing {row.listing_id!r}")
        if row.variant_id is not None and all(
            variant["variant_id"] != row.variant_id for variant in listing["variants"]
        ):
            raise ValueError(f"{where} names unknown variant {row.variant_id!r}")
        if row.review_id in seen:
            raise ValueError(f"{where} is a duplicate review_id {row.review_id!r}")
        seen.add(row.review_id)


CATALOG_FAILURES: dict[str, tuple[ErrorCode, HTTPStatus, str, bool]] = {
    "duplicate_selection": (
        ErrorCode.DUPLICATE_SELECTION,
        HTTPStatus.BAD_REQUEST,
        "The same exact variant cannot be selected twice.",
        False,
    ),
    "invalid_bucket": (
        ErrorCode.INVALID_BUCKET,
        HTTPStatus.BAD_REQUEST,
        "Select between two and four exact variants.",
        False,
    ),
    "provider_unavailable": (
        ErrorCode.PROVIDER_UNAVAILABLE,
        HTTPStatus.SERVICE_UNAVAILABLE,
        "Catalog evidence is temporarily unavailable.",
        True,
    ),
    "snapshot_changed": (
        ErrorCode.SNAPSHOT_CHANGED,
        HTTPStatus.CONFLICT,
        "Catalog evidence changed while the comparison was built.",
        True,
    ),
    "unknown_listing": (
        ErrorCode.UNKNOWN_LISTING,
        HTTPStatus.BAD_REQUEST,
        "The selected listing does not exist.",
        False,
    ),
    "unknown_variant": (
        ErrorCode.UNKNOWN_VARIANT,
        HTTPStatus.BAD_REQUEST,
        "The selected variant does not exist.",
        False,
    ),
    "seller_reply_exists": (
        ErrorCode.SELLER_REPLY_EXISTS,
        HTTPStatus.CONFLICT,
        "The seller already answered this field for this variant.",
        False,
    ),
    "unsupported_provider": (
        ErrorCode.UNSUPPORTED_PROVIDER,
        HTTPStatus.SERVICE_UNAVAILABLE,
        "The configured catalog provider is unavailable.",
        False,
    ),
    "repeated_review_cursor": (
        ErrorCode.REPEATED_REVIEW_CURSOR,
        HTTPStatus.SERVICE_UNAVAILABLE,
        "Catalog review pagination did not advance.",
        True,
    ),
    "invalid_limit": (
        ErrorCode.INVALID_LIMIT,
        HTTPStatus.BAD_REQUEST,
        "The catalog page limit is invalid.",
        False,
    ),
    "invalid_cursor": (
        ErrorCode.INVALID_CURSOR,
        HTTPStatus.BAD_REQUEST,
        "The catalog cursor is invalid.",
        False,
    ),
}


class CatalogError(ApiFailure):
    """A public, stable error code for the API composition layer."""

    def __init__(self, catalog_code: str):
        try:
            self.code, self.http_status, self.public_message, self.retryable = CATALOG_FAILURES[
                catalog_code
            ]
        except KeyError as failure:
            raise ValueError(f"Unknown CatalogError code: {catalog_code!r}") from failure
        self.catalog_code = catalog_code
        super().__init__(catalog_code)


class MockCatalogProvider:
    def __init__(self, data_root: Path = DATA_ROOT):
        listings = json.loads((data_root / "listings.json").read_text())["listings"]
        self._listings = {listing["listing_id"]: listing for listing in listings}
        reviews_path = data_root / "reviews.json"
        self._reviews = json.loads(reviews_path.read_text())["reviews"]
        validate_fixture_reviews(reviews_path, self._reviews, self._listings)

    async def list_listings(self, query: str | None = None) -> list[CatalogListing]:
        return [
            CatalogListing(
                id=listing["listing_id"],
                listing_id=listing["listing_id"],
                title=listing["title"],
                synthetic=listing["synthetic"],
                image_url=listing.get("image_url"),
                preview="Fabricated demo listing; exact variant selection required.",
                variants=[
                    CatalogVariant(
                        id=v["variant_id"],
                        variant_id=v["variant_id"],
                        label=v["label"],
                        price_minor=v["price_minor"],
                        shop_voucher_minor=v["shop_voucher_minor"],
                        shipping_minor=v["shipping_minor"],
                        currency=v["currency"],
                    )
                    for v in listing["variants"]
                ],
            )
            for listing in self._listings.values()
            if not query or query.casefold() in listing["title"].casefold()
        ]

    async def get_listing(self, listing_id: str) -> dict[str, Any] | None:
        return deepcopy(self._listings.get(listing_id))

    async def get_variant(self, listing_id: str, variant_id: str) -> dict[str, Any] | None:
        listing = self._listings.get(listing_id)
        if listing is None:
            return None
        return deepcopy(
            next((v for v in listing["variants"] if v["variant_id"] == variant_id), None)
        )

    async def add_seller_reply(
        self, listing_id: str, variant_id: str, field_key: str, text: str
    ) -> None:
        """Store one simulated seller answer as variant source text, in memory only.

        One answer per field bounds the stored replies by the schema size. The listing
        snapshot hashes the replies, so open comparisons stay untouched and a new
        comparison re-extracts with the answer.
        """
        listing = self._listings.get(listing_id)
        if listing is None:
            raise CatalogError("unknown_listing")
        variant = next((v for v in listing["variants"] if v["variant_id"] == variant_id), None)
        if variant is None:
            raise CatalogError("unknown_variant")
        replies = variant.setdefault("seller_replies", [])
        if any(reply["field_key"] == field_key for reply in replies):
            raise CatalogError("seller_reply_exists")
        replies.append({"field_key": field_key, "text": text})

    async def get_snapshot_version(self, listing_id: str) -> str:
        if listing_id not in self._listings:
            raise CatalogError("unknown_listing")
        snapshot = {
            "listing": self._listings[listing_id],
            "reviews": [r for r in self._reviews if r["listing_id"] == listing_id],
        }
        return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()

    async def get_reviews(
        self, listing_id: str, variant_id: str | None, cursor: str | None = None, limit: int = 50
    ) -> dict[str, Any]:
        """Return exact + unknown reviews; None explicitly requests all listing reviews.

        Unknown-variant reviews are returned with their original null tag, never relabelled.
        """
        version = await self.get_snapshot_version(listing_id)
        if variant_id is not None and await self.get_variant(listing_id, variant_id) is None:
            raise CatalogError("unknown_variant")
        if type(limit) is not int or not 1 <= limit <= 50:
            raise CatalogError("invalid_limit")
        scope = [listing_id, variant_id, version]
        offset = 0
        if cursor is not None:
            try:
                decoded = json.loads(base64.urlsafe_b64decode(cursor.encode()))
                offset = decoded["offset"]
                if decoded["scope"] != scope or type(offset) is not int or offset < 0:
                    raise ValueError("Invalid cursor scope")
            except (ValueError, KeyError, TypeError, UnicodeError) as failure:
                raise CatalogError("invalid_cursor") from failure
        reviews = [
            r
            for r in self._reviews
            if r["listing_id"] == listing_id
            and (variant_id is None or r["variant_id"] in (None, variant_id))
        ]
        if offset > len(reviews):
            raise CatalogError("invalid_cursor")
        next_offset = offset + limit
        next_cursor = (
            None
            if next_offset >= len(reviews)
            else base64.urlsafe_b64encode(
                json.dumps({"scope": scope, "offset": next_offset}).encode()
            ).decode()
        )
        return {
            "reviews": deepcopy(reviews[offset:next_offset]),
            "next_cursor": next_cursor,
            "snapshot_version": version,
        }


def provider_factory(config: dict[str, Any] | None = None) -> CatalogProvider:
    """Construct the only available provider; reject unsupported integrations explicitly."""
    config = config or {}
    if config.get("provider", "mock") != "mock":
        raise CatalogError("unsupported_provider")
    return MockCatalogProvider(Path(config.get("data_root", DATA_ROOT)))
