#!/usr/bin/env node
import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const moduleCache = new Map()

function loadTsModule(relativePath) {
  const filePath = path.join(repoRoot, relativePath)
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports

  const source = fs.readFileSync(filePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText

  const mod = new Module(filePath)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  moduleCache.set(filePath, mod)

  const originalRequire = mod.require.bind(mod)
  mod.require = specifier => {
    if (specifier === './schema') return loadTsModule('lib/bertos/patch/schema.ts')
    if (specifier === './fixtures') return loadTsModule('lib/bertos/patch/fixtures/index.ts')
    if (specifier === '../types') return {}
    if (specifier === '../router') return {
      routePrompt: () => ({
        primary: 'codex-cli',
        secondary: ['claude-code', 'ollama-pro', 'gemini-cli'],
        reasoning: 'test',
        confidence: 1,
        taskType: 'coding',
        strategy: 'single',
      }),
    }
    if (specifier === './claude-cli' || specifier === './codex-cli' || specifier === './gemini-cli' || specifier === './ollama-pro') {
      const providerId = specifier.replace('./', '')
      return {
        status: async () => ({
          ok: providerId === 'codex-cli',
          providerId,
          providerName: providerId,
          modelOrTool: providerId,
          online: providerId === 'codex-cli',
        }),
        ask: async () => ({
          ok: true,
          providerId,
          providerName: providerId,
          modelOrTool: providerId,
          text: '{"summary":"ok","files":[],"validation":{"commands":[]}}',
          latencyMs: 1,
          source: providerId === 'ollama-pro' ? 'api' : 'daemon',
        }),
      }
    }
    return originalRequire(specifier)
  }

  mod._compile(output, filePath)
  return mod.exports
}

const { runPatchParserRegression } = loadTsModule('lib/bertos/patch/parser-regression.ts')
const { askWithProviderRouter, shouldUseProviderInventoryShortcut } = loadTsModule('lib/bertos/providers/router.ts')
const results = runPatchParserRegression()
const failed = results.filter(result => !result.passed)
const patchPrompt = 'Add a tooltip to the Save button and return a canonical patch.'
const inventoryBypassed = !shouldUseProviderInventoryShortcut(patchPrompt, {
  purpose: 'patch',
  mode: 'patch',
  taskType: 'code_patch',
  disableInventoryShortcut: true,
})
const routeResult = await askWithProviderRouter(patchPrompt, 'auto', {
  purpose: 'patch',
  mode: 'patch',
  taskType: 'code_patch',
  disableInventoryShortcut: true,
})
const routePassed = routeResult.ok
  && routeResult.providerId !== 'bertos-router'
  && !/BertOS verified provider status/i.test(routeResult.text)
  && routeResult.inventoryShortcutUsed === false
  && routeResult.routerMode === 'patch'
  && routeResult.taskType === 'code_patch'

console.log(JSON.stringify({
  ok: failed.length === 0 && inventoryBypassed && routePassed,
  parser: results,
  router: {
    inventoryBypassed,
    routePassed,
    selectedProvider: routeResult.selectedProvider,
    providerId: routeResult.providerId,
    routerMode: routeResult.routerMode,
    taskType: routeResult.taskType,
    inventoryShortcutUsed: routeResult.inventoryShortcutUsed,
    rawLooksLikeInventory: /BertOS verified provider status/i.test(routeResult.text),
  },
}, null, 2))
if (failed.length > 0 || !inventoryBypassed || !routePassed) process.exit(1)
