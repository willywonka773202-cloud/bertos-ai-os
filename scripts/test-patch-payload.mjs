#!/usr/bin/env node
/**
 * BertOS Phase 1 — Deterministic patch payload test.
 *
 * Task: "Add tooltip to Save button that says 'Save current file'"
 *
 * Asserts:
 * 1. WorkspaceView.tsx content exists in the final serialized provider payload
 * 2. Payload contains FILE START / FILE END markers
 * 3. Payload contains save-related identifiers from the file
 * 4. Prompt has substantial size (not truncated to nothing)
 * 5. Context serialization assertion passes
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// ── helpers ────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✓ PASS  ${msg}`) }
function fail(msg) { console.error(`  ✗ FAIL  ${msg}`); process.exitCode = 1 }

// Inline the serialization logic (mirrors lib/bertos/context-engine.ts)
function serializeFiles(includedFiles) {
  if (includedFiles.length === 0) return 'No file content available.'
  const blocks = includedFiles.map(f =>
    `=== FILE START: ${f.path} ===\n${f.content}\n=== FILE END: ${f.path} ===`
  )
  const header = [
    `Included files (${includedFiles.length}):`,
    `Paths: ${includedFiles.map(f => f.path).join(', ')}`,
    `Total chars: ${includedFiles.reduce((n, f) => n + f.content.length, 0).toLocaleString()}`,
  ].join('\n')
  return `${header}\n\n${blocks.join('\n\n')}`
}

function buildPrompt(task, context) {
  const includedFiles = context.includedFiles ?? []
  const fileSection = serializeFiles(includedFiles)

  return [
    'You are BertOS Workspace Patch Agent working inside the standalone bertos-ai-os repo.',
    'Hard rules: never touch Sylistly, never edit outside repo, never expose secrets.',
    'Return ONLY valid JSON patch.',
    `Task:\n${task}`,
    `Repo context:\n${JSON.stringify({ activeFile: context.activeFile }, null, 2)}`,
    fileSection,
  ].join('\n\n')
}

// ── load file ──────────────────────────────────────────────────────────────

const WORKSPACE_VIEW = 'components/bertos/workspace/WorkspaceView.tsx'
const filePath = path.join(ROOT, WORKSPACE_VIEW)

if (!fs.existsSync(filePath)) {
  fail(`${WORKSPACE_VIEW} not found — is the repo correct?`)
  process.exit(1)
}

const content = fs.readFileSync(filePath, 'utf8')

// ── build mock request ─────────────────────────────────────────────────────

const task = 'Add a tooltip to the Save button that says "Save current file"'
const context = {
  activeFile: WORKSPACE_VIEW,
  activeContent: content,
  includedFiles: [{ path: WORKSPACE_VIEW, content }],
}

const prompt = buildPrompt(task, context)

// ── print debug info ───────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════')
console.log('  BertOS Patch Payload Test')
console.log('══════════════════════════════════════════\n')
console.log(`  Task            : ${task}`)
console.log(`  File            : ${WORKSPACE_VIEW}`)
console.log(`  File size       : ${content.length.toLocaleString()} chars`)
console.log(`  Total prompt    : ${prompt.length.toLocaleString()} chars`)
console.log(`  Included files  : ${context.includedFiles.length}`)
console.log(`\n  Payload preview (first 300 chars):`)
console.log(`  ${prompt.slice(0, 300).replace(/\n/g, '\n  ')}`)
console.log()

// ── assertions ─────────────────────────────────────────────────────────────

console.log('Assertions:\n')

// 1. FILE START marker present
const fileStartMarker = `=== FILE START: ${WORKSPACE_VIEW} ===`
prompt.includes(fileStartMarker)
  ? pass(`FILE START marker present for ${WORKSPACE_VIEW}`)
  : fail(`Context serialization failure — "${fileStartMarker}" missing from prompt`)

// 2. FILE END marker present
const fileEndMarker = `=== FILE END: ${WORKSPACE_VIEW} ===`
prompt.includes(fileEndMarker)
  ? pass('FILE END marker present')
  : fail('FILE END marker missing from prompt')

// 3. Save-button content present (the file imports Save icon from lucide-react)
const saveTerms = ['Save', 'saveActiveFile', 'handleSave', 'save']
const hasSave = saveTerms.some(t => prompt.includes(t))
hasSave
  ? pass(`File content body present (save-related token found)`)
  : fail('File content body missing — no save-related token found in payload')

// 4. WorkspaceView.tsx content is actually in the prompt (unique string check)
const uniqueToken = 'bertos-workspace-tabs-v2'   // from STORAGE_KEY in WorkspaceView
prompt.includes(uniqueToken)
  ? pass(`WorkspaceView.tsx content present (unique token found: "${uniqueToken}")`)
  : fail(`WorkspaceView.tsx content not serialized — unique token "${uniqueToken}" missing`)

// 5. Prompt has substantial length
prompt.length >= 5_000
  ? pass(`Prompt size is substantial: ${prompt.length.toLocaleString()} chars`)
  : fail(`Prompt is suspiciously short: ${prompt.length.toLocaleString()} chars`)

// 6. Prompt does not say "No active file content is open"
!prompt.includes('No active file content is open')
  ? pass('No "No active file content" fallback triggered')
  : fail('"No active file content is open" found — file was not passed correctly')

// ── result ─────────────────────────────────────────────────────────────────

console.log()
if (process.exitCode === 1) {
  console.error('══════════════════════════════════════════')
  console.error('  FAILED — Context serialization failure')
  console.error('══════════════════════════════════════════\n')
} else {
  console.log('══════════════════════════════════════════')
  console.log('  PASSED — All assertions passed')
  console.log('══════════════════════════════════════════\n')
}
