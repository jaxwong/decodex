# Luna API — Developer B phase B1

This phase owns only the API shell, demo-session state, and OpenAI capability smoke tests. It does not contain marketplace evidence, ranking, or frontend behavior.

## Ownership boundary

| Owner | Owns here | Integrates through |
| --- | --- | --- |
| Developer B | `pyproject.toml`, `uv.lock`, app composition, routes, demo sessions, decision state, and `app/openai/*` | The HTTP/OpenAPI surface and A's public evidence contract |
| Developer A | Evidence contracts, providers, evidence building, and evidence tests | The immutable evidence contract; never B's session store or OpenAI decision calls |
| Developer C | React hosts, widget, and browser tests | The HTTP/OpenAPI surface; never Python state or API keys |

Developer B is the only dependency-lock owner. A new Python dependency is requested from B rather than added through a second project or lockfile.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Demo session | An opaque, process-local token and server-owned expiry; not an OpenAI Live session. |
| Capability check | A bounded developer command that verifies project access; not runtime application behavior. |
| Live session | An OpenAI audio session created from a WebRTC offer; not app-owned comparison state. |

## Run locally

From the repository root:

```bash
make api-sync
make api-dev
curl --fail http://127.0.0.1:8000/api/health
curl --fail -X POST http://127.0.0.1:8000/api/demo-sessions
```

## Verify

```bash
make api-test
```

## OpenAI capability smoke

The command makes at most two provider calls and never retries: one forced strict Responses function call and one GPT-Live create-session request with a locally generated audio-plus-data WebRTC offer. It writes no API key, provider response ID, or SDP to the report.

```bash
make api-capability-smoke
```

`.env` owns the API key and both model names; `.env.example` documents the required variables. Without a key, the command makes no external call, writes an explicit blocked result to `../../docs/capability-smoke.json`, and exits `2`. Missing or blank model configuration exits `2` without writing a misleading report.
