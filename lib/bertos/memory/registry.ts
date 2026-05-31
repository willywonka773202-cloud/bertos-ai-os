import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildMemoryPack, classifyMemorySensitivity, normalizeMemoryTags } from '../memory-engine'
import { makeRuntimeId, nowIso, readJsonFile, runtimePath, slugify, writeJsonFile } from '../runtime-store'
import type { BertOSMemoryItem, MemoryConfidence, MemoryKind, MemorySensitivity, MemorySource, Project } from '../types'
import type { MarkdownMemoryRecord, MemoryProposal, MemoryProposalRiskFlag } from './types'

const MEMORY_INDEX = runtimePath('memory', 'index.json')
const MEMORY_PROPOSALS = runtimePath('memory', 'proposals', 'proposals.json')

const CORE_FILES = [
  'user_profile.md',
  'goals.md',
  'active_projects.md',
  'brand_voice.md',
  'preferences.md',
  'output_index.md',
]

function memoryRecordToItem(record: MarkdownMemoryRecord): BertOSMemoryItem {
  return {
    id: record.id,
    kind: record.kind,
    projectId: record.project,
    title: record.title,
    content: record.content,
    source: record.source,
    sourceRef: record.sourceRef,
    confidence: record.confidence,
    sensitivity: record.sensitivity,
    tags: record.tags,
    createdAt: Date.parse(record.createdAt),
    updatedAt: Date.parse(record.updatedAt),
  }
}

function frontmatter(record: MarkdownMemoryRecord) {
  return [
    '---',
    `id: ${record.id}`,
    `kind: ${record.kind}`,
    `scope: ${record.scope}`,
    record.project ? `project: ${record.project}` : null,
    record.client ? `client: ${record.client}` : null,
    `source: ${record.source}`,
    record.sourceRef ? `source_ref: ${record.sourceRef}` : null,
    `confidence: ${record.confidence}`,
    `sensitivity: ${record.sensitivity}`,
    `tags: [${record.tags.join(', ')}]`,
    `created_at: ${record.createdAt}`,
    `updated_at: ${record.updatedAt}`,
    '---',
    '',
  ].filter(Boolean).join('\n')
}

function scopeFolder(record: Pick<MarkdownMemoryRecord, 'scope' | 'project' | 'client'>) {
  if (record.scope === 'client') return path.join('client_profiles', slugify(record.client ?? 'unknown-client'))
  if (record.scope === 'project') return path.join('projects', slugify(record.project ?? 'general'))
  if (record.scope === 'session') return 'agent_logs'
  return 'approved'
}

function proposalTargetFile(input: Pick<MemoryProposal, 'scope' | 'project' | 'client' | 'title'>) {
  return path.join('memory', scopeFolder(input), `${slugify(input.title)}.md`)
}

function memoryProposalRiskFlags(input: {
  content: string
  source: MemorySource
  sourceRef?: string
  confidence: MemoryConfidence
  sensitivity: MemorySensitivity
  scope: MemoryProposal['scope']
  project?: string
  client?: string
  tags: string[]
}): MemoryProposalRiskFlag[] {
  const flags = new Set<MemoryProposalRiskFlag>()
  const scanned = `${input.content}\n${input.sourceRef ?? ''}\n${input.tags.join(' ')}`.toLowerCase()

  if (input.sensitivity === 'secret-blocked') flags.add('secret-blocked')
  if (input.sensitivity === 'private') flags.add('private-content')
  if (input.client || input.scope === 'client') flags.add('client-scoped')
  if (input.project || input.scope === 'project') flags.add('project-scoped')
  if (input.source === 'import') flags.add('untrusted-import')
  if (input.source === 'tool-output' || input.confidence === 'needs-review') flags.add('needs-source-review')
  if (input.confidence === 'needs-review' || input.confidence === 'inferred') flags.add('unverified-claim')
  if (/\b(gmail|email|inbox|mail|sponsorship|brand deal)\b/.test(scanned)) flags.add('private-inbox')

  return flags.size ? Array.from(flags) : ['safe']
}

function hydrateMemoryProposal(raw: MemoryProposal): MemoryProposal {
  const proposedContent = raw.proposedContent ?? raw.content
  const scope = raw.scope ?? (raw.client ? 'client' : raw.project ? 'project' : 'global')
  const tags = normalizeMemoryTags(raw.tags ?? [])
  const confidence = raw.confidence ?? 'needs-review'
  const sensitivity = raw.sensitivity ?? classifyMemorySensitivity(`${raw.title}\n${proposedContent}`, 'internal')
  const proposal: MemoryProposal = {
    ...raw,
    proposedContent,
    content: raw.content ?? proposedContent,
    scope,
    tags,
    confidence,
    sensitivity,
    riskFlags: raw.riskFlags?.length
      ? raw.riskFlags
      : memoryProposalRiskFlags({
          content: proposedContent,
          source: raw.source ?? 'import',
          sourceRef: raw.sourceRef,
          confidence,
          sensitivity,
          scope,
          project: raw.project,
          client: raw.client,
          tags,
        }),
    targetFile: raw.targetFile ?? proposalTargetFile({ ...raw, scope, title: raw.title }),
  }
  return proposal
}

export async function ensureMemoryVault() {
  await mkdir(runtimePath('memory', 'client_profiles'), { recursive: true })
  await mkdir(runtimePath('memory', 'daily_notes'), { recursive: true })
  await mkdir(runtimePath('memory', 'agent_logs'), { recursive: true })
  await mkdir(runtimePath('memory', 'workflow_history'), { recursive: true })
  await mkdir(runtimePath('memory', 'proposals'), { recursive: true })
  await mkdir(runtimePath('memory', 'approved'), { recursive: true })
  for (const file of CORE_FILES) {
    const fullPath = runtimePath('memory', file)
    try {
      await readFile(fullPath, 'utf8')
    } catch {
      await writeFile(fullPath, `# ${file.replace(/_/g, ' ').replace(/\.md$/, '')}\n\n`, 'utf8')
    }
  }
  return readMemoryVaultIndex()
}

export async function readMemoryVaultIndex() {
  await mkdir(path.dirname(MEMORY_INDEX), { recursive: true })
  return readJsonFile<MarkdownMemoryRecord[]>(MEMORY_INDEX, [])
}

async function writeMemoryVaultIndex(records: MarkdownMemoryRecord[]) {
  await writeJsonFile(MEMORY_INDEX, records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  await writeFile(
    runtimePath('memory', 'index.jsonl'),
    records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''),
    'utf8',
  )
}

export async function searchMemory(options: {
  q?: string
  kind?: MemoryKind
  project?: string
  client?: string
  source?: MemorySource
  confidence?: MemoryConfidence
  sensitivity?: MemorySensitivity
  tag?: string
  limit?: number
} = {}) {
  const query = options.q?.trim().toLowerCase()
  const records = await readMemoryVaultIndex()
  return records
    .filter(record => !options.kind || record.kind === options.kind)
    .filter(record => !options.project || record.project === options.project)
    .filter(record => !options.client || record.client === options.client)
    .filter(record => !options.source || record.source === options.source)
    .filter(record => !options.confidence || record.confidence === options.confidence)
    .filter(record => !options.sensitivity || record.sensitivity === options.sensitivity)
    .filter(record => !options.tag || record.tags.includes(options.tag))
    .filter(record => {
      if (!query) return true
      return [record.title, record.content, record.kind, record.source, record.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
    .slice(0, options.limit ?? 50)
}

export async function buildMarkdownMemoryPack(options: {
  query: string
  project?: string
  projects?: Project[]
  maxTokens?: number
}) {
  const records = await readMemoryVaultIndex()
  return buildMemoryPack({
    query: options.query,
    projectId: options.project,
    projects: options.projects,
    sessions: [],
    items: records.map(memoryRecordToItem),
    maxTokens: options.maxTokens ?? 4000,
    includeSessionSummary: false,
  })
}

export async function listMemoryProposals(status?: MemoryProposal['status']) {
  const proposals = await readJsonFile<MemoryProposal[]>(MEMORY_PROPOSALS, [])
  return proposals.map(hydrateMemoryProposal).filter(proposal => !status || proposal.status === status)
}

export async function createMemoryProposal(input: {
  kind: MemoryKind
  title: string
  content: string
  scope?: MemoryProposal['scope']
  project?: string
  client?: string
  source?: MemorySource
  sourceRef?: string
  confidence?: MemoryConfidence
  sensitivity?: MemorySensitivity
  tags?: string[] | string
  reason?: string
}) {
  const title = input.title.trim()
  const content = input.content.trim()
  const sensitivity = classifyMemorySensitivity(`${title}\n${content}`, input.sensitivity ?? 'internal')
  if (!title || !content) throw new Error('Memory proposal requires title and content.')
  if (sensitivity === 'secret-blocked') throw new Error('Memory proposal blocked because it looks like it may contain a secret.')
  const source = input.source ?? 'human'
  const scope = input.scope ?? (input.client ? 'client' : input.project ? 'project' : 'global')
  const confidence = input.confidence ?? (source === 'tool-output' || source === 'import' ? 'needs-review' : 'confirmed')
  const tags = normalizeMemoryTags(input.tags ?? [])
  const proposal: MemoryProposal = {
    proposalId: makeRuntimeId('memprop'),
    kind: input.kind,
    title,
    proposedContent: content,
    content,
    scope,
    project: input.project,
    client: input.client,
    source,
    sourceRef: input.sourceRef,
    confidence,
    sensitivity,
    tags,
    reason: input.reason ?? 'Proposed by BertOS runtime.',
    riskFlags: memoryProposalRiskFlags({
      content,
      source,
      sourceRef: input.sourceRef,
      confidence,
      sensitivity,
      scope,
      project: input.project,
      client: input.client,
      tags,
    }),
    targetFile: proposalTargetFile({ scope, project: input.project, client: input.client, title }),
    status: 'pending',
    createdAt: nowIso(),
  }
  const proposals = await readJsonFile<MemoryProposal[]>(MEMORY_PROPOSALS, [])
  await writeJsonFile(MEMORY_PROPOSALS, [proposal, ...proposals])
  return proposal
}

export async function writeApprovedMemory(proposal: MemoryProposal) {
  const now = nowIso()
  const record: MarkdownMemoryRecord = {
    id: makeRuntimeId('mem'),
    kind: proposal.kind,
    title: proposal.title,
    content: proposal.proposedContent ?? proposal.content,
    scope: proposal.scope,
    project: proposal.project,
    client: proposal.client,
    source: proposal.source,
    sourceRef: proposal.sourceRef,
    confidence: proposal.confidence === 'needs-review' ? 'confirmed' : proposal.confidence,
    sensitivity: proposal.sensitivity,
    tags: proposal.tags,
    createdAt: now,
    updatedAt: now,
  }
  const folder = runtimePath('memory', scopeFolder(record))
  await mkdir(folder, { recursive: true })
  const fileName = `${record.createdAt.slice(0, 10)}_${slugify(record.title)}_${record.id}.md`
  const filePath = path.join(folder, fileName)
  await writeFile(filePath, `${frontmatter(record)}# ${record.title}\n\n${record.content}\n`, 'utf8')
  record.filePath = path.relative(runtimePath(), filePath)
  const records = await readMemoryVaultIndex()
  await writeMemoryVaultIndex([record, ...records.filter(item => item.id !== record.id)])
  return record
}

export async function approveMemoryProposal(proposalId: string) {
  const proposals = await readJsonFile<MemoryProposal[]>(MEMORY_PROPOSALS, [])
  const proposal = proposals.map(hydrateMemoryProposal).find(item => item.proposalId === proposalId)
  if (!proposal) throw new Error('Memory proposal not found.')
  if (proposal.status !== 'pending') return { proposal, record: null }
  const record = await writeApprovedMemory(proposal)
  const updated: MemoryProposal = { ...proposal, status: 'approved', reviewedAt: nowIso(), reviewedBy: 'local-user', targetFile: record.filePath ?? proposal.targetFile }
  await writeJsonFile(MEMORY_PROPOSALS, proposals.map(item => item.proposalId === proposalId ? updated : hydrateMemoryProposal(item)))
  return { proposal: updated, record }
}

export async function updateMemoryProposal(proposalId: string, input: {
  title?: string
  content?: string
  proposedContent?: string
  reason?: string
  tags?: string[] | string
  targetFile?: string
}) {
  const proposals = await readJsonFile<MemoryProposal[]>(MEMORY_PROPOSALS, [])
  const proposal = proposals.map(hydrateMemoryProposal).find(item => item.proposalId === proposalId)
  if (!proposal) throw new Error('Memory proposal not found.')
  if (proposal.status !== 'pending') throw new Error('Only pending memory proposals can be edited.')

  const title = input.title?.trim() || proposal.title
  const proposedContent = (input.proposedContent ?? input.content)?.trim() || proposal.proposedContent
  const sensitivity = classifyMemorySensitivity(`${title}\n${proposedContent}`, proposal.sensitivity)
  if (sensitivity === 'secret-blocked') throw new Error('Memory proposal blocked because it looks like it may contain a secret.')
  const tags = input.tags === undefined ? proposal.tags : normalizeMemoryTags(input.tags)
  const updated: MemoryProposal = {
    ...proposal,
    title,
    proposedContent,
    content: proposedContent,
    sensitivity,
    tags,
    reason: input.reason?.trim() || proposal.reason,
    targetFile: input.targetFile?.trim() || proposalTargetFile({ ...proposal, title }),
    riskFlags: memoryProposalRiskFlags({
      content: proposedContent,
      source: proposal.source,
      sourceRef: proposal.sourceRef,
      confidence: proposal.confidence,
      sensitivity,
      scope: proposal.scope,
      project: proposal.project,
      client: proposal.client,
      tags,
    }),
  }
  await writeJsonFile(MEMORY_PROPOSALS, proposals.map(item => item.proposalId === proposalId ? updated : hydrateMemoryProposal(item)))
  return updated
}

export async function rejectMemoryProposal(proposalId: string) {
  const proposals = await readJsonFile<MemoryProposal[]>(MEMORY_PROPOSALS, [])
  const proposal = proposals.map(hydrateMemoryProposal).find(item => item.proposalId === proposalId)
  if (!proposal) throw new Error('Memory proposal not found.')
  const updated: MemoryProposal = { ...proposal, status: 'rejected', reviewedAt: nowIso(), reviewedBy: 'local-user' }
  await writeJsonFile(MEMORY_PROPOSALS, proposals.map(item => item.proposalId === proposalId ? updated : hydrateMemoryProposal(item)))
  return updated
}
