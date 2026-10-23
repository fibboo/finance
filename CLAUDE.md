# CLAUDE.md

## Rules

- **Keep CLAUDE.md up to date.** Update it in any PR that makes structural changes. Also fix any mismatch you notice with the actual codebase, even when it is unrelated to the current task. This file is the map and stays short, because it is always loaded. A module's design decisions and the reasons behind them go in `.claude/rules/modules/<module>.md`. Its `paths:` frontmatter loads it only while that module's files are read. When a module needs such a file, its entry here gains one line pointing at it.
- **No code examples in plans.** Plans describe steps and approaches only.
- **Show skill output verbatim.** When a skill runs (via the Skill tool), show ALL its output exactly as returned. Never filter, summarize, truncate or reformat it. The one exception is code review findings: from `/code-review`, a `pr-reviewer` agent, or a forked or background run that arrives as a task notification. Never paste them as JSON. Render them as a list grouped under P1, P2 and P3, the grades `.claude/rules/pr-review.md` defines. Each item names its file and line, states the defect in one sentence, and recommends a fix or leaving it, in the language of the conversation. Put one line before the list naming what the review actually covered. A review started from a clean checkout of `main` reviews its last commit, not the pull request in a worktree.
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

A **module** is a directory that ships as its own container. It owns a `Dockerfile`, a `requirements/` folder or `package.json`, its tests, and a service entry in `docker-compose.yml`. The scoping rules for tests and the PR size limit both depend on this boundary. Adding a module, such as the frontend, follows the `add-module` skill (`.claude/skills/add-module/SKILL.md`).

- **backend/**: the FastAPI API. Code is in `backend/app/`, tests in `backend/tests/`, migrations in `backend/db_migration/` (configured by `backend/alembic.ini`). Its compose service is `backend`, served on port 8000. Details: `.claude/rules/modules/backend.md`
- **frontend/**: the single-page app. Code is in `frontend/src/`, with tests colocated as `*.test.tsx`; `src/config/env.ts` is the one reader of `import.meta.env`, `src/lib/api-schema.ts` holds the generated API types, `src/lib/api-client.ts` the one openapi-fetch client (an error response throws the `ApiError` of `src/lib/api-error.ts`), and `src/test/` holds the Vitest setup (the MSW server, a `navigator.locks` stub, a sign-out after each test) and the shared `render`. `src/features/auth/` keeps the session: `api/session.ts` holds the access token in memory, refreshes it under a Web Lock, shares it over a `BroadcastChannel` and signs out, `api/auth-middleware.ts` (registered on the client in `providers.tsx`) adds the token and refreshes once on a 401, and `RequireSession` is the layout route that guards every signed-in route. `SignInPage` starts the PKCE round trip of `api/pkce.ts` with one button per provider it is given, and `api/complete-sign-in.ts`, the loader of `/auth/callback`, checks the state, exchanges the one-time code and starts the session. `src/features/user/` holds the `userQueries` factory, `userMutations` (setting the base currency and the username, a taken username becoming a field error), the user summary with its username form, the shared username field and the base-currency form, which also shows the given username and saves it first when it was changed. `src/features/dictionaries/` holds the `dictionaryQueries` factory of the dictionary endpoints, with an infinite `staleTime`; since features do not import each other, the app layout reads `dictionaryQueries.user()` and passes the provider labels into the user summary, and the `/sign-in` route module (`src/app/routes/sign-in.tsx`) reads it with `useQuery` (an error reaches the route's error boundary) and passes the provider items into `SignInPage`, while the onboarding route reads `dictionaryQueries.accounting()` the same way, without suspending, and passes its currencies and its copy (header and title) into the base-currency form, which composes the page's copy panel and its form panel of the username and main currency sections; both show skeletons of the provider buttons or the currency list while the dictionary loads. `src/features/summary/`, `src/features/accounts/` and `src/features/transactions/` hold the query factories and the panels of the home page (`src/app/routes/home.tsx`): the balance panel, the largest accounts that fit (measured by `useFittingCount`) and the recent transactions, each showing skeletons while its query is pending. `src/lib/format-money.ts` formats amounts with `Intl.NumberFormat`, and `src/lib/account-colors.ts` holds the account palette, whose first color stands in for an account without one. `src/app/` holds the router (`router.tsx`, every route below the root lazy, route modules in `src/app/routes/`), the providers (query client, theme, error notification), the query client, the root error boundary, `require-onboarding.tsx` (the layout route under `RequireSession` that sends a user without a base currency to `/onboarding` and an onboarded one away from it) and the app layout with its navigation; `src/components/` holds the shared UI (account menu, theme switch, error notification, the `Skeleton` block with its reduced-motion shimmer, and `BootScreen`, the `HydrateFallback` of the root route and, labelled "Signing in", of the sign-in callback, which repeats the boot screen `frontend/index.html` shows in `#root` before any script loads); `src/styles/` holds `tokens.css` (each color one `light-dark()` value that follows the device, pinned by `data-theme="light"` or `"dark"` on the root), `global.css` with the self-hosted Geist fonts, and `media.css` with the `--desktop` custom media that CSS modules import and Lightning CSS resolves. Its compose service is `frontend`, the Vite dev server on port 5173, which proxies `/api` to `backend`; in production nginx (`frontend/nginx.conf`) serves the bundle on port 80 and proxies `/api` the same way. Stack: Vite, React 19 with the React Compiler, TypeScript 6, React Router 8 (data mode), TanStack Query 5, React Hook Form with Zod 4, openapi-fetch over types generated by openapi-typescript, CSS Modules, Vitest in jsdom with Testing Library and MSW, ESLint and Prettier. Conventions: `.claude/rules/typescript.md` and `.claude/rules/react.md`

### Backend layout

Packages under `backend/app/` are split by layer, and each layer is split by domain (`accounting`, `user`):

- `api/`: routers in `api/endpoints/<domain>/`, joined in `api/api.py`. `api/endpoints/user/` holds `auth.py` (sign-in and tokens, and linking providers: `POST /user/auth/link/{provider}`, `POST /user/auth/link/{provider}/complete` and `DELETE /user/auth/link/{provider}`) and `user.py` (the signed-in user: `GET /user/me`, `PUT /user/me/base_currency` and `PUT /user/me/username`). `api/endpoints/accounting/dictionaries.py` serves `GET /dictionaries/accounting` and `api/endpoints/user/dictionaries.py` serves `GET /dictionaries/user` (the sign-in providers, served without sign-in for the sign-in page), the value sets of each domain as key and label pairs. `api/deps.py` holds the dependencies: `get_db` (a plain session), `DbTransaction` (a session opened with `begin()` by the private `_get_db_transaction`, which commits before the response is sent), `get_user_id`, which reads the user id from the `Authorization: Bearer` access token without a database read, `get_onboarded_user_id`, which the create endpoints use to refuse a user whose base currency is not set yet, `get_base_currency`, which returns that base currency with the same refusal for account creation, and `get_refresh_token`, which reads the refresh-token cookie and rejects a foreign `Origin`. `api/cookies.py` holds the HTTP-only steps of the token endpoints, imported as a module: it sets that cookie while building the token response, and clears it.
- `services/`: business logic as module-level functions (`<entity>_service.py`). Transactions are processed by `services/accounting/transaction_processor/`, where `base.py` is the abstract processor, `expense.py`, `income.py`, `transfer.py` and `adjustment.py` subclass it, and `factory.py` picks the processor for a transaction type (`get_processor`). The base never imports its subclasses; only the factory does, which keeps the package free of import cycles. Sign-in is in `services/user/auth/`: `auth_service.py` runs the OpenID Connect authorization code flow (authorize, provider callback, one-time code exchange with PKCE) and links and unlinks further providers of a signed-in user, `oidc_provider.py` is the Authlib client of one provider, and `providers.py` is the provider registry built from settings. `services/user/token_service.py` issues the JWT access token and the rotating refresh token, verifies the access token, and rotates and revokes refresh tokens.
- `crud/`: data access. `crud/base.py` defines `CRUDBase`, which writes with `flush` and leaves the commit to the request transaction. Each entity has a crud module with a module-level instance.
- `models/`: SQLAlchemy models on `models/base.py`.
- `schemas/`: Pydantic schemas, plus `error_response.py` (`ErrorResponse`, `ErrorCodeType`).
- `exceptions/`: the `AppBaseException` hierarchy (`exceptions/base.py`), one file per HTTP status. Each exception carries its status code, message, log message, logger and log level. The handler in `app/main.py` logs it and turns it into an `ErrorResponse`, except `ClientRedirect` (`temporary_redirect_307.py`), which its own handler turns into a redirect to the sign-in client.
- `configs/`: `settings.py` holds the `settings`, `database_settings`, `telegram_settings` (the OIDC client id and secret from BotFather and the discovery URL) and `google_settings` (the OAuth client id and secret from Google Cloud and the discovery URL) instances. `logging_settings.py` holds `get_logger` and `LogLevelType`.
- `db/postgres.py`: the async engine and `session_maker`.
- `utils/`: small pure helpers.

## Commands

Everything runs in Docker through `docker-compose.yml`, which has the `postgres`, `mock-oidc`, `backend` and `frontend` services. `mock-oidc` is a mock OpenID Connect server that stands in for Telegram and Google locally. Rebuild the image only when `backend/tests/Dockerfile` or `backend/requirements/` change. The `backend` service builds from `backend/`, mounts it as `/app` and reads its settings from the committed `backend/.env` through `env_file`. The `frontend` service runs the `node` image with `frontend/` mounted over its own `node_modules` volume, and installs with `npm ci` on start. Production runs `docker-compose.production.yml` on the VPS: `backend` and `frontend` run the GHCR images `ghcr.io/fibboo/finance-backend` and `ghcr.io/fibboo/finance-frontend` tagged with `IMAGE_TAG`, next to `postgres` and `cloudflared`, which runs the Cloudflare Tunnel to `frontend`; every service has a healthcheck, `frontend` starts once the `backend` one passes and `cloudflared` once the `frontend` one does (nginx answering `/api/openapi.json` through its proxy). No service publishes a port on the public address; `postgres` publishes 5432 on `172.29.172.1` only, the host's address on the Amnezia VPN network (README, Deployment). `backend` reads `backend/.env-production`, whose secrets are `'${VAR}'` placeholders filled with envsubst at deploy time, and runs uvicorn only, since the deploy applies the migrations; the compose file reads `IMAGE_TAG`, `POSTGRES_PASSWORD` and `CLOUDFLARE_TUNNEL_TOKEN` from the project `.env` the deploy writes beside it.

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

`backend/tests/db_migration/test_migrations.py` applies the Alembic revisions to an empty pytest-postgresql database, fails on any difference from the models, and runs the downgrade, so a model change needs a matching revision.

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

## Git Conventions

- **Start every new issue on a fresh branch:** before any file edits, run `git fetch origin && git checkout -b <issue_number>-<issue_name> --no-track origin/main`. Never commit or edit files while on `main` or on a stale local branch.
- **Branch naming:** `<issue_number>-<issue_name>`, with no `feature/` prefix (for example `22-port-claude-code-rules`).
- **The `assets` branch:** an orphan branch for files shown in issues, such as the agreed mockups of a screen and their design sources. It shares no history with `main`, holds no code, has no pull requests and is never merged; it holds only one folder per issue number. The `issue-writer` skill describes what goes in it and how an issue shows it.
- **Move the issue through the project statuses:** the `fibboo-finace` project has `In Refinement`, `Ready for Development`, `In Development`, `In Review` and `Done`. The `issue-writer` skill sets the first two, which describe the issue itself; the work sets the rest:
  - work starts only on an issue that is `Ready for Development` and whose every "Blocked by" issue is closed or has an open pull request that the new branch stacks on (the `issue-writer` skill, **Commands**, lists the blockers with their state); an issue still `In Refinement` has its open items settled first through the `issue-writer` skill, which also sets the blockers, and a blocked issue may be refined while it waits;
  - right after the first push of an issue branch, set the issue's Status to `In Development`, unless it is already `In Development`, `In Review` or `Done`;
  - right after creating its pull request, into `main` or into another branch of a stack, set it to `In Review`. The project's built-in workflow "Pull request linked to issue" sets `In Review` too, when a pull request into `main` links the issue, so a stacked PR retargeted to `main` later keeps the status.

  The option ids and the commands that read and set a status are in the `issue-writer` skill (`.claude/skills/issue-writer/SKILL.md`, **Repository and Project** and **Commands**). A Container takes its status from its sub-issues: `In Development` while at least one is `In Development` or `In Review`, otherwise `In Refinement` while at least one is `In Refinement`, otherwise `Ready for Development`. Whenever a sub-issue changes status, check its parent and move the parent as well.
- **Isolate process and prompt changes:** changes under `docs/` and `.claude/` go in a pull request of their own. They are never mixed into a product PR, unless the request explicitly says otherwise or the change is one piece of work with the code. `.claude/rules/modules/` is the one exception: it travels with the code it describes, like `CLAUDE.md` and `README.md`. See `.claude/rules/common.md` for this rule and for what counts toward the 500-line PR limit.
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

`.github/workflows/tests.yml` runs on every pull request (any base branch) and on every push to `main`. On the free `ubuntu-latest` runner it builds `backend/tests/Dockerfile` with `backend/` as the context and runs `pytest -v -n auto` inside it. The `frontend` job runs `npm ci`, `lint`, `typecheck`, a Prettier check, `test` and `build` in `frontend/`. The `api-schema` job starts the backend image with `backend/.env`, runs `generate:api` against it and fails when the committed `api-schema.ts` differs. `.github/workflows/deploy.yml` runs when `tests` succeeds on a push to `main` for the commit that is still the head of `main` (a re-run of a deploy skips that check), and on `workflow_dispatch` from any branch. It checks that every secret is set and has no single quote, builds `backend/Dockerfile` and `frontend/Dockerfile`, pushes them to GHCR tagged with the commit SHA with the GitHub Actions build cache, renders `backend/.env-production` and the project `.env` from the repository secrets, copies them with `docker-compose.production.yml` into `~/finance` on the VPS over SSH, and runs there `docker compose pull`, `up -d --wait --no-recreate postgres`, a `pg_dump` into `~/backups/pre-deploy-<utc time>-<sha>.dump` (the five newest are kept), `alembic upgrade head` in a one-off container of the new backend image started with `--no-deps`, and `up -d --remove-orphans --wait --wait-timeout 300`, which fails the deploy when a service turns unhealthy or is still starting after five minutes and is the only step that applies changes to postgres, then removes the finance images of other SHAs; a failed dump or migration stops the deploy before the backend is replaced. Re-running an earlier deploy run rolls the server back to its SHA; across a migration it needs an `alembic downgrade` first (README, Deployment). README, Deployment, lists the secrets.

## Issue Tracking

Issues live in GitHub Issues of `fibboo/finance` and on the GitHub project `fibboo-finace` (owner `fibboo`, number 3). The `issue-writer` skill creates and updates them.
