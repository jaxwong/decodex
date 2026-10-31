import React, { useEffect, useState } from 'react';
import { REVIEWS, TOPICS, GENERIC } from './data';
import { FIELDS, RULES, cellOf, fieldDef, srcLabel, srcText } from './engine';
import { useCompare } from './CompareContext';

/* ---------- shared bits ---------- */
export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[520px] bg-white z-[70] shadow-2xl flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-medium text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-shopee text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
      </aside>
    </>
  );
}
const Sec = ({ children }) => <div className="mt-5 mb-2 text-[11px] font-medium tracking-wide uppercase text-gray-500">{children}</div>;
const EvBox = ({ bad, label, children }) => (
  <div className={`border rounded-sm px-3 py-2 my-1.5 ${bad ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
    {label && <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>}
    <div className="text-gray-800">{children}</div>
  </div>
);
export const ByBadge = ({ by }) => {
  const m = { ai: ['AI', 'bg-blue-50 text-[#1d4ed8]'], rule: ['RULE', 'bg-green-50 text-green-700'], code: ['CODE', 'bg-slate-100 text-slate-600'], data: ['DATA', 'bg-slate-100 text-slate-600'] }[by];
  return <span className={`inline-block text-[9.5px] font-bold tracking-wide px-1 rounded-sm mr-1.5 ${m[1]}`}>{m[0]}</span>;
};
function Mark({ text, quote }) {
  const t = String(text ?? ''), i = quote ? t.toLowerCase().indexOf(String(quote).toLowerCase()) : -1;
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark className="bg-yellow-200 px-0.5">{t.slice(i, i + quote.length)}</mark>{t.slice(i + quote.length)}</>;
}
const Trace = ({ steps }) => (
  <ul className="text-[12.5px]">
    {steps.map(([t, s], i) => (
      <li key={i} className="grid grid-cols-[48px_1fr] gap-2 py-1.5 border-b border-dashed border-gray-200">
        <span><ByBadge by={t} /></span><span className="text-gray-700">{s}</span>
      </li>
    ))}
  </ul>
);
const SRC_TXT = { cached: 'cached sample output', live: 'live model call', stale: 'cached output from the original listing (listing was edited)', none: 'none', error: 'error', notneeded: '' };

/* ---------- cell detail ---------- */
export function CellPanel({ r, k, threshold, onReviews }) {
  if (k === 'price') return (
    <>
      <div className="text-3xl font-bold text-shopee my-1">{cellOf(r, 'price').disp}</div>
      <p className="text-gray-500 text-xs"><ByBadge by="data" />Read directly from the selected variation (“{r.V.label}”). Prices are never extracted by AI.</p>
    </>
  );
  const f = fieldDef(k), c = cellOf(r, k), x = c.x, rt = x.route, d = r.disputes[k], RD = RULES[k];
  const steps = [];
  steps.push(['code', r.variant.by === 'rule' ? `Variation “${r.V.label}” read from Shopee variant data (label describes itself)` : r.variant.status === 'resolved' ? '✓ AI-resolved variation matches buyer selection' : '✗ ' + r.variant.why]);
  steps.push(['rule', RD.semantic ? `No rule exists for this field: ${RD.desc}` : rt.ruleClaims.length
    ? <>Rules dictionary ({RD.desc}) matched:{rt.ruleClaims.map((a, i) => <span key={i} className="block">· “{a.quote}” in {srcLabel(a.src).toLowerCase()}{a.scopeHit && <span className="text-red-600"> — mentions variation “{a.scopeHit}”</span>}</span>)}</>
    : `Rules dictionary (${RD.desc}) matched nothing`]);
  steps.push(['code', <>Router → <b>{rt.route === 'ai' ? 'send to AI' : 'rules are enough, no AI'}</b>. {rt.reason}</>]);
  if (rt.route === 'ai') steps.push(['ai', ['cached', 'live', 'stale'].includes(r.source)
    ? <>Extractor (only this field + listing text) → {x.claims.length} claim{x.claims.length === 1 ? '' : 's'}{x.claims.map((a, i) => <span key={i} className="block">· raw “{a.raw}” ← {srcLabel(a.src)}</span>)}<span className="text-gray-400"> · {SRC_TXT[r.source]}</span></>
    : 'No AI output available']);
  x.claims.forEach(a => {
    const ok = x.acc.find(b => b.src === a.src && b.quote === a.quote && b.raw === a.raw);
    const rj = x.rej.find(b => b.src === a.src && b.quote === a.quote && b.raw === a.raw);
    steps.push(['code', ok ? <><span className="text-green-700">✓</span> Quote found in {srcLabel(a.src)}{a.relocated ? ` (moved from ${srcLabel(a.relocated)} after edit)` : ''}; parsed “{a.raw}” → {f.fmt(ok.value)}</>
      : <><span className="text-red-600">✗</span> {rj?.why || 'rejected'} (“{a.quote}”)</>]);
  });
  steps.push(['code', x.status === 'conflicting' ? <>Conflict check: {x.distinct.length} different values → <b>Conflicting</b></> : x.acc.length ? 'Conflict check: all verified claims agree' : <>No verified claims → <b>{c.disp}</b></>]);
  if (rt.route === 'ai' && x.acc.length && x.status !== 'conflicting') steps.push(['code', `Confidence policy: ${x.conf} vs threshold ${threshold} → ${x.status === 'unverified' ? 'withheld' : 'shown'}`]);
  if (d) steps.push(['code', `Review check: ${d.count}/${d.total} reviews tagged “${d.topic}” ≥ 2 → flag`]);

  return (
    <>
      <div className="text-xs text-gray-500">{f.def}</div>
      <div className={`text-2xl font-bold my-1 ${x.status === 'conflicting' ? 'text-amber-700' : x.status === 'supported' ? 'text-gray-900' : 'text-gray-400'}`}>{c.disp}</div>
      <div className="text-xs text-gray-600"><ByBadge by={rt.route} />{x.why}</div>
      {x.acc.length > 0 && <>
        <Sec>{x.status === 'conflicting' ? 'What the listing says' : 'Evidence'}</Sec>
        {x.acc.map((a, i) => <EvBox key={i} label={<>{srcLabel(a.src)} → <b>{f.fmt(a.value)}</b></>}><Mark text={srcText(r.L, r.V, a.src)} quote={a.quote} /></EvBox>)}
        {x.status === 'conflicting' && <p className="text-xs text-gray-500 bg-gray-50 rounded-sm px-3 py-2 mt-2">We couldn't verify which applies. The comparison does not pick one silently.</p>}
      </>}
      {x.rej.length > 0 && <>
        <Sec>Rejected AI claims</Sec>
        {x.rej.map((a, i) => <EvBox key={i} bad label={<>AI claimed <b>{a.raw}</b> citing {srcLabel(a.src)}</>}>“{a.quote}”<div className="text-xs text-red-600 mt-1">✗ {a.why}</div></EvBox>)}
      </>}
      {d && <>
        <Sec>Buyer reviews</Sec>
        <EvBox bad>⚑ <b>{d.count} of {d.total}</b> reviews say “{TOPICS[d.topic].label.toLowerCase()}”. <button className="text-shopee text-xs" onClick={onReviews}>See reviews</button></EvBox>
      </>}
      <Sec>How this cell was produced</Sec>
      <Trace steps={steps} />
    </>
  );
}

/* ---------- generic AI comparison ---------- */
export function GenericPanel({ r, k, onEvidence }) {
  const f = fieldDef(k), g = GENERIC[r.lid + ':' + r.vid][k], c = cellOf(r, k);
  let expl = 'The generic summary matches the grounded value.';
  if (!(c.status === 'supported' && c.disp === g)) {
    if (c.status === 'missing') expl = `The listing never states this. The generic summary shows “${g}” anyway, likely from model memory or another product.`;
    else if (c.status === 'conflicting') expl = `The listing contradicts itself (${c.x.distinct.map(f.fmt).join(' vs ')}). The generic summary silently picked “${g}”.`;
    else if (c.status === 'supported') expl = `The evidence for “${r.V.label}” says ${c.disp}. “${g}” is not what this listing states for that variation${f.vs ? ', likely borrowed from another variation in the same listing' : ''}.`;
    else expl = `Shopee Compare could not verify this; the generic summary still shows “${g}”.`;
  }
  return (
    <>
      <Sec>Generic AI said</Sec><div className="text-2xl font-bold">{g}</div>
      <Sec>Shopee Compare</Sec><div className="text-xl font-bold">{c.disp}</div>
      <p className="mt-3 text-gray-700">{expl}</p>
      <button onClick={onEvidence} className="mt-4 border border-shopee text-shopee px-4 py-1.5 rounded-sm text-sm hover:bg-orange-50">See evidence</button>
    </>
  );
}

/* ---------- lists ---------- */
export function RejectedPanel({ results }) {
  const all = results.flatMap(r => r.rejected.map(x => ({ ...x, who: r.L.short })));
  return (
    <>
      <p className="text-xs text-gray-500">Claims the AI produced that code refused to show. This is the guardrail working, not an error.</p>
      {all.length ? all.map((a, i) => <EvBox key={i} bad label={<>{a.who} · {a.field} · AI claimed <b>{a.raw}</b> citing {srcLabel(a.src)}</>}>“{a.quote}”<div className="text-xs text-red-600 mt-1">✗ {a.why}</div></EvBox>) : <p className="mt-3">None in this run.</p>}
    </>
  );
}
export function ReviewsPanel({ r }) {
  const rs = r.rs, R = REVIEWS[r.lid] || [];
  return (
    <>
      <p className="text-xs text-gray-500">AI tags each review with topics (cached sample). Code counts them; the model never writes the numbers. Reviews are listing-level and may cover other variations.</p>
      <div className="mt-3 space-y-2.5">
        {Object.entries(rs.counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
          <div key={t} className="grid grid-cols-[1fr_70px] gap-2 items-center">
            <div>
              <div className="text-sm">{TOPICS[t].label}{TOPICS[t].disputes && n >= 2 && <span className="ml-2 text-[10px] text-red-600 bg-red-50 rounded-full px-2 py-0.5">disputes listing</span>}</div>
              <div className="h-1.5 bg-gray-100 rounded mt-1"><div className="h-1.5 bg-shopee rounded" style={{ width: (n / rs.total) * 100 + '%' }} /></div>
            </div>
            <div className="text-xs text-gray-600"><b>{n}</b> of {rs.total}</div>
          </div>
        ))}
      </div>
      <Sec>Reviews</Sec>
      {R.map(([t, tags], i) => (
        <div key={i} className="py-2 border-b border-gray-100">
          <div className="text-yellow-500 text-xs">★★★★★</div>
          {tags.map(x => <span key={x} className="text-[10px] text-[#1d4ed8] bg-blue-50 rounded-full px-1.5 mr-1">{x}</span>)}{t}
        </div>
      ))}
    </>
  );
}
export function RoutingPanel({ results }) {
  return (
    <>
      <p className="text-xs text-gray-500">Every field goes through the rules dictionary first. A field goes to AI only when (1) it is stated by meaning, not a number; (2) the text mixes several variations; or (3) no rule matched and AI double-checks before we say “Not stated”. AI output then passes the same code checks.</p>
      <table className="w-full mt-3 text-xs">
        <thead><tr><th></th>{results.map(r => <th key={r.lid} className="text-left font-medium p-1 align-top">{r.L.short}<div className="text-gray-400 font-normal">{r.V.label}</div></th>)}</tr></thead>
        <tbody>
          {FIELDS.map(f => (
            <tr key={f.key} className="border-t border-gray-100">
              <th className="text-left font-medium p-1 align-top">{f.label}</th>
              {results.map(r => { const rt = r.fields[f.key].route; return <td key={r.lid} className="p-1 align-top"><ByBadge by={rt.route} /><div className="text-gray-500 mt-0.5">{rt.reason}</div></td>; })}
            </tr>
          ))}
        </tbody>
      </table>
      <Sec>Rules dictionary</Sec>
      {FIELDS.map(f => <div key={f.key} className="text-xs my-1"><b>{f.label}:</b> {RULES[f.key].desc}{f.vs && <span className="text-gray-400"> · variation-sensitive</span>}</div>)}
      <p className="text-xs text-gray-500 bg-gray-50 rounded-sm px-3 py-2 mt-3">Try it: in “Edit listing” for Baseus, add a line “Trọng lượng: 300g”. The weight is then settled by rules, with no AI call.</p>
    </>
  );
}
export function ListingPanel({ L, V }) {
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">This is what the buyer sees today: seller-written text.</p>
      <EvBox label="Title">{L.title}</EvBox>
      <EvBox label="Variations">{L.variants.map((v, i) => <span key={v.id}>{i > 0 && ' · '}{v.id === V.id ? <b>▸ {v.label}</b> : v.label}</span>)}</EvBox>
      <EvBox label="Attributes">{Object.entries(L.attrs).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</EvBox>
      <EvBox label="Description">{L.desc.map((d, i) => <div key={i}><span className="text-gray-400 text-xs mr-1">{i + 1}</span>{d}</div>)}</EvBox>
    </>
  );
}

/* ---------- editor & settings ---------- */
export function EditorPanel({ r, onDone }) {
  const { listings, updateListing, resetListing, compareNow, settings } = useCompare();
  const L = listings[r.lid];
  const [title, setTitle] = useState(L.title);
  const [attrs, setAttrs] = useState(Object.entries(L.attrs).map(([k, v]) => k + ': ' + v).join('\n'));
  const [desc, setDesc] = useState(L.desc.join('\n'));
  const save = () => {
    const a = {}; attrs.split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) a[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    const next = updateListing(r.lid, { ...L, title: title.trim(), attrs: a, desc: desc.split('\n').map(s => s.trim()).filter(Boolean) });
    compareNow({ listingsOverride: next }); onDone();
  };
  const reset = () => { const next = resetListing(r.lid); compareNow({ listingsOverride: next }); onDone(); };
  const inp = 'w-full border border-gray-300 rounded-sm px-2 py-1.5 text-sm outline-none focus:border-shopee';
  return (
    <>
      <p className="text-xs text-gray-500">Change the seller's text and re-run. Rules re-run on your edited text immediately. {settings.key ? 'Fields that still need AI are sent to the model live.' : 'Fields that need AI reuse their cached claims, and code re-checks every quote against your edits. Add a key in Live AI settings to re-extract those too.'}</p>
      <label className="block text-xs text-gray-500 mt-3 mb-1">Title</label><input className={inp} value={title} onChange={e => setTitle(e.target.value)} />
      <label className="block text-xs text-gray-500 mt-3 mb-1">Attributes (one per line, “Key: value”)</label><textarea className={inp + ' h-24'} value={attrs} onChange={e => setAttrs(e.target.value)} />
      <label className="block text-xs text-gray-500 mt-3 mb-1">Description (one line per row; line numbers are evidence ids)</label><textarea className={inp + ' h-52'} value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="flex gap-2 mt-3">
        <button onClick={save} className="bg-shopee hover:bg-shopee2 text-white px-4 py-2 rounded-sm text-sm">Save &amp; re-run</button>
        <button onClick={reset} className="border border-shopee text-shopee px-4 py-2 rounded-sm text-sm hover:bg-orange-50">Reset to original</button>
      </div>
    </>
  );
}
export function SettingsPanel({ onDone }) {
  const { settings, setSettings, compareNow } = useCompare();
  const [s, setS] = useState(settings);
  const inp = 'w-full border border-gray-300 rounded-sm px-2 py-1.5 text-sm outline-none focus:border-shopee';
  return (
    <>
      <p className="text-xs text-gray-500">Optional. With an OpenAI API key, fields the rules can't settle are extracted live. The key stays in this page's memory and is sent only to api.openai.com. For a public demo link, move this call to a small server function so the key isn't in the browser.</p>
      <label className="block text-xs text-gray-500 mt-3 mb-1">OpenAI API key</label><input type="password" className={inp} value={s.key} placeholder="sk-..." onChange={e => setS({ ...s, key: e.target.value.trim() })} />
      <label className="block text-xs text-gray-500 mt-3 mb-1">Model</label><input className={inp} value={s.model} onChange={e => setS({ ...s, model: e.target.value })} />
      <label className="block text-xs text-gray-500 mt-3 mb-1">Confidence threshold: <b>{s.threshold}</b></label>
      <input type="range" min="0.3" max="0.95" step="0.05" value={s.threshold} onChange={e => setS({ ...s, threshold: +e.target.value })} className="w-full accent-shopee" />
      <p className="text-xs text-gray-500">Raising the threshold shows less, but more of what is shown is right.</p>
      <button onClick={() => { setSettings(s); compareNow({ settingsOverride: s }); onDone(); }} className="mt-3 bg-shopee hover:bg-shopee2 text-white px-4 py-2 rounded-sm text-sm">Save</button>
    </>
  );
}
