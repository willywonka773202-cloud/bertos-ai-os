import type { AIModel } from '../types'
import { routePrompt } from '../router'
import * as claudeCli from './claude-cli'
import * as codexCli from './codex-cli'
import * as geminiCli from './gemini-cli'
import * as geminiNative from './gemini-native'
import * as ollamaPro from './ollama-pro'
import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

const PROVIDERS = {
  'claude-code': claudeCli,
  'codex-cli': codexCli,
  'gemini-api-native': geminiNative,
  'gemini-cli': geminiCli,
  'ollama-pro': ollamaPro,
}

type ProviderId = keyof typeof PROVIDERS

function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS
}

export function isProviderInventoryPrompt(prompt: string) {
  return /\b(providers?|models?|tools?)\b/i.test(prompt)
    && /\b(reach|available|status|which|can you|connected|detect)\b/i.test(prompt)
}

export function shouldUseProviderInventoryShortcut(prompt: string, options: ProviderAskOptions = {}) {
  if (options.disableInventoryShortcut || options.purpose === 'patch' || options.mode === 'patch' || options.taskType === 'code_patch') {
    return false
  }
  return isProviderInventoryPrompt(prompt)
}

export async function getVerifiedProviderStatuses(): Promise<ProviderStatusResult[]> {
  return Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async providerId => PROVIDERS[providerId].status()),
  )
}

function reorderForPatchMode(providerIds: ProviderId[], deprioritizedProviders: string[] = []) {
  if (deprioritizedProviders.length === 0) return providerIds
  const deprioritized = new Set(deprioritizedProviders)
  return [
    ...providerIds.filter(providerId => !deprioritized.has(providerId)),
    ...providerIds.filter(providerId => deprioritized.has(providerId)),
  ]
}

function formatProviderReport(statuses: ProviderStatusResult[]) {
  const lines = [
    'BertOS verified provider status:',
    '',
    ...statuses.map(status => {
      const state = status.online ? 'available' : 'unavailable'
      const source = status.providerId === 'ollama-pro' || status.providerId === 'gemini-api-native' ? 'API' : 'daemon'
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
    source: status.providerId === 'ollama-pro' || status.providerId === 'gemini-api-native' ? 'api' as const : 'daemon' as const,
    error: status.error,
  }
}

export async function askWithProviderRouter(
  prompt: string,
  preferred: AIModel = 'auto',
  options: ProviderAskOptions & { deprioritizedProviders?: string[] } = {},
): Promise<ProviderAskResult> {
  const started = Date.now()
  const routerMode = options.mode ?? options.purpose ?? 'chat'
  const taskType = options.taskType ?? (routerMode === 'patch' ? 'code_patch' : 'general')
  const statuses = await getVerifiedProviderStatuses()

  if (shouldUseProviderInventoryShortcut(prompt, options)) {
    return {
      ok: true,
      providerId: 'bertos-router',
      providerName: 'BertOS Router',
      modelOrTool: 'verified-provider-status',
      text: formatProviderReport(statuses),
      latencyMs: Date.now() - started,
      source: 'router',
      routerMode,
      taskType,
      inventoryShortcutUsed: true,
      selectedProvider: 'bertos-router',
      attemptedProviders: statuses.map(providerStatusToAttempt),
    }
  }

  const byId = new Map(statuses.map(status => [status.providerId, status]))
  const decision = routePrompt(prompt, preferred)
  const fallbackOrder: ProviderId[] = routerMode === 'patch'
    ? ['codex-cli', 'claude-code', 'ollama-pro', 'gemini-cli']
    : ['gemini-api-native', 'codex-cli', 'claude-code', 'gemini-cli', 'ollama-pro']
  const requested = preferred !== 'auto' && isProviderId(preferred) ? [preferred] : []
  const ordered = reorderForPatchMode([
    ...requested,
    ...(routerMode === 'patch' ? [] : [decision.primary, ...(decision.secondary ?? [])]),
    ...fallbackOrder,
  ].filter((value, index, array) => array.indexOf(value) === index)
    .filter(isProviderId), options.deprioritizedProviders)

  const errors: string[] = []
  const attemptedProviders: ProviderAskResult['attemptedProviders'] = []

  for (const providerId of ordered) {
    const status = byId.get(providerId)
    attemptedProviders?.push({
      providerId,
      available: Boolean(status?.online),
      source: providerId === 'ollama-pro' || providerId === 'gemini-api-native' ? 'api' : 'daemon',
      error: status?.error,
    })

    if (!status?.online) {
      errors.push(`${providerId}: unavailable${status?.error ? ` - ${status.error}` : ''}`)
      continue
    }

    const result = await PROVIDERS[providerId].ask(prompt, options)
    if (result.ok) {
      return {
        ...result,
        fallbackUsed: providerId === (requested[0] ?? decision.primary) ? undefined : providerId,
        fallbackChain: ordered,
        routerMode,
        taskType,
        inventoryShortcutUsed: false,
        selectedProvider: providerId,
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
    routerMode,
    taskType,
    inventoryShortcutUsed: false,
    selectedProvider: String(ordered[0] ?? decision.primary),
    attemptedProviders,
    error: `All verified providers failed or were unavailable. ${errors.join(' | ')}`,
  }
}
