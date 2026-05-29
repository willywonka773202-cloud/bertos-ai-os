import { spawn } from 'node:child_process'
import { makeRuntimeId, nowIso } from '../runtime-store'
import { requireProject } from './projects'
import { redactSensitiveText } from './safety'
import { CodingOSError, type GitCommitSummary, type GitStatusSnapshot } from './types'

const GIT_TIMEOUT_MS = 10_000
const MAX_GIT_OUTPUT = 400_000

/** Run a read-only git command with an args array (no shell). */
export function runGit(cwd: string, args: string[], timeoutMs = GIT_TIMEOUT_MS): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new CodingOSError('storage-error', `git ${args[0]} timed out.`))
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      if (stdout.length < MAX_GIT_OUTPUT) stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      if (stderr.length < MAX_GIT_OUTPUT) stderr += chunk.toString()
    })
    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code: code ?? 0 })
    })
  })
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const { stdout, code } = await runGit(repoPath, ['rev-parse', '--is-inside-work-tree'])
    return code === 0 && stdout.trim() === 'true'
  } catch {
    return false
  }
}

export async function getGitStatus(projectId: string): Promise<GitStatusSnapshot> {
  const project = await requireProject(projectId)
  if (!(await isGitRepo(project.repoPath))) {
    throw new CodingOSError('invalid-input', 'Project path is not a git repository.')
  }

  const [branchRes, porcelainRes, aheadBehindRes, diffStatRes] = await Promise.all([
    runGit(project.repoPath, ['branch', '--show-current']).catch(() => ({ stdout: '', stderr: '', code: 1 })),
    runGit(project.repoPath, ['status', '--porcelain=v1']).catch(() => ({ stdout: '', stderr: '', code: 1 })),
    runGit(project.repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).catch(() => ({ stdout: '', stderr: '', code: 1 })),
    runGit(project.repoPath, ['diff', '--stat', 'HEAD']).catch(() => ({ stdout: '', stderr: '', code: 1 })),
  ])

  const changedFiles: string[] = []
  const stagedFiles: string[] = []
  const untrackedFiles: string[] = []
  const deletedFiles: string[] = []
  const conflictedFiles: string[] = []

  for (const line of porcelainRes.stdout.split('\n')) {
    if (!line.trim()) continue
    const x = line[0]
    const y = line[1]
    const file = line.slice(3).trim()
    if (x === '?' && y === '?') {
      untrackedFiles.push(file)
      continue
    }
    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      conflictedFiles.push(file)
      continue
    }
    if (x !== ' ' && x !== '?') stagedFiles.push(file)
    if (y !== ' ' && y !== '?') changedFiles.push(file)
    if (x === 'D' || y === 'D') deletedFiles.push(file)
  }

  let ahead = 0
  let behind = 0
  if (aheadBehindRes.code === 0) {
    const [a, b] = aheadBehindRes.stdout.trim().split(/\s+/).map(Number)
    ahead = Number.isFinite(a) ? a : 0
    behind = Number.isFinite(b) ? b : 0
  }

  return {
    snapshotId: makeRuntimeId('git'),
    projectId,
    branch: branchRes.stdout.trim() || 'detached',
    ahead,
    behind,
    clean: !porcelainRes.stdout.trim(),
    changedFiles,
    stagedFiles,
    untrackedFiles,
    deletedFiles,
    conflictedFiles,
    diffStat: diffStatRes.stdout.trim() || 'clean',
    createdAt: nowIso(),
  }
}

export async function getGitDiff(projectId: string, options: { staged?: boolean; file?: string; maxBytes?: number } = {}): Promise<string> {
  const project = await requireProject(projectId)
  const args = ['diff', '--no-color']
  if (options.staged) args.push('--staged')
  if (options.file) {
    // git treats everything after -- as paths; this prevents flag injection.
    args.push('--', options.file)
  }
  const { stdout } = await runGit(project.repoPath, args)
  const limited = stdout.slice(0, options.maxBytes ?? 200_000)
  return redactSensitiveText(limited).text
}

export async function getGitDiffStat(projectId: string): Promise<string> {
  const project = await requireProject(projectId)
  const { stdout } = await runGit(project.repoPath, ['diff', '--stat', 'HEAD'])
  return stdout.trim() || 'clean'
}

export async function getRecentCommits(projectId: string, limit = 20): Promise<GitCommitSummary[]> {
  const project = await requireProject(projectId)
  const count = Math.min(Math.max(1, limit), 100)
  const format = '%H%x1f%h%x1f%s%x1f%an%x1f%ad'
  const { stdout, code } = await runGit(project.repoPath, ['log', `-n${count}`, '--date=short', `--pretty=format:${format}`])
  if (code !== 0) return []
  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, shortHash, subject, author, date] = line.split('\x1f')
      return { hash, shortHash, subject, author, date }
    })
    .filter(commit => commit.hash)
}
