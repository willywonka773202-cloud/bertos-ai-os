# Repository Purpose

BertOS is a standalone AI engineering operating system built with Next.js App Router and TypeScript. It coordinates chat, provider routing, local CLI agents, daemon-gated repo tools, Workspace patch review, Builder/Code Lab missions, Evolution Lab, tasks, memory, GitHub/repo checks, and planned external-agent integrations.

# Setup Instructions

- Use `npm run dev` for the web app.
- Use `npm run bertos:daemon` for daemon-backed local file, terminal, CLI, and repo operations.
- Use `npm run bertos -- providers` to inspect configured providers.
- Do not read `.env*` files or print secrets.

# Repository Structure

- `app/`: Next.js App Router pages and API routes.
- `components/bertos/`: BertOS product surfaces and UI workflows.
- `lib/bertos/`: provider routing, mission/context assembly, daemon helpers, adapters, and shared types.
- `store/bertos/`: local-first state stores.
- `scripts/`: local daemon, safety, smoke, and helper scripts.
- `cli/`: local BertOS terminal CLI.
- `docs/`: setup, provider, and architecture notes.

# Development Guidelines

- Work only inside this BertOS repository.
- Never touch Sylistly files, remotes, domains, or branches.
- Never fake provider output, logs, command output, tests, or task progress.
- Never auto-push, deploy, auto-merge, or make paid API calls without explicit approval.
- Keep external/planned providers honest: Devin, Qwen, OpenClaw, Browser Skills, Hyperframes, Remotion, Anti-Gravity, and Google managed agents are copy-prompt/planned unless a verified backend exists.
- For code changes, validate with `npm run typecheck`, `npm run build`, and `npm run bertos:safety` when applicable.

# Agent OS Execution Contract

- Gather repository context before planning edits.
- Use explicit search, file read, patch proposal, and allowlisted validation steps rather than broad shell improvisation.
- Keep a trajectory ledger in the final report: context gathered, files touched, commands run, validation results, and unresolved risk.
- Pause for approval before deletes, paid calls, pushes, deploys, or broad architecture rewrites.
- Preserve daemon, Workspace, provider routing, Autopilot, chat, settings, and safety behavior unless the task explicitly changes them.
