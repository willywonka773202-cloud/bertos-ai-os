export type OllamaModel = 'ollama-pro' | 'qwen2.5-coder' | 'llama3' | 'llama3.2' | 'mistral' | 'deepseek-coder' | 'hermes3'
export type CLIModel = 'claude-code' | 'gemini-cli' | 'codex-cli' | 'openclaw-cli'
export type APIModel = 'claude-api' | 'openai-api' | 'gemini-api' | 'gemini-api-native' | 'hermes-nous'
export type AIModel = 'auto' | OllamaModel | CLIModel | APIModel

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  model?: AIModel
  timestamp: number
  streaming?: boolean
  routerDecision?: RouterDecision
  metadata?: {
    tokens?: number
    latency?: number
    confidence?: number
    providerSource?: 'daemon' | 'api' | 'router'
    modelOrTool?: string
    fallbackUsed?: string
  }
}

export interface RouterDecision {
  primary: AIModel
  secondary?: AIModel[]
  reasoning: string
  confidence: number
  taskType: TaskType
  strategy: RoutingStrategy
  orchestration?: AgentOrchestrationPlan
}

export type TaskType =
  | 'coding'
  | 'analysis'
  | 'writing'
  | 'brainstorming'
  | 'debugging'
  | 'research'
  | 'math'
  | 'general'

export type RoutingStrategy = 'single' | 'parallel' | 'sequential' | 'best-of'

export type AgentLaneRole =
  | 'orchestrator'
  | 'planner'
  | 'architect'
  | 'implementer'
  | 'reviewer'
  | 'verifier'
  | 'researcher'
  | 'writer'
  | 'memory'

export type AgentLaneRisk = 'safe' | 'approval-required' | 'blocked'

export interface AgentTokenBudget {
  estimatedPromptTokens: number
  maxInputTokens: number
  maxOutputTokens: number
  reservedResponseTokens: number
  contextStrategy: 'full' | 'focused' | 'summarize' | 'chunk'
  warnings: string[]
}

export interface AgentExecutionLane {
  id: string
  label: string
  role: AgentLaneRole
  provider: AIModel
  purpose: string
  promptFocus: string
  canRunInParallel: boolean
  risk: AgentLaneRisk
  requiresDaemon: boolean
  requiresApiKey: boolean
  budget: AgentTokenBudget
}

export interface AgentExecutionGroup {
  id: string
  mode: 'parallel' | 'sequential'
  laneIds: string[]
  reason: string
}

export interface AgentOrchestrationPlan {
  mode: RoutingStrategy
  summary: string
  primaryProvider: AIModel
  fallbackProviders: AIModel[]
  estimatedPromptTokens: number
  maxParallelLanes: number
  tokenPolicy: AgentTokenBudget
  lanes: AgentExecutionLane[]
  executionGroups: AgentExecutionGroup[]
  approvalRequired: boolean
  approvalReasons: string[]
  efficiencyNotes: string[]
  safetyNotes: string[]
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  model: AIModel
  createdAt: number
  updatedAt: number
  projectId?: string
  pinned?: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  createdAt: number
  updatedAt: number
  sessions: string[]
  files: ProjectFile[]
  todos: Todo[]
  pinned: boolean
  context: string
}

export type MemoryKind = 'semantic' | 'episodic' | 'procedural' | 'constraint' | 'preference'
export type MemorySource = 'human' | 'session-summary' | 'repo' | 'tool-output' | 'import'
export type MemoryConfidence = 'confirmed' | 'inferred' | 'needs-review'
export type MemorySensitivity = 'public' | 'internal' | 'private' | 'secret-blocked'

export interface BertOSMemoryItem {
  id: string
  kind: MemoryKind
  projectId?: string
  title: string
  content: string
  source: MemorySource
  sourceRef?: string
  confidence: MemoryConfidence
  sensitivity: MemorySensitivity
  tags: string[]
  createdAt: number
  updatedAt: number
  expiresAt?: number
}

export interface ProjectFile {
  id: string
  name: string
  type: string
  size: number
  content?: string
  uploadedAt: number
}

export interface Todo {
  id: string
  text: string
  done: boolean
  createdAt: number
}

export type AgentStepType = 'think' | 'plan' | 'read-file' | 'search' | 'patch' | 'command' | 'verify' | 'report'
export type AgentStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked'

export interface AgentStep {
  id: string
  number: number
  status: AgentStepStatus
  type: AgentStepType
  title: string
  summary?: string
  output?: string
  timestamp: number
  completedAt?: number
  providerUsed?: string
}

export interface AgentReport {
  goal: string
  completed: string[]
  filesChanged: string[]
  commandsRun: string[]
  passedChecks: string[]
  failedChecks: string[]
  risks: string[]
  nextStep?: string
  generatedAt: number
}

export interface AgentTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'paused' | 'done' | 'failed'
  model: AIModel
  progress: number
  logs: AgentLog[]
  createdAt: number
  updatedAt: number
  projectId?: string
  checkpoints: AgentCheckpoint[]
  steps: AgentStep[]
  mode?: 'plan' | 'build' | 'debug' | 'review' | 'qa'
  safeMode?: boolean
  maxSteps?: number
  report?: AgentReport
}

export interface AgentLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface AgentCheckpoint {
  id: string
  timestamp: number
  description: string
  state: Record<string, unknown>
}

export interface CompareSession {
  id: string
  prompt: string
  responses: CompareResponse[]
  createdAt: number
  winner?: AIModel
}

export interface CompareResponse {
  model: AIModel
  content: string
  streaming: boolean
  latency?: number
  rank?: number
}

export interface CLIStatus {
  name: CLIModel
  available: boolean
  version?: string
  path?: string
}

// ─── Autopilot ────────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | 'manual'
  | 'app-start'
  | 'interval'
  | 'repo-changed'
  | 'build-failed'
  | 'provider-offline'
  | 'daily-review'

export type AutomationAction =
  | 'check-provider-health'
  | 'run-typecheck'
  | 'run-build'
  | 'run-lint'
  | 'run-tests'
  | 'git-status'
  | 'git-diff-stat'
  | 'create-agent-plan'
  | 'create-visual-evolution-task'
  | 'create-workspace-debug-task'
  | 'create-project-health-report'
  | 'create-daily-brief-task'
  | 'create-inbox-triage-task'
  | 'create-weekly-review-task'
  | 'create-content-pipeline-task'
  | 'create-connector-setup-task'

export type AutomationRisk = 'safe' | 'approval-required' | 'blocked'

export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: AutomationTrigger
  actions: AutomationAction[]
  risk: AutomationRisk
  schedule?: {
    intervalMinutes?: number
    timeOfDay?: string
    nextRunAt?: string
  }
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

export interface AutomationRunAction {
  id: string
  action: AutomationAction
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  output?: string
  error?: string
}

export interface AutomationRun {
  id: string
  ruleId?: string
  title: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'needs-approval'
  trigger: AutomationTrigger
  actions: AutomationRunAction[]
  summary?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  logs: string[]
  approvalRequired?: boolean
  risk: AutomationRisk
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface BertOSSettings {
  theme: 'dark' | 'darker' | 'midnight'
  primaryModel: AIModel
  routingEnabled: boolean
  streamingEnabled: boolean
  memoryEnabled: boolean
  enableApiProviders: boolean
  cliPaths: {
    'claude-code'?: string
    'gemini-cli'?: string
    'codex-cli'?: string
  }
  apiKeys: {
    anthropic?: string
    openai?: string
    google?: string
    ollamaCloud?: string
  }
  ollamaEndpoint?: string
  ollamaCloudModel?: string
  ollamaLocalFallback?: string
  modelPriority: AIModel[]
  tokenBudget: number
  animationsEnabled: boolean
  obsidianVaultPath?: string
  obsidianJournalFolder?: string
  obsidianProjectNotesFolder?: string
  obsidianSessionsFolder?: string
}

// Canonical local-first Agent OS runtime types.
export type {
  AgentRun,
  AgentRunLane,
  AutomationCandidate,
  GroundingPack,
  GroundingSource,
  MarkdownMemoryRecord,
  MemoryProposal,
  OutputArtifact,
  OutputArtifactFile,
  OutputArtifactSearch,
  PermissionGate,
  PluginDefinition,
  PluginTool,
  PreviewDescriptor,
  PublishingPlatformVariant,
  PublishingQueueItem,
  PublishingQueueStatus,
  SkillDefinition,
  SkillPatchDraft,
  StudioAsset,
  WorkflowDefinition,
  WorkflowRun,
} from './types-runtime'
