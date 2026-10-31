import { Link, useLocation } from 'react-router-dom';
import { money } from '../../shop';

// Shows the order Checkout just placed. A reload loses router state, so it says so plainly.
function OrderConfirmation() {
    const { state } = useLocation();
    const order = state?.order;

    return (
        <main className="min-h-screen bg-gray-100 py-6">
            <div className="mx-auto max-w-[720px] px-2 sm:px-4">
                {!order ? (
                    <p className="rounded-sm bg-white p-10 text-center text-sm text-gray-600 shadow-sm">
                        No order to show. <Link to="/" className="text-shopee underline">Continue shopping</Link>
                    </p>
                ) : (
                    <section aria-label="Order placed" className="rounded-sm bg-white p-6 text-center shadow-sm">
                        <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">✓</div>
                        <h1 className="mt-3 text-xl font-medium text-gray-900">Order placed</h1>
                        <p className="mt-1 text-sm text-gray-500">This is a demo order. Nothing was charged and nothing will ship.</p>
                        <ul aria-label="Ordered products" className="mt-5 divide-y divide-gray-100 border-y border-gray-100 text-left">
                            {order.lines.map(line => (
                                <li key={line.id} className="flex items-center gap-3 py-3">
                                    {line.imageUrl
                                        ? <img src={line.imageUrl} alt="" className="h-12 w-12 object-contain" />
                                        : <span className="h-12 w-12 bg-gray-50" />}
                                    <span className="flex-1 text-sm text-gray-800">{line.title} · {line.variantLabel}</span>
                                    <span className="text-sm text-gray-500">× {line.quantity}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-sm text-gray-600">
                            Total Payment <span className="ml-2 text-xl text-shopee">{money(order.totalPaymentMinor, order.currency)}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">Cash on Delivery</p>
                        <div className="mt-6 flex justify-center gap-3">
                            <Link to="/" className="border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50">Continue shopping</Link>
                            <Link to="/Cart" className="bg-shopee px-6 py-2 text-sm text-white hover:bg-shopee2">View cart</Link>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

export default OrderConfirmation;
