# Luna — Business-Value Proposals Beyond the v3.2 Spec

**Date:** 31 October 2026 (hackathon day)
**Audience:** Developers A, B and C
**Status:** proposals, not commitments. Nothing here starts before **G2 (03:30)** passes. The spec's cut order and kill switches win over anything in this file.
**Source of truth for existing scope:** `Shopee_Compare_Luna_V3_Implementation_Spec.md`

## Why this file exists

The spec builds a strong **buyer** product: exact variants, grounded specs, review intelligence, a tool-using agent, voice. Our registered direction is **AI-Native Products & Operations**. The "Operations" half is empty today, and so are the levers a Shopee product judge thinks about first: returns and disputes, catalog data quality, seller chat load, and layered pricing. The spec's own rule still applies to every item below: a capability earns a place only if it **removes a real step, changes a visible outcome, preserves evidence and user control, and has a tested failure path** (spec §0.2).

Each proposal below is written in the same order: what the user or business can now do, why Shopee pays for it, what already exists to build on, and the honest cost.

---

## Proposal 1 — Seller Listing Gap Report

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

1. Buyer flow exactly as spec §13: three variants, normalised table, review aspects, "under S$80, at least 65W, prioritise portability". Listing B is excluded. Correction with "actually prioritise price".
2. Presenter: "Same evidence, other side of the marketplace." Clicks "Seller view" and picks listing B. The page is labelled **demo seller view**.
3. Page shows the three blocks computed from the comparisons just made: missing weight, warranty conflict, competitors A and C state weight, dropped twice **in this session** for missing weight.
4. Presenter clicks the warranty conflict. The same evidence drawer the buyer saw opens with both snippets.
5. Close: "The buyer got a decision, the seller got the fix list. No second system, no extra model call."

**Honest limitation to say aloud:** step 6 of the real-world flow, the week-over-week improvement, is the point of the feature and cannot be shown in one day. We show the mechanism once and state that the loop closes when the listing is re-read. Seller Centre placement, seller login, listing ownership and cross-buyer aggregation beyond the demo process are roadmap.

### What it is

A read-only view per listing with three blocks:

1. **Evidence gaps** — each comparison field whose status for this listing is `missing`, `conflicting` or `unresolved`, with the field name and, for conflicts, both source snippets (reuses `Fact.status`, `Fact.conflicting_values`, `Evidence`).
2. **Beaten by** — fields where a competitor in the same comparison had a `supported` value and this listing did not.
3. **Why buyers excluded you** — counts of exclusions per reason, aggregated over this session's `apply_preferences` runs: failed budget, failed minimum power, marked uncertain because a field was missing. Counts come **only** from real demo sessions. No seeded numbers.

### What already exists to build on

- A's immutable `ComparisonEvidence` with per-field statuses (merged, PR #3).
- B2's deterministic filter/ranking already produces exclusion and uncertainty per item (`b2-deterministic-session-tools`, 119 tests).
- B's session store holds every revision, so exclusion reasons can be counted from saved state.

### Honest cost and constraints

- **Zero new model calls. No contract change.** It is a projection of state B already owns.
- Spec §0 lists "seller administration" as out of scope. This is **read-only reporting**, not administration. Keep it that way: no edit, no publish, no seller login.
- B2 must expose exclusion **reasons**, not only excluded item keys. Checked on 31 October: `services/luna-api/app/decision/ranking.py` records `excluded_item_keys` and `uncertain_item_keys` as sets, and the uncertainty cause survives only as a prose note. B adds a per-item reason enum (failed budget, failed minimum power, uncertain on a named field) to `Recommendation` in `app/contracts/session.py`. That is a B-owned session-contract addition, not an A evidence-contract change, but C's generated types must be regenerated.
- Demo exclusions must be produced live during the demo or in the rehearsal session visible to judges. Say "in this session" on screen.

### Ownership

- **B:** `GET /api/listings/{listing_id}/gap-report` (session-authenticated like the other routes) plus the exclusion-reason aggregation. Tests: empty session, listing with no gaps, listing in zero comparisons, second run gives the same counts.
- **C:** one plain page in Host A under a `#/Seller` route, rendering B's response. Must also render in `minimal-host` through the adapter, or it does not count as portable.
- **A:** nothing new. A confirms field status semantics are not reinterpreted.

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

- **This is a contract change after G0.** Either a new `Status` literal (for example `disputed`) or a new `Fact` field such as `disputing_mention_ids`. Spec §1.1: all three approve, and the fixture, OpenAPI snapshot and compatibility test change in the **same commit**. C's generated types must be regenerated.
- A's structured-output prompt and validator need a new rule: a disputed fact keeps its `value` (unlike `conflicting`), so the existing `check_status` invariant in `app/contracts/evidence.py` must be extended deliberately, not bypassed.
- Risk of over-claiming. One or two negative reviews must not flip a status. A sets a minimum mention count and records it in `eval/`.

### Ownership

- **A:** status or field, extraction rule, two fixture reviews, validator, eval row.
- **B:** OpenAPI snapshot, compatibility test, ranking unchanged (disputed facts stay out of the lexicographic sort; they are explanation only, same rule as review reliability in spec §6.4).
- **C:** disputed marker in the table cell and the evidence drawer.

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

---

## Recommended order and blockers

Mapped to the spec's work steps and gates (§1.2, §1.3). Times are the spec's clock.

| Order | Proposal | Earliest start | Blocked by | Owner path | Cut if |
|---|---|---|---|---|---|
| 1 | **Seller Listing Gap Report** | After **G2** passes (03:30) | B2 exclusion reasons exposed; B3 agent merged so B has capacity; C3 wired so C has a working Host A | B route + aggregation, then C page in Host A and `minimal-host` | G2 slips, or C4 portability (G3) is red |
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

> "Same evidence, other side of the marketplace." Open the Seller Gap Report for the listing Luna just excluded. Read the top reason aloud: missing weight, and the competitor that states it. "The buyer got a decision; the seller got the fix."

Pitch sentence addition: **"Luna turns every comparison into two outputs: a defensible decision for the buyer and a precise fix list for the seller."**

## What this file does not claim

- No conversion, GMV, return-rate or chat-volume lift numbers. We have none and will not invent any.
- No real Shopee seller, voucher or chat integration. All data paths run on the labelled mock provider.
- Exclusion counts in the gap report are from demo sessions only and are shown as such.
