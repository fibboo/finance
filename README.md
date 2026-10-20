# Finance

## Description

Finances is a tool designed to help users manage and track their personal finances. It provides features for budgeting,
expense tracking, and generating reports, making financial management simple and efficient.

Tech Stack: Python, FastAPI, SQLAlchemy 2, Pydantic 2, PostgreSQL, Alembic, Docker, Pytest, Pytest x-dist on the
backend; Vite, React 19, TypeScript, TanStack Query, React Router, Vitest and MSW on the frontend

## Agent setup

For Claude Code and Codex setup, shared rules and skills, permissions, and Git troubleshooting, see [Agent setup](docs/agent-setup.md).

## Configuration

Every setting comes from environment variables; none has a default, so the app fails to start when one is missing.
Two env files are committed:

- `backend/.env` holds the local values. `docker-compose.yml` passes it to the `backend` service through `env_file`. The app
  runs locally only in Docker, so its database host is `postgres`, the compose service name.
- `backend/.env-production` holds the production values. Secrets are `'${VAR}'` placeholders, filled with `envsubst` at
  deploy time; the public URLs of `https://finance.fibboo.dev` are written openly. `docker-compose.production.yml` passes it to the `backend` service, which it builds
  from `backend/Dockerfile` and runs without `--reload`.

`backend/pytest.ini` sets fake values for tests, and they take precedence over `backend/.env`.

---

## Quick Start

1. Clone the repository:
   ```bash
   git clone git@github.com:fibboo/finance.git
   ```
2. Navigate to the project directory:
   ```bash
   cd finance
   ```
3. Build the Docker images:
   ```bash
   docker compose build
   ```
4. Start the project:
   ```bash
   docker compose up -d
   ```
5. Apply database migrations:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
   
Once all steps are completed, the frontend is available at [http://localhost:5173](http://localhost:5173) and the API at
[http://localhost:8000](http://localhost:8000). The Vite dev server proxies `/api` to the backend, so the frontend calls
the API as `/api/...`.

### Signing in locally

Locally, both sign-in providers point at the `mock-oidc` service, a [mock OpenID Connect server](https://github.com/navikt/mock-oauth2-server)
on port 8080 with one issuer per provider: `/telegram` and `/google`. `backend/.env` sets `TELEGRAM_SERVER_METADATA_URL` and
`GOOGLE_SERVER_METADATA_URL` to their discovery documents, while `backend/.env-production` keeps the real Telegram and Google
ones. No real Telegram or Google client is needed.

`PUBLIC_BASE_URL` in `backend/.env` is `http://localhost:5173/api`, so the provider sends the browser back to the backend
through the Vite proxy, the same `/api` path nginx serves in production. Signing in needs only port 5173 and the
mock server's port 8080, which also lets a phone sign in through two `adb reverse` forwards.

The mock server is reached as `mock-oidc.localhost:8080` by both sides, because the issuer in its tokens is the host it
was called on and the backend checks it. Chrome and Firefox resolve every `*.localhost` name to the local machine, so the
browser reaches the published port, and inside compose the name is a network alias of the `mock-oidc` service, so the
backend reaches the container. Only Chrome and Firefox resolve `*.localhost` on their own; Safari and some system tools
do not. For those, add this line to the hosts file (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 mock-oidc.localhost
```

The port is published on `127.0.0.1` only, since anyone who reaches the mock server can sign in as any user.

When a sign-in reaches the mock server, it shows a form: type any username, which becomes the user's `sub`, and press
Sign-in. The optional claims field takes a JSON object of extra ID token claims, such as
`{"preferred_username": "alice", "given_name": "Alice", "email": "alice@example.com", "email_verified": true}`. Without
`preferred_username` the user is named `<provider>_<username>`.

### Upgrading from PostgreSQL 15

The `postgres` service runs PostgreSQL 18, which keeps its data under `/var/lib/postgresql/18/docker`, so the compose volume is mounted at `/var/lib/postgresql`. A volume created by the old PostgreSQL 15 service starts as an empty cluster and the backend fails with `database "finance" does not exist`. Recreate the volume once, then repeat steps 4–5:

```bash
docker compose down -v
```

A database migrated before the Alembic revisions were squashed into one initial revision fails `alembic upgrade head` with `Can't locate revision`; recreate it the same way.

---

## API Documentation

The project provides built-in API documentation, available via Swagger or Redoc. To access it, open the following URL after starting the project:

Swagger - [http://localhost:8000/docs](http://localhost:8000/docs)

Redoc - [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Frontend

The `frontend` compose service runs the Vite dev server with `frontend/` mounted, so a saved file reloads the page. In
production `frontend/Dockerfile` builds the bundle and serves it with nginx, which proxies `/api` to the backend.

To work on the frontend outside Docker, install Node 22 or later and run from `frontend/`:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run format
```

The API types in `frontend/src/lib/api-schema.ts` are generated from the backend's OpenAPI schema. After changing the
API, start the backend (`docker compose up -d backend`) and regenerate them from `frontend/`:

```bash
npm run generate:api
```

CI fails when the committed file differs from the generated one.

---

## Running Tests

You can verify the functionality of the project by running the tests. There are two ways to do so:

1. **Inside the Docker container** (service should be running):
   ```bash
   docker compose exec backend pytest -n auto
   ```

2. **Locally (if you have Python installed)**:
   Ensure your virtual environment is activated, then run from `backend/`:
   ```bash
   cd backend
   pytest -n auto
   ```

---

## Testing on a phone

The app needs a secure context, which a phone has only on `localhost`, so an Android phone reaches the local app through
`adb reverse` over wireless debugging (Android 11 or later). The phone and the computer must be on the same Wi-Fi.

1. Install adb once and open a new terminal:
   ```powershell
   winget install Google.PlatformTools
   ```
2. On the phone, turn on Developer options (tap Build number seven times) and then Developer options → Wireless debugging.
3. Close Android Studio, which restarts adb with its own settings. With the app running (`docker compose up -d`), run
   from the repository root in PowerShell 7 (`winget install Microsoft.PowerShell`), whose default execution policy
   runs local scripts:
   ```powershell
   pwsh ./scripts/connect-phone.ps1
   ```
   The script finds the phone on the network, tries every phone that wireless debugging advertises, pairs it when none
   accepts (it asks for the code shown under Pair device with pairing code), connects once, forwards ports 5173 and
   8080, and checks that the dev server and the mock sign-in server answer on them.
4. Open `http://localhost:5173` in Chrome on the phone.

Wireless debugging turns off when the phone restarts or changes networks, and the forwards belong to one connection, so
rerun the script whenever the phone stops loading the app.
