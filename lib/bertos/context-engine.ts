export interface ContextFile {
  path: string
  content: string
  chars: number
  included: boolean
  omittedReason?: string
  matchScore?: number
  truncated?: boolean
}

export interface ContextSnapshot {
  files: ContextFile[]
  totalChars: number
  truncationWarnings: string[]
  includedPaths: string[]
  omittedPaths: string[]
  debug: {
    fileCount: number
    includedCount: number
    omittedCount: number
    totalCharsBeforeTruncation: number
  }
}

export interface ContextEngineOptions {
  task?: string
  activeFile?: string
  activeContent?: string
  additionalFiles?: Array<{ path: string; content: string }>
  maxTotalChars?: number
  maxPerFileChars?: number
}

const DEFAULT_MAX_TOTAL = 80_000
const DEFAULT_MAX_PER_FILE = 40_000

export function assembleContext(options: ContextEngineOptions): ContextSnapshot {
  const {
    task = '',
    activeFile,
    activeContent,
    additionalFiles = [],
    maxTotalChars = DEFAULT_MAX_TOTAL,
    maxPerFileChars = DEFAULT_MAX_PER_FILE,
  } = options

  const allFiles: Array<{ path: string; content: string; matchScore: number }> = []

  // Active file gets highest priority
  if (activeFile && typeof activeContent === 'string' && activeContent.length > 0) {
    allFiles.push({ path: activeFile, content: activeContent, matchScore: 100 })
  }

  // Score and collect additional files
  const taskWords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  for (const file of additionalFiles) {
    const alreadyAdded = allFiles.some(f => f.path === file.path)
    if (alreadyAdded || typeof file.content !== 'string') continue
    const pathLower = file.path.toLowerCase()
    let score = 50
    for (const word of taskWords) {
      if (pathLower.includes(word)) score += 10
      if (file.content.toLowerCase().includes(word)) score += 5
    }
    allFiles.push({ path: file.path, content: file.content, matchScore: score })
  }

  // Sort by relevance
  allFiles.sort((a, b) => b.matchScore - a.matchScore)

  const contextFiles: ContextFile[] = []
  let totalChars = 0
  let totalCharsBeforeTruncation = 0
  const truncationWarnings: string[] = []

  for (const file of allFiles) {
    totalCharsBeforeTruncation += file.content.length
    const remaining = maxTotalChars - totalChars

    if (remaining <= 0) {
      contextFiles.push({
        path: file.path,
        content: '',
        chars: 0,
        included: false,
        omittedReason: 'Context budget exhausted',
        matchScore: file.matchScore,
      })
      continue
    }

    const maxChars = Math.min(maxPerFileChars, remaining)
    const truncated = file.content.length > maxChars
    const content = truncated ? file.content.slice(0, maxChars) : file.content

    if (truncated) {
      truncationWarnings.push(
        `${file.path}: truncated to ${maxChars.toLocaleString()} chars (original: ${file.content.length.toLocaleString()})`
      )
    }

    contextFiles.push({
      path: file.path,
      content,
      chars: content.length,
      included: true,
      matchScore: file.matchScore,
      truncated,
    })
    totalChars += content.length
  }

  const includedPaths = contextFiles.filter(f => f.included).map(f => f.path)
  const omittedPaths = contextFiles.filter(f => !f.included).map(f => f.path)

  return {
    files: contextFiles,
    totalChars,
    truncationWarnings,
    includedPaths,
    omittedPaths,
    debug: {
      fileCount: contextFiles.length,
      includedCount: includedPaths.length,
      omittedCount: omittedPaths.length,
      totalCharsBeforeTruncation,
    },
  }
}

export function serializeContextToPrompt(snapshot: ContextSnapshot): string {
  const blocks: string[] = []

  for (const file of snapshot.files) {
    if (!file.included) continue
    blocks.push(
      `=== FILE START: ${file.path} ===\n${file.content}\n=== FILE END: ${file.path} ===`
    )
  }

  if (blocks.length === 0) return 'No file content available.'

  const header = [
    `Included files (${snapshot.includedPaths.length}):`,
    `Paths: ${snapshot.includedPaths.join(', ')}`,
    `Total chars: ${snapshot.totalChars.toLocaleString()}`,
    snapshot.truncationWarnings.length > 0
      ? `Truncation warnings: ${snapshot.truncationWarnings.join('; ')}`
      : null,
    snapshot.omittedPaths.length > 0
      ? `Omitted (budget): ${snapshot.omittedPaths.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `${header}\n\n${blocks.join('\n\n')}`
}

export function assertContextSerialization(
  snapshot: ContextSnapshot,
  serialized: string
): void {
  for (const file of snapshot.files) {
    if (!file.included) continue
    const marker = `=== FILE START: ${file.path} ===`
    if (!serialized.includes(marker)) {
      throw new Error(
        `Context serialization failure: "${file.path}" was marked as included but is missing from the serialized prompt. ` +
        `includedPaths=[${snapshot.includedPaths.join(', ')}]`
      )
    }
  }
}
