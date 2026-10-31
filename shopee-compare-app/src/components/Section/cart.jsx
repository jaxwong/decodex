import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const formatPrice = value => `${value.toLocaleString('vi-VN')}₫`;
const formatMinor = (minor, currency) => `${currency} ${(minor / 100).toFixed(2)}`;

// Demo cart contents. Each row is an exact variant in Luna's backend catalog, which owns its
// title and price, so Compare now can hand the ticked rows to Luna unchanged.
const cartItem = (listingId, variantId) => ({ id: `${listingId}:${variantId}`, listingId, variantId, quantity: 1 });
const initialCartItems = [
    cartItem('listingA', '100w'),
    cartItem('listingB', '65w'),
    cartItem('listingC', '87w'),
];

async function request(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) throw new Error(`Luna API ${path} returned HTTP ${response.status}`);
    return response.json();
}

const suggestedProducts = [
    { id: 101, title: 'USB-C Fast Charging Cable 2M', image: 'images/categories/2.png', price: 79000, sold: '45.6k' },
    { id: 102, title: 'Laptop Stand Aluminum Adjustable', image: 'images/categories/17.png', price: 349000, sold: '8.9k' },
    { id: 103, title: 'Wireless Mouse Rechargeable Silent', image: 'images/categories/17.png', price: 199000, sold: '23.4k' },
];

function Cart() {
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState(initialCartItems);
    const [selectedItemIds, setSelectedItemIds] = useState(
        () => new Set(initialCartItems.map(item => item.id)),
    );
    const [catalog, setCatalog] = useState(null);
    const [catalogError, setCatalogError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        async function loadCatalog() {
            try {
                const session = await request('/api/demo-sessions', { method: 'POST', signal: controller.signal });
                const { listings } = await request('/api/catalog', {
                    headers: { Authorization: `Bearer ${session.token}` },
                    signal: controller.signal,
                });
                const variants = new Map(listings.flatMap(listing => listing.variants.map(variant =>
                    [`${listing.listing_id}:${variant.variant_id}`, { listing, variant }])));
                const missingIds = initialCartItems.map(item => item.id).filter(id => !variants.has(id));
                if (missingIds.length > 0) {
                    throw new Error(`Cart products ${missingIds.join(', ')} are not in Luna's catalog`);
                }
                // The cart total adds prices together, which is only meaningful in one currency.
                const currencies = new Set(initialCartItems.map(item => variants.get(item.id).variant.currency));
                if (currencies.size !== 1) {
                    throw new Error(`Cart products must share one currency, got ${[...currencies].join(', ')}`);
                }
                setCatalog({ variants, currency: [...currencies][0] });
            } catch (failure) {
                if (!controller.signal.aborted) setCatalogError(failure.message);
            }
        }
        loadCatalog();
        return () => controller.abort();
    }, []);

    const selectedItems = cartItems.filter(item => selectedItemIds.has(item.id));
    const subtotal = catalog && selectedItems.reduce(
        (total, item) => total + catalog.variants.get(item.id).variant.price_minor * item.quantity,
        0,
    );
    const selectedQuantity = selectedItems.reduce(
        (total, item) => total + item.quantity,
        0,
    );

    const toggleItem = itemId => {
        setSelectedItemIds(current => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const toggleAll = () => {
        const allSelected = cartItems.length > 0 && selectedItemIds.size === cartItems.length;
        setSelectedItemIds(allSelected ? new Set() : new Set(cartItems.map(item => item.id)));
    };

    const updateQuantity = (itemId, change) => {
        setCartItems(current => current.map(item => (
            item.id === itemId
                ? { ...item, quantity: Math.max(1, item.quantity + change) }
                : item
        )));
    };

    const removeItem = itemId => {
        setCartItems(current => current.filter(item => item.id !== itemId));
        setSelectedItemIds(current => {
            const next = new Set(current);
            next.delete(itemId);
            return next;
        });
    };

    return (
        <main className="min-h-screen bg-gray-100 py-3 sm:py-6">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <section className="mb-3 rounded-sm bg-white shadow-sm">
                    <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
                        <h1 className="text-xl font-medium text-shopee">Shopping Cart</h1>
                        <span className="text-sm text-gray-400">({cartItems.length} items)</span>
                        <div className="ml-auto text-right">
                            <p className="text-sm font-medium text-gray-700">Compare products with Luna</p>
                            <p className="text-xs text-gray-500">
                                Tick 2–4 products, then compare them side by side.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/Compare', {
                                state: {
                                    cartSelections: selectedItems.map(({ listingId, variantId }) => ({ listingId, variantId })),
                                },
                            })}
                            className="rounded-sm bg-shopee px-5 py-2 text-sm font-medium text-white hover:bg-shopee2"
                        >
                            Compare now
                        </button>
                    </header>
                    <p className="px-4 py-3 text-xs text-gray-500">
                        Cart products come from Luna&apos;s verified backend catalog.
                    </p>
                </section>

                <section aria-label="Cart products" className="space-y-3">
                    {catalogError && (
                        <p role="alert" className="rounded-sm bg-white p-4 text-sm text-red-600 shadow-sm">
                            Couldn&apos;t load your cart: {catalogError}
                        </p>
                    )}
                    {!catalog && !catalogError && (
                        <p className="rounded-sm bg-white p-4 text-sm text-gray-500 shadow-sm">Loading your cart…</p>
                    )}
                    {catalog && cartItems.map(item => {
                        const { listing, variant } = catalog.variants.get(item.id);
                        const name = `${listing.title} ${variant.label}`;
                        return (
                            <article key={item.id} className="grid gap-4 rounded-sm bg-white p-4 shadow-sm md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center">
                                <input
                                    type="checkbox"
                                    aria-label={`Select ${name}`}
                                    checked={selectedItemIds.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                    className="h-4 w-4 accent-shopee"
                                />
                                <div className="flex min-w-0 gap-3">
                                    {listing.image_url ? (
                                        <img
                                            src={listing.image_url}
                                            alt=""
                                            className="h-20 w-20 flex-shrink-0 rounded bg-gray-50 object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded bg-gray-50 text-[10px] text-gray-400">
                                            No image
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h2 className="text-sm text-gray-800">{listing.title}</h2>
                                        <p className="mt-1 text-xs text-gray-400">Variation: {variant.label}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-800">{formatMinor(variant.price_minor, variant.currency)}</div>
                                <div className="flex w-fit items-center border border-gray-300">
                                    <button
                                        type="button"
                                        aria-label={`Decrease ${name} quantity`}
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                    >
                                        −
                                    </button>
                                    <span className="w-10 border-x border-gray-300 py-1 text-center text-sm">{item.quantity}</span>
                                    <button
                                        type="button"
                                        aria-label={`Increase ${name} quantity`}
                                        onClick={() => updateQuantity(item.id, 1)}
                                        className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="flex items-center justify-between gap-4 md:block md:text-right">
                                    <p className="font-medium text-shopee">{formatMinor(variant.price_minor * item.quantity, variant.currency)}</p>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="mt-1 text-xs text-gray-500 hover:text-shopee"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                    {cartItems.length === 0 && (
                        <div className="rounded-sm bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
                            Your cart is empty.
                        </div>
                    )}
                </section>

                <section className="mt-3 rounded-sm bg-white shadow-sm">
                    <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">You May Also Like</h2>
                    <div className="flex gap-3 overflow-x-auto p-4">
                        {suggestedProducts.map(product => (
                            <Link key={product.id} to="/" className="w-[150px] flex-shrink-0 border border-gray-100 p-2 hover:shadow-lg">
                                <img src={product.image} alt="" className="aspect-square w-full bg-gray-50 object-contain" />
                                <p className="mt-2 line-clamp-2 text-xs text-gray-800">{product.title}</p>
                                <p className="mt-1 font-bold text-shopee">{formatPrice(product.price)}</p>
                                <p className="text-[10px] text-gray-400">{product.sold} sold</p>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-4 border-t-2 border-shopee bg-white p-4 shadow-lg">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={cartItems.length > 0 && selectedItemIds.size === cartItems.length}
                            onChange={toggleAll}
                            className="h-4 w-4 accent-shopee"
                        />
                        Select All ({cartItems.length})
                    </label>
                    <div className="ml-auto text-right">
                        <p className="text-sm text-gray-600">
                            Total ({selectedQuantity} items): <span className="text-xl font-bold text-shopee">{catalog ? formatMinor(subtotal, catalog.currency) : '—'}</span>
                        </p>
                    </div>
                    <Link
                        to={selectedItemIds.size > 0 ? '/Checkout' : '#'}
                        aria-disabled={selectedItemIds.size === 0}
                        className={`px-8 py-3 text-sm font-medium uppercase ${selectedItemIds.size > 0 ? 'bg-shopee text-white hover:bg-shopee2' : 'pointer-events-none bg-gray-300 text-gray-500'}`}
                    >
                        Check Out
                    </Link>
                </section>
            </div>
        </main>
    );
}

export default Cart;
