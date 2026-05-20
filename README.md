# BertOS AI OS

BertOS is a standalone AI command center for Ollama Pro, local CLI agents, project work, and future Hermes/Composio tool integrations.

Repository: `willywonka773202-cloud/bertos-ai-os`

## Quick Start

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vercel Environment

Set these in Vercel Project Settings -> Environment Variables:

```text
BERTOS_DEPLOYMENT_MODE=cloud
OLLAMA_API_KEY=<your Ollama Cloud key>
OLLAMA_DEFAULT_MODEL=gpt-oss:120b-cloud
BERTOS_AGENT_SECRET=<long random secret>
ENABLE_API_PROVIDERS=false
```

Optional provider/API integrations:

```text
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
HERMES_API_URL=
HERMES_API_KEY=
COMPOSIO_API_KEY=
```

Verify cloud mode:

```text
https://your-vercel-app.vercel.app/api/ollama/status
```

The response should show `mode: "cloud"` and `provider: "Ollama Cloud"`. Production does not call `localhost:11434`.

## Local Ollama Mode

```powershell
ollama signin
ollama run gpt-oss:120b-cloud
npm run dev
```

Local mode uses `http://127.0.0.1:11434/api/chat` unless `OLLAMA_BASE_URL` is overridden.

## BertOS Terminal CLI

The repo includes a local Node CLI at `cli/bertos.mjs`.

From the repo root:

```powershell
npm run bertos -- init
npm run bertos -- status
npm run bertos -- providers
npm run bertos -- ask "hi"
npm run bertos -- chat
npm run bertos -- doctor
```

`bertos init` stores local config at:

```text
%USERPROFILE%\.bertos\config.json
```

The config contains:

```json
{
  "apiUrl": "https://your-vercel-app.vercel.app",
  "agentSecret": "same value as BERTOS_AGENT_SECRET",
  "defaultProvider": "ollama-pro"
}
```

To make the command available as `bertos`, run:

```powershell
npm link
```

Then use:

```powershell
bertos ask "hi"
bertos status
```

## Local CLI Bridge Daemon

The local daemon lets BertOS use authenticated desktop CLIs without exposing them publicly.

Start it from the repo root:

```powershell
npm run bertos:daemon
```

Defaults:

```text
Host: 127.0.0.1
Port: 8787
```

Daemon endpoints:

```text
GET  http://127.0.0.1:8787/status
GET  http://127.0.0.1:8787/tools
POST http://127.0.0.1:8787/run-cli
POST http://127.0.0.1:8787/ask-cli
```

BertOS web routes:

```text
GET  /api/local-daemon/status
POST /api/local-daemon/ask
GET  /api/providers/status
```

On Vercel, `/api/local-daemon/*` returns unavailable because Vercel cannot reach your Windows localhost daemon. In local development, BertOS proxies to the daemon.

## Test Local CLIs

Run these in Windows PowerShell:

```powershell
claude --version
codex --version
gemini --version
```

Then start the daemon:

```powershell
npm run bertos:daemon
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/status
```

## Safe Command Wrapper

The daemon uses `execFile`, not raw shell execution. It only allows:

```text
claude
codex
gemini
git
npm
node
pnpm
```

It blocks dangerous patterns such as destructive deletes, disk formatting, shutdown commands, credential harvesting, and `.env` access. Every command is logged to:

```text
logs/bertos-daemon.log
```

## Provider Routing

Auto routing prefers:

- Codebase refactor and coding work -> Claude Code CLI
- Repo/task automation and terminal work -> Codex CLI
- Long-context planning and analysis -> Gemini CLI
- General chat and fallback -> Ollama Pro

If the local daemon is offline, BertOS falls back to Ollama Pro instead of pretending the CLI ran.

## Hermes and Composio

The environment schema reserves:

```text
HERMES_API_URL=
HERMES_API_KEY=
COMPOSIO_API_KEY=
```

Those integrations should report missing setup until real credentials and endpoints are configured. Do not hard-code keys in the app.
