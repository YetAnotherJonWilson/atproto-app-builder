# Spec: Light Theme and Theme Switcher

**Status:** draft
**Date:** 2026-04-02

## What

Add a light color theme alongside the existing dark theme, and a toggle for users to switch between them. Respect the user's OS preference (`prefers-color-scheme`) as the default.

## Why

The app is currently dark-only. A light theme improves accessibility, readability in bright environments, and accommodates user preference.

## Acceptance Criteria

- [ ] A light theme is defined using the existing CSS custom property system
  - All color tokens in `styles/_tokens.css` have light-theme counterparts.
  - The light palette is visually cohesive — not just inverted values.

- [ ] A theme switcher toggle is available in the UI
  - The toggle is in the header area, always accessible.
  - Options: Light / Dark / System (follows OS preference).
  - The selected theme is persisted in `localStorage` and restored on reload.

- [ ] The default theme follows the user's OS `prefers-color-scheme` setting
  - If no preference is stored in `localStorage`, the app uses the OS setting.
  - If the OS setting changes while the app is open and the user hasn't manually chosen, the theme updates live.

- [ ] All existing UI components look correct in both themes
  - No hardcoded colors outside the token system that break in light mode.
  - Shadows, borders, and glows are adjusted for light backgrounds.

## Scope

**In scope:**
- Light theme color tokens
- Theme toggle UI
- `localStorage` persistence
- `prefers-color-scheme` media query integration
- Auditing existing styles for hardcoded colors

**Out of scope:**
- Theming for generated apps (separate concern)
- Custom/user-defined themes beyond light and dark
- Changing the existing dark theme colors

## Files Likely Affected

- `styles/_tokens.css` — light theme custom properties
- `src/app/` — theme switcher component and localStorage logic
- `styles/header.css` — toggle placement

## Ambiguity Warnings

1. **Toggle placement and design**
   Where exactly in the header should the toggle go, and what form should it take (icon button, segmented control, dropdown)?
   - _Likely assumption:_ A small icon button (sun/moon) in the header right side, with a click cycling through Light → Dark → System.
   - _Please confirm or clarify._

2. **Light theme palette**
   Should the light theme maintain the same accent color (`#00e5ff` cyan) or shift to a darker accent that has better contrast on light backgrounds?
   - _Likely assumption:_ Adjust the accent for WCAG contrast on light backgrounds while keeping the same hue family.
   - _Please confirm or clarify._

## How to Verify

1. Toggle between light, dark, and system modes — verify each applies correctly.
2. Reload the page — verify the last selected theme persists.
3. Change OS dark mode setting with "System" selected — verify the app follows.
4. Navigate through all panels/dialogs — verify no visual glitches in either theme.
