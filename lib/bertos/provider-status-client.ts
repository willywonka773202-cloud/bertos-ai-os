'use client'

import { fetchBrowserDaemonStatus } from './browser-daemon'
import type { LocalCliProvider, LocalCliToolStatus, LocalDaemonStatus } from './local-daemon'

export type ProviderStatusValue =
  | 'online'
  | 'offline'
  | 'configured'
  | 'blocked'
  | 'enabled'
  | 'disabled'
  | 'planned'
  | 'unknown'
  | 'copy-prompt-only'
  | 'manual-or-api-needed'

export interface ProviderStatusEntry {
  id: string
  name: string
  status: ProviderStatusValue | string
  latency?: number
  message?: string
  source?: 'server' | 'browser-daemon'
}

export interface BrowserAwareProviderStatusResponse {
  providers?: ProviderStatusEntry[]
  localDaemon?: LocalDaemonStatus
  providerStatusSource?: 'server' | 'browser-daemon'
  apiProviders?: {
    enabled?: boolean
    openai?: boolean
    geminiNative?: boolean
    hermesNous?: boolean
    [key: string]: boolean | undefined
  }
  hermes?: {
    enabled?: boolean
    paidEnabled?: boolean
    statusMessage?: string
    apiKeyConfigured?: boolean
    mode?: string
    [key: string]: unknown
  }
  hermesNous?: unknown
  [key: string]: unknown
}

export const LOCAL_CLI_PROVIDER_IDS = ['claude-code', 'codex-cli', 'gemini-cli', 'openclaw-cli'] as const

export function isLocalCliProvider(id: string | undefined): id is LocalCliProvider {
  return Boolean(id && (LOCAL_CLI_PROVIDER_IDS as readonly string[]).includes(id))
}

function toolStatus(tool: LocalCliToolStatus, daemonOnline: boolean): ProviderStatusEntry {
  const online = daemonOnline && tool.installed && tool.loginStatus === 'available'
  const configured = daemonOnline && tool.installed && tool.loginStatus === 'unknown'
  const blocked = daemonOnline && tool.installed && tool.loginStatus === 'error'
  const status: ProviderStatusValue = online ? 'online' : configured ? 'configured' : blocked ? 'blocked' : 'offline'
  const message = online
    ? `${tool.version || tool.resolvedPath || 'available'} · browser daemon`
    : configured
      ? tool.error || tool.version || tool.resolvedPath || 'Installed. Send a test prompt to verify login.'
      : blocked
        ? tool.error || 'Installed, but the last verification run failed.'
      : tool.error || 'Not found from the local daemon PATH.'

  return {
    id: tool.id,
    name: tool.label,
    status,
    message,
    source: 'browser-daemon',
  }
}

export function mergeBrowserDaemonProviderStatus(
  status: BrowserAwareProviderStatusResponse | null,
  daemon: LocalDaemonStatus | null,
): BrowserAwareProviderStatusResponse {
  if (!daemon?.online) return status ?? { providers: [], providerStatusSource: 'server' }

  const existing = new Map((status?.providers ?? []).map(provider => [provider.id, provider]))
  for (const tool of daemon.tools ?? []) {
    existing.set(tool.id, toolStatus(tool, daemon.online))
  }

  return {
    ...(status ?? {}),
    providers: Array.from(existing.values()),
    localDaemon: daemon,
    providerStatusSource: 'browser-daemon',
  }
}

export async function fetchBrowserAwareProviderStatus(timeoutMs = 5000): Promise<BrowserAwareProviderStatusResponse> {
  const [serverResult, daemonResult] = await Promise.allSettled([
    fetch('/api/providers/status', { cache: 'no-store' }).then(async response => (
      response.ok ? await response.json() as BrowserAwareProviderStatusResponse : null
    )),
    fetchBrowserDaemonStatus(timeoutMs),
  ])

  const serverStatus = serverResult.status === 'fulfilled' ? serverResult.value : null
  const daemonStatus = daemonResult.status === 'fulfilled' ? daemonResult.value : null
  return mergeBrowserDaemonProviderStatus(serverStatus, daemonStatus)
}
