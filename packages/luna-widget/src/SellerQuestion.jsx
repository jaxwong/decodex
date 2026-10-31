import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { itemName } from './display.js';

// The buyer confirms the exact server-drafted question before anything reaches the seller.
export function SellerQuestionDialog({ draft, busy, onSend, onCancel }) {
  const titleId = useId();
  const sendButton = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    sendButton.current.focus();
    return () => { if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus(); };
  }, []);

  return <div className="luna-scrim luna-scrim-center" onClick={onCancel}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="luna-confirm"
      onClick={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') onCancel(); }}>
      <h3 id={titleId}>Ask the seller</h3>
      <p className="luna-muted">Luna will send this question to the seller of {itemName(draft.item)}:</p>
      <p className="luna-confirm-question">“{draft.question}”</p>
      <div className="luna-panel-foot">
        <button ref={sendButton} type="button" className="luna-button" disabled={busy} onClick={onSend}>
          Send to seller
        </button>
        <button type="button" className="luna-button luna-button-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  </div>;
}
SellerQuestionDialog.propTypes = {
  draft: PropTypes.shape({
    question: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
  }).isRequired,
  busy: PropTypes.bool.isRequired,
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// A labelled mock of the seller's side: one question, one blank. Nothing here is Seller Centre.
export function SimulatedSellerInbox({ draft, field, busy, onAnswer, onBack }) {
  const [answer, setAnswer] = useState('');
  const answerLabel = field.unit ? `${field.label} (${field.unit})` : field.label;
  return <section aria-label="Simulated seller inbox" className="luna-seller-inbox">
    <p role="note" className="luna-simulated-banner">
      <strong>Simulated seller.</strong> In production this is Seller Centre chat.
    </p>
    <h3 className="luna-section-title">Seller inbox · 1 buyer question</h3>
    <article className="luna-inbox-item">
      <ul aria-label="Question details" className="luna-inbox-tags">
        <li>Listing: {draft.item.title}</li>
        <li>Variant: {draft.item.variant_label}</li>
        <li>Field: {field.label}</li>
      </ul>
      <p className="luna-confirm-question">“{draft.question}”</p>
      <form className="luna-inbox-form" onSubmit={event => { event.preventDefault(); onAnswer(answer); }}>
        <label>
          <span>{answerLabel}</span>
          <input value={answer} maxLength={40} required disabled={busy}
            onChange={event => setAnswer(event.target.value)}/>
        </label>
        <button type="submit" className="luna-button" disabled={busy || !answer.trim()}>Send answer</button>
      </form>
      <p className="luna-muted">
        The answer is stored as listing text for {itemName(draft.item)}. Buyers see it once their
        comparison is rebuilt.
      </p>
    </article>
    <button type="button" className="luna-link" onClick={onBack}>Back to comparison</button>
  </section>;
}
SimulatedSellerInbox.propTypes = {
  draft: PropTypes.shape({
    question: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
  }).isRequired,
  field: PropTypes.shape({
    label: PropTypes.string.isRequired,
    unit: PropTypes.string,
  }).isRequired,
  busy: PropTypes.bool.isRequired,
  onAnswer: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
