import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { assertHostAdapter, selectionKey, selectionKeys } from './hostAdapter.js';
import { LiveVoiceControls } from './LiveVoiceControls.jsx';
import { lunaClient } from './lunaClient.js';
import { errorText, isSellerReply, money } from './display.js';
import {
  ComparisonTable, Conversation, PreferenceChips, SourcePanel, SparkleIcon, UpdateNotice,
} from './LunaPanels.jsx';
import { SellerQuestionDialog, SimulatedSellerInbox } from './SellerQuestion.jsx';

const greeting = {
  role: 'assistant',
  text: 'Here’s the side-by-side. Tell me what matters — budget, weight, charging power or reviews — and I’ll rank them and show you why.',
};
const suggestions = ['Lowest delivered price', 'Lightest first', 'What do reviews say?'];

const newConversationId = () => `luna_${crypto.randomUUID().replaceAll('-', '')}`;

// Comparison request items, in catalog order, for the picked `listing:variant` keys.
function comparisonItems(listings, keys) {
  return listings.flatMap(listing => listing.variants
    .filter(variant => keys.includes(`${listing.listing_id}:${variant.variant_id}`))
    .map(variant => ({ listing_id: listing.listing_id, variant_id: variant.variant_id })));
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
  // True only while the comparison the host handed over (2–4 picks) is being built at start-up.
  const [autoComparing, setAutoComparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [sourceTarget, setSourceTarget] = useState(null);
  // A server-drafted seller question: confirmed by the buyer, then answered in the simulated inbox.
  const [sellerDraft, setSellerDraft] = useState(null);
  // The seller's answer is stored, but the comparison that cites it has not been built yet.
  const [pendingSellerReply, setPendingSellerReply] = useState(null);
  const conversationId = useRef(newConversationId());
  const generation = useRef(0);
  const inputRef = useRef(null);
  const selectedItems = useMemo(() => comparisonItems(catalog, selection), [catalog, selection]);
  const imagesByListing = useMemo(
    () => new Map(catalog.map(listing => [listing.listing_id, listing.image_url])), [catalog]);

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
      setAutoComparing(false);
      setError('');
      try {
        const issued = await lunaClient.createSession(apiBaseUrl, controller.signal);
        const result = await lunaClient.getCatalog(apiBaseUrl, issued.token, controller.signal);
        if (epoch !== generation.current) return;
        const listings = result.listings || [];
        setSession(issued);
        setCatalog(listings);
        // A new session cannot see an earlier session's comparison, so drop it with that session.
        setComparison(null);
        setMessages([]);
        setNotice(null);
        setSourceTarget(null);
        setSellerDraft(null);
        setPendingSellerReply(null);
        const hostKeys = selectionKeys(hostAdapter.getCurrentSelections());
        const availableKeys = new Set(listings.flatMap(listing => listing.variants
          .map(variant => `${listing.listing_id}:${variant.variant_id}`)));
        const unavailableKeys = hostKeys.filter(key => !availableKeys.has(key));
        const pickedKeys = hostKeys.filter(key => availableKeys.has(key));
        setSelection(pickedKeys);
        if (unavailableKeys.length > 0) {
          setError(`Host selection ${unavailableKeys.join(', ')} is unavailable in the Luna catalog.`);
        } else if (pickedKeys.length >= 2) {
          // The host already chose a full comparison (Host A's cart), so skip the picker. The
          // session was issued moments ago in this call, so there is no stale token to renew.
          // If this fails, the picker stays open with the same picks for a manual Compare.
          setAutoComparing(true);
          const created = await lunaClient.createComparison(
            apiBaseUrl, issued.token, comparisonItems(listings, pickedKeys), controller.signal,
          );
          if (epoch !== generation.current) return;
          setComparison(created);
          setMessages([greeting]);
        }
      } catch (err) {
        if (!controller.signal.aborted) showError(err);
      } finally {
        if (epoch === generation.current) {
          setBusy(false);
          setAutoComparing(false);
        }
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

  // The API keeps sessions in memory, so a restart or the one-hour expiry forgets them. The
  // widget always sends a token, so a 401 means this session is gone: start a new one.
  async function renewSession() {
    console.warn('Luna API no longer knows this demo session (HTTP 401); starting a new one');
    const issued = await lunaClient.createSession(apiBaseUrl);
    setSession(issued);
    return issued;
  }

  // A forgotten session takes its comparison with it. Keep the picks so Compare rebuilds it.
  async function recoverLostComparison() {
    setComparison(null);
    setNotice(null);
    setSourceTarget(null);
    setSellerDraft(null);
    setPendingSellerReply(null);
    setMessages([]);
    try {
      await renewSession();
      setError('Luna restarted, so this comparison was cleared. Your products are still picked. Press Compare to build it again.');
    } catch (err) { showError(err); }
  }

  async function createComparison() {
    if (!session || selectedItems.length < 2 || selectedItems.length > 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      let created;
      try {
        created = await lunaClient.createComparison(apiBaseUrl, session.token, selectedItems);
      } catch (err) {
        if (err?.status !== 401) throw err;
        // The server rejected the old session before doing any work, so sending the same
        // request once with a new session cannot create a duplicate comparison.
        const renewed = await renewSession();
        created = await lunaClient.createComparison(apiBaseUrl, renewed.token, selectedItems);
      }
      setComparison(created);
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
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
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
      // A server-side preference mutation may have committed before a failed answer.
      // Refresh explicitly; never automatically replay a potentially mutating ask.
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
  }

  async function askSeller({ itemKey, fieldKey }) {
    if (!comparison || !session || busy) return;
    const item = comparison.evidence.items.find(candidate => candidate.item_key === itemKey);
    setBusy(true);
    setError('');
    try {
      const drafted = await lunaClient.draftSellerQuestion(
        apiBaseUrl, session.token, item.listing_id, item.variant_id, fieldKey,
      );
      setSellerDraft({ ...drafted, item, isInInbox: false });
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
  }

  // New evidence is the one case that needs a new comparison: re-extract the same exact variants.
  // The new comparison id starts a new conversation, and its preferences start empty.
  async function rebuildWithSellerAnswer(reply) {
    const hadNeeds = comparison.preferences.max_price_minor !== null
      || comparison.preferences.min_output_w !== null || comparison.preferences.priorities.length > 0;
    const rebuilt = await lunaClient.createComparison(apiBaseUrl, session.token, comparison.evidence.items
      .map(item => ({ listing_id: item.listing_id, variant_id: item.variant_id })));
    const replySource = Object.values(rebuilt.evidence.evidence).find(record =>
      record.item_key === `${reply.listing_id}:${reply.variant_id}`
      && isSellerReply(record) && record.source_text === reply.text);
    if (!replySource) throw new TypeError(`Rebuilt comparison does not cite seller reply ${reply.text}`);
    conversationId.current = newConversationId();
    setComparison(rebuilt);
    setNotice(null);
    setSourceTarget(null);
    setPendingSellerReply(null);
    setMessages([greeting, {
      role: 'assistant',
      text: `The seller answered “${reply.text}”. I rebuilt the comparison with that answer as a cited source.`
        + (hadNeeds ? ' Your earlier needs were cleared with it, so tell me what matters again.' : ''),
      citations: [replySource.id],
    }]);
  }

  async function sendSellerAnswer(answer) {
    if (!sellerDraft || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      const reply = await lunaClient.sendSellerReply(apiBaseUrl, session.token,
        sellerDraft.listing_id, sellerDraft.variant_id, sellerDraft.field_key, answer);
      setSellerDraft(null);
      setPendingSellerReply(reply);
      await rebuildWithSellerAnswer(reply);
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
  }

  async function retryRebuild() {
    if (!pendingSellerReply || busy) return;
    setBusy(true);
    setError('');
    try { await rebuildWithSellerAnswer(pendingSellerReply); }
    catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
  }

  // The shopper's explicit pick. The host decides what follows; Luna never buys anything.
  async function choose(item) {
    setError('');
    try {
      const result = await hostAdapter.requestAddToCart({
        listingId: item.listing_id,
        variantId: item.variant_id,
      });
      if (typeof result?.ok !== 'boolean') {
        throw new TypeError(`Luna host adapter requestAddToCart() must resolve to { ok: boolean }, got ${JSON.stringify(result)}`);
      }
      if (!result.ok) setError('The shop couldn’t take this product to checkout. Please try again.');
    } catch (err) { showError(err); }
  }

  function draftQuestion(text) {
    setSourceTarget(null);
    setInput(text);
    inputRef.current?.focus();
  }

  const evidence = comparison?.evidence;
  const isDemoData = comparison ? evidence.items.some(item => item.synthetic)
    : catalog.some(listing => listing.synthetic);

  return <section aria-label="Luna shopping assistant" className="luna-widget"
    data-revision={comparison ? comparison.revision : undefined}>
    <header className="luna-header">
      <span className="luna-brand"><SparkleIcon/>Luna</span>
      <h2 className="luna-title">{comparison ? `Comparing ${evidence.items.length} products`
        : autoComparing ? `Comparing ${selectedItems.length} products` : 'Compare products'}</h2>
      {isDemoData && <span className="luna-demo-pill">Demo data</span>}
      {onClose && <button type="button" className="luna-link luna-close" onClick={onClose}>Close</button>}
    </header>

    {error && <div role="alert" className="luna-alert">
      <span>{error}</span>
      {comparison && !pendingSellerReply && <button type="button" onClick={refreshComparison} disabled={busy} className="luna-link">Refresh comparison</button>}
      {pendingSellerReply && <button type="button" onClick={retryRebuild} disabled={busy} className="luna-link">Rebuild with seller answer</button>}
    </div>}

    <div className="luna-body">
      {!comparison && autoComparing && <div className="luna-opening" role="status">
        <span className="luna-spinner" aria-hidden="true"/>
        <div>
          <p className="luna-section-title">Lining up your {selectedItems.length} products…</p>
          <ul className="luna-opening-list">
            {selectedItems.map(({ listing_id: listingId, variant_id: variantId }) => {
              const listing = catalog.find(candidate => candidate.listing_id === listingId);
              const variant = listing.variants.find(candidate => candidate.variant_id === variantId);
              return <li key={`${listingId}:${variantId}`}>
                {listing.image_url && <img src={listing.image_url} alt=""/>}
                <span>{listing.title} · {variant.label}</span>
              </li>;
            })}
          </ul>
          <p className="luna-muted">Luna is reading each listing and its reviews. This can take a few seconds.</p>
        </div>
      </div>}

      {!comparison && !autoComparing && <div className="luna-picker">
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
                <span className="luna-picker-option-copy">
                  <span>{variant.label}</span>
                  <small>
                    List {money(variant.price_minor, variant.currency)} · Voucher −{money(variant.shop_voucher_minor, variant.currency)} · Shipping +{money(variant.shipping_minor, variant.currency)}
                  </small>
                </span>
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
          {sellerDraft?.isInInbox
            ? <SimulatedSellerInbox draft={sellerDraft} busy={busy} onAnswer={sendSellerAnswer}
              field={evidence.schema_fields.find(field => field.field_key === sellerDraft.field_key)}
              onBack={() => setSellerDraft(null)}/>
            : <ComparisonTable comparison={comparison} onOpenCell={setSourceTarget}
              imagesByListing={imagesByListing}
              onNavigateToListing={hostAdapter.navigateToListing} onAskSeller={askSeller}
              onChoose={hostAdapter.requestAddToCart ? choose : undefined}/>}
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
    {sellerDraft && !sellerDraft.isInInbox && <SellerQuestionDialog draft={sellerDraft} busy={busy}
      onSend={() => setSellerDraft(draft => ({ ...draft, isInInbox: true }))} onCancel={() => setSellerDraft(null)}/>}
  </section>;
}

LunaWidget.propTypes = {
  adapter: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    getCurrentSelections: PropTypes.func.isRequired,
    onSelectionChange: PropTypes.func.isRequired,
    navigateToListing: PropTypes.func.isRequired,
    requestAddToCart: PropTypes.func,
  }).isRequired,
  apiBaseUrl: PropTypes.string,
  onClose: PropTypes.func,
};
