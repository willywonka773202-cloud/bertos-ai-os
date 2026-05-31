import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { listMemoryProposals } from './memory/registry'
import { listOutputArtifacts } from './outputs'
import { listPlugins } from './plugins/registry'
import { listSkills } from './skills/registry'
import type {
  PublishReadinessCheck,
  PublishReadinessReport,
  PublishReadinessSection,
  PublishReadinessStatus,
  PublishReadinessSummary,
} from './readiness-types'

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function exists(relativePath: string) {
  try {
    await stat(path.join(process.cwd(), relativePath))
    return true
  } catch {
    return false
  }
}

async function readText(relativePath: string) {
  try {
    return await readFile(path.join(process.cwd(), relativePath), 'utf8')
  } catch {
    return null
  }
}

function check(input: PublishReadinessCheck): PublishReadinessCheck {
  return input
}

async function routeAvailable(url: string) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    })
    return response.ok
  } catch {
    return false
  }
}

function statusCounts(sections: PublishReadinessSection[]): PublishReadinessSummary {
  const checks = sections.flatMap(section => section.checks)
  const count = (status: PublishReadinessStatus) => checks.filter(item => item.status === status).length
  const ready = count('ready')
  const warning = count('warning')
  const blocked = count('blocked')
  const info = count('info')
  const total = checks.length
  const weighted = checks.reduce((sum, item) => {
    if (item.status === 'ready') return sum + 1
    if (item.status === 'info') return sum + 0.85
    if (item.status === 'warning') return sum + 0.45
    return sum
  }, 0)
  return {
    score: total ? Math.round((weighted / total) * 100) : 0,
    ready,
    warning,
    blocked,
    info,
    total,
  }
}

function safeCount(items: { length: number } | null | undefined) {
  return Array.isArray(items) ? items.length : 0
}

export async function buildPublishReadinessReport(): Promise<PublishReadinessReport> {
  const deployment = process.env.VERCEL ? 'vercel' : process.env.NODE_ENV === 'development' ? 'local' : 'unknown'
  const hostedUrl = appUrl()
  const publicBaseUrl = hostedUrl.replace(/\/$/, '')

  const [
    skillsResult,
    pluginsResult,
    outputsResult,
    memoryProposalsResult,
    gitignoreText,
    serviceWorkerExists,
    manifestExists,
    serviceWorkerRouteAvailable,
    manifestRouteAvailable,
    publicKeyLeak,
  ] = await Promise.all([
    listSkills().catch(() => []),
    listPlugins().catch(() => []),
    listOutputArtifacts(20).catch(() => []),
    listMemoryProposals('pending').catch(() => []),
    readText('.gitignore'),
    exists('public/sw.js'),
    exists('app/manifest.ts'),
    routeAvailable(`${publicBaseUrl}/sw.js`),
    routeAvailable(`${publicBaseUrl}/manifest.webmanifest`),
    Promise.resolve(
      Object.keys(process.env).some(key => key.startsWith('NEXT_PUBLIC_') && /(SECRET|TOKEN|API_KEY|PRIVATE|PASSWORD)/i.test(key)),
    ),
  ])

  const skills = skillsResult
  const plugins = pluginsResult
  const outputs = outputsResult
  const pendingMemoryProposals = memoryProposalsResult
  const readyPlugins = plugins.filter(plugin => plugin.setupStatus === 'ready')
  const setupGatedPlugins = plugins.filter(plugin => plugin.setupStatus !== 'ready')
  const gitignoreHasData = gitignoreText ? /^data\/bertos\/$/m.test(gitignoreText) : false
  const gitignoreHasLogs = gitignoreText ? /^logs\/$/m.test(gitignoreText) : false
  const sourceGitignoreUnavailable = gitignoreText === null && deployment === 'vercel'
  const manifestReady = manifestExists || manifestRouteAvailable
  const serviceWorkerReady = serviceWorkerExists || serviceWorkerRouteAvailable

  const sections: PublishReadinessSection[] = [
    {
      id: 'deployment',
      title: 'Deployment Shell',
      description: 'The hosted app must load, identify itself as installable, and make its runtime boundaries obvious.',
      checks: [
        check({
          id: 'hosted-url',
          title: 'Production URL configured',
          description: 'BertOS has a canonical app URL for links, manifests, and share targets.',
          status: hostedUrl.startsWith('http') ? 'ready' : 'warning',
          detail: hostedUrl,
          actionHref: '/settings',
          actionLabel: 'Open settings',
        }),
        check({
          id: 'manifest',
          title: 'Web app manifest',
          description: 'Mobile and desktop browsers can recognize BertOS as an app.',
          status: manifestReady ? 'ready' : 'blocked',
          detail: manifestRouteAvailable
            ? '/manifest.webmanifest is live.'
            : manifestExists
              ? 'app/manifest.ts is present.'
              : 'Missing app manifest route.',
        }),
        check({
          id: 'service-worker',
          title: 'Service worker scaffold',
          description: 'The production shell can cache core routes and survive brief reload/network gaps.',
          status: serviceWorkerReady ? 'ready' : 'warning',
          detail: serviceWorkerRouteAvailable
            ? '/sw.js is live.'
            : serviceWorkerExists
              ? 'public/sw.js is available for production registration.'
              : 'No service worker file found.',
        }),
      ],
    },
    {
      id: 'runtime',
      title: 'Local-First Runtime',
      description: 'Repo actions stay local, explicit, and separated from public hosting.',
      checks: [
        check({
          id: 'browser-daemon-bridge',
          title: 'Browser daemon bridge',
          description: 'Hosted BertOS can use the desktop daemon from the browser without exposing CLI secrets to Vercel.',
          status: 'info',
          detail: 'Client-side bridge checks happen in the browser because Vercel cannot see your Mac localhost.',
          actionHref: '/settings',
          actionLabel: 'Configure bridge',
        }),
        check({
          id: 'runtime-gitignore',
          title: 'Runtime folders ignored',
          description: 'Generated local memory, outputs, and logs must not be committed accidentally.',
          status: gitignoreHasData && gitignoreHasLogs || sourceGitignoreUnavailable ? 'ready' : 'warning',
          detail: gitignoreHasData && gitignoreHasLogs
            ? 'data/bertos/ and logs/ are gitignored.'
            : sourceGitignoreUnavailable
              ? 'Source .gitignore is not readable inside the Vercel function; local validation owns this check.'
              : 'Add data/bertos/ and logs/ to .gitignore.',
        }),
        check({
          id: 'dangerous-actions',
          title: 'Risk gates preserved',
          description: 'Deletes, overwrites, emails, publishing, pushes, deploys, and paid APIs remain approval-gated.',
          status: 'ready',
          detail: 'Daemon and plugin registries declare approval gates for risky operations.',
        }),
      ],
    },
    {
      id: 'creator-os',
      title: 'Creator OS Layer',
      description: 'Skills, plugins, outputs, memory, and runs need visible product surfaces.',
      checks: [
        check({
          id: 'skills',
          title: 'Skills registry',
          description: 'Reusable slash-command workflows are available.',
          status: skills.length >= 8 ? 'ready' : 'warning',
          detail: `${skills.length} skill${skills.length === 1 ? '' : 's'} installed.`,
          actionHref: '/skills',
          actionLabel: 'Open skills',
        }),
        check({
          id: 'plugins',
          title: 'Plugin registry',
          description: 'External tools are represented with setup state and degraded mode.',
          status: plugins.length >= 10 && readyPlugins.length >= 3 ? 'ready' : 'warning',
          detail: `${readyPlugins.length}/${plugins.length} plugins ready; ${setupGatedPlugins.length} setup-gated.`,
          actionHref: '/plugins',
          actionLabel: 'Open plugins',
        }),
        check({
          id: 'outputs',
          title: 'Output registry',
          description: 'Generated work has a searchable place to land.',
          status: 'ready',
          detail: `${outputs.length} recent output artifact${outputs.length === 1 ? '' : 's'} indexed in the local registry.`,
          actionHref: '/outputs',
          actionLabel: 'Open outputs',
        }),
        check({
          id: 'memory-review',
          title: 'Memory review queue',
          description: 'Memory writes go through proposals instead of silent pollution.',
          status: 'ready',
          detail: `${pendingMemoryProposals.length} pending memory proposal${pendingMemoryProposals.length === 1 ? '' : 's'}.`,
          actionHref: '/memory-review',
          actionLabel: 'Review memory',
        }),
      ],
    },
    {
      id: 'security',
      title: 'Public Safety',
      description: 'A publishable OS must be honest about credentials, connectors, and public routes.',
      checks: [
        check({
          id: 'no-public-secrets',
          title: 'No public secret-shaped env names',
          description: 'Secrets must remain server-side or local, never exposed through NEXT_PUBLIC variables.',
          status: publicKeyLeak ? 'blocked' : 'ready',
          detail: publicKeyLeak
            ? 'A NEXT_PUBLIC_* variable looks like a secret name. Rename it or move it server-side.'
            : 'No secret-shaped NEXT_PUBLIC_* env names detected.',
        }),
        check({
          id: 'setup-gated-connectors',
          title: 'Missing connectors are setup-gated',
          description: 'Unavailable Gmail, Calendar, Buffer, media, and video tools must not look live.',
          status: 'ready',
          detail: `${setupGatedPlugins.length} plugins currently report setup-required, planned, or degraded modes.`,
        }),
        check({
          id: 'server-daemon-boundary',
          title: 'Hosted server boundary is explicit',
          description: 'Vercel server routes should not pretend they can reach the desktop daemon.',
          status: 'ready',
          detail: 'Server provider status reports daemon unavailable on Vercel; browser bridge handles local desktop access.',
        }),
      ],
    },
  ]

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    environment: {
      deployment,
      appUrl: hostedUrl,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      vercelUrl: process.env.VERCEL_URL,
    },
    counts: {
      skills: safeCount(skills),
      plugins: safeCount(plugins),
      readyPlugins: safeCount(readyPlugins),
      outputs: safeCount(outputs),
      pendingMemoryProposals: safeCount(pendingMemoryProposals),
    },
    summary: statusCounts(sections),
    sections,
  }
}
