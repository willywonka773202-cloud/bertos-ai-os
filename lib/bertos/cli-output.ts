export const BERTOS_CLI_FINAL_START = 'BERTOS_FINAL_ANSWER_START'
export const BERTOS_CLI_FINAL_END = 'BERTOS_FINAL_ANSWER_END'

const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g

const CLI_NOISE_PATTERNS = [
  /^openai codex\b/i,
  /^codex cli\b/i,
  /^gemini cli\b/i,
  /^claude code\b/i,
  /^(model|provider|tool|command|cwd|workdir|working directory|sandbox|approval|network|reasoning effort|session id|duration|latency|tokens)\s*[:=]/i,
  /^(system prompt|system guidance|conversation context|conversation transcript|developer instructions)\s*:?$/i,
  /^bertos cli chat response contract\.?$/i,
  /^return only the assistant answer/i,
  /^place only the user-visible answer/i,
  /^do not (include|repeat|echo)/i,
  /^now answer only/i,
  /^reply inside bertos/i,
  /^you are bertos,/i,
]

function stripAnsi(text: string) {
  return text.replace(ANSI_PATTERN, '')
}

function extractFinalAnswer(text: string) {
  const startIndex = text.indexOf(BERTOS_CLI_FINAL_START)
  if (startIndex === -1) return null

  const afterStart = text.slice(startIndex + BERTOS_CLI_FINAL_START.length)
  const endIndex = afterStart.indexOf(BERTOS_CLI_FINAL_END)
  return (endIndex === -1 ? afterStart : afterStart.slice(0, endIndex)).trim()
}

function looksLikeCliLeak(text: string) {
  return (
    text.includes(BERTOS_CLI_FINAL_START) ||
    /system prompt|conversation context|bertos cli chat response contract/i.test(text) ||
    CLI_NOISE_PATTERNS.some(pattern => pattern.test(text.trim().split(/\r?\n/, 1)[0] ?? ''))
  )
}

export function cleanCliAssistantText(raw: string) {
  const original = stripAnsi(raw ?? '').trim()
  if (!original) return ''

  const extracted = extractFinalAnswer(original)
  const candidate = extracted || original
  if (!extracted && !looksLikeCliLeak(candidate)) return candidate

  const filtered = candidate
    .replaceAll(BERTOS_CLI_FINAL_START, '')
    .replaceAll(BERTOS_CLI_FINAL_END, '')
    .split(/\r?\n/)
    .filter(line => !CLI_NOISE_PATTERNS.some(pattern => pattern.test(line.trim())))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return filtered || candidate.trim() || original
}

export function compactAssistantText(raw: string, maxChars = 8000) {
  const clean = cleanCliAssistantText(raw)
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, maxChars).trimEnd()}\n\n[Output shortened in BertOS UI. Ask for the full log or open the run details if needed.]`
}

export function buildBertOSCliChatPrompt(systemPrompt: string, transcript: string) {
  return [
    'BERTOS CLI CHAT RESPONSE CONTRACT.',
    'Return only the assistant answer for the user.',
    'Do not include model names, provider names, command args, sandbox status, routing notes, system prompt text, or conversation transcript.',
    `Place only the user-visible answer between ${BERTOS_CLI_FINAL_START} and ${BERTOS_CLI_FINAL_END}.`,
    '',
    'System guidance:',
    systemPrompt,
    '',
    'Conversation transcript:',
    transcript,
    '',
    `Now answer only between ${BERTOS_CLI_FINAL_START} and ${BERTOS_CLI_FINAL_END}.`,
  ].join('\n')
}
