FROM python:3.11.9-bullseye

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

EXPOSE 8000
WORKDIR /app

COPY requirements/* requirements/
RUN pip install -r requirements/base.txt

COPY app app
COPY alembic.ini alembic.ini
COPY db_migration db_migration

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
