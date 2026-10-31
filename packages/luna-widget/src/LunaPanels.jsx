import PropTypes from 'prop-types';

const pretty = (value) => String(value || '').replaceAll('_', ' ').replace(/\\b\\w/g, c => c.toUpperCase());
const money = (minor, currency) => typeof minor === 'number'
  ? `${currency || 'SGD'} ${(minor / 100).toFixed(2)}` : null;

export function PreferenceChips({ preferences, onSuggestion }) {
  const chips = [];
  if (typeof preferences?.max_price_minor === 'number') chips.push(`Budget ≤ ${money(preferences.max_price_minor, 'SGD')}`);
  if (typeof preferences?.min_output_w === 'number') chips.push(`Output ≥ ${preferences.min_output_w}W`);
  for (const priority of preferences?.priorities || []) chips.push(`Priority: ${pretty(priority)}`);
  return <section aria-label="Shopping preferences" className="bg-orange-50 border border-orange-100 rounded-xl p-3">
    <div className="flex flex-wrap justify-between gap-2 mb-2">
      <h3 className="font-semibold text-sm">Your preferences</h3>
      <span className="text-xs text-gray-500">Edit through chat</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {chips.length ? chips.map((chip, index) => <span key={index} className="bg-white border border-orange-200 rounded-full px-3 py-1 text-xs">{chip}</span>)
        : <span className="text-xs text-gray-500">No constraints yet. Tell Luna what matters to you.</span>}
      <button type="button" onClick={() => onSuggestion('Change my shopping preferences: ')}
        className="text-xs underline text-orange-700">Change preferences</button>
    </div>
  </section>;
}
PreferenceChips.propTypes = { preferences: PropTypes.object, onSuggestion: PropTypes.func.isRequired };

export function RecommendationCards({ recommendation, evidence, selectedItems, onNavigateToListing }) {
  const known = new Map(selectedItems.map(item => [`${item.listing_id}:${item.variant_id}`, item]));
  for (const item of evidence?.items || []) {
    known.set(item.item_key, { ...known.get(item.item_key), ...item });
  }
  const ranked = recommendation?.ranked_item_keys || [];
  const winner = recommendation?.item_key;
  const excluded = new Set(recommendation?.excluded_item_keys || []);
  const uncertain = new Set(recommendation?.uncertain_item_keys || []);
  const order = [...new Set([...(winner ? [winner] : []), ...ranked, ...selectedItems.map(i => `${i.listing_id}:${i.variant_id}`)])];
  return <section aria-label="Product recommendations">
    <h3 className="font-semibold mb-2">Comparison results</h3>
    {!winner && <p className="text-xs bg-amber-50 text-amber-800 rounded p-2 mb-3">No verified top match yet. Review available evidence and ask Luna to refine your preferences.</p>}
    <div className="grid md:grid-cols-2 gap-3">
      {order.map((key, index) => {
        const item = known.get(key) || {};
        const isWinner = key === winner;
        return <article key={key} className={`border rounded-xl p-4 ${isWinner ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex justify-between gap-2 items-start">
            <span className="text-xs text-gray-500">{ranked.includes(key) ? `Rank #${ranked.indexOf(key) + 1}` : `Product ${index + 1}`}</span>
            {isWinner && <span className="text-xs font-semibold text-orange-700">★ Top match</span>}
          </div>
          <p className="font-semibold text-sm mt-2">{item.title || key}</p>
          {item.variant_label && <p className="text-xs text-gray-500">{item.variant_label}</p>}
          {money(item.price_minor, item.currency) && <p className="text-sm font-medium mt-2">{money(item.price_minor, item.currency)}</p>}
          {excluded.has(key) && <p className="text-xs text-red-700 mt-2">Excluded by constraints</p>}
          {uncertain.has(key) && <p className="text-xs text-amber-700 mt-2">Evidence incomplete</p>}
          {item.listing_id && <button type="button" onClick={() => onNavigateToListing(item.listing_id)}
            className="text-xs text-orange-700 underline mt-3">View in host</button>}
        </article>;
      })}
    </div>
    {!!recommendation?.limitations?.length && <div className="mt-3 text-xs text-amber-800 bg-amber-50 rounded p-3">
      <strong>Limitations</strong>
      {recommendation.limitations.map((text, index) => <p key={index} className="mt-1">{text}</p>)}
    </div>}
  </section>;
}
RecommendationCards.propTypes = {
  recommendation: PropTypes.object, evidence: PropTypes.object,
  selectedItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  onNavigateToListing: PropTypes.func.isRequired,
};

function sourceText(source) {
  if (!source) return 'Source details unavailable';
  if (typeof source === 'string') return source;
  return source.source_text || source.excerpt || source.quote || source.text || source.url || 'Source details unavailable';
}

export function EvidenceViewer({ evidence, citedIds }) {
  const index = evidence?.evidence || {};
  const citationSource = citationId => index[citationId]
    || evidence?.review_mentions?.[citationId];
  return <section aria-label="Evidence and sources" className="border border-t-0 rounded-b-lg p-3 space-y-4">
    {(evidence?.items || []).map(item => <div key={item.item_key}>
      <h4 className="font-semibold text-sm mb-1">{item.title || item.item_key}</h4>
      <div className="space-y-1">
        {(evidence?.facts_by_item?.[item.item_key] || []).map((fact, i) =>
          <div key={`${fact.field_key}-${i}`} className="flex flex-wrap justify-between gap-2 text-xs border-b py-2">
            <span className="font-medium">{pretty(fact.field_key)}</span>
            <span>{fact.status === 'supported' ? `${fact.value ?? 'Unknown'} ${fact.unit || ''}` : pretty(fact.status || 'Unknown')}</span>
            {!!fact.evidence_ids?.length && <span className="w-full text-gray-500">
              Sources: {fact.evidence_ids.map(id => `${id} (${sourceText(index[id])})`).join(' · ')}
            </span>}
          </div>)}
      </div>
    </div>)}
    {citedIds.length > 0 && <div className="bg-gray-50 rounded p-3">
      <h4 className="font-semibold text-xs mb-2">Cited in Luna&apos;s latest answer</h4>
      {citedIds.map(id => <p key={id} className="text-xs my-1"><strong>{id}:</strong> {sourceText(citationSource(id))}</p>)}
    </div>}
    {!evidence?.items?.length && <p className="text-xs text-gray-500">No structured evidence available yet.</p>}
  </section>;
}
EvidenceViewer.propTypes = { evidence: PropTypes.object, citedIds: PropTypes.arrayOf(PropTypes.string).isRequired };

export function Conversation({ messages, busy }) {
  return <section aria-label="Conversation with Luna">
    <h3 className="font-semibold text-sm mb-2">Ask Luna</h3>
    <div role="log" aria-live="polite" className="max-h-64 overflow-y-auto space-y-3 bg-gray-50 rounded-xl p-3">
      {messages.map((message, index) =>
        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <p className={`text-sm max-w-[90%] rounded-xl p-3 whitespace-pre-wrap ${message.role === 'user' ? 'bg-orange-600 text-white' : 'bg-white border text-gray-700'}`}>
            <strong>{message.role === 'user' ? 'You' : 'Luna'}:</strong> {message.text}
          </p>
        </div>)}
      {busy && <p className="text-xs text-gray-500" role="status">Luna is working on your request…</p>}
    </div>
  </section>;
}
Conversation.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({ role: PropTypes.string, text: PropTypes.string })).isRequired,
  busy: PropTypes.bool,
};
