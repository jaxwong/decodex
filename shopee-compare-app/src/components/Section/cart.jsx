import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const formatPrice = value => `${value.toLocaleString('vi-VN')}₫`;

const initialCartItems = [
    {
        id: 'cart-1',
        shop: 'Anker Official Store',
        mall: true,
        title: 'Anker PowerCore portable charger',
        variation: 'Black',
        image: 'images/categories/2.png',
        price: 899000,
        originalPrice: 1299000,
        quantity: 1,
    },
    {
        id: 'cart-2',
        shop: 'UGREEN Vietnam',
        mall: true,
        title: 'UGREEN USB-C fast charger',
        variation: '65W',
        image: 'images/categories/17.png',
        price: 749000,
        originalPrice: 999000,
        quantity: 1,
    },
    {
        id: 'cart-3',
        shop: 'Tech Accessories',
        mall: false,
        title: 'Baseus compact power bank',
        variation: '20,000 mAh',
        image: 'images/categories/2.png',
        price: 559000,
        originalPrice: 799000,
        quantity: 1,
    },
];

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

    const selectedItems = cartItems.filter(item => selectedItemIds.has(item.id));
    const subtotal = selectedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
    );
    const savings = selectedItems.reduce(
        (total, item) => total + (item.originalPrice - item.price) * item.quantity,
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
                                Choose 2–4 exact backend variants on the comparison page.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/Compare')}
                            className="rounded-sm bg-shopee px-5 py-2 text-sm font-medium text-white hover:bg-shopee2"
                        >
                            Compare now
                        </button>
                    </header>
                    <p className="px-4 py-3 text-xs text-gray-500">
                        Luna uses its verified backend catalog; cart products are never treated as evidence.
                    </p>
                </section>

                <section aria-label="Cart products" className="space-y-3">
                    {cartItems.map(item => (
                        <article key={item.id} className="grid gap-4 rounded-sm bg-white p-4 shadow-sm md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center">
                            <input
                                type="checkbox"
                                aria-label={`Select ${item.title}`}
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => toggleItem(item.id)}
                                className="h-4 w-4 accent-shopee"
                            />
                            <div className="flex min-w-0 gap-3">
                                <img
                                    src={item.image}
                                    alt=""
                                    className="h-20 w-20 flex-shrink-0 rounded bg-gray-50 object-contain"
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        {item.mall && <span className="rounded-sm bg-shopee px-1.5 py-0.5 text-[10px] font-medium text-white">Mall</span>}
                                        <span className="text-xs text-gray-500">{item.shop}</span>
                                    </div>
                                    <h2 className="mt-1 text-sm text-gray-800">{item.title}</h2>
                                    <p className="mt-1 text-xs text-gray-400">Variation: {item.variation}</p>
                                </div>
                            </div>
                            <div className="text-sm">
                                <span className="mr-2 text-xs text-gray-400 line-through">{formatPrice(item.originalPrice)}</span>
                                <span className="text-gray-800">{formatPrice(item.price)}</span>
                            </div>
                            <div className="flex w-fit items-center border border-gray-300">
                                <button
                                    type="button"
                                    aria-label={`Decrease ${item.title} quantity`}
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                >
                                    −
                                </button>
                                <span className="w-10 border-x border-gray-300 py-1 text-center text-sm">{item.quantity}</span>
                                <button
                                    type="button"
                                    aria-label={`Increase ${item.title} quantity`}
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                                >
                                    +
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-4 md:block md:text-right">
                                <p className="font-medium text-shopee">{formatPrice(item.price * item.quantity)}</p>
                                <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="mt-1 text-xs text-gray-500 hover:text-shopee"
                                >
                                    Delete
                                </button>
                            </div>
                        </article>
                    ))}
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
                        <p className="text-xs text-gray-500">Saved: <span className="text-shopee">{formatPrice(savings)}</span></p>
                        <p className="text-sm text-gray-600">
                            Total ({selectedQuantity} items): <span className="text-xl font-bold text-shopee">{formatPrice(subtotal)}</span>
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
