import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      available: false,
      error: 'Worktree creation is scaffolded but not enabled yet. No branch or worktree was created.',
      nextStep: 'Create the worktree manually or wait for daemon-backed worktree management.',
    },
    { status: 501 }
  )
}
