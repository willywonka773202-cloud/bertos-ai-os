import { NextRequest, NextResponse } from 'next/server'

import {
  createOutputArtifact,
  createOutput,
  getOutputRegistryVersion,
  listOutputs,
  OutputRegistryError,
  type CreateOutputInput,
  type OutputKind,
  type OutputRegistryListOptions,
  type OutputStatus,
} from '@/lib/bertos/outputs'

export const runtime = 'nodejs'

const MAX_BODY_CHARS = 2_000_000
const JSON_HEADERS = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const options = parseListOptions(req.nextUrl.searchParams)
    const registry = await listOutputs(options)
    return NextResponse.json({ ok: true, registry }, { headers: JSON_HEADERS })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<CreateOutputInput & { type?: string }>(req)
    const output = body.type
      ? await createOutputArtifact(body as any)
      : await createOutput(body)
    return NextResponse.json(
      {
        ok: true,
        version: getOutputRegistryVersion(),
        output,
      },
      { status: 201, headers: JSON_HEADERS },
    )
  } catch (error) {
    return errorResponse(error)
  }
}

function parseListOptions(params: URLSearchParams): OutputRegistryListOptions {
  const limitValue = params.get('limit')
  const limit = limitValue ? Number(limitValue) : undefined

  return {
    status: parseRepeatedParam<OutputStatus>(params, 'status'),
    kind: parseRepeatedParam<OutputKind>(params, 'kind'),
    tag: parseRepeatedParam<string>(params, 'tag'),
    query: params.get('q') ?? params.get('query') ?? undefined,
    limit,
    includeArchived: params.get('includeArchived') === 'true',
  }
}

function parseRepeatedParam<T extends string>(params: URLSearchParams, key: string): T[] | undefined {
  const values = params
    .getAll(key)
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean) as T[]
  return values.length ? values : undefined
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
