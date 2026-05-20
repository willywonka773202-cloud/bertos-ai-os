const COMPOSIO_BASE_URL = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev/api/v1'

export interface ComposioStatus {
  configured: boolean
  reachable: boolean
  baseUrl: string
  error?: string
}

function getApiKey() {
  return process.env.COMPOSIO_API_KEY?.trim() || ''
}

async function composioFetch(path: string, init: RequestInit = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Missing COMPOSIO_API_KEY.')
  return fetch(`${COMPOSIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
}

export async function getComposioStatus(): Promise<ComposioStatus> {
  if (!getApiKey()) {
    return {
      configured: false,
      reachable: false,
      baseUrl: COMPOSIO_BASE_URL,
      error: 'Missing COMPOSIO_API_KEY.',
    }
  }

  try {
    const res = await composioFetch('/apps')
    if (!res.ok) {
      return {
        configured: true,
        reachable: false,
        baseUrl: COMPOSIO_BASE_URL,
        error: `Composio returned HTTP ${res.status}.`,
      }
    }
    return {
      configured: true,
      reachable: true,
      baseUrl: COMPOSIO_BASE_URL,
    }
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      baseUrl: COMPOSIO_BASE_URL,
      error: error instanceof Error ? error.message : 'Composio status check failed.',
    }
  }
}

export async function listComposioApps() {
  const res = await composioFetch('/apps')
  if (!res.ok) throw new Error(`Composio apps request failed with HTTP ${res.status}.`)
  return res.json()
}

export async function listComposioActions(app?: string) {
  const suffix = app ? `?app=${encodeURIComponent(app)}` : ''
  const res = await composioFetch(`/actions${suffix}`)
  if (!res.ok) throw new Error(`Composio actions request failed with HTTP ${res.status}.`)
  return res.json()
}

export async function callComposioAction(action: string, params: unknown) {
  if (!action) throw new Error('action is required.')
  const res = await composioFetch(`/actions/${encodeURIComponent(action)}/execute`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  })
  if (!res.ok) throw new Error(`Composio action request failed with HTTP ${res.status}.`)
  return res.json()
}
