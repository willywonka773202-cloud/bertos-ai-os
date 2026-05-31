# BertOS AI OS Night Build Research

Last updated: 2026-05-26

## What Strong AI OS Products Converge On

BertOS should keep moving toward one local-first command center where providers, agents, skills, plugins, memory, outputs, workflow runs, approvals, and previews share the same runtime state.

Primary references used for the in-app OS benchmark:

- Open WebUI features: https://docs.openwebui.com/features/
- AnythingLLM docs: https://docs.anythingllm.com/
- LibreChat agents: https://www.librechat.ai/docs/features/agents
- Dify agents: https://docs.dify.ai/en/use-dify/build/agent
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Gemini CLI: https://google-gemini.github.io/gemini-cli/
- Vercel AI Elements: https://vercel.com/academy/ai-sdk/ai-elements

## Integrated Into BertOS

- Added a canonical AI OS benchmark matrix in `lib/bertos/ai-os-benchmark.ts`.
- Added `/api/bertos/os-benchmark` for live feature coverage, runtime counts, sources, and prioritized gaps.
- Added the benchmark to the Launch Readiness cockpit so publishability is measured in-app.
- Added smoke coverage to `scripts/test-creator-os.mjs`.
- Scoped browser-held API keys so chat routes receive only the key relevant to the selected provider.
- Moved the Ollama Cloud test key out of query strings and into a POST body.
- Added a server-side gate for Gemini Native API usage so client flags cannot unlock server-held paid credentials.

## Highest-Leverage Remaining Work

- Add provider test buttons for Codex, Gemini CLI, Claude Code, Ollama, and Hermes.
- Record routing decisions, provider source, latency, and tool events on every response.
- Add workflow checkpoints so interrupted runs can resume without rerunning successful steps.
- Add artifact feedback buttons that create reviewed memory proposals.
- Add local import for Readwise/markdown/CSV notes so second-brain grounding can work without paid connectors.
- Add a first-class preview router for markdown, code, HTML, JSON, image, video, diagram, canvas, and email-table artifacts.
- Add an extension guide for community skills/plugins before a public GitHub launch.
