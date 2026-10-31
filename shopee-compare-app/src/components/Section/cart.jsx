import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money, useShop } from '../../shop';

function Cart() {
    const navigate = useNavigate();
    const { cart, variants, catalogError, updateQuantity, removeFromCart } = useShop();
    const [selectedItemIds, setSelectedItemIds] = useState(() => new Set(cart.map(line => line.id)));

    const missingIds = variants ? cart.map(line => line.id).filter(id => !variants.has(id)) : [];
    // The cart total adds prices together, which is only meaningful in one currency.
    const currencies = variants && missingIds.length === 0
        ? new Set(cart.map(line => variants.get(line.id).variant.currency)) : new Set();
    const cartError = catalogError
        || (missingIds.length > 0 && `Cart products ${missingIds.join(', ')} are not in Luna's catalog`)
        || (currencies.size > 1 && `Cart products must share one currency, got ${[...currencies].join(', ')}`);
    const ready = variants && !cartError;

    const selectedItems = cart.filter(line => selectedItemIds.has(line.id));
    const subtotal = ready && selectedItems.reduce(
        (total, line) => total + variants.get(line.id).variant.price_minor * line.quantity,
        0,
    );
    const selectedQuantity = selectedItems.reduce((total, line) => total + line.quantity, 0);

    const toggleItem = itemId => {
        setSelectedItemIds(current => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const toggleAll = () => {
        const allSelected = cart.length > 0 && selectedItemIds.size === cart.length;
        setSelectedItemIds(allSelected ? new Set() : new Set(cart.map(line => line.id)));
    };

    const removeItem = itemId => {
        removeFromCart([itemId]);
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
                    <header className="flex flex-wrap items-center gap-3 p-4">
                        <h1 className="text-xl font-medium text-shopee">Shopping Cart</h1>
                        <span className="text-sm text-gray-400">({cart.length} items)</span>
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
                </section>

                <section aria-label="Cart products" className="space-y-3">
                    {cartError && (
                        <p role="alert" className="rounded-sm bg-white p-4 text-sm text-red-600 shadow-sm">
                            Couldn&apos;t load your cart: {cartError}
                        </p>
                    )}
                    {!variants && !cartError && (
                        <p className="rounded-sm bg-white p-4 text-sm text-gray-500 shadow-sm">Loading your cart…</p>
                    )}
                    {ready && cart.map(line => {
                        const { listing, variant } = variants.get(line.id);
                        const name = `${listing.title} ${variant.label}`;
                        return (
                            <article key={line.id} className="grid gap-4 rounded-sm bg-white p-4 shadow-sm md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center">
                                <input
                                    type="checkbox"
                                    aria-label={`Select ${name}`}
                                    checked={selectedItemIds.has(line.id)}
                                    onChange={() => toggleItem(line.id)}
                                    className="h-4 w-4 accent-shopee"
                                />
                                <Link to={`/Product/${line.listingId}?variant=${line.variantId}`} className="group flex min-w-0 gap-3">
                                    {listing.image_url ? (
                                        <img
                                            src={listing.image_url}
                                            alt=""
                                            className="h-20 w-20 flex-shrink-0 border border-gray-100 bg-gray-50 object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center bg-gray-50 text-[10px] text-gray-400">
                                            No image
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h2 className="text-sm text-gray-800 group-hover:text-shopee">{listing.title}</h2>
                                        <p className="mt-1 text-xs text-gray-400">Variation: {variant.label}</p>
                                    </div>
                                </Link>
                                <div className="text-sm text-gray-800">{money(variant.price_minor, variant.currency)}</div>
                                <div className="flex w-fit items-center border border-gray-300">
                                    <button
                                        type="button"
                                        aria-label={`Decrease ${name} quantity`}
                                        onClick={() => updateQuantity(line.id, -1)}
                                        className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                    >
                                        −
                                    </button>
                                    <span className="w-10 border-x border-gray-300 py-1 text-center text-sm">{line.quantity}</span>
                                    <button
                                        type="button"
                                        aria-label={`Increase ${name} quantity`}
                                        onClick={() => updateQuantity(line.id, 1)}
                                        className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="flex items-center justify-between gap-4 md:block md:text-right">
                                    <p className="font-medium text-shopee">{money(variant.price_minor * line.quantity, variant.currency)}</p>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(line.id)}
                                        className="mt-1 text-xs text-gray-500 hover:text-shopee"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                    {cart.length === 0 && (
                        <div className="rounded-sm bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
                            Your cart is empty. <Link to="/Search?q=power%20bank" className="text-shopee underline">Find power banks</Link>
                        </div>
                    )}
                </section>

                <section className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-4 border-t-2 border-shopee bg-white p-4 shadow-lg">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={cart.length > 0 && selectedItemIds.size === cart.length}
                            onChange={toggleAll}
                            className="h-4 w-4 accent-shopee"
                        />
                        Select All ({cart.length})
                    </label>
                    <div className="ml-auto text-right">
                        <p className="text-sm text-gray-600">
                            Total ({selectedQuantity} items):{' '}
                            <span className="text-xl font-bold text-shopee">
                                {ready ? money(subtotal, [...currencies][0]) : '—'}
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={selectedItems.length === 0 || !ready}
                        onClick={() => navigate('/Checkout', {
                            state: { items: selectedItems.map(({ listingId, variantId, quantity }) => ({ listingId, variantId, quantity })) },
                        })}
                        className="bg-shopee px-8 py-3 text-sm font-medium uppercase text-white hover:bg-shopee2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                        Check Out
                    </button>
                </section>
            </div>
        </main>
    );
}

export default Cart;
