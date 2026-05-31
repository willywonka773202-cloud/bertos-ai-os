# BertOS — Storage & Persistence

BertOS is **local-first**. Runtime data (projects, runs, outputs, tasks, decisions, patches,
memory proposals) is stored as JSON under `data/bertos/` and is gitignored.

Live status: `GET /api/bertos/coding/readiness` → `storage`, or the cockpit Readiness card.

## Storage modes

| Mode | When | Durable? |
| --- | --- | --- |
| `local-filesystem` | Running locally (default) | ✅ Yes — persists on your machine |
| `vercel-ephemeral` | `VERCEL` env present | ❌ No — `/tmp` wiped on redeploy |
| `custom-path` | `BERTOS_DATA_ROOT` set | Depends on the path (durable unless under temp) |

The data root is resolved by `lib/bertos/runtime-store.ts`:
- `BERTOS_DATA_ROOT` if set
- else `/tmp/bertos/data` on Vercel
- else `./data/bertos` locally

## Durable adapter interface

`lib/bertos/coding/storage.ts` exposes a storage status with a `durableAdapter` field
(`none | vercel-blob | database | sqlite`). The presence of `BLOB_READ_WRITE_TOKEN` /
`DATABASE_URL` / `POSTGRES_URL` flips `durableAdapterConfigured` to true.

**Honest state today:** the adapter *interface and detection* exist, but the durable
read/write adapters (Blob/DB) are **not implemented** — they are scaffolded and reported as
`setupRequired` when running on ephemeral storage. Local filesystem persistence is fully real.

## What persists vs what doesn't

- **Local:** everything under `data/bertos` persists across restarts.
- **Hosted (Vercel, no adapter):** everything is ephemeral and lost on redeploy. The cockpit
  shows a clear warning; do not rely on hosted storage for anything you want to keep.

## Recommended setup

- **Personal daily use:** run locally. Durable, private, fast.
- **Sharing a demo:** host on Vercel and accept ephemerality (the UI warns about it).
- **Production multi-user:** implement a durable adapter **and** auth/user isolation first
  (see `public-readiness.md`).
