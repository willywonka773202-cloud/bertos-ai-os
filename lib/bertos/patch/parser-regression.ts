import { PATCH_PARSER_FIXTURES } from './fixtures'
import { parseCanonicalPatch } from './schema'

export function runPatchParserRegression() {
  return PATCH_PARSER_FIXTURES.map(fixture => {
    try {
      const payload = parseCanonicalPatch(fixture.input)
      return {
        name: fixture.name,
        passed: fixture.shouldParse,
        parsed: true,
        files: payload.files.length,
      }
    } catch (error) {
      return {
        name: fixture.name,
        passed: !fixture.shouldParse,
        parsed: false,
        error: error instanceof Error ? error.message : 'Unknown parser error.',
      }
    }
  })
}
