export interface PatchReliabilityProviderMetrics {
  providerId: string
  attempts: number
  validJson: number
  parseFailures: number
  consecutiveParseFailures: number
  successfulApplies: number
  validationPasses: number
  totalLatencyMs: number
}

export type PatchReliabilityEvent =
  | { type: 'generation'; providerId: string; validJson: boolean; latencyMs?: number }
  | { type: 'apply'; providerId: string; success: boolean }
  | { type: 'validation'; providerId: string; success: boolean }

const STORAGE_KEY = 'bertos-patch-reliability-v1'

function emptyMetrics(providerId: string): PatchReliabilityProviderMetrics {
  return {
    providerId,
    attempts: 0,
    validJson: 0,
    parseFailures: 0,
    consecutiveParseFailures: 0,
    successfulApplies: 0,
    validationPasses: 0,
    totalLatencyMs: 0,
  }
}

export function readPatchReliabilityMetrics(): Record<string, PatchReliabilityProviderMetrics> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, PatchReliabilityProviderMetrics>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function recordPatchReliabilityEvent(event: PatchReliabilityEvent) {
  if (typeof window === 'undefined') return
  const metrics = readPatchReliabilityMetrics()
  const current = metrics[event.providerId] ?? emptyMetrics(event.providerId)
  current.consecutiveParseFailures ??= 0

  if (event.type === 'generation') {
    current.attempts += 1
    if (event.validJson) {
      current.validJson += 1
      current.consecutiveParseFailures = 0
    } else {
      current.parseFailures += 1
      current.consecutiveParseFailures += 1
    }
    current.totalLatencyMs += event.latencyMs ?? 0
  }

  if (event.type === 'apply' && event.success) current.successfulApplies += 1
  if (event.type === 'validation' && event.success) current.validationPasses += 1

  metrics[event.providerId] = current
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
}

export function summarizePatchReliability(metric?: PatchReliabilityProviderMetrics) {
  if (!metric || metric.attempts === 0) {
    return {
      validJsonRate: 'n/a',
      averageLatencyMs: 'n/a',
      quarantined: false,
    }
  }
  return {
    validJsonRate: `${Math.round((metric.validJson / metric.attempts) * 100)}%`,
    averageLatencyMs: `${Math.round(metric.totalLatencyMs / metric.attempts)}ms`,
    quarantined: metric.consecutiveParseFailures >= 3,
  }
}
