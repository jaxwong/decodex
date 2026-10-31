# `@luna/widget`

This package is the only browser owner of Luna comparison UI, API calls, evidence/citation
rendering, seller insights and GPT-Live WebRTC media. It imports neither demo host.

## Host contract

Mount `LunaWidget` with a stable adapter:

```jsx
import { LunaWidget } from '@luna/widget';

<LunaWidget adapter={hostAdapter} apiBaseUrl="/api" />
```

The adapter supplies:

- `hostId`: non-empty host identity;
- `getCurrentSelections()`: an array of at most four `{ listingId, variantId }` the host has
  already chosen, empty when none. When all are in the catalog and there are 2–4, the widget
  compares them immediately; otherwise it picks those it finds and reports any it does not;
- `onSelectionChange(callback)`: subscribe and return an unsubscribe function;
- `navigateToListing(product)`: host-owned product view for the exact canonical snapshot. It
  includes identity, title, variant, synthetic status, the server-owned delivered-price
  breakdown and every normalized specification. Each listed price component and each supported
  or conflicting specification carries its exact evidence source text/location; and
- optional `requestAddToCart(selection)`: when supplied, each comparison column shows **Pick
  this one**; the widget calls it only on that press and requires `{ ok: boolean }` back. The host
  decides what follows (Host A returns to its cart with only that variant ticked; picking is not
  buying).

When `getCurrentSelections()` hands over 2–4 available variants, the host owns picking: the
widget builds the comparison at start-up and never shows its own picker. If that build fails or
the comparison is later lost, it shows the same picks with **Build the comparison again**. The
picker appears only for hosts that hand over fewer than two picks (Host B).

Invalid adapters and selections fail at the package boundary. The widget owns only its
comparison bucket/view state. The API owns evidence, preferences, recommendation and revision.
Hosts own routes, selection context, cart and checkout.

## Delivered-price presentation

The comparison row keeps the API field key `price_minor` for revision focus compatibility, but
labels and displays it as **Delivered price** using the server-validated `landed_price_minor`.
Every price cell opens the same four-line list price, shop voucher, shipping and delivered-total
breakdown. The visible disclaimer is fixed: "Assumes listed shipping and shop voucher." The
widget never calculates the delivered total, changes shipping, or guesses coin, platform-voucher
or buyer-specific eligibility.

The demo hosts keep the widget mounted when showing a product: Host B renders the cited
snapshot, and Host A opens its storefront product page over the comparison. A production host
may navigate to its authorized listing route using `listingId` and `variantId`; the widget never
invents a marketplace URL. Opening a preview makes no new API or model call. The delivered total
is labelled as arithmetic over the cited list-price, shop-voucher and shipping records.
Missing/unresolved specifications have no fabricated citation; the host explicitly says no
verified source exists.

## Session renewal

The API keeps demo sessions in memory, so a server restart or the one-hour expiry forgets them.
The widget always sends a token, so any 401 means its session is gone. Creating a comparison or
reading a seller report then starts a new session and sends that request once more; the server
rejected the first attempt before doing any work. A comparison-bound call (ask, refresh) cannot
recover the lost comparison, so the widget keeps the same products picked and says so: a
host-picked comparison offers **Build the comparison again**, the picker otherwise. Whenever start-up issues a new session it also drops any comparison held
from the previous one.

## Seller report ownership

Buyers never see seller insights. A host mounts `SellerGapReport` on its own seller page:

```jsx
import { SellerGapReport } from '@luna/widget';

<SellerGapReport apiBaseUrl="/api" />
```

It starts its own demo session, lists the catalog's listings and fetches the chosen listing's
gap report. The server counts every buyer comparison in all active sessions and returns the
listing text behind each gap, so the page renders it inline without the buyer evidence panel.
Hosts do not fetch, recount or reinterpret seller insights, and the report never exposes buyer
identity, conversation, budget or preferences. There is no seller login: the page is labelled a
demo seller view and any listing can be opened; it opens on the first listing.

## Seller questions

**Ask seller** on a missing cell asks the buyer to confirm, then `POST
/api/listings/{listing_id}/variants/{variant_id}/questions` opens one fixed-wording question per
variant field. The buyer's widget lists it under **Waiting on the seller** and never shows an
answer form. **Check for the seller's answer** reads `GET /api/listings/{listing_id}/questions`
(one read per asked listing, at most four) and, when the question is no longer open, rebuilds
the same variants into a new comparison that cites the answer. The answer form is
`SellerGapReport`'s **Buyer questions** section, which posts `seller-replies`; nothing seller-side
renders in the buyer widget.

## Live ownership

The browser creates one `RTCPeerConnection`, one microphone stream and the `oai-events` data
channel. It marks connected only after `session.started`, displays transcript deltas as
provisional, and closes only after `session.closed` or an explicit incomplete-finalization
error. It never executes tools. The authenticated server sideband is the sole tool executor.

Offline browser tests do not prove provider audio or tool mutation. The one authorized real run
showed microphone input, captions, sideband mutation and a newer canonical revision, but no
audible output. G4 failed, was not retried and is excluded from the main demo.

## Verify

From the repository root:

```bash
make frontend-build
make e2e
```
