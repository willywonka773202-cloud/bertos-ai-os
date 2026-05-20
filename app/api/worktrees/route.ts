import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      available: false,
      worktrees: [],
      message: 'Worktree management is scaffolded but not enabled yet. Use the Mission Builder worktree preview, then create a git worktree manually until daemon-backed worktree creation is implemented.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
