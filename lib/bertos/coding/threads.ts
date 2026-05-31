import { makeRuntimeId, nowIso } from '../runtime-store'
import { Collection } from './store'
import { redactSensitiveText } from './safety'
import { getStorageStatus } from './storage'
import { CodingOSError } from './types'

export type ThreadProviderMode = 'llm' | 'local' | 'mixed' | 'unknown'

export interface ThreadMessage {
  role: 'user' | 'assistant'
  content: string
  at: string
  intent?: string
  llmUsed?: boolean
  providerName?: string
  outputId?: string
  agentRunId?: string
  createdTaskIds?: string[]
  memoryProposalIds?: string[]
}

export interface AssistantThread {
  threadId: string
  projectId?: string
  projectSlug?: string
  title: string
  messages: ThreadMessage[]
  linkedRunIds: string[]
  linkedOutputIds: string[]
  providerMode: ThreadProviderMode
  storageMode: string
  createdAt: string
  updatedAt: string
}

const threads = new Collection<AssistantThread & Record<string, unknown>>('threads.json', 'threadId')

function deriveTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim()
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned || 'New thread'
}

export async function createThread(input: { projectId?: string; projectSlug?: string; title?: string; firstMessage?: string }): Promise<AssistantThread> {
  const now = nowIso()
  const thread: AssistantThread = {
    threadId: makeRuntimeId('thread'),
    projectId: input.projectId,
    projectSlug: input.projectSlug,
    title: input.title?.trim() || (input.firstMessage ? deriveTitle(input.firstMessage) : 'New thread'),
    messages: [],
    linkedRunIds: [],
    linkedOutputIds: [],
    providerMode: 'unknown',
    storageMode: getStorageStatus().mode,
    createdAt: now,
    updatedAt: now,
  }
  return threads.insert(thread as AssistantThread & Record<string, unknown>)
}

export async function listThreads(projectId?: string, limit = 50): Promise<AssistantThread[]> {
  const all = await threads.list(limit)
  const filtered = projectId ? all.filter(t => t.projectId === projectId) : all
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getThread(threadId: string): Promise<AssistantThread | null> {
  return threads.get(threadId)
}

export async function deleteThread(threadId: string): Promise<boolean> {
  return threads.remove(threadId)
}

export async function renameThread(threadId: string, title: string): Promise<AssistantThread> {
  const existing = await threads.get(threadId)
  if (!existing) throw new CodingOSError('not-found', `Thread not found: ${threadId}`)
  return threads.update(threadId, current => ({ ...current, title: title.trim() || current.title, updatedAt: nowIso() }))
}

/** Append a user message + the assistant result to a thread (creating one if needed). Secrets are redacted before storage. */
export async function appendTurn(input: {
  threadId?: string
  projectId?: string
  projectSlug?: string
  userMessage: string
  assistant: {
    reply: string
    intent: string
    llmUsed: boolean
    providerName?: string
    outputId?: string
    agentRunId?: string
    createdTaskIds: string[]
    memoryProposalIds: string[]
  }
}): Promise<AssistantThread> {
  const thread = input.threadId
    ? (await threads.get(input.threadId)) ?? (await createThread({ projectId: input.projectId, projectSlug: input.projectSlug, firstMessage: input.userMessage }))
    : await createThread({ projectId: input.projectId, projectSlug: input.projectSlug, firstMessage: input.userMessage })

  const now = nowIso()
  const userMsg: ThreadMessage = { role: 'user', content: redactSensitiveText(input.userMessage).text, at: now }
  const a = input.assistant
  const assistantMsg: ThreadMessage = {
    role: 'assistant',
    content: redactSensitiveText(a.reply).text,
    at: now,
    intent: a.intent,
    llmUsed: a.llmUsed,
    providerName: a.providerName,
    outputId: a.outputId,
    agentRunId: a.agentRunId,
    createdTaskIds: a.createdTaskIds,
    memoryProposalIds: a.memoryProposalIds,
  }

  const nextProviderMode: ThreadProviderMode = thread.providerMode === 'unknown'
    ? (a.llmUsed ? 'llm' : 'local')
    : (thread.providerMode === 'llm' && a.llmUsed) ? 'llm'
    : (thread.providerMode === 'local' && !a.llmUsed) ? 'local'
    : 'mixed'

  return threads.update(thread.threadId, current => ({
    ...current,
    title: current.messages.length === 0 ? deriveTitle(input.userMessage) : current.title,
    messages: [...current.messages, userMsg, assistantMsg],
    linkedRunIds: a.agentRunId ? [...new Set([...current.linkedRunIds, a.agentRunId])] : current.linkedRunIds,
    linkedOutputIds: a.outputId ? [...new Set([...current.linkedOutputIds, a.outputId])] : current.linkedOutputIds,
    providerMode: nextProviderMode,
    projectId: current.projectId ?? input.projectId,
    projectSlug: current.projectSlug ?? input.projectSlug,
    updatedAt: now,
  }))
}
