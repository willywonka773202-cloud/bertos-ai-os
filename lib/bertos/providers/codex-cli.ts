import { askLocalDaemon, fetchLocalDaemonStatus } from '../local-daemon'
import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const daemon = await fetchLocalDaemonStatus()
  const tool = daemon.tools.find(item => item.id === 'codex-cli')
  const available = Boolean(daemon.online && tool?.installed && tool.loginStatus === 'available')
  return {
    ok: available,
    providerId: 'codex-cli',
    providerName: 'Codex CLI',
    modelOrTool: tool?.resolvedPath ?? 'codex',
    online: available,
    error: tool?.error ?? daemon.error,
    detail: tool,
  }
}

export async function ask(prompt: string, options: ProviderAskOptions = {}): Promise<ProviderAskResult> {
  const started = Date.now()
  try {
    const result = await askLocalDaemon('codex-cli', prompt, {
      timeoutMs: 180000,
      mode: options.purpose,
    })
    return {
      ok: true,
      providerId: 'codex-cli',
      providerName: 'Codex CLI',
      modelOrTool: result.resolvedPath ?? result.executable,
      text: result.stdout,
      latencyMs: Date.now() - started,
      source: 'daemon',
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'codex-cli',
      providerName: 'Codex CLI',
      modelOrTool: 'codex',
      text: '',
      latencyMs: Date.now() - started,
      source: 'daemon',
      error: error instanceof Error ? error.message : 'Codex CLI request failed.',
    }
  }
}
