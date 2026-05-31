# BertOS Messaging Control

Telegram is the best current messaging control app for BertOS because the repo already has webhook, status, notification, and safe command endpoints for it. Discord and Slack are viable later, but they need additional app registration, OAuth/scopes, and event handling that BertOS does not currently ship.

## Telegram Setup Contract

Configure these server-side environment variables:

```bash
TELEGRAM_BOT_TOKEN=<botfather-token>
TELEGRAM_ALLOWED_CHAT_ID=<your-private-chat-id>
TELEGRAM_WEBHOOK_SECRET=<random-webhook-secret>
TELEGRAM_ALLOW_CHAT=false
TELEGRAM_OLLAMA_MODEL=llama3
```

Expose this webhook URL from the deployed BertOS app:

```text
/api/telegram/webhook
```

Then register it with Telegram's `setWebhook` API using the bot token and the same `TELEGRAM_WEBHOOK_SECRET` as the `secret_token` parameter. Keep the token and secret out of logs and commits.

## Supported Commands

You can use plain language. BertOS maps normal Telegram messages to safe actions:

```text
hey what are we working on?  -> local Ollama chat
explain BertOS simply        -> local Ollama chat
is bertos running?          -> /status
what providers are online?  -> /providers
run typecheck               -> /run-check typecheck
check repo safety           -> /run-check bertos:safety
give me a brief             -> /brief
fix the settings page       -> /coding fix the settings page
```

Plain chat uses local Ollama when BertOS is running locally. It does not route to Hermes, OpenAI, Anthropic, Gemini API, or any external provider.

Slash commands still work when you want exact control:

```text
/status       daemon, repo, branch, dirty tree summary
/daemon       detailed daemon health
/providers    provider bridge status
/hermes       Hermes Hostinger status without a chat completion
/brief        combined operational snapshot
/tasks        task board note
/evolution    improvement backlog note
/memory       memory system note
/coding       review-ready coding task summary
/run-check    safe checks: typecheck, bertos:safety, diff-check
/chat         local Ollama-only chat when TELEGRAM_ALLOW_CHAT=true
/help         command list
```

## Safety Limits

- Telegram cannot write files, apply patches, push git, deploy, merge PRs, or run destructive commands.
- Telegram cannot call Hermes chat completions, external API providers, or paid providers from chat.
- `/chat` uses local Ollama only and requires explicit `TELEGRAM_ALLOW_CHAT=true`.
- `/coding` creates a review-ready task summary only. The browser UI remains the approval point for file edits and patch application.
- `TELEGRAM_ALLOWED_CHAT_ID` is mandatory so random users cannot control the bot.

## Recommendation

Use Telegram for phone-first monitoring, safe checks, and quick task intake. Use the BertOS web app for anything that mutates the repo, touches Hermes/API providers, or requires approval.

## TV Display Mode

Use this when BertOS is open on a monitor or TV and Telegram acts like the remote control.

1. Start local BertOS:

```bash
cd /Users/willlambert/Documents/BertOS
npm run bertos:launch
```

2. Start a public tunnel to the local app:

```bash
cloudflared tunnel --url http://localhost:3004
```

3. Register the Telegram webhook against the tunnel URL:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR-TUNNEL.trycloudflare.com/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

4. Open `http://localhost:3004/dashboard` on the display.

When Telegram sends commands to that webhook, the dashboard's Telegram Remote panel records the command, reply, and safe-check lifecycle. The timeline is in-memory and resets when the BertOS server restarts.
