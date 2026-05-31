import type { AIModel } from './types'

export type AgentEngineId =
  | 'bertos'
  | 'codex'
  | 'claude'
  | 'gemini'
  | 'gemini-native'
  | 'ollama'
  | 'hermes'
  | 'openclaw'
  | 'qwen'
  | 'openai'

export interface AgentEngineTheme {
  mark: string
  accent: string
  accent2: string
  background: string
  surface: string
  surface2: string
  border: string
  text: string
  muted: string
  shadow: string
}

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
  theme: AgentEngineTheme
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
    theme: {
      mark: 'B',
      accent: '#22D3EE',
      accent2: '#8B5CF6',
      background: '#031016',
      surface: 'rgba(8, 28, 38, 0.78)',
      surface2: 'rgba(34, 211, 238, 0.10)',
      border: 'rgba(34, 211, 238, 0.28)',
      text: '#DDFBFF',
      muted: '#7DA8B2',
      shadow: 'rgba(34, 211, 238, 0.22)',
    },
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
    theme: {
      mark: 'CX',
      accent: '#10B981',
      accent2: '#22D3EE',
      background: '#03130F',
      surface: 'rgba(8, 34, 29, 0.78)',
      surface2: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.32)',
      text: '#D8FFF2',
      muted: '#7AB8A2',
      shadow: 'rgba(16, 185, 129, 0.22)',
    },
  },
  {
    id: 'claude',
    label: 'Claw / Claude',
    shortLabel: 'Claw',
    route: '/engines/claude',
    model: 'claude-code',
    providerStatusId: 'claude-code',
    role: 'Architecture and UI quality engine',
    bestUse: 'React UI polish, refactor review, component boundaries, and architecture risk analysis.',
    mode: 'direct-chat',
    source: 'daemon',
    theme: {
      mark: 'CL',
      accent: '#D97757',
      accent2: '#F6C453',
      background: '#1A0803',
      surface: 'rgba(58, 19, 9, 0.78)',
      surface2: 'rgba(217, 119, 87, 0.13)',
      border: 'rgba(217, 119, 87, 0.34)',
      text: '#FFE7D8',
      muted: '#C08A73',
      shadow: 'rgba(217, 119, 87, 0.26)',
    },
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
    theme: {
      mark: 'G',
      accent: '#5B8CFF',
      accent2: '#E879F9',
      background: '#071129',
      surface: 'rgba(10, 24, 64, 0.78)',
      surface2: 'rgba(91, 140, 255, 0.12)',
      border: 'rgba(91, 140, 255, 0.32)',
      text: '#E3EAFF',
      muted: '#8E9ED0',
      shadow: 'rgba(91, 140, 255, 0.24)',
    },
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
    theme: {
      mark: 'GN',
      accent: '#5B8CFF',
      accent2: '#E879F9',
      background: '#071129',
      surface: 'rgba(10, 24, 64, 0.78)',
      surface2: 'rgba(91, 140, 255, 0.12)',
      border: 'rgba(91, 140, 255, 0.32)',
      text: '#E3EAFF',
      muted: '#8E9ED0',
      shadow: 'rgba(91, 140, 255, 0.24)',
    },
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
    theme: {
      mark: 'O',
      accent: '#F7F7F2',
      accent2: '#86C9A0',
      background: '#050505',
      surface: 'rgba(20, 20, 18, 0.82)',
      surface2: 'rgba(247, 247, 242, 0.10)',
      border: 'rgba(247, 247, 242, 0.26)',
      text: '#F7F7F2',
      muted: '#A6A69E',
      shadow: 'rgba(247, 247, 242, 0.16)',
    },
  },
  {
    id: 'hermes',
    label: 'Hermes Agent',
    shortLabel: 'Hermes',
    route: '/engines/hermes',
    model: 'hermes-nous',
    providerStatusId: 'hermes-nous',
    role: 'Server-side OpenAI-compatible agent backend',
    bestUse: 'Free/self-hosted Hermes on Hostinger VPS, local Ollama-backed Hermes, or a custom OpenAI-compatible endpoint.',
    mode: 'api-direct',
    source: 'api',
    requiresApiProviders: false,
    paidGated: false,
    warning: 'Hermes is called only through BertOS backend routes. Configure HERMES_ENABLED, HERMES_BASE_URL, and HERMES_API_KEY server-side; paid model providers are optional only.',
    theme: {
      mark: 'H',
      accent: '#8C5CFF',
      accent2: '#D4B483',
      background: '#10071D',
      surface: 'rgba(39, 16, 90, 0.78)',
      surface2: 'rgba(140, 92, 255, 0.13)',
      border: 'rgba(140, 92, 255, 0.34)',
      text: '#EFE7FF',
      muted: '#B8A0E8',
      shadow: 'rgba(140, 92, 255, 0.26)',
    },
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    shortLabel: 'Claw',
    route: '/engines/openclaw',
    model: 'openclaw-cli',
    providerStatusId: 'openclaw-cli',
    role: 'Local/Ollama-backed personal agent bridge',
    bestUse: 'Local agent tasks, tool-orchestration planning, and messaging-gateway workflows after OpenClaw onboarding.',
    mode: 'direct-chat',
    source: 'daemon',
    warning: 'OpenClaw can operate powerful tools and messaging channels. BertOS uses it only through the desktop daemon and keeps destructive actions behind approval gates.',
    theme: {
      mark: 'OC',
      accent: '#EF4444',
      accent2: '#F97316',
      background: '#170506',
      surface: 'rgba(58, 12, 14, 0.78)',
      surface2: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.34)',
      text: '#FFE4E6',
      muted: '#D08A8D',
      shadow: 'rgba(239, 68, 68, 0.24)',
    },
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
    theme: {
      mark: 'Q',
      accent: '#38BDF8',
      accent2: '#2DD4BF',
      background: '#03111A',
      surface: 'rgba(8, 30, 42, 0.78)',
      surface2: 'rgba(56, 189, 248, 0.12)',
      border: 'rgba(56, 189, 248, 0.32)',
      text: '#DDF7FF',
      muted: '#7FA9B8',
      shadow: 'rgba(56, 189, 248, 0.22)',
    },
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
    theme: {
      mark: 'AI',
      accent: '#10B981',
      accent2: '#22D3EE',
      background: '#03130F',
      surface: 'rgba(8, 34, 29, 0.78)',
      surface2: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.32)',
      text: '#D8FFF2',
      muted: '#78B9A5',
      shadow: 'rgba(16, 185, 129, 0.22)',
    },
  },
]

export function getAgentEngine(id: string) {
  return AGENT_ENGINES.find(engine => engine.id === id)
}

export function getPrimaryAgentEngines() {
  return AGENT_ENGINES.filter(engine => ['bertos', 'codex', 'claude', 'gemini', 'ollama', 'hermes', 'openclaw'].includes(engine.id))
}
