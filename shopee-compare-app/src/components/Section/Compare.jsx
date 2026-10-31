import { useMemo, useState } from 'react';
import { LunaWidget } from '@luna/widget';
import { Link } from 'react-router-dom';
import { createShopeeLunaAdapter } from '../../lunaHostAdapter';

function Compare() {
    const [viewedProduct, setViewedProduct] = useState(null);
    const lunaAdapter = useMemo(() => createShopeeLunaAdapter(setViewedProduct), []);

    return (
        <main className="min-h-screen bg-gray-100 py-3 sm:py-6">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <header className="mb-3 flex flex-wrap items-center gap-3 rounded-sm bg-white p-4 shadow-sm">
                    <div>
                        <h1 className="text-xl font-medium text-shopee">Shopee Compare</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Choose 2–4 exact variants from Luna&apos;s backend catalog.
                        </p>
                    </div>
                    <Link to="/Cart" className="ml-auto text-sm text-shopee hover:text-shopee2">
                        &lt; Back to Cart
                    </Link>
                </header>
                {viewedProduct && (
                    <section aria-label="Host product view" className="mb-3 rounded-sm border border-orange-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-shopee">Host A product preview</p>
                                <h2 className="mt-1 text-xl font-semibold text-gray-900">{viewedProduct.title}</h2>
                                <p className="mt-2 text-sm text-gray-600">{viewedProduct.variantLabel}</p>
                                <p className="mt-1 text-lg font-semibold text-shopee">
                                    {viewedProduct.currency} {(viewedProduct.priceMinor / 100).toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Price source: trusted catalog variant {viewedProduct.listingId} · {viewedProduct.variantId}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewedProduct(null)}
                                className="ml-auto text-sm text-shopee hover:text-shopee2"
                            >
                                Close product view
                            </button>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                            {viewedProduct.synthetic
                                ? 'Synthetic demo listing from Luna’s trusted backend catalog; no Shopee product URL is claimed.'
                                : 'Canonical listing snapshot from Luna’s trusted backend catalog.'}
                        </p>
                        <ul aria-label="Product specifications" className="mt-4 grid gap-3 md:grid-cols-2">
                            {viewedProduct.specifications.map(specification => (
                                <li key={specification.fieldKey} className="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-sm font-medium text-gray-700">{specification.label}</span>
                                        <strong className={specification.status === 'conflicting' ? 'text-amber-700' : 'text-gray-900'}>
                                            {specification.value}
                                        </strong>
                                    </div>
                                    {specification.sources.length > 0 ? (
                                        <ul aria-label={`Sources for ${specification.label}`} className="mt-2 space-y-2">
                                            {specification.sources.map(source => (
                                                <li key={source.evidenceId} className="border-l-2 border-shopee pl-2 text-xs text-gray-600">
                                                    <span className="font-medium text-gray-700">{source.label}</span>
                                                    <q className="mt-1 block">{source.text}</q>
                                                    {source.location && <span className="mt-1 block font-mono text-[11px] text-gray-400">{source.location}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-2 text-xs text-gray-500">No verified seller source. Luna does not guess.</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                <LunaWidget adapter={lunaAdapter} apiBaseUrl="/api" />
            </div>
        </main>
    );
}

export default Compare;
