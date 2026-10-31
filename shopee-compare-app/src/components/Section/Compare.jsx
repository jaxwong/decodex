import { useEffect, useMemo, useRef, useState } from 'react';
import { LunaWidget } from '@luna/widget';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createShopeeLunaAdapter } from '../../lunaHostAdapter';
import { useShop } from '../../shop';
import { ProductDetails } from './ProductPage';

function Compare() {
    const [viewedProduct, setViewedProduct] = useState(null);
    const navigate = useNavigate();
    const { cart } = useShop();
    // The adapter must not change with the cart or route helpers: a new adapter starts a new
    // Luna session and drops the comparison. Its callbacks read the latest values from here.
    const latest = useRef({ cart, navigate });
    latest.current = { cart, navigate };
    // The cart hands over its ticked catalog variants; opening #/Compare directly hands over none.
    const { state: routeState } = useLocation();
    const lunaAdapter = useMemo(
        () => createShopeeLunaAdapter(
            product => setViewedProduct({ listingId: product.listingId, variantId: product.variantId }),
            routeState?.cartSelections ?? [],
            ({ listingId, variantId }) => {
                const cartLine = latest.current.cart.find(line => line.id === `${listingId}:${variantId}`);
                latest.current.navigate('/Checkout', {
                    state: { items: [{ listingId, variantId, quantity: cartLine?.quantity ?? 1 }] },
                });
            },
        ),
        [routeState],
    );

    // The product page covers the comparison instead of replacing it, so closing it returns to
    // the same comparison without rebuilding it.
    useEffect(() => {
        if (!viewedProduct) return undefined;
        const closeOnEscape = event => {
            if (event.key === 'Escape') setViewedProduct(null);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [viewedProduct]);

    return (
        <main className="min-h-screen bg-gray-100 py-3 sm:py-6">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <header className="mb-3 flex flex-wrap items-center gap-3 rounded-sm bg-white p-4 shadow-sm">
                    <div>
                        <h1 className="text-xl font-medium text-shopee">Shopee Compare</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Luna lines your products up and shows where every value comes from.
                        </p>
                    </div>
                    <Link to="/Cart" className="ml-auto text-sm text-shopee hover:text-shopee2">
                        &lt; Back to Cart
                    </Link>
                </header>
                <LunaWidget adapter={lunaAdapter} apiBaseUrl="/api" />
            </div>
            {viewedProduct && (
                <div role="dialog" aria-modal="true" aria-label="Product page" className="fixed inset-0 z-[60] overflow-y-auto bg-gray-100">
                    <div className="sticky top-0 z-10 bg-white shadow-sm">
                        <div className="mx-auto flex max-w-[1200px] items-center px-2 py-3 sm:px-4">
                            <button
                                type="button"
                                onClick={() => setViewedProduct(null)}
                                className="text-sm text-shopee hover:text-shopee2"
                            >
                                &lt; Back to comparison
                            </button>
                        </div>
                    </div>
                    <div className="mx-auto max-w-[1200px] px-2 py-4 sm:px-4">
                        <ProductDetails
                            listingId={viewedProduct.listingId}
                            variantId={viewedProduct.variantId}
                            onVariantChange={variantId => setViewedProduct(current => ({ ...current, variantId }))}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}

export default Compare;
