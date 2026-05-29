# BertOS Local Setup

Run these commands from the repo root:

```bash
cd /Users/willlambert/Documents/BertOS
```

## Start the web app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Start the local daemon

Use a second terminal:

```bash
cd /Users/willlambert/Documents/BertOS
npm run bertos:daemon
```

The daemon enables local-only features:

- Workspace file reads and saves
- Safe terminal commands
- Git status and diff
- Dashboard typecheck/build buttons
- Autopilot project checks
- Claude Code, Codex CLI, and Gemini CLI agent runs

Gemini Native API does not require the daemon, but it does require a server-side `GEMINI_API_KEY` or `GOOGLE_API_KEY`. See `docs/gemini-native-provider.md`.

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

```bash
npm run bertos:daemon
```

## Use the deployed BertOS domain from this desktop

Open `https://bertos-ai-os.vercel.app` while the daemon is running. The production app uses the browser-local daemon bridge to call `http://127.0.0.1:8787`, so the Vercel server does not need access to your laptop.

Check Settings -> Local CLI Bridge. Healthy output should show:

- `Online`
- `Repo safe`
- Claude Code, Codex CLI, and Gemini CLI detected when those CLIs are installed

## Use BertOS from a phone

A phone cannot reach the Mac daemon at `127.0.0.1`. Use a secure HTTPS tunnel and a daemon token:

```bash
BERTOS_DAEMON_TOKEN=replace-with-a-strong-secret npm run bertos:daemon
cloudflared tunnel --url http://127.0.0.1:8787
```

Then open BertOS on the phone, go to Settings -> Local CLI Bridge, set:

- Browser daemon URL: the HTTPS tunnel URL
- Daemon token: the same `BERTOS_DAEMON_TOKEN`

Do not expose the daemon publicly without a token.

## Common issues

- Start commands from `/Users/willlambert/Documents/BertOS`, not another repo.
- Keep the daemon terminal open. Closing it takes the local bridge offline.
- Vercel cannot access your desktop daemon from the server. The production app uses the browser daemon bridge for desktop use and an HTTPS tunnel for phone use.
- BertOS never starts the daemon from the browser; it only provides the command to run.
