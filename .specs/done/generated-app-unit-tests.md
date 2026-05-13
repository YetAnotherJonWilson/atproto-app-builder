# Spec: Unit Tests in Generated Apps

**Status:** draft
**Date:** 2026-04-13

## What

Extend the code generator so every generated app ships with a working
Vitest setup and a starter set of unit tests covering the parts of the
generated code that have testable logic (primarily `Store.ts` and
`Router.ts`, possibly `Api.ts`). Users who clone or export their
generated app can run `npm test` out of the box and get meaningful
coverage of the scaffolded code.

## Why

Generated apps today have no test setup at all — `package.json` lists
only `dev`/`build`/`preview` scripts, and no test files are emitted.
This leaves users with a scaffolded codebase they can't verify,
can't safely refactor, and can't extend with confidence. Adding a
baseline test harness plus a few representative tests gives users a
working example they can build on, and it doubles as a safety net for
the generator itself: if the generator emits broken code, its own
tests will fail.

## Scope decisions (resolved 2026-05-12)

- **Router tests deferred** to a follow-up spec (`generated-app-router-tests.md`). Reason: the emitted `Router.ts` is testable but every test path transitively imports view modules, which pulls in Inlay/Store/Auth — a fragile foundation for starter tests. Defer until view modules have a more isolated test posture (or accept that decision under a dedicated spec).
- **Store tests are generic, not data-model-aware.** v1 emits a subscribe/unsubscribe contract test only. Per-record-type tests deferred to a future iteration once the data-modeling hints spec lands.
- **Vitest config:** one global jsdom environment. Matches generated apps' DOM-heavy code (Router, UI).
- **Vitest version:** match the wizard's major (^4).
- **Smoke procedure:** documented manually, not automated (install + run is too slow for CI).

## Acceptance Criteria

- [ ] **`package.json` generation** — `generatePackageJson` emits a
  `test` script (`"test": "vitest run"`) and adds `vitest` and
  `jsdom` to `devDependencies` at pinned versions matching the
  wizard's own pins.

- [ ] **Vitest config** — a `vitest.config.ts` is emitted at the
  generated app's root, configured with `environment: 'jsdom'` and
  `include: ['tests/**/*.{test,spec}.ts']`.

- [ ] **Test directory layout** — tests live in `tests/` at the
  generated app's root. v1 emits `tests/store.test.ts` only.

- [ ] **Store tests (v1: generic)** — `tests/store.test.ts` covers the
  generic subscribe/unsubscribe contract:
  - `storeManager.subscribe(listener)` returns a function
  - The returned unsubscribe function executes without throwing
  - The default `Store` export is an object

- [ ] **Generator test coverage** — the wizard's own test suite
  (`tests/generator/`) gains assertions that the generator emits:
  `vitest.config.ts`, `tests/store.test.ts`, and that
  `package.json` includes the `test` script + `vitest` + `jsdom`
  devDeps. Emitted test file should parse (no syntax errors).

- [ ] **Smoke procedure documented** — this spec's "How to Verify"
  section includes the exact commands to generate an app, `npm
  install`, and `npm test` to confirm the emitted tests pass.

## Scope

**In scope:**
- Adding `vitest` + `jsdom` to the generated app's `package.json` (devDeps + `test` script)
- Emitting `vitest.config.ts` (global jsdom env)
- Emitting a generic Store subscribe-contract test (`tests/store.test.ts`)
- Wizard-side tests asserting these emissions
- Documenting the manual smoke procedure in this spec

**Out of scope:**
- Router tests (deferred — see `generated-app-router-tests.md`)
- Data-model-aware Store tests (per-record-type setter assertions)
- Tests for `Api.ts`, `Auth.ts`, `Session.ts` — network-bound, separate spec
- Integration / end-to-end tests for generated apps (Playwright etc.)
- Coverage reporting, CI config, or watch-mode tooling inside the
  generated app
- Tests for Inlay primitive rendering inside generated apps — owned
  by the primitive-expansion / template-components specs

## Files Likely Affected

- `src/generator/config/PackageJson.ts` — add `test` script + `vitest` + `jsdom` devDeps
- `src/generator/config/VitestConfig.ts` (new) — emit `vitest.config.ts`
- `src/generator/tests/StoreTest.ts` (new) — emit `tests/store.test.ts`
- `src/generator/index.ts` — wire the new emitters into the output
- `tests/generator/PackageJson.test.ts` — add devDep + script assertions
- `tests/generator/VitestConfig.test.ts` (new) — assert emitted config shape
- `tests/generator/StoreTest.test.ts` (new) — assert emitted store test

## Ambiguity Warnings

All five original ambiguity warnings (data-model awareness, jsdom scope, Vitest version, smoke automation, Router testability) were resolved on 2026-05-12 — see the "Scope decisions" section above.

## How to Verify

- `npm run verify` (= `npm run build` + `vitest run` + `playwright test`) passes.
- Wizard-side tests in `tests/generator/` cover that `package.json`, `vitest.config.ts`, and `tests/store.test.ts` are emitted with the expected shape.
- **Manual smoke procedure:**
  1. Run the wizard locally, create a minimal app (any name; at least one record type optional), generate the output.
  2. `cd` into the generated app directory.
  3. `npm install`
  4. `npm test`
  5. Expected: `tests/store.test.ts` runs and passes.
- TypeScript still compiles in the wizard after generator changes (`npm run build`).
