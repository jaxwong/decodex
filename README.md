# Luna shopping decision demo

Luna is an evidence-backed shopping comparison service with one shared React widget and two
independent browser hosts:

- `shopee-compare-app/` — Host A, the Shopee-style primary demo shell;
- `apps/minimal-host/` — Host B, the portability proof;
- `packages/luna-widget/` — the only Luna browser implementation; and
- `services/luna-api/` — authenticated comparison state, evidence, ranking, text agent and
  GPT-Live sideband.

The catalog and reviews are fabricated and labelled synthetic. This repository does not claim
Shopee API access or production integration.

## Install and verify

Requirements: Node 18+, npm, `uv`, Python from `services/luna-api/.python-version`, and Chromium
installed once with `npx playwright install chromium`.

```bash
npm install
make api-sync
make api-test
make frontend-build
make e2e
make eval
```

`make e2e` starts a deterministic test-only API plus both hosts on isolated local ports. It
makes no provider call. It proves the same cited comparison and correction flow in both hosts,
Host A's Seller Centre counting another buyer session's exclusion, automatic session renewal,
package import boundaries, Live browser event wiring through a labelled WebRTC test double, and
microphone-denied text fallback.

## Run the real local app

```bash
cp .env.example .env
# Add the three documented server-only OpenAI variables to .env.
```

Terminal 1:

```bash
set -a; . ./.env; set +a
make api-dev
```

Terminal 2:

```bash
npm run dev --workspace shopee-compare
```

Terminal 3:

```bash
npm run dev --workspace minimal-host -- --port 5174
```

Open Host A at `http://127.0.0.1:5173/#/Cart` and Host B at
`http://127.0.0.1:5174/`. Both hosts proxy relative `/api` calls to port 8000.

## Honest current limits

- G3 portability is covered by deterministic dual-host browser tests.
- G4 **did not pass** its one authorized real run. The provider accepted the Live session;
  microphone speech produced captions and changed the comparison from revision 0 to 1, but no
  audible Luna response was heard. The run was not retried. Use text in the main demo and do
  not claim working voice audio.
- Host A now has one comparison implementation: `@luna/widget` on `#/Compare`. The demo cart
  holds exact backend catalog variants, and **Compare now** opens the ticked ones pre-selected in
  Luna. Cart text is never treated as trusted evidence.
- Docker/Render deployment and public smoke proof are not implemented.
- `npm install` currently reports dependency audit findings; no automatic or breaking audit fix
  has been applied.

See [the implementation spec](Shopee_Compare_Luna_V3_Implementation_Spec.md),
[architecture](docs/architecture.md), [invariants](docs/invariants.md), and
[user stories](docs/user-stories.md).
