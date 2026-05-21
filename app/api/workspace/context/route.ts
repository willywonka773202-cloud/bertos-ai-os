import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, serializeContextToPrompt } from '@/lib/bertos/context-engine'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: {
    task?: string
    activeFile?: string
    activeContent?: string
    includedFiles?: Array<{ path: string; content: string }>
    maxTotalChars?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const snapshot = assembleContext({
    task: body.task ?? '',
    activeFile: body.activeFile,
    activeContent: body.activeContent,
    additionalFiles: body.includedFiles ?? [],
    maxTotalChars: body.maxTotalChars,
  })

  const serialized = serializeContextToPrompt(snapshot)

  return NextResponse.json({
    ok: true,
    snapshot: {
      includedPaths: snapshot.includedPaths,
      omittedPaths: snapshot.omittedPaths,
      totalChars: snapshot.totalChars,
      truncationWarnings: snapshot.truncationWarnings,
      debug: snapshot.debug,
    },
    serialized,
    preview: serialized.slice(0, 500),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
