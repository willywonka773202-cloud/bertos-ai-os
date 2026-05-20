import { askLocalDaemon, fetchLocalDaemonStatus } from '../local-daemon'
import type { ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const daemon = await fetchLocalDaemonStatus()
  const tool = daemon.tools.find(item => item.id === 'claude-code')
  return {
    ok: Boolean(daemon.online && tool?.installed),
    providerId: 'claude-code',
    providerName: 'Claude Code CLI',
    modelOrTool: tool?.resolvedPath ?? 'claude',
    online: Boolean(daemon.online && tool?.installed),
    error: tool?.error ?? daemon.error,
    detail: tool,
  }
}

export async function ask(prompt: string): Promise<ProviderAskResult> {
  const started = Date.now()
  try {
    const result = await askLocalDaemon('claude-code', prompt, { timeoutMs: 60000 })
    return {
      ok: true,
      providerId: 'claude-code',
      providerName: 'Claude Code CLI',
      modelOrTool: result.resolvedPath ?? result.executable,
      text: result.stdout,
      latencyMs: Date.now() - started,
      source: 'daemon',
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'claude-code',
      providerName: 'Claude Code CLI',
      modelOrTool: 'claude',
      text: '',
      latencyMs: Date.now() - started,
      source: 'daemon',
      error: error instanceof Error ? error.message : 'Claude CLI request failed.',
    }
  }
}
