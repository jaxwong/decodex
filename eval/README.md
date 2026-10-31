# Synthetic evidence evaluation

## A4 final scorecard

Run `make eval` from the repository root. It executes the deterministic baselines,
validates B's current agent handoff, re-scores saved evidence predictions against
the matching source/label snapshot, and writes both `eval/results.json` and
[`SCORECARD.md`](SCORECARD.md). It makes **zero model requests** and does not modify
either paid artifact.

The JSON separates new extraction in this invocation (`grounded_structured_outputs`
and `ungrounded_free_form`) from `recorded_evidence_evaluation`. The recorded
section verifies source/label hashes, canonical evidence relationships, catalog
coverage, original seller/review strings reconstructed through the provider,
request accounting and agreement between stored and recomputed metrics. Free-form
scored facts must also match the parsed output retained for that item.
An invalid or source-stale artifact is reported unavailable, with its reason.

The original 36-request evidence run did not record an implementation fingerprint.
Its source-valid predictions remain useful historical measurements, but
`current_implementation_verified` is false. A subsequent refactor is not silently
declared live-tested. Future explicitly authorized extraction runs record hashes
of evidence/provider/contract/runtime code plus SDK and Pydantic versions; code or
version changes retain the run as historical rather than current-runtime proof.
No fingerprint is retrofitted into the old paid artifact.

B's separate 28-request artifact passes its existing evidence/scenario/text-agent
hash checks and retains `status: partial`, including both failed scenarios. Server
state outcomes are not browser UI verification. That binding does not fingerprint
every API/decision dependency. The final scorecard explicitly
marks matched browser friction, a prose-only agent baseline and cost unavailable
until their actual measurements or verified pricing exist. A4's measured report
is ready to consume; passing every agent scenario and completing G2/G3 remain
separate product acceptance work.

## Individual evaluation commands

Run from repository root with the dependency environment described in
`services/luna-api/app/evidence/README.md`:

```bash
make api-sync
PYTHONPATH=services/luna-api:. services/luna-api/.venv/bin/python -m eval.run
```

This actually executes the regex specification and keyword review baselines and
writes `eval/results.json`. No fake model is evaluated as a real model. Real
Responses evaluation is separate and paid:

```bash
PYTHONPATH=services/luna-api:. services/luna-api/.venv/bin/python -m eval.run --live --output eval/live-results.json
```

The paid decision-agent benchmark is a separate fixed workload:

```bash
cd services/luna-api
PYTHONPATH=../.. uv run --frozen python -m eval.agent --live
```

It writes only `eval/agent-results.json`. A later `make eval` validates the evidence, scenario
suite and text-agent implementation hashes before projecting that artifact into
`eval/results.json`; `make eval` does not make a provider call. A stale artifact remains on disk
as history but is reported as unavailable until an authorized paid rerun replaces it.

The live CLI loads the ignored root `.env` without overwriting process variables.
It requires explicit non-blank `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` values.
Credentials and authorization headers are never written to the report.

One live invocation runs the strengthened demo smoke first, then grounded and
free-form extraction. The current fixture preflight is **6 + 18 + 12 = 36** requests:

- Smoke: three specification calls and three exact-SKU review batches. Checks
  selected 100W identity, 420g conversion with original quote, missing weight,
  12/24-month conflict, exact-SKU review coverage/aspects and canonical provenance.
- Grounded benchmark: twelve specification calls and six review batches, grouped
  into three comparisons of four variants.
- Free-form specification baseline: one plain-text Responses call per variant.

An HTTP request hook counts attempts before transport and blocks request 37.
SDK retries are disabled. A failed smoke stops both benchmarks; failed individual
benchmark extractions retain partial measurements, failure statuses and usage
coverage. The CLI exits 2 for a failed/partial live run and retains its report.
Preflight rejects a changed fixture requiring more than 36 requests before any
network call. Do not add the standalone smoke to this combined run under the same
36-request allowance; the combined command already includes it.

The scorer loads `data/ground_truth.json` only after inference finishes. Neither
baseline nor model receives labels. Sources cover twelve variants, eight fields
(96 labelled cells) and 56 fabricated reviews, six of which have unknown variants.
The 50 known-variant reviews yield 53 labelled unique aspect/sentiment support
units; three known-variant reviews contain speculation and no supported mentions.
Two reviews on `listingB:65w` (`listingB-r19`, `listingB-r20`) report charging a phone
twice and are labelled in `ground_truth.json` `disputes` as contradicting that SKU's
consistent 20 Ah capacity claim.
Labels and sources are generated reproducibly by `data/generate_fixtures.py`.
They were authored together as synthetic cases, with no independent human
adjudication or production data. This tests implementation behavior, not general
shopping performance. Do not tune to these labels and call it independent testing.

Every metric stores numerator, denominator and ratio; denominator zero yields
JSON null. Definitions:

| Metric | Numerator / denominator |
|---|---|
| Exact-variant accuracy | Explicit selection IDs preserved / 12 selections; this does not measure product recognition |
| Supported-field accuracy | Correct status and normalized value / 88 supported labels |
| Evidence precision | Cited value alternatives supported by separately labelled source locations and exact variant / cited value alternatives; each conflict alternative is a claim |
| Unsupported claim rate | Emitted supported facts without a valid supporting source / emitted supported facts |
| Missing-field recall | Correct missing abstentions / 4 truly missing cells |
| Contradiction recall | Conflicts preserving both alternatives in the exact normalized format / 4 contradictory cells |
| Variant leakage rate | Wrong selected output matching a known sibling's output / 12 max-output cells |
| Review mention precision | Correct unique item/review/aspect/sentiment units with literal excerpts containing a labelled supporting span / emitted unique units |
| Review mention recall | Same correct review units / 53 labelled units for selected exact SKUs |
| Dispute precision | Emitted disputed (item, field) claims whose every disputing mention comes from a labelled disputing review / emitted disputed claims |
| Dispute recall | Same matched disputed claims / 1 labelled disputed claim |

A dispute attaches only when at least `DISPUTE_MIN_REVIEWS = 2` distinct analysed
exact-SKU reviews contradict a **supported** seller claim (`app/evidence/schema.py`).
One review never raises the marker. The claim keeps its status and value, so ranking
is unchanged; the marker is explanation, not a measured fact, and describes a count
among reviews analysed, not a defect rate. The keyword baseline emits no disputes,
so its precision is unavailable (0/0) rather than zero. The recorded paid evidence run
predates the disputing reviews, so grounded dispute metrics stay unavailable until an
authorized rerun.

Regex baseline processes description before selected attributes, takes the first
labelled value, ignores variant scope, performs no unit conversion and does not
reconcile conflicts. Keyword baseline quotes the full original review and cannot
identify speculative experience. These intentionally simple behaviors are stated
so their errors cannot be mistaken for a model comparison.

The free-form baseline receives identical indexed seller sources and fixed field
names, but its prompt permits product-knowledge inference and model-side unit
conversion. It uses `responses.create` without Structured Outputs or tools.
Only its JSON shape and field coverage are validated afterward; missing sources,
unknown citations and unsupported values are scored rather than repaired by the
production validator. Malformed, refused or incomplete output abstains without a
second request. Raw output is retained for inspection. This baseline has no review
extraction; its review metrics are explicitly unavailable, not zero recall.

Observed baseline corpus wall time is recorded for the one executed run. It is
not model latency. Repeat runs have identical scores/source hashes but naturally
vary in wall time. Live evaluation, when requested, records three actual
four-item comparison latencies, p50 and nearest-rank p95 (max for this tiny sample),
model-reported tokens and per-item extraction statuses. Missing token data stays
unavailable. No verified price table is configured, so cost remains unavailable.
Free-form timings are per item with sequential execution; grounded timings are
per four-item comparison with concurrent extraction. They are not matched latency
comparisons. Three grounded samples are too few to establish a production p95.
Reports distinguish configured from returned model names, separate smoke token
usage, preserve the grounded evidence graph and record source hashes. Token totals
are labelled with their observed coverage; missing fields remain null.
The agent benchmark runs twelve fixed buyer utterances over
`data/sample_comparison_evidence.json` through the production `run_luna` loop and its same four
tools. It covers hard constraints, preference correction, unclear intent, review evidence,
contradictory and missing facts, stale revision protection, an invalid item, no survivors,
no comparable winner and recommendation explanation. One scenario intentionally fails before
the model call on a stale revision. The other eleven can make at most four Responses requests
each, so an HTTP hook blocks request 45. SDK retries, repair passes and alternate models are
disabled. The artifact stores application outputs, checks, latency and usage, but no provider
response IDs, reasoning or credentials.

## Executed agent run — 31 October 2026

[`agent-results.json`](agent-results.json) records one actual `gpt-6-luna` run. It used 28 of
44 permitted provider requests and completed with `partial` status: 10 of 12 scenarios passed.
The CLI exited 2 as designed for a partial run. It was not retried.

This is the one authorized run of the current B7 agent. `make eval` validates its evidence,
scenario-suite and implementation hashes and projects it into `eval/results.json` as
`agent_output_evaluation.available: true`. The partial status is retained; the run was not
retried or repaired.

| Metric | Observed result |
|---|---:|
| Scenario success | 10/12 |
| Expected tool behavior | 10/11 |
| Expected UI/state outcome | 11/12 |
| Citation behavior | 4/5 |
| State correction | 1/1 |
| Stale-turn protection | 1/1 |

The review-query scenario reached the correct review tool and preserved state, but final-output
validation rejected unsupported citations with `LunaAgentContractError`. The
no-comparable-winner scenario read comparison and review data, then made a rejected tool call;
it returned `LunaToolCallRejected` without changing state or inventing a winner. These failures
remain in the artifact rather than being repaired or removed.

The eleven model-backed scenario latencies had p50 5.930s and nearest-rank p95 7.653s. All 28
responses reported usage: 76,509 input tokens and 1,965 output tokens. Cost remains unavailable
because no verified price table is configured. These are one synthetic run's observations, not
a production accuracy claim or latency SLO. The frozen fixture has no objective value tie, so
the no-comparable-winner scenario measures abstention when review reliability cannot produce an
objective ranking.

## Executed live run — 31 October 2026

[`live-results.json`](live-results.json) records one actual `gpt-6-luna` run with
OpenAI SDK 3.42.0: smoke passed, all twelve variants completed, and the transport
count was exactly 36 requests. Configured and returned model names agreed.

| Metric | Regex/keyword | Grounded | Free-form specs |
|---|---:|---:|---:|
| Supported-field accuracy | 55/88 | 88/88 | 88/88 |
| Evidence precision | 56/92 | 96/96 | 92/96 |
| Unsupported claim rate (supported facts) | 36/92 | 0/88 | 0/88 |
| Missing-field recall | 4/4 | 4/4 | 4/4 |
| Exact normalized contradiction recall | 0/4 | 4/4 | 2/4 |
| Variant leakage | 9/12 | 0/12 | 0/12 |
| Review mention precision | 51/54 | 49/49 | Unavailable |
| Review mention recall | 51/51 | 49/51 | Unavailable |

The free-form baseline recognized all four warranty conflicts. Two alternatives
were emitted as `"12 months"`/`"24 months"` instead of canonical `"12"`/`"24"` with
the separate unit field. The exact normalized scorer therefore counted only two
as correct and four alternatives as unsupported in evidence precision. This is
a serialization/normalization failure, not evidence of two missed semantic
conflicts. No post-hoc normalization or retry was applied to improve its score.

Grounded review extraction omitted two labelled `other/neutral` mentions:
`listingB-r13` and `listingC-r13` (case colour). No emitted mention was rejected by
literal-quote validation. These observations did not trigger prompt tuning.

The grounded comparison latencies were 10.051s, 8.481s and 9.817s: p50 9.817s;
nearest-rank p95 10.051s for only three samples. Observed tokens were 11,435 for
smoke, 32,827 for grounded evaluation and 22,778 for free-form evaluation (67,040
total). Usage coverage was complete; cost remains unavailable. These measurements
are a single synthetic run, not production accuracy, throughput or shopping value.
Grounded token totals include review extraction, while free-form totals cover
specifications only; the workloads differ.

`tests/evidence/test_live_evaluation.py` exercises both SDK paths over an injected
in-memory HTTP transport, including smoke failure, partial failures, malformed
free-form output, label isolation, identical source inputs and the request ceiling.
It does not make live requests or write fake benchmark artifacts. The CLI has no
fake-model or fake-transport setting.

`make eval` belongs to B; it can call `python -m eval.run` from the repository root
with `services/luna-api` on PYTHONPATH. `make test`/browser/host/deploy checks were
not created or claimed by Developer A.
