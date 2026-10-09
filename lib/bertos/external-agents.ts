export type ExternalAgentId = 'devin'

export type ExternalAgentStatus = 'not-connected' | 'configured' | 'connected'

export interface ExternalAgentDefinition {
  id: ExternalAgentId
  name: string
  type: string
  billing: string
  status: ExternalAgentStatus
  bestUse: string[]
  warnings: string[]
  description: string
  docsUrl: string
  color: string
}

export interface DevinPlaybookTemplate {
  id: string
  title: string
  description: string
  promptTemplate: string
  category: 'fix' | 'triage' | 'test' | 'audit' | 'review' | 'feature'
}

export const EXTERNAL_AGENTS: Record<ExternalAgentId, ExternalAgentDefinition> = {
  devin: {
    id: 'devin',
    name: 'Devin',
    type: 'Cloud AI software engineer',
    billing: 'External paid/credit-based service',
    status: 'not-connected',
    bestUse: [
      'Scoped engineering tasks',
      'Pull request creation',
      'Bug triage',
      'Build failure fixes',
      'Auto-triage workflows',
    ],
    warnings: [
      'Do not auto-merge. Review all PRs.',
      'Do not give Devin unrestricted repo access.',
      'Scope tasks narrowly — one ticket per session.',
    ],
    description:
      'Devin is a cloud AI software engineer by Cognition. It can open branches, write code, create PRs, and run builds autonomously. BertOS generates scoped task prompts that you paste into Devin.',
    docsUrl: 'https://docs.devin.ai',
    color: '#6366F1',
  },
}

export const DEVIN_PLAYBOOK_TEMPLATES: DevinPlaybookTemplate[] = [
  {
    id: 'build-failure-fix',
    title: 'Build Failure Fix',
    description: 'Diagnose and fix a failing build. Devin will inspect errors, trace the root cause, and open a PR with the fix.',
    category: 'fix',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Fix the build failure.

Steps:
1. Run \`npm run build\` and capture the full error output.
2. Trace the root cause of each error.
3. Fix the direct cause — do not refactor unrelated code.
4. Run \`npm run typecheck\` and \`npm run build\` to confirm the fix.
5. Open a PR with a clear description. Do not auto-merge.

Rules:
- Do not edit .env.local
- Do not print secrets
- Do not run paid API calls
- Keep changes minimal and scoped`,
  },
  {
    id: 'bug-triage',
    title: 'Bug Triage',
    description: 'Investigate a reported bug, identify the cause, and either fix it or document findings.',
    category: 'triage',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Triage the following bug:
[DESCRIBE BUG HERE]

Steps:
1. Reproduce or locate the issue in the codebase.
2. Identify the root cause.
3. If the fix is safe and scoped, implement it and open a PR.
4. If the fix is complex, document your findings in the PR description and request review.
5. Run \`npm run typecheck\` and \`npm run build\` before opening the PR.

Rules:
- Do not edit .env.local
- Do not print secrets
- Do not auto-merge
- Keep changes minimal`,
  },
  {
    id: 'route-smoke-test',
    title: 'Route Smoke Test',
    description: 'Verify that all BertOS routes load without errors and pass type checks.',
    category: 'test',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Smoke test all routes.

Steps:
1. Run \`npm run typecheck\` — report any errors.
2. Run \`npm run build\` — report any errors.
3. List all pages in app/(bertos)/ and verify each has a valid page.tsx.
4. List all API routes in app/api/ and verify each has a valid route.ts.
5. Report a summary of which routes are healthy and which have issues.

Rules:
- Do not edit .env.local
- Do not print secrets
- Do not make code changes — report only
- Do not run the dev server unless necessary`,
  },
  {
    id: 'provider-status-audit',
    title: 'Provider Status Audit',
    description: 'Audit the /api/providers/status endpoint and verify all registered providers are accounted for.',
    category: 'audit',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Audit the provider status system.

Steps:
1. Read lib/bertos/providers/registry.ts and list all registered providers.
2. Read app/api/providers/status/route.ts and verify it covers every provider.
3. Check that provider types in lib/bertos/providers/types.ts are consistent.
4. Report any gaps, mismatches, or missing providers.
5. If fixes are needed, open a PR with minimal changes.

Rules:
- Do not edit .env.local
- Do not print secrets
- Do not run paid API calls
- Report findings clearly`,
  },
  {
    id: 'pr-review',
    title: 'PR Review',
    description: 'Review an open PR for correctness, type safety, and adherence to BertOS conventions.',
    category: 'review',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Review the following PR:
[PR URL OR BRANCH NAME]

Steps:
1. Check out the branch and read the diff.
2. Run \`npm run typecheck\` and \`npm run build\`.
3. Check for type errors, missing imports, or broken patterns.
4. Verify no .env.local changes, no secrets printed, no paid API calls.
5. Post your review as PR comments or a summary.

Rules:
- Do not merge the PR
- Do not edit .env.local
- Do not print secrets
- Be specific about what needs to change`,
  },
  {
    id: 'small-feature',
    title: 'Small Feature Implementation',
    description: 'Implement a small, well-scoped feature and open a PR.',
    category: 'feature',
    promptTemplate: `You are working in my standalone Bert OS repo.

TASK: Implement the following feature:
[DESCRIBE FEATURE HERE]

Steps:
1. Inspect the relevant files and understand the existing patterns.
2. Implement the feature following BertOS conventions (Next.js App Router, Tailwind, Zustand, Radix UI).
3. Run \`npm run typecheck\` — fix any errors.
4. Run \`npm run build\` — fix any errors.
5. Open a PR with a clear description. Do not auto-merge.

Rules:
- Do not edit .env.local
- Do not print secrets
- Do not run paid API calls
- Do not break existing routes
- Keep changes minimal and scoped`,
  },
]

export function getDevinStatus(): ExternalAgentStatus {
  if (typeof process !== 'undefined' && process.env?.DEVIN_API_KEY) {
    return 'configured'
  }
  return 'not-connected'
}
