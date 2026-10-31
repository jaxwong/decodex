import { useMemo } from 'react';
import { LunaWidget } from '@luna/widget';
import { Link, useNavigate } from 'react-router-dom';
import { createShopeeLunaAdapter } from '../../lunaHostAdapter';

function Compare() {
    const navigate = useNavigate();
    const lunaAdapter = useMemo(() => createShopeeLunaAdapter(navigate), [navigate]);

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
                <LunaWidget adapter={lunaAdapter} apiBaseUrl="/api" />
            </div>
        </main>
    );
}

export default Compare;
