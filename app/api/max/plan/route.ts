import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const PLAN_SYSTEM = `You are BertOS Max Mode — an AI product architect and planning engine.
Given an app idea, generate a comprehensive, structured plan.
Be specific, realistic, and safe. Focus on what can be built in the given timeframe.
Do NOT suggest anything that requires production deployment, real user data, or paid APIs.
Return ONLY valid JSON with no markdown wrapping.`

interface MaxPlanRequest {
  idea: string
  appCategory: string
  targetUser: string
  duration: string
  outputGoal: string
  ollamaEndpoint?: string
  apiKeys?: Record<string, string>
}

interface MaxPlan {
  productConcept: string
  assumptions: string[]
  clarifyingQuestions: string[]
  marketInsights: string
  featureRoadmap: string[]
  technicalArchitecture: string
  dataModel: string
  uiRouteMap: string[]
  agentAssignments: Record<string, string>
  riskRegister: string[]
  validationPlan: string[]
  taskBreakdown: Array<{
    title: string
    description: string
    agentRole: string
    model: string
    priority: number
    estimatedMinutes: number
  }>
  researchSummary: string
}

const AGENT_ROLES = [
  'Product Architect',
  'Research Analyst',
  'UX Designer',
  'Frontend Engineer',
  'Backend Engineer',
  'Integration Engineer',
  'QA Verifier',
  'Memory Curator',
]

function buildPlanPrompt(req: MaxPlanRequest): string {
  const durationLabel = {
    '30min': '30 minutes',
    '2hours': '2 hours',
    'overnight': '8 hours',
    'custom': 'flexible timeframe',
  }[req.duration] ?? req.duration

  return `Generate a comprehensive development plan for this app idea:

IDEA: ${req.idea}
APP CATEGORY: ${req.appCategory}
TARGET USER: ${req.targetUser}
AVAILABLE TIME: ${durationLabel}
OUTPUT GOAL: ${req.outputGoal}

Respond with ONLY a JSON object matching this exact schema:
{
  "productConcept": "2-3 sentence product description",
  "assumptions": ["assumption 1", "assumption 2", "assumption 3"],
  "clarifyingQuestions": ["question only if truly needed, max 3"],
  "marketInsights": "brief market context and opportunity",
  "featureRoadmap": ["MVP feature 1", "MVP feature 2", "MVP feature 3", "V2 feature 1"],
  "technicalArchitecture": "stack and architecture description",
  "dataModel": "key entities and relationships",
  "uiRouteMap": ["/route-name: description", "/route-name: description"],
  "agentAssignments": {
    "Product Architect": "specific task",
    "Research Analyst": "specific task",
    "UX Designer": "specific task",
    "Frontend Engineer": "specific task",
    "Backend Engineer": "specific task",
    "Integration Engineer": "specific task",
    "QA Verifier": "specific task",
    "Memory Curator": "specific task"
  },
  "riskRegister": ["risk: mitigation", "risk: mitigation"],
  "validationPlan": ["validation step 1", "validation step 2"],
  "taskBreakdown": [
    {"title": "Task title", "description": "What to do", "agentRole": "Role name", "model": "ollama-pro", "priority": 1, "estimatedMinutes": 30}
  ],
  "researchSummary": "Research phase summary and findings"
}`
}

async function callOllama(prompt: string, endpoint: string): Promise<string> {
  const base = endpoint?.replace(/\/+$/, '') || 'http://127.0.0.1:11434'
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder',
      prompt: `${PLAN_SYSTEM}\n\n${prompt}`,
      stream: false,
      options: { temperature: 0.4, num_predict: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json() as { response: string }
  return data.response
}

function extractJson(raw: string): MaxPlan {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found')
  return JSON.parse(raw.slice(start, end + 1)) as MaxPlan
}

function fallbackPlan(req: MaxPlanRequest): MaxPlan {
  return {
    productConcept: `${req.idea} — A focused ${req.appCategory} application targeting ${req.targetUser}.`,
    assumptions: [
      'Local development environment available',
      'No external APIs required for MVP',
      'Single-user prototype first',
    ],
    clarifyingQuestions: [],
    marketInsights: 'Market research pending — run Research phase to generate insights.',
    featureRoadmap: [
      'Core data model and storage',
      'Main UI with primary user flow',
      'Basic search and filtering',
      'Export or sharing capability',
    ],
    technicalArchitecture: 'Next.js 15 + React 19 + Zustand + Tailwind CSS. Local-first, no backend required for MVP.',
    dataModel: 'Primary entity with id, title, description, createdAt, metadata fields.',
    uiRouteMap: [
      '/: Landing/home page',
      '/app: Main application view',
      '/new: Create new entry',
      '/settings: User preferences',
    ],
    agentAssignments: Object.fromEntries(AGENT_ROLES.map(r => [r, `Pending — plan generation required`])),
    riskRegister: [
      'Scope creep: Keep MVP tightly scoped to 3 core features',
      'Time overrun: Use plan-only mode for initial session',
    ],
    validationPlan: ['npm run typecheck', 'npm run build', 'Manual UI walkthrough'],
    taskBreakdown: [
      { title: 'Research phase', description: 'Gather market and technical context', agentRole: 'Research Analyst', model: 'ollama-pro', priority: 1, estimatedMinutes: 30 },
      { title: 'Product spec', description: 'Define MVP features and user flows', agentRole: 'Product Architect', model: 'ollama-pro', priority: 2, estimatedMinutes: 20 },
      { title: 'UI route map', description: 'Design page structure and navigation', agentRole: 'UX Designer', model: 'ollama-pro', priority: 3, estimatedMinutes: 20 },
      { title: 'Data model', description: 'Define entities and storage schema', agentRole: 'Backend Engineer', model: 'ollama-pro', priority: 4, estimatedMinutes: 20 },
      { title: 'Component scaffold', description: 'Create main UI components', agentRole: 'Frontend Engineer', model: 'codex-cli', priority: 5, estimatedMinutes: 60 },
      { title: 'Validation checks', description: 'Run typecheck and build', agentRole: 'QA Verifier', model: 'ollama-pro', priority: 6, estimatedMinutes: 10 },
    ],
    researchSummary: 'Research pending — AI plan generation unavailable (Ollama offline). Using structured fallback plan.',
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as MaxPlanRequest
  const prompt = buildPlanPrompt(body)

  // Try Ollama first
  const endpoints = [
    body.ollamaEndpoint,
    'http://127.0.0.1:11434',
    'http://localhost:11434',
  ].filter(Boolean) as string[]

  for (const ep of endpoints) {
    try {
      const raw = await callOllama(prompt, ep)
      const plan = extractJson(raw)
      return NextResponse.json({ ok: true, plan, source: 'ollama' })
    } catch {
      // try next
    }
  }

  // Fallback to structured plan
  return NextResponse.json({ ok: true, plan: fallbackPlan(body), source: 'fallback' })
}
