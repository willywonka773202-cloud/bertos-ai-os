import { NextRequest, NextResponse } from 'next/server'

import {
  archiveOutput,
  deleteOutput,
  getOutput,
  getOutputRegistryVersion,
  OutputRegistryError,
  updateOutput,
  type UpdateOutputInput,
} from '@/lib/bertos/outputs'

export const runtime = 'nodejs'

const MAX_BODY_CHARS = 2_000_000
const JSON_HEADERS = { 'Cache-Control': 'no-store' }
const APPROVAL_REQUIRED_STATUSES = new Set(['approved', 'scheduled', 'published'])

type RouteContext = {
  params: Promise<{ id: string }>
}

type OutputPatchBody = UpdateOutputInput & {
  approved?: boolean
  approvalReason?: string
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const output = await getOutput(id)
    if (!output) throw new OutputRegistryError('not-found', `Output not found: ${id}`)
    return NextResponse.json({ ok: true, version: getOutputRegistryVersion(), output }, { headers: JSON_HEADERS })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readJsonBody<OutputPatchBody>(req)
    if (body.status && APPROVAL_REQUIRED_STATUSES.has(body.status) && (body.approved !== true || !body.approvalReason?.trim())) {
      throw new OutputRegistryError('invalid-input', `Changing output status to ${body.status} requires approved=true and approvalReason.`)
    }
    const { approved: _approved, approvalReason: _approvalReason, ...update } = body
    const output = await updateOutput(id, update)
    return NextResponse.json({ ok: true, version: getOutputRegistryVersion(), output }, { headers: JSON_HEADERS })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const hardDelete = req.nextUrl.searchParams.get('hard') === 'true'

    if (hardDelete) {
      if (req.nextUrl.searchParams.get('approved') !== 'true' || !req.nextUrl.searchParams.get('reason')?.trim()) {
        throw new OutputRegistryError('invalid-input', 'Hard delete requires approved=true and a reason.')
      }
      const result = await deleteOutput(id)
      return NextResponse.json({ ok: true, version: getOutputRegistryVersion(), result }, { headers: JSON_HEADERS })
    }

    const output = await archiveOutput(id)
    return NextResponse.json({ ok: true, version: getOutputRegistryVersion(), output }, { headers: JSON_HEADERS })
  } catch (error) {
    return errorResponse(error)
  }
}

async function readJsonBody<T>(req: NextRequest): Promise<T> {
  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) {
    throw new OutputRegistryError('invalid-input', `Request body must be ${MAX_BODY_CHARS} characters or fewer.`)
  }
  if (!raw.trim()) throw new OutputRegistryError('invalid-input', 'Request body is required.')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new OutputRegistryError('invalid-input', 'Invalid JSON body.')
  }
  if (!isPlainObject(parsed)) throw new OutputRegistryError('invalid-input', 'Request body must be a JSON object.')
  return parsed as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function errorResponse(error: unknown) {
  if (error instanceof OutputRegistryError) {
    const status = error.code === 'not-found'
      ? 404
      : error.code === 'conflict'
        ? 409
        : error.code === 'invalid-input'
        ? 400
        : 500
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code, version: getOutputRegistryVersion() },
      { status, headers: JSON_HEADERS },
    )
  }

  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : 'Output registry failed.', version: getOutputRegistryVersion() },
    { status: 500, headers: JSON_HEADERS },
  )
}
