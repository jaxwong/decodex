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

## A4 held-out scorer, actual baseline execution and integration documentation

- Codex implemented `eval/{baselines,metrics,run}.py`, evaluation documentation,
  independent source-support labels, scorer tests and an explicitly invoked live
  smoke script. Labels are loaded only after inference; no labels are sent to the
  model. Sources and labels are fabricated together, not independently human-rated.
- Actual execution:
  `PYTHONPATH=services/luna-api:. /tmp/luna-evidence-venv/bin/python -m eval.run`
  generated `eval/results.json` for 12 exact SKUs, 96 field cells, 54 source reviews.
  Regex baseline: supported-field accuracy **55/88 (62.5%)**, evidence precision
  **56/92 (60.87%)**, unsupported claims **36/92 (39.13%)**, missing recall **4/4**,
  contradiction recall **0/4**, variant leakage **9/12**. Keyword baseline review
  precision **51/54 (94.44%)**, recall **51/51**. Explicit ID preservation **12/12**
  is not product-recognition accuracy. Baseline elapsed corpus time is observed in
  the artifact, not a model latency measurement.
- Grounded real-model, ungrounded free-form, B's agent, real token/cost and model
  latency measurements remain explicitly unavailable. The fake client is used for
  deterministic correctness tests only, never reported as an evaluated model.
- `PYTHONPATH=services/luna-api /tmp/luna-evidence-venv/bin/python services/luna-api/tests/evidence/live_smoke.py --live`
  exited **2**: `OPENAI_API_KEY missing: live smoke not executed.` No API request
  was made. Server credentials/project access are needed to complete this check.
- Final targeted suite at this milestone:
  `PYTHONPATH=services/luna-api:. /tmp/luna-evidence-venv/bin/python -m pytest services/luna-api/tests/evidence -q`
  → **87 passed**. Includes actual installed SDK JSON-schema serialization and
  response parsing over mock HTTP transport; all network calls remain offline.
- Codex review found and corrected a quote-truncation risk: normalization now
  checks the full original source clause, preventing an excerpt from cutting away
  sibling qualifications. Added a regression test. Catalog summaries now omit raw
  claims and expose public card metadata; complete sources stay server-side.
- Integration instructions and known limits are recorded in A-owned
  `app/evidence/README.md`. B must supply dependency configuration, API/session
  composition and agent outputs; C must render the wrapper and verify both hosts.
  Whole-app tests, browser E2E and deployment were not run on this A-only branch.
- Human corrections: none provided. Human review and B/C integration remain pending.

## A2 review against the shared API gate — 31 October 2026

- Human correction: the user relayed a colleague's formatting/Makefile concern.
  Review found that A's original pytest-only verification did not include B's
  formatting, lint and strict typing gates. Continued on local branch
  `fix/luna-a2-quality-gate` from merged commit `3ba5777`.
- Installed the existing locked dependencies with
  `UV_CACHE_DIR=/tmp/decodex-uv-cache make api-sync` (exit 0). The first sandboxed
  attempt failed on package-host DNS; the approved network retry succeeded.
  Dependency versions and lockfiles were not changed.
- Initial actual results: `make api-test` stopped at formatting (20 files needed
  formatting); `make api-lint` reported 113 errors; `make api-typecheck` reported
  219 errors in 14 files; `make api-unit` failed collection because the root
  `eval` package was outside the service's import path. Each Make invocation
  exited 2. Existing focused A1/A2 behavior passed: 61 tests, exit 0.
- Codex applied the project's existing Ruff conventions to A-owned code and
  examples, removed unused imports, added function/collection annotations, made
  optional provider results explicit in tests, and used the actual SDK client
  type. Deliberately malformed test responses remain explicit boundary tests.
  No assertions or checks were disabled. JSON-shaped dictionaries remain flexible
  at the documented provider/model boundary.
- Validation semantics, field names/defaults and the public evidence-builder
  behavior are preserved. A1's generated Pydantic JSON schema was captured before
  edits and compared afterward: identical. The frozen JSON fixture is unchanged.
- Actual combined verification from the repository root:

  ```text
  PYTHONPATH="$PWD" MYPYPATH="$PWD" UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
  35 files already formatted
  All checks passed!
  Success: no issues found in 33 source files
  101 passed in 0.79s
  exit 0
  ```

- The environment overrides above are temporary diagnostics, not proof that
  plain `make api-test` passes. Proposed B-owned configuration changes: pytest
  `pythonpath = [".", "../.."]`; mypy
  `mypy_path = ["$MYPY_CONFIG_FILE_DIR/../.."]`. User approval was requested because
  the specification assigns that configuration to Developer B.
- Additional A-owned eval formatting and lint checks passed with the service's
  Ruff configuration. No evaluation artifact was regenerated, live model request
  made, teammate message sent, deployment performed, or PR opened in this review.

## Follow-up PR and B2 integration verification — 31 October 2026

- Human decision: leave B-owned configuration for the colleague. No A-authored
  change was made to `pyproject.toml`, `uv.lock` or `Makefile`.
- Human correction: local commit `2bacf6f` had not been pushed or opened as a PR.
  The user requested the missing review handoff. Original evidence PR #3 was
  already merged; this follow-up contains only quality/integration corrections.
- Fetched origin and merged main at `18f0009`, preserving B2 and C's existing
  commits. B had already added pytest's root import path. B2's new `tests` package
  required explicit `tests.evidence` imports; added the A-owned package marker
  and updated the three test consumers, preserving their assertions.
- Actual latest-main verification:

  ```text
  MYPYPATH="$PWD" UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
  49 files already formatted
  All checks passed!
  Success: no issues found in 47 source files
  119 passed in 0.76s
  exit 0

  UV_CACHE_DIR=/tmp/decodex-uv-cache make api-typecheck
  Found 2 errors in 1 file (checked 47 source files)
  make: *** [api-typecheck] Error 1
  exit 2
  ```

- The two remaining diagnostics are `eval.metrics` and `eval.run` import lookup
  in `tests/evidence/test_evaluation.py`. B's proposed remaining configuration is
  `mypy_path = ["$MYPY_CONFIG_FILE_DIR/../.."]`; it was left untouched as requested.
  The passing command uses an explicit temporary environment override, not a
  disabled rule. Plain `make api-test` remains blocked at this mypy check.
- No real model calls, new evaluation results, browser E2E or deployment were
  performed. Existing fixture, dependency lock and evidence wire schema remain
  unchanged. PR description must distinguish these limits from passing tests.

## Approved live evidence validation and A4 comparison — 31 October 2026

- Human approval: strengthen A2/A3 live checks, run grounded and free-form
  benchmarks within 36 paid requests, and finish with a tested PR. Human supplied
  server credentials; they were placed in ignored local `.env` with mode 0600.
  No credential value is recorded in code, artifacts or this log. B-owned project
  configuration remains untouched, following the user's earlier decision.
- Started `feat/luna-live-evidence-evaluation` from main `35c33e2` (B3 included).
  Plain `make api-test` reproduced the known root `eval` mypy lookup failure;
  temporary `MYPYPATH` verification remained explicit.
- Codex strengthened smoke acceptance checks in `eval/smoke.py` and the standalone
  evidence smoke entry point. They check exact selections, 100W isolation, 420g
  normalization with original quote, missing weight, warranty alternatives, exact
  review coverage/aspects and canonical provenance/aggregation invariants.
- `eval/live.py` adds a pre-transport request ceiling and a plain-text Responses
  specification baseline. Both model paths get identical seller evidence; the
  free-form baseline permits knowledge inference and model unit conversion but
  receives no Structured Outputs, tools, provenance repair or automatic retry.
  `eval/run.py` preflights the fixed fixture, runs smoke first, stops on smoke
  failure, retains partial statuses and reports usage coverage rather than guessed
  token/cost values. Ground-truth labels are loaded only after inference finishes.
- OpenAI Docs skill: fetched the official Structured Outputs guide and inspected
  installed SDK 3.42.0 signatures for `responses.parse` and `responses.create`.
  Reference: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
  Kept the approved `gpt-6-luna` model; recorded returned model names separately.
- New offline SDK-transport tests cover prescribed smoke failures, the 36-call
  plan/ceiling, six-call early stop, partial extraction, malformed/incomplete
  free-form output, missing usage, identical input sources and labels loaded only
  after all inference. They write no benchmark artifact and make no real API call.
- Actual offline gate before the live run:

  ```text
  MYPYPATH="$PWD" UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
  52 files already formatted
  All checks passed!
  Success: no issues found in 50 source files
  142 passed in 0.85s
  exit 0
  ```

- Actual deterministic evaluation regenerated `eval/results.json` with unchanged
  regex/keyword scores. Actual paid execution:

  ```text
  PYTHONPATH=services/luna-api:. services/luna-api/.venv/bin/python -m eval.run --live --output eval/live-results.json
  status=completed; smoke=passed
  attempted_requests=36 (6 smoke + 18 grounded + 12 free-form)
  configured_model=gpt-6-luna; returned_models=[gpt-6-luna]
  exit 0
  ```

- `eval/live-results.json` contains real predictions/source graphs, raw free-form
  outputs, source hashes, SDK/model identity, timings, coverage and usage. Both
  canonical evidence graphs and all source hashes were revalidated offline.
  Grounded: supported fields 88/88; evidence precision 96/96; unsupported supported
  claims 0/88; missing recall 4/4; normalized conflict recall 4/4; variant leakage
  0/12; review precision 49/49 and recall 49/51.
- Free-form: supported fields 88/88 and leakage 0/12 also matched the fixtures.
  Exact normalized conflict recall 2/4 and evidence precision 92/96 were reduced
  by `12 months`/`24 months` strings instead of canonical `12`/`24` in two cells.
  All four conflicts were semantically recognized; no claim of missed semantic
  conflicts is made. No post-hoc parser/prompt tuning or paid rerun was performed.
- Grounded omissions were two `other/neutral` case-colour mentions, `listingB-r13`
  and `listingC-r13`. No emitted mention failed literal-quote validation.
- Three grounded comparison timings: 10.051s, 8.481s, 9.817s (p50 9.817s;
  nearest-rank p95 10.051s for three samples only). Model-reported tokens: smoke
  11,435; grounded 32,827; free-form 22,778; total 67,040, complete usage coverage.
  Costs remain unavailable. Workloads/scheduling differ; this is no production
  p95, matched latency/cost comparison, human study or real shopping evaluation.
- Fixtures and labels remain synthetic and were authored together. B's agent
  output evaluation, C's browser/second-host proof and deployment remain outside
  this A-owned run. No additional paid calls are authorized by this completed run.

- Before publishing, merged latest main `8068646`, including B4 and C's existing
  changes, without editing their implementations. Final offline verification:

  ```text
  MYPYPATH="$PWD" UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
  55 files already formatted
  All checks passed!
  Success: no issues found in 53 source files
  150 passed in 1.36s
  exit 0
  ```

- Plain `make api-typecheck` still exits 2: missing root `eval` imports produce
  eight diagnostics, including a propagated untyped return in the standalone
  smoke entry point. All disappear with the root `MYPYPATH` override. The same
  B-owned `mypy_path = ["$MYPY_CONFIG_FILE_DIR/../.."]` configuration remains
  pending. No rule was suppressed and no B-owned configuration was changed.
- Final source/artifact audit: changed paths are A-owned; the fixture, canonical
  evidence contract and data sources are unchanged; both live canonical graphs
  validate; source hashes match; no secret value is present in candidate files.
