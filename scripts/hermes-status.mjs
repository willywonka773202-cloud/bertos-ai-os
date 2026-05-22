#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envPath = path.join(root, '.env.local')

function parseEnvFlag(contents, key) {
  const line = contents
    .split(/\r?\n/)
    .find(item => item.trim().startsWith(`${key}=`))
  if (!line) return undefined
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
}

let envFile = ''
try {
  envFile = fs.readFileSync(envPath, 'utf8')
} catch {
  envFile = ''
}

const envFlag = process.env.ENABLE_HERMES_PAID
const fileFlag = envFile ? parseEnvFlag(envFile, 'ENABLE_HERMES_PAID') : undefined
const effectiveFlag = envFlag ?? fileFlag ?? 'false'
const hasUrl = Boolean(process.env.HERMES_API_URL || (envFile && parseEnvFlag(envFile, 'HERMES_API_URL')))
const hasKey = Boolean(process.env.HERMES_API_KEY || (envFile && parseEnvFlag(envFile, 'HERMES_API_KEY')))

console.log(JSON.stringify({
  ENABLE_HERMES_PAID: effectiveFlag === 'true',
  HERMES_API_URL_present: hasUrl,
  HERMES_API_KEY_present: hasKey,
  routingEnabled: effectiveFlag === 'true' && hasUrl && hasKey,
  note: 'No secrets printed. No network request made. No paid Hermes/Nous call made.',
}, null, 2))
