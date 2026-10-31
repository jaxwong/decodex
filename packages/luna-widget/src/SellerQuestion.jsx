import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { itemName } from './display.js';

const fieldWithUnit = field => (field.unit ? `${field.label} (${field.unit})` : field.label);

// Buyer side: confirm before anything reaches the seller. The server words the question.
export function SellerQuestionDialog({ item, field, busy, onSend, onCancel }) {
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
      <p className="luna-muted">Luna will ask the seller of {itemName(item)} for one value:</p>
      <p className="luna-confirm-question">{fieldWithUnit(field)}</p>
      <p className="luna-muted">
        Their answer comes back into this comparison as a cited source. Luna never guesses it for them.
      </p>
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
  item: PropTypes.object.isRequired,
  field: PropTypes.shape({
    field_key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    unit: PropTypes.string,
  }).isRequired,
  busy: PropTypes.bool.isRequired,
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

function QuestionCard({ question, field, variantName, busy, onAnswer }) {
  const [answer, setAnswer] = useState('');
  return <article aria-label={`Question about ${field.label}`} className="luna-inbox-item">
    <ul aria-label="Question details" className="luna-inbox-tags">
      <li>Model: {variantName}</li>
      <li>Field: {field.label}</li>
    </ul>
    <p className="luna-confirm-question">“{question.question}”</p>
    <form className="luna-inbox-form" onSubmit={event => { event.preventDefault(); onAnswer(question, answer); }}>
      <label>
        <span>{fieldWithUnit(field)}</span>
        <input value={answer} maxLength={40} required disabled={busy}
          onChange={event => setAnswer(event.target.value)}/>
      </label>
      <button type="submit" className="luna-button" disabled={busy || !answer.trim()}>Send answer</button>
    </form>
    <p className="luna-muted">
      Your answer is stored as listing text for this model. Buyers see it the next time Luna
      compares it.
    </p>
  </article>;
}
QuestionCard.propTypes = {
  question: PropTypes.shape({ question: PropTypes.string.isRequired }).isRequired,
  field: PropTypes.shape({ label: PropTypes.string.isRequired, unit: PropTypes.string }).isRequired,
  variantName: PropTypes.string.isRequired,
  busy: PropTypes.bool.isRequired,
  onAnswer: PropTypes.func.isRequired,
};

// Seller side: the listing's open buyer questions, each answered with one value.
export function SellerInbox({ questions, fieldFor, variantNameFor, lastAnswer, busy, onAnswer }) {
  return <section aria-label="Buyer questions" className="luna-seller-inbox">
    <h4>Buyer questions{questions.length > 0 ? ` (${questions.length})` : ''}</h4>
    {lastAnswer && <p role="status" className="luna-inbox-answered">
      Answered “{lastAnswer}”. Buyers see it in their next comparison.
    </p>}
    {questions.length === 0 && <p className="luna-muted">No open questions from buyers.</p>}
    {questions.map(question => <QuestionCard key={`${question.variant_id}:${question.field_key}`}
      question={question} field={fieldFor(question.field_key)}
      variantName={variantNameFor(question.variant_id)} busy={busy} onAnswer={onAnswer}/>)}
  </section>;
}
SellerInbox.propTypes = {
  questions: PropTypes.arrayOf(PropTypes.object).isRequired,
  fieldFor: PropTypes.func.isRequired,
  variantNameFor: PropTypes.func.isRequired,
  lastAnswer: PropTypes.string,
  busy: PropTypes.bool.isRequired,
  onAnswer: PropTypes.func.isRequired,
};
