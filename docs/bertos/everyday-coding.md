# BertOS — Everyday Coding OS

The Everyday Coding OS turns BertOS into a local-first daily coding cockpit. It lives
alongside the Creator OS and reuses the same runtime, output registry, and memory rules.

Entry points:
- `/cockpit` — the Dev Cockpit (daily home)
- `/approvals` — Guardian Gates (Approval Center)
- `/search` — Oracle Search (search everything)

## Architecture

All logic is in `lib/bertos/coding/` and is disk-backed under `data/bertos/coding/`
(gitignored) using the shared `runtime-store` helpers (atomic writes, traversal-safe paths).

| Module | Responsibility |
| --- | --- |
| `safety.ts` | Path traversal/null-byte guard, sensitive-path + secret detection/redaction, command allowlist + shell-metachar guard |
| `store.ts` | Generic disk-backed JSON collection (create/list/get/update/remove + audit log) |
| `projects.ts` | Project registry, active-project selection, health summary |
| `git.ts` | Read-only git (status/diff/log) via `spawn` arg-arrays (no shell) |
| `files.ts` | Safe file browser/search (excludes node_modules/.next/dist/.env/binaries) |
| `commands.ts` | Allowlisted command runner + validation reports (no shell, timeouts, redaction) |
| `patches.ts` | Patch proposal pipeline: propose → review → approve → apply with backups + checksums + conflict detection |
| `approvals.ts` | Central approval gate for every risky action |
| `tasks.ts` / `decisions.ts` | Local task board + decision ledger |
| `workflows.ts` | Deterministic local workflows (no LLM) that produce grounded output artifacts |
| `search.ts` | Unified search across all of the above + the output registry |

## Safety model

- **Path safety:** `resolveWithinRepo` blocks `..` traversal, null bytes, and absolute escapes.
- **Sensitive files:** `.env*`, keys, credentials, `.ssh`/`.aws` are never read, written, or patched.
- **Secrets:** detected and redacted in command output, diffs, file previews, and approval payloads. Never stored.
- **Commands:** allowlisted binaries only; shell metacharacters, `rm`, `sudo`, `curl|sh`, deploy/publish are blocked; mutating git (push/commit/reset --hard/clean/pull) and package installs require approval. Executed with `shell:false` + timeout.
- **Patches:** apply is impossible without an approved proposal; conflicts (file drift since proposal) block apply unless explicitly revalidated; version-safe backups + before/after checksums recorded; re-apply refused.
- **Approvals:** patch apply, git push/commit, deploy, deletion, paid APIs, durable memory writes, external connectors all gate here.

## API surface (all under `/api/bertos`)

- Projects: `GET/POST /projects`, `GET/PATCH /projects/[id]`, `POST /projects/[id]/activate`, `GET /projects/[id]/health`
- Files: `GET /projects/[id]/files`, `GET /projects/[id]/files/read?path=`, `GET /projects/[id]/search?q=`, `GET /projects/[id]/structure`
- Git: `GET /projects/[id]/git/{status,diff,log}`
- Commands: `GET/POST /projects/[id]/commands`, `GET/POST /projects/[id]/validate`
- Patches: `GET/POST /projects/[id]/patches`, `GET /projects/[id]/patches/[patchId]`, `POST .../{approve,reject,apply,validate}`
- Approvals: `GET/POST /approvals`, `GET /approvals/[id]`, `POST /approvals/[id]/{approve,reject}`
- Tasks: `GET/POST /tasks`, `GET/PATCH /tasks/[id]`, `POST /tasks/[id]/{complete,archive}`
- Decisions: `GET/POST /decisions`, `GET/PATCH /decisions/[id]`
- Search: `GET /search?q=`
- Cockpit aggregate: `GET /coding/overview`
- Workflows: `GET/POST /coding/workflows/run`

## Workflows (local, deterministic — no LLM)

`explain-current-project`, `feature-request-to-patch-plan`, `code-review-current-diff`,
`failing-validation-to-fix-plan`, `write-tests-plan`, `daily-dev-briefing`,
`reflect-on-work`, `release-readiness-check`. Each writes a grounded markdown artifact to
the Output Registry and is labelled "local deterministic workflow — no LLM used". They never
write memory directly; they may propose follow-up tasks.

## Main AI interface

`lib/bertos/coding/assistant.ts` powers the project-aware AI:
- builds a compact **grounding pack** (structure, git, validation, recent commands, tasks, decisions, pending patches)
- detects intent (explain / plan / review / fix / test / next / summarize / tasks / patch)
- routes through the existing provider router (`askWithProviderRouter`); if no provider is online it falls back to a **local deterministic** answer and labels it `local · no LLM`
- registers an **OutputArtifact**, records an **AgentRun + WorkflowRun with lanes** (`lib/bertos/coding/agent-runs.ts`), creates follow-up **tasks** for plan intents, and proposes **memory** for durable intents (`lib/bertos/coding/memory-bridge.ts`)

Surfaces: embedded AI Command Center in `/cockpit`, dedicated `/assistant` (with a thread sidebar), API `POST /api/bertos/coding/assistant` (GET returns provider status).

**Threads:** conversations persist as threads (`lib/bertos/coding/threads.ts`; `GET/POST /api/bertos/coding/threads`, `GET/PATCH/DELETE /api/bertos/coding/threads/[id]`). Secrets are redacted before storage; each thread tracks `providerMode` (llm/local/mixed) and links runs/outputs. **Test provider:** `POST /api/bertos/coding/provider-test` (and the AI Command Center **Test** button) sends a tiny prompt to verify a provider responds, only hitting paid APIs with explicit `allowPaid`.

## Runs, memory, readiness

- **Runs:** workflows and assistant turns now appear in `/runs` as real AgentRun/WorkflowRun records with lane logs.
- **Memory:** `explain/review/plan/fix/release/reflect` actions create review-only memory proposals (secrets blocked); the **Memory Chapel** is embedded in the cockpit.
- **Readiness/storage:** `lib/bertos/coding/storage.ts` + `GET /api/bertos/coding/readiness` report storage mode, durability, auth/isolation, provider count, and honest public-readiness verdicts + blockers. See `public-readiness.md`.

## Tests

`npm run smoke:coding-os` (also part of `npm test` and `npm run validate`) covers path safety,
secret detection, command guarding, project registration, the full patch lifecycle (including
approval-gate bypass attempts, conflict detection, exact-content writes, and re-apply refusal),
approvals, commands, tasks, decisions, and search.
