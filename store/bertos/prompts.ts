import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { HERMES_POWER_PROMPTS } from '@/lib/bertos/hermes-power-pack'
import { STYLUSLY_REBUILD_MAX_PROMPT, STYLUSLY_REBUILD_PROMPT_TITLE } from '@/lib/bertos/stylusly-rebuild-prompt'

export type PromptCategory = 'coding' | 'business' | 'school' | 'agents' | 'personal' | 'custom'

export interface PromptTemplate {
  id: string
  title: string
  category: PromptCategory
  content: string
  description?: string
  variables: string[] // e.g., ['projectName', 'goal', 'files']
  tags: string[]
  favorite: boolean
  usageCount: number
  createdAt: number
  updatedAt: number
}

interface PromptStore {
  prompts: PromptTemplate[]

  createPrompt: (data: Omit<PromptTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => PromptTemplate
  updatePrompt: (id: string, updates: Partial<PromptTemplate>) => void
  deletePrompt: (id: string) => void
  getPrompt: (id: string) => PromptTemplate | null
  getPromptsByCategory: (category: PromptCategory) => PromptTemplate[]
  incrementUsage: (id: string) => void
  toggleFavorite: (id: string) => void
  searchPrompts: (query: string) => PromptTemplate[]
  duplicatePrompt: (id: string) => PromptTemplate | null
}

const DEFAULT_PROMPTS: Omit<PromptTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>[] = [
  // Coding prompts
  {
    title: 'Fix TypeScript Errors',
    category: 'coding',
    content: `Review this codebase and fix all TypeScript errors.

Project: {{projectName}}
Focus areas: {{focusAreas}}

Rules:
- Fix type errors without changing functionality
- Maintain existing code style
- Add types, don't use 'any'
- Explain each fix`,
    description: 'Systematically fix TypeScript type errors in a project',
    variables: ['projectName', 'focusAreas'],
    tags: ['typescript', 'debugging', 'types'],
    favorite: false,
  },
  {
    title: STYLUSLY_REBUILD_PROMPT_TITLE,
    category: 'coding',
    content: STYLUSLY_REBUILD_MAX_PROMPT,
    description: 'Max Mode rebuild prompt for restoring Stylusly as a complete fashion styling app instead of a stripped-down Fits clone.',
    variables: [],
    tags: ['stylusly', 'max', 'fashion', 'rebuild', 'product', 'ui', 'database'],
    favorite: true,
  },
  {
    title: 'Improve UI Polish',
    category: 'coding',
    content: `Polish the UI for: {{component}}

Improvements needed:
- Better spacing and alignment
- Smooth animations
- Loading states
- Empty states
- Error states
- Mobile responsive
- Accessibility

Keep existing functionality. Focus on visual quality and user experience.`,
    description: 'Enhance UI/UX of a component',
    variables: ['component'],
    tags: ['ui', 'ux', 'design', 'polish'],
    favorite: false,
  },
  {
    title: 'Add Feature Safely',
    category: 'coding',
    content: `Add this feature to the project: {{featureDescription}}

Requirements:
- Use existing architecture
- Match current code style
- Add TypeScript types
- Handle errors gracefully
- Test edge cases
- Don't break existing features

Files likely affected: {{files}}`,
    description: 'Add a new feature without breaking existing code',
    variables: ['featureDescription', 'files'],
    tags: ['feature', 'development', 'architecture'],
    favorite: false,
  },
  {
    title: 'Debug Build Failure',
    category: 'coding',
    content: `The build is failing with this error:

{{error}}

Project: {{projectName}}
Build command: {{buildCommand}}

Please:
1. Diagnose the root cause
2. Explain what went wrong
3. Provide a fix
4. Verify the fix works`,
    description: 'Debug and fix build failures',
    variables: ['error', 'projectName', 'buildCommand'],
    tags: ['debugging', 'build', 'fix'],
    favorite: false,
  },

  // Business prompts
  {
    title: 'MVP Plan',
    category: 'business',
    content: `Create an MVP plan for: {{productIdea}}

Include:
1. Core features (must-have for v1)
2. Nice-to-have features (v2)
3. Tech stack recommendation
4. Timeline estimate (weeks)
5. Key risks
6. Success metrics

Keep it lean and focused. The goal is to validate the idea quickly.`,
    description: 'Plan a minimum viable product',
    variables: ['productIdea'],
    tags: ['mvp', 'planning', 'startup'],
    favorite: false,
  },
  {
    title: 'Landing Page Copy',
    category: 'business',
    content: `Write landing page copy for: {{productName}}

Product description: {{description}}
Target audience: {{audience}}

Include:
- Hero headline (clear value prop)
- Subheading (expand on value)
- 3 key benefits
- Social proof section
- CTA text

Make it compelling and conversion-focused.`,
    description: 'Generate landing page copy',
    variables: ['productName', 'description', 'audience'],
    tags: ['copywriting', 'marketing', 'landing-page'],
    favorite: false,
  },

  // School prompts
  {
    title: 'Essay Outline',
    category: 'school',
    content: `Help me outline an essay on: {{topic}}

Requirements:
- {{wordCount}} words
- {{style}} style
- Due: {{deadline}}

Provide:
1. Thesis statement
2. Main arguments (3-5)
3. Supporting points for each
4. Conclusion approach

Don't write the essay, just help me structure it.`,
    description: 'Create an essay outline',
    variables: ['topic', 'wordCount', 'style', 'deadline'],
    tags: ['writing', 'essay', 'school'],
    favorite: false,
  },

  // Agent prompts
  {
    title: 'Autonomous Build Task',
    category: 'agents',
    content: `You are an autonomous coding agent. Build: {{goal}}

Context:
- Project: {{projectName}}
- Framework: {{framework}}
- Files to consider: {{files}}

Process:
1. Plan the implementation
2. Break into steps
3. Execute each step
4. Verify with tests
5. Report completion

Work safely. Ask before making risky changes.`,
    description: 'Run an autonomous agent to build a feature',
    variables: ['goal', 'projectName', 'framework', 'files'],
    tags: ['agent', 'automation', 'autonomous'],
    favorite: false,
  },
  {
    title: 'Multi-Model Council',
    category: 'agents',
    content: `I need multiple AI perspectives on: {{question}}

Please:
1. Analyze from different angles
2. Consider pros/cons
3. Identify blind spots
4. Synthesize a final recommendation

Act as a council of experts with diverse viewpoints.`,
    description: 'Get multiple AI perspectives and synthesize them',
    variables: ['question'],
    tags: ['analysis', 'council', 'decision'],
    favorite: false,
  },

  // Personal
  {
    title: 'Project Planning',
    category: 'personal',
    content: `Help me plan: {{projectName}}

Current situation: {{currentState}}
Goal: {{goal}}
Timeline: {{timeline}}
Constraints: {{constraints}}

Provide:
1. Milestone breakdown
2. Weekly tasks
3. Potential blockers
4. Success criteria`,
    description: 'Plan a personal project',
    variables: ['projectName', 'currentState', 'goal', 'timeline', 'constraints'],
    tags: ['planning', 'goals', 'productivity'],
    favorite: false,
  },
  ...HERMES_POWER_PROMPTS.map(prompt => ({
    title: prompt.title,
    category: prompt.category,
    content: prompt.content,
    description: prompt.description,
    variables: prompt.variables,
    tags: prompt.tags,
    favorite: false,
  })),
]

function materializeDefaultPrompts() {
  const now = Date.now()
  return DEFAULT_PROMPTS.map(p => ({
    ...p,
    id: uuidv4(),
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }))
}

function mergeMissingDefaultPrompts(existing: PromptTemplate[]) {
  const byTitle = new Set(existing.map(prompt => prompt.title))
  const missingDefaults = materializeDefaultPrompts().filter(prompt => !byTitle.has(prompt.title))
  return missingDefaults.length ? [...missingDefaults, ...existing] : existing
}

export const usePromptStore = create<PromptStore>()(
  persist(
    (set, get) => ({
      prompts: materializeDefaultPrompts(),

      createPrompt: (data) => {
        const prompt: PromptTemplate = {
          ...data,
          id: uuidv4(),
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set(state => ({ prompts: [...state.prompts, prompt] }))
        return prompt
      },

      updatePrompt: (id, updates) =>
        set(state => ({
          prompts: state.prompts.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        })),

      deletePrompt: (id) =>
        set(state => ({
          prompts: state.prompts.filter(p => p.id !== id),
        })),

      getPrompt: (id) => {
        const { prompts } = get()
        return prompts.find(p => p.id === id) ?? null
      },

      getPromptsByCategory: (category) => {
        const { prompts } = get()
        return prompts.filter(p => p.category === category)
      },

      incrementUsage: (id) =>
        set(state => ({
          prompts: state.prompts.map(p =>
            p.id === id ? { ...p, usageCount: p.usageCount + 1 } : p
          ),
        })),

      toggleFavorite: (id) =>
        set(state => ({
          prompts: state.prompts.map(p =>
            p.id === id ? { ...p, favorite: !p.favorite } : p
          ),
        })),

      searchPrompts: (query) => {
        const { prompts } = get()
        const q = query.toLowerCase()
        return prompts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some(tag => tag.toLowerCase().includes(q))
        )
      },

      duplicatePrompt: (id) => {
        const prompt = get().getPrompt(id)
        if (!prompt) return null

        const duplicate = get().createPrompt({
          ...prompt,
          title: `${prompt.title} (Copy)`,
          favorite: false,
        })
        return duplicate
      },
    }),
    {
      name: 'bertos-prompts',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PromptStore>
        return {
          ...current,
          ...p,
          prompts: mergeMissingDefaultPrompts(p.prompts ?? current.prompts),
        }
      },
    }
  )
)
