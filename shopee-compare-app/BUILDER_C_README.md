# Builder C — Luna widget prototype

This is a **frontend-only first milestone**. The existing comparison/cart flow is unchanged. The `Ask Luna` button on `#/Compare` toggles a host-independent `LunaWidget` in `src/luna/LunaWidget.jsx`. Messages and preference keywords are local-only; no AI recommendations or backend calls are claimed.

## Run

```powershell
cd C:\Users\jiajie.yee\dev\decodex\shopee-compare-app
npm ci
npm run dev
```

Open the local Vite URL, navigate to `#/Cart`, select 2–4 products, then Compare. Click **Ask Luna**, send `prioritize price and weight`, confirm it appears in the conversation and preference summary. Close and reopen the widget; confirm the existing comparison table, variants, evidence drawers and checkout remain usable.

## Next integration

Agree with Builder B on session creation, message endpoint, product IDs/variants, normalized evidence and ranking response schema. Replace the local `send` handler with a backend client (do not expose OpenAI keys in the browser). Extract styling into scoped CSS, add API loading/error states, and mount the exact same widget in a second independent host.
