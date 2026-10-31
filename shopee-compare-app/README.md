# Shopee Compare — Luna Host A

This Vite app is the Shopee-style Host A for the shared `@luna/widget` workspace package.
The supported flow is: open `#/Cart` → tick 2–4 products → **Compare now** →
compare → set a constraint that excludes a listing → top-bar **Seller Centre** → choose the
listing to see why buyers dropped it. Luna uses only relative
`/api` calls; model keys, evidence, ranking and seller counts remain on `services/luna-api`.

Host A has one comparison owner. `src/components/Section/Compare.jsx` is a thin route that
mounts `LunaWidget`; the former `src/compare` provider, browser ranking, sample data, panels and
direct OpenAI call have been deleted. Cart rows are exact backend catalog variants: the cart
renders their titles and prices from `/api/catalog` and hands the ticked listing/variant IDs to
Luna, which pre-ticks them. Cart text is never submitted as evidence.

## Run it

Install from the repository root so the shared widget and Host B resolve from one lockfile:

```bash
npm install
make frontend-build
npm run dev --workspace shopee-compare  # http://localhost:5173/#/Cart
```

Open `#/Cart`, tick 2–4 products and press **Compare now**. Luna opens with those variants
already picked; adjust the picks if you like, then press the compare button for the selected
count. **View product** opens Host A's exact canonical product preview
without unmounting the comparison. It lists all normalized specifications and the exact seller
source text/location for each supported or conflicting value; missing values explicitly have no
verified source. The view makes no new API/model call, and the demo does not invent a Shopee URL.

## Where the feature lives

```
src/components/Section/cart.jsx     catalog-backed demo cart and Compare entry point
src/components/Section/Compare.jsx  thin #/Compare route that mounts @luna/widget
src/components/Section/SellerCentre.jsx  thin #/SellerCentre route that mounts SellerGapReport
src/components/Navigation/Nav.jsx   top-bar Seller Centre link
src/lunaHostAdapter.js              Host A bridge: cart selections in, product view out
packages/luna-widget/               canonical browser comparison UI
services/luna-api/                  canonical evidence, ranking and model boundary
```

## Server-owned AI

The browser has no API-key field and makes no direct OpenAI request. Luna text and GPT-Live
requests are server-owned and read only the root `.env` through FastAPI.

GPT-Live browser controls exist inside `@luna/widget`. One authorized real microphone turn
produced captions and incremented the canonical comparison from revision 0 to 1, but no audible
response was heard. G4 failed, was not retried, and voice is not a demo claim.

## Credits / declarations

The Shopee-style UI shell (nav, footer, cart layout, landing pages, images) comes from the open-source clone [neoB23/Shopee_E-commerce-Clone](https://github.com/neoB23/Shopee_E-commerce-Clone) (React + Vite + Tailwind). The Luna comparison route, adapter and shared widget integration are new.

Sample listings and reviews are illustrative and are not real product data.
