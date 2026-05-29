import { askLocalDaemon, fetchLocalDaemonStatus } from '../local-daemon'
import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const daemon = await fetchLocalDaemonStatus()
  const tool = daemon.tools.find(item => item.id === 'openclaw-cli')
  const available = Boolean(daemon.online && tool?.installed && tool.loginStatus === 'available')
  return {
    ok: available,
    providerId: 'openclaw-cli',
    providerName: 'OpenClaw',
    modelOrTool: tool?.resolvedPath ?? 'openclaw',
    online: available,
    error: tool?.error ?? daemon.error,
    detail: tool,
  }
}

export async function ask(prompt: string, options: ProviderAskOptions = {}): Promise<ProviderAskResult> {
  const started = Date.now()
  try {
    const result = await askLocalDaemon('openclaw-cli', prompt, {
      timeoutMs: options.purpose === 'patch' ? 180000 : 180000,
      mode: options.purpose,
    })
    return {
      ok: true,
      providerId: 'openclaw-cli',
      providerName: 'OpenClaw',
      modelOrTool: result.resolvedPath ?? result.executable,
      text: result.stdout,
      latencyMs: Date.now() - started,
      source: 'daemon',
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'openclaw-cli',
      providerName: 'OpenClaw',
      modelOrTool: 'openclaw',
      text: '',
      latencyMs: Date.now() - started,
      source: 'daemon',
      error: error instanceof Error ? error.message : 'OpenClaw request failed.',
    }
  }
}
