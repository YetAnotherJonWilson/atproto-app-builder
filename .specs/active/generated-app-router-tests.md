# Spec: Router tests for generated apps

**Status:** stub (deferred from `generated-app-unit-tests.md` on 2026-05-12)
**Date:** 2026-05-12

## What

Add a generated `tests/router.test.ts` to every generated app, covering the basic navigation contract on the emitted `Router` class.

## Why

The Vitest harness + Store contract test landed under `generated-app-unit-tests.md` on 2026-05-12, but Router tests were deferred. The emitted `Router.ts` is testable as-is for starter scope (instantiation against a mounted `#appContent`, `getActiveViewId`, navigate behavior), but every test path transitively imports view modules — which pulls in Inlay/Store/Auth. That dependency chain is fragile for starter tests until view modules have a more isolated test posture, or we accept the chain explicitly under this spec.

## Acceptance Criteria

- [ ] `tests/router.test.ts` is emitted at the generated app's root
- [ ] Test asserts a `Router` can be instantiated when `#appContent` is mounted
- [ ] Test asserts `getActiveViewId()` returns `null` before any navigation
- [ ] Test asserts `navigate(unknownId)` does not throw and sets `activeViewId`
- [ ] Test asserts `navigate(knownId)` mutates `container.innerHTML` and updates `activeViewId`
- [ ] Wizard-side test asserts the generator emits `tests/router.test.ts` and the file references the expected `Router` API surface
- [ ] Manual smoke procedure (per `generated-app-unit-tests.md`) confirms emitted tests run in a real generated app

## Open questions

- How to handle the case where the generated app has zero views (no view modules to import). Likely emit a minimal test that just constructs the Router with an empty map, or skip emission entirely.
- Whether view modules' import-time side effects (env reads, etc.) blow up the test. If so, this spec may need a small refactor to the generated Router (e.g., accept the views map via constructor injection) — that refactor would then live in this spec's scope.

## Out of scope

- Data-model-aware Store tests (separate future iteration)
- Tests for `Api.ts`, `Auth.ts`, `Session.ts` (network-bound, separate spec)
