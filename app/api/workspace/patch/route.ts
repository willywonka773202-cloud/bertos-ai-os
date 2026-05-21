import { NextRequest, NextResponse } from 'next/server'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'
import {
  PATCH_COMPILER_INSTRUCTIONS,
  cleanupPatchOutput,
  createParseAttempt,
  extractFirstJsonObject,
  getRawPatchOutputDiagnostics,
  parseCanonicalPatch,
  type CanonicalPatchPayload,
  type PatchParseDebug,
} from '@/lib/bertos/patch/schema'
import {
  getServerPatchQuarantinedProviders,
  recordServerPatchParse,
} from '@/lib/bertos/metrics/patch-reliability-server'
import {
  buildPatchProviderPayload,
  type PatchPayloadSerializationDebug,
} from '@/lib/bertos/patch/provider-payload'
import { getLocalDaemonBaseUrl, isLocalDaemonAvailableFromServer } from '@/lib/bertos/local-daemon'
import type { AIModel } from '@/lib/bertos/types'

export const runtime = 'nodejs'

type PatchOperation = 'modify' | 'create' | 'delete'

interface PatchFile {
  path: string
  operation: PatchOperation
  before?: string
  after?: string
}

interface PatchProposal {
  summary: string
  provider?: string
  files: PatchFile[]
  commandsToRun: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

interface ContextSearchHit {
  path: string
  matchedTerms: string[]
  snippets: Array<{
    term: string
    lines: Array<{ lineNumber: number; text: string }>
  }>
}

interface PerFileDebug {
  path: string
  status: 'included' | 'omitted' | 'chunked' | 'truncated'
  chars?: number
  originalChars?: number
  percentIncluded?: number
  isActive: boolean
  isForced: boolean
  isExplicit: boolean
  reason?: string
}

interface PatchContextPack {
  activeFile?: string
  searchTerms: string[]
  filesIncluded: string[]
  filesIncludedFull: string[]
  filesIncludedSnippetsOnly: string[]
  totalContextChars: number
  snippetsCount: number
  searchHits: ContextSearchHit[]
  packageScripts: Record<string, string>
  componentNames: string[]
  openTabs: Array<{ path: string; content: string }>
  fileContents: Array<{ path: string; content: string; inclusion: 'full' | 'snippet'; originalChars: number }>
  perFileDebug: PerFileDebug[]
  omittedPaths: string[]
  activeFileIncluded: boolean
}

const TOTAL_CONTEXT_CHAR_BUDGET = 140_000
const FULL_FILE_CHAR_LIMIT = 55_000
const SNIPPET_RADIUS = 45

function isPatchProviderId(value: string): value is Exclude<AIModel, 'auto'> {
  return value === 'codex-cli' || value === 'claude-code' || value === 'ollama-pro' || value === 'gemini-cli'
}

function deriveSearchTerms(task: string) {
  const quoted = Array.from(task.matchAll(/"([^"]{2,80})"/g)).map(match => match[1])
  const words = task
    .split(/[^A-Za-z0-9]+/)
    .map(word => word.trim())
    .filter(word => word.length >= 4)
  const titleCase = Array.from(task.matchAll(/\b[A-Z][A-Za-z0-9]{2,}\b/g)).map(match => match[0])
  const terms = [
    ...quoted,
    ...titleCase,
    ...words.slice(0, 16),
  ]

  if (/\bsave\b/i.test(task)) terms.push('Save button', 'Save', 'saved', 'Revert', 'Path', 'copyActivePath', 'saveActiveFile', 'Save current file', 'dirty ?')
  if (/\btooltip\b/i.test(task)) terms.push('title=', 'Tooltip', 'aria-label')
  if (/\bworkspace\b/i.test(task)) terms.push('WorkspaceView', 'Workspace')

  return [...new Set(terms)].slice(0, 24)
}

function extractComponentNames(content: string) {
  return [
    ...Array.from(content.matchAll(/\b(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)).map(match => match[1]),
    ...Array.from(content.matchAll(/\bexport\s+function\s+([A-Z][A-Za-z0-9_]*)/g)).map(match => match[1]),
  ].slice(0, 20)
}

function rankFileTreeCandidates(fileTree: string[] | undefined, searchTerms: string[]) {
  if (!Array.isArray(fileTree)) return []
  const normalizedTerms = searchTerms.map(term => term.toLowerCase()).filter(Boolean)
  return fileTree
    .filter(path => /\.(tsx?|jsx?|json|md|css)$/i.test(path))
    .map(path => {
      const lower = path.toLowerCase()
      let score = 0
      for (const term of normalizedTerms) {
        const simple = term.toLowerCase().replace(/[^a-z0-9_]+/g, '')
        if (simple && lower.includes(simple)) score += 4
      }
      if (/\bsave\b/i.test(searchTerms.join(' ')) && /workspaceview\.tsx$/i.test(path)) score += 10
      if (/workspaceview\.tsx$/i.test(path)) score += 3
      if (/components\/bertos/i.test(path)) score += 1
      return { path, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .map(item => item.path)
    .slice(0, 5)
}

function buildContentSearchHit(path: string, content: string, searchTerms: string[]): ContextSearchHit | undefined {
  const lines = content.split(/\r?\n/)
  const snippets = searchTerms.flatMap(term => {
    const normalized = term.trim()
    if (!normalized || normalized.length < 3) return []
    const lowerTerm = normalized.toLowerCase()
    const matchedLines = lines
      .map((text, index) => ({ lineNumber: index + 1, text }))
      .filter(line => line.text.toLowerCase().includes(lowerTerm))
      .slice(0, 4)
    return matchedLines.length ? [{ term: normalized, lines: matchedLines }] : []
  }).slice(0, 12)

  if (!snippets.length) return undefined
  return {
    path,
    matchedTerms: snippets.map(snippet => snippet.term),
    snippets,
  }
}

function buildSnippetContent(content: string, hit?: ContextSearchHit) {
  if (!hit) return content.slice(0, Math.min(content.length, 20_000))
  const lines = content.split(/\r?\n/)
  const lineNumbers = hit.snippets.flatMap(snippet => snippet.lines.map(line => line.lineNumber))
  if (lineNumbers.length === 0) return content.slice(0, Math.min(content.length, 20_000))
  const ranges = lineNumbers.map(lineNumber => ({
    start: Math.max(1, lineNumber - SNIPPET_RADIUS),
    end: Math.min(lines.length, lineNumber + SNIPPET_RADIUS),
  }))
  const merged: Array<{ start: number; end: number }> = []
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && range.start <= last.end + 5) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged.slice(0, 4).map(range => [
    `// snippet lines ${range.start}-${range.end}`,
    ...lines.slice(range.start - 1, range.end),
  ].join('\n')).join('\n\n// ...\n\n').slice(0, 45_000)
}

async function daemonJson(path: string, init?: RequestInit) {
  if (!isLocalDaemonAvailableFromServer()) return null
  try {
    const res = await fetch(`${getLocalDaemonBaseUrl()}${path}`, {
      ...init,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function readDaemonFile(path: string): Promise<string | null> {
  const data = await daemonJson(`/repo/file?path=${encodeURIComponent(path)}`)
  return typeof data?.content === 'string' ? data.content : null
}

async function buildContextPack(
  task: string,
  context: {
    activeFile?: string
    activeContent?: string
    openTabs?: Array<{ path?: string; content?: string }>
    fileTree?: string[]
  },
  options: {
    forceActiveFile?: boolean
    explicitIncludePaths?: string[]
  } = {}
) {
  const searchTerms = deriveSearchTerms(task)
  const searchData = await daemonJson('/repo/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      terms: searchTerms,
      globs: ['components/', 'app/', 'lib/'],
      maxResults: 20,
    }),
  }) as { results?: ContextSearchHit[] } | null
  const searchHits = searchData?.results ?? []
  const openTabs = (context.openTabs ?? [])
    .filter(tab => typeof tab.path === 'string' && typeof tab.content === 'string')
    .map(tab => ({ path: String(tab.path), content: String(tab.content).slice(0, 30000) }))
    .slice(0, 6)

  const topSearchPaths = searchHits.slice(0, 3).map(hit => hit.path)
  const fileTreePaths = rankFileTreeCandidates(context.fileTree, searchTerms)
  const explicitPaths = (options.explicitIncludePaths ?? []).filter(Boolean)

  const likelyPaths = Array.from(new Set([
    context.activeFile,
    ...explicitPaths,
    ...openTabs.map(tab => tab.path),
    ...topSearchPaths,
    ...fileTreePaths,
  ].filter((path): path is string => Boolean(path))))

  const perFileDebug: PerFileDebug[] = []
  const fileContents: PatchContextPack['fileContents'] = []
  let totalContextChars = 0
  const MAX_FILES = 10

  for (const path of likelyPaths) {
    const isActive = path === context.activeFile
    const isForced = isActive && Boolean(options.forceActiveFile)
    const isExplicit = explicitPaths.includes(path)

    if (fileContents.length >= MAX_FILES && !isForced) {
      perFileDebug.push({ path, status: 'omitted', isActive, isForced, isExplicit, reason: 'Exceeded max file limit' })
      continue
    }

    const open = openTabs.find(tab => tab.path === path)
    const content = open?.content
      ?? (path === context.activeFile ? context.activeContent : undefined)
      ?? await readDaemonFile(path)

    if (typeof content !== 'string') {
      perFileDebug.push({ path, status: 'omitted', isActive, isForced, isExplicit, reason: 'File not found or unreadable' })
      continue
    }

    const remainingBudget = TOTAL_CONTEXT_CHAR_BUDGET - totalContextChars
    if (remainingBudget <= 0 && !isForced) {
      perFileDebug.push({ path, status: 'omitted', isActive, isForced, isExplicit, reason: 'Context budget exhausted', chars: 0, originalChars: content.length })
      continue
    }

    const hit = searchHits.find(item => item.path === path) ?? buildContentSearchHit(path, content, searchTerms)
    const effectiveBudget = isForced
      ? Math.max(remainingBudget, Math.min(FULL_FILE_CHAR_LIMIT, Math.floor(TOTAL_CONTEXT_CHAR_BUDGET / 2)))
      : remainingBudget
    const canIncludeFull = content.length <= FULL_FILE_CHAR_LIMIT && content.length <= effectiveBudget
    const includedContent = canIncludeFull ? content : buildSnippetContent(content, hit)
    const finalContent = includedContent.slice(0, effectiveBudget)
    totalContextChars += finalContent.length

    fileContents.push({
      path,
      content: finalContent,
      inclusion: canIncludeFull ? 'full' : 'snippet',
      originalChars: content.length,
    })

    perFileDebug.push({
      path,
      status: !canIncludeFull ? 'chunked' : (finalContent.length < content.length ? 'truncated' : 'included'),
      chars: finalContent.length,
      originalChars: content.length,
      percentIncluded: Math.round((finalContent.length / Math.max(content.length, 1)) * 100),
      isActive,
      isForced,
      isExplicit,
    })
  }

  const packageJson = await readDaemonFile('package.json')
  let packageScripts: Record<string, string> = {}
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> }
      packageScripts = parsed.scripts ?? {}
    } catch {
      packageScripts = {}
    }
  }

  const omittedPaths = perFileDebug.filter(f => f.status === 'omitted').map(f => f.path)
  const activeFileIncluded = Boolean(context.activeFile && fileContents.some(f => f.path === context.activeFile))
  const componentNames = Array.from(new Set(fileContents.flatMap(file => extractComponentNames(file.content))))

  return {
    activeFile: context.activeFile,
    searchTerms,
    filesIncluded: fileContents.map(file => file.path),
    filesIncludedFull: fileContents.filter(file => file.inclusion === 'full').map(file => file.path),
    filesIncludedSnippetsOnly: fileContents.filter(file => file.inclusion === 'snippet').map(file => file.path),
    totalContextChars,
    snippetsCount: searchHits.reduce((count, hit) => count + hit.snippets.length, 0),
    searchHits,
    packageScripts,
    componentNames,
    openTabs,
    fileContents,
    perFileDebug,
    omittedPaths,
    activeFileIncluded,
  } satisfies PatchContextPack
}

function canonicalToProposal(payload: CanonicalPatchPayload, providerName?: string): PatchProposal {
  const hasDelete = payload.files.some(file => file.action === 'delete')
  const hasCreate = payload.files.some(file => file.action === 'create')
  return {
    summary: payload.summary,
    provider: providerName,
    files: payload.files.map(file => ({
      path: file.path,
      operation: file.action === 'update' ? 'modify' : file.action,
      after: file.action === 'delete' ? undefined : file.content,
    })),
    commandsToRun: payload.validation.commands.length ? payload.validation.commands : ['npm run typecheck', 'npm run build'],
    riskLevel: hasDelete ? 'high' : hasCreate ? 'medium' : 'low',
  }
}

function buildRepairPrompt(invalidOutput: string, parseError: string) {
  return [
    PATCH_COMPILER_INSTRUCTIONS,
    'Repair this invalid provider output into the exact canonical patch JSON schema.',
    `Parse error: ${parseError}`,
    'Preserve only safe, concrete file changes that are present in the invalid output.',
    'If no safe concrete patch exists, return {"summary":"No safe patch could be extracted.","files":[],"validation":{"commands":["npm run typecheck","npm run build"]}}',
    'Invalid output:',
    invalidOutput.slice(0, 50000),
  ].join('\n\n')
}

async function parseWithRepair(rawText: string, selectedProvider: AIModel, providerId?: string): Promise<{ payload: CanonicalPatchPayload; debug: PatchParseDebug }> {
  const debug: PatchParseDebug = {
    raw: rawText,
    rawDiagnostics: getRawPatchOutputDiagnostics(rawText),
    repairAttempts: [],
  }

  try {
    debug.extractedJsonCandidate = extractFirstJsonObject(rawText)
    const payload = parseCanonicalPatch(rawText)
    debug.normalized = payload
    debug.repairAttempts.push(createParseAttempt(0, rawText, true, undefined, providerId))
    return { payload, debug }
  } catch (error) {
    const parseError = error instanceof Error ? error.message : 'Patch JSON parse failed.'
    debug.parseError = parseError
    debug.repairAttempts.push(createParseAttempt(0, rawText, false, parseError, providerId))
  }

  const cleaned = cleanupPatchOutput(rawText)
  if (cleaned !== rawText.trim()) {
    try {
      debug.extractedJsonCandidate = extractFirstJsonObject(cleaned)
      const payload = parseCanonicalPatch(cleaned)
      debug.normalized = payload
      debug.parseError = undefined
      debug.repairAttempts.push(createParseAttempt(1, cleaned, true, undefined, 'local-cleanup', 'local-cleanup'))
      return { payload, debug }
    } catch (error) {
      const cleanupError = error instanceof Error ? error.message : 'Local cleanup did not produce valid JSON.'
      debug.parseError = cleanupError
      debug.repairAttempts.push(createParseAttempt(1, cleaned, false, cleanupError, 'local-cleanup', 'local-cleanup'))
    }
  }

  let currentRaw = rawText
  let lastError = debug.parseError ?? 'Patch JSON parse failed.'
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const repair = await askWithProviderRouter(buildRepairPrompt(currentRaw, lastError), selectedProvider, {
      purpose: 'patch',
      mode: 'patch',
      taskType: 'code_patch',
      disableInventoryShortcut: true,
      temperature: 0,
      maxTokens: 4096,
      deprioritizedProviders: getServerPatchQuarantinedProviders(),
    })
    if (!repair.ok) {
      const error = repair.error || 'Repair provider failed.'
      debug.repairAttempts.push(createParseAttempt(attempt + 1, repair.text, false, error, repair.providerId, 'repair'))
      lastError = error
      continue
    }

    currentRaw = repair.text
    try {
      debug.extractedJsonCandidate = extractFirstJsonObject(repair.text)
      const payload = parseCanonicalPatch(repair.text)
      debug.normalized = payload
      debug.parseError = undefined
      debug.repairAttempts.push(createParseAttempt(attempt + 1, repair.text, true, undefined, repair.providerId, 'repair'))
      return { payload, debug }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Repair output was invalid JSON.'
      debug.parseError = lastError
      debug.repairAttempts.push(createParseAttempt(attempt + 1, repair.text, false, lastError, repair.providerId, 'repair'))
    }
  }

  throw Object.assign(new Error(`Patch JSON parse failed after repair attempts: ${lastError}`), { debug })
}

export async function POST(req: NextRequest) {
  const started = Date.now()
  let body: {
    task?: string
    provider?: AIModel
    forceActiveFile?: boolean
    explicitIncludePaths?: string[]
    context?: {
      repo?: unknown
      activeFile?: string
      activeContent?: string
      fileTree?: string[]
      gitStatus?: string
      terminalOutput?: string
      memories?: string[]
      openTabs?: Array<{ path?: string; content?: string }>
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.task?.trim()) {
    return NextResponse.json({ ok: false, error: 'task is required.' }, { status: 400 })
  }

  const preferred = body.provider || 'auto'
  const requestedProvider = preferred !== 'auto' && isPatchProviderId(preferred) ? preferred : 'auto'
  const contextPack = await buildContextPack(body.task, body.context ?? {}, {
    forceActiveFile: Boolean(body.forceActiveFile),
    explicitIncludePaths: body.explicitIncludePaths ?? [],
  })
  let serializationDebug: PatchPayloadSerializationDebug | undefined

  try {
    const { prompt, serializedContextPayload, serialization } = buildPatchProviderPayload({
      compilerInstructions: PATCH_COMPILER_INSTRUCTIONS,
      task: body.task,
      contextPack,
      context: body.context ?? {},
    })
    serializationDebug = serialization
    console.info('[BertOS Patch] provider payload ready', {
      promptChars: serialization.promptChars,
      includedFileCount: serialization.includedFileCount,
      includedFilePaths: serialization.includedFilePaths,
      serializedContextPreview: serializedContextPayload.slice(0, 300),
      serializedPayloadPreview: serialization.serializedPayloadPreview,
      fileBodiesPresent: serialization.fileBodiesPresent,
      truncationWarnings: serialization.truncationWarnings,
    })

    const result = await askWithProviderRouter(prompt, requestedProvider, {
      purpose: 'patch',
      mode: 'patch',
      taskType: 'code_patch',
      disableInventoryShortcut: true,
      temperature: 0,
      maxTokens: 4096,
      deprioritizedProviders: getServerPatchQuarantinedProviders(),
    })
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'Provider failed.',
        durationMs: Date.now() - started,
        filesIncluded: contextPack.filesIncluded,
        filesOmitted: contextPack.omittedPaths,
        activeFileIncluded: contextPack.activeFileIncluded,
        routeDebug: {
          selectedProvider: result.selectedProvider ?? result.providerId,
          routerMode: result.routerMode ?? 'patch',
          taskType: result.taskType ?? 'code_patch',
          inventoryShortcutUsed: Boolean(result.inventoryShortcutUsed),
        },
        debug: {
          raw: result.text,
          rawDiagnostics: getRawPatchOutputDiagnostics(result.text),
          parseError: result.error || 'Provider failed before JSON parsing.',
          repairAttempts: [],
          context: contextPack,
          serialization: serializationDebug,
          perFile: contextPack.perFileDebug,
          omittedPaths: contextPack.omittedPaths,
          activeFileIncluded: contextPack.activeFileIncluded,
        },
      }, { status: 500 })
    }

    const selectedProvider = isPatchProviderId(result.selectedProvider ?? result.providerId)
      ? (result.selectedProvider ?? result.providerId) as AIModel
      : requestedProvider
    const { payload, debug } = await parseWithRepair(result.text, selectedProvider, result.providerId)
    recordServerPatchParse(result.providerId, true)
    const providerName = result.providerName || result.providerId
    const durationMs = Date.now() - started
    console.info('[BertOS Patch] success', {
      durationMs,
      filesIncluded: contextPack.filesIncluded,
      omittedPaths: contextPack.omittedPaths,
      activeFileIncluded: contextPack.activeFileIncluded,
    })
    return NextResponse.json({
      ok: true,
      canonicalPatch: payload,
      proposal: canonicalToProposal(payload, providerName),
      durationMs,
      filesIncluded: contextPack.filesIncluded,
      filesOmitted: contextPack.omittedPaths,
      activeFileIncluded: contextPack.activeFileIncluded,
      provider: {
        providerId: result.providerId,
        providerName: result.providerName,
        modelOrTool: result.modelOrTool,
        source: result.source,
        fallbackUsed: result.fallbackUsed,
        fallbackChain: result.fallbackChain,
        latencyMs: result.latencyMs,
      },
      routeDebug: {
        selectedProvider: result.selectedProvider ?? result.providerId,
        routerMode: result.routerMode ?? 'patch',
        taskType: result.taskType ?? 'code_patch',
        inventoryShortcutUsed: Boolean(result.inventoryShortcutUsed),
      },
      raw: result.text,
      debug: {
        ...debug,
        context: contextPack,
        serialization: serializationDebug,
        perFile: contextPack.perFileDebug,
        omittedPaths: contextPack.omittedPaths,
        activeFileIncluded: contextPack.activeFileIncluded,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const debug = typeof error === 'object' && error && 'debug' in error
      ? (error as { debug?: PatchParseDebug }).debug
      : undefined
    const failedProvider = debug?.repairAttempts.find(attempt => attempt.providerId && attempt.providerId !== 'local-cleanup')?.providerId
    recordServerPatchParse(failedProvider, false)
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not generate a patch.',
      durationMs: Date.now() - started,
      filesIncluded: contextPack.filesIncluded,
      filesOmitted: contextPack.omittedPaths,
      activeFileIncluded: contextPack.activeFileIncluded,
      debug: debug
        ? { ...debug, context: contextPack, serialization: serializationDebug, perFile: contextPack.perFileDebug, omittedPaths: contextPack.omittedPaths, activeFileIncluded: contextPack.activeFileIncluded }
        : { raw: '', rawDiagnostics: { byteLength: 0, charLength: 0, first500: '', last500: '' }, repairAttempts: [], context: contextPack, serialization: serializationDebug, perFile: contextPack.perFileDebug, omittedPaths: contextPack.omittedPaths, activeFileIncluded: contextPack.activeFileIncluded },
    }, { status: 500 })
  }
}
