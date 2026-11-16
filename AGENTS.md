# Codex repository instructions

Read `CLAUDE.md` and `.claude/rules/common.md` in full before planning or changing this repository. They are shared project instructions, not Claude-only conventions. Follow their Git, scope, formatting and test rules.

## Load applicable rules

- Before reading, planning, editing or reviewing files, read each applicable `.claude/rules/**/*.md` file in full. A rule with `paths:` frontmatter applies when any listed pattern matches a repository-relative path; a rule without `paths:` applies to all work. Check this directory when a task starts so newly added module rules are included.
- For a review, match rules against the changed paths even if the diff came from `gh` rather than from opening the files. Read `.claude/rules/pr-review.md` before reporting findings.
- Use paths from the root of the checkout being worked on, including in a Git worktree. Do not read rules or edit files in another worktree by accident.

## Approval

For every Codex task that requires user approval, prefer native Plan mode and its plan-approval UI when the host exposes and permits them. Check the tools available in the current session and the active mode's restrictions before choosing the approval route; repository instructions cannot switch collaboration mode or grant tool permissions.

If native Plan mode or its plan-approval UI is unavailable or prohibited, state the limitation, present the complete proposal in chat and obtain explicit approval there. Use a question tool only when its documented constraints and the active mode permit approval requests; otherwise ask in chat and wait. Do not call unavailable tools or use a clarification-only tool for approval.

Preserve the applicable workflow's requirements for the proposal's contents and approval timing. Continue only independent work while approval is pending; silence, elapsed time and a preselected option are not approval. Do not request approval again for an unchanged proposal the user already approved. Task approval and the host's command permissions are separate: neither replaces the other.

## Skills

Codex discovers entrypoints in `.agents/skills/`. Each entrypoint points to the complete shared workflow in `.claude/skills/`; read and follow that workflow before acting. Do not maintain a second copy of its instructions.

- `#issue <description>` creates an issue; `#issue <number>` updates or refines it as requested, using `issue-writer`.
- Use `add-module` when adding a module/service or planning an issue that adds one.
- Claude-specific tool names in shared instructions mean the equivalent available Codex action. Do not attempt to call unavailable tools. For skill execution without a Skill tool, present the workflow's requested result; source file reads and shell output are not skill results to paste verbatim.

## Environment

Read `docs/agent-setup.md` when setting up the checkout or diagnosing Git, GitHub, permissions or skill discovery. A sandbox access failure is not evidence that the user's credentials are broken. Retry through the host's approval mechanism when allowed; never change global trust or copy credentials into the repository to bypass the sandbox.
