import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { assertHostAdapter, selectionKey, selectionKeys } from './hostAdapter.js';
import { LiveVoiceControls } from './LiveVoiceControls.jsx';
import { lunaClient } from './lunaClient.js';
import { errorText, fieldLabel, isSellerReply, itemName, money } from './display.js';
import {
  ComparisonTable, Conversation, PreferenceChips, SourcePanel, SparkleIcon, UpdateNotice,
} from './LunaPanels.jsx';
import { SellerQuestionDialog } from './SellerQuestion.jsx';

const greeting = {
  role: 'assistant',
  text: 'Here’s the side-by-side. Tell me what matters — budget, weight, charging power or reviews — and I’ll rank them and show you why.',
};
const suggestions = ['Lowest delivered price', 'Lightest first', 'What do reviews say?'];

const newConversationId = () => `luna_${crypto.randomUUID().replaceAll('-', '')}`;
const questionKey = question => `${question.listing_id}:${question.variant_id}:${question.field_key}`;

// Comparison request items, in catalog order, for the picked `listing:variant` keys.
function comparisonItems(listings, keys) {
  return listings.flatMap(listing => listing.variants
    .filter(variant => keys.includes(`${listing.listing_id}:${variant.variant_id}`))
    .map(variant => ({ listing_id: listing.listing_id, variant_id: variant.variant_id })));
}

function PickedProducts({ catalog, items }) {
  return <ul className="luna-opening-list">
    {items.map(({ listing_id: listingId, variant_id: variantId }) => {
      const listing = catalog.find(candidate => candidate.listing_id === listingId);
      const variant = listing.variants.find(candidate => candidate.variant_id === variantId);
      return <li key={`${listingId}:${variantId}`}>
        {listing.image_url && <img src={listing.image_url} alt=""/>}
        <span>{listing.title} · {variant.label}</span>
      </li>;
    })}
  </ul>;
}
PickedProducts.propTypes = {
  catalog: PropTypes.arrayOf(PropTypes.object).isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function LunaWidget({ adapter, apiBaseUrl = '/api', onClose }) {
  const hostAdapter = useMemo(() => assertHostAdapter(adapter), [adapter]);
  const [session, setSession] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // True when the host handed over a full comparison (2–4 picks). Such a host owns picking, so
  // the widget never shows its own picker: a lost or failed comparison offers a rebuild instead.
  const [hostPicked, setHostPicked] = useState(false);
  // True only while the host-handed comparison is being built at start-up.
  const [autoComparing, setAutoComparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [sourceTarget, setSourceTarget] = useState(null);
  // The missing cell the buyer is about to ask the seller about, awaiting their confirmation.
  const [sellerAsk, setSellerAsk] = useState(null);
  // Questions this buyer sent that the seller has not answered yet, as the server returned them.
  const [openQuestions, setOpenQuestions] = useState([]);
  const [sellerCheck, setSellerCheck] = useState('');
  // The column the shopper picked. Deciding is not buying: the host records the pick, and
  // checkout is one explicit press away only when the host offers it.
  const [pickedItemKey, setPickedItemKey] = useState(null);
  const [pickBarDismissed, setPickBarDismissed] = useState(false);
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
        setSellerAsk(null);
        setOpenQuestions([]);
        setSellerCheck('');
        setPickedItemKey(null);
        const hostKeys = selectionKeys(hostAdapter.getCurrentSelections());
        const availableKeys = new Set(listings.flatMap(listing => listing.variants
          .map(variant => `${listing.listing_id}:${variant.variant_id}`)));
        const unavailableKeys = hostKeys.filter(key => !availableKeys.has(key));
        const pickedKeys = hostKeys.filter(key => availableKeys.has(key));
        setSelection(pickedKeys);
        const handedOver = unavailableKeys.length === 0 && pickedKeys.length >= 2;
        setHostPicked(handedOver);
        if (unavailableKeys.length > 0) {
          setError(`Host selection ${unavailableKeys.join(', ')} is unavailable in the Luna catalog.`);
        } else if (handedOver) {
          // The host already chose a full comparison (Host A's cart). The session was issued
          // moments ago in this call, so there is no stale token to renew. If this fails, the
          // same picks stay and the shopper can build the comparison again.
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
  // The restart that forgot the session also forgot any question still waiting on the seller.
  async function recoverLostComparison() {
    const hadOpenQuestions = openQuestions.length > 0;
    setComparison(null);
    setNotice(null);
    setSourceTarget(null);
    setSellerAsk(null);
    setOpenQuestions([]);
    setSellerCheck('');
    setPickedItemKey(null);
    setMessages([]);
    try {
      await renewSession();
      setError((hostPicked
        ? 'Luna restarted, so this comparison was cleared. Your products are still picked, so build it again.'
        : 'Luna restarted, so this comparison was cleared. Your products are still picked. Press Compare to build it again.')
        + (hadOpenQuestions ? ' Your question to the seller was dropped with it; ask again once the comparison is back.' : ''));
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
      else {
        console.error('Luna request failed', err?.status, err?.message, err?.details);
        setMessages(old => [...old, { role: 'assistant', isError: true, text: errorText(err) }]);
      }
    } finally { setBusy(false); }
  }

  function askSeller({ itemKey, fieldKey }) {
    if (!comparison || busy) return;
    const item = comparison.evidence.items.find(candidate => candidate.item_key === itemKey);
    const field = comparison.evidence.schema_fields.find(candidate => candidate.field_key === fieldKey);
    setSellerAsk({ item, field });
  }

  // The buyer confirmed. The server words the question and keeps it open until the seller answers.
  async function sendSellerQuestion() {
    if (!sellerAsk || !session || busy) return;
    const { item, field } = sellerAsk;
    setBusy(true);
    setError('');
    try {
      const question = await lunaClient.sendSellerQuestion(
        apiBaseUrl, session.token, item.listing_id, item.variant_id, field.field_key,
      );
      setSellerAsk(null);
      setSellerCheck('');
      setOpenQuestions(open => open.some(candidate => questionKey(candidate) === questionKey(question))
        ? open : [...open, question]);
      setMessages(old => [...old, {
        role: 'assistant',
        text: `I’ve asked the seller of ${itemName(item)}: “${question.question}”. `
          + 'When they reply, press Check for the seller’s answer and I’ll add it as a cited source.',
      }]);
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else if (err?.status === 409) {
        // The seller already answered this field for another buyer; this comparison predates
        // the answer. Rebuilding the same variants brings it in as a cited source.
        setSellerAsk(null);
        try {
          await rebuildWithSellerAnswers(
            [{ listing_id: item.listing_id, variant_id: item.variant_id, field_key: field.field_key }],
            'The seller had already answered another buyer',
          );
        } catch (rebuildFailure) { showError(rebuildFailure); }
      } else showError(err);
    } finally { setBusy(false); }
  }

  // New evidence is the one case that needs a new comparison: re-extract the same exact variants.
  // The new comparison id starts a new conversation, and its preferences start empty.
  async function rebuildWithSellerAnswers(answered, intro = 'The seller answered') {
    const hadNeeds = comparison.preferences.max_price_minor !== null
      || comparison.preferences.min_output_w !== null || comparison.preferences.priorities.length > 0;
    const rebuilt = await lunaClient.createComparison(apiBaseUrl, session.token, comparison.evidence.items
      .map(item => ({ listing_id: item.listing_id, variant_id: item.variant_id })));
    const replySources = answered.map(question => {
      const itemKey = `${question.listing_id}:${question.variant_id}`;
      const fact = rebuilt.evidence.facts_by_item[itemKey]
        .find(candidate => candidate.field_key === question.field_key);
      const sourceId = fact?.evidence_ids.find(evidenceId => isSellerReply(rebuilt.evidence.evidence[evidenceId]));
      if (!sourceId) {
        throw new TypeError(`Rebuilt comparison does not cite the seller’s answer for ${itemKey} ${question.field_key}`);
      }
      return rebuilt.evidence.evidence[sourceId];
    });
    conversationId.current = newConversationId();
    setComparison(rebuilt);
    setNotice(null);
    setSourceTarget(null);
    setMessages([greeting, {
      role: 'assistant',
      text: `${intro} ${replySources.map(source => `“${source.source_text}”`).join(' and ')}. `
        + 'I rebuilt the comparison with that answer as a cited source.'
        + (hadNeeds ? ' Your earlier needs were cleared with it, so tell me what matters again.' : ''),
      citations: replySources.map(source => source.id),
    }]);
  }

  // One read per asked listing (at most four) tells which questions the seller has closed.
  async function checkSellerAnswers() {
    if (!comparison || !session || busy || openQuestions.length === 0) return;
    setBusy(true);
    setError('');
    setSellerCheck('');
    try {
      const stillOpen = new Set();
      for (const listingId of new Set(openQuestions.map(question => question.listing_id))) {
        const { questions } = await lunaClient.getSellerQuestions(apiBaseUrl, session.token, listingId);
        for (const question of questions) stillOpen.add(questionKey(question));
      }
      const answered = openQuestions.filter(question => !stillOpen.has(questionKey(question)));
      if (answered.length === 0) {
        setSellerCheck('No answer yet. The seller hasn’t replied.');
        return;
      }
      await rebuildWithSellerAnswers(answered);
      setOpenQuestions(open => open.filter(question => stillOpen.has(questionKey(question))));
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else showError(err);
    } finally { setBusy(false); }
  }

  // The shopper's explicit pick. Luna records it against the revision on screen, so Seller
  // Centre can say why; then the host decides what follows. Luna never buys anything.
  async function pick(item) {
    if (!comparison || !session) return;
    setError('');
    try {
      await lunaClient.pick(apiBaseUrl, session.token, comparison.comparison_id, {
        item_key: item.item_key,
        expected_revision: comparison.revision,
      });
    } catch (err) {
      if (err?.status === 401) await recoverLostComparison();
      else if (err?.status === 409) {
        // The server moved on since this table was drawn. Show the current state; the shopper
        // picks again from it. A refresh failure keeps its own message.
        await refreshComparison();
        setError(previous => previous || errorText(err));
      } else showError(err);
      return;
    }
    try {
      const result = await hostAdapter.requestAddToCart({
        listingId: item.listing_id,
        variantId: item.variant_id,
      });
      if (typeof result?.ok !== 'boolean') {
        throw new TypeError(`Luna host adapter requestAddToCart() must resolve to { ok: boolean }, got ${JSON.stringify(result)}`);
      }
      if (!result.ok) {
        setError('The shop couldn’t take your pick. Please try again.');
        return;
      }
      setPickedItemKey(item.item_key);
      setPickBarDismissed(false);
    } catch (err) { showError(err); }
  }

  // Checkout is the host's: Luna only hands over the picked variant on an explicit press.
  async function checkoutPick(item) {
    setError('');
    try {
      const result = await hostAdapter.requestCheckout({
        listingId: item.listing_id,
        variantId: item.variant_id,
      });
      if (typeof result?.ok !== 'boolean') {
        throw new TypeError(`Luna host adapter requestCheckout() must resolve to { ok: boolean }, got ${JSON.stringify(result)}`);
      }
      if (!result.ok) setError('The shop couldn’t open checkout for your pick. Please try again.');
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
  // A pick belongs to a column; a comparison without that column has no pick to show.
  const pickedItem = (comparison && pickedItemKey
    && evidence.items.find(item => item.item_key === pickedItemKey)) || null;

  return <section aria-label="Luna shopping assistant" className="luna-widget"
    data-revision={comparison ? comparison.revision : undefined}>
    <header className="luna-header">
      <span className="luna-brand"><SparkleIcon/>Luna</span>
      <h2 className="luna-title">{comparison ? `Comparing ${evidence.items.length} products`
        : hostPicked ? `Comparing ${selectedItems.length} products` : 'Compare products'}</h2>
      {isDemoData && <span className="luna-demo-pill">Demo data</span>}
      {onClose && <button type="button" className="luna-link luna-close" onClick={onClose}>Close</button>}
    </header>

    {error && <div role="alert" className="luna-alert">
      <span>{error}</span>
      {comparison && <button type="button" onClick={refreshComparison} disabled={busy} className="luna-link">Refresh comparison</button>}
    </div>}

    <div className="luna-body">
      {!comparison && autoComparing && <div className="luna-opening" role="status">
        <span className="luna-spinner" aria-hidden="true"/>
        <div>
          <p className="luna-section-title">Lining up your {selectedItems.length} products…</p>
          <PickedProducts catalog={catalog} items={selectedItems}/>
          <p className="luna-muted">Luna is reading each listing and its reviews. This can take a few seconds.</p>
        </div>
      </div>}

      {!comparison && !autoComparing && hostPicked && <div className="luna-opening" role="status">
        <div>
          <p className="luna-section-title">Your {selectedItems.length} products are still picked</p>
          <PickedProducts catalog={catalog} items={selectedItems}/>
          <button type="button" className="luna-button" onClick={createComparison} disabled={busy}>
            {busy ? 'Loading…' : 'Build the comparison again'}
          </button>
        </div>
      </div>}

      {!comparison && !autoComparing && !hostPicked && <div className="luna-picker">
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
          {openQuestions.length > 0 && <section aria-label="Waiting on the seller" className="luna-waiting">
            <div>
              <strong>Waiting on the seller</strong>
              <ul>
                {openQuestions.map(question => {
                  const item = evidence.items.find(candidate =>
                    candidate.item_key === `${question.listing_id}:${question.variant_id}`);
                  return <li key={questionKey(question)}>
                    {fieldLabel(evidence.schema_fields, question.field_key)} for {item ? itemName(item) : question.variant_id}
                  </li>;
                })}
              </ul>
              {sellerCheck && <p role="status" className="luna-muted">{sellerCheck}</p>}
            </div>
            <button type="button" className="luna-button luna-button-secondary" onClick={checkSellerAnswers} disabled={busy}>
              Check for the seller’s answer
            </button>
          </section>}
          <ComparisonTable comparison={comparison} onOpenCell={setSourceTarget}
            imagesByListing={imagesByListing}
            onNavigateToListing={hostAdapter.navigateToListing} onAskSeller={askSeller}
            openQuestionKeys={new Set(openQuestions.map(questionKey))}
            pickedItemKey={pickedItem?.item_key ?? null}
            onPick={hostAdapter.requestAddToCart ? pick : undefined}/>
          {pickedItem && !pickBarDismissed && <section aria-label="Your pick" className="luna-pick-bar">
            {imagesByListing.get(pickedItem.listing_id)
              && <img src={imagesByListing.get(pickedItem.listing_id)} alt=""/>}
            <div className="luna-pick-bar-copy">
              <span className="luna-pick-bar-label">Your pick</span>
              <strong>{itemName(pickedItem)}</strong>
              <span>Delivered {money(pickedItem.landed_price_minor, pickedItem.currency)}</span>
            </div>
            <div className="luna-pick-bar-actions">
              {hostAdapter.requestCheckout && <button type="button" className="luna-button"
                onClick={() => checkoutPick(pickedItem)} disabled={busy}>Check out</button>}
              <button type="button" className="luna-button luna-button-secondary"
                onClick={() => setPickBarDismissed(true)}>Keep comparing</button>
            </div>
          </section>}
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
    {sellerAsk && <SellerQuestionDialog item={sellerAsk.item} field={sellerAsk.field} busy={busy}
      onSend={sendSellerQuestion} onCancel={() => setSellerAsk(null)}/>}
  </section>;
}

LunaWidget.propTypes = {
  adapter: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    getCurrentSelections: PropTypes.func.isRequired,
    onSelectionChange: PropTypes.func.isRequired,
    navigateToListing: PropTypes.func.isRequired,
    requestAddToCart: PropTypes.func,
    requestCheckout: PropTypes.func,
  }).isRequired,
  apiBaseUrl: PropTypes.string,
  onClose: PropTypes.func,
};
