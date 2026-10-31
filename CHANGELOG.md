# Implementation changelog

This file records implemented Luna milestones. The implementation spec remains the source of truth for planned behavior. The integration lead owns this summary; developer-level evidence stays in `docs/codex-build-log/`.

## 31 October 2026

### Merged into `main`

- **B1 API shell and capability checks — [PR #1](https://github.com/jaxwong/decodex/pull/1):** FastAPI health and demo-session endpoints, locked uv project, bounded Responses function-call smoke, and GPT-Live session smoke. Both OpenAI capabilities passed with retries disabled and at most two provider calls.
- **B-owned API Make targets — [PR #2](https://github.com/jaxwong/decodex/pull/2):** root commands for API sync, formatting, linting, type checking, tests, development server, and the explicit paid capability smoke.
- **A evidence and review intelligence — [PR #3](https://github.com/jaxwong/decodex/pull/3):** frozen evidence contract and synthetic fixtures, mock catalog provider, exact-variant specification extraction, cited review analysis, failure behavior, and executed synthetic evaluation artifacts.
- **B2 deterministic sessions and decision tools — [PR #5](https://github.com/jaxwong/decodex/pull/5):** authenticated comparison state, provider-backed catalog and evidence creation, deterministic ranking, exactly four decision tools, optimistic revisions, and stable HTTP errors.

### Implemented on `b3-responses-text-agent`

- Authenticated `POST /api/comparisons/{comparison_id}/ask` using `gpt-6-luna` Responses.
- Strict schemas over B2's exact four tools; at most three tool rounds and four provider calls per turn, with SDK retries disabled.
- Session-owned bounded conversation history and comparison binding.
- Server validation of citations, deterministic recommendations, revision-safe UI patches, and unsupported model output.
- Timeout-after-update responses prevent a client retry from duplicating an already-saved mutation.
- Full behavior suite: **128 tests passed**; automated B3 tests make no provider calls.
- One local paid `gpt-6-luna` flow passed health → session → catalog → comparison → ask, saved revision 1, selected `listingB:65w`, and returned four validated citation IDs.

### Not yet merged

- B4 GPT-Live delegation, sideband tool execution, and browser voice integration.
- C's completed Host A replacement flow and independent Host B.
- Aggregate E2E/demo Make targets, the single Docker image, and Render deployment.
