import { getActiveProject, listProjects } from './projects'
import { listCodingTasks } from './tasks'
import { listDecisionRecords } from './decisions'
import { listPatchProposals } from './patches'
import { listCommandRuns, listValidationReports } from './commands'
import { listApprovalRequests } from './approvals'
import { searchProjectFiles } from './files'
import type { SearchResult } from './types'

function score(haystack: string, needle: string): number {
  const lower = haystack.toLowerCase()
  const q = needle.toLowerCase()
  if (!lower.includes(q)) return 0
  if (lower === q) return 100
  if (lower.startsWith(q)) return 60
  return 30
}

export interface UnifiedSearchOptions {
  projectId?: string
  includeFiles?: boolean
  limit?: number
}

export async function unifiedSearch(query: string, options: UnifiedSearchOptions = {}): Promise<SearchResult[]> {
  const q = (query ?? '').trim()
  if (q.length < 2) return []
  const results: SearchResult[] = []
  const limit = options.limit ?? 60

  const [projects, tasks, decisions, patches, commands, validations, approvals] = await Promise.all([
    listProjects(true).catch(() => []),
    listCodingTasks(options.projectId ? { projectId: options.projectId } : {}).catch(() => []),
    listDecisionRecords(options.projectId).catch(() => []),
    listPatchProposals(options.projectId).catch(() => []),
    listCommandRuns(options.projectId, 80).catch(() => []),
    listValidationReports(options.projectId, 40).catch(() => []),
    listApprovalRequests(options.projectId ? { projectId: options.projectId } : {}).catch(() => []),
  ])

  for (const project of projects) {
    const s = Math.max(score(project.name, q), score(project.slug, q), score(project.description ?? '', q), ...project.tags.map(tag => score(tag, q)))
    if (s) results.push({ type: 'project', id: project.projectId, title: project.name, snippet: project.description, project: project.slug, updatedAt: project.updatedAt, link: '/cockpit', source: 'project-registry', score: s + 10 })
  }
  for (const task of tasks) {
    const s = Math.max(score(task.title, q), score(task.description ?? '', q), ...task.tags.map(tag => score(tag, q)))
    if (s) results.push({ type: 'task', id: task.taskId, title: task.title, snippet: `${task.status} · ${task.priority}`, updatedAt: task.updatedAt, link: '/cockpit', source: 'tasks', score: s })
  }
  for (const decision of decisions) {
    const s = Math.max(score(decision.title, q), score(decision.decision, q), score(decision.context ?? '', q))
    if (s) results.push({ type: 'decision', id: decision.decisionId, title: decision.title, snippet: decision.decision.slice(0, 120), updatedAt: decision.updatedAt, link: '/cockpit', source: 'decisions', score: s })
  }
  for (const patch of patches) {
    const s = Math.max(score(patch.title, q), score(patch.description ?? '', q), ...patch.filesChanged.map(file => score(file.path, q)))
    if (s) results.push({ type: 'patch', id: patch.patchProposalId, title: patch.title, snippet: `${patch.status} · ${patch.filesChanged.length} file(s)`, updatedAt: patch.updatedAt, link: '/cockpit', source: 'patch-forge', score: s })
  }
  for (const run of commands) {
    const s = score(run.command, q)
    if (s) results.push({ type: 'command', id: run.commandRunId, title: run.command, snippet: `${run.status}${run.exitCode !== undefined ? ` · exit ${run.exitCode}` : ''}`, updatedAt: run.completedAt ?? run.startedAt, link: '/cockpit', source: 'commands', score: s })
  }
  for (const report of validations) {
    const s = Math.max(score(report.summary, q), score('validation', q))
    if (s) results.push({ type: 'validation', id: report.validationReportId, title: report.summary, snippet: report.status, updatedAt: report.completedAt ?? report.startedAt, link: '/cockpit', source: 'validation', score: s })
  }
  for (const approval of approvals) {
    const s = Math.max(score(approval.title, q), score(approval.actionType, q))
    if (s) results.push({ type: 'approval', id: approval.approvalId, title: approval.title, snippet: `${approval.actionType} · ${approval.status}`, updatedAt: approval.requestedAt, link: '/approvals', source: 'guardian-gates', score: s })
  }

  // Best-effort: outputs registry + run ledger.
  try {
    const { searchOutputArtifacts } = await import('../outputs/registry')
    const artifacts = await searchOutputArtifacts({ query: q, limit: 20 })
    for (const artifact of artifacts) {
      results.push({ type: 'output', id: artifact.outputId, title: artifact.title, snippet: artifact.type, project: artifact.project, updatedAt: artifact.updatedAt, link: '/outputs', source: 'output-registry', score: 35 })
    }
  } catch {
    // optional
  }

  // Optional: file content search scoped to active/selected project.
  if (options.includeFiles) {
    const projectId = options.projectId ?? (await getActiveProject().catch(() => null))?.projectId
    if (projectId) {
      try {
        const hits = await searchProjectFiles(projectId, q)
        for (const hit of hits.slice(0, 20)) {
          results.push({ type: 'file', id: `${hit.path}:${hit.line}`, title: hit.path, snippet: `L${hit.line}: ${hit.preview}`, link: '/cockpit', source: 'file-search', score: 25 })
        }
      } catch {
        // file search optional
      }
    }
  }

  return results.sort((a, b) => b.score - a.score || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, limit)
}
