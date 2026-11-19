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

## Review workflow

Follow the shared sequence in `CLAUDE.md`, **Review stages**, **Review every finished issue** and **Check a frontend change in a browser**. For Codex authoring tasks, request built-in GitHub Code Review by posting `@codex review` on the issue's PR. Do not invoke Claude CLI, a local review command or a reviewer subagent as a substitute.

The shared workflow authorizes its review-trigger comments. It does not authorize unapproved fixes, changes to review settings or a different review mechanism when the required service is unavailable. Report such a limitation and ask the user how to proceed.

For each GitHub review, record the current PR head and wait for the integration's result for that commit. Report the actual reviewed commit, findings and any incomplete stage; an acknowledgement reaction, successful CI or an older review does not establish completion for the current head. Preserve the shared requirements for approval of fixes, commit checks and frontend verification.

## Code Review Rules

Read `.claude/rules/pr-review.md` in full and apply its finding criteria and severity rules. Read every rule applicable to the changed paths as described in **Load applicable rules**, even when examining a diff without opening those files.

Use the shared rules as the source of truth rather than maintaining a second set of review criteria here. A reviewer inspects and reports; the author applies approved fixes. Review instructions do not authorize editing files, committing, pushing, posting GitHub comments or launching another reviewer.

## Skills

Codex discovers entrypoints in `.agents/skills/`. Each entrypoint points to the complete shared workflow in `.claude/skills/`; read and follow that workflow before acting. Do not maintain a second copy of its instructions.

- `#issue <description>` creates an issue; `#issue <number>` updates or refines it as requested, using `issue-writer`.
- Use `add-module` when adding a module/service or planning an issue that adds one.
- Claude-specific tool names in shared instructions mean the equivalent available Codex action. Do not attempt to call unavailable tools. For skill execution without a Skill tool, present the workflow's requested result; source file reads and shell output are not skill results to paste verbatim.

## Visual HTML artifacts

Use Sites for HTML mockups, interactive prototypes and other visual web artifacts that would be shared as Claude Artifacts, unless the user explicitly requests local-only output. Follow the available Sites skill to publish them and return a clickable HTTPS URL; when the artifact needs user approval, provide that URL before asking for approval.

If Sites or publication is unavailable, report the limitation and keep the hosted preview incomplete rather than presenting a local file path as a working web link. For issue mockups, preserve the shared workflow's design approval, PNG exports, source storage in the `assets` branch and issue body format; a Sites preview does not replace them.

## Environment

Read `docs/agent-setup.md` when setting up the checkout or diagnosing Git, GitHub, permissions or skill discovery. A sandbox access failure is not evidence that the user's credentials are broken. Retry through the host's approval mechanism when allowed; never change global trust or copy credentials into the repository to bypass the sandbox.
