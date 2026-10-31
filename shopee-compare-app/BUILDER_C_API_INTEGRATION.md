# Builder C — current frontend integration

## Ownership

- `shopee-compare-app/` owns Host A's Shopee-style shell, routes and adapter.
- `apps/minimal-host/` owns the independent Host B shell, catalog view and adapter.
- `packages/luna-widget/` is the sole Luna browser implementation.
- `services/luna-api/` owns authentication, evidence, comparison state, ranking, tools and
  OpenAI calls. API keys never enter browser code.
- Root `package.json` and `package-lock.json` are the only npm workspace/lock owners.

Host A imports `LunaWidget` from `@luna/widget`; neither `src/luna` nor `src/compare` exists.
The host supplies navigation behavior. The widget owns canonical catalog selection and uses
relative `/api` routes.

## Implemented

- Exact API-catalog variants, 2–4 item comparison and canonical revision display.
- Server-ranked recommendation, preference chips, seller sources and review-mention citations.
- Host A Seller Centre page (`#/SellerCentre`) with the seller gap report across every active
  buyer session, including the listing text behind each gap. Buyers see no seller UI.
- Text turns with canonical refresh, explicit 409 failure text and automatic session renewal on
  401.
- Independent Host B with a different component tree, layout and adapter.
- Exact product-snapshot handoff to separate Host A and Host B product previews; closing the
  preview preserves the comparison revision.
- Every product preview lists all schema specifications from canonical comparison evidence.
  Supported/conflicting facts retain exact source excerpts and locations; missing facts abstain.
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
response and a labelled browser WebRTC test double. Current result on this branch: seven
passed, one intentional Host B skip for the single shared-package transport lifecycle test.

## Remaining and explicitly unverified

- Host A cart IDs are not mapped to an authorized marketplace catalog. The demo therefore asks
  buyers to choose exact backend variants in Luna instead of treating clone cart data as
  evidence.
- One real paid microphone run produced captions and a visible revision 0→1 but no audible Luna
  response. It was not retried; G4 failed and voice is excluded from the main demo.
- The full cross-product review-aspect view, Docker/Render deployment and public smoke proof
  are not implemented.
