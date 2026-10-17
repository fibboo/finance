---
name: add-module
description: Checklist of the repository files that must change alongside a new module (compose file, Dockerfiles, tests, health endpoint, frontend proxy, CLAUDE.md). Use whenever a new module or service is added to the repo, such as the planned frontend/, or an issue plans one.
---

# Adding a New Module

A module is a directory that ships as its own container (see the Modules section of `CLAUDE.md`). When adding one, always update these files together with the module itself:

1. **`docker-compose.yml`**: add a service entry for the module and expose its port for local use. Add a new supporting service (a broker, a cache, another database) only when the module needs infrastructure the file does not already have.
2. **`<module>/Dockerfile`**: the production image, the lightest one that works. A Python module follows the Docker Images rule in `.claude/rules/python.md`. The frontend uses a multi-stage build: a Node stage installs with `npm ci` and builds the bundle, and the `alpine` variant of the official nginx image serves it and proxies `/api`.
3. **Tests**: a Python module gets a `tests/` directory, a `tests/Dockerfile` and a `pytest.ini` with fake environment values, following the Tests section of `.claude/rules/python.md`. A frontend gets Vitest in jsdom configured in the Vite config with its test values in `test.env`, a setup file that starts the MSW server, the shared `frontend/src/test/render.tsx`, and tests colocated as `*.test.*`, following the Tests sections of `.claude/rules/typescript.md` and `.claude/rules/react.md`.
4. **`CLAUDE.md`**: add the module to the Modules section with its port, and add its format and test commands to the Commands section. If the module needs design notes, create `.claude/rules/modules/<module>.md` with a `paths:` frontmatter matching the module directory, and point to it from the module's entry.
5. **`README.md`**: add the steps to build and run the module locally.

For **FastAPI services** specifically:
- The service exposes a `GET /health` endpoint that returns `{"status": "ok"}`.

For the **frontend** specifically:
- It follows `.claude/rules/typescript.md` and `.claude/rules/react.md` from the first commit: the compiler options, the ESLint and Prettier configs, the typed settings module, the `package.json` script that regenerates the API types from the backend's OpenAPI schema, and the ignore entries that keep that generated `frontend/src/lib/api-schema.ts` out of ESLint and Prettier.
- `package.json` has `lint`, `format`, `typecheck`, `test` and `generate:api` scripts, and `CLAUDE.md` lists them under Commands. CI runs `lint`, `typecheck`, `test` and a Prettier check, and fails when the committed API types are stale.
- It lives in `frontend/` and proxies every API call (`/api/*`) to the `backend` compose service, in the dev server configuration and in the production web-server configuration alike. The backend then needs no CORS configuration, and in production it does not have to expose a host port of its own. The backend sets the refresh-token cookie on `/user/auth`, which the browser sees as `/api/user/auth`, so both proxies rewrite the cookie path: `cookiePathRewrite` in the Vite dev proxy and `proxy_cookie_path` in nginx.
