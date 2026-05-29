export const HERMES_ROUTE_STATUS = [
  {
    route: '/dashboard',
    name: 'Mission Control',
    status: 'deep-themed',
    components: ['CommandCore', 'MissionCard', 'AchievementChip', 'ChamberCard', 'EmptyChamber', 'LoadingRelay'],
    remaining: 'Visual verification still belongs to release checks',
  },
  {
    route: '/chat',
    name: 'Oracle Console',
    status: 'deep-themed',
    components: ['HologramPanel', 'ProviderBadge', 'StatusOrb', 'LoadingRelay'],
    remaining: 'Browser provider response depends on local/API setup',
  },
  {
    route: '/autopilot',
    name: 'Autopilot Praetorium',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'StatusOrb'],
    remaining: 'Runs require explicit user click',
  },
  {
    route: '/agents',
    name: 'Agent Legion',
    status: 'deep-themed',
    components: ['RouteHero', 'EmptyChamber', 'AgentStatusPill'],
    remaining: 'External agents stay copy-prompt/planned unless verified',
  },
  {
    route: '/skills',
    name: 'Skills Registry',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'Badge'],
    remaining: 'Skill execution still routes through approved workflow/API surfaces',
  },
  {
    route: '/plugins',
    name: 'Plugin Registry',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'ProviderBadge'],
    remaining: 'External integrations stay setup-required until configured',
  },
  {
    route: '/outputs',
    name: 'Output Registry',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard'],
    remaining: 'Preview renderers are scaffolded by descriptor type',
  },
  {
    route: '/runs',
    name: 'Runs / Logs',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard'],
    remaining: 'Sub-agent lanes preserve records even when execution is sequential',
  },
  {
    route: '/studio',
    name: 'Studio Mini-App',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard'],
    remaining: 'Paid media generation remains setup-gated',
  },
  {
    route: '/memory',
    name: 'Memory Vault',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'RomanDivider'],
    remaining: 'Obsidian writer remains planned and permissioned',
  },
  {
    route: '/memory-review',
    name: 'Memory Review',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard'],
    remaining: 'Writes require proposal approval',
  },
  {
    route: '/settings',
    name: 'Provider Forge',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'ProviderBadge'],
    remaining: 'Paid providers remain gated by settings/env',
  },
  {
    route: '/github',
    name: 'Repo War Room',
    status: 'deep-themed',
    components: ['RouteHero', 'EmptyChamber', 'ProofOfWorkPanel'],
    remaining: 'Pull requests/issues are proof placeholders unless a live GitHub connector is added',
  },
  {
    route: '/evolution',
    name: 'Experimental Armory',
    status: 'deep-themed',
    components: ['RouteHero', 'EmptyChamber', 'LoadingRelay'],
    remaining: 'Patch apply remains approval-gated',
  },
  {
    route: '/coding',
    name: 'Forge / Engineering Bay',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'ProviderBadge'],
    remaining: 'Patch execution requires daemon and safe repo',
  },
  {
    route: '/builder',
    name: 'Forge / Engineering Bay',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'ProviderBadge'],
    remaining: 'Alias route shares Coding view',
  },
  {
    route: '/compare',
    name: 'Oracle Tribunal',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'EmptyChamber', 'LoadingRelay'],
    remaining: 'Only selected available providers run',
  },
  {
    route: '/workspace',
    name: 'Command Deck',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'StatusOrb'],
    remaining: 'File writes require daemon safety',
  },
  {
    route: '/playbooks',
    name: 'Doctrine Library',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'RomanDivider'],
    remaining: 'Templates are copy-prompt only',
  },
  {
    route: '/prompts',
    name: 'Prompt Arsenal',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'EmptyChamber'],
    remaining: 'Prompt execution routes through chat/builder',
  },
  {
    route: '/tasks',
    name: 'Task Phalanx',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard'],
    remaining: 'Task board is localStorage only',
  },
  {
    route: '/brief',
    name: 'Daily Oracle Brief',
    status: 'deep-themed',
    components: ['RouteHero', 'ChamberCard', 'EmptyChamber'],
    remaining: 'External calendars/email are not wired',
  },
  {
    route: '/migrations',
    name: 'Migration Cartography',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile'],
    remaining: 'Anti-Gravity remains planned/experimental',
  },
  {
    route: '/max',
    name: 'Max Mode / Overnight Forge',
    status: 'deep-themed',
    components: ['HologramPanel', 'StatusOrb', 'RouteHero', 'MetricTile'],
    remaining: 'Plan execution requires Ollama running; all patches stay approval-gated',
  },
] as const

export type HermesTone = 'cyan' | 'bronze' | 'emerald' | 'amber' | 'red' | 'violet' | 'zinc'

export function toneClasses(tone: HermesTone = 'cyan') {
  switch (tone) {
    case 'bronze':
      // Primary imperial gold — sacred registers and main announcement panels
      return 'border-[rgba(212,180,131,0.28)] bg-[rgba(212,180,131,0.05)] text-amber-100 shadow-[0_0_32px_rgba(212,180,131,0.08),inset_0_1px_0_rgba(240,232,208,0.04)]'
    case 'emerald':
      // Sage verification — success and validation states
      return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.06)]'
    case 'amber':
      // Parchment amber — caution and attention
      return 'border-amber-300/22 bg-amber-300/5 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.06)]'
    case 'red':
      // Crimson alert
      return 'border-red-400/20 bg-red-400/5 text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.07)]'
    case 'violet':
      // Deep imperial purple — advanced / mystical
      return 'border-violet-400/18 bg-violet-400/5 text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.07)]'
    case 'zinc':
      // Warm stone neutral
      return 'border-[rgba(60,48,32,0.70)] bg-[rgba(10,8,5,0.50)] text-stone-300'
    default:
      // Celestial blue — oracle / signal states (soft, not neon)
      return 'border-[rgba(122,188,214,0.20)] bg-[rgba(122,188,214,0.05)] text-sky-100 shadow-[0_0_28px_rgba(122,188,214,0.07)]'
  }
}
