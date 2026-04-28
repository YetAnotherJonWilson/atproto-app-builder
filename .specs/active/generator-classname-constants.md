# Spec: Generator — Shared Class-Name Constants Module

**Status:** draft
**Date:** 2026-04-27

## What

Today, CSS class names like `list-item`, `button-group`, and
`nav-menu-item` appear as bare string literals in two places: the
generated CSS (`src/generator/templates/Styles.ts`, where they're
selectors) and the component generators (where they're assigned to
`element.className` in emitted code). Nothing connects the two — if you
rename one, the other silently breaks.

Extract every class name that appears in **both** layers into a single
constants module (proposed: `src/generator/templates/classNames.ts`) and
have both `Styles.ts` and the component generators import from it.

## Why

The duplication creates two coupled risks:

- **Silent breakage on rename.** Renaming a class name in `Styles.ts`
  doesn't break the build — it just makes the corresponding generated
  app render unstyled, with no error anywhere.
- **Theming friction.** Any future theming work that wants to vary class
  structure (e.g. introduce a `list-item--compact` variant, or rename
  `button-group` to something more specific) has to touch both layers
  in lockstep.

A shared constants module makes the linkage explicit: rename the
constant, both sides update, TypeScript catches the cases where the
constant is no longer imported.

## Acceptance Criteria

- [ ] A new module `src/generator/templates/classNames.ts` exports a
      constant for every CSS class name that appears in **both**
      `Styles.ts` and at least one component generator.
- [ ] Each constant is a `const` string declared with `as const` so
      TypeScript treats it as a literal type (not just `string`).
- [ ] `Styles.ts` imports from the constants module and interpolates the
      constants into its CSS selectors. No bare class-name string
      literal that's also referenced by a generator remains in
      `Styles.ts`.
- [ ] Each component generator imports from the constants module and
      uses the constant when assigning `className` on emitted elements.
      No bare class-name string literal for a shared class remains in
      these files.
- [ ] The constants module covers _at minimum_ every class name found
      in both layers. Based on a `git grep` audit at spec-write time,
      that set is: `list-item`, `list-container`, `button-group`,
      `nav-menu`, `nav-menu-item`, `tags-container`, `tag`, `no-data`,
      `field-group`, `field-label`, `field-value`, `detail-container`,
      `form-container`, `checkbox-label`, `view-empty`, `app-component`,
      `app-component-placeholder`, `placeholder-type`,
      `placeholder-requirements`. The implementer should re-verify this
      list against the current source — anything new should be included,
      anything no longer dual-referenced can be skipped.
- [ ] Class names that appear in only one layer (e.g. `.spinner`,
      `.status` and its modifiers in `Styles.ts` only; `inlay-root` in
      generators only) are NOT moved into the constants module — see
      Scope.
- [ ] Generated CSS and generated app HTML/JS are byte-equivalent to
      the pre-refactor output. Existing generator tests pass without
      snapshot changes.

## Scope

**In scope:**

- New file `src/generator/templates/classNames.ts`.
- Updates to `Styles.ts` and the component generators
  (`NavMenu.ts`, `RecordList.ts`, `RecordDetail.ts`, `RecordForm.ts`,
  `Placeholder.ts`, `views/ViewPage.ts`) to consume those constants.
- Updates to any tests in `tests/generator/` that assert on the literal
  class-name strings, switching them to import from the same constants
  module.

**Out of scope:**

- Centralizing class names that appear in only one layer. The point is
  removing the duplication, not creating a comprehensive registry.
- Renaming any existing classes. Constants capture current names as-is.
- Restructuring CSS selectors (combinators, specificity, nesting).
- Type-level guarantees beyond `as const` literal types. No branded
  types, no class-name-builder DSL, no compile-time check that every
  CSS selector has a corresponding generator usage.
- The wizard's own stylesheets and components.

## Files Likely Affected

- `src/generator/templates/classNames.ts` — **new file**.
- `src/generator/templates/Styles.ts` — interpolate constants into CSS
  selectors.
- `src/generator/components/NavMenu.ts` — uses `nav-menu`,
  `nav-menu-item`.
- `src/generator/components/RecordList.ts` — uses `list-container`,
  `list-item`, `tags-container`, `tag`, `no-data`, `button-group`.
- `src/generator/components/RecordDetail.ts` — uses `detail-container`,
  `field-group`, `field-label`, `field-value`, `button-group`.
- `src/generator/components/RecordForm.ts` — uses `form-container`,
  `button-group`, `checkbox-label`.
- `src/generator/components/Placeholder.ts` — uses
  `app-component-placeholder`, `placeholder-type`,
  `placeholder-requirements` (verify at implementation time).
- `src/generator/views/ViewPage.ts` — uses `view-empty`, `app-component`,
  `app-component-placeholder`.
- `tests/generator/*.test.ts` — update assertions that use the literal
  class-name strings.

## Ambiguity Warnings

1. **Constant naming**
   Should the constants be `LIST_ITEM = 'list-item'` (SCREAMING_SNAKE)
   or `listItem = 'list-item'` (camelCase)? Both work; the project's
   existing TypeScript style leans camelCase for module exports.
   - _Likely assumption:_ camelCase, exported individually
     (`export const listItem = 'list-item' as const`).
   - _Alternative:_ A single object export
     (`export const cn = { listItem: 'list-item', ... } as const`),
     which gives a single import line at the call site.
   - _Please confirm or clarify._

2. **Composite className strings**
   `ViewPage.ts` emits `'app-component inlay-root'` — a space-separated
   pair. How should that look once `app-component` is a constant?
   - _Likely assumption:_ String interpolation:
     `` `${cn.appComponent} inlay-root` ``. `inlay-root` is single-side
     and stays inline.
   - _Please confirm or clarify._

3. **Test-side coupling**
   If a generator test asserts that the emitted code contains the
   literal `'list-item'`, switching the assertion to use the imported
   constant means the test no longer catches a regression where
   _both_ the constant and the generator are renamed in sync but the
   resulting class name no longer matches the CSS selector.
   - _Likely assumption:_ Accept this. The byte-equivalence check
     against pre-refactor output, plus the e2e smoke test rendering a
     real generated app, both catch unstyled output.
   - _Please confirm or clarify._

## How to Verify

1. `npm run verify` — build, vitest, and the e2e smoke test all pass.
2. `git grep "'list-item'\|'button-group'\|'nav-menu-item'" src/generator/`
   returns only matches inside the constants module.
3. Generate a sample app via the wizard, open in a browser, confirm the
   rendering is visually unchanged.
4. Try renaming one of the constants to an obviously wrong value (e.g.
   `listItem = 'list-item-XXX'`), regenerate, confirm both the CSS
   selector and the emitted className update — proving both sides are
   actually wired to the constant.
