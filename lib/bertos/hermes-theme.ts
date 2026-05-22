export const HERMES_ROUTE_STATUS = [
  {
    route: '/dashboard',
    name: 'Mission Control',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'StatusOrb', 'RomanDivider', 'ProofOfWorkPanel'],
    remaining: 'None known',
  },
  {
    route: '/chat',
    name: 'Oracle Console',
    status: 'deep-themed',
    components: ['HologramPanel', 'ProviderBadge', 'StatusOrb'],
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
    components: ['HologramPanel', 'MetricTile', 'AgentStatusPill'],
    remaining: 'External agents stay copy-prompt/planned unless verified',
  },
  {
    route: '/memory',
    name: 'Memory Vault',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'RomanDivider'],
    remaining: 'Obsidian writer remains planned and permissioned',
  },
  {
    route: '/settings',
    name: 'Provider Forge',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'ProviderBadge'],
    remaining: 'Paid providers remain gated by settings/env',
  },
  {
    route: '/github',
    name: 'Repo War Room',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'ProofOfWorkPanel'],
    remaining: 'Pull requests/issues are proof placeholders unless a live GitHub connector is added',
  },
  {
    route: '/evolution',
    name: 'Experimental Armory',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'StatusOrb'],
    remaining: 'Patch apply remains approval-gated',
  },
  {
    route: '/coding',
    name: 'Forge / Engineering Bay',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'ProviderBadge'],
    remaining: 'Patch execution requires daemon and safe repo',
  },
  {
    route: '/builder',
    name: 'Forge / Engineering Bay',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'ProviderBadge'],
    remaining: 'Alias route shares Coding view',
  },
  {
    route: '/compare',
    name: 'Oracle Tribunal',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile', 'ProviderBadge'],
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
    components: ['HologramPanel', 'MetricTile', 'RomanDivider'],
    remaining: 'Templates are copy-prompt only',
  },
  {
    route: '/prompts',
    name: 'Prompt Arsenal',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile'],
    remaining: 'Prompt execution routes through chat/builder',
  },
  {
    route: '/tasks',
    name: 'Task Phalanx',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile'],
    remaining: 'Task board is localStorage only',
  },
  {
    route: '/brief',
    name: 'Daily Oracle Brief',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile'],
    remaining: 'External calendars/email are not wired',
  },
  {
    route: '/migrations',
    name: 'Migration Cartography',
    status: 'deep-themed',
    components: ['HologramPanel', 'MetricTile'],
    remaining: 'Anti-Gravity remains planned/experimental',
  },
] as const

export type HermesTone = 'cyan' | 'bronze' | 'emerald' | 'amber' | 'red' | 'violet' | 'zinc'

export function toneClasses(tone: HermesTone = 'cyan') {
  switch (tone) {
    case 'bronze':
      return 'border-amber-400/25 bg-amber-400/8 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.08)]'
    case 'emerald':
      return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.08)]'
    case 'amber':
      return 'border-amber-400/25 bg-amber-400/8 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.08)]'
    case 'red':
      return 'border-red-400/25 bg-red-400/8 text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.08)]'
    case 'violet':
      return 'border-violet-400/25 bg-violet-400/8 text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.08)]'
    case 'zinc':
      return 'border-zinc-700/70 bg-zinc-950/50 text-zinc-300'
    default:
      return 'border-cyan-400/25 bg-cyan-400/8 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.10)]'
  }
}
