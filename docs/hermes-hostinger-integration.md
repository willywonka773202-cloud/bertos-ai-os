# Hermes Hostinger Integration

This is the BertOS integration contract for a Hostinger-hosted Hermes Agent.

## Current VPS Findings

- Hostinger deployed Hermes as Docker project `hermes-agent-f3dt`.
- The running container is `hermes-agent-f3dt-hermes-agent-1`.
- The image is `ghcr.io/hostinger/hvps-hermes-agent:latest`.
- Docker publishes container port `4860/tcp`, but that endpoint answers as the Hostinger `ttyd` web terminal and is not the OpenAI-compatible Hermes API.
- Local SSH to the VPS public IP timed out from this machine, so server access currently depends on the Hostinger browser terminal.

## Hostinger Access Pattern

Hostinger documents Hermes as a CLI-first deployment:

1. Open the Hostinger VPS browser terminal.
2. Go to the Docker project directory:

```bash
cd /docker/hermes-agent-f3dt
```

3. Enter the Hermes container:

```bash
docker compose exec -it hermes-agent /bin/bash
```

4. Start or verify Hermes from inside the container:

```bash
cd /opt/hermes
uv run python cli.py --help
```

The deployed container inspected for BertOS did not have a `hermes` command on `PATH`; it runs Hermes from `/opt/hermes` through `uv run python cli.py`. Do not dump `.env` files or API keys into logs.

## BertOS Routing Contract

BertOS routes `hermes-nous` only through Hermes Agent's OpenAI-compatible API server. Configure BertOS with:

```bash
HERMES_ENABLED=true
HERMES_BASE_URL=http://your-hermes-api-host:8642/v1
HERMES_API_KEY=your-api-server-bearer-key
HERMES_MODEL=hermes-agent
```

`HERMES_BASE_URL` should include `/v1`; BertOS also accepts legacy `HERMES_API_URL` and normalizes either form. The adapter calls:

```text
GET  /health
GET  /v1/models
POST /v1/chat/completions
POST /v1/runs
```

Hermes stays manual-selection only and is not part of the default fallback order.

## Enabling the API Server

Hermes Agent API server setup is separate from the Hostinger web terminal. The expected Hermes-side configuration is:

```bash
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=<bearer-token>
API_SERVER_MODEL_NAME=hermes-agent
```

Then start the Hermes gateway process:

```bash
cd /opt/hermes
uv run python cli.py --gateway
```

Some Hermes installs also expose this as `hermes gateway`; the Hostinger container inspected here did not.

For remote BertOS access, prefer a trusted HTTPS reverse proxy in front of a loopback-bound Hermes server. If binding outside loopback, require `API_SERVER_KEY`, use HTTPS, and firewall the port.

For the complete free/local setup matrix, see [`docs/hermes-free-setup.md`](hermes-free-setup.md).

## Safety Gates

- Do not read or print `.env*` files.
- Do not require paid OpenAI, Claude, Anthropic, or OpenRouter keys for the default Hermes path.
- If Hermes itself uses a paid backend, require explicit user approval outside BertOS.
- Do not expose the Hermes API server publicly without a bearer key.
- Do not assume the Hostinger `ttyd` terminal endpoint is the Hermes chat API.
- Keep Hermes outside automatic fallback routing until the user explicitly selects it.
