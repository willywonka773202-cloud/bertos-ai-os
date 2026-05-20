import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      available: false,
      error: 'Worktree task execution is scaffolded but not enabled yet. No task was run.',
      nextStep: 'Use Workspace on the current repo or manually start an isolated worktree before running the mission.',
    },
    { status: 501 }
  )
}
