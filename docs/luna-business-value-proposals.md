# Luna — Business-Value Proposals Beyond the v3.2 Spec

**Date:** 31 October 2026 (hackathon day)
**Audience:** Developers A, B and C
**Status:** Proposal 1's backend and Host A Seller Centre page are implemented; counts cover
every active demo session. Seller authentication, ownership, persistence and week-over-week
history remain roadmap.
Proposals 2–5 remain proposals. The spec's cut order and kill switches win over anything in
this file.
**Source of truth for existing scope:** `Shopee_Compare_Luna_V3_Implementation_Spec.md`

## Why this file exists

The spec builds a strong **buyer** product: exact variants, grounded specs, review intelligence, a tool-using agent, voice. Our registered direction is **AI-Native Products & Operations**. The "Operations" half is empty today, and so are the levers a Shopee product judge thinks about first: returns and disputes, catalog data quality, seller chat load, and layered pricing. The spec's own rule still applies to every item below: a capability earns a place only if it **removes a real step, changes a visible outcome, preserves evidence and user control, and has a tested failure path** (spec §0.2).

Each proposal below is written in the same order: what the user or business can now do, why Shopee pays for it, what already exists to build on, and the honest cost.

---

## Proposal 1 — Seller Listing Gap Report

**Implementation status:** Developer B steps B-1 through B-5 are complete and tested. The
report now lives on Host A's **Seller Centre** page (top-bar link, `#/SellerCentre`), not in
the buyer comparison, and counts comparisons from every active buyer session (decision D-18).
Playwright proves the buyer widget shows no seller UI and that Seller Centre counts another
buyer session's S$70 exclusion with the weight/warranty gaps and the listing's two warranty
sentences.

### Business value, in plain language

Today a seller only knows that buyers looked at their listing and left. They never learn *why*. Luna already knows: the weight was not stated, the warranty contradicted itself, the price was above what the buyer typed. With this report, a seller opens one page and reads: "In 14 comparisons this week your power bank was dropped 9 times because weight is missing, 3 times on budget, 2 times on a warranty conflict. Competitors A and B state weight." They fix the listing in minutes.

For Shopee this is catalog quality at scale without a single ops person reading listings. Better attribute data improves search, filters, ads relevance and conversion for every buyer, not only Luna users. No marketplace tells sellers what buyers rejected them for **at the moment of decision**. That is the "operations redesigned with AI" story our pitch is missing.

For the pitch it gives Luna a second output from the same evidence: a decision for the buyer and a fix list for the seller.

### User story

Nothing is sent to sellers. Luna stores buyer comparisons as it already does; a seller pulls the aggregate for their own listing when they choose to look. Sellers never see a buyer's budget, preferences, conversation or identity. Only counts, plus their own listing text and competitors' public listing values.

**Real-world flow (what the pitch describes)**

Persona: Linh runs a small electronics shop on Shopee VN and sells a 20,000 mAh power bank.

1. Over the week, buyers use Luna to compare power banks. Linh's listing appears in some comparisons. Linh does nothing and knows nothing yet.
2. Linh opens Seller Centre to check orders. Under her power bank listing is one line: "Luna insight: compared 14 times, dropped 9 times. See why."
3. She opens it. Three blocks. **Gaps:** weight not stated; warranty says 12 months in the description and 24 months in attributes. **Beaten by:** two competitors state weight, one states cable length. **Why buyers dropped you:** missing weight 9, over budget 3, warranty conflict 2.
4. She taps "warranty conflict" and sees her own two sentences side by side. She realises she copied an old template.
5. She edits the listing in the normal Seller Centre editor: adds weight to attributes, fixes the warranty line. Luna edited nothing. She did.
6. Next week the line reads: compared 11 times, dropped 2 times, both over budget. The missing-weight reason is gone because later comparisons read the updated listing.

**Demo flow (what judges see today)**

1. Buyer compares the three exact variants, then sets a S$70 maximum, 65W minimum and portability before price. Listing C is excluded on budget; its evidence still records missing weight and conflicting warranty.
2. Presenter: "Same evidence, other side of the marketplace." Clicks **Seller Centre** in the storefront top bar and chooses the Comet listing (listing C). The page is labelled **demo seller view**.
3. Page shows the three blocks computed from every active buyer comparison on the demo server: missing weight, warranty conflict, competitors A and B state weight, and the `over_budget` exclusion count.
4. Presenter points at the warranty conflict. The listing's own two sentences ("Warranty: 1 year" and "Warranty: 24 months") are shown under it.
5. Close: "The buyer got a decision, the seller got the fix list. No second system, no extra model call."

**Honest limitation to say aloud:** step 6 of the real-world flow, the week-over-week improvement, is the point of the feature and cannot be shown in one day. We show the mechanism once and state that the loop closes when the listing is re-read. Seller login, listing ownership and counts that survive an API restart are roadmap; today the counts cover buyer sessions from the last hour in one server process.

### What it is

A read-only view per listing with three blocks:

1. **Evidence gaps** — each comparison field whose status for this listing is `missing`, `conflicting` or `unresolved`, with the field name and, for conflicts, both source snippets (reuses `Fact.status`, `Fact.conflicting_values`, `Evidence`).
2. **Beaten by** — fields where a competitor in the same comparison had a `supported` value and this listing did not.
3. **Why buyers excluded you** — counts of current comparison outcomes: failed budget, failed minimum power, or marked uncertain because a field was missing. Counts come **only** from real comparisons in active demo sessions on this server. No revision history or seeded numbers.

### What already exists to build on

- A's immutable `ComparisonEvidence` with per-field statuses (merged, PR #3).
- B2's deterministic filter/ranking already produces exclusion and uncertainty per item (`b2-deterministic-session-tools`, 119 tests).
- B's session store holds the latest state of each comparison, so current exclusion reasons can be counted without a history table.

### Honest cost and constraints

- **Zero new model calls.** The new gap-report response is an additive API contract. Existing
  comparison and agent-visible recommendation JSON remains unchanged.
- Spec §0 lists "seller administration" as out of scope. This is **read-only reporting**, not administration. Keep it that way: no edit, no publish, no seller login.
- Ranking now owns structured exclusion reasons and uncertain field names at the decision point.
  These are required in memory but excluded from comparison and agent serialization. C generates
  only the additive `ListingGapReport` types from OpenAPI; it does not receive a changed
  `Recommendation` contract.
- Demo exclusions must be produced live during the demo or in a rehearsal within the last hour on the same running server. The page says counts cover buyer comparisons from sessions started in the last hour.

### Exact implementation

Design decision, stated once: the ranking already knows the reason at the exact line it excludes an item. Record it there. Everything else is a read of saved state. No new model call, no new storage, no new exception class, no history table.

**Developer A: nothing.** A reviews B's PR only to confirm no `Fact.status` meaning was reinterpreted.

**Developer B**

B-1. `services/luna-api/app/contracts/session.py`

- Add the type alias next to `RankingPriority`:
  `type ExclusionReason = Literal["over_budget", "below_min_output"]`
- Add two fields to `Recommendation`, after `uncertain_item_keys`:
  `exclusion_reasons: dict[str, ExclusionReason] = Field(exclude=True)` (item_key to reason)
  `uncertain_fields: dict[str, list[str]] = Field(exclude=True)` (item_key to field keys that had no supported value)
- The exclusion is mandatory: seller-only metadata cannot enter existing comparison JSON,
  OpenAPI `Recommendation`, text-agent input/tool output or Live context.
- Keep `excluded_item_keys` and `uncertain_item_keys`. They are derived from the two dicts inside `rank_comparison` and nowhere else, so there is one owner.
- Add three response models:
  `ListingGapField`: `item_key: str`, `field_key: str`, `status: Literal["missing", "conflicting", "unresolved"]`, `conflicting_values: list[str]`, `evidence: list[Evidence]` (the listing text itself, so a seller page needs no buyer comparison)
  `ListingBeatenBy`: `item_key: str`, `field_key: str`, `competitor_item_keys: list[str]`
  `ListingGapReport`: `listing_id: str`, `schema_fields: list[SchemaField]`, `comparisons_count: int`, `gaps: list[ListingGapField]`, `beaten_by: list[ListingBeatenBy]`, `exclusion_counts: dict[ExclusionReason, int]`, `uncertainty_counts: dict[str, int]`

B-2. `services/luna-api/app/decision/ranking.py`, function `rank_comparison`

- Replace `excluded_item_keys: set[str] = set()` with `exclusion_reasons: dict[str, ExclusionReason] = {}`.
- Replace `uncertain_item_keys: set[str] = set()` with `uncertain_fields: dict[str, list[str]] = {}`.
- At the budget branch: `exclusion_reasons[item_key] = "over_budget"`.
- At the `max_output_w < preferences.min_output_w` branch: `exclusion_reasons[item_key] = "below_min_output"`.
- At the `max_output_w is None` branch: `uncertain_fields.setdefault(item_key, []).append("max_output_w")`.
- In the priority loop where `value is None`: `uncertain_fields.setdefault(item_key, []).append(priority)`.
- Membership checks for eligible and comparable items use the dicts.
- In the `return Recommendation(...)`: `excluded_item_keys=[k for k in item_keys if k in exclusion_reasons]`, `uncertain_item_keys=[k for k in item_keys if k in uncertain_fields]`, plus `exclusion_reasons=exclusion_reasons`, `uncertain_fields=uncertain_fields`.
- Checked on 31 October: `rank_comparison` is the only place that constructs `Recommendation`. Nothing else changes.

B-3. New file `services/luna-api/app/decision/gap_report.py`, one pure function

`def build_gap_report(comparisons: Iterable[ComparisonResponse], listing_id: str) -> ListingGapReport`

- Matching comparisons = every given comparison where some `evidence.items[i].listing_id == listing_id`.
- For each such comparison and each of its items with that listing id:
  gaps: every fact in `evidence.facts_by_item[item_key]` with `status != "supported"`, deduplicated on the whole row. Each comparison extracts independently, so two disagreeing findings are both listed.
  beaten_by: for each of those fields, the other item keys in the same comparison whose fact for that field is `supported`, deduplicated on `(item_key, field_key)` with competitors unioned.
  counts: `comparison.recommendation.exclusion_reasons.get(item_key)` increments `exclusion_counts`; each entry of `comparison.recommendation.uncertain_fields.get(item_key, [])` increments `uncertainty_counts`.
- `comparisons_count = len(comparisons)`.
- The store keeps only the latest `ComparisonResponse` per comparison id, so a count means "comparisons whose current state excludes this listing". There is no revision history and you must not add one.
- A listing in zero comparisons returns a report with zero counts and empty lists. That is a valid answer, not an error.
- Scope (decision D-18): the route passes every active session's comparisons. This is the deliberate exception to B2's isolation; the report carries counts and listing text only.

B-4. New file `services/luna-api/app/routes/listings.py`

- `GET /api/listings/{listing_id}/gap-report`, `response_model=ListingGapReport`, dependency `require_demo_session_state` from `app/routes/session_auth.py`, exactly like `get_catalog`.
- Body: `provider = cast(CatalogProvider, request.app.state.catalog_provider)`; if `await provider.get_listing(listing_id) is None` raise `CatalogError("unknown_listing")`; else build the report from every comparison in `request.app.state.demo_sessions` (already swept of expired sessions by the dependency, at most 1,000 comparisons).
- `CatalogError("unknown_listing")` is already mapped to HTTP 400 `UNKNOWN_LISTING` in `app/errors.py`. No new exception class, no new handler.
- Register the router in `create_app` in `app/main.py` after `catalog_router`.

B-5. Tests, no model calls

- `tests/decision/test_ranking.py`: in the existing hard-constraint test add `assert recommendation.exclusion_reasons == {"listingC:87w": "over_budget"}`; in the missing-weight test add `assert recommendation.uncertain_fields == {"listingC:87w": ["weight_g"]}`.
- New `tests/decision/test_gap_report.py` using the existing public `eval.fixtures` helpers
  (the proposed `tests/decision/fixtures.py` path was not found and was not invented):
  empty session returns `comparisons_count == 0` and empty collections;
  after one fixture comparison, the `listingC` report has a `weight_g` gap with status `missing`, a `warranty_months` gap with status `conflicting` and both values, and `beaten_by` for `weight_g` lists `["listingA:100w", "listingB:65w"]`;
  after `apply_preferences` with `max_price_minor=7000, min_output_w=65, priorities=["weight_g", "price_minor"]`, `exclusion_counts == {"over_budget": 1}`;
  after `apply_preferences` with `max_price_minor=8000, priorities=["weight_g", "price_minor"]` on a fresh comparison, `uncertainty_counts == {"weight_g": 1}`;
  the `listingA` report has empty `gaps` and empty `exclusion_counts`;
  calling the function twice returns equal objects.
- New `tests/routes/test_listings.py` using `create_authorized_client` from `tests/routes/test_comparisons.py`: 401 without a token with the existing `SESSION_REQUIRED` envelope; 400 `UNKNOWN_LISTING` for `listingZ`; 200 zero report before any comparison; the path appears in `GET /openapi.json`.
- Verify: `make api-test` exits 0.

**Developer C — implemented result**

C-1. The proposed `packages/luna-widget/src/contracts.ts` path and a generation command were
searched and not found. The frontend is JavaScript, so no generated-types claim or competing
handwritten transport type was invented; the running service's OpenAPI remains the source of
truth.

C-2. `packages/luna-widget/src/SellerGapReport.jsx` is a standalone seller page,
`<SellerGapReport apiBaseUrl="/api" />`.

- It starts its own demo session, lists the catalog's listings and fetches the chosen listing's report.
- Renders three lists straight from the report: gaps (with the listing text inline), beaten by, why buyers dropped you. It computes nothing: no counting, no sorting, no status reinterpretation.
- Fixed banner: demo seller view, no seller login, counts cover buyer comparisons from sessions started in the last hour on this demo server.

C-3. The existing API client fetches `GET /api/listings/{listingId}/gap-report`. If the API has
forgotten the page's session (HTTP 401), the page starts a new session and reads once more; the
report is a read, so this cannot duplicate work. Other failures show the widget's error text.

C-4/C-5. The buyer widget has no seller action. Host A's existing top-bar **Seller Centre** link
opens `#/SellerCentre` (`src/components/Section/SellerCentre.jsx`), a thin route that mounts
`SellerGapReport`. Host B is the buyer portability proof and has no seller page.

C-6. Playwright asserts the buyer journey shows no **Seller view** in both hosts, then (Host A)
runs a buyer comparison with a S$70 budget, opens Seller Centre from the top bar and asserts the
comparison and over-budget counts each rose by one over a baseline read, plus the weight gap,
both warranty sentences and the competitor that states weight.

**Done when**

- `make api-test` exits 0 with the new tests.
- `GET /api/listings/listingC/gap-report` returns a zero report before any comparison and, after Story C, shows the missing weight gap and `over_budget: 1`.
- A second GET returns identical JSON.
- **B complete:** the three backend conditions above pass, including a public create → ask →
  gap-report route test.
- **C complete for demo scope:** Host A's Seller Centre renders the report through
  `@luna/widget`'s `SellerGapReport`; the buyer widget in both hosts shows no seller UI.

---

## Proposal 2 — Review-Disputed Claims

### Business value, in plain language

A seller writes "20,000 mAh". Six of the forty reviews Luna analysed say the bank charges a phone twice, not four times. Today Luna shows the seller claim as `supported` because the seller's own sources agree with each other. The buyer finds out after delivery and files a return.

With this, the comparison cell shows the seller claim **and** a visible "disputed in analysed reviews" marker with the exact review quotes. The buyer decides with open eyes. Shopee sees fewer "not as described" returns and disputes, which are among the most expensive events in SEA e-commerce: reverse logistics, refunds, customer-service time, and seller penalties. It also strengthens our Deep Domain supporting story: a trustworthy system distinguishes "the seller is consistent" from "the seller is believed".

### What it is

A new status outcome where seller sources agree but review mentions contradict the claimed value or capability. Both sides stay visible. Language must stay sample-limited: "among 40 reviews analysed", never prevalence or fraud (spec §5 and §10.1 rules on review language apply).

### User story

**Real-world flow**

Persona: Minh is choosing between three power banks for a week of travel.

1. Minh adds three variants to the bucket. The table shows capacity for all three as stated by the sellers.
2. Listing B's capacity cell reads "20,000 mAh" with a small marker: "disputed in 6 of 40 reviews analysed". The other two cells have no marker.
3. Minh taps the marker. The drawer shows the seller's claim with its source line, and under it the six review excerpts in the reviewers' own words, each with its review ID. One says it charged a phone twice, not four times.
4. Minh asks Luna: "Is B's capacity claim reliable?" Luna answers that the seller states 20,000 mAh, six analysed reviews report lower real-world capacity, and Luna cannot verify the true figure. It cites the claim and the review IDs. It does not change the ranking, because a dispute is explanation, not a measured fact.
5. Minh picks listing A, which has no dispute, or buys B knowing the risk. Either way the "not as described" return that would have followed a blind purchase does not happen.

**Demo flow**

1. In the normalised table, point at the disputed marker on listing B's capacity cell.
2. Click it. Show the seller claim and the review excerpts side by side, read one excerpt aloud with its review ID.
3. Type or say: "Is B's capacity claim reliable?" Show the answer citing both sides and the sentence "Luna cannot verify the true figure."
4. Say the limitation: "Among 40 reviews analysed, not a defect rate."

**Honest limitation:** the threshold for raising a dispute is a number A chooses and records in `eval/`. One angry review must never flip the marker, and we say so if asked.

### What already exists to build on

- A's extraction already produces `Fact`, `Evidence` and `ReviewMention` with exact substrings and review IDs.
- The fixture already includes negative heat mentions and mixed-sentiment reviews; it needs one or two reviews that contradict a numeric seller claim.
- B's `inspect_evidence` and `get_review_aspect` tools can already return the citations; the agent can explain a dispute without a new tool.

### Honest cost and constraints

- **This is a contract change after G0.** Decision: one new optional field on `Fact`, `disputing_mention_ids`, defaulting to empty. Not a new `Status`. Spec §1.1: all three approve, and the fixture, the OpenAPI contract test and C's regenerated types change in the **same commit**.
- A's structured-output prompt and review validator gain one rule each (see exact steps). `check_status` keeps its invariant that only supported facts carry a value; a disputed fact is a supported fact with citations against it.
- Risk of over-claiming. One or two negative reviews must not flip a status. A sets a minimum mention count and records it in `eval/`.

### Exact implementation

Design decision, stated once: a disputed claim is still a consistent seller claim, so it stays `supported` and keeps its value. The dispute is a list of review mention ids attached to the fact. Ranking reads only status and value, so it cannot change by construction. The existing fixture validates unchanged because the default is empty. A fifth status would force ranking, tools, the agent prompt and C's table to each handle a new case.

**Developer A**

A-1. `services/luna-api/app/contracts/evidence.py`

- `Fact`: add `disputing_mention_ids: list[str] = Field(default_factory=list)`.
- `Fact.check_status`: add `if self.disputing_mention_ids and self.status != "supported": raise ValueError("Only supported facts can be disputed")`.
- `ComparisonEvidence.check_relationships`: for every fact, every id in `disputing_mention_ids` must be a key of `self.review_mentions` whose `item_key` equals the fact's item key, else `raise ValueError("Unknown or wrong-item disputing mention")`.
- `tests/evidence/test_contract.py`: one accepting case, one case per new rejection.

A-2. `services/luna-api/app/evidence/model.py`: `CandidateMention` gains `disputes_field_key: FieldKey | None`. The structured-output schema follows automatically because `responses.parse` uses this model.

A-3. `services/luna-api/app/evidence/prompt.py`, `REVIEW_PROMPT`, one added sentence: "If the reviewer reports an experienced or measured value that contradicts a listed specification field, set disputes_field_key to that field key; otherwise null. Opinions are not disputes."

A-4. `services/luna-api/app/evidence/reviews.py`

- `ReviewValidation` gains `disputes: dict[str, set[str]]` (field key to mention ids).
- In `validate_review_mentions`, build the `ReviewMention` with `candidate.model_dump(exclude={"disputes_field_key"})` because `ReviewMention` forbids extra fields, and when `candidate.disputes_field_key` is set add the mention id under that field key. Rejected candidates never reach `disputes`.

A-5. `services/luna-api/app/evidence/build.py`, `_analyze`, after the review batch loop

- Constant in `app/evidence/schema.py`: `DISPUTE_MIN_REVIEWS = 2`.
- For each field key in the merged disputes: count distinct `review_id` among those mentions. If the count is at least `DISPUTE_MIN_REVIEWS` and the fact for that field has `status == "supported"`, replace that fact with `fact.model_copy(update={"disputing_mention_ids": sorted(ids)})`. Otherwise leave the fact untouched. Facts are frozen, so copy rather than mutate.
- If spec extraction failed earlier, all facts are `unresolved` and nothing attaches. No special case needed.

A-6. Fixture `data/generate_fixtures.py`

- Add two reviews on `listingB` variant `65w` whose text contradicts the capacity claim in the reviewer's own words, for example "Charges my phone twice, nowhere near 20000mAh." Listing review count goes from 18 to 20, still inside spec §2.4's 12 to 20.
- Ground truth: label both as mentions with an existing aspect and a `disputes` block `{"listingB:65w": {"capacity_mah": [review ids]}}`.
- Regenerate `data/listings.json`, `data/reviews.json`, `data/ground_truth.json` with the generator, then regenerate `data/sample_comparison_evidence.json` with the same method used at A1 so `listingB:65w`'s `capacity_mah` fact carries the two mention ids. B2 and C tests load this file.

A-7. Tests and eval

- `tests/evidence/test_reviews.py`: one disputing review attaches nothing; two attach; two against a `missing` field attach nothing; a dispute from a sibling variant review is rejected as today.
- `eval/metrics.py`: add dispute precision and recall rows (emitted disputes matching labelled over emitted, and over labelled). Rerun `PYTHONPATH=services/luna-api python -m eval.run` from the repository root and update the table in `eval/README.md`.

**Developer B**

B-1. Ranking, tools, session store: no change. The field passes through `ComparisonResponse.evidence` and `get_comparison` untouched.

B-2. `tests/routes/test_comparisons.py`, `test_openapi_exposes_bearer_auth_and_canonical_comparison_contract`: assert `disputing_mention_ids` appears in the `Fact` schema.

B-3. `services/luna-api/app/openai/text_agent.py`, trusted system instruction, one added sentence: "A fact with disputing_mention_ids is a seller claim that analysed reviews contradict. Say so, cite those mention ids, and never change or drop the value." Confirm the existing citation validation accepts review mention ids as citations; spec §6.5 step 4 says it must.

B-4. Live delegation: no change, same tools.

**Developer C**

C-1. Regenerate `contracts.ts` from `GET /openapi.json`.

C-2. Specs table cell: when `fact.disputing_mention_ids.length > 0`, render a marker reading "disputed in N reviews analysed", where N is the number of distinct `review_id` among those mentions looked up in `comparison.evidence.review_mentions`. That is a lookup, not a computation of evidence.

C-3. Clicking the marker opens the existing evidence drawer with two sections: the fact's `evidence_ids` sources (the seller claim) and the disputing mentions' excerpts with review ids. No new drawer, no new state.

C-4. Never render the marker when the list is empty. Never change the cell's value or the row's position.

**Done when**

- Contract tests, review tests and `make api-test` exit 0.
- The regenerated fixture loads in B's tests with `listingB:65w` capacity disputed by two reviews.
- Asking "Is B's capacity claim reliable?" returns an answer citing the claim and both mention ids while `recommendation` is unchanged.
- `eval/results.json` contains the dispute rows with real numbers.

---

## Proposal 3 — True Landed Price

### Business value, in plain language

Shopee prices are layers: strike-through price, flash price, shop voucher, platform voucher, shipping fee. A buyer comparing three listings cannot tell which is actually cheapest without adding to cart three times. Luna already ranks on `price_minor`. With this, the ranking and the table use **the price the buyer would actually pay**, with the breakdown one click away. "Under S$80" means under S$80 delivered.

This is the single most recognisable friction for any Shopee buyer and judge. Our own live probe of the real site confirmed three price levels exist in Shopee's data (memory note, 30 October), so the shape is real, not invented.

### What it is

A deterministic price breakdown per selected variant: list price, applied discounts, shipping, landed total, each with its own evidence ID. Hard budget filtering uses the landed total. No model involvement; this is arithmetic over fixture fields.

### User story

**Real-world flow**

Persona: Hoa has S$80 to spend and three power banks in her bucket.

1. The table's price row shows one number per listing: the landed total. Listing A reads S$78, listing B reads S$81, listing C reads S$74. Under each is a faint "breakdown".
2. Hoa taps B's breakdown. List price S$69, shop voucher minus S$5, shipping S$17, landed S$81. B looked cheapest on the search page and is actually the most expensive delivered.
3. Hoa says: "Under S$80, at least 65W." Luna excludes B. The explanation says "B's delivered price is S$81, above your budget", and cites the shipping line.
4. Hoa says: "Actually I'll collect from a locker, no shipping." Luna cannot personalise shipping and says so. It keeps the stated assumption visible: "prices assume listed shipping and the listed shop voucher."
5. Hoa buys C and pays what the table said she would pay.

**Demo flow**

1. Point at the price row and say "this is the delivered price, not the sticker".
2. Open listing B's breakdown and show the shipping line that pushes it over.
3. Say "under S$80". B is excluded with the delivered-price reason cited.
4. State the assumption on screen: listed shipping and listed shop voucher, no personalised eligibility.

**Honest limitation:** real vouchers depend on the buyer, the time and the cart. We show one declared assumption and never claim to know what a specific buyer would pay after platform promotions.

### What already exists to build on

- Prices are already integer minor units with a currency code (spec §2.3).
- Budget is already a hard constraint in B2's ranking.

### Honest cost and constraints

- **Contract change after G0** (new price breakdown object on `items`), so the same three-way approval and same-commit rule as Proposal 2.
- Fixture must gain voucher and shipping fields for every listing (A), clearly labelled synthetic.
- Vouchers are user- and time-specific on the real platform. In the demo we show "assuming the listed shop voucher applies"; we do not claim personalised voucher eligibility.
- Highest buyer resonance of the five, highest coordination cost: touches A fixture, A contract, B ranking, C table. Do not start unless all three have spare time after G3.

### Exact implementation

Design decision, stated once: prices stay provider-owned and are never extracted, which `app/evidence/schema.py` already states. Two provider inputs are added per variant and one derived number is computed in exactly one place. The contract validator checks the arithmetic at load time, so a wrong fixture fails before ranking ever sees it. No toggle, no per-user voucher logic, no platform promotions.

**Developer A**

A-1. `data/generate_fixtures.py`: each variant gains `shipping_minor` and `shop_voucher_minor`, non-negative integers in SGD minor units, with `shop_voucher_minor <= price_minor`. Choose values so one listing changes order, for example `listingB` cheapest by sticker and most expensive delivered. Regenerate the three data files. Ground truth is untouched because prices are not labelled.

A-2. `services/luna-api/app/providers/mock.py`, `list_listings`: pass both fields through in each variant dict.

A-3. `services/luna-api/app/evidence/build.py`, `_analyze`, the `item` dict: add `shop_voucher_minor`, `shipping_minor`, and `landed_price_minor = price_minor - shop_voucher_minor + shipping_minor`. This is the only place it is computed.

A-4. `services/luna-api/app/contracts/evidence.py`, `ComparisonEvidence.check_relationships`, beside the existing price check: require the three new values to be non-negative integers and `landed_price_minor == price_minor - shop_voucher_minor + shipping_minor`, else `raise ValueError("Landed price must equal price minus shop voucher plus shipping")`. Regenerate `data/sample_comparison_evidence.json`. Add one rejecting contract test.

**Developer B**

B-1. `services/luna-api/app/decision/ranking.py`: rename `_price_minor` to `_landed_price_minor` and read `item["landed_price_minor"]`. The budget filter and the `price_minor` priority both call it, so delivered price is used everywhere without a second code path.

B-2. `services/luna-api/app/contracts/session.py`: `ComparisonSnapshotItem` gains `landed_price_minor`, `shipping_minor`, `shop_voucher_minor`; `app/decision/tools.py` `get_comparison` fills them from the item dict with the same strict integer checks as `_required_price_minor`. `app/routes/catalog.py` `CatalogVariantResponse` gains `shipping_minor` and `shop_voucher_minor`.

B-3. `tests/decision/test_ranking.py`: one test on the regenerated fixture where sticker order and landed order differ and the ranking follows landed. Extend the OpenAPI contract test for the new item fields.

B-4. `app/openai/text_agent.py` instruction, one sentence: "Budget constraints apply to landed_price_minor, which includes the listed shipping and shop voucher."

**Developer C**

C-1. Regenerate `contracts.ts`. The price row shows `landed_price_minor`. The column key stays `price_minor` so `focused_fields` keeps working; the column label reads "Delivered price".

C-2. A breakdown popover per cell lists list price, shop voucher, shipping, delivered total from the three item fields. Fixed label: "Assumes listed shipping and shop voucher."

C-3. No toggle, no editable shipping, no coin or platform voucher rows.

**Done when**

- Contract test rejects a fixture whose arithmetic is wrong.
- Ranking test shows the order flip on landed price.
- "Under S$80" excludes the listing whose delivered price exceeds the budget and the answer cites the delivered price.

### Implementation status — `feat/true-landed-price`

Implemented across the evidence, decision and shared-widget boundaries. The selected synthetic
SKUs now demonstrate sticker order A → B → C and delivered order C → A → B. In particular,
listing B moves from a S$69.65 list price to S$81.65 delivered after a S$5.00 shop voucher and
S$17.00 shipping, so an S$80 delivered budget excludes it. The comparison table labels the row
"Delivered price", shows list-versus-delivered values at a glance, and opens the fixed four-line
breakdown with the required assumption label. No user-specific voucher, coin, platform promotion,
shipping editor or toggle was added.

The fixture change intentionally makes the prior paid evidence and agent artifacts stale. They
remain unchanged as historical files; the free scorecard projection reports them unavailable
until a separately authorized rerun, rather than presenting old measurements as current proof.

---

## Proposal 4 — Evidence Gap to Seller Question Loop

### Business value, in plain language

When the weight is missing, today the buyer either guesses or opens seller chat and types "shop ơi, cái này nặng bao nhiêu?". Sellers answer the same ten questions hundreds of times, and Shopee measures them on response rate. With this, Luna drafts the exact question for the missing field in one tap, and when the seller answers, the answer becomes a cited fact with status "seller confirmed" that every later buyer sees. One question answered once, instead of once per buyer.

For Shopee: lower seller chat volume, higher response-rate metrics, and catalog gaps that close themselves over time.

### What it is

- A "Ask seller" action on any `missing` cell that produces a structured question (field, listing, variant).
- A simulated seller inbox that answers from a labelled fixture file.
- The answer enters evidence with `source_type` `external` or a new `seller_reply` type and a visible "confirmed by seller on <date>" label.

### User story

**Real-world flow**

Two personas: Tuan is a buyer comparing power banks. Linh is the seller of listing B.

1. Tuan's table shows listing B's weight cell as "not stated". Next to it is one button: "Ask seller".
2. Tuan taps it. Luna shows the exact question it will send, already filled in: "What is the weight in grams of the 20,000 mAh, 65W variant?" Tuan confirms. He typed nothing.
3. Linh sees one item in her Seller Centre inbox, tagged with the listing, the variant and the field. Not a chat thread, a form with one blank. She types "198" and submits.
4. Tuan's table updates: weight 198 g, labelled "confirmed by seller, 31 Oct". The cell is clickable and shows Linh's reply as its source.
5. The next buyer who compares listing B sees 198 g immediately. Linh never gets the weight question again. Her response-rate metric went up with one answer instead of forty.
6. If Linh's reply disagrees with her own listing text later, Luna shows both, the same way it already shows any conflict.

**Demo flow**

1. Click "Ask seller" on the missing weight cell. Show the drafted question.
2. Open the simulated seller inbox, labelled **simulated seller** on screen. Show the one-field form and submit the fixture answer.
3. Return to the comparison. The weight cell now shows the value with the "confirmed by seller" label. Click it to show the reply as evidence.
4. Say: "In production this inbox is Seller Centre chat. Today the seller side is a labelled mock."

**Honest limitation:** the seller reply is a fixture. We demonstrate the workflow shape, not chat integration, and we say so.

### Honest cost and constraints

- **The seller side is a labelled simulation.** Present it as a demonstrated workflow with a mock seller, never as chat integration. Spec rule: never fake access.
- Adding a new `source_type` is a contract change (same rules as Proposals 2 and 3). Reusing `external` avoids the contract change but blurs it with web evidence; A decides.
- Needs a small write path outside `apply_preferences`, which is currently the only P0 mutation (spec §6.3). Keep it as a plain route, not a fifth agent tool, so the four-tool rule stays intact.
- Lower priority than 1 and 2 because the demo payoff depends on a simulated reply.

### Exact implementation

Design decision, stated once: no new source type, no new status, no new validator, no write path into evidence. A seller reply is stored by the provider as one more variant attribute. The existing extraction turns it into a supported fact with a real evidence id through the same code that handles every other attribute. The snapshot version changes automatically because it hashes the listing, so an open comparison is never silently altered and a new comparison picks the reply up. The "confirmed by seller" label is derived from the evidence `source_location` prefix.

**Developer A**

A-1. `services/luna-api/app/providers/mock.py`: `async def add_seller_reply(self, listing_id: str, variant_id: str, field_key: str, text: str) -> None` appends `{"field_key": field_key, "text": text}` to `variant["seller_replies"]` (create the list if absent). Unknown ids raise the existing `CatalogError("unknown_listing")` or `CatalogError("unknown_variant")`. Add the method to the `CatalogProvider` protocol in `app/providers/base.py`.

A-2. `services/luna-api/app/evidence/index.py`, `build_evidence_index`: after the variant attributes loop, index `variant.get("seller_replies", [])` with `source_type="attribute"` at location `variants/{variant_id}/seller_replies/{n}` and the variant id. Three lines. Nothing else in extraction or validation changes.

A-3. `tests/evidence/test_pipeline.py`: after `add_seller_reply(..., "weight_g", "Weight: 198 g")`, the snapshot version differs and a new build yields a supported `weight_g` fact whose evidence `source_location` starts with `variants/87w/seller_replies/`.

**Developer B**

B-1. New `services/luna-api/app/routes/seller_replies.py`, both routes behind `require_demo_session_state`:

- `POST /api/listings/{listing_id}/variants/{variant_id}/questions`, body `{"field_key": FieldKey}`, returns `{"question": str}` built from `SCHEMA_FIELDS` label and unit and the variant label, for example "What is the Weight (g) of the 87W synthetic SKU?". Deterministic template, no model call. An unknown field key fails request validation at the boundary because the body type is the `FieldKey` literal.
- `POST /api/listings/{listing_id}/variants/{variant_id}/seller-replies`, body `{"field_key": FieldKey, "text": str}`, returns 201. Before storing, require `extract_source_values(field_key, text)` from `app/evidence/normalize.py` to be non-empty; otherwise return the existing 422 `INVALID_REQUEST`. A reply the pipeline could not parse is therefore never stored.
- Register the router in `create_app`.

B-2. `tests/routes/test_seller_replies.py`: question text for `weight_g`; 422 for text with no parsable value; 201 then a new `POST /api/comparisons` with the same selections returns a supported `weight_g` for that item.

**Developer C**

C-1. On any cell with status `missing`, an "Ask seller" button. Click calls the questions route and shows the returned question in a confirm dialog. Confirm navigates to the simulated inbox.

C-2. Simulated inbox page, banner fixed: "Simulated seller. In production this is Seller Centre chat." One form with the field label and a text input. Submit calls the seller-replies route.

C-3. After 201, C calls `POST /api/comparisons` with the same selections and replaces the current comparison. Spec §6.1 forbids re-extraction for preference changes; new evidence is the one case where a new comparison is correct.

C-4. In the evidence drawer, when `source_location` contains `/seller_replies/`, show the label "Confirmed by seller". No other UI change.

**Done when**

- A missing weight becomes a supported weight with a seller-reply evidence id after one simulated reply.
- The old comparison is unchanged until the buyer rebuilds it.
- A reply without a parsable value is rejected with 422 and nothing is stored.

---

## Proposal 5 — Vietnamese and Mixed-Language Reviews in the Fixture

### Business value, in plain language

Round-one judges are from Shopee Vietnam and Garena Vietnam. Our fixture is English with Singapore dollars. Real Shopee reviews are Vietnamese, Bahasa, Thai, Singlish, often mixed in one sentence. If Luna quotes a Vietnamese review in the original, tags it correctly as a negative heat mention, and the buyer still gets an English answer, we prove the extraction is built for this region, not for a textbook. If it only works in English, a Shopee judge will assume it does not work on their platform.

### What it is

Four to six fixture reviews in Vietnamese and one in Vinglish, spread across listings, including at least one negative heat mention and one review that disputes a claim (helps Proposal 2). Excerpts remain exact substrings. Aspect aggregation counts them. The evidence drawer shows the original text.

### User story

**Real-world flow**

Persona: Ngoc shops on Shopee VN. Most reviews on her shortlisted power banks are in Vietnamese, a few in English, some mixed.

1. Ngoc opens the heat aspect. The count says "negative in 7 of 38 reviews analysed" for listing A. She did not have to read 38 reviews in two languages.
2. She taps the count. The excerpts appear in the reviewers' original words. One reads "sạc nhanh nhưng nóng kinh khủng", one reads "gets hot when fast charging la". Each has its review ID. Nothing is translated away or paraphrased.
3. She asks Luna in Vietnamese: "cái nào ít nóng nhất?" Luna answers in Vietnamese, citing the same review IDs, and says the count is among reviews analysed.
4. She asks the same question in English. Same citations, same answer. The evidence did not change with the language of the question.

**Demo flow**

1. Open the heat aspect for listing A and click the negative count.
2. Point at a Vietnamese excerpt and read it aloud. Say: "Luna quotes the reviewer, it does not rewrite them."
3. Ask one question in Vietnamese if the presenter is comfortable, otherwise in English, and show the citations match the excerpts just shown.
4. Say: "Same extraction, same evidence rules, in the language your buyers actually write in."

**Honest limitation:** this is a fixture change plus a rerun of the scorer. If extraction precision on the Vietnamese rows is lower, the scorecard shows it; we do not remove the rows to protect the number.

### Honest cost and constraints

- Fixture-only for A, plus re-running `eval/run.py` so `results.json` reflects the new reviews. **No contract change.**
- Must not be a last-minute change to `data/` after A4's `results.json` exists unless A reruns the scorer; a stale scorecard is a false report.
- If extraction precision drops on these rows, say so on the scorecard rather than removing them.

### Exact implementation

Design decision, stated once: this is a fixture change plus a scorer rerun. The substring rule that validates excerpts is Python `in` on `str`, which is Unicode-correct, so no code path changes. No translation field, no language setting, no detection.

**Developer A**

A-1. `data/generate_fixtures.py`: add two reviews per listing with exact variant ids, so each listing goes from 18 to 20 reviews. Include at least: one Vietnamese negative heat mention ("sạc nhanh nhưng nóng kinh khủng"), one mixed-language review ("gets hot when fast charging la, but charges my laptop ok"), one Vietnamese positive portability mention. If Proposal 2 lands, one of these is the capacity dispute. Write the files with `ensure_ascii=False` so the JSON is readable; the escaped form also round-trips, so this is optional.

A-2. Ground truth: label each new review's aspect and sentiment units with the exact supporting span copied from the text.

A-3. `services/luna-api/app/evidence/prompt.py`, `REVIEW_PROMPT`, one added sentence: "Reviews may be in any language. Copy excerpts exactly in the original language; never translate or normalise them."

A-4. `tests/evidence/test_reviews.py`: a Vietnamese excerpt with diacritics is accepted when exact and rejected when diacritics are stripped.

A-5. Rerun `PYTHONPATH=services/luna-api python -m eval.run` from the repository root. Update the counts in `eval/README.md` (reviews, labelled units) and commit the new `eval/results.json`. If review mention precision drops, the number stays and the scorecard says why.

A-6. Order rule: do this before A4's scorer is declared final. A fixture change after `results.json` exists without a rerun is a false report.

**Developer B: nothing.** The agent already answers in the buyer's language. Do not add a language knob.

**Developer C: nothing to build.** Confirm the evidence drawer font renders Vietnamese diacritics in both hosts. No translation toggle.

**Done when**

- The heat aspect for the chosen listing lists a Vietnamese excerpt with its review id.
- `eval/results.json` reflects the enlarged corpus and the README counts match it.
- Review tests exit 0.

---

## Recommended order and blockers

Mapped to the spec's work steps and gates (§1.2, §1.3). Times are the spec's clock.

| Order | Proposal | Earliest start | Blocked by | Owner path | Cut if |
|---|---|---|---|---|---|
| 1 | **Seller Listing Gap Report** | After **G2** passes (03:30) | B2 exclusion reasons exposed; B3 agent merged so B has capacity; C3 wired so C has a working Host A | B route + aggregation, then C Seller Centre page in Host A | G2 slips, or C4 portability (G3) is red |
| 2 | **Vietnamese reviews in fixture** | After A3 reviews pass (04:00) and **before** A4 scorer runs | A3 complete; A4 not yet frozen | A only | A4 is behind; never edit fixture after `results.json` without rerunning |
| 3 | **Review-disputed claims** | After **G3** (04:15) | Three-way contract approval; A3 done; C generated types regenerable | A extraction + validator, B snapshot/test, C marker | Any P0 test red, or approval not obtained by 04:30 |
| 4 | **True landed price** | After **G4** decision (04:45), only with slack in all three streams | Three-way contract approval; fixture voucher fields; B ranking change; C table change | A, B, C in one commit | Normally roadmap. Spec §8 says B takes at most one optional item |
| 5 | **Seller question loop** | Roadmap slide | Contract decision on `source_type`; mock seller inbox; write route | A, B, C | Default: do not build today |

**Hard rules carried over from the spec**

- **G5 feature freeze at 05:45** applies to every proposal. After that, only correctness fixes and demo evidence.
- Spec §8: B takes **at most one** optional item. Proposal 1 is B's optional item if chosen; then B does **not** also take screenshot matching.
- Kill switches (§1.3): if G2 misses 03:30, stop all optional work including everything here. If G3 fails, C fixes portability before any new page.
- Any contract change (Proposals 2, 3, 4) requires all three to approve and must update the fixture, OpenAPI snapshot and compatibility test in the same commit (§1.1). A contract change that misses that rule is rejected regardless of business value.
- Nothing here uses a live Shopee account, scrapes, or claims integration. Simulated parts are labelled on screen.

**Why this order**

Proposal 1 first because it adds the missing Operations half of our pitch with no model calls and no contract change, and the judges can see it in the same session that produced the buyer's decision. Proposal 5 second because it is fixture-only and targets the actual judging panel. Proposal 2 third because it is the strongest trust and returns story but costs a contract change. Proposals 3 and 4 are real value with coordination costs that do not fit a seven-hour day; they belong on one honest roadmap slide with the cost stated.

## How this changes the judge demo (§13)

Insert one beat after the correction step and before the portability switch, about ten seconds:

> "Same evidence, other side of the marketplace." Click **Seller Centre** in the top bar and choose the listing Luna just excluded. Read the top reason aloud: missing weight, and the competitor that states it. "The buyer got a decision; the seller got the fix."

Pitch sentence addition: **"Luna turns every comparison into two outputs: a defensible decision for the buyer and a precise fix list for the seller."**

## What this file does not claim

- No conversion, GMV, return-rate or chat-volume lift numbers. We have none and will not invent any.
- No real Shopee seller, voucher or chat integration. All data paths run on the labelled mock provider.
- Exclusion counts in the gap report are from active demo sessions on one server only and are shown as such.
