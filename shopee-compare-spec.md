# Shopee Compare

## Evidence-Grounded AI Product Comparison for Messy Marketplace Listings

**Status:** Hackathon build specification\
**Product thesis:** The comparison bucket is the UX. The technical
product is an evidence-grounded normalization layer that turns
inconsistent seller-authored listings and exact variants into a
trustworthy, comparable temporary catalog.\
**Primary user:** Buyer actively comparing similar products on Shopee\
**Primary business hypothesis:** Reducing research friction keeps
high-intent comparison activity inside Shopee and increases
comparison-to-cart / comparison-to-purchase conversion.\
**Hackathon constraint:** Build from scratch in a 7-hour window with a
3--4 person team.

------------------------------------------------------------------------

# 1. One-line pitch

**Shopee Compare lets buyers add similar listings to a comparison
bucket, then uses AI to resolve the exact variants, normalize
inconsistent seller information into a shared category-specific schema,
cite every extracted specification back to its evidence, flag
contradictions, and abstain when the listing does not support a claim.**

The system does **not** decide what the buyer should buy. It gives the
buyer a trustworthy common representation of the products they already
chose to compare.

------------------------------------------------------------------------

# 2. Why this product exists

Shopee already helps buyers discover alternatives. Its Singapore Help
Centre documents a **Similar** flow from the cart that displays similar
products so buyers can compare prices, offers, and variations. Shopee
also lets buyers save products in **My Likes** and find similar products
from there.

That solves candidate discovery.

It does not solve the next problem:

> **How do I reliably compare several seller-authored listings that
> describe similar products in different formats, with different variant
> names, incomplete fields, marketing language, images, and occasionally
> contradictory claims?**

The desired journey is:

``` text
Search / Similar Products / My Likes
                ↓
         buyer sees candidates
                ↓
             + Compare
                ↓
         Comparison Bucket
                ↓
     exact variant resolution
                ↓
 evidence-grounded normalization
                ↓
     trustworthy comparison table
                ↓
        buyer chooses product
                ↓
            Add to Cart
```

The product deliberately sits **downstream of search, recommendations,
Similar Products, and sponsored discovery**. It does not rerank the
marketplace or replace Shopee's existing ad/recommendation systems.

------------------------------------------------------------------------

# 3. What is novel --- and what is not

## Not the innovation

These are not novel claims:

-   product comparison tables;
-   AI shopping assistants;
-   "compare these products";
-   summarizing product specifications;
-   highlighting which product has the largest number in a column.

Amazon's current shopping AI already supports selecting multiple
products from search results and comparing them side-by-side. Therefore
the hackathon pitch must never claim that AI product comparison itself
is new.

## The engineering problem

Shopee Compare focuses on the harder marketplace-specific layer:

``` text
seller-authored listing A ─┐
seller-authored listing B ─┼─► temporary normalized product catalog
seller-authored listing C ─┘
```

The system must determine:

1.  What exact product/variant is this listing describing?
2.  Which attributes are genuinely comparable across these products?
3.  Which values are explicitly supported by listing evidence?
4.  Which values need unit/terminology normalization?
5.  Where do title, description, structured attributes, selected
    variant, or images disagree?
6.  When should the system say **Not stated** instead of guessing?
7.  Which differences are meaningful for the buyer's stated use case?

The core promise is:

> **No specification in the comparison table without traceable evidence
> or an explicit "not stated / conflicting" status.**

------------------------------------------------------------------------

# 4. Flagship user story

A buyer searches:

``` text
65W+ power bank for laptop
```

They open three Shopee-style listings:

``` text
Listing A
"UGREEN Nexode Power Bank 20000mAh 100W Fast Charging Laptop PD"

Variations:
- 100W Black
- 130W Black
- 100W + Cable
- 130W + Cable


Listing B
"ANKER Power Bank 20K 87W Laptop Portable Charger"

Variations:
- A1383 Black
- A1383 White


Listing C
"BASEUS 20000mAh 65W/100W PD Fast Charge Powerbank"

Variations:
- 65W
- 100W
- 100W + Cable
```

The buyer selects exact variants and taps:

``` text
[ + Compare ]
```

A persistent bucket appears:

``` text
COMPARE (3)

UGREEN 100W
ANKER 87W
BASEUS 100W

[ Compare now ]
```

Shopee Compare produces:

  Specification                 UGREEN        ANKER           BASEUS
  ----------------------- ------------ ------------ ----------------
  Exact variant             20K / 100W        A1383       20K / 100W
  Current listing price          S\$79        S\$89            S\$55
  Rated capacity            20,000 mAh   20,000 mAh       20,000 mAh
  Max output                     100 W         87 W            100 W
  USB-C ports                        2            2                2
  Weight                         420 g        350 g   **Not stated**
  Warranty                   24 months    24 months    ⚠ Conflicting
  Included cable                   Yes           No              Yes

A buyer can click any cell:

``` text
UGREEN → Max output → 100 W

Evidence
────────────────────────────
Source: Product description
"USB-C1/C2 maximum output: 100W"

Source: Selected variant
"100W Black"

Confidence: High
```

For a contradiction:

``` text
BASEUS → Warranty

⚠ Conflicting information

Listing title:
"24 Months Local Warranty"

Description:
"12-month seller warranty"

The comparison does not choose one silently.
```

------------------------------------------------------------------------

# 5. Product principles

## 5.1 Compare the exact selected variant

A marketplace listing is not necessarily a single product configuration.

The selected variant can change:

-   power;
-   capacity;
-   storage;
-   size;
-   colour;
-   accessories;
-   warranty bundle;
-   price;
-   promotion eligibility;
-   model number.

Therefore:

``` text
Listing != Comparison Item
```

The actual comparison unit is:

``` text
ComparisonItem =
Listing
+ SelectedVariant
+ CurrentListingState
```

If the exact variant cannot be resolved confidently, the item must not
enter the final normalized table without a warning.

## 5.2 Evidence before fluency

A polished answer is not enough.

For every normalized field:

``` text
normalized value
        ↓
must point to
        ↓
source evidence
```

The model may transform:

``` text
"0.42 kg"
```

into:

``` text
420 g
```

but must preserve the source text and transformation.

## 5.3 Missing means missing

If the seller never states the weight:

``` text
Weight: Not stated
```

Never infer a likely weight from:

-   another seller;
-   a similar model;
-   model memory;
-   general web knowledge;
-   category averages.

## 5.4 Contradictions remain visible

If authoritative listing evidence disagrees:

``` text
Title:       100W
Description: 65W
Image:       100W
```

the default output is:

``` text
⚠ Conflicting information
```

not a guessed resolution.

The system may rank source reliability, but it must retain the
disagreement and make the resolution policy explicit.

## 5.5 The buyer decides

The product may explain trade-offs.

It should not present a universal:

``` text
BEST PRODUCT
```

unless the user explicitly provides a preference function that makes the
choice deterministic.

Prefer:

``` text
Best fit for your stated priorities
```

and explain why.

------------------------------------------------------------------------

# 6. Scope

## In scope

For the hackathon:

-   electronics/accessories only;
-   2--4 products per comparison;
-   exact variant selection;
-   title;
-   seller description;
-   structured product attributes;
-   variation names;
-   price;
-   optional listing images if time permits;
-   AI-generated comparison schema;
-   evidence-grounded extraction;
-   normalization;
-   contradiction detection;
-   abstention;
-   side-by-side comparison;
-   buyer question such as:
    -   "Which is lighter?"
    -   "Which can charge my laptop?"
    -   "Show only meaningful differences."
-   evaluation harness.

## Out of scope

-   searching the entire Shopee catalog;
-   changing Shopee ranking;
-   recommending sponsored products;
-   seller replacement;
-   web-wide fact enrichment in the MVP;
-   review summarization;
-   fake-review detection;
-   personalized pricing;
-   auto-purchase;
-   predicting return probability;
-   claiming conversion lift from offline tests;
-   building a universal schema for every Shopee category.

------------------------------------------------------------------------

# 7. Why start with electronics

Electronics are ideal for the MVP because:

1.  products have dense comparable specifications;
2.  units can be normalized deterministically;
3.  exact variants matter;
4.  seller naming is often inconsistent;
5.  mistakes are obvious and costly to buyer trust;
6.  human-labelled ground truth is feasible;
7.  the demo is visually understandable.

Good demo categories:

``` text
power banks
wireless headphones
mechanical keyboards
monitors
USB-C chargers
portable SSDs
```

The flagship category should be **power banks or chargers** because
wattage, capacity, ports, weight, protocols, accessories, and warranty
create useful normalization problems without requiring a huge schema.

------------------------------------------------------------------------

# 8. System architecture

``` text
┌───────────────────────────────────────────────┐
│             Comparison Bucket                 │
│ listing + selected variant + current price   │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│          Listing Evidence Collector           │
│ title / description / attributes / variant   │
│ optional images                               │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│           Variant Identity Resolver           │
│ Which exact configuration is selected?        │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│        Comparison Schema Generator            │
│ What fields matter across THIS product set?   │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│       Evidence-Grounded Field Extractor       │
│ value + evidence + confidence + source        │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│        Deterministic Normalization Layer      │
│ units / enums / formatting / type checks      │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│        Contradiction & Abstention Layer       │
│ supported / missing / conflicting / invalid   │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│             Comparison Table                  │
│ evidence-backed cells + differences           │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│        Buyer Preference / Q&A Layer           │
│ explanation over normalized evidence only     │
└───────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 9. Core domain model

``` python
@dataclass(frozen=True)
class Evidence:
    source_type: Literal[
        "title",
        "description",
        "structured_attribute",
        "variant",
        "image"
    ]
    source_id: str
    text: str
    location: str | None = None


@dataclass(frozen=True)
class ExtractedValue:
    field: str
    raw_value: str | None
    normalized_value: str | int | float | bool | None
    unit: str | None
    status: Literal[
        "supported",
        "missing",
        "conflicting",
        "invalid"
    ]
    confidence: float
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class ComparisonItem:
    listing_id: str
    seller_id: str
    listing_title: str
    selected_variant_id: str
    selected_variant_label: str
    current_price: int
    evidence: tuple[Evidence, ...]


@dataclass(frozen=True)
class ComparisonSchemaField:
    key: str
    label: str
    value_type: Literal["number", "enum", "boolean", "text"]
    canonical_unit: str | None
    importance: Literal["primary", "secondary"]
```

------------------------------------------------------------------------

# 10. Variant resolution

This is a hard correctness boundary.

Input:

``` text
Listing title
Variation hierarchy
Selected variation IDs
Variation labels
Description references
```

Output:

``` json
{
  "model_family": "UGREEN Nexode",
  "model_number": "PB720",
  "selected_variant": "100W Black",
  "bundle": "power_bank_only",
  "confidence": 0.98,
  "evidence": ["variant:100W Black", "description:PB720"]
}
```

## Failure behavior

If the selected variant says:

``` text
"Option 3"
```

and the listing content does not establish what Option 3 means:

``` text
Variant identity: unresolved
```

The UI asks the user to confirm or excludes variant-specific fields.

Never borrow specifications from another variant in the same listing
without evidence.

------------------------------------------------------------------------

# 11. Dynamic comparison schema

A static universal schema is brittle.

Instead:

``` text
comparison items
      ↓
category / product family inference
      ↓
candidate comparison dimensions
      ↓
schema
```

For power banks:

``` text
capacity
max output
max input
USB-C ports
USB-A ports
charging protocols
weight
dimensions
included cable
airline suitability
warranty
```

For headphones:

``` text
ANC
battery life
weight
codec
multipoint
water resistance
wired mode
microphone
warranty
```

## Guardrail

The model generates the **schema labels and semantic definitions**, not
arbitrary factual values.

Schema generation output must be structured JSON.

Example:

``` json
{
  "fields": [
    {
      "key": "max_output_w",
      "label": "Maximum output",
      "type": "number",
      "canonical_unit": "W",
      "definition": "Maximum advertised charging output of the selected variant."
    }
  ]
}
```

For the hackathon, cap the schema at approximately **8--12 useful
fields**.

------------------------------------------------------------------------

# 12. Evidence-grounded extraction

The extractor receives:

``` text
schema
+
listing evidence
+
selected variant
```

and returns only structured claims.

Example:

``` json
{
  "field": "max_output_w",
  "raw_value": "100W Max Fast Charging",
  "normalized_candidate": 100,
  "unit": "W",
  "status": "supported",
  "confidence": 0.96,
  "evidence_ids": ["description:line_14", "variant:v3"]
}
```

The LLM must not return a supported value without at least one evidence
ID.

Programmatic validation rejects:

``` text
status == supported
AND
evidence_ids is empty
```

------------------------------------------------------------------------

# 13. Deterministic normalization

Do not ask the LLM to perform conversions that code can perform
reliably.

Examples:

``` text
0.42 kg       → 420 g
20 Ah         → 20,000 mAh
100 watts     → 100 W
2 years       → 24 months
```

Use deterministic unit conversion after extraction.

Pipeline:

``` text
LLM:
"raw value is 0.42 kg"

CODE:
parse quantity
validate dimension
convert kg → g
render 420 g
```

Benefits:

-   reproducibility;
-   lower hallucination surface;
-   easier testing;
-   exact comparison.

------------------------------------------------------------------------

# 14. Source precedence and contradictions

Potential source types:

``` text
selected variant
structured attribute
description
title
image text
```

Do not silently assume one universal precedence order is always correct.

For the MVP use an explicit policy such as:

1.  exact selected-variant metadata for variant identity;
2.  structured specification attached to the selected variant;
3.  listing structured attributes;
4.  description;
5.  title;
6.  image-extracted text.

But if two credible sources materially disagree:

``` text
status = conflicting
```

Example:

``` json
{
  "field": "warranty_months",
  "status": "conflicting",
  "claims": [
    {
      "value": 24,
      "evidence": "title"
    },
    {
      "value": 12,
      "evidence": "description"
    }
  ]
}
```

The UI shows both.

------------------------------------------------------------------------

# 15. Confidence is not truth

Do not use:

``` text
confidence > 0.9
```

as proof that a claim is correct.

Confidence controls **abstention policy** only.

Example:

``` text
if confidence < threshold:
    status = "needs_review"
```

The evaluation must measure whether changing the threshold improves
precision at the cost of coverage.

The desired product behavior is:

``` text
low confidence
      ↓
show less
```

not:

``` text
low confidence
      ↓
guess anyway
```

------------------------------------------------------------------------

# 16. Comparison rendering

Default table behavior:

1.  show exact selected variant;
2.  show current price separately from extracted specs;
3.  put primary decision fields first;
4.  highlight differences;
5.  collapse identical/low-value fields;
6.  display `Not stated` explicitly;
7.  display contradictions explicitly;
8.  make every supported value clickable for provenance.

Possible cell states:

``` text
100 W
Not stated
⚠ Conflicting
Variant unresolved
```

Never use a blank cell for missing information.

------------------------------------------------------------------------

# 17. "Show only differences"

This is a high-value demo feature and cheap to build.

If all products have:

``` text
20,000 mAh
```

the user can toggle:

``` text
[ Show only differences ]
```

and collapse identical rows.

This reduces a 12-row table to perhaps:

``` text
price
max output
weight
warranty
included cable
```

The AI's job is normalization; once normalized, difference detection is
deterministic.

------------------------------------------------------------------------

# 18. Buyer preference layer

After the table exists, the buyer can ask:

``` text
"I use a MacBook Pro and travel a lot.
Which differences actually matter?"
```

The assistant must answer **only from normalized comparison data plus
explicitly supplied buyer context**.

Example:

``` text
For travel, the largest relevant difference in these listings is weight:
Anker is listed at 350 g versus UGREEN at 420 g.

Both listings claim enough output for laptop charging, but the Baseus
listing does not state its weight, so I can't reliably compare portability
for that option.
```

Every factual product claim in the explanation must reference normalized
fields that themselves have evidence.

No free-form model-memory product facts in MVP.

------------------------------------------------------------------------

# 19. Recommendation policy

Avoid:

``` text
"Product A is best."
```

Prefer:

``` text
"If your priority is lowest listed weight, A leads among the products
with stated weight."

"If your priority is highest listed charging output, B leads."

"C cannot be ranked on portability because its weight is not stated."
```

If the user explicitly gives weighted priorities:

``` text
weight: very important
price: important
output above 65W: not important
```

the system may compute a fit explanation.

But it should show the reasoning rather than hide it behind a score.

------------------------------------------------------------------------

# 20. Ads and marketplace economics

Shopee Compare does not control candidate discovery.

The existing systems continue to own:

``` text
search
recommendations
Similar Products
sponsored listings
seller ads
```

The buyer manually adds a listing to the comparison bucket.

Therefore:

``` text
ad/recommendation exposure
        ↓
buyer consideration
        ↓
+ Compare
```

The feature does not silently substitute a different seller or product
after the seller has earned consideration.

For the MVP:

**Do not insert sponsored alternatives inside the comparison table.**

The comparison surface needs trust.

------------------------------------------------------------------------

# 21. Business hypothesis

The system does not directly spend Shopee's money.

The hypothesis is:

``` text
better in-platform research
        ↓
less comparison friction
        ↓
more confident product choice
        ↓
higher comparison → cart conversion
        ↓
higher completed GMV
```

The hackathon cannot prove the behavioral arrows.

Therefore do not claim:

``` text
"Shopee Compare increases GMV by X%."
```

Offline evaluation proves **information quality and system
performance**.

A production experiment would test commercial impact.

------------------------------------------------------------------------

# 22. Production experiment

Eligible population:

``` text
buyers showing comparison intent
```

Possible trigger signals:

-   using Similar Products;
-   opening several same-category listings in a session;
-   adding 2+ comparable products to My Likes;
-   explicitly using the Compare bucket.

Randomize:

``` text
CONTROL
current shopping experience

TREATMENT
comparison bucket + normalized comparison
```

Primary metric:

``` text
completed GMV per eligible comparison session
```

Secondary metrics:

``` text
comparison → cart rate
comparison → purchase rate
time to purchase
number of product-detail hops
external-exit rate if measurable
return/refund rate
GMV/session
average order value
```

Guardrails:

``` text
cancellation rate
return rate
support contacts
seller concentration
ad ecosystem impact
page latency
```

------------------------------------------------------------------------

# 23. Hackathon evaluation thesis

The benchmark should answer:

> **Can the system normalize messy marketplace listings into accurate,
> evidence-backed comparisons while refusing unsupported claims?**

The key metrics are:

1.  field extraction accuracy;
2.  evidence precision;
3.  unsupported-claim rate;
4.  contradiction detection;
5.  abstention quality;
6.  variant resolution accuracy;
7.  schema usefulness/coverage;
8.  latency;
9.  token/inference cost.

This is a much stronger evaluation than asking judges whether the
generated table "looks right."

------------------------------------------------------------------------

# 24. Evaluation dataset

Target:

``` text
60–100 comparison items
20–30 comparison sets
3–4 items per set
```

Do not waste hackathon time creating thousands.

Use a mix of:

``` text
clean listings
messy listings
missing fields
unit differences
variant-specific differences
contradictory claims
marketing-heavy descriptions
ambiguous variant labels
```

For speed, the dataset can be Shopee-style synthetic listings derived
from a hand-authored ground-truth catalog.

If real public listings are used, avoid relying on scraping that may
fail during the demo. Snapshot the permitted test inputs used for the
benchmark.

------------------------------------------------------------------------

# 25. Ground-truth format

For each exact comparison item:

``` json
{
  "listing_id": "listing_001",
  "selected_variant": "100W Black",
  "ground_truth": {
    "capacity_mah": {
      "value": 20000,
      "status": "supported"
    },
    "max_output_w": {
      "value": 100,
      "status": "supported"
    },
    "weight_g": {
      "value": null,
      "status": "missing"
    },
    "warranty_months": {
      "value": null,
      "status": "conflicting",
      "claims": [12, 24]
    }
  }
}
```

Human labels are the evaluation authority.

The benchmark must not use the model's own output as ground truth.

------------------------------------------------------------------------

# 26. Mutation-based benchmark generation

To expand coverage cheaply, begin with clean canonical products and
generate listing variants.

Mutation operators:

``` text
UNIT_CHANGE
420 g → 0.42 kg

TERM_ALIAS
USB Power Delivery → PD

FIELD_OMISSION
remove weight

TITLE_DESCRIPTION_CONTRADICTION
title: 100W
description: 65W

VARIANT_COLLISION
listing contains 65W and 100W
selected variant is 65W

BUNDLE_VARIATION
device only
device + cable

MARKETING_NOISE
"SUPER FAST ULTRA POWER!!!"

FORMAT_NOISE
20,000mAh
20000 mAh
20Ah

WARRANTY_CONFLICT
24 months in title
12 months in description
```

Because the mutation engine knows what it changed, ground truth remains
known.

This is **not** a simulator of buyer behavior. It is a controlled
benchmark of information extraction and normalization.

------------------------------------------------------------------------

# 27. Baselines

The AI system needs real baselines.

## B0 --- Raw listing view

No extraction.

Represents the current manual comparison burden.

Not scored on extraction accuracy; useful only in UX demo.

## B1 --- Regex / deterministic parser

Extract obvious patterns:

``` text
\d+\s?W
\d+(,\d+)?\s?mAh
\d+\s?g
```

This will perform well on easy structured values and poorly on
semantic/ambiguous fields.

It is an important baseline because we should not use an LLM for
problems regex already solves.

## B2 --- Ungrounded LLM

Prompt:

``` text
Extract these specifications from the listing.
```

No mandatory evidence IDs or abstention contract.

This demonstrates why generic "AI comparison" is unsafe.

## S1 --- Evidence-grounded extractor

Requires:

``` text
value
status
confidence
evidence IDs
```

plus deterministic normalization and contradiction handling.

This is the proposed system.

------------------------------------------------------------------------

# 28. Primary metrics

## 28.1 Field Accuracy

Among fields with a labelled supported value:

``` text
correct normalized values
/
labelled supported fields
```

For numeric fields, define exact or tolerance-based matching where
appropriate.

## 28.2 Unsupported Claim Rate

Critical safety metric:

``` text
supported claims without valid supporting evidence
/
all emitted supported claims
```

Lower is better.

A fluent but unsupported answer should score badly.

## 28.3 Evidence Precision

``` text
claims whose cited evidence actually supports the value
/
claims with cited evidence
```

This catches fake citations where the model points to irrelevant text.

## 28.4 Missing-Field Accuracy

``` text
true missing fields correctly marked Not stated
/
all ground-truth missing fields
```

## 28.5 Contradiction Recall

``` text
true contradictions detected
/
all labelled contradictions
```

## 28.6 False Contradiction Rate

``` text
non-conflicting fields marked conflicting
/
all non-conflicting fields
```

## 28.7 Variant Resolution Accuracy

``` text
correct exact variant identity
/
variant-labelled items
```

This is a headline metric.

A comparison of the wrong variant is a wrong comparison even if every
extracted number is internally consistent.

------------------------------------------------------------------------

# 29. Precision vs coverage

Abstention creates a real trade-off.

At confidence threshold `t`:

``` text
coverage(t)
=
fields emitted as supported
/
all fields
```

and:

``` text
precision(t)
=
correct supported fields
/
emitted supported fields
```

Sweep:

``` text
t = 0.5, 0.6, 0.7, 0.8, 0.9
```

Plot:

``` text
precision
   ↑
   │       •
   │    •
   │  •
   │•
   └────────────→ coverage
```

The product should prefer high precision because wrong specifications
destroy comparison trust.

Do not select the threshold by looking at the final test set.

------------------------------------------------------------------------

# 30. Contradiction stress test

Construct dedicated cases:

``` text
title vs description
description vs structured attributes
variant vs generic listing copy
image vs description
```

Example:

``` text
Title:
"100W Power Bank"

Selected variant:
"65W Black"

Description:
"Maximum output 100W on PB720 model"
```

Ground truth:

``` text
selected variant max output = unresolved/conflicting
```

The system must not simply extract the largest or most repeated number.

------------------------------------------------------------------------

# 31. Variant leakage test

This deserves its own evaluation.

Create listings with multiple variants:

``` text
65W
100W
140W
```

Descriptions mention all three.

Select only:

``` text
65W
```

Measure whether the extractor incorrectly imports:

``` text
100W / 140W
```

into the selected variant.

Metric:

``` text
Variant Leakage Rate
=
fields incorrectly borrowed from non-selected variants
/
variant-sensitive fields
```

This is an excellent judge-facing metric because it captures a failure
that generic product summarizers can easily make.

------------------------------------------------------------------------

# 32. Schema evaluation

Dynamic schema generation is harder to score automatically.

Keep it modest.

For each demo category, hand-label:

``` text
must-have fields
nice-to-have fields
irrelevant fields
```

Then compute:

``` text
Must-Have Schema Recall
=
must-have fields generated
/
labelled must-have fields
```

and:

``` text
Irrelevant Field Rate
=
irrelevant generated fields
/
generated fields
```

Do not over-invest in this evaluation during the hackathon.

If time is tight, use a small category schema registry and let AI map
listing language into it. The evidence-grounded normalization is more
important than dynamic schema generation.

------------------------------------------------------------------------

# 33. Latency evaluation

Measure end-to-end:

``` text
variant resolution
schema generation
field extraction
normalization
table rendering
```

Report:

``` text
p50
p95
```

for 2-, 3-, and 4-product buckets.

Also report:

``` text
LLM calls
input tokens
output tokens
estimated cost
```

The comparison experience can tolerate more latency than checkout, but
it should still feel interactive.

Target architecture should parallelize extraction per product.

------------------------------------------------------------------------

# 34. Cost architecture

Avoid one LLM call per field.

Bad:

``` text
10 fields
× 4 products
= 40 calls
```

Better:

``` text
1 schema call
+
1 extraction call per product in parallel
+
optional 1 explanation call
```

For 4 products:

``` text
~5–6 calls total
```

Potential optimization:

``` text
cache normalized listing+variant result
```

Cache key:

``` text
listing_id
variant_id
listing_version/hash
schema_version
extractor_version
```

Then repeated comparisons do not require re-extraction.

This is an important production cost story.

------------------------------------------------------------------------

# 35. Trust architecture

Every table cell has one of four states:

``` text
SUPPORTED
MISSING
CONFLICTING
UNRESOLVED
```

No fifth state called:

``` text
MODEL_GUESSED
```

The user-facing UI maps them to:

``` text
100 W
Not stated
⚠ Conflicting
? Could not verify
```

This makes uncertainty part of the interface rather than hiding it.

------------------------------------------------------------------------

# 36. Prompt contract

The extractor prompt should explicitly state:

``` text
You are extracting specifications for ONE exact selected marketplace variant.

Use only the evidence provided.

Do not use prior product knowledge.

Do not infer a value because it is typical for this model/category.

A supported field MUST cite evidence IDs.

If evidence is absent, return missing.

If credible evidence disagrees, return conflicting.

Do not borrow a specification from another variant unless the evidence
explicitly states that the specification applies to the selected variant.
```

Return strict structured output.

No prose parsing in the backend.

------------------------------------------------------------------------

# 37. Backend validation

After model output:

``` python
def validate_extraction(result, evidence_index):
    for field in result.fields:
        if field.status == "supported":
            assert field.evidence_ids

        for evidence_id in field.evidence_ids:
            assert evidence_id in evidence_index

        validate_type(field)
        validate_unit_dimension(field)
```

Optional second-stage evidence verifier if time permits:

``` text
claim + cited evidence
      ↓
entailment/verifier
      ↓
supported / unsupported
```

Do not make this mandatory for MVP.

------------------------------------------------------------------------

# 38. Product UI

## Search/results page

Each product card gains:

``` text
[ + Compare ]
```

If the listing has variants:

``` text
+ Compare
   ↓
choose exact variant
```

## Persistent comparison bucket

Bottom sheet:

``` text
COMPARE 3/4

[UGREEN] [ANKER] [BASEUS]

[ Compare now ]
```

Maximum four products for MVP.

## Comparison page

Header:

``` text
Compare 3 power banks

[ All specs ] [ Differences only ]
```

Columns are products.

Rows are normalized attributes.

Each cell is clickable for evidence.

## Evidence drawer

``` text
Maximum output
100 W

Evidence:
"USB-C1 maximum output 100W"

Source:
Product description

Selected variant:
100W Black
```

## Contradiction drawer

``` text
Warranty
⚠ Conflicting

Title:
24 Months Local Warranty

Description:
12-month seller warranty

We couldn't verify which applies.
```

------------------------------------------------------------------------

# 39. Conversational follow-up

Below the table:

``` text
Ask about these products...
```

Examples:

``` text
Which is lightest?
Which differences actually matter for travel?
Which ones have at least 65W output?
Ignore anything above 65W. Which is cheapest?
Why can't you compare the warranty?
```

The Q&A layer receives only:

``` text
normalized comparison table
+
evidence
+
user question
```

It does not receive unrestricted web search in MVP.

------------------------------------------------------------------------

# 40. 60-second demo

## 0--10 seconds --- discovery

Search:

``` text
power bank laptop
```

Show three messy seller listings.

Tap:

``` text
+ Compare
+ Compare
+ Compare
```

## 10--20 seconds --- AI normalization

Open bucket.

Compact trace:

``` text
Resolving exact variants...
Normalizing 27 specifications...
Checking source conflicts...
```

Do not expose chain-of-thought.

## 20--35 seconds --- comparison

Clean side-by-side table appears.

Toggle:

``` text
Show only differences
```

The table collapses.

## 35--45 seconds --- trust

Click:

``` text
100 W
```

Show source evidence.

Click:

``` text
⚠ Warranty conflict
```

Show contradictory listing text.

## 45--52 seconds --- useful AI

Ask:

``` text
I travel a lot and only need 65W.
What actually matters?
```

Show grounded answer.

## 52--60 seconds --- evaluation

Flash benchmark:

``` text
Variant accuracy
Field accuracy
Unsupported claim rate
Contradiction recall
p95 latency
Cost/comparison
```

Close:

> "The comparison table is the interface. The hard problem is turning
> inconsistent marketplace listings into evidence-backed facts without
> hallucinating."

------------------------------------------------------------------------

# 41. Four-hour core build plan

## Engineer A --- domain + benchmark data

**0:00--2:00**

Build:

``` text
listing schema
variant schema
ground-truth format
20–30 benchmark listings
mutation generator
```

Then expand cases.

## Engineer B --- AI normalization pipeline

**0:00--2:30**

Build:

``` text
schema selection
variant resolver
evidence-grounded extractor
structured output
```

Then deterministic normalization.

## Engineer C --- frontend

**0:00--2:30**

Build:

``` text
search/results mock
+ Compare
bucket
comparison table
evidence drawer
difference toggle
```

## Engineer D --- evaluation

**0:00--2:30**

Build:

``` text
regex baseline
ungrounded baseline
metric scorer
benchmark runner
result JSON
```

## 2:30--4:00

Integrate one category end-to-end.

At hour four:

``` text
3 products
→ comparison bucket
→ normalized table
→ evidence click-through
→ benchmark command
```

must work.

------------------------------------------------------------------------

# 42. Remaining three hours

## Hour 4--5

-   expand benchmark;
-   fix variant leakage;
-   improve contradiction handling;
-   measure latency/cost.

## Hour 5--6

-   add conversational follow-up;
-   polish comparison UI;
-   add evaluation summary;
-   run final benchmark.

## Hour 6--7

-   freeze features;
-   record final metrics;
-   rehearse;
-   prepare fallback demo;
-   verify every number on slides comes from a real run.

No new architecture after hour six.

------------------------------------------------------------------------

# 43. Feature cut order

If behind schedule, cut:

1.  image extraction;
2.  conversational Q&A;
3.  fully dynamic schema generation;
4.  source-reliability verifier;
5.  extra categories;
6.  elaborate animations.

Do **not** cut:

``` text
exact variant
comparison bucket
evidence-grounded extraction
deterministic normalization
missing/conflicting states
evidence drawer
benchmark
```

Those are the product thesis.

------------------------------------------------------------------------

# 44. Minimal implementation option

If the team is behind:

Use one category:

``` text
power banks
```

Use a fixed schema:

``` text
capacity
max output
ports
weight
dimensions
protocol
included cable
warranty
```

The AI still performs:

``` text
variant resolution
evidence extraction
semantic mapping
contradiction detection
abstention
```

This is still a valid project.

Dynamic schema generation is not required for the core thesis.

------------------------------------------------------------------------

# 45. Evaluation command

Suggested:

``` bash
uv run python -m eval.run \
  --dataset data/benchmark.json \
  --systems regex,ungrounded,grounded \
  --output results.json
```

Confidence sweep:

``` bash
uv run python -m eval.confidence_sweep \
  --dataset data/benchmark.json \
  --thresholds 0.5,0.6,0.7,0.8,0.9 \
  --output confidence.json
```

Variant stress test:

``` bash
uv run python -m eval.run \
  --dataset data/variant_stress.json \
  --systems ungrounded,grounded \
  --metrics variant_accuracy,variant_leakage \
  --output variant_results.json
```

------------------------------------------------------------------------

# 46. Benchmark scoreboard

Do not pre-fill results.

Render from `results.json`.

Example structure:

  ---------------------------------------------------------------------------------
  System            Variant        Field   Unsupported   Contradiction  p95 latency
                   accuracy     accuracy        claims          recall 
  ------------ ------------ ------------ ------------- --------------- ------------
  Regex            measured     measured      measured        measured     measured

  Ungrounded       measured     measured      measured        measured     measured
  LLM                                                                  

  Shopee           measured     measured      measured        measured     measured
  Compare                                                              
  ---------------------------------------------------------------------------------

Below:

``` text
Cost per 3-product comparison: measured
Tokens per comparison: measured
Coverage at selected confidence threshold: measured
```

No invented percentages.

------------------------------------------------------------------------

# 47. Acceptance criteria

## Product

-   user can add 2--4 products to a comparison bucket;
-   exact variant is captured for every product;
-   comparison table renders shared normalized fields;
-   differences-only mode works;
-   every supported value has inspectable evidence;
-   missing values display `Not stated`;
-   contradictions are visible;
-   user can return from comparison to the selected listing/cart flow.

## AI correctness

-   structured extraction only;
-   no supported field without evidence;
-   no external/model-memory product facts in MVP;
-   variant leakage benchmark exists;
-   contradiction benchmark exists;
-   confidence/abstention policy exists.

## Evaluation

-   human-labelled ground truth exists;
-   deterministic baseline exists;
-   generic ungrounded LLM baseline exists;
-   final metrics are computed by code;
-   no benchmark number is manually invented;
-   latency and token usage are measured.

## Business honesty

-   no claim of measured GMV/conversion lift;
-   commercial impact is explicitly an A/B-test hypothesis;
-   comparison does not override ads/search/recommendations;
-   comparison table contains no new sponsored placement in MVP.

------------------------------------------------------------------------

# 48. INVARIANTS.md

``` text
1. The comparison unit is the exact selected variant, not the generic listing.
2. No supported specification may exist without source evidence.
3. Missing evidence must produce "Not stated" or "Could not verify", never a guess.
4. Materially conflicting evidence must remain visible as a conflict.
5. Deterministic code performs unit conversion and type validation.
6. Product facts in buyer-facing explanations must come from the normalized evidence store.
7. The system never silently replaces a product or seller.
8. The system does not claim a universal "best" product without explicit buyer criteria.
9. Search, ads, and recommendation ranking remain outside the comparison system.
10. Offline extraction metrics are never presented as measured conversion or GMV lift.
11. All benchmark values shown to judges come from actual benchmark runs.
```

------------------------------------------------------------------------

# 49. Repository shape

``` text
shopee-compare/
├── app/
│   ├── api/
│   ├── domain/
│   │   ├── listing.py
│   │   ├── variant.py
│   │   ├── evidence.py
│   │   └── comparison.py
│   ├── ai/
│   │   ├── schema.py
│   │   ├── variant_resolver.py
│   │   ├── extractor.py
│   │   └── explain.py
│   ├── normalization/
│   │   ├── units.py
│   │   ├── enums.py
│   │   └── contradictions.py
│   └── services/
│       └── compare.py
├── data/
│   ├── benchmark.json
│   └── variant_stress.json
├── eval/
│   ├── baselines.py
│   ├── metrics.py
│   ├── run.py
│   └── confidence_sweep.py
├── web/
├── tests/
├── README.md
└── INVARIANTS.md
```

------------------------------------------------------------------------

# 50. Judge questions

## "Isn't this just Amazon's product comparison?"

Answer:

> Side-by-side comparison is not novel, and we do not claim it is. Our
> engineering problem is marketplace normalization. Seller-authored
> listings can use different names, units, variants, bundles, and
> contradictory copy. We build a temporary evidence-backed catalog for
> exactly the variants the buyer selected, and we benchmark
> hallucination, variant leakage, contradiction detection, and
> abstention.

## "Why do you need an LLM?"

Answer:

> Regex and deterministic parsers handle easy numeric patterns well, and
> we benchmark against them. The model is used where the mapping is
> semantic: resolving seller-specific variant names, mapping differently
> phrased attributes into a shared schema, identifying which evidence
> applies to the selected variant, and interpreting contradictory
> unstructured text. Unit conversion and validation remain
> deterministic.

## "Why not scrape the manufacturer's website?"

Answer:

> That could be a later verification source, but it introduces
> product-identity matching and external-web reliability into a
> seven-hour build. The MVP asks a narrower question: can we faithfully
> compare what the Shopee sellers themselves are claiming without
> inventing missing facts?

## "What if the seller is wrong?"

Answer:

> The system establishes provenance, not ultimate physical truth. It
> says what each listing claims and flags internal conflicts. A
> production version could add manufacturer or Shopee Mall authoritative
> sources with explicit source precedence.

## "How does this make Shopee money?"

Answer:

> The hypothesis is that high-intent buyers currently spend effort
> hopping among product pages or leaving the platform to research
> differences. The feature keeps comparison inside Shopee and reduces
> decision friction. We do not claim offline extraction accuracy proves
> revenue. Production impact requires an A/B test measuring completed
> GMV per eligible comparison session, along with return and
> cancellation guardrails.

## "Does this hurt advertisers?"

Answer:

> No candidate is inserted or reranked by the comparison system. Search,
> Similar Products, recommendations, and ads still determine discovery.
> The buyer explicitly chooses which listings enter the bucket.

------------------------------------------------------------------------

# 51. Product risks

## Risk: AI hallucinates specifications

Mitigation:

``` text
mandatory evidence IDs
abstention
structured output
evidence precision benchmark
```

## Risk: wrong variant

Mitigation:

``` text
selected variant is explicit input
variant-specific extraction
variant leakage test
unresolved state
```

## Risk: seller copy contradicts itself

Mitigation:

``` text
conflicting state
show both claims
do not silently resolve
```

## Risk: comparison becomes too dense

Mitigation:

``` text
8–12 fields
primary fields first
differences-only toggle
collapse identical rows
```

## Risk: generic feature already exists elsewhere

Mitigation:

Do not sell "AI comparison" as novelty. Sell the **evidence-grounded
marketplace normalization architecture and evaluation**.

## Risk: no measured revenue proof

Mitigation:

Be explicit that the hackathon validates information quality. Define the
production A/B test separately.

------------------------------------------------------------------------

# 52. Success criteria for the hackathon

The project is successful if judges can see, in under one minute, that:

1.  three messy marketplace listings become one clean comparison;
2.  the exact variants are respected;
3.  every fact can be traced to seller evidence;
4.  the system says "Not stated" instead of hallucinating;
5.  contradictions remain visible;
6.  the evaluation quantitatively tests those failure modes;
7.  the implementation is small enough to actually work live.

The desired reaction is not:

> "Cool, ChatGPT made a table."

It is:

> **"They treated marketplace comparison as a data-quality and grounding
> problem, and they can prove when the AI is trustworthy."**

------------------------------------------------------------------------

# 53. Final pitch

> **Shopee already helps buyers discover similar products. The hard part
> comes next: seller listings describe comparable products with
> inconsistent names, variants, units, missing specifications and
> sometimes contradictory claims. Shopee Compare lets buyers add the
> exact listings they are considering to a comparison bucket. AI
> resolves the selected variants and maps messy listing evidence into a
> shared comparison schema; deterministic code normalizes units; every
> specification links back to its source; and unsupported or conflicting
> claims are shown as uncertainty rather than guessed. We benchmark it
> against regex extraction and an ungrounded LLM using human-labelled
> marketplace listings, measuring variant accuracy, unsupported-claim
> rate, evidence precision, contradiction recall, latency and cost. The
> comparison table is the interface. The product is a trustworthy
> temporary catalog built from messy marketplace data.**

------------------------------------------------------------------------

# 54. Source notes used to shape the spec

-   Shopee Singapore currently documents a **Similar** option from the
    shopping cart that displays similar products and explicitly says
    buyers can compare prices, offers, and variations.
-   Shopee Singapore documents **My Likes** as a place to save products
    and find similar alternatives.
-   Shopee Singapore documents that exact product variations can be
    selected/changed in the cart and that different variations can have
    different prices/promotional states. This supports treating the
    selected variant as part of the comparison identity.
-   Amazon's 2026 Alexa for Shopping supports selecting multiple
    products from search results and comparing them side-by-side, so
    generic AI comparison must not be presented as the innovation.
-   The Sea × OpenAI hackathon rules state that teams build from scratch
    and are judged on problem framing, build quality, depth of thinking,
    and effective Codex use.

Public references:

Shopee Similar Products:
https://help.shopee.sg/portal/4/article/83727-%5BSimilar-Products%5D-What-does-the-Similar-option-in-my-shopping-cart-do

Shopee My Likes:
https://help.shopee.sg/portal/4/article/76564-%5BNew-to-Shopee%5D-What-happens-when-I-like-a-product

Shopee product variation in cart:
https://help.shopee.sg/portal/4/article/81959-%5BNew-to-Shopee%5D-How-do-I-change-the-product-variation-for-an-item-in-my-cart

Shopee variation pricing:
https://help.shopee.sg/portal/4/article/76842-%5BBuyer-Basics%5D-Why-are-the-prices-of-the-same-item-%28with-different-variations%29-different-in-my-cart

Amazon Alexa for Shopping:
https://www.aboutamazon.com/news/retail/alexa-for-shopping-ai-assistant

Sea × OpenAI Regional Codex Hackathon: https://codexhackathon.sea.com/
