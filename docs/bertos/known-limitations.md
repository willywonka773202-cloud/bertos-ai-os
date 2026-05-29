# BertOS — Known Limitations

Honest list of what is **not** done or not production-grade. Pairs with `public-readiness.md`.

## Hosting / multi-user
- **No authentication or user isolation.** One shared runtime store. Not safe for multi-user public hosting.
- **Hosted storage is ephemeral** (Vercel `/tmp`). Data is lost on redeploy. Durable adapters are scaffolded but not implemented.

## AI
- AI quality depends entirely on the configured provider. With none online, the assistant is **local deterministic** (grounded summaries, not generative).
- The assistant builds a compact grounding pack (structure, git, validation, tasks, decisions) — it does **not** read every file into context.
- Conversation history **is persisted** server-side as threads (`data/bertos/coding/threads.json`); secrets are redacted before storage. (Single-user, local.)

## Patches / files
- Patch proposals are full-file `after` content; the cockpit renders a **true client-side line diff** against current file content, but the stored proposal format is full-file.
- File preview is capped (size + redaction). No in-app editing.

## QA
- Validation (`npm run validate`), HTTP route smoke, **and a real browser pass (Preview MCP)** have been run. A real AI turn was verified through **Ollama Local** (`llmUsed: true`), not just deterministic fallback.
- On **narrow/mobile widths** the immersive "Praetorium" game layer (an intentional feature — "every route a Praetorium chamber") stacks above the work content, so you scroll past it to reach the cockpit/assistant. At desktop width the layout is sidebar + compact hero + work surface.

## Lint
- `npm run lint` uses `next lint`, which can prompt interactively for first-time ESLint config; it is not part of `npm run validate`. Use typecheck + tests + build as the gate.

## External integrations
- Gmail, Calendar, Buffer, YouTube, Readwise, FAL, Remotion, Hyperframes, Paper, Excalidraw, GitHub, Vercel are **not** verified live and are represented as setup-required/planned. No external integration is claimed live unless configured and verified.
