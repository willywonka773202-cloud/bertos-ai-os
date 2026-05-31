import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { requireProject } from './projects'
import {
  isIgnoredProjectPath,
  isLikelyBinaryPath,
  isSensitivePath,
  languageForPath,
  redactSensitiveText,
  resolveWithinRepo,
} from './safety'
import { CodingOSError, type CodingProject, type ProjectFileEntry, type ProjectFilePreview, type ProjectSearchHit } from './types'

const MAX_PREVIEW_BYTES = 120_000
const MAX_LIST_ENTRIES = 500
const MAX_SEARCH_FILES = 1500
const MAX_SEARCH_HITS = 80
const MAX_SEARCHABLE_FILE_BYTES = 600_000

function toRelative(repoRoot: string, absolute: string): string {
  return path.relative(repoRoot, absolute).split(path.sep).join('/')
}

/** True when a relative path is safe to surface (not sensitive, not in an ignored dir). */
export function isBrowsablePath(relativePath: string): boolean {
  if (!relativePath) return false
  if (isIgnoredProjectPath(relativePath)) return false
  if (isSensitivePath(relativePath)) return false
  return true
}

export async function listProjectFiles(
  projectId: string,
  options: { dir?: string } = {},
): Promise<{ dir: string; entries: ProjectFileEntry[] }> {
  const project = await requireProject(projectId)
  const relDir = (options.dir ?? '').replace(/^\/+/, '')
  if (relDir && !isBrowsablePath(relDir)) {
    throw new CodingOSError('blocked', 'That directory is not browsable.')
  }
  const absDir = resolveWithinRepo(project.repoPath, relDir || '.')

  let dirents
  try {
    dirents = await readdir(absDir, { withFileTypes: true })
  } catch {
    throw new CodingOSError('not-found', `Directory not found: ${relDir || '.'}`)
  }

  const entries: ProjectFileEntry[] = []
  for (const dirent of dirents) {
    const rel = toRelative(project.repoPath, path.join(absDir, dirent.name))
    if (!isBrowsablePath(rel)) continue
    if (dirent.isDirectory()) {
      entries.push({ path: rel, name: dirent.name, type: 'dir' })
    } else if (dirent.isFile()) {
      let sizeBytes: number | undefined
      try {
        sizeBytes = (await stat(path.join(absDir, dirent.name))).size
      } catch {
        sizeBytes = undefined
      }
      entries.push({ path: rel, name: dirent.name, type: 'file', sizeBytes, ext: path.extname(dirent.name).toLowerCase() || undefined })
    }
    if (entries.length >= MAX_LIST_ENTRIES) break
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { dir: relDir, entries }
}

export async function readProjectFile(projectId: string, relativePath: string): Promise<ProjectFilePreview> {
  const project = await requireProject(projectId)
  const rel = relativePath.replace(/^\/+/, '')
  if (isSensitivePath(rel)) {
    throw new CodingOSError('blocked', 'That file is sensitive and cannot be read.')
  }
  if (isIgnoredProjectPath(rel)) {
    throw new CodingOSError('blocked', 'That file lives in an ignored directory.')
  }
  if (isLikelyBinaryPath(rel)) {
    throw new CodingOSError('blocked', 'Binary files cannot be previewed.')
  }
  const abs = resolveWithinRepo(project.repoPath, rel)
  let info
  try {
    info = await stat(abs)
  } catch {
    throw new CodingOSError('not-found', `File not found: ${rel}`)
  }
  if (!info.isFile()) throw new CodingOSError('invalid-input', 'Path is not a file.')

  const buffer = await readFile(abs)
  const truncated = buffer.length > MAX_PREVIEW_BYTES
  const raw = buffer.subarray(0, MAX_PREVIEW_BYTES).toString('utf8')
  const { text, redacted } = redactSensitiveText(raw)
  return {
    path: rel,
    content: text,
    truncated,
    redactionApplied: redacted,
    totalBytes: info.size,
    language: languageForPath(rel),
  }
}

export async function getFilePreview(projectId: string, relativePath: string, maxLines = 60): Promise<string> {
  const file = await readProjectFile(projectId, relativePath)
  return file.content.split('\n').slice(0, maxLines).join('\n')
}

async function walkFiles(repoRoot: string, options: { limit: number }): Promise<string[]> {
  const results: string[] = []
  const queue: string[] = ['.']
  while (queue.length && results.length < options.limit) {
    const current = queue.shift() as string
    const abs = path.join(repoRoot, current)
    let dirents
    try {
      dirents = await readdir(abs, { withFileTypes: true })
    } catch {
      continue
    }
    for (const dirent of dirents) {
      const rel = current === '.' ? dirent.name : `${current}/${dirent.name}`
      if (!isBrowsablePath(rel)) continue
      if (dirent.isDirectory()) {
        queue.push(rel)
      } else if (dirent.isFile() && !isLikelyBinaryPath(rel)) {
        results.push(rel)
        if (results.length >= options.limit) break
      }
    }
  }
  return results
}

export async function searchProjectFiles(projectId: string, query: string): Promise<ProjectSearchHit[]> {
  const project = await requireProject(projectId)
  const needle = (query ?? '').trim()
  if (needle.length < 2) return []
  const lowerNeedle = needle.toLowerCase()
  const files = await walkFiles(project.repoPath, { limit: MAX_SEARCH_FILES })
  const hits: ProjectSearchHit[] = []

  for (const rel of files) {
    if (hits.length >= MAX_SEARCH_HITS) break
    let info
    try {
      info = await stat(path.join(project.repoPath, rel))
    } catch {
      continue
    }
    if (info.size > MAX_SEARCHABLE_FILE_BYTES) continue
    let content
    try {
      content = await readFile(path.join(project.repoPath, rel), 'utf8')
    } catch {
      continue
    }
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].toLowerCase().includes(lowerNeedle)) {
        hits.push({
          path: rel,
          line: i + 1,
          preview: redactSensitiveText(lines[i].trim().slice(0, 200)).text,
        })
        if (hits.length >= MAX_SEARCH_HITS) break
      }
    }
  }
  return hits
}

const TECH_SIGNALS: Array<{ file: string; label: string }> = [
  { file: 'next.config.js', label: 'Next.js' },
  { file: 'next.config.mjs', label: 'Next.js' },
  { file: 'next.config.ts', label: 'Next.js' },
  { file: 'tailwind.config.js', label: 'Tailwind' },
  { file: 'tailwind.config.ts', label: 'Tailwind' },
  { file: 'tsconfig.json', label: 'TypeScript' },
  { file: 'vite.config.ts', label: 'Vite' },
  { file: 'Cargo.toml', label: 'Rust' },
  { file: 'go.mod', label: 'Go' },
  { file: 'requirements.txt', label: 'Python' },
  { file: 'pyproject.toml', label: 'Python' },
  { file: 'Dockerfile', label: 'Docker' },
  { file: 'prisma/schema.prisma', label: 'Prisma' },
]

export async function detectTechStack(repoPath: string): Promise<string[]> {
  const stack = new Set<string>()
  for (const signal of TECH_SIGNALS) {
    try {
      await stat(path.join(repoPath, signal.file))
      stack.add(signal.label)
    } catch {
      // not present
    }
  }
  try {
    const pkgRaw = await readFile(path.join(repoPath, 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps.react) stack.add('React')
    if (deps.vue) stack.add('Vue')
    if (deps.svelte) stack.add('Svelte')
    if (deps.express) stack.add('Express')
    if (deps.typescript) stack.add('TypeScript')
    if (deps.jest || deps.vitest) stack.add('Tests')
  } catch {
    // no package.json
  }
  return [...stack]
}

export async function detectImportantFiles(project: CodingProject): Promise<string[]> {
  const candidates = [
    ...project.importantPaths,
    'package.json', 'README.md', 'tsconfig.json', 'next.config.mjs', 'next.config.js',
    'CLAUDE.md', 'AGENTS.md', '.gitignore',
  ]
  const found: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const rel = candidate.replace(/^\/+/, '')
    if (seen.has(rel) || !isBrowsablePath(rel)) continue
    seen.add(rel)
    try {
      const info = await stat(resolveWithinRepo(project.repoPath, rel))
      if (info.isFile()) found.push(rel)
    } catch {
      // missing
    }
    if (found.length >= 12) break
  }
  return found
}

export async function summarizeProjectStructure(projectId: string): Promise<{ techStack: string[]; importantFiles: string[]; topLevel: ProjectFileEntry[] }> {
  const project = await requireProject(projectId)
  const [{ entries }, techStack, importantFiles] = await Promise.all([
    listProjectFiles(projectId, { dir: '' }),
    detectTechStack(project.repoPath),
    detectImportantFiles(project),
  ])
  return { techStack, importantFiles, topLevel: entries.slice(0, 40) }
}
