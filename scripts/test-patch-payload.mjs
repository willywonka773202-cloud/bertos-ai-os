#!/usr/bin/env node
import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const workspacePath = 'components/bertos/workspace/WorkspaceView.tsx'
const fullPath = path.join(root, workspacePath)

function loadTsModule(relativePath) {
  const filePath = path.join(root, relativePath)
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
  mod._compile(output, filePath)
  return mod.exports
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

if (!fs.existsSync(fullPath)) {
  console.error(`FAIL ${workspacePath} not found`)
  process.exit(1)
}

const content = fs.readFileSync(fullPath, 'utf8')
const { assembleContext, assertContextSerialization, serializeContextToPrompt } = loadTsModule('lib/bertos/context-engine.ts')
const snapshot = assembleContext({
  task: 'Add a tooltip to the Save button that says Save current file.',
  activeFile: workspacePath,
  activeContent: content,
  additionalFiles: [
    {
      path: 'package.json',
      content: fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    },
  ],
})
const prompt = serializeContextToPrompt(snapshot)
assertContextSerialization(snapshot, prompt)

console.log('BertOS patch payload smoke')
console.log(`file=${workspacePath}`)
console.log(`fileChars=${content.length}`)
console.log(`promptChars=${prompt.length}`)
console.log(`includedFiles=${snapshot.includedPaths.join(', ')}`)

assert(prompt.includes(`=== FILE START: ${workspacePath}`), 'FILE START marker is present')
assert(prompt.includes(`=== FILE END: ${workspacePath} ===`), 'FILE END marker is present')
assert(prompt.includes('saveActiveFile'), 'Workspace save handler is present in payload')
assert(prompt.includes('Save'), 'Save button context is present in payload')
assert(prompt.includes('bertos-workspace-tabs-v2'), 'WorkspaceView unique token is present in payload')
assert(prompt.length > 5000, 'payload is substantial and not empty')
assert(snapshot.includedPaths.includes(workspacePath), 'context snapshot includes WorkspaceView')
assert(snapshot.debug.includedCount >= 1, 'context debug reports included files')

if (process.exitCode === 1) process.exit(1)
