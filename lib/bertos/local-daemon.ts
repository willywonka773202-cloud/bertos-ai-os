export type LocalCliProvider = 'claude-code' | 'codex-cli' | 'gemini-cli'

export interface LocalCliToolStatus {
  id: LocalCliProvider
  label: string
  executable: 'claude' | 'codex' | 'gemini'
  installed: boolean
  resolvedPath?: string
  candidates?: string[]
  version?: string
  loginStatus: 'available' | 'missing' | 'error' | 'unknown'
  error?: string
}

export interface LocalDaemonStatus {
  online: boolean
  available: boolean
  host: string
  port: number
  uptimeMs?: number
  tools: LocalCliToolStatus[]
  logsCount?: number
  repo?: LocalRepoStatus
  error?: string
  startCommand: string
}

export interface LocalRepoStatus {
  root: string
  daemonCwd: string
  branch: string
  remote: string
  status: string
  safeRepo: boolean
  blockedReason?: string
}

export interface LocalDaemonAskResult {
  ok: boolean
  providerId: LocalCliProvider
  executable: string
  resolvedPath?: string
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  error?: string
}

export const LOCAL_CLI_TOOLS: Record<LocalCliProvider, Omit<LocalCliToolStatus, 'installed' | 'loginStatus'>> = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    executable: 'claude',
  },
  'codex-cli': {
    id: 'codex-cli',
    label: 'Codex CLI',
    executable: 'codex',
  },
  'gemini-cli': {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    executable: 'gemini',
  },
}

export function getLocalDaemonBaseUrl(): string {
  const host = process.env.BERTOS_DAEMON_HOST || '127.0.0.1'
  const port = process.env.BERTOS_DAEMON_PORT || '8787'
  return `http://${host}:${port}`
}

export function isLocalDaemonAvailableFromServer(): boolean {
  return !process.env.VERCEL
}

export function unavailableLocalDaemonStatus(reason?: string): LocalDaemonStatus {
  const base = new URL(getLocalDaemonBaseUrl())
  return {
    online: false,
    available: false,
    host: base.hostname,
    port: Number(base.port || 8787),
    tools: Object.values(LOCAL_CLI_TOOLS).map(tool => ({
      ...tool,
      installed: false,
      loginStatus: 'unknown',
      error: 'Daemon is offline.',
    })),
    error: reason ?? 'Local CLI bridge is offline. Start it with npm run bertos:daemon.',
    startCommand: 'npm run bertos:daemon',
  }
}

export async function fetchLocalDaemonStatus(timeoutMs = 2500): Promise<LocalDaemonStatus> {
  if (!isLocalDaemonAvailableFromServer()) {
    return unavailableLocalDaemonStatus('Local CLI bridge is unavailable on Vercel. Start the app locally to reach your Windows daemon.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${getLocalDaemonBaseUrl()}/status`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      return unavailableLocalDaemonStatus(`Daemon returned HTTP ${res.status}.`)
    }

    const data = await res.json() as LocalDaemonStatus
    return {
      ...data,
      online: Boolean(data.online),
      available: Boolean(data.available),
      startCommand: data.startCommand || 'npm run bertos:daemon',
    }
  } catch (error) {
    return unavailableLocalDaemonStatus(error instanceof Error ? error.message : 'Could not reach local daemon.')
  } finally {
    clearTimeout(timeout)
  }
}

export async function askLocalDaemon(
  providerId: LocalCliProvider,
  prompt: string,
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<LocalDaemonAskResult> {
  if (!isLocalDaemonAvailableFromServer()) {
    throw new Error('Local CLI bridge is only available in local development. Falling back to Ollama Pro.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120000)

  try {
    const res = await fetch(`${getLocalDaemonBaseUrl()}/ask-cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        prompt,
        cwd: options.cwd,
        timeoutMs: options.timeoutMs,
      }),
      signal: controller.signal,
    })
    const data = await res.json() as LocalDaemonAskResult
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Local CLI bridge returned HTTP ${res.status}.`)
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchLocalRepoStatus(timeoutMs = 2500): Promise<LocalRepoStatus | null> {
  if (!isLocalDaemonAvailableFromServer()) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${getLocalDaemonBaseUrl()}/repo/status`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json() as LocalRepoStatus
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function runLocalDaemonCommand(
  executable: string,
  args: string[] = [],
  options: { cwd?: string; timeoutMs?: number } = {},
) {
  if (!isLocalDaemonAvailableFromServer()) {
    throw new Error('Local CLI bridge is only available in local development.')
  }
  const res = await fetch(`${getLocalDaemonBaseUrl()}/run-cli`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executable, args, cwd: options.cwd, timeoutMs: options.timeoutMs }),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || `Command failed with HTTP ${res.status}.`)
  return data
}
