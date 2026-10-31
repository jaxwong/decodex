"""Explicit paid API smoke; excluded from normal pytest collection."""
import argparse
import asyncio
import os

from app.evidence import EvidenceBuilder, OpenAIModelClient
from app.providers import MockCatalogProvider


async def smoke() -> None:
    model = OpenAIModelClient()
    result = await EvidenceBuilder(MockCatalogProvider(), model).build([
        {'listing_id': 'listingA', 'variant_id': '100w'},
        {'listing_id': 'listingB', 'variant_id': '65w'},
        {'listing_id': 'listingC', 'variant_id': '87w'},
    ])
    assert all(item['analysis_status'] == 'completed' for item in result.items), 'Live spec extraction unavailable'
    assert all(item['review_status'] == 'completed' for item in result.items), 'Live review extraction unavailable'
    assert any(f.status == 'supported' for facts in result.facts_by_item.values() for f in facts)
    assert result.review_mentions, 'No grounded review mentions returned'
    print(f'Validated {len(result.items)} exact variants, {len(result.review_mentions)} cited review mentions; '
          f'{len(model.observations)} actual Responses calls.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', required=True, help='Authorize actual OpenAI API requests')
    parser.parse_args()
    if not os.environ.get('OPENAI_API_KEY'):
        parser.exit(2, 'OPENAI_API_KEY missing: live smoke not executed.\n')
    asyncio.run(smoke())
