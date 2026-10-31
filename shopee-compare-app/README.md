# Shopee Compare — Luna Host A

This Vite app is the Shopee-style Host A for the shared `@luna/widget` workspace package.
The demo walk is: search **power bank** on the home page → open a product → pick a model and
**Add To Cart** → cart → tick 2–4 products → **Compare now** (Luna opens on their comparison) →
**Choose this one** → Checkout → **Place Order**. Seller insight is the top-bar **Seller Centre**.
Luna uses only relative `/api` calls; model keys, evidence, ranking and seller counts remain on
`services/luna-api`.

Luna's backend catalog is the only product source. `src/shop.jsx` loads it once and keeps the
cart, whose rows are exact listing/variant IDs; every page renders titles, images and prices
from the catalog. Search, product page, cart and checkout never become comparison evidence:
Luna builds evidence server-side from the provider.

## Run it

Install from the repository root so the shared widget and Host B resolve from one lockfile. Root
`package.json` and `package-lock.json` are the only npm workspace/lock owners.

```bash
npm install
make frontend-build
npm run dev --workspace shopee-compare  # http://localhost:5173/
```

- **Search** (`#/Search?q=`) asks `GET /api/catalog?q=`, which matches listing titles.
- **Product page** (`#/Product/:listingId?variant=`) shows the seller's listing as shoppers see
  it, from `GET /api/catalog/{listing_id}`: image, rating, price (a range until a model is
  picked), shop voucher, shipping, model buttons, quantity, specifications exactly as written,
  description and paged star reviews. These are unverified seller claims; Luna's checked values
  live in the comparison.
- **Compare now** hands the ticked IDs to Luna. With 2–4 ticked, Luna shows those products
  loading and then the table; with fewer, its picker with them picked. **View product** opens the
  same product page over the comparison, so closing it returns to the same comparison.
- **Choose this one** (the widget's optional `requestAddToCart`) checks out exactly that variant.
  Checkout applies each listing's voucher and shipping once per line, so one unit costs Luna's
  delivered total. Payment is cash on delivery only; nothing is charged or shipped.

## Where the feature lives

```
src/shop.jsx                              catalog load, storefront session and cart (one owner)
src/components/SubNavigation/SubNav.jsx   search box, catalog search chips, cart badge
src/components/Section/SearchResults.jsx  #/Search results grid
src/components/Section/ProductPage.jsx    #/Product page and the overlay used by Compare
src/components/Section/cart.jsx           catalog-backed cart and Compare entry point
src/components/Section/Compare.jsx        #/Compare route that mounts @luna/widget
src/components/Section/Checkout.jsx       checkout of the handed-over lines
src/components/Section/SellerCentre.jsx   #/SellerCentre route that mounts SellerGapReport
src/lunaHostAdapter.js                    cart selections in; product view and checkout out
packages/luna-widget/                     canonical browser comparison UI
services/luna-api/                        canonical catalog, evidence, ranking and model boundary
```

## Server-owned AI

The browser has no API-key field and makes no direct OpenAI request. Luna text and GPT-Live
requests are server-owned and read only the root `.env` through FastAPI.

GPT-Live browser controls exist inside `@luna/widget`. One authorized real microphone turn
produced captions and incremented the canonical comparison from revision 0 to 1, but no audible
response was heard. G4 failed, was not retried, and voice is not a demo claim.

## Credits / declarations

The Shopee-style UI shell (nav, footer, landing pages, images) comes from the open-source clone [neoB23/Shopee_E-commerce-Clone](https://github.com/neoB23/Shopee_E-commerce-Clone) (React + Vite + Tailwind). Search, product page, cart, checkout, the Luna comparison route, adapter and shared widget integration are new.

Sample listings, product images (drawn renders of fictional products) and reviews are illustrative and are not real product data.
