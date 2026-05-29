#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

function compileTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      paths: { '@/*': ['./*'] },
      baseUrl: root,
    },
  }).outputText
  module._compile(output, filename)
}

Module._extensions['.ts'] = compileTs

function req(relativePath) {
  return require(path.join(root, relativePath))
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

const originalEnv = { ...process.env }

function resetHermesEnv() {
  delete process.env.HERMES_ENABLED
  delete process.env.HERMES_BASE_URL
  delete process.env.HERMES_API_URL
  delete process.env.HERMES_API_KEY
  delete process.env.HERMES_API_SERVER_KEY
  delete process.env.HERMES_MODEL
  delete process.env.HERMES_TIMEOUT_MS
  delete process.env.HERMES_STREAMING
  delete process.env.HERMES_BACKEND_MODE
  delete process.env.HERMES_ALLOW_NO_API_KEY
  delete process.env.ENABLE_HERMES_PAID
}

const {
  normalizeHermesApiBase,
  getHermesNousConfig,
} = req('lib/bertos/providers/hermes-nous.ts')
const {
  checkHermesRouteRateLimit,
  hermesPublicConfig,
  validateHermesProxyReady,
} = req('lib/bertos/hermes-proxy.ts')

resetHermesEnv()
assert(normalizeHermesApiBase(' http://127.0.0.1:8642/v1/ ') === 'http://127.0.0.1:8642', 'Hermes base URL normalization strips trailing /v1')

let ready = validateHermesProxyReady()
assert(!ready.ok && ready.error.includes('HERMES_ENABLED'), 'Hermes proxy reports disabled state without env')

process.env.HERMES_ENABLED = 'true'
process.env.HERMES_BASE_URL = 'http://127.0.0.1:8642/v1'
process.env.HERMES_API_KEY = 'test-secret-token'
process.env.HERMES_MODEL = 'hermes-agent'
process.env.HERMES_TIMEOUT_MS = '120000'
process.env.HERMES_STREAMING = 'true'
process.env.HERMES_BACKEND_MODE = 'free-local'

const cfg = getHermesNousConfig()
assert(cfg.enabled, 'Hermes config enables when HERMES_ENABLED=true')
assert(cfg.apiUrl === 'http://127.0.0.1:8642', 'Hermes config stores normalized root URL')
assert(cfg.v1BaseUrl === 'http://127.0.0.1:8642/v1', 'Hermes config exposes /v1 base URL')
assert(cfg.apiKeyConfigured, 'Hermes config detects server-side API key')
assert(cfg.model === 'hermes-agent', 'Hermes config uses configured model')
assert(cfg.backendMode === 'free-local', 'Hermes config preserves free backend mode')

const publicCfg = hermesPublicConfig()
assert(publicCfg.apiKeyMasked === '******** configured', 'public Hermes config masks API key')
assert(!JSON.stringify(publicCfg).includes('test-secret-token'), 'public Hermes config does not expose the token')
assert(publicCfg.freeModelBackends.includes('Ollama/local model'), 'public Hermes config advertises free local model path')

ready = validateHermesProxyReady()
assert(ready.ok && ready.status === 200, 'Hermes proxy is ready when enabled, URL, and key are present')

const rateKey = `test-hermes-${Date.now()}`
assert(checkHermesRouteRateLimit(rateKey, 2, 1000).ok, 'rate limiter allows first request')
assert(checkHermesRouteRateLimit(rateKey, 2, 1000).ok, 'rate limiter allows second request')
assert(!checkHermesRouteRateLimit(rateKey, 2, 1000).ok, 'rate limiter blocks requests over limit')

process.env = originalEnv

if (process.exitCode === 1) process.exit(1)
