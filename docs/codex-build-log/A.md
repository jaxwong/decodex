# Developer A — Evidence Intelligence

All products, seller claims and reviews in this branch are fabricated. No Shopee
access, human user study, production evaluation or deployed integration is claimed.

## Handoff and A1 contract freeze — 31 October 2026

- Inspected repository, v3.2 specification and code-style guidance. Fetched origin;
  `main` / `origin/main` both pointed at shared handoff `58223d5`. No separate
  integration branch existed. Created `feat/luna-evidence-intelligence` from it.
- Codex implemented the exact seven public contract exports in
  `services/luna-api/app/contracts/evidence.py`, the provider protocol, a complete
  `data/sample_comparison_evidence.json`, and contract-validation tests.
- Contract fields, types, status vocabulary and defaults match section 2.3.
  Validation rejects broken provenance links, wrong variants, unsupported numeric
  assertions and invalid review excerpts. Models prevent field reassignment;
  consumers must also treat nested collections as immutable snapshots.
- Frozen public handoff: `from app.contracts.evidence import ComparisonEvidence`;
  load the fixture with `ComparisonEvidence.model_validate_json(path.read_text())`.
  Selected items use snake_case `listing_id`, `variant_id`, `item_key`,
  `price_minor`, `currency`, `snapshot_version`, `title`, `variant_label`, `synthetic`.
  Schema fields use `field_key`, `label`, `unit`. SGD prices are integer minor units.
- Exact verification from repository root:
  `PYTHONPATH=services/luna-api /tmp/luna-evidence-venv/bin/python -m pytest services/luna-api/tests/evidence/test_contract.py -q`
  → **3 passed**. Isolated temporary environment: Python 3.12.10,
  pydantic 2.14.2, pytest 9.2.0, openai 3.42.0. Shared dependency files are B-owned
  and were not created or changed.
- Human corrections: none supplied during this implementation. Human review of
  this PR and integration with B/C remain pending; no teammate messages were sent.

## A2 catalog provider

- Codex built the async provider, explicit mock-only factory, ID validation,
  content-hashed snapshots, scoped pagination and defensive fixture copies.
- Source files: `data/{listings,reviews,ground_truth}.json`, reproducible generator,
  and `app/providers/{base,mock,__init__}.py`. Three fabricated listings expose
  twelve exact variants; each listing has eighteen source reviews.
- Provider-focused execution:
  `PYTHONPATH=services/luna-api /tmp/luna-evidence-venv/bin/python -m pytest services/luna-api/tests/evidence/test_pipeline.py -q -k provider`
  (full passing result recorded in the following pipeline entry).
- Initial push failed because the system Git helper referred to a missing
  `credential-manager-core`. Retried using the existing authenticated GitHub CLI
  credential helper for that command only; push succeeded. No credential values
  were printed or committed and global Git configuration was not changed.
- Human corrections: none supplied. B/C consumers have not yet been exercised.

## A2/A3 extraction, normalization and review intelligence

- Codex implemented indexing, prompts, typed Responses candidates, deterministic
  normalization, provenance validation, partial-failure handling and public DI in
  `app/evidence/`. The SDK call uses `AsyncOpenAI.responses.parse(text_format=...)`,
  matching the fetched official Structured Outputs guide and installed 3.42.0
  signature. No live SDK success is claimed. Official reference:
  https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- One spec request per selected item, no automatic retry or alternate extractor.
  Numeric source clauses must have recognized field labels and units. Unfamiliar
  prose is retained but abstains instead of becoming an unsupported measurement.
  Explicit seller contradictions are reconciled even if model cites just one side.
- Exact-SKU reviews are sent in balanced batches of at most twenty; unknown/sibling
  variants stay in the source index but never enter exact-SKU mentions or counts.
  Mixed reviews count once for each expressed sentiment, so sentiment totals may
  exceed the number of analyzed reviews. Failed batches do not enter denominators.
- Public boundary: `from app.evidence import build_comparison_evidence,
  evidence_dependencies, EvidenceBuilder`. B may inject dependencies with the
  task-local context manager or bind `EvidenceBuilder(provider, model).build`.
  Returned item metadata includes `analysis_status`, `review_status` and
  `review_coverage`; these keys live inside the contract's prescribed `list[dict]`.
- Actual checks:
  `PYTHONPATH=services/luna-api /tmp/luna-evidence-venv/bin/python -m pytest services/luna-api/tests/evidence -q`
  → **76 passed**; provider subset → **6 passed, 48 deselected**.
- Codex corrected a missing-key failure boundary before verification: SDK
  construction now occurs inside the typed exception handler, so absent credentials
  produce unresolved fields and preserve provider prices rather than crashing.
  This was an automated correction, not a human-supplied correction.
- `OPENAI_API_KEY` is absent from the process environment. No .env file was read,
  credentials requested, or live request attempted. API smoke and real model quality,
  token/cost and latency measurements remain pending.
