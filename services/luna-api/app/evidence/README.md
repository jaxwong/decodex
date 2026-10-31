# Evidence integration handoff

All supplied catalog/review data is synthetic. This package has no Shopee access,
HTTP routes, frontend, session state, recommendations or preferences.

## Frozen contract

`app.contracts.evidence` owns the typed catalog, selection, comparison-item, fact,
review, and evidence graph models. Validators also check references and counts.
Models prevent assignment; nested collections remain the prescribed lists/dicts
and must be treated as immutable snapshots.

B/C can load `data/sample_comparison_evidence.json` at the repository root:

```python
from pathlib import Path
from app.contracts.evidence import ComparisonEvidence

snapshot = ComparisonEvidence.model_validate_json(
    Path("data/sample_comparison_evidence.json").read_text()
)
```

Item identity is `listing_id + ':' + variant_id`. Demo selections are
`listingA:100w`, `listingB:65w`, `listingC:87w`. All twelve SKUs are returned by the
catalog. Items contain `listing_id`, `variant_id`, `item_key`, `title`,
`variant_label`, integer `price_minor`, `shop_voucher_minor`, `shipping_minor`,
validated `landed_price_minor`, `currency='SGD'`, `snapshot_version`, `synthetic`.
The evidence builder is the sole runtime owner of `price - voucher + shipping`.
A supported fact may carry `disputing_mention_ids`: review mentions on the same item whose
reviewers report a value contradicting the claim. The builder attaches them only when at least
`DISPUTE_MIN_REVIEWS` distinct analysed reviews agree; the fact keeps its status and value.
Schema rows contain `field_key`, `label`, `unit`. Do not derive
frontend types independently; generate from B's eventual OpenAPI wrapper.

## Public function and dependency injection

Run Python with `services/luna-api` on the import path. The exact public interface:

```python
from app.evidence import build_comparison_evidence, evidence_dependencies
from app.evidence import OpenAIModelClient
from app.contracts.evidence import ComparisonSelection
from app.providers import provider_factory

selections = [
    ComparisonSelection(listing_id="listingA", variant_id="100w"),
    ComparisonSelection(listing_id="listingB", variant_id="65w"),
    ComparisonSelection(listing_id="listingC", variant_id="87w"),
]

# Inside B's asynchronous route/service:
model_client = OpenAIModelClient(shared_sdk_client, model=resolved_text_model)
with evidence_dependencies(provider_factory({"provider": "mock"}), model_client):
    evidence = await build_comparison_evidence(selections)
```

Alternatively construct `EvidenceBuilder(provider, model_client)` at startup and
inject its bound `build(selections)` method. There are no process-global mutable
provider settings; context-manager bindings are task-local. Test doubles implement
`ModelClient.extract_specs(request)` and `extract_reviews(request)`; they live
only under `tests/evidence` and cannot be enabled by runtime configuration.

The API composition root resolves credentials and models once and injects one shared SDK
client. There is no model default or offline-answer fallback. Missing configuration or
malformed/failed Responses output produces unresolved facts.
Catalog errors raise `CatalogError` with stable typed `.code` values; the API returns these in
its HTTP envelope. Selection validation can raise Pydantic `ValidationError`.
Only two to four unique exact variants are accepted, including different variants
of one listing. Invalid identities fail before any model work.

`CatalogProvider` defines five async methods in `app/providers/base.py`.
`list_listings(query)` returns public cards with `id`/`listing_id`, `title`,
`image_url=None` (no inherited assets), `preview`, `synthetic`, and variant metadata
(`id`/`variant_id`, `label`, `price_minor`, `currency`); raw claims stay server-side.
Catalog variant metadata also includes the listed `shop_voucher_minor` and
`shipping_minor`; it does not assert personalised checkout eligibility.
`get_listing`/`get_variant` return defensive copies or `None` on unknown IDs.
Snapshot/review methods raise `CatalogError` for unknown IDs. Review pages contain
`reviews`, `next_cursor`, `snapshot_version`. Requesting a variant returns exact
plus explicitly null-tagged reviews; `variant_id=None` requests all listing
reviews. Cursors are scoped to listing, variant and source-content hash. They are
pagination tokens, not authorization tokens. Changing either source file changes
the listing's snapshot. Only the `mock` factory is implemented.

## Evidence and failure behavior

- One specification request per item, at most four per comparison, with no
  automatic retry. SDK `responses.parse(text_format=...)` validates typed raw
  candidates; Python converts Ah/mAh, kg/g, years/months and boolean aliases.
- Supported values require exact-SKU evidence and a recognized, fully labelled
  source clause such as `Weight: 0.42 kg`. Unsupported dimensions, ambiguous prose,
  unknown citations and sibling claims abstain. This deliberately limits natural
  language coverage; expanding accepted grammar requires tests.
- Complete original strings and locations are preserved. A truncated model quote
  cannot remove qualifying context from the original clause. Applicable explicit
  contradictory claims are reconciled even if the model cites only one side.
- Failed item extraction leaves other items intact. `item['analysis_status']` is
  `completed` or `unresolved`; error metadata contains only exception class names.
  B saves the returned snapshot and does not re-extract for preference changes.
- Seller/review strings are JSON-encoded user data under separate trusted system
  instructions; no extraction tools or external product knowledge are provided.
- The builder fetches reviews with pagination, excludes unknown/sibling variants
  before model extraction, and checks snapshot consistency. Their original source
  strings remain indexed with original variant tags for inspection.
- Reviews use balanced batches of 10–20 where enough exact-SKU source reviews
  exist; smaller populations use one smaller batch. Literal nonempty excerpts and
  batch-local review IDs are checked. Invalid mentions are dropped and counted.
- Aggregates count unique reviews per aspect/sentiment. A mixed review counts once
  in each expressed sentiment; sentiment totals may exceed N. N includes all
  successfully analyzed exact-SKU reviews, even those with no mentions. A failed
  batch contributes no reviews to N. `review_status='unresolved'` signals partial
  or failed extraction; `review_coverage` gives analyzed/available counts,
  excluded variant counts and rejected mention count. Never show zero complaints
  as successful analysis when the status is unresolved.
- Counts describe the sampled reviews only; they are not defect rates or verified
  safety conclusions. Unknown-variant listing-wide insights are excluded rather
  than presented as exact-SKU summaries.

## Verification

The evidence package shares `services/luna-api/pyproject.toml`, `uv.lock` and the root
`Makefile` with the rest of the API. Use that locked environment rather than a separate
dependency installation; `pyproject.toml` already adds the repository root to pytest's and
mypy's import paths.

The installed SDK's strict schema serialization and parser were exercised with a
mock HTTP transport. These checks do not prove real evidence extraction.

Offline reproduction from the repository root:

```bash
make api-sync
make api-test
make eval
```

Separate real-API pathways, requiring a server-side key and available model access:

```bash
PYTHONPATH=services/luna-api:. services/luna-api/.venv/bin/python services/luna-api/tests/evidence/live_smoke.py --live
PYTHONPATH=services/luna-api:. services/luna-api/.venv/bin/python -m eval.run --live --output eval/live-results.json
```

The combined evaluation includes the smoke test. For the current fixtures its
preflight is six smoke requests, eighteen grounded requests and twelve free-form
baseline requests, capped at 36 total with no retries. Run the combined command
alone under that allowance; the standalone smoke is an alternative six-request
diagnostic. The CLI loads the ignored root `.env` and stores only measured results.
See root `eval/README.md` for conditions and failure behavior.

The live pathway is never run by ordinary pytest. B2 wraps/stores
`ComparisonEvidence` and B3 supplies comparison chat. A's extraction verification
does not establish the browser flow, second-host portability or deployment.
The approved 31 October live run completed all 36 requests and passed the
strengthened smoke. `eval/live-results.json` contains the actual predictions,
sources, counts, tokens and timings; `eval/README.md` explains the measured
limitations, including neutral review omissions and free-form unit formatting.
Fixture access on the pushed branch is the A1 handoff; no direct messages to
teammates or unverified B/C compatibility claims were made.

Official Structured Outputs reference checked for this implementation:
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
