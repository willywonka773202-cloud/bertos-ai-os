// BertOS Everyday Coding OS — canonical local-first types.
// All records are stored as JSON under data/bertos/coding/* via runtime-store helpers.

export type ProjectStatus = 'active' | 'paused' | 'archived'

export interface CodingProject {
  projectId: string
  name: string
  slug: string
  description?: string
  repoPath: string
  repoUrl?: string
  defaultBranch?: string
  status: ProjectStatus
  tags: string[]
  client?: string
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
  memoryScope: string
  outputScope: string
  allowedCommands: string[]
  blockedCommands: string[]
  validationCommands: string[]
  importantPaths: string[]
  ignoredPaths: string[]
  notes?: string
  favorite: boolean
  localOnly: boolean
}

export interface ProjectHealthSummary {
  projectId: string
  pathExists: boolean
  isGitRepo: boolean
  branch?: string
  clean?: boolean
  changedFiles?: number
  ahead?: number
  behind?: number
  lastValidationStatus?: ValidationStatus
  lastValidationAt?: string
  openTasks: number
  pendingApprovals: number
  pendingPatches: number
  techStack: string[]
  importantFiles: string[]
  warnings: string[]
  checkedAt: string
}

// ── Git ────────────────────────────────────────────────────────────────────

export interface GitStatusSnapshot {
  snapshotId: string
  projectId: string
  branch: string
  ahead: number
  behind: number
  clean: boolean
  changedFiles: string[]
  stagedFiles: string[]
  untrackedFiles: string[]
  deletedFiles: string[]
  conflictedFiles: string[]
  diffStat: string
  createdAt: string
}

export interface GitCommitSummary {
  hash: string
  shortHash: string
  subject: string
  author: string
  date: string
}

// ── Commands & Validation ────────────────────────────────────────────────────

export type CommandRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'error' | 'approval-required'

export interface CommandRun {
  commandRunId: string
  projectId: string
  command: string
  args: string[]
  cwd: string
  status: CommandRunStatus
  startedAt: string
  completedAt?: string
  exitCode?: number
  stdoutPreview: string
  stderrPreview: string
  outputFile?: string
  redactionApplied: boolean
  approvalRequired: boolean
  approvedBy?: string
  blockedReason?: string
  durationMs?: number
  linkedAgentRunId?: string
  linkedWorkflowRunId?: string
  linkedValidationReportId?: string
}

export type ValidationStatus = 'passed' | 'failed' | 'partial' | 'blocked'

export interface ValidationReport {
  validationReportId: string
  projectId: string
  commandRunIds: string[]
  status: ValidationStatus
  summary: string
  failures: string[]
  startedAt: string
  completedAt?: string
  linkedOutputArtifactId?: string
}

export interface CommandGuardResult {
  allowed: boolean
  approvalRequired: boolean
  reason?: string
  base: string
  args: string[]
}

// ── Files ──────────────────────────────────────────────────────────────────

export interface ProjectFileEntry {
  path: string
  name: string
  type: 'file' | 'dir'
  sizeBytes?: number
  ext?: string
}

export interface ProjectFilePreview {
  path: string
  content: string
  truncated: boolean
  redactionApplied: boolean
  totalBytes: number
  language: string
}

export interface ProjectSearchHit {
  path: string
  line: number
  preview: string
}

// ── Patches ──────────────────────────────────────────────────────────────────

export type PatchStatus = 'draft' | 'proposed' | 'approved' | 'applied' | 'rejected' | 'failed'
export type RiskLevel = 'low' | 'medium' | 'high'
export type PatchFileAction = 'create' | 'modify' | 'delete'

export interface PatchFileChange {
  path: string
  action: PatchFileAction
  /** Expected current content checksum at proposal time (undefined for create). */
  baseChecksum?: string
  /** Full file content after applying (undefined for delete). */
  after?: string
  baseExists: boolean
  baseSizeBytes?: number
}

export interface PatchProposal {
  patchProposalId: string
  projectId: string
  title: string
  description?: string
  reason?: string
  createdByAgentRunId?: string
  workflowRunId?: string
  sourceOutputId?: string
  status: PatchStatus
  filesChanged: PatchFileChange[]
  diff: string
  patchFormat: 'unified-full-file'
  riskLevel: RiskLevel
  approvalRequired: boolean
  approvalId?: string
  validationPlan: string[]
  createdAt: string
  updatedAt: string
  approvedAt?: string
  appliedAt?: string
  rejectedAt?: string
  errors?: string[]
  appliedOutputId?: string
  backups?: PatchBackupRecord[]
}

export interface PatchBackupRecord {
  path: string
  backupPath?: string
  beforeChecksum?: string
  afterChecksum?: string
  action: PatchFileAction
}

export interface PatchConflict {
  path: string
  reason: string
}

export interface PatchApplyResult {
  ok: boolean
  patch: PatchProposal
  conflicts: PatchConflict[]
  appliedFiles: string[]
  outputId?: string
  validationReportId?: string
}

// ── Approvals ────────────────────────────────────────────────────────────────

export type ApprovalActionType =
  | 'file_deletion'
  | 'file_overwrite'
  | 'patch_apply'
  | 'git_commit'
  | 'git_push'
  | 'deploy'
  | 'send_email'
  | 'calendar_event'
  | 'publish'
  | 'paid_api'
  | 'package_install'
  | 'sensitive_file_access'
  | 'durable_memory_write'
  | 'external_connector'
  | 'persona_generation'
  | 'risky_command'

export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface ApprovalRequest {
  approvalId: string
  actionType: ApprovalActionType
  title: string
  description?: string
  riskLevel: ApprovalRiskLevel
  projectId?: string
  requestedByAgentRunId?: string
  requestedAt: string
  status: ApprovalStatus
  approvedAt?: string
  rejectedAt?: string
  requiredBefore?: string
  payloadSummary?: string
  sensitiveFieldsRedacted: boolean
  consequences?: string
  rollbackPlan?: string
  targetRef?: string
  sourceRunId?: string
  sourceOutputId?: string
  decisionNote?: string
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export type TaskStatus = 'inbox' | 'planned' | 'active' | 'blocked' | 'done' | 'archived'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskSource = 'user' | 'workflow' | 'memory' | 'output' | 'agent'

export interface CodingTask {
  taskId: string
  projectId?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  source: TaskSource
  tags: string[]
  acceptanceCriteria: string[]
  linkedOutputIds: string[]
  linkedAgentRunIds: string[]
  linkedWorkflowRunIds: string[]
  linkedPatchProposalIds: string[]
  linkedCommandRunIds: string[]
  createdAt: string
  updatedAt: string
  dueAt?: string
  completedAt?: string
}

// ── Decisions ─────────────────────────────────────────────────────────────────

export type DecisionStatus = 'proposed' | 'accepted' | 'superseded' | 'rejected'

export interface DecisionRecord {
  decisionId: string
  projectId?: string
  title: string
  context?: string
  decision: string
  alternatives: string[]
  consequences?: string
  linkedRunIds: string[]
  linkedOutputIds: string[]
  linkedTaskIds: string[]
  createdAt: string
  updatedAt: string
  status: DecisionStatus
  supersededBy?: string
}

// ── Search ──────────────────────────────────────────────────────────────────

export type SearchResultType =
  | 'project'
  | 'file'
  | 'output'
  | 'run'
  | 'task'
  | 'memory'
  | 'patch'
  | 'command'
  | 'validation'
  | 'decision'
  | 'approval'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  snippet?: string
  project?: string
  updatedAt?: string
  link: string
  source: string
  score: number
}

export class CodingOSError extends Error {
  code: 'invalid-input' | 'not-found' | 'conflict' | 'blocked' | 'approval-required' | 'storage-error'
  constructor(code: CodingOSError['code'], message: string) {
    super(message)
    this.name = 'CodingOSError'
    this.code = code
  }
}
