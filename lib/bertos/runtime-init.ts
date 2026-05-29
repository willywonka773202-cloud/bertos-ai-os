import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ensureRuntimeDir, runtimePath } from './runtime-store'

const MEMORY_CORE_DIRS = [
  ['memory'],
  ['memory', 'core'],
  ['memory', 'client_profiles'],
  ['memory', 'daily_notes'],
  ['memory', 'agent_logs'],
  ['memory', 'workflow_history'],
  ['memory', 'proposals'],
  ['memory', 'approved'],
  ['memory', 'projects'],
] as const

export const BERTOS_RUNTIME_DIRS = [
  [],
  ['agents'],
  ['agents', 'runs'],
  ['agents', 'runs', 'logs'],
  ['agents', 'logs'],
  ...MEMORY_CORE_DIRS,
  ['skills'],
  ['skills', '_patches'],
  ['plugins'],
  ['workflows'],
  ['workflows', 'definitions'],
  ['workflows', 'runs'],
  ['outputs'],
  ['outputs', '_registry'],
  ['outputs', 'records'],
  ['outputs', 'clients'],
  ['outputs', 'previews'],
  ['outputs', 'projects'],
  ['outputs', 'projects', 'general'],
  ['projects'],
  ['logs'],
  ['prompts'],
  ['templates'],
  ['dashboard'],
  ['integrations'],
  ['automations'],
  ['studio'],
  ['studio', 'assets'],
  ['publishing'],
  ['publishing', 'queue'],
  ['grounding'],
  ['grounding', 'packs'],
] as const

const MEMORY_CORE_FILES = [
  ['memory', 'user_profile.md', '# User Profile\n\n'],
  ['memory', 'goals.md', '# Goals\n\n'],
  ['memory', 'active_projects.md', '# Active Projects\n\n'],
  ['memory', 'brand_voice.md', '# Brand Voice\n\n'],
  ['memory', 'preferences.md', '# Preferences\n\n'],
  ['memory', 'output_index.md', '# Output Index\n\n'],
] as const

const JSON_SEED_FILES = [
  ['agents', 'registry.json', []],
  ['plugins', 'registry.json', []],
  ['workflows', 'runs', 'runs.json', []],
  ['studio', 'assets.json', []],
  ['publishing', 'queue.json', []],
] as const

export interface BertOSRuntimeInitResult {
  root: string
  directories: string[]
}

export async function ensureBertOSRuntime(): Promise<BertOSRuntimeInitResult> {
  const directories: string[] = []

  for (const segments of BERTOS_RUNTIME_DIRS) {
    directories.push(await ensureRuntimeDir(...segments))
  }

  for (const [dir, fileName, content] of MEMORY_CORE_FILES) {
    await writeTextFileIfMissing(runtimePath(dir, fileName), content)
  }

  for (const seed of JSON_SEED_FILES) {
    const value = seed[seed.length - 1] as unknown
    const segments = seed.slice(0, -1) as string[]
    await writeTextFileIfMissing(runtimePath(...segments), `${JSON.stringify(value, null, 2)}\n`)
  }

  return {
    root: runtimePath(),
    directories,
  }
}

async function writeTextFileIfMissing(filePath: string, content: string) {
  try {
    await readFile(filePath, 'utf8')
  } catch {
    await ensureRuntimeDir(path.relative(runtimePath(), path.dirname(filePath)))
    await writeFile(filePath, content, 'utf8')
  }
}
