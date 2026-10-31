# Synthetic evidence evaluation

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

The live CLI loads the ignored root `.env` without overwriting process variables.
It requires `OPENAI_API_KEY` and uses `OPENAI_TEXT_MODEL` (default `gpt-6-luna`).
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
(96 labelled cells) and 54 fabricated reviews, six of which have unknown variants.
The 48 known-variant reviews yield 51 labelled unique aspect/sentiment support
units; three known-variant reviews contain speculation and no supported mentions.
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
| Review mention recall | Same correct review units / 51 labelled units for selected exact SKUs |

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
B's agent-output benchmark remains unavailable until B supplies its outputs.

## Executed live run — 31 October 2026

[`live-results.json`](live-results.json) records one actual `gpt-6-luna` run with
OpenAI SDK 3.42.0: smoke passed, all twelve variants completed, and the transport
count was exactly 36 requests. Configured and returned model names agreed.

| Metric | Regex/keyword | Grounded | Free-form specs |
|---|---:|---:|---:|
| Supported-field accuracy | 55/88 | 88/88 | 88/88 |
| Evidence precision | 56/92 | 96/96 | 92/96 |
| Unsupported supported-claim rate | 36/92 | 0/88 | 0/88 |
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

`tests/evidence/test_live_evaluation.py` exercises both SDK paths over an injected
in-memory HTTP transport, including smoke failure, partial failures, malformed
free-form output, label isolation, identical source inputs and the request ceiling.
It does not make live requests or write fake benchmark artifacts. The CLI has no
fake-model or fake-transport setting.

`make eval` belongs to B; it can call `python -m eval.run` from the repository root
with `services/luna-api` on PYTHONPATH. `make test`/browser/host/deploy checks were
not created or claimed by Developer A.
