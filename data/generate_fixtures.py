"""Reproduce fabricated demo sources and separately stored manual fixture labels.

No marketplace access. Labels are never included in extraction request payloads.
"""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIELDS = {
    'capacity_mah': ('Capacity', 'mAh'), 'max_output_w': ('Max output', 'W'),
    'usb_c_ports': ('USB-C ports', None), 'weight_g': ('Weight', 'g'),
    'max_input_w': ('Max input', 'W'), 'pd_supported': ('USB PD', None),
    'included_cable': ('Included cable', None), 'warranty_months': ('Warranty', 'months'),
}

# Listed checkout assumptions are intentionally different enough to reverse the
# selected demo variants' price order. They are fixed fixture data, not estimates.
LANDED_PRICE_COMPONENTS = {
    'listingA': {'shipping_minor': 1500, 'shop_voucher_minor': 0},
    'listingB': {'shipping_minor': 1700, 'shop_voucher_minor': 500},
    'listingC': {'shipping_minor': 300, 'shop_voucher_minor': 1000},
}

# Storefront titles and product images. Images are drawn renders of fictional products, inlined
# as data URIs so every host, including the single-file build, shows them without a file server.
PRODUCTS = {
    'Atlas': ('Atlas Portable Power Bank', 'atlas.svg'),
    'Breeze': ('Breeze Slim Power Bank', 'breeze.svg'),
    'Comet': ('Comet Travel Power Bank', 'comet.svg'),
}

# Reviewers on Breeze's 65W demo SKU report experienced capacity that contradicts the
# seller's consistent 20 Ah claim. Two distinct reviews meet DISPUTE_MIN_REVIEWS; one is in
# Vietnamese, so the dispute rests on evidence in two languages.
DISPUTING_REVIEWS = {
    'listingB': ('65w', 'capacity_mah', [
        ('Charges my phone twice, nowhere near 20000mAh.',
         [('charging', 'negative', 'Charges my phone twice, nowhere near 20000mAh')]),
        ('Chỉ sạc đầy điện thoại được hai lần, không được 20000mAh như quảng cáo.',
         [('charging', 'negative', 'Chỉ sạc đầy điện thoại được hai lần, không được 20000mAh như quảng cáo')]),
    ]),
}

# Shopee buyers in the region write in Vietnamese or mix languages in one sentence. These
# reviews on each remaining listing's demo SKU are labelled with spans copied from the
# original text; nothing is translated. Strings are NFC, the form the excerpt check compares.
REGIONAL_REVIEWS = {
    'listingA': [
        ('Sạc nhanh nhưng nóng kinh khủng.',
         [('charging', 'positive', 'Sạc nhanh'), ('heat', 'negative', 'nóng kinh khủng')]),
        ('Gets hot when fast charging la, but charges my laptop ok.',
         [('heat', 'negative', 'Gets hot when fast charging'), ('charging', 'positive', 'charges my laptop ok')]),
    ],
    'listingC': [
        ('Pin nhỏ gọn, nhẹ, bỏ balo mang đi cả ngày không thấy nặng.',
         [('portability', 'positive', 'nhỏ gọn, nhẹ')]),
        ('Dùng được một tuần thì hỏng, không sạc được nữa.',
         [('reliability', 'negative', 'Dùng được một tuần thì hỏng')]),
    ],
}


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2) + '\n')


def image_data_uri(file_name):
    encoded = base64.b64encode((ROOT / 'images' / file_name).read_bytes()).decode()
    return f'data:image/svg+xml;base64,{encoded}'


# Star ratings follow each review's labelled sentiment so the storefront average reads like a
# real listing. Nothing in comparison evidence or ranking reads the rating.
def review_rating(mentions):
    sentiments = {sentiment for _, sentiment, _ in mentions} - {'neutral'}
    if sentiments == {'positive'}:
        return 5
    if sentiments == {'negative'}:
        return 2
    return 3 if sentiments else 4


def source_id(item_key, location, text):
    digest = hashlib.sha256((location + '\0' + text).encode()).hexdigest()[:20]
    return f'{item_key}:source:{digest}'


def generate():
    listings, reviews = [], []
    labels = {'synthetic': True, 'items': {}, 'reviews': [], 'source_claims': {}, 'disputes': {}}
    for index, (name, powers, demo) in enumerate([
        ('Atlas', [100, 130, 65, 30], 100), ('Breeze', [65, 100, 130, 45], 65),
        ('Comet', [87, 100, 130, 65], 87),
    ]):
        lid = 'listing' + chr(65 + index)
        variants = []
        for power in powers:
            vid = str(power) + 'w'
            values = [20000, power, 2, 420 if index == 0 else 310, 65, True, True, 12]
            attributes = [
                ('capacity_mah', 'Capacity: 20 Ah'), ('max_output_w', f'Max output: {power} W'),
                ('usb_c_ports', 'USB-C ports: 2'), ('weight_g', 'Weight: 0.42 kg' if index == 0 else 'Weight: 310 g'),
                ('max_input_w', 'Max input: 65 W'), ('pd_supported', 'USB PD: yes'),
                ('included_cable', 'Included cable: yes'), ('warranty_months', 'Warranty: 1 year'),
            ]
            if index == 2:
                attributes = [(k, t) for k, t in attributes if k != 'weight_g']
            variant = {
                'variant_id': vid,
                'label': f'{power}W',
                'price_minor': 5900 + index * 1000 + power,
                **LANDED_PRICE_COMPONENTS[lid],
                'currency': 'SGD',
                'attributes': [{'field_key': k, 'text': t} for k, t in attributes],
            }
            variants.append(variant)
            normalized_values = dict(zip(FIELDS, values))
            labels['source_claims'][f'{lid}:{vid}'] = {
                f'variants/{vid}/attributes/{n}': {'field_key': field, 'value': normalized_values[field]}
                for n, (field, _) in enumerate(attributes)
            }
            if power == 130:
                labels['source_claims'][f'{lid}:{vid}']['description/0'] = {'field_key': 'max_output_w', 'value': 130}
            if index == 2:
                labels['source_claims'][f'{lid}:{vid}'][f'description/{2 + powers.index(power)}'] = {
                    'field_key': 'warranty_months', 'value': 24}
            labels['items'][f'{lid}:{vid}'] = {
                k: {'status': 'missing' if k == 'weight_g' and index == 2 else 'conflicting' if k == 'warranty_months' and index == 2 else 'supported',
                    'value': None if index == 2 and k in ('weight_g', 'warranty_months') else val,
                    'conflicting_values': ['12', '24'] if index == 2 and k == 'warranty_months' else []}
                for k, val in zip(FIELDS, values)
            }
        descriptions = [{'text': 'Need more power? The 130W model offers Max output: 130 W.', 'variant_id': '130w'},
                        {'text': 'Pick the model that matches your devices. Weight depends on the model you choose.', 'variant_id': None}]
        if index == 2:
            descriptions.extend({'text': 'Warranty: 24 months', 'variant_id': v['variant_id']} for v in variants)
        title, image_file = PRODUCTS[name]
        listings.append({'listing_id': lid, 'title': title, 'synthetic': True,
                         'image_url': image_data_uri(image_file),
                         'attributes': [], 'description': descriptions, 'variants': variants})
        phrases = [
            ('It gets hot during charging.', [('heat', 'negative', 'gets hot')]),
            ('It stays cool on my desk.', [('heat', 'positive', 'stays cool')]),
            ('It feels light in my bag.', [('portability', 'positive', 'feels light')]),
            ('It feels heavy in my bag.', [('portability', 'negative', 'feels heavy')]),
            ('It charges fast at home.', [('charging', 'positive', 'charges fast')]),
            ('It charges slowly with my laptop.', [('charging', 'negative', 'charges slowly')]),
            ('It stopped working after a week.', [('reliability', 'negative', 'stopped working')]),
            ('It works reliably every day.', [('reliability', 'positive', 'works reliably')]),
            ('It was good value for my needs.', [('value', 'positive', 'good value')]),
            ('It was poor value for my needs.', [('value', 'negative', 'poor value')]),
            ('It charges fast but gets hot.', [('charging', 'positive', 'charges fast'), ('heat', 'negative', 'gets hot')]),
            ('It stays cool at low load but gets hot at high load.', [('heat', 'positive', 'stays cool'), ('heat', 'negative', 'gets hot')]),
            ('The case is blue.', [('other', 'neutral', 'case is blue')]),
            ('Maybe it will be reliable; I have not used it.', []),
            ('It gets hot with my computer.', [('heat', 'negative', 'gets hot')]),
            ('It feels heavy on trips.', [('portability', 'negative', 'feels heavy')]),
            ('It charges fast in my office.', [('charging', 'positive', 'charges fast')]),
            ('It gets hot at my desk.', [('heat', 'negative', 'gets hot')]),
        ]
        disputing_vid, disputed_field, disputing = DISPUTING_REVIEWS.get(lid, (None, None, []))
        regional = REGIONAL_REVIEWS.get(lid, [])
        demo_vid = str(demo) + 'w'
        for n, (text, mentions) in enumerate(phrases + disputing + regional):
            is_disputing = 18 <= n < 18 + len(disputing)
            vid = (demo_vid if n < 14 else '130w' if n < 16 else None if n < 18
                   else disputing_vid if is_disputing else demo_vid)
            rid = f'{lid}-r{n + 1:02}'
            if is_disputing:
                labels['disputes'].setdefault(f'{lid}:{vid}', {}).setdefault(disputed_field, []).append(rid)
            reviews.append({'review_id': rid, 'listing_id': lid, 'variant_id': vid, 'rating': review_rating(mentions),
                            'text': text, 'created_at': None, 'source': 'fixture'})
            labels['reviews'].append({'review_id': rid, 'listing_id': lid, 'variant_id': vid,
                                     'mentions': [{'aspect': a, 'sentiment': s, 'excerpt': q} for a, s, q in mentions]})
    write('listings.json', {'synthetic': True, 'listings': listings})
    write('reviews.json', {'synthetic': True, 'reviews': reviews})
    write('ground_truth.json', labels)
    # A1 is a hand-authored contract handoff, independent of the model pipeline.
    result = {'items': [], 'schema_fields': [{'field_key': k, 'label': l, 'unit': u} for k, (l, u) in FIELDS.items()],
              'facts_by_item': {}, 'evidence': {}, 'review_summaries': [], 'review_mentions': {}}
    for listing in listings:
        variant = listing['variants'][0]
        lid, vid = listing['listing_id'], variant['variant_id']
        key = f'{lid}:{vid}'
        result['items'].append({
            'listing_id': lid,
            'variant_id': vid,
            'item_key': key,
            'title': listing['title'],
            'variant_label': variant['label'],
            'price_minor': variant['price_minor'],
            'shop_voucher_minor': variant['shop_voucher_minor'],
            'shipping_minor': variant['shipping_minor'],
            'landed_price_minor': (
                variant['price_minor'] - variant['shop_voucher_minor'] + variant['shipping_minor']
            ),
            'currency': 'SGD',
            'snapshot_version': 'synthetic-handoff-v1',
            'synthetic': True,
        })
        for field, source_label in [
            ('price_minor', 'List price'),
            ('shop_voucher_minor', 'Shop voucher'),
            ('shipping_minor', 'Shipping'),
        ]:
            location = f'variants/{vid}/{field}'
            source_text = f"{source_label}: {variant['currency']} {variant[field] / 100:.2f}"
            sid = source_id(key, location, source_text)
            result['evidence'][sid] = dict(
                id=sid,
                item_key=key,
                source_type='variant',
                source_text=source_text,
                source_location=location,
                variant_id=vid,
                review_id=None,
            )
        facts = []
        for field, label in labels['items'][key].items():
            source_ids = []
            for n, attribute in enumerate(variant['attributes']):
                if attribute['field_key'] == field:
                    sid = f'{key}:attribute:{n}'
                    result['evidence'][sid] = dict(id=sid, item_key=key, source_type='attribute', source_text=attribute['text'],
                                                   source_location=f'variants/{vid}/attributes/{n}', variant_id=vid, review_id=None)
                    source_ids.append(sid)
            if label['status'] == 'conflicting':
                sid = f'{key}:description:warranty'
                result['evidence'][sid] = dict(id=sid, item_key=key, source_type='description', source_text='Warranty: 24 months',
                                               source_location='description/2', variant_id=vid, review_id=None)
                source_ids.append(sid)
            facts.append(dict(field_key=field, status=label['status'], value=label['value'], unit=FIELDS[field][1],
                              evidence_ids=source_ids, conflicting_values=label['conflicting_values'],
                              disputing_mention_ids=[]))
        result['facts_by_item'][key] = facts
        exact_reviews = [r for r in reviews if r['listing_id'] == lid and r['variant_id'] == vid]
        disputed_reviews = labels['disputes'].get(key, {})
        for review in exact_reviews:
            sid = f"{key}:review:{review['review_id']}"
            result['evidence'][sid] = dict(id=sid, item_key=key, source_type='review', source_text=review['text'],
                                          source_location='reviews/' + review['review_id'], variant_id=vid, review_id=review['review_id'])
            labelled = next(r for r in labels['reviews'] if r['review_id'] == review['review_id'])
            for n, mention in enumerate(labelled['mentions']):
                mid = f"{key}:mention:{review['review_id']}:{n}"
                result['review_mentions'][mid] = dict(id=mid, item_key=key, review_id=review['review_id'], **mention)
                for fact in facts:
                    if review['review_id'] in disputed_reviews.get(fact['field_key'], []):
                        fact['disputing_mention_ids'].append(mid)
        for aspect in ['heat', 'portability', 'charging', 'reliability', 'value', 'other']:
            mentions = [m for m in result['review_mentions'].values() if m['item_key'] == key and m['aspect'] == aspect]
            result['review_summaries'].append(dict(item_key=key, aspect=aspect, analyzed_reviews=len(exact_reviews),
                mention_ids=[m['id'] for m in mentions], **{s + '_count': len({m['review_id'] for m in mentions if m['sentiment'] == s}) for s in ['positive', 'negative', 'neutral']}))
    write('sample_comparison_evidence.json', result)


if __name__ == '__main__':
    generate()
