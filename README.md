# Finance

## Description

Finances is a tool designed to help users manage and track their personal finances. It provides features for budgeting,
expense tracking, and generating reports, making financial management simple and efficient.

Tech Stack: Python, FastAPI, SQLAlchemy 2, Pydantic 2, PostgreSQL, Alembic, Docker, Pytest, Pytest x-dist

## Configuration

Every setting comes from environment variables; none has a default, so the app fails to start when one is missing.
`docker-compose.yml` sets them for the `backend` service and `pytest.ini` sets fake values for tests. To run the app
outside Docker, copy the template and adjust the values:

```bash
cp .env.example .env
```

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
   Ensure your virtual environment is activated, then run:
   ```bash
   pytest -n auto
   ```
