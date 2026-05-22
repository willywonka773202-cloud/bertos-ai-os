export interface ContextFile {
  path: string
  content: string
  chars: number
  originalChars: number
  included: boolean
  omittedReason?: string
  matchScore?: number
  truncated?: boolean
  chunked?: boolean
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
    perFile: Array<{
      path: string
      originalChars: number
      includedChars: number
      matchScore: number
      included: boolean
      omittedReason?: string
      truncated?: boolean
      chunked?: boolean
    }>
  }
}

export interface ContextEngineOptions {
  task?: string
  activeFile?: string
  activeContent?: string
  additionalFiles?: Array<{ path: string; content: string }>
  maxTotalChars?: number
  maxPerFileChars?: number
  priorityFilePath?: string
}

const DEFAULT_MAX_TOTAL = 80_000
const DEFAULT_MAX_PER_FILE = 40_000

function extractKeywords(task: string): string[] {
  const stopwords = new Set(['with', 'that', 'this', 'from', 'into', 'have', 'when', 'where', 'which', 'they', 'their', 'there', 'been', 'will', 'would', 'could', 'should', 'make', 'take', 'give', 'does', 'just', 'your', 'more', 'also', 'then', 'some', 'what', 'were'])
  return task
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word))
    .slice(0, 20)
}

function extractRelevantChunks(
  content: string,
  keywords: string[],
  maxChars: number,
  windowLines = 45,
): { text: string; chunked: boolean } {
  if (content.length <= maxChars) return { text: content, chunked: false }
  if (keywords.length === 0) return { text: content.slice(0, maxChars), chunked: false }

  const lines = content.split('\n')
  const keywordLower = keywords.map(keyword => keyword.toLowerCase())
  const relevantLineNums = new Set<number>()

  for (let i = 0; i < Math.min(60, lines.length); i += 1) relevantLineNums.add(i)

  for (let i = 0; i < lines.length; i += 1) {
    const lineLower = lines[i].toLowerCase()
    if (keywordLower.some(keyword => lineLower.includes(keyword))) {
      for (let j = Math.max(0, i - windowLines); j <= Math.min(lines.length - 1, i + windowLines); j += 1) {
        relevantLineNums.add(j)
      }
    }
  }

  const outputLines: string[] = []
  let charsUsed = 0
  let prevNum = -2

  for (const lineNum of Array.from(relevantLineNums).sort((a, b) => a - b)) {
    if (lineNum > prevNum + 1 && prevNum >= 0) {
      const gap = lineNum - prevNum - 1
      const marker = `// ... [${gap} line${gap === 1 ? '' : 's'} omitted] ...`
      outputLines.push(marker)
      charsUsed += marker.length + 1
    }
    outputLines.push(lines[lineNum])
    charsUsed += lines[lineNum].length + 1
    if (charsUsed >= maxChars) break
    prevNum = lineNum
  }

  return { text: outputLines.join('\n'), chunked: true }
}

export function assembleContext(options: ContextEngineOptions): ContextSnapshot {
  const {
    task = '',
    activeFile,
    activeContent,
    additionalFiles = [],
    maxTotalChars = DEFAULT_MAX_TOTAL,
    maxPerFileChars = DEFAULT_MAX_PER_FILE,
    priorityFilePath,
  } = options

  const keywords = extractKeywords(task)
  const allFiles: Array<{ path: string; content: string; matchScore: number }> = []
  const effectivePriorityPath = priorityFilePath || activeFile

  if (activeFile && typeof activeContent === 'string' && activeContent.length > 0) {
    allFiles.push({ path: activeFile, content: activeContent, matchScore: 100 })
  }

  const taskWords = task.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  for (const file of additionalFiles) {
    if (allFiles.some(existing => existing.path === file.path) || typeof file.content !== 'string') continue
    const pathLower = file.path.toLowerCase()
    let score = effectivePriorityPath && file.path === effectivePriorityPath ? 95 : 50
    for (const word of taskWords) {
      if (pathLower.includes(word)) score += 10
      if (file.content.toLowerCase().includes(word)) score += 5
    }
    allFiles.push({ path: file.path, content: file.content, matchScore: score })
  }

  allFiles.sort((a, b) => b.matchScore - a.matchScore)

  const contextFiles: ContextFile[] = []
  let totalChars = 0
  let totalCharsBeforeTruncation = 0
  const truncationWarnings: string[] = []

  for (const file of allFiles) {
    const originalChars = file.content.length
    totalCharsBeforeTruncation += originalChars
    const remaining = maxTotalChars - totalChars

    if (remaining <= 0) {
      contextFiles.push({
        path: file.path,
        content: '',
        chars: 0,
        originalChars,
        included: false,
        omittedReason: 'Context budget exhausted',
        matchScore: file.matchScore,
      })
      continue
    }

    const maxChars = Math.min(maxPerFileChars, remaining)
    if (file.content.length > maxChars) {
      const { text, chunked } = extractRelevantChunks(file.content, keywords, maxChars)
      truncationWarnings.push(
        chunked
          ? `${file.path}: keyword-chunked to ${text.length.toLocaleString()} chars (original: ${originalChars.toLocaleString()})`
          : `${file.path}: truncated to ${text.length.toLocaleString()} chars (original: ${originalChars.toLocaleString()})`,
      )
      contextFiles.push({
        path: file.path,
        content: text,
        chars: text.length,
        originalChars,
        included: true,
        matchScore: file.matchScore,
        truncated: !chunked,
        chunked,
      })
      totalChars += text.length
    } else {
      contextFiles.push({
        path: file.path,
        content: file.content,
        chars: file.content.length,
        originalChars,
        included: true,
        matchScore: file.matchScore,
        truncated: false,
        chunked: false,
      })
      totalChars += file.content.length
    }
  }

  const includedPaths = contextFiles.filter(file => file.included).map(file => file.path)
  const omittedPaths = contextFiles.filter(file => !file.included).map(file => file.path)

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
      perFile: contextFiles.map(file => ({
        path: file.path,
        originalChars: file.originalChars,
        includedChars: file.chars,
        matchScore: file.matchScore ?? 0,
        included: file.included,
        omittedReason: file.omittedReason,
        truncated: file.truncated,
        chunked: file.chunked,
      })),
    },
  }
}

export function serializeContextToPrompt(snapshot: ContextSnapshot): string {
  const blocks = snapshot.files
    .filter(file => file.included)
    .map(file => {
      const label = file.chunked
        ? `=== FILE START: ${file.path} (keyword-chunked, ${file.chars.toLocaleString()}/${file.originalChars.toLocaleString()} chars) ===`
        : file.truncated
          ? `=== FILE START: ${file.path} (truncated, ${file.chars.toLocaleString()}/${file.originalChars.toLocaleString()} chars) ===`
          : `=== FILE START: ${file.path} ===`
      return `${label}\n${file.content}\n=== FILE END: ${file.path} ===`
    })

  if (blocks.length === 0) return 'No file content available.'

  const header = [
    `Included files (${snapshot.includedPaths.length}):`,
    `Paths: ${snapshot.includedPaths.join(', ')}`,
    `Total chars: ${snapshot.totalChars.toLocaleString()}`,
    snapshot.truncationWarnings.length > 0 ? `Truncation/chunking: ${snapshot.truncationWarnings.join('; ')}` : null,
    snapshot.omittedPaths.length > 0 ? `Omitted (budget): ${snapshot.omittedPaths.join(', ')}` : null,
  ].filter(Boolean).join('\n')

  return `${header}\n\n${blocks.join('\n\n')}`
}

export function assertContextSerialization(snapshot: ContextSnapshot, serialized: string): void {
  for (const file of snapshot.files) {
    if (!file.included) continue
    const marker = `=== FILE START: ${file.path}`
    if (!serialized.includes(marker)) {
      throw new Error(
        `Context serialization failure: "${file.path}" was marked as included but is missing from the serialized prompt. ` +
        `includedPaths=[${snapshot.includedPaths.join(', ')}]`,
      )
    }
  }
}
