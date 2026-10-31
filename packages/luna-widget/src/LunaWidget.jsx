import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { assertHostAdapter, selectionKey } from './hostAdapter.js';
import { LiveVoiceControls } from './LiveVoiceControls.jsx';
import { lunaClient } from './lunaClient.js';
import { money } from './display.js';
import {
  ComparisonTable, Conversation, PreferenceChips, SourcePanel, SparkleIcon, UpdateNotice,
} from './LunaPanels.jsx';
import { SellerGapReport } from './SellerGapReport.jsx';

const greeting = {
  role: 'assistant',
  text: 'Here’s the side-by-side. Tell me what matters — budget, weight, charging power or reviews — and I’ll rank them and show you why.',
};
const suggestions = ['Cheapest first', 'Lightest first', 'What do reviews say?'];

function errorText(error) {
  if (error?.status === 401) return 'Your demo session expired. Restart the session to continue.';
  if (error?.status === 409) return 'The comparison changed while you were asking. Refresh it, then ask again.';
  if (error?.status === 0) return 'Luna can’t be reached right now. Check your connection and try again.';
  if (error?.status >= 500) return 'Luna ran into a problem on our side. Please try again in a moment.';
  return error?.message || 'Something went wrong.';
}

export default function LunaWidget({ adapter, apiBaseUrl = '/api', onClose }) {
  const hostAdapter = useMemo(() => assertHostAdapter(adapter), [adapter]);
  const [session, setSession] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [sourceTarget, setSourceTarget] = useState(null);
  const [sellerReport, setSellerReport] = useState(null);
  const conversationId = useRef(`luna_${crypto.randomUUID().replaceAll('-', '')}`);
  const generation = useRef(0);
  const inputRef = useRef(null);
  const selectedItems = useMemo(() => catalog.flatMap(listing =>
    listing.variants.filter(variant => selection.includes(`${listing.listing_id}:${variant.variant_id}`))
      .map(variant => ({ listing_id: listing.listing_id, variant_id: variant.variant_id }))), [catalog, selection]);

  function showError(failure) {
    // Keep the API's diagnostic detail for developers; shoppers get plain text.
    console.error('Luna request failed', failure?.status, failure?.message, failure?.details);
    setError(errorText(failure));
  }

  useEffect(() => {
    const controller = new AbortController();
    const epoch = ++generation.current;
    async function initialize() {
      setBusy(true);
      setError('');
      try {
        const issued = await lunaClient.createSession(apiBaseUrl, controller.signal);
        const result = await lunaClient.getCatalog(apiBaseUrl, issued.token, controller.signal);
        if (epoch !== generation.current) return;
        const listings = result.listings || [];
        setSession(issued);
        setCatalog(listings);
        const hostKey = selectionKey(hostAdapter.getCurrentSelection());
        const availableKeys = new Set(listings.flatMap(listing => listing.variants
          .map(variant => `${listing.listing_id}:${variant.variant_id}`)));
        setSelection(hostKey && availableKeys.has(hostKey) ? [hostKey] : []);
        if (hostKey && !availableKeys.has(hostKey)) {
          setError(`Host selection ${hostKey} is unavailable in the Luna catalog.`);
        }
      } catch (err) {
        if (!controller.signal.aborted) showError(err);
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    }
    initialize();
    return () => { controller.abort(); generation.current += 1; };
    // A new adapter or API base means a new host boundary and therefore a new demo session.
  }, [apiBaseUrl, hostAdapter]);

  useEffect(() => {
    const unsubscribe = hostAdapter.onSelectionChange(hostSelection => {
      if (comparison) return;
      const hostKey = selectionKey(hostSelection);
      if (!hostKey) return;
      const isAvailable = catalog.some(listing => listing.variants.some(variant =>
        `${listing.listing_id}:${variant.variant_id}` === hostKey));
      if (!isAvailable) {
        setError(`Host selection ${hostKey} is unavailable in the Luna catalog.`);
        return;
      }
      setError('');
      setSelection(previous => previous.includes(hostKey) || previous.length >= 4
        ? previous : [...previous, hostKey]);
    });
    if (typeof unsubscribe !== 'function') {
      throw new TypeError('Luna host adapter onSelectionChange() must return an unsubscribe function');
    }
    return unsubscribe;
  }, [catalog, comparison, hostAdapter]);

  // Announce a change only when the server moved to a newer revision with a matching patch.
  function applyComparison(next) {
    if (comparison && next.revision > comparison.revision && next.ui_patch?.new_revision === next.revision) {
      setNotice(next.ui_patch);
    }
    setComparison(next);
  }

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
      setComparison(await lunaClient.createComparison(apiBaseUrl, session.token, selectedItems));
      setNotice(null);
      setMessages([greeting]);
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  async function refreshComparison() {
    if (!comparison || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      applyComparison(await lunaClient.getComparison(apiBaseUrl, session.token, comparison.comparison_id));
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  async function ask(text) {
    const message = text.trim();
    if (!message || !comparison || !session || busy) return;
    setBusy(true);
    setError('');
    setNotice(null);
    setMessages(old => [...old, { role: 'user', text: message }]);
    setInput('');
    try {
      const answer = await lunaClient.ask(apiBaseUrl, session.token, comparison.comparison_id, {
        conversation_id: conversationId.current,
        message,
        expected_revision: comparison.revision,
      });
      // The ask response does not contain the full canonical comparison.
      applyComparison(await lunaClient.getComparison(apiBaseUrl, session.token, comparison.comparison_id));
      setMessages(old => [...old, { role: 'assistant', text: answer.answer, citations: answer.cited_ids }]);
    } catch (err) {
      showError(err);
      // A server-side preference mutation may have committed before a failed answer.
      // Refresh explicitly; never automatically replay a potentially mutating ask.
    } finally { setBusy(false); }
  }

  function draftQuestion(text) {
    setSourceTarget(null);
    setInput(text);
    inputRef.current?.focus();
  }

  async function openSellerReport(listingId) {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      setSellerReport(await lunaClient.getListingGapReport(apiBaseUrl, session.token, listingId));
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  const evidence = comparison?.evidence;
  const isDemoData = comparison ? evidence.items.some(item => item.synthetic)
    : catalog.some(listing => listing.synthetic);

  return <section aria-label="Luna shopping assistant" className="luna-widget"
    data-revision={comparison ? comparison.revision : undefined}>
    <header className="luna-header">
      <span className="luna-brand"><SparkleIcon/>Luna</span>
      <h2 className="luna-title">{comparison ? `Comparing ${evidence.items.length} products` : 'Compare products'}</h2>
      {isDemoData && <span className="luna-demo-pill">Demo data</span>}
      {onClose && <button type="button" className="luna-link luna-close" onClick={onClose}>Close</button>}
    </header>

    {error && <div role="alert" className="luna-alert">
      <span>{error}</span>
      {comparison && <button type="button" onClick={refreshComparison} disabled={busy} className="luna-link">Refresh comparison</button>}
      {error.includes('expired') && <button type="button" onClick={() => window.location.reload()} className="luna-link">Restart session</button>}
    </div>}

    <div className="luna-body">
      {!comparison && <div className="luna-picker">
        <h3 className="luna-section-title">Pick 2–4 products to compare</h3>
        <p className="luna-muted">Luna lines them up side by side and shows where every value comes from.</p>
        <div className="luna-picker-grid">
          {catalog.map(listing => <div key={listing.listing_id} role="group" aria-label={listing.title} className="luna-picker-card">
            <p className="luna-picker-title">{listing.title}</p>
            {listing.variants.map(variant => {
              const key = `${listing.listing_id}:${variant.variant_id}`;
              return <label key={key} className="luna-picker-option">
                <input type="checkbox" checked={selection.includes(key)}
                  disabled={busy || (!selection.includes(key) && selection.length >= 4)} onChange={() => toggle(key)}/>
                <span>{variant.label} · {money(variant.price_minor, variant.currency)}</span>
              </label>;
            })}
          </div>)}
        </div>
        <div className="luna-picker-footer">
          <span className="luna-muted">{selection.length} of 4 picked</span>
          <button type="button" className="luna-button" onClick={createComparison}
            disabled={busy || selection.length < 2 || selection.length > 4}>
            {busy ? 'Loading…' : `Compare ${selection.length} products`}
          </button>
        </div>
      </div>}

      {comparison && <div className="luna-layout">
        <div className="luna-main">
          <PreferenceChips preferences={comparison.preferences} currency={evidence.items[0].currency}
            schemaFields={evidence.schema_fields} onChange={() => draftQuestion('Change my needs: ')}/>
          {notice && <UpdateNotice uiPatch={notice} preferences={comparison.preferences} evidence={evidence}/>}
          <ComparisonTable comparison={comparison} onOpenCell={setSourceTarget}
            onNavigateToListing={hostAdapter.navigateToListing} onOpenSellerReport={openSellerReport}/>
          {sellerReport && <SellerGapReport report={sellerReport} evidence={evidence}
            onClose={() => setSellerReport(null)}
            onOpenEvidence={gap => setSourceTarget({ itemKey: gap.item_key, fieldKey: gap.field_key })}/>}
        </div>
        <aside aria-label="Ask Luna" className="luna-chat">
          <h3 className="luna-chat-title">Ask Luna</h3>
          <Conversation messages={messages} busy={busy} evidence={evidence}
            onOpenCitation={citationId => setSourceTarget({ citationId })}/>
          <div className="luna-suggestions">
            {suggestions.map(text => <button key={text} type="button" className="luna-suggestion"
              onClick={() => ask(text)} disabled={busy}>{text}</button>)}
          </div>
          <form className="luna-composer" onSubmit={event => { event.preventDefault(); ask(input); }}>
            <input ref={inputRef} aria-label="Message Luna" maxLength={2000} value={input}
              onChange={event => setInput(event.target.value)} placeholder="Ask about price, weight, power…"
              disabled={busy}/>
            <button type="submit" className="luna-button" disabled={busy || !input.trim()}>Send</button>
          </form>
          {session && <LiveVoiceControls
            apiBaseUrl={apiBaseUrl}
            token={session.token}
            comparisonId={comparison.comparison_id}
            disabled={busy}
            onCanonicalStateChanged={refreshComparison}
          />}
        </aside>
      </div>}
    </div>

    {sourceTarget && comparison && <SourcePanel key={JSON.stringify(sourceTarget)} comparison={comparison}
      target={sourceTarget} onClose={() => setSourceTarget(null)} onAsk={draftQuestion}/>}
  </section>;
}

LunaWidget.propTypes = {
  adapter: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    getCurrentSelection: PropTypes.func.isRequired,
    onSelectionChange: PropTypes.func.isRequired,
    navigateToListing: PropTypes.func.isRequired,
    requestAddToCart: PropTypes.func,
  }).isRequired,
  apiBaseUrl: PropTypes.string,
  onClose: PropTypes.func,
};
