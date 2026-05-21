export interface PatchProviderFileContent {
  path: string
  content: string
  inclusion: 'full' | 'snippet'
  originalChars: number
}

export interface PatchProviderContextPack {
  activeFile?: string
  searchTerms: string[]
  filesIncluded: string[]
  filesIncludedFull: string[]
  filesIncludedSnippetsOnly: string[]
  totalContextChars: number
  snippetsCount: number
  searchHits: unknown[]
  packageScripts: Record<string, string>
  componentNames: string[]
  fileContents: PatchProviderFileContent[]
}

export interface PatchPayloadSerializationDebug {
  promptChars: number
  includedFileCount: number
  includedFilePaths: string[]
  serializedContextPreview: string
  serializedPayloadPreview: string
  fileBodiesPresent: boolean
  truncationWarnings: string[]
}

interface BuildPatchProviderPayloadInput {
  compilerInstructions: string
  task: string
  contextPack: PatchProviderContextPack
  context: {
    repo?: unknown
    activeFile?: string
    activeContent?: string
    fileTree?: string[]
    gitStatus?: string
    terminalOutput?: string
    memories?: string[]
  }
}

function fileContentSignature(content: string) {
  const normalized = content.trim()
  if (!normalized) return ''
  return normalized.slice(0, Math.min(300, normalized.length))
}

export function serializePatchFileContext(contextPack: PatchProviderContextPack) {
  return contextPack.fileContents.map(file => [
    `=== FILE START: ${file.path} ===`,
    file.content,
    '=== FILE END ===',
  ].join('\n')).join('\n\n')
}

export function buildPatchContextPayload(input: BuildPatchProviderPayloadInput) {
  const context = input.context
  const contextPack = input.contextPack
  return JSON.stringify({
    repo: context.repo,
    activeFile: context.activeFile,
    gitStatus: context.gitStatus,
    fileTree: context.fileTree?.slice(0, 180),
    recentTerminalOutput: context.terminalOutput?.slice(-8000),
    memories: context.memories,
    packageScripts: contextPack.packageScripts,
    contextPack: {
      searchTerms: contextPack.searchTerms,
      filesIncluded: contextPack.filesIncluded,
      filesIncludedFull: contextPack.filesIncludedFull,
      filesIncludedSnippetsOnly: contextPack.filesIncludedSnippetsOnly,
      totalContextChars: contextPack.totalContextChars,
      snippetsCount: contextPack.snippetsCount,
      componentNames: contextPack.componentNames,
      searchHits: contextPack.searchHits.slice(0, 10),
      fileManifest: contextPack.fileContents.map(file => ({
        path: file.path,
        inclusion: file.inclusion === 'full' ? 'FULL_CONTENT' : 'SNIPPET_ONLY',
        includedChars: file.content.length,
        originalChars: file.originalChars,
      })),
    },
  }, null, 2)
}

export function buildPatchProviderPayload(input: BuildPatchProviderPayloadInput) {
  const serializedContextPayload = buildPatchContextPayload(input)
  const fileContext = serializePatchFileContext(input.contextPack)
  const truncationWarnings = input.contextPack.fileContents
    .filter(file => file.inclusion === 'snippet' || file.content.length < file.originalChars)
    .map(file => `${file.path} included as ${file.inclusion === 'full' ? 'FULL_CONTENT' : 'SNIPPET_ONLY'} (${file.content.length}/${file.originalChars} chars).`)

  const hasActiveFile = Boolean(input.context.activeFile && typeof input.context.activeContent === 'string')
  const hasFileContents = input.contextPack.fileContents.length > 0

  const activeFileSection = hasActiveFile
    ? [
        `## ACTIVE FILE: ${input.context.activeFile}`,
        'This is the currently open file. If the task touches this file, always include it in your changes.',
        input.context.activeContent!.slice(0, 45000),
      ].join('\n')
    : '## ACTIVE FILE\nNo active file is open.'

  const fileContentsSection = hasFileContents
    ? [
        '## INCLUDED FILES',
        'Each file is delimited with === FILE START: path === and === FILE END ===.',
        'Files marked SNIPPET_ONLY in the manifest exceeded the context budget and contain only relevant excerpts.',
        '',
        fileContext,
      ].join('\n')
    : '## INCLUDED FILES\nNo relevant file contents were found by repo search. If the task requires specific files, explain what context is missing in your summary and return an empty files array.'

  const prompt = [
    'You are Bert OS Patch Agent — an AI that makes precise, safe, minimal changes to an existing TypeScript/Next.js repository.',
    '',
    '## RULES',
    '- Use the provided context only. Do not invent imports, files, or APIs that are not shown.',
    '- Make minimal, targeted changes to accomplish the task. Do not refactor unrelated code.',
    '- Preserve existing architecture, types, and working behavior.',
    '- Do not remove working features or change unrelated systems.',
    '- Do not expose secrets, edit .env files, lockfiles, or generated outputs.',
    '- Do not touch Sylistly, .git, node_modules, or files outside this repo.',
    '- Do not auto-push or run destructive git commands.',
    '- If the context is insufficient, say so in summary and return an empty files array rather than guessing.',
    '- Include verification steps in validation.commands (e.g. npm run typecheck, npm run build).',
    '',
    `## USER TASK\n${input.task}`,
    '',
    `## PROJECT STATE\n${serializedContextPayload}`,
    '',
    activeFileSection,
    '',
    fileContentsSection,
    '',
    input.compilerInstructions,
  ].join('\n')

  const serialization = buildPatchPayloadSerializationDebug(prompt, serializedContextPayload, input.contextPack, truncationWarnings)
  assertPatchProviderPayloadHasContext(prompt, input.contextPack)
  return { prompt, serializedContextPayload, serialization }
}

export function buildPatchPayloadSerializationDebug(
  prompt: string,
  serializedContextPayload: string,
  contextPack: PatchProviderContextPack,
  truncationWarnings: string[] = [],
): PatchPayloadSerializationDebug {
  const fileBodiesPresent = contextPack.fileContents.every(file => {
    const markerPresent = prompt.includes(`=== FILE START: ${file.path} ===`) && prompt.includes('=== FILE END ===')
    const signature = fileContentSignature(file.content)
    return markerPresent && (!signature || prompt.includes(signature))
  })

  return {
    promptChars: prompt.length,
    includedFileCount: contextPack.fileContents.length,
    includedFilePaths: contextPack.fileContents.map(file => file.path),
    serializedContextPreview: serializedContextPayload.slice(0, 300),
    serializedPayloadPreview: prompt.slice(0, 300),
    fileBodiesPresent,
    truncationWarnings,
  }
}

export function assertPatchProviderPayloadHasContext(prompt: string, contextPack: PatchProviderContextPack) {
  const missing = contextPack.fileContents.filter(file => {
    const hasStart = prompt.includes(`=== FILE START: ${file.path} ===`)
    const hasEnd = prompt.includes('=== FILE END ===')
    const signature = fileContentSignature(file.content)
    const hasBody = !signature || prompt.includes(signature)
    return !hasStart || !hasEnd || !hasBody
  })

  if (missing.length > 0) {
    throw new Error(`Context serialization failure: final provider payload omitted included file content for ${missing.map(file => file.path).join(', ')}.`)
  }
}
