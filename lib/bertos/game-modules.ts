export type GameModuleId =
  | 'dashboard'
  | 'cockpit'
  | 'approvals'
  | 'chat'
  | 'hermes'
  | 'prompts'
  | 'compare'
  | 'coding'
  | 'max'
  | 'workspace'
  | 'evolution'
  | 'agents'
  | 'memory'
  | 'brief'
  | 'playbooks'
  | 'tasks'
  | 'migrations'
  | 'github'
  | 'autopilot'
  | 'automations'
  | 'settings'
  | 'launch'

export type GameGeometry = 'citadel' | 'orb' | 'library' | 'tribunal' | 'forge' | 'moon' | 'deck' | 'armory' | 'legion' | 'vault' | 'map' | 'repo'

export interface GameModule {
  id: GameModuleId
  href: string
  navLabel: string
  title: string
  callsign: string
  objective: string
  reward: string
  geometry: GameGeometry
  color: string
  secondaryColor: string
  accent: string
  lane: 'command' | 'oracle' | 'forge' | 'memory' | 'legion' | 'repo'
}

export const GAME_MODULES: GameModule[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    navLabel: 'Mission',
    title: 'Mission Control',
    callsign: 'Prime Command',
    objective: 'Balance provider health, daemon status, tasks, automations, and operator rank.',
    reward: 'Strategic overview XP',
    geometry: 'citadel',
    color: '#D4B483',
    secondaryColor: '#7ABCD6',
    accent: '#F0E8D0',
    lane: 'command',
  },
  {
    id: 'cockpit',
    href: '/cockpit',
    navLabel: 'Cockpit',
    title: 'Dev Cockpit',
    callsign: 'Daily Sanctuary',
    objective: 'Register repos, browse safely, run validation, forge patches behind approval, and keep every run in one place.',
    reward: 'Daily build flow',
    geometry: 'forge',
    color: '#7ABCD6',
    secondaryColor: '#D4B483',
    accent: '#CFFAFE',
    lane: 'forge',
  },
  {
    id: 'approvals',
    href: '/approvals',
    navLabel: 'Gates',
    title: 'Approval Center',
    callsign: 'Guardian Gates',
    objective: 'Review and approve every risky action — patch applies, pushes, deploys, deletions, paid APIs.',
    reward: 'Safety integrity',
    geometry: 'tribunal',
    color: '#FB7185',
    secondaryColor: '#86C9A0',
    accent: '#FFE4E6',
    lane: 'command',
  },
  {
    id: 'chat',
    href: '/chat',
    navLabel: 'Oracle',
    title: 'Oracle Console',
    callsign: 'Signal Spire',
    objective: 'Route prompts, watch model streams, and convert intent into usable work.',
    reward: 'Relay streak XP',
    geometry: 'orb',
    color: '#7ABCD6',
    secondaryColor: '#D4B483',
    accent: '#CFFAFE',
    lane: 'oracle',
  },
  {
    id: 'hermes',
    href: '/hermes',
    navLabel: 'Hermes',
    title: 'Hermes Power Agent',
    callsign: 'Messenger Rail',
    objective: 'Run memory, goals, briefs, swarms, content, and setup-gated integrations from one control surface.',
    reward: 'Agent leverage',
    geometry: 'orb',
    color: '#F8F5EE',
    secondaryColor: '#D4B483',
    accent: '#FFFFFF',
    lane: 'oracle',
  },
  {
    id: 'prompts',
    href: '/prompts',
    navLabel: 'Prompts',
    title: 'Prompt Arsenal',
    callsign: 'Glyph Library',
    objective: 'Collect, tune, and launch reusable prompts into the right workflow.',
    reward: 'Template mastery',
    geometry: 'library',
    color: '#A78BFA',
    secondaryColor: '#D4B483',
    accent: '#E9D5FF',
    lane: 'oracle',
  },
  {
    id: 'compare',
    href: '/compare',
    navLabel: 'Tribunal',
    title: 'Oracle Tribunal',
    callsign: 'Council Arena',
    objective: 'Compare provider responses and choose the strongest path forward.',
    reward: 'Council clarity',
    geometry: 'tribunal',
    color: '#60A5FA',
    secondaryColor: '#F6C453',
    accent: '#DBEAFE',
    lane: 'oracle',
  },
  {
    id: 'coding',
    href: '/coding',
    navLabel: 'Forge',
    title: 'Forge Bay',
    callsign: 'Patch Crucible',
    objective: 'Compile scoped missions, generate patches, and run validation gates.',
    reward: 'Forge heat',
    geometry: 'forge',
    color: '#F6C453',
    secondaryColor: '#86C9A0',
    accent: '#FEF3C7',
    lane: 'forge',
  },
  {
    id: 'max',
    href: '/max',
    navLabel: 'Max Mode',
    title: 'Max Mode',
    callsign: 'Overnight Engine',
    objective: 'Plan deeper autonomous work while keeping every patch behind approval.',
    reward: 'Long-run focus',
    geometry: 'moon',
    color: '#C084FC',
    secondaryColor: '#7ABCD6',
    accent: '#F5D0FE',
    lane: 'forge',
  },
  {
    id: 'workspace',
    href: '/workspace',
    navLabel: 'Deck',
    title: 'Command Deck',
    callsign: 'File Grid',
    objective: 'Inspect files, review patches, and validate local repo changes.',
    reward: 'Workspace control',
    geometry: 'deck',
    color: '#86C9A0',
    secondaryColor: '#7ABCD6',
    accent: '#D1FAE5',
    lane: 'forge',
  },
  {
    id: 'evolution',
    href: '/evolution',
    navLabel: 'Armory',
    title: 'Evolution Armory',
    callsign: 'Mutation Range',
    objective: 'Test improvement ideas safely before they touch the main workflow.',
    reward: 'Experiment charge',
    geometry: 'armory',
    color: '#FB7185',
    secondaryColor: '#F6C453',
    accent: '#FFE4E6',
    lane: 'forge',
  },
  {
    id: 'agents',
    href: '/agents',
    navLabel: 'Legion',
    title: 'Agent Legion',
    callsign: 'Squad Command',
    objective: 'Stage agent runs, assign work, and inspect completion state.',
    reward: 'Legion renown',
    geometry: 'legion',
    color: '#34D399',
    secondaryColor: '#D4B483',
    accent: '#A7F3D0',
    lane: 'legion',
  },
  {
    id: 'memory',
    href: '/memory',
    navLabel: 'Memory',
    title: 'Memory Vault',
    callsign: 'Context Sanctum',
    objective: 'Anchor project knowledge so every AI run starts with sharper context.',
    reward: 'Context depth',
    geometry: 'vault',
    color: '#FBBF24',
    secondaryColor: '#A78BFA',
    accent: '#FEF3C7',
    lane: 'memory',
  },
  {
    id: 'brief',
    href: '/brief',
    navLabel: 'Brief',
    title: 'Daily Brief',
    callsign: 'Dawn Relay',
    objective: 'Convert scattered priorities into a clean daily command signal.',
    reward: 'Daily focus',
    geometry: 'orb',
    color: '#F59E0B',
    secondaryColor: '#7ABCD6',
    accent: '#FED7AA',
    lane: 'memory',
  },
  {
    id: 'playbooks',
    href: '/playbooks',
    navLabel: 'Doctrine',
    title: 'Doctrine Library',
    callsign: 'Playbook Codex',
    objective: 'Use proven templates for repeatable building, review, and launch work.',
    reward: 'Doctrine rank',
    geometry: 'library',
    color: '#D4B483',
    secondaryColor: '#A78BFA',
    accent: '#F0E8D0',
    lane: 'memory',
  },
  {
    id: 'tasks',
    href: '/tasks',
    navLabel: 'Tasks',
    title: 'Task Phalanx',
    callsign: 'Objective Board',
    objective: 'Move work through visible stages and turn completion into progression.',
    reward: 'Completion XP',
    geometry: 'tribunal',
    color: '#22D3EE',
    secondaryColor: '#86C9A0',
    accent: '#CFFAFE',
    lane: 'command',
  },
  {
    id: 'migrations',
    href: '/migrations',
    navLabel: 'Migrations',
    title: 'Migration Cartography',
    callsign: 'Route Atlas',
    objective: 'Map provider moves, framework changes, and experimental migration paths.',
    reward: 'Route certainty',
    geometry: 'map',
    color: '#38BDF8',
    secondaryColor: '#F6C453',
    accent: '#BAE6FD',
    lane: 'command',
  },
  {
    id: 'github',
    href: '/github',
    navLabel: 'Repo',
    title: 'Repo War Room',
    callsign: 'Branch Citadel',
    objective: 'Inspect branch state and repo signals without auto-pushing or merging.',
    reward: 'Repo integrity',
    geometry: 'repo',
    color: '#94A3B8',
    secondaryColor: '#86C9A0',
    accent: '#E2E8F0',
    lane: 'repo',
  },
  {
    id: 'autopilot',
    href: '/autopilot',
    navLabel: 'Autopilot',
    title: 'Autopilot Praetorium',
    callsign: 'Automation Arena',
    objective: 'Schedule recurring work while keeping approvals and safety gates visible.',
    reward: 'Automation control',
    geometry: 'citadel',
    color: '#2DD4BF',
    secondaryColor: '#D4B483',
    accent: '#CCFBF1',
    lane: 'command',
  },
  {
    id: 'automations',
    href: '/automations',
    navLabel: 'Automations',
    title: 'Automation Relay',
    callsign: 'Scheduler Ring',
    objective: 'Monitor recurring jobs, runs, approvals, and follow-up loops.',
    reward: 'Cadence control',
    geometry: 'map',
    color: '#14B8A6',
    secondaryColor: '#F6C453',
    accent: '#CCFBF1',
    lane: 'command',
  },
  {
    id: 'settings',
    href: '/settings',
    navLabel: 'Settings',
    title: 'Provider Forge',
    callsign: 'Config Anvil',
    objective: 'Configure providers, paid gates, daemon paths, and system preferences honestly.',
    reward: 'System readiness',
    geometry: 'forge',
    color: '#E879F9',
    secondaryColor: '#D4B483',
    accent: '#F5D0FE',
    lane: 'command',
  },
  {
    id: 'launch',
    href: '/launch',
    navLabel: 'Launch',
    title: 'Launch Readiness',
    callsign: 'Publish Gate',
    objective: 'Verify domain, installability, local bridge, safety gates, and Creator OS readiness.',
    reward: 'Public OS confidence',
    geometry: 'citadel',
    color: '#34D399',
    secondaryColor: '#7ABCD6',
    accent: '#D1FAE5',
    lane: 'command',
  },
]

export function getGameModuleForPath(pathname: string | null | undefined) {
  const path = pathname || '/dashboard'
  if (path === '/builder') return GAME_MODULES.find(module => module.id === 'coding') ?? GAME_MODULES[0]
  const exact = GAME_MODULES.find(module => path === module.href || path.startsWith(`${module.href}/`))
  return exact ?? GAME_MODULES[0]
}

export function getNextGameModule(currentId: GameModuleId) {
  const index = GAME_MODULES.findIndex(module => module.id === currentId)
  return GAME_MODULES[(index + 1) % GAME_MODULES.length] ?? GAME_MODULES[0]
}

export function getPreviousGameModule(currentId: GameModuleId) {
  const index = GAME_MODULES.findIndex(module => module.id === currentId)
  return GAME_MODULES[(index - 1 + GAME_MODULES.length) % GAME_MODULES.length] ?? GAME_MODULES[0]
}
