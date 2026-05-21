# BertOS Agent Guide

BertOS is a standalone AI engineering operating system for coding inside this repo through the web app, local daemon, CLI bridge, provider router, Workspace, Evolution Lab, terminal, patch review, and git workflow.

## Important Paths
- `app/`: Next.js App Router pages and API routes.
- `components/bertos/`: BertOS UI surfaces, including Workspace, chat, settings, agents, and Evolution Lab.
- `lib/bertos/`: provider routing, runtime config, adapters, and shared types.
- `lib/bertos/missions.ts`: Coding tab mission compiler and reusable task templates.
- `scripts/bertos-daemon.mjs`: local Windows-safe daemon for file, terminal, and CLI bridge operations.
- `cli/bertos.mjs`: local terminal CLI for status, providers, doctor, ask, and daemon.

## Local Workflow
- Start app: `npm run dev`
- Start daemon: `npm run bertos:daemon`
- Inspect providers: `npm run bertos -- providers`
- Use Workspace for file edits, patch review, safe terminal commands, validation, and local commits.
- Use Coding for large prompts: compile mission first, then run a provider-routed patch through the existing patch engine.

## Provider Roles
- Ollama Pro: cheap classification, summaries, fallback chat.
- Gemini CLI: broad planning, long-context review, research, documentation planning.
- Claude Code CLI: architecture review, UI quality, refactors, risk review.
- Codex CLI: implementation, repo edits, patch generation, task automation.

## Safety Rules
- Never touch Sylistly, Sylistly remotes, Sylistly domains, or old Sylistly branches.
- Never fake provider output, logs, command output, tests, or task progress.
- Never expose secrets or read `.env*` files.
- Never auto-push or deploy.
- Never edit outside the BertOS repo root.
- Use the daemon for repo file writes and safe terminal commands.

## Validation
- Fast: `npm run typecheck`
- Standard: `npm run typecheck` then `npm run build`
- Strict: `npm run typecheck`, `npm run build`, `npm run bertos:safety`, then relevant smoke checks.
- Full: `npm run validate`

## Done When
- The scoped request is implemented without parallel duplicate systems.
- Typecheck/build pass for code changes.
- Safety check passes for repo-sensitive work.
- UI states are honest: working, missing setup, or disabled with a clear reason.
- Git status is reported and nothing is pushed without explicit approval.
