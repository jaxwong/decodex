# Shopee Compare — Luna Host A

This Vite app is the Shopee-style Host A for the shared `@luna/widget` workspace package.
The supported Luna flow is: open `#/Cart` → Compare → **Ask Luna**. Luna then uses only
relative `/api` calls; model keys and ranking remain on `services/luna-api`.

The older `src/compare` implementation still renders the surrounding legacy comparison and
contains browser API-key settings. It is superseded, must not be used for the Luna demo, and
must be deleted when the shared widget becomes Host A's sole compare owner.

Evidence-grounded product comparison inside a Shopee-style cart. Buyers tick **Compare** on 2–4 cart items, pick the exact variation, and get a side-by-side table where every value traces back to the seller's own listing text.

**Rules first, AI only where rules can't settle a field.** A deterministic rules dictionary (regex + Vietnamese/English keywords) extracts hard facts. A field is sent to the LLM only when:

1. it is stated by meaning, not a number (e.g. "is a cable in the box?"),
2. the listing text mixes several variations (e.g. "Bản 100W: 420g. Bản 130W: 498g."), or
3. no rule matched, so AI double-checks before the table says "Not stated".

All AI output then passes the same code checks: the quote must exist in the listing, the value is parsed by code, conflicts are found by code, and confidence decides only whether to withhold a value.

## Run it

Install from the repository root so the shared widget and Host B resolve from one lockfile:

```bash
npm install
make frontend-build
npm run dev --workspace shopee-compare  # http://localhost:5173/#/Cart
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

## Legacy browser AI — do not use

The **⚙ Live AI settings** control belongs to the superseded `src/compare` path. Never paste an
API key into it. Current Luna text and GPT-Live requests are server-owned and read only the root
`.env` through FastAPI.

GPT-Live browser controls exist inside `@luna/widget`, but voice is not a demo claim until a
real microphone turn invokes the backend sideband tool and visibly increments the canonical
comparison revision. Deterministic Playwright proves wiring and text fallback only.

## Credits / declarations

The Shopee-style UI shell (nav, footer, cart layout, landing pages, images) comes from the open-source clone [neoB23/Shopee_E-commerce-Clone](https://github.com/neoB23/Shopee_E-commerce-Clone) (React + Vite + Tailwind). Everything under `src/compare/`, `Compare.jsx`, and the compare additions to `cart.jsx` are new.

Sample listings and reviews are illustrative and are not real product data.
