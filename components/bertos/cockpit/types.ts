// Client-side mirrors of the Coding OS API shapes (kept loose for resilience).
export interface CockpitProject {
  projectId: string
  name: string
  slug: string
  description?: string
  repoPath: string
  status: string
  tags: string[]
  favorite: boolean
  validationCommands: string[]
  importantPaths: string[]
  lastOpenedAt?: string
}

export interface CockpitHealth {
  pathExists: boolean
  isGitRepo: boolean
  branch?: string
  clean?: boolean
  changedFiles?: number
  ahead?: number
  behind?: number
  lastValidationStatus?: string
  openTasks: number
  pendingApprovals: number
  pendingPatches: number
  techStack: string[]
  importantFiles: string[]
  warnings: string[]
}

export interface CockpitGit {
  branch: string
  ahead: number
  behind: number
  clean: boolean
  changedFiles: string[]
  untrackedFiles: string[]
  stagedFiles: string[]
  diffStat: string
}

export interface CockpitCommit {
  shortHash: string
  subject: string
  author: string
  date: string
}

export interface CockpitPatchFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  after?: string
}

export interface CockpitPatch {
  patchProposalId: string
  projectId: string
  title: string
  description?: string
  status: string
  riskLevel: string
  filesChanged: CockpitPatchFile[]
  diff: string
  validationPlan: string[]
  createdAt: string
  appliedOutputId?: string
}

export interface CockpitApproval {
  approvalId: string
  actionType: string
  title: string
  riskLevel: string
  status: string
  payloadSummary?: string
  consequences?: string
  requestedAt: string
  projectId?: string
}

export interface CockpitTask {
  taskId: string
  title: string
  status: string
  priority: string
  description?: string
  createdAt: string
}

export interface CockpitDecision {
  decisionId: string
  title: string
  decision: string
  context?: string
  status: string
  createdAt: string
}

export interface CockpitCommand {
  commandRunId: string
  command: string
  status: string
  exitCode?: number
  stdoutPreview: string
  stderrPreview: string
  blockedReason?: string
  startedAt: string
  durationMs?: number
}

export interface CockpitValidation {
  validationReportId: string
  status: string
  summary: string
  failures: string[]
  startedAt: string
}

export interface CockpitStructure {
  techStack: string[]
  importantFiles: string[]
  topLevel: Array<{ path: string; name: string; type: 'file' | 'dir' }>
}

export interface CockpitOverview {
  projects: CockpitProject[]
  project: CockpitProject | null
  health?: CockpitHealth | null
  git?: CockpitGit | null
  commits?: CockpitCommit[]
  patches?: CockpitPatch[]
  approvals?: CockpitApproval[]
  tasks?: CockpitTask[]
  decisions?: CockpitDecision[]
  commands?: CockpitCommand[]
  validation?: CockpitValidation[]
  structure?: CockpitStructure | null
}

export interface CockpitWorkflow {
  id: string
  label: string
  outputType: string
  creates: string
}

export async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json() as Promise<T>
}

export async function patchJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json() as Promise<T>
}

export async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  return res.json() as Promise<T>
}

export function riskTone(risk: string): 'amber' | 'red' | 'emerald' | 'cyan' | 'zinc' {
  if (risk === 'critical' || risk === 'high') return 'red'
  if (risk === 'medium') return 'amber'
  if (risk === 'low') return 'emerald'
  return 'zinc'
}

export function statusBadge(status: string): 'default' | 'success' | 'warning' | 'error' {
  if (['passed', 'applied', 'approved', 'done', 'accepted'].includes(status)) return 'success'
  if (['failed', 'rejected', 'blocked', 'error'].includes(status)) return 'error'
  if (['proposed', 'draft', 'pending', 'partial', 'approval-required', 'active', 'planned'].includes(status)) return 'warning'
  return 'default'
}
