import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'

import {
  OUTPUT_KIND_VALUES,
  OUTPUT_REGISTRY_FORMAT,
  OUTPUT_REGISTRY_SCHEMA_VERSION,
  OUTPUT_REGISTRY_VERSION,
  OUTPUT_STATUS_VALUES,
  type CreateOutputArtifactInput,
  type CreateOutputInput,
  type JsonObject,
  type JsonValue,
  type OutputArtifact,
  type OutputArtifactFile,
  type OutputArtifactSearch,
  type OutputIndexEntry,
  type OutputKind,
  type OutputRecord,
  type OutputRegistryEvent,
  type OutputRegistryEventType,
  type OutputRegistryIndex,
  type OutputRegistryListOptions,
  type OutputRegistryListResult,
  type OutputRegistryStorage,
  type OutputRegistryVersion,
  type OutputSource,
  type OutputStatus,
  type UpdateOutputInput,
} from './types'
import { runtimePath } from '../runtime-store'

const RECORDS_DIR = 'records'
const FILES_DIR = 'files'
const INDEX_FILE = 'registry.json'
const EVENTS_FILE = 'events.jsonl'
const OUTPUT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MAX_LIMIT = 200

export type OutputRegistryErrorCode = 'invalid-input' | 'not-found' | 'conflict' | 'storage-error'

export class OutputRegistryError extends Error {
  code: OutputRegistryErrorCode

  constructor(code: OutputRegistryErrorCode, message: string) {
    super(message)
    this.name = 'OutputRegistryError'
    this.code = code
  }
}

export function getOutputRegistryVersion(): OutputRegistryVersion {
  return {
    schemaVersion: OUTPUT_REGISTRY_SCHEMA_VERSION,
    format: OUTPUT_REGISTRY_FORMAT,
    registryVersion: OUTPUT_REGISTRY_VERSION,
  }
}

export function getOutputRegistryStorage(repoRoot = process.cwd()): OutputRegistryStorage {
  const resolvedRepoRoot = resolve(repoRoot)
  const rootDir = runtimePath('outputs')

  const recordsDir = resolve(rootDir, RECORDS_DIR)
  assertInside(recordsDir, rootDir, 'Output records directory')
  const filesDir = resolve(rootDir, FILES_DIR)
  assertInside(filesDir, rootDir, 'Output files directory')

  return {
    kind: 'local-json-jsonl',
    repoRoot: resolvedRepoRoot,
    rootDir,
    recordsDir,
    filesDir,
    indexPath: resolve(rootDir, INDEX_FILE),
    eventsPath: resolve(rootDir, EVENTS_FILE),
  }
}

export function createOutputId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `out_${stamp}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export async function createOutput(input: CreateOutputInput): Promise<OutputRecord> {
  const storage = getOutputRegistryStorage()
  await ensureStorage(storage)

  const id = validateOutputId(input.id ?? createOutputId())
  const recordPath = getRecordPath(storage, id)
  if (await exists(recordPath)) {
    throw new OutputRegistryError('conflict', `Output already exists: ${id}`)
  }

  const now = nowIso()
  const record: OutputRecord = {
    id,
    title: normalizeRequiredString(input.title, 'title', 180),
    kind: normalizeKind(input.kind),
    status: normalizeStatus(input.status),
    summary: normalizeOptionalString(input.summary, 'summary', 1000),
    tags: normalizeTags(input.tags),
    source: normalizeSource(input.source),
    payload: normalizeJsonValue(input.payload ?? null),
    version: {
      ...getOutputRegistryVersion(),
      recordVersion: 1,
    },
    createdAt: now,
    updatedAt: now,
  }

  await persistRecordMutation(storage, record, 'created', 'Output created.')
  return record
}

export async function getOutput(id: string): Promise<OutputRecord | null> {
  const storage = getOutputRegistryStorage()
  const recordPath = getRecordPath(storage, validateOutputId(id))
  const raw = await readJsonFile<unknown>(recordPath)
  if (raw === null) return null
  return normalizeRecordFromDisk(raw, recordPath)
}

export async function updateOutput(id: string, input: UpdateOutputInput): Promise<OutputRecord> {
  return updateOutputWithEvent(id, input, 'updated', 'Output updated.')
}

export async function archiveOutput(id: string): Promise<OutputRecord> {
  return updateOutputWithEvent(id, { status: 'archived' }, 'archived', 'Output archived.')
}

export async function deleteOutput(id: string): Promise<{ id: string; deleted: true }> {
  const storage = getOutputRegistryStorage()
  const outputId = validateOutputId(id)
  const existing = await requireOutput(outputId)

  try {
    await unlink(getRecordPath(storage, outputId))
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw new OutputRegistryError('storage-error', `Could not delete output ${outputId}.`)
    }
  }

  await writeIndexFromRecords(storage)
  await appendRegistryEvent(storage, {
    eventType: 'deleted',
    outputId,
    recordVersion: existing.version.recordVersion,
    summary: 'Output deleted.',
  })

  return { id: outputId, deleted: true }
}

export async function readOutputIndex(): Promise<OutputRegistryIndex> {
  const storage = getOutputRegistryStorage()
  const records = await readAllRecords(storage)
  return buildIndex(storage, records)
}

export async function listOutputs(options: OutputRegistryListOptions = {}): Promise<OutputRegistryListResult> {
  const index = await readOutputIndex()
  const totalCount = index.outputs.length
  const filtered = applyListFilters(index.outputs, options)

  return {
    ...index,
    outputs: filtered,
    count: filtered.length,
    totalCount,
  }
}

export async function readOutputEvents(options: { outputId?: string; limit?: number } = {}): Promise<OutputRegistryEvent[]> {
  const storage = getOutputRegistryStorage()
  const raw = await readTextFile(storage.eventsPath)
  if (!raw.trim()) return []

  const events = raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => normalizeEventFromDisk(parseJsonLine(line, index + 1)))

  const outputId = options.outputId ? validateOutputId(options.outputId) : undefined
  const filtered = outputId ? events.filter(event => event.outputId === outputId) : events
  const limit = clampLimit(options.limit ?? filtered.length)
  return filtered.slice(-limit)
}

export async function createOutputArtifact(input: CreateOutputArtifactInput): Promise<OutputArtifact> {
  const storage = getOutputRegistryStorage()
  const previewKind = input.preview?.kind ?? input.preview?.type ?? inferPreviewKind(input.type)
  const checksum = input.content ? sha256(input.content) : undefined
  const payload: Record<string, unknown> = {
    artifactId: '',
    outputId: '',
    type: input.type,
    title: input.title,
    files: [],
    preview: {
      kind: previewKind,
      type: previewKind,
      title: input.preview?.title ?? input.title,
      path: input.preview?.path,
      mimeType: input.preview?.mimeType,
      component: input.preview?.component ?? previewComponent(previewKind),
      summary: input.preview?.summary,
    },
    skillId: input.skillId,
    pluginIds: input.pluginIds ?? [],
    agentRunId: input.agentRunId,
    workflowRunId: input.workflowRunId,
    groundingPackIds: input.groundingPackIds ?? [],
    contextPackId: input.contextPackId,
    promptId: input.promptId,
    promptText: input.promptText,
    project: input.project,
    client: input.client,
    sourceLinks: input.sourceLinks ?? [],
    backlinks: input.backlinks ?? [],
    status: input.status ?? 'draft',
    tags: input.tags ?? [],
    memoryWritebackCandidates: input.memoryWritebackCandidates ?? [],
    version: 1,
    versionHistory: checksum ? [{ version: 1, checksum, createdAt: nowIso(), reason: 'initial-create' }] : [],
    checksum,
    metadata: input.metadata ?? {},
    content: input.content,
    fileName: input.fileName,
  }
  const record = await createOutput({
    title: input.title,
    kind: 'artifact',
    status: input.status ?? 'draft',
    tags: input.tags,
    source: {
      agentId: input.agentRunId,
      runId: input.workflowRunId,
      missionId: input.skillId,
    },
    payload: payload as JsonObject,
  })
  const artifactFiles = input.content
    ? [await writeOutputArtifactContentFile(storage, record.id, {
        content: input.content,
        fileName: input.fileName,
        previewKind,
      })]
    : []
  const preview: JsonObject = isPlainObject(payload.preview) ? { ...payload.preview } as JsonObject : {}
  if (artifactFiles[0]) {
    preview.path = typeof preview.path === 'string' ? preview.path : artifactFiles[0].path
    if (typeof preview.mimeType !== 'string' && artifactFiles[0].mimeType) {
      preview.mimeType = artifactFiles[0].mimeType
    }
  }
  const updatedPayload: JsonObject = {
    ...(isPlainObject(record.payload) ? record.payload : {}),
    artifactId: record.id,
    outputId: record.id,
    files: artifactFiles as unknown as JsonValue,
    preview,
  }
  const updated = await updateOutput(record.id, { payload: updatedPayload })
  return toOutputArtifact(updated)
}

export async function getOutputArtifact(outputId: string): Promise<OutputArtifact | null> {
  const record = await getOutput(outputId)
  return record ? toOutputArtifact(record) : null
}

export async function listOutputArtifacts(limit = 100): Promise<OutputArtifact[]> {
  const registry = await listOutputs({ limit, includeArchived: true })
  const records = await Promise.all(registry.outputs.map(entry => getOutput(entry.id)))
  return records.filter((record): record is OutputRecord => Boolean(record)).map(toOutputArtifact)
}

export async function searchOutputArtifacts(search: OutputArtifactSearch = {}): Promise<OutputArtifact[]> {
  const query = search.query?.trim().toLowerCase()
  const artifacts = await listOutputArtifacts(search.limit ?? MAX_LIMIT)
  return artifacts
    .filter(artifact => !search.type || artifact.type === search.type)
    .filter(artifact => !search.status || artifact.status === search.status)
    .filter(artifact => !search.skillId || artifact.skillId === search.skillId)
    .filter(artifact => !search.project || artifact.project === search.project)
    .filter(artifact => !search.client || artifact.client === search.client)
    .filter(artifact => !search.tag || artifact.tags.includes(search.tag))
    .filter(artifact => !search.tags?.length || search.tags.every(tag => artifact.tags.includes(tag)))
    .filter(artifact => {
      if (!query) return true
      return [
        artifact.outputId,
        artifact.title,
        artifact.type,
        artifact.skillId,
        artifact.project,
        artifact.client,
        ...artifact.tags,
        ...(artifact.sourceLinks ?? []),
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
    .slice(0, search.limit ?? MAX_LIMIT)
}

export async function updateOutputStatus(outputId: string, status: OutputStatus): Promise<OutputArtifact | null> {
  const record = await getOutput(outputId)
  if (!record) return null
  const payload = isPlainObject(record.payload) ? { ...record.payload, status } : record.payload
  return toOutputArtifact(await updateOutput(outputId, { status, payload }))
}

async function updateOutputWithEvent(
  id: string,
  input: UpdateOutputInput,
  eventType: OutputRegistryEventType,
  eventSummary: string,
): Promise<OutputRecord> {
  const storage = getOutputRegistryStorage()
  const existing = await requireOutput(validateOutputId(id))
  const now = nowIso()

  const next: OutputRecord = {
    ...existing,
    title: input.title === undefined ? existing.title : normalizeRequiredString(input.title, 'title', 180),
    kind: input.kind === undefined ? existing.kind : normalizeKind(input.kind),
    status: input.status === undefined ? existing.status : normalizeStatus(input.status),
    summary: input.summary === undefined ? existing.summary : normalizeOptionalString(input.summary, 'summary', 1000),
    tags: input.tags === undefined ? existing.tags : normalizeTags(input.tags),
    source: input.source === undefined ? existing.source : normalizeSource(input.source),
    payload: input.payload === undefined ? existing.payload : normalizeJsonValue(input.payload),
    version: {
      ...getOutputRegistryVersion(),
      recordVersion: existing.version.recordVersion + 1,
    },
    updatedAt: now,
  }

  await persistRecordMutation(storage, next, eventType, eventSummary)
  return next
}

async function requireOutput(id: string): Promise<OutputRecord> {
  const output = await getOutput(id)
  if (!output) throw new OutputRegistryError('not-found', `Output not found: ${id}`)
  return output
}

async function persistRecordMutation(
  storage: OutputRegistryStorage,
  record: OutputRecord,
  eventType: OutputRegistryEventType,
  eventSummary: string,
): Promise<void> {
  await writeJsonAtomic(getRecordPath(storage, record.id), record)
  await writeIndexFromRecords(storage)
  await appendRegistryEvent(storage, {
    eventType,
    outputId: record.id,
    recordVersion: record.version.recordVersion,
    summary: eventSummary,
  })
}

async function ensureStorage(storage: OutputRegistryStorage): Promise<void> {
  await mkdir(storage.recordsDir, { recursive: true })
  await mkdir(storage.filesDir, { recursive: true })
}

async function writeOutputArtifactContentFile(
  storage: OutputRegistryStorage,
  outputId: string,
  input: {
    content: string
    fileName?: string
    previewKind: NonNullable<OutputArtifact['preview']>['kind']
  },
): Promise<OutputArtifactFile> {
  const outputDir = resolve(storage.filesDir, outputId)
  assertInside(outputDir, storage.filesDir, 'Output artifact directory')
  await mkdir(outputDir, { recursive: true })

  const fileName = normalizeArtifactFileName(input.fileName, input.previewKind)
  const targetPath = await nextAvailableArtifactPath(outputDir, fileName)
  await writeFile(targetPath, input.content, 'utf8')

  const fileStat = await stat(targetPath)
  return {
    path: relative(storage.repoRoot, targetPath),
    name: basename(targetPath),
    mimeType: mimeTypeForFile(targetPath, input.previewKind),
    sizeBytes: fileStat.size,
    sha256: sha256(input.content),
    role: 'primary',
  }
}

async function nextAvailableArtifactPath(outputDir: string, fileName: string): Promise<string> {
  const parsedExt = extname(fileName)
  const stem = parsedExt ? fileName.slice(0, -parsedExt.length) : fileName
  for (let version = 1; version < 1000; version += 1) {
    const candidateName = version === 1 ? fileName : `${stem}-v${version}${parsedExt}`
    const candidatePath = resolve(outputDir, candidateName)
    assertInside(candidatePath, outputDir, 'Output artifact file')
    if (!(await exists(candidatePath))) return candidatePath
  }
  throw new OutputRegistryError('conflict', 'Could not find an available version-safe output file path.')
}

function normalizeArtifactFileName(fileName: string | undefined, previewKind: NonNullable<OutputArtifact['preview']>['kind']) {
  const fallback = `artifact.${extensionForPreview(previewKind)}`
  const raw = basename((fileName ?? fallback).trim() || fallback)
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  const safe = cleaned || fallback
  return extname(safe) ? safe : `${safe}.${extensionForPreview(previewKind)}`
}

function extensionForPreview(kind: NonNullable<OutputArtifact['preview']>['kind']) {
  if (kind === 'json' || kind === 'diagram' || kind === 'canvas') return 'json'
  if (kind === 'html') return 'html'
  if (kind === 'code') return 'txt'
  if (kind === 'image') return 'png'
  if (kind === 'video') return 'mp4'
  if (kind === 'audio') return 'mp3'
  return 'md'
}

function mimeTypeForFile(filePath: string, previewKind: NonNullable<OutputArtifact['preview']>['kind']) {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.json') return 'application/json'
  if (ext === '.html') return 'text/html'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.md' || previewKind === 'markdown') return 'text/markdown'
  return 'text/plain'
}

async function writeIndexFromRecords(storage: OutputRegistryStorage): Promise<OutputRegistryIndex> {
  await ensureStorage(storage)
  const records = await readAllRecords(storage)
  const index = buildIndex(storage, records)
  await writeJsonAtomic(storage.indexPath, index)
  return index
}

async function readAllRecords(storage: OutputRegistryStorage): Promise<OutputRecord[]> {
  let files: string[]
  try {
    files = await readdir(storage.recordsDir)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw new OutputRegistryError('storage-error', 'Could not read output records directory.')
  }

  const records: OutputRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const recordPath = resolve(storage.recordsDir, file)
    assertInside(recordPath, storage.recordsDir, 'Output record')
    const raw = await readJsonFile<unknown>(recordPath)
    if (raw !== null) records.push(normalizeRecordFromDisk(raw, recordPath))
  }

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function buildIndex(storage: OutputRegistryStorage, records: OutputRecord[]): OutputRegistryIndex {
  return {
    version: getOutputRegistryVersion(),
    storage,
    generatedAt: nowIso(),
    outputs: records.map(toIndexEntry),
  }
}

function toIndexEntry(record: OutputRecord): OutputIndexEntry {
  return {
    id: record.id,
    title: record.title,
    kind: record.kind,
    status: record.status,
    summary: record.summary,
    tags: record.tags,
    source: record.source,
    payloadBytes: Buffer.byteLength(JSON.stringify(record.payload), 'utf8'),
    recordVersion: record.version.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function toOutputArtifact(record: OutputRecord): OutputArtifact {
  const payload = isPlainObject(record.payload) ? record.payload : {}
  const files = (Array.isArray(payload.files) ? payload.files.filter(isPlainObject) : []) as Record<string, unknown>[]
  const tags = Array.isArray(payload.tags) ? payload.tags.map(String) : record.tags
  return {
    artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : record.id,
    outputId: typeof payload.outputId === 'string' ? payload.outputId : record.id,
    type: typeof payload.type === 'string' ? payload.type : record.kind,
    title: typeof payload.title === 'string' ? payload.title : record.title,
    summary: record.summary,
    files: files.map(file => ({
      path: typeof file.path === 'string' ? file.path : '',
      name: typeof file.name === 'string' ? file.name : undefined,
      mimeType: typeof file.mimeType === 'string' ? file.mimeType : undefined,
      sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : undefined,
      sha256: typeof file.sha256 === 'string' ? file.sha256 : undefined,
      role: typeof file.role === 'string' ? file.role : undefined,
    })),
    preview: isPlainObject(payload.preview) ? {
      kind: typeof payload.preview.kind === 'string' ? payload.preview.kind as any : undefined,
      type: typeof payload.preview.type === 'string' ? payload.preview.type as any : undefined,
      title: typeof payload.preview.title === 'string' ? payload.preview.title : undefined,
      path: typeof payload.preview.path === 'string' ? payload.preview.path : undefined,
      mimeType: typeof payload.preview.mimeType === 'string' ? payload.preview.mimeType : undefined,
      component: typeof payload.preview.component === 'string' ? payload.preview.component : undefined,
      summary: typeof payload.preview.summary === 'string' ? payload.preview.summary : undefined,
    } : undefined,
    payload: record.payload,
    source: record.source,
    tags,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    skillId: typeof payload.skillId === 'string' ? payload.skillId : undefined,
    pluginIds: Array.isArray(payload.pluginIds) ? payload.pluginIds.map(String) : [],
    agentRunId: typeof payload.agentRunId === 'string' ? payload.agentRunId : undefined,
    workflowRunId: typeof payload.workflowRunId === 'string' ? payload.workflowRunId : undefined,
    groundingPackIds: Array.isArray(payload.groundingPackIds) ? payload.groundingPackIds.map(String) : [],
    contextPackId: typeof payload.contextPackId === 'string' ? payload.contextPackId : undefined,
    promptId: typeof payload.promptId === 'string' ? payload.promptId : undefined,
    promptText: typeof payload.promptText === 'string' ? payload.promptText : undefined,
    project: typeof payload.project === 'string' ? payload.project : undefined,
    client: typeof payload.client === 'string' ? payload.client : undefined,
    sourceLinks: Array.isArray(payload.sourceLinks) ? payload.sourceLinks.map(String) : [],
    backlinks: Array.isArray(payload.backlinks) ? payload.backlinks.map(String) : [],
    status: record.status,
    memoryWritebackCandidates: Array.isArray(payload.memoryWritebackCandidates) ? payload.memoryWritebackCandidates.map(String) : [],
    version: record.version.recordVersion,
    versionHistory: parseOutputVersionHistory(payload.versionHistory, record.createdAt),
    checksum: typeof payload.checksum === 'string' ? payload.checksum : undefined,
    metadata: isPlainObject(payload.metadata) ? payload.metadata as JsonObject : undefined,
  }
}

function parseOutputVersionHistory(value: unknown, fallbackCreatedAt: string): NonNullable<OutputArtifact['versionHistory']> {
  if (!Array.isArray(value)) return []
  return value.filter(isPlainObject).map(item => ({
    version: typeof item.version === 'number' ? item.version : 1,
    checksum: typeof item.checksum === 'string' ? item.checksum : undefined,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : fallbackCreatedAt,
    reason: typeof item.reason === 'string' ? item.reason : undefined,
  }))
}

function inferPreviewKind(type: string): NonNullable<OutputArtifact['preview']>['kind'] {
  if (type === 'diagram') return 'diagram'
  if (type === 'design_canvas') return 'canvas'
  if (type === 'motion_composition' || type === 'rendered_video') return 'video'
  if (type === 'image_asset' || type === 'thumbnail') return 'image'
  if (type === 'email_priority_table' || type === 'publishing_queue_item') return 'json'
  return 'markdown'
}

function previewComponent(kind: NonNullable<OutputArtifact['preview']>['kind']) {
  if (kind === 'diagram') return 'DiagramPreview'
  if (kind === 'canvas') return 'CanvasPreview'
  if (kind === 'video') return 'VideoPreview'
  if (kind === 'image') return 'ImagePreview'
  if (kind === 'json') return 'JsonPreview'
  return 'MarkdownPreview'
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function applyListFilters(entries: OutputIndexEntry[], options: OutputRegistryListOptions): OutputIndexEntry[] {
  const statuses = toArray(options.status)
  const kinds = toArray(options.kind)
  const tags = toArray(options.tag).map(tag => tag.toLowerCase())
  const query = options.query?.trim().toLowerCase()
  const limit = clampLimit(options.limit ?? MAX_LIMIT)

  return entries
    .filter(entry => options.includeArchived || entry.status !== 'archived')
    .filter(entry => statuses.length === 0 || statuses.includes(entry.status))
    .filter(entry => kinds.length === 0 || kinds.includes(entry.kind))
    .filter(entry => tags.length === 0 || tags.every(tag => entry.tags.some(entryTag => entryTag.toLowerCase() === tag)))
    .filter(entry => {
      if (!query) return true
      return [
        entry.id,
        entry.title,
        entry.summary ?? '',
        entry.kind,
        entry.status,
        ...entry.tags,
      ].some(value => value.toLowerCase().includes(query))
    })
    .slice(0, limit)
}

function normalizeRecordFromDisk(value: unknown, recordPath: string): OutputRecord {
  if (!isPlainObject(value)) {
    throw new OutputRegistryError('storage-error', `Output record is not an object: ${recordPath}`)
  }

  const record = value as Record<string, unknown>
  const id = validateOutputId(asString(record.id, 'id'))
  return {
    id,
    title: normalizeRequiredString(record.title, 'title', 180),
    kind: normalizeKind(record.kind),
    status: normalizeStatus(record.status),
    summary: normalizeOptionalString(record.summary, 'summary', 1000),
    tags: normalizeTags(record.tags),
    source: normalizeSource(record.source),
    payload: normalizeJsonValue(record.payload ?? null),
    version: {
      ...getOutputRegistryVersion(),
      recordVersion: normalizeRecordVersion(record.version),
    },
    createdAt: normalizeIsoString(record.createdAt, 'createdAt'),
    updatedAt: normalizeIsoString(record.updatedAt, 'updatedAt'),
  }
}

function normalizeRecordVersion(value: unknown): number {
  if (isPlainObject(value) && typeof value.recordVersion === 'number' && Number.isInteger(value.recordVersion) && value.recordVersion > 0) {
    return value.recordVersion
  }
  return 1
}

function normalizeEventFromDisk(value: unknown): OutputRegistryEvent {
  if (!isPlainObject(value)) {
    throw new OutputRegistryError('storage-error', 'Output registry event is not an object.')
  }
  const event = value as Record<string, unknown>
  return {
    eventId: normalizeRequiredString(event.eventId, 'eventId', 160),
    eventType: normalizeEventType(event.eventType),
    outputId: validateOutputId(asString(event.outputId, 'outputId')),
    recordVersion: normalizePositiveInteger(event.recordVersion, 'recordVersion'),
    at: normalizeIsoString(event.at, 'at'),
    actor: normalizeRequiredString(event.actor, 'actor', 80),
    summary: normalizeOptionalString(event.summary, 'summary', 1000),
    version: getOutputRegistryVersion(),
  }
}

async function appendRegistryEvent(
  storage: OutputRegistryStorage,
  event: Omit<OutputRegistryEvent, 'eventId' | 'at' | 'actor' | 'version'> & { actor?: string },
): Promise<void> {
  await ensureStorage(storage)
  const { actor = 'local', ...eventData } = event
  const line: OutputRegistryEvent = {
    eventId: randomUUID(),
    ...eventData,
    at: nowIso(),
    actor,
    version: getOutputRegistryVersion(),
  }
  await appendFile(storage.eventsPath, `${JSON.stringify(line)}\n`, 'utf8')
}

function getRecordPath(storage: OutputRegistryStorage, id: string): string {
  const outputId = validateOutputId(id)
  const recordPath = resolve(storage.recordsDir, `${outputId}.json`)
  assertInside(recordPath, storage.recordsDir, 'Output record')
  return recordPath
}

function validateOutputId(id: string): string {
  const value = id.trim()
  if (!OUTPUT_ID_PATTERN.test(value)) {
    throw new OutputRegistryError('invalid-input', 'Output id must be 1-128 URL-safe characters.')
  }
  return value
}

function normalizeKind(value: unknown): OutputKind {
  if (value === undefined || value === null) return 'other'
  if (typeof value === 'string' && (OUTPUT_KIND_VALUES as readonly string[]).includes(value)) {
    return value as OutputKind
  }
  throw new OutputRegistryError('invalid-input', `Invalid output kind. Allowed: ${OUTPUT_KIND_VALUES.join(', ')}`)
}

function normalizeStatus(value: unknown): OutputStatus {
  if (value === undefined || value === null) return 'ready'
  if (typeof value === 'string' && (OUTPUT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as OutputStatus
  }
  throw new OutputRegistryError('invalid-input', `Invalid output status. Allowed: ${OUTPUT_STATUS_VALUES.join(', ')}`)
}

function normalizeEventType(value: unknown): OutputRegistryEventType {
  if (value === 'created' || value === 'updated' || value === 'archived' || value === 'deleted') return value
  throw new OutputRegistryError('storage-error', 'Invalid output registry event type.')
}

function normalizeRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new OutputRegistryError('invalid-input', `${field} must be a string.`)
  }
  const trimmed = value.trim()
  if (!trimmed) throw new OutputRegistryError('invalid-input', `${field} is required.`)
  if (trimmed.length > maxLength) {
    throw new OutputRegistryError('invalid-input', `${field} must be ${maxLength} characters or fewer.`)
  }
  return trimmed
}

function normalizeOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined
  return normalizeRequiredString(value, field, maxLength)
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new OutputRegistryError('invalid-input', 'tags must be an array of strings.')

  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of value) {
    const tag = normalizeRequiredString(item, 'tag', 64)
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  if (tags.length > 32) throw new OutputRegistryError('invalid-input', 'tags must contain 32 entries or fewer.')
  return tags
}

function normalizeSource(value: unknown): OutputSource | undefined {
  if (value === undefined || value === null) return undefined
  if (!isPlainObject(value)) throw new OutputRegistryError('invalid-input', 'source must be an object.')

  const input = value as Record<string, unknown>
  const source: OutputSource = {}
  for (const key of ['agentId', 'providerId', 'taskId', 'missionId', 'runId', 'route'] as const) {
    if (input[key] === undefined || input[key] === null) continue
    source[key] = normalizeRequiredString(input[key], `source.${key}`, 180)
  }

  return Object.keys(source).length ? source : undefined
}

function normalizeJsonValue(value: unknown, field = 'payload'): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new OutputRegistryError('invalid-input', `${field} contains a non-finite number.`)
    return value
  }
  if (Array.isArray(value)) return value.map((item, index) => normalizeJsonValue(item, `${field}[${index}]`))
  if (isPlainObject(value)) {
    const output: JsonObject = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      output[key] = normalizeJsonValue(item, `${field}.${key}`)
    }
    return output
  }
  throw new OutputRegistryError('invalid-input', `${field} must be JSON-serializable.`)
}

function normalizePositiveInteger(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  throw new OutputRegistryError('storage-error', `${field} must be a positive integer.`)
}

function normalizeIsoString(value: unknown, field: string): string {
  const text = normalizeRequiredString(value, field, 80)
  const time = Date.parse(text)
  if (Number.isNaN(time)) throw new OutputRegistryError('storage-error', `${field} must be an ISO timestamp.`)
  return text
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new OutputRegistryError('storage-error', `${field} must be a string.`)
  return value
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return MAX_LIMIT
  return Math.min(Math.floor(value), MAX_LIMIT)
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  const raw = await readTextFile(path)
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new OutputRegistryError('storage-error', `Invalid JSON file: ${path}`)
  }
}

function parseJsonLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line)
  } catch {
    throw new OutputRegistryError('storage-error', `Invalid JSONL event at line ${lineNumber}.`)
  }
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return ''
    throw new OutputRegistryError('storage-error', `Could not read ${path}.`)
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, path)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return false
    throw new OutputRegistryError('storage-error', `Could not inspect ${path}.`)
  }
}

function assertInside(target: string, parent: string, label: string): void {
  const relativePath = relative(parent, target)
  if (relativePath && (relativePath.startsWith('..') || isAbsolute(relativePath))) {
    throw new OutputRegistryError('invalid-input', `${label} must stay inside the BertOS repo.`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function nowIso(): string {
  return new Date().toISOString()
}
