export interface ProviderAskResult {
  ok: boolean
  providerId: string
  providerName: string
  modelOrTool: string
  text: string
  latencyMs: number
  source?: 'daemon' | 'api' | 'router'
  fallbackUsed?: string
  fallbackChain?: string[]
  attemptedProviders?: Array<{
    providerId: string
    available: boolean
    source: 'daemon' | 'api'
    error?: string
  }>
  error?: string
}

export interface ProviderStatusResult {
  ok: boolean
  providerId: string
  providerName: string
  modelOrTool: string
  online: boolean
  error?: string
  detail?: unknown
}
