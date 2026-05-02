# Spec: Inlay component library — browse and preview

**Status:** draft
**Date:** 2026-05-01

## What
Add a way to browse all discovered Inlay components — independent of a specific wizard component — and preview each one rendered against sample data. Today, Inlay components are only surfaced through `showInlayComponentPicker`, which requires an existing wizard component with a `do` requirement and a published-NSID data type. There is no general-purpose browser, and there is no preview at all (the picker shows metadata only). This spec adds a Library surface (modal initially; could become a panel section later) reachable from the Components panel, listing each discovered Inlay component with its accepted data types, description, body type, and a live preview.

## Why

Two concrete needs:

1. **Discoverability.** A user designing an app may want to see what Inlay components exist before committing to a data model. The current attach-only flow means they only learn about a component once they've built a `do` requirement with a matching NSID.
2. **Preview parity with `know` components.** `know` components show a live Inlay preview on each card via `renderInlayPreviews()` at `ComponentsPanel.ts:1158`. Inlay-attached components, by contrast, only show "Inlay: `<short-name>`" — no rendering. Users have asked for the same kind of "see before you choose" preview when browsing.

## Acceptance Criteria

- [ ] **A "Browse Inlay components" entry point exists in the Components panel.**
  - A button labeled "Browse Inlay library" appears in the Components panel, placed inline with (or directly adjacent to) the "+ New Component" button. It uses the same `.add-btn` visual treatment but with a different leading icon (e.g. a bookshelf glyph or simply "📚" if no SVG exists yet — see Ambiguity #1).
  - Clicking it opens the Library modal.
  - The button is visible whenever the Components panel is rendered with at least one requirement (i.e., whenever the panel is in state B per the existing comment in `ComponentsPanel.ts:8`). It is hidden in the empty state (no requirements at all).

- [ ] **Library modal lists all discovered Inlay components grouped sensibly.**
  - On open, the modal calls `discoverInlayComponents()` (via `resolveInlayTemplateCached` cache where applicable for templates) and renders the result.
  - Components are grouped by `bodyType`: Templates first, then Primitives, then External (if any). Within each group they are sorted by NSID alphabetically.
  - Each list item shows:
    - NSID (monospace, prominent)
    - Author handle (`@handle`)
    - Description (if present in record)
    - "Accepts:" line showing accepted record-view collections (NSIDs as `<code>`) and primitive types (as plain text), or "no record-view accept" matching existing picker styling.
    - Body type label badge (Template / Primitive / External).
  - Discovery failures (per author) are listed at the bottom in a collapsed/inline section, matching the picker's pattern at `InlayComponentPickerDialog.ts:160`.
  - A close button (×) and Cancel button at the bottom dismiss the modal.

- [ ] **Each Library entry shows a live preview.**
  - For Template-body components whose `acceptsCollections` is non-empty, the modal attempts to render the template against a sample record. See Integration Boundaries below for the sample-record contract.
  - For Primitive-body components, the preview renders the primitive with placeholder content (e.g. paragraph: "Sample paragraph text"; heading: "Sample heading").
  - For External-body components, no preview is shown — instead a "Preview not available (external body)" hint.
  - Preview rendering uses `renderToDOM` from `src/inlay/host-runtime.ts` for primitives and the existing template-resolution + render path for templates.
  - If preview rendering fails (resolution error, render error), show a one-line error message in place of the preview (no stack traces). The list item itself stays clickable so the user can still inspect metadata.
  - Preview is rendered eagerly when the list item is rendered. (See Ambiguity #2 for whether to lazy-load on expand vs. render all up front.)

- [ ] **Library is read-only / browse-only.**
  - List items have no "Attach" button and no click-to-attach behavior. Browsing here does not modify wizard state.
  - This keeps the Library decoupled from the per-component attach flow, which already lives in `showInlayComponentPicker`. Users wanting to attach still go through the existing card-level "Attach Inlay component" button.

- [ ] **Library uses the existing dialog infrastructure.**
  - Mirrors the structure of `InlayComponentPickerDialog.ts`: a `<dialog>` element with `wizard-dialog` class, modal showing via `dialog.showModal()`, click-outside-to-close, ESC-to-close (browser default for `<dialog>`), and a close × button.

## Scope

**In scope:**
- New file: `src/app/dialogs/InlayLibraryDialog.ts` exporting `showInlayLibrary(): Promise<void>` (resolves on close — no return value since it doesn't attach).
- New "Browse Inlay library" button in `renderComponentsPanel()` and matching wiring in `wireComponentsPanel()`.
- Reuse `discoverInlayComponents` and `resolveInlayTemplateCached` — no new discovery logic.
- Sample-record provisioning helper (small, lives next to the dialog or in `src/inlay/sample-records.ts`).
- Styles for the library modal — extend or piggyback on existing `.inlay-picker-*` styles where they fit; new `.inlay-library-*` classes where they diverge (preview area, group headers).

**Out of scope:**
- Rich filtering / search inside the library (deferred — see Future Considerations).
- Editing or publishing components from the library.
- Adding Inlay components from the library to a wizard component (existing attach flow is the entry point for that).
- New discovery sources beyond `KNOWN_INLAY_AUTHORS`.
- Refactoring the existing picker dialog to share UI code (do that only if the duplication becomes painful — keep specs small).

## Files Likely Affected
- `src/app/dialogs/InlayLibraryDialog.ts` — new.
- `src/inlay/sample-records.ts` — new (small): hardcoded sample record blobs keyed by NSID for known templates we can preview, plus a fallback shape.
- `src/app/views/panels/ComponentsPanel.ts` — add Browse button + handler in `renderComponentsPanel`/`wireComponentsPanel`.
- `styles/workspace/components-panel.css` or a new `styles/workspace/inlay-library.css` — modal styles.
- `tests/inlay-library.test.ts` — light coverage for sample-record selection logic; UI behavior is best covered by a Playwright step.

## Integration Boundaries

### Inlay discovery
- **Data flowing in:** `discoverInlayComponents()` returns `InlayDiscoveryResult` (`{ components, failures }`) — same as the picker uses.
- **Data flowing out:** none.
- **Expected contract:** unchanged from picker.
- **Unavailability:** if discovery throws or returns empty `components`, render an empty-state message in the modal: "No Inlay components could be discovered. Check your network connection and try again." Failures list (per-author) renders the same way the picker shows them.

### Template resolution
- **Data flowing in:** `resolveInlayTemplateCached(uri)` returns the resolved template tree or an error.
- **Data flowing out:** none.
- **Expected contract:** existing.
- **Unavailability:** broken template → preview area shows "Template unavailable" inline; list item stays.

### Sample records
- **Data flowing in:** for templates, the dialog needs a sample record of the right collection NSID to bind into the template. Two options:
  - **Hardcoded fixtures.** Ship a small `sampleRecords` map keyed by well-known NSIDs (e.g. `app.bsky.feed.post`, `fm.teal.alpha.actor.status`). For unknown NSIDs, generate a stub from the template's expected fields if discoverable, otherwise show "No sample available — pick another component or attach to a real record".
  - **Network fetch.** Hit `public.api.bsky.app` or the source-of-truth PDS for an example record. Costlier, more fragile.
- **Data flowing out:** none (samples are consumed locally for rendering).
- **Expected contract:** the sample object's shape must match the template's expected `view` data so binding succeeds.
- **Unavailability:** missing sample → preview area shows "No sample available for `<NSID>`."

## Ambiguity Warnings

1. **Entry-point styling and exact placement.**
   Two reasonable placements: (a) a second `.add-btn` directly to the right of "+ New Component" with a separator, (b) a small text-link "Browse library" under the workspace description. The first is more discoverable; the second is less visually noisy.
   - _Likely assumption:_ Option (a) — second `.add-btn` to the right of "+ New Component". Both buttons share the existing `.add-btn` styling so they line up; we already shrink the new-component button in the prior CSS change.
   - _Please confirm or clarify._

2. **Preview eagerness.**
   Rendering every template preview eagerly means N parallel template resolutions on dialog open — possibly slow. Alternative: render metadata + a "Preview" button per row that loads on click.
   - _Likely assumption:_ Eager render with a per-row spinner; resolution is already cached via `resolveInlayTemplateCached`, and the discovery list is small (today: 2 known authors). Revisit if discovery grows beyond ~25 components or perceived latency becomes an issue.
   - _Please confirm or clarify._

3. **Sample record source.**
   Hardcoded fixtures are fast and offline-friendly; network samples are realistic but fragile. Templates we can't fixture for would have a degraded preview.
   - _Likely assumption:_ Start with hardcoded fixtures for the 2-3 NSIDs we already know (whatever the existing test fixtures cover, e.g. `fm.teal.alpha.actor.status` from the NowPlaying spec); fall back to "No sample available" with a hint to attach the component to a real `do` requirement to see it live. Avoid network samples in v1.
   - _Please confirm or clarify._

4. **Should the Library be a modal or a Components-panel sub-section?**
   A modal is simple and reuses dialog infrastructure. A panel section is more "browsable" — could live alongside the component grid, with previews always visible. The modal lines up with how the picker works today and keeps blast radius small; the panel-section idea is more ambitious and probably warrants its own spec.
   - _Likely assumption:_ Modal. Defer panel-section idea to a follow-up spec.
   - _Please confirm or clarify._

5. **What about Inlay components without an `acceptsCollections` entry?**
   Some components might be "global" UI primitives that don't bind to a record (banners, layouts, etc.). The current picker filters to `bodyType === 'template'` only.
   - _Likely assumption:_ Library shows all discovered components regardless of body type, grouped as described. Preview-rendering for non-template/non-primitive bodies shows a "Preview not available" placeholder.
   - _Please confirm or clarify._

## Behavioral Scenarios

**Scenario: Open Library and browse**
- Setup: Components panel rendered with at least one requirement. Network reachable.
- Action: User clicks "Browse Inlay library".
- Expected outcome: Modal opens, briefly shows a "Loading components…" placeholder, then renders a grouped list of all discovered Inlay components with metadata and previews. Pressing ESC or clicking × closes the modal.

**Scenario: Library with discovery failure for one author**
- Setup: One of `KNOWN_INLAY_AUTHORS` is unreachable; the other returns components.
- Action: User opens the Library.
- Expected outcome: Components from the reachable author are listed normally. The unreachable author appears in a "Some authors failed:" list at the bottom of the modal with the error message.

**Scenario: Template preview renders successfully**
- Setup: Library open. A discovered template has `acceptsCollections: ['fm.teal.alpha.actor.status']` and a sample fixture exists for that NSID.
- Action: List item renders.
- Expected outcome: Preview area inside the list item shows the rendered template DOM populated with sample data. Visual fidelity matches what the user would see if they attached the component to a real record.

**Scenario: Template preview fails (broken resolution)**
- Setup: Template URI returns a resolution error from `resolveInlayTemplateCached`.
- Action: List item renders.
- Expected outcome: Preview area shows "Template unavailable" inline. Metadata still renders. Item remains in the list.

**Scenario: No sample record available**
- Setup: A template accepts an NSID for which we have no fixture.
- Action: List item renders.
- Expected outcome: Preview area shows "No sample available for `<NSID>`." Metadata still renders.

**Scenario: Empty discovery**
- Setup: All `KNOWN_INLAY_AUTHORS` return empty (or none configured).
- Action: User opens the Library.
- Expected outcome: Modal shows "No Inlay components could be discovered." Cancel/× still work.

**Scenario: Library does not modify wizard state**
- Setup: Library open with components listed.
- Action: User clicks anywhere inside a list item.
- Expected outcome: Nothing — no attach, no navigation. Only × and Cancel close the dialog.

## How to Verify

1. Manual:
   - Walk through each scenario in the running app (`npm run dev`).
   - Verify previews visually match what the same template renders inside an attached card.
   - Verify the Browse button does not appear when there are zero requirements.
2. Vitest:
   - Sample-record selector: given an NSID with a fixture, returns the fixture; given unknown NSID, returns null.
   - Failure-list rendering doesn't blow up when failures array is empty or large.
3. Playwright: a smoke step that opens the dialog and asserts at least one component item or the empty-state message is present (since real network discovery is flaky in CI, this may need a stubbed discovery — see existing test patterns for how the picker is exercised).
4. `npm run verify` must pass.

## Future Considerations (non-binding)

- Search / filter input inside the modal (by NSID, author, accepted collection).
- "Attach this" button per row (would couple Library to the components panel state — non-trivial, needs UX thought about which wizard component receives the attachment).
- Promote the modal to a Components-panel sub-section once the data model and rendering are stable.
- Author trust / curation surface (e.g. flagging unknown authors).
