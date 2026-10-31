import React, { createContext, useContext, useRef, useState } from 'react';
import { LISTINGS } from './data';
import { clone, makeCache, runComparison } from './engine';

const Ctx = createContext(null);
export const useCompare = () => useContext(Ctx);

// Cart = Shopee cart items. Power banks are linked to a listing (lid) + selected variant (vid).
const INITIAL_CART = [
  { id: 1, lid: 'A', vid: 'a1', qty: 1, compare: true, mall: true, discount: 0.32 },
  { id: 2, lid: 'B', vid: 'b1', qty: 1, compare: true, mall: true, discount: 0.18 },
  { id: 3, lid: 'C', vid: 'c2', qty: 1, compare: true, mall: false, discount: 0.45 },
  { id: 4, lid: 'D', vid: 'd1', qty: 1, compare: false, mall: true, discount: 0.25 },
  { id: 5, lid: null, title: 'Wireless Bluetooth Earbuds TWS Pro Max Noise Cancelling IPX5 Waterproof', img: 'images/categories/12.png', shop: 'TechGadgets Official Store', variation: 'Black', price: 349000, qty: 1, compare: false, mall: true, discount: 0.6 },
];

export function CompareProvider({ children }) {
  const [listings, setListings] = useState(() => clone(LISTINGS));
  const [cart, setCart] = useState(INITIAL_CART);
  const [settings, setSettings] = useState({ key: '', model: 'gpt-5-mini', threshold: 0.6 });
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);
  const cacheRef = useRef(makeCache(LISTINGS));
  const liveRef = useRef({});
  const runN = useRef(0);

  const compareItems = (c = cart) => c.filter(i => i.compare && i.lid);

  async function compareNow({ cartOverride, listingsOverride, settingsOverride } = {}) {
    const c = cartOverride || cart, L = listingsOverride || listings, s = settingsOverride || settings;
    const items = compareItems(c).map(i => ({ lid: i.lid, vid: i.vid }));
    if (items.length < 2) return;
    setRunning(true);
    const out = await runComparison(items, L, s, cacheRef.current, liveRef.current);
    runN.current += 1;
    setRun({ ...out, n: runN.current });
    setRunning(false);
  }

  const toggleCompare = id => setCart(c => {
    const item = c.find(i => i.id === id);
    if (!item.compare && compareItems(c).length >= 4) return c; // max 4
    return c.map(i => (i.id === id ? { ...i, compare: !i.compare } : i));
  });
  const setVariant = (id, vid) => {
    const next = cart.map(i => (i.id === id ? { ...i, vid } : i));
    setCart(next);
    return next;
  };
  const updateQty = (id, d) => setCart(c => c.map(i => (i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i)));
  const removeItem = id => setCart(c => c.filter(i => i.id !== id));
  const updateListing = (lid, L) => { const next = { ...listings, [lid]: L }; setListings(next); return next; };
  const resetListing = lid => updateListing(lid, clone(LISTINGS[lid]));

  return (
    <Ctx.Provider value={{ listings, cart, settings, setSettings, run, running, compareNow, compareItems, toggleCompare, setVariant, updateQty, removeItem, updateListing, resetListing }}>
      {children}
    </Ctx.Provider>
  );
}
