import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient';
import { RecommendationCards, PreferenceChips, EvidenceViewer, Conversation } from './LunaPanels';

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
  const [showEvidence, setShowEvidence] = useState(false);
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
  const recommendation = comparison?.recommendation;
  const askSuggestion = (text) => { if (!busy && comparison) setInput(text); };

  return <section aria-label="Luna shopping assistant" className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 md:p-6 my-4 text-gray-800">
    <header className="flex justify-between items-start gap-3 mb-5">
      <div>
        <h2 className="text-xl font-bold text-orange-600">✦ Luna <span className="text-xs font-normal text-gray-500 ml-2">Shopping decision assistant</span></h2>
        <p className="text-xs text-gray-500 mt-1">Evidence-backed · backend-connected demo catalog</p>
      </div>
      {onClose && <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-orange-700">Close ×</button>}
    </header>

    {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-sm mb-4">
      {error}
      {comparison && <button type="button" onClick={refreshComparison} disabled={busy} className="underline ml-2">Refresh comparison</button>}
      {error.includes('expired') && <button type="button" onClick={() => window.location.reload()} className="underline ml-2">Restart session</button>}
    </div>}

    {!comparison && <div className="mb-5">
      <h3 className="font-semibold text-sm mb-1">Choose products to compare</h3>
      <p className="text-xs text-gray-500 mb-3">Select 2–4 variants from the Luna demo catalog. Shopee products are preselected only when IDs match.</p>
      <div className="grid md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {catalog.map(listing => <div key={listing.listing_id} className="border rounded-lg p-3">
          <p className="text-sm font-medium mb-2">{listing.title}</p>
          {listing.variants.map(variant => {
            const key = `${listing.listing_id}:${variant.variant_id}`;
            return <label key={key} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
              <input type="checkbox" checked={selection.includes(key)} disabled={busy || (!selection.includes(key) && selection.length >= 4)} onChange={() => toggle(key)}/>
              <span>{variant.label} · {variant.currency} {typeof variant.price_minor === 'number' ? (variant.price_minor / 100).toFixed(2) : 'Price unknown'}</span>
            </label>;
          })}
        </div>)}
      </div>
      <button type="button" onClick={createComparison} disabled={busy || selection.length < 2 || selection.length > 4}
        className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 mt-3">
        {busy ? 'Loading…' : `Compare ${selection.length} variants`}
      </button>
    </div>}

    {comparison && <div className="space-y-5 mb-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="text-xs text-gray-500">Comparison · Revision {comparison.revision}</p>
        <button type="button" onClick={refreshComparison} disabled={busy}
          className="text-xs text-orange-700 underline disabled:opacity-50">Refresh results</button>
      </div>
      <PreferenceChips preferences={comparison.preferences} onSuggestion={askSuggestion} />
      <RecommendationCards recommendation={recommendation} evidence={evidence} selectedItems={selectedItems}/>
      <div>
        <button type="button" onClick={() => setShowEvidence(old => !old)}
          aria-expanded={showEvidence}
          className="w-full text-left border rounded-lg p-3 text-sm font-semibold hover:bg-gray-50">
          {showEvidence ? '▾' : '▸'} Evidence, conflicting claims & sources
        </button>
        {showEvidence && <EvidenceViewer evidence={evidence} citedIds={lastAnswer?.cited_ids || []}/>}
      </div>
    </div>}

    <Conversation messages={messages} busy={busy && !!comparison}/>
    {comparison && <div className="flex flex-wrap gap-2 my-3">
      {['Prioritize price', 'Which is most portable?', 'Explain the evidence'].map(text =>
        <button key={text} type="button" onClick={() => askSuggestion(text)} disabled={busy}
          className="text-xs border border-orange-200 text-orange-700 rounded-full px-3 py-2 hover:bg-orange-50 disabled:opacity-50">{text}</button>)}
    </div>}
    <form onSubmit={send} className="flex gap-2 mt-3">
      <input aria-label="Message Luna" maxLength={2000}
        className="border rounded-lg px-3 py-2 flex-1 min-w-0 text-sm"
        value={input} onChange={event => setInput(event.target.value)}
        placeholder={comparison ? 'Ask about price, power, reviews…' : 'Create a comparison first'}
        disabled={!comparison || busy}/>
      <button type="submit" disabled={!comparison || busy || !input.trim()}
        className="bg-orange-600 disabled:opacity-50 text-white px-4 rounded-lg text-sm">{busy ? 'Wait…' : 'Send'}</button>
    </form>
    <p className="text-xs text-gray-400 mt-3">Luna uses server-side rankings. AI responses may require model access; never place API keys in browser code.</p>
  </section>;
}

LunaWidget.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func,
};
