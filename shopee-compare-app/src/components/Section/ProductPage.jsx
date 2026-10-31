import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, priceRange, useShop } from '../../shop';

const REVIEWS_PER_PAGE = 6;

function Stars({ rating, className = '' }) {
    return (
        <span className={`inline-flex tracking-tight ${className}`} aria-hidden="true">
            {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={star <= Math.round(rating) ? 'text-shopee' : 'text-gray-300'}>★</span>
            ))}
        </span>
    );
}

Stars.propTypes = {
    rating: PropTypes.number.isRequired,
    className: PropTypes.string,
};

// "Capacity: 20 Ah" → ["Capacity", "20 Ah"], exactly as the seller wrote it.
function splitSpecification(line) {
    const colon = line.indexOf(':');
    return colon === -1 ? ['', line] : [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
}

function Section({ title, children }) {
    return (
        <section aria-label={title} className="mt-3 rounded-sm bg-white p-5 shadow-sm">
            <h2 className="bg-gray-50 px-4 py-3 text-base font-medium uppercase text-gray-800">{title}</h2>
            <div className="px-4 pt-4">{children}</div>
        </section>
    );
}

Section.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

// Shopee-style listing page: the seller's own text and buyers' reviews, unverified. Luna's
// checked values live in the comparison, not here. variantId null means no model picked yet.
export function ProductDetails({ listingId, variantId, onVariantChange }) {
    const { apiGet, addToCart } = useShop();
    const navigate = useNavigate();
    const [page, setPage] = useState(null);
    const [error, setError] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [ratingFilter, setRatingFilter] = useState('all');
    const [reviewPage, setReviewPage] = useState(0);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        setPage(null);
        setError('');
        apiGet(`/api/catalog/${encodeURIComponent(listingId)}`, controller.signal)
            .then(setPage)
            .catch(failure => {
                if (!controller.signal.aborted) setError(failure.message);
            });
        return () => controller.abort();
    }, [apiGet, listingId]);

    useEffect(() => setAdded(false), [variantId, quantity]);
    useEffect(() => setReviewPage(0), [variantId]);

    if (error) {
        return <p role="alert" className="rounded-sm bg-white p-6 text-sm text-red-600 shadow-sm">Couldn&apos;t load this product: {error}</p>;
    }
    if (!page) {
        return <p className="rounded-sm bg-white p-6 text-sm text-gray-500 shadow-sm">Loading product…</p>;
    }
    const variant = variantId === null ? null : page.variants.find(candidate => candidate.variant_id === variantId);
    if (variantId !== null && !variant) {
        return <p role="alert" className="rounded-sm bg-white p-6 text-sm text-red-600 shadow-sm">{page.title} has no model &quot;{variantId}&quot;.</p>;
    }

    const { currency } = page.variants[0];
    const average = page.reviews.length > 0
        ? page.reviews.reduce((total, review) => total + review.rating, 0) / page.reviews.length : 0;
    // Without a picked model, show only the lines every model shares; per-model lines differ.
    const specifications = variant
        ? variant.specifications
        : page.variants[0].specifications.filter(line => page.variants.every(candidate => candidate.specifications.includes(line)));
    const descriptionLines = [...new Set(page.description
        .filter(paragraph => !variant || paragraph.variant_id === null || paragraph.variant_id === variant.variant_id)
        .map(paragraph => paragraph.text))];
    const modelLabel = id => page.variants.find(candidate => candidate.variant_id === id)?.label;
    const filters = [
        { key: 'all', label: `All (${page.reviews.length})`, keep: () => true },
        ...[5, 4, 3, 2, 1].map(stars => ({
            key: String(stars),
            label: `${stars} Star (${page.reviews.filter(review => review.rating === stars).length})`,
            keep: review => review.rating === stars,
        })),
        ...(variant ? [{
            key: 'model',
            label: `${variant.label} model (${page.reviews.filter(review => review.variant_id === variant.variant_id).length})`,
            keep: review => review.variant_id === variant.variant_id,
        }] : []),
    ];
    const activeFilter = filters.find(filter => filter.key === ratingFilter) ?? filters[0];
    const shownReviews = page.reviews.filter(activeFilter.keep);
    const reviewPageCount = Math.max(1, Math.ceil(shownReviews.length / REVIEWS_PER_PAGE));
    const visibleReviews = shownReviews.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE);

    return (
        <div>
            <section aria-label="Product overview" className="grid gap-6 rounded-sm bg-white p-4 shadow-sm md:grid-cols-[420px_1fr] md:p-5">
                <div className="flex aspect-square items-center justify-center bg-gray-50">
                    {page.image_url
                        ? <img src={page.image_url} alt={page.title} className="h-full w-full object-contain" />
                        : <span className="text-sm text-gray-400">No image</span>}
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl font-medium text-gray-900">{page.title}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <span className="border-b border-shopee text-base text-shopee">{average.toFixed(1)}</span>
                            <Stars rating={average} />
                        </span>
                        <span className="border-l border-gray-300 pl-4 text-gray-600">
                            <span className="border-b border-gray-800 text-base text-gray-900">{page.reviews.length}</span> Ratings
                        </span>
                        {page.synthetic && (
                            <span className="border-l border-gray-300 pl-4 text-xs uppercase tracking-wide text-gray-400">Demo listing</span>
                        )}
                    </div>

                    <div className="mt-4 bg-gray-50 px-5 py-4">
                        <p aria-label="Price" className="text-3xl font-medium text-shopee">
                            {variant ? money(variant.price_minor, currency) : priceRange(page.variants)}
                        </p>
                    </div>

                    <dl className="mt-5 grid grid-cols-[110px_1fr] items-center gap-y-5 px-1 text-sm">
                        <dt className="text-gray-500">Shop Vouchers</dt>
                        <dd>
                            {variant
                                ? variant.shop_voucher_minor > 0
                                    ? <span className="border border-shopee bg-orange-50 px-2 py-0.5 text-shopee">{money(variant.shop_voucher_minor, currency)} OFF</span>
                                    : <span className="text-gray-500">None for this model</span>
                                : <span className="text-gray-500">Select a model</span>}
                        </dd>
                        <dt className="text-gray-500">Shipping</dt>
                        <dd className="text-gray-800">
                            {variant ? `Shipping fee ${money(variant.shipping_minor, currency)}` : <span className="text-gray-500">Select a model</span>}
                        </dd>
                        <dt className="self-start pt-2 text-gray-500">Model</dt>
                        <dd className="flex flex-wrap gap-2" role="group" aria-label="Model">
                            {page.variants.map(candidate => {
                                const selected = candidate.variant_id === variant?.variant_id;
                                return (
                                    <button
                                        key={candidate.variant_id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => onVariantChange(candidate.variant_id)}
                                        className={`relative min-w-[80px] border px-4 py-2 text-sm ${selected ? 'border-shopee text-shopee' : 'border-gray-300 text-gray-800 hover:border-shopee hover:text-shopee'}`}
                                    >
                                        {candidate.label}
                                        {selected && <span aria-hidden="true" className="absolute bottom-0 right-0 bg-shopee px-0.5 text-[9px] leading-tight text-white">✓</span>}
                                    </button>
                                );
                            })}
                        </dd>
                        <dt className="text-gray-500">Quantity</dt>
                        <dd className="flex w-fit items-center border border-gray-300">
                            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(current => Math.max(1, current - 1))} className="h-8 w-8 text-gray-600 hover:bg-gray-100">−</button>
                            <span aria-label="Quantity" className="w-12 border-x border-gray-300 py-1 text-center">{quantity}</span>
                            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(current => current + 1)} className="h-8 w-8 text-gray-600 hover:bg-gray-100">+</button>
                        </dd>
                    </dl>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            disabled={!variant}
                            onClick={() => {
                                addToCart(page.listing_id, variant.variant_id, quantity);
                                setAdded(true);
                            }}
                            className="flex h-12 items-center gap-2 border border-shopee bg-orange-50 px-5 text-shopee hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Add To Cart
                        </button>
                        <button
                            type="button"
                            disabled={!variant}
                            onClick={() => navigate('/Checkout', {
                                state: { items: [{ listingId: page.listing_id, variantId: variant.variant_id, quantity }] },
                            })}
                            className="h-12 bg-shopee px-10 text-white hover:bg-shopee2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Buy Now
                        </button>
                    </div>
                    {!variant && <p className="mt-3 text-sm text-shopee">Please select a model first.</p>}
                    {added && (
                        <p role="status" className="mt-3 text-sm text-green-700">
                            Added {quantity} × {variant.label} to your cart. <Link to="/Cart" className="text-shopee underline">View cart</Link>
                        </p>
                    )}
                </div>
            </section>

            <Section title="Product Specifications">
                {specifications.length > 0 ? (
                    <dl className="grid grid-cols-[180px_1fr] gap-y-4 text-sm">
                        {specifications.map(line => {
                            const [label, value] = splitSpecification(line);
                            return (
                                <div key={line} className="contents">
                                    <dt className="text-gray-500">{label}</dt>
                                    <dd className="text-gray-800">{value}</dd>
                                </div>
                            );
                        })}
                    </dl>
                ) : <p className="text-sm text-gray-500">The seller listed no specifications.</p>}
                {!variant && <p className="mt-4 text-xs text-gray-500">Select a model to see every specification for it.</p>}
            </Section>

            <Section title="Product Description">
                <div className="space-y-2 text-sm leading-relaxed text-gray-800">
                    {descriptionLines.map(text => <p key={text}>{text}</p>)}
                </div>
            </Section>

            <Section title="Product Ratings">
                <div className="flex flex-wrap items-center gap-6 border border-orange-100 bg-orange-50/60 p-6">
                    <div className="text-shopee">
                        <p><span className="text-3xl">{average.toFixed(1)}</span> <span className="text-lg">out of 5</span></p>
                        <Stars rating={average} className="text-xl" />
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter ratings">
                        {filters.map(filter => (
                            <button
                                key={filter.key}
                                type="button"
                                aria-pressed={filter.key === activeFilter.key}
                                onClick={() => {
                                    setRatingFilter(filter.key);
                                    setReviewPage(0);
                                }}
                                className={`min-w-[100px] border bg-white px-3 py-1.5 text-sm ${filter.key === activeFilter.key ? 'border-shopee text-shopee' : 'border-gray-200 text-gray-800'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
                <ul aria-label="Reviews" className="divide-y divide-gray-100">
                    {visibleReviews.map(review => (
                        <li key={review.review_id} className="flex gap-3 py-4">
                            <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-500">B</span>
                            <div>
                                <p className="text-xs text-gray-800">Buyer</p>
                                <Stars rating={review.rating} className="text-xs" />
                                <span className="sr-only">{review.rating} out of 5 stars</span>
                                <p className="mt-1 text-xs text-gray-500">
                                    Model: {review.variant_id ? modelLabel(review.variant_id) : 'not stated'}
                                </p>
                                <p className="mt-2 text-sm text-gray-800">{review.text}</p>
                            </div>
                        </li>
                    ))}
                    {shownReviews.length === 0 && <li className="py-8 text-center text-sm text-gray-500">No ratings yet.</li>}
                </ul>
                {reviewPageCount > 1 && (
                    <nav aria-label="Review pages" className="flex justify-center gap-1 py-4">
                        {Array.from({ length: reviewPageCount }, (_, index) => (
                            <button
                                key={index}
                                type="button"
                                aria-label={`Review page ${index + 1}`}
                                aria-current={index === reviewPage ? 'page' : undefined}
                                onClick={() => setReviewPage(index)}
                                className={`h-8 min-w-[2rem] px-2 text-sm ${index === reviewPage ? 'bg-shopee text-white' : 'text-gray-600 hover:text-shopee'}`}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </nav>
                )}
            </Section>
        </div>
    );
}

ProductDetails.propTypes = {
    listingId: PropTypes.string.isRequired,
    variantId: PropTypes.string,
    onVariantChange: PropTypes.func.isRequired,
};

function ProductPage() {
    const { listingId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    return (
        <main className="min-h-screen bg-gray-100 py-4">
            <div className="mx-auto max-w-[1200px] px-2 sm:px-4">
                <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500">
                    <Link to="/" className="text-blue hover:underline">Shopee</Link>
                    <span className="mx-2">›</span>
                    <Link to="/Search?q=power%20bank" className="text-blue hover:underline">Power banks</Link>
                </nav>
                <ProductDetails
                    listingId={listingId}
                    variantId={searchParams.get('variant')}
                    onVariantChange={variantId => setSearchParams({ variant: variantId }, { replace: true })}
                />
            </div>
        </main>
    );
}

export default ProductPage;
