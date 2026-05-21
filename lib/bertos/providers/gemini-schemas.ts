import { Type } from '@google/genai'

const statusEnum = ['SUCCESS', 'WARNING', 'BLOCKED']
const priorityEnum = ['low', 'medium', 'high']
const riskEnum = ['low', 'medium', 'high']

export type BertAgentPlan = {
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED'
  summary: string
  assumptions: string[]
  todos: Array<{
    id: string
    title: string
    type: 'think' | 'read-file' | 'search' | 'patch' | 'command' | 'verify' | 'report'
    priority: 'low' | 'medium' | 'high'
    risk: 'low' | 'medium' | 'high'
  }>
  likelyFiles: string[]
  risks: string[]
  verification: string[]
  nextAction: string
}

export type CouncilJudgeResult = {
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED'
  bestPoints: Array<{
    model: string
    point: string
  }>
  conflicts: string[]
  finalAnswer: string
  confidence: 'low' | 'medium' | 'high'
  recommendedNextAction: string
}

export type WorkspacePatchPlan = {
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED'
  summary: string
  filesToInspect: string[]
  filesToModify: string[]
  implementationPlan: string[]
  risks: string[]
  verificationCommands: string[]
  needsMoreContext: boolean
  missingContext: string[]
}

export type AutopilotProjectReport = {
  status: 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'BLOCKED'
  summary: string
  health: Array<{
    area: string
    status: 'good' | 'warning' | 'critical' | 'unknown'
    detail: string
  }>
  recommendedActions: Array<{
    title: string
    priority: 'low' | 'medium' | 'high'
    risk: 'safe' | 'approval-required' | 'blocked'
    reason: string
  }>
  blockers: string[]
  nextBestAction: string
}

const stringArray = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
}

export const agentPlanSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: statusEnum },
    summary: { type: Type.STRING },
    assumptions: stringArray,
    todos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['think', 'read-file', 'search', 'patch', 'command', 'verify', 'report'] },
          priority: { type: Type.STRING, enum: priorityEnum },
          risk: { type: Type.STRING, enum: riskEnum },
        },
        required: ['id', 'title', 'type', 'priority', 'risk'],
      },
    },
    likelyFiles: stringArray,
    risks: stringArray,
    verification: stringArray,
    nextAction: { type: Type.STRING },
  },
  required: ['status', 'summary', 'assumptions', 'todos', 'likelyFiles', 'risks', 'verification', 'nextAction'],
}

export const councilJudgeSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: statusEnum },
    bestPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          model: { type: Type.STRING },
          point: { type: Type.STRING },
        },
        required: ['model', 'point'],
      },
    },
    conflicts: stringArray,
    finalAnswer: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    recommendedNextAction: { type: Type.STRING },
  },
  required: ['status', 'bestPoints', 'conflicts', 'finalAnswer', 'confidence', 'recommendedNextAction'],
}

export const workspacePatchPlanSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: statusEnum },
    summary: { type: Type.STRING },
    filesToInspect: stringArray,
    filesToModify: stringArray,
    implementationPlan: stringArray,
    risks: stringArray,
    verificationCommands: stringArray,
    needsMoreContext: { type: Type.BOOLEAN },
    missingContext: stringArray,
  },
  required: ['status', 'summary', 'filesToInspect', 'filesToModify', 'implementationPlan', 'risks', 'verificationCommands', 'needsMoreContext', 'missingContext'],
}

export const autopilotProjectReportSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['SUCCESS', 'WARNING', 'CRITICAL', 'BLOCKED'] },
    summary: { type: Type.STRING },
    health: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['good', 'warning', 'critical', 'unknown'] },
          detail: { type: Type.STRING },
        },
        required: ['area', 'status', 'detail'],
      },
    },
    recommendedActions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          priority: { type: Type.STRING, enum: priorityEnum },
          risk: { type: Type.STRING, enum: ['safe', 'approval-required', 'blocked'] },
          reason: { type: Type.STRING },
        },
        required: ['title', 'priority', 'risk', 'reason'],
      },
    },
    blockers: stringArray,
    nextBestAction: { type: Type.STRING },
  },
  required: ['status', 'summary', 'health', 'recommendedActions', 'blockers', 'nextBestAction'],
}

export function schemaForGeminiMode(mode: string) {
  if (mode === 'structured-plan') return agentPlanSchema
  if (mode === 'workspace-patch-plan') return workspacePatchPlanSchema
  if (mode === 'council-judge') return councilJudgeSchema
  if (mode === 'autopilot-report') return autopilotProjectReportSchema
  return undefined
}
