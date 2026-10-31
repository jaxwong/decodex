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

## B4: GPT-Live delegation and server-side tool relay — 31 October 2026

**Outcome:** Added an authenticated comparison-bound GPT-Live session endpoint and the single server-side sideband executor. Live Responses delegation reuses B3's exact four strict schemas and `execute_luna_tool`; preference changes commit to the same comparison state before the tool result resumes spoken reasoning.

**Ownership and limits:**

- B owns Live session creation, concise server-composed UI context, sideband attachment, tool execution, and revision-safe mutation. C owns `RTCPeerConnection`, microphone/audio, captions, mute/stop, and polling the existing comparison route.
- One start operation performs at most one Live create call and one sideband attach with `max_retries=0`. A failed call has no alternate model, transport, or executor.
- One delegation permits at most three sequential tool calls because `parallel_tool_calls=false`. Raw argument deltas never execute; completed call IDs execute once.
- `apply_preferences` may run once per delegation. On success the relay commits state, refreshes the delegated tool schema/UI context to the new revision, sends the matching function output, and sends one `response.create` continuation.
- Expected invalid tool arguments and stale revisions return structured, non-retryable tool results. Provider/protocol failures terminate the relay and are logged once; no partial result is treated as durable before state commit.

**Files changed:**

- `services/luna-api/app/openai/live_agent.py`
- `services/luna-api/app/openai/text_agent.py`
- `services/luna-api/app/contracts/session.py`
- `services/luna-api/app/decision/sessions.py`
- `services/luna-api/app/routes/comparisons.py`
- `services/luna-api/app/errors.py`
- `services/luna-api/tests/openai/test_live_agent.py`
- `services/luna-api/tests/routes/test_live_sessions.py`
- `services/luna-api/README.md`
- `CHANGELOG.md`

**OpenAI contract verification:** Official current Live delegation, server-side controls, and Live prompting documentation plus installed SDK `3.42.0` confirmed `gpt-live-1`, Responses delegation, `<|SpawnThinking|>`, nested `response.event`, completed function-call items, `response.item.create`, `response.create`, and sideband attachment. Production explicitly overrides the SDK sideband's default retries with `max_retries=0`.

**Automated verification:**

```text
uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff format --check <B4 paths>
8 files already formatted
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff check <B4 paths>
All checks passed!
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen mypy <B4 paths>
Success: no issues found in 8 source files
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q
........................................................................ [ 52%]
................................................................         [100%]
136 passed in 0.63s
exit 0
```

The aggregate root gate still stops at an inherited evaluation import issue after formatting and lint pass:

```text
UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
54 files already formatted
All checks passed!
tests/evidence/test_evaluation.py:7: error: Cannot find implementation or library stub for module named "eval.metrics"
tests/evidence/test_evaluation.py:8: error: Cannot find implementation or library stub for module named "eval.run"
Found 2 errors in 1 file (checked 52 source files)
exit 2
```

**Paid local verification:**

```text
GET /api/health
HTTP 200, health_ok=true

POST /api/demo-sessions
HTTP 201, token_present=true

GET /api/catalog
HTTP 200, catalog_listings=3

POST /api/comparisons
HTTP 201, evidence_items=3, revision=0

POST /api/comparisons/{comparison_id}/live/session
HTTP 201, session_id_present=true, transport_type=webrtc, answer_sdp_present=true
```

This verifies the real provider accepted the delegated session configuration and the API attached its server-side sideband before returning. It does **not** prove microphone audio, a real provider-emitted delegation, spoken output, or the joint visible mutation. Those require C5's browser path, so B4 does not claim the full F5 voice DoD yet.

## B5: API gate, failure-path and latency hardening — 31 October 2026

**Why this block:** The optional screenshot feature is gated on G2–G4. G4 has no real C5 microphone → delegated tool → visible revision proof, so starting screenshot matching would violate the spec's cut rule. Root deployment/E2E work is also blocked because `minimal-host` and its build/test commands do not exist. B therefore took the specified fallback: harden tests and latency without blocking another developer.

**Outcome:** Plain `make api-test` now passes without a temporary import-path environment override. Live tests cover provider creation failure, concurrent stale correction and protocol failure. Existing text-turn and Live-create success logs now include actual external-call counts and monotonic elapsed milliseconds; no queue, metrics store, API field or configurable timing knob was added.

**Ownership and limits:**

- `services/luna-api/pyproject.toml` remains the only Python tool configuration owner. Its mypy path now matches pytest's already-configured repository-root path; no import was ignored and strict mode remains enabled.
- A failed Live create makes one attempt, never attaches a sideband and leaves no session-owned task. A concurrent winning revision is preserved; the stale call receives a structured non-retryable result. A provider protocol error closes the one sideband without fallback.
- Text logs report `provider_calls=tool_rounds+1` with the existing four-call ceiling. Live creation reports its fixed create-plus-attach count of two. Wall time is observed at the owning boundary and is not presented as an accuracy, cost or production-SLO claim.

**Files changed:**

- `services/luna-api/pyproject.toml`
- `services/luna-api/app/openai/text_agent.py`
- `services/luna-api/app/openai/live_agent.py`
- `services/luna-api/tests/openai/test_text_agent.py`
- `services/luna-api/tests/openai/test_live_agent.py`
- `services/luna-api/README.md`
- `CHANGELOG.md`
- `docs/codex-build-log/B.md`

**Red-to-green verification:**

```text
UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
54 files already formatted
All checks passed!
tests/evidence/test_evaluation.py:7: error: Cannot find implementation or library stub for module named "eval.metrics"
tests/evidence/test_evaluation.py:8: error: Cannot find implementation or library stub for module named "eval.run"
Found 2 errors in 1 file (checked 52 source files)
exit 2

UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
54 files already formatted
All checks passed!
Success: no issues found in 52 source files
........................................................................ [ 51%]
...................................................................      [100%]
139 passed in 0.70s
exit 0
```

**Focused verification:**

```text
uv run --frozen ruff format --check app/openai/text_agent.py app/openai/live_agent.py tests/openai/test_text_agent.py tests/openai/test_live_agent.py
4 files already formatted
uv run --frozen ruff check app/openai/text_agent.py app/openai/live_agent.py tests/openai/test_text_agent.py tests/openai/test_live_agent.py
All checks passed!
uv run --frozen mypy app/openai/text_agent.py app/openai/live_agent.py tests/openai/test_text_agent.py tests/openai/test_live_agent.py
Success: no issues found in 4 source files
uv run --frozen pytest -q tests/openai/test_text_agent.py tests/openai/test_live_agent.py
15 passed in 0.31s
exit 0
```

No paid provider call, browser E2E, screenshot feature or deployment was run in B5. Those are unnecessary for this deterministic hardening block or remain gated as described above.

## B6: bounded decision-agent evaluation and system documentation — 31 October 2026

**Outcome:** Added a fixed synthetic benchmark that exercises the production Responses agent,
same four decision tools and canonical comparison state. Added `make eval`, recorded one paid
run without retry, and documented the current architecture, invariants, decisions and
plain-language product flow. The documentation states that the backend exists but Host A is not
connected; this branch does not claim browser E2E.

**Ownership and limits:**

- `eval/agent.py` owns the twelve fixed utterances and one `eval/agent-results.json` artifact.
  The stale-turn scenario makes zero model calls; the other eleven allow at most four each, so
  the complete benchmark has a 44-request ceiling.
- The paid CLI is the only writer of agent measurements. Tests inject concrete SDK response
  objects and cannot write a measured artifact. `eval.run` only hash-validates and projects an
  existing artifact.
- SDK retries, repair passes and alternate models are disabled. A partial run remains partial.
- This branch does not change React. `shopee-compare-app/src/compare/engine.js` still calls
  OpenAI directly and `src/luna/LunaWidget.jsx` still says API integration is pending. Deleting
  that superseded path and wiring Host A to `/api` remains C3.

**Files changed:**

- `eval/agent.py`
- `eval/live.py`
- `eval/run.py`
- `eval/agent-results.json`
- `eval/results.json`
- `eval/README.md`
- `services/luna-api/tests/openai/test_agent_evaluation.py`
- `services/luna-api/tests/evidence/test_live_evaluation.py`
- `Makefile`
- `docs/{architecture,invariants,decisions,user-stories}.md`
- `CHANGELOG.md`
- `docs/codex-build-log/B.md`

**Paid evaluation:**

```text
cd services/luna-api
PYTHONPATH=../.. uv run --frozen python -m eval.agent --live
status=partial
attempted_requests=28
request_limit=44
scenario_success=10/12
tool_success=11/11
ui_outcome_success=12/12
citation_behavior_success=4/5
state_correction_success=1/1
stale_turn_protection=1/1
exit 2
```

The review-query output used unsupported citation IDs, so the production citation boundary
returned the conservative unverified answer. The review-reliability scenario mutated once and
correctly kept the recommendation empty, then attempted a disallowed third tool and received
`LunaToolCallRejected`. Neither scenario was retried or repaired.

**Final deterministic verification:**

```text
UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
56 files already formatted
All checks passed!
Success: no issues found in 54 source files
156 passed in 0.97s
exit 0

UV_CACHE_DIR=/tmp/decodex-uv-cache make eval
agent=true
exit 0

git diff --check -- docs/architecture.md docs/invariants.md docs/decisions.md docs/user-stories.md
exit 0
```

No paid provider call was made by either final verification command. Browser E2E, real
microphone input, Host B, Docker and deployment remain unverified because their C-owned inputs
do not exist.

## B7: terminal mutation and current evaluation ownership — 31 October 2026

**Outcome:** Made a successful text preference mutation the last possible tool action, clarified
the review citation identifier at the model boundary, and preserved committed revision context
for invalid post-mutation output. Bound agent measurements to the evaluated text-agent source so
the pre-B7 paid artifact cannot be presented as current.

**Ownership and limits:**

- Text `apply_preferences` remains the same sole mutation. Its continuation retains the same
  tool definitions for prompt caching but sets `tool_choice: "none"`; an impossible provider
  function call is rejected before execution.
- Live still uses the same tool schemas and executor. B7 does not change its multi-round
  sideband protocol; only the text-turn continuation becomes terminal.
- The citation allowlist is unchanged. Prompt and tool text now say that review claims cite a
  review mention ID, never the related review ID.
- The B6 paid artifact is not deleted, rewritten or claimed as B7 evidence. `make eval` reports
  it unavailable after the implementation hash changes. No paid rerun occurred.

**Files changed:**

- `services/luna-api/app/openai/text_agent.py`
- `services/luna-api/app/errors.py`
- `services/luna-api/tests/openai/test_text_agent.py`
- `services/luna-api/tests/routes/test_comparisons.py`
- `services/luna-api/tests/evidence/test_evaluation.py`
- `services/luna-api/tests/openai/test_agent_evaluation.py`
- `eval/agent.py`
- `eval/run.py`
- `eval/results.json`
- `eval/README.md`
- `docs/{architecture,invariants,decisions}.md`
- `CHANGELOG.md`
- `docs/codex-build-log/B.md`

**Red-to-green verification:**

```text
pytest -q tests/openai/test_text_agent.py::test_agent_executes_one_mutation_and_returns_only_valid_citations tests/openai/test_text_agent.py::test_agent_rejects_provider_tool_call_after_terminal_mutation tests/routes/test_comparisons.py::test_invalid_answer_after_update_returns_committed_revision
3 failed in 0.43s
exit 1

pytest -q tests/openai/test_text_agent.py::test_agent_executes_one_mutation_and_returns_only_valid_citations tests/openai/test_text_agent.py::test_agent_rejects_provider_tool_call_after_terminal_mutation tests/routes/test_comparisons.py::test_invalid_answer_after_update_returns_committed_revision
3 passed in 0.48s
exit 0

pytest -q tests/openai/test_text_agent.py tests/routes/test_comparisons.py
18 passed in 0.37s
exit 0

pytest -q tests/evidence/test_evaluation.py tests/openai/test_agent_evaluation.py
11 passed in 0.52s
exit 0
```

**Final deterministic verification:**

```text
UV_CACHE_DIR=/tmp/decodex-uv-cache make api-test
56 files already formatted
All checks passed!
Success: no issues found in 54 source files
159 passed in 0.96s
exit 0

UV_CACHE_DIR=/tmp/decodex-uv-cache make eval
agent=false
exit 0
```

No paid provider call, browser E2E, Live microphone flow, Host B, Docker or deployment was run.
The existing `eval/agent-results.json` remains the unmodified B6 historical measurement.
