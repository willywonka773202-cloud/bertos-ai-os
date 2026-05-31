export type ProviderKind = 'ollama' | 'cli-subscription' | 'api-optional' | 'api-native' | 'api-paid'
export type BillingMode = 'subscription' | 'local' | 'api' | 'api-paid'
export type ProviderId =
  | 'ollama'
  | 'claude-code'
  | 'gemini-cli'
  | 'codex-cli'
  | 'openclaw-cli'
  | 'claude-api'
  | 'openai-api'
  | 'gemini-api'
  | 'gemini-api-native'
  | 'hermes-nous'

export interface ProviderHealth {
  available: boolean
  authenticated?: boolean
  latency?: number
  message?: string
  version?: string
  models?: string[]
}

export interface ProviderDefinition {
  id: ProviderId
  name: string
  kind: ProviderKind
  billingMode: BillingMode
  defaultModel: string
  localFallbackModel?: string
  description: string
  billingWarning?: string
  setupCommand: string
  docsUrl: string
  models: string[]
  color: string
  capabilities?: string[]
  requiredEnvVars?: string[]
}
