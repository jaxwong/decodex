# Shopee Compare

Evidence-grounded product comparison inside a Shopee-style cart. Buyers tick **Compare** on 2–4 cart items, pick the exact variation, and get a side-by-side table where every value traces back to the seller's own listing text.

**Rules first, AI only where rules can't settle a field.** A deterministic rules dictionary (regex + Vietnamese/English keywords) extracts hard facts. A field is sent to the LLM only when:

1. it is stated by meaning, not a number (e.g. "is a cable in the box?"),
2. the listing text mixes several variations (e.g. "Bản 100W: 420g. Bản 130W: 498g."), or
3. no rule matched, so AI double-checks before the table says "Not stated".

All AI output then passes the same code checks: the quote must exist in the listing, the value is parsed by code, conflicts are found by code, and confidence decides only whether to withhold a value.

## Run it

No local install needed. Use GitHub Codespaces or any machine with Node 18+:

```bash
npm install
npm run dev            # http://localhost:5173/#/Cart
npm run build          # static site in dist/ (works on GitHub Pages / Vercel / Netlify)
npm run build:single   # one self-contained preview file: dist-single/index.html
```

Open `#/Cart`, tick **Compare** on 2–4 power banks, then press **Compare now**.

## Where the feature lives

```
src/compare/
  data.js            sample listings (illustrative specs), cached sample AI output, reviews
  engine.js          rules dictionary, router, unit parsing, validation, conflicts, live LLM call
  CompareContext.jsx cart + compare state, runComparison()
  Panels.jsx         evidence / trace / routing / reviews / editor / settings drawers
  ProductThumb.jsx   illustrated thumbnails (no real product photos)
src/components/Section/
  cart.jsx           cart with Compare toggles, variation picker, compare bucket
  Compare.jsx        comparison page (#/Compare)
```

## Live AI (optional)

Under **⚙ Live AI settings** on the compare page, paste an OpenAI API key and set a model name. Only the fields the rules couldn't settle are sent to the model. The key stays in browser memory. Before you share a public demo link, move this call to a server function.

## Credits / declarations

The Shopee-style UI shell (nav, footer, cart layout, landing pages, images) comes from the open-source clone [neoB23/Shopee_E-commerce-Clone](https://github.com/neoB23/Shopee_E-commerce-Clone) (React + Vite + Tailwind). Everything under `src/compare/`, `Compare.jsx`, and the compare additions to `cart.jsx` are new.

Sample listings and reviews are illustrative and are not real product data.
