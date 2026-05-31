import type { DaemonHealth } from './daemon-health'
import { offlineDaemonHealth } from './daemon-health'
import type { LocalDaemonStatus } from './local-daemon'

export const DEFAULT_BROWSER_DAEMON_URL = 'http://127.0.0.1:8787'

export function browserDaemonBaseUrl() {
  if (typeof window === 'undefined') return DEFAULT_BROWSER_DAEMON_URL
  return (window.localStorage.getItem('bertos-daemon-url') || DEFAULT_BROWSER_DAEMON_URL).replace(/\/+$/, '')
}

export function browserDaemonToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('bertos-daemon-token') || ''
}

export function canUseBrowserDaemon() {
  return typeof window !== 'undefined'
}

export async function fetchBrowserDaemon(path: string, init: RequestInit = {}) {
  if (!canUseBrowserDaemon()) throw new Error('Browser-local daemon fetch is unavailable server-side.')
  const endpoint = path.startsWith('/') ? path : `/${path}`
  return fetch(`${browserDaemonBaseUrl()}${endpoint}`, {
    ...init,
    cache: 'no-store',
    mode: 'cors',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(browserDaemonToken() ? { 'x-bertos-agent-secret': browserDaemonToken() } : {}),
      ...(init.headers ?? {}),
    },
  })
}

function mapLocalDaemonApiPath(input: string, init: RequestInit = {}) {
  const url = new URL(input, window.location.origin)
  if (!url.pathname.startsWith('/api/local-daemon')) return null
  const suffix = url.pathname.replace('/api/local-daemon', '') || '/status'

  if (suffix === '/status' || suffix === '/health') return '/status'
  if (suffix === '/repo/status') return '/repo/status'
  if (suffix === '/files') return `/repo/files${url.search}`
  if (suffix === '/search') return '/repo/search'
  if (suffix === '/run') return '/run-cli'
  if (suffix === '/ask') return '/ask-cli'

  if (suffix === '/file') {
    if ((init.method ?? 'GET').toUpperCase() === 'GET') return `/repo/file${url.search}`
    try {
      const body = typeof init.body === 'string' ? JSON.parse(init.body) as { operation?: string } : {}
      if (body.operation === 'create') return '/repo/file/create'
      if (body.operation === 'delete') return '/repo/file/delete'
    } catch {
      // Fall through to normal write route.
    }
    return '/repo/file'
  }

  return null
}

export async function fetchLocalDaemonBridge(input: string, init: RequestInit = {}) {
  if (!canUseBrowserDaemon()) return fetch(input, init)
  const mappedPath = mapLocalDaemonApiPath(input, init)
  if (!mappedPath) return fetch(input, init)
  try {
    const res = await fetchBrowserDaemon(mappedPath, init)
    if (res.ok || res.status === 400 || res.status === 401 || res.status === 409) return res
  } catch {
    // Fall back to the app route. In local Next dev this keeps server-side daemon proxying working.
  }
  return fetch(input, init)
}

export async function fetchBrowserDaemonStatus(timeoutMs = 4000): Promise<LocalDaemonStatus | null> {
  if (!canUseBrowserDaemon()) return null
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchBrowserDaemon('/status', { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json() as LocalDaemonStatus
    return {
      ...data,
      online: Boolean(data.online),
      available: Boolean(data.available),
      startCommand: data.startCommand || 'npm run bertos:daemon',
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchBrowserDaemonHealth(timeoutMs = 4000): Promise<DaemonHealth | null> {
  const status = await fetchBrowserDaemonStatus(timeoutMs)
  if (!status?.online) return null
  const repo = status.repo
  const repoDetected = Boolean(repo?.root)
  const gitDetected = Boolean(repo?.branch)
  const repoSafe = Boolean(repo?.safeRepo)
  return {
    ok: repoDetected && repoSafe,
    daemonOnline: true,
    daemonUrl: browserDaemonBaseUrl(),
    uptimeMs: status.uptimeMs,
    workspaceRoot: repo?.root,
    repoDetected,
    gitDetected,
    packageJsonDetected: true,
    scripts: {
      bertosDaemon: true,
      typecheck: true,
      build: true,
      lint: true,
      test: false,
    },
    capabilities: {
      readFiles: repoDetected && repoSafe,
      runSafeCommands: repoDetected && repoSafe,
      gitStatus: gitDetected && repoSafe,
      gitDiff: gitDetected && repoSafe,
      askProvider: true,
    },
    error: repo?.blockedReason,
    fixCommand: status.startCommand || 'npm run bertos:daemon',
  }
}

export function browserDaemonOfflineHealth(error = 'Hosted BertOS could not reach the daemon on this Mac. Start npm run bertos:daemon and restart it after pulling the latest code.'): DaemonHealth {
  return {
    ...offlineDaemonHealth(error),
    daemonUrl: browserDaemonBaseUrl(),
  }
}
