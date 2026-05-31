#!/usr/bin/env node

const enabled = process.env.HERMES_ENABLED === 'true'
const hasBaseUrl = Boolean(process.env.HERMES_BASE_URL || process.env.HERMES_API_URL)
const hasKey = Boolean(process.env.HERMES_API_KEY || process.env.HERMES_API_SERVER_KEY)
const model = process.env.HERMES_MODEL || process.env.HERMES_API_MODEL || 'hermes-agent'

console.log(JSON.stringify({
  HERMES_ENABLED: enabled,
  HERMES_BASE_URL_present: hasBaseUrl,
  HERMES_API_KEY_present: hasKey,
  HERMES_MODEL: model,
  routingEnabled: enabled && hasBaseUrl && hasKey,
  paidProviderOptional: process.env.ENABLE_HERMES_PAID === 'true',
  note: 'No env files read. No secrets printed. No network request made. No paid Hermes call made. BertOS supports Ollama/local, custom, and free-tier Hermes backends.',
}, null, 2))
