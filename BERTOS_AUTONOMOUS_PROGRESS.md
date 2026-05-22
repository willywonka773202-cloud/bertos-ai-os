# BertOS Autonomous Progress

## Current Recovery Pass

- Verified this work is inside `C:\Users\owner\bertos-ai-os` on `main` with remote `https://github.com/willywonka773202-cloud/bertos-ai-os.git`.
- Checked `.env.local` for tracked changes without printing secret contents. No tracked `.env.local` restore was needed.
- Inspected `components/bertos/panels/SettingsView.tsx`; the reported unmatched JSX damage is not present in the current checkout.
- Ran `npm run typecheck` before feature work; it passed.

## Fixes Applied

- Added exactly one Hermes / Nous Proxy card to Settings > Providers.
- Marked Hermes / Nous as paid API credits required, not default, and disabled from routing unless `ENABLE_HERMES_PAID=true`.
- Added Hermes / Nous status metadata to `/api/providers/status` without calling chat completions or spending credits.
- Added a `/builder` page that reuses the existing Coding mission center instead of creating a duplicate builder system.

## Provider Setup

- Default/free path: Ollama / Ollama Pro / local Ollama models.
- CLI/subscription helpers: Claude Code CLI, Codex CLI, Gemini CLI.
- Structured planning API: Gemini Native API when explicitly configured.
- Paid optional connector: Hermes / Nous Proxy. Paid credits are required and no free Nous text/chat model is available on this account.

## How To Run

```powershell
npm run dev
npm run bertos:daemon
```

Use the app at the Next.js local URL, then open:

- `/dashboard` for system status
- `/chat` for chat
- `/settings` for provider setup
- `/builder` or `/coding` for mission building

## Known Limitations

- Hermes / Nous is status-only unless paid routing is explicitly enabled with `ENABLE_HERMES_PAID=true`.
- BertOS does not run Hermes / Nous chat completion tests in this pass.
- Local repo commands, file operations, and CLI agents still require `npm run bertos:daemon`.
