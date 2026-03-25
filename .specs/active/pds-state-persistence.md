# Spec: PDS State Persistence (Multi-Project)

**Status:** ready
**Date:** 2026-03-25

## What

Save and load wizard projects to/from the authenticated user's PDS as AT Protocol records. Each project is a separate record in a custom lexicon collection, enabling users to have multiple saved projects accessible from any device. localStorage continues as the fast working copy; the PDS is the durable, portable store.

## Why

Currently wizard state is only persisted in localStorage, which is device-specific and fragile. Saving to a user's PDS makes their work portable across devices, recoverable after clearing browser data, and consistent with the AT Protocol ecosystem the wizard is designed to serve. Multi-project support is essential — without it, starting a new project means losing the old one.

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

- [ ] **PDS write access verified** — Before building the full feature, confirm that the authenticated OAuth session (scope `atproto transition:generic`) can successfully perform `createRecord`, `getRecord`, `listRecords`, and `deleteRecord` on the user's own repo. This is a prerequisite — if writes fail, the scope or session setup must be fixed first.

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

- [ ] **Save to PDS** — Logged-in users can save the current project to their PDS.
  - The header area (near the auth controls) shows a "Save" button when the user is logged in and the current project has meaningful state.
  - Clicking "Save" saves the current WizardState to PDS:
    - If `activeProjectRkey` is set, it updates the existing record (putRecord).
    - If `activeProjectRkey` is null, it creates a new record (createRecord) and sets `activeProjectRkey` to the returned rkey.
  - `projectName` is derived from `appInfo.appName`. If blank, use "Untitled Project".
  - While saving, the button shows a brief spinner/disabled state. On success, show a brief "Saved to PDS" confirmation (similar to the existing "Progress saved!" pattern). On failure, show an error message.
  - On successful PDS save, `lastPdsSaveTimestamp` is updated.
  - When logged in, the "Progress saved!" localStorage indicator is suppressed — the PDS save confirmation is the only save feedback. When logged out, localStorage save feedback remains as-is.

- [ ] **Project picker dialog on login** — After a successful login, if the user has saved projects on their PDS, a project picker dialog appears.
  - After `completeLogin()` succeeds, call `listProjects()`.
  - If the user has 0 saved projects, skip the dialog — proceed as today.
  - If the user has 1+ saved projects, show a modal dialog with:
    - A heading: "Your Projects"
    - A list of saved projects, each showing: project name, last updated date (human-readable relative or absolute). Sorted by `updatedAt` descending (most recent first).
    - Each project row is clickable/selectable.
    - A "Load Selected" button (or clicking the row directly loads it).
    - A "Continue Without Loading" button that dismisses the dialog and keeps whatever is in localStorage.
    - A "Start New Project" button that clears current state and initializes fresh.
  - **Unsaved local work protection:** If localStorage has meaningful state that has never been saved to PDS (`activeProjectRkey` is null), the dialog shows a warning: "You have an unsaved local project" with a "Save Current Project First" option before allowing load or new project actions.
  - When a project is loaded from PDS:
    - The WizardState is deserialized, run through `setWizardState()` (which handles migration), and becomes the active state.
    - `activeProjectRkey` is set.
    - `lastPdsSaveTimestamp` is set to the record's `updatedAt`.
    - localStorage is updated with this state (so it becomes the working copy).
    - The UI re-renders to reflect the loaded state.

- [ ] **"My Projects" button** — A persistent button in the header (visible when logged in) opens the project picker dialog at any time.
  - Placed in the header auth area, between the username and "Log out" link. Text: "My Projects".
  - Clicking it opens the same project picker dialog as on login.
  - If the current project has unsaved PDS changes (detected via the timestamp comparison described above), the dialog shows: "You have unsaved changes in your current project" with a "Save First" option.
  - The dialog also shows a "Delete" action for each project. Deletion requires typing the project name to confirm.

- [ ] **Auto-save to PDS on generate** — When a logged-in user generates/downloads their app (ZIP or GitHub export), the project is automatically saved to PDS if it hasn't been saved yet or has changes.
  - This happens after successful generation, not before (so it doesn't block the download).
  - If save fails, show a non-blocking warning but don't prevent the download.

- [ ] **Logged-out experience unchanged** — Users who are not logged in see no PDS-related UI.
  - No "Save" button, no "My Projects" button, no project picker.
  - localStorage auto-save continues as the only persistence mechanism.
  - The wizard is fully functional without login — PDS persistence is purely additive.

- [ ] **Record size limit handling** — If `wizardState` serialized JSON exceeds 500KB (the `maxLength`), the save operation fails with a user-facing message: "This project is too large to save to your PDS. You can continue working locally." The localStorage save is unaffected.

## Scope

**In scope:**
- Verify PDS write access with current OAuth scope (prerequisite)
- Lexicon schema for wizard project records
- PDS read/write service module (CRUD operations)
- Project picker dialog (list, load, delete with name-confirmation)
- Save button in header
- "My Projects" button in header
- Auto-save to PDS on generate
- Active project rkey and last-save timestamp tracking
- Unsaved changes detection (timestamp comparison)
- Unsaved local work protection on project switch/load
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
- `src/app/auth/HeaderAuth.ts` — add "Save" and "My Projects" buttons to logged-in header
- `src/app/auth/ProjectPickerDialog.ts` — **new** — project picker dialog UI and event wiring
- `src/app/bootstrap/Initialization.ts` — hook project picker into post-login flow
- `src/app/views/panels/GeneratePanel.ts` — add auto-save-to-PDS after generation
- `src/app/auth/AuthService.ts` — expose `getAgent()` for PDS operations (currently Agent is created ad-hoc in `getUserProfile()`)
- `src/types/wizard.ts` — possibly add a `ProjectMetadata` type for the list view
- `worker/index.ts` — possibly register the lexicon (or do this manually via existing publish flow)
- `styles.css` — styles for project picker dialog and header buttons

## Integration Boundaries

### User's PDS (via AT Protocol)
- **Data flowing in:** `listRecords` → project summaries; `getRecord` → full project state
- **Data flowing out:** `createRecord` / `putRecord` → serialized WizardState; `deleteRecord` → remove project
- **Expected contract:** Standard `com.atproto.repo.*` XRPC methods via the authenticated Agent. The session's DID is used as the `repo` parameter. Records conform to the `com.thelexfiles.appwizard.project` lexicon. OAuth scope `atproto transition:generic` grants full repo read/write.
- **Unavailability:** All PDS operations show a user-facing error message. No operation blocks the wizard — the user can always continue working with localStorage. The "Save" button shows an error; the project picker shows "Unable to load projects" with a retry option.

### localStorage (existing)
- **Relationship:** localStorage remains the working copy. PDS is the durable store. On load-from-PDS, localStorage is overwritten with the loaded state. On save-to-PDS, the current localStorage state is what gets saved.
- **No sync:** There is no automatic sync loop. PDS saves happen on explicit user action (Save button) or on generate. PDS loads happen on explicit user action (project picker).
- **Save feedback:** When logged in, the "Progress saved!" localStorage indicator is suppressed. PDS "Saved" confirmation is the only save feedback shown. When logged out, localStorage feedback remains as-is.

## Behavioral Scenarios

**Scenario: First-time login with no saved projects**
- Setup: User has never logged in before. localStorage has a project in progress.
- Action: User logs in.
- Expected: Login completes, no project picker appears. User continues with their localStorage project. "Save" and "My Projects" buttons appear in header.

**Scenario: Login with saved projects**
- Setup: User has 3 projects saved on PDS. localStorage has a different project in progress.
- Action: User logs in.
- Expected: Project picker dialog shows 3 projects sorted by most recent. Dialog warns "You have an unsaved local project" with option to save it first. User can load a PDS project (replacing localStorage), continue without loading (keeping localStorage project), or start fresh.

**Scenario: Save new project**
- Setup: User is logged in. `activeProjectRkey` is null. Current project has appName "My Cool App".
- Action: User clicks "Save".
- Expected: `createRecord` is called. Project is saved with projectName "My Cool App". `activeProjectRkey` is set to the returned TID. `lastPdsSaveTimestamp` updated. Button briefly shows success state.

**Scenario: Update existing project**
- Setup: User is logged in. `activeProjectRkey` is "3lr7...". User has made changes since last save.
- Action: User clicks "Save".
- Expected: `putRecord` is called with rkey "3lr7...". Record is updated. `lastPdsSaveTimestamp` updated. Brief success confirmation.

**Scenario: Save with blank app name**
- Setup: User is logged in, has meaningful state, but appInfo.appName is empty.
- Action: User clicks "Save".
- Expected: Project is saved with projectName "Untitled Project".

**Scenario: Load project from picker**
- Setup: User has localStorage project "App A" (already saved to PDS). PDS has project "App B".
- Action: User opens My Projects, clicks "App B".
- Expected: App B's WizardState is loaded via `setWizardState()`, `activeProjectRkey` set to App B's rkey, `lastPdsSaveTimestamp` set, localStorage updated, UI re-renders to show App B's state.

**Scenario: Load project with unsaved local changes**
- Setup: User has "App A" loaded with changes since last PDS save. User opens My Projects, tries to load "App B".
- Action: User clicks "App B".
- Expected: Dialog warns "You have unsaved changes in your current project" with "Save First" option. User can save then load, or discard changes and load.

**Scenario: Load project with never-saved local work**
- Setup: User has meaningful local state that has never been saved to PDS (`activeProjectRkey` is null). User opens My Projects.
- Action: Dialog opens.
- Expected: Dialog warns "You have an unsaved local project" with "Save Current Project First" option.

**Scenario: Delete project from picker**
- Setup: User has 3 projects on PDS.
- Action: User clicks delete on "Old App".
- Expected: Confirmation dialog requires typing "Old App" to confirm. After confirmation, `deleteRecord` called. Project removed from list. If it was the active project, `activeProjectRkey` and `lastPdsSaveTimestamp` are set to null.

**Scenario: Switch projects with unsaved changes**
- Setup: User is logged in with "App A" loaded (`activeProjectRkey` set). User has made changes since last PDS save.
- Action: User clicks "My Projects".
- Expected: Dialog shows "You have unsaved changes in your current project" with a "Save First" option before loading a different project.

**Scenario: PDS save fails (network error)**
- Setup: User is logged in. PDS is unreachable.
- Action: User clicks "Save".
- Expected: Button shows error state. Error message displayed (e.g., "Couldn't save to PDS — check your connection"). localStorage save is unaffected. User can continue working.

**Scenario: PDS list fails on login**
- Setup: User logs in. PDS is unreachable for listRecords.
- Action: Login completes.
- Expected: Login succeeds (profile shows). Project picker is skipped. "My Projects" button still appears. If user clicks it, dialog shows "Unable to load projects" with retry.

**Scenario: Auto-save on generate**
- Setup: User is logged in. Project has changes not yet saved to PDS.
- Action: User generates and downloads ZIP.
- Expected: ZIP downloads normally. After download completes, project is silently saved to PDS. If save fails, a non-blocking warning appears but download is not affected.

**Scenario: Logged-out user**
- Setup: User is not logged in.
- Action: User uses the wizard normally.
- Expected: No "Save" button, no "My Projects" button. localStorage auto-save works as before with "Progress saved!" indicator. No PDS interactions occur.

**Scenario: Start new project from picker**
- Setup: User has "App A" loaded with unsaved changes.
- Action: User opens My Projects, clicks "Start New Project".
- Expected: Warned about unsaved changes with "Save First" option. After resolving, `initializeWizardState()` is called, `activeProjectRkey` and `lastPdsSaveTimestamp` set to null, localStorage updated with fresh state, UI re-renders to fresh state.

**Scenario: Project too large to save**
- Setup: User has a very complex project. Serialized WizardState exceeds 500KB.
- Action: User clicks "Save".
- Expected: Save fails with message: "This project is too large to save to your PDS. You can continue working locally." localStorage is unaffected.

## How to Verify

1. **Prerequisite — PDS write test:** Log in, run a test function from browser console that creates a record, reads it back, and deletes it. Confirm all three operations succeed with the current OAuth scope.
2. **Manual — logged out:** Verify wizard works identically to today. No PDS UI visible. "Progress saved!" still appears on localStorage saves.
3. **Manual — login with no projects:** Log in, verify no picker appears. Verify "Save" and "My Projects" appear in header.
4. **Manual — save and reload:** Log in, create a project, click Save. Log out. Clear localStorage. Log back in. Verify project appears in picker and can be loaded.
5. **Manual — multiple projects:** Save 2-3 projects. Open My Projects. Verify all appear sorted by date. Load one, verify state switches. Load another, verify state switches.
6. **Manual — unsaved changes:** Make changes after saving. Open My Projects. Verify unsaved changes warning appears. Verify "Save First" works.
7. **Manual — unsaved local work:** Have local work without ever saving to PDS. Log in (or open My Projects). Verify warning about unsaved local project.
8. **Manual — delete:** Delete a project from the picker. Verify name-typing confirmation is required. Verify project is gone on refresh.
9. **Manual — cross-device:** Save a project on one browser/device. Log in on another. Verify project appears and loads correctly.
10. **Manual — error handling:** Disconnect network. Try to save. Verify graceful error. Try My Projects. Verify graceful error with retry.
11. **Manual — save feedback:** When logged in, verify "Progress saved!" does NOT appear on regular edits. Verify PDS save shows its own confirmation.
12. **Automated:** Unit tests for ProjectService (mock the Agent's XRPC calls). Test serialization/deserialization round-trip. Test projectName derivation. Test unsaved-changes detection logic.
