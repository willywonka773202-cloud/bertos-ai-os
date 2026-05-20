import type { AIModel, RouterDecision, RoutingStrategy, TaskType } from './types'

interface RoutingRule {
  patterns: RegExp[]
  taskType: TaskType
  primary: AIModel
  secondary?: AIModel[]
  strategy: RoutingStrategy
  reasoning: string
}

const ROUTING_RULES: RoutingRule[] = [
  {
    patterns: [
      /\b(team mode|multi[- ]model|provider debate|hard task|complex task|large implementation)\b/i,
      /\b(plan.*implement.*review|architecture.*implementation|design.*patch.*review)\b/i,
    ],
    taskType: 'analysis',
    primary: 'gemini-cli',
    secondary: ['claude-code', 'codex-cli', 'ollama-pro'],
    strategy: 'sequential',
    reasoning: 'Using Gemini first because this needs broad planning, then Claude for architecture review and Codex for implementation if the mission proceeds.',
  },
  {
    patterns: [
      /\b(implement|edit files|change files|apply patch|generate patch|write code|repo edit|code change|task automation)\b/i,
      /\b(codex|workspace patch|patch generation|create file|modify file|delete file)\b/i,
      /\b(codebase|repo|repository|diff)\b/i,
      /```/,
    ],
    taskType: 'coding',
    primary: 'codex-cli',
    secondary: ['claude-code', 'ollama-pro'],
    strategy: 'single',
    reasoning: 'Using Codex because this is an implementation or repo-edit task. Claude is the review fallback, and Ollama Pro is the always-on fallback.',
  },
  {
    patterns: [
      /\b(debug|why (is|does|did|won't|can't)|trace|fix this|what's wrong|broken)\b/i,
      /\b(agent|automation|automate|task|run tests|terminal|command|git status|build this repo)\b/i,
    ],
    taskType: 'debugging',
    primary: 'codex-cli',
    secondary: ['claude-code', 'ollama-pro'],
    strategy: 'single',
    reasoning: 'Using Codex because this is debugging, validation, or repo automation. Claude can review failures; Ollama Pro is the fallback.',
  },
  {
    patterns: [
      /\b(architecture|architect|ui review|ux review|review this|refactor plan|component design|layout|visual polish)\b/i,
      /\b(cleanup|stabilize|quality review|risk review|technical debt)\b/i,
    ],
    taskType: 'analysis',
    primary: 'claude-code',
    secondary: ['gemini-cli', 'codex-cli', 'ollama-pro'],
    strategy: 'single',
    reasoning: 'Using Claude because this is architecture, UI review, or refactor-quality work. Gemini can broaden the plan; Codex can implement after review.',
  },
  {
    patterns: [
      /\b(write|essay|article|blog|story|summarize|explain|describe|draft)\b/i,
    ],
    taskType: 'writing',
    primary: 'ollama-pro',
    secondary: ['gemini-cli', 'claude-code'],
    strategy: 'single',
    reasoning: 'Using Ollama first to reduce paid usage for writing, summaries, and explanation. Gemini or Claude can be selected for larger reviews.',
  },
  {
    patterns: [
      /\b(large|massive|entire|whole|full|complete|all of|entire document|pdf|book)\b/i,
      /\b(analyze this|process this|go through)\b/i,
      /\b(long context|planning|plan|strategy|architecture|roadmap)\b/i,
    ],
    taskType: 'analysis',
    primary: 'gemini-cli',
    secondary: ['claude-code', 'ollama-pro'],
    strategy: 'single',
    reasoning: 'Using Gemini first because this needs long-context planning or research. Claude is the architecture fallback; Ollama Pro is the cheap fallback.',
  },
  {
    patterns: [
      /\b(brainstorm|ideas|creative|options|alternatives|what if|possibilities|suggest)\b/i,
    ],
    taskType: 'brainstorming',
    primary: 'ollama-pro',
    secondary: ['claude-code', 'gemini-cli'],
    strategy: 'single',
    reasoning: 'Using Ollama first to reduce paid usage for cheap ideation. Use Team Mode only if the task becomes complex.',
  },
  {
    patterns: [
      /\b(research|find|search|information about|tell me about|what is|who is|when did|history)\b/i,
    ],
    taskType: 'research',
    primary: 'gemini-cli',
    secondary: ['ollama-pro'],
    strategy: 'single',
    reasoning: 'Using Gemini because this is research or long-context information work. Ollama Pro remains the fallback.',
  },
  {
    patterns: [
      /\b(calculate|math|equation|formula|solve|compute|integral|derivative|probability)\b/i,
    ],
    taskType: 'math',
    primary: 'ollama-pro',
    secondary: ['claude-code'],
    strategy: 'single',
    reasoning: 'Math problems route to Ollama Pro. Enable Claude Code CLI for complex step-by-step solutions.',
  },
]

function classifyTask(prompt: string): { taskType: TaskType; rule: RoutingRule | null } {
  let bestRule: RoutingRule | null = null
  let bestScore = 0

  for (const rule of ROUTING_RULES) {
    let score = 0
    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  return {
    taskType: bestRule?.taskType ?? 'general',
    rule: bestRule,
  }
}

function computeConfidence(prompt: string, rule: RoutingRule | null): number {
  if (!rule) return 0.5
  let matched = 0
  for (const p of rule.patterns) {
    if (p.test(prompt)) matched++
  }
  return Math.min(0.95, 0.6 + (matched / rule.patterns.length) * 0.35)
}

export function routePrompt(prompt: string, preferredModel: AIModel): RouterDecision {
  if (preferredModel !== 'auto') {
    return {
      primary: preferredModel,
      reasoning: `Manually routed to ${preferredModel} as selected.`,
      confidence: 1.0,
      taskType: 'general',
      strategy: 'single',
    }
  }

  const { taskType, rule } = classifyTask(prompt)
  const confidence = computeConfidence(prompt, rule)

  if (!rule) {
    return {
      primary: 'ollama-pro',
      reasoning: 'Using Ollama first to reduce paid usage for a general task. Pick Codex, Claude, or Gemini when the mission needs implementation, review, or long planning.',
      confidence: 0.5,
      taskType: 'general',
      strategy: 'single',
    }
  }

  return {
    primary: rule.primary,
    secondary: rule.secondary,
    reasoning: rule.reasoning,
    confidence,
    taskType,
    strategy: rule.strategy,
  }
}

export function getModelColor(model: string): string {
  switch (model) {
    case 'ollama-pro':      return '#F97316'
    case 'qwen2.5-coder':   return '#F97316'
    case 'llama3':          return '#F97316'
    case 'llama3.2':        return '#F97316'
    case 'mistral':         return '#EC4899'
    case 'deepseek-coder':  return '#06B6D4'
    case 'hermes3':         return '#A855F7'
    case 'claude-code':     return '#8B5CF6'
    case 'gemini-cli':      return '#3B82F6'
    case 'codex-cli':       return '#10B981'
    case 'claude-api':      return '#8B5CF6'
    case 'openai-api':      return '#10B981'
    case 'gemini-api':      return '#3B82F6'
    case 'auto':            return '#F59E0B'
    default:                return '#6B7280'
  }
}

export function getModelLabel(model: string): string {
  switch (model) {
    case 'ollama-pro':      return 'Ollama Pro'
    case 'qwen2.5-coder':   return 'Qwen 2.5 Coder'
    case 'llama3':          return 'Llama 3'
    case 'llama3.2':        return 'Llama 3.2'
    case 'mistral':         return 'Mistral'
    case 'deepseek-coder':  return 'DeepSeek Coder'
    case 'hermes3':         return 'Hermes 3'
    case 'claude-code':     return 'Claude Code'
    case 'gemini-cli':      return 'Gemini CLI'
    case 'codex-cli':       return 'Codex CLI'
    case 'claude-api':      return 'Anthropic API'
    case 'openai-api':      return 'OpenAI API'
    case 'gemini-api':      return 'Gemini API'
    case 'auto':            return 'Auto'
    default:                return model
  }
}
