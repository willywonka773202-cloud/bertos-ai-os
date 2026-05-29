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
    if (specifier === './provider-payload') return loadTsModule('lib/bertos/patch/provider-payload.ts')
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
    if (specifier === './claude-cli' || specifier === './codex-cli' || specifier === './gemini-cli' || specifier === './gemini-native' || specifier === './hermes-nous' || specifier === './ollama-pro' || specifier === './openclaw-cli') {
      const providerId = specifier.replace('./', '')
      const normalizedProviderId = providerId === 'gemini-native'
        ? 'gemini-api-native'
        : providerId
      return {
        status: async () => ({
          ok: providerId === 'codex-cli',
          providerId: normalizedProviderId,
          providerName: providerId === 'gemini-native' ? 'Gemini Native API' : providerId,
          modelOrTool: providerId,
          online: providerId === 'codex-cli',
        }),
        ask: async () => ({
          ok: true,
          providerId: normalizedProviderId,
          providerName: providerId,
          modelOrTool: providerId,
          text: '{"summary":"ok","files":[],"validation":{"commands":[]}}',
          latencyMs: 1,
          source: providerId === 'ollama-pro' || providerId === 'hermes-nous' ? 'api' : 'daemon',
        }),
      }
    }
    return originalRequire(specifier)
  }

  mod._compile(output, filePath)
  return mod.exports
}

const { runPatchParserRegression } = loadTsModule('lib/bertos/patch/parser-regression.ts')
const { PATCH_COMPILER_INSTRUCTIONS } = loadTsModule('lib/bertos/patch/schema.ts')
const { buildPatchProviderPayload } = loadTsModule('lib/bertos/patch/provider-payload.ts')
const { askWithProviderRouter, shouldUseProviderInventoryShortcut } = loadTsModule('lib/bertos/providers/router.ts')
const results = runPatchParserRegression()
const failed = results.filter(result => !result.passed)
const workspaceContent = [
  'export function WorkspaceView() {',
  '  async function saveActiveFile() {',
  '    return "saved"',
  '  }',
  '  return <button onClick={saveActiveFile}>Save</button>',
  '}',
].join('\n')
const payloadTest = buildPatchProviderPayload({
  compilerInstructions: PATCH_COMPILER_INSTRUCTIONS,
  task: 'Add tooltip to Save button',
  context: {
    activeFile: 'components/bertos/workspace/WorkspaceView.tsx',
    activeContent: workspaceContent,
    fileTree: ['components/bertos/workspace/WorkspaceView.tsx'],
    gitStatus: '',
  },
  contextPack: {
    activeFile: 'components/bertos/workspace/WorkspaceView.tsx',
    searchTerms: ['Save button', 'Save', 'saveActiveFile'],
    filesIncluded: ['components/bertos/workspace/WorkspaceView.tsx'],
    filesIncludedFull: ['components/bertos/workspace/WorkspaceView.tsx'],
    filesIncludedSnippetsOnly: [],
    totalContextChars: workspaceContent.length,
    snippetsCount: 1,
    searchHits: [],
    packageScripts: { typecheck: 'next typegen && tsc --noEmit', build: 'next build' },
    componentNames: ['WorkspaceView'],
    fileContents: [{
      path: 'components/bertos/workspace/WorkspaceView.tsx',
      content: workspaceContent,
      inclusion: 'full',
      originalChars: workspaceContent.length,
    }],
  },
})
const payloadPassed = payloadTest.prompt.includes('=== FILE START: components/bertos/workspace/WorkspaceView.tsx ===')
  && payloadTest.prompt.includes('=== FILE END ===')
  && payloadTest.prompt.includes('saveActiveFile')
  && payloadTest.prompt.includes('Save</button>')
  && payloadTest.serialization.fileBodiesPresent
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
  ok: failed.length === 0 && inventoryBypassed && routePassed && payloadPassed,
  parser: results,
  providerPayload: {
    payloadPassed,
    promptChars: payloadTest.serialization.promptChars,
    includedFileCount: payloadTest.serialization.includedFileCount,
    includedFilePaths: payloadTest.serialization.includedFilePaths,
    fileBodiesPresent: payloadTest.serialization.fileBodiesPresent,
    containsSaveHandler: payloadTest.prompt.includes('saveActiveFile'),
  },
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
if (failed.length > 0 || !inventoryBypassed || !routePassed || !payloadPassed) process.exit(1)
