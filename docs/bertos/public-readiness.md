# BertOS — Public Readiness

This page is the honest answer to "can other people use this yet?"

Check the live status any time at **`/settings`** (Readiness card) or `GET /api/bertos/coding/readiness`.

## What is ready vs not ready

| Capability | Status | Notes |
| --- | --- | --- |
| Local single-user use | ✅ Ready | Full cockpit, AI assistant (local or provider), patches, runs, memory — persists under `data/bertos`. |
| Main AI interface | ✅ Ready (provider-dependent) | Project-aware assistant uses the configured provider; falls back to honest local deterministic mode with no provider. |
| Hosted single-user demo | ⚠️ Works, ephemeral | Runs on Vercel, but `/tmp` storage is wiped on redeploy. Clearly labelled in-app. |
| Hosted multi-user production | ❌ Not ready | No authentication or per-user data isolation, and hosted storage is ephemeral. |
| Durable hosted storage | ❌ Not configured | Adapter interface exists (`lib/bertos/coding/storage.ts`); Vercel Blob / database adapters are detected by env but not yet implemented. |

## The three readiness verdicts

- **`localUseReady`** — true. BertOS is a complete daily coding OS on your machine.
- **`publicDemoReady`** — true *as a single-user demo*, with an explicit ephemeral-storage banner. Do not register private repos on a shared hosted instance.
- **`publicMultiUserReady`** — **false**. Requires both: (1) auth + per-user data isolation, (2) a durable storage adapter.

## Blockers to public multi-user launch

1. **No auth / user isolation.** All runtime records share one store. `getAuthStatus()` reports `userIsolation: false`. A hosted instance is effectively single-tenant.
2. **Ephemeral hosted storage.** On Vercel, data lives in `/tmp` and is lost on redeploy. A durable adapter must be wired.
3. **Provider configuration is per-deployment.** With no provider online the assistant is deterministic-only (still useful, but not "AI").

## How to read the in-app status

The Cockpit **Readiness & Storage** card and the `/settings` page show:
- storage mode + durable/ephemeral
- auth/isolation mode
- providers online / total
- local / demo / multi-user verdicts
- the live blocker list

Nothing here is hidden or aspirational — the verdicts are computed from real runtime state.
