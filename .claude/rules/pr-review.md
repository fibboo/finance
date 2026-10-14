# PR Review Guidelines

These guidelines apply to every pull request review in this repository. This file says what a finding is and how severe it is. How a particular reviewer publishes its findings is up to that reviewer.

If the diff touches a `.py` file, a `requirements/` file, a Dockerfile, `pytest.ini`, `pyproject.toml`, `setup.cfg` or an `.env` template, read `.claude/rules/python.md` in full before reviewing it. That file loads only when a matching file is opened, and a review that reads the diff through `gh` opens none, yet every rule in it applies to the diff, not only the sections cited here.

## Severity

- Grade every finding **P1**, **P2** or **P3**. Severity alone does not decide blocking: a P1 always blocks, a P3 never does, and a P2 blocks only when the author can act on it in this PR before the merge.
- A P2 the author can do nothing about is reported, not blocked on.
- A judgement that belongs to the author is not blocking either, whatever its severity.

## What Is Not a Finding

- The size of a pull request. `.claude/rules/common.md` sets the 500-line limit as a rule for planning and authoring. A review does not count a diff's lines against it and never asks for a split to shrink a PR. The one-kind-of-work rule below is about what the diff contains rather than how big it is, and it still applies.
- A violation in a file the diff does not touch. Existing code is brought in line by dedicated issues, and a review never asks a pull request to migrate code it did not change. A file the diff moves or rewrites counts as touched and is held to the rules in full.

## Mixed Scope

A pull request carries one kind of work (`.claude/rules/common.md`: one issue is one kind of work). Read the linked issue and compare its scope with the diff:

- A fix to existing behaviour shipped together with a new capability is a finding, whatever the line count.
- A new branch inside existing logic for a case it already handles is part of the fix. A new endpoint, a new transaction type or a new entity is a new capability.
- Name which files belong to which piece, and ask for the original issue to be split into two sub-issues: a **Bug** for the fix and an **Enhancement** for the new capability, each with its own PR.
- Grade it **P2** and treat it as blocking, since the author can act on it before the merge. The reviewer never creates or edits issues; the split is the author's to make.

## Test Shape

Check every test the diff adds or changes against the Tests section of `.claude/rules/python.md`. Each of the following is a finding:

- **A mock of our own code.** A patch or mock that replaces one of our classes, crud modules or functions, or the very thing the test asserts on. Only external resources are mocked. A test that overrides one settings field for its own duration is not this finding.
- **A database reached around the fixtures.** A test that mocks a crud or a session, or opens the engine itself instead of taking `db` or `db_transaction` from `conftest.py`. These are the same finding: passing a plain session where production passes the request transaction, inserting rows or reading assertions through the act's `db_transaction` instead of the separate plain `db`, or asserting before that transaction is committed.
- **An act that is not the real call.** An act that goes through a helper instead of calling the function under test, an assertion that reads what a mock of our own code was called with instead of what the call returned or left behind, or async code driven by `asyncio.run` inside a sync test instead of an `async def` test.
- **A test-local helper.** Any module-level function in a test file other than the tests themselves, such as setup code, a builder or a one-line assertion wrapper. Shared setup belongs in a `conftest.py` fixture or in `pytest.mark.parametrize`.
- **A test of an endpoint.** A test whose act calls a route handler, directly or through a request, instead of the service it delegates to.
- **A test of a definition.** A test whose act only reads back an enum's members or values, a constant, a settings default or a schema's fields, instead of exercising the behaviour that uses it.
- **A test outside its mirrored path.** A test file that is not at the path mirroring the one `app/` module it tests, a folder carrying the `test_` prefix, or a file holding the tests of more than one module.

Grade each **P2** and treat it as blocking, since the author can act on it before the merge.

## Settings

Settings are read at the use site (`.claude/rules/common.md` **Architecture**). Each of the following is a finding when the diff adds it to our own code (a function, method, constructor or exception):

- a parameter whose every production caller passes the same settings value (test call sites do not count, since a test runs on `pytest.ini` and overrides a field rather than passing one);
- a call the diff adds that passes a settings value into an existing parameter whose other production callers pass the same value;
- a parameter that takes a whole settings object;
- a settings field with a default value, or code that reads `os.environ`.

Grade it **P2** and treat it as blocking: the fix is for the callee to read the setting itself, or for the value to come from the environment. A parameter whose production callers pass different settings or data is not a finding.

## Database Access

Each of the following is a finding when the diff adds it (`.claude/rules/python.md` **Database Access**):

- a crud method that returns a pydantic schema;
- a crud method that commits, or a call in application code that sets the `commit` flag of a `CRUDBase` method (a test's arrange step committing its rows through the plain `db` with `commit=True` is not a finding);
- a `commit()` or a `begin()` block in a service or endpoint, or a write such code performs around the crud with `db.add` or its own insert, update or delete;
- an endpoint that writes but depends on `get_db` instead of `get_db_transaction`.

Grade it **P2** and treat it as blocking: the fix is to return the model, to move the write into the crud, or to let the request transaction commit.
