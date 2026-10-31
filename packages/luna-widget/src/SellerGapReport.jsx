import PropTypes from 'prop-types';

const label = (value) => String(value).replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

export function SellerGapReport({ report, onClose, onOpenEvidence }) {
  const exclusionCounts = Object.entries(report.exclusion_counts);
  const uncertaintyCounts = Object.entries(report.uncertainty_counts);

  return <section aria-label="Demo seller view" className="border rounded-xl p-4 space-y-4">
    <div className="flex justify-between items-start gap-2">
      <div>
        <h3 className="font-semibold">Demo seller view</h3>
        <p className="text-xs text-gray-500">Listing {report.listing_id} · Comparisons in session: {report.comparisons_count}</p>
      </div>
      <button type="button" onClick={onClose} className="text-xs text-orange-700 underline">Close seller view</button>
    </div>
    <p className="text-xs bg-orange-50 border rounded p-3">
      Demo seller view. Counts cover comparisons in this demo session only.
    </p>

    <div>
      <h4 className="font-semibold text-sm mb-2">Evidence gaps</h4>
      {report.gaps.length === 0 && <p className="text-xs text-gray-500">No evidence gaps in this session.</p>}
      <div className="space-y-1">
        {report.gaps.map(gap => <div key={`${gap.item_key}:${gap.field_key}:${gap.status}`} className="border-b py-2 text-xs">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{label(gap.field_key)}</span>
            <span>{label(gap.status)}</span>
          </div>
          {gap.conflicting_values.length > 0 && <p className="text-gray-500 mt-1">
            Conflicting values: {gap.conflicting_values.join(' · ')}
          </p>}
          {gap.evidence_ids.length > 0 && <button type="button"
            onClick={() => onOpenEvidence(gap.evidence_ids)}
            className="text-orange-700 underline mt-1">
            Open evidence for {label(gap.field_key)}
          </button>}
        </div>)}
      </div>
    </div>

    <div>
      <h4 className="font-semibold text-sm mb-2">Beaten by</h4>
      {report.beaten_by.length === 0 && <p className="text-xs text-gray-500">No supported competitor advantage recorded.</p>}
      {report.beaten_by.map(entry => <p key={`${entry.item_key}:${entry.field_key}`} className="text-xs my-1">
        <strong>{label(entry.field_key)}:</strong> {entry.competitor_item_keys.join(' · ')}
      </p>)}
    </div>

    <div>
      <h4 className="font-semibold text-sm mb-2">Why buyers dropped you</h4>
      {exclusionCounts.length === 0 && uncertaintyCounts.length === 0
        && <p className="text-xs text-gray-500">No exclusions or evidence uncertainty recorded.</p>}
      {exclusionCounts.map(([reason, count]) => <p key={reason} className="text-xs my-1">
        {label(reason)}: {count}
      </p>)}
      {uncertaintyCounts.map(([fieldKey, count]) => <p key={fieldKey} className="text-xs my-1">
        Could not verify {label(fieldKey)}: {count}
      </p>)}
    </div>

    <p className="text-xs text-gray-500">Luna does not edit listings. Use the normal seller editor to correct source data.</p>
  </section>;
}

SellerGapReport.propTypes = {
  report: PropTypes.shape({
    listing_id: PropTypes.string.isRequired,
    comparisons_count: PropTypes.number.isRequired,
    gaps: PropTypes.arrayOf(PropTypes.shape({
      item_key: PropTypes.string.isRequired,
      field_key: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
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
  onClose: PropTypes.func.isRequired,
  onOpenEvidence: PropTypes.func.isRequired,
};
