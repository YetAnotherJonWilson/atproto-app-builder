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

## Acceptance Criteria

- [ ] **`package.json` generation** — `generatePackageJson` emits a
  `test` script (`"test": "vitest run"`) and adds `vitest` to
  `devDependencies` at a pinned version.

- [ ] **Vitest config** — a `vitest.config.ts` (or equivalent) is
  emitted at the generated app's root, configured for the environment
  the generated app runs in (jsdom for DOM-touching code).

- [ ] **Test directory layout** — tests live in `tests/` at the
  generated app's root, mirroring `src/` structure
  (`tests/store.test.ts`, `tests/router.test.ts`, etc.).

- [ ] **Store tests** — cover the state mutation and subscription
  surface of the generated `Store.ts`:
  - initial state matches the shape declared by the wizard's data model
  - setters/updaters produce the expected next state
  - subscribers fire when (and only when) state changes

- [ ] **Router tests** — cover route matching and navigation in the
  generated `Router.ts`:
  - a known path resolves to the expected view
  - an unknown path resolves to the not-found view (or whatever the
    current Router does)
  - navigation updates whatever state/history the Router owns

- [ ] **Generator test coverage** — the wizard's own test suite
  (`tests/generator/`) gains a test that runs the generator for a
  representative `WizardState`, then asserts the produced
  `package.json`, `vitest.config.ts`, and test files are present and
  well-formed (parseable, importable).

- [ ] **Smoke test** — there is a way (documented or scripted) to take
  a generated app, `npm install`, `npm test`, and observe that the
  emitted tests pass. This catches divergence between the generator's
  idea of the code and the real emitted code.

## Scope

**In scope:**
- Adding Vitest to the generated app's `package.json`
- Emitting a Vitest config file
- Emitting starter tests for `Store.ts` and `Router.ts`
- A wizard-side test that asserts the test files are emitted
- Documenting how to run the generated app's tests

**Out of scope:**
- Tests for `Api.ts`, `Auth.ts`, `Session.ts` — these are
  network-bound and need a mocking strategy that deserves its own
  spec
- Integration / end-to-end tests for generated apps (Playwright etc.)
- Coverage reporting, CI config, or watch-mode tooling inside the
  generated app
- Tests for Inlay primitive rendering inside generated apps — owned
  by the primitive-expansion / template-components specs

## Files Likely Affected

- `src/generator/config/PackageJson.ts` — add `test` script, add
  `vitest` to devDependencies
- `src/generator/config/` — new file emitting `vitest.config.ts`
- `src/generator/tests/` (new) — test-file emitters for store, router
- `src/generator/index.ts` — wire the new emitters into the output
  bundle
- `tests/generator/` — new wizard-side test asserting the generator
  produces a well-formed test setup

## Ambiguity Warnings

1. **How data-model-aware should Store tests be?**
   The generated Store is shaped by the wizard's data model (record
   types, fields). Should emitted Store tests be generic (assert the
   store exists and responds to a dummy set/subscribe cycle) or
   tailored to the specific data model the user picked (assert that
   adding a record of the user's chosen type produces the expected
   state)?
   - _Likely assumption:_ Start generic — one test that exercises the
     store's core subscribe/update contract without referencing
     user-specific record types. Tailored tests can come in a later
     spec once the data-modeling hints spec lands.
   - _Please confirm or clarify._

2. **Vitest config environment**
   Parts of the generated app touch the DOM (`UI.ts`, Router). Tests
   for those need jsdom; Store tests don't. Should the generator emit
   one config with jsdom globally, or split per-file with
   `@vitest-environment` comments?
   - _Likely assumption:_ One global jsdom config. Simpler, slightly
     slower, matches how the wizard's own tests are set up.
   - _Please confirm or clarify._

3. **Vitest version pinning**
   The wizard's own `package.json` uses Vitest 4.x. Should generated
   apps pin the same major, or a more conservative minimum?
   - _Likely assumption:_ Match the wizard's major version for
     consistency.
   - _Please confirm or clarify._

4. **Smoke-test automation**
   The "install + test a generated app" smoke test is high-value but
   slow (real `npm install`). Should this run in the wizard's normal
   `npx vitest run` path, be a separate script (`npm run smoke`), or
   stay manual for now?
   - _Likely assumption:_ Separate script, not part of the default
     test run, because of install cost. Document how to run it.
   - _Please confirm or clarify._

5. **Router testability**
   Depends on whether the generated `Router.ts` currently exposes its
   route table in a way that's unit-testable, or whether routing is
   entangled with `window.location` and DOM side effects. If the
   latter, this spec may need a small refactor of the emitted Router
   to make it testable — which arguably belongs in a separate spec.
   - _Likely assumption:_ Read `src/generator/app/Router.ts` before
     finalizing this spec and either (a) confirm it's unit-testable
     as-is, or (b) split the refactor into its own prerequisite spec.
   - _Please confirm or clarify._

## How to Verify

- `npx vitest run tests/generator/` — wizard-side test asserting the
  generator emits the test harness passes.
- Manually: generate an app, `cd` into it, `npm install`, `npm test` —
  all emitted tests pass.
- `npm run build` in the wizard — TypeScript still compiles after
  generator changes.
