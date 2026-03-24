# Spec: Block-to-Component Rendering (Generator Phase 3)

**Status:** draft
**Date:** 2026-03-23

## What

Replace placeholder block rendering with real, functional components for each `blockType`. Menu blocks already render as working NavMenu components (done in generator-view-driven-pages spec). This spec covers the remaining block types: `list`, `form`, `detail`, `table`, `card`, and `text`.

## Why

The generator currently renders all non-menu blocks as placeholder sections with dashed borders and requirement summaries. Users expect the generated app to include functional starting points — a list that actually fetches and displays records, a form that creates them, etc. The existing RecordList, RecordForm, and RecordDetail generator source files (in `src/generator/components/`) were preserved during the Phase 1 restructure specifically for this purpose.

## Key Work Items

- Implement real components for `blockType` values:
  - `list` → RecordList (adapt existing `src/generator/components/RecordList.ts`)
  - `form` → RecordForm (adapt existing `src/generator/components/RecordForm.ts`)
  - `detail` → RecordDetail (adapt existing `src/generator/components/RecordDetail.ts`)
  - `table` → RecordTable (new)
  - `card` → RecordCard (new)
  - `text` → TextSection (new — render `know` requirement text/content as static HTML)
- Wire each component to the specific record type referenced by the block's `do` requirement `dataTypeId`
- Support multi-record-type apps: different blocks on the same view can reference different record types
- Add a `blockType` selector to the full block creation/edit form (Blocks panel)
- Support changing a block's `blockType` after creation

## Prior Work

- Spec: `.specs/done/generator-view-driven-pages.md` — established the view-driven page architecture, `blockType` field, NavMenu component, placeholder rendering, and folder structure
- Existing generator source files preserved for adaptation: `src/generator/components/RecordList.ts`, `RecordDetail.ts`, `RecordForm.ts`

## Scope

**In scope:**
- Real component generation for all `blockType` values
- Wiring blocks to record types via `dataTypeId`
- `blockType` selector in block creation/edit form
- Changing `blockType` after creation

**Out of scope:**
- Navigation components beyond menu (direct links, forward/back) — separate spec
- Custom styling per block — future enhancement

## Files Likely Affected

- `src/generator/components/RecordList.ts` — adapt for block-driven usage
- `src/generator/components/RecordDetail.ts` — adapt for block-driven usage
- `src/generator/components/RecordForm.ts` — adapt for block-driven usage
- `src/generator/components/Placeholder.ts` — reduce to only handle `undefined` blockType
- `src/generator/views/ViewPage.ts` — import and call real components instead of placeholders
- `src/generator/index.ts` — generate component files for typed blocks
- `src/app/views/panels/BlocksPanel.ts` — add blockType selector to full form

## How to Verify

1. Create blocks with various `blockType` values targeting different record types
2. Generate the app and verify real components render (list fetches data, form submits, etc.)
3. Verify multi-record-type support: two list blocks on the same page targeting different record types
4. Verify `blockType` can be set and changed via the block edit form
