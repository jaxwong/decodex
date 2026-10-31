import { SellerGapReport } from '@luna/widget';
import { Link } from 'react-router-dom';

function SellerCentre() {
    return (
        <main className="min-h-screen bg-gray-100 py-3 sm:py-6">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <header className="mb-3 flex flex-wrap items-center gap-3 rounded-sm bg-white p-4 shadow-sm">
                    <div>
                        <h1 className="text-xl font-medium text-shopee">Seller Centre</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Luna insights from buyer comparisons of your listings.
                        </p>
                    </div>
                    <Link to="/Cart" className="ml-auto text-sm text-shopee hover:text-shopee2">
                        &lt; Back to shopping
                    </Link>
                </header>
                <SellerGapReport apiBaseUrl="/api" />
            </div>
        </main>
    );
}

export default SellerCentre;
