# BertOS Autonomous Progress

This document tracks autonomous agent integrations and their implementation status.

## Devin Integration

**Added:** 2026-05-22
**Status:** Placeholder — no live API calls

### What Devin is used for

Devin is a cloud AI software engineer by Cognition. In BertOS, it serves as an external coding teammate for:

- Scoped engineering tasks (small features, refactors)
- Pull request creation from task prompts
- Bug triage and investigation
- Build failure diagnosis and fixes
- Route smoke testing
- Provider status auditing
- PR review assistance

### What is connected vs placeholder

| Feature | Status |
|---|---|
| Devin agent card on `/agents` | Connected (UI only) |
| Devin playbook templates on `/playbooks` | Connected (prompt generation) |
| Task Builder with Devin option on `/builder` | Connected (prompt generation) |
| "Copy for Devin" button | Connected (clipboard copy) |
| `/api/providers/status` external agents | Connected (status check) |
| Live Devin API calls | Placeholder — not implemented |
| Direct session creation | Placeholder — not implemented |
| Automatic PR submission | Placeholder — not implemented |

### How to use Devin safely

1. Use the BertOS Builder (`/builder`) to generate a scoped task prompt.
2. Open [app.devin.ai](https://app.devin.ai) and start a new session.
3. Paste the generated prompt into Devin.
4. Devin works autonomously — opens a branch, writes code, creates a PR.
5. **Review the PR manually before merging. Never auto-merge.**
6. Record outcomes in BertOS Memory for future reference.

### Safety policies

- **No auto-merge:** All Devin PRs must be reviewed by a human before merging.
- **No .env.local edits:** Devin should never modify environment files.
- **No secrets printed:** Task prompts never include credentials.
- **No paid API calls:** BertOS does not call Devin APIs unless `DEVIN_API_KEY` is explicitly configured.
- **Scoped tasks only:** Give Devin one focused task per session, not broad instructions like "build my whole app."
- **Hermes/Nous remain paid-gated:** External integrations that require payment stay behind explicit configuration.
- **FCC remains experimental/gated:** Experimental features are not exposed to external agents.

### Recommended workflow

```
BertOS Builder generates task prompt
    ↓
You paste/send task to Devin
    ↓
Devin opens branch/PR
    ↓
You verify build/typecheck pass
    ↓
You merge only after reviewing
    ↓
BertOS memory/playbooks record what happened
```

### Next steps

- Add direct Devin API integration when official credentials are available
- Add Devin session status tracking in the Agents panel
- Add automatic playbook selection based on task type
- Add PR review integration between Devin and BertOS
