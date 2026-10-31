# Developer A — Evidence Intelligence

All products, seller claims and reviews in this branch are fabricated. No Shopee
access, human user study, production evaluation or deployed integration is claimed.

## Handoff and A1 contract freeze — 31 October 2026

- Inspected repository, v3.2 specification and code-style guidance. Fetched origin;
  `main` / `origin/main` both pointed at shared handoff `58223d5`. No separate
  integration branch existed. Created `feat/luna-evidence-intelligence` from it.
- Codex implemented the exact seven public contract exports in
  `services/luna-api/app/contracts/evidence.py`, the provider protocol, a complete
  `data/sample_comparison_evidence.json`, and contract-validation tests.
- Contract fields, types, status vocabulary and defaults match section 2.3.
  Validation rejects broken provenance links, wrong variants, unsupported numeric
  assertions and invalid review excerpts. Models prevent field reassignment;
  consumers must also treat nested collections as immutable snapshots.
- Frozen public handoff: `from app.contracts.evidence import ComparisonEvidence`;
  load the fixture with `ComparisonEvidence.model_validate_json(path.read_text())`.
  Selected items use snake_case `listing_id`, `variant_id`, `item_key`,
  `price_minor`, `currency`, `snapshot_version`, `title`, `variant_label`, `synthetic`.
  Schema fields use `field_key`, `label`, `unit`. SGD prices are integer minor units.
- Exact verification from repository root:
  `PYTHONPATH=services/luna-api /tmp/luna-evidence-venv/bin/python -m pytest services/luna-api/tests/evidence/test_contract.py -q`
  → **3 passed**. Isolated temporary environment: Python 3.12.10,
  pydantic 2.14.2, pytest 9.2.0, openai 3.42.0. Shared dependency files are B-owned
  and were not created or changed.
- Human corrections: none supplied during this implementation. Human review of
  this PR and integration with B/C remain pending; no teammate messages were sent.
