export interface ProviderAskResult {
  ok: boolean
  providerId: string
  providerName: string
  modelOrTool: string
  text: string
  latencyMs: number
  fallbackUsed?: string
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
