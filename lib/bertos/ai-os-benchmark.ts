import { listMemoryProposals } from './memory/registry'
import { listOutputArtifacts } from './outputs'
import { listPlugins } from './plugins/registry'
import { buildPublishReadinessReport } from './readiness'
import { listSkills } from './skills/registry'

export type AiOsFeatureLayer =
  | 'command-center'
  | 'models'
  | 'agents'
  | 'skills'
  | 'plugins'
  | 'memory'
  | 'outputs'
  | 'workflows'
  | 'grounding'
  | 'studio'
  | 'coding'
  | 'safety'
  | 'publishing'
  | 'mobile'
  | 'community'

export type AiOsFeatureStatus = 'implemented' | 'partial' | 'setup-gated' | 'planned'
export type AiOsFeaturePriority = 'critical' | 'high' | 'medium'
export type AiOsFeatureDifficulty = 'small' | 'medium' | 'large'

export interface AiOsSource {
  id: string
  name: string
  url: string
  takeaway: string
}

export interface AiOsBenchmarkFeature {
  id: string
  title: string
  layer: AiOsFeatureLayer
  status: AiOsFeatureStatus
  priority: AiOsFeaturePriority
  difficulty: AiOsFeatureDifficulty
  inspiredBy: string[]
  sourceUrl: string
  bertosSurface: string
  implementation: string
  nextStep: string
}

export interface AiOsBenchmarkReport {
  ok: true
  generatedAt: string
  summary: {
    score: number
    total: number
    implemented: number
    partial: number
    setupGated: number
    planned: number
    criticalGaps: number
  }
  runtime: {
    skills: number
    plugins: number
    readyPlugins: number
    outputs: number
    pendingMemoryProposals: number
    readinessScore: number
  }
  sources: AiOsSource[]
  features: AiOsBenchmarkFeature[]
  layers: Array<{
    id: AiOsFeatureLayer
    label: string
    total: number
    implemented: number
    partial: number
    setupGated: number
    planned: number
    score: number
  }>
  priorityGaps: AiOsBenchmarkFeature[]
}

export const AI_OS_SOURCES: AiOsSource[] = [
  {
    id: 'open-webui',
    name: 'Open WebUI',
    url: 'https://docs.openwebui.com/features/',
    takeaway: 'A publishable AI OS needs one interface for models, chat, knowledge, tools, notes, terminal, previews, extensibility, and automations.',
  },
  {
    id: 'anythingllm',
    name: 'AnythingLLM',
    url: 'https://docs.anythingllm.com/',
    takeaway: 'Workspaces, local/private data, model routing, built-in skills, agents, scheduled jobs, and desktop/mobile modes are core OS primitives.',
  },
  {
    id: 'librechat',
    name: 'LibreChat',
    url: 'https://www.librechat.ai/docs/features/agents',
    takeaway: 'Custom agents should bind instructions, model settings, tool capabilities, file context, RAG, artifacts, and @mentions into one builder.',
  },
  {
    id: 'dify',
    name: 'Dify',
    url: 'https://docs.dify.ai/en/use-dify/build/agent',
    takeaway: 'Agent workflow quality improves when prompts, variables, tool loops, retrieval settings, preview/debug, and publish steps are explicit.',
  },
  {
    id: 'langgraph',
    name: 'LangGraph',
    url: 'https://docs.langchain.com/oss/python/langgraph/overview',
    takeaway: 'Durable execution, checkpoints, human approvals, streaming, memory, and state inspection are the backbone of reliable long-running agents.',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    url: 'https://code.claude.com/docs/en/sub-agents',
    takeaway: 'Subagents, MCP tools, hooks, slash commands, and permission-scoped execution are the right model for advanced coding work.',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    url: 'https://google-gemini.github.io/gemini-cli/',
    takeaway: 'A strong local coding agent should expose free-tier access, file/shell tools, MCP extensibility, checkpointing, and GitHub workflow hooks.',
  },
  {
    id: 'vercel-ai-elements',
    name: 'Vercel AI Elements',
    url: 'https://vercel.com/academy/ai-sdk/ai-elements',
    takeaway: 'Production AI interfaces need first-class components for streams, messages, reasoning, tool calls, attachments, citations, and actions.',
  },
]

export const AI_OS_BENCHMARK_FEATURES: AiOsBenchmarkFeature[] = [
  {
    id: 'one-command-center',
    title: 'One command center for every AI system',
    layer: 'command-center',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI', 'LibreChat'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/dashboard, /engines, game layer, sidebar',
    implementation: 'BertOS already exposes provider rosters, engine tabs, dashboard modules, game navigation, and status cards in one shell.',
    nextStep: 'Keep reducing duplicate status surfaces so the same provider truth appears everywhere.',
  },
  {
    id: 'browser-aware-local-daemon',
    title: 'Browser-aware desktop daemon bridge',
    layer: 'coding',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI Open Terminal', 'Gemini CLI'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'local daemon, provider status client, workspace bridge',
    implementation: 'Hosted BertOS can call the local desktop daemon from the browser instead of pretending Vercel can see localhost.',
    nextStep: 'Add guided phone tunnel setup validation and one-click daemon retest from Settings.',
  },
  {
    id: 'multi-model-routing',
    title: 'Multi-model routing with honest fallbacks',
    layer: 'models',
    status: 'partial',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI', 'AnythingLLM'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'provider router, engine chat, provider status indicator',
    implementation: 'Ollama, Codex CLI, Gemini CLI, Claude Code, Gemini API, and Hermes have routing entries and status states.',
    nextStep: 'Add a visible routing decision trace to every AI response.',
  },
  {
    id: 'free-local-model-path',
    title: 'Free/local model path',
    layer: 'models',
    status: 'partial',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['AnythingLLM', 'Gemini CLI'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: 'Ollama provider, Hermes free setup docs',
    implementation: 'Ollama is the default working free path, and Hermes is documented as an OpenAI-compatible server with local model options.',
    nextStep: 'Add a guided Ollama model pull/check flow and model selector for local fallback models.',
  },
  {
    id: 'provider-test-buttons',
    title: 'Provider test and repair buttons',
    layer: 'models',
    status: 'partial',
    priority: 'high',
    difficulty: 'small',
    inspiredBy: ['Gemini CLI', 'Claude Code'],
    sourceUrl: 'https://google-gemini.github.io/gemini-cli/',
    bertosSurface: 'engine pages, settings, provider health command',
    implementation: 'Provider health checks exist, but setup failures still need more direct per-provider repair actions.',
    nextStep: 'Add Test Codex, Test Gemini, Test Claude, Test Ollama, and Test Hermes actions to Settings.',
  },
  {
    id: 'agent-roster',
    title: 'Specialized agent roster',
    layer: 'agents',
    status: 'implemented',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['LibreChat', 'Open WebUI'],
    sourceUrl: 'https://www.librechat.ai/docs/features/agents',
    bertosSurface: '/agents, command-center definitions',
    implementation: 'BertOS defines role-based agents and engine tabs with clear model/backend roles.',
    nextStep: 'Allow user-created agent cards with tool and memory scopes from the UI.',
  },
  {
    id: 'sub-agent-lanes',
    title: 'Sub-agent lanes and merged results',
    layer: 'agents',
    status: 'partial',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Claude Code', 'LangGraph'],
    sourceUrl: 'https://code.claude.com/docs/en/sub-agents',
    bertosSurface: 'workflow runs, agent lanes, runs page',
    implementation: 'Run records can represent sub-agent lanes even when execution is sequential or prompt-orchestrated.',
    nextStep: 'Add a lane visualizer that shows split, progress, merge summary, timeout, and failed-lane recovery.',
  },
  {
    id: 'permission-scoped-agents',
    title: 'Permission-scoped agents',
    layer: 'agents',
    status: 'partial',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Claude Code', 'LibreChat'],
    sourceUrl: 'https://code.claude.com/docs/en/sub-agents',
    bertosSurface: 'plugin permission gates, skill memory access rules',
    implementation: 'Skills and plugins declare permissions and approval gates, but agents do not yet have a full visual capability editor.',
    nextStep: 'Expose agent capabilities as readable chips and block actions that exceed the declared scope.',
  },
  {
    id: 'slash-skill-registry',
    title: 'Slash-command skill registry',
    layer: 'skills',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI', 'Claude Code'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/skills, data/bertos/skills',
    implementation: 'BertOS reads skill.md files, seeds eight creator skills, validates definitions, and displays installed skills.',
    nextStep: 'Add a run button that invokes a skill against a selected project and writes an output artifact.',
  },
  {
    id: 'skill-versioning',
    title: 'Skill versioning and changelogs',
    layer: 'skills',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI', 'Claude Code'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'skill patch drafts, runtime skill patches',
    implementation: 'Skill patch drafts exist, but the UI still needs a clean diff/review workflow.',
    nextStep: 'Show natural-language preference patches as approveable diffs with semantic version bumps.',
  },
  {
    id: 'natural-language-skill-editing',
    title: 'Natural-language skill editing',
    layer: 'skills',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['Claude Code hooks/plugins'],
    sourceUrl: 'https://code.claude.com/docs/en/hooks',
    bertosSurface: 'skill registry patch proposals',
    implementation: 'The runtime supports draft patches; the product flow needs an editor prompt, diff, approval, and test result.',
    nextStep: 'Build a Skill Patch Agent UI: request, diff, approve, test, record preference.',
  },
  {
    id: 'plugin-manifest-registry',
    title: '@mention plugin manifest registry',
    layer: 'plugins',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Claude Code MCP', 'LibreChat @mentions'],
    sourceUrl: 'https://code.claude.com/docs/en/mcp',
    bertosSurface: '/plugins, plugin registry API',
    implementation: 'BertOS lists @youtube, @readwise, @gmail, @calendar, @buffer, media, browser, filesystem, memory, and output plugins with setup state.',
    nextStep: 'Add install/test flows for each live adapter without exposing credentials to the browser.',
  },
  {
    id: 'mcp-style-tool-discovery',
    title: 'MCP-style tool discovery',
    layer: 'plugins',
    status: 'planned',
    priority: 'high',
    difficulty: 'large',
    inspiredBy: ['Claude Code MCP', 'Gemini CLI MCP'],
    sourceUrl: 'https://code.claude.com/docs/en/mcp',
    bertosSurface: 'planned plugin adapters',
    implementation: 'Plugin manifests model tools, but BertOS does not yet dynamically discover external MCP servers.',
    nextStep: 'Add a local MCP registry adapter that can list servers, resources, prompts, and tool schemas.',
  },
  {
    id: 'setup-required-connectors',
    title: 'Setup-required connector truth states',
    layer: 'plugins',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'small',
    inspiredBy: ['AnythingLLM', 'LibreChat'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: '/plugins, readiness API',
    implementation: 'Missing integrations are marked planned, missing_credentials, disabled, or degraded instead of pretending to be live.',
    nextStep: 'Add setup recipes and env variable checklists inside each plugin detail panel.',
  },
  {
    id: 'permission-gate-runtime',
    title: 'Permission gate runtime',
    layer: 'safety',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['LangGraph human-in-the-loop', 'Claude Code permissions'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/interrupts',
    bertosSurface: 'plugin registry, daemon safety, readiness checks',
    implementation: 'Paid APIs, email send, scheduling, publishing, deleting, overwriting, and likeness generation require approval gates.',
    nextStep: 'Persist approval events to run logs with actor, reason, scope, and expiry.',
  },
  {
    id: 'markdown-memory-vault',
    title: 'Markdown memory vault',
    layer: 'memory',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI Memory', 'AnythingLLM Memories'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/memory, /memory-review, data/bertos/memory',
    implementation: 'BertOS has local markdown memory files, index storage, scoped searches, and proposal review.',
    nextStep: 'Add project-level memory heatmaps showing what context was injected into recent runs.',
  },
  {
    id: 'memory-proposal-review',
    title: 'Memory proposal review queue',
    layer: 'memory',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['LangGraph human-in-the-loop'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/interrupts',
    bertosSurface: '/memory-review',
    implementation: 'Agents propose memory writes; user approval or rejection controls durable memory.',
    nextStep: 'Add edit-before-approve and bulk approve/reject with scope safeguards.',
  },
  {
    id: 'context-pack-injection',
    title: 'Automatic context pack injection',
    layer: 'memory',
    status: 'partial',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI Notes', 'LibreChat File Context'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'context-engine, mission-builder, memory builder',
    implementation: 'BertOS can assemble project context and serialized file packs; not every task path uses memory packs yet.',
    nextStep: 'Require every skill/workflow invocation to record the exact memory pack it used.',
  },
  {
    id: 'client-project-isolation',
    title: 'Client and project memory isolation',
    layer: 'memory',
    status: 'partial',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI access control', 'AnythingLLM workspaces'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: 'memory proposal scopes, project store',
    implementation: 'Memory types support client/project scopes, but the UI should make cross-scope movement explicit.',
    nextStep: 'Add scope lock warnings when an output or memory proposal crosses projects or clients.',
  },
  {
    id: 'output-registry',
    title: 'Output artifact registry',
    layer: 'outputs',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI Notes', 'LibreChat Artifacts'],
    sourceUrl: 'https://www.librechat.ai/docs/features/agents',
    bertosSurface: '/outputs, output registry API',
    implementation: 'Generated artifacts get ids, metadata, status, source links, file references, previews, tags, and memory writeback candidates.',
    nextStep: 'Add artifact compare/version history and backlinks to the exact prompt/context pack.',
  },
  {
    id: 'dynamic-preview-routing',
    title: 'Dynamic preview routing',
    layer: 'outputs',
    status: 'partial',
    priority: 'high',
    difficulty: 'large',
    inspiredBy: ['Open WebUI website preview', 'Vercel AI Elements'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'output preview descriptors, workspace previews',
    implementation: 'Output artifacts carry preview descriptors; UI supports common output previews but not every media/canvas type yet.',
    nextStep: 'Add first-class preview components for markdown, HTML, code, JSON, diagram, canvas, image, video, and email tables.',
  },
  {
    id: 'source-linked-grounding-packs',
    title: 'Source-linked grounding packs',
    layer: 'grounding',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI RAG', 'Dify retrieval'],
    sourceUrl: 'https://docs.dify.ai/en/use-dify/build/agent',
    bertosSurface: 'grounding builder, grounding API',
    implementation: 'GroundingPack objects track source, source URL, excerpt summary, relevance, rights notes, scope, tokens, and staleness.',
    nextStep: 'Attach grounding packs automatically to every run and show them in the right panel.',
  },
  {
    id: 'youtube-transcript-grounding',
    title: 'YouTube transcript grounding',
    layer: 'grounding',
    status: 'setup-gated',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['creator OS workflows'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/skills youtube-researcher, @youtube',
    implementation: 'The skill and plugin manifest exist; live transcript fetching needs an adapter or pasted transcript degraded mode.',
    nextStep: 'Implement a no-key transcript fallback plus API-key mode for channel/video metadata.',
  },
  {
    id: 'second-brain-grounding',
    title: 'Second-brain grounding',
    layer: 'grounding',
    status: 'setup-gated',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['AnythingLLM workspaces', 'Dify knowledge'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: '/skills second-brain, @readwise, memory vault',
    implementation: 'The local memory path works; Readwise requires credentials or import adapter setup.',
    nextStep: 'Add local import of exported Readwise/markdown/CSV notes so no paid connector is required.',
  },
  {
    id: 'workflow-runner',
    title: 'Workflow runner with run records',
    layer: 'workflows',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Dify workflows', 'LangGraph durable execution'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/overview',
    bertosSurface: 'workflow definitions, runner API, runs page',
    implementation: 'BertOS can define workflow chains, create WorkflowRun/AgentRun records, outputs, validation, and memory proposals.',
    nextStep: 'Add resumable checkpoints and approval pauses for long-running production workflows.',
  },
  {
    id: 'durable-checkpoints',
    title: 'Durable checkpoints and resume',
    layer: 'workflows',
    status: 'planned',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['LangGraph persistence'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/persistence',
    bertosSurface: 'planned workflow checkpoint store',
    implementation: 'Run records persist summaries, but true checkpoint/resume for each step is not yet implemented.',
    nextStep: 'Persist step input/output/state so interrupted workflows can resume without rerunning successful steps.',
  },
  {
    id: 'automation-promotion',
    title: 'Promote successful runs into automations',
    layer: 'workflows',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI Automations', 'AnythingLLM Scheduled Jobs'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/autopilot, automation candidates',
    implementation: 'Automation candidate scaffolding exists; production scheduling UX still needs approval and failure policy details.',
    nextStep: 'Add a Promote to Automation button on successful skill/workflow runs.',
  },
  {
    id: 'daily-weekly-reflection',
    title: 'Daily and weekly reflection loop',
    layer: 'memory',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['AnythingLLM scheduled jobs', 'LangGraph memory'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: 'automation templates, memory proposals',
    implementation: 'Reflection templates exist as scaffolds; fully scheduled reflection writeback needs stronger run history summaries.',
    nextStep: 'Generate a Sunday output/memory review that creates memory proposals only after human review.',
  },
  {
    id: 'studio-asset-grid',
    title: 'Shared Studio asset grid',
    layer: 'studio',
    status: 'partial',
    priority: 'high',
    difficulty: 'large',
    inspiredBy: ['Open WebUI image generation', 'Vercel AI Elements'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/studio, studio registry',
    implementation: 'Studio assets have schema and local UI scaffolding for human/agent shared state.',
    nextStep: 'Add agent-created image prompt cards that appear in the same grid the user edits.',
  },
  {
    id: 'diagram-canvas-motion-types',
    title: 'Diagram, canvas, and motion output types',
    layer: 'studio',
    status: 'partial',
    priority: 'high',
    difficulty: 'large',
    inspiredBy: ['Vercel AI Elements', 'LibreChat Artifacts'],
    sourceUrl: 'https://vercel.com/academy/ai-sdk/ai-elements',
    bertosSurface: '/skills diagram, paper-canvas, motion-graphics',
    implementation: 'Skill definitions and output types exist; live Excalidraw/Paper/Remotion exports remain adapter-gated.',
    nextStep: 'Implement a local Excalidraw JSON exporter first, then Remotion templates after tool verification.',
  },
  {
    id: 'publishing-queue-local',
    title: 'Local publishing queue',
    layer: 'publishing',
    status: 'implemented',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['AnythingLLM scheduled jobs'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: '/publishing-queue, publishing API',
    implementation: 'BertOS has a local Buffer-style queue schema and page for idea, drafted, reviewed, scheduled, published, and archived states.',
    nextStep: 'Add platform preview cards and approval-gated Buffer draft sync when credentials exist.',
  },
  {
    id: 'inbox-deal-flow',
    title: 'Inbox and brand deal flow',
    layer: 'publishing',
    status: 'setup-gated',
    priority: 'medium',
    difficulty: 'large',
    inspiredBy: ['AnythingLLM Gmail Agent', 'Claude Code MCP'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: '@gmail, @calendar, inbox-deal-manager skill',
    implementation: 'The skill and plugins are setup-gated with explicit no-send/no-schedule approval rules.',
    nextStep: 'Add Gmail connector read-only digest using the app connector or OAuth adapter, with private content excluded from memory.',
  },
  {
    id: 'coding-workspace',
    title: 'Coding workspace with patch validation',
    layer: 'coding',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Gemini CLI', 'Claude Code'],
    sourceUrl: 'https://google-gemini.github.io/gemini-cli/',
    bertosSurface: '/workspace, /coding, patch parser, daemon commands',
    implementation: 'BertOS supports mission compilation, file context, safe command execution, patch payload smoke tests, and local repo status.',
    nextStep: 'Add an in-app diff viewer that can stage selected hunks without pushing.',
  },
  {
    id: 'github-launch-readiness',
    title: 'GitHub launch readiness',
    layer: 'community',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['Gemini CLI GitHub integration'],
    sourceUrl: 'https://google-gemini.github.io/gemini-cli/',
    bertosSurface: '/launch, /github, README',
    implementation: 'BertOS can report deployment readiness and repo status, but needs a stronger contributor-facing launch checklist.',
    nextStep: 'Add GitHub star/readme checklist, screenshots, quickstart, security model, and plugin extension guide.',
  },
  {
    id: 'pwa-install',
    title: 'Installable PWA shell',
    layer: 'mobile',
    status: 'implemented',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['AnythingLLM Desktop/Mobile', 'Open WebUI deploy anywhere'],
    sourceUrl: 'https://docs.anythingllm.com/',
    bertosSurface: 'manifest, service worker, launch page',
    implementation: 'BertOS has a web app manifest, service worker, install prompt handling, and mobile dashboard path.',
    nextStep: 'Add an update-available toast so stale service workers do not hide fresh deployments.',
  },
  {
    id: 'phone-secure-bridge',
    title: 'Phone-to-desktop secure bridge',
    layer: 'mobile',
    status: 'partial',
    priority: 'critical',
    difficulty: 'large',
    inspiredBy: ['Open WebUI deploy anywhere'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: '/launch, /settings, daemon token',
    implementation: 'Docs and launch page explain secure tunnel/token mode, but automated tunnel verification is not complete.',
    nextStep: 'Add a bridge test wizard that validates HTTPS tunnel, token, CORS, and repo safety from the phone.',
  },
  {
    id: 'ai-ui-components',
    title: 'AI-native message and tool UI components',
    layer: 'command-center',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['Vercel AI Elements'],
    sourceUrl: 'https://vercel.com/academy/ai-sdk/ai-elements',
    bertosSurface: 'chat, engine chat, run logs',
    implementation: 'BertOS has custom chat surfaces; it still needs richer structured rendering for reasoning, tool calls, citations, and attachments.',
    nextStep: 'Create shared AI response primitives instead of duplicating engine chat display logic.',
  },
  {
    id: 'message-queue',
    title: 'Message queue while agents are running',
    layer: 'command-center',
    status: 'planned',
    priority: 'medium',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI message queue'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'planned chat queue state',
    implementation: 'BertOS can run tasks, but the chat UI does not yet queue follow-up messages behind active model responses.',
    nextStep: 'Add queued prompt state with cancel/reorder and attach it to run records.',
  },
  {
    id: 'artifact-feedback-loop',
    title: 'Artifact-level feedback loop',
    layer: 'outputs',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['LangGraph memory', 'Vercel AI Elements response actions'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/overview',
    bertosSurface: 'outputs, memory proposals',
    implementation: 'Outputs can carry memory writeback candidates; thumbs-up/down and correction capture are still missing.',
    nextStep: 'Add feedback buttons that create reviewed memory proposals and reusable workflow lessons.',
  },
  {
    id: 'observability-run-log',
    title: 'Run observability and event logs',
    layer: 'workflows',
    status: 'partial',
    priority: 'high',
    difficulty: 'medium',
    inspiredBy: ['LangGraph observability', 'Open WebUI Administration'],
    sourceUrl: 'https://docs.langchain.com/oss/python/langgraph/overview',
    bertosSurface: '/runs, logs, readiness',
    implementation: 'Run pages and logs exist; richer step-level events and latency/cost traces are next.',
    nextStep: 'Record model, latency, tokens, tool events, approvals, and validation results for every run step.',
  },
  {
    id: 'cost-budget-tracking',
    title: 'Cost and budget tracking',
    layer: 'safety',
    status: 'planned',
    priority: 'medium',
    difficulty: 'medium',
    inspiredBy: ['Open WebUI Administration'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'planned provider accounting',
    implementation: 'Paid API gates exist, but there is no token/cost budget ledger yet.',
    nextStep: 'Add per-provider estimated token usage, spend caps, and paid API preflight confirmation.',
  },
  {
    id: 'secret-leak-guard',
    title: 'Secret leak guard',
    layer: 'safety',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'small',
    inspiredBy: ['Claude Code permissions', 'Gemini CLI sandboxing'],
    sourceUrl: 'https://code.claude.com/docs/en/mcp',
    bertosSurface: 'readiness API, daemon/file safety, plugin rules',
    implementation: 'Secret-shaped NEXT_PUBLIC env names are blocked, .env access is prohibited, and plugin safety rules ban credential memory writes.',
    nextStep: 'Add automated redaction to run logs and output metadata sidecars.',
  },
  {
    id: 'path-traversal-protection',
    title: 'Path traversal and workspace boundary protection',
    layer: 'safety',
    status: 'implemented',
    priority: 'critical',
    difficulty: 'medium',
    inspiredBy: ['Gemini CLI trusted folders', 'Claude Code tool scopes'],
    sourceUrl: 'https://google-gemini.github.io/gemini-cli/',
    bertosSurface: 'local daemon, repo safety script',
    implementation: 'Repo operations are bound to the BertOS root and safety checks enforce the intended workspace.',
    nextStep: 'Expose recent blocked file attempts in Runs/Logs for auditability.',
  },
  {
    id: 'community-extension-guide',
    title: 'Community extension guide',
    layer: 'community',
    status: 'planned',
    priority: 'medium',
    difficulty: 'small',
    inspiredBy: ['Open WebUI community extensions', 'Claude Code plugins'],
    sourceUrl: 'https://docs.openwebui.com/features/',
    bertosSurface: 'planned docs/plugin guide',
    implementation: 'BertOS has plugin/skill architecture, but a contributor guide for building new skills/plugins is not complete.',
    nextStep: 'Write docs for adding a skill, plugin manifest, permission gate, output type, test, and preview component.',
  },
]

const LAYER_LABELS: Record<AiOsFeatureLayer, string> = {
  'command-center': 'Command Center',
  models: 'Models',
  agents: 'Agents',
  skills: 'Skills',
  plugins: 'Plugins',
  memory: 'Memory',
  outputs: 'Outputs',
  workflows: 'Workflows',
  grounding: 'Grounding',
  studio: 'Studio',
  coding: 'Coding',
  safety: 'Safety',
  publishing: 'Publishing',
  mobile: 'Mobile',
  community: 'Community',
}

const STATUS_WEIGHT: Record<AiOsFeatureStatus, number> = {
  implemented: 1,
  partial: 0.62,
  'setup-gated': 0.45,
  planned: 0.15,
}

function countStatus(features: AiOsBenchmarkFeature[], status: AiOsFeatureStatus) {
  return features.filter(feature => feature.status === status).length
}

function featureScore(features: AiOsBenchmarkFeature[]) {
  if (features.length === 0) return 0
  const score = features.reduce((sum, feature) => sum + STATUS_WEIGHT[feature.status], 0)
  return Math.round((score / features.length) * 100)
}

export async function buildAiOsBenchmarkReport(): Promise<AiOsBenchmarkReport> {
  const [skills, plugins, outputs, memoryProposals, readiness] = await Promise.all([
    listSkills().catch(() => []),
    listPlugins().catch(() => []),
    listOutputArtifacts(50).catch(() => []),
    listMemoryProposals('pending').catch(() => []),
    buildPublishReadinessReport().catch(() => null),
  ])

  const features = AI_OS_BENCHMARK_FEATURES
  const layers = Object.entries(LAYER_LABELS).map(([id, label]) => {
    const scoped = features.filter(feature => feature.layer === id)
    return {
      id: id as AiOsFeatureLayer,
      label,
      total: scoped.length,
      implemented: countStatus(scoped, 'implemented'),
      partial: countStatus(scoped, 'partial'),
      setupGated: countStatus(scoped, 'setup-gated'),
      planned: countStatus(scoped, 'planned'),
      score: featureScore(scoped),
    }
  }).filter(layer => layer.total > 0)

  const priorityRank: Record<AiOsFeaturePriority, number> = { critical: 0, high: 1, medium: 2 }
  const statusRank: Record<AiOsFeatureStatus, number> = { planned: 0, 'setup-gated': 1, partial: 2, implemented: 3 }
  const priorityGaps = features
    .filter(feature => feature.status !== 'implemented')
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || statusRank[a.status] - statusRank[b.status])
    .slice(0, 12)

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      score: featureScore(features),
      total: features.length,
      implemented: countStatus(features, 'implemented'),
      partial: countStatus(features, 'partial'),
      setupGated: countStatus(features, 'setup-gated'),
      planned: countStatus(features, 'planned'),
      criticalGaps: features.filter(feature => feature.priority === 'critical' && feature.status !== 'implemented').length,
    },
    runtime: {
      skills: skills.length,
      plugins: plugins.length,
      readyPlugins: plugins.filter(plugin => plugin.setupStatus === 'ready').length,
      outputs: outputs.length,
      pendingMemoryProposals: memoryProposals.length,
      readinessScore: readiness?.summary.score ?? 0,
    },
    sources: AI_OS_SOURCES,
    features,
    layers,
    priorityGaps,
  }
}
