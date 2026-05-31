import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { makeRuntimeId, nowIso, readJsonFile, runtimePath, slugify, writeJsonFile } from '../runtime-store'
import type { OutputArtifactType } from '../outputs/types'
import type { SkillDefinition, SkillMemoryAccess, SkillPatchDraft, SkillPermission } from './types'

const PATCH_INDEX = runtimePath('skills', '_patches', 'patches.json')

const SEED_SKILLS: Record<string, string> = {
  'youtube-researcher': `---
id: youtube-researcher
name: YouTube Researcher
version: 1.0.0
command: /youtube-researcher
description: Ground content strategy and scripts in YouTube transcripts.
required_plugins: [youtube, filesystem]
optional_plugins: [browser, memory, outputs]
default_agent: content-grounding-agent
output_types: [transcript_analysis, hook_options, script, content_ideas]
memory_access: read_project_write_proposals
permissions: [read_external_sources, write_outputs, propose_memory]
approval_required_for: [memory_write, publishing, paid_api]
---

## Purpose
Analyze YouTube transcripts, hooks, style patterns, and creator examples to produce grounded original content.

## Inputs
- video_url, channel_url, pasted_transcript, latest_n, target_topic, output_count, analysis_mode

## Workflow
1. Collect transcript or accept pasted transcript in degraded mode.
2. Extract hooks, intros, pacing, examples, teaching moves, and recurring structure.
3. Generate original hooks, intros, scripts, explanations, or idea lists.
4. Cite every source URL used.
5. Propose reusable style notes only as memory proposals.

## Output Policy
Save transcript analysis, hook options, scripts, and idea lists as Output Registry artifacts with source links.

## Memory Policy
Never store raw transcripts automatically. Propose compact, source-linked style notes for review.

## Safety Policy
Do not impersonate a creator or imply endorsement. If live YouTube tools are unavailable, use pasted transcripts or URLs only.

## Examples
- /youtube-researcher @youtube video_url=https://youtube.com/watch?v=... mode=hooks
- /youtube-researcher pasted_transcript="..." target_topic="BertOS skills" output_count=10
`,
  'second-brain': `---
id: second-brain
name: Second Brain
version: 1.0.0
command: /second-brain
description: Turn saved highlights, notes, and bookmarks into grounded content ideas.
required_plugins: [memory, outputs]
optional_plugins: [readwise, filesystem]
default_agent: second-brain-agent
output_types: [content_ideas, automation_digest, memory_note]
memory_access: read_project_write_proposals
permissions: [read_external_sources, read_memory, write_outputs, propose_memory]
approval_required_for: [memory_write]
---

## Purpose
Group saved notes and highlights by theme, then create source-linked content concepts and daily digests.

## Inputs
- timeframe, tags, source_filter, output_count, target_platform

## Workflow
1. Search Readwise if configured; otherwise use BertOS memory and previous outputs.
2. Group references into themes.
3. Create ideas with original source links.
4. Save digest and propose durable themes for memory review.

## Output Policy
Every idea must include at least one source reference or state that it came from local memory.

## Memory Policy
Do not store raw private notes automatically. Propose themes, preferences, and selected ideas only.

## Safety Policy
Do not invent sources.

## Examples
- /second-brain @readwise timeframe=3d output_count=10
`,
  'excalidraw-diagrams': `---
id: excalidraw-diagrams
name: Excalidraw Diagrams
version: 1.0.0
command: /diagram
description: Create low-text, visual-first diagrams and diagram plans.
required_plugins: [outputs]
optional_plugins: [excalidraw, filesystem]
default_agent: diagram-agent
output_types: [diagram]
memory_access: read_project_write_proposals
permissions: [write_outputs, propose_memory]
approval_required_for: [memory_write]
---

## Purpose
Create visual-first diagrams for explainers, teaching aids, and planning boards.

## Inputs
- concept, audience, format, low_text_mode, export_format

## Workflow
1. Identify the core visual structure.
2. Use arrows, grouping, frames, icons, and short labels.
3. Save diagram JSON/markdown plan and preview descriptor.
4. Capture user diagram preferences as memory proposals after approval.

## Output Policy
Prefer Excalidraw-compatible JSON when adapter is available; otherwise save a diagram spec and preview plan.

## Memory Policy
Only save durable diagram preferences, not every temporary sketch.

## Safety Policy
Keep text minimal by default.

## Examples
- /diagram explain skills vs plugins in low-text mode
`,
  'paper-canvas': `---
id: paper-canvas
name: AI Canvas
version: 1.0.0
command: /paper-canvas
description: Create AI-native design canvases, concept boards, and screenshot-feedback iterations.
required_plugins: [outputs]
optional_plugins: [paper, browser, filesystem]
default_agent: ai-canvas-agent
output_types: [design_canvas, thumbnail]
memory_access: read_project_write_proposals
permissions: [write_outputs, propose_memory]
approval_required_for: [memory_write]
---

## Purpose
Create editable visual canvases for diagrams, thumbnails, landing concepts, lead magnets, and brand planning.

## Workflow
Generate canvas JSON, preview instructions, and feedback checkpoints. Iterate from screenshots or annotations.

## Degraded Mode
If Paper is unavailable, create local canvas JSON and HTML/PNG export instructions.
`,
  'motion-graphics': `---
id: motion-graphics
name: Motion Graphics
version: 1.0.0
command: /motion-graphics
description: Plan Remotion/Hyperframes-style launch videos, demos, overlays, and animated B-roll.
required_plugins: [outputs]
optional_plugins: [remotion, hyperframes, filesystem]
default_agent: motion-agent
output_types: [motion_composition, rendered_video]
memory_access: read_project_write_proposals
permissions: [write_outputs, run_local_tools, propose_memory]
approval_required_for: [memory_write, paid_api]
---

## Purpose
Create timeline-aware motion composition specs and reusable video templates.

## Workflow
Define scenes, durations, assets, variations, render settings, and edit notes.

## Degraded Mode
If render tools are unavailable, create composition JSON and render instructions without claiming video export.
`,
  'gen-media-studio': `---
id: gen-media-studio
name: Gen Media Studio
version: 1.0.0
command: /gen-media
description: Generate, organize, and review media assets in the shared Studio grid.
required_plugins: [outputs]
optional_plugins: [fal, filesystem]
default_agent: studio-agent
output_types: [image_asset, thumbnail, rendered_video]
memory_access: read_project_write_proposals
permissions: [write_outputs, use_paid_api, propose_memory]
approval_required_for: [paid_api, likeness_generation, memory_write]
---

## Purpose
Create image/video/audio prompt sets and generated assets for human review.

## Workflow
Create multiple options, save prompt history, place assets in the Studio grid, and wait for human selection.

## Safety Policy
Paid generation and likeness/persona generation require explicit approval.
`,
  'inbox-deal-manager': `---
id: inbox-deal-manager
name: Inbox / Brand Deal Manager
version: 1.0.0
command: /brand-deal-manager
description: Triage sponsorship and important inbox opportunities with approval gates.
required_plugins: [outputs]
optional_plugins: [gmail, calendar, memory]
default_agent: deal-flow-agent
output_types: [email_priority_table, calendar_suggestion, automation_digest]
memory_access: read_client_scoped_write_proposals
permissions: [read_external_sources, write_outputs, send_email, schedule_calendar, propose_memory]
approval_required_for: [send_email, schedule_calendar, memory_write]
---

## Purpose
Find, score, and prepare brand deal opportunities.

## Workflow
Search inbox if connected, score opportunities, draft reply strategy, suggest meeting windows, and require approval before sends/schedules.

## Safety Policy
Never send email or schedule calendar events without explicit approval. Do not store private email content automatically.
`,
  'publishing-queue': `---
id: publishing-queue
name: Publishing Queue
version: 1.0.0
command: /publishing-queue
description: Convert BertOS ideas and outputs into local or Buffer-backed publishing queue items.
required_plugins: [outputs]
optional_plugins: [buffer, memory]
default_agent: publishing-agent
output_types: [publishing_queue_item, automation_digest]
memory_access: read_project_write_proposals
permissions: [read_memory, write_outputs, publish, propose_memory]
approval_required_for: [publishing, memory_write]
---

## Purpose
Draft platform variants and queue publishable ideas from BertOS memory, chats, and outputs.

## Workflow
Extract ideas, create captions, create platform variants, save to local queue or Buffer draft after approval.

## Safety Policy
Never publish or schedule without approval.
`,
  ...buildCodingSeedSkills(),
}

function codingSkill(opts: {
  id: string; name: string; command: string; description: string; outputs: string; purpose: string
  workflow: string[]; degraded: string; example: string; approval?: string
}): string {
  return `---
id: ${opts.id}
name: ${opts.name}
version: 1.0.0
command: ${opts.command}
description: ${opts.description}
required_plugins: [filesystem, project-registry, code-search]
optional_plugins: [git, command-runner, patcher, test-runner, provider, outputs, memory, approvals, runs]
default_agent: bertos-coding-agent
output_types: [${opts.outputs}]
memory_access: read_project_write_proposals
permissions: [read_files, read_git, run_allowlisted_commands, propose_patch, write_outputs, propose_memory]
approval_required_for: [${opts.approval ?? 'patch_apply, git_push, package_install, deploy, paid_api'}]
---

## Purpose
${opts.purpose}

## Inputs
- active project, user request, file paths, git status/diff, validation output

## Workflow
${opts.workflow.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Output Policy
Save a grounded artifact to the Output Registry and record an AgentRun + WorkflowRun with lane logs.

## Memory Policy
Propose durable lessons (decisions, failure lessons, patterns) for review only. Never write memory automatically. Secrets are blocked.

## Safety Policy
Read-only by default. Patch apply, git push/commit, deploys, deletions, package installs, and paid APIs require explicit approval. Commands are allowlisted; sensitive files are blocked.

## Degraded Mode
${opts.degraded}

## Examples
- ${opts.example}
`
}

function buildCodingSeedSkills(): Record<string, string> {
  const defs = [
    { id: 'codebase-explainer', name: 'Codebase Explainer', command: '/explain-codebase', description: 'Explain a repo: structure, stack, important files, and how it fits together.', outputs: 'repo_map, code_search_summary', purpose: 'Produce a grounded map of the active project so you can orient quickly.', workflow: ['Read project structure, important files, and tech stack.', 'Summarize architecture and entry points.', 'Cite real files only.'], degraded: 'With no provider, returns a deterministic grounded repo map from real structure.', example: '/explain-codebase' },
    { id: 'feature-builder', name: 'Feature Builder', command: '/build-feature', description: 'Turn a feature request into a plan and a safe patch proposal.', outputs: 'feature_plan, implementation_plan, patch_proposal', purpose: 'Plan and scaffold a feature, ending in an approval-gated patch proposal.', workflow: ['Locate affected modules via code search.', 'Draft a scoped plan and follow-up tasks.', 'Create a patch proposal (never auto-applied).'], degraded: 'With no provider, emits a deterministic plan + follow-up tasks.', example: '/build-feature add a settings page' },
    { id: 'bug-hunter', name: 'Bug Hunter', command: '/debug', description: 'Investigate a bug from symptoms, logs, and the current diff.', outputs: 'bug_report, implementation_plan', purpose: 'Localize a defect and propose the smallest safe fix.', workflow: ['Reproduce from validation/command output.', 'Localize with code search.', 'Propose a minimal patch.'], degraded: 'With no provider, summarizes failing validation and likely files.', example: '/debug the build is failing on typecheck' },
    { id: 'test-writer', name: 'Test Writer', command: '/write-tests', description: 'Plan and draft tests for changed or critical code.', outputs: 'test_report, implementation_plan', purpose: 'Increase coverage on safety-critical and changed code.', workflow: ['Detect test tooling.', 'Identify untested critical paths.', 'Draft test cases / a patch proposal.'], degraded: 'With no provider, lists suggested coverage from real structure.', example: '/write-tests for the patch pipeline' },
    { id: 'build-fixer', name: 'Build Fixer', command: '/fix-build', description: 'Triage a failing build/validation and propose a fix.', outputs: 'bug_report, implementation_plan', purpose: 'Get back to green from a failing validation run.', workflow: ['Read the latest validation report.', 'Reproduce the failing command.', 'Propose the smallest fix.'], degraded: 'With no provider, returns a deterministic triage from the last validation run.', example: '/fix-build' },
    { id: 'refactor-planner', name: 'Refactor Planner', command: '/refactor', description: 'Plan a safe, incremental refactor.', outputs: 'implementation_plan, feature_plan', purpose: 'Sequence a refactor into small, verifiable steps.', workflow: ['Map the target area.', 'Propose incremental steps.', 'Create follow-up tasks; defer edits to patches.'], degraded: 'With no provider, returns a deterministic step list grounded in structure.', example: '/refactor extract the provider router' },
    { id: 'docs-writer', name: 'Docs Writer', command: '/write-docs', description: 'Draft or update documentation grounded in the code.', outputs: 'docs_update', purpose: 'Produce accurate docs from real files and structure.', workflow: ['Read relevant files.', 'Draft docs.', 'Propose a docs patch for review.'], degraded: 'With no provider, outlines doc sections from real structure.', example: '/write-docs for the coding API', approval: 'patch_apply, publishing' },
    { id: 'release-manager', name: 'Release Manager', command: '/release-check', description: 'Assess release readiness from validation, git, and decisions.', outputs: 'release_checklist', purpose: 'Produce a release readiness checklist; releasing stays manual.', workflow: ['Check validation status.', 'Check working-tree cleanliness and upstream.', 'List blockers.'], degraded: 'Deterministic readiness checklist from real state.', example: '/release-check', approval: 'git_push, deploy, publishing' },
    { id: 'daily-coding-planner', name: 'Daily Coding Planner', command: '/daily-dev', description: 'A grounded daily briefing of tasks, patches, and validation.', outputs: 'daily_dev_briefing', purpose: 'Start the day with a focused, grounded plan.', workflow: ['Gather open tasks, pending patches, validation.', 'Suggest a focus.', 'Optionally create tasks.'], degraded: 'Deterministic briefing from real tasks/patches/validation.', example: '/daily-dev' },
    { id: 'pr-reviewer', name: 'PR Reviewer', command: '/review-diff', description: 'Review the current working-tree diff for issues.', outputs: 'diff_review', purpose: 'Catch problems in changes before commit.', workflow: ['Read git status/diff.', 'Review for correctness, safety, and secrets.', 'Summarize findings.'], degraded: 'Deterministic diff summary + checklist from real git state.', example: '/review-diff' },
    { id: 'dependency-auditor', name: 'Dependency Auditor', command: '/dependency-audit', description: 'Inspect dependencies and flag risks (read-only).', outputs: 'bug_report, code_search_summary', purpose: 'Surface dependency risks; installs require approval.', workflow: ['Read package manifests.', 'Flag outdated/risky deps.', 'Propose follow-up tasks.'], degraded: 'Deterministic summary of declared dependencies.', example: '/dependency-audit', approval: 'package_install, paid_api' },
    { id: 'ui-polisher', name: 'UI Polisher', command: '/polish-ui', description: 'Plan UI/UX polish grounded in real components.', outputs: 'implementation_plan, diff_review', purpose: 'Identify polish opportunities and propose safe patches.', workflow: ['Locate UI components.', 'List polish opportunities.', 'Propose patches for review.'], degraded: 'Deterministic polish checklist from real component files.', example: '/polish-ui the cockpit' },
  ]
  const record: Record<string, string> = {}
  for (const def of defs) record[def.id] = codingSkill(def)
  return record
}

function parseList(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return trimmed ? [trimmed] : []
  return trimmed.slice(1, -1).split(',').map(item => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) throw new Error('skill.md is missing YAML frontmatter.')
  const raw: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':')
    if (index < 0) continue
    raw[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return { raw, body: match[2].trim() }
}

export function parseSkillMarkdown(markdown: string, source: SkillDefinition['source'] = 'runtime', filePath?: string): SkillDefinition {
  const { raw, body } = parseFrontmatter(markdown)
  const definition: SkillDefinition = {
    id: raw.id,
    name: raw.name,
    version: raw.version || '0.1.0',
    command: (raw.command || `/${raw.id}`) as `/${string}`,
    description: raw.description || '',
    requiredPlugins: parseList(raw.required_plugins || ''),
    optionalPlugins: parseList(raw.optional_plugins || ''),
    defaultAgent: raw.default_agent || 'bertos-orchestrator',
    outputTypes: parseList(raw.output_types || '[]') as OutputArtifactType[],
    memoryAccess: (raw.memory_access || 'none') as SkillMemoryAccess,
    permissions: parseList(raw.permissions || '[]') as SkillPermission[],
    approvalRequiredFor: parseList(raw.approval_required_for || '[]'),
    body,
    source,
    filePath,
    examples: body.split('\n').filter(line => line.trim().startsWith('- /')).map(line => line.replace(/^-\s*/, '').trim()),
  }
  validateSkillDefinition(definition)
  return definition
}

export function validateSkillDefinition(skill: SkillDefinition) {
  if (!skill.id || !/^[a-z0-9-]+$/.test(skill.id)) throw new Error('Skill id must be kebab-case.')
  if (!skill.name) throw new Error(`${skill.id} is missing name.`)
  if (!skill.command?.startsWith('/')) throw new Error(`${skill.id} command must start with /.`)
  if (!skill.version) throw new Error(`${skill.id} is missing version.`)
  return true
}

async function readRuntimeSkills() {
  const skillsRoot = runtimePath('skills')
  const entries = await readdir(skillsRoot, { withFileTypes: true }).catch(() => [])
  const skills: SkillDefinition[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    const filePath = path.join(skillsRoot, entry.name, 'skill.md')
    try {
      skills.push(parseSkillMarkdown(await readFile(filePath, 'utf8'), 'runtime', filePath))
    } catch {
      // Ignore invalid runtime skills; tests and UI can validate individual files later.
    }
  }
  return skills
}

export async function listSkills() {
  const builtIns = Object.values(SEED_SKILLS).map(markdown => parseSkillMarkdown(markdown, 'built-in'))
  const runtime = await readRuntimeSkills()
  const byId = new Map(builtIns.map(skill => [skill.id, skill]))
  for (const skill of runtime) byId.set(skill.id, skill)
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getSkill(idOrCommand: string) {
  const normalized = idOrCommand.replace(/^\//, '')
  return (await listSkills()).find(skill => skill.id === normalized || skill.command === idOrCommand) ?? null
}

export async function seedRuntimeSkills() {
  for (const [id, markdown] of Object.entries(SEED_SKILLS)) {
    const dir = runtimePath('skills', id)
    const file = path.join(dir, 'skill.md')
    await mkdir(path.join(dir, 'examples'), { recursive: true })
    await mkdir(path.join(dir, 'outputs'), { recursive: true })
    await mkdir(path.join(dir, 'references'), { recursive: true })
    await mkdir(path.join(dir, 'tests'), { recursive: true })
    try {
      await readFile(file, 'utf8')
    } catch {
      await writeFile(file, markdown, 'utf8')
    }
  }
}

export async function duplicateSkill(skillId: string, newId?: string) {
  const skill = await getSkill(skillId)
  if (!skill) throw new Error('Skill not found.')
  const targetId = slugify(newId || `${skill.id}-copy`)
  const markdown = `---
id: ${targetId}
name: ${skill.name} Copy
version: 1.0.0
command: /${targetId}
description: ${skill.description}
required_plugins: [${skill.requiredPlugins.join(', ')}]
optional_plugins: [${skill.optionalPlugins.join(', ')}]
default_agent: ${skill.defaultAgent}
output_types: [${skill.outputTypes.join(', ')}]
memory_access: ${skill.memoryAccess}
permissions: [${skill.permissions.join(', ')}]
approval_required_for: [${skill.approvalRequiredFor.join(', ')}]
---

${skill.body}
`
  const dir = runtimePath('skills', targetId)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'skill.md'), markdown, 'utf8')
  return parseSkillMarkdown(markdown, 'runtime', path.join(dir, 'skill.md'))
}

function bumpPatch(version: string) {
  const parts = version.split('.').map(part => Number(part) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.slice(0, 3).join('.')
}

export async function draftSkillPatch(skillId: string, instruction: string): Promise<SkillPatchDraft> {
  const skill = await getSkill(skillId)
  if (!skill) throw new Error('Skill not found.')
  const proposedVersion = bumpPatch(skill.version)
  const proposedMarkdown = `---
id: ${skill.id}
name: ${skill.name}
version: ${proposedVersion}
command: ${skill.command}
description: ${skill.description}
required_plugins: [${skill.requiredPlugins.join(', ')}]
optional_plugins: [${skill.optionalPlugins.join(', ')}]
default_agent: ${skill.defaultAgent}
output_types: [${skill.outputTypes.join(', ')}]
memory_access: ${skill.memoryAccess}
permissions: [${skill.permissions.join(', ')}]
approval_required_for: [${skill.approvalRequiredFor.join(', ')}]
---

${skill.body}

## User Preference Patch ${nowIso()}
${instruction}
`
  const draft: SkillPatchDraft = {
    patchId: makeRuntimeId('skillpatch'),
    skillId: skill.id,
    instruction,
    currentVersion: skill.version,
    proposedVersion,
    proposedMarkdown,
    diffSummary: [`Append user preference to ${skill.id}`, `Bump version ${skill.version} -> ${proposedVersion}`],
    createdAt: nowIso(),
    status: 'draft',
  }
  const patches = await readJsonFile<SkillPatchDraft[]>(PATCH_INDEX, [])
  await writeJsonFile(PATCH_INDEX, [draft, ...patches])
  return draft
}

export async function applySkillPatch(patchId: string, approved: boolean) {
  const patches = await readJsonFile<SkillPatchDraft[]>(PATCH_INDEX, [])
  const patch = patches.find(item => item.patchId === patchId)
  if (!patch) throw new Error('Patch not found.')
  if (!approved) {
    const updated = { ...patch, status: 'rejected' as const }
    await writeJsonFile(PATCH_INDEX, patches.map(item => item.patchId === patchId ? updated : item))
    return updated
  }
  const skill = parseSkillMarkdown(patch.proposedMarkdown, 'runtime')
  const dir = runtimePath('skills', skill.id)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'skill.md'), patch.proposedMarkdown, 'utf8')
  const updated = { ...patch, status: 'applied' as const }
  await writeJsonFile(PATCH_INDEX, patches.map(item => item.patchId === patchId ? updated : item))
  return updated
}
