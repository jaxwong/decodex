"""Execute reproducible baseline evaluation; --live separately invokes real Responses.

Run from repository root:
PYTHONPATH=services/luna-api python -m eval.run
PYTHONPATH=services/luna-api python -m eval.run --live --output eval/live-results.json
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
from statistics import median
from time import perf_counter

from app.evidence import EvidenceBuilder, OpenAIModelClient
from app.providers import MockCatalogProvider
from eval.baselines import predict
from eval.metrics import score

ROOT = Path(__file__).resolve().parents[1]


def unavailable(reason: str) -> dict:
    return {'available': False, 'reason': reason}


def merge_predictions(predictions: list[dict]) -> dict:
    merged = dict(items=[], facts_by_item={}, evidence={}, review_mentions={})
    for prediction in predictions:
        merged['items'].extend(prediction['items'])
        for field in ('facts_by_item', 'evidence', 'review_mentions'):
            merged[field].update(prediction[field])
    return merged


async def evaluate(*, live: bool = False) -> dict:
    if live and not os.environ.get('OPENAI_API_KEY'):
        raise RuntimeError('OPENAI_API_KEY is required for explicit --live evaluation')
    provider = MockCatalogProvider()
    listings = await provider.list_listings()
    selections = [dict(listing_id=listing['listing_id'], variant_id=variant['variant_id'])
                  for listing in listings for variant in listing['variants']]
    # Inference finishes before the scorer loads the held-out labels.
    start = perf_counter()
    baseline = await predict(provider, selections)
    elapsed_ms = (perf_counter() - start) * 1000
    live_predictions, comparison_latencies, model = [], [], None
    if live:
        model = OpenAIModelClient()
        builder = EvidenceBuilder(provider, model)
        for offset in range(0, len(selections), 4):
            start = perf_counter()
            comparison = await builder.build(selections[offset:offset + 4])
            comparison_latencies.append((perf_counter() - start) * 1000)
            live_predictions.append(comparison.model_dump())
    labels = json.loads((ROOT / 'data/ground_truth.json').read_text())
    result = {
        'conditions': {
            'synthetic': True, 'sku_count': len(selections), 'field_count': 8,
            'source_review_count': len(labels['reviews']),
            'label_provenance': 'Fabricated fixture labels authored in a separate file; no human adjudication claimed.',
            'labels_supplied_to_extractor': False,
            'source_sha256': {name: hashlib.sha256((ROOT / 'data' / name).read_bytes()).hexdigest()
                              for name in ('listings.json', 'reviews.json', 'ground_truth.json')},
            'limitations': ['Synthetic fixtures do not demonstrate production shopping performance.',
                           'Exact-variant accuracy measures ID preservation for explicit selections, not product recognition.',
                           'Review support uses exact aspect/sentiment and literal label-span containment.',
                           'One baseline corpus run; runtime is observed wall time, not model latency.',
                           'Fixture generation and parsing rules were developed together; no independent human-labelled test set.'],
        },
        'regex_keyword_baseline': {
            'metrics': score(baseline, labels, selections),
            'observed_corpus_latency_ms': elapsed_ms,
            'tokens': unavailable('No model called for deterministic baseline'),
            'cost': unavailable('No billable model request'),
        },
        'grounded_structured_outputs': unavailable('Not executed; requires explicit --live and API credentials'),
        'ungrounded_free_form': unavailable('No live free-form baseline executed'),
        'agent_output_evaluation': unavailable('Developer B supplies decision/agent outputs and tests'),
    }
    if live:
        merged = merge_predictions(live_predictions)
        statuses = [item['analysis_status'] for item in merged['items']]
        usages = [o['usage'] for o in model.observations if o['usage'] is not None]
        result['grounded_structured_outputs'] = {
            'available': True, 'model': model.model, 'metrics': score(merged, labels, selections),
            'analysis_statuses': statuses, 'successful_responses': len(model.observations),
            'comparison_latency_ms': {'samples': comparison_latencies, 'p50': median(comparison_latencies),
                                      'p95_nearest_rank': max(comparison_latencies)},
            'tokens': {key: sum(usage.get(key, 0) for usage in usages) for key in ('input_tokens', 'output_tokens', 'total_tokens')}
                      if usages else unavailable('Provider returned no usage'),
            'cost': unavailable('No verified pricing configured; usage is reported without guessed cost'),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Spend API credits using real Structured Outputs')
    parser.add_argument('--output', type=Path, default=ROOT / 'eval/results.json')
    args = parser.parse_args()
    try:
        result = asyncio.run(evaluate(live=args.live))
    except RuntimeError as failure:
        parser.exit(2, str(failure) + '\n')
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'output': str(args.output), 'baseline': result['regex_keyword_baseline']['metrics'],
                      'live': result['grounded_structured_outputs'].get('available', False)}, indent=2))


if __name__ == '__main__':
    main()
