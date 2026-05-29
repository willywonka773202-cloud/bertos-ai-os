# Hermes Power Agent Blueprint

This is the BertOS implementation blueprint for a stronger Hermes-style agent. It turns the video ideas into safe, source-grounded operating lanes without claiming planned connectors are live.

## Source-Backed Lanes

| Lane | BertOS surface | State | Purpose | Gate |
| --- | --- | --- | --- | --- |
| Memory Core + `soul.md` | `/memory` | Copy prompt | Identity, preferences, projects, decisions, and long-term goals | No secrets, no `.env` content |
| Super Goal Loop | `/prompts`, `/agents` | Copy prompt | Human-agent transaction plan with acceptance criteria | Approval before writes, paid calls, publish, deploy, push, merge |
| Dream Brief + Background Work | `/brief`, `/autopilot` | Copy prompt | Daily recommendations from memory and current project state | Do not imply calendar/email/meeting access unless connected |
| Model Pantheon Router | `/compare`, `/settings` | Copy prompt | Assign planning, coding, research, design, and cheap summary work by model capability | Hermes/Nous and paid APIs remain manual and gated |
| Kanban Agent Swarm | `/agents`, `/tasks` | Copy prompt | Orchestrator, researcher, builder, reviewer, verifier, memory logger | External agents are copy-prompt until verified |
| Research + Content Factory | `/playbooks`, `/prompts` | Copy prompt | One topic to research brief, article, video script, posts, newsletter, NotebookLM asset plan | NotebookLM MCP/CLI is community tooling and setup-gated |
| HyperFrames Video Studio | `/coding` | Planned | HTML/CSS/JS video-as-code pipeline | Verify Node, FFmpeg, and HyperFrames before render claims |
| Private Snapshot Backup | `/github` | Planned | Portable memory/skills/config backup to a private repo | Exclude secrets, browser profiles, raw mail, and transcripts |

## First Build Order

1. Create a `soul.md` draft with the Hermes soul.md Builder prompt.
2. Pick one major outcome and run the Hermes Super Goal Mission prompt.
3. Use the Morning Dream Brief prompt manually for a week before automating it.
4. Use the Model Pantheon Router pattern to decide which provider gets each job.
5. Convert the Super Goal transactions into `/agents` tasks.
6. Use the Content Factory prompt only with real source links.
7. Plan HyperFrames, NotebookLM MCP, Firecrawl, email, meeting, and GitHub backup connectors as setup-gated integrations.

## Verified vs Planned

Verified in BertOS:

- Prompt library entries for Hermes memory, goals, briefs, content, and HyperFrames setup.
- Dashboard Hermes Power Pack with source links and safety states.
- Existing paid gate for Hermes/Nous remote routing.
- Existing planned labels for HyperFrames, Remotion, Obsidian markdown writes, external agents, and paid providers.

Still planned:

- Automatic NotebookLM asset generation.
- HyperFrames/Remotion video render buttons.
- Firecrawl-backed search.
- Email, calendar, meeting-note, or social posting connectors.
- Automatic private GitHub snapshot backups.

## External References

- Better Stack Hermes Agent guide: https://betterstack.com/community/guides/ai/hermes-agent/
- HyperFrames: https://hyperframes.video/
- OpenRouter free router docs: https://openrouter.ai/openrouter/free/providers
- Firecrawl search API: https://docs.firecrawl.dev/api-reference/endpoint/search
- NotebookLM MCP CLI: https://github.com/jacob-bd/notebooklm-mcp-cli
