import { makeRuntimeId, nowIso } from '../runtime-store'
import { Collection } from './store'
import { CodingOSError, type CodingTask, type TaskPriority, type TaskSource, type TaskStatus } from './types'

const tasks = new Collection<CodingTask & Record<string, unknown>>('tasks.json', 'taskId')

export interface CreateTaskInput {
  title: string
  projectId?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  source?: TaskSource
  tags?: string[]
  acceptanceCriteria?: string[]
  dueAt?: string
  linkedOutputIds?: string[]
  linkedWorkflowRunIds?: string[]
  linkedPatchProposalIds?: string[]
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map(s => s.trim()).filter(Boolean) : []
}

export async function createCodingTask(input: CreateTaskInput): Promise<CodingTask> {
  const title = (input.title ?? '').trim()
  if (!title) throw new CodingOSError('invalid-input', 'Task title is required.')
  const now = nowIso()
  const task: CodingTask = {
    taskId: makeRuntimeId('task'),
    projectId: input.projectId,
    title,
    description: input.description?.trim() || undefined,
    status: input.status ?? 'inbox',
    priority: input.priority ?? 'medium',
    source: input.source ?? 'user',
    tags: list(input.tags),
    acceptanceCriteria: list(input.acceptanceCriteria),
    linkedOutputIds: list(input.linkedOutputIds),
    linkedAgentRunIds: [],
    linkedWorkflowRunIds: list(input.linkedWorkflowRunIds),
    linkedPatchProposalIds: list(input.linkedPatchProposalIds),
    linkedCommandRunIds: [],
    createdAt: now,
    updatedAt: now,
    dueAt: input.dueAt,
  }
  return tasks.insert(task as CodingTask & Record<string, unknown>)
}

export async function listCodingTasks(filter: { projectId?: string; status?: TaskStatus } = {}): Promise<CodingTask[]> {
  const all = await tasks.list()
  return all
    .filter(task => !filter.projectId || task.projectId === filter.projectId)
    .filter(task => !filter.status || task.status === filter.status)
}

export async function getCodingTask(taskId: string): Promise<CodingTask | null> {
  return tasks.get(taskId)
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  acceptanceCriteria?: string[]
  dueAt?: string
}

export async function updateCodingTask(taskId: string, input: UpdateTaskInput): Promise<CodingTask> {
  const existing = await tasks.get(taskId)
  if (!existing) throw new CodingOSError('not-found', `Task not found: ${taskId}`)
  return tasks.update(taskId, current => ({
    ...current,
    title: input.title?.trim() || current.title,
    description: input.description === undefined ? current.description : input.description.trim() || undefined,
    status: input.status ?? current.status,
    priority: input.priority ?? current.priority,
    tags: input.tags === undefined ? current.tags : list(input.tags),
    acceptanceCriteria: input.acceptanceCriteria === undefined ? current.acceptanceCriteria : list(input.acceptanceCriteria),
    dueAt: input.dueAt === undefined ? current.dueAt : input.dueAt,
    completedAt: input.status === 'done' ? nowIso() : current.completedAt,
    updatedAt: nowIso(),
  }))
}

export async function completeCodingTask(taskId: string): Promise<CodingTask> {
  return updateCodingTask(taskId, { status: 'done' })
}

export async function archiveCodingTask(taskId: string): Promise<CodingTask> {
  return updateCodingTask(taskId, { status: 'archived' })
}

/** Create tasks from a workflow output's follow-up list, deduping by title within a project. */
export async function tasksFromWorkflowOutput(input: { projectId?: string; titles: string[]; workflowRunId?: string; outputId?: string }): Promise<CodingTask[]> {
  const existing = await listCodingTasks({ projectId: input.projectId })
  const existingTitles = new Set(existing.map(task => task.title.toLowerCase()))
  const created: CodingTask[] = []
  for (const title of input.titles) {
    const trimmed = title.trim()
    if (!trimmed || existingTitles.has(trimmed.toLowerCase())) continue
    existingTitles.add(trimmed.toLowerCase())
    created.push(await createCodingTask({
      title: trimmed,
      projectId: input.projectId,
      source: 'workflow',
      status: 'planned',
      linkedWorkflowRunIds: input.workflowRunId ? [input.workflowRunId] : [],
      linkedOutputIds: input.outputId ? [input.outputId] : [],
    }))
  }
  return created
}
