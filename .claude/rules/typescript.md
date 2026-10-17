---
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.tsx"
  - "frontend/package.json"
  - "frontend/tsconfig*.json"
  - "frontend/eslint.config.*"
  - "frontend/vite.config.*"
  - "frontend/.env*"
  - "frontend/Dockerfile"
---

# TypeScript Rules

These rules apply to new and changed code under `frontend/`. They give the TypeScript form of `.claude/rules/common.md`. React-specific rules are in `.claude/rules/react.md`.

## Toolchain

- TypeScript stays on the 6.x line. typescript-eslint's type-aware linting does not run on TypeScript 7 until 7.1 ships its programmatic API, and the linting is worth more than the faster compiler. The move to 7 is its own issue.
- Vite builds and type-strips. `tsc` only type-checks (`noEmit`), with `moduleResolution: "bundler"` and `isolatedModules`.
- Node 22 or later, ESM only (`"type": "module"`).

## Formatting and Linting

- Prettier formats and ESLint finds defects; ESLint never formats. Both read their configuration from `frontend/`, so defer to those files instead of restating values here.
- ESLint uses the flat config with typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` on the project service, `eslint-plugin-react-hooks` `recommended`, `eslint-plugin-jsx-a11y` `strict`, and `eslint-config-prettier` last.
- A rule is never switched off inline. If a rule is wrong for the codebase, it is switched off in the config, in its own pull request, with the reason in the PR description.
- Blank lines follow the same logic as `.claude/rules/python.md` **Formatting**: never a blank line between an assignment and the control flow block or `return` that uses it, and one blank line before the assignment group instead.
- Conditions are explicit (`items.length > 0`, `value !== undefined`), enforced by `strict-boolean-expressions`. Truthiness is used only when falsy semantics are really meant.

## Compiler Options

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `noPropertyAccessFromIndexSignature` are on. An index read is then `T | undefined`, and an optional field that is missing is told apart from one set to `undefined`.
- `verbatimModuleSyntax` and `erasableSyntaxOnly` are on. A type-only import is written `import type`, and nothing that emits runtime code from a type construct (`enum`, `namespace`, parameter properties) is allowed.

## Types

- No `any`. Data of unknown shape is `unknown` and is narrowed or parsed before use.
- No non-null assertion (`!`). Narrow the value or throw (`.claude/rules/common.md`: fail fast).
- No `as` casts except `as const`. A literal that must match a type uses `satisfies`, which checks the shape and keeps the literal types.
- Object types are declared with `type`, enforced by `consistent-type-definitions`. `interface` is used only to extend a library's interface.
- No `enum`. A value set is a string-literal union. A value set the backend defines comes from the generated API types and its labels from the dictionary endpoint (`.claude/rules/common.md` **Architecture**), never from a union declared here.
- Types of API requests and responses are taken from the types generated from the backend's OpenAPI schema. They are never redeclared by hand. A frontend-only shape derived from one of them uses `Pick`, `Omit` or an intersection.
- A value that can be in several states is a discriminated union with a literal `status` or `kind` field, and every `switch` over it is exhaustive (`switch-exhaustiveness-check`).
- Props, function parameters and shared data are `readonly` (`Readonly<T>`, `ReadonlyArray<T>`). Code builds new values instead of mutating the ones it receives.
- Exported functions annotate their parameters and return type. Local variables rely on inference unless the inferred type is wider than intended.

## Function Signatures

- A function that takes more than one parameter takes a single object parameter with named fields, the TypeScript form of the keyword-only rule in `.claude/rules/python.md`. A callback whose signature a library dictates (an event handler, a `select` function, a `queryFn`) is exempt.
- Functions are declared with `function` at module level. Arrow functions are for inline callbacks. A function inside an object literal, such as a key factory's entry, uses method shorthand.

## Return Style

- Assign a computed result to a named constant before returning it, as in `.claude/rules/python.md` **Return Style**. A bare identifier, a property access chain or JSX may be returned directly.

## Modules and Imports

- Named exports only. A default export is allowed only where a tool requires one.
- A route module that React Router loads through `lazy` exports `Component`, `loader` and `ErrorBoundary` under the names React Router expects. It is the one exception to the one-component-per-file rule of `.claude/rules/react.md`.
- No barrel `index.ts` files that re-export a folder. Import from the file that defines the thing. Barrels slow the Vite dev server, defeat tree-shaking and hide import cycles.
- Absolute imports go through the one `@/` alias for `frontend/src/`, declared in both `tsconfig` and the Vite config. Relative imports are used only inside one feature folder.
- The module boundaries of `.claude/rules/react.md` **Structure** are enforced by an ESLint import restriction, not by convention alone.

## Naming

- Files and folders are kebab-case (`account-list.tsx`, `use-accounts.ts`). This avoids case-only renames that Windows and Linux treat differently.
- Types and components are PascalCase, functions and variables camelCase, and module-level constants holding a primitive value that never changes (a number, a string) UPPER_SNAKE_CASE. An object of functions, such as a query key factory, is camelCase.
- Fields keep the names the API gives them (snake_case). The frontend does not map them to camelCase, so one concept has one name across the modules (`.claude/rules/common.md` **Naming**).

## Configuration

- Settings are read from one module, `frontend/src/config/env.ts`, which parses `import.meta.env` with a Zod schema at startup and exports the typed result. Code imports that object and reads the field where it is used (`.claude/rules/common.md` **Architecture**). Nothing else reads `import.meta.env`.
- Every variable under the `VITE_` prefix ships in the bundle that any visitor can read. Only public configuration goes there, never a secret.
- Tests run on the values the Vitest config sets (`test.env`), the counterpart of `pytest.ini`. A test that needs another value overrides that one field for its own duration with `vi.stubEnv` and nothing else.

## Error Handling

- Only `Error` instances are thrown (`only-throw-error`), and a promise is only rejected with one.
- A `catch` binding is `unknown` and is narrowed before use.
- An error of the backend becomes one typed `ApiError` (status, the error code and message from `ErrorResponse`, and the field errors of a FastAPI validation 422, taken from the `loc` and `msg` of each `detail` item) in the API client, so the rest of the code never inspects a raw response.
- No empty `catch`. An error is handled, rethrown or shown, never swallowed.

## Logging

- No `console` in committed code (`no-console`). An error the user must know about is shown in the UI; an unexpected one reaches the error boundary.

## Tests

- Tests are colocated with the file they test, named `<file>.test.ts` or `<file>.test.tsx`, one test file per source file.
- The test shape of `.claude/rules/python.md` **Tests** applies in full, with these forms: the act is one call of the real code; only the network is mocked, through MSW; our own modules, hooks and the API client are never mocked with `vi.mock`; a test file defines no functions other than its tests, and shared setup lives in the Vitest setup file or in `test.each`; a definition (a union, a constant, a schema's fields) is never the subject of a test.
- Tests run under Vitest in jsdom.
- Test section markers are `// arrange`, `// act`, `// assert` and `// act / assert`.
