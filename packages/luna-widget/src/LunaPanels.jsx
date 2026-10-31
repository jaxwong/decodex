import { Fragment, useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  PRICE_FIELD, citationSource, conflictText, factValueText, fieldLabel, itemName, money,
  readableLimitation, sourceLabel,
} from './display.js';

// The API ranks against max_output_w when the shopper sets min_output_w.
const MIN_OUTPUT_FIELD = 'max_output_w';

function factFor(evidence, itemKey, fieldKey) {
  const fact = evidence.facts_by_item[itemKey].find(candidate => candidate.field_key === fieldKey);
  if (!fact) throw new TypeError(`Comparison evidence has no ${fieldKey} fact for ${itemKey}`);
  return fact;
}

function describeCell(evidence, item, fieldKey) {
  if (fieldKey === PRICE_FIELD) {
    return { status: 'price', text: money(item.landed_price_minor, item.currency) };
  }
  const fact = factFor(evidence, item.item_key, fieldKey);
  if (fact.status === 'supported') return { status: 'supported', text: factValueText(fact), fact };
  if (fact.status === 'conflicting') return { status: 'conflicting', text: conflictText(fact), fact };
  return { status: fact.status, text: null, fact };
}

function columnStatus(recommendation, itemKey) {
  if (itemKey === recommendation.item_key) return { label: 'Top match', tone: 'top' };
  if (recommendation.excluded_item_keys.includes(itemKey)) return { label: 'Doesn’t fit your needs', tone: 'out' };
  if (recommendation.uncertain_item_keys.includes(itemKey)) return { label: 'Can’t rank yet', tone: 'warn' };
  const rank = recommendation.ranked_item_keys.indexOf(itemKey);
  return rank >= 0 ? { label: `#${rank + 1}`, tone: 'rank' } : null;
}

function rowHint(preferences, currency, fieldKey) {
  const hints = [];
  const priority = preferences.priorities.indexOf(fieldKey);
  if (priority >= 0) hints.push(`Priority ${priority + 1}`);
  if (fieldKey === PRICE_FIELD && preferences.max_price_minor !== null) {
    hints.push(`Up to ${money(preferences.max_price_minor, currency)}`);
  }
  if (fieldKey === MIN_OUTPUT_FIELD && preferences.min_output_w !== null) {
    hints.push(`At least ${preferences.min_output_w} W`);
  }
  return hints.join(' · ');
}

function highlightValue(text) {
  const separator = text.indexOf(': ');
  if (separator < 0) return text;
  return <>{text.slice(0, separator + 2)}<mark>{text.slice(separator + 2)}</mark></>;
}

export const SparkleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/>
</svg>;

export function PreferenceChips({ preferences, currency, schemaFields, onChange }) {
  const hasNeeds = preferences.max_price_minor !== null || preferences.min_output_w !== null
    || preferences.priorities.length > 0;
  return <section aria-label="Your needs" className="luna-needs">
    <span className="luna-needs-label">Your needs</span>
    {preferences.max_price_minor !== null && <span className="luna-chip">
      Up to {money(preferences.max_price_minor, currency)}
    </span>}
    {preferences.min_output_w !== null && <span className="luna-chip">At least {preferences.min_output_w} W</span>}
    {preferences.priorities.map((priority, index) => <span key={priority} className="luna-chip">
      <span className="luna-chip-rank" aria-hidden="true">{index + 1}</span>
      <span className="luna-sr-only">Priority {index + 1}: </span>{fieldLabel(schemaFields, priority)}
    </span>)}
    {!hasNeeds && <span className="luna-muted">Nothing yet. Tell Luna what matters to you.</span>}
    <button type="button" className="luna-link" onClick={onChange}>Change</button>
  </section>;
}
PreferenceChips.propTypes = {
  preferences: PropTypes.object.isRequired,
  currency: PropTypes.string.isRequired,
  schemaFields: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
};

export function UpdateNotice({ uiPatch, preferences, evidence }) {
  const top = evidence.items.find(item => item.item_key === uiPatch.highlight_item_key);
  const priorities = preferences.priorities.map(priority => fieldLabel(evidence.schema_fields, priority));
  return <div role="status" className="luna-notice">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>
    </svg>
    <p>
      <strong>Updated to match your needs.</strong>
      {priorities.length > 0 && ` Ranked by ${priorities.join(', then ')}.`}
      {top && ` ${itemName(top)} is the top match.`}
    </p>
  </div>;
}
UpdateNotice.propTypes = {
  uiPatch: PropTypes.object.isRequired,
  preferences: PropTypes.object.isRequired,
  evidence: PropTypes.object.isRequired,
};

function CellContent({ cell }) {
  if (cell.status === 'price' || cell.status === 'supported') return <span className="luna-value">{cell.text}</span>;
  if (cell.status === 'missing') return <>
    <span className="luna-value is-missing">Not stated</span>
    <span className="luna-cell-note">Seller didn’t list it</span>
  </>;
  if (cell.status === 'conflicting') return <>
    <span className="luna-value is-conflict">Listing disagrees</span>
    <span className="luna-cell-note">{cell.text}</span>
  </>;
  return <>
    <span className="luna-value is-missing">Couldn’t verify</span>
    <span className="luna-cell-note">Sources unclear</span>
  </>;
}
CellContent.propTypes = { cell: PropTypes.object.isRequired };

const cellSpokenText = cell => ({
  missing: 'Not stated',
  conflicting: `Listing disagrees, ${cell.text}`,
  unresolved: 'Couldn’t verify',
}[cell.status] || cell.text);

function productSnapshot(evidence, item) {
  return {
    listingId: item.listing_id,
    variantId: item.variant_id,
    title: item.title,
    variantLabel: item.variant_label,
    priceMinor: item.price_minor,
    currency: item.currency,
    synthetic: item.synthetic,
    specifications: evidence.schema_fields.map(field => {
      const fact = factFor(evidence, item.item_key, field.field_key);
      const cell = describeCell(evidence, item, field.field_key);
      const value = {
        conflicting: `Listing disagrees: ${cell.text}`,
        missing: 'Not stated',
        unresolved: 'Couldn’t verify',
      }[cell.status] || cell.text;
      const sources = fact.evidence_ids.map(evidenceId => {
        const record = evidence.evidence[evidenceId];
        if (!record) throw new TypeError(`Product specification source ${evidenceId} is missing`);
        return {
          evidenceId,
          label: sourceLabel(record.source_type),
          text: record.source_text,
          location: record.source_location,
        };
      });
      return {
        fieldKey: field.field_key,
        label: field.label,
        status: fact.status,
        value,
        sources,
      };
    }),
  };
}

export function ComparisonTable({ comparison, onOpenCell, onNavigateToListing, onOpenSellerReport }) {
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const { evidence, recommendation, preferences } = comparison;
  const schemaFields = evidence.schema_fields;
  const itemsByKey = new Map(evidence.items.map(item => [item.item_key, item]));
  const columns = [...new Set([
    ...(recommendation.item_key ? [recommendation.item_key] : []),
    ...recommendation.ranked_item_keys,
    ...evidence.items.map(item => item.item_key),
  ])].map(itemKey => itemsByKey.get(itemKey));
  const currency = columns[0].currency;

  const fieldKeys = [PRICE_FIELD, ...schemaFields.map(field => field.field_key)];
  const cells = new Map(fieldKeys.map(fieldKey =>
    [fieldKey, columns.map(item => describeCell(evidence, item, fieldKey))]));
  const isSameEverywhere = fieldKey => {
    const row = cells.get(fieldKey);
    return row.every(cell => (cell.status === 'supported' || cell.status === 'price') && cell.text === row[0].text);
  };
  const focused = comparison.ui_patch?.new_revision === comparison.revision
    ? comparison.ui_patch.focused_fields.filter(fieldKey => fieldKeys.includes(fieldKey)) : [];
  const unfocused = fieldKeys.filter(fieldKey => !focused.includes(fieldKey));
  const differing = unfocused.filter(fieldKey => !isSameEverywhere(fieldKey));
  const same = unfocused.filter(isSameEverywhere);
  const groups = [
    { title: 'What you asked for', fieldKeys: focused },
    { title: 'Where they differ', fieldKeys: differing },
    { title: `Same on all ${columns.length}`, fieldKeys: differencesOnly ? [] : same },
  ].filter(group => group.fieldKeys.length > 0);
  const limitations = recommendation.limitations
    .map(text => readableLimitation(text, evidence.items, schemaFields));

  return <section aria-label="Comparison" className="luna-compare">
    <div className="luna-landed-callout">
      <strong>Sticker prices can mislead.</strong>
      <span>Luna ranks and filters by the delivered total.</span>
      <small>Assumes listed shipping and shop voucher.</small>
    </div>
    <div className="luna-compare-tools">
      <label className="luna-toggle">
        <input type="checkbox" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)}/>
        Show only differences
      </label>
    </div>
    <div className="luna-table-scroll">
      <table className="luna-table" aria-label="Product comparison" style={{ minWidth: 130 + columns.length * 150 }}>
        <colgroup><col className="luna-col-label"/>{columns.map(item => <col key={item.item_key}/>)}</colgroup>
        <thead>
          <tr>
            <th scope="col" className="luna-corner"><span className="luna-muted">Tap a value to see its source</span></th>
            {columns.map(item => {
              const status = columnStatus(recommendation, item.item_key);
              const isTop = status?.tone === 'top';
              return <th key={item.item_key} scope="col"
                className={`luna-product${isTop ? ' is-top' : ''}${status?.tone === 'out' ? ' is-out' : ''}`}>
                {status && <span className={`luna-badge luna-badge-${status.tone}`}>{status.label}</span>}
                <span className="luna-product-title">{item.title}</span>
                <span className="luna-product-variant">{item.variant_label}</span>
                <span className="luna-product-list-price">
                  List <s>{money(item.price_minor, item.currency)}</s>
                </span>
                <span className="luna-product-price">
                  Delivered {money(item.landed_price_minor, item.currency)}
                </span>
                <span className="luna-product-actions">
                  <button type="button" className="luna-link"
                    onClick={() => onNavigateToListing(productSnapshot(evidence, item))}>
                    View product
                  </button>
                  {status?.tone === 'out' && <button type="button" className="luna-link"
                    onClick={() => onOpenSellerReport(item.listing_id)}>Seller view</button>}
                </span>
              </th>;
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => <Fragment key={group.title}>
            <tr className="luna-group"><th scope="colgroup" colSpan={columns.length + 1}>{group.title}</th></tr>
            {group.fieldKeys.map(fieldKey => {
              const label = fieldLabel(schemaFields, fieldKey);
              const hint = rowHint(preferences, currency, fieldKey);
              return <tr key={fieldKey}>
                <th scope="row" className="luna-row-label">
                  {label}{hint && <span className="luna-row-hint">{hint}</span>}
                </th>
                {columns.map((item, index) => {
                  const cell = cells.get(fieldKey)[index];
                  return <td key={item.item_key} className={item.item_key === recommendation.item_key ? 'is-top' : undefined}>
                    <button type="button" className={`luna-cell${cell.status === 'conflicting' ? ' is-conflict' : ''}`}
                      aria-label={`${label} for ${itemName(item)}: ${cellSpokenText(cell)}`}
                      onClick={() => onOpenCell({ itemKey: item.item_key, fieldKey })}>
                      <CellContent cell={cell}/>
                    </button>
                  </td>;
                })}
              </tr>;
            })}
          </Fragment>)}
          {differencesOnly && same.length > 0 && <tr className="luna-same">
            <th scope="row" className="luna-row-label">Same on all {columns.length}</th>
            <td colSpan={columns.length}>
              <div className="luna-same-list">
                {same.map(fieldKey => <button key={fieldKey} type="button" className="luna-pill"
                  onClick={() => onOpenCell({ itemKey: columns[0].item_key, fieldKey })}>
                  {fieldLabel(schemaFields, fieldKey)}: {cells.get(fieldKey)[0].text}
                </button>)}
              </div>
            </td>
          </tr>}
        </tbody>
      </table>
    </div>
    {limitations.length > 0 && <div className="luna-notes">
      <strong>Good to know</strong>
      <ul>{limitations.map(text => <li key={text}>{text}</li>)}</ul>
    </div>}
  </section>;
}
ComparisonTable.propTypes = {
  comparison: PropTypes.object.isRequired,
  onOpenCell: PropTypes.func.isRequired,
  onNavigateToListing: PropTypes.func.isRequired,
  onOpenSellerReport: PropTypes.func.isRequired,
};

// A cited ID points either at a listing fact (open that table cell) or at a quote
// that backs no fact, such as a review mention.
function resolveTarget(evidence, target) {
  if (!target.citationId) return target;
  const source = citationSource(evidence, target.citationId);
  if (source.kind === 'evidence') {
    const fact = evidence.facts_by_item[source.record.item_key]
      .find(candidate => candidate.evidence_ids.includes(target.citationId));
    if (fact) return { itemKey: source.record.item_key, fieldKey: fact.field_key };
  }
  return { itemKey: source.record.item_key, source };
}

function cellExplanation(cell, label) {
  const field = label.toLowerCase();
  if (cell.status === 'price') {
    return 'Luna uses this delivered total for price ranking and budget checks. It is calculated only from the listed components shown above.';
  }
  if (cell.status === 'supported') {
    return cell.fact.evidence_ids.length > 1
      ? `Found in ${cell.fact.evidence_ids.length} places in the listing.` : 'Read from the seller’s listing.';
  }
  if (cell.status === 'missing') {
    return `The listing doesn’t state ${field}, and Luna won’t guess it. Products missing a value you rank by show as “Can’t rank yet”.`;
  }
  if (cell.status === 'conflicting') {
    return `Luna won’t pick one, so ${field} isn’t used to rank this product. Check with the seller before you buy.`;
  }
  return `Luna couldn’t confirm ${field} from the listing, so it isn’t used to rank this product.`;
}

const CELL_STATUS = {
  price: ['ok', 'Listed checkout assumptions'],
  supported: ['ok', 'From the listing'],
  missing: ['none', 'Not stated'],
  conflicting: ['warn', 'Listing disagrees with itself'],
  unresolved: ['none', 'Couldn’t verify'],
};

export function SourcePanel({ comparison, target, onClose, onAsk }) {
  const titleId = useId();
  const closeButton = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButton.current.focus();
    return () => { if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus(); };
  }, []);

  const { evidence } = comparison;
  const resolved = resolveTarget(evidence, target);
  const item = evidence.items.find(candidate => candidate.item_key === resolved.itemKey);
  let title, subtitle, body, question;
  if (resolved.source) {
    const { kind, record } = resolved.source;
    title = itemName(item);
    subtitle = kind === 'review' ? 'Customer review' : sourceLabel(record.source_type);
    body = <>
      <div className="luna-quote">
        <p>“{kind === 'review' ? record.excerpt : record.source_text}”</p>
      </div>
      {kind === 'review' && <p className="luna-panel-explain">
        A {record.sentiment} review mention about {record.aspect.replaceAll('_', ' ')}.
      </p>}
    </>;
  } else {
    const label = fieldLabel(evidence.schema_fields, resolved.fieldKey);
    const cell = describeCell(evidence, item, resolved.fieldKey);
    const [tone, statusText] = CELL_STATUS[cell.status];
    const quotes = (cell.fact?.evidence_ids || []).map(id => citationSource(evidence, id).record);
    title = `${label} · ${item.title}`;
    subtitle = item.variant_label;
    question = `Tell me about the ${label.toLowerCase()} of ${itemName(item)}.`;
    body = <>
      <span className={`luna-status luna-status-${tone}`}>{statusText}</span>
      <p className={`luna-panel-value${cell.text && cell.status !== 'conflicting' ? '' : ' is-missing'}`}>
        {cell.status === 'conflicting' ? 'Unclear' : cell.text || 'No value'}
      </p>
      {cell.status === 'price' && <div className="luna-price-breakdown">
        <dl>
          <div><dt>List price</dt><dd>{money(item.price_minor, item.currency)}</dd></div>
          <div><dt>Shop voucher</dt><dd>− {money(item.shop_voucher_minor, item.currency)}</dd></div>
          <div><dt>Shipping</dt><dd>+ {money(item.shipping_minor, item.currency)}</dd></div>
          <div className="luna-price-total"><dt>Delivered total</dt><dd>{money(item.landed_price_minor, item.currency)}</dd></div>
        </dl>
        <p>Assumes listed shipping and shop voucher.</p>
      </div>}
      {cell.status === 'conflicting' && <p className="luna-panel-lead">The seller gives different values: {cell.text}.</p>}
      {quotes.map(record => <div key={record.id} className="luna-quote">
        <span className="luna-quote-from">{sourceLabel(record.source_type)}</span>
        <p>{highlightValue(record.source_text)}</p>
      </div>)}
      <p className="luna-panel-explain">{cellExplanation(cell, label)}</p>
    </>;
  }

  return <div className="luna-scrim" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="luna-panel"
      onClick={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <div className="luna-panel-head">
        <div>
          <h3 id={titleId}>{title}</h3>
          <span className="luna-panel-sub">{subtitle}</span>
        </div>
        <button ref={closeButton} type="button" className="luna-icon-button" aria-label="Close source details"
          onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div className="luna-panel-body">{body}</div>
      <div className="luna-panel-foot">
        {question && <button type="button" className="luna-button" onClick={() => onAsk(question)}>Ask Luna about this</button>}
        <button type="button" className="luna-button luna-button-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}
SourcePanel.propTypes = {
  comparison: PropTypes.object.isRequired,
  target: PropTypes.shape({
    itemKey: PropTypes.string,
    fieldKey: PropTypes.string,
    citationId: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onAsk: PropTypes.func.isRequired,
};

function citationText(evidence, citationId) {
  const { kind, record } = citationSource(evidence, citationId);
  const item = evidence.items.find(candidate => candidate.item_key === record.item_key);
  return kind === 'review'
    ? `${item.title} · review: “${record.excerpt}”`
    : `${item.title} · “${record.source_text}”`;
}

export function Conversation({ messages, busy, evidence, onOpenCitation }) {
  return <div role="log" aria-live="polite" aria-label="Conversation with Luna" className="luna-messages">
    {messages.map((message, index) => <div key={index} className={`luna-message is-${message.role}`}>
      <p><span className="luna-sr-only">{message.role === 'user' ? 'You' : 'Luna'}: </span>{message.text}</p>
      {message.citations?.length > 0 && <div className="luna-citations">
        <span className="luna-citations-label">Sources</span>
        {message.citations.map(citationId => {
          const text = citationText(evidence, citationId);
          return <button key={citationId} type="button" className="luna-citation" title={text}
            aria-label={`Source: ${text}`} onClick={() => onOpenCitation(citationId)}>{text}</button>;
        })}
      </div>}
    </div>)}
    {busy && <p className="luna-typing" role="status">Luna is working on it…</p>}
  </div>;
}
Conversation.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({
    role: PropTypes.oneOf(['user', 'assistant']).isRequired,
    text: PropTypes.string.isRequired,
    citations: PropTypes.arrayOf(PropTypes.string),
  })).isRequired,
  busy: PropTypes.bool.isRequired,
  evidence: PropTypes.object.isRequired,
  onOpenCitation: PropTypes.func.isRequired,
};
