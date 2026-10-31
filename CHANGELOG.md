# Implementation changelog

This file records implemented Luna milestones. The implementation spec remains the source of truth for planned behavior. The integration lead owns this summary; developer-level evidence stays in `docs/codex-build-log/`.

## 31 October 2026

### Merged into `main`

- **B1 API shell and capability checks — [PR #1](https://github.com/jaxwong/decodex/pull/1):** FastAPI health and demo-session endpoints, locked uv project, bounded Responses function-call smoke, and GPT-Live session smoke. Both OpenAI capabilities passed with retries disabled and at most two provider calls.
- **B-owned API Make targets — [PR #2](https://github.com/jaxwong/decodex/pull/2):** root commands for API sync, formatting, linting, type checking, tests, development server, and the explicit paid capability smoke.
- **A evidence and review intelligence — [PR #3](https://github.com/jaxwong/decodex/pull/3):** frozen evidence contract and synthetic fixtures, mock catalog provider, exact-variant specification extraction, cited review analysis, failure behavior, and executed synthetic evaluation artifacts.

### Implemented on `b2-deterministic-session-tools`

- Session-owned comparison state with bearer authentication, expiry, and cross-session isolation.
- Authenticated catalog, comparison creation, and comparison retrieval routes.
- Deterministic hard filtering and lexicographic ranking that preserves missing-data uncertainty.
- Exactly four decision tools: `get_comparison`, `get_review_aspect`, `apply_preferences`, and `inspect_evidence`.
- Optimistic revision conflicts, stable HTTP error envelopes, and an OpenAPI contract for C.
- Full behavior suite: **119 tests passed** without model calls in B2 tests.

### Not yet merged

- B3 Responses decision-agent loop and `/api/comparisons/{id}/ask`.
- B4 GPT-Live delegation, sideband tool execution, and browser voice integration.
- C's portable Luna widget, Host A replacement flow, and independent Host B.
- Aggregate E2E/demo Make targets, the single Docker image, and Render deployment.
