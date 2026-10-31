# Shopee Compare + Luna — Implementation Specification v3.0

**Date:** 31 October 2026  
**Event:** SEA × OpenAI hackathon  
**Team:** exactly 3 developers  
**Timebox:** approximately seven hours; feature freeze and rehearsal included  
**Deliverable:** a **portable Luna shopping-intelligence module** running in a mock Shopee-inspired storefront, with a second unrelated host proving integration portability  
**Status:** implementation plan; example products/reviews/metrics are fixtures, not observed results

> **Thesis:** Remove the manual steps between discovering candidate products and making a defensible purchasing decision. Luna turns messy seller listings and review text into evidence-backed comparisons; a buyer can adjust constraints by text or voice, and the visible comparison responds. **The module must not depend on the demo storefront's data structures, components, or checkout code.**

**One-line pitch:** “Luna is an embeddable AI shopping decision layer: a marketplace supplies product and review evidence; Luna normalizes, compares, explains, and acts on buyer preferences through text or voice.”

**Rule about ‘drop-in’:** We can prove *integration readiness* through defined host/data adapters and two independently implemented demo hosts. We **cannot** claim real Shopee integration without authorized internal APIs, authentication, event hooks, reviews, performance/security review, and Shopee engineering approval.

**Starter-code/licensing gate:** The inspected `neoB23/Shopee_E-commerce-Clone` is a React/Vite/Tailwind **frontend** whose product arrays are hardcoded (e.g. `Shopee/src/components/Section/discovery.jsx`) and whose public repo has no declared license. Do **not** assume that public source is freely reusable. Obtain author permission **and** organizer approval before incorporating it; otherwise build a minimal mock storefront during the hackathon. Treat other e-commerce clones as visual references, not architectural dependencies. Do not spend hackathon time reproducing all Shopee flows.

---

## 0. Scope, priorities, and non-negotiable success

| Priority | Deliverable | Friction eliminated | Owner | Gate |
|---|---|---|---|---|
| **P0** | **Portable Luna integration contracts + two hosts** | Rebuilding Luna for every storefront | A: catalog adapter, C: widget/host adapters, B: agent-service boundary | Same widget/API used in two hosts; only adapters change |
| **P0** | Exact-variant comparison bucket | Reopening and remembering shortlisted SKUs | C UI, A API | 2–4 explicit variants selected |
| **P0** | Grounded specification comparison | Reading inconsistent descriptions/units | A, C | Clickable source evidence, missing/conflict states |
| **P0** | Cross-product review intelligence | Reading dozens of reviews manually | A, C | Comparable aspects, original quoted review IDs |
| **P0** | **Luna text agent that uses tools** | Manually filtering, sorting, and explaining tradeoffs | B, C | Preferences cause a real backend state change and visible UI patch |
| **P1** | **GPT-Live voice over the same tools** | Typing filters and repetitive prompts | B voice backend, C audio/UI | Spoken preference changes same comparison revision |
| **P1** | Screenshot-based catalog matching | Re-searching a product shown in a screenshot | B + C | Suggestion requires variant confirmation |
| **P2** | External investigation of gaps | Manual cross-site checks | B | External claims are cited and separated from seller evidence |
| **P2** | Watchlist / scheduled re-check | Repeatedly checking saved candidates | B+A | True monitor only with refreshed data and actual scheduling |

**What not to build:** live Shopee scraping, real checkout/payments, seller administration, cart synchronization, authentication platform, browser extension, universal product schemas, fake Live interaction, or general-purpose multi-agent workflows.

**Required demo:** Three exact power-bank variants added → comparison of 8–10 normalized fields → review aspects with source texts → buyer says/types “Under S$80, at least 65W; prioritize portability” → Luna executes a tool, updates the compare UI and explains cited tradeoffs → “Actually prioritize price” updates the same session without re-extraction.

**Required portability proof:** Load Luna in a compact Shopee-inspired demo **and** a plainly styled `minimal-host` page. The host must supply only the adapter and context; no edits to `packages/luna-widget` or `services/luna-api` are allowed for the second host. A different CSS theme alone is insufficient: use a distinct host component tree, different routing/layout, and a separate host-adapter implementation.

**Cut order:** P2 investigation/watchlist first; P1 screenshot next; GPT-Live if its tool relay is not working by the cutoff. Do not cut evidence grounding, agent state mutation, or the second-host portability test. If behind schedule, reduce the storefront to one product grid and one product-detail route.

---

## 1. Ownership, coordination, and seven-hour gates

**Developer A — Marketplace data + evidence (Python).** Owns `CatalogProvider` and `MockCatalogProvider`, fixture snapshots, catalog/variant/review API, selected-SKU normalization, review-aspect analysis, provenance, evaluation data and scorer. **Boundary:** can change providers without changing the agent or frontend; is not responsible for React or voice. Immediately publishes a sample `ComparisonResponse` and a provider contract.

**Developer B — Luna decision service + OpenAI (Python).** Owns deterministic preference filtering/ranking, Responses tool schemas/executor, conversation state, API endpoints, GPT-Live session and sideband tool relay, and any gated vision/investigation/watchlist tasks. **Boundary:** cannot reference demo-host files or call the mock catalog directly; uses the `CatalogProvider`-backed comparison service. All mutations go through validated domain functions.

**Developer C — Portable Luna UI SDK + two demo hosts (React/TypeScript).** Owns `packages/luna-widget` public props and state, compare bucket/table, evidence/review drawers, Luna chat, voice widget, Shopee-inspired host, independent minimal host, adapter implementations and final demo. **Boundary:** `luna-widget` cannot import `apps/demo-shopee/*`, use a global mock catalog, or assume host routes/cart controls. Host integrations call the package's documented props/callbacks only.

**Team workflow:** At T+00:15 freeze core IDs, API payloads, package exports and error states. A owns Python schemas, C owns TypeScript equivalents, B tests schema compatibility. B and C use seeded responses while A builds extraction. Merge at ~T+01:30, T+03:00, T+04:30. Each change to a shared contract requires all three to approve; avoid parallel edits to a single giant component. One branch per owner and short PRs. Codex may generate boilerplate/tests, but the developers must understand and verify it.

| Elapsed | Developer A | Developer B | Developer C | Acceptance gate |
|---|---|---|---|---|
| **0:00–0:20** | Fixture, provider interface, canonical response JSON | API smoke test; tool and ranking stubs | Monorepo and reusable widget skeleton; host interfaces | Shared contract frozen, runnable skeleton |
| **0:20–1:30** | Mock provider, listing/variant endpoints, extraction pipeline | Pure ranking + function executors over sample response | First host grid, bucket, SKU selector, table | Widget renders without backend extraction |
| **1:30–2:45** | Evidence validation, review extraction and summaries | Text agent `/ask` loop, state revisions | Evidence/review drawers and chat; UI patch reducer | **Full P0 shopping flow** operational |
| **2:45–3:45** | API integration/tests; assist B with contract issues | Harden tools and correction handling | Independent minimal host and adapter; run same widget | **Portability proof passes** (no widget edits) |
| **3:45–4:45** | Benchmark fixtures, baselines, scoring | GPT-Live session and tool relay | Live microphone + state sync + fallback | Voice changes UI or is cut |
| **4:45–5:45** | Run evals, fix correctness failures | Finish voice or gated screenshot | Polish; screenshot upload only if ready | Feature freeze; all P0 tests passing |
| **5:45–7:00** | Save measured results and logs | Verify model cost and Live reliability | Rehearse both-host demonstration | Two reliable rehearsals, no invented results |

**Kill switches:** If P0 isn't reliable at T+03:45, all three stop P1. If second host fails, C fixes modularity before voice polish. If GPT-Live doesn't trigger the exact same domain tool and UI revision by T+04:45, remove it from the main demonstration. If any step depends on a live Shopee account/network, replace it with a fixture-backed mock and disclose the source.

---

## 2. Repository and boot procedure — build first

### 2.1 Monorepo layout

```text
luna-shopping/
  apps/
    demo-shopee/               # Host A: Shopee-inspired, NOT Luna business logic
      src/HostAdapter.ts       # implements LunaHostAdapter
      src/ShopPage.tsx
    minimal-host/              # Host B: deliberately different plain layout
      src/HostAdapter.ts
      src/App.tsx
  packages/
    luna-widget/               # Portable React UI, one set of components
      src/index.ts             # exports LunaProvider, AddCompareButton, ComparisonDrawer, LunaAssistant
      src/contracts.ts         # frontend contract and host-adapter types
      src/api.ts               # typed calls to Luna service, not host-specific catalog
      src/state.ts             # comparison view + revision guards
      src/components/         # bucket, table, reviews, evidence, chat, Live
  services/
    luna-api/                  # FastAPI; runnable independently of any host
      app/
        main.py
        contracts.py
        routes/catalog.py
        routes/comparisons.py
        routes/luna.py
        routes/live.py
        providers/base.py      # CatalogProvider protocol
        providers/mock.py      # JSON fixtures implementing provider
        services/compare.py
        ai/extract.py
        ai/reviews.py
        ai/agent.py
        ai/tools.py
        ai/rank.py
      tests/
      pyproject.toml
  data/
    listings.json
    reviews.json
    sample_comparison.json    # B/C fixtures until A's extractor is running
    ground_truth.json         # labels are separate from model input
  eval/
    baselines.py
    run.py
    metrics.py
    results.json              # generated only
  docs/
    INTEGRATION.md            # one-page host/backend adapter guide
    DEMO.md
  .env.example
  Makefile
  README.md
```

**Why one repo?** Three people can develop and test a frontend package, two hosts, and one backend together with a single contract. This is a monorepo for collaboration **not a runtime coupling requirement**. The `luna-widget` must be importable as a package, and `luna-api` must run without any frontend installed. Future Shopee teams would embed the UI, supply adapters, and deploy the service independently.

### 2.2 Setup and commands

```bash
# From root, when generating the project from scratch at the event:
mkdir -p apps/demo-shopee apps/minimal-host packages/luna-widget services/luna-api
# Scaffold each Vite app and the workspace package using the approved tooling.
# Configure an npm workspace linking the two apps to @luna/widget.

# Backend terminal
cd services/luna-api
uv sync  # dependencies: fastapi, uvicorn, pydantic, openai, httpx, pytest
uv run uvicorn app.main:app --reload --port 8000

# Frontend terminal, from repo root
npm install
npm run dev:demo       # localhost:5173
npm run dev:minimal    # separate port, e.g. localhost:5174

curl http://localhost:8000/api/health
```

`Makefile` must have `make dev`, `make test`, `make eval` and document starting both hosts. Vite proxies `/api` to port 8000. Do not put `OPENAI_API_KEY` in `VITE_*` variables or commits. Pin the OpenAI SDK revision that passed smoke tests, and use `.env.example` for `OPENAI_TEXT_MODEL`, `OPENAI_LIVE_MODEL`, `LUNA_CATALOG_PROVIDER=mock`.

### 2.3 Shared canonical IDs and response schema

**Exact comparison identity:** `item_key = listing_id + ':' + variant_id` (not title, not product family). The product snapshot has a revision/hash; current listing price comes from the selected variant in the catalog, not from the LLM. Prices are integer minor currency units, with explicit currency codes.

```python
# services/luna-api/app/contracts.py (core fields, implement as Pydantic)
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

class ComparisonResponse(BaseModel):
    id: str
    revision: int
    items: list[dict]                    # selected variant, price/currency, snapshot IDs
    schema_fields: list[dict]           # capped 8–10 dimensions
    facts_by_item: dict[str,list[Fact]]
    evidence: dict[str,Evidence]
    review_summaries: list[ReviewAspectSummary]
    review_mentions: dict[str,ReviewMention]
    preferences: dict
    recommendation: dict | None = None
```

C generates/mirrors these types in `packages/luna-widget/src/contracts.ts`; B uses them for function outputs. Prefer an exported OpenAPI schema for compatibility tests. No frontend model may silently reinterpret missing, conflicting, or unresolved as a numeric zero.

### 2.4 Minimum fixture and validity rules

Seed three to four **fabricated and explicitly labelled** power-bank listings with 8–10 comparable fields, selected variants, seller descriptions, and 12–20 source reviews each. Required adversarial cases: sibling 100W/130W descriptions; `0.42kg` needing normalization; missing weight; contradictory 12/24-month warranty; negative heat mentions; mixed-sentiment reviews; unknown review variant. Use a stable, deterministic catalog version so `MockCatalogProvider` and benchmarks see the same evidence. Prices must use one declared currency (e.g. SGD) in the main demo.

**Invariants:** supported claim needs a semantically valid source ID tied to correct SKU; missing/unresolved cannot assert a numeric fact; conflict keeps both claims; a review excerpt must be an exact substring of the review; variant-unlabelled reviews must be marked listing-level; no product detail is drawn from model memory; stale UI patches cannot overwrite newer revisions. `Evidence` and review strings are **untrusted data**, never instructions.

**Setup DoD:** health/catalog work in both hosts, sample JSON loads in B/C, package typechecks, API runs without frontend, and keys remain server-side.

---

## 2A. Integration architecture — the portability contract (P0)

**Do this before writing AI prompts.** Two ports of the same mock storefront would not show portability. Keep a distinct *host UI adapter*, *data provider*, *Luna UI package*, and *Luna backend*. Never call Shopee private endpoints or claim access to them.

### 2A.1 Frontend host contract (C owns; B/A review)

```typescript
// packages/luna-widget/src/contracts.ts
export type Selection = { listingId: string; variantId: string };
export type Money = { currency: string; amountMinor: number };
export interface LunaHostAdapter {
  hostId: string;                 // 'mock-shopee' / 'minimal-demo'
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

**Host A (`demo-shopee`)**: orange e-commerce product grid and detail page, direct + Compare button, a basic variant chooser, optional fake cart. **Host B (`minimal-host`)**: one neutral product list and distinct route structure; implement a separate adapter, mount the *same* compiled widget package; do not copy widget code. **Test**: swap host UI and reload; all Luna functions still work with the same `comparison_id` when authorized and same fixtures.

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
- **Second-host test (C owner):** run identical add → compare → ask → cite sequences in `demo-shopee` and `minimal-host`. Add an import-boundary check (ESLint or grep-based CI) that fails when widget source imports from `apps/*`. Record `git diff -- packages/luna-widget services/luna-api`: **empty** after adding Host B. If Host B needs modifications to core Luna code, the portability goal is not met.

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

**Owner:** A for provider-backed API/data, C for the shared widget in both hosts.

### Step-by-step implementation

1. **A:** Implement `GET /api/catalog` through `CatalogProvider`, not by importing demo-host data. Return listings with `id`, `title`, `image_url` (only known permitted fixtures), `variants:[{id,label,price_minor,currency}]`, a 1–2-line description preview. Keep complete evidence server-side.
2. **C:** Render 3–4 fixture cards in Host A and an independent minimal list in Host B; both mount the same `AddCompareButton` and variant-picker logic. Clicking it opens a variant selector; make buyer select explicitly. Maintain an array `selected: [{listing_id, variant_id}]`, maximum four.
3. **C:** In `luna-widget` (not in either host), show a persistent bucket, e.g. `Compare 3/4`, with selected variant badges and remove controls. Prevent adding the same exact variant twice; allow two variants from one listing if different SKUs.
4. **A:** Implement `POST /api/comparisons`, request `{ "items": [{"listing_id":"A","variant_id":"100w"}, ...] }`. Validate 2–4 items, known IDs, no duplicates; return `201 {"comparison_id":"cmp...","revision":0}`. Error codes: 400 (bad count), 404 (unknown listing/variant), 409 (duplicate exact SKU).
5. **C:** “Compare now” creates comparison, navigates to `/compare/:id`, and calls `GET /api/comparisons/:id`. Initially load sample data if extraction isn't ready; remove this fallback before final demo unless marked.
6. **A:** Persist selected variant, provider namespace, listing snapshot hash, and price in a session-scoped in-memory comparison map. Calls to extract must use precisely this selected identity.

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
6. **Parallelize three extraction requests** with `asyncio.gather(..., return_exceptions=True)`, bound concurrency to 3, and allow partial results: a failed item renders unresolved cells and a retry control. Cache key `(listing_id,variant_id,snapshot_hash,schema_version,prompt_version)`.
7. **API:** `POST /api/comparisons/{id}/analyze` returns the canonical `ComparisonResponse` (synchronous is fine for 3 items; frontend shows loading). `GET /api/comparisons/{id}` returns latest saved response.
8. **C:** Render columns as exact SKUs; rows as schema fields. Each **supported** cell is clickable; drawer displays original source quote(s) and variation. Missing displays `Not stated`; conflicting displays `⚠ Conflicting`; unresolved shows `Could not verify`. Add “Differences only” calculated from normalized values, not by an LLM.

### Extraction prompt (keep in `services/luna-api/app/ai/prompts.py`)

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
8. **Optional fast-path with Decisions API:** After extraction, classify ambiguous mention snippets with a fixed `choice` question (`positive/negative/neutral`) using `client.decisions.create(model="gpt-6-luna", input=..., questions=[...])`. **Never substitute Decision confidence for evidence**; keep quote validation. This is an optional optimization, not an extra feature needed for P0.

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

**Owner:** B (session/delegation and server-side function execution), C (WebRTC/browser inside `luna-widget`), A (provider/evidence compatibility). 

**Verified integration path:** The current GPT-Live docs describe **`gpt-live-1`**, WebRTC sessions at `POST /v1/live/sessions`, **Responses delegation** to a model such as `gpt-6-luna`, and backend function tools. The model providing conversation is different from the model handling tasks. Use these precise docs rather than an older Realtime tutorial: https://developers.openai.com/api/docs/guides/live, https://developers.openai.com/api/docs/guides/live-delegation, https://developers.openai.com/api/docs/guides/voice-webrtc?api=live .

### Minimum voice implementation, in order

1. **B:** Create `POST /api/comparisons/{id}/live/session` that accepts `{"sdp":"..."}`. Verify comparison exists and user is authorized for it (demo session ID if no login). Configure `client.live.create(session={...}, transport={"type":"webrtc","sdp":...})` server-side, return provider's session ID and SDP answer. Never expose API key. Use `model:"gpt-live-1"` and `delegation:{type:"responses", responses:{model:"gpt-6-luna", instructions:..., tools:[YOUR FUNCTION SCHEMAS], tool_choice:"auto"}}`. Start with one `get_comparison` tool, then add `apply_preferences` and `get_review_aspect`.
2. **C:** Implement standard browser `RTCPeerConnection`; add microphone track from `getUserMedia({audio:true})`, remote audio playback, and a data channel named `oai-events`. Create offer, POST its SDP to your API, set returned remote SDP answer. Wait for `session.started` before marking Live ready. Clean up mic tracks and peer connection on stop/unmount.
3. **B:** Copy the same four tool JSON schemas and **same underlying Python functions** from F4 into Live delegation. Configure backend instructions to use tools for any product factual claim or preference change. **Choose one executor**: the **server-side sideband WebSocket** (`wss://api.openai.com/v1/live/sessions/{session_id}/attach`) owns all tool execution. The browser only handles microphone, playback, captions, and screen state. The server-side connection observes function-call events and sends results. Never execute the same tool from both browser and server.
4. **C:** On data-channel transcript events, show captions **as provisional**, not already-committed preferences. When the tool returns a confirmed `ui_patch`, apply it with the same revision guard used for text mode. If voice events do not surface the patch directly, use a short-poll `GET /api/comparisons/{id}` after confirmed backend mutations. This requires B to save each mutation server-side.
5. **B:** Include concise **UI context** in Live session (selected item keys, current comparison revision, active tab and explicitly set preferences), so “this one”, “actually”, and interruptions refer to the right candidates. Push updates when selection changes; don't send full DOM or raw pages.
6. **B/C:** Implement cancellation/stale-turn protection: if user says “Actually under S$70” before earlier analysis finishes, only the latest committed revision is applied. Never cancel a completed mutation by pretending it did not happen; check state and issue a corrective change.
7. **C:** Voice control supports `Start`, `Mute`, `Stop`, clear connection status, caption preview, and text fallback. `Stop` gracefully closes Live session, releases tracks, and handles `session.closed`.

### 7.1 The exact tool-event relay (do not skip)

**B owns this loop.** Follow [Server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls) and [Live delegation events](https://developers.openai.com/api/docs/guides/live-delegation):

1. After `client.live.create` returns `session.id`, B attaches a **server-authenticated sideband** WebSocket to `wss://api.openai.com/v1/live/sessions/{session_id}/attach`; associate session with the comparison ID. Do not call `session.start` again. (If a sideband isn't viable, the documented alternative is to forward function-call events from the browser data channel to an authenticated backend, and return results through the data channel; **do not implement both**.)
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
- [ ] Visible text answer or captions and spoken explanation are consistent enough for demo.
- [ ] API key not present in browser. Mic permission denied → text Luna remains usable.
- [ ] `Stop` releases mic; session errors do not crash comparison.

**Failure policy:** Voice without real tool-backed UI mutation is **not done**. Cut it from the main demo if integration fails.

---

## 8. Feature F6 — Screenshot-assisted product addition (P1, SECOND stretch)

**User problem:** Users often have a product screenshot or saved listing image; manually searching for it again creates friction.

**Owner:** B (image-to-candidate), C (upload/confirmation).

### Steps

1. **C:** “Add from screenshot” accepts PNG/JPEG/WEBP, max 8 MB app-side; sends multipart form to `POST /api/catalog/match-screenshot`. Do not capture the screen automatically or upload unrelated content without action.
2. **B:** Server validates image MIME/magic bytes and payload size; invokes a vision-capable Responses model (`gpt-6-luna` if supported in account) with the image and a **compact JSON catalog candidate list** (titles/model names). Ask for `{candidate_listing_id|null, candidate_variant_id|null, confidence_category: high|medium|low, observed_text, reason}`.
3. **B:** Validate proposed IDs exist in local catalog. If image shows a product but not the specific variant, return `candidate_variant_id:null` and require manual selection. Product photo matching is suggestion, not verification of marketplace seller or SKU.
4. **C:** Show a prefilled candidate card + “Confirm match” / “Choose different” / “No match”. **Never auto-add** solely from vision output.
5. **C:** On confirm, route to the existing exact-variant picker and bucket; same F1 flow.

### DoD F6

- [ ] Screenshot showing a known fixture product suggests the correct catalog listing; buyer confirms before adding.
- [ ] Unclear/unknown image yields a `No confident match` state, not invented listing data.
- [ ] Sibling variant ambiguity requires buyer choice.
- [ ] The confirmed candidate then appears through ordinary F1 bucket state.

**Cut condition:** No live Shopee image search. Production matching requires an authorized retrieval provider.

---

## 9. Feature F7 — Luna Investigates with external web evidence (P2)

**User problem:** A material field is missing or contradictory; buyers may leave Shopee to research it.

**Owner:** B only after Live/vision gates.

### Steps

1. Add an **explicit** “Investigate this uncertainty” button next to a conflict or missing field (not an autonomous search for every field).
2. Backend receives `(comparison_id, item_key, field_key)`, gathers exact model number and selected variant; if model identity is ambiguous, **stop and ask for clarification**.
3. Run a separate Responses request with hosted `web_search`, ideally a search-capable supported model configured according to the latest docs (the published example uses `gpt-5.5`). Limit budget/search scope to that question.
4. Parse returned URL citations and record external source URL, title, retrieved timestamp, quote/claim. **Do not overwrite the seller's original fact**, even if manufacturer sources conflict.
5. Display side-by-side: `Seller claims`, `External source suggests`, `Unresolved`. Distinguish manufacturer / third-party / forum; sources may refer to a different hardware revision.

### DoD F7

- [ ] One deliberately ambiguous field can be investigated on demand.
- [ ] External assertion has a clickable source URL and remains separate from seller claim.
- [ ] The system declines to claim verification when exact model/variant match is uncertain.
- [ ] Tool cost/latency is logged; no background unbounded research.

---

## 10. Feature F8 — Luna Watchlist / Dots-inspired persistence (P2)

**User problem:** After narrowing candidates, users must remember to check price changes or other relevant developments.

**Dots is not an embeddable SDK.** Agents API automations can schedule work, but need authorized refreshable data and a delivery channel. Simulated fixture snapshots are not live monitoring.

**Owner:** B creates job/session only if API access is ready; A provides fixture snapshot transition; C displays watch state.

### Step-by-step

1. **C:** “Watch this comparison” captures explicit criterion and trigger, e.g. `notify when recommended candidate price <= S$70`, plus consent. Show saved current snapshot.
2. **A:** Define `WatchRule {id, comparison_id, item_key, metric, operator, threshold, timezone, enabled, last_observed_snapshot_hash, last_notified_snapshot_hash}`; persist locally to JSON if needed. Do not store private contact information for a demo.
3. **A:** Implement deterministic `evaluate_watch(rule, new_catalog_snapshot)` → `triggered|unchanged|unavailable`, with **idempotency** keyed by `(rule_id, snapshot_hash)`.
4. **C:** Add **Run sample next-day check** using a second labelled fixture snapshot containing a genuine deliberate change in price or availability. Show before/after and how Luna's best-fit recommendation changes, if it does.
5. **B (only if time):** Create an Agents API scheduled automation (`client.beta.agents.automations.create`) with appropriate agent/session, cron/timezone, and read-only data connector. A scheduled invocation is **not itself proof that a price changed or that a user was notified**; inspect run results. Provide disable/pause control.
6. **C:** Notifications in demo are **in-app cards** rendered after a completed evaluation. Real email/push only with authorized service and consent; not needed in 7 hours.

### DoD F8

**Simulation done:**
- [ ] User saves threshold and explicitly triggers next snapshot.
- [ ] Deterministic evaluator shows before/after, reason, and evidence.
- [ ] Same snapshot does not create duplicate alerts.
- [ ] UI clearly says **“Simulated future snapshot — not live monitoring.”**

**Real scheduling done (higher bar):**
- [ ] Agent automation created and run is verifiably executed with authorized updated data.
- [ ] Run result is surfaced and disable/cancel works.
- [ ] No claim of real alert delivery without an implemented delivery channel.

---

## 11. Exact backend routes and payload contracts

| Endpoint | Method | Owner | Tier | Request → response |
|---|---|---|---|---|
| `/api/health` | GET | A | P0 | → `{"ok":true}` |
| `/api/demo-sessions` | POST | A | P0 | → `{token,expires_at}`; bind subsequent comparison requests |
| `/api/catalog` | GET | A | P0 | → `{listings:[...]}` |
| `/api/comparisons` | POST | A | P0 | `{items:[{listing_id,variant_id}]}` → `{comparison_id,revision}` |
| `/api/comparisons/{id}` | GET | A | P0 | → `ComparisonResponse` |
| `/api/comparisons/{id}/analyze` | POST | A | P0 | empty → `ComparisonResponse` with facts + review summaries |
| `/api/comparisons/{id}/ask` | POST | B | P0 | `{conversation_id,message,expected_revision}` → answer + citations + `ui_patch` |
| `/api/comparisons/{id}/live/session` | POST | B | P1 | `{sdp}` → unchanged Live provider `session` + `transport.sdp` |
| `/api/catalog/match-screenshot` | POST | B | P1 | image → catalog suggestions (not added) |
| `/api/comparisons/{id}/investigate` | POST | B | P2 | `{item_key,field_key}` → seller/external evidence comparison |
| `/api/watch` | POST | B/A | P2 | watch rule → saved ID |
| `/api/watch/{id}/run-demo` | POST | A | P2 | next fixture snapshot → simulated trigger outcome |

**Error envelope, everywhere:**

```json
{"error":{"code":"INVALID_VARIANT","message":"Unknown selected variant","retryable":false}}
```

**Concurrency:** each change to preferences increments revision; if a request contains old `expected_revision`, return `409 STALE_COMPARISON` with current revision; client refreshes and may re-submit the **user's newer intent** once. Key each agent turn with `request_id`; never apply a stale UI patch. For demo store `comparison_id`, `conversation_id`, and `revision` in memory.

**Frontend:** all server data typed. The comparison response is the canonical state; `ui_patch` modifies presentation and server-saved preferences. Do not let React invent evidence IDs or perform authoritative ranking client-side.

---

## 12. Test plan — exact fixtures, metrics, and command

### 12.1 Minimum benchmark data (realistic for 3 developers)

- **Specs:** 12 exact SKU fixtures, 3–4 comparison sets, ~8 fields each. At least 3 multi-variant collisions, 3 missing fields, 3 contradictions, 3 unit conversions.
- **Reviews:** 45–60 short labelled review texts, spanning 3 listings, 5 aspects, positive/negative/mixed/no-aspect. Keep source samples and expected mentions separately.
- **Agent:** 12 scripted utterances: budget, power threshold, priority inversion, unclear intent, review query, contradictory claim, missing field, stale-turn correction, invalid item key, no survivors, product tie, “why?”.
- **Voice (if P1):** 3 spoken scenarios: initial intent, preference correction mid-answer, microphone denied fallback.
- **Vision (if P1):** 3 images: clear known listing, unknown product, same family/ambiguous variant.

Use held-out evaluation labels; never send labels to the extractor. All sample counts are targets, not measured achievements.

### 12.2 Scoring

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

**Baseline comparisons:** B1 regex specification parser; B2 ungrounded free-form extraction; S1 grounded structured extraction. For review extraction, use simple keyword baseline vs cited aspect extraction. For agent, compare (a) static prose-only assistant and (b) Luna tool-backed agent on the same 12 task scripts; grade **UI outcome** not verbal impressiveness. For friction, define identical start/end states and count taps/field edits—be explicit that proxy is a scripted analysis, not a user study.

### 12.3 Required tests, by component

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

**C (manual/browser):**
- Confirm two independent host adapters, import-boundary test, session expiry, and same widget output; add/remove exact SKUs; compare; toggle differences; open seller evidence; open review evidence; ask; observe UI mutation; refresh state; mock API failure; microphone denied fallback; stop voice.

**Commands:**

```bash
make test
make eval          # runs fixtures and writes eval/results.json
# inspect results.json; any blank or N/A metric should remain blank on slide
```

**Numerical claims:** Report measured values only; never confuse offline accuracy or scripted click counts with a demonstrated conversion/GMV lift.

---

## 12A. Integration and risk checklist (do not confuse demo portability with production readiness)

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

## 13. End-to-end acceptance stories (required rehearsals)

### Story A — compare + explain (P0)

**Given:** 3 demo listings, exact variants selected, one missing weight, one contradictory warranty.  
**When:** User taps “Compare now” and “Differences only.”  
**Then:** Same 8 normalized fields appear, identical rows collapse, every supported cell opens seller quote, missing and conflict are explicit.  
**Definition of done:** no fabricated or sibling-variant spec; two repeat runs pass.

### Story P — independent-host portability (P0)

**Given:** `demo-shopee` and `minimal-host` have separate routes/styles and host adapters.  
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

### Story E — screenshot (P1)

**When:** User drops an image of a fixture product.  
**Then:** Candidate suggestion → explicit selected variant → existing compare bucket.  
**Definition of done:** screenshot only reduces manual search, never bypasses identity/variant check.

### Story F — watchlist (P2)

**When:** User saves a watch rule and manually triggers the labelled future-snapshot demo.  
**Then:** condition evaluator shows whether trigger fired, with snapshot evidence and no duplicate alert.  
**Definition of done:** clearly labelled simulation; don't claim actual future monitoring unless real connector + schedule + delivery are demonstrated.

---

## 14. Judge-facing demo (75–90 seconds, P0 + Live if working)

**0–15 s:** “Three power banks, incompatible listing formats, many reviews.” Add exact variants in one bucket.  
**15–30 s:** Show comparison matrix; click evidence and conflicting warranty. “We don't guess.”  
**30–45 s:** Switch to review-aspect grid; click heat mention to open real fixture text.  
**45–70 s:** Say to Luna Live (or type if voice unavailable): “Under S$80, at least 65W, prioritize portability.” Highlight UI changes; interrupt with “Actually prioritize price.” Highlight changes again.  
**70–90 s:** Switch briefly to `minimal-host` showing the identical widget and state, then show benchmark from measured `results.json`: variant accuracy, evidence precision, review aspect precision, agent tool success, p95 latency, costs.

**Pitch sentence:** “Luna is portable across marketplace hosts; instead of merely answering a question, Luna **removes the sequence of actions** between having a shopping need and making an evidence-backed choice: collect, normalize, inspect reviews, constrain, compare, explain, and refine—through text or voice.”

If Live isn't ready, use text mode **without faking audio integration**. A reliable tool-using text journey scores better than a nonfunctional voice demo.

---

## 15. API and model references verified on 31 October 2026

- Responses API function calling (tool-call result feedback loop): https://developers.openai.com/api/docs/guides/function-calling
- Structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Decisions API (`POST /v1/decisions`, `gpt-6-luna`, fixed-choice/predicate/score): https://developers.openai.com/api/docs/guides/decisions
- GPT-Live getting started: https://developers.openai.com/api/docs/guides/live
- GPT-Live delegation (Responses/client, custom functions, transcript events, UI context): https://developers.openai.com/api/docs/guides/live-delegation
- GPT-Live WebRTC quickstart (`POST /v1/live/sessions`, `session.started`, `session.closed`): https://developers.openai.com/api/docs/guides/voice-webrtc?api=live
- GPT-Live server-side sideband and exactly-once tool ownership: https://developers.openai.com/api/docs/guides/voice-server-controls
- Images and vision (image inputs to a vision-capable model): https://developers.openai.com/api/docs/guides/images-vision
- Hosted web search: https://developers.openai.com/api/docs/guides/tools-web-search
- Agents API scheduled automations: https://developers.openai.com/api/docs/guides/agents-api/sessions/automations
- SEA × OpenAI hackathon: https://codexhackathon.sea.com/

**Access caveat:** A documented API is not evidence that *your particular OpenAI project* has access, available credits, compatible SDK version, or regional entitlement. **B must smoke-test actual GPT-Live session and Responses calls in the first 20 minutes.** Use exact names and request parameters from your installed SDK and official quickstart. Pricing/access may change, so log rather than assume.

---

## 16. Final build order: developer checklist

### Developer A (Evidence & Reviews)

- [ ] **A0 (00:00):** Freeze provider protocol; seed power-bank listings, variants, reviews and shared JSON; `GET /api/catalog` calls `MockCatalogProvider`. **Done:** B/C consume contracts.
- [ ] **A1 (00:20):** Build demo session-token issuance/expiry, comparison ID/store + exact-variant selection. **Done:** valid 2–4 item bucket and errors.
- [ ] **A2 (00:45):** Build evidence index + fixed-schema extraction. **Done:** expected 8 cells per item with source IDs.
- [ ] **A3 (01:10):** Unit normalizer/conflict/missing validator and cache. **Done:** 4 red-flag tests pass.
- [ ] **A4 (01:40):** Review extraction/aggregation. **Done:** aspect table has clickable exact quotes; no wrong SKU association.
- [ ] **A5 (02:40):** Inject provider into all catalog/comparison handlers, add provider-unavailable test, smoke-test B's tool reads. **Done:** first P0 journey integrated.
- [ ] **A6 (03:45):** Expand labelled fixtures, run baselines/scorer. **Done:** `results.json` generated with real numbers, no manual estimates.

### Developer B (Luna & OpenAI)

- [ ] **B0 (00:00):** API access smoke test; Responses tool call succeeds; check GPT-Live entitlement. **Done:** return one verified test result or log blocker.
- [ ] **B1 (00:20):** Pure-Python deterministic filter/rank + four tool handlers over fixture; no direct access to mock provider or demo host. **Done:** input preferences produce correct allowed UI patch.
- [ ] **B2 (01:10):** Responses function-call loop `/ask`. **Done:** at least two tool calls and valid cited response; no prose-only fake.
- [ ] **B3 (01:40):** Handle corrections, IDs, revision conflicts. **Done:** 12 scripted preference scenarios run; latest intent wins.
- [ ] **B4 (02:40):** Copy official GPT-Live WebRTC backend quickstart, start session with delegated model. **Done:** real speech session connects.
- [ ] **B5 (03:45):** Wire Live function-call relay to **same** tools. **Done:** voice utterance updates comparison revision/UI.
- [ ] **B6 (04:45):** Only if voice passes: screenshot matching. **Done:** explicit user-confirmed suggested candidate.
- [ ] **B7 (optional P2):** If absolutely spare time, investigate/automations; otherwise document as roadmap, not done.

### Developer C (Frontend & demo)

- [ ] **C0 (00:00):** npm workspace and `@luna/widget` public exports, `LunaHostAdapter`, Host A skeleton, sample types. **Done:** product cards and placeholder comparison load without API.
- [ ] **C1 (00:20):** Portable exact variant picker + bucket in `packages/luna-widget`. **Done:** 2–4 selected SKUs and remove controls.
- [ ] **C2 (00:55):** Compare matrix + differences toggle + evidence drawers. **Done:** clicking value opens source.
- [ ] **C3 (01:40):** Reviews tab + per-aspect mention drawer. **Done:** compare review counts and inspect text.
- [ ] **C4 (02:10):** Luna chat + revision-safe `ui_patch` reducer within shared widget. **Done:** B's real `/ask` changes UI.
- [ ] **C5 (02:45):** Build independent Host B with separate adapter and import-boundary check; no edits to Luna package. **Done:** A/B/C core flow works in both hosts. Then build voice controls, remote audio and caption events with B. **Done:** audio and UI change verified.
- [ ] **C6 (04:45):** Only if B matches screenshot: upload + confirm. **Done:** added item goes into F1 bucket.
- [ ] **C7 (05:45):** Lock both-host demo path, test error states and rehearse; preserve two-host evidence for judges. **Done:** two back-to-back runs succeed.

### Final rule

> **One grounded comparison + cited reviews + a tool-using Luna that visibly changes the table in two independent hosts** is the required product. **GPT-Live** is the highest-value extension. Screenshot, web investigation, and Dots-inspired watchlist are conditional enhancements. A three-developer team should optimize for a complete end-to-end agent experience, not a list of unfinished integrations.


## 17. Final sign-off matrix (all three developers)

| Test | Responsible | Pass condition |
|---|---|---|
| Contract compatibility | A + C | Typed frontend API and Pydantic/OpenAPI schema agree on supported/missing/conflicting, IDs and price units |
| Provider swapping | A | Swap mock fixture/source via provider injection and core Luna code unchanged |
| Tool truthfulness | B | Filter/rank tool is actually executed; cited facts resolve; invalid/stale calls rejected |
| Same widget in two hosts | C | Two independent adapters, no Luna package/service edits; functional parity recorded |
| Spoken decision | B + C | Real GPT-Live call executes same backend tool and increments same comparison revision, or feature is explicitly cut |
| Review grounding | A | Review mention IDs and literal excerpts validate, with appropriate variant status |
| Demo / measured eval | A + B + C | Two successful end-to-end runs; honest benchmark metrics and clearly labelled synthetic data |

**Final operational rule:** Stop adding features to preserve a reliable, explainable and portable core. The most valuable new GPT feature is not a decorative button; it is a capability that actually removes an action and preserves evidence, state and user control.
