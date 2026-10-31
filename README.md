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
makes no provider call. It proves the same two-turn cited comparison flow in both hosts,
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
- GPT-Live server and browser code exists, but G4 is **not passed** until an explicitly
  authorized real microphone turn invokes the sideband tool and visibly increments the same
  comparison revision. Do not demo voice if that check is red.
- Host A still contains the superseded legacy compare engine and browser API-key settings next
  to the shared Luna panel. They must be deleted when Luna becomes Host A's sole compare path.
- Seller report UI, Docker/Render deployment and public smoke proof are not implemented.
- `npm install` currently reports dependency audit findings; no automatic or breaking audit fix
  has been applied.

See [the implementation spec](Shopee_Compare_Luna_V3_Implementation_Spec.md),
[architecture](docs/architecture.md), [invariants](docs/invariants.md), and
[user stories](docs/user-stories.md).
