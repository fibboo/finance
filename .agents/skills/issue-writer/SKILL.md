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

The **Mockups** step of the shared workflow assumes a design canvas, which Codex does not have. Agree the screens with the user in chat and ask them for the agreed PNGs, or render HTML mockups locally with a headless browser when the user prefers that; the export names, the `assets` branch and the Mockups section stay as the shared file defines them. Local HTML mockups are the mockup's sources and are stored with the PNGs; a mockup agreed only as images has none.

For each clarification round of the shared workflow, ask all of its questions together; omit questions already answered in the conversation. Keep questions self-contained, using concise choices when useful and free text for an issue number. An asynchronous question returns before the user answers: continue only independent work, and wait for the answer before drafting or performing actions that depend on it. Silence, elapsed time and a preselected option are not answers or approval. If a question tool is unavailable or rejects the request, use chat and wait instead of calling it repeatedly.

Follow the draft approval rule in the shared workflow's **Approval and Body Files** section. The Codex host's command permission prompt is separate from draft approval.
