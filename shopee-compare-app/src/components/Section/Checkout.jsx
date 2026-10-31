import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { money, useShop } from '../../shop';

// Checks out exactly the lines the previous page handed over (cart ticks, Buy Now, or the
// product chosen in Luna). Prices come from Luna's catalog; no payment is taken.
function Checkout() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { variants, catalogError, removeFromCart } = useShop();
    const items = state?.items ?? [];

    if (catalogError) {
        return <Notice role="alert">Couldn&apos;t load checkout: {catalogError}</Notice>;
    }
    if (!variants) return <Notice>Loading checkout…</Notice>;
    if (items.length === 0) {
        return <Notice>Nothing to check out yet. <Link to="/Cart" className="text-shopee underline">Go to your cart</Link></Notice>;
    }
    const missing = items.filter(item => !variants.has(`${item.listingId}:${item.variantId}`));
    if (missing.length > 0) {
        return <Notice role="alert">Products {missing.map(item => `${item.listingId}:${item.variantId}`).join(', ')} are not in Luna&apos;s catalog.</Notice>;
    }

    const lines = items.map(item => {
        const { listing, variant } = variants.get(`${item.listingId}:${item.variantId}`);
        return { ...item, id: `${item.listingId}:${item.variantId}`, listing, variant };
    });
    const { currency } = lines[0].variant;
    if (lines.some(line => line.variant.currency !== currency)) {
        return <Notice role="alert">These products are priced in different currencies and can&apos;t be checked out together.</Notice>;
    }
    // Each listing is its own shop order: its voucher and shipping apply once per order line.
    const merchandise = lines.reduce((total, line) => total + line.variant.price_minor * line.quantity, 0);
    const shipping = lines.reduce((total, line) => total + line.variant.shipping_minor, 0);
    const vouchers = lines.reduce((total, line) => total + line.variant.shop_voucher_minor, 0);
    const totalPayment = merchandise - vouchers + shipping;

    const placeOrder = () => {
        removeFromCart(lines.map(line => line.id));
        navigate('/OrderConfirmation', {
            replace: true,
            state: {
                order: {
                    lines: lines.map(line => ({
                        id: line.id,
                        title: line.listing.title,
                        imageUrl: line.listing.image_url,
                        variantLabel: line.variant.label,
                        quantity: line.quantity,
                    })),
                    totalPaymentMinor: totalPayment,
                    currency,
                },
            },
        });
    };

    return (
        <main className="min-h-screen bg-gray-100 py-4">
            <div className="mx-auto max-w-[1200px] space-y-3 px-2 sm:px-4">
                <h1 className="text-xl font-medium text-shopee">Checkout</h1>

                <section aria-label="Delivery address" className="overflow-hidden rounded-sm bg-white shadow-sm">
                    <div className="h-1 bg-[repeating-linear-gradient(45deg,#6fa6d6,#6fa6d6_33px,transparent_0,transparent_41px,#f18d9b_0,#f18d9b_74px,transparent_0,transparent_82px)]" />
                    <div className="p-5">
                        <h2 className="text-base text-shopee">Delivery Address</h2>
                        <p className="mt-2 text-sm text-gray-600">Demo checkout: no address is collected and nothing ships.</p>
                    </div>
                </section>

                <section aria-label="Products ordered" className="rounded-sm bg-white shadow-sm">
                    <div className="hidden grid-cols-[1fr_120px_80px_140px] gap-4 px-5 pt-5 text-sm text-gray-500 md:grid">
                        <h2 className="text-base text-gray-800">Products Ordered</h2>
                        <span className="text-right">Unit Price</span>
                        <span className="text-right">Amount</span>
                        <span className="text-right">Item Subtotal</span>
                    </div>
                    {lines.map(line => (
                        <article key={line.id} aria-label={`${line.listing.title} ${line.variant.label}`} className="border-b border-dashed border-gray-200 px-5 py-4 last:border-b-0">
                            <div className="grid items-center gap-4 md:grid-cols-[1fr_120px_80px_140px]">
                                <div className="flex items-center gap-3">
                                    {line.listing.image_url
                                        ? <img src={line.listing.image_url} alt="" className="h-12 w-12 border border-gray-100 object-contain" />
                                        : <span className="flex h-12 w-12 items-center justify-center bg-gray-50 text-[10px] text-gray-400">No image</span>}
                                    <div>
                                        <p className="text-sm text-gray-800">{line.listing.title}</p>
                                        <p className="text-xs text-gray-500">Variation: {line.variant.label}</p>
                                    </div>
                                </div>
                                <span className="text-sm md:text-right">{money(line.variant.price_minor, currency)}</span>
                                <span className="text-sm md:text-right">{line.quantity}</span>
                                <span className="text-sm md:text-right">{money(line.variant.price_minor * line.quantity, currency)}</span>
                            </div>
                            <dl className="mt-3 grid gap-1 bg-blue-50/40 px-3 py-2 text-sm sm:grid-cols-2">
                                <div className="flex justify-between gap-4 sm:block"><dt className="inline text-gray-500">Shop Voucher </dt><dd className="inline text-shopee">{line.variant.shop_voucher_minor > 0 ? `−${money(line.variant.shop_voucher_minor, currency)}` : 'None'}</dd></div>
                                <div className="flex justify-between gap-4 sm:block sm:text-right"><dt className="inline text-gray-500">Shipping fee </dt><dd className="inline text-gray-800">{money(line.variant.shipping_minor, currency)}</dd></div>
                            </dl>
                        </article>
                    ))}
                </section>

                <section aria-label="Payment" className="rounded-sm bg-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 p-5">
                        <h2 className="text-base text-gray-800">Payment Method</h2>
                        <span className="border border-shopee px-3 py-1 text-sm text-shopee">Cash on Delivery</span>
                        <span className="text-xs text-gray-500">Demo: no payment is taken.</span>
                    </div>
                    <dl aria-label="Order summary" className="ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-8 gap-y-3 p-5 text-sm">
                        <dt className="text-gray-500">Merchandise Subtotal</dt><dd className="text-right">{money(merchandise, currency)}</dd>
                        <dt className="text-gray-500">Shipping Total</dt><dd className="text-right">{money(shipping, currency)}</dd>
                        <dt className="text-gray-500">Shop Voucher Discount</dt><dd className="text-right">−{money(vouchers, currency)}</dd>
                        <dt className="self-center text-gray-500">Total Payment</dt><dd className="text-right text-2xl text-shopee">{money(totalPayment, currency)}</dd>
                    </dl>
                    <div className="flex justify-end border-t border-dashed border-gray-200 p-5">
                        <button type="button" onClick={placeOrder} className="bg-shopee px-14 py-3 text-sm text-white hover:bg-shopee2">
                            Place Order
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}

function Notice({ children, role }) {
    return (
        <main className="min-h-screen bg-gray-100 py-6">
            <p role={role} className="mx-auto max-w-[1200px] rounded-sm bg-white p-10 text-center text-sm text-gray-600 shadow-sm">{children}</p>
        </main>
    );
}

Notice.propTypes = {
    children: PropTypes.node.isRequired,
    role: PropTypes.string,
};

export default Checkout;
