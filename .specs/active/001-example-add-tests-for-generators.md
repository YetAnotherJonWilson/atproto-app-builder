# Spec: Add unit tests for remaining generator modules

**Status:** ready
**Date:** 2026-03-05

## What
Add Vitest unit tests for the generator modules that produce output app files:
ViteConfig, TsConfig, IndexHtml, Styles, Lexicon, and AppEntry.

## Why
The generator is the core value of this app — it produces the code users download.
Bugs in generator output mean broken apps for users. These are pure functions that
take WizardState data and return strings, making them ideal test targets.

## Acceptance Criteria
- [ ] Each generator module has at least 3 tests covering: valid output, edge cases, empty/missing inputs
- [ ] All tests pass with `npx vitest run`
- [ ] Tests use realistic WizardState fixtures (shared test helper)

## Scope
**In scope:**
- Unit tests for each file in `src/generator/config/` and `src/generator/templates/`
- A shared test fixture file with sample WizardState data

**Out of scope:**
- Tests for the wizard UI (steps, dialogs, navigation)
- E2E / browser tests
- Refactoring generator code

## Files Likely Affected
- `tests/generator/ViteConfig.test.ts` (new)
- `tests/generator/TsConfig.test.ts` (new)
- `tests/generator/IndexHtml.test.ts` (new)
- `tests/generator/Styles.test.ts` (new)
- `tests/generator/Lexicon.test.ts` (new)
- `tests/fixtures/wizardState.ts` (new — shared test data)

## Edge Cases
- Empty appName / domain
- RecordTypes with no fields
- Special characters in user-provided names

## How to Verify
Run `npx vitest run` — all tests should pass.
