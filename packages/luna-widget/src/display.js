// Shopper-facing text for comparison data. Field names and units come from the
// comparison's schema_fields, so the API stays the single owner of what a field is called.

export const PRICE_FIELD = 'price_minor';

// Keys the API uses outside schema_fields (price lives on the item; review reliability
// is a ranking priority, not a listing field).
const NON_SCHEMA_LABELS = {
  [PRICE_FIELD]: 'Price',
  review_reliability: 'Review reliability',
};

const EXCLUSION_LABELS = {
  over_budget: 'Over budget',
  below_min_output: 'Below minimum output',
};

const SOURCE_LABELS = {
  title: 'Listing title',
  description: 'Product description',
  attribute: 'Spec table',
  variant: 'Variant details',
  review: 'Customer review',
  image: 'Product image',
  external: 'External source',
};

export const money = (minor, currency) => `${currency} ${(minor / 100).toFixed(2)}`;

export const itemName = item => `${item.title} · ${item.variant_label}`;

export function fieldLabel(schemaFields, fieldKey) {
  if (NON_SCHEMA_LABELS[fieldKey]) return NON_SCHEMA_LABELS[fieldKey];
  const field = schemaFields.find(candidate => candidate.field_key === fieldKey);
  if (!field) throw new TypeError(`Comparison field ${fieldKey} is not in schema_fields`);
  return field.label;
}

export function exclusionLabel(reason) {
  if (!EXCLUSION_LABELS[reason]) throw new TypeError(`Unknown exclusion reason ${reason}`);
  return EXCLUSION_LABELS[reason];
}

export function sourceLabel(sourceType) {
  if (!SOURCE_LABELS[sourceType]) throw new TypeError(`Unknown evidence source type ${sourceType}`);
  return SOURCE_LABELS[sourceType];
}

const withUnit = (value, unit) => (unit ? `${value} ${unit}` : value);

export function factValueText(fact) {
  if (typeof fact.value === 'boolean') return fact.value ? 'Yes' : 'No';
  const value = typeof fact.value === 'number' ? fact.value.toLocaleString('en-US') : String(fact.value);
  return withUnit(value, fact.unit);
}

export const conflictText = fact => withUnit(fact.conflicting_values.join(' vs '), fact.unit);

// Limitations are server-written sentences that name items and fields by key.
export function readableLimitation(text, items, schemaFields) {
  let readable = text;
  for (const item of items) readable = readable.split(item.item_key).join(itemName(item));
  for (const field of schemaFields) readable = readable.split(field.field_key).join(field.label);
  return readable.split(PRICE_FIELD).join(NON_SCHEMA_LABELS[PRICE_FIELD]);
}

// Resolve a cited ID to the record the API stored for it. The API only returns cited IDs
// that exist in evidence or review mentions, so a miss is a broken contract.
export function citationSource(evidence, citationId) {
  const record = evidence.evidence[citationId];
  if (record) return { kind: 'evidence', record };
  const mention = evidence.review_mentions[citationId];
  if (mention) return { kind: 'review', record: mention };
  throw new TypeError(`Citation ${citationId} is not in comparison evidence or review mentions`);
}
