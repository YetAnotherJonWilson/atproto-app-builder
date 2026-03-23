# Spec: App Config Placement

**Status:** draft
**Date:** 2026-03-22
**Depends on:** Views Panel (Phase 5)

## What

Determine where App Config settings (primary record type, list display fields, output method) are captured in the new sidebar + workspace layout. Currently these fields exist on `WizardState.appConfig` but have no UI since the deprecated Step 6 was removed.

## Why

The layout migration spec (`.specs/active/layout-migration-sidebar-workspace.md`) raises this as an open design question. The old wizard captured these in Step 6; the new layout needs a home for them. Candidates include: part of the Generate flow (Phase 6), a settings panel, or a sub-section of the Views panel.

## Scope

**In scope:**
- Deciding where App Config UI lives in the new layout
- Designing and implementing that UI
- Full behavioral detail TBD

**Out of scope:**
- Changes to the `AppConfig` type itself (unless needed by the chosen placement)
- Views panel (prerequisite, separate spec)
