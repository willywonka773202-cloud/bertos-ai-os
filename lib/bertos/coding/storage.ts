import { tmpdir } from 'node:os'
import path from 'node:path'
import { BERTOS_DATA_ROOT } from '../runtime-store'

export type StorageMode = 'local-filesystem' | 'vercel-ephemeral' | 'custom-path'
export type DurableAdapter = 'none' | 'vercel-blob' | 'database' | 'sqlite'

export interface StorageStatus {
  mode: StorageMode
  dataRoot: string
  durable: boolean
  ephemeral: boolean
  warning?: string
  durableAdapter: DurableAdapter
  durableAdapterConfigured: boolean
  setupRequired: boolean
  notes: string
}

/** Presence-only env check — never exposes the value. */
function hasEnv(...keys: string[]): boolean {
  return keys.some(key => typeof process.env[key] === 'string' && process.env[key]!.length > 0)
}

export function getStorageStatus(): StorageStatus {
  const onVercel = hasEnv('VERCEL')
  const dataRoot = BERTOS_DATA_ROOT
  const underTmp = dataRoot.startsWith(path.resolve(tmpdir()))

  // Detect a (planned) durable adapter purely by env-var presence.
  let durableAdapter: DurableAdapter = 'none'
  if (hasEnv('BLOB_READ_WRITE_TOKEN', 'BERTOS_BLOB_TOKEN')) durableAdapter = 'vercel-blob'
  else if (hasEnv('DATABASE_URL', 'BERTOS_DATABASE_URL', 'POSTGRES_URL')) durableAdapter = 'database'
  const durableAdapterConfigured = durableAdapter !== 'none'

  let mode: StorageMode
  if (onVercel || underTmp) mode = onVercel ? 'vercel-ephemeral' : 'custom-path'
  else if (process.env.BERTOS_DATA_ROOT) mode = 'custom-path'
  else mode = 'local-filesystem'

  const ephemeral = (onVercel || underTmp) && !durableAdapterConfigured
  const durable = mode === 'local-filesystem' || durableAdapterConfigured || (mode === 'custom-path' && !underTmp)

  return {
    mode,
    dataRoot,
    durable,
    ephemeral,
    warning: ephemeral
      ? 'Runtime data is stored on an ephemeral filesystem and will be lost on redeploy/restart. Configure a durable adapter for hosted production use.'
      : undefined,
    durableAdapter,
    durableAdapterConfigured,
    setupRequired: ephemeral && !durableAdapterConfigured,
    notes: mode === 'local-filesystem'
      ? 'Local-first: data persists under data/bertos on this machine. Safe for single-user local use.'
      : mode === 'vercel-ephemeral'
        ? 'Hosted on Vercel with ephemeral /tmp storage. Not durable; a real storage adapter is required for production.'
        : 'Custom BERTOS_DATA_ROOT path in use.',
  }
}

export type AuthMode = 'none' | 'single-user-demo' | 'session-scoped' | 'configured'

export interface AuthStatus {
  mode: AuthMode
  userIsolation: boolean
  hostedMode: boolean
  note: string
}

export function getAuthStatus(): AuthStatus {
  const hostedMode = hasEnv('VERCEL')
  // No auth provider is wired yet; BertOS runs as a single-user surface.
  return {
    mode: hostedMode ? 'single-user-demo' : 'none',
    userIsolation: false,
    hostedMode,
    note: hostedMode
      ? 'Hosted demo mode: a single shared runtime store with NO multi-user isolation. Do not register private repos or treat as multi-tenant.'
      : 'Local single-user mode: all data belongs to this machine\'s operator.',
  }
}

export interface PublicReadiness {
  generatedAt: string
  storage: StorageStatus
  auth: AuthStatus
  providers: { total: number; online: number; anyOnline: boolean }
  localUseReady: boolean
  publicDemoReady: boolean
  publicMultiUserReady: boolean
  blockers: string[]
  summary: string
}

export async function getPublicReadiness(): Promise<PublicReadiness> {
  const storage = getStorageStatus()
  const auth = getAuthStatus()

  let online = 0
  let total = 0
  try {
    const { getAssistantProviderStatuses } = await import('./assistant')
    const providers = await getAssistantProviderStatuses()
    total = providers.length
    online = providers.filter(p => p.online).length
  } catch {
    // provider status optional
  }

  const blockers: string[] = []
  if (!auth.userIsolation) blockers.push('No authentication / user isolation — not safe for multi-user public hosting.')
  if (storage.ephemeral) blockers.push('Hosted storage is ephemeral — data is lost on redeploy. Configure a durable adapter.')
  if (online === 0) blockers.push('No AI provider is online — the assistant runs in local deterministic mode only.')

  return {
    generatedAt: new Date().toISOString(),
    storage,
    auth,
    providers: { total, online, anyOnline: online > 0 },
    localUseReady: true,
    publicDemoReady: !storage.ephemeral || true, // demo works, just ephemeral — explicitly labelled
    publicMultiUserReady: auth.userIsolation && storage.durable,
    blockers,
    summary: auth.userIsolation && storage.durable
      ? 'Ready for hosted multi-user use.'
      : storage.ephemeral
        ? 'Usable locally and as a single-user hosted demo (ephemeral). NOT multi-user production ready.'
        : 'Usable as a single-user local/hosted OS. Multi-user production requires auth + durable storage.',
  }
}
