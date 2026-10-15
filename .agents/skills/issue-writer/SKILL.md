---
name: issue-writer
description: 'Create, update or refine GitHub issues for fibboo/finance, including labels, project placement and sub-issues. Use for GitHub issue requests and #issue commands.'
---

# Issue writer

Read `.claude/skills/issue-writer/SKILL.md` in full from the root of the current checkout and follow it as the authoritative workflow. It defines the repository, project, labels, issue format, approval steps and GitHub commands.

The shared file retains Claude's native tool names and metadata. Apply the Codex mappings below instead of modifying those names in the Claude skill. Its `allowed-tools` field does not grant Codex permissions.

## Codex tool mappings

Use only tools exposed in the current session; names and availability can vary by host and mode.

| Claude tool | Codex action |
| --- | --- |
| `Bash` | Run commands with `exec_command`, through `functions.exec` when that is how the host exposes it. Follow the host's sandbox and escalation rules. On Windows use PowerShell; disable profile loading when the execution tool supports it. |
| `Glob` | Use `rg --files` through the command tool, with appropriate glob filters. Include hidden paths such as `.claude/` when needed and exclude other worktrees. |
| `Grep` | Use `rg` through the command tool, scoped to the current checkout and relevant paths. |
| `Read` | Use an available file reader or `Get-Content -LiteralPath ... -Encoding UTF8` through the command tool on Windows. |
| `Write` | Use `apply_patch` or an available file writer. Follow the shared workflow's UTF-8 temporary-file and safe-quoting requirements for issue bodies. |
| `Skill` | Use native skill invocation if the host exposes it; otherwise read the relevant `SKILL.md` and follow its workflow. Do not invent a Skill-tool result or paste source reads as skill output. |
| `AskUserQuestion` | Use `request_user_input_async` when available. If only `request_user_input` is available, use it only when the current mode and its documented constraints allow that question. Otherwise ask in chat. |
| `EnterPlanMode` / `ExitPlanMode` | Present the complete draft in chat and request explicit approval after showing it. Use `request_user_input_async` if available, or ask in the final response and wait. Do not use `request_user_input` for approval requests when its constraints forbid that, and do not try to change collaboration mode through an unavailable tool. |

For clarification, combine parent selection and unresolved questions into one round; omit questions already answered in the conversation. Keep questions self-contained, using concise choices when useful and free text for an issue number. An asynchronous question returns before the user answers: continue only independent work, and wait for the answer before drafting or performing actions that depend on it. Silence, elapsed time and a preselected option are not answers or approval. If a question tool is unavailable or rejects the request, use chat and wait instead of calling it repeatedly.

An approval remains valid only when the user gave it after seeing the complete draft of the exact title, body, labels and parent being written. An initial instruction such as "go ahead and create it" before the draft is shown is not draft approval. Present a changed draft again for approval. The host's command permission prompt is separate from this workflow approval.
