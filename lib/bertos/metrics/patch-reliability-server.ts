interface ServerPatchProviderMetrics {
  providerId: string
  consecutiveParseFailures: number
  parseFailures: number
  validJson: number
}

const metrics = new Map<string, ServerPatchProviderMetrics>()

function get(providerId: string) {
  const existing = metrics.get(providerId)
  if (existing) return existing
  const created = {
    providerId,
    consecutiveParseFailures: 0,
    parseFailures: 0,
    validJson: 0,
  }
  metrics.set(providerId, created)
  return created
}

export function recordServerPatchParse(providerId: string | undefined, ok: boolean) {
  if (!providerId) return
  const metric = get(providerId)
  if (ok) {
    metric.validJson += 1
    metric.consecutiveParseFailures = 0
  } else {
    metric.parseFailures += 1
    metric.consecutiveParseFailures += 1
  }
}

export function getServerPatchQuarantinedProviders() {
  return Array.from(metrics.values())
    .filter(metric => metric.consecutiveParseFailures >= 3)
    .map(metric => metric.providerId)
}

export function getServerPatchMetrics() {
  return Array.from(metrics.values())
}
