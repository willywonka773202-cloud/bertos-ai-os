import type { AIModel, BertOSSettings } from './types'

type ClientApiKeys = BertOSSettings['apiKeys']

export function scopedClientKeysForModel(model: AIModel | string, apiKeys: ClientApiKeys = {}): ClientApiKeys {
  if (!apiKeys) return {}

  switch (model) {
    case 'claude-api':
      return apiKeys.anthropic ? { anthropic: apiKeys.anthropic } : {}
    case 'openai-api':
      return apiKeys.openai ? { openai: apiKeys.openai } : {}
    case 'gemini-api':
    case 'gemini-api-native':
      return apiKeys.google ? { google: apiKeys.google } : {}
    case 'ollama-pro':
      return apiKeys.ollamaCloud ? { ollamaCloud: apiKeys.ollamaCloud } : {}
    default:
      return {}
  }
}
