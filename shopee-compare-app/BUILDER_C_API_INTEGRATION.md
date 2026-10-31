# Builder C — Backend API integration

## What changed
- `src/luna/lunaClient.js`: HTTP client, demo-session bearer auth, error handling.
- `src/luna/LunaWidget.jsx`: fetches API catalog, selects 2–4 exact variants, creates comparison,
  sends chat with revision, fetches canonical state, displays ranking and evidence.
- `vite.config.js`: local `/api` reverse proxy to FastAPI port 8000.

## Important integration boundaries
- The existing Shopee sample comparison remains unchanged.
- The Luna API uses a separate synthetic catalog. Shopee IDs are **not** assumed to match
  API IDs. The widget only preselects exact matching `(listing_id, variant_id)` pairs.
  Otherwise the user selects from the API catalog inside the widget.
- `/ask` requires Builder B's OpenAI configuration. Without it, creation and ranking
  can still be tested, but AI chat may return 503.
- The UI is a first functional integration, not yet the final portable packaged widget,
  shared Shopee/backend catalog, or WebRTC voice client.
- Demo sessions are process-local and expire after one hour. Reloading creates a new session.
- The browser never receives a server OpenAI key.
- Failed `/ask` calls are not automatically retried, because a preference mutation may
  already have committed. Use Refresh comparison.

## Test
From repository root, in terminal 1:
```
make api-sync
make api-dev
```
In terminal 2:
```
cd shopee-compare-app
npm ci
npm run dev -- --host 0.0.0.0
```
Open Codespaces port 5173; open Shopee Compare, click Ask Luna, choose 2–4
API catalog variants, create a comparison, inspect ranking and evidence.
Try asking a question if OpenAI environment variables are configured.

Frontend checks:
```
cd shopee-compare-app
npx eslint src/luna/LunaWidget.jsx src/luna/lunaClient.js vite.config.js
npm run build
```
The repository has pre-existing unrelated global lint failures.
