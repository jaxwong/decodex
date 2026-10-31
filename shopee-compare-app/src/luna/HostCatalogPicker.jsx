import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient';

// Host A selects canonical backend variants; no Shopee-to-synthetic substitution.
export default function HostCatalogPicker({ onCompare }) {
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const session = await lunaClient.createSession(controller.signal);
        const catalog = await lunaClient.getCatalog(session.token, controller.signal);
        if (!controller.signal.aborted) setListings(catalog.listings || []);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Could not load catalog');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);
  const toggle = (item) => {
    const key = `${item.listing_id}:${item.variant_id}`;
    setSelected(old => old.some(p => `${p.listing_id}:${p.variant_id}` === key)
      ? old.filter(p => `${p.listing_id}:${p.variant_id}` !== key)
      : old.length < 4 ? [...old, item] : old);
  };
  return <section className="bg-white border border-orange-200 rounded-lg p-4 my-4" aria-label="Luna demo catalog selection">
    <h2 className="font-semibold text-orange-700">Luna demo catalog — Host A</h2>
    <p className="text-xs text-gray-600 mb-3">Synthetic products supplied by the backend. This is separate from the existing Shopee cart.</p>
    {loading && <p role="status">Loading backend catalog…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid md:grid-cols-2 gap-2">
      {listings.map(listing => <div key={listing.listing_id} className="border rounded p-3">
        <p className="font-medium text-sm">{listing.title}</p>
        {listing.variants.map(variant => {
          const item = { listing_id: listing.listing_id, variant_id: variant.variant_id };
          const checked = selected.some(p => p.listing_id === item.listing_id && p.variant_id === item.variant_id);
          return <label key={variant.variant_id} className="flex gap-2 items-center text-xs py-1">
            <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 4} onChange={() => toggle(item)}/>
            {variant.label} · {variant.currency} {(variant.price_minor / 100).toFixed(2)}
          </label>;
        })}
      </div>)}
    </div>
    <button type="button" disabled={selected.length < 2 || selected.length > 4}
      className="mt-3 bg-orange-600 text-white rounded px-4 py-2 disabled:opacity-50"
      onClick={() => onCompare([...selected])}>Compare {selected.length} in Luna</button>
  </section>;
}
HostCatalogPicker.propTypes = { onCompare: PropTypes.func.isRequired };
