import type { AIModel } from '../types'
import { routePrompt } from '../router'
import * as claudeCli from './claude-cli'
import * as codexCli from './codex-cli'
import * as geminiCli from './gemini-cli'
import * as ollamaPro from './ollama-pro'
import type { ProviderAskResult } from './provider-result'

const PROVIDERS = {
  'claude-code': claudeCli,
  'codex-cli': codexCli,
  'gemini-cli': geminiCli,
  'ollama-pro': ollamaPro,
}

export async function askWithProviderRouter(prompt: string, preferred: AIModel = 'auto'): Promise<ProviderAskResult> {
  const decision = routePrompt(prompt, preferred)
  const ordered = [
    decision.primary,
    ...(decision.secondary ?? []),
    'ollama-pro',
  ].filter((value, index, array) => array.indexOf(value) === index)

  const errors: string[] = []
  for (const providerId of ordered) {
    if (!(providerId in PROVIDERS)) continue
    const provider = PROVIDERS[providerId as keyof typeof PROVIDERS]
    const result = await provider.ask(prompt)
    if (result.ok) {
      return {
        ...result,
        fallbackUsed: providerId === decision.primary ? undefined : String(providerId),
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
    latencyMs: 0,
    error: `All providers failed. ${errors.join(' | ')}`,
  }
}
