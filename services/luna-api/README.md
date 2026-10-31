# Luna API — Developer B phases B1–B5

The service owns the API shell, authenticated demo sessions, canonical comparison state, deterministic ranking, four decision tools, bounded Responses chat, the GPT-Live server sideband, and OpenAI capability checks. A owns immutable marketplace evidence and C owns its frontend projection and WebRTC media.

## Ownership boundary

| Owner | Owns here | Integrates through |
| --- | --- | --- |
| Developer B | `pyproject.toml`, `uv.lock`, app composition, routes, demo sessions, decision state, and `app/openai/*` | The HTTP/OpenAPI surface and A's public evidence contract |
| Developer A | Evidence contracts, providers, evidence building, and evidence tests | The immutable evidence contract; never B's session store or OpenAI decision calls |
| Developer C | React hosts, widget, and browser tests | The HTTP/OpenAPI surface; never Python state or API keys |

Developer B is the only dependency-lock owner. A new Python dependency is requested from B rather than added through a second project or lockfile.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Demo session | An opaque, process-local token and server-owned expiry; not an OpenAI Live session. |
| Conversation | Bounded successful text turns bound to one comparison in one demo session; not an OpenAI Conversation resource. |
| Capability check | A bounded developer command that verifies project access; not runtime application behavior. |
| Live session | An OpenAI audio session created from a WebRTC offer; not app-owned comparison state. |

## Run locally

From the repository root:

```bash
make api-sync
set -a
. ./.env
set +a
make api-dev
curl --fail http://127.0.0.1:8000/api/health
curl --fail -X POST http://127.0.0.1:8000/api/demo-sessions
```

Copy the issued token into a shell variable before calling protected routes:

```bash
export LUNA_DEMO_TOKEN='<token from POST /api/demo-sessions>'
curl --fail -H "Authorization: Bearer $LUNA_DEMO_TOKEN" \
  http://127.0.0.1:8000/api/catalog
curl --fail -X POST \
  -H "Authorization: Bearer $LUNA_DEMO_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"listing_id":"listingA","variant_id":"100w"},{"listing_id":"listingB","variant_id":"65w"},{"listing_id":"listingC","variant_id":"87w"}]}' \
  http://127.0.0.1:8000/api/comparisons
```

Comparison creation calls A's evidence builder exactly once. Runtime has no fixture fallback; the frozen fixture builder exists only under `tests/`.

Copy the returned `comparison_id` and current `revision`, then ask Luna:

```bash
export LUNA_COMPARISON_ID='<comparison_id from POST /api/comparisons>'
curl --fail -X POST \
  -H "Authorization: Bearer $LUNA_DEMO_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"conversation_id":"demo","message":"Under S$80 and at least 65W; prioritize portability.","expected_revision":0}' \
  "http://127.0.0.1:8000/api/comparisons/$LUNA_COMPARISON_ID/ask"
```

One text turn makes at most four Responses calls: the initial request plus continuations for at most three tool rounds. SDK retries and parallel tool calls are disabled. Luna can mutate state only through `apply_preferences`; a timeout after that mutation returns the saved revision and tells the client not to repeat the request.

On successful completion, the text boundary logs the request/comparison IDs, saved revision, tool rounds, actual provider-call count, action/citation counts, monotonic elapsed milliseconds, and the four-call ceiling. Logs are an operational projection, never comparison state.

## Seller listing gap report

The read-only seller projection reuses the same session state and evidence without a model call:

```bash
curl --fail -H "Authorization: Bearer $LUNA_DEMO_TOKEN" \
  http://127.0.0.1:8000/api/listings/listingC/gap-report
```

The response contains current-session comparison count, unsupported fields, competitors with
supported values, exclusion-reason counts and uncertainty-field counts. It never contains a
buyer identity, conversation, budget or preference. One request makes at most one catalog
lookup, then reads at most the server-owned ceiling of ten comparisons with four items each.
There is no model call, retry, cross-session aggregation or retained report state.

## GPT-Live server boundary

The C-owned browser creates an audio-plus-data WebRTC offer and posts its SDP to:

```text
POST /api/comparisons/{comparison_id}/live/session
Authorization: Bearer <demo token>
Content-Type: application/json

{"sdp":"<browser RTCPeerConnection offer SDP>"}
```

The response contains only the unchanged provider `session.id`, transport type, and answer SDP. B creates at most one provider session and attaches exactly one server-authenticated sideband, both without retries. The sideband is the only tool executor; the browser owns microphone capture, audio playback, captions, mute/stop controls, and comparison polling.

Successful Live creation logs the session/comparison IDs, revision, its fixed two external calls, elapsed milliseconds, and zero attach retries. It does not log SDP, credentials, or marketplace source text.

Each Responses delegation executes only completed function-call items, deduplicates call IDs, permits at most three sequential tool rounds, and sends one continuation after each result. A successful `apply_preferences` is committed before its function output and refreshes the Live tool schema to the new comparison revision. No raw marketplace page text is placed in Live UI context.

The API can verify session creation and sideband attachment without C, but genuine microphone input, spoken output, and a provider-driven tool mutation require C's browser WebRTC path. Do not claim the full voice feature until that joint check passes.

## Decision tools

B2 exposes exactly four Python tool functions for B3 text and B4 Live delegation:

- `get_comparison` returns compact normalized facts without raw source text.
- `get_review_aspect` returns bounded aggregates and literal supporting mentions.
- `apply_preferences` is the only mutation; it enforces optimistic revision checks.
- `inspect_evidence` returns exact sources only for stored evidence IDs.

Ranking applies budget and minimum-power constraints before lexicographic objective priorities.
Budget checks and the `price_minor` priority both use the contract-validated delivered total:
list price minus the listed shop voucher plus listed shipping. Missing facts remain uncertain,
review reliability is not converted into a score, and absent criteria produce no invented winner.
Ranking also retains server-only exclusion reasons and uncertain field names for the seller report.
Those fields are structurally excluded from existing comparison API and agent serialization.

## Verify

```bash
make api-test
```

The B-owned B2–B5 behavior subset is independently runnable without network or API credits:

```bash
cd services/luna-api
uv run --frozen pytest -q tests/decision tests/routes tests/openai
```

## OpenAI capability smoke

The command makes at most two provider calls and never retries: one forced strict Responses function call and one GPT-Live create-session request with a locally generated audio-plus-data WebRTC offer. It writes no API key, provider response ID, or SDP to the report.

```bash
make api-capability-smoke
```

`.env` owns the API key and both model names; `.env.example` documents the required variables. Without a key, the command makes no external call, writes an explicit blocked result to `../../docs/capability-smoke.json`, and exits `2`. Missing or blank model configuration exits `2` without writing a misleading report.
