# Implementation changelog

This file records implemented Luna milestones. The implementation spec remains the source of truth for planned behavior. The integration lead owns this summary; developer-level evidence stays in `docs/codex-build-log/`.

## 31 October 2026

### Merged into `main`

- **B1 API shell and capability checks — [PR #1](https://github.com/jaxwong/decodex/pull/1):** FastAPI health and demo-session endpoints, locked uv project, bounded Responses function-call smoke, and GPT-Live session smoke. Both OpenAI capabilities passed with retries disabled and at most two provider calls.
- **B-owned API Make targets — [PR #2](https://github.com/jaxwong/decodex/pull/2):** root commands for API sync, formatting, linting, type checking, tests, development server, and the explicit paid capability smoke.
- **A evidence and review intelligence — [PR #3](https://github.com/jaxwong/decodex/pull/3):** frozen evidence contract and synthetic fixtures, mock catalog provider, exact-variant specification extraction, cited review analysis, failure behavior, and executed synthetic evaluation artifacts.
- **B2 deterministic sessions and decision tools — [PR #5](https://github.com/jaxwong/decodex/pull/5):** authenticated comparison state, provider-backed catalog and evidence creation, deterministic ranking, exactly four decision tools, optimistic revisions, and stable HTTP errors.
- **B3 bounded Responses text agent — [PR #7](https://github.com/jaxwong/decodex/pull/7):** authenticated comparison chat over the same four tools, bounded conversation history, revision-safe mutations, evidence-bound answers, and a paid local end-to-end verification.
- **B4 GPT-Live server delegation — [PR #9](https://github.com/jaxwong/decodex/pull/9):** authenticated WebRTC session creation, one no-retry server sideband executor over the same four tools, revision-safe corrections, and paid provider create-and-attach verification. Browser microphone/audio remained C5 work and was not claimed complete.
- **C3 Host A API panel — [PR #14](https://github.com/jaxwong/decodex/pull/14):** demo-session auth, API catalog selection, comparison creation, text ask and canonical-state refresh inside `shopee-compare-app`. This connected panel does not yet replace the legacy browser comparison engine.
- **C3 interactive Luna UI — [PR #19](https://github.com/jaxwong/decodex/pull/19):** recommendation cards, preference chips, evidence view and conversation UI in Host A.

### G3 portability and G4 browser transport — merged in [PR #20](https://github.com/jaxwong/decodex/pull/20)

- Moved Luna browser ownership from Host A's deleted `src/luna` path into one
  `@luna/widget` workspace package; Host A and independent Host B provide separate adapters.
- Added root npm workspaces and one root lockfile. Both production hosts build through
  `make frontend-build`; no host copies widget code or imports another host.
- Added `apps/minimal-host` with a distinct layout, catalog state and navigation behavior.
- Added browser GPT-Live WebRTC controls: microphone track, remote audio, `oai-events`,
  `session.started`, provisional captions, mute, graceful `session.close`/`session.closed`,
  explicit failures and text fallback. The server sideband remains the only tool executor.
- Added `make e2e`: both hosts run the same three-SKU, seller/review citation, revisions
  0→1→2 journey using frozen evidence and an injected SDK-shaped response. Import boundaries,
  successful WebRTC lifecycle and microphone denial are deterministic browser checks.
- Final deterministic gates: **194 API tests passed**, frontend lint passed, Host A transformed
  70 modules, Host B transformed 45 modules, and Playwright reported **5 passed / 1 intentional
  duplicate-project skip**.
- G3 has automated proof. G4 later received one explicitly authorized real run: the Live
  session returned HTTP 201, microphone speech produced captions, canonical state changed from
  revision 0 to 1 and refreshes returned HTTP 200, but no audible response was heard. There was
  no retry, G4 remains failed, and voice is cut from the main demo.
- Added root/package integration READMEs and updated architecture, invariants, decisions, user
  stories and the implementation spec to match the current tree.

### Implemented on `feat/seller-gap-view`

- Added one `SellerGapReport` view to `@luna/widget`; neither host owns a parallel seller
  route, fetch, count or presentation.
- Excluded recommendation cards fetch the existing authenticated gap-report endpoint with the
  widget's bearer token. The view renders server-owned evidence gaps, supported competitors,
  exclusion/uncertainty counts and the required demo-session limitation.
- Conflict actions reuse the existing comparison evidence panel. No second drawer, model call,
  state store, retry or fallback data was added.
- Extended the deterministic SDK-shaped test agent only to recognize the bounded S$70 test
  turn. The same Playwright journey now proves revisions 0→1→2→3 and the seller flow in both
  hosts.
- Verification: **194 API tests passed**, focused frontend ESLint passed, Host A transformed 71
  modules, Host B transformed 46 modules, and Playwright reported **5 passed / 1 intentional
  duplicate-project skip**. These commands made zero provider calls.
- `npm install` restored missing locked local packages and again reported the known 15 audit
  findings (4 moderate, 11 high). No automatic or breaking audit fix was applied.

### Implemented on `feat/host-a-canonical-luna`

- Made `@luna/widget` Host A's sole comparison implementation. `#/Compare` is now a thin host
  route and renders the canonical API catalog immediately; there is no hidden **Ask Luna** gate.
- Removed `CompareProvider` and deleted the complete legacy `src/compare` path: independent
  browser ranking, sample evidence, panels, browser API-key settings and the direct
  `api.openai.com` request. No fallback implementation remains.
- Kept cart quantity, selection, removal and checkout presentation local to the storefront.
  The cart links to Luna but never promotes unverified clone product IDs into trusted evidence;
  buyers choose 2–4 exact backend variants on the comparison page.
- Added a Playwright source-boundary assertion that Host A has no legacy compare directory,
  provider, direct OpenAI request or browser key UI.
- Verification made zero provider calls: focused frontend ESLint passed, both production hosts
  built (Host A 66 modules, Host B 46), all **194 API tests passed**, and Playwright reported
  **7 passed / 1 intentional Host B transport skip**.
- `npm install` reported the known 15 audit findings (4 moderate, 11 high). No automatic or
  breaking audit fix was applied.

### Implemented on `b8-a4-c-unblock`

- Executed the one explicitly authorized current-agent benchmark with no retry: 28/44 provider
  requests, 10/12 scenarios, `partial` status. `review_query` failed citation validation and
  `no_comparable_winner` made a rejected tool call; both failures remain visible.
- Regenerated `eval/results.json` with the free `make eval` projection. It validates the current
  evidence, scenario-suite and text-agent hashes and now reports
  `agent_output_evaluation.available: true`, unblocking A4's honest scorecard.
- Confirmed that C's merged panel has all B routes needed to continue. Remaining replacement of
  the direct browser OpenAI path, review UI, portable widget, Host B, voice controls and
  dual-host E2E are C-owned work; no additional B route is pending.

### Implemented on `b9-seller-gap-report`

- Added structured budget, minimum-output and uncertainty reasons at the deterministic ranking
  owner. Existing item lists are derived from those maps rather than computed independently.
- Added `GET /api/listings/{listing_id}/gap-report`, a read-only projection of evidence gaps,
  supported competitors and current decision reasons within the authorized demo session.
- Seller-only reason maps are required in memory but excluded from existing comparison JSON,
  OpenAPI `Recommendation`, text-agent tool/input JSON and Live context. A4 remains current.
- The report performs one catalog lookup, reads at most ten comparisons with four items each,
  makes zero model calls, retains no new state and never crosses session boundaries.
- Full API gate: formatting and lint passed, strict typing passed, and **181 tests passed**.
- The backend slice was later completed by the shared Host A/Host B seller view and browser
  journey on `feat/seller-gap-view`.

### Implemented on `b5-api-hardening`

- Plain `make api-test` now resolves root `eval.*` modules under strict mypy without an environment override or ignored imports.
- Live hardening covers create failure with no orphaned session, concurrent stale correction without overwrite, and protocol failure with guaranteed sideband close.
- Existing text and Live success-boundary logs now record actual external-call counts and monotonic elapsed milliseconds without adding a second state/metrics owner.
- Full API gate: **54 files formatted, lint passed, 52 sources strictly typed, and 139 tests passed**.
- Screenshot matching was not started because G4 still requires C5's real microphone → tool → revision proof; aggregate E2E and deployment remain blocked on C's absent Host B/build outputs.

### Implemented on `b6-agent-evaluation`

- Added a fixed 12-utterance decision-agent benchmark over the production `run_luna` loop,
  same four tools and frozen comparison evidence. Eleven model-backed scenarios are bounded to
  four calls each; the stale-turn scenario fails before a model call, for a structural ceiling
  of 44 paid requests.
- The first paid `gpt-6-luna` run used 28/44 requests and finished `partial`: scenario success
  10/12, tool behavior 11/11, UI/state outcomes 12/12, citation behavior 4/5, state correction
  1/1 and stale-turn protection 1/1. It was not retried; both failed scenarios remain in the
  committed artifact.
- `make eval` is now an actual phony command and projects the hash-validated agent artifact into
  `eval/results.json` without making a provider call.
- Added `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` and
  `docs/user-stories.md`, including Mermaid system/flow diagrams and explicit implemented versus
  planned status.
- Full API gate: **56 files formatted, lint passed, 54 sources strictly typed, and 156 tests
  passed**.
- The docs identify the main integration gap rather than hiding it: Host A still uses its legacy
  browser comparison/OpenAI path, and C3 has not connected it to the implemented Luna API.

### Implemented on `b7-agent-boundary-hardening`

- Text-agent preference mutation is now terminal for tool execution: the continuation uses
  `tool_choice: "none"`, and a provider function call after mutation is rejected before another
  application tool can run.
- Review tool and trusted prompt language distinguish the citeable review mention ID from the
  non-citeable review ID while preserving the server citation allowlist.
- Invalid final output after a committed mutation remains non-retryable and now returns the
  committed comparison revision so clients refresh instead of repeating intent.
- Agent artifact validation now covers the text-agent implementation. The B6 paid artifact is
  retained unchanged as historical evidence; `eval/results.json` reports the current agent
  measurement unavailable until an explicitly authorized B7 paid run.
- Full API gate: **56 files formatted, lint passed, 54 sources strictly typed, and 159 tests
  passed**. No provider call was made.

### Remaining integration

- Keep voice out of the main demo. The one authorized G4 run proved speech/captions/mutation but
  failed audible output; its generation-versus-playback root cause is unverified.
- Add the single Docker image, Render deployment and public smoke proof.
- Do not preselect Luna from clone cart IDs. A future real storefront integration must supply an
  authorized canonical listing/variant mapping rather than an inferred or hardcoded one.
