# BertOS — Safety Model

BertOS is built so that nothing destructive, external, or paid happens without your explicit
approval. The guarantees below are enforced in `lib/bertos/coding/*` and covered by
`npm run smoke:coding-os`.

## Path safety
- `resolveWithinRepo` blocks `..` traversal, null bytes, and absolute paths that escape the project root.
- Sensitive files (`.env*`, private keys, `.ssh`/`.aws`, credentials) are never read, written, or patched.
- Build/dependency dirs (`node_modules`, `.next`, `dist`, …) are excluded from browsing and search.

## Secrets
- Detected (Anthropic/OpenAI/Google/GitHub/Slack/AWS keys, private-key blocks, bearer tokens, generic assignments) and **redacted** in command output, diffs, file previews, and approval payloads.
- Memory proposals are refused if they contain secret material — both at proposal time and re-checked at approval.

## Commands
- Allowlisted binaries only (`git`, `npm`, `node`, `tsc`, `next`, test runners, …).
- Shell metacharacters, `rm`/`sudo`, `curl|sh`, deploy/publish are blocked.
- Mutating git (`push`, `commit`, `reset --hard`, `clean`, `pull`) and package installs require approval.
- Executed with `shell: false` and a timeout; output is captured and redacted.

## Patches
- Apply is **impossible** without an approved proposal (enforced server-side; a 412 is returned otherwise).
- Conflicts (file drift since proposal) block apply unless explicitly revalidated.
- Version-safe backups + before/after checksums are recorded; re-apply is refused.

## Approval gates (Guardian Gates)
Patch apply, git push/commit, deploy, file deletion, paid API use, durable memory writes,
external connector actions, and persona generation all require an explicit approval at
`/approvals`. Rejections are recorded.

## Memory
- Coding workflows and the AI assistant create **proposals only** — never automatic writes.
- Proposals carry source run/output, project scope, confidence, risk flags, and target file.
- Approval writes to the correct scoped file; secrets are blocked.

## AI honesty
- The assistant never claims to have run a command, applied a patch, or called an external
  service — those are user-approved actions.
- With no provider online, answers are clearly labelled `local · no LLM`.
