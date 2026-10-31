# Builder C — current frontend integration

## Ownership

- `shopee-compare-app/` owns Host A's Shopee-style shell, routes and adapter.
- `apps/minimal-host/` owns the independent Host B shell, catalog view and adapter.
- `packages/luna-widget/` is the sole Luna browser implementation.
- `services/luna-api/` owns authentication, evidence, comparison state, ranking, tools and
  OpenAI calls. API keys never enter browser code.
- Root `package.json` and `package-lock.json` are the only npm workspace/lock owners.

Host A imports `LunaWidget` from `@luna/widget`; the deleted `src/luna` path has no wrapper.
The host supplies only selection/navigation behavior. The widget uses relative `/api` routes.

## Implemented

- Exact API-catalog variants, 2–4 item comparison and canonical revision display.
- Server-ranked recommendation, preference chips, seller sources and review-mention citations.
- Session-scoped seller gap report for excluded listings, including canonical conflict evidence.
- Text turns with canonical refresh and explicit 401/409 failure text.
- Independent Host B with a different component tree, layout and adapter.
- GPT-Live browser WebRTC: mic, remote audio, `oai-events`, `session.started`, provisional
  captions, Mute, Stop/`session.closed`, canonical refresh and text fallback.
- Deterministic same-flow Playwright in both hosts and widget import-boundary test.

## Verify

From the repository root:

```bash
npm install
make frontend-build
make e2e
```

`make e2e` makes no provider call. It uses frozen evidence, an injected SDK-shaped text
response and a labelled browser WebRTC test double. Current result on this branch: five passed,
one intentional Host B skip for the single shared-package transport lifecycle test.

## Remaining and explicitly unverified

- Host A's legacy `src/compare` path still owns a parallel comparison and browser OpenAI-key
  route. It is superseded but not yet deleted.
- One real paid microphone run produced captions and a visible revision 0→1 but no audible Luna
  response. It was not retried; G4 failed and voice is excluded from the main demo.
- The full cross-product review-aspect view, Docker/Render deployment and public smoke proof
  are not implemented.
