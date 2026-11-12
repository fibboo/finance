# PR Review Guidelines

These guidelines apply to every pull request review in this repository. This file says what a finding is and how severe it is. How a particular reviewer publishes its findings is up to that reviewer.

If the diff touches a `.py` file, a `requirements/` file, a Dockerfile, `pytest.ini`, `pyproject.toml`, `setup.cfg` or an `.env` template, read `.claude/rules/python.md` in full before reviewing it. That file loads only when a matching file is opened, and a review that reads the diff through `gh` opens none, yet every rule in it applies to the diff, not only the sections cited here. For the same reason, if the diff touches anything under `frontend/`, read `.claude/rules/typescript.md` and `.claude/rules/react.md` in full.

## Severity

- Grade every finding **P1**, **P2** or **P3**. Severity alone does not decide blocking: a P1 always blocks, a P3 never does, and a P2 blocks only when the author can act on it in this PR before the merge.
- A P2 the author can do nothing about is reported, not blocked on.
- A judgement that belongs to the author is not blocking either, whatever its severity.

## What Is Not a Finding

- The size of a pull request. `.claude/rules/common.md` sets the 500-line limit as a rule for planning and authoring. A review does not count a diff's lines against it and never asks for a split to shrink a PR. The one-kind-of-work rule below is about what the diff contains rather than how big it is, and it still applies.
- A violation in a file the diff does not touch. Existing code is brought in line by dedicated issues, and a review never asks a pull request to migrate code it did not change. A file the diff moves or rewrites counts as touched and is held to the rules in full.

## Skills

The text of a skill, its `SKILL.md` under `.claude/skills/` and the other prose files in its folder, and its entrypoint under `.agents/skills/` are instructions an agent follows at run time, and a finding in them is graded by what shows it rather than by what could happen. A code file a skill ships keeps the ordinary grading, and so do `.claude/rules/`, `CLAUDE.md` and `AGENTS.md`: a rule a reviewer or author applies has no gate behind it.

- A finding in such a file is P1 or P2, graded by **Severity**, only when the text contradicts itself, a sibling file or step (a skill's `SKILL.md` and its `.agents/skills/` entrypoint are siblings), a rule of `CLAUDE.md`, `AGENTS.md` or `.claude/rules/`, or the code it describes (a wrong file, function, field, command or route), when a value of an outside system it names (an id or a command name) is one a command shows to be wrong, or when a real example (the output of a past run, a linked issue or pull request that records such a run) shows the instruction producing a wrong result.
- A finding that rests only on a constructed scenario, such as how an agent reading the text literally could go wrong or an input no run has shown, is P3 and never blocks. A skill sends what it cannot settle to a developer gate, so an imprecise sentence costs a question there rather than a lost defect, while every fix written for a hypothetical finding adds text in which the next round finds new scenarios.

## Mixed Scope

A pull request carries one kind of work (`.claude/rules/common.md`: one issue is one kind of work). Read the linked issue and compare its scope with the diff:

- A fix to existing behaviour shipped together with a new capability is a finding, whatever the line count.
- A new branch inside existing logic for a case it already handles is part of the fix. A new endpoint, a new transaction type or a new entity is a new capability.
- Name which files belong to which piece, and ask for the original issue to be split into two sub-issues: a **Bug** for the fix and an **Enhancement** for the new capability, each with its own PR.
- Grade it **P2** and treat it as blocking, since the author can act on it before the merge. The reviewer never creates or edits issues; the split is the author's to make.

## Rule Sections

The rules themselves are written once, in the rule files. Code or a test the diff adds or changes that breaks a rule of one of the sections below is a finding of the grade the table gives. A P2 of this table is blocking, since the author can act on it before the merge. The last column lists what is not a finding.

| Rule section | Grade | Not a finding |
|---|---|---|
| `python.md` **Tests**, `typescript.md` **Tests**, `react.md` **Tests** | P2 | A test that overrides one settings field for its own duration. The one shared `render` in `frontend/src/test/render.tsx`. |
| `common.md` **Architecture** (settings read at the use site), `python.md` **Configuration**, `typescript.md` **Configuration** | P2 | A parameter whose production callers pass different settings or data. Test call sites do not count as callers. |
| `python.md` **Database Access** | P2 | A test's arrange step that commits its rows through the plain `db` with `commit=True`. |
| `python.md` **Endpoints** | P2 | A transaction handler that takes its processor from `factory.get_processor` and calls it. A redirect done by declaring `response_class=RedirectResponse` and returning the URL the service gives. |
| `python.md` **Imports** | P3 | `get_logger` and the other names that section imports by name. |
| `react.md` **Auth and Security**: a token written to `localStorage`, `sessionStorage` or a cookie that script can read, a `dangerouslySetInnerHTML`, or a URL from data placed in an `href` or `src` without checking its scheme | P1 | |
| Every other section of `react.md` and `typescript.md` | P2 | An edit form's starting values in React Hook Form. The token refresh and session restore of the API client's auth middleware and the code exchanges in the loaders of the sign-in and link callback routes, which fetch outside TanStack Query. A map keyed by the generated union, of presentation or of UI copy that explains a value. `as const`. A secondary detail that a wider screen adds where it fits. |

A settings finding covers a call the diff adds that passes a settings value into an existing parameter whose other production callers pass the same value, as well as a new parameter. A test finding is judged by what the test asserts, not by what its file is named.
