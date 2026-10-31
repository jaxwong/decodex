import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient.js';
import { errorText, evidenceLabel, exclusionLabel, fieldLabel, itemName } from './display.js';
import { SparkleIcon } from './LunaPanels.jsx';

const STATUS_LABELS = { missing: 'Not stated', conflicting: 'Listing disagrees', unresolved: 'Couldn’t verify' };

function catalogItemName(listings, itemKey) {
  for (const listing of listings) {
    const variant = listing.variants.find(candidate => `${listing.listing_id}:${candidate.variant_id}` === itemKey);
    if (variant) return itemName({ title: listing.title, variant_label: variant.label });
  }
  throw new TypeError(`Seller report item ${itemKey} is not in the Luna catalog`);
}

// The seller side of Luna. It reads the server's counts across every buyer comparison and
// computes nothing itself: no counting, sorting or status reinterpretation.
export function SellerGapReport({ apiBaseUrl = '/api' }) {
  const [session, setSession] = useState(null);
  const [listings, setListings] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  function showError(failure) {
    console.error('Luna seller request failed', failure?.status, failure?.message, failure?.details);
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
        setSession(issued);
        setListings(result.listings || []);
      } catch (err) {
        if (!controller.signal.aborted) showError(err);
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    }
    initialize();
    return () => { controller.abort(); generation.current += 1; };
  }, [apiBaseUrl]);

  async function openReport(listingId) {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      try {
        setReport(await lunaClient.getListingGapReport(apiBaseUrl, session.token, listingId));
      } catch (err) {
        if (err?.status !== 401) throw err;
        // The API forgot this page's session (restart or one-hour expiry). The report is a
        // read, so asking once more with a new session is safe.
        console.warn('Luna API no longer knows this demo session (HTTP 401); starting a new one');
        const renewed = await lunaClient.createSession(apiBaseUrl);
        setSession(renewed);
        setReport(await lunaClient.getListingGapReport(apiBaseUrl, renewed.token, listingId));
      }
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  const listing = report && listings.find(candidate => candidate.listing_id === report.listing_id);
  const label = fieldKey => fieldLabel(report.schema_fields, fieldKey);
  const nameOf = itemKey => catalogItemName(listings, itemKey);

  return <section aria-label="Luna seller insights" className="luna-widget">
    <header className="luna-header">
      <span className="luna-brand"><SparkleIcon/>Luna</span>
      <h2 className="luna-title">Why buyers dropped your listing</h2>
      {listings.some(candidate => candidate.synthetic) && <span className="luna-demo-pill">Demo data</span>}
    </header>
    <p className="luna-seller-banner">
      Demo seller view. There is no seller login, so every listing is open. Counts cover buyer
      comparisons from sessions started in the last hour on this demo server; restarting the server
      clears them.
    </p>

    {error && <div role="alert" className="luna-alert"><span>{error}</span></div>}

    <div className="luna-seller-layout">
      <nav aria-label="Your listings" className="luna-seller-listings">
        <h3 className="luna-section-title">Your listings</h3>
        {listings.map(candidate => <button key={candidate.listing_id} type="button"
          className="luna-seller-listing" aria-pressed={report?.listing_id === candidate.listing_id}
          disabled={busy || !session} onClick={() => openReport(candidate.listing_id)}>
          {candidate.title}
        </button>)}
      </nav>

      {!report && <p className="luna-muted">Choose a listing to see what buyers comparing it ran into.</p>}
      {report && <section aria-label="Seller report" className="luna-seller">
        <div>
          <h3>{listing.title}</h3>
          <p className="luna-muted">
            In {report.comparisons_count} buyer comparison{report.comparisons_count === 1 ? '' : 's'}
          </p>
        </div>

        <div>
          <h4>Evidence gaps</h4>
          {report.gaps.length === 0 && <p className="luna-muted">No evidence gaps found.</p>}
          {report.gaps.map(gap => <div key={JSON.stringify(gap)} className="luna-seller-row">
            <div className="luna-seller-row-head">
              <strong>{label(gap.field_key)}</strong>
              <span>{STATUS_LABELS[gap.status]}</span>
            </div>
            <p className="luna-muted">{nameOf(gap.item_key)}</p>
            {gap.conflicting_values.length > 0 && <p className="luna-muted">
              Conflicting values: {gap.conflicting_values.join(' · ')}
            </p>}
            {gap.evidence.length > 0 && <ul aria-label={`Your listing text for ${label(gap.field_key)}`} className="luna-seller-sources">
              {gap.evidence.map(source => <li key={source.id}>
                <span className="luna-muted">{evidenceLabel(source)}:</span> “{source.source_text}”
              </li>)}
            </ul>}
          </div>)}
        </div>

        <div>
          <h4>Beaten by</h4>
          {report.beaten_by.length === 0 && <p className="luna-muted">No supported competitor advantage recorded.</p>}
          {report.beaten_by.map(entry => <p key={`${entry.item_key}:${entry.field_key}`} className="luna-seller-row">
            <strong>{label(entry.field_key)}:</strong> {entry.competitor_item_keys.map(nameOf).join(' · ')}
          </p>)}
        </div>

        <div>
          <h4>Why buyers dropped you</h4>
          {Object.keys(report.exclusion_counts).length === 0 && Object.keys(report.uncertainty_counts).length === 0
            && <p className="luna-muted">No exclusions or evidence uncertainty recorded.</p>}
          {Object.entries(report.exclusion_counts).map(([reason, count]) => <p key={reason} className="luna-seller-row">
            {exclusionLabel(reason)}: {count}
          </p>)}
          {Object.entries(report.uncertainty_counts).map(([fieldKey, count]) => <p key={fieldKey} className="luna-seller-row">
            Could not verify {label(fieldKey)}: {count}
          </p>)}
        </div>

        <p className="luna-muted">Luna does not edit listings. Use the normal seller editor to correct source data.</p>
      </section>}
    </div>
  </section>;
}

SellerGapReport.propTypes = {
  apiBaseUrl: PropTypes.string,
};
