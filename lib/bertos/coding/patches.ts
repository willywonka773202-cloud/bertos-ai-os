import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { checksumFor, makeRuntimeId, nowIso } from '../runtime-store'
import { requireProject } from './projects'
import { Collection, codingPath } from './store'
import { isSensitivePath, resolveWithinRepo } from './safety'
import {
  approveAction,
  createApprovalRequest,
  getApprovalRequest,
  rejectAction,
} from './approvals'
import {
  CodingOSError,
  type CodingProject,
  type PatchApplyResult,
  type PatchBackupRecord,
  type PatchConflict,
  type PatchFileChange,
  type PatchProposal,
  type RiskLevel,
} from './types'

const patches = new Collection<PatchProposal & Record<string, unknown>>('patches.json', 'patchProposalId')

export interface CreatePatchInput {
  title: string
  description?: string
  reason?: string
  files: Array<{ path: string; action: 'create' | 'modify' | 'delete'; after?: string }>
  validationPlan?: string[]
  createdByAgentRunId?: string
  workflowRunId?: string
  sourceOutputId?: string
}

async function readFileSafe(abs: string): Promise<string | null> {
  try {
    return await readFile(abs, 'utf8')
  } catch {
    return null
  }
}

export async function createPatchProposal(projectId: string, input: CreatePatchInput): Promise<PatchProposal> {
  const project = await requireProject(projectId)
  const title = (input.title ?? '').trim()
  if (!title) throw new CodingOSError('invalid-input', 'Patch title is required.')
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new CodingOSError('invalid-input', 'A patch must change at least one file.')
  }

  const filesChanged: PatchFileChange[] = []
  for (const file of input.files) {
    const rel = (file.path ?? '').replace(/^\/+/, '')
    // Validate path safety up-front (throws on traversal / null bytes / escape).
    resolveWithinRepo(project.repoPath, rel)
    if (isSensitivePath(rel)) {
      throw new CodingOSError('blocked', `Refusing to patch sensitive file: ${rel}`)
    }
    if (file.action !== 'delete' && typeof file.after !== 'string') {
      throw new CodingOSError('invalid-input', `File ${rel} (${file.action}) requires 'after' content.`)
    }

    const abs = resolveWithinRepo(project.repoPath, rel)
    const current = await readFileSafe(abs)
    const baseExists = current !== null
    if (file.action === 'create' && baseExists) {
      throw new CodingOSError('conflict', `Cannot create ${rel}: file already exists. Use action 'modify'.`)
    }
    if (file.action !== 'create' && !baseExists) {
      throw new CodingOSError('conflict', `Cannot ${file.action} ${rel}: file does not exist.`)
    }
    filesChanged.push({
      path: rel,
      action: file.action,
      baseChecksum: baseExists ? checksumFor(current as string) : undefined,
      after: file.action === 'delete' ? undefined : file.after,
      baseExists,
      baseSizeBytes: baseExists ? Buffer.byteLength(current as string, 'utf8') : undefined,
    })
  }

  const riskLevel = computeRisk(filesChanged)
  const now = nowIso()
  const proposal: PatchProposal = {
    patchProposalId: makeRuntimeId('patch'),
    projectId,
    title,
    description: input.description?.trim() || undefined,
    reason: input.reason?.trim() || undefined,
    createdByAgentRunId: input.createdByAgentRunId,
    workflowRunId: input.workflowRunId,
    sourceOutputId: input.sourceOutputId,
    status: 'proposed',
    filesChanged,
    diff: renderUnifiedDiff(project, filesChanged),
    patchFormat: 'unified-full-file',
    riskLevel,
    approvalRequired: true,
    validationPlan: input.validationPlan?.length ? input.validationPlan : project.validationCommands,
    createdAt: now,
    updatedAt: now,
  }

  return patches.insert(proposal as PatchProposal & Record<string, unknown>)
}

export async function listPatchProposals(projectId?: string): Promise<PatchProposal[]> {
  const all = await patches.list()
  return projectId ? all.filter(patch => patch.projectId === projectId) : all
}

export async function getPatchProposal(patchProposalId: string): Promise<PatchProposal | null> {
  return patches.get(patchProposalId)
}

async function requirePatch(patchProposalId: string): Promise<PatchProposal> {
  const patch = await patches.get(patchProposalId)
  if (!patch) throw new CodingOSError('not-found', `Patch proposal not found: ${patchProposalId}`)
  return patch
}

export async function approvePatchProposal(patchProposalId: string, note?: string): Promise<PatchProposal> {
  const patch = await requirePatch(patchProposalId)
  if (patch.status === 'applied') throw new CodingOSError('conflict', 'Patch is already applied.')
  if (patch.status === 'rejected') throw new CodingOSError('conflict', 'Patch was rejected.')

  let approvalId = patch.approvalId
  if (!approvalId) {
    const approval = await createApprovalRequest({
      actionType: 'patch_apply',
      title: `Apply patch: ${patch.title}`,
      description: patch.description,
      projectId: patch.projectId,
      riskLevel: patch.riskLevel === 'high' ? 'high' : 'medium',
      payloadSummary: `${patch.filesChanged.length} file(s): ${patch.filesChanged.map(file => `${file.action} ${file.path}`).join(', ')}`,
      consequences: 'Writes the proposed content to real project files. Version-safe backups are created first.',
      rollbackPlan: 'Restore from the per-file backups recorded with this patch.',
      targetRef: patch.patchProposalId,
    })
    approvalId = approval.approvalId
  }
  await approveAction(approvalId, note).catch(() => undefined)

  return patches.update(patchProposalId, current => ({
    ...current,
    status: 'approved',
    approvalId,
    approvedAt: nowIso(),
    updatedAt: nowIso(),
  }))
}

export async function rejectPatchProposal(patchProposalId: string, note?: string): Promise<PatchProposal> {
  const patch = await requirePatch(patchProposalId)
  if (patch.status === 'applied') throw new CodingOSError('conflict', 'Patch is already applied.')
  if (patch.approvalId) {
    await rejectAction(patch.approvalId, note).catch(() => undefined)
  }
  return patches.update(patchProposalId, current => ({
    ...current,
    status: 'rejected',
    rejectedAt: nowIso(),
    updatedAt: nowIso(),
  }))
}

export async function checkPatchConflicts(patchProposalId: string): Promise<PatchConflict[]> {
  const patch = await requirePatch(patchProposalId)
  const project = await requireProject(patch.projectId)
  return detectConflicts(project, patch.filesChanged)
}

async function detectConflicts(project: CodingProject, files: PatchFileChange[]): Promise<PatchConflict[]> {
  const conflicts: PatchConflict[] = []
  for (const file of files) {
    const abs = resolveWithinRepo(project.repoPath, file.path)
    const current = await readFileSafe(abs)
    if (file.action === 'create') {
      if (current !== null) conflicts.push({ path: file.path, reason: 'File now exists; cannot create over it.' })
      continue
    }
    if (current === null) {
      conflicts.push({ path: file.path, reason: 'File no longer exists.' })
      continue
    }
    if (file.baseChecksum && checksumFor(current) !== file.baseChecksum) {
      conflicts.push({ path: file.path, reason: 'File changed since the patch was proposed.' })
    }
  }
  return conflicts
}

export interface ApplyPatchOptions {
  /** Acknowledge and override detected drift; baseline is refreshed to current content. */
  revalidate?: boolean
  /** Run the project's validation commands after applying. */
  runValidationAfter?: boolean
}

export async function applyPatchProposal(patchProposalId: string, options: ApplyPatchOptions = {}): Promise<PatchApplyResult> {
  const patch = await requirePatch(patchProposalId)
  const project = await requireProject(patch.projectId)

  // ── Approval gate — cannot be bypassed. ──
  if (patch.status === 'applied') {
    throw new CodingOSError('conflict', 'Patch has already been applied. Create a new proposal to re-apply.')
  }
  if (patch.status !== 'approved') {
    throw new CodingOSError('approval-required', 'Patch must be approved before it can be applied.')
  }
  if (patch.approvalId) {
    const approval = await getApprovalRequest(patch.approvalId)
    if (!approval || approval.status !== 'approved') {
      throw new CodingOSError('approval-required', 'Linked approval is not approved.')
    }
  }

  // ── Conflict detection. ──
  const conflicts = await detectConflicts(project, patch.filesChanged)
  if (conflicts.length && !options.revalidate) {
    return { ok: false, patch, conflicts, appliedFiles: [] }
  }

  // ── Apply each file with backups + checksums. ──
  const backupDir = codingPath('patches', patch.patchProposalId, 'backups')
  await mkdir(backupDir, { recursive: true })
  const backups: PatchBackupRecord[] = []
  const appliedFiles: string[] = []

  try {
    for (const file of patch.filesChanged) {
      const abs = resolveWithinRepo(project.repoPath, file.path)
      if (isSensitivePath(file.path)) {
        throw new CodingOSError('blocked', `Refusing to write sensitive file: ${file.path}`)
      }
      const before = await readFileSafe(abs)
      const backupRecord: PatchBackupRecord = {
        path: file.path,
        action: file.action,
        beforeChecksum: before !== null ? checksumFor(before) : undefined,
      }
      if (before !== null) {
        const backupPath = path.join(backupDir, `${file.path.replace(/[\\/]/g, '__')}.bak`)
        await writeFile(backupPath, before, 'utf8')
        backupRecord.backupPath = backupPath
      }

      if (file.action === 'delete') {
        await unlink(abs)
      } else {
        await mkdir(path.dirname(abs), { recursive: true })
        await writeFile(abs, file.after ?? '', 'utf8')
        backupRecord.afterChecksum = checksumFor(file.after ?? '')
      }
      backups.push(backupRecord)
      appliedFiles.push(file.path)
    }
  } catch (error) {
    await patches.update(patchProposalId, current => ({
      ...current,
      status: 'failed',
      errors: [...(current.errors ?? []), error instanceof Error ? error.message : 'Apply failed.'],
      backups,
      updatedAt: nowIso(),
    }))
    throw error
  }

  // ── Register an output artifact (patch application report). ──
  let outputId: string | undefined
  try {
    const { createOutputArtifact } = await import('../outputs/registry')
    const report = [
      `# Patch applied: ${patch.title}`,
      '',
      patch.description ?? '',
      '',
      '## Files',
      ...appliedFiles.map(file => `- ${file}`),
      '',
      '## Diff',
      '```diff',
      patch.diff.slice(0, 40_000),
      '```',
    ].join('\n')
    const artifact = await createOutputArtifact({
      type: 'patch_application_report',
      title: `Patch applied: ${patch.title}`,
      project: project.slug,
      tags: ['patch', 'coding-os'],
      status: 'ready',
      content: report,
      fileName: 'patch-application-report.md',
      sourceLinks: [`patch:${patch.patchProposalId}`],
    })
    outputId = artifact.outputId
  } catch {
    // output registry is best-effort
  }

  // ── Optional post-apply validation. ──
  let validationReportId: string | undefined
  if (options.runValidationAfter) {
    try {
      const { runValidation } = await import('./commands')
      const report = await runValidation(patch.projectId)
      validationReportId = report.validationReportId
    } catch {
      // validation failures are surfaced via the report, not thrown here
    }
  }

  const updated = await patches.update(patchProposalId, current => ({
    ...current,
    status: 'applied',
    appliedAt: nowIso(),
    backups,
    appliedOutputId: outputId,
    updatedAt: nowIso(),
  }))

  return { ok: true, patch: updated, conflicts: [], appliedFiles, outputId, validationReportId }
}

function computeRisk(files: PatchFileChange[]): RiskLevel {
  if (files.some(file => file.action === 'delete')) return 'high'
  if (files.some(file => file.action === 'create')) return 'medium'
  if (files.length > 8) return 'medium'
  return 'low'
}

/** Render a readable unified-style diff (LCS line diff per file). */
export function renderUnifiedDiff(project: CodingProject, files: PatchFileChange[]): string {
  const blocks: string[] = []
  for (const file of files) {
    blocks.push(`diff --git a/${file.path} b/${file.path}`)
    if (file.action === 'create') {
      blocks.push('new file')
      blocks.push(`--- /dev/null`)
      blocks.push(`+++ b/${file.path}`)
      for (const line of (file.after ?? '').split('\n')) blocks.push(`+${line}`)
    } else if (file.action === 'delete') {
      blocks.push('deleted file')
      blocks.push(`--- a/${file.path}`)
      blocks.push(`+++ /dev/null`)
    } else {
      blocks.push(`--- a/${file.path}`)
      blocks.push(`+++ b/${file.path}`)
      // We do not have the base content here (only its checksum); show new content
      // as additions framed by a context note. Full base-vs-after diffing happens in the UI
      // from live reads when previewing.
      blocks.push(`@@ full-file replacement @@`)
      for (const line of (file.after ?? '').split('\n')) blocks.push(`+${line}`)
    }
    blocks.push('')
  }
  return blocks.join('\n').trim()
}

/** Compute a proper LCS line diff between two strings (used by the live diff preview API). */
export function lineDiff(before: string, after: string): Array<{ type: 'context' | 'add' | 'del'; text: string }> {
  const a = before.split('\n')
  const b = after.split('\n')
  const m = a.length
  const n = b.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: Array<{ type: 'context' | 'add' | 'del'; text: string }> = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'context', text: a[i] })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i += 1
    } else {
      out.push({ type: 'add', text: b[j] })
      j += 1
    }
  }
  while (i < m) { out.push({ type: 'del', text: a[i] }); i += 1 }
  while (j < n) { out.push({ type: 'add', text: b[j] }); j += 1 }
  return out
}
