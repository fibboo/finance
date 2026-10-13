# Common Rules

## Architecture

- Follow existing patterns in the codebase. Don't introduce new abstractions without a reason.
- Single responsibility: each class or function does one thing.
- Settings are read at the use site. Code imports the settings instance from `app/configs/settings.py` and reads the field where the value is used. It never passes a settings value or a settings object into a function, method or constructor of its own code. A parameter fed from settings is allowed only when its callers pass different settings or data, not one and the same setting. Tests do not count as callers here: a test runs on the values `pytest.ini` sets, so a parameter that exists only to give a test another value breaks this rule.
- A client that is already injected through a constructor keeps that seam. This rule is about settings, not about how clients are built.
- KISS: the simplest solution that fits is correct.
- Flat helper structure: one orchestrating method calls all private helpers and combines their results in its own body. Helpers are leaf functions over passed-in data and call no other private helpers. Never create a single-use middle-man method that only delegates to other methods; inline it into the orchestrator.
- The flat-helper rule covers orchestration: methods that drive the scenario or touch instance state. A pure static calculator (`@staticmethod`, no state, no side effects) may be called from any private method, including another helper. It is a named expression, not a step in the scenario.
- Any method that never touches `self` must be a `@staticmethod`. Call sites keep using `self.__method(...)`.

## Security

- Never hardcode credentials, tokens or secrets. Always load them from environment variables through `BaseSettings`.
- Validate all external inputs (request bodies, Telegram auth data, third-party API responses) before processing them.
- Never log sensitive data (passwords, tokens, session ids, PII).

## General Coding

- No comments in code. Names must explain intent.
- Exception: a route handler's docstring stays, because FastAPI shows it as the endpoint description in Swagger and Redoc. It is API documentation for the people who call the API, not a comment on the code.
- Exception: tests may use `# arrange`, `# act` and `# assert` section comments. `# act / assert` is the one combined form, for when the act and the assert are a single statement (such as a `pytest.raises` block). Case does not matter: `# Arrange` and `# arrange` are the same marker, and existing markers are never rewritten from one case to the other.
- A test may also carry a short comment above a group of setup lines or assertions, saying what the group checks or where its values come from. A test's steps are data rather than named code. Keep such a comment when the test is moved or rewritten.
- Don't modify code unrelated to the current task.
- Fail fast: raise as soon as a precondition is violated rather than continuing with invalid state.
- One issue = one PR. Keep PRs under 500 lines added + removed.
- One issue is one kind of work. A fix to existing behaviour and a new capability (a new endpoint, a new transaction type, a new entity) are two pieces of work, even when one issue asks for both. Split the original issue into two sub-issues: a **Bug** for the fix and an **Enhancement** for the new capability, each delivered by its own pull request. A new branch inside existing logic for a case it already handles is part of the fix, not a second piece. This rule applies whatever the line count.
- A pull request led by deletions is not held to the limit. If its counted added lines stay within 500 and its counted deleted lines are more than its counted added lines, the change is a removal and there is nothing to split. The limit exists because a reviewer reads what a diff adds, line by line, and lives with it afterwards. Deleted code is checked for being dead, not read.
- What counts toward the 500-line limit is every changed line in every file of the diff, except these. Each is stated as a path or name shape so that everyone counts the same way:
  - anything under a directory named `tests/` or `test/`, or under a directory whose name contains `.test`
  - any file whose name matches a colocated-test pattern (`*.test.*`, `*.spec.*`, `*_test.*` or `test_*.*`), so that a frontend test beside its component counts the same as a pytest suite in `tests/`
  - anything under `db_migration/versions/` (the generated Alembic revisions)
  - any file named `README.md` or `CLAUDE.md`, and anything under `.claude/rules/modules/`
  - files nobody writes by hand:
    - anything under a `.vscode/` or `.devcontainer/` directory
    - any file named `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `settings.local.json`, `pytest.ini` or `local_tests.txt`
    - any file ending in `.min.js` or `.min.css`
    - any binary or document asset: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.pdf`, `.xls`, `.xlsx`, `.csv`, `.zip`, `.gz`, `.ttf`, `.woff`, `.woff2`

  Nothing else is excluded. Source, configuration, compose files, workflows, hand-written files under `db_migration/` such as `env.py`, `docs/` and the rest of `.claude/` all count. Two people counting the same branch must get the same number, because that number decides whether the work is split.
- Changes under `docs/` and `.claude/` go in a pull request of their own and are never mixed into a product PR. There are two exceptions: the request explicitly says otherwise, or the change is one piece of work with the code, such as a skill together with the local tools it drives. Process and prompt changes are read differently from product code, and mixing unrelated ones lets one hide inside the other. This isolation covers those two paths only. Documentation elsewhere is not isolated: `CLAUDE.md`, `README.md` files and any other docs next to the code they describe travel with the change that makes them stale. So does `.claude/rules/modules/`, which is module documentation kept under `.claude/` only so that Claude Code loads it by path.
