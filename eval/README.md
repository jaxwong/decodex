# Synthetic evidence evaluation

Run from repository root with the dependency environment described in
`services/luna-api/app/evidence/README.md`:

```bash
PYTHONPATH=services/luna-api:. /tmp/luna-evidence-venv/bin/python -m eval.run
```

This actually executes the regex specification and keyword review baselines and
writes `eval/results.json`. No fake model is evaluated as a real model. Real
Responses evaluation is separate and paid:

```bash
PYTHONPATH=services/luna-api:. /tmp/luna-evidence-venv/bin/python -m eval.run --live --output eval/live-results.json
```

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
| Contradiction recall | Conflicts preserving both labelled alternatives / 4 contradictory cells |
| Variant leakage rate | Wrong selected output matching a known sibling's output / 12 max-output cells |
| Review mention precision | Correct unique item/review/aspect/sentiment units with literal excerpts containing a labelled supporting span / emitted unique units |
| Review mention recall | Same correct review units / 51 labelled units for selected exact SKUs |

Regex baseline processes description before selected attributes, takes the first
labelled value, ignores variant scope, performs no unit conversion and does not
reconcile conflicts. Keyword baseline quotes the full original review and cannot
identify speculative experience. These intentionally simple behaviors are stated
so their errors cannot be mistaken for a model comparison.

Observed baseline corpus wall time is recorded for the one executed run. It is
not model latency. Repeat runs have identical scores/source hashes but naturally
vary in wall time. Live evaluation, when requested, records three actual
four-item comparison latencies, p50 and nearest-rank p95 (max for this tiny sample),
model-reported tokens and per-item extraction statuses. Missing token data stays
unavailable. No verified price table is configured, so cost remains unavailable.
Ungrounded free-form and B's agent-output benchmarks also remain unavailable.

`make eval` belongs to B; it can call `python -m eval.run` from the repository root
with `services/luna-api` on PYTHONPATH. `make test`/browser/host/deploy checks were
not created or claimed by Developer A.
