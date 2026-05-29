import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

function resolveBertOSDataRoot() {
  if (process.env.BERTOS_DATA_ROOT) return path.resolve(process.env.BERTOS_DATA_ROOT)
  if (process.env.VERCEL) return path.resolve(tmpdir(), 'bertos', 'data')
  return path.resolve(process.cwd(), 'data/bertos')
}

export const BERTOS_DATA_ROOT = resolveBertOSDataRoot()

export function runtimePath(...segments: string[]) {
  const target = path.resolve(BERTOS_DATA_ROOT, ...segments)
  if (target !== BERTOS_DATA_ROOT && !target.startsWith(`${BERTOS_DATA_ROOT}${path.sep}`)) {
    throw new Error('Runtime path is outside the BertOS data root.')
  }
  return target
}

export async function ensureRuntimeDir(...segments: string[]) {
  const dir = runtimePath(...segments)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function pathExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, filePath)
}

export async function appendJsonl(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const existing = await readFile(filePath, 'utf8').catch(() => '')
  await writeFile(filePath, `${existing}${JSON.stringify(value)}\n`, 'utf8')
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled'
}

export function checksumFor(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function nowIso() {
  return new Date().toISOString()
}

export function makeRuntimeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
