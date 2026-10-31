# Implementation changelog

This file records implemented Luna milestones. The implementation spec remains the source of truth for planned behavior. The integration lead owns this summary; developer-level evidence stays in `docs/codex-build-log/`.

## 31 October 2026

### Merged into `main`

- **B1 API shell and capability checks — [PR #1](https://github.com/jaxwong/decodex/pull/1):** FastAPI health and demo-session endpoints, locked uv project, bounded Responses function-call smoke, and GPT-Live session smoke. Both OpenAI capabilities passed with retries disabled and at most two provider calls.
- **B-owned API Make targets — [PR #2](https://github.com/jaxwong/decodex/pull/2):** root commands for API sync, formatting, linting, type checking, tests, development server, and the explicit paid capability smoke.
- **A evidence and review intelligence — [PR #3](https://github.com/jaxwong/decodex/pull/3):** frozen evidence contract and synthetic fixtures, mock catalog provider, exact-variant specification extraction, cited review analysis, failure behavior, and executed synthetic evaluation artifacts.
- **B2 deterministic sessions and decision tools — [PR #5](https://github.com/jaxwong/decodex/pull/5):** authenticated comparison state, provider-backed catalog and evidence creation, deterministic ranking, exactly four decision tools, optimistic revisions, and stable HTTP errors.
- **B3 bounded Responses text agent — [PR #7](https://github.com/jaxwong/decodex/pull/7):** authenticated comparison chat over the same four tools, bounded conversation history, revision-safe mutations, evidence-bound answers, and a paid local end-to-end verification.

### Implemented on `b4-gpt-live-delegation`

- Authenticated `POST /api/comparisons/{comparison_id}/live/session` returns only the provider's Live session ID and WebRTC answer SDP.
- One `gpt-live-1` create call and one server-side sideband attach, both with SDK retries disabled; the browser never receives the API key or executes tools.
- Responses delegation reuses B3's exact four strict schemas and Python executor, with one call at a time and at most three tool rounds per delegation.
- Completed function calls are deduplicated, validated, saved before their output is returned, and followed by exactly one continuation; raw argument deltas never execute.
- A successful preference change refreshes the delegated tool schema and UI context to the newly committed revision, so a later correction cannot reuse a stale revision.
- Full behavior suite: **136 tests passed**; automated B4 tests make no provider calls.
- One paid local flow passed health → session → catalog → comparison → Live session creation and server-side attach, returning a WebRTC answer.
- Genuine microphone input, spoken output, and a real provider delegation-driven mutation remain C5 integration work; the full voice DoD is not yet claimed.

### Not yet merged

- C5 browser WebRTC voice controls and the joint real-microphone delegation/mutation check.
- C's independent Host B.
- Aggregate E2E/demo Make targets, the single Docker image, and Render deployment.
