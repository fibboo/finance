import asyncio
import os

import edgedb
import pytest

from app.config.settings import settings
from app.services.expense import expense_service, category_service, place_service


@pytest.fixture
def app_settings():
    return settings.settings


@pytest.fixture(scope='session')
def event_loop():
    loop = asyncio.get_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope='session', autouse=True)
def edgedb_connection(event_loop):
    conn = edgedb.create_async_client()
    event_loop.run_until_complete(conn.execute('CREATE DATABASE test_db;'))
    test_conn = edgedb.create_async_client(database='test_db')

    migration_path = os.path.join(os.path.dirname(__file__), '../app/models/migrations')

    for file in os.listdir(migration_path):
        if file.endswith('.edgeql'):
            event_loop.run_until_complete(test_conn.execute(open(os.path.join(migration_path, file), 'r').read()))

    yield test_conn

    event_loop.run_until_complete(test_conn.aclose())
    event_loop.run_until_complete(conn.execute('DROP DATABASE test_db;'))
    event_loop.run_until_complete(conn.aclose())


@pytest.fixture
def db(mocker, edgedb_connection, event_loop):
    mocker.patch.object(expense_service, 'db', edgedb_connection)
    mocker.patch.object(category_service, 'db', edgedb_connection)
    mocker.patch.object(place_service, 'db', edgedb_connection)

    yield edgedb_connection

    event_loop.run_until_complete(edgedb_connection.query(f'DELETE expense::Expense'))
    event_loop.run_until_complete(edgedb_connection.query(f'DELETE expense::ExpensePlace'))
    event_loop.run_until_complete(edgedb_connection.query(f'DELETE expense::ExpenseCategory'))
