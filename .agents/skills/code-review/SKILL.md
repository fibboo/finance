---
name: code-review
description: Delegate a read-only code review to an independent Codex subagent in the current session. Use for explicit review requests and for the review stage after finishing a fibboo/finance issue.
---

# Code review

Read the shared [Code Review workflow](../../../docs/agent-workflow.md#code-review) and [review criteria](../../../.claude/rules/pr-review.md). Resolve the target checkout and the immutable revisions or diff snapshot before delegation. For a repeated review, include the files and lines changed by the fixes.

Launch one separate reviewer with the session's subagent tool. Give it the task scope, the checkout path, the review target and the repository instruction paths. Use a fresh reviewer context when the tool supports it. The reviewer loads the instructions from the reviewed checkout or revision, identifies applicable rules from the changed paths and independently inspects the diff and relevant source. It uses read-only actions and reports the target and its P1–P3 findings or a clean result. It has no authority to edit, commit, push, publish comments or delegate the review.

Wait for the report and check that it covers the requested target. Present it in the current session using the shared reporting and approval steps. If the host cannot launch an independent subagent or the review does not complete, report that stage as incomplete.
