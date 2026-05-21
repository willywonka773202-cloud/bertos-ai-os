# AGENTS.md — BertOS Development Instructions

This file governs how AI agents, automation, and coding missions operate inside the
`bertos-ai-os` repo. All agents (Claude, Codex, Gemini, Ollama) must respect these rules.

---

## Repo Safety (Non-Negotiable)

- **Only work in:** `bertos-ai-os` repo
- **Remote must be:** `https://github.com/willywonka773202-cloud/bertos-ai-os.git`
- **Never touch:** Sylistly, or any other repo
- **Never push without explicit `PUSH NOW` approval from the user**
- **Never expose secrets, API keys, or .env contents**
- **Never fake terminal output, provider status, or build results**
- **Never auto-apply patches — all writes require approval**

Verify before any operation:
```
pwd              # must contain bertos-ai-os
git remote -v   # must point to willywonka773202-cloud/bertos-ai-os
git branch      # confirm correct branch
```

---

## Provider Roles

| Provider      | Use for                                               | Source  |
|---------------|-------------------------------------------------------|---------|
| Ollama Cloud  | Cheap/default, simple summaries, low-risk patches     | API     |
| Gemini CLI    | Long planning, research, broad context analysis       | Daemon  |
| Claude Code   | Architecture, UI, review, complex reasoning           | Daemon  |
| Codex CLI     | Implementation, repo edits, patch generation          | Daemon  |
| Team Mode     | Multi-step: Gemini plan → Claude review → Codex build | Chained |

Routing happens automatically in `lib/bertos/providers/router.ts`.

---

## Local Daemon

The daemon runs at `http://127.0.0.1:8787`. Start it with:
```
npm run bertos:daemon
```

Daemon responsibilities:
- File reading and writing (`GET/POST /file`)
- Terminal command execution (`POST /run-cli`)
- Claude/Codex/Gemini CLI bridges (`POST /ask-cli`)
- Repo safety checks (`GET /repo/status`)

The daemon is the only thing that can write files. Patches go through the daemon.
Never bypass the daemon for file writes.

---

## Patch Rules

1. All patches require **user approval** before applying — never auto-apply
2. Never auto-push to git — local commits only unless `PUSH NOW` is given
3. **Blocked paths:** `.env`, `node_modules/`, `.git/`, path traversal (`../`)
4. **Blocked operations:** delete .env, force push, destructive rm -rf
5. Format: `"after"` must contain full file content, not prose or diffs
6. Multi-file patches: user approves each file via checkbox
7. Maximum recommended patch: 5 files, focused changes
8. Always run typecheck + build after applying a patch

---

## Validation Commands

```bash
npm run typecheck       # TypeScript — must pass with 0 errors
npm run build           # Next.js production build — must pass
npm run bertos:safety   # Repo safety check — must pass
npm run validate        # Runs typecheck + build + safety
npm run smoke           # Quick smoke test
node scripts/test-patch-payload.mjs   # Phase 1 serialization test
```

---

## Done-When Checklist

A task is complete only when ALL of these pass:

- [ ] `npm run typecheck` — 0 TypeScript errors
- [ ] `npm run build` — Next.js build succeeds
- [ ] `npm run bertos:safety` — Repo safety check passes
- [ ] Feature works exactly as described in the task
- [ ] No fake success, placeholder stubs, or unimplemented functions
- [ ] No accidental changes to unrelated files
- [ ] No broken imports or missing types
- [ ] No push without explicit user approval

---

## Architecture

| Layer           | Technology                                |
|-----------------|-------------------------------------------|
| Framework       | Next.js 15 (App Router, nodejs runtime)   |
| State           | Zustand with `persist` middleware         |
| UI              | Tailwind CSS + Radix UI + shadcn          |
| AI providers    | Local CLIs via daemon + Ollama API        |
| Provider router | `lib/bertos/providers/router.ts`          |
| Context engine  | `lib/bertos/context-engine.ts`            |
| Mission builder | `lib/bertos/mission-builder.ts`           |

---

## Key Files

```
app/api/workspace/patch/route.ts      — Patch generation endpoint (Phase 1 fixed)
app/api/workspace/mission/route.ts    — Mission compiler endpoint
app/api/workspace/context/route.ts    — Context engine endpoint
lib/bertos/context-engine.ts          — Context assembly + serialization
lib/bertos/mission-builder.ts         — Mission compiler (pure function)
lib/bertos/providers/router.ts        — Provider selection + fallback
lib/bertos/local-daemon.ts            — Daemon HTTP bridge
components/bertos/workspace/WorkspaceView.tsx  — Workspace + patch UI
components/bertos/coding/CodingView.tsx        — Coding missions UI
components/bertos/dashboard/DashboardView.tsx  — Dashboard
components/bertos/evolution/EvolutionLabView.tsx — Evolution Lab
scripts/bertos-daemon.mjs             — Local daemon process
scripts/test-patch-payload.mjs        — Phase 1 serialization test
```

---

## Scaffolded Features (honest state)

These are scaffolded — routes exist, UI exists, backend is not complete:

| Feature        | Status      | Required env vars                               |
|----------------|-------------|-------------------------------------------------|
| GitHub tab     | Scaffolded  | None — needs daemon worktree backend            |
| Hermes         | Scaffolded  | `HERMES_API_URL`, `HERMES_API_KEY`              |
| Telegram       | Scaffolded  | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_ID`|
| Worktrees      | Scaffolded  | Needs daemon worktree support                   |

No fake success. If a feature is not implemented, the UI says so clearly.

---

## Context Serialization Format

Files in provider prompts use this format (enforced by `context-engine.ts`):

```
=== FILE START: components/bertos/workspace/WorkspaceView.tsx ===
<full file content here>
=== FILE END: components/bertos/workspace/WorkspaceView.tsx ===
```

If `assertContextSerialization()` detects a file was marked included but the marker
is missing from the serialized prompt, it throws:
```
Context serialization failure: "<path>" was marked as included but is missing from the serialized prompt.
```

---

## Commit Rules

- Commits are local-only unless the user says `PUSH NOW`
- Commit messages: one line, imperative mood, no markdown
- Never amend published commits
- Never force-push to main/master
- Staged files: specific files only, never `git add .` for sensitive data
