export type CanonicalPatchAction = 'create' | 'update' | 'delete'

export interface CanonicalPatchFile {
  path: string
  action: CanonicalPatchAction
  content: string
}

export interface CanonicalPatchPayload {
  summary: string
  files: CanonicalPatchFile[]
  validation: {
    commands: string[]
  }
}

export interface PatchParseAttempt {
  attempt: number
  providerId?: string
  stage?: 'initial' | 'local-cleanup' | 'repair'
  ok: boolean
  error?: string
  rawPreview: string
}

export interface RawPatchOutputDiagnostics {
  byteLength: number
  charLength: number
  first500: string
  last500: string
}

export interface PatchParseDebug {
  raw: string
  rawDiagnostics: RawPatchOutputDiagnostics
  extractedJsonCandidate?: string
  normalized?: CanonicalPatchPayload
  parseError?: string
  repairAttempts: PatchParseAttempt[]
}

export const PATCH_COMPILER_INSTRUCTIONS = [
  'You are a patch compiler.',
  'Return ONLY valid JSON.',
  'Do not use markdown.',
  'Do not explain changes.',
  'Do not include reasoning, analysis, chain of thought, or a plan.',
  'Do not wrap output in backticks.',
  'Do not include conversational text before or after the JSON.',
  'The JSON must match exactly:',
  '{"summary":string,"files":[{"path":string,"action":"create"|"update"|"delete","content":string}],"validation":{"commands":string[]}}',
  'For create and update, content must be the full final file content.',
  'For delete, content must be an empty string.',
  'If the task cannot be safely patched with the provided context, return an empty files array and explain the missing context in summary.',
].join('\n')

export const PATCH_BOUNDARY_START = 'BEGIN_PATCH_JSON'
export const PATCH_BOUNDARY_END = 'END_PATCH_JSON'

const MAX_PATCH_BYTES = 700_000
const MAX_FILE_BYTES = 250_000
const PROTECTED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])
const PROTECTED_PATH_PATTERNS = [
  /(^|[\\/])\.env(\.|$)/i,
  /(^|[\\/])config[\\/].*(secret|token|key|credential)/i,
  /(secret|token|credential|private-key|api-key)/i,
]

function preview(value: string) {
  return value.slice(0, 1200)
}

export function getRawPatchOutputDiagnostics(value: string): RawPatchOutputDiagnostics {
  return {
    byteLength: new TextEncoder().encode(value).byteLength,
    charLength: value.length,
    first500: value.slice(0, 500),
    last500: value.slice(Math.max(0, value.length - 500)),
  }
}

export function stripMarkdownFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

function normalizeSmartQuotes(value: string) {
  return value
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

function removeTrailingCommas(value: string) {
  let output = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (escaped) {
      output += char
      escaped = false
      continue
    }
    if (char === '\\') {
      output += char
      escaped = true
      continue
    }
    if (char === '"') inString = !inString
    if (!inString && char === ',') {
      const next = value.slice(i + 1).match(/^\s*([}\]])/)
      if (next) continue
    }
    output += char
  }
  return output
}

function extractBoundaryJson(text: string): string | null {
  const start = text.indexOf(PATCH_BOUNDARY_START)
  const end = text.indexOf(PATCH_BOUNDARY_END)
  if (start < 0 || end < 0 || end <= start) return null
  return text.slice(start + PATCH_BOUNDARY_START.length, end).trim()
}

export function cleanupPatchOutput(text: string) {
  return removeTrailingCommas(normalizeSmartQuotes(stripMarkdownFences(text)))
}

export function extractFirstJsonObject(text: string): string {
  const boundary = extractBoundaryJson(text)
  const source = cleanupPatchOutput(boundary ?? text)
  const start = source.indexOf('{')
  if (start < 0) throw new Error('No JSON object start "{" found in provider output.')

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') inString = !inString
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }

  throw new Error('Provider output contains a partial or truncated JSON object.')
}

function assertSafePatchPath(pathValue: unknown): string {
  if (typeof pathValue !== 'string' || !pathValue.trim()) throw new Error('Each patch file requires a non-empty path.')
  const normalized = pathValue.replace(/\\/g, '/').trim()
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) throw new Error(`${normalized} is absolute; patch paths must be repo-relative.`)
  if (normalized.split('/').some(part => part === '..')) throw new Error(`${normalized} contains path traversal.`)
  if (/(^|\/)(node_modules|\.git|\.next|dist|build|coverage|\.vercel)(\/|$)/i.test(normalized)) {
    throw new Error(`${normalized} targets an ignored or generated directory.`)
  }
  const basename = normalized.split('/').at(-1)?.toLowerCase() ?? ''
  if (PROTECTED_FILE_NAMES.has(basename)) throw new Error(`${normalized} is protected and cannot be patched.`)
  for (const pattern of PROTECTED_PATH_PATTERNS) {
    if (pattern.test(normalized)) throw new Error(`${normalized} is blocked by the secret/config safety policy.`)
  }
  return normalized
}

function looksBinary(value: string) {
  return value.includes('\u0000')
}

export function normalizeCanonicalPatch(value: unknown): CanonicalPatchPayload {
  const raw = value as {
    summary?: unknown
    files?: unknown
    validation?: { commands?: unknown }
    commandsToRun?: unknown
  }

  if (!raw || typeof raw !== 'object') throw new Error('Parsed JSON is not an object.')
  const filesInput = Array.isArray(raw.files) ? raw.files : []
  const seen = new Set<string>()
  const files = filesInput.map((item, index) => {
    const file = item as {
      path?: unknown
      action?: unknown
      operation?: unknown
      content?: unknown
      after?: unknown
    }
    const path = assertSafePatchPath(file.path)
    const actionValue = file.action ?? file.operation
    const action: CanonicalPatchAction =
      actionValue === 'create' ? 'create'
      : actionValue === 'update' || actionValue === 'modify' ? 'update'
      : actionValue === 'delete' ? 'delete'
      : (() => { throw new Error(`File ${index + 1} has malformed action "${String(actionValue)}".`) })()
    if (seen.has(path)) throw new Error(`Duplicate patch file entry for ${path}.`)
    seen.add(path)
    const contentValue = file.content ?? file.after ?? ''
    const content = action === 'delete' ? '' : String(contentValue)
    if (action !== 'delete' && typeof contentValue !== 'string') throw new Error(`${path} is missing string content.`)
    if (looksBinary(content)) throw new Error(`${path} appears to contain binary content.`)
    if (content.length > MAX_FILE_BYTES) throw new Error(`${path} exceeds the per-file patch size limit.`)
    return { path, action, content }
  })

  const payload: CanonicalPatchPayload = {
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : 'AI proposed workspace patch.',
    files,
    validation: {
      commands: Array.isArray(raw.validation?.commands)
        ? raw.validation.commands.filter((command): command is string => typeof command === 'string').slice(0, 8)
        : Array.isArray(raw.commandsToRun)
        ? raw.commandsToRun.filter((command): command is string => typeof command === 'string').slice(0, 8)
        : ['npm run typecheck', 'npm run build'],
    },
  }

  if (JSON.stringify(payload).length > MAX_PATCH_BYTES) throw new Error('Patch payload exceeds the total patch size limit.')
  return payload
}

export function parseCanonicalPatch(rawText: string): CanonicalPatchPayload {
  const json = extractFirstJsonObject(rawText)
  try {
    return normalizeCanonicalPatch(JSON.parse(json))
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Parsed patch JSON is invalid.')
  }
}

export function createParseAttempt(
  attempt: number,
  raw: string,
  ok: boolean,
  error?: string,
  providerId?: string,
  stage: PatchParseAttempt['stage'] = 'initial',
): PatchParseAttempt {
  return {
    attempt,
    providerId,
    stage,
    ok,
    error,
    rawPreview: preview(raw),
  }
}
