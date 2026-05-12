# Spec: Generated App — CSS Custom Properties for Colors and Radii

**Status:** draft
**Date:** 2026-04-27

## What

Refactor `src/generator/templates/Styles.ts` so that all hardcoded color
hex values and border-radius pixel values are declared once as CSS custom
properties in a single `:root { ... }` block, then referenced via
`var(--token-name)` throughout the rest of the stylesheet. No second
theme, no theme picker, no user-facing change — just one default theme
defined via tokens.

## Why

The generated app's CSS is currently a flat string of literal hex colors
and inline radius values. Adding a second theme today means hand-finding
~10 distinct colors across ~350 lines of CSS and editing each in place,
hoping not to miss any. With tokens, adding a theme becomes "override
these ~15 variables" — a much smaller, lower-risk task.

This is groundwork for an eventual theming feature. Doing it now, before
any theming work begins, makes the future theming spec smaller and
keeps the change isolated to a single mechanical pass.

## Acceptance Criteria

- [ ] Every color literal (hex, rgb, named) in `Styles.ts` is replaced
      with a `var(--token-name)` reference.
- [ ] Every border-radius pixel value (`3px`, `5px`, `8px`, `10px`) is
      replaced with a `var(--radius-*)` reference. The `50%` value used
      for the spinner stays inline (it's a shape, not a token).
- [ ] A single `:root { ... }` block at the top of the generated CSS
      defines every token used.
- [ ] Token names are semantic, not numeric. Use names like
      `--color-bg`, `--color-surface`, `--color-text`,
      `--color-text-muted`, `--color-accent`, `--color-accent-hover`,
      `--color-danger`, `--color-danger-hover`, `--color-info-bg`,
      `--color-info-text`, `--color-error-bg`, `--color-error-text`,
      `--color-border`, `--color-border-subtle`, `--radius-sm` (3px),
      `--radius-md` (5px), `--radius-lg` (8px), `--radius-xl` (10px).
- [ ] Visual output of generated apps is unchanged. Token values
      reproduce the current literals exactly. Verified by the e2e smoke
      test passing and by spot-checking a generated app in the browser.
- [ ] Spacing values (margins, paddings, gaps) are NOT tokenized in this
      spec — see Out of Scope.

## Scope

**In scope:**

- `src/generator/templates/Styles.ts` — extract colors and border-radii
  to `:root` custom properties; replace literals with `var(--*)`.

**Out of scope:**

- Tokenizing spacing values (margins, paddings, gaps). The spacing
  system in the generated CSS is inconsistent enough that tokenizing it
  deserves its own pass. Border-radius (which has a clear small/medium/
  large/xlarge scale) is the only non-color group included.
- Adding a second theme or any theme-switching mechanism.
- Touching the wizard's own stylesheets (`styles.css`,
  `styles/inlay-primitives.css`, `styles/_tokens.css`). This spec is
  about the **generated app** only.
- Changing any visual values. The refactor is value-preserving.

## Files Likely Affected

- `src/generator/templates/Styles.ts` — primary file under change.
- `tests/generator/` — update any tests that assert on raw hex values
  in the generated CSS, if such assertions exist.

## Ambiguity Warnings

1. **Token naming convention**
   The criteria propose semantic names (`--color-accent`, `--radius-md`).
   Other valid choices: numeric scales (`--color-gray-100`), or the
   convention used by the wizard's own `styles/_tokens.css`.
   - _Likely assumption:_ Use semantic names. They survive theme swaps
     (an "accent" stays an accent in any theme; a numeric scale doesn't
     translate cleanly).
   - _Please confirm or clarify, especially whether you want this to
     align with the wizard's existing `_tokens.css` naming._

2. **`#f5f5f5` is used for two different roles**
   The body background, the user-info panel background, and the nav-menu
   container background all use `#f5f5f5`. Are they all the same token,
   or should they be distinct tokens that happen to share a value today?
   - _Likely assumption:_ One shared token (`--color-bg`). If a future
     theme needs them to diverge, that's a follow-up split.
   - _Please confirm or clarify._

## How to Verify

1. `npm run verify` — build, vitest, and the e2e smoke test all pass.
2. Generate a sample app via the wizard, open in a browser, and confirm
   the rendering is visually identical to a generation done before this
   refactor (sidebar, buttons, list items, forms, status messages).
3. In the generated CSS, confirm one `:root { ... }` block exists at the
   top and no hex color literals or `Npx` radius literals appear below
   it — only `var(--*)` references.
