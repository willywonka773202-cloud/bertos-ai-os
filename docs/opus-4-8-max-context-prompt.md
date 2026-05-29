# BertOS Opus 4.8 Max Handoff Prompt

You are continuing BertOS from the current GitHub branch. Do not rely on old summaries. Pull and inspect the repo directly before changing code.

Repository:
- GitHub: `https://github.com/willywonka773202-cloud/bertos-ai-os`
- Branch to use: `codex/hermes-hostinger-provider`
- Production app: `https://bertos-ai-os.vercel.app`
- Latest verified Vercel deployment from this handoff: `https://bertos-ai-q2ppnugri-willywonka773202-clouds-projects.vercel.app`
- `HiClaw/` is registered as a submodule pointing at `https://github.com/agentscope-ai/HiClaw.git` commit `a994578`. Initialize it only if you need the HiClaw reference code.

Operating rules:
- Do not read `.env*` files.
- Do not expose secrets.
- Do not push, deploy, publish, send email, schedule calendar events, delete files, or use paid APIs without explicit approval.
- Do not touch Sylistly code, remotes, domains, or branches.
- Keep BertOS local-first by default. Hosted Vercel runtime storage is ephemeral unless a real persistence layer is added.
- External integrations must be represented honestly as `ready`, `missing_credentials`, `planned`, or `disabled`. Do not claim Gmail, Calendar, Buffer, YouTube, Readwise, FAL, Remotion, Hyperframes, Paper, or Excalidraw are live unless setup and credentials are verified.
- Generated runtime data belongs under `data/bertos/` locally and is gitignored.

Current verified state:
- The app builds on Vercel production.
- `https://bertos-ai-os.vercel.app` redirects to `/dashboard`.
- `/api/health` returns `runtime.initialized: true` on Vercel with root `/tmp/bertos/data`.
- `/api/bertos/readiness` returns `ok: true` and recently scored `99`.
- Local validation most recently passed:
  - `npm run typecheck`
  - `npm run smoke:creator-os`
- `npm test` does not exist.
- `npm run lint` is still not usable non-interactively because `next lint` prompts to configure ESLint.

Recent major implementation areas already present:
- Canonical BertOS runtime types in `lib/bertos/types.ts` and `lib/bertos/types-runtime.ts`.
- Runtime initialization in `lib/bertos/runtime-init.ts`.
- Shared runtime pathing in `lib/bertos/runtime-store.ts`; locally uses `data/bertos`, on Vercel uses writable ephemeral `/tmp/bertos/data`.
- Output Registry in `lib/bertos/outputs/` with version-safe artifact file writes, metadata, preview descriptors, checksums, source links, and path traversal protection.
- Markdown Memory Vault and review queue in `lib/bertos/memory/`, including proposal editing, approval/rejection audit fields, risk flags, target files, and secret/private-content safety rules.
- Skill registry in `lib/bertos/skills/`, seeded slash-command skills, skill parsing/validation, duplication, patch proposals, and invocation scaffolding.
- Plugin registry and permission gates in `lib/bertos/plugins/`, including setup-required/degraded states and gates for paid APIs, email sending, calendar scheduling, file deletion, publishing, likeness/persona generation, memory isolation, and source-link requirements.
- Grounding packs in `lib/bertos/grounding/`, persisted locally and attachable to outputs/runs.
- Workflow definitions and runner in `lib/bertos/workflows/`, including output creation, memory proposals, lanes, validation status, and run records.
- Run ledger in `lib/bertos/runs/`.
- Studio and local publishing queue schemas in `lib/bertos/studio/` and `lib/bertos/publishing/`.
- Automation candidate and reflection scaffolding in `lib/bertos/automation/`.
- Creator OS smoke coverage in `scripts/test-creator-os.mjs`.

Dashboard/API surfaces already added:
- Pages:
  - `/skills`
  - `/plugins`
  - `/outputs`
  - `/memory-review`
  - `/runs`
  - `/studio`
  - `/publishing-queue`
  - `/content-lab`
  - `/inbox-deals`
  - `/launch`
  - `/hermes`
- APIs:
  - `/api/bertos/skills`
  - `/api/bertos/plugins`
  - `/api/bertos/outputs`
  - `/api/bertos/memory/search`
  - `/api/bertos/memory/proposals`
  - `/api/bertos/grounding`
  - `/api/bertos/workflows/run`
  - `/api/bertos/runs`
  - `/api/bertos/studio/assets`
  - `/api/bertos/publishing/queue`
  - `/api/bertos/automations/candidates`
  - `/api/bertos/automations/reflection`
  - `/api/bertos/readiness`

Key known limitations:
- Vercel runtime writes are ephemeral. If cloud persistence is required, add a real storage adapter with clear setup status and migration rules.
- Lint needs migration away from interactive `next lint`.
- There is no formal `npm test` script yet.
- Some UI sections are functional scaffolds and should be hardened with deeper empty/loading/error states and browser verification.
- External connector actions remain setup-gated/degraded unless real credentials/tools are configured.

Your first actions:
1. Pull branch `codex/hermes-hostinger-provider`.
2. Read `AGENTS.md`, `package.json`, `.gitignore`, `lib/bertos/runtime-store.ts`, `lib/bertos/runtime-init.ts`, `lib/bertos/outputs/registry.ts`, `lib/bertos/memory/registry.ts`, `lib/bertos/plugins/registry.ts`, `lib/bertos/skills/registry.ts`, `lib/bertos/workflows/runner.ts`, `scripts/test-creator-os.mjs`, and the relevant app pages/API routes.
3. Run `npm run typecheck` and `npm run smoke:creator-os` first. If feasible, run `npm run build` and `npm run bertos:safety`.
4. Continue implementation only after verifying what is actually present.

Priority next work:
1. Add non-interactive lint support or replace the deprecated `next lint` script with an ESLint CLI setup that works in CI.
2. Add a real `npm test` script and split Creator OS smoke coverage into focused tests where practical.
3. Add durable optional cloud persistence adapters for Vercel-hosted runtime data, while preserving local-first defaults and setup-required states.
4. Browser-verify the new BertOS dashboard sections, especially Skills, Plugins, Output Registry, Memory Review, Runs, Studio, Publishing Queue, Content Lab, and Inbox / Deals.
5. Harden all risky action gates end-to-end in APIs and UI. No send/schedule/publish/delete/paid API calls without explicit approval.
6. Expand workflow runs so every local run produces artifacts, validation results, lane logs, memory proposals when appropriate, and dashboard events.
7. Keep reporting concrete files changed, validations run, deployment state, and honest blockers.

Do not create a parallel app or a new architecture plan. Continue improving the existing BertOS implementation in this repo.
