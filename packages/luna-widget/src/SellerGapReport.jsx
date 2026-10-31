import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient.js';
import { errorText, evidenceLabel, exclusionLabel, fieldLabel, itemName } from './display.js';
import { SparkleIcon } from './LunaPanels.jsx';
import { SellerInbox } from './SellerQuestion.jsx';

const STATUS_LABELS = { missing: 'Not stated', conflicting: 'Listing disagrees', unresolved: 'Couldn’t read' };
const EXCLUSION_HINTS = {
  over_budget: 'The buyer’s budget was below this listing’s delivered price (list price − voucher + shipping).',
  below_min_output: 'The buyer needed more output power than this listing states.',
};

// Why one buyer picked a competitor, in the seller's terms. The server attributed the pick
// to the first stated need the competitor won on; "no stated reason" is reported, never guessed.
function lostPickText(entry, label, nameOf, variantLabelOf) {
  const buyers = `${entry.count} buyer${entry.count === 1 ? '' : 's'} picked ${nameOf(entry.competitor_item_key)}`;
  const model = `your ${variantLabelOf(entry.item_key)} model`;
  switch (entry.reason) {
    case 'over_budget': return `${buyers} because your delivered price was over their budget`;
    case 'below_min_output': return `${buyers} because ${model} states less output than they needed`;
    case 'not_stated': return `${buyers} because they ranked by ${label(entry.field_key)} and ${model} doesn’t state it`;
    case 'beaten_on': return `${buyers} because they ranked by ${label(entry.field_key)} and it beat ${model} on it`;
    case 'no_stated_reason': return `${buyers} with no stated reason`;
    default: throw new TypeError(`Unknown pick reason ${entry.reason}`);
  }
}

function variantOf(listings, itemKey) {
  for (const listing of listings) {
    const variant = listing.variants.find(candidate => `${listing.listing_id}:${candidate.variant_id}` === itemKey);
    if (variant) return { listing, variant };
  }
  throw new TypeError(`Seller report item ${itemKey} is not in the Luna catalog`);
}

// What the seller can do about one gap, in the listing's own terms. No value is suggested.
function gapAdvice(gap, label, variantLabel) {
  if (gap.status === 'missing') {
    return `Add a “${label}” line to the ${variantLabel} model’s specifications. Until then, buyers who rank by ${label.toLowerCase()} see “Can’t rank yet” for it.`;
  }
  if (gap.status === 'conflicting') {
    return `Your listing gives ${gap.conflicting_values.join(' and ')}. Make the specifications and description agree; Luna won’t pick one for you.`;
  }
  return `Luna couldn’t read one clear value. Restate it as “${label}: value with unit”.`;
}

// The seller side of Luna. It reads the server's counts across every buyer comparison and
// computes nothing itself: no counting, sorting or status reinterpretation.
export function SellerGapReport({ apiBaseUrl = '/api' }) {
  const [session, setSession] = useState(null);
  const [listings, setListings] = useState([]);
  const [report, setReport] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lastAnswer, setLastAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  function showError(failure) {
    console.error('Luna seller request failed', failure?.status, failure?.message, failure?.details);
    setError(errorText(failure));
  }

  // The API forgot this page's session (restart or one-hour expiry). Reads are safe to repeat
  // once with a new session; a reply is repeated once too because the server rejected the first
  // attempt before storing anything.
  async function withSession(call) {
    try {
      return await call(session);
    } catch (err) {
      if (err?.status !== 401) throw err;
      console.warn('Luna API no longer knows this demo session (HTTP 401); starting a new one');
      const renewed = await lunaClient.createSession(apiBaseUrl);
      setSession(renewed);
      return call(renewed);
    }
  }

  async function loadListing(listingId, activeSession = session) {
    const [nextReport, inbox] = await Promise.all([
      lunaClient.getListingGapReport(apiBaseUrl, activeSession.token, listingId),
      lunaClient.getSellerQuestions(apiBaseUrl, activeSession.token, listingId),
    ]);
    setReport(nextReport);
    setQuestions(inbox.questions);
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
        setSession(issued);
        setListings(result.listings || []);
        // A seller lands on their first listing, not on an empty page.
        if (result.listings?.length > 0) await loadListing(result.listings[0].listing_id, issued);
      } catch (err) {
        if (!controller.signal.aborted) showError(err);
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    }
    initialize();
    return () => { controller.abort(); generation.current += 1; };
    // loadListing reads only its arguments and setters; the effect runs once per API base.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  async function openListing(listingId) {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    setLastAnswer('');
    try { await withSession(active => loadListing(listingId, active)); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  async function answerQuestion(question, answer) {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    setLastAnswer('');
    try {
      const reply = await withSession(active => lunaClient.sendSellerReply(
        apiBaseUrl, active.token, question.listing_id, question.variant_id, question.field_key, answer,
      ));
      setLastAnswer(reply.text);
      await withSession(active => loadListing(question.listing_id, active));
    } catch (err) {
      showError(err);
      // Someone else answered this field first, so the question is already closed: show that.
      if (err?.status === 409) {
        try { await withSession(active => loadListing(question.listing_id, active)); }
        catch (reloadFailure) { showError(reloadFailure); }
      }
    } finally { setBusy(false); }
  }

  const listing = report && listings.find(candidate => candidate.listing_id === report.listing_id);
  const label = fieldKey => fieldLabel(report.schema_fields, fieldKey);
  const fieldFor = fieldKey => report.schema_fields.find(field => field.field_key === fieldKey);
  const nameOf = itemKey => {
    const { listing: owner, variant } = variantOf(listings, itemKey);
    return itemName({ title: owner.title, variant_label: variant.label });
  };
  const variantLabelOf = itemKey => variantOf(listings, itemKey).variant.label;
  const hasComparisons = report?.comparisons_count > 0;
  const comparisonsText = count => `In ${count} buyer comparison${count === 1 ? '' : 's'}`;

  return <section aria-label="Luna seller insights" className="luna-widget">
    <header className="luna-header">
      <span className="luna-brand"><SparkleIcon/>Luna</span>
      <h2 className="luna-title">Listing insights</h2>
      {listings.some(candidate => candidate.synthetic) && <span className="luna-demo-pill">Demo data</span>}
    </header>
    <p className="luna-seller-banner">
      Demo seller view. There is no seller login, so every listing is open and anyone can answer
      buyers. Counts cover buyer comparisons on this demo server in the last hour.
    </p>

    {error && <div role="alert" className="luna-alert"><span>{error}</span></div>}

    <div className="luna-seller-layout">
      <nav aria-label="Your listings" className="luna-seller-listings">
        <h3 className="luna-section-title">Your listings</h3>
        {listings.map(candidate => <button key={candidate.listing_id} type="button"
          className="luna-seller-listing" aria-pressed={report?.listing_id === candidate.listing_id}
          disabled={busy || !session} onClick={() => openListing(candidate.listing_id)}>
          {candidate.image_url && <img src={candidate.image_url} alt=""/>}
          <span>{candidate.title}</span>
        </button>)}
      </nav>

      {!report && !error && <p className="luna-muted">Loading your listings…</p>}
      {report && <section aria-label="Seller report" className="luna-seller">
        <div className="luna-seller-head">
          {listing.image_url && <img src={listing.image_url} alt=""/>}
          <div>
            <h3>{listing.title}</h3>
            <p className="luna-muted">{comparisonsText(report.comparisons_count)}</p>
            {hasComparisons && <p className="luna-muted">Picked over competitors: {report.picked_count}</p>}
          </div>
        </div>

        <SellerInbox questions={questions} fieldFor={fieldFor} busy={busy} lastAnswer={lastAnswer}
          variantNameFor={variantId => variantLabelOf(`${report.listing_id}:${variantId}`)}
          onAnswer={answerQuestion}/>

        {!hasComparisons && <p className="luna-muted">
          No buyer has compared this listing in the last hour, so there is nothing to report yet.
          Compare it as a buyer and come back.
        </p>}

        {hasComparisons && <>
          <div>
            <h4>What buyers couldn’t see</h4>
            {report.gaps.length === 0 && <p className="luna-muted">Every compared value was stated clearly. Nothing to fix.</p>}
            {report.gaps.map(gap => <div key={JSON.stringify(gap)} className="luna-seller-row">
              <div className="luna-seller-row-head">
                <strong>{label(gap.field_key)}</strong>
                <span className={`luna-status luna-status-${gap.status === 'conflicting' ? 'warn' : 'none'}`}>
                  {STATUS_LABELS[gap.status]}
                </span>
              </div>
              <p className="luna-muted">{nameOf(gap.item_key)}</p>
              <p className="luna-seller-fix">{gapAdvice(gap, label(gap.field_key), variantLabelOf(gap.item_key))}</p>
              {gap.evidence.length > 0 && <ul aria-label={`Your listing text for ${label(gap.field_key)}`} className="luna-seller-sources">
                {gap.evidence.map(source => <li key={source.id}>
                  <span className="luna-muted">{evidenceLabel(source)}:</span> “{source.source_text}”
                </li>)}
              </ul>}
            </div>)}
          </div>

          {report.beaten_by.length > 0 && <div>
            <h4>Competitors state what you don’t</h4>
            <p className="luna-muted">In the same comparisons, these listings gave buyers a value where yours had a gap.</p>
            {report.beaten_by.map(entry => <div key={`${entry.item_key}:${entry.field_key}`} className="luna-seller-row">
              <strong>{label(entry.field_key)}</strong>
              <ul aria-label={`Competitors stating ${label(entry.field_key)}`} className="luna-seller-chips">
                {entry.competitor_item_keys.map(nameOf).map(name => <li key={name}>{name}</li>)}
              </ul>
            </div>)}
          </div>}

          <div>
            <h4>Why buyers dropped you</h4>
            {Object.keys(report.exclusion_counts).length === 0 && Object.keys(report.uncertainty_counts).length === 0
              && report.lost_picks.length === 0
              && <p className="luna-muted">No buyer excluded this listing, nothing was too unclear to rank, and no buyer picked a competitor over it.</p>}
            {report.lost_picks.map(entry => <div key={`${entry.item_key}:${entry.competitor_item_key}:${entry.reason}:${entry.field_key}`} className="luna-seller-row">
              <div className="luna-seller-row-head">
                <strong>Lost a pick</strong>
                <span>{entry.count} buyer{entry.count === 1 ? '' : 's'}</span>
              </div>
              <p className="luna-muted">{nameOf(entry.item_key)}</p>
              <p className="luna-seller-fix">{lostPickText(entry, label, nameOf, variantLabelOf)}</p>
            </div>)}
            {Object.entries(report.exclusion_counts).map(([reason, count]) => <div key={reason} className="luna-seller-row">
              <div className="luna-seller-row-head">
                <strong>{exclusionLabel(reason)}</strong>
                <span>{count} buyer{count === 1 ? '' : 's'}</span>
              </div>
              <p className="luna-seller-fix">{EXCLUSION_HINTS[reason]}</p>
            </div>)}
            {Object.entries(report.uncertainty_counts).map(([fieldKey, count]) => <div key={fieldKey} className="luna-seller-row">
              <div className="luna-seller-row-head">
                <strong>Couldn’t rank on {label(fieldKey)}</strong>
                <span>{count} buyer{count === 1 ? '' : 's'}</span>
              </div>
              <p className="luna-seller-fix">
                These buyers ranked by {label(fieldKey).toLowerCase()}, which this listing doesn’t state clearly.
              </p>
            </div>)}
          </div>
        </>}

        <p className="luna-muted">Luna doesn’t edit listings. Fix the listing text and the next buyer comparison reads it.</p>
      </section>}
    </div>
  </section>;
}

SellerGapReport.propTypes = {
  apiBaseUrl: PropTypes.string,
};
