import { NextRequest, NextResponse } from 'next/server'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'
import { assembleContext, serializeContextToPrompt, assertContextSerialization } from '@/lib/bertos/context-engine'
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

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] ?? text
  const start = source.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') inString = !inString
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

function normalizeProposal(value: unknown): PatchProposal {
  const raw = value as Partial<PatchProposal>
  const files = Array.isArray(raw.files)
    ? raw.files
        .map(file => file as PatchFile)
        .filter(file =>
          typeof file.path === 'string' &&
          ['modify', 'create', 'delete'].includes(file.operation) &&
          (file.operation === 'delete' || typeof file.after === 'string')
        )
    : []

  return {
    summary: typeof raw.summary === 'string' ? raw.summary : 'AI proposed workspace patch.',
    provider: typeof raw.provider === 'string' ? raw.provider : undefined,
    files,
    commandsToRun: Array.isArray(raw.commandsToRun)
      ? raw.commandsToRun.filter(c => typeof c === 'string').slice(0, 6)
      : ['npm run typecheck', 'npm run build'],
    riskLevel: raw.riskLevel === 'high' || raw.riskLevel === 'medium' || raw.riskLevel === 'low'
      ? raw.riskLevel
      : 'medium',
  }
}

async function parseOrRepair(rawText: string, preferred: AIModel): Promise<PatchProposal> {
  const json = extractJsonObject(rawText)
  if (json) return normalizeProposal(JSON.parse(json))

  const repair = await askWithProviderRouter(
    [
      'Repair the following response into ONLY valid JSON for this TypeScript shape:',
      '{ "summary": string, "files": [{ "path": string, "operation": "modify"|"create"|"delete", "before"?: string, "after"?: string }], "commandsToRun": string[], "riskLevel": "low"|"medium"|"high" }',
      'Do not add markdown. Do not invent files. If no valid patch exists, return files: [].',
      rawText,
    ].join('\n\n'),
    preferred
  )

  const repairedJson = extractJsonObject(repair.text)
  if (!repairedJson) throw new Error('AI did not return valid patch JSON.')
  return normalizeProposal(JSON.parse(repairedJson))
}

export async function POST(req: NextRequest) {
  let body: {
    task?: string
    provider?: AIModel
    forceActiveFile?: boolean
    context?: {
      repo?: unknown
      activeFile?: string
      activeContent?: string
      includedFiles?: Array<{ path: string; content: string }>
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
  const context = body.context ?? {}

  const t0 = Date.now()
  // Assemble context with file serialization
  const ctxSnapshot = assembleContext({
    task: body.task,
    activeFile: context.activeFile,
    activeContent: context.activeContent,
    additionalFiles: context.includedFiles ?? [],
    maxTotalChars: 80_000,
    maxPerFileChars: 40_000,
    priorityFilePath: context.activeFile,
  })
  const assembleMs = Date.now() - t0

  const fileSection = serializeContextToPrompt(ctxSnapshot)

  // Assertion: verify all included files made it into the serialized output
  try {
    assertContextSerialization(ctxSnapshot, fileSection)
  } catch (assertErr) {
    const msg = assertErr instanceof Error ? assertErr.message : String(assertErr)
    console.error(`[BertOS Patch] ASSERTION FAILED: ${msg}`)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const prompt = [
    'You are BertOS Workspace Patch Agent working inside the standalone bertos-ai-os repo.',
    'Hard rules: never touch Sylistly, never edit outside repo, never expose secrets, never fake command output.',
    'Return ONLY valid JSON with this exact shape:',
    '{ "summary": string, "provider": string, "files": [{ "path": string, "operation": "modify"|"create"|"delete", "before"?: string, "after"?: string }], "commandsToRun": string[], "riskLevel": "low"|"medium"|"high" }',
    'For modify/create, "after" must be the full final file content, not a prose description. Prefer a small focused patch. If the task needs more context, return files: [] and explain in summary.',
    `Task:\n${body.task}`,
    `Repo context:\n${JSON.stringify({
      repo: context.repo,
      activeFile: context.activeFile,
      gitStatus: context.gitStatus,
      fileTree: context.fileTree?.slice(0, 180),
      recentTerminalOutput: context.terminalOutput?.slice(-8000),
      memories: context.memories,
    }, null, 2)}`,
    fileSection,
  ].join('\n\n')

  // Debug logging (server-side only)
  console.error('[BertOS Patch] === Payload Debug ===')
  console.error(`  assembleContext: ${assembleMs}ms`)
  console.error(`  Total prompt chars: ${prompt.length.toLocaleString()}`)
  console.error(`  Context total chars: ${ctxSnapshot.totalChars.toLocaleString()} / 80,000 budget`)
  console.error(`  Included files: ${ctxSnapshot.debug.includedCount} / ${ctxSnapshot.debug.fileCount}`)
  console.error(`  Included paths: ${ctxSnapshot.includedPaths.join(', ') || '(none)'}`)
  console.error(`  Omitted paths: ${ctxSnapshot.omittedPaths.join(', ') || '(none)'}`)
  for (const pf of ctxSnapshot.debug.perFile) {
    const status = pf.included
      ? `OK  score=${pf.matchScore} chars=${pf.includedChars.toLocaleString()}/${pf.originalChars.toLocaleString()}${pf.chunked ? ' [chunked]' : pf.truncated ? ' [truncated]' : ''}`
      : `OMIT reason="${pf.omittedReason ?? 'budget'}"`
    console.error(`    ${pf.path}: ${status}`)
  }
  if (ctxSnapshot.truncationWarnings.length > 0) {
    console.error(`  TRUNCATION WARNINGS: ${ctxSnapshot.truncationWarnings.join(' | ')}`)
  }
  if (prompt.length > 100_000) {
    console.error(`  WARNING: Prompt is very large (${prompt.length.toLocaleString()} chars) — may exceed provider context window`)
  }

  try {
    const result = await askWithProviderRouter(prompt, preferred)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Provider failed.' }, { status: 500 })
    }

    const proposal = await parseOrRepair(result.text, preferred)
    return NextResponse.json({
      ok: true,
      proposal: {
        ...proposal,
        provider: proposal.provider || result.providerName || result.providerId,
      },
      provider: {
        providerId: result.providerId,
        providerName: result.providerName,
        modelOrTool: result.modelOrTool,
        source: result.source,
        fallbackUsed: result.fallbackUsed,
        fallbackChain: result.fallbackChain,
        latencyMs: result.latencyMs,
      },
      raw: result.text,
      contextDebug: {
        includedFiles: ctxSnapshot.debug.includedCount,
        omittedFiles: ctxSnapshot.debug.omittedCount,
        totalChars: ctxSnapshot.totalChars,
        includedPaths: ctxSnapshot.includedPaths,
        omittedPaths: ctxSnapshot.omittedPaths,
        truncationWarnings: ctxSnapshot.truncationWarnings,
        promptSize: prompt.length,
        assembleMs,
        perFile: ctxSnapshot.debug.perFile,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not generate a patch.',
    }, { status: 500 })
  }
}
