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
- Daily Brief, Playbooks, Builder/Code Lab, and local-first command center foundations

Legacy clothing catalog, commerce, outfit-building, and discovery routes from the original scaffold are intentionally removed from this repository.

## Quick Start

Double-click `Open BertOS.command` on macOS for the normal local launch. It safely checks GitHub for fast-forward updates, refreshes dependencies when needed, starts the local daemon, starts `localhost:3000`, and opens BertOS in the browser.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Manual all-in-one launch:

```powershell
npm run bertos:launch -- --port 3000
```

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
ENABLE_HERMES_PAID=false
ENABLE_FCC_PROXY=false
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
POST /api/workspace/context
POST /api/workspace/mission
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

## Command Center Surfaces

- `/dashboard` is the local mission control page with system status, agent stack visibility, today's command center, and quick launch buttons.
- `/builder` and `/coding` are the Builder / Code Lab workflow center for scoped missions, provider selection, copyable Claude/Codex/Gemini/Devin/Qwen/Hermes/FCC prompts, and safe local patch flow.
- `/tasks` is a localStorage task board for tracking generated prompts, external-agent handoffs, review, blockers, and completion.
- `/memory` is the local-first memory vault foundation. Project memory is active; Obsidian/local markdown vault support is planned.
- `/brief` is a daily chief-of-staff view that works without Gmail or Calendar access.
- `/playbooks` contains Devin-style safe auto-triage templates and copyable prompts. These do not run autonomous actions unless explicitly routed through existing Builder, Agents, or daemon workflows.
- `/agents` shows the runnable local agent console plus the full agent roster: Ollama, Claude Code, Codex CLI, Gemini CLI, Devin, Hermes/Nous, FCC Proxy, Qwen, OpenClaw, Browser Skills, Hyperframes, and Google managed-agent concepts.
- `/migrations` tracks the Gemini CLI to Google Anti-Gravity transition. Anti-Gravity is planned/experimental and is not the default until official docs and local command detection confirm it.
- `/github` is a safe GitHub / Repo control room for branch, remote, daemon-backed repo safety, and read-only git workflow checks. It never pushes or merges.

## Agent Teams

BertOS supports prompt-orchestrated agent teams through shared metadata in `lib/bertos/agent-teams.ts`:

- Coding Team: Orchestrator, Claude Code UI Engineer, Codex Build Verifier, Devin PR Teammate, Provider Health Auditor, and Memory Logger.
- Content Team: Orchestrator, Researcher, Content Writer, Thumbnail Creator, Review Editor, Hyperframes Video Agent, and Social Repurposer.
- SEO / Lead Gen Team: SEO Researcher, Keyword/Trend Scout, WordPress Fixer, Content Publisher, Outreach Drafter, and Analytics Reviewer.
- Daily Chief of Staff Team: Daily Brief Agent, Task Prioritizer, Calendar/Email Placeholder Agent, Memory/Journaling Agent, and Progress Reporter.
- Bert OS Maintenance Team: Route Smoke Tester, Typecheck/Build Fixer, Safety Auditor, Provider Registry Auditor, and Documentation Updater.

These teams are role templates with visible outputs and proof requirements. They do not fake execution. Builder can generate team prompts, Agents shows team cards, and Dashboard shows team readiness.

## Mission and Context APIs

BertOS now has a shared context/mission layer used by the self-coding workflow:

```text
POST /api/workspace/context
POST /api/workspace/mission
```

The context endpoint serializes included files with explicit markers:

```text
=== FILE START: path ===
full or budgeted file content
=== FILE END: path ===
```

It fails loudly if a file is marked included but omitted from the serialized prompt. The mission endpoint turns rough requests into scoped missions with provider recommendation, risk, validation commands, likely files, and a copyable prompt.

## Agent OS Patterns

BertOS mission prompts now include an Agent OS execution contract based on patterns from OpenHands, SWE-agent, AutoGPT, CrewAI, LangGraph, Agent Zero, Stagehand, and E2B. Missions apply the relevant subset automatically:

- repository microagent context
- explicit agent-computer command surfaces
- trajectory/audit evidence
- approval checkpoints for risky actions
- sandbox/runtime boundaries
- workflow blocks for broad missions
- browser observe-act verification for UI work
- memory handoff notes for future agents

See `docs/agent-os-research.md` for the research notes and adopted patterns. The repo also includes `.openhands/microagents/repo.md` so OpenHands-compatible agents get BertOS setup, structure, safety rules, and validation expectations up front.

The router also builds an orchestration plan for each prompt:

- estimates prompt tokens before routing
- chooses the cheapest safe lane for classification and memory work
- routes planning/research to Gemini, UI/architecture review to Claude Code, and implementation/verification to Codex
- marks file-writing, validation, paid calls, push/deploy, and risky operations as approval-gated
- exposes read-only parallel lanes for broad tasks before sequential implementation

`POST /api/agents/orchestrate` returns the plan by default. Set `run: true` to run only safe online read-only lanes in parallel. CLI-backed lanes require `allowCliAgents: true`, and implementation/verification lanes remain approval-gated.

## Direct Engine Tabs

BertOS keeps `/chat` and `/engines/bertos` as the combined router experience, then exposes direct side tabs for specific engines:

- `/engines/codex` for Codex CLI implementation and verification
- `/engines/claude` for Claude Code architecture and UI review
- `/engines/gemini` for Gemini CLI planning and research
- `/engines/ollama` for cheap/default Ollama chat and summaries
- `/engines/hermes` for paid-gated Hermes / Nous manual routing

Additional direct routes exist for Gemini Native, Qwen, and OpenAI API. API and paid-gated tabs show missing setup instead of silently spending credits.

## Builder Workflow

Use Builder when you want to stop bouncing between AI sites:

1. Enter a task title and large task description.
2. Choose a task type such as UI/React change, build/typecheck fix, provider integration, Devin PR task, or Anti-Gravity migration task.
3. Let BertOS recommend an agent, or force a target such as Claude Code, Codex CLI, Gemini CLI, Devin, Qwen, Hermes, or FCC.
4. Use Single Agent mode or Team Mode. Team Mode adds roles, workflow order, verification, handoffs, and final report requirements.
5. Copy the generated prompt to the external tool, or use the daemon-backed patch flow when local safety checks are available.
6. Track the task in `/tasks`, save durable notes in `/memory`, and validate with `npm run typecheck`, `npm run build`, and `npm run bertos:safety`.

Builder does not claim external agents can edit local files unless a verified daemon/API route exists. Devin, Qwen, FCC, Anti-Gravity, OpenClaw, Browser Skills, Hyperframes, and Remotion are copy-prompt/planned unless explicitly configured in a later phase.

Codex is first-class as the build verifier and repository audit agent. Use it for typecheck/build fixes, route smoke tests, PR review, provider registry audits, safety checks, and verifying changes made by Devin, Claude, Qwen, or other external agents.

## Creative and Memory Roadmap

Hyperframes and Remotion are planned local video-generation integrations:

- Hyperframes: HTML/CSS/JS animated video generation after Node, FFmpeg, and Hyperframes are installed and detected.
- Remotion: React-based programmatic video rendering after Node, FFmpeg/Remotion setup is installed and detected.

BertOS does not claim video rendering works today. Builder and Agents generate setup/implementation prompts for these tools only.

Obsidian/local markdown memory is a major planned upgrade. The Memory page includes a vault setup section and a prompt generator for a future permissioned daemon writer. Future memory should save project notes, goals, decisions, daily journals, agent sessions, and playbooks as local markdown. It must never write secrets and must require explicit permission before writing files.

## Hermes and Composio

The environment schema reserves:

```text
HERMES_API_URL=
HERMES_API_KEY=
COMPOSIO_API_KEY=
```

Those integrations should report missing setup until real credentials and endpoints are configured. Do not hard-code keys in the app.

Hermes / Nous is paid-only for this account right now. No free text/chat model is available, so BertOS does not make Hermes / Nous a default provider and does not include it in auto-routing unless `ENABLE_HERMES_PAID=true` is set intentionally.

To verify the local safety gate without printing secrets or making a network call:

```powershell
npm run hermes:status
```

The API status payload also exposes both `.hermes` and `.hermesNous` for compatibility:

```powershell
Invoke-RestMethod http://localhost:3000/api/providers/status | Select-Object -ExpandProperty hermes
```

Do not add a browser toggle that writes `.env.local`; enable paid routing only by deliberately editing local/server environment variables and restarting the server.

Additional Hermes route scaffolds exist for future remote orchestration:

```text
GET  /api/hermes/status
POST /api/hermes/message
POST /api/hermes/task
```

`/api/hermes/message` and `/api/hermes/task` return `403` unless `ENABLE_HERMES_PAID=true` is set. BertOS does not run Hermes chat/completion tests by default.

## Telegram Scaffold

Telegram is optional and disabled until server-side environment variables are configured:

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_ID=
```

Routes:

```text
GET  /api/telegram/status
POST /api/telegram/webhook
POST /api/telegram/send
```

Supported commands are `/status`, `/providers`, `/tasks`, `/evolution`, `/ask`, and `/help`. `/ask` is intentionally disabled for now to avoid surprise provider calls or paid usage. Telegram cannot apply patches, write files, push git, or run paid calls without explicit web approval.

## External Agents and Migration Notes

- Devin is treated as an external cloud coding teammate. BertOS can generate scoped copy prompts and review checklists, but it does not call Devin APIs or auto-merge PRs.
- FCC Proxy is experimental and not official Anthropic Claude. Treat it as a Claude Code-style harness with a different backend; backend pricing and limits depend on its provider. It stays disabled unless `ENABLE_FCC_PROXY=true`.
- Qwen is experimental/manual/API-dependent. BertOS does not claim free unlimited usage.
- OpenClaw, Browser Skills, Hyperframes, Remotion, Google Anti-Gravity CLI, and Google Managed Agents are planned surfaces only until real local commands or safe API routes exist.
- Gemini CLI remains supported. Google Anti-Gravity migration must be verified with official docs and local command detection before any default routing changes.

## Product Principle

BertOS should reduce terminal dependence over time: terminal setup can happen once, then daily work should move through buttons, panels, generated prompts, explicit status cards, and daemon-safe verification. When a tool still requires terminal setup, BertOS should show setup instructions and copyable commands instead of hiding the requirement.
