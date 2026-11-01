---
paths:
  - "**/*.py"
  - "backend/requirements/**"
  - "backend/pyproject.toml"
  - "backend/setup.cfg"
  - "**/.env*"
  - "backend/Dockerfile"
  - "backend/tests/Dockerfile"
  - "backend/pytest.ini"
  - "backend/alembic.ini"
---

# Python Rules

These rules apply to new and changed code. Existing code that does not follow them yet is brought in line by dedicated issues, not by unrelated pull requests.

## Formatting

- Black and isort read their configuration from `pyproject.toml`. Always defer to those settings rather than restating values here.
- Blank lines around control flow blocks (`if`/`elif`/`else`, `for`/`while`, `try`/`except`/`finally`, `with`):
  - Default: one blank line before and after the block, except at the very start or end of the enclosing block.
  - **NEVER put a blank line between a variable assignment and the control flow block that uses that variable.** This holds whether the variable appears in the block's header (condition, iterator, context expression) or in its body (accumulators, dicts or lists filled by a loop, buffers written inside a `with`). The assignment group and the block are one logical unit, so the blank line goes *before* the assignment group. This applies to every assignment form (`x = ...`, `x: T = ...`, `x += ...`, tuple unpacking), and also when the block uses only some variables of the group.

    ```python
    account_db: AccountModel | None = await account_crud.get_or_none(db=db, id=account_id, user_id=user_id)
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id}, logger=logger)
    ```

    ```python
    amounts: dict[UUID, Decimal] = {}
    for transaction in transactions:
        ...
    ```

  - A blank line before a control flow block is correct only when the statement above it is unrelated to the block (for example a side-effect call, or an assignment first used after the block).
  - Required self-check before finishing any Python change: for every `if`/`for`/`while`/`with`, look at the lines directly above it. If they assign a variable used in the block's header or body, there must be no blank line between them.
- Prefer the single-line form whenever it fits within the configured line length. Never spread an expression across lines for style alone.
- Don't use an inline ternary (`value if condition else other`) when it would push the line past the configured line length; use a full `if`/`else` block instead. When it fits, prefer the inline ternary over assigning a default and then overriding it in an `if` block.
- Don't use comprehensions or generator expressions when they would push the line past the configured line length. Use a regular `for` loop instead.
- Prefer explicit conditions (`len(x) > 0`, `x is not None`) over truthy/falsy checks. Use truthy/falsy only when the falsy semantics are really needed.

## Imports

These rules cover the code in `app/`. A test imports the functions it tests by name.

- A module of plain functions of ours (a service, `utils`, `cookies`) is imported as a module, and its functions and constants are reached through it: `from app.api import cookies`, then `cookies.delete_refresh_token_cookie(...)` or `cookies.REFRESH_TOKEN_COOKIE`.
- An endpoint module is imported as a module too, and its `router` is read through it, as `app/api/api.py` does (`auth.router`).
- Classes, instances (crud objects, settings), enums, exceptions, schemas and the FastAPI dependencies in `deps.py` are imported by name, as the code already does. So is `get_logger`, as **Logging** prescribes.

## Configuration

- Use pydantic `BaseSettings` for all settings.
- Every field is populated from environment variables and `.env` files. Never set default field values.
- Never read `os.environ` directly.
- Code imports the settings instance it needs (`settings`, `database_settings`, `telegram_settings`) from `app/configs/settings.py` and reads the field where the value is used.
- Never pass a setting value or a settings object into our own code as a parameter. The callee reads the field from the settings instance itself (`.claude/rules/common.md` **Architecture** names the exceptions).
- Tests run on the settings `pytest.ini` sets, which are the test values by design. A test that really needs another value overrides that one field for its own duration (`monkeypatch.setattr` on the settings instance) and nothing else. It does not add a parameter to the code under test to receive the value.

## Comments

- A route handler's docstring stays, because FastAPI shows it as the endpoint description in Swagger and Redoc. It is API documentation for the people who call the API, not a comment on the code. Every other docstring and comment follows the no-comments rule of `.claude/rules/common.md`.
- Test section markers are `# arrange`, `# act`, `# assert` and `# act / assert`, the last one for a `pytest.raises` block.

## Error Handling

- Raise exceptions from the `AppBaseException` hierarchy in `app/exceptions/`, one file per HTTP status. Never raise bare `Exception` in services, crud or endpoints. A new error condition gets its own subclass in the file of its status, passing the module's `logger` so that the handler in `app/main.py` logs it at the subclass's level.

## Docker Images

- No base image is prescribed for the production `Dockerfile` or for `tests/Dockerfile`. Each image is chosen by what the module needs, and among the images that work, the lightest one is taken. That is the `alpine` variant of the official Python image when the dependencies and the runtime work on musl, and the `slim` variant when they do not. When an image leaves alpine, write the reason in the module's entry in `CLAUDE.md` so that the next reader does not move it back. The test image is `slim` because it installs PostgreSQL for pytest-postgresql. No version is prescribed either: the Python version and the versions of everything the image installs are whatever the module currently builds and runs with, and they move with upgrades.

## Logging

- Log through a module-level `logger = get_logger(logger_name=__name__)` from `app/configs/logging_settings.py`.
- Never use `print()`.

## Return Style

- Always assign the result to a variable before returning it; never return an inline expression. Exception: a bare identifier or a pure attribute-access chain with no calls may be returned directly (e.g. `return MyClass`, `return settings.app_title`, `return self._field`).
- **NEVER put a blank line between the assignment of the returned variable and the `return` itself.** This is the same rule as for control flow blocks: the assignment and the statement that uses it are one logical unit, so the blank line goes *before* the assignment group.

  ```python
  account: Account = Account.model_validate(account_db)
  return account
  ```

  A blank line before `return` is correct only when the statement above it is unrelated to the returned value (for example a logging call, or a bare `return` that ends a guard).

## Condition Style

- Never put a function or method call inside a condition (`if`, `while`, ternary, comprehension filter) when the call spans or wraps lines. Assign each call result to a named variable first, then use the variables in the condition. A condition must read as a comparison of named values, not a computation.

## Typing

- All function parameters, return types and variable assignments carry explicit type annotations, with two exceptions: (1) omit the annotation if adding it would push the line past the configured line length; (2) omit it when the variable is assigned directly from a constructor call, since the type is evident from the right-hand side (e.g. `result = MyClass(...)`).
- A constrained field uses `Annotated`, as the Pydantic documentation recommends: `Annotated[str, StringConstraints(...)]` for a string and `Annotated[Decimal, Field(...)]` for a number. The `con*` functions (`constr`, `condecimal`, `conint` and the rest) are not used. A constraint shared by several fields of one module that mean the same thing is one named `Annotated` alias in that module, annotated `TypeAlias`.

## Function Signatures

- Every function and method that takes one or more parameters (besides `self`/`cls`) puts `*` before them, making them keyword-only. The exceptions are callbacks a framework calls positionally, whose signature the framework dictates: an exception handler registered with `app.exception_handler`, a pydantic `field_validator`, and an override that forwards `*args, **kwargs` to a library base class (`Transaction.__init__`). Test functions are not covered, since pytest calls them.

## Class Method Ordering

- `@abstractmethod` methods come right after `__init__` (if present), before any concrete methods.

## Method Visibility

- A method that only its own class calls is private and is named `__name`.
- A single underscore `_name` is for a method that a subclass overrides or calls: abstract hooks, and base-class helpers that subclasses use (for example the `transaction_processor` hooks or `CRUDBase._build_get_query`). Python mangles `__name` per class, so a subclass can neither override nor call it.
- Call sites decide, not habit: a `_name` defined and called in one class only breaks the rule, and a `_name` a subclass reaches is correct.

## Static Methods

- Any method that never touches `self` must be a `@staticmethod`. Call sites keep using `self.__method(...)`.
- The pure calculator that `.claude/rules/common.md` lets any private helper call is a `@staticmethod` with no state and no side effects.

## Endpoints

- A route handler takes its parameters and dependencies, hands the request to the service layer and returns the result. It has no logic of its own: no branching, no computation and no building of a response schema. Every business decision about the request belongs to the service layer. Handing over is one call into it, such as a service function, or the transaction processor that `factory.get_processor` returns (`app/services/accounting/transaction_processor/`).
- A dependency in `app/api/deps.py` may check the request itself: authenticate it, check its `Origin`, read a cookie or a header. It makes no business decision; that stays in the service layer.
- A cookie exists only in HTTP, so setting or clearing it is done by a helper in `app/api/`. The handler may call one such helper with the service layer's result before it returns.
- A redirect needs no helper. The route declares `response_class=RedirectResponse`, and the handler returns the URL the service layer gives it.
- A handler with more than two query parameters takes them as one Pydantic model. A new handler uses FastAPI's query parameter models (`Annotated[Model, Query()]`). An existing model taken as `Depends()`, as `CategoryRequest` is, is allowed too. Validation of their values (a fixed value, a format, a length) lives in that model, and the handler passes the model to the service as it is. Path parameters and dependencies are not counted.

## Database Access

- **A crud returns models or plain values.** It returns an ORM model, a list or page of them, or a plain value (`bool`, `int`, `UUID`, a SQLAlchemy `Row` of an aggregate or column projection). It never returns a pydantic schema. Turning a model into a schema is serialization, which is the service's job. This does not cover a schema passed to a crud as input, which the crud modules already accept.
- **A crud writes with `flush` and never commits.** The commit belongs to the request transaction. An endpoint that writes takes `db: DbTransaction` (`app/api/deps.py`), which opens the session with `begin()` and commits it before the response is sent. So every write in a request, such as an account balance and the transaction that changes it, lands together or not at all. The `commit` flag of the `CRUDBase` methods stays `False` in application code; only a test's arrange step sets it, to commit its rows through the plain `db`.
- **Services write only through the crud.** Services and endpoints never call `commit()` and never open a `begin()` block. They do not write around the crud with `db.add` or an insert, update or delete of their own.

## Tests

- **A client is never the subject of a test.** A client is code whose only job is to talk to an external service, such as the Telegram API over httpx. Testing it only restates the call it makes. The test passes because the assertion was copied from the implementation, fails on any harmless rewrite that sends the same request differently, and proves nothing about behaviour, because what the service really answers is only observable against the live service. Request building, retry and timeout wiring, response-to-schema mapping and client reuse are all that kind of code. The framework is the same case: asserting FastAPI routing, `TestClient` status codes or Pydantic validation describes someone else's code. A rule of ours that happens to live in a client stays tested, for example the ID token checks of `iss`, `aud` and `nonce` in `oidc_provider.py`, with the external service mocked.
- **An endpoint is never the subject of a test,** whether it is driven through a request or called directly. A route handler only passes its arguments to the service it delegates to and returns the answer, so anything it could be asserted to do is what that service does. Test the service instead. This covers the route handler only: the helpers in `app/api/` (`cookies`) and the dependencies in `deps.py` are our code and are tested directly.
- **A rule with edges is tested at every edge at once.** A window, a limit or a threshold is tested just inside and just outside each of its edges, in one test or in one `parametrize`, and the data is chosen so that moving any edge by one step changes the result the test asserts, instead of hiding behind a tie that another ordering or a default happens to break the same way. A test that reads the clock freezes it for both the arrange and the act, so that a run across midnight cannot move the edges between them. Fixing a finding about one edge means checking all of them in the same change, not only the one the finding names.
- **A definition is never the subject of a test.** An enum's members and values, a constant, a settings default or a schema's list of fields are declared, not computed. A test that reads one back only copies the declaration. A definition is tested only through the behaviour that uses it, and a test whose act is nothing but reading the definition is deleted.
- **Only external resources are mocked.** A test may replace only a service outside this repository: the Telegram API and any other HTTP service. Our own classes, crud modules and functions are never mocked, and neither is the thing the test asserts on. A test that patches a crud and then asserts the mock was awaited proves the code calls what the test put there, not that the code works. Overriding one settings field for the duration of a test (see **Configuration** above) is not a mock: it changes a value the code reads, not the code that reads it.
- **The database is real.** Tests run against a PostgreSQL database started by pytest-postgresql, with the schema built from the models' metadata in `tests/conftest.py`. Tests reach it through the `db` and `db_transaction` session fixtures, never through the engine and never through a mocked crud or session. The fixtures mirror how the code gets its session. Where production runs the code inside `DbTransaction`, the test passes `db_transaction` and commits it in the act, as the dependency does at the end of a request. Rows the test needs are inserted and committed through the plain `db`, with the `commit=True` flag of the `CRUDBase` methods, which exists for exactly this. Assertions on the database are also read through the plain `db`, a separate session, so they only see what was actually committed. A test that needs two transactions in a row stores the first one's outcome as rows in arrange, since a transaction opened with `begin()` accepts nothing after its commit.
- **The act calls the real code.** The act is one direct call to the function under test, and the assertions read what that call returned or the state it left behind, never what a mock of our own code was called with. Async tests are `async def` under pytest-asyncio with `asyncio_mode = auto`, with no per-test marker. `asyncio.run` inside a sync test is rejected.
- **No test-local helpers.** A test module defines no functions other than its tests. Inputs, mocks of external services, database rows and verification queries are written out in each test, so that it reads top to bottom as what it sets up, what it calls and what it checks. Setup shared by several tests lives only in pytest fixtures in `conftest.py` and in `pytest.mark.parametrize`. The one other shared module a suite may keep under `tests/` holds data, not steps: test-data constants, and classes that fake an external service. A function in such a module is still a helper.
- **Where a test lives.** `tests/` mirrors the `app/` package path, with the same folder names and no `test_` prefix on folders: `app/services/accounting/account_service.py` is tested in `tests/services/accounting/test_account_service.py`. There is one test file per module under test, named `test_<module>.py`, holding only that module's tests. Behaviour inherited from a base class is tested in the subclass's file.
- **The criterion is what the test asserts, not what the file is named.** A suite named after a service still goes if all it asserts is the transport underneath, and a rule of ours inside a module named `*_client.py` stays tested.
