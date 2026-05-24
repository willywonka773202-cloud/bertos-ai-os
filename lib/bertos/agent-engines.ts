import type { AIModel } from './types'

export type AgentEngineId =
  | 'bertos'
  | 'codex'
  | 'claude'
  | 'gemini'
  | 'gemini-native'
  | 'ollama'
  | 'hermes'
  | 'qwen'
  | 'openai'

export interface AgentEngine {
  id: AgentEngineId
  label: string
  shortLabel: string
  route: string
  model: AIModel
  providerStatusId: string
  role: string
  bestUse: string
  mode: 'combined-router' | 'direct-chat' | 'api-direct' | 'experimental'
  source: 'router' | 'daemon' | 'api' | 'ollama'
  requiresApiProviders?: boolean
  paidGated?: boolean
  warning?: string
}

export const AGENT_ENGINES: AgentEngine[] = [
  {
    id: 'bertos',
    label: 'BertOS',
    shortLabel: 'BertOS',
    route: '/engines/bertos',
    model: 'auto',
    providerStatusId: 'bertos-router',
    role: 'Combined AI operating layer',
    bestUse: 'Automatically route across all verified providers with token, fallback, and safety planning.',
    mode: 'combined-router',
    source: 'router',
  },
  {
    id: 'codex',
    label: 'Codex',
    shortLabel: 'Codex',
    route: '/engines/codex',
    model: 'codex-cli',
    providerStatusId: 'codex-cli',
    role: 'Implementation and verification engine',
    bestUse: 'Repo edits, patch generation, typecheck/build fixes, and task automation through the daemon.',
    mode: 'direct-chat',
    source: 'daemon',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    shortLabel: 'Claude',
    route: '/engines/claude',
    model: 'claude-code',
    providerStatusId: 'claude-code',
    role: 'Architecture and UI quality engine',
    bestUse: 'React UI polish, refactor review, component boundaries, and architecture risk analysis.',
    mode: 'direct-chat',
    source: 'daemon',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    shortLabel: 'Gemini',
    route: '/engines/gemini',
    model: 'gemini-cli',
    providerStatusId: 'gemini-cli',
    role: 'Long-context planning engine',
    bestUse: 'Research synthesis, large plans, migration review, and broad architecture analysis.',
    mode: 'direct-chat',
    source: 'daemon',
  },
  {
    id: 'gemini-native',
    label: 'Gemini Native',
    shortLabel: 'G Native',
    route: '/engines/gemini-native',
    model: 'gemini-api-native',
    providerStatusId: 'gemini-api-native',
    role: 'Structured API planning engine',
    bestUse: 'Structured planning, council judge synthesis, and long-context API workflows when configured.',
    mode: 'api-direct',
    source: 'api',
    requiresApiProviders: true,
  },
  {
    id: 'ollama',
    label: 'Ollama',
    shortLabel: 'Ollama',
    route: '/engines/ollama',
    model: 'ollama-pro',
    providerStatusId: 'ollama-pro',
    role: 'Cheap/default local or cloud engine',
    bestUse: 'Fast chat, summaries, memory handoffs, classification, and low-cost fallback work.',
    mode: 'direct-chat',
    source: 'ollama',
  },
  {
    id: 'hermes',
    label: 'Hermes / Nous',
    shortLabel: 'Hermes',
    route: '/engines/hermes',
    model: 'hermes-nous',
    providerStatusId: 'hermes-nous',
    role: 'Paid-gated remote reasoning engine',
    bestUse: 'Manual paid remote reasoning only when explicitly enabled and approved.',
    mode: 'api-direct',
    source: 'api',
    requiresApiProviders: true,
    paidGated: true,
    warning: 'Hermes / Nous can spend paid credits. It stays disabled unless API providers and paid Hermes gates are enabled.',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    shortLabel: 'Qwen',
    route: '/engines/qwen',
    model: 'qwen2.5-coder',
    providerStatusId: 'ollama-pro',
    role: 'Experimental coding model through Ollama',
    bestUse: 'Local/Ollama coding fallback and long-context draft review when the model is available.',
    mode: 'experimental',
    source: 'ollama',
    warning: 'Qwen availability depends on the configured Ollama model catalog.',
  },
  {
    id: 'openai',
    label: 'OpenAI API',
    shortLabel: 'OpenAI',
    route: '/engines/openai',
    model: 'openai-api',
    providerStatusId: 'openai-api',
    role: 'Optional API engine',
    bestUse: 'Manual API chat when OpenAI credentials and API providers are enabled.',
    mode: 'api-direct',
    source: 'api',
    requiresApiProviders: true,
    warning: 'OpenAI API calls are metered. Use only when API providers are intentionally enabled.',
  },
]

export function getAgentEngine(id: string) {
  return AGENT_ENGINES.find(engine => engine.id === id)
}

export function getPrimaryAgentEngines() {
  return AGENT_ENGINES.filter(engine => ['bertos', 'codex', 'claude', 'gemini', 'ollama', 'hermes'].includes(engine.id))
}
