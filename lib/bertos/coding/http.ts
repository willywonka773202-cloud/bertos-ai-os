import { NextResponse } from 'next/server'
import { CodingOSError } from './types'

export const JSON_HEADERS = { 'Cache-Control': 'no-store' }
const MAX_BODY_CHARS = 4_000_000

const STATUS_BY_CODE: Record<CodingOSError['code'], number> = {
  'invalid-input': 400,
  'not-found': 404,
  conflict: 409,
  blocked: 403,
  'approval-required': 412,
  'storage-error': 500,
}

export function codingError(error: unknown): NextResponse {
  if (error instanceof CodingOSError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: STATUS_BY_CODE[error.code] ?? 500, headers: JSON_HEADERS },
    )
  }
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : 'Coding OS request failed.' },
    { status: 500, headers: JSON_HEADERS },
  )
}

export function ok(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status, headers: JSON_HEADERS })
}

export async function readBody<T>(req: Request): Promise<T> {
  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) throw new CodingOSError('invalid-input', 'Request body is too large.')
  if (!raw.trim()) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new CodingOSError('invalid-input', 'Invalid JSON body.')
  }
}
