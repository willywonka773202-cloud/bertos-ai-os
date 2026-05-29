export type HermesPowerStatus = 'live' | 'copy-prompt' | 'planned' | 'paid-gated'
export type HermesPowerPromptCategory = 'coding' | 'business' | 'school' | 'agents' | 'personal' | 'custom'

export interface HermesPowerLane {
  id: string
  title: string
  status: HermesPowerStatus
  route: string
  useFor: string
  whyItMatters: string
  safety: string
  nextStep: string
  source: string
}

export interface HermesPowerPrompt {
  id: string
  title: string
  category: HermesPowerPromptCategory
  description: string
  tags: string[]
  variables: string[]
  content: string
}

export const HERMES_POWER_SOURCES = [
  {
    label: 'Hermes Agent guide',
    url: 'https://betterstack.com/community/guides/ai/hermes-agent/',
    note: 'Persistent markdown memory, reusable skills, tool access, compression, and session recall.',
  },
  {
    label: 'HyperFrames',
    url: 'https://hyperframes.video/',
    note: 'Agent-friendly HTML to MP4 workflow with local/CI rendering once installed.',
  },
  {
    label: 'OpenRouter free router',
    url: 'https://openrouter.ai/openrouter/free/providers',
    note: 'Free model router is useful for cheap delegation, but rate limits and availability must be handled.',
  },
  {
    label: 'Firecrawl search endpoint',
    url: 'https://docs.firecrawl.dev/api-reference/endpoint/search',
    note: 'Search plus scrape can return result metadata or markdown content for research workflows.',
  },
  {
    label: 'NotebookLM MCP CLI',
    url: 'https://github.com/jacob-bd/notebooklm-mcp-cli',
    note: 'Community NotebookLM automation path; treat as setup-gated and verify before claiming asset generation.',
  },
]

export const HERMES_POWER_LANES: HermesPowerLane[] = [
  {
    id: 'memory-soul',
    title: 'Memory Core + soul.md',
    status: 'copy-prompt',
    route: '/memory',
    useFor: 'Identity, preferences, operating rules, projects, people, goals, and decision history.',
    whyItMatters: 'Hermes becomes much stronger when persistent memory is explicit, structured, and reviewable.',
    safety: 'Never save secrets, credentials, private keys, or raw .env content.',
    nextStep: 'Create a soul.md draft, then mirror stable facts into Obsidian/local markdown.',
    source: 'Hermes Agent guide + video memory workflow',
  },
  {
    id: 'goal-loop',
    title: 'Super Goal Loop',
    status: 'copy-prompt',
    route: '/prompts',
    useFor: 'Turn a large outcome into human-owned and agent-owned transactions with acceptance criteria.',
    whyItMatters: 'Standard goals can run ahead without the human handshake. Super goals force explicit checkpoints.',
    safety: 'Require approval before paid calls, publishing, file writes, deploys, or destructive actions.',
    nextStep: 'Use the Super Goal Mission prompt for the next important project.',
    source: 'Video goal/super-goal workflow',
  },
  {
    id: 'background-brief',
    title: 'Dream Brief + Background Work',
    status: 'copy-prompt',
    route: '/brief',
    useFor: 'Daily planning, proactive recommendations, and background research queues.',
    whyItMatters: 'The highest leverage assistant pattern is scheduled synthesis from recent work and long-term goals.',
    safety: 'Do not imply calendar, email, or meeting access unless the connector is actually configured.',
    nextStep: 'Use the Morning Dream Brief prompt; later wire it to Autopilot after approvals.',
    source: 'Video cron/background workflow',
  },
  {
    id: 'model-pantheon',
    title: 'Model Pantheon Router',
    status: 'copy-prompt',
    route: '/compare',
    useFor: 'Assign planning, coding, research, design review, cheap summaries, and multimodal tasks to the right model.',
    whyItMatters: 'Power comes from routing work by capability and cost, not using one model for everything.',
    safety: 'Hermes/Nous and paid APIs stay manual-selection only until explicitly approved.',
    nextStep: 'Run a model council prompt, then update model priority in Settings if the result is stable.',
    source: 'Video model delegation workflow + OpenRouter docs',
  },
  {
    id: 'agent-swarm',
    title: 'Kanban Agent Swarm',
    status: 'copy-prompt',
    route: '/agents',
    useFor: 'Decompose one mission into orchestrator, researcher, builder, reviewer, verifier, and memory logger roles.',
    whyItMatters: 'Parallel work is only useful when each role has a narrow output and proof requirement.',
    safety: 'BertOS must not auto-push, auto-merge, or claim external agents edited files unless verified.',
    nextStep: 'Open Agents and convert the one-line mission into subtasks.',
    source: 'Video Kanban/swarm workflow',
  },
  {
    id: 'research-content',
    title: 'Research + Content Factory',
    status: 'copy-prompt',
    route: '/playbooks',
    useFor: 'Turn one topic into research notes, blog outline, short script, social posts, newsletter, and follow-up tasks.',
    whyItMatters: 'NotebookLM-style source grounding plus content repurposing gives repeatable output from one idea.',
    safety: 'NotebookLM MCP/CLI is community tooling; verify auth, terms, and local setup before automation.',
    nextStep: 'Run the Content Factory playbook with source links and no auto-publishing.',
    source: 'Video NotebookLM/content workflow + NotebookLM MCP CLI repo',
  },
  {
    id: 'video-studio',
    title: 'HyperFrames Video Studio',
    status: 'planned',
    route: '/coding',
    useFor: 'Scripted HTML/CSS/JS videos, product demos, launch trailers, and data highlight reels.',
    whyItMatters: 'Video as code lets agents generate, diff, render, and verify repeatable assets.',
    safety: 'Do not claim video rendering works until Node, FFmpeg, and HyperFrames are detected locally.',
    nextStep: 'Use the HyperFrames setup prompt and add detection before any render button.',
    source: 'HyperFrames docs + GitHub repo',
  },
  {
    id: 'snapshot-backup',
    title: 'Private Snapshot Backup',
    status: 'planned',
    route: '/github',
    useFor: 'Back up Hermes memory, skills, and non-secret configuration to a private repository.',
    whyItMatters: 'A powerful agent should be portable across machines without losing memory.',
    safety: 'Never back up tokens, .env files, browser profiles, cookies, raw mail, or private meeting transcripts.',
    nextStep: 'Create a backup plan first; require explicit user approval before any commit or push.',
    source: 'Video GitHub snapshot workflow + BertOS safety rules',
  },
]

export const HERMES_POWER_PROMPTS: HermesPowerPrompt[] = [
  {
    id: 'hermes-soul-md-builder',
    title: 'Hermes soul.md Builder',
    category: 'personal',
    description: 'Build a structured identity and operating manual for Hermes memory.',
    variables: ['name', 'work', 'goals', 'preferences'],
    tags: ['hermes', 'memory', 'soul-md', 'obsidian'],
    content: `MISSION: Draft my Hermes soul.md memory manual.

User:
- Name: {{name}}
- Work/projects: {{work}}
- Current goals: {{goals}}
- Preferences and constraints: {{preferences}}

Create a markdown file with these sections:
1. Identity and context
2. Active projects
3. Long-term goals
4. Communication preferences
5. Decision principles
6. Tool and provider preferences
7. Things Hermes should challenge me on
8. Things Hermes must never do
9. Memory update rules

Rules:
- Do not include secrets, API keys, passwords, tokens, private keys, or .env values.
- Mark uncertain facts as "needs confirmation".
- Keep it concise enough to load into agent context.
- End with 10 questions that would improve the memory if answered.`,
  },
  {
    id: 'hermes-super-goal',
    title: 'Hermes Super Goal Mission',
    category: 'agents',
    description: 'Convert a major outcome into agent-owned and human-owned transactions.',
    variables: ['goal', 'deadline', 'constraints', 'availableTools'],
    tags: ['hermes', 'goal', 'agent', 'kanban'],
    content: `MISSION: Convert this into a Super Goal plan with a human-agent handshake.

Goal: {{goal}}
Deadline: {{deadline}}
Constraints: {{constraints}}
Available tools/providers: {{availableTools}}

Output:
1. Define the success criteria in one paragraph.
2. Break the goal into 5 to 9 transactions.
3. For each transaction, assign Owner as Human, Hermes, or Specialist Agent.
4. For each transaction, list inputs, output artifact, acceptance criteria, and blockers.
5. Mark every action that needs explicit approval before running.
6. Create a Kanban-ready task list.
7. End with the next single action Hermes should take now.

Safety:
- Do not spend credits, publish, deploy, push, merge, or write files without explicit approval.
- Do not claim a connector exists unless it has been verified.`,
  },
  {
    id: 'hermes-morning-dream-brief',
    title: 'Hermes Morning Dream Brief',
    category: 'personal',
    description: 'Daily proactive synthesis prompt for memory, goals, meetings, and open work.',
    variables: ['date', 'knownInputs', 'topGoal'],
    tags: ['hermes', 'daily-brief', 'cron', 'dream'],
    content: `MISSION: Produce my Morning Dream Brief for {{date}}.

Known inputs available today:
{{knownInputs}}

Top goal:
{{topGoal}}

Brief format:
1. Today in one sentence
2. Three recommendations based on memory, recent work, and current goals
3. One non-negotiable action
4. Risks or distractions to avoid
5. Background tasks Hermes should run, each with an approval level
6. What data is missing that would improve the brief

Rules:
- If calendar, email, meetings, Obsidian, GitHub, or browser data are not connected, say so directly.
- Do not invent meetings, emails, metrics, or recent events.
- Keep the brief actionable and under 500 words.`,
  },
  {
    id: 'hermes-content-factory',
    title: 'Hermes Content Factory',
    category: 'business',
    description: 'Turn one idea into source-grounded multi-format content without auto-publishing.',
    variables: ['topic', 'audience', 'sources', 'offer'],
    tags: ['hermes', 'content', 'notebooklm', 'seo'],
    content: `MISSION: Run a source-grounded Content Factory pass.

Topic: {{topic}}
Audience: {{audience}}
Source links or notes:
{{sources}}
Offer or CTA: {{offer}}

Produce:
1. Source-grounded research brief with verified vs assumed claims
2. SEO article outline
3. 90-second short video script
4. LinkedIn post
5. X/Twitter post
6. Newsletter blurb
7. Thumbnail concept
8. NotebookLM asset plan: podcast, infographic, slides, mind map, quiz
9. Review checklist before publishing

Rules:
- Do not auto-post or publish.
- Cite source URLs when used.
- Treat NotebookLM MCP/CLI as setup-gated unless already verified.
- Treat HyperFrames/Remotion as planned unless local detection confirms rendering works.`,
  },
  {
    id: 'hermes-hyperframes-setup',
    title: 'Hermes HyperFrames Setup Plan',
    category: 'coding',
    description: 'Plan a safe local HyperFrames integration for BertOS.',
    variables: ['videoGoal', 'repoNotes'],
    tags: ['hermes', 'hyperframes', 'video', 'setup'],
    content: `MISSION: Plan a safe HyperFrames video pipeline for BertOS.

Video goal: {{videoGoal}}
Repo notes: {{repoNotes}}

Requirements:
1. Verify Node, package manager, FFmpeg, and HyperFrames availability first.
2. Do not install packages unless explicitly approved.
3. Do not claim rendering works until a local render command succeeds.
4. Design a workflow where an agent writes HTML/CSS/JS, previews it, renders MP4, and verifies the output.
5. Add safety gates for external assets, licenses, and file writes.
6. Include a minimal first video spec and a validation checklist.

Final output:
- Implementation plan
- Commands to run after approval
- Files likely touched
- Risks and limitations
- First smoke test`,
  },
]

export function buildHermesOperatingSystemPrompt() {
  return [
    'MISSION: Upgrade BertOS into a stronger Hermes-style agent operating system.',
    '',
    'Use these lanes without pretending planned integrations are live:',
    ...HERMES_POWER_LANES.map(lane => `- ${lane.title}: ${lane.status}. Use for ${lane.useFor}`),
    '',
    'Implementation rules:',
    '- Keep Hermes server-side and setup-gated. BertOS supports free/local Hermes backends; require explicit approval for any paid backend configured behind Hermes.',
    '- Keep HyperFrames, NotebookLM MCP, Firecrawl, email, meetings, and private GitHub backup setup-gated until verified.',
    '- Prefer copy-prompt workflows for external agents and planned tools.',
    '- Store only non-secret memory. Never read or print .env files.',
    '- Preserve BertOS local daemon approval gates, Workspace review, and no auto-push/no auto-merge policy.',
    '',
    'Deliverables:',
    '- A soul.md memory draft',
    '- A Super Goal task plan',
    '- A Morning Dream Brief prompt',
    '- A model-routing council prompt',
    '- A content factory prompt',
    '- A HyperFrames setup checklist',
    '- A backup plan that excludes secrets',
  ].join('\n')
}
