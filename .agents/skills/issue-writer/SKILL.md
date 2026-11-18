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
| `EnterPlanMode` / `ExitPlanMode` | Follow `AGENTS.md`, **Approval**: prefer native Plan mode and its plan-approval UI when exposed and permitted; otherwise explain the limitation and obtain explicit approval in chat. Present the complete draft before approval in either route, preserving the shared workflow's **Approval and Body Files** requirements and the active mode's tool restrictions. |

For the shared workflow's **Mockups** step, use the available mockup tools; when no design canvas is available, prepare local HTML mockups and render them with a headless browser. Show the variants to the user and agree the designs in chat. Do not ask whether to prepare required mockups or ask the user to supply them unless a necessary source is missing. The export names, the `assets` branch and the Mockups section stay as the shared file defines them. Local HTML mockups are the mockup's sources and are stored with the PNGs; a mockup agreed only as images has none.

Apply the shared workflow's **Clarifications** section before using a question tool. When a clarification round is needed, ask its unresolved questions together and keep them self-contained, using concise choices when useful. An asynchronous question returns before the user answers: continue only independent work, and wait for the answer before drafting or performing actions that depend on it. Silence, elapsed time and a preselected option are not answers or approval. If a question tool is unavailable or rejects the request, use chat and wait instead of calling it repeatedly.

Follow the draft approval rule in the shared workflow's **Approval and Body Files** section. The Codex host's command permission prompt is separate from draft approval.
