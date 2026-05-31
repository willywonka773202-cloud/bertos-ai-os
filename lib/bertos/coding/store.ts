import { appendJsonl, nowIso, readJsonFile, runtimePath, writeJsonFile } from '../runtime-store'

const CODING_ROOT = 'coding'

export function codingPath(...segments: string[]): string {
  return runtimePath(CODING_ROOT, ...segments)
}

/**
 * A tiny disk-backed collection: an array of records in a single JSON file,
 * each addressed by a string id field. Newest records are kept first.
 */
export class Collection<T extends Record<string, unknown>> {
  private readonly file: string

  constructor(private readonly relativeFile: string, private readonly idKey: keyof T) {
    this.file = codingPath(relativeFile)
  }

  async all(): Promise<T[]> {
    return readJsonFile<T[]>(this.file, [])
  }

  async list(limit = 200): Promise<T[]> {
    const items = await this.all()
    return items.slice(0, limit)
  }

  async get(id: string): Promise<T | null> {
    const items = await this.all()
    return items.find(item => item[this.idKey] === id) ?? null
  }

  async insert(record: T): Promise<T> {
    const items = await this.all()
    if (items.some(item => item[this.idKey] === record[this.idKey])) {
      const id = String(record[this.idKey])
      throw new Error(`Record already exists in ${this.relativeFile}: ${id}`)
    }
    await writeJsonFile(this.file, [record, ...items])
    await this.audit('created', String(record[this.idKey]))
    return record
  }

  async upsert(record: T): Promise<T> {
    const items = await this.all()
    const next = [record, ...items.filter(item => item[this.idKey] !== record[this.idKey])]
    await writeJsonFile(this.file, next)
    return record
  }

  async update(id: string, mutate: (current: T) => T): Promise<T> {
    const items = await this.all()
    const index = items.findIndex(item => item[this.idKey] === id)
    if (index === -1) throw new Error(`Record not found in ${this.relativeFile}: ${id}`)
    const updated = mutate(items[index])
    const next = [...items]
    next[index] = updated
    await writeJsonFile(this.file, next)
    await this.audit('updated', id)
    return updated
  }

  async remove(id: string): Promise<boolean> {
    const items = await this.all()
    const next = items.filter(item => item[this.idKey] !== id)
    if (next.length === items.length) return false
    await writeJsonFile(this.file, next)
    await this.audit('removed', id)
    return true
  }

  private async audit(event: string, id: string): Promise<void> {
    try {
      await appendJsonl(codingPath('_audit.jsonl'), { at: nowIso(), collection: this.relativeFile, event, id })
    } catch {
      // audit log is best-effort
    }
  }
}
