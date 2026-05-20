import type { AIModel } from '../types'
import { routePrompt } from '../router'
import * as claudeCli from './claude-cli'
import * as codexCli from './codex-cli'
import * as geminiCli from './gemini-cli'
import * as ollamaPro from './ollama-pro'
import type { ProviderAskResult, ProviderStatusResult } from './provider-result'

const PROVIDERS = {
  'claude-code': claudeCli,
  'codex-cli': codexCli,
  'gemini-cli': geminiCli,
  'ollama-pro': ollamaPro,
}

type ProviderId = keyof typeof PROVIDERS

function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS
}

function isProviderInventoryPrompt(prompt: string) {
  return /\b(providers?|models?|tools?)\b/i.test(prompt)
    && /\b(reach|available|status|which|can you|connected|detect)\b/i.test(prompt)
}

export async function getVerifiedProviderStatuses(): Promise<ProviderStatusResult[]> {
  return Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async providerId => PROVIDERS[providerId].status()),
  )
}

function formatProviderReport(statuses: ProviderStatusResult[]) {
  const lines = [
    'BertOS verified provider status:',
    '',
    ...statuses.map(status => {
      const state = status.online ? 'available' : 'unavailable'
      const source = status.providerId === 'ollama-pro' ? 'API' : 'daemon'
      const detail = status.error ? ` - ${status.error}` : ''
      return `- ${status.providerName}: ${state} via ${source}; tool/model: ${status.modelOrTool}${detail}`
    }),
    '',
    'I will only route to providers marked available above. I will not claim GPT-4, Claude API, Gemini API, or any other provider unless that provider is actually configured and verified.',
  ]
  return lines.join('\n')
}

function providerStatusToAttempt(status: ProviderStatusResult) {
  return {
    providerId: status.providerId,
    available: status.online,
    source: status.providerId === 'ollama-pro' ? 'api' as const : 'daemon' as const,
    error: status.error,
  }
}

export async function askWithProviderRouter(prompt: string, preferred: AIModel = 'auto'): Promise<ProviderAskResult> {
  const started = Date.now()
  const statuses = await getVerifiedProviderStatuses()

  if (isProviderInventoryPrompt(prompt)) {
    return {
      ok: true,
      providerId: 'bertos-router',
      providerName: 'BertOS Router',
      modelOrTool: 'verified-provider-status',
      text: formatProviderReport(statuses),
      latencyMs: Date.now() - started,
      source: 'router',
      attemptedProviders: statuses.map(providerStatusToAttempt),
    }
  }

  const byId = new Map(statuses.map(status => [status.providerId, status]))
  const decision = routePrompt(prompt, preferred)
  const fallbackOrder = ['codex-cli', 'claude-code', 'gemini-cli', 'ollama-pro']
  const ordered = [
    decision.primary,
    ...(decision.secondary ?? []),
    ...fallbackOrder,
  ].filter((value, index, array) => array.indexOf(value) === index)
    .filter(isProviderId)

  const errors: string[] = []
  const attemptedProviders: ProviderAskResult['attemptedProviders'] = []

  for (const providerId of ordered) {
    const status = byId.get(providerId)
    attemptedProviders?.push({
      providerId,
      available: Boolean(status?.online),
      source: providerId === 'ollama-pro' ? 'api' : 'daemon',
      error: status?.error,
    })

    if (!status?.online) {
      errors.push(`${providerId}: unavailable${status?.error ? ` - ${status.error}` : ''}`)
      continue
    }

    const result = await PROVIDERS[providerId].ask(prompt)
    if (result.ok) {
      return {
        ...result,
        fallbackUsed: providerId === decision.primary ? undefined : providerId,
        fallbackChain: ordered,
        attemptedProviders,
      }
    }
    errors.push(`${providerId}: ${result.error}`)
  }

  return {
    ok: false,
    providerId: String(decision.primary),
    providerName: 'BertOS Router',
    modelOrTool: String(decision.primary),
    text: '',
    latencyMs: Date.now() - started,
    source: 'router',
    fallbackChain: ordered,
    attemptedProviders,
    error: `All verified providers failed or were unavailable. ${errors.join(' | ')}`,
  }
}
