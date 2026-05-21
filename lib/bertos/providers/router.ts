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
    'I will only route to providers marked available above.',
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

// Team Mode: Gemini plans → Claude reviews → Codex implements → Ollama summarizes
export async function askWithTeamMode(prompt: string): Promise<ProviderAskResult> {
  const started = Date.now()
  const statuses = await getVerifiedProviderStatuses()
  const byId = new Map(statuses.map(s => [s.providerId, s]))
  const chainLog: string[] = []

  const tryStep = async (
    providerId: ProviderId,
    stepPrompt: string,
    stepLabel: string,
  ): Promise<string | null> => {
    if (!byId.get(providerId)?.online) {
      chainLog.push(`[${stepLabel}] ${providerId} unavailable — skipped`)
      return null
    }
    const r = await PROVIDERS[providerId].ask(stepPrompt)
    if (r.ok) {
      chainLog.push(`[${stepLabel}] ${providerId} ✓ (${Date.now() - started}ms)`)
      return r.text
    }
    chainLog.push(`[${stepLabel}] ${providerId} failed: ${r.error}`)
    return null
  }

  // Step 1: Gemini plans
  const plan = await tryStep(
    'gemini-cli',
    `You are the Planner in a multi-agent coding pipeline. Analyze this task and produce a concise implementation plan (numbered steps, files to change, approach). Do not write code yet.\n\nTask:\n${prompt}`,
    'Plan',
  )

  // Step 2: Claude reviews the plan
  const planContext = plan ? `\n\nProposed plan:\n${plan}` : ''
  const review = await tryStep(
    'claude-code',
    `You are the Architect/Reviewer in a multi-agent pipeline. Review the plan and identify risks, missing steps, and improvements. Be specific.${planContext}\n\nOriginal task:\n${prompt}`,
    'Review',
  )

  // Step 3: Codex implements
  const reviewContext = review ? `\n\nArchitect review:\n${review}` : ''
  const implementation = await tryStep(
    'codex-cli',
    `You are the Implementer. Based on the task, plan, and review, produce the final implementation as a valid JSON patch.\n\nTask:\n${prompt}${planContext}${reviewContext}`,
    'Implement',
  )

  // Step 4: Ollama summarizes (best-effort)
  const summaryContext = [plan, review, implementation].filter(Boolean).join('\n\n---\n\n')
  const summary = await tryStep(
    'ollama-pro',
    `Summarize what was done in this multi-agent coding pipeline in 2-3 sentences:\n\n${summaryContext}`,
    'Summarize',
  )

  const finalText = implementation ?? review ?? plan ?? 'Team mode: all providers unavailable or failed.'

  return {
    ok: Boolean(implementation ?? review ?? plan),
    providerId: 'bertos-team',
    providerName: 'BertOS Team Mode',
    modelOrTool: 'gemini→claude→codex→ollama',
    text: finalText,
    latencyMs: Date.now() - started,
    source: 'router',
    fallbackChain: ['gemini-cli', 'claude-code', 'codex-cli', 'ollama-pro'],
    attemptedProviders: statuses.map(providerStatusToAttempt),
    error: (implementation ?? review ?? plan) ? undefined : 'All team mode providers failed.',
    // Attach chain log as metadata in the text
    ...(chainLog.length > 0 ? { teamChainLog: chainLog } : {}),
  } as ProviderAskResult & { teamChainLog?: string[] }
}

export async function askWithProviderRouter(prompt: string, preferred: AIModel = 'auto'): Promise<ProviderAskResult> {
  const started = Date.now()

  // Team mode: chain all providers
  if (preferred === ('team' as AIModel)) {
    return askWithTeamMode(prompt)
  }

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
        routingReason: decision.reasoning,
        routingTaskType: decision.taskType,
      } as ProviderAskResult & { routingReason?: string; routingTaskType?: string }
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
