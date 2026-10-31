import asyncio
from copy import deepcopy
import json
from pathlib import Path

import pytest

from eval.baselines import predict
from eval.metrics import ratio, score
from eval.run import evaluate
from app.providers import MockCatalogProvider
from test_pipeline import SELECTIONS, comparison

ROOT = Path(__file__).resolve().parents[4]


def labels():
    return json.loads((ROOT / 'data/ground_truth.json').read_text())


def test_deterministic_evaluation_behavior():
    first, second = asyncio.run(evaluate()), asyncio.run(evaluate())
    assert first['conditions'] == second['conditions']
    assert first['regex_keyword_baseline']['metrics'] == second['regex_keyword_baseline']['metrics']
    metrics = first['regex_keyword_baseline']['metrics']
    assert metrics['supported_field_accuracy'] == ratio(55, 88)
    assert metrics['missing_field_recall'] == ratio(4, 4)
    assert metrics['contradiction_recall'] == ratio(0, 4)
    assert metrics['variant_leakage_rate'] == ratio(9, 12)
    assert not first['grounded_structured_outputs']['available']
    assert first['conditions']['source_review_count'] == 54


def test_scorer_checks_hand_authored_expected_values():
    # This is scorer verification with test-only fake output, never a model benchmark.
    predictions = comparison().model_dump()
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics['supported_field_accuracy'] == ratio(22, 22)
    assert metrics['evidence_precision'] == ratio(24, 24)
    assert metrics['unsupported_claim_rate'] == ratio(0, 22)
    assert metrics['contradiction_recall'] == ratio(1, 1)
    assert metrics['review_mention_precision'] == ratio(45, 45)
    assert metrics['review_mention_recall'] == ratio(45, 45)


def test_scorer_rejects_wrong_source_even_if_value_correct():
    predictions = comparison().model_dump()
    changed = predictions['facts_by_item']['listingA:100w'][0]
    changed['evidence_ids'] = ['unknown']
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics['supported_field_accuracy']['value'] == 1
    assert metrics['unsupported_claim_rate'] == ratio(1, 22)
    assert metrics['evidence_precision'] == ratio(23, 24)


def test_scorer_review_support_and_variant_exclusion():
    predictions = comparison().model_dump()
    next(iter(predictions['review_mentions'].values()))['excerpt'] = 'Invented quotation'
    metrics = score(predictions, labels(), SELECTIONS)
    assert metrics['review_mention_precision'] == ratio(44, 45)
    assert metrics['review_mention_recall'] == ratio(44, 45)


def test_baseline_input_does_not_contain_labels():
    # Provider methods expose raw source only, not ground truth or expected mentions.
    catalog = asyncio.run(MockCatalogProvider().list_listings())
    assert all('attributes' not in v and 'description' not in listing
               for listing in catalog for v in listing['variants'])
    assert 'ground_truth' not in json.dumps(catalog)


def test_unavailable_metric_has_no_guessed_zero():
    assert ratio(0, 0)['value'] is None


def test_explicit_live_evaluation_requires_credentials(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    with pytest.raises(RuntimeError, match='OPENAI_API_KEY'):
        asyncio.run(evaluate(live=True))
