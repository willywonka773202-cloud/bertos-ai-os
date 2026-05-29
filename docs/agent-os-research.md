# Agent OS Research Notes

This document captures the patterns BertOS should absorb from current agentic operating systems and coding-agent workbenches.

## Sources Reviewed

- [OpenHands](https://github.com/OpenHands/OpenHands): SDK, CLI, local GUI, cloud/enterprise deployments, GitHub integrations, repository microagents, and sandboxed runtime architecture.
- [OpenHands repository customization](https://docs.openhands.dev/openhands/usage/prompting/repository): repo-level microagents plus optional setup and pre-commit hooks.
- [SWE-agent](https://github.com/SWE-agent/SWE-agent): configurable software engineering agent built around agent-computer interface design.
- [SWE-agent architecture](https://swe-agent.com/0.7/background/architecture/): persistent environment shell, history compression, custom commands, and action/observation loop.
- [SWE-agent trajectories](https://github.com/SWE-agent/SWE-agent/blob/main/docs/usage/trajectories.md): JSON trajectory files with thought, action, observation, config, and repeatability evidence.
- [AutoGPT Platform](https://github.com/Significant-Gravitas/AutoGPT): low-code agent builder, workflow blocks, deployment controls, marketplace, monitoring, and analytics.
- [CrewAI Flows](https://crewai.com/crewai-flows): controlled, event-driven workflows that can mix rules, functions, LLM calls, and multi-agent crews.
- [LangGraph agents](https://www.langchain.com/agents): durable orchestration, stateful agents, memory, and human-in-the-loop control.
- [Agent Zero](https://github.com/agent0ai/agent-zero): full Linux container, desktop/browser surfaces, plugin hub, skills, memory, and host-machine connector.
- [Stagehand](https://github.com/browserbase/stagehand): browser-agent primitives that separate observe, act, extract, and autonomous agent steps.
- [E2B Fragments](https://github.com/e2b-dev/fragments): secure code execution sandboxes and streaming UI for generated apps.

## Adopted Patterns

- Repository microagent context: BertOS now includes `.openhands/microagents/repo.md` so compatible external agents receive compact repo purpose, setup, safety, and validation rules.
- Agent-computer interface: missions now ask agents to separate search, file reads, patch proposals, and validation instead of improvising broad shell access.
- Trajectory ledger: missions now require action/observation evidence and validation status in the final report.
- Approval checkpoints: missions now pause before deletes, paid calls, pushes, deploys, or broad rewrites.
- Sandbox boundary: missions now reinforce the BertOS repo boundary, daemon safety gates, and honest missing-setup states.
- Workflow blocks: broad missions now decompose into named blocks with owner, output, and validation signal.
- Browser observe-act: UI missions now require current-state inspection and visual verification when a dev server is available.
- Memory handoff: broad or agentic missions now ask for reusable decisions, constraints, and follow-up risks instead of chat-only context.

## Routing and Parallelism Model

BertOS now uses a shared orchestration planner in `lib/bertos/agent-orchestrator.ts`.

- Ollama Pro: default cheap lane for classification, short summaries, memory handoffs, and fallback.
- Gemini CLI / Gemini Native: broad planning, research, long-context synthesis, and judge-style work.
- Claude Code: UI/UX, architecture, refactor quality, and review lanes.
- Codex CLI: implementation, patch generation, typecheck/build/safety validation, and direct failure repair.
- Hermes Agent: server-side setup-gated lane only; never included in automatic execution unless explicitly configured and approved.

Broad prompts can fan out into read-only parallel lanes first. Mutating lanes such as implementation, validation commands, push/deploy, deletes, paid calls, or production/webhook work stay sequential and approval-gated.

Token policy is explicit per lane: the planner estimates prompt tokens, reserves output tokens, chooses full/focused/summarized/chunked context, and warns when a provider should receive compressed context instead of raw files.

## Provider Tab UX

Multi-model UIs such as LibreChat and Open WebUI make model choice a first-class action, while OpenHands and Agent Zero keep setup state close to the agent surface. BertOS follows that split:

- `/chat` and `/engines/bertos` are the combined router.
- `/engines/codex`, `/engines/claude`, `/engines/gemini`, `/engines/ollama`, and `/engines/hermes` are direct engine conversations.
- Direct tabs preserve local per-engine history.
- Provider status is shown in the tab, and missing daemon/API/paid setup blocks sends instead of falling through silently.
- Planned or metered engines can exist in the registry without becoming automatic routing defaults.

## Next Candidates

- Add a first-class trajectory viewer for Builder and Workspace patch runs.
- Add explicit approval-gate objects to patch proposals and Max Mode missions.
- Add browser-route smoke checks that store screenshot and console-error evidence.
- Add provider/runtime capability probes so planned integrations can graduate only after local verification.
