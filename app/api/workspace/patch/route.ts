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

function isPatchProviderId(value: string): value is Exclude<AIModel, 'auto'> {
  return value === 'codex-cli' || value === 'claude-code' || value === 'ollama-pro' || value === 'gemini-cli'
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

function buildPatchPrompt(body: {
  task: string
  context: {
    repo?: unknown
    activeFile?: string
    activeContent?: string
    fileTree?: string[]
    gitStatus?: string
    terminalOutput?: string
    memories?: string[]
  }
}) {
  const context = body.context
  return [
    PATCH_COMPILER_INSTRUCTIONS,
    'Repository: standalone bertos-ai-os.',
    'Hard rules: never touch Sylistly, never edit outside repo, never expose secrets, never fake command output, never auto-push.',
    'Safety rules: do not edit .env files, lockfiles, .git, node_modules, generated build outputs, or files outside the repo.',
    `Task:\n${body.task}`,
    `Repo context:\n${JSON.stringify({
      repo: context.repo,
      activeFile: context.activeFile,
      gitStatus: context.gitStatus,
      fileTree: context.fileTree?.slice(0, 180),
      recentTerminalOutput: context.terminalOutput?.slice(-8000),
      memories: context.memories,
    }, null, 2)}`,
    context.activeFile && typeof context.activeContent === 'string'
      ? `Active file ${context.activeFile} content:\n${context.activeContent.slice(0, 45000)}`
      : 'No active file content is open.',
  ].join('\n\n')
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
  let body: {
    task?: string
    provider?: AIModel
    context?: {
      repo?: unknown
      activeFile?: string
      activeContent?: string
      fileTree?: string[]
      gitStatus?: string
      terminalOutput?: string
      memories?: string[]
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
  const prompt = buildPatchPrompt({
    task: body.task,
    context: body.context ?? {},
  })

  try {
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
        },
      }, { status: 500 })
    }

    const selectedProvider = isPatchProviderId(result.selectedProvider ?? result.providerId)
      ? (result.selectedProvider ?? result.providerId) as AIModel
      : requestedProvider
    const { payload, debug } = await parseWithRepair(result.text, selectedProvider, result.providerId)
    recordServerPatchParse(result.providerId, true)
    const providerName = result.providerName || result.providerId
    return NextResponse.json({
      ok: true,
      canonicalPatch: payload,
      proposal: canonicalToProposal(payload, providerName),
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
      debug,
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
      debug,
    }, { status: 500 })
  }
}
