import { NextResponse } from 'next/server'
import { getBertOSDeploymentMode } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

function present(name: string) {
  return Boolean(process.env[name]?.trim())
}

export async function GET() {
  const mode = getBertOSDeploymentMode()
  return NextResponse.json({
    mode,
    required: {
      BERTOS_AGENT_SECRET: present('BERTOS_AGENT_SECRET'),
      OLLAMA_API_KEY: mode === 'cloud' ? present('OLLAMA_API_KEY') : 'not-required-local',
      OLLAMA_DEFAULT_MODEL: present('OLLAMA_DEFAULT_MODEL'),
    },
    optional: {
      COMPOSIO_API_KEY: present('COMPOSIO_API_KEY'),
      HERMES_API_URL: present('HERMES_API_URL'),
      HERMES_API_KEY: present('HERMES_API_KEY'),
      OPENAI_API_KEY: present('OPENAI_API_KEY'),
      ANTHROPIC_API_KEY: present('ANTHROPIC_API_KEY'),
      GEMINI_API_KEY: present('GEMINI_API_KEY'),
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
