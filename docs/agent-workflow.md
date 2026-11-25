# Agent workflow

## Load instructions

1. Identify the task and the root of the checkout it applies to. When reviewing a PR from another checkout, use the target checkout's instructions, or fetch the files from the reviewed revision. In a nested worktree, exclude other worktrees from file searches.
2. Read the root `CLAUDE.md` and `.claude/rules/common.md`. Enumerate Markdown rules below `.claude/rules/`, including new files. Load other rules without `paths:` across the project unless their opening text gives a task-specific trigger. Load `.claude/rules/pr-review.md` for reviews and when deciding whether review findings block completion.
3. Identify paths before reading their contents, planning changes or reviewing them. For PR or branch reviews, get the changed paths from the target diff even when the diff is read through GitHub. Match repository-relative paths against each rule's `paths:` frontmatter. A match on any listed pattern selects the rule. Claude Code can load matching rules when its tools open files. For paths obtained only from a diff or whenever native loading is uncertain, read the matching rules explicitly. Codex reads them explicitly.
4. Read selected rules in full. Split reads when output is truncated. Recompute applicable rules when new paths enter scope or the checkout changes. Load the relevant skill before using its workflow.

A request to inspect or discuss work authorizes gathering evidence and reporting. An instruction to implement an issue starts the development workflow below.

## Issue development

1. Confirm that the issue is ready and that each blocker is closed or has an open PR the work can stack on. Follow **Git Conventions** for the checkout, branch and status.
2. Implement only the approved scope. Use the module and file-level test rules in [CLAUDE.md](../CLAUDE.md#tests).
3. Run **Before every commit**, commit, then push. Open the PR against the branch selected at the start and move the issue to `In Review`. Review the committed and pushed work as soon as it is ready.
4. Complete **Code Review**, then **Browser check** when applicable. In the final report, identify the checks performed and any incomplete stage.

## Before every commit

1. Run Black on changed backend Python files and Prettier on changed frontend files that it formats.
2. Run isort on changed backend Python files.
3. Run only the tests affected by the changes. For rules or documentation without corresponding product tests, skip product tests.

Use the [formatting commands](../CLAUDE.md#format) and [test commands](../CLAUDE.md#tests) in `CLAUDE.md`.

## Code Review

1. Select the target before starting. For a finished issue with a PR, use the PR number, its actual base and its pushed head SHA. For a finished issue with no PR, use the pushed issue branch and its intended base. An explicit review request can name a different commit or diff. Record the immutable revisions or the exact diff snapshot. Use the target checkout for file reads.
2. Run one independent review in the current author session. Claude Code invokes its native `/code-review` at `medium` effort. Codex uses the [code-review skill](../.agents/skills/code-review/SKILL.md) to launch a separate subagent. Wait for the reviewer's report on the selected target, including when there are no findings. If the required reviewer cannot run or reviewed a different target, report the incomplete stage and ask how to proceed.
3. Show the reviewed target and results to the developer before seeking approval for fixes. Group findings by P1, P2 and P3 using [the shared review criteria](../.claude/rules/pr-review.md). Include the file and line, a concise explanation and a proposed fix or disposition, in the language of the conversation. Apply only approved fixes and run **Before every commit** before committing and pushing them.
4. Run one more round on the updated target only when an approved fix for a blocking finding changes behavior and the tests added or changed by the fixes do not cover that change. Review the files and lines changed by the fixes. Report the results and apply approved fixes to that round without a third review. When the reviewed and final SHAs differ, report both and state whether the repeat condition applied.
5. For existing GitHub review threads, resolve an addressed thread after its approved fix is committed, pushed and verified. When the developer agrees that a change is unnecessary, record the explanation and resolve the thread. Leave pending findings open. In-session review findings are reported in the session.

## Browser check

When the issue diff touches `frontend/`, check whether it changes the UI. If the UI is unaffected, say so and skip the check. Otherwise, start the browser check once the final review result has been shown. When there are proposed fixes, wait for the developer’s decision and push any approved fixes before starting.

- Run headless Chromium through Playwright (`playwright@1.65.0`, installed outside the repository). Run Compose from the issue's checkout and stop a stack from another checkout first. Use `mock-oidc` to sign in as an existing local user, or seed a new username when none exists. Get developer consent before recreating a user.
- Announce the number of smoke scenarios before running them. Group by screen and cover the changed flow and affected loading, empty and error states. Intercepting `/api` is acceptable. When several screens share changed code, use a representative screen and rely on unit coverage for combinations already tested.
- Run each scenario at 384 × 824 and at 1707 × 940 with device scale factor 1.5 for the desktop viewport. Use dark theme, and use both themes when the change depends on the theme. Run each scenario once unless its script or the product code was fixed.
- Report what ran, what failed, what changed in the script after a failure, and a proposed fix for each failed scenario. Commit and push approved scenario fixes, using **Before every commit**, then rerun only the failed scenarios without another review round. A later behavior change requested by the developer that is unrelated to a failed scenario goes through review before checking its affected scenarios again.
- In the session reply, give steps and expected results for any scenario that could not run or whose outcome is uncertain. Keep those manual verification instructions out of the issue and PR. If all scenarios ran and their results are known, say so.

## Git Conventions

- **Start every new issue on a fresh branch.** Fetch `origin` and check the issue status and blockers before creating the branch. Branch from updated `origin/main` for independent work or from the open blocker PR head on which the work depends for a stacked PR. Use the same base for the PR. Create the branch before editing files, with no upstream tracking. Keep implementation edits and commits off `main` and stale local branches. Its first push carries commits and sets its own remote branch as upstream.
- **Branch naming:** `<issue_number>-<issue_name>`, with no `feature/` prefix (for example `22-port-claude-code-rules`).
- **The `assets` branch:** an orphan branch for files shown in issues, such as the agreed mockups of a screen and their design sources. It shares no history with `main`, holds no code, has no pull requests and is never merged; it holds only one folder per issue number. The `issue-writer` skill describes what goes in it and how an issue shows it.
- **Move the issue through the project statuses:** the `fibboo-finace` project has `In Refinement`, `Ready for Development`, `In Development`, `In Review` and `Done`. The `issue-writer` skill sets the first two, which describe the issue itself; the work sets the rest:
  - work starts only on an issue that is `Ready for Development` and whose every "Blocked by" issue is closed or has an open pull request that the new branch stacks on (the `issue-writer` skill, **Commands**, lists the blockers with their state); an issue still `In Refinement` has its open items settled first through the `issue-writer` skill, which also sets the blockers, and a blocked issue may be refined while it waits;
  - immediately after successfully creating the issue's working branch, including through a new worktree, set the issue's Status to `In Development` before any implementation edits, unless it is already `In Development`, `In Review` or `Done`;
  - right after creating its pull request, into `main` or into another branch of a stack, set it to `In Review`. The project's built-in workflow "Pull request linked to issue" sets `In Review` too, when a pull request into `main` links the issue, so a stacked PR retargeted to `main` later keeps the status.

  The option ids and the commands that read and set a status are in the `issue-writer` skill (`.claude/skills/issue-writer/SKILL.md`, **Repository and Project** and **Commands**). A Container takes its status from its sub-issues: `In Development` while at least one is past `Ready for Development` (`In Development`, `In Review` or `Done`) and not all of them are `Done`, `Done` once all of them are, otherwise `In Refinement` while at least one is `In Refinement`, otherwise `Ready for Development`. Whenever a sub-issue changes status, check its parent and move the parent as well.
- **Isolate process and prompt changes:** changes under `docs/` and `.claude/` go in a pull request of their own. `.claude/rules/common.md` **General Coding** has the rule with its exceptions, and how pull requests are split.
- **First commit message:**
  ```
  #<issue_number>: <issue_name>

  Brief description of changes made
  ```
- **Later commit messages** (second and beyond in the same PR):
  ```
  Brief description of changes made
  ```
- **PR title:** `#<issue_number>: <issue_name>`
- **PR description:**
  ```
  Closes #<issue_number>

  Brief description of changes made
  ```
  `Closes` is a GitHub closing keyword. It links the pull request to the issue and closes the issue when the PR merges into `main`. For an issue the PR only references and must not close, such as a parent or a sibling, write `Part of #<issue_number>` instead. A closing keyword applies to the issue reference right after it, so never put another issue number directly after one.

## Verify agent workflows

Use the same inputs in fresh Codex and Claude Code sessions from the target checkout. Record the loaded rules, actions, approval points and outcome. Use existing PRs or disposable fixtures for the scenarios and keep approval exercises read-only.

| Scenario | Expected behavior |
|---|---|
| Review a backend PR from its diff | Load Python, the matching backend module rules and review criteria. Report the intended commit and findings or a clean result. |
| Review a backend API change with only the regenerated frontend schema | Apply the module-split exception, select tests by the affected paths and skip browser testing when the UI is unaffected. |
| Follow an approved frontend fix after review | Apply the repeat condition, report the reviewed and final SHAs and start the browser check only after review is complete. |
| Prepare a draft issue with a contract change | Present the full draft with its contract examples and wait for approval before any GitHub write. |
| Inspect work in another checkout | Use the target worktree's rules and changed paths, including newly added rules. |
| Run Codex review for a finished issue | A separate subagent inspects the intended revisions and the author waits for its report before proposing fixes. |

Report any scenario you could not run and the reason.
