# Developer B — Codex build log

## B1: capability smoke tests and API shell — 31 October 2026

**Outcome:** Added the B-owned FastAPI shell, application-owned demo-session store, official OpenAI SDK capability runner, tests, dependency lock, and developer commands. Both required OpenAI capabilities passed against the configured project.

**Files changed:**

- `services/luna-api/app/main.py`
- `services/luna-api/app/contracts/session.py`
- `services/luna-api/app/decision/sessions.py`
- `services/luna-api/app/routes/health.py`
- `services/luna-api/app/routes/demo_sessions.py`
- `services/luna-api/app/openai/capability_smoke.py`
- `services/luna-api/tests/**`
- `services/luna-api/pyproject.toml`
- `services/luna-api/uv.lock`
- `services/luna-api/README.md`
- `.env.example`
- `docs/capability-smoke.json`

**Human/Codex corrections:**

- Replaced an unusable console-script entry point after confirming this is a bare service project; the documented smoke command now runs the Python module directly.
- Replaced the placeholder Live SDP after the API rejected it with `Offer did not have an audio media section`. The generated offer now always contains an Opus audio section and bundled WebRTC data channel.
- Kept demo-session expiry server-owned at one hour and ensured expired/unknown failures never include the token value.
- Disabled OpenAI SDK retries and structurally capped the smoke operation at two independent external calls; neither check is a fallback for the other.
- Removed test-only client protocols, the output-path option, model-name defaults, broad exception handling, and silent response-field defaults. The installed SDK type, fixed report path, required environment values, and typed provider/contract failures now each have one owner.
- Recorded a missing `OPENAI_API_KEY` as a blocker without an external call. Missing model configuration fails before a report can misidentify the models tested.

**Verification:**

```text
uv --cache-dir /tmp/decodex-uv-cache run --frozen pytest -q
..............                                                           [100%]
14 passed in 0.37s
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff check .
All checks passed!
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen ruff format --check .
15 files already formatted
exit 0

uv --cache-dir /tmp/decodex-uv-cache run --frozen mypy
Success: no issues found in 14 source files
exit 0

GET /api/health
200 {"ok":true}

POST /api/demo-sessions
201 {"token":"<redacted>","expires_at":"<one-hour UTC expiry>"}

set -a
source ../../.env
set +a
uv --cache-dir /tmp/decodex-uv-cache run --frozen python -m app.openai.capability_smoke
overall_status=passed
responses_function_call=passed (gpt-6-luna)
gpt_live_session=passed (gpt-live-1)
max_external_calls=2
exit 0
```
