# BertOS — Deployment

> BertOS is local-first. Deploying is optional and, until auth + durable storage exist, only
> appropriate as a **single-user demo**. See `public-readiness.md` and `known-limitations.md`.

## Run locally (recommended)

```bash
npm install
npm run dev          # http://localhost:3000
```

For phone access on the same Wi-Fi, bind to all interfaces and use your machine's LAN IP:

```bash
npm run dev -- --hostname 0.0.0.0
# then open http://<your-LAN-IP>:3000 on the phone (not localhost)
```

Data persists under `data/bertos/` (gitignored).

## Production build

```bash
npm run build
npm start
```

## Validate before shipping

```bash
npm run validate     # typecheck + build + safety + all smoke suites
npm test             # smoke suites only (fast)
```

## Hosted (Vercel) — demo only

- Storage is ephemeral (`/tmp`); data is lost on redeploy. The UI shows a banner.
- No multi-user isolation — treat as single-tenant.
- Configure provider keys via Vercel env vars (never commit them). BertOS reads presence only.
- Do **not** register private repositories on a shared hosted instance.

## Do not (without explicit approval)
- push, deploy, publish, send email, schedule calendar events, or call paid APIs.

These remain manual, approval-gated actions by design.
