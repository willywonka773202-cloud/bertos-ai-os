import type { WorkflowDefinition } from './types'

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'raw-thought-to-memory-action-plan',
    name: 'Raw Thought to Memory + Action Plan',
    description: 'Turn a note, voice transcript, or rough thought into structured memory proposals and next actions.',
    trigger: 'manual/raw-thought',
    skillChain: ['second-brain'],
    pluginIds: ['memory', 'outputs'],
    outputTypes: ['memory_note', 'content_ideas'],
    approvalRequired: false,
  },
  {
    id: 'research-outline-draft-publish-checklist',
    name: 'Research -> Outline -> Draft -> Publish Checklist',
    description: 'Create a source-grounded content package with a publishing checklist.',
    trigger: 'manual/topic',
    skillChain: ['youtube-researcher', 'second-brain', 'publishing-queue'],
    pluginIds: ['memory', 'outputs', 'youtube', 'readwise'],
    outputTypes: ['transcript_analysis', 'content_ideas', 'script', 'publishing_queue_item'],
    approvalRequired: false,
  },
  {
    id: 'idea-to-project-plan-tasks',
    name: 'Idea to Project Plan + Tasks',
    description: 'Convert an idea into a project plan, task list, and memory proposals.',
    trigger: 'manual/idea',
    skillChain: ['second-brain'],
    pluginIds: ['memory', 'outputs'],
    outputTypes: ['workflow_report', 'memory_note'],
    approvalRequired: false,
  },
  {
    id: 'app-idea-scaffold-code-test-deploy-notes',
    name: 'App Idea to Scaffold/Test/Deploy Notes',
    description: 'Produce an implementation mission and deploy notes without pushing or deploying.',
    trigger: 'manual/app-idea',
    skillChain: ['second-brain'],
    pluginIds: ['filesystem', 'outputs'],
    outputTypes: ['workflow_report', 'validation_report'],
    approvalRequired: true,
  },
  {
    id: 'content-idea-digest',
    name: 'Content Idea Digest',
    description: 'Collect grounded ideas from memory and previous outputs.',
    trigger: 'manual-or-schedule/digest',
    skillChain: ['second-brain', 'publishing-queue'],
    pluginIds: ['memory', 'outputs'],
    outputTypes: ['content_ideas', 'automation_digest'],
    approvalRequired: false,
  },
  {
    id: 'brand-deal-digest',
    name: 'Brand Deal Digest',
    description: 'Local/degraded sponsorship opportunity table until Gmail/Calendar connectors are configured.',
    trigger: 'manual-or-schedule/inbox',
    skillChain: ['inbox-deal-manager'],
    pluginIds: ['gmail', 'calendar', 'outputs'],
    outputTypes: ['email_priority_table', 'calendar_suggestion'],
    approvalRequired: true,
  },
  {
    id: 'publishing-queue-local-fallback',
    name: 'Publishing Queue Local Fallback',
    description: 'Create local publishing queue items without sending to Buffer.',
    trigger: 'manual-or-schedule/publishing',
    skillChain: ['publishing-queue'],
    pluginIds: ['outputs', 'buffer'],
    outputTypes: ['publishing_queue_item'],
    approvalRequired: false,
  },
]

export function getWorkflowDefinition(id: string) {
  return WORKFLOW_DEFINITIONS.find(definition => definition.id === id) ?? null
}
