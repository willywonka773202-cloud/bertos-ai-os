# BertOS — AI Provider Setup

BertOS routes AI requests through a provider router (`lib/bertos/providers/router.ts`).
The AI Command Center and Assistant use whatever provider is **verified online**; with no
provider online they fall back to **local deterministic mode** (grounded, but no LLM) — and
say so explicitly in the UI. BertOS never fakes an AI response.

Check live provider status at `GET /api/bertos/coding/assistant` or in the cockpit AI Command Center header.

## Supported providers

| Provider | Kind | How it's detected |
| --- | --- | --- |
| Ollama (local) | local daemon | Local Ollama server reachable |
| Claude Code CLI | local CLI | `claude` CLI available via the local daemon |
| Codex CLI | local CLI | `codex` CLI available via the local daemon |
| Gemini CLI | local CLI | `gemini` CLI available |
| Gemini API (native) | API | API key configured in env |
| Hermes (Nous) | API endpoint | Hermes endpoint + key configured in env |

Statuses surface as: **online** (verified reachable) or **offline** (with a reason). The
router only routes to providers it has verified as online.

## Configuring keys (safety)

- API keys live in **environment variables only** — never in BertOS memory, outputs, or the UI.
- BertOS does not read `.env` files directly and never displays secret values; it only checks
  presence to report a provider as configured.
- Paid APIs are off by default and gated; enable them deliberately.

## No provider configured?

That's fine for trying BertOS:
- The assistant answers in **local deterministic mode**, grounded in your real project context.
- Workflows still produce real outputs, runs, tasks, and memory proposals.
- The UI labels everything `local · no LLM` so you're never misled.

To get AI-authored answers, run a local Ollama model or make a CLI/API provider available,
then reload — the AI Command Center header will switch to the provider name.

## Test AI provider

The AI Command Center has a **Test** button (and `POST /api/bertos/coding/provider-test`). It
sends a tiny prompt to verify a provider truly responds and tells you exactly what to fix if
not. It only runs a live generation against a **free/local** provider unless paid testing is
explicitly enabled (respecting "no paid API without approval").

**Verified:** a live turn through **Ollama Local** (`ollama-pro`) was confirmed end-to-end —
the assistant produced a real, repo-grounded answer (`llmUsed: true`) and saved a thread,
output, and run. With Ollama running locally, BertOS uses real AI, not fallback.

## Provider Hub (use every model from one place)

`/providers` is the unified hub. For each provider it shows status (online / offline /
missing_credentials / setup_required), cost mode (free-local / subscription / paid), capability
flags (text, edit code, tools, long-context, safe-auto), models, best-use, a **Test** button,
last test result, and an expandable setup guide. "Test all" checks every provider; paid providers
are only live-tested when you tick **Allow paid-API live tests**.

API: `GET /api/bertos/providers`, `GET /api/bertos/providers/[id]`,
`POST /api/bertos/providers/[id]/test`, `POST /api/bertos/providers/test-all`,
`GET /api/bertos/providers/[id]/setup`, `GET /api/bertos/providers/[id]/models`.

### Routing modes & multi-provider (in `/assistant` and the cockpit)

The AI Command Center **Route** selector: Auto · Local/free only · Best planner (Claude→Gemini→Ollama) ·
Best code editor (Codex→Claude→Ollama) · Best reviewer · Long-context (Gemini→Claude) · Fast & cheap
(Ollama) · or a specific online provider. **Ask all & compare** queries every online provider, runs
each as an AgentRun lane, and saves a deterministic synthesis (`POST /api/bertos/coding/assistant/compare`).
Routing only ever picks a provider that is actually online — no false claims.

### Patch from a provider

`POST /api/bertos/coding/patch-from-provider` asks the chosen provider for a structured patch,
parses it into an **approval-gated PatchProposal** (never auto-applied), and saves invalid output as
a draft for repair. Apply still happens only through the Patch Forge after approval.
