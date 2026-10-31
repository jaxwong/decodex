# Implementation changelog

This file records implemented Luna milestones. The implementation spec remains the source of truth for planned behavior. The integration lead owns this summary; developer-level evidence stays in `docs/codex-build-log/`.

## 31 October 2026

### Implemented on `feat/demo-flow-rich-data`

- Demo catalog reads like real listings: Atlas Portable, Breeze Slim and Comet Travel Power
  Bank; variant labels such as "100W"; drawn SVG product images inlined as data URIs; star
  ratings that follow each review's labelled sentiment. Ground-truth labels are unchanged; the
  seller question now ends "…of the 87W model?".
- `GET /api/catalog?q=` matches titles; `GET /api/catalog/{listing_id}` returns a storefront
  listing (description, per-variant specification lines, every review) with no model call.
- Host A: working search and suggestion chips, a Shopee-style product page with model buttons,
  quantity, **Add To Cart** / **Buy Now**, specifications, description and paged star reviews;
  cart rows link to it. **View product** in the comparison opens it as an overlay.
- Widget: a "Lining up your N products" state replaces the pre-ticked picker while a
  cart-handed comparison builds; product images in column headers; **Choose this one** calls the
  optional `requestAddToCart`, which Host A uses to check out that exact variant.
- Checkout and Order Confirmation rebuilt over catalog prices (per-line voucher and shipping,
  cash on delivery only); the clone pages and the cart's VND "You May Also Like" strip are gone.
- Playwright covers search → product → add to cart, the held-comparison loading state, cart and
  chosen-product checkout, and the Host A product overlay.

### Implemented on `feat/seller-question-loop`

- Proposal 4: a missing table cell offers **Ask seller**. `POST
  /api/listings/{listing_id}/variants/{variant_id}/questions` returns a fixed-template question
  (no model call, nothing stored); the buyer confirms it in a dialog.
- A labelled **Simulated seller** inbox inside the shared widget takes a one-field answer.
  `POST .../seller-replies` composes the labelled clause (a bare number takes the question's
  unit), rejects anything extraction could not read with 422 `INVALID_REQUEST`, and stores one
  answer per variant field in the mock provider (`SELLER_REPLY_EXISTS` 409 for a second).
- The answer is indexed as exact-variant attribute evidence at `seller_replies/{n}`. The listing
  snapshot changes, open comparisons are untouched, and the widget rebuilds the same variants
  into a new comparison whose cell shows the value with "Confirmed by seller" and cites it.
  A reply that disagrees with the listing becomes an ordinary conflict.
- The deterministic e2e API now builds evidence through the real `EvidenceBuilder` with the
  test extraction double, so provider changes reach new comparisons in browser tests.
- No new source type, status or agent tool. The seller side is a labelled mock, not Seller
  Centre chat; replies live in memory and reset on API restart.

### Implemented on `feat/cart-luna-link`

- Linked Host A's cart to the backend catalog. Cart rows are now exact catalog variants (Atlas
  100W, Breeze 65W, Comet 87W) whose titles and SGD prices come from `/api/catalog`; the clone
  Anker/UGREEN/Baseus rows, VND prices, strike-through prices and "Saved" line are deleted.
- **Compare now** passes the ticked cart rows to `#/Compare`. With 2–4 ticked, Luna creates the
  comparison immediately and opens on the table, so the shopper never picks twice. With 0–1
  ticked, Luna shows the picker with that product already picked. If the automatic comparison
  fails, the picker stays open with the same picks. Opening `#/Compare` directly starts empty.
- Replaced the widget host contract's `getCurrentSelection()` with `getCurrentSelections()` (an
  array of at most four) in the widget, both hosts, the package README and the spec.
- Added a Host A Playwright test for the cart rows and total, the straight-to-table comparison,
  the exact items requested for a partial selection with the outage fallback, and the one- and
  zero-product pickers. The deterministic test API only has evidence for all three products, so
  a successful two-product comparison is not exercised offline.

### Implemented on `feat/review-disputed-claims`

- Added `Fact.disputing_mention_ids` (default empty) for Proposal 2. A disputed claim stays
  `supported` with its value; the contract rejects disputes on unsupported facts and unknown or
  wrong-item mentions. Ranking reads only status and value, so disputes never reorder items.
- Review extraction can flag a mention that reports an experienced value contradicting a listed
  field. The builder attaches a dispute only when at least `DISPUTE_MIN_REVIEWS = 2` distinct
  analysed exact-SKU reviews contradict a supported claim; one review never raises the marker.
- Added two synthetic `listingB:65w` reviews that contradict its 20 Ah capacity claim, ground-truth
  dispute labels, a disputed capacity fact in the sample handoff, and dispute precision/recall rows.
- Text and Live agents share one policy rule: cite the claim and its disputing mentions, say Luna
  cannot verify the true figure, and describe only a count among reviews analysed.
- The shared widget shows "Disputed in N of M reviews analysed" on the cell, keeps that row out of
  the "Same on all" collapse, and opens the existing drawer with the seller source and each
  disputing review excerpt with its review ID. Both hosts' browser flows cover it.
- Paid evaluation artifacts were not rerun; grounded dispute metrics stay unavailable.

### Implemented on `feat/true-landed-price`

- Added listed shop-voucher and shipping components to every synthetic variant and one validated
  `landed_price_minor` per comparison item. The contract rejects invalid arithmetic before ranking.
- Changed both hard budgets and the existing `price_minor` ranking priority to use delivered totals.
  The selected demo order flips from sticker A → B → C to delivered C → A → B; listing B is
  S$69.65 listed and S$81.65 delivered, so an S$80 budget excludes it.
- Extended the catalog, compact decision snapshot and OpenAPI schemas without adding another
  pricing computation path. Text and Live agents inherit the explicit delivered-budget rule.
- Updated the shared Host A/Host B widget with a visible sticker-price warning, list-versus-delivered
  columns, a four-line breakdown and the fixed listed-assumptions label. No personalisation controls
  or unsupported discount types were added.
- Added contract, ranking, budget, tool, OpenAPI and dual-host browser coverage. Existing paid
  evaluation artifacts remain untouched and are now honestly stale after the source change.

### Merged into `main`

- **B1 API shell and capability checks — [PR #1](https://github.com/jaxwong/decodex/pull/1):** FastAPI health and demo-session endpoints, locked uv project, bounded Responses function-call smoke, and GPT-Live session smoke. Both OpenAI capabilities passed with retries disabled and at most two provider calls.
- **B-owned API Make targets — [PR #2](https://github.com/jaxwong/decodex/pull/2):** root commands for API sync, formatting, linting, type checking, tests, development server, and the explicit paid capability smoke.
- **A evidence and review intelligence — [PR #3](https://github.com/jaxwong/decodex/pull/3):** frozen evidence contract and synthetic fixtures, mock catalog provider, exact-variant specification extraction, cited review analysis, failure behavior, and executed synthetic evaluation artifacts.
- **B2 deterministic sessions and decision tools — [PR #5](https://github.com/jaxwong/decodex/pull/5):** authenticated comparison state, provider-backed catalog and evidence creation, deterministic ranking, exactly four decision tools, optimistic revisions, and stable HTTP errors.
- **B3 bounded Responses text agent — [PR #7](https://github.com/jaxwong/decodex/pull/7):** authenticated comparison chat over the same four tools, bounded conversation history, revision-safe mutations, evidence-bound answers, and a paid local end-to-end verification.
- **B4 GPT-Live server delegation — [PR #9](https://github.com/jaxwong/decodex/pull/9):** authenticated WebRTC session creation, one no-retry server sideband executor over the same four tools, revision-safe corrections, and paid provider create-and-attach verification. Browser microphone/audio remained C5 work and was not claimed complete.
- **C3 Host A API panel — [PR #14](https://github.com/jaxwong/decodex/pull/14):** demo-session auth, API catalog selection, comparison creation, text ask and canonical-state refresh inside `shopee-compare-app`. This connected panel does not yet replace the legacy browser comparison engine.
- **C3 interactive Luna UI — [PR #19](https://github.com/jaxwong/decodex/pull/19):** recommendation cards, preference chips, evidence view and conversation UI in Host A.

### G3 portability and G4 browser transport — merged in [PR #20](https://github.com/jaxwong/decodex/pull/20)

- Moved Luna browser ownership from Host A's deleted `src/luna` path into one
  `@luna/widget` workspace package; Host A and independent Host B provide separate adapters.
- Added root npm workspaces and one root lockfile. Both production hosts build through
  `make frontend-build`; no host copies widget code or imports another host.
- Added `apps/minimal-host` with a distinct layout, catalog state and navigation behavior.
- Added browser GPT-Live WebRTC controls: microphone track, remote audio, `oai-events`,
  `session.started`, provisional captions, mute, graceful `session.close`/`session.closed`,
  explicit failures and text fallback. The server sideband remains the only tool executor.
- Added `make e2e`: both hosts run the same three-SKU, seller/review citation, revisions
  0→1→2 journey using frozen evidence and an injected SDK-shaped response. Import boundaries,
  successful WebRTC lifecycle and microphone denial are deterministic browser checks.
- Final deterministic gates: **194 API tests passed**, frontend lint passed, Host A transformed
  70 modules, Host B transformed 45 modules, and Playwright reported **5 passed / 1 intentional
  duplicate-project skip**.
- G3 has automated proof. G4 later received one explicitly authorized real run: the Live
  session returned HTTP 201, microphone speech produced captions, canonical state changed from
  revision 0 to 1 and refreshes returned HTTP 200, but no audible response was heard. There was
  no retry, G4 remains failed, and voice is cut from the main demo.
- Added root/package integration READMEs and updated architecture, invariants, decisions, user
  stories and the implementation spec to match the current tree.

### Implemented on `feat/seller-centre` — Seller Centre and session renewal

- Removed **Seller view** from the buyer comparison: buyers never see seller insights. Host A's
  top-bar **Seller Centre** link now opens `#/SellerCentre`, which mounts the widget package's
  standalone `SellerGapReport` page (listing picker, report, inline listing text).
- `GET /api/listings/{listing_id}/gap-report` now counts current comparisons from every active
  demo session (decision D-18). Each gap carries its `evidence` objects instead of
  `evidence_ids`, and the report carries `schema_fields`. Disagreeing extractions from different
  comparisons are both listed instead of raising `RuntimeError`.
- Removed the "Your demo session expired / Restart session" banner. On HTTP 401 the widget starts
  a new session: compare and seller-report reads are sent once more; a lost comparison returns
  to the picker with the same products picked. Start-up that issues a new session now also drops
  the previous session's comparison, fixing "The comparison was not found in this demo session"
  after a live code reload.
- Verification after rebasing onto `a9787f0`: **199 API tests passed** (two new gap-report
  cases); both hosts built; Playwright reported **9 passed / 3 intentional Host A-only skips**. A throwaway probe reproduced the live-reload desync before the
  fix and passed after it; it was deleted. These commands made zero provider calls.

### Implemented on `feat/luna-comparison-ui`

- Replaced the widget's recommendation cards and collapsed evidence list with one side-by-side
  comparison table: products as columns (top match first and tinted), server `focused_fields`
  first, identical specs folded into one "Same on all" row, and plain-language cell states.
- Tapping a cell, a citation chip under a Luna reply, or a seller-view gap opens one source panel
  with the seller's exact quoted text. It replaces the collapsed evidence list; no second drawer
  or data path was added.
- Field labels and units now come from the comparison's `schema_fields` through one
  `display.js` owner, replacing two label helpers (one of which never capitalized).
- Chat sits beside the table on wide containers, suggestions send immediately, and a banner
  announces revisions that carry a matching `ui_patch`.
- The widget now owns one complete stylesheet. Host B's `.catalog + section` workaround for
  missing widget styles was removed.
- Not done: per-row "best" tags and per-card ranking reasons. Both need the API to expose what
  it already computes (`exclusion_reasons`, `uncertain_fields`) instead of copying ranking rules
  into the browser.

### Implemented on `fix/view-product`

- Fixed **View product**, which previously passed only a listing ID to Host A and rewrote the
  current Compare query without any component owning it.
- The shared widget now passes the exact canonical product snapshot to the public host adapter.
  Host A and Host B each render and close their own product preview; the widget stays mounted,
  so the comparison revision and conversation are preserved.
- Demo previews state when data is synthetic and do not invent a Shopee or marketplace URL.
  A production host can map the canonical listing and variant IDs through its authorized route.
- Failure-first Playwright reproduced the missing product view in both hosts. Final verification
  made zero provider calls: focused ESLint passed, both production hosts built (Host A 67
  modules, Host B 47), all **194 API tests passed**, and Playwright reported **7 passed / 1
  intentional Host B transport skip**.
- `npm install` reported the known 15 audit findings (4 moderate, 11 high). No automatic or
  breaking audit fix was applied.

### Implemented on `fix/view-product-specs`

- Extended the canonical product snapshot with all eight `schema_fields` specifications instead
  of showing only title, variant and price.
- Projected facts from the existing immutable comparison. Supported and conflicting values
  retain every evidence ID plus exact source type, excerpt and location. Missing/unresolved
  values explicitly say no verified seller source exists; no citation is invented.
- Integrated the delivered-price contract added on `main`: the preview now shows list price,
  shop voucher, shipping and delivered total. The three listed components carry their exact
  evidence excerpt/location; delivered total is labelled as arithmetic over those sources.
- Host A and Host B render the same snapshot through distinct views. Opening/closing the view
  makes zero external calls and preserves comparison revision/conversation state.
- Failure-first Playwright found zero spec rows in both hosts. Final verification made zero
  provider calls: focused ESLint passed, Host A built 67 modules, Host B built 47 modules, all
  **197 API tests passed**, and Playwright reported **7 passed / 1 intentional Host B transport
  skip**.
- `npm install` reported the known 15 audit findings (4 moderate, 11 high). No automatic or
  breaking audit fix was applied.

### Implemented on `feat/seller-gap-view`

- Added one `SellerGapReport` view to `@luna/widget`; neither host owns a parallel seller
  route, fetch, count or presentation.
- Excluded recommendation cards fetch the existing authenticated gap-report endpoint with the
  widget's bearer token. The view renders server-owned evidence gaps, supported competitors,
  exclusion/uncertainty counts and the required demo-session limitation.
- Conflict actions reuse the existing comparison evidence panel. No second drawer, model call,
  state store, retry or fallback data was added.
- Extended the deterministic SDK-shaped test agent only to recognize the bounded S$70 test
  turn. The same Playwright journey now proves revisions 0→1→2→3 and the seller flow in both
  hosts.
- Verification: **194 API tests passed**, focused frontend ESLint passed, Host A transformed 71
  modules, Host B transformed 46 modules, and Playwright reported **5 passed / 1 intentional
  duplicate-project skip**. These commands made zero provider calls.
- `npm install` restored missing locked local packages and again reported the known 15 audit
  findings (4 moderate, 11 high). No automatic or breaking audit fix was applied.

### Implemented on `feat/host-a-canonical-luna`

- Made `@luna/widget` Host A's sole comparison implementation. `#/Compare` is now a thin host
  route and renders the canonical API catalog immediately; there is no hidden **Ask Luna** gate.
- Removed `CompareProvider` and deleted the complete legacy `src/compare` path: independent
  browser ranking, sample evidence, panels, browser API-key settings and the direct
  `api.openai.com` request. No fallback implementation remains.
- Kept cart quantity, selection, removal and checkout presentation local to the storefront.
  The cart links to Luna but never promotes unverified clone product IDs into trusted evidence;
  buyers choose 2–4 exact backend variants on the comparison page.
- Added a Playwright source-boundary assertion that Host A has no legacy compare directory,
  provider, direct OpenAI request or browser key UI.
- Verification made zero provider calls: focused frontend ESLint passed, both production hosts
  built (Host A 66 modules, Host B 46), all **194 API tests passed**, and Playwright reported
  **7 passed / 1 intentional Host B transport skip**.
- `npm install` reported the known 15 audit findings (4 moderate, 11 high). No automatic or
  breaking audit fix was applied.

### Implemented on `b8-a4-c-unblock`

- Executed the one explicitly authorized current-agent benchmark with no retry: 28/44 provider
  requests, 10/12 scenarios, `partial` status. `review_query` failed citation validation and
  `no_comparable_winner` made a rejected tool call; both failures remain visible.
- Regenerated `eval/results.json` with the free `make eval` projection. It validates the current
  evidence, scenario-suite and text-agent hashes and now reports
  `agent_output_evaluation.available: true`, unblocking A4's honest scorecard.
- Confirmed that C's merged panel has all B routes needed to continue. Remaining replacement of
  the direct browser OpenAI path, review UI, portable widget, Host B, voice controls and
  dual-host E2E are C-owned work; no additional B route is pending.

### Implemented on `b9-seller-gap-report`

- Added structured budget, minimum-output and uncertainty reasons at the deterministic ranking
  owner. Existing item lists are derived from those maps rather than computed independently.
- Added `GET /api/listings/{listing_id}/gap-report`, a read-only projection of evidence gaps,
  supported competitors and current decision reasons within the authorized demo session.
- Seller-only reason maps are required in memory but excluded from existing comparison JSON,
  OpenAPI `Recommendation`, text-agent tool/input JSON and Live context. A4 remains current.
- The report performs one catalog lookup, reads at most ten comparisons with four items each,
  makes zero model calls, retains no new state and never crosses session boundaries.
- Full API gate: formatting and lint passed, strict typing passed, and **181 tests passed**.
- The backend slice was later completed by the shared Host A/Host B seller view and browser
  journey on `feat/seller-gap-view`.

### Implemented on `b5-api-hardening`

- Plain `make api-test` now resolves root `eval.*` modules under strict mypy without an environment override or ignored imports.
- Live hardening covers create failure with no orphaned session, concurrent stale correction without overwrite, and protocol failure with guaranteed sideband close.
- Existing text and Live success-boundary logs now record actual external-call counts and monotonic elapsed milliseconds without adding a second state/metrics owner.
- Full API gate: **54 files formatted, lint passed, 52 sources strictly typed, and 139 tests passed**.
- Screenshot matching was not started because G4 still requires C5's real microphone → tool → revision proof; aggregate E2E and deployment remain blocked on C's absent Host B/build outputs.

### Implemented on `b6-agent-evaluation`

- Added a fixed 12-utterance decision-agent benchmark over the production `run_luna` loop,
  same four tools and frozen comparison evidence. Eleven model-backed scenarios are bounded to
  four calls each; the stale-turn scenario fails before a model call, for a structural ceiling
  of 44 paid requests.
- The first paid `gpt-6-luna` run used 28/44 requests and finished `partial`: scenario success
  10/12, tool behavior 11/11, UI/state outcomes 12/12, citation behavior 4/5, state correction
  1/1 and stale-turn protection 1/1. It was not retried; both failed scenarios remain in the
  committed artifact.
- `make eval` is now an actual phony command and projects the hash-validated agent artifact into
  `eval/results.json` without making a provider call.
- Added `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` and
  `docs/user-stories.md`, including Mermaid system/flow diagrams and explicit implemented versus
  planned status.
- Full API gate: **56 files formatted, lint passed, 54 sources strictly typed, and 156 tests
  passed**.
- The docs identify the main integration gap rather than hiding it: Host A still uses its legacy
  browser comparison/OpenAI path, and C3 has not connected it to the implemented Luna API.

### Implemented on `b7-agent-boundary-hardening`

- Text-agent preference mutation is now terminal for tool execution: the continuation uses
  `tool_choice: "none"`, and a provider function call after mutation is rejected before another
  application tool can run.
- Review tool and trusted prompt language distinguish the citeable review mention ID from the
  non-citeable review ID while preserving the server citation allowlist.
- Invalid final output after a committed mutation remains non-retryable and now returns the
  committed comparison revision so clients refresh instead of repeating intent.
- Agent artifact validation now covers the text-agent implementation. The B6 paid artifact is
  retained unchanged as historical evidence; `eval/results.json` reports the current agent
  measurement unavailable until an explicitly authorized B7 paid run.
- Full API gate: **56 files formatted, lint passed, 54 sources strictly typed, and 159 tests
  passed**. No provider call was made.

### Remaining integration

- Keep voice out of the main demo. The one authorized G4 run proved speech/captions/mutation but
  failed audible output; its generation-versus-playback root cause is unverified.
- Add the single Docker image, Render deployment and public smoke proof.
- A future real storefront cart must supply an authorized canonical listing/variant mapping
  rather than an inferred or hardcoded one. The demo cart already holds catalog variants.
