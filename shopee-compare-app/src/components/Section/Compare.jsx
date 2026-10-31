
import { useEffect, useState } from 'react';
import LunaWidget from '../../luna/LunaWidget';
import { Link, useNavigate } from 'react-router-dom';
import { useCompare } from '../../compare/CompareContext';
import ProductThumb from '../../compare/ProductThumb';
import { TOPICS, GENERIC } from '../../compare/data';
import { FIELDS, PRICE, bestValue, cellOf, fieldDef, rowIsSame } from '../../compare/engine';
import { Drawer, ByBadge, CellPanel, GenericPanel, RejectedPanel, ReviewsPanel, RoutingPanel, ListingPanel, EditorPanel, SettingsPanel } from '../../compare/Panels';

const SRC = { cached: ['AI: cached', 'bg-slate-100 text-slate-600'], live: ['AI: live', 'bg-green-50 text-green-700'], stale: ['AI: cached · listing edited', 'bg-amber-50 text-amber-700'], none: ['AI: no output', 'bg-red-50 text-red-600'], error: ['AI error', 'bg-red-50 text-red-600'], notneeded: ['no AI call needed', 'bg-green-50 text-green-700'] };
const PRIO_KEYS = ['price', 'max_output_w', 'weight_g', 'capacity_mah', 'warranty_months', 'cable_included'];

function Compare() {
    const { run, running, cart, compareItems, compareNow, setVariant, settings } = useCompare();
    const navigate = useNavigate();
    const [mode, setMode] = useState('grounded');
    const [diffOnly, setDiffOnly] = useState(false);
    const [showBy, setShowBy] = useState(true);
    const [prio, setPrio] = useState([]);
    const [drawer, setDrawer] = useState(null); // {type, i, k}
    const [added, setAdded] = useState(null);
    const [lunaOpen, setLunaOpen] = useState(false);
    const [hostProducts, setHostProducts] = useState([]);

    useEffect(() => {
    const saved = sessionStorage.getItem('luna-host-selection');

    if (!saved) return;

    try {
        const items = JSON.parse(saved);

        if (Array.isArray(items) && items.length >= 2 && items.length <= 4) {
        setHostProducts(items);
        setLunaOpen(true);
        }
    } catch {
        console.error('Invalid Luna selection');
    }

    sessionStorage.removeItem('luna-host-selection');
    }, []);


    useEffect(() => {
        if (!run && !running) { compareItems().length >= 2 ? compareNow() : navigate('/Cart'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (running || !run) {
        return (
            <main className="bg-gray-100 min-h-screen py-6">
                <div className="max-w-[1200px] mx-auto px-4">
                    <div className="bg-white rounded-sm shadow-sm p-12 text-center text-gray-500 text-sm">
                        <div className="w-7 h-7 border-[3px] border-orange-200 border-t-shopee rounded-full animate-spin mx-auto mb-3" />
                        Applying rules, then sending only unresolved fields to AI{settings.key ? ' (live call)' : ''}…
                    </div>
                </div>
            </main>
        );
    }

    const R = run.results;
    const tot = R.length * FIELDS.length, aiN = R.reduce((a, r) => a + r.needAI.length, 0), calls = R.filter(r => r.needAI.length).length;
    const claims = R.reduce((a, r) => a + FIELDS.reduce((b, f) => b + r.fields[f.key].claims.length, 0), 0);
    const rej = R.reduce((a, r) => a + r.rejected.length, 0);
    const conf = R.reduce((a, r) => a + FIELDS.filter(f => r.fields[f.key].status === 'conflicting').length, 0);
    const miss = R.reduce((a, r) => a + FIELDS.filter(f => r.fields[f.key].status === 'missing').length, 0);
    const rows = [...[PRICE, ...FIELDS].filter(f => prio.includes(f.key)), ...[PRICE, ...FIELDS].filter(f => !prio.includes(f.key))];
    const best = {}; prio.forEach(k => (best[k] = bestValue(R, k)));
    const togglePrio = k => setPrio(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
    const changeVariant = (r, vid) => { const item = cart.find(c => c.lid === r.lid); const next = setVariant(item.id, vid); compareNow({ cartOverride: next }); };
    const close = () => setDrawer(null);

    const cell = (r, i, f) => {
        if (mode === 'generic') {
            if (f.key === 'price') return <div className="px-2 py-1.5"><div className="font-medium text-gray-800">{cellOf(r, 'price').disp}</div></div>;
            const g = GENERIC[r.lid + ':' + r.vid];
            if (!g) return <div className="px-2 py-1.5 text-gray-300">—<div className="text-[11px]">no sample for this variation</div></div>;
            const c = cellOf(r, f.key), flag = !(c.status === 'supported' && c.disp === g[f.key]);
            return (
                <button onClick={() => setDrawer({ type: 'generic', i, k: f.key })} className="w-full text-left px-2 py-1.5 rounded-sm border border-transparent hover:border-gray-200 hover:bg-gray-50">
                    <div className="font-medium text-gray-800">{g[f.key]}</div>
                    {flag && <div className="text-[11px] text-red-600 mt-0.5">⚑ grounded: {c.disp}</div>}
                </button>
            );
        }
        const c = cellOf(r, f.key), isBest = prio.includes(f.key) && best[f.key] !== undefined && c.status === 'supported' && c.value === best[f.key];
        const d = r.disputes[f.key], by = f.key === 'price' ? 'data' : r.fields[f.key].route.route;
        const evn = f.key === 'price' ? 'from selected variation' : c.status === 'supported' ? `${c.x.acc.length} source${c.x.acc.length > 1 ? 's' : ''}` : c.status === 'conflicting' ? c.x.distinct.map(v => fieldDef(f.key).fmt(v)).join(' vs ') : '';
        const tone = isBest ? 'bg-green-50' : c.status === 'conflicting' ? 'bg-amber-50' : '';
        const vtone = isBest ? 'text-green-700' : c.status === 'conflicting' ? 'text-amber-700' : c.status === 'supported' ? (f.key === 'price' ? 'text-shopee' : 'text-gray-800') : 'text-gray-400 italic font-normal';
        return (
            <button onClick={() => setDrawer({ type: 'cell', i, k: f.key })}
                className={`w-full text-left px-2 py-1.5 rounded-sm border border-transparent hover:border-gray-200 hover:bg-gray-50 ${tone} ${showBy && by === 'ai' ? 'shadow-[inset_3px_0_0_#93a5f5]' : ''}`}>
                <div className={`font-medium ${vtone}`}>{c.disp}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{showBy && <ByBadge by={by} />}{evn}</div>
                {d && <span className="inline-block mt-1 text-[11px] text-red-600 bg-red-50 rounded-full px-2">⚑ {d.count} of {d.total} reviews dispute this</span>}
            </button>
        );
    };

    const explain = prio.map(k => {
        const def = fieldDef(k), cs = R.map(r => ({ r, c: cellOf(r, k) }));
        const ok = cs.filter(x => x.c.status === 'supported'), bad = cs.filter(x => x.c.status !== 'supported');
        let line;
        if (!ok.length) line = <>No listing states {def.label.toLowerCase()} clearly.</>;
        else if (def.better === 'true') { const yes = ok.filter(x => x.c.value === true); line = yes.length ? <><b>{yes.map(x => x.r.L.short).join(', ')}</b> include{yes.length === 1 ? 's' : ''} a cable for the selected variation.</> : <>None of the selected variations includes a cable.</>; }
        else {
            const sorted = [...ok].sort((a, b) => (def.better === 'low' ? a.c.value - b.c.value : b.c.value - a.c.value));
            line = <>{def.better === 'low' ? 'Lowest' : 'Highest'} first: {sorted.map((x, j) => <span key={j}>{j > 0 && ' → '}{j === 0 ? <b>{x.r.L.short} {x.c.disp}</b> : `${x.r.L.short} ${x.c.disp}`}</span>)}.</>;
        }
        const why = bad.map(x => `can't rank ${x.r.L.short} (${x.c.status === 'missing' ? 'not stated in listing' : x.c.status === 'conflicting' ? 'listing contradicts itself' : 'could not verify'})`);
        const disp = R.filter(r => r.disputes[k]).map(r => { const d = r.disputes[k]; return `${d.count} of ${d.total} ${r.L.short} reviews say “${TOPICS[d.topic].label.toLowerCase()}”`; });
        return <li key={k} className="my-1"><b>{def.label}:</b> {line}{why.length > 0 && <> Note: {why.join('; ')}.</>}{disp.length > 0 && <span className="text-red-600"> ⚑ {disp.join('; ')}.</span>}</li>;
    });

    const dr = drawer && R[drawer.i];
    return (
        <main className="bg-gray-100 min-h-screen py-3 sm:py-6">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Header */}
                <div className="bg-white rounded-sm shadow-sm mb-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="text-shopee flex-shrink-0"><path fill="currentColor" d="M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6zm2 0v18h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-6 4h2v2H6zm0 4h2v2H6zm8-4h4v2h-4zm0 4h4v2h-4z" /></svg>
                        <h1 className="text-lg sm:text-xl text-shopee font-medium">Shopee Compare</h1>
                        <span className="text-gray-400 text-sm">({R.length} power banks)</span>
                        <div className="ml-auto flex items-center gap-3">
                            <button type="button" onClick={() => setLunaOpen(v => !v)} className="text-xs bg-orange-600 text-white px-3 py-2 rounded">✦ {lunaOpen ? 'Hide Luna' : 'Ask Luna'}</button>
                            <span className="text-[11px] bg-orange-50 text-shopee px-2 py-0.5 rounded-sm">{settings.key ? `AI: live (${settings.model})` : 'AI: cached samples'}</span>
                            <button onClick={() => setDrawer({ type: 'settings' })} className="text-xs text-shopee hover:text-shopee2">⚙ Live AI settings</button>
                            <Link to="/Cart" className="text-xs text-shopee hover:text-shopee2">&lt; Back to Cart</Link>
                        </div>
                    </div>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3 bg-gray-50 text-xs text-gray-600">
                        <div className="flex border border-gray-300 rounded-sm overflow-hidden bg-white">
                            <button onClick={() => setMode('grounded')} className={`px-3 py-1.5 ${mode === 'grounded' ? 'bg-shopee text-white' : 'hover:text-shopee'}`}>Evidence-grounded</button>
                            <button onClick={() => setMode('generic')} className={`px-3 py-1.5 border-l border-gray-300 ${mode === 'generic' ? 'bg-shopee text-white' : 'hover:text-shopee'}`}>Generic AI summary (sample)</button>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-shopee" checked={diffOnly} onChange={e => setDiffOnly(e.target.checked)} />Show only differences</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-shopee" checked={showBy} onChange={e => setShowBy(e.target.checked)} />Show RULE / AI</label>
                        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                            <span className="text-gray-500 mr-1">What matters to you?</span>
                            {PRIO_KEYS.map(k => (
                                <button key={k} onClick={() => togglePrio(k)} className={`px-2.5 py-1 rounded-sm border ${prio.includes(k) ? 'border-shopee text-shopee bg-orange-50' : 'border-gray-300 bg-white hover:border-shopee hover:text-shopee'}`}>{fieldDef(k).label}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {lunaOpen && <LunaWidget key={hostProducts?.map(p => `${p.listing_id}:${p.variant_id}`).join('|') || 'legacy'} products={hostProducts || []} onClose={() => setLunaOpen(false)} />}
                {/* Run log */}
                <div className="bg-white rounded-sm shadow-sm mb-3 px-3 sm:px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                    <span>Run #{run.n}</span>
                    <button onClick={() => setDrawer({ type: 'routing' })} className="text-shopee hover:text-shopee2"><b>{tot - aiN}/{tot}</b> fields settled by rules · <b>{aiN}</b> needed AI · <b>{calls}</b> LLM call{calls === 1 ? '' : 's'} ({settings.key ? 'live' : 'cached'}) — see routing</button>
                    <span>Code checks: <b className="text-gray-700">{claims}</b> claims validated in {run.codeMs.toFixed(1)} ms</span>
                    <button onClick={() => setDrawer({ type: 'rejected' })} className="text-red-600"><b>{rej}</b> claim{rej === 1 ? '' : 's'} rejected</button>
                    <span><b className="text-gray-700">{conf}</b> conflict{conf === 1 ? '' : 's'}</span>
                    <span><b className="text-gray-700">{miss}</b> not stated</span>
                </div>

                {mode === 'generic' && (
                    <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-50 border border-orange-100 rounded-sm mb-3 text-xs text-shopee">
                        This is what an unconstrained LLM summary looks like on the same listings (sample output). Red flags mark values with no matching evidence or that disagree with the grounded result. Tap a cell to see why.
                    </div>
                )}

                {/* Comparison table */}
                <div className="bg-white rounded-sm shadow-sm overflow-x-auto">
                    <table className="w-full min-w-[760px] table-fixed text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 align-top">
                                <th className="w-[160px] bg-gray-50 text-left text-xs text-gray-500 uppercase font-normal p-4">Product</th>
                                {R.map((r, i) => (
                                    <th key={r.lid} className="text-left font-normal p-4">
                                        <div className="flex gap-3">
                                            <ProductThumb listing={r.L} className="w-16 h-16" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    {cart.find(c => c.lid === r.lid)?.mall && <span className="bg-shopee text-white text-[9px] px-1.5 py-0.5 rounded-sm font-medium">Mall</span>}
                                                    <span className="text-sm text-gray-800 font-medium truncate">{r.L.short}</span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{r.L.title}</p>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-1 text-xs text-gray-400 mt-2">Variation:
                                            <select value={r.vid} onChange={e => changeVariant(r, e.target.value)} className="text-xs text-gray-700 border border-gray-200 rounded-sm px-1 py-0.5 outline-none hover:border-shopee cursor-pointer">
                                                {r.L.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                            </select>
                                        </label>
                                        <div className="text-[11px] mt-1.5 flex flex-wrap items-center gap-1.5">
                                            {r.variant.status === 'resolved' ? <span className="text-green-700">✓ Exact variation</span> : <span className="text-red-600">? Variation unresolved</span>}
                                            <span className={`px-1.5 rounded-sm ${SRC[r.source][1]}`} title={r.err || ''}>{SRC[r.source][0]}</span>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">{FIELDS.length - r.needAI.length}/{FIELDS.length} fields by rules · {r.needAI.length} by AI</div>
                                        <div className="text-xs mt-2 flex flex-wrap gap-x-2 gap-y-1">
                                            <button onClick={() => setDrawer({ type: 'listing', i })} className="text-shopee hover:text-shopee2">View listing</button>
                                            <button onClick={() => setDrawer({ type: 'editor', i })} className="text-shopee hover:text-shopee2">Edit listing</button>
                                            <button onClick={() => setDrawer({ type: 'reviews', i })} className="text-shopee hover:text-shopee2">Reviews ({r.rs.total})</button>
                                        </div>
                                        <button onClick={() => setAdded(i)} className="mt-2 w-full border border-shopee text-shopee bg-orange-50 hover:bg-orange-100 text-xs py-1.5 rounded-sm">Add To Cart</button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(f => {
                                if (diffOnly && rowIsSame(R, f.key)) return null;
                                const isP = prio.includes(f.key);
                                return (
                                    <tr key={f.key} className="border-b border-gray-100 align-top">
                                        <th className={`bg-gray-50 text-left font-normal text-sm px-4 py-3 ${isP ? 'text-shopee' : 'text-gray-600'}`}>{isP && '★ '}{f.label}</th>
                                        {R.map((r, i) => <td key={r.lid} className="px-2 py-1.5">{cell(r, i, f)}</td>)}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Trade-offs */}
                {mode === 'grounded' && prio.length > 0 && (
                    <div className="bg-white rounded-sm shadow-sm mt-3 overflow-hidden">
                        <div className="px-3 sm:px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-medium text-gray-700">Trade-offs for your priorities</h3></div>
                        <ul className="list-disc pl-8 pr-4 py-3 text-sm text-gray-700">{explain}</ul>
                        <p className="px-4 pb-3 text-xs text-gray-400">No single “best” product. Rankings use only verified listing values; items that can&apost be verified are named, not guessed.</p>
                    </div>
                )}
                <p className="text-[11px] text-gray-400 mt-3">Sample listings — specs are illustrative, not real product data.</p>
            </div>

            {/* Drawers */}
            {drawer?.type === 'cell' && <Drawer title={`${dr.L.short} · ${fieldDef(drawer.k).label}`} onClose={close}><CellPanel r={dr} k={drawer.k} threshold={settings.threshold} onReviews={() => setDrawer({ type: 'reviews', i: drawer.i })} /></Drawer>}
            {drawer?.type === 'generic' && <Drawer title={`${dr.L.short} · ${fieldDef(drawer.k).label}`} onClose={close}><GenericPanel r={dr} k={drawer.k} onEvidence={() => { setMode('grounded'); setDrawer({ ...drawer, type: 'cell' }); }} /></Drawer>}
            {drawer?.type === 'rejected' && <Drawer title="Rejected AI claims" onClose={close}><RejectedPanel results={R} /></Drawer>}
            {drawer?.type === 'routing' && <Drawer title="Rules vs AI routing" onClose={close}><RoutingPanel results={R} /></Drawer>}
            {drawer?.type === 'reviews' && <Drawer title={`${dr.L.short} · Reviews`} onClose={close}><ReviewsPanel r={dr} /></Drawer>}
            {drawer?.type === 'listing' && <Drawer title={`${dr.L.short} · Raw listing`} onClose={close}><ListingPanel L={dr.L} V={dr.V} /></Drawer>}
            {drawer?.type === 'editor' && <Drawer title={`Edit listing — ${dr.L.short}`} onClose={close}><EditorPanel r={dr} onDone={close} /></Drawer>}
            {drawer?.type === 'settings' && <Drawer title="Live AI settings" onClose={close}><SettingsPanel onDone={close} /></Drawer>}
            {added !== null && (
                <Drawer title="Added to cart" onClose={() => setAdded(null)}>
                    <p><b>{R[added].L.short}</b> · {R[added].V.label} · <span className="text-shopee">{cellOf(R[added], 'price').disp}</span></p>
                    <p className="text-xs text-gray-500 mt-2">Goes back into the normal Shopee checkout flow. The comparison never swaps the seller or product.</p>
                    <Link to="/Checkout" className="inline-block mt-4 bg-shopee hover:bg-shopee2 text-white px-6 py-2 rounded-sm text-sm">Check Out</Link>
                </Drawer>
            )}
        </main>
    );
}

export default Compare;
