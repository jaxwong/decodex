import { SellerGapReport } from '@luna/widget';

function SellerCentre() {
    return (
        <main className="min-h-screen bg-gray-100 py-3 sm:py-6">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <header className="mb-3 rounded-sm bg-white p-4 shadow-sm">
                    <h1 className="text-xl font-medium text-gray-900">Luna insights</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        What buyers ran into when Luna compared your listings, and their open questions.
                    </p>
                </header>
                <SellerGapReport apiBaseUrl="/api" />
            </div>
        </main>
    );
}

export default SellerCentre;
