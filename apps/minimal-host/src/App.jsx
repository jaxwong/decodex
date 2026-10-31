import { useEffect, useMemo, useState } from 'react';
import { LunaWidget } from '@luna/widget';
import { createMinimalHostAdapter } from './minimalHostAdapter.js';

async function request(path, options) {
  const response = await fetch(path, options);
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(responseBody?.error?.message || `Minimal host API returned HTTP ${response.status}`);
  }
  return responseBody;
}

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [viewedProduct, setViewedProduct] = useState(null);
  const hostBridge = useMemo(() => createMinimalHostAdapter(setViewedProduct), []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      try {
        const session = await request('/api/demo-sessions', {
          method: 'POST',
          signal: controller.signal,
        });
        const catalogResponse = await request('/api/catalog', {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: controller.signal,
        });
        setCatalog(catalogResponse.listings);
      } catch (failure) {
        if (!controller.signal.aborted) setCatalogError(failure.message);
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, []);

  return <main>
    <header className="host-header">
      <p className="eyebrow">Independent Host B</p>
      <h1>Plain product shortlist</h1>
      <p>This host has its own layout, selection state, routing, and adapter.</p>
    </header>
    <section aria-label="Minimal host catalog" className="catalog">
      <h2>Host catalog</h2>
      {catalogError && <p role="alert">{catalogError}</p>}
      <div className="catalog-grid">
        {catalog.map(listing => <article key={listing.listing_id}>
          <h3>{listing.title}</h3>
          <p>{listing.preview}</p>
          {listing.variants.map(variant => <button type="button" key={variant.variant_id}
            onClick={() => hostBridge.select({
              listingId: listing.listing_id,
              variantId: variant.variant_id,
            })}>
            Select {variant.label} · {variant.currency} {(variant.price_minor / 100).toFixed(2)}
          </button>)}
        </article>)}
      </div>
    </section>
    {viewedProduct && <section aria-label="Host product view" className="product-view">
      <p className="eyebrow">Host B product preview</p>
      <h2>{viewedProduct.title}</h2>
      <p>{viewedProduct.variantLabel}</p>
      <p>{viewedProduct.currency} {(viewedProduct.priceMinor / 100).toFixed(2)}</p>
      <p>{viewedProduct.synthetic
        ? 'Synthetic demo listing from Luna’s trusted backend catalog.'
        : 'Canonical listing snapshot from Luna’s trusted backend catalog.'}</p>
      <button type="button" onClick={() => setViewedProduct(null)}>Close product view</button>
    </section>}
    <LunaWidget adapter={hostBridge.adapter} apiBaseUrl="/api" />
  </main>;
}
