import PropTypes from 'prop-types';
import { exclusionLabel, fieldLabel, itemName } from './display.js';

const STATUS_LABELS = { missing: 'Not stated', conflicting: 'Listing disagrees', unresolved: 'Couldn’t verify' };

export function SellerGapReport({ report, evidence, onClose, onOpenEvidence }) {
  const label = fieldKey => fieldLabel(evidence.schema_fields, fieldKey);
  const nameOf = itemKey => itemName(evidence.items.find(item => item.item_key === itemKey));
  const listing = evidence.items.find(item => item.listing_id === report.listing_id);
  const exclusionCounts = Object.entries(report.exclusion_counts);
  const uncertaintyCounts = Object.entries(report.uncertainty_counts);

  return <section aria-label="Demo seller view" className="luna-seller">
    <div className="luna-seller-head">
      <div>
        <h3>Demo seller view</h3>
        <p className="luna-muted">{listing.title} · Comparisons in session: {report.comparisons_count}</p>
      </div>
      <button type="button" onClick={onClose} className="luna-link">Close seller view</button>
    </div>
    <p className="luna-seller-banner">
      Demo seller view. Counts cover comparisons in this demo session only.
    </p>

    <div>
      <h4>Evidence gaps</h4>
      {report.gaps.length === 0 && <p className="luna-muted">No evidence gaps in this session.</p>}
      {report.gaps.map(gap => <div key={`${gap.item_key}:${gap.field_key}:${gap.status}`} className="luna-seller-row">
        <div className="luna-seller-row-head">
          <strong>{label(gap.field_key)}</strong>
          <span>{STATUS_LABELS[gap.status]}</span>
        </div>
        {gap.conflicting_values.length > 0 && <p className="luna-muted">
          Conflicting values: {gap.conflicting_values.join(' · ')}
        </p>}
        {gap.evidence_ids.length > 0 && <button type="button" className="luna-link" onClick={() => onOpenEvidence(gap)}>
          Open evidence for {label(gap.field_key)}
        </button>}
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
      {exclusionCounts.length === 0 && uncertaintyCounts.length === 0
        && <p className="luna-muted">No exclusions or evidence uncertainty recorded.</p>}
      {exclusionCounts.map(([reason, count]) => <p key={reason} className="luna-seller-row">
        {exclusionLabel(reason)}: {count}
      </p>)}
      {uncertaintyCounts.map(([fieldKey, count]) => <p key={fieldKey} className="luna-seller-row">
        Could not verify {label(fieldKey)}: {count}
      </p>)}
    </div>

    <p className="luna-muted">Luna does not edit listings. Use the normal seller editor to correct source data.</p>
  </section>;
}

SellerGapReport.propTypes = {
  report: PropTypes.shape({
    listing_id: PropTypes.string.isRequired,
    comparisons_count: PropTypes.number.isRequired,
    gaps: PropTypes.arrayOf(PropTypes.shape({
      item_key: PropTypes.string.isRequired,
      field_key: PropTypes.string.isRequired,
      status: PropTypes.oneOf(Object.keys(STATUS_LABELS)).isRequired,
      conflicting_values: PropTypes.arrayOf(PropTypes.string).isRequired,
      evidence_ids: PropTypes.arrayOf(PropTypes.string).isRequired,
    })).isRequired,
    beaten_by: PropTypes.arrayOf(PropTypes.shape({
      item_key: PropTypes.string.isRequired,
      field_key: PropTypes.string.isRequired,
      competitor_item_keys: PropTypes.arrayOf(PropTypes.string).isRequired,
    })).isRequired,
    exclusion_counts: PropTypes.objectOf(PropTypes.number).isRequired,
    uncertainty_counts: PropTypes.objectOf(PropTypes.number).isRequired,
  }).isRequired,
  evidence: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onOpenEvidence: PropTypes.func.isRequired,
};
