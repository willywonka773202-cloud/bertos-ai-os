import type { NextRequest } from 'next/server'
import { getActiveProject, getProject, getProjectHealthSummary, listProjects } from '@/lib/bertos/coding/projects'
import { getGitStatus, getRecentCommits, isGitRepo } from '@/lib/bertos/coding/git'
import { listPatchProposals } from '@/lib/bertos/coding/patches'
import { listApprovalRequests } from '@/lib/bertos/coding/approvals'
import { listCodingTasks } from '@/lib/bertos/coding/tasks'
import { listDecisionRecords } from '@/lib/bertos/coding/decisions'
import { listCommandRuns, listValidationReports } from '@/lib/bertos/coding/commands'
import { summarizeProjectStructure } from '@/lib/bertos/coding/files'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get('projectId')
    const projects = await listProjects(true)
    const project = requested ? await getProject(requested) : await getActiveProject()

    if (!project) {
      return ok({ projects, project: null })
    }

    const projectId = project.projectId
    const gitRepo = await isGitRepo(project.repoPath).catch(() => false)

    const [health, git, commits, patches, approvals, tasks, decisions, commands, validation, structure] = await Promise.all([
      getProjectHealthSummary(projectId).catch(() => null),
      gitRepo ? getGitStatus(projectId).catch(() => null) : Promise.resolve(null),
      gitRepo ? getRecentCommits(projectId, 8).catch(() => []) : Promise.resolve([]),
      listPatchProposals(projectId).catch(() => []),
      listApprovalRequests({ projectId }).catch(() => []),
      listCodingTasks({ projectId }).catch(() => []),
      listDecisionRecords(projectId).catch(() => []),
      listCommandRuns(projectId, 15).catch(() => []),
      listValidationReports(projectId, 8).catch(() => []),
      summarizeProjectStructure(projectId).catch(() => null),
    ])

    return ok({
      projects,
      project,
      health,
      git,
      commits,
      patches,
      approvals,
      tasks,
      decisions,
      commands,
      validation,
      structure,
    })
  } catch (error) {
    return codingError(error)
  }
}
