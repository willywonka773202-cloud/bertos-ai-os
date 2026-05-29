import type { AutomationAction, AutomationRule } from '@/lib/bertos/types'

export const STARTER_AUTOMATION_ACTIONS = [
  'create-daily-brief-task',
  'create-inbox-triage-task',
  'create-weekly-review-task',
  'create-content-pipeline-task',
  'create-connector-setup-task',
] as const satisfies readonly AutomationAction[]

export type StarterAutomationAction = (typeof STARTER_AUTOMATION_ACTIONS)[number]

export interface AutomationStarterDefinition {
  id: string
  ruleId: string
  title: string
  shortTitle: string
  description: string
  action: StarterAutomationAction
  cadence: string
  scope: string
  connectors: string[]
  guardrails: string[]
  firstStep: string
}

export const STARTER_AUTOMATIONS: AutomationStarterDefinition[] = [
  {
    id: 'daily-life-brief',
    ruleId: 'rule-life-daily-brief',
    title: 'Daily Life Brief',
    shortTitle: 'Daily brief',
    description: 'Plan a morning brief that can gather agenda, priorities, reminders, inbox alerts, and project status into one reviewable snapshot.',
    action: 'create-daily-brief-task',
    cadence: 'Daily at your chosen time',
    scope: 'Personal planning',
    connectors: ['Calendar', 'Gmail', 'Tasks', 'Memory'],
    guardrails: ['Draft-only output', 'No message sending', 'No calendar changes without approval'],
    firstStep: 'Create the brief spec, required connectors, and approval gates.',
  },
  {
    id: 'inbox-triage',
    ruleId: 'rule-inbox-triage-starter',
    title: 'Inbox Triage',
    shortTitle: 'Inbox triage',
    description: 'Design an inbox workflow that ranks urgent mail, drafts suggested replies, and separates FYI messages from action items.',
    action: 'create-inbox-triage-task',
    cadence: 'Manual or recurring review',
    scope: 'Email operations',
    connectors: ['Gmail', 'Memory'],
    guardrails: ['Never send automatically', 'Never delete automatically', 'Approval before labels or archive actions'],
    firstStep: 'Define triage categories, safe read scopes, and reply-draft approval rules.',
  },
  {
    id: 'weekly-review',
    ruleId: 'rule-weekly-life-review',
    title: 'Weekly Life Review',
    shortTitle: 'Weekly review',
    description: 'Create a weekly review workflow that summarizes tasks, open loops, project movement, and memory items needing attention.',
    action: 'create-weekly-review-task',
    cadence: 'Weekly',
    scope: 'Personal operating rhythm',
    connectors: ['Tasks', 'Memory', 'Workspace', 'Outputs'],
    guardrails: ['Read-only summary first', 'Explicit approval for follow-up tasks', 'Audit log for every generated item'],
    firstStep: 'Map the review sections and the data each section can read.',
  },
  {
    id: 'content-pipeline',
    ruleId: 'rule-content-pipeline-starter',
    title: 'Content Pipeline',
    shortTitle: 'Content pipeline',
    description: 'Turn notes, transcripts, and ideas into an approval-gated publishing queue with drafts, hooks, and repurposing tasks.',
    action: 'create-content-pipeline-task',
    cadence: 'Weekly or source-triggered',
    scope: 'Creator operations',
    connectors: ['Drive', 'Memory', 'Outputs', 'Publishing queue'],
    guardrails: ['No publishing without approval', 'Source links preserved', 'Generated drafts marked as drafts'],
    firstStep: 'Pick source folders, output destinations, and approval checkpoints.',
  },
  {
    id: 'connector-setup',
    ruleId: 'rule-life-connector-setup',
    title: 'Life Automation Connector Setup',
    shortTitle: 'Connector setup',
    description: 'Inventory the connectors, scopes, local daemon paths, and approval policies needed before BertOS can automate personal workflows.',
    action: 'create-connector-setup-task',
    cadence: 'One-time setup audit',
    scope: 'Automation readiness',
    connectors: ['Gmail', 'Calendar', 'Drive', 'Browser', 'Local daemon'],
    guardrails: ['No secrets exposed', 'Minimum required scopes', 'Setup status reported as ready, missing, or disabled'],
    firstStep: 'Generate a connector checklist and mark what is currently missing.',
  },
]

export const STARTER_AUTOMATION_RULE_TEMPLATES: Array<Omit<AutomationRule, 'createdAt' | 'updatedAt'>> =
  STARTER_AUTOMATIONS.map(starter => ({
    id: starter.ruleId,
    name: starter.title,
    description: `${starter.description} First step: ${starter.firstStep}`,
    enabled: true,
    trigger: 'manual',
    actions: [starter.action],
    risk: 'approval-required',
  }))

export function isStarterAutomationAction(action: AutomationAction): action is StarterAutomationAction {
  return STARTER_AUTOMATION_ACTIONS.includes(action as StarterAutomationAction)
}

export function getStarterAutomation(action: StarterAutomationAction) {
  return STARTER_AUTOMATIONS.find(starter => starter.action === action)
}

export function buildStarterAutomationTaskDescription(action: StarterAutomationAction, runTitle: string) {
  const starter = getStarterAutomation(action)
  if (!starter) return `Create an approval-gated automation plan for "${runTitle}".`

  return [
    `Generated from Autopilot starter "${runTitle}".`,
    '',
    `Automation: ${starter.title}`,
    `Scope: ${starter.scope}`,
    `Cadence: ${starter.cadence}`,
    `Connectors to verify: ${starter.connectors.join(', ')}`,
    '',
    'Goal:',
    `- ${starter.description}`,
    `- ${starter.firstStep}`,
    '- Return a concrete build plan that can be implemented in BertOS without duplicating existing Autopilot, Workspace, Memory, or Outputs systems.',
    '',
    'Guardrails:',
    ...starter.guardrails.map(item => `- ${item}`),
    '- Do not expose secrets or read .env files.',
    '- Do not send emails, publish content, edit calendars, spend money, push code, deploy, or delete files without explicit approval.',
    '- Mark every external connector as ready, missing setup, or disabled. Do not pretend a connector works until it is verified.',
    '',
    'Done when:',
    '- The required connector scopes are listed.',
    '- The first safe implementation step is identified.',
    '- Approval gates are defined for every action that changes external state.',
  ].join('\n')
}
