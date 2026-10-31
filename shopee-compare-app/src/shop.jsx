import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

// Host A's storefront state. Luna's backend catalog owns every title, image and price; this
// provider only loads it and keeps the shopper's cart, which holds exact catalog variant IDs,
// plus which lines are ticked for checkout (ticks survive leaving and returning to the cart).
const ShopContext = createContext(null);

const cartLine = (listingId, variantId, quantity = 1) => ({
    id: `${listingId}:${variantId}`, listingId, variantId, quantity,
});

// Demo cart contents: one exact variant of each catalog product.
const initialCart = [
    cartLine('listingA', '100w'),
    cartLine('listingB', '65w'),
    cartLine('listingC', '87w'),
];

export const money = (minor, currency) => `${currency} ${(minor / 100).toFixed(2)}`;

// A listing's list-price span across its models, as Shopee shows before a model is picked.
export function priceRange(variants) {
    const prices = variants.map(variant => variant.price_minor);
    const [low, high] = [Math.min(...prices), Math.max(...prices)];
    const { currency } = variants[0];
    return low === high ? money(low, currency) : `${money(low, currency)} – ${money(high, currency)}`;
}

async function createSessionToken() {
    const response = await fetch('/api/demo-sessions', { method: 'POST' });
    if (!response.ok) throw new Error(`Luna API /api/demo-sessions returned HTTP ${response.status}`);
    return (await response.json()).token;
}

export function ShopProvider({ children }) {
    const sessionToken = useRef(null);
    const [listings, setListings] = useState(null);
    const [catalogError, setCatalogError] = useState('');
    const [cart, setCart] = useState(initialCart);
    // Ticked lines mean "check these out", as on Shopee. New lines start ticked.
    const [selectedIds, setSelectedIds] = useState(() => new Set(initialCart.map(line => line.id)));
    // The line Luna's "Pick this one" ticked alone; cleared as soon as the shopper re-ticks by hand.
    const [pickedId, setPickedId] = useState(null);

    function startSession() {
        // Shared by every page, so one page's abort never cancels another page's session.
        sessionToken.current = createSessionToken().catch(failure => {
            sessionToken.current = null;
            throw failure;
        });
        return sessionToken.current;
    }

    // Storefront reads are GETs, so repeating one once with a new session is safe when the API
    // has forgotten the old session (a restart or the one-hour expiry).
    const apiGet = useCallback(async (path, signal) => {
        const get = async token => fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal });
        let response = await get(await (sessionToken.current ?? startSession()));
        if (response.status === 401) {
            console.warn(`Luna API forgot the storefront session (HTTP 401 on ${path}); starting a new one`);
            response = await get(await startSession());
        }
        if (!response.ok) throw new Error(`Luna API ${path} returned HTTP ${response.status}`);
        return response.json();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        apiGet('/api/catalog', controller.signal)
            .then(result => setListings(result.listings))
            .catch(failure => {
                if (!controller.signal.aborted) setCatalogError(failure.message);
            });
        return () => controller.abort();
    }, [apiGet]);

    const variants = useMemo(() => listings && new Map(listings.flatMap(listing => listing.variants
        .map(variant => [`${listing.listing_id}:${variant.variant_id}`, { listing, variant }]))), [listings]);

    const addToCart = useCallback((listingId, variantId, quantity) => {
        const id = `${listingId}:${variantId}`;
        setCart(current => current.some(line => line.id === id)
            ? current.map(line => line.id === id ? { ...line, quantity: line.quantity + quantity } : line)
            : [...current, cartLine(listingId, variantId, quantity)]);
        setSelectedIds(current => new Set([...current, id]));
    }, []);

    const toggleSelected = useCallback(id => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setPickedId(null);
    }, []);

    const setAllSelected = useCallback(selected => {
        setSelectedIds(selected ? new Set(cart.map(line => line.id)) : new Set());
        setPickedId(null);
    }, [cart]);

    // Luna's pick: in the cart (added if absent) and the only ticked line. Nothing is bought.
    const pickProduct = useCallback((listingId, variantId) => {
        const id = `${listingId}:${variantId}`;
        setCart(current => current.some(line => line.id === id)
            ? current : [...current, cartLine(listingId, variantId, 1)]);
        setSelectedIds(new Set([id]));
        setPickedId(id);
    }, []);

    const updateQuantity = useCallback((id, change) => {
        setCart(current => current.map(line => line.id === id
            ? { ...line, quantity: Math.max(1, line.quantity + change) } : line));
    }, []);

    const removeFromCart = useCallback(ids => {
        setCart(current => current.filter(line => !ids.includes(line.id)));
        setSelectedIds(current => new Set([...current].filter(id => !ids.includes(id))));
        setPickedId(current => (ids.includes(current) ? null : current));
    }, []);

    const shop = useMemo(() => ({
        listings, variants, catalogError, apiGet, cart, selectedIds, pickedId,
        addToCart, updateQuantity, removeFromCart, toggleSelected, setAllSelected, pickProduct,
    }), [listings, variants, catalogError, apiGet, cart, selectedIds, pickedId,
        addToCart, updateQuantity, removeFromCart, toggleSelected, setAllSelected, pickProduct]);

    return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

ShopProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export function useShop() {
    const shop = useContext(ShopContext);
    if (!shop) throw new Error('useShop() must be used inside <ShopProvider>');
    return shop;
}
