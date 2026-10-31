# Builder C Phase 3 — Interactive comparison UI

This patch builds on the merged Phase 2 API integration.

Changes:
- Recommendation cards with labels, rank, price (when available), exclusions, uncertainty and limitations.
- Readable preference chips; edits are composed into chat rather than changing server state directly.
- Evidence viewer with source references and unsupported/conflicting statuses.
- Chat bubbles, suggestions, loading indicator and refresh action.
- No changes to backend contracts or server-owned ranking logic.

Caveats:
- Uses the Phase 2 response shape; verify against your current Builder B contracts.
- Currency is displayed as SGD for preference budget because the current preference schema has no currency field.
- Product prices only appear when catalog price_minor is provided.
- Suggested questions fill the composer; click Send to submit.
- Not yet a second host, voice interface, or full responsive QA.

Test in Codespaces:
cd shopee-compare-app
npx eslint src/luna/LunaWidget.jsx src/luna/LunaPanels.jsx
npm run build
npm run dev -- --host 0.0.0.0

Check: select 2–4 variants; create comparison; inspect cards; change priorities via chat; verify revision; expand evidence; test 401/409 error handling.
