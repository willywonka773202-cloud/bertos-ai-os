import { spawn } from 'node:child_process'
import { makeRuntimeId, nowIso } from '../runtime-store'
import { requireProject } from './projects'
import { Collection } from './store'
import { guardCommand, redactSensitiveText } from './safety'
import { createApprovalRequest } from './approvals'
import {
  CodingOSError,
  type CommandRun,
  type CommandRunStatus,
  type ValidationReport,
  type ValidationStatus,
} from './types'

const commandRuns = new Collection<CommandRun & Record<string, unknown>>('commands.json', 'commandRunId')
const validationReports = new Collection<ValidationReport & Record<string, unknown>>('validation.json', 'validationReportId')

const COMMAND_TIMEOUT_MS = 180_000
const PREVIEW_CHARS = 8_000

interface SpawnResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}

function spawnSafe(base: string, args: string[], cwd: string, timeoutMs: number): Promise<SpawnResult> {
  return new Promise(resolve => {
    // shell:false is critical — no shell interpretation of args.
    const child = spawn(base, args, { cwd, shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stdout?.on('data', chunk => { stdout += chunk.toString() })
    child.stderr?.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error instanceof Error ? error.message : 'spawn error'}`, timedOut })
    })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code: code ?? 0, stdout, stderr, timedOut })
    })
  })
}

export interface RunCommandOptions {
  approved?: boolean
  linkedAgentRunId?: string
  linkedWorkflowRunId?: string
  linkedValidationReportId?: string
}

export async function runCommand(projectId: string, command: string, options: RunCommandOptions = {}): Promise<CommandRun> {
  const project = await requireProject(projectId)
  const guard = guardCommand(command, { allowedCommands: project.allowedCommands, blockedCommands: project.blockedCommands })

  const base: Omit<CommandRun, 'status'> = {
    commandRunId: makeRuntimeId('cmd'),
    projectId,
    command: command.trim(),
    args: guard.args,
    cwd: project.repoPath,
    startedAt: nowIso(),
    stdoutPreview: '',
    stderrPreview: '',
    redactionApplied: false,
    approvalRequired: guard.approvalRequired,
    linkedAgentRunId: options.linkedAgentRunId,
    linkedWorkflowRunId: options.linkedWorkflowRunId,
    linkedValidationReportId: options.linkedValidationReportId,
  }

  if (!guard.allowed) {
    return persistRun({ ...base, status: 'blocked', blockedReason: guard.reason, completedAt: nowIso() })
  }

  if (guard.approvalRequired && !options.approved) {
    const approval = await createApprovalRequest({
      actionType: 'risky_command',
      title: `Run command: ${command.trim()}`,
      projectId,
      payloadSummary: command.trim(),
      consequences: guard.reason,
      targetRef: base.commandRunId,
    })
    return persistRun({
      ...base,
      status: 'approval-required',
      blockedReason: `${guard.reason} (approval ${approval.approvalId})`,
      completedAt: nowIso(),
    })
  }

  const started = Date.now()
  const running = await persistRun({ ...base, status: 'running' })
  const result = await spawnSafe(guard.base, guard.args, project.repoPath, COMMAND_TIMEOUT_MS)
  const stdoutRedaction = redactSensitiveText(result.stdout)
  const stderrRedaction = redactSensitiveText(result.stderr)
  const status: CommandRunStatus = result.timedOut ? 'error' : result.code === 0 ? 'passed' : 'failed'

  return commandRuns.update(running.commandRunId, current => ({
    ...current,
    status,
    exitCode: result.code,
    completedAt: nowIso(),
    durationMs: Date.now() - started,
    stdoutPreview: stdoutRedaction.text.slice(-PREVIEW_CHARS),
    stderrPreview: stderrRedaction.text.slice(-PREVIEW_CHARS),
    redactionApplied: stdoutRedaction.redacted || stderrRedaction.redacted,
    approvedBy: options.approved ? 'operator' : current.approvedBy,
  }))
}

async function persistRun(run: CommandRun): Promise<CommandRun> {
  const existing = await commandRuns.get(run.commandRunId)
  if (existing) {
    return commandRuns.update(run.commandRunId, () => run as CommandRun & Record<string, unknown>)
  }
  return commandRuns.insert(run as CommandRun & Record<string, unknown>)
}

export async function listCommandRuns(projectId?: string, limit = 100): Promise<CommandRun[]> {
  const all = await commandRuns.list(limit)
  return projectId ? all.filter(run => run.projectId === projectId) : all
}

export async function getCommandRun(commandRunId: string): Promise<CommandRun | null> {
  return commandRuns.get(commandRunId)
}

// ── Validation ───────────────────────────────────────────────────────────────

export async function runValidation(projectId: string, commands?: string[]): Promise<ValidationReport> {
  const project = await requireProject(projectId)
  const toRun = (commands?.length ? commands : project.validationCommands).filter(Boolean)
  if (!toRun.length) {
    throw new CodingOSError('invalid-input', 'No validation commands configured for this project.')
  }

  const reportId = makeRuntimeId('val')
  const startedAt = nowIso()
  const commandRunIds: string[] = []
  const failures: string[] = []
  let anyFailed = false
  let anyBlocked = false
  let anyPassed = false

  for (const command of toRun) {
    const run = await runCommand(projectId, command, { linkedValidationReportId: reportId })
    commandRunIds.push(run.commandRunId)
    if (run.status === 'passed') anyPassed = true
    else if (run.status === 'blocked' || run.status === 'approval-required') {
      anyBlocked = true
      failures.push(`${command}: ${run.blockedReason ?? 'blocked'}`)
    } else {
      anyFailed = true
      failures.push(`${command}: exit ${run.exitCode ?? '?'}`)
    }
  }

  let status: ValidationStatus
  if (anyFailed) status = 'failed'
  else if (anyBlocked && !anyPassed) status = 'blocked'
  else if (anyBlocked) status = 'partial'
  else status = 'passed'

  const report: ValidationReport = {
    validationReportId: reportId,
    projectId,
    commandRunIds,
    status,
    summary: status === 'passed'
      ? `All ${toRun.length} validation command(s) passed.`
      : `${failures.length} of ${toRun.length} validation command(s) need attention.`,
    failures,
    startedAt,
    completedAt: nowIso(),
  }

  // Best-effort output artifact for the ledger.
  try {
    const { createOutputArtifact } = await import('../outputs/registry')
    const artifact = await createOutputArtifact({
      type: 'validation_report',
      title: `Validation: ${project.name} — ${status}`,
      project: project.slug,
      status: status === 'passed' ? 'ready' : 'draft',
      tags: ['validation', 'coding-os'],
      content: [`# Validation report (${status})`, '', report.summary, '', '## Commands', ...toRun.map(c => `- ${c}`), '', ...(failures.length ? ['## Failures', ...failures.map(f => `- ${f}`)] : [])].join('\n'),
      fileName: 'validation-report.md',
    })
    report.linkedOutputArtifactId = artifact.outputId
  } catch {
    // best-effort
  }

  return validationReports.insert(report as ValidationReport & Record<string, unknown>)
}

export async function listValidationReports(projectId?: string, limit = 50): Promise<ValidationReport[]> {
  const all = await validationReports.list(limit)
  return projectId ? all.filter(report => report.projectId === projectId) : all
}

export async function getLatestValidationReport(projectId: string): Promise<ValidationReport | null> {
  const reports = await listValidationReports(projectId, 1)
  return reports[0] ?? null
}
