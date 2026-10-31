import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompare } from '../../compare/CompareContext';
import ProductThumb from '../../compare/ProductThumb';
import HostCatalogPicker from '../../luna/HostCatalogPicker';

const peso = n => n.toLocaleString('vi-VN') + '₫';

const suggestedProducts = [
    { id: 101, title: 'Phone Case iPhone 15 Pro Max Clear', img: 'images/categories/2.png', price: 99000, originalPrice: 299000, sold: '12.3k' },
    { id: 102, title: 'USB-C Fast Charging Cable 2M', img: 'images/categories/2.png', price: 79000, originalPrice: 199000, sold: '45.6k' },
    { id: 103, title: 'Laptop Stand Aluminum Adjustable', img: 'images/categories/17.png', price: 349000, originalPrice: 799000, sold: '8.9k' },
    { id: 104, title: 'Wireless Mouse Rechargeable Silent', img: 'images/categories/17.png', price: 199000, originalPrice: 499000, sold: '23.4k' },
];

function Cart() {
    const { cart, listings, toggleCompare, setVariant, updateQty, removeItem, compareItems, compareNow } = useCompare();
    const navigate = useNavigate();
    const launchLuna = (items) => {
  sessionStorage.setItem(
    'luna-host-selection',
    JSON.stringify(items)
  );

  navigate('/Compare');
};
    const [selectedItems, setSelectedItems] = useState(new Set(cart.map(i => i.id)));

    // Resolve cart rows (power banks come from listings + selected variant)
    const rows = cart.map(item => {
        if (!item.lid) return { ...item, originalPrice: Math.round(item.price / (1 - item.discount) / 1000) * 1000 };
        const L = listings[item.lid];
        const V = L.variants.find(v => v.id === item.vid);
        return { ...item, L, V, title: L.title, shop: L.shop, price: V.price, variation: V.label, originalPrice: Math.round(V.price / (1 - item.discount) / 1000) * 1000 };
    });

    const toggleSelect = id => setSelectedItems(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    const toggleSelectAll = () => setSelectedItems(selectedItems.size === rows.length ? new Set() : new Set(rows.map(i => i.id)));

    const selectedCartItems = rows.filter(item => selectedItems.has(item.id));
    const subtotal = selectedCartItems.reduce((a, i) => a + i.price * i.qty, 0);
    const totalItems = selectedCartItems.reduce((a, i) => a + i.qty, 0);
    const totalSavings = selectedCartItems.reduce((a, i) => a + (i.originalPrice - i.price) * i.qty, 0);

    const groupedItems = rows.reduce((acc, item) => {
        if (!acc[item.shop]) acc[item.shop] = { shop: item.shop, mall: item.mall, items: [] };
        acc[item.shop].items.push(item);
        return acc;
    }, {});

    const bucket = compareItems().map(i => rows.find(r => r.id === i.id));
    const goCompare = () => { compareNow(); navigate('/Compare'); };

    const CompareToggle = ({ item, compact }) => {
        if (!item.lid) return <span className="text-[11px] text-gray-300" title="Compare supports power banks in this demo">Compare n/a</span>;
        const full = !item.compare && bucket.length >= 4;
        return (
            <button
                onClick={() => toggleCompare(item.id)}
                disabled={full}
                title={full ? 'Compare holds up to 4 items' : 'Add to comparison'}
                className={`inline-flex items-center gap-1 ${compact ? 'text-xs' : 'text-[13px]'} px-2 py-1 rounded-sm border transition-colors ${item.compare ? 'border-shopee bg-orange-50 text-shopee' : 'border-gray-300 text-gray-600 hover:border-shopee hover:text-shopee'} ${full ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
                <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] leading-none ${item.compare ? 'bg-shopee border-shopee text-white' : 'border-gray-400'}`}>{item.compare ? '✓' : ''}</span>
                Compare
            </button>
        );
    };

    const Variation = ({ item }) => item.lid ? (
        <label className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
            Variation:
            <select value={item.vid} onChange={e => setVariant(item.id, e.target.value)} className="text-xs text-gray-600 bg-transparent border border-gray-200 rounded-sm px-1 py-0.5 outline-none hover:border-shopee cursor-pointer">
                {item.L.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
        </label>
    ) : <p className="text-xs text-gray-400 mt-1">Variation: {item.variation}</p>;

    const Thumb = ({ item }) => item.lid
        ? <ProductThumb listing={item.L} />
        : <img src={item.img} alt={item.title} className="w-20 h-20 object-contain bg-gray-50 rounded flex-shrink-0" />;

    return (
        <main className="bg-gray-100 min-h-screen py-3 sm:py-6">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                <HostCatalogPicker onCompare={launchLuna} />
                </div>
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Header */}
                <div className="bg-white rounded-sm shadow-sm mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="text-shopee flex-shrink-0">
                            <path fill="currentColor" d="M7 22q-.825 0-1.412-.587T5 20t.588-1.412T7 18t1.413.588T9 20t-.587 1.413T7 22m10 0q-.825 0-1.412-.587T15 20t.588-1.412T17 18t1.413.588T19 20t-.587 1.413T17 22M5.2 4h16.5l-4.975 9H8.1L7 15h12v2H3.625L6.6 11.6L3 4H1V2h3.25z"/>
                        </svg>
                        <h1 className="text-lg sm:text-xl text-shopee font-medium">Shopping Cart</h1>
                        <span className="text-gray-400 text-sm">({rows.length} items)</span>
                        <span className="ml-auto hidden sm:inline text-xs text-gray-500">Tick <b className="text-shopee font-medium">Compare</b> on 2–4 items to compare the exact variations you picked</span>
                    </div>
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-xs text-gray-500 uppercase">
                        <div className="col-span-6 flex items-center gap-3">
                            <input type="checkbox" className="w-4 h-4 accent-shopee cursor-pointer" checked={selectedItems.size === rows.length && rows.length > 0} onChange={toggleSelectAll} />
                            <span>Product</span>
                        </div>
                        <div className="col-span-2 text-center">Unit Price</div>
                        <div className="col-span-2 text-center">Quantity</div>
                        <div className="col-span-1 text-center">Total</div>
                        <div className="col-span-1 text-center">Actions</div>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="space-y-3">
                    {Object.values(groupedItems).map(group => (
                        <div key={group.shop} className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-b border-gray-100">
                                <input type="checkbox" className="w-4 h-4 accent-shopee cursor-pointer"
                                    checked={group.items.every(i => selectedItems.has(i.id))}
                                    onChange={() => {
                                        const all = group.items.every(i => selectedItems.has(i.id));
                                        setSelectedItems(prev => { const s = new Set(prev); group.items.forEach(i => (all ? s.delete(i.id) : s.add(i.id))); return s; });
                                    }} />
                                <div className="flex items-center gap-2">
                                    {group.mall && <span className="bg-shopee text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-sm font-medium">Mall</span>}
                                    <span className="text-sm font-medium text-gray-800">{group.shop}</span>
                                </div>
                                <Link to="/" className="text-xs text-shopee hover:text-shopee2 ml-auto">View Shop &gt;</Link>
                            </div>

                            {group.items.map((item, idx) => (
                                <div key={item.id} className={`p-3 sm:p-4 ${idx !== group.items.length - 1 ? 'border-b border-gray-100' : ''} ${item.compare ? 'bg-orange-50/40' : ''}`}>
                                    {/* Mobile */}
                                    <div className="md:hidden flex gap-3">
                                        <input type="checkbox" className="w-4 h-4 accent-shopee self-start mt-1 cursor-pointer" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                                        <Thumb item={item} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 line-clamp-2">{item.title}</p>
                                            <Variation item={item} />
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-gray-400 text-xs line-through">{peso(item.originalPrice)}</span>
                                                <span className="text-shopee font-medium">{peso(item.price)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 gap-2">
                                                <CompareToggle item={item} compact />
                                                <button onClick={() => removeItem(item.id)} className="text-xs text-gray-500 hover:text-shopee">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Desktop */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-6 flex gap-3 items-center">
                                            <input type="checkbox" className="w-4 h-4 accent-shopee cursor-pointer" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                                            <Thumb item={item} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-800 line-clamp-2">{item.title}</p>
                                                <Variation item={item} />
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-xs text-gray-400 line-through block">{peso(item.originalPrice)}</span>
                                            <span className="text-sm text-gray-800">{peso(item.price)}</span>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <div className="flex items-center border border-gray-300 rounded-sm">
                                                <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                                                <span className="w-12 text-center text-sm border-x border-gray-300 py-1">{item.qty}</span>
                                                <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                                            </div>
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <span className="text-shopee font-medium text-sm">{peso(item.price * item.qty)}</span>
                                        </div>
                                        <div className="col-span-1 flex flex-col items-center gap-1.5">
                                            <button onClick={() => removeItem(item.id)} className="text-sm text-gray-500 hover:text-shopee transition-colors">Delete</button>
                                            <CompareToggle item={item} compact />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* You May Also Like (from the original clone) */}
                <div className="bg-white rounded-sm shadow-sm mt-3 overflow-hidden">
                    <div className="px-3 sm:px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-medium text-gray-700">You May Also Like</h3>
                    </div>
                    <div className="flex overflow-x-auto gap-2 p-3 sm:p-4 scrollbar-hide">
                        {suggestedProducts.map(product => (
                            <Link key={product.id} to="/" className="flex-shrink-0 w-[120px] sm:w-[150px] bg-white border border-gray-100 rounded-sm hover:shadow-lg transition-shadow group">
                                <div className="relative aspect-square overflow-hidden bg-gray-50">
                                    <img src={product.img} alt={product.title} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform" />
                                    <div className="absolute top-0 right-0 bg-yellow-400 text-red-600 text-[9px] px-1 py-0.5 font-bold">-{Math.round((1 - product.price / product.originalPrice) * 100)}%</div>
                                </div>
                                <div className="p-2">
                                    <p className="text-[11px] text-gray-800 line-clamp-2">{product.title}</p>
                                    <p className="text-shopee font-bold text-sm mt-1">{peso(product.price)}</p>
                                    <p className="text-gray-400 text-[10px]">{product.sold} sold</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Sticky bottom: compare bucket + checkout bar */}
                <div className="sticky bottom-0 z-50 mt-3">
                    {bucket.length > 0 && (
                        <div className="bg-white rounded-t-sm shadow-lg border-t-2 border-shopee px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-shopee whitespace-nowrap">COMPARE ({bucket.length}/4)</span>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {bucket.map(i => (
                                    <span key={i.id} className="flex items-center gap-2 border border-gray-200 rounded-sm pl-1 pr-2 py-1 text-xs text-gray-700 bg-white">
                                        <ProductThumb listing={i.L} className="w-7 h-7" />
                                        <span className="max-w-[140px] truncate">{i.L.short} · {i.V.label}</span>
                                        <button onClick={() => toggleCompare(i.id)} className="text-gray-400 hover:text-shopee ml-1" title="Remove">✕</button>
                                    </span>
                                ))}
                            </div>
                            <button onClick={goCompare} disabled={bucket.length < 2}
                                className={`px-6 py-2 rounded-sm text-sm font-medium transition-colors ${bucket.length >= 2 ? 'bg-shopee hover:bg-shopee2 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                                {bucket.length >= 2 ? 'Compare now' : 'Add 1 more to compare'}
                            </button>
                        </div>
                    )}
                    <div className={`bg-white shadow-lg ${bucket.length ? 'border-t border-gray-100' : 'rounded-sm border-t-2 border-shopee'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 accent-shopee" checked={selectedItems.size === rows.length && rows.length > 0} onChange={toggleSelectAll} />
                                    <span className="text-xs sm:text-sm">Select All ({rows.length})</span>
                                </label>
                                <button className="text-xs sm:text-sm text-gray-600 hover:text-shopee transition-colors">Delete</button>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-6">
                                <div className="flex-1 sm:flex-none text-right">
                                    <div className="text-xs text-gray-500 hidden sm:block">Saved: <span className="text-shopee">{peso(totalSavings)}</span></div>
                                    <div className="flex items-baseline gap-1 justify-end">
                                        <span className="text-xs sm:text-sm text-gray-600">Total ({totalItems} items):</span>
                                        <span className="text-lg sm:text-2xl text-shopee font-bold">{peso(subtotal)}</span>
                                    </div>
                                </div>
                                <Link to={selectedItems.size > 0 ? '/Checkout' : '#'}
                                    className={`px-6 sm:px-12 py-2.5 sm:py-3 rounded-sm text-sm uppercase font-medium transition-colors inline-block text-center ${selectedItems.size > 0 ? 'bg-shopee hover:bg-shopee2 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'}`}>
                                    Check Out
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default Cart;
