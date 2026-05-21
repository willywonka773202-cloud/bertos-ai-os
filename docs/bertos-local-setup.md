# BertOS Local Setup

Run these commands from the repo root:

```powershell
cd C:\Users\owner\bertos-ai-os
```

## Start the web app

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Start the local daemon

Use a second PowerShell terminal:

```powershell
cd C:\Users\owner\bertos-ai-os
npm run bertos:daemon
```

The daemon enables local-only features:

- Workspace file reads and saves
- Safe terminal commands
- Git status and diff
- Dashboard typecheck/build buttons
- Autopilot project checks
- Claude Code, Codex CLI, and Gemini CLI agent runs

## Verify health

With the app running, open:

```text
http://localhost:3000/api/local-daemon/health
```

Healthy local output should include:

- `daemonOnline: true`
- `repoDetected: true`
- `gitDetected: true`
- `capabilities.readFiles: true`
- `capabilities.runSafeCommands: true`

If the daemon is offline, BertOS will show:

```text
Local daemon is not running.
```

Fix it with:

```powershell
npm run bertos:daemon
```

## Common issues

- Start commands from `C:\Users\owner\bertos-ai-os`, not another repo.
- Keep the daemon terminal open. Closing it takes the local bridge offline.
- Vercel cannot access your Windows daemon. Local coding features require local dev.
- BertOS never starts the daemon from the browser; it only provides the command to copy.
