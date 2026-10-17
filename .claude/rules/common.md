# Common Rules

These rules apply to every module and every language in the repository. Each language has its own rule file (`.claude/rules/python.md` for the backend) that gives the concrete form of a rule where the language needs one: which file holds the settings, which comment syntax a test marker uses, which construct a pure function is. When a language file and this file seem to disagree, the language file names the form and this file names the principle.

## Architecture

- Follow existing patterns in the codebase. Don't introduce new abstractions without a reason.
- Single responsibility: each module, class, component or function does one thing.
- DRY: every piece of knowledge has one place where it is defined. A business rule, a validation, a value set, a mapping or a constant lives once, and every other place uses it. DRY is about knowledge, not about lines that look alike: two pieces of code that look the same but would change for different reasons stay separate, and an abstraction made only to merge them is worse than the copy. Tests are the stated exception, since each test is written out in full.
- KISS: the simplest solution that fits is correct.
- YAGNI: build only what a current issue needs. No parameter, option, extension point, abstraction layer or setting is added for a need nobody has yet. When that need arrives, its own issue adds it.
- Settings are read at the use site. Code reads each setting from the module's settings instance where the value is used. It never passes a settings value or a settings object into a function, method, constructor or component of its own code. A parameter fed from settings is allowed only when its callers pass different settings or data, not one and the same setting. Tests do not count as callers here: a test runs on the module's test settings, so a parameter that exists only to give a test another value breaks this rule. The language rule file names where the settings instance lives and where the test values come from.
- A client that is already injected through a constructor keeps that seam. This rule is about settings, not about how clients are built.
- Value sets the backend defines (enum values and option lists) and their display labels reach the frontend from the backend. The backend declares each label once, next to the enum it describes, and serves the sets the frontend uses through one dictionary endpoint per domain, each item a key and a label. The frontend loads these endpoints once at startup and never copies a set or its labels into its own constants. It may use a key as an identifier: in a condition or as the key of a presentation map. A set is added to an endpoint when a frontend screen first needs it, not in advance. Only presentation stays on the frontend: colors, CSS tokens, icons and layout.
- Flat helper structure: one orchestrating function or method calls all private helpers and combines their results in its own body. Helpers are leaf functions over passed-in data and call no other private helpers. Never create a single-use middle-man that only delegates to other functions; inline it into the orchestrator.
- The flat-helper rule covers orchestration: code that drives the scenario or touches state. A pure calculator (no state, no side effects) may be called from any private helper, including another helper. It is a named expression, not a step in the scenario. The language rule file names the construct a pure calculator takes.
- The transport layer is thin. A route handler, a message consumer or a CLI command only takes the input, calls the code that decides, and hands back its result. Decisions, branching and conversions live below it. The language rule file names the form.

## Naming

- A name says what a thing is or does in the terms of the domain: `account`, `base_currency_amount`, `transfer`, not `data`, `item`, `obj` or `tmp`.
- No abbreviations other than those everyone in the domain uses (`id`, `url`, `api`).
- A boolean reads as a statement that is true or false (`is_active`, `has_children`). A function that returns something is named for what it returns, and one that acts is named for what it does.
- One concept has one name across the modules: the frontend calls a thing what the backend's API calls it. Casing follows the language rule file.

## Security

- Never hardcode credentials, tokens or secrets. Load them from the environment through the module's settings mechanism, which the language rule file names.
- Validate all external inputs (request bodies, sign-in provider data, responses of third-party APIs) before processing them. A response of our own backend to the frontend is not parsed again: its contract is the types generated from the backend's schema, which the language rule file describes.
- Never log sensitive data (passwords, tokens, session ids, PII).

## General Coding

- No comments in code. Names must explain intent. The language rule file names the documentation a framework shows to the people who call the code, which stays.
- Exception: tests may carry `arrange`, `act` and `assert` section comments, written in the language's comment syntax (`# arrange` in Python, `// arrange` in TypeScript). `act / assert` is the one combined form, for when the act and the assert are a single statement (such as a block that expects an error). Case does not matter: `Arrange` and `arrange` are the same marker, and existing markers are never rewritten from one case to the other.
- A test may also carry a short comment above a group of setup lines or assertions, saying what the group checks or where its values come from. A test's steps are data rather than named code. Keep such a comment when the test is moved or rewritten.
- Don't modify code unrelated to the current task.
- Fail fast: raise or throw as soon as a precondition is violated rather than continuing with invalid state.
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
    - the API types generated from the backend's OpenAPI schema, `frontend/src/lib/api-schema.ts`
    - any binary or document asset: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.pdf`, `.xls`, `.xlsx`, `.csv`, `.zip`, `.gz`, `.ttf`, `.woff`, `.woff2`

  Nothing else is excluded. Source, configuration, compose files, workflows, hand-written files under `db_migration/` such as `env.py`, `docs/` and the rest of `.claude/` all count. Two people counting the same branch must get the same number, because that number decides whether the work is split.
- Changes under `docs/` and `.claude/` go in a pull request of their own and are never mixed into a product PR. There are two exceptions: the request explicitly says otherwise, or the change is one piece of work with the code, such as a skill together with the local tools it drives. Process and prompt changes are read differently from product code, and mixing unrelated ones lets one hide inside the other. This isolation covers those two paths only. Documentation elsewhere is not isolated: `CLAUDE.md`, `README.md` files and any other docs next to the code they describe travel with the change that makes them stale. So does `.claude/rules/modules/`, which is module documentation kept under `.claude/` only so that Claude Code loads it by path.
