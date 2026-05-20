import { NextRequest, NextResponse } from 'next/server'
import { getLocalDaemonBaseUrl, isLocalDaemonAvailableFromServer } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isLocalDaemonAvailableFromServer()) {
    return NextResponse.json({ ok: false, error: 'Local daemon unavailable in Vercel/cloud mode.' }, { status: 503 })
  }
  const filePath = req.nextUrl.searchParams.get('path') || ''
  const res = await fetch(`${getLocalDaemonBaseUrl()}/repo/file?path=${encodeURIComponent(filePath)}`, { cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!isLocalDaemonAvailableFromServer()) {
    return NextResponse.json({ ok: false, error: 'Local daemon unavailable in Vercel/cloud mode.' }, { status: 503 })
  }
  const body = await req.json()
  const operation = body.operation === 'create'
    ? 'create'
    : body.operation === 'delete'
    ? 'delete'
    : 'write'
  const endpoint = operation === 'create'
    ? '/repo/file/create'
    : operation === 'delete'
    ? '/repo/file/delete'
    : '/repo/file'
  const res = await fetch(`${getLocalDaemonBaseUrl()}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
}
