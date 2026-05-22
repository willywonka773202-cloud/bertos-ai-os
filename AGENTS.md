# BertOS Agent Guide

BertOS is a standalone AI engineering operating system for coding inside this repo through the web app, local daemon, CLI bridge, provider router, Workspace, Evolution Lab, terminal, patch review, and git workflow.

## Important Paths
- `app/`: Next.js App Router pages and API routes.
- `components/bertos/`: BertOS UI surfaces, including Dashboard, Builder/Coding, Workspace, Agents, Playbooks, Tasks, Memory, GitHub/Repo, Settings, and Evolution Lab.
- `lib/bertos/`: provider routing, runtime config, adapters, and shared types.
- `lib/bertos/command-center.ts`: shared agent roster, playbook templates, task types, and self-coding prompt builder.
- `lib/bertos/agent-teams.ts`: prompt-orchestrated team templates for coding, content, SEO/lead-gen, daily brief, and BertOS maintenance workflows.
- `lib/bertos/context-engine.ts`: central context pack assembly and `=== FILE START ===` serialization for patch/mission prompts.
- `lib/bertos/mission-builder.ts`: structured mission compiler used by `/api/workspace/mission`.
- `lib/bertos/missions.ts`: Coding tab mission compiler and reusable task templates.
- `scripts/bertos-daemon.mjs`: local Windows-safe daemon for file, terminal, and CLI bridge operations.
- `cli/bertos.mjs`: local terminal CLI for status, providers, doctor, ask, and daemon.

## Local Workflow
- Start app: `npm run dev`
- Start daemon: `npm run bertos:daemon`
- Inspect providers: `npm run bertos -- providers`
- Use Workspace for file edits, patch review, safe terminal commands, validation, and local commits.
- Use Coding for large prompts: compile mission first, then run a provider-routed patch through the existing patch engine.
- Use Builder/Playbooks/Tasks for copy-prompt workflows when an external agent is not directly callable from BertOS.
- Use Agent Teams for role-based handoffs; teams are prompt-orchestrated unless every listed backend is verified.
- Use GitHub/Repo for safe local branch/remote/status checks only; BertOS must never auto-push or auto-merge.

## Provider Roles
- Ollama Pro: cheap classification, summaries, fallback chat.
- Gemini CLI: broad planning, long-context review, research, documentation planning.
- Claude Code CLI: architecture review, UI quality, refactors, risk review.
- Codex CLI: implementation, repo edits, patch generation, task automation.
- Devin, FCC Proxy, Qwen, OpenClaw, Browser Skills, Hyperframes, Anti-Gravity, and Google Managed Agents are external/planned/experimental unless a verified backend exists.
- Hyperframes and Remotion are planned local video pipelines only. Verify Node, FFmpeg, and the relevant tool before claiming video rendering works.
- Hermes / Nous is paid-gated. Do not route to it unless `ENABLE_HERMES_PAID=true` and the user explicitly accepts paid credits.

## Safety Rules
- Never touch Sylistly, Sylistly remotes, Sylistly domains, or old Sylistly branches.
- Never fake provider output, logs, command output, tests, or task progress.
- Never expose secrets or read `.env*` files.
- Never auto-push or deploy.
- Never auto-merge PRs or call paid APIs for status/testing unless explicitly asked and gated.
- Never edit outside the BertOS repo root.
- Use the daemon for repo file writes and safe terminal commands.
- Telegram routes are notification/control scaffolds only; no file writes, patch apply, git push, or paid calls from Telegram without web approval.

## Validation
- Fast: `npm run typecheck`
- Standard: `npm run typecheck` then `npm run build`
- Strict: `npm run typecheck`, `npm run build`, `npm run bertos:safety`, then relevant smoke checks.
- Full: `npm run validate`
- Patch payload smoke: `npm run smoke:payload`

## Done When
- The scoped request is implemented without parallel duplicate systems.
- Typecheck/build pass for code changes.
- Safety check passes for repo-sensitive work.
- UI states are honest: working, missing setup, or disabled with a clear reason.
- Git status is reported and nothing is pushed without explicit approval.
