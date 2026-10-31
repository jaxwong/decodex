# Shopee Compare + Luna — Implementation Specification v3.2 (judge-aligned)

**Date:** 31 October 2026  
**Event:** SEA × OpenAI hackathon  
**Team:** exactly 3 developers  
**Timebox:** approximately seven hours; feature freeze and rehearsal included  
**Deliverable:** the existing **`shopee-compare-app/` frontend upgraded into an AI-native product** by embedding a portable Luna shopping-intelligence module, with a second unrelated host proving that Luna is not coupled to that storefront
**Status:** implementation plan; example products/reviews/metrics are fixtures, not observed results
**Judging source:** participant briefing, slides 5–6
**Confirmed registered build direction:** **AI-Native Products & Operations**

> **Thesis:** Remove the manual steps between discovering candidate products and making a defensible purchasing decision. Luna turns messy seller listings and review text into evidence-backed comparisons; a buyer can adjust constraints by text or voice, and the visible comparison responds. **The module must not depend on the demo storefront's data structures, components, or checkout code.**

**One-line pitch:** “Luna is an embeddable AI shopping decision layer: a marketplace supplies product and review evidence; Luna normalizes, compares, explains, and acts on buyer preferences through text or voice.”

**Rule about ‘drop-in’:** We can prove *integration readiness* through defined host/data adapters and two independently implemented demo hosts. We **cannot** claim real Shopee integration without authorized internal APIs, authentication, event hooks, reviews, performance/security review, and Shopee engineering approval.

## Start here — what this branch is for

This document began as the developer handoff and remains the implementation source of truth.

### Current implementation status — 31 October 2026

- **G3 portability is implemented on `feat/g3-g4-portable-live`:** root npm workspaces contain
  Host A, `packages/luna-widget` and the independent `apps/minimal-host`; one root lockfile owns
  dependencies. `make e2e` runs the same exact-variant → comparison → cited answer → revision
  correction flow in both hosts and checks that widget source imports neither host.
- **G4 browser transport is implemented but the gate is not passed:** WebRTC offer/answer,
  `oai-events`, `session.started`, remote audio, provisional input/output captions, mute, Stop,
  `session.closed`, canonical refresh and microphone-denied text fallback exist. Playwright uses
  a labelled browser transport double and makes no provider call. A real authorized microphone
  → GPT-Live → sideband `apply_preferences` → visible newer revision is still required.
- **Still incomplete:** Host A retains the legacy direct-browser OpenAI comparison path beside
  Luna; seller gap-report UI, single-image runtime, deployment and public smoke proof remain.
  Voice must be cut from the main demo unless the real G4 check passes.

1. Push `shopee-compare-app/` and this spec together. Do not push `node_modules/`, generated `dist/`, `.env`, API keys or unrelated local files.
2. A, B and C branch from the same handoff commit and follow only their rows in section 1. They share A1's fixture; they do not edit each other's areas.
3. At G2, combine the three outputs and run the local P0 flow on the existing frontend.
4. After `make test` and `make e2e` pass locally, build one Docker image and deploy that exact image as one web service for the demo.

**Handoff is ready to push when:**

```bash
cd shopee-compare-app
npm ci
npm run build
cd ..
git diff --check
git status --short
```

Expected now: the frontend build exits `0`; only intended source/spec/config changes appear; no secret or dependency directory is tracked. The participant briefing PDF is currently a local untracked input—do not add it unless the organizers permit redistribution. The existing lint failure is documented in section 2.2.1 and is a C-owned implementation task, not hidden. Do not delay the handoff to redesign the current compare code—the spec explicitly replaces it.

**Completed product is ready for demo only when all four are true:**

- `make api-test` and `make frontend-build` exit `0`.
- `make e2e` exits `0` against both Host A and Host B.
- The manual local script in section 10.4 succeeds twice.
- The deployed `/api/health`, Host A and Host B smoke checks in section 11 succeed.

**Reading map:** everyone reads Start Here + section 1. Then A reads sections 2.3, 2.4, 2A.2, 4, 5 and 10; B reads sections 6, 7, 9–11; C reads sections 2.1, 2.2, 2A.1, 3 and 10–13. Sections outside your map are interface reference, not permission to edit another owner's files.

**Frontend decision — confirmed:** **Yes, `shopee-compare-app/` is Host A and the product we build on top of.** “Build on top” means reuse the useful storefront shell, visual language and entry routes—not preserve its current compare architecture. Do not create a replacement `apps/demo-shopee` application or rebuild the storefront. Replace the existing compare engine/state/UI with the clean `packages/luna-widget` + `services/luna-api` design below. Host B exists only to prove that the new Luna module is portable.

**Starter-code/licensing gate:** `shopee-compare-app/README.md` declares that its Shopee-style shell and assets came from `neoB23/Shopee_E-commerce-Clone`; the inspected upstream public repository has no declared license. The existing app remains the development baseline, but this is a **submission/distribution blocker**, not a footnote. Obtain written author permission and organizer approval before publicly distributing inherited code/assets. If that approval is unavailable, replace only the inherited shell/assets with an original compact storefront while keeping the same Host A routes, adapter and Luna module; do not maintain two Host A implementations. Preserve the attribution/declaration until the licensing decision is resolved.

### Existing frontend: keep the shell; replace the bad implementation

| Existing path | Keep / change | Target responsibility |
|---|---|---|
| `shopee-compare-app/src/App.jsx` | **Keep and minimally wire** the application entry, layouts and routes | Mount the new Luna provider/adapter without moving storefront ownership into the widget |
| `shopee-compare-app/src/components/Section/cart.jsx` | **Keep its useful presentation; replace compare state calls** | Call public `@luna/widget` selection controls/callbacks; no duplicated comparison state |
| `shopee-compare-app/src/components/Section/Compare.jsx` | **Replace with a thin route component** | Render exported Luna comparison/review/assistant components on `#/Compare` |
| `shopee-compare-app/src/compare/CompareContext.jsx` | **Delete after the new provider is wired** | Widget owns comparison view state; backend owns canonical comparison/preferences/revision |
| `shopee-compare-app/src/compare/engine.js` | **Delete; do not port or wrap it** | Server owns evidence validation, extraction and ranking; the direct browser OpenAI call is forbidden |
| `shopee-compare-app/src/compare/Panels.jsx` | **Delete after replacement components render** | New evidence/review UI lives in the widget; no browser API-key settings |
| `shopee-compare-app/src/compare/data.js` | **Replace; do not copy its runtime role** | Rewrite only useful synthetic cases into canonical root `data/` fixtures served by `MockCatalogProvider` |

**Replacement rule:** Do not spend time achieving behavioral parity with known-bad code. First record one baseline screenshot/build so accidental storefront regressions are visible; then build the thinnest new cart → compare → evidence path and delete the old compare implementation as soon as that path works. Every merged step must leave Host A runnable. There is one compare state owner, one fixture source and one OpenAI boundary. The old engine is never retained as a fallback and the frontend never receives `OPENAI_API_KEY`.

---

## 0. Scope, priorities, and non-negotiable success

| Priority | Deliverable | Friction eliminated | Owner | Gate |
|---|---|---|---|---|
| **P0** | **Portable Luna integration contracts + two hosts** | Rebuilding Luna for every storefront | A: catalog adapter, C: widget/host adapters, B: agent-service boundary | Same widget/API used in two hosts; only adapters change |
| **P0** | Exact-variant comparison bucket | Reopening and remembering shortlisted SKUs | A data, B API, C UI | 2–4 explicit variants selected |
| **P0** | Grounded specification comparison | Reading inconsistent descriptions/units | A evidence, B wrapper, C UI | Clickable source evidence, missing/conflict states |
| **P0** | Cross-product review intelligence | Reading dozens of reviews manually | A extraction, B tool, C UI | Comparable aspects, original quoted review IDs |
| **P0** | **Luna text agent that uses tools** | Manually filtering, sorting, and explaining tradeoffs | B, C | Preferences cause a real backend state change and visible UI patch |
| **P1** | **GPT-Live voice over the same tools** | Typing filters and repetitive prompts | B voice backend, C audio/UI | Spoken preference changes same comparison revision |
| **P1** | Screenshot-based catalog matching | Re-searching a product shown in a screenshot | B + C | Suggestion requires variant confirmation |
| **P2** | External investigation of gaps | Manual cross-site checks | B | External claims are cited and separated from seller evidence |
| **P2** | Watchlist / scheduled re-check | Repeatedly checking saved candidates | B only, if time | True monitor only with refreshed data and actual scheduling |

**What not to build:** live Shopee scraping, real checkout/payments, seller administration, cart synchronization, authentication platform, browser extension, universal product schemas, fake Live interaction, or general-purpose multi-agent workflows.

**Required demo:** Three exact power-bank variants added → comparison of 8–10 normalized fields → review aspects with source texts → buyer says/types “Under S$80, at least 65W; prioritize portability” → Luna executes a tool, updates the compare UI and explains cited tradeoffs → “Actually prioritize price” updates the same session without re-extraction.

**Required portability proof:** Load Luna in a compact Shopee-inspired demo **and** a plainly styled `minimal-host` page. The host must supply only the adapter and context; no edits to `packages/luna-widget` or `services/luna-api` are allowed for the second host. A different CSS theme alone is insufficient: use a distinct host component tree, different routing/layout, and a separate host-adapter implementation.

**Cut order:** P2 investigation/watchlist first; P1 screenshot next; GPT-Live if its tool relay is not working by the cutoff. Do not cut evidence grounding, agent state mutation, or the second-host portability test. If behind schedule, reduce the storefront to one product grid and one product-detail route.

### 0.1 Judging strategy and build-direction gate

**Registration alignment — confirmed:** The team's initial registered direction is **AI-Native Products & Operations**. The product scope, implementation priorities, evaluation and judge narration must remain aligned to that direction. Do not reposition Luna as a different build direction merely to claim an additional rubric category.

**Primary direction — AI-Native Products & Operations:** Luna is not a chat box added to a comparison table. It redesigns the shopping-decision workflow so one evidence-grounded system collects exact variants, normalizes incompatible claims, aligns review evidence, applies buyer constraints, changes the visible decision state and supports correction. The working demo must prove what a buyer can now do in one flow that previously required repeated listing, review and filter work.

**Supporting direction — Deep Domain AI:** exact-SKU identity, source provenance, conflict preservation, abstention, sample-limited review language and deterministic ranking reflect how a trustworthy marketplace decision system should work. Treat this as supporting evidence, not a second unfocused pitch.

**Do not claim Autonomous & Adaptive AI as the build direction.** A tool-using assistant is not automatically autonomous, and this plan has no learning loop. A simulated watchlist does not prove reliable unattended operation or improvement over repeated runs. Watchlist automation remains a conditional business-value extension inside the confirmed AI-Native Product direction.

| Judging criterion | What the working product must prove | Evidence to preserve |
|---|---|---|
| **Problem & Solution Fit** | Buyers face a real exact-variant, inconsistent-spec and review-synthesis problem; Luna removes the right steps rather than adding chat | One matched manual-vs-Luna task script, explicit start/end state and measured interaction count; no invented user-study claim |
| **Build Quality** | The core journey works repeatedly, handles missing/conflicting evidence, stale revisions and one provider/model failure | Two back-to-back rehearsals, automated test output, error-state screenshot/log and measured latency |
| **Insight & Originality** | This is not a generic comparison table or prose chatbot: the model operates over evidence contracts and constrained tools, while the same module works in two unrelated hosts | Tool log + visible UI mutation, evidence drawer, import-boundary test and second-host recording |
| **Real-World Value** | Shoppers reach a defensible shortlist with fewer manual actions; a marketplace can integrate the decision layer without rebuilding it | Measured friction proxy, portable adapter proof and honest list of production integration gaps; never claim conversion or GMV lift |
| **Alignment with Build Direction** | The demo visibly behaves as an AI-native decision product, not a conventional UI with an AI badge | Judge narration maps normalize → inspect → constrain → act → correct to one continuous workflow |
| **Use of Codex** | Codex materially accelerates architecture, contracts, tests, implementation, debugging and evaluation, with humans reviewing every consequential change | `docs/codex-build-log/{A,B,C}.md` containing 6–8 total high-impact tasks, files changed, human corrections and exact verification commands/output |

### 0.2 Current OpenAI capability selection — business value first

Every OpenAI capability must pass four gates: **removes a real user or operating step; changes a visible or measurable outcome; preserves evidence and user control; and has a tested failure fallback.** Newness alone is not a reason to ship it.

| Capability | Business value in Luna | Tier and inclusion gate |
|---|---|---|
| **Responses Structured Outputs** | Converts inconsistent seller and review text into a fixed, validated evidence contract | **P0.** Required for grounded extraction; invalid output is rejected, never displayed optimistically |
| **Responses function calling with GPT-6 Luna** | Turns natural-language constraints into validated comparison reads and one deterministic preference mutation, removing manual filtering/ranking | **P0.** Required; actual tool execution and UI revision must be visible |
| **GPT-Live with Responses delegation** | Lets a buyer state and correct constraints hands-free while looking at the table; the same backend tools preserve consistent behavior | **P1, first extension.** Ship only after text tools work and voice changes the same comparison revision |
| **Image input / vision** | A screenshot can recover likely catalog candidates instead of forcing the buyer to re-search manually | **P1.** Ship only with candidate scoring and explicit exact-variant confirmation; never infer an exact SKU from appearance alone |
| **Hosted web search** | Investigates one missing or conflicting field without making the buyer leave the decision flow | **P2.** User-triggered only; external evidence remains separate from seller evidence and exact model identity is required |
| **Decisions API** | Can classify high-volume review snippets into fixed aspect/sentiment choices with lower latency, improving operating cost and responsiveness | **Conditional optimization.** Keep only if the held-out benchmark improves precision, latency or cost over the existing Responses extraction; it is not a demo feature by itself |
| **Dots** | Demonstrates the product pattern of an always-on responsibility that continues between conversations and returns for decisions | **Product inspiration, not Luna's API.** Dots is a ChatGPT experience for eligible accounts; do not claim it is embedded in the storefront |
| **Agents scheduled automations** | Could re-check an already narrowed shortlist instead of requiring repeated manual visits | **P2 / roadmap unless real.** Claim only with authorized refreshable data, an executed schedule, idempotency and a working delivery surface |

**Deliberately excluded from the seven-hour runtime:** Tool Search (only four tools), computer use (no authorized Shopee operation and too risky), MCP (no real external provider to connect), Code Interpreter/hosted shell (deterministic domain code is safer), file search (no document corpus), and image generation (decorative). They may be supported platform features, but they do not improve this demo's business outcome.

---

## 1. Three parallel work streams — one owner per decision

The team shares **one artifact only**: A's frozen evidence contract plus `data/sample_comparison_evidence.json`. After minute 30, B and C work against that fixture without waiting for A's implementation. No developer edits another developer's implementation area.

### 1.1 Ownership boundaries

| Developer | Owns exclusively | Public output to the other developers | Never owns |
|---|---|---|---|
| **A — Evidence** | `data/*`, `eval/*`, `app/contracts/evidence.py`, `app/providers/*`, `app/evidence/*`, evidence/review tests | `ComparisonEvidence` contract, sample JSON fixture, `build_comparison_evidence(selections)`, evidence structured-output calls/validation | Sessions, revisions, recommendations, agent tools, React, API composition |
| **B — Decision agent + API** | `app/main.py`, `app/contracts/session.py`, `app/routes/*`, `app/decision/*`, `app/openai/*`, session/agent/Live tests, root `Dockerfile`, `render.yaml`, `Makefile` | HTTP/OpenAPI API, deterministic ranking, conversation/revision state, agent/Live model calls, text and Live endpoints, single-service runtime/deployment | Evidence extraction rules/model calls, provider internals, React, host behavior |
| **C — Frontend** | `shopee-compare-app/*`, `packages/luna-widget/*`, `apps/minimal-host/*`, root npm workspace, root `.gitignore`, Playwright tests | Host A, reusable widget, Host B, browser test report and demo | Python internals, ranking, model calls, API keys, evidence truth |

**One state owner:** A returns immutable evidence. **B alone owns** `comparison_id`, preferences, recommendation, conversation and `revision`. C renders B's response and sends user intent; it never recomputes facts or ranking.

**One contract owner:** A owns evidence fields and statuses. B wraps that contract with session state. C generates frontend types from B's OpenAPI output; C does not hand-create a competing schema. Any contract change after G0 requires all three to approve and must update the fixture, OpenAPI snapshot and compatibility test in the same commit.

**Codex evidence without file conflicts:** each developer writes only `docs/codex-build-log/A.md`, `B.md` or `C.md`. Each entry records the task, files changed, human correction and exact command/result. C owns the final read-only index `docs/codex-build-log/README.md`.

### 1.2 Exact work order and blockers

#### Developer A — Evidence

| Step | Time | Deliverable / done condition | Blocked by | Who it blocks |
|---|---:|---|---|---|
| **A1 Contract + fixture** | 00:00–00:30 | Canonical IDs, evidence/review schema, provider protocol and one valid `sample_comparison_evidence.json` | Nothing | **B2 and C2 only, until G0** |
| **A2 Evidence pipeline** | 00:30–02:30 | Mock provider → selected exact variants → normalized facts with valid evidence IDs; missing/conflict/variant-leakage tests pass | A1 | G2 integration, not B/C fixture work |
| **A3 Reviews + failure behavior** | 02:30–04:00 | Exact review excerpts, aspect aggregates, provider-unavailable and partial-analysis behavior pass | A2 | Reviews portion of G2 only |
| **A4 Evaluation** | 04:00–05:45 | Held-out scorer and real `eval/results.json`; no blank metric presented as a result | A2; B supplies final 12 agent outputs by 05:00 | Final scorecard only |

#### Developer B — Decisions + OpenAI + API

| Step | Time | Deliverable / done condition | Blocked by | Who it blocks |
|---|---:|---|---|---|
| **B1 Capability smoke tests + API shell** | 00:00–00:30 | Responses function call and GPT-Live session access recorded; FastAPI health endpoint and session store shell run | Credentials/entitlement only | Nothing in P0; Live is cut if unavailable |
| **B2 Deterministic session + four tools** | 00:30–02:00 | Create comparison, filter/rank, evidence/review reads and revision conflict behavior pass over A1 fixture | **A1** | C3 real API wiring |
| **B3 Responses text agent** | 02:00–03:30 | Bounded tool loop executes B2 functions; citations validate; correction changes same comparison revision | B2; live evidence hookup uses A2 at G2 | G2 and C3 chat |
| **B4 GPT-Live delegation** | 03:30–04:45 | Same B2 tools execute through Live sideband exactly once; spoken correction changes revision | B3 and successful B1 Live smoke test | C5 voice only |
| **B5 Optional feature** | 04:45–05:45 | Add screenshot matching **only if G2–G4 pass**; otherwise harden tests and latency | All earlier gates | Nobody; never delays demo |

#### Developer C — Frontend

| Step | Time | Deliverable / done condition | Blocked by | Who it blocks |
|---|---:|---|---|---|
| **C1 Workspace + Host A shell** | 00:00–00:30 | Existing frontend baseline recorded; root workspace and empty widget package build; `#/Cart` still opens | Nothing | Nothing |
| **C2 New widget over fixture** | 00:30–02:30 | Replace old compare state/engine with exact bucket, table, evidence/review drawers and Luna panel over A1 fixture; delete old browser OpenAI settings/call | **A1** | G2 projection only |
| **C3 Wire Host A to API** | 02:30–03:30 | Cart → compare → ask → cited visible UI mutation works on `shopee-compare-app`; stale patch is rejected | B2/B3 routes; A2 for live evidence | G2 |
| **C4 Independent Host B** | 03:30–04:15 | Minimal host mounts unchanged widget through a separate adapter; import-boundary and same-flow Playwright test pass | C2; can use fixture/API already available | G3 only |
| **C5 Voice UI** | 04:15–04:45 | Microphone, captions, stop/mute and text fallback; voice mutation visible | B4 | Voice demo only |
| **C6 Freeze + rehearse** | 04:45–07:00 | Builds/lint/tests pass; error states visible; two successful rehearsals; demo artifacts saved | G2/G3; A4 metrics by 05:45 | Final delivery |

### 1.3 Gates and waiting rules

| Gate | Deadline | Pass condition | If it fails |
|---|---:|---|---|
| **G0 Contract freeze** | 00:30 | A1 fixture validates; B imports it; C renders one item | A is the only blocker. B/C scaffold, test tooling and do not invent fields |
| **G1 Independent streams ready** | 02:30 | A evidence tests pass; B four tools pass on fixture; C Host A renders full fixture flow | Each owner fixes only their stream; the other two continue their own tests |
| **G2 P0 integrated** | 03:30 | Host A add → compare → ask → tool → visible revision → citation works | All stretch work stops; failing layer's owner fixes it |
| **G3 Portability — automated pass** | 04:15 | Same P0 flow works in Host B without changing widget/backend | C fixes adapter coupling; B/A do not create host-specific paths |
| **G4 Voice decision — real run pending** | 04:45 | Speech invokes the same tool and revision as text | Remove voice from the main demo; keep text. No second voice architecture |
| **G5 Feature freeze** | 05:45 | All P0 tests pass; optional work either passes or is removed | No new code except correctness fixes and demo evidence |
| **G6 Demo ready** | 07:00 | Two consecutive end-to-end runs and only measured claims | Do not claim unverified behavior |

**Waiting rule:** after G0, nobody waits for another developer before G2. A builds the real evidence implementation; B and C use the frozen fixture. At G2, replace the fixture boundary with A's function without changing its shape. Post blockers as “owner + missing artifact + failing command,” never “waiting on backend/frontend.”

**Kill switches:** If G2 misses 03:30, stop all optional work. If G3 fails, C fixes portability before voice. If G4 fails, cut Live. If any path needs a live Shopee account, use the labelled mock provider and disclose it; never fake access.

---

## 2. Repository and boot procedure — build first

### 2.1 Monorepo layout

```text
decodex/
  shopee-compare-app/          # Host A: EXISTING frontend and primary judge demo
    src/App.jsx                # preserve shell + #/Cart and #/Compare routes
    src/lunaHostAdapter.js     # implements LunaHostAdapter for existing routes
    src/components/Section/    # existing host-owned storefront presentation
    package.json               # existing Vite app; becomes an npm workspace
  apps/
    minimal-host/              # Host B: deliberately different plain layout
      src/minimalHostAdapter.js
      src/App.jsx
  packages/
    luna-widget/               # Portable React UI, one set of components
      src/index.jsx            # exports the shared LunaWidget
      src/hostAdapter.js       # runtime-validated public host contract
      src/lunaClient.js        # Luna service calls, never host-specific catalog internals
      src/LunaWidget.jsx       # comparison state and UI owner
      src/LiveVoiceControls.jsx # browser-only WebRTC media/events
  services/
    luna-api/                  # FastAPI; runnable independently of any host
      app/
        main.py                # B: composition root and API
        contracts/
          evidence.py          # A: immutable evidence schema
          session.py           # B: session/revision wrapper
        providers/             # A: provider protocol + mock implementation
        evidence/              # A: normalization, validation, reviews
        decision/              # B: sessions, deterministic ranking, four tools
        openai/                # B: Responses and GPT-Live integration
        routes/                # B: HTTP boundary; calls A's public function
      tests/
        evidence/              # A only
        decision/              # B only
      pyproject.toml
  data/
    listings.json
    reviews.json
    sample_comparison_evidence.json # A's frozen contract fixture for B/C
    ground_truth.json         # labels are separate from model input
  eval/
    baselines.py
    run.py
    metrics.py
    results.json              # generated only
  docs/
    INTEGRATION.md            # one-page host/backend adapter guide
    DEMO.md
    codex-build-log/
      A.md                    # each owner writes only their own log
      B.md
      C.md
      README.md               # C-owned final index
  .env.example
  .gitignore                   # C: one repo-wide ignore file; no nested copies
  package.json                 # new npm workspace: existing Host A + widget + minimal host
  package-lock.json            # one root lockfile after workspace conversion
  Dockerfile                   # B: one image containing API + both built hosts
  .dockerignore
  render.yaml                  # B: one Render web service, no database/worker
  Makefile                     # B: test/e2e/demo entry points
  scripts/
    e2e-local.sh               # B-owned orchestration; calls C's Playwright suite
  README.md
```

**Why one repo?** Three people can develop and test the existing frontend, one shared package, a second host and one backend against a single contract. This is a monorepo for collaboration **not a runtime coupling requirement**. Do not move or clone `shopee-compare-app/`. The `luna-widget` must be importable as a package, and `luna-api` must run without any frontend installed. Future marketplace teams would embed the UI, supply adapters and deploy the service independently.

### 2.2 Setup and commands

#### 2.2.1 Test the existing frontend now, before Luna work

```bash
# Terminal 1 — current baseline only
cd shopee-compare-app
npm install
npm run dev -- --host 127.0.0.1
# Open http://127.0.0.1:5173/#/Cart
```

Baseline manual check: the cart loads; select 2–4 supported power-bank rows; change one exact variant; click **Compare now**; confirm `#/Compare` renders; open one evidence drawer. This proves only that the starting frontend runs—it does **not** prove the new Luna architecture or AI behavior.

In a second shell:

```bash
cd shopee-compare-app
npm run build
npm run lint
```

**Observed baseline on 31 October 2026:** `npm run build` exits `0`; `npm run lint` exits `1` with 173 findings (171 errors, 2 warnings). Do not describe the current frontend as green. C records the full lint output before replacement, then makes the final root lint command pass; do not disable rules, ignore files or delete assertions to manufacture a pass.

#### 2.2.2 Create the target workspace once

1. Keep `shopee-compare-app/` where it is.
2. Add root workspaces for `shopee-compare-app`, `packages/luna-widget` and `apps/minimal-host`.
3. Root scripts own `build` and `test:e2e`; use npm's workspace flag for each development server.
4. Create the FastAPI service and root fixtures shown in section 2.1.
5. Move to one root npm lockfile; do not keep independently resolved frontend dependency graphs.
6. Add Playwright as the single browser-test runner because it must exercise two real Vite hosts, navigation, drawers and API-driven UI mutations. Do not add a second E2E framework.

#### 2.2.3 Run the completed system locally

Use three terminals from the repository root:

```bash
# One-time JavaScript setup
npm install

# Terminal 1 — backend (load root .env first)
set -a; . ./.env; set +a
make api-dev

# Terminal 2 — existing Shopee frontend (Host A)
npm run dev --workspace shopee-compare
# Open http://127.0.0.1:5173/#/Cart

# Terminal 3 — portability host (Host B)
npm run dev --workspace minimal-host -- --port 5174
# Open http://127.0.0.1:5174/
```

Health checks, from a fourth shell:

```bash
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/demo-sessions
```

Expected: both return HTTP `200`; both hosts show the same fixture products; only Host A has the Shopee-style shell. Vite in both hosts proxies `/api` to port 8000.

The root `Makefile` currently exposes `make api-test`, `make frontend-build`, `make e2e`,
`make eval`, `make api-dev` and the explicitly paid `make api-capability-smoke`. `README.md`
contains the same startup sequence without hidden steps. `make demo` and a full browser
`make test-live` do not exist yet and must not be claimed. Do not put `OPENAI_API_KEY` in
`VITE_*` variables or commits. Pin the OpenAI SDK revision that passed smoke tests, and use
`.env.example` for `OPENAI_TEXT_MODEL`, `OPENAI_LIVE_MODEL`, `LUNA_CATALOG_PROVIDER=mock`.

### 2.3 Shared canonical IDs and response schema

**Exact comparison identity:** `item_key = listing_id + ':' + variant_id` (not title, not product family). The product snapshot has a revision/hash; current listing price comes from the selected variant in the catalog, not from the LLM. Prices are integer minor currency units, with explicit currency codes.

```python
# services/luna-api/app/contracts/evidence.py (A-owned immutable fields)
from typing import Literal
from pydantic import BaseModel, Field

Status = Literal['supported','missing','conflicting','unresolved']
SourceType = Literal['title','description','attribute','variant','review','image','external']

class Evidence(BaseModel):
    id: str
    item_key: str
    source_type: SourceType
    source_text: str
    source_location: str | None = None
    variant_id: str | None = None
    review_id: str | None = None

class Fact(BaseModel):
    field_key: str
    status: Status
    value: str | int | float | bool | None = None
    unit: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    conflicting_values: list[str] = Field(default_factory=list)

class ReviewMention(BaseModel):
    id: str
    review_id: str
    item_key: str
    aspect: Literal['heat','portability','charging','reliability','value','other']
    sentiment: Literal['positive','negative','neutral']
    excerpt: str

class ReviewAspectSummary(BaseModel):
    item_key: str
    aspect: str
    positive_count: int
    negative_count: int
    neutral_count: int
    analyzed_reviews: int
    mention_ids: list[str]

class ComparisonEvidence(BaseModel):
    items: list[dict]                    # selected variant, price/currency, snapshot IDs
    schema_fields: list[dict]           # capped 8–10 dimensions
    facts_by_item: dict[str,list[Fact]]
    evidence: dict[str,Evidence]
    review_summaries: list[ReviewAspectSummary]
    review_mentions: dict[str,ReviewMention]
```

B wraps `ComparisonEvidence` in the session response containing `id`, `revision`, `preferences` and `recommendation`. C generates `packages/luna-widget/src/contracts.ts` from B's exported OpenAPI schema. No frontend model may silently reinterpret missing, conflicting, or unresolved as a numeric zero.

### 2.4 Minimum fixture and validity rules

Seed three to four **fabricated and explicitly labelled** power-bank listings with 8–10 comparable fields, selected variants, seller descriptions, and 12–20 source reviews each. Required adversarial cases: sibling 100W/130W descriptions; `0.42kg` needing normalization; missing weight; contradictory 12/24-month warranty; negative heat mentions; mixed-sentiment reviews; unknown review variant. Use a stable, deterministic catalog version so `MockCatalogProvider` and benchmarks see the same evidence. Prices must use one declared currency (e.g. SGD) in the main demo.

**Invariants:** supported claim needs a semantically valid source ID tied to correct SKU; missing/unresolved cannot assert a numeric fact; conflict keeps both claims; a review excerpt must be an exact substring of the review; variant-unlabelled reviews must be marked listing-level; no product detail is drawn from model memory; stale UI patches cannot overwrite newer revisions. `Evidence` and review strings are **untrusted data**, never instructions.

**Setup DoD:** health/catalog work in both hosts, A's sample JSON loads in B/C, package typechecks, API runs without frontend, and keys remain server-side.

---

## 2A. Integration architecture — the portability contract (P0)

**Do this before writing AI prompts.** Two ports of the same mock storefront would not show portability. Keep a distinct *host UI adapter*, *data provider*, *Luna UI package*, and *Luna backend*. Never call Shopee private endpoints or claim access to them.

### 2A.1 Frontend host contract (C owns)

```typescript
// packages/luna-widget/src/contracts.ts
export type Selection = { listingId: string; variantId: string };
export type Money = { currency: string; amountMinor: number };
export interface LunaHostAdapter {
  hostId: string;                 // 'shopee-compare-app' / 'minimal-host'
  getCurrentSelection(): Selection | null;
  onSelectionChange(cb: (s: Selection | null) => void): () => void;
  navigateToListing(listingId: string): void;
  requestAddToCart?(selection: Selection): Promise<{ ok: boolean }>;
}

export type LunaConfig = {
  adapter: LunaHostAdapter;
  apiBaseUrl: string;
  sessionToken: string;           // demo session, validated by backend
};
```

**Package usage** (illustrative public API; keep exports stable):

```tsx
<LunaProvider adapter={hostAdapter} apiBaseUrl="/api" sessionToken={sessionToken}>
  <AddCompareButton listingId="listingA" />
  <ComparisonDrawer />
  <LunaAssistant />
</LunaProvider>
```

`AddCompareButton` asks host for currently selected SKU where appropriate; otherwise renders its own variant picker using backend catalog metadata. `requestAddToCart` is **optional** and must require explicit user confirmation; no purchase or payment API is supplied. `navigateToListing` is a host callback, not a hardcoded route. The widget owns its comparison bucket/view state; it must not import host Redux/Zustand stores or scrape the DOM. Scope CSS and expose theme tokens. For non-React hosts, optionally export `mountLuna(element, config)` wrapping React `createRoot`; this is an embedding bridge, not evidence of compatibility with Shopee’s actual frontend.

**Host A (`shopee-compare-app/`)**: the existing orange storefront, cart, `#/Cart` and `#/Compare`; replace only the compare implementation. **Host B (`apps/minimal-host/`)**: one neutral product list and distinct route structure; implement a separate adapter, mount the *same* compiled widget package and do not copy widget code. **Test**: run the same Playwright scenario in both hosts; all Luna functions work against the same API and fixture IDs.

### 2A.2 Backend catalog-provider contract (A owns; B consumes)

```python
from typing import Protocol

class CatalogProvider(Protocol):
    async def list_listings(self, query: str | None = None) -> list[dict]: ...
    async def get_listing(self, listing_id: str) -> dict | None: ...
    async def get_variant(self, listing_id: str, variant_id: str) -> dict | None: ...
    async def get_reviews(self, listing_id: str, variant_id: str | None,
                          cursor: str | None = None, limit: int = 50) -> dict: ...
    async def get_snapshot_version(self, listing_id: str) -> str: ...
```

Implement `MockCatalogProvider` reading fixture files and an optional `provider_factory(config)` with only `mock` enabled. Do **not** put `if provider == "shopee"` throughout Luna's core. A hypothetical `AuthorizedShopeeProvider` is **a future implementation point**, not a working adapter. Its feasibility requires approved product/review data entitlements, regional variation semantics, consent/security requirements, and per-user access controls. The mock provider supports paginated review reads and returns source strings/IDs; the comparison service transforms them to canonical schema and snapshots.

The agent never fetches arbitrary marketplace HTML. It invokes domain services with explicit provider-backed data and authorization. Keep `listing_id` namespaced by marketplace/provider if additional sources are added later (e.g. `mock:listingA`), and do not expose raw external credentials to the model.

### 2A.3 Service boundary / portable deployment

- `luna-widget` -> authenticated `/api` calls -> `luna-api` -> `CatalogProvider` -> data source. Neither widget nor agent imports app-specific/mock data. The provider is injected at FastAPI startup (dependency injection), so tests can swap it without changing handlers.
- `LunaHostAdapter` handles **browser-local** selection, navigation and explicit cart intents. `CatalogProvider` handles **server-side** trusted evidence and availability. They are not interchangeable. The UI never sends seller specs/reviews as trusted facts; it sends IDs and optional user preferences only.
- Host session proof: `POST /api/demo-sessions` issues an opaque random token (e.g. `secrets.token_urlsafe(32)`) with a short expiry stored server-side; the widget sends `Authorization: Bearer` and comparisons are bound to the session. Reject missing/expired tokens and another session's comparison ID; a client-chosen user ID is not authentication. In production Shopee would provide approved identity/session mapping, rate limits, security review, and auth; these remain integration work, not solved by the prototype.
- Add a versioned HTTP contract (`/api/v1/...` in a future release; keep `/api` for today's demo) and a small integration guide: install widget, supply host adapter, configure API URL, configure trusted catalog adapter, customize theme. API errors are stable (`unknown_listing`, `unknown_variant`, `invalid_bucket`, `comparison_expired`, `revision_conflict`, `provider_unavailable`).
- **Second-host test (C owner):** run identical add → compare → ask → cite sequences in `shopee-compare-app` and `minimal-host`. Add an import-boundary check that fails when widget source imports either host. Record `git diff -- packages/luna-widget services/luna-api`: **empty** after adding Host B. If Host B needs modifications to core Luna code, the portability goal is not met.

### DoD: portability is a tested invariant

- [ ] Two different host implementations use the same packaged Luna frontend and backend.
- [ ] Neither host shares UI state other than the agreed adapter contracts; no mock host paths imported by widget.
- [ ] Changing provider fixtures changes results without code edits to the widget or agent.
- [ ] Both hosts can pick the exact same SKU and retrieve its evidence and reviews by canonical ID.
- [ ] The widget doesn't invoke cart/purchase unless the host explicitly exposes the optional callback and buyer confirms.
- [ ] An unknown SKU, unavailable provider, expired session, and stale revision produce visible recoverable errors.
- [ ] README accurately states what is portable **and** what real Shopee integration still requires.

---

## 3. Feature F1 — Add + compare exact variants (P0)

**User problem:** A comparison is worthless if product A is the 100W variant but specifications belong to the 130W variant.

**Owner:** A for provider/catalog data, B for HTTP/session state, C for the shared widget in both hosts.

### Step-by-step implementation

1. **A:** Implement `CatalogProvider.list_listings()` and variant validation. Return `id`, `title`, permitted fixture `image_url`, `variants:[{id,label,price_minor,currency}]` and a short preview. Keep complete evidence server-side.
2. **B:** Expose A's output at `GET /api/catalog`; the route contains no fixture or extraction logic.
3. **C:** Render 3–4 fixture cards in Host A and an independent minimal list in Host B; both mount the same `AddCompareButton` and variant picker. Require an explicit variant. Maintain `selected: [{listing_id,variant_id}]`, maximum four.
4. **C:** In `luna-widget`, show a persistent `Compare 3/4` bucket with exact-variant badges and remove controls. Prevent duplicate exact variants; allow two distinct variants from one listing.
5. **B:** Implement `POST /api/comparisons`. Validate 2–4 items, ask A's provider to validate IDs, reject duplicates, call A's `build_comparison_evidence` once, and save selected identity + evidence in B's session store. Return the complete response with `comparison_id` and `revision:0`.
6. **C:** “Compare now” posts the selection, navigates to existing `#/Compare?comparison_id=<id>`, and renders the returned response. Fixture mode exists only in tests; the final runtime has no fallback data path.

### DoD F1

- [ ] Can add A:100W, B:87W, C:100W and remove any one.
- [ ] Both hosts show **exact variant** labels and variant-specific prices using the same widget package.
- [ ] Invalid variant API request fails; no silent default to the first variant.
- [ ] `Compare now` with 1 or 5 items is disallowed; 2–4 works.
- [ ] Refresh of the comparison URL either loads the persisted in-process comparison or shows a clear expired-state message. Do not silently fabricate a replacement bucket.

---

## 4. Feature F2 — Evidence-backed specification normalization (P0)

**User problem:** Sellers describe identical concepts in different words and units, and sometimes contradict themselves.

**Owner:** A; C renders the output through the reusable widget in both hosts.

### Processing algorithm (one selected variant at a time)

1. **Freeze schema:** For this hackathon use a fixed **power-bank schema** (not dynamic schema generation): `capacity_mah`, `max_output_w`, `usb_c_ports`, `weight_g`, `max_input_w`, `pd_supported`, `included_cable`, `warranty_months`. Add at most 2 extra fields if all three samples support them. Field meanings are documented, especially “max output for selected SKU.”
2. **Build evidence index:** Give each seller title, selected variant, structured attribute, and description paragraph a stable source ID. Retain exact original text and optional source location. Mark general marketing text as listing-level until clearly applicable.
3. **Batch extract using Responses structured output:** One call per item, **not one call per field**. Input = selected variant + all relevant evidence IDs and strings + the fixed field schema. Ask model for raw candidate values with exact source IDs, explicit applicability to selected variant, and `supported/missing/conflicting/unresolved`. Use Pydantic parsing/JSON schema; reject invalid output.
4. **Normalize in Python:** `kg→g`, `Ah→mAh`, `years→months`, bool aliases; use deterministic parser and dimension checks. Do not convert apparent 20Ah into mAh if context says an unrelated battery value; validate relevance and units.
5. **Validate:** Verify citation ID exists; supporting quotes match source; no fact uses data from unrelated variant; range checks (`weight_g > 0`, `max_output_w > 0`); explicit conflict preservation. Fail a questionable cell as `unresolved` rather than guessing.
6. **Bound external work:** make exactly one extraction request per selected item, so one comparison makes at most four extraction calls. Calls may run concurrently. A typed failure produces `Analysis unavailable` for that item and preserves the other items; never invent unresolved facts, switch strategies or retry automatically.
7. **A/B boundary:** A returns `ComparisonEvidence`; B's `POST /api/comparisons` wraps and saves it as `ComparisonResponse`. `GET /api/comparisons/{id}` returns that latest response. There is no separate `/analyze` state or route.
8. **C:** Render columns as exact SKUs; rows as schema fields. Each **supported** cell is clickable; drawer displays original source quote(s) and variation. Missing displays `Not stated`; conflicting displays `⚠ Conflicting`; unresolved shows `Could not verify`. Add “Differences only” calculated from normalized values, not by an LLM.

### Extraction prompt (keep in A-owned `services/luna-api/app/evidence/prompt.py`)

```text
Extract technical specifications for ONE explicit selected variant.
Only use supplied seller evidence. Do not use product knowledge or web facts.
Do not copy a sibling variant's specifications unless evidence explicitly applies to this variant.
For every supported field include evidence IDs that genuinely support it.
If absent mark missing; if credible claims disagree mark conflicting and return both;
if unclear which SKU a claim describes mark unresolved.
Preserve raw values; do not calculate unit conversions yourself.
Output exactly the supplied structured schema, with no surrounding prose.
```

### DoD F2

- [ ] A selected 100W variant never inherits the sibling 130W value on the leakage fixture.
- [ ] `0.42 kg` displays as `420 g` while drawer preserves `0.42 kg`.
- [ ] C missing weight displays `Not stated` (not invented or hidden).
- [ ] C contradictory warranties display both conflicting source snippets.
- [ ] Every green/supported cell links to valid source evidence.
- [ ] Differences toggle actually changes the table rows.
- [ ] A failing model call does not break the whole comparison or emit invented output.

---

## 5. Feature F3 — Review Intelligence (P0)

**User problem:** Reading 50–200 reviews and inferring differences is expensive; simple star ratings obscure specific strengths and recurring complaints.

**Owner:** A for pipeline, C for UI. B may use Decisions API to triage review mentions **only after** F3's cited extraction works.

### Explicit scope

Use **12–20 sampled demo reviews per listing**, not a claim to cover all marketplace reviews. Treat the count as “among reviews analyzed,” **never** defect prevalence. Different SKU variants may share a listing's reviews: preserve variant tag `variant_id | null` and distinguish variant-specific from general aggregate. Do not call your approach fake-review detection.

### Step-by-step implementation

1. **A:** Store each review as `{review_id, listing_id, variant_id|null, rating, text, created_at|null, source:"fixture"}`. Keep the original review text immutable.
2. **A:** Define fixed aspects: `heat`, `portability`, `charging`, `reliability`, `value`, and `other`; sentiment: `positive`, `negative`, `neutral`. Define what counts as **actual experience** vs irrelevant/seller-promotion statement. A review can contain **multiple** mentions with distinct aspects; ignore purely speculative claims.
3. **A:** Make one Responses structured-extraction call per **batch of 10–20 reviews**, output a list of `ReviewMention` with `review_id`, `aspect`, `sentiment`, and exact **quote substring**. Validate the quoted substring against the saved review. Drop invalid mentions; do not invent excerpts.
4. **A:** Make aggregates in deterministic code: group by `(item_key, aspect, sentiment)`, compute unique **review counts** for each aspect (count a review once per aspect/sentiment; define how mixed sentiment is handled), `analyzed_reviews`, and a list of `mention_ids`. Do not infer complaint probabilities from these counts.
5. **A:** Handle unknown variant reviews: either store in `listing_level_insights` and label them, or exclude from exact-SKU ranking. For hackathon UI, show clearly marked “Listing-wide reviews” below the variant-specific panel if necessary.
6. **C:** Build a Reviews tab directly next to the Specs tab. Each product has aspect chips with e.g. `Heating: 4 negative mentions (of 18 reviews analyzed)`. A comparison view aligns the **same aspect** for A/B/C. Clicking the number opens supporting original review excerpts + review IDs.
7. **B:** Expose a tool `get_review_aspect(comparison_id, item_keys, aspect)` which returns the stored aggregates and supporting review IDs, **not raw unbounded reviews**. Luna can say what reviews mention, not assert physical product quality as certain.
8. **Optional fast-path with Decisions API:** After extraction, classify ambiguous mention snippets with a fixed `choice` question (`positive/negative/neutral`) using `client.decisions.create(model="gpt-6-luna", input=..., questions=[...])`. Decisions returns a typed category/probability; it does not generate the review evidence contract. **Never substitute Decision probability for evidence**; keep quote-substring validation. Retain this path only if the same held-out review set shows a measured precision, latency or cost improvement over Responses structured extraction.

### Source contract

```json
{
  "item_key": "listingA:100w",
  "aspect": "heat",
  "positive_count": 1,
  "negative_count": 4,
  "neutral_count": 0,
  "analyzed_reviews": 18,
  "mention_ids": ["m14", "m15", "m22", "m33", "m41"]
}
```

The UI must render **“4 negative heat mentions / 18 reviews analyzed”**, **not** “22% of products overheat”. Mention counts are sample-specific; reviewers may be selected/nonrepresentative.

### DoD F3

- [ ] At least 3 product columns and 3 comparable review aspects visible.
- [ ] Review excerpt drawer can trace every mention to a stored original review ID and exact text.
- [ ] Mixed review yields multiple aspects when justified by text.
- [ ] Reviewer saying “gets warm” is not silently equated with a verified safety defect.
- [ ] No aspect-level aggregate mixes unknown variants into a selected-SKU fact without labelling.
- [ ] “What do reviews say about heat?” works in Luna without fresh unsupported claims.

---

## 6. Feature F4 — Luna Decision Agent (P0; highest AI priority)

**User problem:** Traditional comparison tables still require buyers to turn needs into attributes, set filters, interpret trade-offs, and manually change the UI. This is where GPT meaningfully reduces friction.

**Owner:** B for Luna service/tools, C for the portable widget UI and revision handling.

### 6.1 Agent behavior vs simple chatbot

User says: *“I travel a lot. Keep the price below S$80; I only need 65W, and portability is more important than maximum charging speed.”*

Luna MUST:

1. Interpret `price_minor <= 8000`, `max_output_w >= 65`, and portability priority.
2. Query normalized specification **and review** evidence; treat missing weight as uncertain.
3. Run **server-owned deterministic filtering/ranking**, never invent a score in the LLM response.
4. Change UI: filter out hard-ineligible products (or visibly mark excluded), focus `weight_g`, `price`, `max_output_w`, and highlight the recommendation.
5. Say which source facts support the choice and what remains unknown.
6. Accept corrections: *“Actually reliability matters more”* updates preferences and reruns ranking **without re-extracting listing data**.

### 6.2 State: backend truth, frontend projection

```json
{
  "comparison_id": "cmp123",
  "revision": 3,
  "preferences": {
    "max_price_minor": 8000,
    "min_output_w": 65,
    "priorities": ["weight_g", "review_reliability", "price_minor"]
  },
  "ui_patch": {
    "base_revision": 2,
    "new_revision": 3,
    "focused_fields": ["weight_g", "max_output_w", "price_minor"],
    "excluded_item_keys": ["listingB:87w"],
    "highlight_item_key": "listingA:100w",
    "active_tab": "specs"
  }
}
```

**Do not let a model directly mutate React state or call host-specific APIs.** The model calls constrained application functions; the server checks IDs, permissions, budget/filters, and revision; the frontend applies only a validated `ui_patch`. Store `conversation_id` and bounded previous user-assistant turns. Remember only explicit shopping preferences, never infer sensitive characteristics.

### 6.3 Exactly four required tools (not ten)

1. `get_comparison(comparison_id)` → normalized facts, exact item keys, known prices, selected variant labels, current preference state (omit massive descriptions).
2. `get_review_aspect(comparison_id, aspect, item_keys)` → review counts + citation/mention IDs.
3. `apply_preferences(comparison_id, patch, expected_revision)` → validates permitted fields; merges with current preferences; reruns deterministic filter/ranking; saves state; returns `ui_patch`, ranked candidates, uncertainties, and new revision.
4. `inspect_evidence(comparison_id, evidence_ids)` → exact source details for already stored citations.

**Tool choices:** Never expose arbitrary database access, raw provider operations, or `eval`. `apply_preferences` is the only P0 state mutation. It can update *view and decision state* but **cannot purchase, add to cart, message sellers, or trigger payments**. Tool handler enforces budget, ID membership, and optimistic revision checks. If a concurrent turn supersedes a previous turn, its stale `ui_patch` is dropped.

### 6.4 Deterministic recommendation rules

- **Hard constraints**: budget and minimum advertised power. If a field is missing/conflicting, mark the candidate `uncertain`, not passed or failed by guessing. Present uncertain candidates separately (don't silently exclude them unless buyer chooses strict verification-only).
- **Preferences**: choose weight ordering explicitly from user text (`portability > price > power`). Use numeric normalization only when values are comparable, and keep model-generated qualitative claims out of score.
- **Review reliability**: use review mentions as **uncertain supporting signals**; do **not** convert handfuls of complaints into objective reliability scores. During P0, ranking on objective price/weight/power is deterministic and review insights can be explanatory/tiebreaker only with caveat.
- **Missing data**: unsupported comparison dimension contributes **no score**; disclose incomplete comparison. Do not award maximum or zero by default.
- **No preference supplied**: Luna asks **one high-information question** (e.g., budget vs portability) instead of fabricating a universal winner.
- **Tie/close score**: present a shortlist and one key tradeoff; no forced singleton winner.
- **Evidence**: each named product fact in Luna's narrative references IDs or structured fields that already have evidence.

For P0 use a **lexicographic ranking** over explicitly ordered priorities (simple, explainable) rather than an opaque weighted score: first apply hard filters; sort by the first fully comparable priority, then subsequent priorities to break ties. For missing attributes, mark incomplete and show candidates separately. This is easier to defend and test than guessed weights.

### 6.5 Responses API function-call execution loop

Implement `run_luna(comparison_id, message, conversation_id)` using the OpenAI SDK and `model="gpt-6-luna"`, four JSON-schema function tools. The loop must:

1. Construct a **trusted system instruction** + compact comparison snapshot + permitted tools + bounded chat history. Treat listing/review text as **untrusted source data**, never instructions.
2. Call `client.responses.create(...)` with the tool schemas. If a response includes `function_call` items, validate the requested tool and JSON arguments.
3. Execute each allowed function in your own Python code and produce `{type:"function_call_output", call_id:..., output: JSON_STRING}`. Continue with `previous_response_id` (or carry output items for compatible model flow). Cap to **three tool rounds** per user turn.
4. If the model produces unsupported facts/citation IDs, reject/repair or return a conservative answer. Validate final `citation_ids` against current evidence and review mentions.
5. Return `{conversation_id, answer, cited_ids, recommendation, ui_patch, request_id}` to React. The API should not return private reasoning or raw tool internals.
6. On OpenAI timeout: return a friendly retry status, preserve comparison state, and show existing deterministic table. Distinguish “tool action completed but model response failed” so retry does not duplicate mutations.

**Endpoint:** `POST /api/comparisons/{id}/ask`

Request:

```json
{
  "conversation_id": "conv1",
  "message": "Below S$80, at least 65W; prioritize weight.",
  "expected_revision": 2
}
```

Response:

```json
{
  "conversation_id": "conv1",
  "request_id": "req42",
  "answer": "Among products with verified weights ...",
  "cited_ids": ["listA:description:line7", "listB:attribute:weight"],
  "recommendation": {"item_key": "listingA:100w", "limitations": ["C weight not stated"]},
  "ui_patch": {
    "base_revision": 2, "new_revision": 3,
    "focused_fields": ["weight_g", "price_minor", "max_output_w"],
    "excluded_item_keys": ["listingB:87w"],
    "highlight_item_key": "listingA:100w", "active_tab": "specs"
  }
}
```

**Example values are contract illustrations, not real measurements or an endorsed recommendation.** The returned recommendation must be computed from the current sample data.

### 6.6 Frontend UI patch reducer

C implements `applyUiPatch(patch)` **inside `packages/luna-widget`** with guards: current comparison ID matches, `patch.base_revision === current.revision`, all referenced item keys and field keys exist; otherwise fetch latest comparison and reconcile. Do not apply partial/stale updates. Luna text pane shows chat response with evidence chips and a status such as “Updated comparison priorities.”

### DoD F4

- [ ] “Under S$80 and >=65W, prioritize portability” causes **actual UI filters/focus and a citation-backed answer**.
- [ ] “Actually prioritize price” changes recommendation/filter ordering without regenerating facts or reviews.
- [ ] “What do reviews say about heating?” invokes review tool and cites review excerpts.
- [ ] User can click citation to open source evidence.
- [ ] A made-up item ID or field in a tool call is rejected by server validation.
- [ ] “Pick the best” with no criteria either asks one clarification or explicitly declares the ranking basis.
- [ ] A newer correction wins; late results from an older request cannot overwrite it.
- [ ] Failed agent call leaves existing table usable.

---

## 7. Feature F5 — GPT-Live voice (P1, FIRST stretch)

**User problem:** Users should not have to type detailed requirements or interact with many filters. They can talk, interrupt, and correct themselves while inspecting the comparison.

**Owner:** B (session/delegation and server-side function execution), C (WebRTC/browser inside `luna-widget`). A has no Live work.

**Verified integration path:** The current GPT-Live docs describe **`gpt-live-1`**, WebRTC sessions at `POST /v1/live/sessions`, **Responses delegation** to a model such as `gpt-6-luna`, and backend function tools. The model providing conversation is different from the model handling tasks. Use these precise docs rather than an older Realtime tutorial: https://developers.openai.com/api/docs/guides/live, https://developers.openai.com/api/docs/guides/live-delegation, https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=live .

### Minimum voice implementation, in order

1. **B:** Create `POST /api/comparisons/{id}/live/session` that accepts `{"sdp":"..."}`. Verify comparison exists and user is authorized for it (demo session ID if no login). From the trusted server, call `POST https://api.openai.com/v1/live/sessions` (or the equivalent method in the installed SDK after verifying it against the current docs) with `session` and `transport:{"type":"webrtc","sdp":...}`; return the provider's unchanged `session.id` and `transport.sdp`. Never expose the API key. Use `model:"gpt-live-1"` and `delegation:{type:"responses", responses:{model:"gpt-6-luna", instructions:..., tools:[YOUR FUNCTION SCHEMAS], tool_choice:"auto", parallel_tool_calls:false}}`. Start with `get_comparison`, then add `apply_preferences` and `get_review_aspect`.
2. **C:** Implement standard browser `RTCPeerConnection`; add microphone track from `getUserMedia({audio:true})`, remote audio playback, and a data channel named `oai-events`. Create offer, POST its SDP to your API, set returned remote SDP answer. Wait for `session.started` before marking Live ready. Clean up mic tracks and peer connection on stop/unmount.
3. **B:** Copy the same four tool JSON schemas and **same underlying Python functions** from F4 into Live delegation. Configure backend instructions to use tools for any product factual claim or preference change. **Choose one executor**: the **server-side sideband WebSocket** (`wss://api.openai.com/v1/live/sessions/{session_id}/attach`) owns all tool execution. The browser only handles microphone, playback, captions, and screen state. The server-side connection observes function-call events and sends results. Never execute the same tool from both browser and server.
4. **C:** On data-channel transcript events, show captions **as provisional**, not already-committed preferences. When the tool returns a confirmed `ui_patch`, apply it with the same revision guard used for text mode. If voice events do not surface the patch directly, use a short-poll `GET /api/comparisons/{id}` after confirmed backend mutations. This requires B to save each mutation server-side.
5. **B:** Include concise **UI context** in Live session (selected item keys, current comparison revision, active tab and explicitly set preferences), so “this one”, “actually”, and interruptions refer to the right candidates. Push updates when selection changes; don't send full DOM or raw pages.
6. **B/C:** Implement cancellation/stale-turn protection: if user says “Actually under S$70” before earlier analysis finishes, only the latest committed revision is applied. Never cancel a completed mutation by pretending it did not happen; check state and issue a corrective change.
7. **C:** Voice control supports `Start`, `Mute`, `Stop`, clear connection status, caption preview, and text fallback. `Stop` gracefully closes Live session, releases tracks, and handles `session.closed`.

### 7.1 The exact tool-event relay (do not skip)

**B owns this loop.** Follow [Server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls) and [Live delegation events](https://developers.openai.com/api/docs/guides/live-delegation):

1. After the Live create-session response returns `session.id`, B attaches a **server-authenticated sideband** WebSocket to `wss://api.openai.com/v1/live/sessions/{session_id}/attach`; associate session with the comparison ID. Do not call `session.start` again. (If a sideband isn't viable, the documented alternative is to forward function-call events from the browser data channel to an authenticated backend, and return results through the data channel; **do not implement both**.)
2. On top-level event `session.delegation.created`, record `delegation_id` and `response_id`. Delegated Responses events are wrapped as `{type:"response.event", delegation_id, event:{...}}`.
3. Watch for nested **`response.output_item.done`**. If `event.item.type == "function_call"`, read **`call_id`**, `name`, and `arguments`. **Do not execute on an arguments-delta event**; wait for the completed function item. Accumulate all completed pending calls for that backend response.
4. Validate `name` against the four allowlisted F4 tools. Parse JSON with Pydantic; verify comparison ID, session authorization, item/field IDs, and revision. Execute the same backend tool handler as text Luna **once**. Save result/state, including `ui_patch`, before replying. For errors, return a structured error as the tool result instead of an unhandled exception. Deduplicate `(session_id, call_id)`.
5. For each pending function call, send on sideband `response.item.create` with `item:{type:"function_call_output", call_id, output: JSON.stringify(tool_result)}`. **After all required calls have a result**, send `response.create` exactly once to resume delegated reasoning. Sending the output item alone does not resume it. If more calls appear, repeat this cycle, capped by your tool-round policy.
6. After `apply_preferences` succeeds, C can poll `GET /api/comparisons/{id}` every 500–1000 ms **while voice is connected**, then re-render when `revision` increases. This is simpler than building another push channel in seven hours. C never assumes that a partially transcribed preference is committed. No Live handler imports either demo host.

**Event shape example (illustrative):**

```json
{"type":"response.event", "delegation_id":"item_xyz", "event": {
  "type":"response.output_item.done", "item": {
    "type":"function_call", "name":"apply_preferences", "call_id":"call_123",
    "arguments":"{\"comparison_id\":\"cmp123\",\"patch\":{\"max_price_minor\":8000},\"expected_revision\":2}"
}}}
```

**Send results (documented Live event names):**

```json
{"type":"response.item.create", "event_id":"tool_result_123", "item": {
  "type":"function_call_output", "call_id":"call_123",
  "output":"{\"ok\":true,\"new_revision\":3}"
}}
```

Then: `{"type":"response.create","event_id":"continue_123"}`. **All values above are examples, not recorded API events.** Use provider-generated IDs unchanged and preserve call ordering.

**DoD for this relay:** server log shows `session.delegation.created` → completed function-call item → actual `apply_preferences` state mutation → matching function-call output → `response.create` → new spoken answer. Refreshing `GET /api/comparisons/{id}` reports incremented revision. If any link is missing, voice is not integrated.

### Voice prompt separation

**Live conversation prompt (short):**

```text
You are Luna, a concise, friendly shopping companion. Let the buyer finish or interrupt.
When a question requires listing facts, review evidence, or a change to preferences,
delegate to your backend. Never guess product specifications or claim an action completed
before backend confirmation. Say what changed in plain language.
```

**Delegated backend instructions (detailed):** use the exact F4 constraints, tools, and source-grounding policy. Backend only can rank/modify state through server functions.

### Voice test script

1. Start Live and ask: “Which is best if I travel every week?” → Luna asks or infers only justified priorities; product facts come from comparison.
2. “I want under eighty dollars and at least sixty-five watts.” → tool updates budget/min output; UI updates.
3. Interrupt: “Actually, forget speed. Weight is what matters.” → new priorities; UI changes again, with a cited tradeoff.
4. “Why do you say that?” → explains evidence; voice and UI refer to same recommendation.

### DoD F5

- [ ] Mic audio reaches GPT-Live; generated voice plays; browser shows connected state.
- [ ] At least one spoken constraint **invokes backend tool execution and changes the existing comparison state/UI**.
- [ ] A correction/interrupt changes a preference without duplicate or stale actions.
- [x] Provisional captions and Live connection state are covered by deterministic browser tests.
- [x] API key not present in browser. Mic permission denied → text Luna remains usable.
- [x] `Stop` waits for `session.closed`, releases mic, and session errors preserve text mode in deterministic tests.

**Failure policy:** Voice without real tool-backed UI mutation is **not done**. Cut it from the main demo if integration fails.

---

## 8. Optional features — only after G4

Do not start these while a P0 or portability test is red. B chooses **at most one**; C adds UI only after B returns a tested endpoint. A does not take optional work before `eval/results.json` exists.

| Option | Owner | Smallest implementation | Pass condition | Otherwise |
|---|---|---|---|---|
| **Screenshot match (preferred)** | B endpoint, C confirmation UI | Validate PNG/JPEG/WEBP ≤8 MB; send image plus compact fixture catalog to `gpt-6-luna`; validate returned catalog IDs | Known image suggests listing; ambiguous variant stays `null`; user explicitly confirms through existing picker | Cut; never auto-add or claim visual SKU verification |
| **Decisions benchmark** | B | Run fixed review aspect/sentiment choices on the same held-out labels as Responses | Keep only if precision, latency or cost improves with no evidence loss | Record result; do not add a demo button |
| **Web investigation** | B | User requests one missing/conflicting field; use `{type:"web_search"}` for exact model only; render clickable `url_citation` separately from seller evidence | Exact identity, bounded request, clickable citation, seller claim not overwritten | Stop on identity ambiguity; no autonomous research |
| **Scheduled watch** | B, only with spare time | Agents scheduled automation plus refreshable authorized data, followed session result, idempotency and real in-app delivery | Schedule executes, session work reaches terminal result and outcome is shown | Roadmap only. Dots is inspiration, not an embed API; fixture simulation is labelled as simulation |

**Priority:** screenshot match first because it removes a visible search step. Decisions is an invisible optimization. Web search and scheduling are P2 and should normally be presented as roadmap in a seven-hour build.

---

## 9. Exact backend routes and payload contracts

| Endpoint | Method | Owner | Tier | Request → response |
|---|---|---|---|---|
| `/api/health` | GET | B | P0 | → `{"ok":true}` |
| `/api/demo-sessions` | POST | B | P0 | → `{token,expires_at}`; bind subsequent comparison requests |
| `/api/catalog` | GET | B | P0 | → `{listings:[...]}` from A's provider |
| `/api/comparisons` | POST | B | P0 | `{items:[{listing_id,variant_id}]}` → complete `ComparisonResponse`; calls A's `build_comparison_evidence` once |
| `/api/comparisons/{id}` | GET | B | P0 | → latest saved `ComparisonResponse` |
| `/api/comparisons/{id}/ask` | POST | B | P0 | `{conversation_id,message,expected_revision}` → answer + citations + `ui_patch` |
| `/api/comparisons/{id}/live/session` | POST | B | P1 | `{sdp}` → unchanged Live provider `session` + `transport.sdp` |
| `/api/catalog/match-screenshot` | POST | B | Optional | image → validated catalog suggestion; never auto-add |

**Error envelope, everywhere:**

```json
{"error":{"code":"INVALID_VARIANT","message":"Unknown selected variant","retryable":false}}
```

**Concurrency:** each change to preferences increments revision; if a request contains old `expected_revision`, return `409 STALE_COMPARISON` with current revision; client refreshes and may re-submit the **user's newer intent** once. Key each agent turn with `request_id`; never apply a stale UI patch. For demo store `comparison_id`, `conversation_id`, and `revision` in memory.

**Frontend:** all server data typed. The comparison response is the canonical state; `ui_patch` modifies presentation and server-saved preferences. Do not let React invent evidence IDs or perform authoritative ranking client-side.

---

## 10. Test plan — exact fixtures, metrics, and command

### 10.1 Minimum benchmark data (realistic for 3 developers)

- **Specs:** 12 exact SKU fixtures, 3–4 comparison sets, ~8 fields each. At least 3 multi-variant collisions, 3 missing fields, 3 contradictions, 3 unit conversions.
- **Reviews:** 45–60 short labelled review texts, spanning 3 listings, 5 aspects, positive/negative/mixed/no-aspect. Keep source samples and expected mentions separately.
- **Agent:** 12 scripted utterances: budget, power threshold, priority inversion, unclear intent, review query, contradictory claim, missing field, stale-turn correction, invalid item key, no survivors, product tie, “why?”.
- **Voice (if P1):** 3 spoken scenarios: initial intent, preference correction mid-answer, microphone denied fallback.
- **Vision (if P1):** 3 images: clear known listing, unknown product, same family/ambiguous variant.

Use held-out evaluation labels; never send labels to the extractor. All sample counts are targets, not measured achievements.

### 10.2 Scoring

| Metric | Definition | Why it matters |
|---|---|---|
| Exact-variant accuracy | correctly identified selected variants / labelled variants | Prevents false comparison |
| Supported-field accuracy | correct normalized supported values / labelled supported fields | Data correctness |
| Evidence precision | cited claims genuinely supported by cited sources / cited claims | Catches decorative/fake citations |
| Unsupported claim rate | emitted supported claims lacking valid evidence / emitted supported claims | Safety/trust |
| Missing-field recall | correctly abstained missing fields / labelled missing fields | Doesn't invent specs |
| Contradiction recall | detected ground-truth contradictions / true contradictions | Conflict handling |
| Variant leakage rate | sibling-SKU attributes misassigned / variant-sensitive fields | Marketplace-specific challenge |
| Review mention precision/recall | exact aspect+sentiment+support match against human labels | Review intelligence validity |
| Luna tool success rate | scenarios with correct tool calls + valid UI change / scripted scenarios | **Measures agentic behavior** |
| State-correction success | final state matches latest user correction / correction scenarios | Conversation reliability |
| Friction proxy | manual clicks/type interactions vs agent-assisted actions on matched scripted task | Do not claim production usability lift |
| Performance | p50/p95 latency, token count and estimated cost per comparison/turn | Practical constraints |

**Baseline comparisons:** regex specification parser vs ungrounded free-form extraction vs grounded structured extraction. For review extraction, use simple keyword baseline vs cited aspect extraction. For agent, compare (a) static prose-only assistant and (b) Luna tool-backed agent on the same 12 task scripts; grade **UI outcome** not verbal impressiveness. For friction, define identical start/end states and count taps/field edits—be explicit that proxy is a scripted analysis, not a user study.

### 10.3 Required tests, by component

**A (pytest):**
- `test_variant_leakage_100w_not_130w`
- `test_weight_conversion_kg_to_g`
- `test_conflicting_warranty_not_overridden`
- `test_missing_weight_abstains`
- `test_supported_requires_valid_evidence`
- `test_review_quote_must_be_substring`
- `test_review_unknown_variant_not_exact_sku`

**B (pytest, mocked model output plus at least one live integration):**
- `test_budget_filter_validates_currency_minor`
- `test_ranking_does_not_guess_missing_weight`
- `test_tool_call_rejects_unknown_item`
- `test_preferences_revision_conflict`
- `test_luna_citation_ids_exist`
- `test_old_turn_does_not_override_correction`

**C (Playwright/browser):**
- Host A cart → exact variants → comparison → evidence/reviews → ask → visible revision change.
- The same flow in Host B with the same widget/API.
- Import-boundary failure if the widget imports either host.
- Expired session, stale patch, API failure and microphone-denied text fallback.
- No browser API-key field, `VITE_*` OpenAI secret or direct request to `api.openai.com`.

**Commands:**

```bash
make api-test   # Python format, lint, typecheck and pytest; no provider call
make frontend-build # production builds for Host A and Host B
make e2e        # test-only fake OpenAI client + Playwright against both local hosts
make eval       # held-out fixtures -> eval/results.json
make api-capability-smoke # explicit paid Responses + Live capability check; not full browser voice
```

`make api-test`, `make frontend-build` and `make e2e` must be deterministic and must not spend API credits. The fake OpenAI client and WebRTC transport are injected from test code only; neither is selectable in the shipped runtime. `make api-capability-smoke` proves project access and provider session creation, not real browser audio/tool mutation. Any blank or N/A metric in `eval/results.json` remains blank on the slide.

**Numerical claims:** Report measured values only; never confuse offline accuracy or scripted click counts with a demonstrated conversion/GMV lift.

### 10.4 Minimal local E2E — run this before deployment

**Automated:**

```bash
make api-test
make frontend-build
make e2e
```

All three commands must exit `0`. `make e2e` must prove the same scripted flow in `shopee-compare-app` and `minimal-host`: select three exact variants → compare → open seller evidence → open review evidence → ask for `under S$80, at least 65W, portability first` → observe a revision and recommendation change → correct to `price first` → observe a newer revision.

**Real local app (not the Docker deployment proof):**

```bash
cp .env.example .env
# Put OPENAI_API_KEY in .env; never use a VITE_* key.
set -a; . ./.env; set +a
make api-dev
# In separate terminals:
npm run dev --workspace shopee-compare
npm run dev --workspace minimal-host -- --port 5174
```

The single Docker image and `make demo` are not implemented as of the status date. Do not use
the following future deployment URLs until section 11's runtime files exist and pass review:

```bash
curl --fail http://127.0.0.1:8080/api/health
# Host A: http://127.0.0.1:8080/#/Cart
# Host B: http://127.0.0.1:8080/minimal/
```

Run this manual script **twice from a fresh page**:

1. Host A opens with no browser API-key field and no console error.
2. Select three exact power-bank variants and open Compare.
3. Toggle differences; open one supported evidence cell, one missing field and one conflict.
4. Open Heating reviews and one literal review excerpt.
5. Type `Under S$80, at least 65W; prioritize portability`; confirm the UI revision and recommendation visibly change.
6. Type `Actually prioritize price`; confirm the same comparison receives a newer revision without re-extraction.
7. Open Host B and repeat add → compare → ask → cite with the same API.
8. If Live passed G4, speak the correction once; otherwise verify the visible text fallback and do not claim Live.

Save the command output and one screenshot per host under the team demo artifacts. If either run fails, do not deploy; the owner named by the failing boundary fixes it.

---

### 10.5 Integration and risk checklist (do not confuse demo portability with production readiness)

| Concern | Demo action | Real Shopee integration requirement |
|---|---|---|
| Marketplace data | `MockCatalogProvider` and deterministic snapshots | Authorized APIs, listing/variant/review access scopes, rate limits, data retention policy |
| Identity | Session-scoped demo token + comparison ownership check | Shopee's approved sign-in/session, access controls, abuse prevention |
| UI | `LunaHostAdapter` with click and navigate callbacks | Compatibility with host framework, CSP, performance, accessibility, rollout flags |
| User action | Optional `requestAddToCart` with confirmation | Authorized cart write workflow, idempotency, fraud/safety checks, permission boundary |
| Freshness | Versioned local price snapshots | Time-sensitive price/stock/promotions, regional currency, cache invalidation |
| Privacy | Synthetic reviews and no real user PII | User consent and vendor policies, review privacy, data minimization |
| Reliability | Mock-failure paths, request timeout and retries | Observability, SLOs, scaling, feature rollback and cost controls |

**Definition of done:** Team can point to each unimplemented dependency rather than overclaiming. The mock demonstrates interoperability, **not** technical authorization to integrate with a production service.

---

## 11. Simplest demo deployment — one image, one service, one origin

Deploy only after section 10.4 passes locally and the starter-code licensing gate is resolved. Do **not** deploy the frontend and backend separately. B owns `Dockerfile`, `render.yaml` and `Makefile`; C only ensures both frontend build outputs exist.

### 11.1 Runtime shape

The multi-stage root `Dockerfile` must:

1. Run the locked root npm install and build both frontends.
2. Install the locked Python service dependencies.
3. Copy Host A's built files into the API image's static root.
4. Copy Host B under `/minimal/` and build it with that base path.
5. Start one FastAPI/Uvicorn process on `0.0.0.0:${PORT:-8080}`.

FastAPI registers `/api/*` first, mounts Host B at `/minimal`, then mounts Host A at `/` **last**. The existing HashRouter makes Host A's `/#/Cart` work without server rewrites. Both hosts call relative `/api` URLs, so there is no CORS configuration. Keep demo state in memory, one process, no database, worker, queue, cache or persistent disk. A restart clears sessions; that is acceptable and must be disclosed for the demo.

### 11.2 Render Blueprint

Use one Git-backed Docker web service on Render because it builds a root `Dockerfile`, supplies a public HTTPS URL and supports a health-check path. Keep this root `render.yaml`:

```yaml
services:
  - type: web
    name: shopee-compare-luna-demo
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /api/health
    autoDeployTrigger: off
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_TEXT_MODEL
        value: gpt-6-luna
      - key: OPENAI_LIVE_MODEL
        value: gpt-live-1
      - key: LUNA_CATALOG_PROVIDER
        value: mock
```

`OPENAI_API_KEY` is entered in the Render dashboard during Blueprint creation and is never a Docker build argument, repository value or frontend variable. Render requires the service to bind `0.0.0.0` and the `PORT` environment value; do not hardcode a production port. Current official references: [Render Blueprints](https://render.com/docs/infrastructure-as-code), [Docker deploys](https://render.com/docs/docker), and [web-service port binding](https://render.com/docs/web-services#port-binding).

### 11.3 Deploy and smoke-test

1. Re-run `make api-test`, `make frontend-build`, `make e2e` and the two manual local text runs.
   Run the paid capability smoke or real G4 microphone check only with explicit authorization.
2. Commit and push the tested branch.
3. In Render: **New → Blueprint** → connect the repository → select the pushed branch → keep the root `render.yaml` path → enter `OPENAI_API_KEY` → **Deploy Blueprint**.
4. Wait until `/api/health` passes. Copy the assigned HTTPS URL.
5. Run:

```bash
export DEMO_URL='https://<assigned-service>.onrender.com'
curl --fail "$DEMO_URL/api/health"
# Open "$DEMO_URL/#/Cart"
# Open "$DEMO_URL/minimal/"
```

6. Repeat the section 10.4 P0 script once on the public URL. Test microphone permission and one Live correction only if G4 passed locally.
7. Turn off automatic deploys during judging; deploy a new commit only after the same local gates pass again.

**Deployment pass condition:** health returns `200`; Host A and Host B load over HTTPS; text Luna executes a real tool and visibly changes the comparison; citations open; no key appears in browser source/network payloads; server logs contain no uncaught error. If public Live fails but text works, cut Live rather than changing deployment architecture.

---

## 12. End-to-end acceptance stories (required rehearsals)

### Story A — compare + explain (P0)

**Given:** 3 demo listings, exact variants selected, one missing weight, one contradictory warranty.  
**When:** User taps “Compare now” and “Differences only.”  
**Then:** Same 8 normalized fields appear, identical rows collapse, every supported cell opens seller quote, missing and conflict are explicit.  
**Definition of done:** no fabricated or sibling-variant spec; two repeat runs pass.

### Story P — independent-host portability (P0)

**Given:** `shopee-compare-app` and `minimal-host` have separate routes/styles and host adapters.
**When:** Add variants, compare, ask Luna for a budget filter, open cited evidence in each.  
**Then:** both render the same output (modulo layout), hit the same service and validate the same IDs.  
**Definition of done:** no changes to `packages/luna-widget` or `services/luna-api` to add the second host; log/screenshots from both runs and working adapter tests.

### Story B — reviews (P0)

**Given:** ~18 saved reviews per item, with literal quoted mentions.  
**When:** User switches to Reviews and asks “Which one has more heating complaints?”  
**Then:** Aligned aspect counts with denominators appear; Luna cites matching review IDs and says sample/variant limitations.  
**Definition of done:** every cited review can be opened and verified; no objective failure-rate claim.

### Story C — agentic preferences (P0)

**Given:** comparison currently shows all candidates.  
**When:** User types “I want under S$80, at least 65W, portability first.”  
**Then:** Luna calls tools, server applies constraints, UI highlights matching candidates and focused fields, explains one choice and missing-data caveat.  
**When:** User types “Actually price is more important.”  
**Then:** same comparison data remains; preference ordering and UI recommendation update.  
**Definition of done:** reviewer can see backend tool log + visible changed UI; no static scripted response.

### Story D — Live (P1)

**Given:** Story C works in text.  
**When:** User speaks the same two turns including a correction.  
**Then:** GPT-Live talks and delegates; **the same backend tools** produce **the same UI state**.  
**Definition of done:** genuine microphone, network Live session, tool execution, revision-safe state, usable stop/fallback.

## 13. Judge-facing demo (75–90 seconds, P0 + Live if working)

**0–12 s — problem/fit:** “Three exact power-bank variants, incompatible seller formats and dozens of reviews normally require repeated opening, remembering and filtering.” Add the variants in one bucket.
**12–28 s — build quality/trust:** Show the normalized comparison; click one seller quote and the conflicting warranty. “Luna does not guess.”
**28–40 s — domain intelligence:** Open the aligned heat-review aspect and one original review ID/quote. State the analyzed-sample limitation.
**40–68 s — AI-native action:** Say to GPT-Live (or type): “Under S$80, at least 65W, prioritize portability.” Show the real tool call and visible table mutation. Correct it with “Actually prioritize price,” and show the new revision without re-extraction.
**68–80 s — originality/portability:** Switch to `minimal-host`, showing the same widget/service and comparison state through a different adapter.
**80–90 s — measured value/Codex:** Show only measured `results.json` values—tool success, evidence precision, friction proxy, p95 latency and cost—and point to the short Codex build log. Keep the AI-Native Products alignment visible on the scorecard.

**Pitch sentence:** “Luna is an AI-native, portable marketplace decision layer; instead of merely answering a question, it **removes the sequence of actions** between having a shopping need and making an evidence-backed choice: normalize, inspect, constrain, compare, explain and correct—through text or voice.”

If Live isn't ready, use text mode **without faking audio integration**. A reliable tool-using text journey scores better than a nonfunctional voice demo.

**Demo rule:** Name a GPT capability only after showing the user or business step it removes. Do not spend demo time listing APIs.

---

## 14. API and platform references verified on 31 October 2026

- GPT-6 Luna model capabilities (Responses, tools, structured outputs, image input): https://developers.openai.com/api/docs/models/gpt-6-luna
- Responses API function calling (tool-call result feedback loop): https://developers.openai.com/api/docs/guides/function-calling
- Structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Decisions API (`POST /v1/decisions`, `gpt-6-luna`, fixed-choice/predicate/score): https://developers.openai.com/api/docs/guides/decisions
- GPT-Live getting started: https://developers.openai.com/api/docs/guides/live
- GPT-Live delegation (Responses/client, custom functions, transcript events, UI context): https://developers.openai.com/api/docs/guides/live-delegation
- GPT-Live create-session reference (`POST /v1/live/sessions`, WebRTC `session` + `transport`): https://developers.openai.com/api/reference/resources/live/methods/create
- GPT-Live WebRTC quickstart (`session.started`, `session.close`, `session.closed`): https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=live
- GPT-Live server-side sideband and exactly-once tool ownership: https://developers.openai.com/api/docs/guides/voice-server-controls
- Images and vision (image inputs to a vision-capable model): https://developers.openai.com/api/docs/guides/images-vision
- Hosted web search: https://developers.openai.com/api/docs/guides/tools-web-search
- Agents API scheduled automations: https://developers.openai.com/api/docs/guides/agents-api/sessions/automations
- Dots product behavior and access (ChatGPT experience, not a Luna embed API): https://learn.chatgpt.com/docs/dots
- SEA × OpenAI hackathon: https://codexhackathon.sea.com/
- Render Docker deploys: https://render.com/docs/docker
- Render Blueprints: https://render.com/docs/infrastructure-as-code
- Render web-service port binding and HTTPS endpoint behavior: https://render.com/docs/web-services

**Access caveat:** A documented API is not evidence that *your particular OpenAI project* has access, available credits, compatible SDK version or regional entitlement. Dots has separate ChatGPT plan/region/workspace availability and is not required by Luna. **B must smoke-test the required Responses function call and GPT-Live session creation in B1.** Test Decisions only if B5 benchmarks it; test Agents automations only if F8 remains in scope. Use exact names and request parameters from the installed SDK and official quickstart. Pricing/access may change, so log rather than assume.

---

## 15. Final sign-off matrix

| Test | Responsible | Pass condition |
|---|---|---|
| Registration/build direction | All | Demo, scorecard and pitch consistently present Luna as an **AI-Native Product & Operation** |
| Contract compatibility | A + B + C | A evidence schema, B OpenAPI wrapper and C generated types agree on statuses, IDs and price units |
| Provider swapping | A | Swap mock fixture/source via provider injection and core Luna code unchanged |
| Tool truthfulness | B | Filter/rank tool is actually executed; cited facts resolve; invalid/stale calls rejected |
| 2026 capability truth | B | Current official docs and installed SDK were checked; required Responses and Live smoke results are recorded; Decisions is reported only if attempted; Dots is not represented as an API |
| Same widget in two hosts | C | Two independent adapters, no Luna package/service edits; functional parity recorded |
| Spoken decision | B + C | Real GPT-Live call executes same backend tool and increments same comparison revision, or feature is explicitly cut |
| Review grounding | A | Review mention IDs and literal excerpts validate, with appropriate variant status |
| Demo / measured eval | A + B + C | Two successful end-to-end runs; honest benchmark metrics and clearly labelled synthetic data |
| Codex leverage | All | 6–8 consequential Codex tasks record files changed, human review/correction and exact verification output |

**Final operational rule:** Stop adding features to preserve a reliable, explainable and portable core. The most valuable new GPT feature is not a decorative button; it is a capability that actually removes an action and preserves evidence, state and user control.
