import { askLocalDaemon, fetchLocalDaemonStatus } from '../local-daemon'
import type { ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const daemon = await fetchLocalDaemonStatus()
  const tool = daemon.tools.find(item => item.id === 'codex-cli')
  return {
    ok: Boolean(daemon.online && tool?.installed),
    providerId: 'codex-cli',
    providerName: 'Codex CLI',
    modelOrTool: tool?.resolvedPath ?? 'codex',
    online: Boolean(daemon.online && tool?.installed),
    error: tool?.error ?? daemon.error,
    detail: tool,
  }
}

export async function ask(prompt: string): Promise<ProviderAskResult> {
  const started = Date.now()
  try {
    const result = await askLocalDaemon('codex-cli', prompt, { timeoutMs: 180000 })
    return {
      ok: true,
      providerId: 'codex-cli',
      providerName: 'Codex CLI',
      modelOrTool: result.resolvedPath ?? result.executable,
      text: result.stdout,
      latencyMs: Date.now() - started,
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'codex-cli',
      providerName: 'Codex CLI',
      modelOrTool: 'codex',
      text: '',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Codex CLI request failed.',
    }
  }
}
