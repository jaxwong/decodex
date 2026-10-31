# Developer B — Codex build log

## B1: capability smoke tests and API shell — 31 October 2026

**Outcome:** Added the B-owned FastAPI shell, application-owned demo-session store, official OpenAI SDK capability runner, tests, dependency lock, and developer commands. Both required OpenAI capabilities passed against the configured project.

**Files changed:**

- `services/luna-api/app/main.py`
- `services/luna-api/pyproject.toml`
- `services/luna-api/app/contracts/session.py`
- `services/luna-api/app/decision/sessions.py`
- `services/luna-api/app/routes/health.py`
- `services/luna-api/app/routes/demo_sessions.py`
- `services/luna-api/app/openai/capability_smoke.py`
- `services/luna-api/tests/**`
- `services/luna-api/pyproject.toml`
- `services/luna-api/uv.lock`
- `services/luna-api/README.md`
- `.env.example`
- `docs/capability-smoke.json`

**Human/Codex corrections:**

- Replaced an unusable console-script entry point after confirming this is a bare service project; the documented smoke command now runs the Python module directly.
- Replaced the placeholder Live SDP after the API rejected it with `Offer did not have an audio media section`. The generated offer now always contains an Opus audio section and bundled WebRTC data channel.
- Kept demo-session expiry server-owned at one hour and ensured expired/unknown failures never include the token value.
- Disabled OpenAI SDK retries and structurally capped the smoke operation at two independent external calls; neither check is a fallback for the other.
- Removed test-only client protocols, the output-path option, model-name defaults, broad exception handling, and silent response-field defaults. The installed SDK type, fixed report path, required environment values, and typed provider/contract failures now each have one owner.
- Recorded a missing `OPENAI_API_KEY` as a blocker without an external call. Missing model configuration fails before a report can misidentify the models tested.

**Verification:**

```text
uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q
..............                                                           [100%]
14 passed in 0.37s
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff check .
All checks passed!
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff format --check .
15 files already formatted
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen mypy
Success: no issues found in 14 source files
exit 0

GET /api/health
200 {"ok":true}

POST /api/demo-sessions
201 {"token":"<redacted>","expires_at":"<one-hour UTC expiry>"}

set -a
source ../../.env
set +a
uv --cache-dir /tmp/decodex-uv-cache run --frozen python -m app.openai.capability_smoke
overall_status=passed
responses_function_call=passed (gpt-6-luna)
gpt_live_session=passed (gpt-live-1)
max_external_calls=2
exit 0
```

## B infrastructure: API Make targets — 31 October 2026

**Outcome:** Added a root Makefile with runnable B-owned targets for API dependency sync, formatting, linting, type checking, unit tests, local development and the bounded OpenAI capability smoke.

**Files changed:**

- `Makefile`
- `services/luna-api/README.md`
- `docs/codex-build-log/B.md`

**Boundary:** The default `make` target runs the complete API gate. Aggregate `test`, `e2e` and `demo` targets are not defined yet because the root npm workspace, browser-test command and local orchestration script do not exist. B will add those targets only after C publishes their real command names; the Makefile does not silently skip missing frontend work.

**Verification:**

```text
UV_CACHE_DIR=/tmp/decodex-uv-cache make api-sync
Checked 40 packages in 6ms
exit 0

UV_CACHE_DIR=/tmp/decodex-uv-cache make
15 files already formatted
All checks passed!
Success: no issues found in 14 source files
14 passed in 0.37s
exit 0

make --dry-run api-dev
exit 0

make --dry-run api-capability-smoke
exit 0
```

## B2: deterministic sessions and four decision tools — 31 October 2026

**Outcome:** Added session-owned comparison state over A's frozen `ComparisonEvidence`, authenticated catalog/create/get routes, deterministic hard filtering and lexicographic ranking, exactly four decision tools, stable HTTP errors and optimistic revision conflicts. B2 tests make zero model calls and use A's frozen fixture only from the test tree.

**Ownership and limits:**

- One `DemoSessionState` owns its comparison responses; another session receives the same not-found response as an unknown ID.
- `apply_preferences` is the only mutation and commits one revision after validating `expected_revision`.
- Comparison creation calls the injected A evidence builder exactly once; runtime has no fixture or alternate fallback.
- Ranking never scores missing facts or review reliability, never retries and does not force a winner without an objective priority.
- B did not modify A-owned evidence/provider files after the merged baseline exposed their formatting, lint, typing and test-collection failures.

**Files changed:**

- `CHANGELOG.md`
- `services/luna-api/app/contracts/session.py`
- `services/luna-api/app/decision/{sessions,comparisons,ranking,tools}.py`
- `services/luna-api/app/errors.py`
- `services/luna-api/app/routes/{session_auth,catalog,comparisons}.py`
- `services/luna-api/app/main.py`
- `services/luna-api/tests/decision/**`
- `services/luna-api/tests/routes/test_comparisons.py`
- `services/luna-api/README.md`
- `docs/codex-build-log/B.md`

**B-owned verification:**

```text
uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff format --check <B2 paths>
18 files already formatted
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff check <B2 paths>
All checks passed!
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q tests/decision tests/routes tests/openai
................................                                         [100%]
32 passed in 0.46s
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q
........................................................................ [ 60%]
...............................................                          [100%]
119 passed in 0.63s
exit 0

POST /api/demo-sessions
HTTP 201, token length 43, one-hour UTC expiry

GET /api/catalog without token
HTTP 401 SESSION_REQUIRED

GET /api/catalog with bearer token
HTTP 200, 3 listings, 12 exact variants
```

**Merged baseline defects outside B ownership:**

```text
make
20 A-owned files would be reformatted
exit 2

uv run --frozen mypy <B2 paths>
MYPY_RAW_EXIT=1
MYPY_ALL_ERRORS=39
MYPY_B2_ERRORS=0
All 39 errors are in 9 imported A-owned evidence/provider files.
exit 1
```

The initial full pytest collection error for root `eval` imports was B-owned configuration, not an A defect. Adding the repository root to pytest's configured Python path made the unchanged evaluation tests pass (`7 passed`) and restored full-suite collection.

## B3: bounded Responses text agent — 31 October 2026

**Outcome:** Added authenticated comparison chat over `gpt-6-luna`. One session owner retains bounded successful text history; the Responses loop exposes only B2's four strict tools, validates all arguments and citations, and returns only server-computed recommendation/UI state. The route never exposes provider IDs, reasoning, tool internals, or credentials.

**Limits and failure behavior:**

- One turn executes at most three tool rounds and four provider calls. The SDK uses `max_retries=0`; a failed call never selects another model or strategy.
- `parallel_tool_calls=false` structurally permits zero or one function call per round. `apply_preferences` may execute only once per turn.
- The generated tool schema fixes both `comparison_id` and `expected_revision` to authorized values. Python validates them again before executing B2 functions.
- Unsupported citation IDs are replaced with a conservative answer. A late concurrent revision is rejected rather than returned to C.
- A timeout after mutation preserves the saved comparison and returns `LUNA_TIMEOUT_AFTER_UPDATE`, `retryable=false`, and the new revision. Repeating the stale request is rejected before a provider call.

**Files changed:**

- `services/luna-api/app/openai/text_agent.py`
- `services/luna-api/app/contracts/session.py`
- `services/luna-api/app/decision/sessions.py`
- `services/luna-api/app/routes/comparisons.py`
- `services/luna-api/app/errors.py`
- `services/luna-api/app/main.py`
- `services/luna-api/tests/openai/test_text_agent.py`
- `services/luna-api/tests/routes/test_comparisons.py`
- `services/luna-api/README.md`
- `CHANGELOG.md`

**OpenAI contract verification:** Official OpenAI documentation and installed SDK `3.42.0` confirmed Responses function-call outputs, `previous_response_id`, strict tool schemas, `parallel_tool_calls=false`, structured `text.format`, and `gpt-6-luna` Responses tool support. Tests construct the installed SDK's concrete `Response` types rather than a competing client abstraction.

**Verification:**

```text
uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff format --check <B3 paths>
8 files already formatted
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff check <B3 paths>
All checks passed!
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q tests/openai/test_text_agent.py tests/routes/test_comparisons.py
................                                                         [100%]
16 passed in 0.38s
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q
........................................................................ [ 56%]
........................................................                 [100%]
128 passed in 0.66s
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen mypy <B3 paths>
MYPY_RAW_EXIT=1
MYPY_ALL_ERRORS=39
MYPY_B3_ERRORS=0
All 39 errors are in 9 imported A-owned evidence/provider files.
exit 1
```

**Paid local verification:**

```text
make api-dev
Uvicorn running on http://127.0.0.1:8000

GET /api/health
HTTP 200, health_ok=true

POST /api/demo-sessions
HTTP 201

GET /api/catalog
HTTP 200, catalog_listings=3

POST /api/comparisons
HTTP 201, comparison_items=3, initial_revision=0

POST /api/comparisons/{comparison_id}/ask
HTTP 200, conversation=live-smoke, new_revision=1, cited_ids=4,
recommendation=listingB:65w
```

The local server required the host namespace because the sandbox blocks Uvicorn's reload watcher. The first host-side client command reached comparison creation but the shell expanded `$80` under `set -u` before sending `/ask`; building the request body with `jq` corrected the invocation. No application retry or fallback was added.
