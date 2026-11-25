# Codex repository instructions

Read [CLAUDE.md](CLAUDE.md) and [.claude/rules/common.md](.claude/rules/common.md) in full. Follow [Agent workflow](docs/agent-workflow.md), including its rule-loading steps before reading, planning, editing or reviewing repository files.

## Approval

For every Codex task that requires user approval, prefer native Plan mode and its plan-approval UI when the host exposes and permits them. Check the tools available in the current session and the active mode's restrictions before choosing the approval route; repository instructions cannot switch collaboration mode or grant tool permissions.

If native Plan mode or its plan-approval UI is unavailable or prohibited, state the limitation, present the complete proposal in chat and obtain explicit approval there. Use a question tool only when its documented constraints and the active mode permit approval requests; otherwise ask in chat and wait. Do not call unavailable tools or use a clarification-only tool for approval.

Preserve the applicable workflow's requirements for the proposal's contents and approval timing. Continue only independent work while approval is pending; silence, elapsed time and a preselected option are not approval. Do not request approval again for an unchanged proposal the user already approved. Task approval and the host's command permissions are separate: neither replaces the other.

## Code Review Rules

Use the [code-review skill](.agents/skills/code-review/SKILL.md) for explicit review requests and the review stage of finished issue work. It delegates to an independent subagent in the current session. Follow [the shared review sequence](docs/agent-workflow.md#code-review) and load [.claude/rules/pr-review.md](.claude/rules/pr-review.md) and the rules applicable to the changed paths. The reviewer inspects and reports. The author obtains approval before applying fixes.

## Skills

Codex discovers entrypoints in `.agents/skills/`. Shared skill entrypoints point to `.claude/skills/`. Read the shared workflow before acting. Codex-only tool routing lives in the Codex skills.

- `#issue <description>` creates an issue; `#issue <number>` updates or refines it as requested, using `issue-writer`.
- Use `add-module` when adding a module/service or planning an issue that adds one.
- Claude-specific tool names in shared instructions mean the equivalent available Codex action. Do not attempt to call unavailable tools. For skill execution without a Skill tool, present the workflow's requested result; source file reads and shell output are not skill results to paste verbatim.

## Visual HTML artifacts

Use Sites for HTML mockups, interactive prototypes and other visual web artifacts that would be shared as Claude Artifacts, unless the user explicitly requests local-only output. Follow the available Sites skill to publish them and return a clickable HTTPS URL; when the artifact needs user approval, provide that URL before asking for approval.

If Sites or publication is unavailable, report the limitation and keep the hosted preview incomplete rather than presenting a local file path as a working web link. For issue mockups, preserve the shared workflow's design approval, PNG exports, source storage in the `assets` branch and issue body format; a Sites preview does not replace them.

## Environment

Read `docs/agent-setup.md` when setting up the checkout or diagnosing Git, GitHub, permissions or skill discovery. A sandbox access failure is not evidence that the user's credentials are broken. Retry through the host's approval mechanism when allowed; never change global trust or copy credentials into the repository to bypass the sandbox.
