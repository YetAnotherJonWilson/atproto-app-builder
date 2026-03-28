# Spec: Clean Up Unused Fonts and SVG Filters

**Status:** ready
**Date:** 2026-03-15

## What
Remove unused font declarations, font files, and SVG filter definitions that are no longer applied anywhere in the codebase.

## Why
The codebase carries dead weight from earlier design iterations: three font families that are loaded but never referenced in CSS, and two SVG displacement-map filters that are defined in HTML but never applied. Removing them reduces page load size and eliminates confusion about what's actively used.

## Acceptance Criteria
- [ ] The `djgross`, `bilbo-swash`, and `bilbo-regular` `@font-face` declarations are removed from `styles.css`
- [ ] The corresponding font files are deleted from `fonts/`
- [ ] The `paint-roughen` and `paint-roughen-heavy` SVG filter definitions are removed from `index.html`
- [ ] The `dirty-ego` and `fira-sans` fonts remain intact and functional
- [ ] The header logo SVG (which uses an inline `font-family` reference to `dirty-ego`) still renders correctly
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Visual spot-check confirms no regressions on the landing page or wizard

## Scope
**In scope:**
- Remove `@font-face` declarations for `djgross`, `bilbo-swash`, `bilbo-regular`
- Delete font files: `fonts/DJ-Gross/`, `fonts/bilbo/`
- Remove the `<svg>` block containing `#paint-roughen` and `#paint-roughen-heavy` filter definitions from `index.html`

**Out of scope:**
- Any changes to the landing page content or layout
- Any changes to the header design or dirty-ego font usage
- Step 1 page changes (still under consideration)
- Wizard redesign / mockup 3b implementation

## Files Likely Affected
- `styles.css` — remove three `@font-face` blocks
- `index.html` — remove the SVG `<defs>` filter block (lines ~420-465)
- `fonts/DJ-Gross/` — delete directory
- `fonts/bilbo/` — delete directory

## Edge Cases
- Confirm no JS or inline styles reference `djgross`, `bilbo-swash`, `bilbo-regular`, `paint-roughen`, or `paint-roughen-heavy` before deleting
- The logo SVG in `index.html` references `font-family="'dirty-ego'"` inline — this must NOT be affected

## How to Verify
1. Run `npm run build` — should compile without errors
2. Run `npx vitest run` — all tests pass
3. Open the app in a browser:
   - Landing page renders correctly with header logo and dirty-ego title
   - Navigate into the wizard — header scales down, no visual regressions
   - No console errors related to missing fonts or filters
