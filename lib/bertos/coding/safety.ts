import path from 'node:path'
import { CodingOSError, type CommandGuardResult } from './types'

// ── Path safety ──────────────────────────────────────────────────────────────

/**
 * Resolve a (possibly relative) path strictly within a repo root.
 * Blocks null bytes, parent-escape traversal, and absolute paths that land
 * outside the root. Returns the resolved absolute path.
 */
export function resolveWithinRepo(repoRoot: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new CodingOSError('invalid-input', 'A file path is required.')
  }
  if (relativePath.includes('\0')) {
    throw new CodingOSError('blocked', 'Null bytes are not allowed in paths.')
  }
  const root = path.resolve(repoRoot)
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new CodingOSError('blocked', `Path escapes the project root: ${relativePath}`)
  }
  return target
}

const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '.npmrc',
  '.netrc',
  'credentials',
  'credentials.json',
  'secrets.json',
  'service-account.json',
  '.pypirc',
  '.git-credentials',
])

const SENSITIVE_PATTERNS: RegExp[] = [
  /(^|[/\\])\.env(\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.keystore$/i,
  /(^|[/\\])\.ssh([/\\]|$)/i,
  /(^|[/\\])\.aws([/\\]|$)/i,
  /(^|[/\\])\.gnupg([/\\]|$)/i,
  /id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /secret/i,
  /credential/i,
]

/** True when a path points at credential/secret material we must never read or write. */
export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').trim()
  if (!normalized) return false
  const base = normalized.split('/').filter(Boolean).pop() ?? ''
  if (SENSITIVE_BASENAMES.has(base.toLowerCase())) return true
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(normalized))
}

const IGNORED_DIR_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  '.vercel',
  'out',
  '.idea',
  '.vscode-test',
])

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.ogg',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.node',
  '.lock', '.snap',
])

/** True when a path lives in a build/dependency directory that should never be browsed/indexed. */
export function isIgnoredProjectPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').trim()
  if (!normalized) return false
  return normalized.split('/').filter(Boolean).some(segment => IGNORED_DIR_SEGMENTS.has(segment))
}

export function isLikelyBinaryPath(relativePath: string): boolean {
  return BINARY_EXTS.has(path.extname(relativePath).toLowerCase())
}

// ── Secret detection & redaction ─────────────────────────────────────────────

interface SecretRule {
  kind: string
  pattern: RegExp
}

const SECRET_RULES: SecretRule[] = [
  { kind: 'anthropic-key', pattern: /sk-ant-[A-Za-z0-9_-]{16,}/g },
  { kind: 'openai-key', pattern: /sk-(?:proj-)?[A-Za-z0-9]{20,}/g },
  { kind: 'google-key', pattern: /AIza[0-9A-Za-z_-]{30,}/g },
  { kind: 'github-token', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { kind: 'github-pat', pattern: /github_pat_[A-Za-z0-9_]{20,}/g },
  { kind: 'slack-token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { kind: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { kind: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/g },
  { kind: 'generic-secret-assignment', pattern: /(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi },
]

export function detectSecretKinds(text: string): string[] {
  if (!text) return []
  const kinds = new Set<string>()
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(text)) kinds.add(rule.kind)
  }
  return [...kinds]
}

export function containsSecret(text: string): boolean {
  return detectSecretKinds(text).length > 0
}

/** Replace detected secrets with a redaction marker, preserving the secret kind. */
export function redactSensitiveText(text: string): { text: string; redacted: boolean; kinds: string[] } {
  if (!text) return { text, redacted: false, kinds: [] }
  let result = text
  const kinds = new Set<string>()
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0
    result = result.replace(rule.pattern, () => {
      kinds.add(rule.kind)
      return `[REDACTED:${rule.kind}]`
    })
  }
  return { text: result, redacted: kinds.size > 0, kinds: [...kinds] }
}

/** Throw if any field of a memory/durable-write payload contains a secret. */
export function assertNoSecret(text: string, label = 'content'): void {
  const kinds = detectSecretKinds(text)
  if (kinds.length) {
    throw new CodingOSError('blocked', `${label} contains blocked secret material (${kinds.join(', ')}).`)
  }
}

// ── Command safety ───────────────────────────────────────────────────────────

// Shell metacharacters that must never appear in a command we execute without a shell.
const SHELL_METACHAR = /[;&|`$<>(){}\n\r\\!*?~#]|\$\(|&&|\|\|/

// Base executables we permit for project-scoped validation/inspection.
const ALLOWED_BINARIES = new Set([
  'git', 'npm', 'pnpm', 'yarn', 'node', 'npx', 'tsc', 'next',
  'jest', 'vitest', 'eslint', 'prettier', 'tsx', 'deno', 'bun',
  'python', 'python3', 'pytest', 'go', 'cargo', 'make',
])

// Sub-actions / argument fragments that are mutating or dangerous.
// These flip a command to approval-required (or blocked outright).
const APPROVAL_REQUIRED_FRAGMENTS: Array<{ test: (parts: string[]) => boolean; reason: string }> = [
  { test: p => p[0] === 'git' && ['push', 'commit', 'merge', 'rebase', 'cherry-pick', 'tag', 'pull'].includes(p[1]), reason: 'Mutating git operation requires approval.' },
  { test: p => p[0] === 'git' && p[1] === 'reset' && p.includes('--hard'), reason: 'git reset --hard is destructive and requires approval.' },
  { test: p => p[0] === 'git' && p[1] === 'clean', reason: 'git clean deletes files and requires approval.' },
  { test: p => p[0] === 'git' && p[1] === 'checkout' && !p.includes('--'), reason: 'git checkout can modify files and requires approval.' },
  { test: p => ['npm', 'pnpm', 'yarn', 'bun'].includes(p[0]) && ['install', 'i', 'add', 'remove', 'rm', 'uninstall', 'update', 'upgrade'].includes(p[1]), reason: 'Package install/update requires approval.' },
  { test: p => p[0] === 'npx' || p[0] === 'bun', reason: 'Executing arbitrary packages requires approval.' },
]

const BLOCKED_FRAGMENTS: Array<{ test: (parts: string[]) => boolean; reason: string }> = [
  { test: p => p.includes('rm') || p.includes('rmdir') || p.includes('del') || p.includes('rd'), reason: 'File deletion commands are blocked.' },
  { test: p => p[0] === 'sudo' || p[0] === 'su', reason: 'Privilege escalation is blocked.' },
  { test: p => p.some(part => /^(curl|wget)$/i.test(part)), reason: 'Network fetch commands are blocked in the validation runner.' },
  { test: p => p.some(part => /deploy|vercel|netlify|publish/i.test(part)), reason: 'Deploy/publish commands require explicit approval outside the runner.' },
  { test: p => p.includes('>') || p.includes('>>'), reason: 'Output redirection is blocked.' },
]

export function tokenizeCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean)
}

/**
 * Evaluate a project-scoped command string against the global allowlist and the
 * project's own allow/block lists. Pure (no side effects) so it is trivially testable.
 */
export function guardCommand(
  command: string,
  options: { allowedCommands?: string[]; blockedCommands?: string[] } = {},
): CommandGuardResult {
  const trimmed = command.trim()
  if (!trimmed) {
    return { allowed: false, approvalRequired: false, reason: 'Empty command.', base: '', args: [] }
  }
  if (SHELL_METACHAR.test(trimmed)) {
    return { allowed: false, approvalRequired: false, reason: 'Shell metacharacters are not allowed.', base: '', args: [] }
  }

  const parts = tokenizeCommand(trimmed)
  const base = parts[0]
  const args = parts.slice(1)

  // Project explicit block list takes precedence.
  if (options.blockedCommands?.some(blocked => trimmed === blocked || trimmed.startsWith(`${blocked} `))) {
    return { allowed: false, approvalRequired: false, reason: 'Command is blocked for this project.', base, args }
  }

  for (const rule of BLOCKED_FRAGMENTS) {
    if (rule.test(parts)) {
      return { allowed: false, approvalRequired: false, reason: rule.reason, base, args }
    }
  }

  const projectAllowed = options.allowedCommands?.some(allowed => trimmed === allowed || trimmed.startsWith(`${allowed} `))
  if (!ALLOWED_BINARIES.has(base) && !projectAllowed) {
    return { allowed: false, approvalRequired: false, reason: `'${base}' is not in the command allowlist.`, base, args }
  }

  for (const rule of APPROVAL_REQUIRED_FRAGMENTS) {
    if (rule.test(parts)) {
      return { allowed: true, approvalRequired: true, reason: rule.reason, base, args }
    }
  }

  return { allowed: true, approvalRequired: false, base, args }
}

export function languageForPath(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json', '.md': 'markdown',
    '.css': 'css', '.scss': 'scss', '.html': 'html', '.py': 'python', '.go': 'go',
    '.rs': 'rust', '.sh': 'bash', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
    '.sql': 'sql', '.txt': 'text', '.env': 'text',
  }
  return map[ext] ?? 'text'
}
