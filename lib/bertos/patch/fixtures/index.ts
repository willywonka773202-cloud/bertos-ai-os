export interface PatchParserFixture {
  name: string
  input: string
  shouldParse: boolean
}

export const PATCH_PARSER_FIXTURES: PatchParserFixture[] = [
  {
    name: 'plain canonical json',
    shouldParse: true,
    input: '{"summary":"ok","files":[{"path":"tmp/a.md","action":"create","content":"hello"}],"validation":{"commands":["npm run typecheck"]}}',
  },
  {
    name: 'markdown wrapped json',
    shouldParse: true,
    input: '```json\n{"summary":"ok","files":[{"path":"tmp/a.md","action":"create","content":"hello"}],"validation":{"commands":["npm run typecheck"]}}\n```',
  },
  {
    name: 'prose plus json',
    shouldParse: true,
    input: 'Here is the patch:\n{"summary":"ok","files":[{"path":"tmp/a.md","action":"create","content":"hello"}],"validation":{"commands":["npm run typecheck"]}}\nDone.',
  },
  {
    name: 'boundary wrapped json',
    shouldParse: true,
    input: 'BEGIN_PATCH_JSON\n{"summary":"ok","files":[{"path":"tmp/a.md","action":"create","content":"hello"}],"validation":{"commands":["npm run typecheck"]}}\nEND_PATCH_JSON',
  },
  {
    name: 'trailing comma cleanup',
    shouldParse: true,
    input: '{"summary":"ok","files":[{"path":"tmp/a.md","action":"create","content":"hello",},],"validation":{"commands":["npm run typecheck",],},}',
  },
  {
    name: 'multiple objects uses first balanced object',
    shouldParse: true,
    input: '{"summary":"first","files":[],"validation":{"commands":[]}}\n{"summary":"second","files":[],"validation":{"commands":[]}}',
  },
  {
    name: 'truncated json rejects',
    shouldParse: false,
    input: '{"summary":"bad","files":[{"path":"tmp/a.md","action":"create","content":"hello"}],"validation":{"commands":["npm run typecheck"]}',
  },
  {
    name: 'no json rejects',
    shouldParse: false,
    input: 'I can do that, but first I need more context.',
  },
]
