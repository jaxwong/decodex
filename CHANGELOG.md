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

### Implemented on `b5-api-hardening`

- Plain `make api-test` now resolves root `eval.*` modules under strict mypy without an environment override or ignored imports.
- Live hardening covers create failure with no orphaned session, concurrent stale correction without overwrite, and protocol failure with guaranteed sideband close.
- Existing text and Live success-boundary logs now record actual external-call counts and monotonic elapsed milliseconds without adding a second state/metrics owner.
- Full API gate: **54 files formatted, lint passed, 52 sources strictly typed, and 139 tests passed**.
- Screenshot matching was not started because G4 still requires C5's real microphone → tool → revision proof; aggregate E2E and deployment remain blocked on C's absent Host B/build outputs.

### Not yet merged

- C5 browser WebRTC voice controls and the joint real-microphone delegation/mutation check.
- C's independent Host B.
- Aggregate E2E/demo Make targets, the single Docker image, and Render deployment.
