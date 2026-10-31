# Midpoint measured-claims sheet

Use the wording below in the writeup, slides and narration. A metric's denominator and limitation
must remain attached to the number.

## Claims supported by current evidence

| Topic | Permitted wording | Evidence and limit |
|---|---|---|
| Grounded specifications | “The recorded grounded run produced 88/88 supported fields with 96/96 evidence precision.” | Historical synthetic run; source and prediction data revalidated, but no current implementation fingerprint was recorded. |
| Missing/conflicting evidence | “The recorded grounded run recovered 4/4 labelled missing fields and 4/4 exact normalized conflicts.” | Synthetic labels authored with the fixtures; not independent human adjudication. |
| Variant safety | “The recorded grounded run had 0/12 labelled sibling-variant leakage cases.” | Fixed synthetic adversarial cases, not a production catalog estimate. |
| Reviews | “Recorded review mention precision was 49/49 and recall was 49/51.” | Two labelled `other/neutral` mentions were missed; sampled synthetic reviews only. |
| Agent | “The one bounded paid agent run passed 10/12 scripted scenarios.” | Partial result; 28/44 allowed requests were attempted with no retry. |
| Agent safety | “Correction and stale-turn protection each passed their one scripted scenario.” | One scenario each; not a broad reliability rate. |
| Browser portability | “The same packaged widget passes the deterministic buyer, correction and seller-report journey in two independent hosts.” | Browser test uses labelled SDK/WebRTC test doubles; it is not provider or production-host proof. |
| Seller report | “The report reuses current authorized-session evidence and decision reasons with no additional model call.” | No seller login, ownership, persistence, weekly history or cross-session aggregation. |
| Voice | “One real run captured speech, captions and revision `0 → 1`, but no audible Luna output.” | G4 failed; voice is excluded from the demo. |
| Current free gates | “At commit `18eb720`, 194 API tests passed, both production hosts built, and Playwright reported five passes plus one intentional duplicate-host skip.” | Local deterministic verification on 31 October 2026; not public deployment proof. |

## Claims that are not supported

Do not claim any of the following:

- production Shopee integration, access to Shopee APIs or compatibility with Shopee's actual
  frontend;
- production accuracy, production p95 latency or an SLO;
- conversion, GMV, return-rate, dispute-rate or support-cost improvement;
- a user study, human preference study or independently adjudicated benchmark;
- complete review coverage, defect prevalence or fake-review detection;
- verified cost savings or model cost—the price table is not configured;
- a matched manual-versus-agent friction reduction—the interaction counts are unavailable;
- a working audible voice demo;
- a public deployment or public smoke proof;
- persistent seller analytics, seller authentication or buyer personalization;
- that all agent scenarios pass.

## Required labels

- Call all catalog, listing and review data **synthetic**.
- Say **among reviews analysed**, never “buyers generally” or “failure rate.”
- Say **in this demo session** for seller counts, never “this week.”
- Say **historical recorded evidence run** when citing evidence-model metrics.
- Say **partial 10/12 agent result**, not “83% production accuracy.”
- Call Host B a portability proof, not proof of integration with Shopee production.

## Source artifacts

- [`eval/SCORECARD.md`](../../eval/SCORECARD.md)
- [`eval/results.json`](../../eval/results.json)
- [`eval/live-results.json`](../../eval/live-results.json)
- [`eval/agent-results.json`](../../eval/agent-results.json)
- [`docs/user-stories.md`](../user-stories.md)
- [`docs/architecture.md`](../architecture.md)
