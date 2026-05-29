export const OUTPUT_REGISTRY_SCHEMA_VERSION = 1 as const
export const OUTPUT_REGISTRY_FORMAT = 'bertos.outputs.local-json-jsonl' as const
export const OUTPUT_REGISTRY_VERSION = '2026-05-25' as const

export const OUTPUT_KIND_VALUES = [
  'agent-run',
  'plan',
  'patch',
  'validation',
  'artifact',
  'message',
  'note',
  'other',
] as const

export const OUTPUT_STATUS_VALUES = ['draft', 'ready', 'reviewed', 'approved', 'scheduled', 'published', 'failed', 'archived'] as const

export type OutputKind = (typeof OUTPUT_KIND_VALUES)[number]
export type OutputStatus = (typeof OUTPUT_STATUS_VALUES)[number]
export type OutputArtifactType = string
export type OutputArtifactStatus = OutputStatus

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

export interface JsonObject {
  [key: string]: JsonValue
}

export interface OutputRegistryVersion {
  schemaVersion: typeof OUTPUT_REGISTRY_SCHEMA_VERSION
  format: typeof OUTPUT_REGISTRY_FORMAT
  registryVersion: typeof OUTPUT_REGISTRY_VERSION
}

export interface OutputRecordVersion extends OutputRegistryVersion {
  recordVersion: number
}

export interface OutputSource {
  agentId?: string
  providerId?: string
  taskId?: string
  missionId?: string
  runId?: string
  route?: string
}

export interface OutputArtifactFile {
  path: string
  name?: string
  mimeType?: string
  sizeBytes?: number
  sha256?: string
  role?: string
}

export interface PreviewDescriptor {
  kind?: 'markdown' | 'json' | 'html' | 'image' | 'video' | 'file' | 'none' | 'code' | 'audio' | 'table' | 'diagram' | 'canvas' | 'folder'
  type?: 'markdown' | 'json' | 'html' | 'image' | 'video' | 'file' | 'none' | 'code' | 'audio' | 'table' | 'diagram' | 'canvas' | 'folder'
  title?: string
  url?: string
  path?: string
  mimeType?: string
  width?: number
  height?: number
  component?: string
  summary?: string
}

export interface OutputArtifactSearch {
  query?: string
  type?: OutputArtifactType
  status?: OutputStatus
  skillId?: string
  project?: string
  client?: string
  tag?: string
  tags?: string[]
  limit?: number
  createdAfter?: string
  createdBefore?: string
}

export interface OutputArtifact {
  artifactId: string
  outputId: string
  type: OutputArtifactType
  title: string
  summary?: string
  files: OutputArtifactFile[]
  preview?: PreviewDescriptor
  payload?: JsonValue
  source?: OutputSource
  tags: string[]
  createdAt: string
  updatedAt: string
  skillId?: string
  pluginIds?: string[]
  agentRunId?: string
  workflowRunId?: string
  groundingPackIds?: string[]
  contextPackId?: string
  promptId?: string
  promptText?: string
  project?: string
  client?: string
  sourceLinks?: string[]
  backlinks?: string[]
  status?: OutputArtifactStatus
  memoryWritebackCandidates?: string[]
  version?: number
  versionHistory?: Array<{ version: number; checksum?: string; createdAt: string; reason?: string }>
  checksum?: string
  metadata?: JsonObject
}

export interface CreateOutputArtifactInput {
  type: OutputArtifactType
  title: string
  content?: string
  fileName?: string
  skillId?: string
  pluginIds?: string[]
  agentRunId?: string
  workflowRunId?: string
  groundingPackIds?: string[]
  contextPackId?: string
  promptId?: string
  promptText?: string
  project?: string
  client?: string
  sourceLinks?: string[]
  backlinks?: string[]
  preview?: Partial<PreviewDescriptor>
  status?: OutputArtifactStatus
  tags?: string[]
  memoryWritebackCandidates?: string[]
  metadata?: JsonObject
}

export interface OutputRecord {
  id: string
  title: string
  kind: OutputKind
  status: OutputStatus
  summary?: string
  tags: string[]
  source?: OutputSource
  payload: JsonValue
  version: OutputRecordVersion
  createdAt: string
  updatedAt: string
}

export interface CreateOutputInput {
  id?: string
  title: string
  kind?: OutputKind
  status?: OutputStatus
  summary?: string
  tags?: string[]
  source?: OutputSource
  payload?: JsonValue
}

export interface UpdateOutputInput {
  title?: string
  kind?: OutputKind
  status?: OutputStatus
  summary?: string | null
  tags?: string[]
  source?: OutputSource | null
  payload?: JsonValue
}

export interface OutputIndexEntry {
  id: string
  title: string
  kind: OutputKind
  status: OutputStatus
  summary?: string
  tags: string[]
  source?: OutputSource
  payloadBytes: number
  recordVersion: number
  createdAt: string
  updatedAt: string
}

export interface OutputRegistryStorage {
  kind: 'local-json-jsonl'
  repoRoot: string
  rootDir: string
  recordsDir: string
  filesDir: string
  indexPath: string
  eventsPath: string
}

export interface OutputRegistryIndex {
  version: OutputRegistryVersion
  storage: OutputRegistryStorage
  generatedAt: string
  outputs: OutputIndexEntry[]
}

export type OutputRegistryEventType = 'created' | 'updated' | 'archived' | 'deleted'

export interface OutputRegistryEvent {
  eventId: string
  eventType: OutputRegistryEventType
  outputId: string
  recordVersion: number
  at: string
  actor: string
  summary?: string
  version: OutputRegistryVersion
}

export interface OutputRegistryListOptions {
  status?: OutputStatus | OutputStatus[]
  kind?: OutputKind | OutputKind[]
  tag?: string | string[]
  query?: string
  limit?: number
  includeArchived?: boolean
}

export interface OutputRegistryListResult extends OutputRegistryIndex {
  count: number
  totalCount: number
}
