# Spec: PDS State Persistence (Multi-Project)

**Status:** done
**Date:** 2026-03-25

## What

Save and load wizard projects to/from the authenticated user's PDS as AT Protocol records. Each project is a separate record in a custom lexicon collection, enabling users to have multiple saved projects accessible from any device. localStorage continues as the fast working copy; the PDS is the durable, portable store.

## Why

Currently wizard state is only persisted in localStorage, which is device-specific and fragile. Saving to a user's PDS makes their work portable across devices, recoverable after clearing browser data, and consistent with the AT Protocol ecosystem the wizard is designed to serve. Multi-project support is essential — without it, starting a new project means losing the old one.

## Mockup

See `mockups/8-pds-projects.html` for visual reference of all UI elements described below.

## Lexicon Design

**Collection NSID:** `com.thelexfiles.appwizard.project`

**Record schema:**
```json
{
  "lexicon": 1,
  "id": "com.thelexfiles.appwizard.project",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["projectName", "wizardState", "createdAt", "updatedAt"],
        "properties": {
          "projectName": { "type": "string", "maxLength": 1000, "maxGraphemes": 100 },
          "wizardState": { "type": "string", "maxLength": 500000 },
          "createdAt": { "type": "string", "format": "datetime" },
          "updatedAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

**Notes:**
- `wizardState` is JSON-serialized WizardState stored as a string. This avoids needing the lexicon schema to mirror every nested wizard type, and makes migration trivial — the app already handles WizardState migration in `setWizardState()`.
- `projectName` is extracted from `appInfo.appName` (or a default like "Untitled Project") for display in the project picker without deserializing the full state.
- `key: "tid"` — each project gets a unique TID as its rkey, assigned on first save.
- `wizardState` maxLength is 500KB. If a project exceeds this, the save fails with a user-facing message explaining the project is too large to save. This is a known limitation for v1.

## Acceptance Criteria

- [x] **PDS write access verified** — The authenticated OAuth session (scope `atproto transition:generic`) can successfully perform `createRecord`, `getRecord`, `listRecords`, and `deleteRecord` on the user's own repo. Verified 2026-03-25 in production.

- [ ] **Lexicon published** — `com.thelexfiles.appwizard.project` lexicon is published to the protopunx PDS (via the existing publish infrastructure or manually) so the schema is discoverable.

- [ ] **PDS service module** — A new `ProjectService` module provides the PDS read/write layer.
  - `listProjects()` calls `com.atproto.repo.listRecords` for the collection and returns a summary list (rkey, projectName, updatedAt) without deserializing wizardState.
  - `loadProject(rkey)` calls `com.atproto.repo.getRecord` and returns the deserialized WizardState plus metadata (rkey, projectName, createdAt, updatedAt).
  - `saveProject(state, rkey?)` calls `com.atproto.repo.putRecord` (update) or `com.atproto.repo.createRecord` (new). Returns the rkey.
  - `deleteProject(rkey)` calls `com.atproto.repo.deleteRecord`.
  - All methods use the authenticated session's Agent. All methods handle network errors gracefully and surface them to the caller.

- [ ] **Active project tracking** — The app tracks which PDS project is currently loaded.
  - A module-level variable (e.g., `activeProjectRkey: string | null`) in WizardState.ts (or a new ProjectState module) tracks the rkey of the currently-loaded PDS project.
  - A `lastPdsSaveTimestamp: string | null` tracks when the current project was last saved to PDS.
  - When a project is loaded from PDS, `activeProjectRkey` is set to its rkey and `lastPdsSaveTimestamp` is set to the record's `updatedAt`.
  - When the user starts a new project (fresh state), both are set to `null`.
  - Neither value is persisted in localStorage or WizardState — they are session-only state.
  - **Unsaved changes detection:** The project has unsaved PDS changes if `lastPdsSaveTimestamp` is null and `hasMeaningfulState()` is true, OR if `lastPdsSaveTimestamp` is older than `wizardState.lastSaved` (meaning localStorage has been updated since the last PDS save).

- [ ] **Username dropdown menu** — When logged in, the header nav shows the username as a clickable dropdown trigger (same behavior on all screen sizes, no separate mobile/desktop layout).
  - Clicking the username toggles a dropdown with two items: "My Projects" and "Log out".
  - A small down-caret indicator (▾) appears after the username to signal it is interactive.
  - Clicking outside the dropdown or clicking an item closes it.
  - When logged out, the header shows the existing "Log in" button (no change).

- [ ] **Save button in sidebar / below accordions** — A "Save to PDS" button is shown when the user is logged in and the current project has meaningful state.
  - **Wide layout (sidebar visible):** The save button is pinned to the bottom of the sidebar, below the section nav, separated by a top border. Below the button, a status line shows "Last saved X ago" or similar.
  - **Narrow layout (accordion):** The save button appears below all accordion sections, styled the same.
  - The button shows contextual states:
    - **Default:** "Save to PDS" with a cloud icon.
    - **Saving:** "Saving…" with disabled/dimmed state.
    - **Success:** "Saved!" with green styling (brief flash, reverts to default after ~2 seconds).
    - **Error:** "Save failed" with red styling + status text "Check connection".
  - The save button is hidden when logged out.

- [ ] **Auto-save to PDS** — When logged in, the project is automatically saved to PDS on meaningful events, with a brief "Saved!" indicator on the sidebar/accordion save button.
  - **Auto-save triggers:**
    - Switching between panels (sidebar section click or accordion toggle).
    - Creating a card (requirement, data type, block, view).
    - Updating a card (saving edits to any existing item).
  - Auto-saves are silent on success (brief "Saved!" flash on the save button, no modal or toast). On failure, the save button shows the error state but does not interrupt the user's workflow.
  - Auto-save is debounced — if multiple triggers fire in quick succession, only one PDS save occurs.
  - localStorage auto-save continues unchanged alongside PDS auto-save.

- [ ] **Project picker dialog** — A modal dialog for listing, loading, and managing saved PDS projects.
  - Triggered on login (if user has 1+ saved projects) or via the "My Projects" item in the username dropdown.
  - Shows a heading "Your Projects" with a list of saved projects: project name, last updated date (human-readable relative or absolute), sorted by `updatedAt` descending.
  - The currently-loaded project (if any) is highlighted with a "current" badge.
  - Each project row is clickable to select it.
  - Buttons: "Load Selected", "Start New Project" (secondary style).
  - "Continue without loading" link at bottom to dismiss.
  - Each project has a delete button (×) that opens a delete confirmation sub-dialog.
  - **Unsaved local work protection:** If the current project has unsaved PDS changes (detected via timestamp comparison), the dialog shows a yellow warning: "Unsaved changes. Your current project has changes that haven't been saved to your PDS." with a "Save Current Project First" button.
  - **On load:** WizardState is deserialized, run through `setWizardState()` (handles migration), `activeProjectRkey` and `lastPdsSaveTimestamp` set, localStorage updated, UI re-renders.
  - **Empty state:** If no saved projects, show "No saved projects yet. Use the Save to PDS button in the sidebar to save your current project." with "Start New Project" and "Close" options.

- [ ] **Delete confirmation** — Deleting a project requires typing the project name to confirm.
  - Shows project name prominently, warns it cannot be undone.
  - Delete button is disabled until the typed text matches the project name exactly.
  - On confirm, `deleteRecord` is called. Project removed from list. If it was the active project, `activeProjectRkey` and `lastPdsSaveTimestamp` are set to null.

- [ ] **Auto-save to PDS on generate** — When a logged-in user generates/downloads their app (ZIP or GitHub export), the project is automatically saved to PDS if it hasn't been saved yet or has changes.
  - This happens after successful generation, not before (so it doesn't block the download).
  - If save fails, show a non-blocking warning but don't prevent the download.

- [ ] **Remove "Back to intro" button** — The `#back-to-landing` button and its wiring are removed.
  - Remove the button element from `index.html`.
  - Remove the event listener setup from `Initialization.ts`.
  - Remove associated CSS.

- [ ] **Logged-out experience unchanged** — Users who are not logged in see no PDS-related UI.
  - No save button in sidebar/accordion, no username dropdown, no project picker.
  - localStorage auto-save continues as the only persistence mechanism with "Progress saved!" indicator.
  - The wizard is fully functional without login — PDS persistence is purely additive.

- [ ] **Record size limit handling** — If `wizardState` serialized JSON exceeds 500KB (the `maxLength`), the save operation fails with a user-facing message: "This project is too large to save to your PDS. You can continue working locally." The localStorage save is unaffected.

## Scope

**In scope:**
- Verify PDS write access with current OAuth scope (done)
- Lexicon schema for wizard project records
- PDS read/write service module (CRUD operations)
- Username dropdown menu (replaces inline header auth links)
- Save button at bottom of sidebar (wide) / below accordions (narrow)
- Auto-save on panel switch, card create, card update
- Project picker dialog (list, load, delete with name-confirmation)
- Auto-save to PDS on generate
- Active project rkey and last-save timestamp tracking
- Unsaved changes detection (timestamp comparison)
- Unsaved local work protection on project switch/load
- Remove "Back to intro" button
- Record size limit handling
- Error handling for all PDS operations (network failures, auth expiry)

**Out of scope:**
- Conflict resolution with merge — if local and remote differ, the user picks one (via the project picker), not a field-level merge
- Real-time sync / polling for remote changes
- Sharing projects between users
- Project versioning / history
- Offline queue (if PDS is unreachable, save just fails with a message)
- Publishing the lexicon to a custom domain (use thelexfiles.com temp namespace for now)
- Renaming projects (project name is always derived from appInfo.appName)
- Pagination in project picker (sufficient for v1; unlikely users have 100+ projects)

## Files Likely Affected

- `src/app/services/ProjectService.ts` — **new** — PDS CRUD operations for project records
- `src/app/state/WizardState.ts` — add `activeProjectRkey` and `lastPdsSaveTimestamp` tracking, suppress localStorage save indicator when logged in
- `src/app/auth/HeaderAuth.ts` — replace logged-in layout with username dropdown trigger + dropdown menu
- `src/app/auth/ProjectPickerDialog.ts` — **new** — project picker dialog UI and event wiring
- `src/app/bootstrap/Initialization.ts` — hook project picker into post-login flow, remove "Back to intro" wiring
- `src/app/views/panels/GeneratePanel.ts` — add auto-save-to-PDS after generation
- `src/app/views/panels/DataPanel.ts` — add auto-save trigger on card create/update
- `src/app/views/panels/RequirementsPanel.ts` — add auto-save trigger on card create/update
- `src/app/views/panels/BlocksPanel.ts` — add auto-save trigger on card create/update
- `src/app/views/panels/ViewsPanel.ts` — add auto-save trigger on card create/update
- `src/app/views/WorkspaceLayout.ts` — add auto-save trigger on panel switch
- `src/app/auth/AuthService.ts` — expose `getAgent()` for PDS operations (already added)
- `src/types/wizard.ts` — possibly add a `ProjectMetadata` type for the list view
- `worker/index.ts` — possibly register the lexicon (or do this manually via existing publish flow)
- `index.html` — remove `#back-to-landing` button
- `styles/header.css` — username dropdown styles
- `styles/workspace/sidebar.css` — save button at bottom of sidebar
- `styles/workspace/accordion.css` — save button below accordions
- `styles/wizard/dialogs.css` — project picker and delete confirmation dialog styles

## Integration Boundaries

### User's PDS (via AT Protocol)
- **Data flowing in:** `listRecords` → project summaries; `getRecord` → full project state
- **Data flowing out:** `createRecord` / `putRecord` → serialized WizardState; `deleteRecord` → remove project
- **Expected contract:** Standard `com.atproto.repo.*` XRPC methods via the authenticated Agent. The session's DID is used as the `repo` parameter. Records conform to the `com.thelexfiles.appwizard.project` lexicon. OAuth scope `atproto transition:generic` grants full repo read/write.
- **Unavailability:** All PDS operations show a user-facing error message. No operation blocks the wizard — the user can always continue working with localStorage. The save button shows an error state; the project picker shows "Unable to load projects" with a retry option.

### localStorage (existing)
- **Relationship:** localStorage remains the working copy. PDS is the durable store. On load-from-PDS, localStorage is overwritten with the loaded state. On save-to-PDS, the current localStorage state is what gets saved.
- **Save triggers:** localStorage auto-save continues on every input change (as today). PDS auto-save triggers on panel switch, card create/update, and generate. Manual PDS save via the sidebar/accordion button.
- **Save feedback:** When logged in, the "Progress saved!" localStorage indicator is suppressed. The sidebar/accordion save button shows PDS save status instead. When logged out, localStorage feedback remains as-is.

## Behavioral Scenarios

**Scenario: First-time login with no saved projects**
- Setup: User has never logged in before. localStorage has a project in progress.
- Action: User logs in.
- Expected: Login completes, no project picker appears. User continues with their localStorage project. Username dropdown appears in header. Save button appears at bottom of sidebar.

**Scenario: Login with saved projects**
- Setup: User has 3 projects saved on PDS. localStorage has a different project in progress.
- Action: User logs in.
- Expected: Project picker dialog shows 3 projects sorted by most recent. Dialog warns "You have an unsaved local project" with option to save it first. User can load a PDS project (replacing localStorage), continue without loading (keeping localStorage project), or start fresh.

**Scenario: Save new project (manual)**
- Setup: User is logged in. `activeProjectRkey` is null. Current project has appName "My Cool App".
- Action: User clicks "Save to PDS" in sidebar.
- Expected: `createRecord` is called. Project is saved with projectName "My Cool App". `activeProjectRkey` is set to the returned TID. `lastPdsSaveTimestamp` updated. Button briefly shows "Saved!" in green.

**Scenario: Auto-save on panel switch**
- Setup: User is logged in with a project loaded. User has made changes on the Data panel.
- Action: User clicks "Components" in the sidebar.
- Expected: Panel switches to Components. In the background, PDS save fires. Save button briefly flashes "Saved!". If save fails, button shows error state but panel switch is unaffected.

**Scenario: Auto-save on card create**
- Setup: User is logged in on the Requirements panel.
- Action: User creates a new requirement.
- Expected: Requirement is added to state. localStorage saves immediately. PDS auto-save fires (debounced). Save button briefly flashes "Saved!".

**Scenario: Update existing project**
- Setup: User is logged in. `activeProjectRkey` is "3lr7...". User has made changes since last save.
- Action: User clicks "Save to PDS" in sidebar.
- Expected: `putRecord` is called with rkey "3lr7...". Record is updated. `lastPdsSaveTimestamp` updated. Brief "Saved!" confirmation.

**Scenario: Save with blank app name**
- Setup: User is logged in, has meaningful state, but appInfo.appName is empty.
- Action: Save triggers (manual or auto).
- Expected: Project is saved with projectName "Untitled Project".

**Scenario: Load project from picker**
- Setup: User has localStorage project "App A" (already saved to PDS). PDS has project "App B".
- Action: User opens My Projects via username dropdown, clicks "App B", clicks "Load Selected".
- Expected: App B's WizardState is loaded via `setWizardState()`, `activeProjectRkey` set to App B's rkey, `lastPdsSaveTimestamp` set, localStorage updated, UI re-renders to show App B's state.

**Scenario: Load project with unsaved local changes**
- Setup: User has "App A" loaded with changes since last PDS save. User opens My Projects.
- Action: Dialog opens.
- Expected: Dialog warns "You have unsaved changes in your current project" with "Save Current Project First" button. User can save then load, or dismiss warning and load anyway.

**Scenario: Load project with never-saved local work**
- Setup: User has meaningful local state that has never been saved to PDS (`activeProjectRkey` is null). User opens My Projects.
- Action: Dialog opens.
- Expected: Dialog warns "You have an unsaved local project" with "Save Current Project First" option.

**Scenario: Delete project from picker**
- Setup: User has 3 projects on PDS.
- Action: User clicks × on "Old App".
- Expected: Delete confirmation dialog appears, requires typing "Old App" to confirm. Delete button disabled until name matches. After confirmation, `deleteRecord` called. Project removed from list. If it was the active project, `activeProjectRkey` and `lastPdsSaveTimestamp` are set to null.

**Scenario: PDS save fails (network error)**
- Setup: User is logged in. PDS is unreachable.
- Action: Save triggers (manual or auto).
- Expected: Save button shows "Save failed" in red. Status text shows "Check connection". localStorage save is unaffected. User can continue working.

**Scenario: PDS list fails on login**
- Setup: User logs in. PDS is unreachable for listRecords.
- Action: Login completes.
- Expected: Login succeeds (username dropdown shows). Project picker is skipped. If user clicks "My Projects", dialog shows "Unable to load projects" with retry.

**Scenario: Auto-save on generate**
- Setup: User is logged in. Project has changes not yet saved to PDS.
- Action: User generates and downloads ZIP.
- Expected: ZIP downloads normally. After download completes, project is saved to PDS. Save button shows "Saved!". If save fails, a non-blocking warning appears but download is not affected.

**Scenario: Logged-out user**
- Setup: User is not logged in.
- Action: User uses the wizard normally.
- Expected: No save button in sidebar/accordion. No username dropdown. "Log in" button in header. localStorage auto-save works as before with "Progress saved!" indicator. No PDS interactions occur.

**Scenario: Start new project from picker**
- Setup: User has "App A" loaded with unsaved changes.
- Action: User opens My Projects, clicks "Start New Project".
- Expected: Warned about unsaved changes with "Save First" option. After resolving, `initializeWizardState()` is called, `activeProjectRkey` and `lastPdsSaveTimestamp` set to null, localStorage updated with fresh state, UI re-renders to fresh state.

**Scenario: Project too large to save**
- Setup: User has a very complex project. Serialized WizardState exceeds 500KB.
- Action: Save triggers (manual or auto).
- Expected: Save fails. Save button shows error. Status message: "Project too large to save to PDS." localStorage is unaffected.

**Scenario: Debounced auto-save**
- Setup: User is logged in. User rapidly creates 3 requirements in succession.
- Action: Three card-create events fire within a short window.
- Expected: Only one PDS save occurs (debounced). Save button shows "Saved!" once after the debounce settles.

## How to Verify

1. **Prerequisite — PDS write test:** ~~Log in, run a test function from browser console.~~ Done — verified 2026-03-25.
2. **Manual — logged out:** Verify wizard works identically to today. No PDS UI visible. No save button in sidebar. "Progress saved!" still appears on localStorage saves.
3. **Manual — username dropdown:** Log in. Verify username appears with ▾ caret. Click it — verify "My Projects" and "Log out" appear. Click outside — verify it closes.
4. **Manual — save button:** Log in. Verify save button appears at bottom of sidebar. Click it. Verify save succeeds with "Saved!" flash. Verify "Last saved" timestamp updates.
5. **Manual — auto-save:** Log in with a project. Switch panels. Verify save button briefly flashes "Saved!". Create a card. Verify same behavior.
6. **Manual — login with no projects:** Log in, verify no picker appears.
7. **Manual — save and reload:** Log in, work on a project, let auto-save run. Log out. Clear localStorage. Log back in. Verify project appears in picker and can be loaded.
8. **Manual — multiple projects:** Save 2-3 projects. Open My Projects. Verify all appear sorted by date. Load one, verify state switches. Load another, verify state switches.
9. **Manual — unsaved changes:** Make changes after saving. Open My Projects. Verify unsaved changes warning appears. Verify "Save First" works.
10. **Manual — delete:** Delete a project from the picker. Verify name-typing confirmation is required. Verify project is gone on refresh.
11. **Manual — cross-device:** Save a project on one browser/device. Log in on another. Verify project appears and loads correctly.
12. **Manual — error handling:** Disconnect network. Try to save. Verify save button shows error state. Try My Projects. Verify graceful error with retry.
13. **Manual — narrow layout:** Resize to narrow breakpoint. Verify save button appears below accordions. Verify username dropdown still works.
14. **Manual — back-to-intro removed:** Verify the "← Back to intro" button is gone.
15. **Automated:** Unit tests for ProjectService (mock the Agent's XRPC calls). Test serialization/deserialization round-trip. Test projectName derivation. Test unsaved-changes detection logic. Test debounce behavior.
