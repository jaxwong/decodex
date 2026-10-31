import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { priceRange, useShop } from '../../shop';

// Search matching is the backend's: GET /api/catalog?q= matches listing titles.
function SearchResults() {
    const [searchParams] = useSearchParams();
    const query = (searchParams.get('q') ?? '').trim();
    const { apiGet } = useShop();
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setResults(null);
        setError('');
        apiGet(`/api/catalog${query ? `?q=${encodeURIComponent(query)}` : ''}`, controller.signal)
            .then(result => setResults(result.listings))
            .catch(failure => {
                if (!controller.signal.aborted) setError(failure.message);
            });
        return () => controller.abort();
    }, [apiGet, query]);

    return (
        <main className="min-h-screen bg-gray-100 py-4">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <h1 className="mb-3 text-base text-gray-700">
                    {query
                        ? <>Search result for &apos;<span className="text-shopee">{query}</span>&apos;</>
                        : 'All products'}
                </h1>
                {error && <p role="alert" className="rounded-sm bg-white p-4 text-sm text-red-600 shadow-sm">Couldn&apos;t search: {error}</p>}
                {!results && !error && <p className="rounded-sm bg-white p-4 text-sm text-gray-500 shadow-sm">Searching…</p>}
                {results && results.length === 0 && (
                    <p className="rounded-sm bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
                        No results for &apos;{query}&apos;. Try <Link to="/Search?q=power%20bank" className="text-shopee underline">power bank</Link>.
                    </p>
                )}
                {results && results.length > 0 && (
                    <ul aria-label="Search results" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {results.map(listing => (
                            <li key={listing.listing_id}>
                                <Link
                                    to={`/Product/${listing.listing_id}`}
                                    className="block h-full border border-transparent bg-white shadow-sm transition hover:-translate-y-px hover:border-shopee hover:shadow-md"
                                >
                                    <div className="aspect-square bg-gray-50">
                                        {listing.image_url
                                            ? <img src={listing.image_url} alt="" className="h-full w-full object-contain" />
                                            : <span className="flex h-full items-center justify-center text-xs text-gray-400">No image</span>}
                                    </div>
                                    <div className="p-2">
                                        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-gray-800">{listing.title}</p>
                                        <p className="mt-2 text-shopee">{priceRange(listing.variants)}</p>
                                        <p className="mt-1 text-xs text-gray-500">{listing.variants.length} models</p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}

export default SearchResults;
