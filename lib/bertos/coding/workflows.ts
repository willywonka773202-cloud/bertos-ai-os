import { requireProject } from './projects'
import { getGitStatus, getRecentCommits, getGitDiffStat, isGitRepo } from './git'
import { summarizeProjectStructure } from './files'
import { getLatestValidationReport, listCommandRuns } from './commands'
import { listCodingTasks, tasksFromWorkflowOutput } from './tasks'
import { listDecisionRecords } from './decisions'
import { listPatchProposals } from './patches'
import { recordCodingRun } from './agent-runs'
import { proposeCodingMemory } from './memory-bridge'
import { CodingOSError, type CodingProject } from './types'
import type { MemoryKind } from '../types'
import type { OutputArtifact } from '../outputs/types'

export const CODING_WORKFLOWS = [
  { id: 'explain-current-project', label: 'Explain repo', outputType: 'repo_map', creates: 'A grounded repo map.' },
  { id: 'feature-request-to-patch-plan', label: 'Plan feature', outputType: 'feature_plan', creates: 'A feature plan with follow-up tasks.' },
  { id: 'code-review-current-diff', label: 'Review current diff', outputType: 'diff_review', creates: 'A review of the working-tree diff.' },
  { id: 'failing-validation-to-fix-plan', label: 'Triage validation failure', outputType: 'bug_report', creates: 'A triage plan from the last validation run.' },
  { id: 'write-tests-plan', label: 'Write tests plan', outputType: 'test_report', creates: 'A test plan grounded in the codebase.' },
  { id: 'daily-dev-briefing', label: 'Daily dev briefing', outputType: 'daily_dev_briefing', creates: 'Today\'s coding briefing.' },
  { id: 'reflect-on-work', label: 'Reflect on work', outputType: 'reflection_digest', creates: 'A reflection digest + follow-up tasks.' },
  { id: 'release-readiness-check', label: 'Release readiness check', outputType: 'release_checklist', creates: 'A release readiness checklist.' },
] as const

export type CodingWorkflowId = (typeof CODING_WORKFLOWS)[number]['id']

const LOCAL_NOTE = '> _Local deterministic workflow — no LLM used. Grounded only in your local project data._'

export interface WorkflowRunResult {
  workflowId: CodingWorkflowId
  outputId?: string
  title: string
  markdown: string
  createdTaskIds: string[]
  memoryProposalIds: string[]
  workflowRunId?: string
  agentRunId?: string
  llmUsed: false
  groundedIn: string[]
}

// Workflows that produce a durable, review-worthy memory proposal.
const MEMORY_WORKFLOWS: Partial<Record<CodingWorkflowId, MemoryKind>> = {
  'explain-current-project': 'semantic',
  'code-review-current-diff': 'procedural',
  'release-readiness-check': 'procedural',
  'reflect-on-work': 'episodic',
}

export async function runCodingWorkflow(projectId: string, workflowId: CodingWorkflowId, input?: { request?: string }): Promise<WorkflowRunResult> {
  const project = await requireProject(projectId)
  if (!CODING_WORKFLOWS.some(workflow => workflow.id === workflowId)) {
    throw new CodingOSError('invalid-input', `Unknown workflow: ${workflowId}`)
  }

  const built = await buildWorkflowContent(project, workflowId, input)
  let outputId: string | undefined
  try {
    const { createOutputArtifact } = await import('../outputs/registry')
    const definition = CODING_WORKFLOWS.find(workflow => workflow.id === workflowId)
    const artifact: OutputArtifact = await createOutputArtifact({
      type: definition?.outputType ?? 'repo_map',
      title: built.title,
      project: project.slug,
      status: 'ready',
      tags: ['coding-os', 'workflow', workflowId],
      content: built.markdown,
      fileName: `${workflowId}.md`,
      sourceLinks: [`project:${project.slug}`],
    })
    outputId = artifact.outputId
  } catch {
    // output registry best-effort
  }

  let createdTaskIds: string[] = []
  if (built.followUps.length) {
    const created = await tasksFromWorkflowOutput({
      projectId,
      titles: built.followUps,
      outputId,
    }).catch(() => [])
    createdTaskIds = created.map(task => task.taskId)
  }

  // Record this workflow as a real run (AgentRun + WorkflowRun + lanes) in the ledger.
  let workflowRunId: string | undefined
  let agentRunId: string | undefined
  try {
    const recorded = await recordCodingRun({
      workflowId,
      title: built.title,
      objective: `Local workflow: ${workflowId}`,
      projectSlug: project.slug,
      skillIds: [workflowId],
      lanes: [
        { role: 'grounding', summary: `Grounded in ${built.groundedIn.join(', ')}` },
        { role: 'synthesis', summary: 'Composed deterministic artifact (no LLM)' },
        { role: 'output', summary: outputId ? `Registered output ${outputId}` : 'Output registry unavailable', outputIds: outputId ? [outputId] : [] },
      ],
      outputIds: outputId ? [outputId] : [],
      taskIds: createdTaskIds,
      llmUsed: false,
    })
    workflowRunId = recorded.workflowRunId
    agentRunId = recorded.agentRunId
  } catch {
    // ledger recording is best-effort
  }

  // Propose a durable memory for review when this workflow yields a lasting lesson.
  const memoryProposalIds: string[] = []
  const memoryKind = MEMORY_WORKFLOWS[workflowId]
  if (memoryKind) {
    const proposalId = await proposeCodingMemory({
      projectSlug: project.slug,
      kind: memoryKind,
      title: built.title,
      content: built.markdown,
      reason: `Auto-proposed from the ${workflowId} workflow for review (not written to memory automatically).`,
      sourceRunId: agentRunId,
      sourceOutputId: outputId,
      tags: ['coding-os', 'workflow', workflowId],
    })
    if (proposalId) memoryProposalIds.push(proposalId)
  }

  return {
    workflowId,
    outputId,
    title: built.title,
    markdown: built.markdown,
    createdTaskIds,
    memoryProposalIds,
    workflowRunId,
    agentRunId,
    llmUsed: false,
    groundedIn: built.groundedIn,
  }
}

interface BuiltWorkflow {
  title: string
  markdown: string
  followUps: string[]
  groundedIn: string[]
}

export async function buildWorkflowContent(project: CodingProject, workflowId: CodingWorkflowId, input?: { request?: string }): Promise<BuiltWorkflow> {
  const gitRepo = await isGitRepo(project.repoPath).catch(() => false)
  const grounded: string[] = ['project metadata']

  switch (workflowId) {
    case 'explain-current-project': {
      const structure = await summarizeProjectStructure(project.projectId).catch(() => null)
      if (structure) grounded.push('file structure', 'config files')
      const md = [
        `# Repo map — ${project.name}`,
        LOCAL_NOTE,
        '',
        project.description ? `**Description:** ${project.description}` : '',
        `**Path:** \`${project.repoPath}\``,
        structure?.techStack.length ? `**Tech stack:** ${structure.techStack.join(', ')}` : '**Tech stack:** (none detected)',
        '',
        '## Important files',
        ...(structure?.importantFiles.length ? structure.importantFiles.map(file => `- \`${file}\``) : ['- (none detected yet)']),
        '',
        '## Top-level entries',
        ...(structure?.topLevel.length ? structure.topLevel.map(entry => `- ${entry.type === 'dir' ? '📁' : '📄'} \`${entry.path}\``) : ['- (empty)']),
        '',
        '## Validation commands',
        ...project.validationCommands.map(command => `- \`${command}\``),
      ].filter(Boolean).join('\n')
      return { title: `Repo map — ${project.name}`, markdown: md, followUps: [], groundedIn: grounded }
    }

    case 'feature-request-to-patch-plan': {
      const request = input?.request?.trim() || 'the requested feature'
      const md = [
        `# Feature plan — ${project.name}`,
        LOCAL_NOTE,
        '',
        `**Request:** ${request}`,
        '',
        '## Suggested approach',
        '1. Locate the affected modules with Oracle Search.',
        '2. Draft a small, coherent patch proposal in the Patch Forge.',
        '3. Review the diff and risk level.',
        '4. Approve, apply, and re-run validation.',
        '',
        '## Follow-up tasks (created automatically)',
        `- Scope: ${request}`,
        `- Implement: ${request}`,
        `- Validate: re-run \`${project.validationCommands[0] ?? 'npm run typecheck'}\``,
      ].join('\n')
      return {
        title: `Feature plan — ${request.slice(0, 60)}`,
        markdown: md,
        followUps: [`Scope: ${request}`, `Implement: ${request}`, `Validate after: ${request}`],
        groundedIn: grounded,
      }
    }

    case 'code-review-current-diff': {
      if (!gitRepo) return notAGitRepo(project, 'Code review')
      const [status, diffStat] = await Promise.all([
        getGitStatus(project.projectId).catch(() => null),
        getGitDiffStat(project.projectId).catch(() => 'unavailable'),
      ])
      grounded.push('git status', 'git diff')
      const md = [
        `# Diff review — ${project.name}`,
        LOCAL_NOTE,
        '',
        status ? `**Branch:** ${status.branch} · ${status.clean ? 'clean' : `${status.changedFiles.length} changed, ${status.untrackedFiles.length} untracked`}` : '',
        '',
        '## Changed files',
        ...(status?.changedFiles.length ? status.changedFiles.map(file => `- \`${file}\``) : ['- (no tracked changes)']),
        status?.untrackedFiles.length ? '\n## Untracked' : '',
        ...(status?.untrackedFiles ?? []).map(file => `- \`${file}\``),
        '',
        '## Diff stat',
        '```',
        diffStat,
        '```',
        '',
        '## Review checklist',
        '- [ ] Changes are small and coherent',
        '- [ ] No secrets or .env content introduced',
        '- [ ] Validation passes',
        '- [ ] Risky operations are gated behind approval',
      ].filter(Boolean).join('\n')
      return { title: `Diff review — ${project.name}`, markdown: md, followUps: [], groundedIn: grounded }
    }

    case 'failing-validation-to-fix-plan': {
      const report = await getLatestValidationReport(project.projectId).catch(() => null)
      grounded.push('validation report')
      const md = [
        `# Validation triage — ${project.name}`,
        LOCAL_NOTE,
        '',
        report ? `**Last run:** ${report.status} — ${report.summary}` : '**No validation runs yet.** Run validation from the Command Altar first.',
        '',
        report?.failures.length ? '## Failures' : '',
        ...(report?.failures ?? []).map(failure => `- ${failure}`),
        '',
        '## Triage plan',
        '1. Re-read the failing command output in the Command Output panel.',
        '2. Reproduce locally with the exact command.',
        '3. Draft a focused patch proposal for the smallest fix.',
        '4. Re-run validation after applying.',
      ].filter(Boolean).join('\n')
      const followUps = report?.failures.length ? [`Fix validation failure: ${report.failures[0].slice(0, 60)}`] : []
      return { title: `Validation triage — ${project.name}`, markdown: md, followUps, groundedIn: grounded }
    }

    case 'write-tests-plan': {
      const structure = await summarizeProjectStructure(project.projectId).catch(() => null)
      if (structure) grounded.push('file structure')
      const hasTests = structure?.techStack.includes('Tests')
      const md = [
        `# Test plan — ${project.name}`,
        LOCAL_NOTE,
        '',
        hasTests ? '**Test tooling detected.** Extend existing suites.' : '**No test tooling detected.** Consider adding one (Vitest/Jest).',
        '',
        '## Suggested coverage',
        '- Critical safety paths (path traversal, secret blocking)',
        '- Core business logic happy paths',
        '- Error/edge cases for new code',
        '',
        '## Follow-up tasks',
        '- Add tests for the most recently changed module',
      ].join('\n')
      return { title: `Test plan — ${project.name}`, markdown: md, followUps: ['Add tests for recently changed module'], groundedIn: grounded }
    }

    case 'daily-dev-briefing': {
      const [tasks, patches, validation, status] = await Promise.all([
        listCodingTasks({ projectId: project.projectId }).catch(() => []),
        listPatchProposals(project.projectId).catch(() => []),
        getLatestValidationReport(project.projectId).catch(() => null),
        gitRepo ? getGitStatus(project.projectId).catch(() => null) : Promise.resolve(null),
      ])
      grounded.push('tasks', 'patches', 'validation', 'git status')
      const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status))
      const pendingPatches = patches.filter(patch => ['draft', 'proposed', 'approved'].includes(patch.status))
      const md = [
        `# Daily dev briefing — ${project.name}`,
        LOCAL_NOTE,
        `_${new Date().toLocaleString()}_`,
        '',
        status ? `**Repo:** ${status.branch} · ${status.clean ? 'clean' : `${status.changedFiles.length + status.untrackedFiles.length} dirty`}` : '',
        validation ? `**Last validation:** ${validation.status}` : '**Validation:** not run yet',
        '',
        `## Open tasks (${openTasks.length})`,
        ...(openTasks.slice(0, 10).map(task => `- [${task.priority}] ${task.title}`)),
        openTasks.length ? '' : '- No open tasks. ',
        `## Pending patches (${pendingPatches.length})`,
        ...(pendingPatches.slice(0, 8).map(patch => `- ${patch.status}: ${patch.title}`)),
        pendingPatches.length ? '' : '- No pending patches.',
        '',
        '## Focus suggestion',
        openTasks.length ? `Start with: **${openTasks[0].title}**` : 'Pick a feature to plan, or review the current diff.',
      ].filter(Boolean).join('\n')
      return { title: `Daily briefing — ${project.name}`, markdown: md, followUps: [], groundedIn: grounded }
    }

    case 'reflect-on-work': {
      const [commands, tasks] = await Promise.all([
        listCommandRuns(project.projectId, 40).catch(() => []),
        listCodingTasks({ projectId: project.projectId }).catch(() => []),
      ])
      grounded.push('command runs', 'tasks')
      const done = tasks.filter(task => task.status === 'done')
      const passed = commands.filter(run => run.status === 'passed').length
      const failed = commands.filter(run => run.status === 'failed').length
      const md = [
        `# Reflection digest — ${project.name}`,
        LOCAL_NOTE,
        '',
        `- Completed tasks: ${done.length}`,
        `- Command runs: ${commands.length} (${passed} passed, ${failed} failed)`,
        '',
        '## Lessons / follow-ups',
        failed > 0 ? '- Investigate recurring command failures.' : '- Validation has been healthy.',
        '- Capture any reusable pattern as a Decision Record.',
        '',
        '_Reflection does not write memory directly; it proposes follow-ups only._',
      ].join('\n')
      const followUps = failed > 0 ? ['Investigate recurring command failures'] : []
      return { title: `Reflection — ${project.name}`, markdown: md, followUps, groundedIn: grounded }
    }

    case 'release-readiness-check': {
      const [validation, status, decisions] = await Promise.all([
        getLatestValidationReport(project.projectId).catch(() => null),
        gitRepo ? getGitStatus(project.projectId).catch(() => null) : Promise.resolve(null),
        listDecisionRecords(project.projectId).catch(() => []),
      ])
      grounded.push('validation', 'git status', 'decisions')
      const md = [
        `# Release readiness — ${project.name}`,
        LOCAL_NOTE,
        '',
        `- [${validation?.status === 'passed' ? 'x' : ' '}] Validation passing (${validation?.status ?? 'not run'})`,
        `- [${status?.clean ? 'x' : ' '}] Working tree clean`,
        `- [${(status?.behind ?? 0) === 0 ? 'x' : ' '}] Up to date with upstream`,
        `- [${decisions.length ? 'x' : ' '}] Key decisions recorded (${decisions.length})`,
        '',
        validation?.status === 'passed' && status?.clean ? '**Looks ready.** Push/deploy remain manual + approval-gated.' : '**Not ready yet.** Resolve the unchecked items above.',
      ].join('\n')
      return { title: `Release readiness — ${project.name}`, markdown: md, followUps: [], groundedIn: grounded }
    }

    default:
      throw new CodingOSError('invalid-input', `Unhandled workflow: ${workflowId}`)
  }
}

function notAGitRepo(project: CodingProject, label: string): BuiltWorkflow {
  return {
    title: `${label} — ${project.name}`,
    markdown: `# ${label} — ${project.name}\n\n${LOCAL_NOTE}\n\nThis project path is not a git repository, so diff-based analysis is unavailable.`,
    followUps: [],
    groundedIn: ['project metadata'],
  }
}
