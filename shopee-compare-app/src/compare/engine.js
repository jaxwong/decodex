// Shopee Compare engine.
// RULE  = deterministic rules dictionary (regex + Vietnamese/English keywords)
// AI    = LLM, only for fields the rules cannot settle
// CODE  = deterministic validation, unit conversion, conflict detection, ranking
import { AI_BASE, REVIEWS, TOPICS } from './data';

/* ---------------- utils ---------------- */
export const norm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
export const vnd = n => n.toLocaleString('vi-VN') + '₫';
export const clone = o => JSON.parse(JSON.stringify(o));
export function listingHash(L) {
  const s = JSON.stringify([L.title, L.attrs, L.desc, L.variants]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/* ---------------- unit parsing (CODE) ---------------- */
const NUM = '(\\d+(?:[.,]\\d+)?)';
const fixK = s => String(s).replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');
const num = x => parseFloat(x.replace(',', '.'));
function allm(re, s, f) { const out = [], r = new RegExp(re, 'gi'); let m; s = fixK(s); while ((m = r.exec(s))) out.push(f(m)); return out; }
export const PARSE = {
  mah: s => allm(NUM + '\\s*(mah|ah|k)(?![a-z])', s, m => { const n = num(m[1]), u = m[2].toLowerCase(); return Math.round(u === 'mah' ? n : n * 1000); }),
  w: s => allm(NUM + '\\s*w(?![a-z])', s, m => num(m[1])),
  count: s => allm('(\\d+)', s, m => +m[1]).slice(0, 1),
  g: s => allm(NUM + '\\s*(kg|g)(?![a-z])', s, m => Math.round(m[2].toLowerCase() === 'kg' ? num(m[1]) * 1000 : num(m[1]))),
  months: s => allm('(\\d+)\\s*(tháng|thang|months?|năm|nam|years?)', s, m => /^(năm|nam|year)/i.test(m[2]) ? +m[1] * 12 : +m[1]),
  bool: s => { const t = norm(s); if (/^(yes|có|co\b|true|included|tặng)/.test(t)) return [true]; if (/^(no|không|khong|false|not)/.test(t)) return [false]; return []; },
};

/* ---------------- comparison schema (fixed registry for power banks) ---------------- */
export const FIELDS = [
  { key: 'capacity_mah', label: 'Capacity', p: 'mah', fmt: v => v.toLocaleString('en-US') + ' mAh', better: 'high', def: 'Rated battery capacity.' },
  { key: 'max_output_w', label: 'Max output', p: 'w', fmt: v => v + ' W', better: 'high', vs: true, def: 'Maximum advertised output of the selected variant.' },
  { key: 'max_input_w', label: 'Recharge input', p: 'w', fmt: v => v + ' W', better: 'high', vs: true, def: 'Maximum input when recharging the power bank.' },
  { key: 'usbc_ports', label: 'USB-C ports', p: 'count', fmt: v => String(v), better: 'high', def: 'Number of USB-C ports.' },
  { key: 'weight_g', label: 'Weight', p: 'g', fmt: v => v + ' g', better: 'low', vs: true, def: 'Weight of the selected variant.' },
  { key: 'cable_included', label: 'Cable included', p: 'bool', fmt: v => (v ? 'Yes' : 'No'), better: 'true', vs: true, def: 'Whether a cable is in the box for the selected variant.' },
  { key: 'warranty_months', label: 'Warranty', p: 'months', fmt: v => v + ' months', better: 'high', def: 'Warranty length.' },
];
export const PRICE = { key: 'price', label: 'Price', better: 'low', fmt: v => vnd(v) };
export const fieldDef = k => (k === 'price' ? PRICE : FIELDS.find(f => f.key === k));

/* ---------------- RULES dictionary ---------------- */
const RX = {
  mah: /(\d+(?:[.,]\d+)*)\s*(mah|ah)(?![\p{L}])/giu,
  w: /(\d+(?:[.,]\d+)*)\s*w(?![\p{L}])/giu,
  g: /(\d+(?:[.,]\d+)*)\s*(kg|g)(?![\p{L}])/giu,
  months: /(\d+)\s*(tháng|months?|năm|years?)(?![\p{L}])/giu,
  count: /(\d+)\s*(?:x\s*)?(?:cổng\s*)?usb-?c(?![\p{L}\d])/giu,
};
export const RULES = {
  capacity_mah: { rx: 'mah', desc: 'number + “mAh” / “Ah”, anywhere in the listing' },
  max_output_w: { rx: 'w', skip: /sạc vào|đầu vào|input|cáp|cable/iu, variantSrc: true, desc: 'number + “W” in title, variant or description, skipping lines about input or cables' },
  max_input_w: { rx: 'w', kw: /sạc vào|đầu vào|input/iu, desc: 'keyword “sạc vào / đầu vào / input” + number + “W”' },
  usbc_ports: { rx: 'count', desc: 'number (+ “x” / “cổng”) + “USB-C”' },
  weight_g: { rx: 'g', kw: /trọng lượng|khối lượng|weight|nặng/iu, desc: 'keyword “trọng lượng / khối lượng / weight” + number + “g” / “kg”' },
  warranty_months: { rx: 'months', kw: /bảo hành|warranty/iu, desc: 'keyword “bảo hành / warranty” + number + “tháng / năm / months / years”' },
  cable_included: { semantic: true, desc: 'no rule: “is a cable in the box” is stated by meaning (or by omission), not by a number pattern' },
};
const SCOPE_RX = /(^|[\s(])(phiên bản|bản|version)(?=\s)/iu;
export const OPAQUE_VARIANT = /^(option|loại|phân loại|mẫu|kiểu|type|combo)\s*\d+$/iu;

export function srcText(L, V, src) {
  if (src === 'title') return L.title;
  if (src === 'variant') return V.label;
  let m = /^desc:(\d+)$/.exec(src || ''); if (m) return L.desc[+m[1] - 1] ?? null;
  m = /^attr:(.+)$/.exec(src || ''); if (m) return L.attrs[m[1]] ?? null;
  return null;
}
export function srcLabel(src) {
  if (src === 'title') return 'Listing title';
  if (src === 'variant') return 'Selected variant label';
  let m = /^desc:(\d+)$/.exec(src || ''); if (m) return 'Description, line ' + m[1];
  m = /^attr:(.+)$/.exec(src || ''); if (m) return 'Attribute “' + m[1] + '”';
  return src;
}
function ruleSources(L, V, withVariant) {
  const s = [
    { src: 'title', text: L.title, kw: L.title },
    ...Object.entries(L.attrs).map(([k, v]) => ({ src: 'attr:' + k, text: v, kw: k + ': ' + v })),
    ...L.desc.map((d, i) => ({ src: 'desc:' + (i + 1), text: d, kw: d })),
  ];
  if (withVariant) s.push({ src: 'variant', text: V.label, kw: V.label });
  return s;
}
function otherVariantTokens(L, V) {
  const split = l => norm(l).split(/[\s+/]+/).filter(Boolean);
  const all = new Set(L.variants.flatMap(v => split(v.label))), sel = new Set(split(V.label));
  return [...all].filter(t => !sel.has(t) && (/\d/.test(t) || /^(cáp|cable)$/.test(t)));
}
export function ruleExtract(L, V, f) {
  const R = RULES[f.key], others = otherVariantTokens(L, V), out = [];
  for (const s of ruleSources(L, V, R.variantSrc)) {
    if (R.kw && !R.kw.test(s.kw)) continue;
    if (R.skip && R.skip.test(s.text)) continue;
    const rx = new RegExp(RX[R.rx].source, RX[R.rx].flags); let m;
    while ((m = rx.exec(s.text))) {
      let scopeHit = null;
      if (f.vs && s.src !== 'variant') {
        const sm = SCOPE_RX.exec(s.text);
        if (sm) scopeHit = sm[2];
        else { const t = others.find(t => norm(s.text).includes(t)); if (t) scopeHit = t; }
      }
      out.push({ raw: m[0], src: s.src, quote: m[0], scopeHit });
    }
  }
  return out;
}
/* Router: decide per field whether rules are enough or AI is needed */
export function routeField(L, V, f) {
  if (RULES[f.key].semantic) return { route: 'ai', reason: 'Meaning-based field: no reliable rule pattern.', ruleClaims: [] };
  const rc = ruleExtract(L, V, f);
  if (!rc.length) return { route: 'ai', reason: 'No rule matched. AI double-checks the text before we say “Not stated”.', ruleClaims: rc };
  const scoped = rc.filter(c => c.scopeHit);
  if (f.vs && scoped.length) {
    const where = [...new Set(scoped.map(c => '“' + c.scopeHit + '” in ' + srcLabel(c.src).toLowerCase()))].join(', ');
    return { route: 'ai', reason: `Text mixes variants (${where}). AI decides which value belongs to “${V.label}”.`, ruleClaims: rc };
  }
  const vals = new Set(rc.map(c => PARSE[f.p](c.raw)[0]));
  return { route: 'rule', reason: vals.size > 1 ? 'Rules found different values with no variant involved. Code marks the conflict; no AI needed.' : 'Rules found one clear value. No AI needed.', ruleClaims: rc };
}

/* ---------------- AI layer (cached sample or live) ---------------- */
function sysPrompt(need) {
  return `You extract specifications for ONE exact selected marketplace variant of a power bank listing.
Rules:
- Use only the evidence provided. Do not use prior product knowledge. Do not infer typical values.
- Every claim must cite a source id exactly as given in brackets (e.g. "title", "desc:3", "attr:Bảo hành", "variant") and a "quote" that is an EXACT substring copied from that source line.
- Do not borrow a value from another variant unless the evidence says it applies to the selected variant.
- If evidence is absent for a field, return an empty claims array.
- If sources disagree, return ALL claims. Do not resolve conflicts yourself.
- "raw" is a short value string as written, e.g. "100W", "0.42kg", "20Ah", "24 tháng", "2", or "yes"/"no" for cable_included.
Only these fields were left unresolved by deterministic rules; extract ONLY these: ${need.map(k => k + ' (' + fieldDef(k).def + ')').join('; ')}.
Return JSON only:
{"variant":{"label":"<selected variant label, exactly>","model":"<model number or null>","bundle":"<what is included>","confidence":0.0-1.0,"quotes":[{"src":"variant","quote":"..."}]},
 "fields":{"<field>":{"confidence":0.0-1.0,"claims":[{"raw":"...","src":"...","quote":"..."}]}}}`;
}
async function liveExtract(L, V, need, settings) {
  const ev = [`[title] ${L.title}`, ...Object.entries(L.attrs).map(([k, v]) => `[attr:${k}] ${v}`), ...L.desc.map((d, i) => `[desc:${i + 1}] ${d}`), `[variant] ${V.label}`];
  const user = `All variants in this listing: ${L.variants.map(v => v.label).join(' | ')}\nSELECTED variant: ${V.label}\n\nEvidence:\n${ev.join('\n')}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.key },
    body: JSON.stringify({ model: settings.model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sysPrompt(need) }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()).slice(0, 180));
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content);
}
export function makeCache(listings) {
  const c = {};
  for (const k in AI_BASE) c[k] = { hash: listingHash(listings[k.split(':')[0]]), ai: AI_BASE[k] };
  return c;
}
async function getAI(L, lid, vid, need, settings, cache, liveCache) {
  const V = L.variants.find(v => v.id === vid), h = listingHash(L), k = lid + ':' + vid;
  if (liveCache[k + ':' + h]) return { ai: liveCache[k + ':' + h], source: 'live' };
  const c = cache[k];
  if (c && c.hash === h) return { ai: c.ai, source: 'cached' };
  if (settings.key) { const ai = await liveExtract(L, V, need, settings); liveCache[k + ':' + h] = ai; return { ai, source: 'live' }; }
  if (c) return { ai: c.ai, source: 'stale' };
  return { ai: null, source: 'none' };
}

/* ---------------- CODE layer: validation, normalization, conflicts ---------------- */
function resolveVariant(L, V, ai, settings) {
  if (!OPAQUE_VARIANT.test(V.label.trim())) return { status: 'resolved', by: 'rule', why: `Selected variant “${V.label}” read from Shopee's variant data. The label describes itself, so no AI is needed.` };
  if (!ai || !ai.variant) return { status: 'unresolved', why: `Variant label “${V.label}” doesn't say what it is, and no AI output is available.` };
  const av = ai.variant;
  if (norm(av.label) !== norm(V.label)) return { status: 'unresolved', why: `AI resolved “${av.label}” but the buyer selected “${V.label}”.`, av };
  if ((av.confidence ?? 1) < settings.threshold) return { status: 'unresolved', why: 'Variant confidence below threshold.', av };
  return { status: 'resolved', by: 'ai', av };
}
function resolveField(L, V, f, aiF, variantUnresolved, stale, threshold) {
  const acc = [], rej = [], claims = ((aiF && aiF.claims) || []).map(c => ({ ...c }));
  for (const c of claims) {
    let src = srcText(L, V, c.src);
    // Listing edited & cached claims stale: re-locate the exact quote in the edited description (deterministic)
    if (stale && /^desc:/.test(c.src || '') && !(src != null && norm(src).includes(norm(c.quote)))) {
      const hits = L.desc.map((d, i) => (norm(d).includes(norm(c.quote)) ? i : -1)).filter(i => i >= 0);
      if (hits.length === 1) { c.relocated = c.src; c.src = 'desc:' + (hits[0] + 1); src = L.desc[hits[0]]; }
    }
    if (src == null) { rej.push({ ...c, why: 'Unknown source id' }); continue; }
    if (!c.quote || !norm(src).includes(norm(c.quote))) { rej.push({ ...c, why: 'Quoted text does not appear in the listing' }); continue; }
    const vals = PARSE[f.p](c.raw || '');
    if (vals.length !== 1) { rej.push({ ...c, why: vals.length ? 'Ambiguous value' : 'Value could not be parsed' }); continue; }
    const v = vals[0];
    if (f.p !== 'bool' && !PARSE[f.p](c.quote).some(x => Math.abs(x - v) < 1e-9)) { rej.push({ ...c, why: 'Value is not in the quoted text' }); continue; }
    acc.push({ ...c, value: v });
  }
  const distinct = [...new Set(acc.map(a => a.value))];
  let status, value = null, why;
  if (!acc.length) { status = 'missing'; why = claims.length ? 'Every AI claim failed validation, so nothing is shown.' : 'The listing does not state this.'; }
  else if (distinct.length > 1) { status = 'conflicting'; why = 'Listing sources disagree. We show both instead of picking one.'; }
  else if ((aiF.confidence ?? 1) < threshold) { status = 'unverified'; why = `Confidence ${aiF.confidence} is below the ${threshold} threshold.`; }
  else { status = 'supported'; value = distinct[0]; why = 'Value backed by verified listing quotes.'; }
  if (variantUnresolved && f.vs) { status = 'unverified'; value = null; why = 'Exact variant could not be confirmed, so variant-specific fields are withheld.'; }
  return { status, value, acc, rej, conf: aiF?.confidence, claims, why, distinct };
}
export function reviewStats(lid) {
  const R = REVIEWS[lid] || [], counts = {};
  R.forEach(([, t]) => t.forEach(x => (counts[x] = (counts[x] || 0) + 1)));
  return { total: R.length, counts };
}

/* ---------------- full run ---------------- */
export async function runComparison(items, listings, settings, cache, liveCache) {
  const t0 = performance.now();
  const outs = await Promise.all(items.map(async ({ lid, vid }) => {
    const L = listings[lid], V = L.variants.find(v => v.id === vid);
    const routes = {}; FIELDS.forEach(f => (routes[f.key] = routeField(L, V, f)));
    const need = FIELDS.filter(f => routes[f.key].route === 'ai').map(f => f.key);
    let g;
    if (!need.length && !OPAQUE_VARIANT.test(V.label.trim())) g = { ai: null, source: 'notneeded' };
    else { try { g = await getAI(L, lid, vid, need, settings, cache, liveCache); } catch (e) { g = { ai: null, source: 'error', err: e.message }; } }
    return { lid, vid, L, V, g, routes, need };
  }));
  const t1 = performance.now();
  const results = outs.map(({ lid, vid, L, V, g, routes, need }) => {
    const vr = resolveVariant(L, V, g.ai, settings), fields = {}, rejected = [];
    for (const f of FIELDS) {
      const rt = routes[f.key]; let r;
      if (rt.route === 'rule') r = resolveField(L, V, f, { confidence: 1, claims: rt.ruleClaims.map(x => ({ raw: x.raw, src: x.src, quote: x.quote })) }, false, false, settings.threshold);
      else {
        const aiF = g.ai?.fields?.[f.key];
        r = aiF ? resolveField(L, V, f, aiF, vr.status !== 'resolved', g.source === 'stale', settings.threshold)
          : { status: 'unverified', value: null, acc: [], rej: [], claims: [], distinct: [], why: 'Routed to AI, but no AI output is available. Add an API key in Live AI settings.' };
      }
      r.route = rt; fields[f.key] = r; r.rej.forEach(x => rejected.push({ ...x, field: f.label }));
    }
    const rs = reviewStats(lid), disputes = {};
    for (const t in rs.counts) { const d = TOPICS[t]?.disputes; if (d && rs.counts[t] >= 2) disputes[d] = { topic: t, count: rs.counts[t], total: rs.total }; }
    return { lid, vid, L, V, source: g.source, err: g.err, variant: vr, fields, rejected, disputes, rs, needAI: need };
  });
  return { results, aiMs: t1 - t0, codeMs: performance.now() - t1 };
}

/* ---------------- view helpers ---------------- */
export function cellOf(r, key) {
  if (key === 'price') return { status: 'supported', value: r.V.price, disp: vnd(r.V.price) };
  const f = fieldDef(key), x = r.fields[key];
  const disp = x.status === 'supported' ? f.fmt(x.value) : x.status === 'missing' ? 'Not stated' : x.status === 'conflicting' ? '⚠ Conflicting' : '? Could not verify';
  return { status: x.status, value: x.value, disp, x };
}
export function bestValue(results, key) {
  const def = fieldDef(key);
  const vals = results.map(r => cellOf(r, key)).filter(c => c.status === 'supported').map(c => c.value);
  if (vals.length < 2) return undefined;
  if (def.better === 'true') return vals.includes(true) ? true : undefined;
  const b = def.better === 'low' ? Math.min(...vals) : Math.max(...vals);
  return vals.every(v => v === b) ? undefined : b;
}
export function rowIsSame(results, key) {
  const cs = results.map(r => cellOf(r, key));
  return cs.every(c => c.status === 'supported') && new Set(cs.map(c => c.value)).size === 1 && !results.some(r => r.disputes[key]);
}
