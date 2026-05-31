import { stat } from 'node:fs/promises'
import path from 'node:path'
import { makeRuntimeId, nowIso, readJsonFile, slugify, writeJsonFile } from '../runtime-store'
import { Collection, codingPath } from './store'
import { CodingOSError, type CodingProject, type ProjectHealthSummary, type ProjectStatus } from './types'
import { isSensitivePath } from './safety'

const projects = new Collection<CodingProject & Record<string, unknown>>('projects.json', 'projectId')
const ACTIVE_FILE = codingPath('active.json')

const DEFAULT_VALIDATION = ['npm run typecheck']
const DEFAULT_IMPORTANT = ['package.json', 'README.md', 'tsconfig.json']

export interface CreateProjectInput {
  name: string
  repoPath: string
  description?: string
  repoUrl?: string
  defaultBranch?: string
  tags?: string[]
  client?: string
  validationCommands?: string[]
  allowedCommands?: string[]
  blockedCommands?: string[]
  importantPaths?: string[]
  ignoredPaths?: string[]
  notes?: string
  favorite?: boolean
  localOnly?: boolean
}

export async function verifyProjectPath(repoPath: string): Promise<{ ok: boolean; reason?: string; resolved: string }> {
  const raw = (repoPath ?? '').trim()
  if (!raw) return { ok: false, reason: 'A repository path is required.', resolved: '' }
  if (raw.includes('\0')) return { ok: false, reason: 'Path contains null bytes.', resolved: raw }
  const resolved = path.resolve(raw)
  if (isSensitivePath(resolved)) {
    return { ok: false, reason: 'That path points at sensitive/credential material and is blocked.', resolved }
  }
  try {
    const info = await stat(resolved)
    if (!info.isDirectory()) return { ok: false, reason: 'Path is not a directory.', resolved }
    return { ok: true, resolved }
  } catch {
    return { ok: false, reason: 'Path does not exist or is not accessible.', resolved }
  }
}

export async function createProject(input: CreateProjectInput): Promise<CodingProject> {
  const name = (input.name ?? '').trim()
  if (!name) throw new CodingOSError('invalid-input', 'Project name is required.')

  const verification = await verifyProjectPath(input.repoPath)
  if (!verification.ok) {
    throw new CodingOSError('invalid-input', verification.reason ?? 'Invalid repository path.')
  }

  const existing = await projects.all()
  const baseSlug = slugify(name)
  let slug = baseSlug
  let counter = 2
  while (existing.some(project => project.slug === slug)) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }

  if (existing.some(project => path.resolve(project.repoPath) === verification.resolved)) {
    throw new CodingOSError('conflict', 'A project is already registered for that repository path.')
  }

  const now = nowIso()
  const project: CodingProject = {
    projectId: makeRuntimeId('proj'),
    name,
    slug,
    description: input.description?.trim() || undefined,
    repoPath: verification.resolved,
    repoUrl: input.repoUrl?.trim() || undefined,
    defaultBranch: input.defaultBranch?.trim() || undefined,
    status: 'active',
    tags: normalizeStringList(input.tags),
    client: input.client?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    memoryScope: `project:${slug}`,
    outputScope: `project:${slug}`,
    allowedCommands: normalizeStringList(input.allowedCommands),
    blockedCommands: normalizeStringList(input.blockedCommands),
    validationCommands: normalizeStringList(input.validationCommands).length
      ? normalizeStringList(input.validationCommands)
      : [...DEFAULT_VALIDATION],
    importantPaths: normalizeStringList(input.importantPaths).length
      ? normalizeStringList(input.importantPaths)
      : [...DEFAULT_IMPORTANT],
    ignoredPaths: normalizeStringList(input.ignoredPaths),
    notes: input.notes?.trim() || undefined,
    favorite: Boolean(input.favorite),
    localOnly: input.localOnly ?? true,
  }

  await projects.insert(project as CodingProject & Record<string, unknown>)
  // First project becomes active automatically.
  const active = await getActiveProjectId()
  if (!active) await setActiveProject(project.projectId)
  return project
}

/**
 * Make the coding OS "never empty": if no projects are registered yet, auto-register
 * the directory BertOS is running in as the first project so the cockpit, assistant,
 * and runs all have real context to work with on first launch. Returns the active
 * (or newly seeded) project, or null if seeding isn't possible/appropriate.
 *
 * Skipped on ephemeral hosted deploys (Vercel) where the filesystem resets each cold
 * start, and can be disabled with BERTOS_NO_AUTOSEED=true. Best-effort and idempotent.
 */
export async function ensureDefaultProject(): Promise<CodingProject | null> {
  const existing = await projects.all()
  if (existing.length > 0) return getActiveProject()
  if (process.env.VERCEL || process.env.BERTOS_NO_AUTOSEED === 'true') return null

  const cwd = process.cwd()
  const verification = await verifyProjectPath(cwd)
  if (!verification.ok) return null

  try {
    const name = path.basename(verification.resolved) || 'My Workspace'
    return await createProject({
      name,
      repoPath: cwd,
      description: 'Auto-registered workspace — the directory BertOS is running in. Register your own projects anytime in the Cockpit.',
      tags: ['auto-seeded'],
    })
  } catch {
    // A race or conflict means a project now exists; fall back to whatever is active.
    return getActiveProject()
  }
}

export async function listProjects(includeArchived = false): Promise<CodingProject[]> {
  const all = await projects.list()
  const filtered = includeArchived ? all : all.filter(project => project.status !== 'archived')
  return filtered.sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt)
  })
}

export async function getProject(projectId: string): Promise<CodingProject | null> {
  return projects.get(projectId)
}

export async function requireProject(projectId: string): Promise<CodingProject> {
  const project = await getProject(projectId)
  if (!project) throw new CodingOSError('not-found', `Project not found: ${projectId}`)
  return project
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  repoUrl?: string
  defaultBranch?: string
  status?: ProjectStatus
  tags?: string[]
  client?: string
  validationCommands?: string[]
  allowedCommands?: string[]
  blockedCommands?: string[]
  importantPaths?: string[]
  ignoredPaths?: string[]
  notes?: string
  favorite?: boolean
  lastOpenedAt?: string
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<CodingProject> {
  await requireProject(projectId)
  return projects.update(projectId, current => ({
    ...current,
    name: input.name?.trim() || current.name,
    description: input.description === undefined ? current.description : input.description.trim() || undefined,
    repoUrl: input.repoUrl === undefined ? current.repoUrl : input.repoUrl.trim() || undefined,
    defaultBranch: input.defaultBranch === undefined ? current.defaultBranch : input.defaultBranch.trim() || undefined,
    status: input.status ?? current.status,
    tags: input.tags === undefined ? current.tags : normalizeStringList(input.tags),
    client: input.client === undefined ? current.client : input.client.trim() || undefined,
    validationCommands: input.validationCommands === undefined ? current.validationCommands : normalizeStringList(input.validationCommands),
    allowedCommands: input.allowedCommands === undefined ? current.allowedCommands : normalizeStringList(input.allowedCommands),
    blockedCommands: input.blockedCommands === undefined ? current.blockedCommands : normalizeStringList(input.blockedCommands),
    importantPaths: input.importantPaths === undefined ? current.importantPaths : normalizeStringList(input.importantPaths),
    ignoredPaths: input.ignoredPaths === undefined ? current.ignoredPaths : normalizeStringList(input.ignoredPaths),
    notes: input.notes === undefined ? current.notes : input.notes.trim() || undefined,
    favorite: input.favorite === undefined ? current.favorite : input.favorite,
    lastOpenedAt: input.lastOpenedAt ?? current.lastOpenedAt,
    updatedAt: nowIso(),
  }))
}

export async function archiveProject(projectId: string): Promise<CodingProject> {
  return updateProject(projectId, { status: 'archived' })
}

// ── Active project ───────────────────────────────────────────────────────────

async function getActiveProjectId(): Promise<string | null> {
  const state = await readJsonFile<{ activeProjectId: string | null }>(ACTIVE_FILE, { activeProjectId: null })
  return state.activeProjectId
}

export async function setActiveProject(projectId: string): Promise<CodingProject> {
  const project = await requireProject(projectId)
  await writeJsonFile(ACTIVE_FILE, { activeProjectId: projectId, updatedAt: nowIso() })
  await updateProject(projectId, { lastOpenedAt: nowIso() })
  return project
}

export async function getActiveProject(): Promise<CodingProject | null> {
  const id = await getActiveProjectId()
  if (!id) return null
  const project = await getProject(id)
  return project && project.status !== 'archived' ? project : null
}

// ── Health summary ───────────────────────────────────────────────────────────

export async function getProjectHealthSummary(projectId: string): Promise<ProjectHealthSummary> {
  const project = await requireProject(projectId)
  const warnings: string[] = []
  const verification = await verifyProjectPath(project.repoPath)

  const summary: ProjectHealthSummary = {
    projectId,
    pathExists: verification.ok,
    isGitRepo: false,
    openTasks: 0,
    pendingApprovals: 0,
    pendingPatches: 0,
    techStack: [],
    importantFiles: [],
    warnings,
    checkedAt: nowIso(),
  }

  if (!verification.ok) {
    warnings.push(verification.reason ?? 'Project path is not accessible.')
    return summary
  }

  // Lazy imports avoid circular deps at module load.
  const [{ getGitStatus, isGitRepo }, { detectTechStack, detectImportantFiles }, tasks, approvals, patches, validation] = await Promise.all([
    import('./git'),
    import('./files'),
    import('./tasks'),
    import('./approvals'),
    import('./patches'),
    import('./commands'),
  ])

  summary.isGitRepo = await isGitRepo(project.repoPath)
  if (summary.isGitRepo) {
    try {
      const status = await getGitStatus(projectId)
      summary.branch = status.branch
      summary.clean = status.clean
      summary.changedFiles = status.changedFiles.length + status.untrackedFiles.length
      summary.ahead = status.ahead
      summary.behind = status.behind
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Could not read git status.')
    }
  }

  try {
    summary.techStack = await detectTechStack(project.repoPath)
    summary.importantFiles = await detectImportantFiles(project)
  } catch {
    warnings.push('Could not inspect project structure.')
  }

  const [openTasks, pendingApprovals, pendingPatches, lastValidation] = await Promise.all([
    tasks.listCodingTasks({ projectId }).then(items => items.filter(task => !['done', 'archived'].includes(task.status)).length).catch(() => 0),
    approvals.listApprovalRequests({ projectId, status: 'pending' }).then(items => items.length).catch(() => 0),
    patches.listPatchProposals(projectId).then(items => items.filter(patch => ['draft', 'proposed', 'approved'].includes(patch.status)).length).catch(() => 0),
    validation.getLatestValidationReport(projectId).catch(() => null),
  ])

  summary.openTasks = openTasks
  summary.pendingApprovals = pendingApprovals
  summary.pendingPatches = pendingPatches
  if (lastValidation) {
    summary.lastValidationStatus = lastValidation.status
    summary.lastValidationAt = lastValidation.completedAt ?? lastValidation.startedAt
  }

  return summary
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string') {
      return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean).slice(0, 64)
    }
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const text = String(item).trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result.slice(0, 64)
}
