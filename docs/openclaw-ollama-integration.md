# BertOS OpenClaw + Ollama Integration

BertOS treats OpenClaw as a local agent runtime, not a cloud API provider. The supported path is:

1. Configure OpenClaw locally, preferably through Ollama.
2. Start the BertOS desktop daemon from the BertOS repo.
3. BertOS detects `openclaw` on PATH.
4. BertOS can send direct prompts to OpenClaw through the local daemon only.

## Official Setup Paths

Ollama documents OpenClaw as an assistant integration:

```bash
ollama launch openclaw
```

For configuration without launching:

```bash
ollama launch openclaw --config
```

For headless/non-interactive setup:

```bash
ollama launch openclaw --model kimi-k2.5:cloud --yes
```

OpenClaw also documents its own onboarding flow:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway status
```

Sources:

- https://docs.ollama.com/integrations/openclaw
- https://github.com/openclaw/openclaw

## BertOS Runtime Path

```text
BertOS web app
  -> browser-local BertOS daemon bridge
  -> openclaw CLI
  -> OpenClaw gateway / configured model
  -> Ollama local/cloud model or other OpenClaw model backend
```

BertOS does not expose OpenClaw through the Vercel server. Hosted BertOS cannot call a Mac-only `127.0.0.1` daemon from a phone unless the daemon is exposed through a secure HTTPS tunnel with `BERTOS_DAEMON_TOKEN`.

## Required Local Commands

From the BertOS repo:

```bash
cd ~/Documents/BertOS
npm run bertos:daemon
```

Then open BertOS and select **OpenClaw** from the engine bar or model selector.

For long OpenClaw Control sessions, raise the compaction reserve floor if the UI reports that auto-compaction could not recover the turn:

```bash
openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 --strict-json
```

## Safety Rules

- OpenClaw can control tools and messaging channels, so it is treated as a privileged local agent.
- BertOS only routes OpenClaw through the local daemon.
- Do not expose OpenClaw or the BertOS daemon publicly without authentication.
- Do not store OpenClaw tokens, API keys, or channel secrets in BertOS memory.
- Destructive actions still require BertOS approval gates.
- If OpenClaw is configured with paid providers behind the scenes, those costs are outside BertOS and must be managed in OpenClaw/Ollama.

## Current BertOS Support

BertOS implements:

- `openclaw-cli` model/provider id.
- Local daemon detection for `openclaw`.
- Direct OpenClaw engine page at `/engines/openclaw`.
- Provider status display for OpenClaw.
- Settings setup instructions.
- Chat routing through `openclaw agent --message ... --thinking high` once OpenClaw is installed and onboarded.

BertOS does not install OpenClaw automatically and does not claim OpenClaw is connected until the local daemon detects it.
