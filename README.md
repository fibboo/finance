# Finance

## Description

Finances is a tool designed to help users manage and track their personal finances. It provides features for budgeting,
expense tracking, and generating reports, making financial management simple and efficient.

Tech Stack: Python, FastAPI, SQLAlchemy 2, Pydantic 2, PostgreSQL, Alembic, Docker, Pytest, Pytest x-dist

## Agent setup

For Claude Code and Codex setup, shared rules and skills, permissions, and Git troubleshooting, see [Agent setup](docs/agent-setup.md).

## Configuration

Every setting comes from environment variables; none has a default, so the app fails to start when one is missing.
Two env files are committed:

- `backend/.env` holds the local values. `docker-compose.yml` passes it to the `backend` service through `env_file`. The app
  runs locally only in Docker, so its database host is `postgres`, the compose service name.
- `backend/.env-production` holds the production values. Secrets and host-specific values are `'${VAR}'` placeholders, filled
  with `envsubst` at deploy time. `docker-compose.production.yml` passes it to the `backend` service, which it builds
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
5. Create the database:
   ```bash
   docker compose exec postgres psql -U user -d postgres -c "CREATE DATABASE finance;"
   ```
6. Apply database migrations:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
   
Once all steps are completed, your project will be available at:  
[http://localhost:8000](http://localhost:8000)

### Upgrading from PostgreSQL 15

The `postgres` service runs PostgreSQL 18, which keeps its data under `/var/lib/postgresql/18/docker`, so the compose volume is mounted at `/var/lib/postgresql`. A volume created by the old PostgreSQL 15 service starts as an empty cluster and the backend fails with `database "finance" does not exist`. Recreate the volume once, then repeat steps 4–6:

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
