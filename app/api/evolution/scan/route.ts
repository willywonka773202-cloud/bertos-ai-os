import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { getComposioStatus } from '@/lib/tools/composio'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'
import type { AIModel } from '@/lib/bertos/types'

export const runtime = 'nodejs'

type EvolutionCategory = 'bug' | 'feature' | 'ui' | 'code-quality' | 'automation' | 'safety'

interface EvolutionItem {
  id: string
  title: string
  category: EvolutionCategory
  description: string
  evidence: string[]
  impact: number
  risk: number
  difficulty: number
  score: number
  recommendedProvider: AIModel
  nextAction: string
  patchPrompt: string
}

function score(impact: number, risk: number, difficulty: number) {
  return Math.max(1, Math.round((impact * 2.2 - risk * 0.9 - difficulty * 0.55) * 10) / 10)
}

function item(input: Omit<EvolutionItem, 'score'>): EvolutionItem {
  return { ...input, score: score(input.impact, input.risk, input.difficulty) }
}

async function readPackageJson() {
  try {
    const raw = await readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    return JSON.parse(raw) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  } catch {
    return {}
  }
}

function hasScript(pkg: { scripts?: Record<string, string> }, name: string) {
  return Boolean(pkg.scripts?.[name])
}

function buildBacklog(args: {
  daemon: Awaited<ReturnType<typeof fetchLocalDaemonStatus>>
  packageJson: Awaited<ReturnType<typeof readPackageJson>>
  composio: Awaited<ReturnType<typeof getComposioStatus>>
  ollama: ReturnType<typeof getOllamaConfig>
}) {
  const { daemon, packageJson, composio, ollama } = args
  const backlog: EvolutionItem[] = []
  const scripts = packageJson.scripts ?? {}
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }
  const repoStatus = daemon.repo?.status?.trim()
  const tools = daemon.tools ?? []
  const missingTools = tools.filter(tool => !tool.installed)

  if (!daemon.online || !daemon.repo?.safeRepo) {
    backlog.push(item({
      id: 'daemon-safe-repo',
      title: 'Harden local daemon and repo safety recovery',
      category: 'safety',
      description: 'Workspace write actions require a local daemon and safe bertos-ai-os repo. Improve the recovery path when this prerequisite is not met.',
      evidence: [
        daemon.online ? 'Daemon is online.' : `Daemon offline: ${daemon.error ?? 'no daemon response'}`,
        daemon.repo?.safeRepo ? 'Repo is safe.' : daemon.repo?.blockedReason ?? 'Repo safety status unavailable.',
      ],
      impact: 9,
      risk: 3,
      difficulty: 4,
      recommendedProvider: 'codex-cli',
      nextAction: 'Improve local-only messaging, daemon diagnostics, and recovery buttons.',
      patchPrompt: 'Improve BertOS local daemon unavailable and repo safety recovery UX without weakening safety checks. Do not write outside bertos-ai-os. Keep all file writes approval-gated.',
    }))
  }

  if (repoStatus) {
    backlog.push(item({
      id: 'dirty-worktree-review',
      title: 'Review current worktree changes before new automation',
      category: 'safety',
      description: 'The repo has uncommitted changes. Evolution should summarize and validate them before proposing more changes.',
      evidence: repoStatus.split(/\r?\n/).slice(0, 8),
      impact: 8,
      risk: 2,
      difficulty: 2,
      recommendedProvider: 'codex-cli',
      nextAction: 'Run typecheck/build and draft a commit message after review.',
      patchPrompt: 'Inspect the current bertos-ai-os git diff and propose only documentation or UI improvements needed to make the current changes safer. Do not apply or push anything automatically.',
    }))
  }

  if (!hasScript(packageJson, 'test')) {
    backlog.push(item({
      id: 'add-test-script',
      title: 'Add a real test script or honest test status',
      category: 'automation',
      description: 'BertOS asks agents to run tests, but package.json has no test script. Add a real lightweight test/smoke script or make the UI clearly report that tests are not configured.',
      evidence: ['package.json does not define scripts.test'],
      impact: 8,
      risk: 4,
      difficulty: 5,
      recommendedProvider: 'codex-cli',
      nextAction: 'Add a deterministic smoke test script for provider/workspace APIs or honest no-test messaging.',
      patchPrompt: 'Add a safe, deterministic BertOS smoke test script or update UI/docs so Test Agent and Workspace terminal do not imply npm test exists when package.json lacks a test script. Preserve typecheck/build.',
    }))
  }

  if (scripts.lint === 'next lint') {
    backlog.push(item({
      id: 'modernize-lint-script',
      title: 'Modernize lint workflow for this Next.js version',
      category: 'code-quality',
      description: 'The lint script still uses next lint. Next.js 15+ projects commonly need an ESLint CLI-based lint command.',
      evidence: [`scripts.lint = ${scripts.lint}`],
      impact: 6,
      risk: 3,
      difficulty: 3,
      recommendedProvider: 'codex-cli',
      nextAction: 'Replace or wrap lint with a command that works in this repo.',
      patchPrompt: 'Modernize the BertOS lint command and any UI references to lint so npm run lint is reliable for this Next.js app. Do not install packages unless already present.',
    }))
  }

  if (!deps['monaco-editor'] && !deps['@monaco-editor/react']) {
    backlog.push(item({
      id: 'upgrade-editor-monaco',
      title: 'Upgrade Workspace editor from textarea to Monaco-compatible adapter',
      category: 'feature',
      description: 'The Workspace editor is functional but still a textarea fallback. Add an adapter so Monaco can be enabled later without rewriting the workspace.',
      evidence: ['No monaco-editor or @monaco-editor/react dependency found.', 'Workspace currently uses a safe textarea editor fallback.'],
      impact: 7,
      risk: 5,
      difficulty: 6,
      recommendedProvider: 'claude-code',
      nextAction: 'Create an editor abstraction and keep textarea fallback active until dependency approval.',
      patchPrompt: 'Refactor Workspace editor into a small adapter component that preserves the current textarea behavior and leaves a clean Monaco integration point. Do not add dependencies.',
    }))
  }

  if (!composio.configured || !composio.reachable) {
    backlog.push(item({
      id: 'composio-setup-guidance',
      title: 'Make Composio setup actionable in Tools and Settings',
      category: 'automation',
      description: 'Composio is scaffolded but not connected. Improve setup guidance and tool-call approval states without pretending a connection exists.',
      evidence: [composio.error ?? 'Composio status is not reachable.', `configured=${composio.configured}`, `reachable=${composio.reachable}`],
      impact: 6,
      risk: 2,
      difficulty: 4,
      recommendedProvider: 'claude-code',
      nextAction: 'Improve missing-key UX and tool approval copy.',
      patchPrompt: 'Improve BertOS Composio missing-key and unavailable states in Settings/Tools UI. Do not expose COMPOSIO_API_KEY and do not fake connected tools.',
    }))
  }

  if (missingTools.length > 0) {
    backlog.push(item({
      id: 'cli-tool-recovery',
      title: 'Improve missing CLI provider recovery',
      category: 'automation',
      description: 'One or more local CLI providers are not installed or not reachable. Add targeted recovery instructions.',
      evidence: missingTools.map(tool => `${tool.label}: ${tool.error ?? 'missing'}`),
      impact: 7,
      risk: 2,
      difficulty: 3,
      recommendedProvider: 'claude-code',
      nextAction: 'Add per-tool recovery commands and noninteractive checks.',
      patchPrompt: 'Improve Settings and provider diagnostics for missing Claude/Codex/Gemini CLI tools. Do not mark tools available unless daemon status verifies them.',
    }))
  }

  if (ollama.requiresApiKey && !ollama.apiKey) {
    backlog.push(item({
      id: 'ollama-cloud-key-diagnostics',
      title: 'Clarify Ollama Cloud key diagnostics',
      category: 'ui',
      description: 'Server-side Ollama Cloud requires OLLAMA_API_KEY, while browser settings can provide a key for chat. Make this distinction unmistakable.',
      evidence: ['Server OLLAMA_API_KEY is missing.', 'Ollama Cloud mode is active.'],
      impact: 7,
      risk: 2,
      difficulty: 3,
      recommendedProvider: 'claude-code',
      nextAction: 'Improve settings and provider status copy.',
      patchPrompt: 'Clarify Ollama Cloud key diagnostics across BertOS Settings, provider status, and CLI errors. Do not expose secrets and preserve working browser-provided key behavior.',
    }))
  }

  backlog.push(item({
    id: 'evolution-lab-next',
    title: 'Expand Evolution Lab into team-mode review',
    category: 'feature',
    description: 'Evolution Lab can become a multi-provider improvement pipeline: scan, plan, architecture review, implementation patch, and review notes.',
    evidence: ['BertOS has verified Ollama, Codex, Claude, and Gemini provider routing.', 'Workspace patch workflow is approval-gated.'],
    impact: 8,
    risk: 5,
    difficulty: 7,
    recommendedProvider: 'gemini-cli',
    nextAction: 'Add multi-provider cards and store scan history.',
    patchPrompt: 'Extend Evolution Lab with Team Mode cards for planner, architect, implementer, and reviewer using existing provider routing. Keep all file writes approval-gated.',
  }))

  backlog.push(item({
    id: 'workspace-smoke-tests',
    title: 'Add browser smoke checklist for Workspace self-coding loop',
    category: 'automation',
    description: 'The Workspace now edits files, proposes patches, and runs commands. Add a documented or scripted smoke checklist to protect it from regressions.',
    evidence: ['Workspace includes file editor, terminal, patch proposal, and git panels.', 'No dedicated Workspace browser smoke script found.'],
    impact: 7,
    risk: 2,
    difficulty: 4,
    recommendedProvider: 'codex-cli',
    nextAction: 'Create a smoke checklist or lightweight script for Workspace APIs.',
    patchPrompt: 'Add a safe Workspace smoke test checklist or script covering file read, safe command run, patch API shape, and provider status. Do not require external services beyond local daemon where noted.',
  }))

  return backlog.sort((a, b) => b.score - a.score)
}

export async function GET() {
  const [daemon, packageJson, composio] = await Promise.all([
    fetchLocalDaemonStatus(),
    readPackageJson(),
    getComposioStatus(),
  ])
  const ollama = getOllamaConfig()
  const backlog = buildBacklog({ daemon, packageJson, composio, ollama })

  let aiSummary: string | undefined
  try {
    const summary = await Promise.race([
      askWithProviderRouter([
      'Summarize this BertOS Evolution Lab scan in 4 concise bullets.',
      'Do not invent providers or claim file changes. Mention that all writes require approval.',
      JSON.stringify(backlog.slice(0, 6).map(({ title, category, impact, risk, difficulty, score, evidence }) => ({
        title, category, impact, risk, difficulty, score, evidence,
      })), null, 2),
      ].join('\n\n'), 'ollama-pro'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI scan summary timed out.')), 8000)),
    ])
    if (summary.ok && summary.text.trim()) aiSummary = summary.text.trim()
  } catch {
    aiSummary = undefined
  }

  return NextResponse.json({
    ok: true,
    scannedAt: new Date().toISOString(),
    summary: aiSummary ?? 'Scan completed from verified repo, provider, package, and daemon signals. All file writes remain approval-gated.',
    repo: daemon.repo,
    providers: {
      ollama: {
        online: ollama.requiresApiKey ? Boolean(ollama.apiKey) : true,
        provider: ollama.providerName,
        mode: ollama.mode,
        model: ollama.defaultModel,
      },
      localDaemon: {
        online: daemon.online,
        safeRepo: Boolean(daemon.repo?.safeRepo),
        tools: daemon.tools.map(tool => ({
          id: tool.id,
          label: tool.label,
          installed: tool.installed,
          version: tool.version,
          resolvedPath: tool.resolvedPath,
          loginStatus: tool.loginStatus,
          error: tool.error,
        })),
      },
      composio: {
        configured: composio.configured,
        reachable: composio.reachable,
        error: composio.error,
      },
    },
    backlog,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
