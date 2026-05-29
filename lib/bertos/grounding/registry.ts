import { readdir } from 'node:fs/promises'

import { ensureRuntimeDir, readJsonFile, runtimePath, writeJsonFile } from '../runtime-store'
import type { GroundingPack, GroundingPackListOptions } from './types'

const PACKS_DIR = ['grounding', 'packs'] as const
const GROUNDING_PACK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const DEFAULT_LIST_LIMIT = 100
const MAX_LIST_LIMIT = 500

export function getGroundingPackStoragePath(groundingPackId: string) {
  return runtimePath(...PACKS_DIR, `${validateGroundingPackId(groundingPackId)}.json`)
}

export async function saveGroundingPack(pack: GroundingPack): Promise<GroundingPack> {
  const storagePath = getGroundingPackStoragePath(pack.groundingPackId)
  const persisted: GroundingPack = {
    ...pack,
    storagePath,
  }

  await writeJsonFile(storagePath, persisted)
  return persisted
}

export async function getGroundingPack(groundingPackId: string): Promise<GroundingPack | null> {
  const storagePath = getGroundingPackStoragePath(groundingPackId)
  const pack = await readJsonFile<GroundingPack | null>(storagePath, null)
  if (!pack) return null
  return withStoragePath(pack, storagePath)
}

export async function listGroundingPacks(options: GroundingPackListOptions = {}): Promise<GroundingPack[]> {
  const dir = await ensureRuntimeDir(...PACKS_DIR)
  const entries = await readdir(dir, { withFileTypes: true })
  const packs = await Promise.all(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(async entry => {
        const storagePath = runtimePath(...PACKS_DIR, entry.name)
        const pack = await readJsonFile<GroundingPack | null>(storagePath, null)
        return pack ? withStoragePath(pack, storagePath) : null
      }),
  )

  return packs
    .filter((pack): pack is GroundingPack => Boolean(pack))
    .filter(pack => !options.project || pack.project === options.project)
    .filter(pack => !options.client || pack.client === options.client)
    .filter(pack => matchesQuery(pack, options.query))
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
    .slice(0, clampLimit(options.limit))
}

function validateGroundingPackId(value: string) {
  if (!GROUNDING_PACK_ID_PATTERN.test(value)) {
    throw new Error(`Invalid grounding pack id: ${value}`)
  }
  return value
}

function withStoragePath(pack: GroundingPack, storagePath: string): GroundingPack {
  return {
    ...pack,
    storagePath,
  }
}

function matchesQuery(pack: GroundingPack, query?: string) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) return true
  return [pack.query, pack.taskReason, pack.project, pack.client]
    .filter((value): value is string => Boolean(value))
    .some(value => value.toLowerCase().includes(normalized))
}

function timestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clampLimit(limit = DEFAULT_LIST_LIMIT) {
  return Math.max(0, Math.min(MAX_LIST_LIMIT, Math.floor(limit)))
}
