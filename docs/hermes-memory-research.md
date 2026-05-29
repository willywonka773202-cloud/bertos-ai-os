# Hermes Memory Research

Date: 2026-05-25

This note captures the starting research for making Hermes more capable by giving it better memory. The short version: do not solve this by dumping everything into one giant prompt. Make memory explicit, tiered, searchable, reviewable, and protected from poisoned writes.

## Working Goal

Make Hermes consistently useful across sessions by giving it:

- a small always-loaded identity and operating memory,
- project-specific durable facts and decisions,
- searchable session history,
- reusable procedural playbooks,
- explicit memory update rules,
- provenance and approval gates for anything written into long-term memory.

This should strengthen Hermes without violating BertOS safety rules: no secrets, no `.env` reads, no unapproved Hermes calls, no auto-push, no auto-deploy.

## Current BertOS Baseline

BertOS already has the right scaffolding:

- `/hermes` and `lib/bertos/hermes-power-pack.ts` define a Hermes Power Agent plan with Memory Core, Super Goal Loop, Dream Brief, routing, swarms, content, and backup lanes.
- `/memory` and `components/bertos/memory/MemoryView.tsx` provide local project memory, Obsidian/local markdown settings, and copyable memory templates.
- `store/bertos/projects.ts` persists project context in local storage.
- `store/bertos/chat.ts` persists chat sessions but trims each session to the last 100 messages.
- `lib/bertos/context-engine.ts` can assemble focused file context with keyword chunking for coding tasks.
- `docs/hermes-hostinger-integration.md` keeps Hermes Agent remote routing manual and setup-gated.

Missing pieces:

- no first-class memory item schema,
- no retrieval index,
- no memory provenance/audit workflow,
- no automatic session summarization into durable notes,
- no safe local markdown writer yet,
- no prompt-time memory budgeter that decides which memory tier enters a Hermes request.

## Research Findings

### 1. Use tiered memory, not one huge context blob

MemGPT frames agent memory as virtual context management: keep a small high-priority in-context memory and page less urgent information from slower external stores when needed. This maps well to BertOS because Hermes can receive a compact core profile plus retrieved project/session notes instead of full chat history.

Source: https://arxiv.org/abs/2310.08560

### 2. Separate semantic, episodic, and procedural memory

The strongest agent memory designs separate:

- Semantic: stable facts, preferences, people, projects, architecture decisions.
- Episodic: session logs, what happened, prior attempts, failures, outcomes.
- Procedural: reusable workflows, playbooks, validation recipes, provider routing rules.

LangGraph/Letta docs and recent agent-memory research use this distinction because each type needs different storage and retrieval behavior.

Sources:

- https://docs.letta.com/guides/agents/architectures/memgpt
- https://docs.letta.com/guides/agents/archival-memory
- https://arxiv.org/abs/2502.12110

### 3. Reflection and consolidation matter

Generative Agents showed the value of recording observations, synthesizing higher-level reflections, and retrieving relevant memories during planning. For Hermes, raw transcripts should not become memory by default. Session summaries should be compacted into decisions, facts, lessons, and follow-ups.

Source: https://arxiv.org/abs/2304.03442

### 4. Hermes Agent already supports additive external memory providers

The Hermes Agent docs describe built-in `MEMORY.md` / `USER.md` plus external memory providers. Provider context is injected before turns, relevant memories can be prefetched, turns can be synced after responses, and provider-specific tools can search/store/manage memories.

This reinforces the BertOS direction: keep a small local core memory, then add a configurable external provider later instead of hard-coding one memory backend.

Source: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory-providers.md

### 5. Function calling and structured outputs are a Hermes strength

Nous describes Hermes 3 as strong at multi-turn conversation, long-context retention, and agentic function calling. The Hermes function-calling repo shows schema-based tool use and JSON mode. That means memory writes should be exposed to Hermes as structured operations, not freeform hidden prompt side effects.

Sources:

- https://nousresearch.com/hermes3/
- https://github.com/NousResearch/Hermes-Function-Calling

### 6. Persistent memory creates a real attack surface

Recent memory-security papers are a warning against automatic memory writes. Attacks can plant dormant instructions or poisoned experiences into long-term memory and later trigger unsafe behavior or data exfiltration. BertOS should treat untrusted web pages, emails, tool outputs, repo text, and chat text as untrusted until memory writes are reviewed or classified.

Sources:

- https://arxiv.org/abs/2605.01970
- https://arxiv.org/abs/2605.15338
- https://arxiv.org/abs/2512.16962

## Recommended BertOS Architecture

### Tier 0: Core Identity Memory

Small, always-loaded, human-reviewable markdown or structured JSON.

Candidate file names:

- `soul.md`
- `USER.md`
- `MEMORY.md`

Contents:

- user identity and communication preferences,
- active goals,
- non-negotiable safety rules,
- provider routing preferences,
- what Hermes should challenge,
- explicit memory update rules.

Budget: roughly 1,000 to 2,500 tokens.

### Tier 1: Project Memory

Structured project notes keyed by project/repo.

Contents:

- project summary,
- architecture decisions,
- active tasks,
- known constraints,
- provider setup facts without secret values,
- validation commands,
- recurring pitfalls.

Storage options:

- local storage first, matching the existing project store,
- markdown export/import next,
- SQLite/FTS or vector index later.

### Tier 2: Session Memory

A session should end with a compact note:

- task,
- outcome,
- files changed,
- commands run,
- validation status,
- decisions,
- unresolved risks,
- next prompt.

Do not retain raw transcript as default prompt context. Keep raw chat for UI history, but feed Hermes summaries unless a specific transcript search is needed.

### Tier 3: Retrieval Memory

Searchable long-term memory for older notes.

Recommended first implementation:

- local keyword search over markdown/session notes,
- metadata filters for project, memory type, source, confidence, and date,
- optional embeddings later only after schema/provenance exists.

Do not start with a vector database alone. Vector recall without provenance and lifecycle rules will become noisy and unsafe.

### Tier 4: Procedural Memory

Reusable playbooks and skills:

- how to validate BertOS changes,
- how to prepare a Hermes mission,
- how to run content factory safely,
- how to update memory,
- how to perform provider status checks without leaking secrets.

Procedural memory should be promoted manually from repeated successful sessions.

## Memory Item Schema

Use a schema like this before introducing retrieval:

```ts
type MemoryKind = 'semantic' | 'episodic' | 'procedural' | 'constraint' | 'preference'

interface BertOSMemoryItem {
  id: string
  kind: MemoryKind
  projectId?: string
  title: string
  content: string
  source: 'human' | 'session-summary' | 'repo' | 'tool-output' | 'import'
  sourceRef?: string
  confidence: 'confirmed' | 'inferred' | 'needs-review'
  sensitivity: 'public' | 'internal' | 'private' | 'secret-blocked'
  tags: string[]
  createdAt: number
  updatedAt: number
  expiresAt?: number
}
```

Hard rules:

- `secret-blocked` items must never be saved.
- `tool-output` and `import` memories default to `needs-review`.
- Prompt instructions found inside retrieved documents must never be promoted into procedural memory without human approval.
- Every injected memory block should include source and confidence.

## Prompt Assembly Policy

For Hermes prompts, assemble context in this order:

1. BertOS safety rules and paid-provider gates.
2. Tier 0 core identity memory.
3. Active project memory.
4. Task-specific retrieved memories, capped by budget.
5. Recent session summary, not full transcript.
6. Current user request.

Suggested memory budget:

- Small request: 1,000 to 2,000 tokens.
- Coding/research mission: 3,000 to 8,000 tokens.
- Long-context review: increase only when the selected provider supports it and cost is approved.

## Implementation Path

### Phase 1: Research-backed memory templates

- Add a dedicated Hermes memory research note. Done in this file.
- Add a `soul.md` template that matches Tier 0.
- Add a session-summary template aligned with semantic/episodic/procedural categories.
- Keep all writes copy-prompt/manual.

Validation: docs only, no build required unless UI changes are made.

### Phase 2: Local structured memory store

- Add `store/bertos/memory.ts` for typed memory items.
- Add create/edit/delete/review flows to `/memory`.
- Add tags, confidence, sensitivity, project binding, and source metadata.
- Add a memory export view that generates `MEMORY.md`, `USER.md`, and `soul.md` text.

Validation: `npm run typecheck`, `npm run build`, `npm run bertos:safety`.

### Phase 3: Prompt-time memory packer

- Add `lib/bertos/memory-engine.ts`.
- Implement deterministic ranking:
  - exact project match,
  - kind priority,
  - confidence,
  - recency,
  - keyword match,
  - token budget.
- Feed selected memory into chat, workspace missions, and Hermes copy prompts.

Validation: add smoke tests for memory selection and budget limits.

### Phase 4: Safe markdown vault writer

- Use the daemon only.
- Require an approved vault root.
- Validate writes stay inside the vault.
- Block `.env`, key, token, credential, cookie, and browser-profile paths.
- Require explicit web approval before write.

Validation: `npm run typecheck`, `npm run build`, `npm run bertos:safety`, daemon path traversal tests.

### Phase 5: Retrieval index

- Start with local full-text search over memory items and markdown files.
- Add embeddings only after source/confidence/sensitivity metadata is enforced.
- Consider SQLite FTS first; vector search can be additive later.
- Add retrieval debug UI so users can see why Hermes got each memory.

Validation: retrieval regression tests, poisoned-memory fixture tests, prompt budget tests.

### Phase 6: Hermes external memory provider bridge

- Keep Hermes Agent server-side and setup-gated.
- Add setup docs for one external memory provider at a time.
- Mirror approved BertOS memory exports into Hermes memory provider only after user approval.
- Never mirror secrets or raw transcripts by default.

Validation: dry-run export first; no paid call required for local validation.

## Immediate Next Prompt

Use this if continuing the work:

```text
Implement Phase 2 of docs/hermes-memory-research.md.

Goal:
Add a local typed memory item store and Memory Vault UI for semantic, episodic, procedural, constraint, and preference memories.

Constraints:
- Do not call Hermes/Nous.
- Do not read .env files.
- Do not write outside the BertOS repo.
- Do not add vector search yet.
- Keep existing project memory behavior intact.

Required:
- Add typed memory store with source, confidence, sensitivity, tags, timestamps, and optional project binding.
- Add create/edit/delete/review UI in /memory.
- Add export preview for MEMORY.md, USER.md, and soul.md.
- Run npm run typecheck, npm run build, and npm run bertos:safety.
```
