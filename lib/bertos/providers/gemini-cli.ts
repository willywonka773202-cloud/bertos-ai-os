import { askLocalDaemon, fetchLocalDaemonStatus } from '../local-daemon'
import type { ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const daemon = await fetchLocalDaemonStatus()
  const tool = daemon.tools.find(item => item.id === 'gemini-cli')
  return {
    ok: Boolean(daemon.online && tool?.installed),
    providerId: 'gemini-cli',
    providerName: 'Gemini CLI',
    modelOrTool: tool?.resolvedPath ?? 'gemini',
    online: Boolean(daemon.online && tool?.installed),
    error: tool?.error ?? daemon.error,
    detail: tool,
  }
}

export async function ask(prompt: string): Promise<ProviderAskResult> {
  const started = Date.now()
  try {
    const result = await askLocalDaemon('gemini-cli', prompt, { timeoutMs: 180000 })
    return {
      ok: true,
      providerId: 'gemini-cli',
      providerName: 'Gemini CLI',
      modelOrTool: result.resolvedPath ?? result.executable,
      text: result.stdout,
      latencyMs: Date.now() - started,
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'gemini-cli',
      providerName: 'Gemini CLI',
      modelOrTool: 'gemini',
      text: '',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Gemini CLI request failed.',
    }
  }
}
