import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient';

const keyOf = (item) => `${item.listing_id}:${item.variant_id}`;
const initialMessage = {
  role: 'assistant',
  text: 'Choose 2–4 exact variants to start an evidence-backed comparison.',
};
const errorText = (error) => error?.status === 401
  ? 'Your demo session expired. Click Restart session.'
  : error?.status === 409
    ? 'The comparison changed. Please refresh the comparison before asking again.'
    : error?.message || 'Something went wrong.';

export default function LunaWidget({ products = [], onClose }) {
  const [session, setSession] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastAnswer, setLastAnswer] = useState(null);
  const conversationId = useRef(`luna_${crypto.randomUUID().replaceAll('-', '')}`);
  const generation = useRef(0);
  const selectedItems = useMemo(() => catalog.flatMap(listing =>
    listing.variants.filter(variant => selection.includes(`${listing.listing_id}:${variant.variant_id}`))
      .map(variant => ({ listing_id: listing.listing_id, variant_id: variant.variant_id,
        title: listing.title, variant_label: variant.label, price_minor: variant.price_minor,
        currency: variant.currency }))), [catalog, selection]);

  useEffect(() => {
    const controller = new AbortController();
    const epoch = ++generation.current;
    async function initialize() {
      setBusy(true);
      setError('');
      try {
        const issued = await lunaClient.createSession(controller.signal);
        const result = await lunaClient.getCatalog(issued.token, controller.signal);
        if (epoch !== generation.current) return;
        const listings = result.listings || [];
        setSession(issued);
        setCatalog(listings);
        // Only preselect when the Shopee identifiers exactly match API identifiers.
        const hostKeys = new Set(products.map(p =>
          `${p.listing_id ?? p.lid ?? ''}:${p.variant_id ?? p.vid ?? ''}`));
        setSelection(listings.flatMap(listing => listing.variants
          .filter(variant => hostKeys.has(`${listing.listing_id}:${variant.variant_id}`))
          .map(variant => `${listing.listing_id}:${variant.variant_id}`)).slice(0, 4));
      } catch (err) {
        if (!controller.signal.aborted) setError(errorText(err));
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    }
    initialize();
    return () => { controller.abort(); generation.current += 1; };
    // Initialize once per mount; changes to host selection do not silently reset a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(itemKey) {
    if (comparison || busy) return;
    setSelection(old => old.includes(itemKey) ? old.filter(k => k !== itemKey)
      : old.length < 4 ? [...old, itemKey] : old);
  }

  async function createComparison() {
    if (!session || selectedItems.length < 2 || selectedItems.length > 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await lunaClient.createComparison(session.token,
        selectedItems.map(({ listing_id, variant_id }) => ({ listing_id, variant_id })));
      setComparison(result);
      setLastAnswer(null);
      setMessages([{ role: 'assistant', text: 'Comparison created. Ask me about budget, charging power, portability, or reviews.' }]);
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function refreshComparison() {
    if (!comparison || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      setComparison(await lunaClient.getComparison(session.token, comparison.comparison_id));
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function send(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !comparison || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      const answer = await lunaClient.ask(session.token, comparison.comparison_id, {
        conversation_id: conversationId.current,
        message,
        expected_revision: comparison.revision,
      });
      // The ask response does not contain the full canonical comparison.
      const updated = await lunaClient.getComparison(session.token, comparison.comparison_id);
      setComparison(updated);
      setLastAnswer(answer);
      setMessages(old => [...old, { role: 'user', text: message },
        { role: 'assistant', text: answer.answer, citations: answer.cited_ids }]);
      setInput('');
    } catch (err) {
      setError(errorText(err));
      // A server-side preference mutation may have committed before a failed answer.
      // Refresh explicitly; never automatically replay a potentially mutating ask.
    } finally { setBusy(false); }
  }

  const evidence = comparison?.evidence;
  const evidenceIndex = evidence?.evidence || {};
  const itemLookup = new Map((evidence?.items || []).map(item => [item.item_key, item]));
  const recommendation = comparison?.recommendation;
  const winner = recommendation?.item_key;
  const winnerLabel = winner
    ? (itemLookup.get(winner)?.title || selectedItems.find(item => keyOf(item) === winner)?.title || winner)
    : null;

  return <section aria-label="Luna shopping assistant" className="bg-white rounded-lg shadow-sm border border-orange-100 p-4 my-4 text-gray-800">
    <header className="flex justify-between items-start gap-3 mb-3">
      <div><h2 className="text-lg font-semibold text-orange-600">✦ Luna</h2>
        <p className="text-xs text-gray-500">Backend-connected · synthetic demo catalog</p></div>
      {onClose && <button type="button" onClick={onClose} className="text-sm text-gray-500">Close ×</button>}
    </header>
    {error && <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3">
      {error} {comparison && <button type="button" onClick={refreshComparison} disabled={busy} className="underline ml-2">Refresh comparison</button>}
      {error.includes('expired') && <button type="button" onClick={() => window.location.reload()} className="underline ml-2">Restart session</button>}
    </div>}
    {!comparison && <div className="mb-4">
      <p className="text-sm mb-2">Select 2–4 variants from Builder A&apos;s catalog. Shopee selections are preselected only when IDs match exactly.</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {catalog.map(listing => <div key={listing.listing_id} className="border rounded p-2">
          <p className="text-sm font-medium">{listing.title}</p>
          {listing.variants.map(variant => {
            const key = `${listing.listing_id}:${variant.variant_id}`;
            return <label key={key} className="flex items-center gap-2 text-xs py-1">
              <input type="checkbox" checked={selection.includes(key)} disabled={busy || (!selection.includes(key) && selection.length >= 4)} onChange={() => toggle(key)}/>
              {variant.label} · {variant.currency} {(variant.price_minor / 100).toFixed(2)}
            </label>;
          })}
        </div>)}
      </div>
      <button type="button" onClick={createComparison} disabled={busy || selection.length < 2 || selection.length > 4}
        className="bg-orange-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50 mt-3">
        {busy ? 'Loading…' : `Compare ${selection.length} variants`}
      </button>
    </div>}
    {comparison && <div className="mb-3 space-y-2 text-sm">
      <p className="text-xs text-gray-500">Comparison {comparison.comparison_id} · Revision {comparison.revision}</p>
      <p><strong>Top match:</strong> {winnerLabel || 'No verified winner yet'}</p>
      <p><strong>Ranked:</strong> {(recommendation?.ranked_item_keys || []).join(' → ') || 'Not ranked'}</p>
      {!!recommendation?.excluded_item_keys?.length && <p>Excluded: {recommendation.excluded_item_keys.join(', ')}</p>}
      {!!recommendation?.uncertain_item_keys?.length && <p>Uncertain: {recommendation.uncertain_item_keys.join(', ')}</p>}
      {(recommendation?.limitations || []).map((limitation, index) =>
        <p key={index} className="text-amber-700 text-xs">Limitation: {limitation}</p>)}
      <p className="text-xs">Preferences: {JSON.stringify(comparison.preferences)}</p>
      <details className="border rounded p-2"><summary className="cursor-pointer">Evidence-backed specifications</summary>
        {(evidence?.items || []).map(item => <div key={item.item_key} className="mt-3">
          <p className="font-medium">{item.title || item.item_key}</p>
          {(evidence.facts_by_item?.[item.item_key] || []).map(fact =>
            <p key={fact.field_key} className="text-xs py-1">
              {fact.field_key}: {fact.status === 'supported' ? `${fact.value}${fact.unit ? ` ${fact.unit}` : ''}` : fact.status}
              {fact.evidence_ids?.length ? ` · Sources: ${fact.evidence_ids.join(', ')}` : ''}
            </p>)}
        </div>)}
      </details>
      {lastAnswer?.cited_ids?.length > 0 && <details className="border rounded p-2">
        <summary className="cursor-pointer">Sources cited by Luna ({lastAnswer.cited_ids.length})</summary>
        {lastAnswer.cited_ids.map(id => <p key={id} className="text-xs my-2">
          <strong>{id}</strong>: {evidenceIndex[id]?.source_text || 'Source not found in comparison evidence'}
        </p>)}
      </details>}
    </div>}
    <div role="log" aria-live="polite" className="max-h-52 overflow-y-auto space-y-2 bg-gray-50 rounded p-3 mb-3">
      {messages.map((message, index) => <p key={index} className={`text-sm ${message.role === 'user' ? 'text-right text-orange-700' : 'text-gray-700'}`}>
        <strong>{message.role === 'user' ? 'You' : 'Luna'}:</strong> {message.text}
      </p>)}
    </div>
    <form onSubmit={send} className="flex gap-2">
      <input aria-label="Message Luna" maxLength={2000} className="border rounded px-3 py-2 flex-1 min-w-0 text-sm"
        value={input} onChange={event => setInput(event.target.value)}
        placeholder={comparison ? 'e.g. Under S$80, prioritize portability' : 'Create a comparison first'}
        disabled={!comparison || busy}/>
      <button type="submit" disabled={!comparison || busy || !input.trim()}
        className="bg-orange-600 disabled:opacity-50 text-white px-4 rounded text-sm">{busy ? 'Wait…' : 'Send'}</button>
    </form>
    <p className="text-xs text-gray-400 mt-2">Server rankings are authoritative. Chat needs Builder B&apos;s configured OpenAI credentials. No API keys are sent from this browser.</p>
  </section>;
}

LunaWidget.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func,
};
