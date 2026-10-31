# Builder C Phase 1 — historical

This file records the original frontend-only milestone and is superseded by
[BUILDER_C_API_INTEGRATION.md](BUILDER_C_API_INTEGRATION.md).

The current implementation no longer stores Luna under `src/luna` or uses local keyword
replies. Host A imports the shared `@luna/widget` workspace package and calls the Luna API.
