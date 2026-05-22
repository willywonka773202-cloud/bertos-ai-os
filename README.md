# BertOS AI OS

BertOS is a standalone AI command center for Ollama Pro, local CLI agents, project work, and future Hermes/Composio tool integrations.

Repository: `willywonka773202-cloud/bertos-ai-os`

## Standalone Scope

BertOS is its own project. The app surface is limited to the AI operating system:

- Chat and provider routing
- Workspace coding tools
- Local CLI bridge daemon
- Evolution Lab
- Memory, agents, compare, and settings
- Composio/Hermes scaffolds

Legacy clothing catalog, commerce, outfit-building, and discovery routes from the original scaffold are intentionally removed from this repository.

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

The command should stay running until you press `Ctrl+C`. If it immediately returns to PowerShell, check whether another process is already using port `8787`:

```powershell
Get-NetTCPConnection -LocalPort 8787 -State Listen
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
Invoke-RestMethod http://127.0.0.1:8787/tools
Invoke-RestMethod http://127.0.0.1:8787/repo/status
```

Expected status includes:

- `online: true`
- resolved `.cmd` paths for Claude, Codex, and Gemini on Windows
- `repo.safeRepo: true`
- `remote: https://github.com/willywonka773202-cloud/bertos-ai-os.git`

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

## Devin Integration

BertOS supports [Devin](https://docs.devin.ai) as an external cloud coding agent. Devin is a cloud AI software engineer by Cognition that can open branches, write code, create PRs, and run builds autonomously.

### What is connected

- **Agents page** (`/agents`): Shows a Devin agent card with status, best-use cases, and safety warnings.
- **Playbooks page** (`/playbooks`): Pre-built Devin task prompts — copy-paste into a new Devin session.
- **Builder page** (`/builder`): Generate custom scoped task prompts for Devin (or other agents). Includes "Copy for Devin" button.
- **Provider status** (`/api/providers/status`): Reports Devin status under `externalAgents.devin`.

### What is placeholder

- No live Devin API calls are made. BertOS generates task prompts that you manually paste into Devin.
- The `DEVIN_API_KEY` env var is checked for status only. If set, Devin shows as "configured" instead of "not-connected".

### How to use Devin safely

1. Use the Builder (`/builder`) to generate a scoped task prompt.
2. Open [app.devin.ai](https://app.devin.ai), start a new session, and paste the prompt.
3. Devin opens a branch and creates a PR.
4. **Review the PR manually. Do not auto-merge.**
5. After merging, record what happened in BertOS Memory.

### Safety rules

- Do not auto-merge Devin PRs.
- Do not give Devin unrestricted repo access — scope tasks narrowly.
- Do not edit `.env.local` through Devin.
- Do not print or expose secrets.
- BertOS does not call paid Devin APIs unless `DEVIN_API_KEY` is explicitly configured.

## Hermes and Composio

The environment schema reserves:

```text
HERMES_API_URL=
HERMES_API_KEY=
COMPOSIO_API_KEY=
```

Those integrations should report missing setup until real credentials and endpoints are configured. Do not hard-code keys in the app.
