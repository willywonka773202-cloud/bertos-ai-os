# Hermes Free Setup

This guide configures BertOS to use Hermes Agent as a server-side OpenAI-compatible backend without requiring paid OpenAI, Anthropic, Claude, or OpenRouter keys.

## Production Shape

Use this architecture for hosted BertOS:

```text
BertOS frontend
  -> BertOS backend API route
  -> Hermes API server
  -> Ollama/local model, custom compatible endpoint, or optional free-tier provider
```

Do not call Hermes directly from browser JavaScript. `HERMES_API_KEY` must stay in the BertOS server environment.

## BertOS Environment

```bash
HERMES_ENABLED=true
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_API_KEY=replace-with-strong-secret
HERMES_MODEL=hermes-agent
HERMES_TIMEOUT_MS=120000
HERMES_STREAMING=true
```

For a separate Hermes server:

```bash
HERMES_BASE_URL=https://hermes.your-domain.com/v1
```

Legacy `HERMES_API_URL` is still accepted, but new deployments should use `HERMES_BASE_URL`.

## Free Model Backends

Hermes itself can use different model backends. BertOS does not require paid model APIs.

Recommended no-paid-key path:

```text
Provider: Ollama or local model server
Base URL: http://127.0.0.1:11434
Models: llama3.1, mistral, qwen2.5, gemma, hermes3
```

Other supported paths:

```text
Provider: custom OpenAI-compatible endpoint
Base URL: https://some-compatible-endpoint/v1
API key: optional or provider-specific
Model: configured by the endpoint
```

```text
Provider: free-tier API
Examples: OpenRouter free models, Gemini free tier, Groq free tier, Mistral free tier
API key: may be required, but not a paid key by default
```

Paid providers can be configured behind Hermes later, but they are optional and should require explicit user approval.

## Case 1: BertOS and Hermes on the Same Hostinger VPS

Use this when BertOS and Hermes run on the same server. Keep Hermes bound to loopback.

Hermes `.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=replace-with-strong-secret
API_SERVER_MODEL_NAME=hermes-agent
```

BertOS server environment:

```bash
HERMES_ENABLED=true
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_API_KEY=replace-with-same-strong-secret
HERMES_MODEL=hermes-agent
```

This keeps Hermes private to the VPS. On a hosted site, `127.0.0.1` means the server running BertOS, not the user's laptop.

## Case 2: BertOS on Hostinger, Hermes on a Separate VPS

Use this when the current Hostinger plan cannot run Hermes as a persistent process or Docker service.

Hermes `.env` on the Hermes VPS:

```bash
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=replace-with-strong-secret
API_SERVER_MODEL_NAME=hermes-agent
```

Expose Hermes through a secured HTTPS reverse proxy:

```text
https://hermes.your-domain.com/v1
```

BertOS server environment:

```bash
HERMES_ENABLED=true
HERMES_BASE_URL=https://hermes.your-domain.com/v1
HERMES_API_KEY=replace-with-same-strong-secret
HERMES_MODEL=hermes-agent
```

Security requirements:

- Use HTTPS.
- Use a strong bearer token.
- Do not allow public unauthenticated access.
- Do not expose Hermes directly without auth.
- Prefer server-to-server calls from the BertOS backend.
- Limit CORS to trusted origins only if browser access is absolutely required.

## Case 3: Local Development

Use this only for local development.

Hermes:

```bash
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=local-dev-secret
API_SERVER_MODEL_NAME=hermes-agent
API_SERVER_CORS_ORIGINS=http://localhost:3000
```

BertOS:

```bash
HERMES_ENABLED=true
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_API_KEY=local-dev-secret
HERMES_MODEL=hermes-agent
```

Run Hermes, then test:

```bash
hermes gateway
curl http://127.0.0.1:8642/health
npm run hermes:status
```

Some Hostinger Hermes containers start the gateway from `/opt/hermes` with `uv run python cli.py --gateway` instead of a `hermes` binary.

## BertOS Routes

Minimum working routes:

```text
GET  /api/hermes/health
GET  /api/hermes/models
POST /api/hermes/chat
```

Extended proxy routes:

```text
POST /api/hermes/responses
POST /api/hermes/runs
GET  /api/hermes/runs/:runId
GET  /api/hermes/runs/:runId/events
POST /api/hermes/runs/:runId/stop
```

Example chat proxy body:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Say hello from Hermes and confirm Bert OS integration is working."
    }
  ]
}
```

BertOS converts that into an OpenAI-compatible `/v1/chat/completions` call with `model: "hermes-agent"`.

## Hostinger Plan Notes

- Hostinger VPS can run BertOS, Hermes, Ollama, Docker, reverse proxies, and persistent services.
- Hostinger cloud/web hosting may run a Node app but may not run Hermes as a persistent local service.
- Static hosting cannot keep the Hermes secret safe by itself. Use a backend route or separate server.
- Python-heavy Hermes deployments are usually VPS-style services. Do not fake local Hermes support on static-only hosting.

## Failure States

BertOS should show clear messages for:

- Hermes is disabled.
- `HERMES_BASE_URL` is missing.
- `HERMES_API_KEY` is missing.
- `/health` failed.
- `/v1/models` does not show the configured model.
- `/v1/chat/completions` failed.
- Hermes timed out.

## Safety Rules

- Never expose `HERMES_API_KEY` to the frontend.
- Never commit `.env` files.
- Never log full bearer tokens.
- Do not let arbitrary users change `HERMES_BASE_URL`.
- Rate-limit BertOS Hermes routes.
- Limit request body size.
- Add stop/cancel support for long-running runs.
- Require approval for file deletion, email sending, calendar scheduling, publishing, deploying, pushing, and paid API usage.
- Prefer binding Hermes to `127.0.0.1` and proxying server-to-server.
