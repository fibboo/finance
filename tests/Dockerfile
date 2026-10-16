FROM python:3.15.0-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

EXPOSE 8000
WORKDIR /app

RUN apt-get update && apt-get install -y postgresql-common \
    && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && apt-get install -y --no-install-recommends gcc postgresql-18 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements requirements
RUN pip install -r requirements/local_tests.txt

COPY app app
COPY tests tests
COPY db_migration db_migration
COPY alembic.ini alembic.ini
COPY pytest.ini pytest.ini

RUN useradd test && chown -R test:test /app
USER test

CMD ["pytest", "tests", "-n", "auto"]
