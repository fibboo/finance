# CLAUDE.md

## Rules

- **Keep CLAUDE.md up to date.** Update it in any PR that makes structural changes. Also fix any mismatch you notice with the actual codebase, even when it is unrelated to the current task. This file is the map and stays short, because it is always loaded. A module's design decisions and the reasons behind them go in `.claude/rules/modules/<module>.md`. Its `paths:` frontmatter loads it only while that module's files are read. When a module needs such a file, its entry here gains one line pointing at it.
- **No code examples in plans.** Plans describe steps and approaches only.
- **Show skill output verbatim.** When a skill runs (via the Skill tool), show ALL its output exactly as returned. Never filter, summarize, truncate or reformat it. The one exception is code review findings: from `/code-review`, a `pr-reviewer` agent, or a forked or background run that arrives as a task notification. Never paste them as JSON. Render them as a list grouped under P1, P2 and P3, the grades `.claude/rules/pr-review.md` defines. Each item names its file and line, states the defect in one sentence, and recommends a fix or leaving it, in the language of the conversation. Put one line before the list naming what the review actually covered. A review started from a clean checkout of `main` reviews its last commit, not the pull request in a worktree.
- **Before every commit** (in order):
  1. Run Black
  2. Run isort
  3. Run only the tests affected by the changes (see the Tests section for scoping rules)
- See `.claude/rules/common.md` for general coding principles, `.claude/rules/python.md` for Python conventions, and `.claude/rules/pr-review.md` for PR review guidelines. pr-review.md is the one place that says what a finding is and how severe it is.

## Skill Triggers

- `#issue <description>`: create a new GitHub issue (invokes the `issue-writer` skill)
- `#issue <number>`: update an existing GitHub issue (invokes the `issue-writer` skill)

Skills live in `.claude/skills/<name>/SKILL.md`.

## Project Overview

Finance is a personal finance service: accounts, categories, locations, income sources, and income, expense and transfer transactions. Users sign in through Telegram. A FastAPI backend sits at the repository root. A frontend is planned under `frontend/`.

Tech stack: Python 3.11, FastAPI, SQLAlchemy 2 (async, asyncpg), Pydantic 2, pydantic-settings, PostgreSQL, Alembic, Docker, pytest with pytest-postgresql and pytest-xdist.

## Architecture

### Modules

A **module** is a directory that ships as its own container. It owns a `Dockerfile`, a `requirements/` folder or `package.json`, its tests, and a service entry in `docker-compose.yml`. The scoping rules for tests and the PR size limit both depend on this boundary. Adding a module, such as the frontend, follows the `add-module` skill (`.claude/skills/add-module/SKILL.md`).

- **backend (repository root)**: the FastAPI API. Code is in `app/`, tests in `tests/`, migrations in `db_migration/` (configured by `alembic.ini`). Its compose service is `backend`, served on port 8000. Details: `.claude/rules/modules/backend.md`
- **frontend/**: planned, not yet present.

### Backend layout

Packages under `app/` are split by layer, and each layer is split by domain (`accounting`, `user`):

- `api/`: routers in `api/endpoints/<domain>/`, joined in `api/api.py`. `api/deps.py` holds the dependencies: `get_db` (a plain session), `get_db_transaction` (a session opened with `begin()`, which commits at the end of the request), `get_user_id` and `get_token`.
- `services/`: business logic as module-level functions (`<entity>_service.py`). Transactions are processed by `services/accounting/transaction_processor/`, where `base.py` is the abstract processor and `expense.py`, `income.py` and `transfer.py` subclass it. Authentication clients are in `services/user/auth/` (`auth_client.py` is the base, with `telegram_client.py` and `test_client.py`).
- `crud/`: data access. `crud/base.py` defines `CRUDBase`, which writes with `flush` and leaves the commit to the request transaction. Each entity has a crud module with a module-level instance.
- `models/`: SQLAlchemy models on `models/base.py`.
- `schemas/`: Pydantic schemas, plus `error_response.py` (`ErrorResponse`, `ErrorCodeType`).
- `exceptions/`: the `AppBaseException` hierarchy (`exceptions/base.py`), one file per HTTP status. Each exception carries its status code, message, log message, logger and log level. The handler in `app/main.py` logs it and turns it into an `ErrorResponse`.
- `configs/`: `settings.py` holds the `settings`, `database_settings` and `telegram_settings` instances. `logging_settings.py` holds `get_logger` and `LogLevelType`.
- `db/postgres.py`: the async engine and `session_maker`.
- `utils/`: small pure helpers.

## Commands

Everything runs in Docker through `docker-compose.yml`, which has the `postgres` and `backend` services. Rebuild the image only when `tests/Dockerfile` or `requirements/` change.

### Format

Try the local CLI first, and fall back to Docker if the command is missing. Run from the repo root:

```bash
black <changed_files>      || docker compose run --rm backend black <changed_files>
isort <changed_files>      || docker compose run --rm backend isort <changed_files>
```

### Tests

Tests run through `tests/Dockerfile`, and `pytest.ini` sets the environment with fake values. The pytest-postgresql database is the one real service a suite starts. Every other external service stays mocked.

**Scoping rules: always apply both levels.**
1. **Module level**: only run tests for modules whose source files changed.
2. **File level**: within that module, pass only the test paths that correspond to the changed source files. Do not run the full suite when a subset is enough. If no test maps to the changed files (for example, only config or rule files changed), skip tests entirely.

```bash
docker build -t finance-test -f tests/Dockerfile .
docker run --rm -v "${PWD}:/app" finance-test pytest -v -n auto <test_paths>
```

**Windows only:** run this in **PowerShell or WSL**, not Git Bash. Git Bash turns the current directory into a POSIX path (`/c/Users/...`) that Docker Desktop rejects. The volume then silently fails to mount, and the tests run against the files baked into the image.

### Database migrations

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "<description>"
```

## Git Conventions

- **Start every new issue on a fresh branch:** before any file edits, run `git fetch origin && git checkout -b <issue_number>-<issue_name> --no-track origin/main`. Never commit or edit files while on `main` or on a stale local branch.
- **Branch naming:** `<issue_number>-<issue_name>`, with no `feature/` prefix (for example `22-port-claude-code-rules`).
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

## Issue Tracking

Issues live in GitHub Issues of `fibboo/finance` and on the GitHub project `fibboo-finace` (owner `fibboo`, number 3). The `issue-writer` skill creates and updates them.
