# Spec: Requirements Navigation Wiring

**Status:** draft
**Date:** 2026-03-22
**Depends on:** Views Panel (Phase 5)

## What

Wire up the currently disabled navigation dropdowns and checkbox lists in the Requirements panel to use the views list from WizardState. This includes populating `fromView`/`toView` selects, the `menuItems` and `menuVisibleOn` checkbox lists, and the `pageOrder` reorder list. Additionally, add an "Include all views" option to the Navigation Menu subtype so users can create a menu that automatically stays in sync with the views list.

## Why

The navigation-subtypes spec (`.specs/done/navigation-subtypes.md`) rendered the navigate sub-forms as disabled placeholders because no views existed yet. Once the Views panel is complete and `views` is available on WizardState, these controls should be populated and functional so users can fully define navigation requirements.

The "Include all views" option for menus addresses a common pattern: most apps want a nav menu linking to every page. Rather than requiring users to manually update the menu every time they add or rename a view, this option keeps the menu in sync automatically. The existing form note already says "By default, every view gets a navigation menu linking to all other views" — this feature delivers on that promise.

## Data Model Changes

### Requirement (modified)

Add one field to the `Requirement` interface in `src/types/wizard.ts`:

```typescript
// navigate — menu
menuIncludeAllViews?: boolean;  // NEW: when true, menuItems is derived from wizardState.views
menuItems?: string[];           // existing: manually selected view IDs (used when menuIncludeAllViews is false)
menuVisibleOn?: string[];       // existing: view IDs where this menu appears
```

**Default behavior:** When a user creates a new Navigation Menu requirement, `menuIncludeAllViews` defaults to `true`. The user can uncheck it to manually select which views appear in the menu.

## UI Changes

### Direct Link sub-form

Replace the disabled placeholder dropdowns with populated `<select>` elements:

- **From View:** `<select>` populated with all view names from `wizardState.views`. Default: empty/prompt ("Select a view").
- **To View:** Same as From View.
- Both are required for save.

### Navigation Menu sub-form

**"Include all views" toggle:**

```html
<div class="form-group">
  <label class="checkbox-label">
    <input type="checkbox" id="menu-include-all-views" checked>
    Include all views
  </label>
  <div class="form-hint">
    Menu items will automatically update when views are added, removed, or renamed.
  </div>
</div>
```

**When "Include all views" is checked (default):**
- The "Menu Items" checkbox list is hidden — no need to manually select views.
- A read-only preview shows the current views that will be included, e.g.: "Currently: Home, Profile, Settings"
- `menuItems` is not stored on the requirement — it is derived from `wizardState.views` at render time and during code generation.

**When "Include all views" is unchecked:**
- The "Menu Items" checkbox list appears, populated with all views from `wizardState.views`.
- Each view is a checkbox item. The user checks which views to include in the menu.
- Checked views are stored in `menuItems` as an array of view IDs.
- At least one view must be selected for save to be enabled.

**"Show Menu On" section** (applies regardless of the toggle above):

```html
<div class="form-group">
  <label>Show Menu On</label>
  <div class="form-hint">Which views should display this menu?</div>
  <!-- checkbox list of all views -->
</div>
```

- All views listed as checkboxes. All checked by default when creating a new menu.
- Checked views are stored in `menuVisibleOn` as an array of view IDs.
- At least one must be selected for save.

**Note:** "Show Menu On" determines which views the menu *appears on* (i.e., which views the Nav Menu block should be assigned to). "Menu Items" / "Include all views" determines which views the menu *links to*. These are independent — a menu on the Home page could link to Profile and Settings but not to Home itself (though it could).

### Forward/Back sub-form

- **Page Order:** Reorder list populated with all view names from `wizardState.views`. Uses up/down buttons (same pattern as block card reorder).
- **Control Type:** Dropdown with "Arrows" / "Buttons" (already rendered, just needs to be enabled).
- **Button text fields:** Shown when "Buttons" is selected (already rendered).

### Saving navigate requirements

Currently, the save function returns `null` for navigate requirements. This spec enables saving:

- **Direct Link:** Save when `fromView` and `toView` are both selected.
- **Navigation Menu:** Save when `menuIncludeAllViews` is true (no further validation needed for items), OR when at least one `menuItem` is manually selected. At least one `menuVisibleOn` must be selected.
- **Forward/Back:** Save when `pageOrder` contains at least one view and `navControlType` is selected.

## Acceptance Criteria

- [ ] Direct Link dropdowns are populated with views
  - When the user selects Navigate > Direct Link, the From View and To View dropdowns are populated with view names from `wizardState.views`.
  - Selecting both From and To enables the Save button.
  - Saved requirement stores `fromView` and `toView` as view IDs.
  - When views are renamed, the dropdown labels update on next render. Stored IDs remain stable.

- [ ] Navigation Menu supports "Include all views" toggle
  - When creating a new Navigation Menu requirement, "Include all views" is checked by default.
  - When checked, the Menu Items checkbox list is hidden. A read-only preview shows the current view names.
  - When unchecked, the Menu Items checkbox list appears with all views. The user manually selects which views to include.
  - The toggle state is stored as `menuIncludeAllViews` on the requirement.

- [ ] Navigation Menu "Include all views" auto-updates
  - When `menuIncludeAllViews` is true and the user adds, renames, or deletes a view (via the Views panel), the menu requirement's display text and sidebar text reflect the current views without any user action in the Requirements panel.
  - No data migration is needed when views change — the menu items are derived from `wizardState.views` at render time.

- [ ] Navigation Menu "Show Menu On" is populated with views
  - The "Show Menu On" checkbox list shows all views from `wizardState.views`.
  - All views are checked by default when creating a new menu.
  - The user can uncheck views to exclude them.
  - Checked views are stored in `menuVisibleOn`.

- [ ] Forward/Back sub-form is populated with views
  - The Page Order section shows all views from `wizardState.views` as a reorder list with up/down buttons.
  - The user can reorder views to define the page sequence.
  - The Control Type dropdown and button text fields are enabled and functional.
  - Saved requirement stores `pageOrder` as an array of view IDs, `navControlType`, and optional button text.

- [ ] Navigate requirements can be saved
  - The Save button is enabled when the subtype-specific validation passes (see "Saving navigate requirements" above).
  - Saved requirements appear in the requirements list with correct display text and sidebar text.
  - Editing a saved navigate requirement re-populates the sub-form with stored values.

- [ ] Display text updates for "Include all views" menus
  - Sidebar text for a menu with `menuIncludeAllViews: true` shows: "menu: all views"
  - Sidebar text for a menu with manual items shows: "menu: Home, Profile" (view names joined)
  - Display text on block cards follows the same pattern.

## Scope

**In scope:**
- Populating all view-referencing dropdowns and lists with data from `wizardState.views`
- `menuIncludeAllViews` field on Requirement and corresponding UI toggle
- Read-only view preview when "Include all views" is checked
- Manual menu item selection when "Include all views" is unchecked
- "Show Menu On" checkbox list
- Page Order reorder list for Forward/Back
- Enabling saving of navigate requirements (currently returns null)
- Display text and sidebar text updates for all nav subtypes
- Tests for new functionality

**Out of scope:**
- Views panel itself (prerequisite, separate spec)
- Changes to the View data model
- Auto-creating blocks or auto-assigning blocks to views (the user still creates a block from this requirement and places it on views manually)
- Drag-and-drop reordering of page order (using up/down buttons)

## Files Likely Affected

### Modified Files
- `src/types/wizard.ts` — Add `menuIncludeAllViews` field to `Requirement`
- `src/app/views/panels/RequirementsPanel.ts` — Replace placeholder sub-forms with functional forms, add "Include all views" toggle, enable saving
- `styles.css` or `styles/workspace/` — Checkbox list styles, read-only preview styles
- `tests/views/RequirementsPanel.test.ts` — Tests for nav wiring and "Include all views" behavior

## Resolved Design Decisions

1. **"Include all views" is opt-in at creation, default on.** New Navigation Menu requirements default to `menuIncludeAllViews: true`. The user can uncheck to customize. This matches the existing form note: "By default, every view gets a navigation menu linking to all other views."
2. **No auto-creation of blocks or views.** The "Include all views" option only affects what the menu *links to*. The user still manually creates a block from this requirement and assigns that block to views. This keeps the requirement → block → view pipeline clean.
3. **"Menu Items" vs "Show Menu On" are independent.** "Menu Items" (or "Include all views") controls which views appear as links in the menu. "Show Menu On" controls which views display the menu. A menu on the Home page could link to Profile and Settings but not include a link to Home itself.
4. **View references use IDs, not names.** All stored references (`fromView`, `toView`, `menuItems`, `menuVisibleOn`, `pageOrder`) use view IDs. Display renders view names by looking up the ID. If a view is deleted, stale IDs are filtered out during render (same pattern as blocks panel handling deleted requirements).

## Behavioral Scenarios

**Scenario 1: Creating a Navigation Menu with "Include all views"**
- Setup: Views exist: Home, Profile, Settings.
- Action: User creates a Navigate > Navigation Menu requirement. "Include all views" is checked by default. Preview shows "Currently: Home, Profile, Settings". User clicks Save.
- Expected outcome: Requirement saved with `menuIncludeAllViews: true`, no `menuItems` stored. Sidebar shows "menu: all views". Display text shows "menu: all views".

**Scenario 2: Auto-update when a view is added**
- Setup: Navigation Menu requirement exists with `menuIncludeAllViews: true`. Views: Home, Profile.
- Action: User goes to Views panel and creates a "Settings" view.
- Expected outcome: Without any action in the Requirements panel, the menu requirement's display now reflects 3 views. If the user edits the requirement, the preview shows "Currently: Home, Profile, Settings".

**Scenario 3: Switching to manual menu items**
- Setup: Navigation Menu requirement exists with `menuIncludeAllViews: true`. Views: Home, Profile, Settings.
- Action: User edits the menu requirement. Unchecks "Include all views". Checkbox list appears with all 3 views checked. User unchecks "Home" (the menu shouldn't link to itself on the Home page). Clicks Save.
- Expected outcome: Requirement saved with `menuIncludeAllViews: false`, `menuItems: [profileId, settingsId]`. Sidebar shows "menu: Profile, Settings". Adding a new view later does NOT auto-add it to this menu.

**Scenario 4: Creating a Direct Link**
- Setup: Views: Home, Profile.
- Action: User creates Navigate > Direct Link. Selects "Home" in From View, "Profile" in To View. Clicks Save.
- Expected outcome: Requirement saved with `fromView: homeId, toView: profileId`. Sidebar shows "Home → Profile".

**Scenario 5: Forward/Back with page order**
- Setup: Views: Home, Profile, Settings.
- Action: User creates Navigate > Forward/Back. Page Order shows Home, Profile, Settings. User moves Settings above Profile (clicks up on Settings). Selects "Buttons" control type, enters "Next" and "Previous" for button text. Clicks Save.
- Expected outcome: Requirement saved with `pageOrder: [homeId, settingsId, profileId]`, `navControlType: 'buttons'`, `buttonForwardText: 'Next'`, `buttonBackText: 'Previous'`.

**Scenario 6: Deleted view in a navigate requirement**
- Setup: Direct Link requirement references `fromView: homeId, toView: profileId`. Profile view is deleted.
- Action: User views the Requirements panel.
- Expected outcome: Display text shows "Home → [deleted view]" or filters gracefully. Editing the requirement shows From View as "Home", To View as empty/unselected. User must select a new To View to save.

**Scenario 7: "Show Menu On" customization**
- Setup: Views: Home, Profile, Settings. User creates a Navigation Menu.
- Action: "Include all views" is checked. In "Show Menu On", all 3 views are checked. User unchecks "Settings" (the settings page shouldn't show the main nav menu). Clicks Save.
- Expected outcome: Requirement saved with `menuVisibleOn: [homeId, profileId]`. The menu links to all views but only appears on Home and Profile.

**Scenario 8: No views exist yet**
- Setup: User has not created any views (edge case — should not happen since Home is seeded, but defensive).
- Action: User opens Navigate > Direct Link sub-form.
- Expected outcome: Dropdowns are empty with placeholder text. Save button is disabled. Hint text suggests creating views first.

## How to Verify

1. Create a Direct Link requirement — verify From/To dropdowns populate with views, requirement saves and displays correctly
2. Create a Navigation Menu with "Include all views" checked — verify preview shows current views, saves with `menuIncludeAllViews: true`, sidebar shows "menu: all views"
3. Add a new view, then check the menu requirement — verify it reflects the new view without editing
4. Edit the menu, uncheck "Include all views" — verify checkbox list appears, manually deselect a view, save, verify sidebar shows specific view names
5. Verify "Show Menu On" works independently of "Include all views"
6. Create a Forward/Back requirement — verify page order list, reorder, control type, button text all save correctly
7. Delete a view that's referenced by a navigate requirement — verify graceful handling
8. Edit each nav subtype — verify forms pre-populate with saved values
9. `npm run build` compiles without errors
10. `npx vitest run` passes
