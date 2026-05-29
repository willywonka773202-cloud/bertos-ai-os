#!/usr/bin/env node
import Module from 'node:module'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

const {
  buildHermesMemoryHandoff,
  buildMemoryExport,
  buildMemoryPack,
  classifyMemorySensitivity,
} = loadTsModule('lib/bertos/memory-engine.ts')

const now = Date.now()
const projects = [
  {
    id: 'default',
    name: 'BertOS',
    description: 'AI engineering operating system',
    color: '#3B82F6',
    icon: 'B',
    createdAt: now,
    updatedAt: now,
    sessions: [],
    files: [],
    todos: [],
    pinned: true,
    context: 'Hermes should use structured, safe memory.',
  },
]

const items = [
  {
    id: 'constraint-1',
    kind: 'constraint',
    projectId: 'default',
    title: 'Never store secrets',
    content: 'Do not store API keys, tokens, passwords, cookies, private keys, or raw .env content.',
    source: 'human',
    confidence: 'confirmed',
    sensitivity: 'internal',
    tags: ['safety', 'memory'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'procedure-1',
    kind: 'procedural',
    title: 'Use tiered memory',
    content: 'Load core memory first, then project memory, then relevant retrieved memories.',
    source: 'human',
    confidence: 'confirmed',
    sensitivity: 'internal',
    tags: ['hermes', 'memory'],
    createdAt: now,
    updatedAt: now,
  },
]

const pack = buildMemoryPack({
  query: 'make hermes better with memory',
  projectId: 'default',
  projects,
  sessions: [],
  items,
  maxTokens: 1600,
})
const handoff = buildHermesMemoryHandoff(pack)
const exports = buildMemoryExport(items, projects)

console.log('BertOS memory engine smoke')
console.log(`selected=${pack.selectedItems.length}`)
console.log(`tokens=${pack.estimatedTokens}`)

assert(pack.selectedItems.length === 2, 'memory pack selects relevant memories')
assert(handoff.includes('MISSION: Ingest this BertOS memory pack'), 'handoff mission is present')
assert(handoff.includes('Never store secrets'), 'constraint memory appears in handoff')
assert(exports.soulMd.includes('Memory Update Rules'), 'soul.md export includes memory update rules')
assert(classifyMemorySensitivity('OPENAI_API_KEY=abc123', 'private') === 'secret-blocked', 'secret-like content is blocked')

if (process.exitCode === 1) process.exit(1)
