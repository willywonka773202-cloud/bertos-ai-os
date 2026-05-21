# Gemini Native API Provider

BertOS supports Gemini in two separate ways:

- `gemini-cli`: local CLI provider through the BertOS daemon.
- `gemini-api-native`: server-side Google GenAI SDK provider for structured planning.

Gemini Native API is intended for:

- structured JSON agent plans
- long-context planning
- council judge synthesis
- workspace patch planning
- system analysis
- Autopilot project health reports
- future multimodal inputs and context caching

## Setup

Add the key only to local or deployment environment variables. Do not paste it into chat and do not commit it.

```env
GEMINI_API_KEY=your_key_here
```

`GOOGLE_API_KEY` is also supported as a fallback.

## Local

Use `.env.local`:

```powershell
cd C:\Users\owner\bertos-ai-os
notepad .env.local
```

Restart `npm run dev` after changing environment variables.

## Vercel

Add `GEMINI_API_KEY` in Vercel Project Settings -> Environment Variables, then redeploy.

## Safety

- API keys stay server-side.
- Provider status only returns configured/missing booleans.
- Gemini Native API is billed separately by Google.
- Gemini CLI remains available as the no-API fallback when the local daemon is running.

## Structured modes

The route `POST /api/providers/gemini-native` supports:

- `chat`
- `structured-plan`
- `workspace-patch-plan`
- `council-judge`
- `system-analysis`
- `autopilot-report`

Structured modes request JSON output with explicit schemas. If the key is missing, the route returns a clear setup error instead of pretending success.
