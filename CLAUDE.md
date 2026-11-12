# CLAUDE.md

## Rules

- **Keep CLAUDE.md a map.** It says what lives where: the modules, the folders and their roles, the commands and the conventions. Update it in a PR that adds, moves or removes a folder, a module, a command or a convention, and fix any mismatch with the codebase you notice, even when it is unrelated to the current task. A PR that only changes behaviour inside existing files does not touch it: what a screen shows, what an endpoint answers and how a function decides are stated by the code and its tests. A module's design decisions and the reasons behind them, which the code cannot state, go in `.claude/rules/modules/`, in files whose `paths:` frontmatter loads each one only while the files it describes are read. They pass the same test: a decision and its reason, not a retelling of behaviour. The test holds for the text a PR adds or changes; the backend module files predate it and are trimmed by an issue of their own, not by a PR that touches them for another reason. This file is always loaded, so it stays short.
- **No code examples in plans.** Plans describe steps and approaches only.
- **Show skill output verbatim.** When a skill runs (via the Skill tool), show ALL its output exactly as returned. Never filter, summarize, truncate or reformat it. The one exception is code review findings: from `/code-review`, a `pr-reviewer` agent, or a forked or background run that arrives as a task notification. Never paste them as JSON. Render them as a list grouped under P1, P2 and P3, the grades `.claude/rules/pr-review.md` defines. Each item names its file and line, states the defect in one sentence, and recommends a fix or leaving it, in the language of the conversation. Put one line before the list naming what the review actually covered. A review started from a clean checkout of `main` reviews its last commit, not the pull request in a worktree.
- **Review every finished issue.** Once the work on an issue is finished, run `/code-review` at once, without an effort level, so the skill keeps the one the developer typed last. It always runs with a target: the issue's pull request when one is open, passed by number, and the issue's branch when not. The issue's uncommitted changes are committed, after the steps of **Before every commit**, and every commit is pushed before it starts, so that the target holds all the work. Fixes are applied only after the developer approves them. When the approved fixes include one for a blocking finding, as `.claude/rules/pr-review.md` **Severity** defines one, that changes how the code behaves rather than only its tests, they are committed and pushed the same way and `/code-review` runs again on the same target, its arguments naming the files and lines the fixes changed, so that it reports findings on those lines only. An issue gets at most two such repeated rounds. Any other round ends the loop, and so does the second repeated one: its findings are reported, and the fixes the developer approves among them are applied without another review. When the issue's diff touches `frontend/`, the reply after the approved fixes of the last round are applied, or the one that reports that round when none are approved, also lists the scenarios to test by hand in the UI, in that reply only, not in the pull request or the issue; when the diff changes nothing the UI shows, it says so instead. They are grouped by screen and cover what the issue's diff changed, including the error, empty and loading states it touches. Each scenario gives its steps and the expected result, and names the phone or desktop width and the dark or light theme only when the change depends on them.
- **Before every commit** (in order):
  1. Run Black on changed backend files, Prettier on changed frontend files
  2. Run isort on changed backend files
  3. Run only the tests affected by the changes (see the Tests section for scoping rules)
- See `.claude/rules/common.md` for the principles that apply to every module and language, `.claude/rules/python.md` for Python conventions and the Python form of those principles, `.claude/rules/typescript.md` and `.claude/rules/react.md` for the frontend, and `.claude/rules/pr-review.md` for PR review guidelines. pr-review.md is the one place that says what a finding is and how severe it is.

## Skill Triggers

- `#issue <description>`: create a new GitHub issue (invokes the `issue-writer` skill)
- `#issue <number>`: update an existing GitHub issue (invokes the `issue-writer` skill)

Skills live in `.claude/skills/<name>/SKILL.md`.

## Agent Compatibility

`CLAUDE.md`, `.claude/rules/` and `.claude/skills/` are the shared source of project guidance. Claude Code uses its native discovery; Codex reads `AGENTS.md` and discovers thin entrypoints under `.agents/skills/` that point to the same workflows. Keep workflow changes in the shared files and update entrypoint descriptions when their trigger or scope changes. New skills need entrypoints for both agents; new module rules need matching `paths:` frontmatter.

Setup, permission modes and Git troubleshooting: `docs/agent-setup.md`. Tool names are host-specific: use the available equivalent while preserving the workflow's outputs and approval requirements. The verbatim-output rule applies when a Skill tool actually returns a result, not to shell output or source-file reads in hosts without that tool.

## Project Overview

Finance is a personal finance service: ledger accounts (money accounts, categories as EXPENSE accounts and income sources as INCOME accounts), locations, and income, expense, transfer and balance adjustment transactions. Users sign in through Telegram or Google. A FastAPI backend lives in `backend/` and a React frontend in `frontend/`.

Tech stack: Python 3.15, FastAPI, SQLAlchemy 2 (async, asyncpg), Pydantic 2, pydantic-settings, PostgreSQL, Alembic, Docker, pytest with pytest-postgresql and pytest-xdist.

## Architecture

### Modules

A **module** is a directory that ships as its own container. It owns a `Dockerfile`, a `requirements/` folder or `package.json`, its tests, and a service entry in `docker-compose.yml`. The scoping rules for tests and the PR size limit both depend on this boundary. Adding a module follows the `add-module` skill (`.claude/skills/add-module/SKILL.md`).

- **backend/**: the FastAPI API. Code is in `backend/app/`, tests in `backend/tests/`, migrations in `backend/db_migration/` (configured by `backend/alembic.ini`). Its compose service is `backend`, served on port 8000. Details, each loaded by path: `.claude/rules/modules/backend.md` (primary keys, the request transaction), `backend-user.md` (tokens, sign-in, account merge, base currency, username), `backend-accounts.md` (currencies, ledger accounts, deleted accounts and locations), `backend-ledger.md` (transactions, postings, valuation, recalculation, balance adjustments, the summary) and `backend-migrations.md`
- **frontend/**: the single-page app. Its compose service is `frontend`, the Vite dev server on port 5173, which proxies `/api` to `backend`; in production nginx (`frontend/nginx.conf`) serves the bundle on port 80 and proxies `/api` the same way. Stack: Vite, React 19 with the React Compiler, TypeScript 6, React Router 8 (data mode), TanStack Query 5, React Hook Form with Zod 4, openapi-fetch over types generated by openapi-typescript, CSS Modules, Vitest in jsdom with Testing Library and MSW, ESLint and Prettier. Code is in `frontend/src/`, with tests colocated as `*.test.tsx`. Conventions: `.claude/rules/typescript.md` and `.claude/rules/react.md`. Details: `.claude/rules/modules/frontend.md`
  - `app/`: the router (`router.tsx`), the route modules (`routes/`), the providers, the query client, the app layout with its navigation, the onboarding guard (`require-onboarding.tsx`), and everything that composes more than one feature (the details column, the New transaction sheet, the choices of a transaction form).
  - `features/<feature>/`: one domain each, in `api/`, `components/`, `hooks/` and `schemas/`: `auth` (the session, sign-in, linking a provider), `user`, `dictionaries`, `currencies`, `summary`, `accounts`, `transactions` and `locations`.
  - `components/`: shared UI without domain knowledge (`Page`, `Sheet`, `DetailsPanel`, `ActionBar`, `EntityForm`, `EntityPicker`, the fields, `Skeleton`, `LoadError`, `BootScreen`).
  - `hooks/`: hooks that features share (the local today, arrow-key selection, sheet drag, outside click).
  - `lib/`: the generated API types (`api-schema.ts`), the one openapi-fetch client (`api-client.ts`) with its `ApiError`, and the formatting and input rules of money, dates, amounts and account colors.
  - `config/env.ts`: the one reader of `import.meta.env`.
  - `styles/`: `tokens.css`, `global.css` and `media.css`.
  - `test/`: the Vitest setup and the shared `render`.

### Backend layout

Packages under `backend/app/` are split by layer, and each layer is split by domain (`accounting`, `user`):

- `api/`: routers in `api/endpoints/<domain>/`, joined in `api/api.py`. `api/endpoints/user/` holds `auth.py` (sign-in and tokens, and linking providers: `POST /user/auth/link/{provider}`, `POST /user/auth/link/{provider}/complete` and `DELETE /user/auth/link/{provider}`, and merging the other user an offered identity belongs to: `POST /user/auth/merge`) and `user.py` (the signed-in user: `GET /user/me`, `PUT /user/me/base_currency` and `PUT /user/me/username`). `api/endpoints/accounting/dictionaries.py` serves `GET /dictionaries/accounting` and `api/endpoints/user/dictionaries.py` serves `GET /dictionaries/user` (the sign-in providers, served without sign-in for the sign-in page), the value sets of each domain as key and label pairs. `api/endpoints/accounting/currencies.py` serves `GET /accounting/currencies`, every currency as a key and label pair, those in the most active transactions of the signed-in user in the last 90 days first and the rest in the dictionary's order. `api/endpoints/accounting/account.py` serves the accounts and their balance adjustments, created by `POST /accounting/accounts/{account_id}/adjustment` and updated by `PUT /accounting/accounts/{account_id}/adjustment/{transaction_id}` with one body that carries the signed amount; `GET /accounting/accounts/{account_id}` takes an optional `date` and then answers the sums that decide whether the account has a rate for a balance adjustment on that date, without the postings of the transaction given as `excluded_transaction_id`. `api/deps.py` holds the dependencies: `get_db` (a plain session), `DbTransaction` (a session opened with `begin()` by the private `_get_db_transaction`, which commits before the response is sent), `get_user_id`, which reads the user id from the `Authorization: Bearer` access token without a database read, `get_onboarded_user_id`, which the create endpoints use to refuse a user whose base currency is not set yet, and `get_refresh_token`, which reads the refresh-token cookie and rejects a foreign `Origin`. `api/cookies.py` holds the HTTP-only steps of the token endpoints, imported as a module: it sets that cookie while building the token response, and clears it.
- `services/`: business logic as module-level functions (`<entity>_service.py`). Transactions are processed by `services/accounting/transaction_processor/`, where `base.py` is the abstract processor, `expense.py`, `income.py`, `transfer.py` and `adjustment.py` subclass it and build the postings of their type, and `factory.py` picks the processor for a transaction type (`get_processor`) or for the kinds of the two accounts of a movement (`get_movement_processor`). The base never imports its subclasses; only the factory does, which keeps the package free of import cycles. `services/accounting/ledger_service.py` values a debit at an account's average rate and, after every create, update and delete, revalues the later postings of the accounts it touches in date order, values the expenses stored without a rate at the next credit's rate and posts exchange differences to the EQUITY account. `services/accounting/exchange_rate_service.py` fetches today's market rates from open.er-api.com and caches them in process memory, for the estimates of unvalued amounts that the transaction, account and summary services add on read. Sign-in is in `services/user/auth/`: `auth_service.py` runs the OpenID Connect authorization code flow (authorize, provider callback, one-time code exchange with PKCE) and links and unlinks further providers of a signed-in user, `oidc_provider.py` is the Authlib client of one provider, and `providers.py` is the provider registry built from settings. `services/user/merge_service.py` merges another user into the signed-in one. `services/user/token_service.py` issues the JWT access token and the rotating refresh token, verifies the access token, and rotates and revokes refresh tokens.
- `crud/`: data access. `crud/base.py` defines `CRUDBase`, which writes with `flush` and leaves the commit to the request transaction. Each entity has a crud module with a module-level instance.
- `models/`: SQLAlchemy models on `models/base.py`. A transaction is a header row (`models/accounting/transaction.py`) with its postings (`models/accounting/posting.py`).
- `schemas/`: Pydantic schemas, plus `error_response.py` (`ErrorResponse`, `ErrorCodeType`).
- `exceptions/`: the `AppBaseException` hierarchy (`exceptions/base.py`), one file per HTTP status. Each exception carries its status code, message, log message, logger and log level. The handler in `app/main.py` logs it and turns it into an `ErrorResponse`, except `ClientRedirect` (`temporary_redirect_307.py`), which its own handler turns into a redirect to the sign-in client.
- `configs/`: `settings.py` holds the `settings`, `database_settings`, `telegram_settings` (the OIDC client id and secret from BotFather and the discovery URL), `google_settings` (the OAuth client id and secret from Google Cloud and the discovery URL), and `exchange_rate_settings` (the open.er-api.com URL and how long its rates are cached) instances. `logging_settings.py` holds `get_logger` and `LogLevelType`.
- `db/postgres.py`: the async engine and `session_maker`.
- `utils/`: small pure helpers.

## Commands

Everything runs in Docker through `docker-compose.yml`, which has the `postgres`, `mock-oidc`, `backend` and `frontend` services. `mock-oidc` is a mock OpenID Connect server that stands in for Telegram and Google locally. Rebuild the image only when `backend/tests/Dockerfile` or `backend/requirements/` change. The `backend` service builds from `backend/`, mounts it as `/app` and reads its settings from the committed `backend/.env` through `env_file`. The `frontend` service runs the `node` image with `frontend/` mounted over its own `node_modules` volume, and installs with `npm ci` on start. Production and its deploy: `.claude/rules/ci.md`.

`scripts/connect-phone.ps1` connects an Android phone to the local app over wireless debugging and forwards its ports with `adb reverse` (README, Testing on a phone).

### Format

Try the local CLI first, and fall back to Docker if the command is missing. Run from `backend/`, with paths relative to it, since `backend/pyproject.toml` holds the configuration and the container mounts `backend/` as `/app`:

```bash
black <changed_files>      || docker compose run --rm backend black <changed_files>
isort <changed_files>      || docker compose run --rm backend isort <changed_files>
```

The frontend formats with Prettier and lints with ESLint, both configured in `frontend/`. Run from `frontend/` after `npm ci`:

```bash
npx prettier --write <changed_files>
npm run lint
npm run typecheck
```

### Tests

Tests run through `backend/tests/Dockerfile`, and `backend/pytest.ini` sets the environment with fake values. The pytest-postgresql database is the one real service a suite starts. Every other external service stays mocked.

`backend/tests/db_migration/test_migrations.py` applies the Alembic revisions to an empty pytest-postgresql database, fails on any difference from the models, and runs the downgrade, so a model change needs a matching revision. It also applies the head revision to a database with a stored transaction, so a revision that changes rows of `transactions` and then alters the table is checked against a row.

**Scoping rules: always apply both levels.**
1. **Module level**: only run tests for modules whose source files changed.
2. **File level**: within that module, pass only the test paths that correspond to the changed source files. Do not run the full suite when a subset is enough. If no test maps to the changed files (for example, only config or rule files changed), skip tests entirely.

```bash
docker build -t finance-test -f backend/tests/Dockerfile backend
docker run --rm -v "${PWD}/backend:/app" finance-test pytest -v -n auto <test_paths>
```

`<test_paths>` are relative to `backend/`, which is mounted as `/app` (`tests/services/...`, not `backend/tests/services/...`).

**Windows only:** run this in **PowerShell or WSL**, not Git Bash. Git Bash turns the current directory into a POSIX path (`/c/Users/...`) that Docker Desktop rejects. The volume then silently fails to mount, and the tests run against the files baked into the image.

The frontend runs Vitest in jsdom on the values `test.env` in `frontend/vite.config.ts` sets. From `frontend/`, pass only the colocated test files of the changed source files:

```bash
npm run test -- <test_paths>
```

### API types

`frontend/src/lib/api-schema.ts` is generated from the running backend's `/openapi.json` and committed. Regenerate it after any change to the API, with the backend up on port 8000 (`docker compose up -d backend`), from `frontend/`:

```bash
npm run generate:api
```

### Database migrations

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "<description>"
```

### Test data

`backend/scripts/seed.py` fills a migrated local database through the services with a user whose username (default `test_1`), sign-in provider (Telegram or Google) and dataset it asks for: `full`, the transactions from 2024-01-01 to today, or `small`, a few transactions that cover every case of an account merge, both in base currency USD; if the user exists for that provider, it asks whether to recreate it or to seed another username (README, Seeding test data):

```bash
docker compose exec backend python -m scripts.seed
```

## Git Conventions

- **Start every new issue on a fresh branch:** before any file edits, run `git fetch origin && git checkout -b <issue_number>-<issue_name> --no-track origin/main`. Never commit or edit files while on `main` or on a stale local branch. The first push of every issue branch comes once it carries commits and is `git push -u origin <issue_number>-<issue_name>`, so that the branch tracks its own remote branch.
- **Branch naming:** `<issue_number>-<issue_name>`, with no `feature/` prefix (for example `22-port-claude-code-rules`).
- **The `assets` branch:** an orphan branch for files shown in issues, such as the agreed mockups of a screen and their design sources. It shares no history with `main`, holds no code, has no pull requests and is never merged; it holds only one folder per issue number. The `issue-writer` skill describes what goes in it and how an issue shows it.
- **Move the issue through the project statuses:** the `fibboo-finace` project has `In Refinement`, `Ready for Development`, `In Development`, `In Review` and `Done`. The `issue-writer` skill sets the first two, which describe the issue itself; the work sets the rest:
  - work starts only on an issue that is `Ready for Development` and whose every "Blocked by" issue is closed or has an open pull request that the new branch stacks on (the `issue-writer` skill, **Commands**, lists the blockers with their state); an issue still `In Refinement` has its open items settled first through the `issue-writer` skill, which also sets the blockers, and a blocked issue may be refined while it waits;
  - right after the first push of an issue branch, set the issue's Status to `In Development`, unless it is already `In Development`, `In Review` or `Done`;
  - right after creating its pull request, into `main` or into another branch of a stack, set it to `In Review`. The project's built-in workflow "Pull request linked to issue" sets `In Review` too, when a pull request into `main` links the issue, so a stacked PR retargeted to `main` later keeps the status.

  The option ids and the commands that read and set a status are in the `issue-writer` skill (`.claude/skills/issue-writer/SKILL.md`, **Repository and Project** and **Commands**). A Container takes its status from its sub-issues: `In Development` while at least one is past `Ready for Development` (`In Development`, `In Review` or `Done`) and not all of them are `Done`, `Done` once all of them are, otherwise `In Refinement` while at least one is `In Refinement`, otherwise `Ready for Development`. Whenever a sub-issue changes status, check its parent and move the parent as well.
- **Isolate process and prompt changes:** changes under `docs/` and `.claude/` go in a pull request of their own. `.claude/rules/common.md` **General Coding** has the rule with its exceptions, and what counts toward the 500-line PR limit.
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

## CI/CD

`.github/workflows/tests.yml` runs the backend tests, the frontend checks and the API schema check on every pull request, each only when its files changed. `.github/workflows/deploy.yml` deploys every push to `main` to the VPS. Both run on the self-hosted runner on that VPS. Details: `.claude/rules/ci.md`.

## Issue Tracking

Issues live in GitHub Issues of `fibboo/finance` and on the GitHub project `fibboo-finace` (owner `fibboo`, number 3). The `issue-writer` skill creates and updates them.
