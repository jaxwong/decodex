# `@luna/widget`

This package is the only browser owner of Luna comparison UI, API calls, evidence/citation
rendering and GPT-Live WebRTC media. It imports neither demo host.

## Host contract

Mount `LunaWidget` with a stable adapter:

```jsx
import { LunaWidget } from '@luna/widget';

<LunaWidget adapter={hostAdapter} apiBaseUrl="/api" />
```

The adapter supplies:

- `hostId`: non-empty host identity;
- `getCurrentSelection()`: `{ listingId, variantId }` or `null`;
- `onSelectionChange(callback)`: subscribe and return an unsubscribe function;
- `navigateToListing(listingId)`: host-owned navigation; and
- optional `requestAddToCart(selection)`: not currently invoked by the widget.

Invalid adapters and selections fail at the package boundary. The widget owns only its
comparison bucket/view state. The API owns evidence, preferences, recommendation and revision.
Hosts own routes, selection context, cart and checkout.

## Live ownership

The browser creates one `RTCPeerConnection`, one microphone stream and the `oai-events` data
channel. It marks connected only after `session.started`, displays transcript deltas as
provisional, and closes only after `session.closed` or an explicit incomplete-finalization
error. It never executes tools. The authenticated server sideband is the sole tool executor.

Offline browser tests do not prove provider audio or tool mutation. A real paid acceptance run
must show microphone input, generated speech, sideband mutation and a newer canonical revision.

## Verify

From the repository root:

```bash
make frontend-build
make e2e
```
