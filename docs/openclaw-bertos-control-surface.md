# OpenClaw Control Surface in BertOS

BertOS treats OpenClaw as a local, privileged agent gateway. OpenClaw should not be hidden behind a normal chat tab because its strongest features are gateway-level control: sessions, channels, skills, nodes, cron jobs, logs, configuration, and health.

## What OpenClaw Does Well

- Runs as a self-hosted gateway on the user's hardware.
- Connects AI agents to messaging surfaces such as Telegram, Discord, Slack, iMessage, WhatsApp, WebChat, and plugin channels.
- Keeps stateful sessions, workspace files, skills, tools, memory, and multi-agent routing close to the local machine.
- Can use local model paths through Ollama, while still allowing optional paid providers when the user chooses them.
- Provides its own Control UI on the Gateway port, normally `http://127.0.0.1:18789`.
- Supports scheduled or recurring work through Gateway cron jobs and heartbeat-style checks.

## What BertOS Adds

- A single OpenClaw surface at `/engines/openclaw`.
- Browser-aware provider status from the BertOS desktop daemon.
- OpenClaw Gateway reachability detection from `scripts/bertos-daemon.mjs`.
- Control UI launch routes for chat, overview, sessions, skills, nodes, and config.
- Frame-blocker detection for OpenClaw's `X-Frame-Options` and `frame-ancestors` headers.
- A safe BertOS bridge test through a dedicated OpenClaw session key.
- Clear warnings that BertOS does not store, display, or copy OpenClaw gateway tokens.

## Weak Spots and Guardrails

- OpenClaw is powerful because it can bridge tools, files, terminal commands, messages, and background jobs. That also makes it high-risk.
- Keep the Gateway bound to `127.0.0.1` unless using a secured remote access pattern.
- Use Telegram allowlists before treating a bot as private.
- Install optional skills one at a time and review what each skill can read or execute.
- Run `openclaw security audit --deep` regularly.
- Do not store OpenClaw channel secrets, gateway tokens, or provider API keys in BertOS memory.
- Do not bypass OpenClaw's frame-blocking headers by stripping them in a proxy. If the Control UI blocks iframes, BertOS should launch it in a tab.
- Small local models can fail before a real answer with `Context overflow`. Use a larger-context OpenClaw model before routing long BertOS missions through it.
- Long sessions can also fail with `Auto-compaction could not recover this turn` when OpenClaw does not reserve enough post-compaction headroom. Set `agents.defaults.compaction.reserveTokensFloor` to `20000` or higher in the OpenClaw config.
- Hosted BertOS cannot call a Mac-local OpenClaw Gateway from a phone unless the Mac exposes a secure endpoint or the user uses a remote access layer.

## Local Verification

1. Start or restart the BertOS daemon:

   ```bash
   cd ~/Documents/BertOS
   lsof -tiTCP:8787 -sTCP:LISTEN | xargs kill
   npm run bertos:daemon
   ```

2. Confirm the OpenClaw Gateway is reachable:

   ```bash
   openclaw dashboard --no-open
   ```

3. Open BertOS:

   ```text
   /engines/openclaw
   ```

4. Use the **Test OpenClaw** button. A successful result means:

   ```text
   BertOS web app -> BertOS desktop daemon -> OpenClaw CLI -> OpenClaw model path
   ```

If the test returns `Context overflow`, the OpenClaw CLI path is wired but the selected model is too small for the current agent context. Move OpenClaw to a larger-context model or reset the OpenClaw session before using it for real work.

If OpenClaw Control shows an auto-compaction recovery warning, validate the fix first:

```bash
openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 --strict-json --dry-run
```

Then apply it from outside BertOS if the dry run succeeds:

```bash
openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 --strict-json
```

OpenClaw remains the owner of its gateway token, device pairing, channels, and Control UI session. BertOS should launch the Control UI rather than weaken its browser security headers.
