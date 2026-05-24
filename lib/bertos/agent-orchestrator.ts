import type {
  AgentExecutionLane,
  AgentOrchestrationPlan,
  AgentTokenBudget,
  AIModel,
  RoutingStrategy,
  TaskType,
} from './types'

interface BaseDecision {
  primary: AIModel
  secondary?: AIModel[]
  taskType: TaskType
  strategy: RoutingStrategy
}

interface ProviderProfile {
  maxInputTokens: number
  maxOutputTokens: number
  requiresDaemon: boolean
  requiresApiKey: boolean
  cost: 'included' | 'api' | 'paid-gated'
  strengths: string[]
}

const PROVIDER_PROFILES: Partial<Record<AIModel, ProviderProfile>> = {
  'ollama-pro': {
    maxInputTokens: 24_000,
    maxOutputTokens: 2048,
    requiresDaemon: false,
    requiresApiKey: false,
    cost: 'included',
    strengths: ['cheap summaries', 'classification', 'memory notes'],
  },
  'codex-cli': {
    maxInputTokens: 96_000,
    maxOutputTokens: 4096,
    requiresDaemon: true,
    requiresApiKey: false,
    cost: 'included',
    strengths: ['implementation', 'repo validation', 'patch review'],
  },
  'claude-code': {
    maxInputTokens: 96_000,
    maxOutputTokens: 4096,
    requiresDaemon: true,
    requiresApiKey: false,
    cost: 'included',
    strengths: ['UI architecture', 'review', 'refactor quality'],
  },
  'gemini-cli': {
    maxInputTokens: 128_000,
    maxOutputTokens: 4096,
    requiresDaemon: true,
    requiresApiKey: false,
    cost: 'included',
    strengths: ['long-context planning', 'research', 'broad analysis'],
  },
  'gemini-api-native': {
    maxInputTokens: 128_000,
    maxOutputTokens: 4096,
    requiresDaemon: false,
    requiresApiKey: true,
    cost: 'api',
    strengths: ['structured planning', 'long-context synthesis', 'judge'],
  },
  'hermes-nous': {
    maxInputTokens: 64_000,
    maxOutputTokens: 4096,
    requiresDaemon: false,
    requiresApiKey: true,
    cost: 'paid-gated',
    strengths: ['paid cloud reasoning when explicitly enabled'],
  },
}

const DEFAULT_PROFILE: ProviderProfile = {
  maxInputTokens: 16_000,
  maxOutputTokens: 2048,
  requiresDaemon: false,
  requiresApiKey: false,
  cost: 'included',
  strengths: ['general fallback'],
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'into', 'have', 'will', 'would', 'could', 'should',
  'there', 'their', 'what', 'when', 'where', 'which', 'about', 'just', 'make', 'need', 'want',
])

function profileFor(provider: AIModel): ProviderProfile {
  return PROVIDER_PROFILES[provider] ?? DEFAULT_PROFILE
}

export function estimatePromptTokens(text: string) {
  const roughByChars = Math.ceil(text.length / 4)
  const roughByWords = Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35)
  return Math.max(roughByChars, roughByWords, 1)
}

function topKeywords(prompt: string) {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 10)
}

function hasRiskyAction(prompt: string) {
  return /\b(delete|remove|drop|destroy|push|deploy|publish|merge|paid|secret|token|credential|webhook|telegram|remote write|production)\b/i.test(prompt)
}

function contextStrategy(estimatedTokens: number, maxInputTokens: number): AgentTokenBudget['contextStrategy'] {
  if (estimatedTokens < maxInputTokens * 0.35) return 'full'
  if (estimatedTokens < maxInputTokens * 0.7) return 'focused'
  if (estimatedTokens < maxInputTokens) return 'summarize'
  return 'chunk'
}

function budgetFor(provider: AIModel, estimatedPromptTokens: number, requestedMaxOutput?: number): AgentTokenBudget {
  const profile = profileFor(provider)
  const reservedResponseTokens = Math.min(profile.maxOutputTokens, requestedMaxOutput ?? profile.maxOutputTokens)
  const strategy = contextStrategy(estimatedPromptTokens, profile.maxInputTokens - reservedResponseTokens)
  const warnings: string[] = []

  if (strategy === 'summarize') warnings.push('Prompt is large; summarize low-signal context before sending.')
  if (strategy === 'chunk') warnings.push('Prompt exceeds safe context for this lane; chunk files or use focused context search.')
  if (profile.cost === 'api') warnings.push('API provider requires explicit Settings/provider enablement before use.')
  if (profile.cost === 'paid-gated') warnings.push('Paid-gated provider must not run without explicit user approval.')

  return {
    estimatedPromptTokens,
    maxInputTokens: profile.maxInputTokens,
    maxOutputTokens: reservedResponseTokens,
    reservedResponseTokens,
    contextStrategy: strategy,
    warnings,
  }
}

function uniqueProviders(values: AIModel[]) {
  return values.filter((provider, index, all) => provider !== 'auto' && all.indexOf(provider) === index)
}

function lane(input: Omit<AgentExecutionLane, 'requiresDaemon' | 'requiresApiKey' | 'budget'> & { estimatedPromptTokens: number; maxOutputTokens?: number }): AgentExecutionLane {
  const profile = profileFor(input.provider)
  return {
    ...input,
    requiresDaemon: profile.requiresDaemon,
    requiresApiKey: profile.requiresApiKey,
    budget: budgetFor(input.provider, input.estimatedPromptTokens, input.maxOutputTokens),
  }
}

export function buildAgentOrchestrationPlan(prompt: string, decision: BaseDecision): AgentOrchestrationPlan {
  const estimatedPromptTokens = estimatePromptTokens(prompt)
  const lower = prompt.toLowerCase()
  const keywords = topKeywords(prompt)
  const risky = hasRiskyAction(prompt)
  const broad = /\b(team|parallel|simultaneous|simultaneously|council|compare|all agents|multi[- ]agent|orchestrat|large|entire|whole|platform|architecture)\b/i.test(prompt)
  const ui = /\b(ui|ux|react|layout|component|screen|route|page|frontend|visual)\b/i.test(prompt)
  const needsCode = decision.taskType === 'coding' || decision.taskType === 'debugging' || /\b(implement|patch|edit|build|fix|typecheck|repo|code)\b/i.test(prompt)
  const needsResearch = decision.taskType === 'research' || /\b(research|internet|github|find|compare|latest|agentic os)\b/i.test(prompt)
  const needsWriting = decision.taskType === 'writing' || /\b(write|draft|docs|readme|summary|memory|handoff)\b/i.test(prompt)

  const primary = decision.primary === 'auto' ? 'ollama-pro' : decision.primary
  const fallbackProviders = uniqueProviders([...(decision.secondary ?? []), 'ollama-pro'])
  const lanes: AgentExecutionLane[] = [
    lane({
      id: 'orchestrator',
      label: 'Orchestrator',
      role: 'orchestrator',
      provider: 'ollama-pro',
      purpose: 'Classify intent, compress context, enforce safety gates, and assemble final handoff.',
      promptFocus: `Route by intent and keep context focused on: ${keywords.join(', ') || 'the user goal'}.`,
      canRunInParallel: true,
      risk: 'safe',
      estimatedPromptTokens,
      maxOutputTokens: 1200,
    }),
  ]

  if (needsResearch || broad) {
    lanes.push(lane({
      id: 'planner',
      label: 'Research Planner',
      role: 'planner',
      provider: decision.primary === 'gemini-api-native' ? 'gemini-api-native' : 'gemini-cli',
      purpose: 'Build the broad plan, identify external patterns, and reduce the problem into work lanes.',
      promptFocus: 'Return a concise plan, risks, and source-backed assumptions. Do not edit files.',
      canRunInParallel: true,
      risk: 'safe',
      estimatedPromptTokens,
      maxOutputTokens: 2400,
    }))
  }

  if (ui || broad) {
    lanes.push(lane({
      id: 'architect',
      label: 'Architecture / UI Reviewer',
      role: 'architect',
      provider: 'claude-code',
      purpose: 'Review architecture, UX, component boundaries, and duplicate-system risk.',
      promptFocus: 'Return review findings and implementation guidance only unless explicitly assigned a patch.',
      canRunInParallel: true,
      risk: 'safe',
      estimatedPromptTokens,
      maxOutputTokens: 2400,
    }))
  }

  if (needsCode) {
    lanes.push(lane({
      id: 'implementer',
      label: 'Implementation Agent',
      role: 'implementer',
      provider: primary === 'claude-code' && ui ? 'claude-code' : 'codex-cli',
      purpose: 'Produce focused code changes after context and approval gates are clear.',
      promptFocus: 'Patch only the scoped files, preserve existing systems, and report changed files.',
      canRunInParallel: false,
      risk: risky ? 'approval-required' : 'safe',
      estimatedPromptTokens,
      maxOutputTokens: 4096,
    }))
    lanes.push(lane({
      id: 'verifier',
      label: 'Build Verifier',
      role: 'verifier',
      provider: 'codex-cli',
      purpose: 'Run or request typecheck, build, safety, and direct failure fixes.',
      promptFocus: 'Validate the patch and fix only direct failures. Do not push.',
      canRunInParallel: false,
      risk: 'approval-required',
      estimatedPromptTokens,
      maxOutputTokens: 2400,
    }))
  }

  if (needsWriting || broad) {
    lanes.push(lane({
      id: 'memory',
      label: 'Memory Handoff',
      role: 'memory',
      provider: 'ollama-pro',
      purpose: 'Summarize decisions, validation, risks, and the next prompt for future agents.',
      promptFocus: 'Write a compact handoff note with no secrets.',
      canRunInParallel: true,
      risk: 'safe',
      estimatedPromptTokens,
      maxOutputTokens: 1200,
    }))
  }

  const parallelLaneIds = lanes.filter(item => item.canRunInParallel && item.risk === 'safe').map(item => item.id)
  const gatedLaneIds = lanes.filter(item => !item.canRunInParallel || item.risk !== 'safe').map(item => item.id)
  const shouldParallelize = broad || decision.strategy === 'parallel' || decision.strategy === 'best-of' || /\b(simultaneous|simultaneously|ask all|parallel|council)\b/i.test(prompt)
  const mode: RoutingStrategy = shouldParallelize && parallelLaneIds.length > 1 ? 'parallel' : decision.strategy
  const approvalReasons = [
    ...(risky ? ['Prompt includes risky action words such as delete, push, deploy, paid calls, secrets, or production mutation.'] : []),
    ...(gatedLaneIds.includes('implementer') ? ['Implementation lane must stay patch/approval-gated before file writes.'] : []),
    ...(gatedLaneIds.includes('verifier') ? ['Validation lane may run commands and should use daemon allowlists.'] : []),
  ]
  const primaryBudget = budgetFor(primary, estimatedPromptTokens)

  return {
    mode,
    summary: shouldParallelize
      ? 'Use parallel read-only planning/review lanes first, then gate implementation and validation.'
      : 'Use the primary provider with explicit fallback and token guardrails.',
    primaryProvider: primary,
    fallbackProviders,
    estimatedPromptTokens,
    maxParallelLanes: Math.min(3, parallelLaneIds.length || 1),
    tokenPolicy: primaryBudget,
    lanes,
    executionGroups: [
      ...(parallelLaneIds.length > 1 ? [{
        id: 'parallel-discovery',
        mode: 'parallel' as const,
        laneIds: parallelLaneIds,
        reason: 'These lanes are read-only and can run simultaneously to reduce latency and compare perspectives.',
      }] : []),
      ...(gatedLaneIds.length ? [{
        id: 'gated-implementation',
        mode: 'sequential' as const,
        laneIds: gatedLaneIds,
        reason: 'These lanes can write files or run commands, so they stay ordered and approval-gated.',
      }] : []),
    ],
    approvalRequired: approvalReasons.length > 0,
    approvalReasons,
    efficiencyNotes: [
      `Estimated prompt size: ${estimatedPromptTokens.toLocaleString()} tokens.`,
      `Primary context strategy: ${primaryBudget.contextStrategy}.`,
      'Prefer Ollama for classification/memory, Gemini for broad planning, Claude for architecture/UI review, and Codex for implementation/verification.',
      'Run only the smallest set of lanes needed; skip planned or unavailable providers instead of waiting on them.',
    ],
    safetyNotes: [
      'Never read .env files or expose secrets.',
      'Never push, deploy, merge, or spend paid credits without explicit approval.',
      'Parallel lanes must be read-only unless the user approves a patch workflow.',
      'If a provider is unavailable, fall back to the next verified provider and report it honestly.',
    ],
  }
}

export function buildLanePrompt(plan: AgentOrchestrationPlan, laneId: string, originalPrompt: string) {
  const lane = plan.lanes.find(item => item.id === laneId)
  if (!lane) throw new Error(`Unknown orchestration lane: ${laneId}`)
  return [
    `You are the ${lane.label} for BertOS.`,
    '',
    `Original task: ${originalPrompt}`,
    '',
    `Lane purpose: ${lane.purpose}`,
    `Focus: ${lane.promptFocus}`,
    `Token budget: keep response under ${lane.budget.maxOutputTokens.toLocaleString()} tokens.`,
    '',
    'Safety:',
    ...plan.safetyNotes.map(note => `- ${note}`),
    lane.risk !== 'safe' ? '- This lane is approval-gated. Do not mutate files or run commands unless approval is explicit.' : '- This lane is read-only. Return analysis, not file writes.',
    '',
    'Return:',
    '- Findings or output for this lane',
    '- Assumptions',
    '- Risks',
    '- Recommended next action',
  ].join('\n')
}
