# Spec: Generator — View-Driven Pages and Block Components

**Status:** ready
**Date:** 2026-03-23

## What

Rewrite the code generator to produce a multi-page app driven by the wizard's Views, Blocks, and Requirements, replacing the current hardcoded four-view (menu/list/detail/form) output. Restructure the generated app's folder layout to separate AT Protocol integration, views, and components into clear directories. Add a `blockType` field to blocks so the generator knows what kind of component to render for each block — starting with `menu` blocks that produce a working nav menu, with other block types (list, form, detail, etc.) rendered as typed placeholders for now.

## Why

The wizard now collects rich structured data — requirements grouped into blocks, placed onto named views — but the generator ignores all of it. It produces the same single-record-type CRUD app regardless of what the user configured. This makes the wizard's Blocks and Views panels feel purposeless. The generated app should reflect the user's design intent: pages matching their views, a working nav menu linking them, and placeholder sections where they defined blocks.

Additionally, the generated app's folder structure puts everything under a generic `services/` directory, including views. Views are not services, and the flat structure provides no separation between AT Protocol code, UI logic, and page rendering.

## Generated App Folder Structure

**Current structure:**
```
app.ts
services/
  Auth.ts
  types.ts
  Store.ts
  API.ts
  UIState.ts
  UIComponents.ts
  Navigation.ts
  SessionManager.ts
  views/
    ListView.ts
    DetailView.ts
    FormView.ts
```

**New structure:**
```
src/
  main.ts                   — app entry (init, OAuth, page setup)
  router.ts                 — view switching between pages
  store.ts                  — data store for all record types
  ui.ts                     — DOM helpers (merged UIState + UIComponents)
  atproto/
    auth.ts                 — OAuth client
    api.ts                  — AT Protocol CRUD operations
    session.ts              — session management
    types.ts                — TypeScript interfaces for record types
  views/                    — one file per wizard View
    Home.ts                 — generated from wizard View "Home"
    [ViewName].ts           — one per additional wizard View
  components/               — block component renderers
    NavMenu.ts              — navigation menu (from menu-type block)
    [BlockName].ts          — typed placeholder per block
```

Config files unchanged at root: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `styles.css`, `README.md`, `lexicons/`.

### Naming Rationale

- **`atproto/`**: Groups all AT Protocol-specific code (OAuth, API calls, session handling, types). These files deal with the protocol; nothing else does.
- **`views/`**: One file per wizard View. Each file is a page-level renderer that composes its assigned blocks. Named to match wizard terminology.
- **`components/`**: Block-level renderers. Each component renders one block's worth of UI. The generator uses the block's `blockType` to determine what to render — a real component (e.g., NavMenu) or a typed placeholder.
- **`ui.ts`**: Merges current `UIState.ts` (screen switching) and `UIComponents.ts` (DOM helpers) into a single utility file — both are small helper collections.
- **`router.ts`**: Replaces `Navigation.ts`. "Router" better describes its role — switching between top-level views/pages.
- **`store.ts`**: Unchanged in purpose, moved to `src/` root since it's app-level, not protocol-specific.
- **`main.ts`**: Replaces `app.ts`. Standard Vite entry point convention.

## Block Types

A new `blockType` field on the `Block` interface tells the generator what kind of component to render. This replaces inference from requirement analysis — the user explicitly chooses the block's shape when creating it.

### Type Definition

```typescript
export type BlockType = 'menu' | 'list' | 'detail' | 'form' | 'table' | 'card' | 'text';

export interface Block {
  id: string;
  name: string;
  requirementIds: string[];
  blockType?: BlockType;
}
```

### Block Type Descriptions

| blockType | Intended rendering | Data source |
|---|---|---|
| `menu` | Nav menu with links to views | navigate requirement's view list |
| `list` | List/feed of records | `do` requirement's `dataTypeId` |
| `detail` | Single record display | `do` requirement's `dataTypeId` |
| `form` | Create/edit form | `do` requirement's `dataTypeId` |
| `table` | Tabular record display | `do` requirement's `dataTypeId` |
| `card` | Single record card | `do` requirement's `dataTypeId` |
| `text` | Static text/info section | `know` requirement's `text`/`content` |

### Quick-Create Integration

The Blocks panel's "+ Block" quick-create already shows name suggestions based on requirement type. These suggestions now also set `blockType`:

```typescript
const QUICK_NAMES: Record<string, { label: string; blockType?: BlockType }[]> = {
  know:         [
    { label: 'Paragraph', blockType: 'text' },
    { label: 'Section', blockType: 'text' },
    { label: 'Heading', blockType: 'text' },
    { label: 'Info Box', blockType: 'text' },
    { label: 'Banner', blockType: 'text' },
  ],
  'do-data':    [
    { label: 'Form', blockType: 'form' },
    { label: 'List', blockType: 'list' },
    { label: 'Card', blockType: 'card' },
    { label: 'Table', blockType: 'table' },
    { label: 'Detail View', blockType: 'detail' },
  ],
  'do-element': [
    { label: 'Widget' },
    { label: 'Tool' },
    { label: 'Control' },
  ],
  navigate:     [
    { label: 'Menu', blockType: 'menu' },
    { label: 'Link' },
    { label: 'Button' },
    { label: 'Menu Item' },
    { label: 'Tab' },
  ],
};
```

When the user clicks a quick-create option that has a `blockType`, the created block gets that `blockType` set. Options without a `blockType` create blocks with `blockType: undefined` (rendered as generic placeholders).

The full block creation form (where the user types a custom name and selects requirements) does not need a `blockType` selector in this phase — blocks created that way get `blockType: undefined`. Adding a type selector to the full form is future work.

### Generator Mapping

The generator checks each block's `blockType` to decide how to render it:

| `blockType` | Phase 2 behavior | Future (Phase 3) |
|---|---|---|
| `menu` | **Real component:** NavMenu with view links | Enhanced with styling options |
| `list` | Typed placeholder: "List: [dataTypeName]" | Real RecordList component |
| `detail` | Typed placeholder: "Detail: [dataTypeName]" | Real RecordDetail component |
| `form` | Typed placeholder: "Form: [dataTypeName]" | Real RecordForm component |
| `table` | Typed placeholder: "Table: [dataTypeName]" | Real RecordTable component |
| `card` | Typed placeholder: "Card: [dataTypeName]" | Real RecordCard component |
| `text` | Typed placeholder: "Text: [content preview]" | Real text section |
| `undefined` | Generic placeholder with requirement summary | Same |

## Implementation Phases

### Phase 1: Folder Restructure

Reorganize the generated output paths without changing generated app behavior. The generated app should function identically — same OAuth flow, same hardcoded list/detail/form views, same navigation — but with files in the new directory structure.

**Output path mapping:**

| Current output path | New output path |
|---|---|
| `app.ts` | `src/main.ts` |
| `services/Auth.ts` | `src/atproto/auth.ts` |
| `services/types.ts` | `src/atproto/types.ts` |
| `services/Store.ts` | `src/store.ts` |
| `services/API.ts` | `src/atproto/api.ts` |
| `services/UIState.ts` | `src/ui.ts` (merged) |
| `services/UIComponents.ts` | `src/ui.ts` (merged) |
| `services/Navigation.ts` | `src/router.ts` |
| `services/SessionManager.ts` | `src/atproto/session.ts` |
| `services/views/ListView.ts` | `src/components/RecordList.ts` |
| `services/views/DetailView.ts` | `src/components/RecordDetail.ts` |
| `services/views/FormView.ts` | `src/components/RecordForm.ts` |

Each generator module's generated import paths must update to reflect the new layout. For example, `import Store from './Store'` in the current Navigation.ts output becomes `import Store from '../store'` in the new router.ts output.

The `index.html` `<script>` tag changes from `./app.ts` to `./src/main.ts`.

**Generator source reorganization:**

The generator source files in `src/generator/` should be reorganized to mirror the new output structure:

| Current generator source | New generator source |
|---|---|
| `src/generator/AppEntry.ts` | `src/generator/app/Main.ts` |
| `src/generator/services/Auth.ts` | `src/generator/atproto/Auth.ts` |
| `src/generator/services/Types.ts` | `src/generator/atproto/Types.ts` |
| `src/generator/services/Api.ts` | `src/generator/atproto/Api.ts` |
| `src/generator/services/SessionManager.ts` | `src/generator/atproto/Session.ts` |
| `src/generator/services/Store.ts` | `src/generator/app/Store.ts` |
| `src/generator/services/UIState.ts` | `src/generator/app/UI.ts` (merged) |
| `src/generator/services/UIComponents.ts` | (merged into UI.ts above) |
| `src/generator/services/Navigation.ts` | `src/generator/app/Router.ts` |
| `src/generator/views/ListView.ts` | `src/generator/components/RecordList.ts` |
| `src/generator/views/DetailView.ts` | `src/generator/components/RecordDetail.ts` |
| `src/generator/views/FormView.ts` | `src/generator/components/RecordForm.ts` |

### Phase 2: View-Driven Pages + Router + Nav Menu

Replace the hardcoded four-view architecture with dynamic page generation driven by the wizard's Views, Blocks, and Requirements.

#### Block Type Addition (Wizard Side)

Add `blockType` field to the `Block` interface and update the Blocks panel:

- Add `BlockType` type and optional `blockType` field to `src/types/wizard.ts`
- Restructure `QUICK_NAMES` in `BlocksPanel.ts` from `string[]` to `{ label: string; blockType?: BlockType }[]`
- When a quick-create option with a `blockType` is selected, store it on the created block
- Add "Menu" as the first option in the navigate quick-names (above "Link")
- Add state migration in `setWizardState()` for existing saved states (blocks without `blockType` get `undefined` — no migration needed since the field is optional)

#### index.html Changes

The app section in `index.html` changes from hardcoded view divs to a single content container:

```html
<div id="appSection" class="app-section">
  <div class="user-info">
    <strong>Logged in as:</strong>
    <div id="userDisplayName"></div>
    <div id="userHandle"></div>
    <div id="userDid" style="font-size: 12px; color: #666; margin-top: 5px"></div>
  </div>
  <div id="appStatus" class="status">Ready!</div>
  <div id="appContent"></div>
  <button id="logoutButton" class="secondary">Sign Out</button>
</div>
```

The Router manages view rendering inside `#appContent`.

#### Router

The new `src/router.ts` replaces the hardcoded `NavigationManager`. It:
- Maintains a map of view IDs to render functions
- Renders view content into `#appContent` (clearing previous content)
- Tracks the active view
- Exposes `navigate(viewId)` for programmatic navigation
- Shows the first view in the `views[]` array after login (the default)

View IDs for the Router are derived as camelCase slugs from the view name (e.g., "User Profile" → `'userProfile'`), with numeric suffix on collision (e.g., `'myPage'`, `'myPage2'`). This matches the PascalCase filename approach but in camelCase for use as map keys and function arguments.

Generated example (for an app with Home and Profile views):

```typescript
import { renderHomeView } from './views/Home';
import { renderProfileView } from './views/Profile';

export class Router {
  private activeViewId: string | null = null;
  private container: HTMLElement;
  private views: Map<string, { render: (container: HTMLElement, router: Router) => void }>;

  constructor() {
    this.container = document.getElementById('appContent')!;
    this.views = new Map([
      ['home', { render: renderHomeView }],
      ['profile', { render: renderProfileView }],
    ]);
  }

  navigate(viewId: string): void {
    this.container.innerHTML = '';
    this.activeViewId = viewId;

    const view = this.views.get(viewId);
    if (view) {
      view.render(this.container, this);
    }
  }

  getActiveViewId(): string | null {
    return this.activeViewId;
  }
}
```

#### View Page Files

Each wizard View generates a file in `src/views/`. The file exports a render function that:
1. Creates a page heading from the view name
2. Renders each assigned block in order as `<section>` elements
3. Passes the Router to block components that need it (nav menu)

If two views produce the same PascalCase filename, add a numeric suffix (e.g., `MyPage.ts`, `MyPage2.ts`).

Generated example:

```typescript
// src/views/Home.ts
import type { Router } from '../router';
import { renderMainMenu } from '../components/MainMenu';

export function renderHomeView(container: HTMLElement, router: Router): void {
  const heading = document.createElement('h2');
  heading.textContent = 'Home';
  container.appendChild(heading);

  // Block: Main Menu (menu)
  const mainMenuSection = document.createElement('section');
  mainMenuSection.className = 'block';
  renderMainMenu(mainMenuSection, router);
  container.appendChild(mainMenuSection);

  // Block: Post Feed (list) — placeholder
  const postFeedSection = document.createElement('section');
  postFeedSection.className = 'block block-placeholder';
  postFeedSection.innerHTML = `
    <h3>Post Feed</h3>
    <div class="placeholder-type">List</div>
    <ul class="placeholder-requirements">
      <li>view posts</li>
    </ul>
  `;
  container.appendChild(postFeedSection);
}
```

Views with no blocks render a heading and empty state message: "No content defined for this view yet."

Only blocks assigned to at least one view generate component files. Unassigned blocks are skipped.

#### NavMenu Component

When the generator encounters a block with `blockType: 'menu'`, it generates a NavMenu component file. The menu items are derived from the navigate requirement within the block:
- If `menuIncludeAllViews` is true → include all wizard Views
- If false → include only the views listed in `menuItems`
- If the block has no navigate requirement with menu data → fall back to all views

Each menu block's component file exports a render function with a unique name derived from the block name (e.g., block "Main Menu" → `renderMainMenu`, block "Dashboard Nav" → `renderDashboardNav`). This avoids import aliasing when a view uses multiple menu blocks.

```typescript
// src/components/MainMenu.ts
import type { Router } from '../router';

export function renderMainMenu(container: HTMLElement, router: Router): void {
  const nav = document.createElement('nav');
  nav.className = 'nav-menu';

  const items = [
    { label: 'Home', viewId: 'home' },
    { label: 'Profile', viewId: 'profile' },
  ];

  items.forEach(item => {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'nav-menu-item';
    link.textContent = item.label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(item.viewId);
    });
    nav.appendChild(link);
  });

  container.appendChild(nav);
}
```

Multiple menu-type blocks are valid — each generates its own component file with its own uniquely-named render function and set of menu items. Different pages might have different nav menus.

#### Placeholder Block Rendering

For blocks without `blockType: 'menu'`, the generator produces a placeholder section. The placeholder indicates both the block type and its requirements:

**Typed placeholders** (block has a `blockType`):
- Show the block name as heading
- Show the `blockType` as a label (e.g., "List", "Form", "Detail View")
- List the block's requirements as bullet points

**Generic placeholders** (block has no `blockType`):
- Show the block name as heading
- List the block's requirements as bullet points

Requirement summary text per type:
- `know` → the requirement's `text`, or "Info section" if empty
- `do` with `dataTypeId` → `"verb dataTypeName"` (e.g., "create Post", "view Comments")
- `do` with `elementId` → `"verb elementName"`
- `navigate` (direct) → `"link to ViewName"`
- `navigate` (forward-back) → `"page navigation"`
- `navigate` (menu, in a non-menu block) → `"navigation menu"`

Placeholders have a distinct visual style: dashed border, muted text, subtle background. This makes it clear the section is a scaffold to be filled in by the developer.

#### Existing Record Components (RecordList, RecordDetail, RecordForm)

In Phase 2, the hardcoded navigation and view architecture is replaced by the Router and view-driven pages. The existing RecordList, RecordDetail, and RecordForm components lose their callers and are **not generated in the output**. The generator source files for these components (`src/generator/components/RecordList.ts`, etc.) are kept in this project — Phase 3 will adapt and re-enable them when real block-type rendering is implemented.

`generateAllFiles()` in Phase 2 stops calling these generators and stops writing their output paths.

#### main.ts Changes

The entry point (`src/main.ts`) changes:
- Import and instantiate the Router instead of NavigationManager
- After successful login, call `router.navigate('home')` (or the ID of the first view in the array) instead of `initializeMainMenu()`
- Remove the hardcoded menu button setup (`initializeMainMenu` function deleted)

### Phase 3: Block-to-Component Rendering (Future)

**This phase is out of scope for the current spec** but documented here for context. Future work would:

- Implement real components for `blockType` values: `list` → RecordList, `form` → RecordForm, `detail` → RecordDetail, `table` → RecordTable, `card` → RecordCard, `text` → TextSection
- These would adapt the existing RecordList/RecordForm/RecordDetail generators, wiring them to the specific record type referenced by the block's `do` requirement `dataTypeId`
- Wire multi-record-type support so different blocks use different record types' API/Store
- Add a `blockType` selector to the full block creation/edit form
- Support changing a block's `blockType` after creation

## Acceptance Criteria

### Phase 1: Folder Restructure

- [ ] Generated app files are output to the new directory structure
  - `src/main.ts` as entry, `src/atproto/` for protocol files, `src/store.ts`, `src/router.ts`, `src/ui.ts`
  - `src/components/` for RecordList, RecordDetail, RecordForm
  - No `services/` folder in output
- [ ] All import paths in generated files are updated for new locations
- [ ] `index.html` script tag points to `src/main.ts`
- [ ] Generated app still builds and runs identically (same OAuth flow, same views, same behavior)
- [ ] Generator source files in `src/generator/` are reorganized to mirror output structure
- [ ] Existing tests updated for new file paths and imports

### Phase 2: View-Driven Pages + Block Types + Nav Menu

- [ ] `BlockType` type and `blockType` field added to `Block` interface in `src/types/wizard.ts`
- [ ] Blocks panel quick-create options set `blockType` when applicable
  - Navigate requirements show "Menu" as the first quick-create option (with `blockType: 'menu'`)
  - Know requirements' options set `blockType: 'text'`
  - Do-data requirements' options set `blockType: 'form'`, `'list'`, `'card'`, `'table'`, or `'detail'`
- [ ] `index.html` contains a single `#appContent` container instead of hardcoded view divs
- [ ] One view file is generated per wizard View in `src/views/`
  - File named from view name in PascalCase (e.g., `Home.ts`, `UserProfile.ts`)
  - Numeric suffix on filename collision
  - Exports a render function named `render[ViewName]View`
  - Views with no blocks show a heading and "No content defined for this view yet."
- [ ] Router is generated in `src/router.ts`
  - Registers all wizard Views with their render functions
  - `navigate(viewId)` clears `#appContent` and renders the target view
  - First view in `views[]` array shown after login
- [ ] Each view file renders its assigned blocks in order as `<section>` elements
  - Blocks with `blockType: 'menu'` render the NavMenu component
  - Blocks with other `blockType` values render as typed placeholders (showing the type label and requirement summaries)
  - Blocks with no `blockType` render as generic placeholders (requirement summaries only)
- [ ] NavMenu component generated for each `menu`-type block in `src/components/`
  - Renders links to views specified in the block's navigate requirement
  - Clicking a link calls `router.navigate()`
  - Falls back to all views if no navigate requirement provides menu items
- [ ] `src/main.ts` uses Router instead of NavigationManager
  - After login, navigates to first view
  - No hardcoded menu buttons
- [ ] Placeholder sections have a distinct visual style (dashed border, muted text) in generated `styles.css`
- [ ] Only blocks assigned to at least one view generate component files
- [ ] Generated app builds and runs: login works, views are navigable via nav menu

## Scope

**In scope:**
- Adding `blockType` field to Block interface and BlockType type
- Updating Blocks panel quick-create to set `blockType`
- Reorganizing the generated app's folder structure
- Reorganizing the generator source files to mirror output
- Generating view page files from wizard Views
- Generating a Router for view switching
- Generating NavMenu components for `menu`-type blocks
- Typed and generic placeholder rendering for non-menu blocks
- Updating existing tests for new paths
- Styles for nav menu and placeholder blocks in generated `styles.css`

**Out of scope:**
- Implementing real components for `list`, `form`, `detail`, `table`, `card`, `text` block types — Phase 3
- `blockType` selector in the full block creation/edit form — Phase 3
- Changing a block's `blockType` after creation — Phase 3
- Multi-record-type view generation — Phase 3
- Forward/back navigation component (placeholder only for now)
- Direct link navigation component (placeholder only for now)
- `queryMethods` / `procedureMethods` — inert, not addressed here
- `appConfig.primaryRecordType` and `appConfig.listDisplayFields` — these become less relevant as blocks drive the UI; cleanup deferred

## Files Likely Affected

### Generator source (this project)

**Moved/renamed (Phase 1):**
- `src/generator/AppEntry.ts` → `src/generator/app/Main.ts`
- `src/generator/services/Auth.ts` → `src/generator/atproto/Auth.ts`
- `src/generator/services/Types.ts` → `src/generator/atproto/Types.ts`
- `src/generator/services/Api.ts` → `src/generator/atproto/Api.ts`
- `src/generator/services/SessionManager.ts` → `src/generator/atproto/Session.ts`
- `src/generator/services/Store.ts` → `src/generator/app/Store.ts`
- `src/generator/services/UIState.ts` → merged into `src/generator/app/UI.ts`
- `src/generator/services/UIComponents.ts` → merged into `src/generator/app/UI.ts`
- `src/generator/services/Navigation.ts` → `src/generator/app/Router.ts`
- `src/generator/views/ListView.ts` → `src/generator/components/RecordList.ts`
- `src/generator/views/DetailView.ts` → `src/generator/components/RecordDetail.ts`
- `src/generator/views/FormView.ts` → `src/generator/components/RecordForm.ts`

**New (Phase 2):**
- `src/generator/views/ViewPage.ts` — generates a view page file from a wizard View
- `src/generator/components/NavMenu.ts` — generates nav menu component
- `src/generator/components/Placeholder.ts` — generates placeholder block sections

**Modified:**
- `src/generator/index.ts` — update all imports and output paths; add view/component generation loops
- `src/generator/templates/IndexHtml.ts` — replace hardcoded view divs with `#appContent`
- `src/generator/templates/Styles.ts` — add nav-menu and placeholder-block styles
- `src/generator/Readme.ts` — update generated file structure description

### Wizard source (this project)

- `src/types/wizard.ts` — add `BlockType` type and `blockType?: BlockType` field to `Block`
- `src/app/views/panels/BlocksPanel.ts` — restructure `QUICK_NAMES` to include `blockType`, add "Menu" option for navigate, pass `blockType` when creating blocks

### Tests

- `tests/` — update path expectations in existing tests, add tests for new generator modules

## Design Decisions

1. **Generated component filenames from block names:** Convert to PascalCase, strip non-alphanumeric characters (e.g., "Post Feed" → `PostFeed.ts`, "my cool thing!" → `MyCoolThing.ts`). Add numeric suffix on collision (e.g., `PostFeed.ts`, `PostFeed2.ts`).

2. **Menu block without a navigate requirement:** Fall back to including all views in the generated nav menu. The `blockType` is the generator's primary signal; missing requirement data gets sensible defaults rather than breaking generation.

3. **View naming collisions:** Add numeric suffix when two views produce the same PascalCase filename (e.g., `MyPage.ts`, `MyPage2.ts`).

4. **Default view after login:** The first view in the `views[]` array is shown. Ordering determines the default, not the name.

5. **Views with no blocks:** Render a heading with the view name and a message: "No content defined for this view yet."

6. **Unassigned blocks:** Don't generate component files for blocks not placed on any view. Only generate what's referenced.

7. **View IDs for the Router:** Derived as camelCase slugs from view names (e.g., "User Profile" → `'userProfile'`), with numeric suffix on collision.

8. **Component function naming:** Each block's component exports a uniquely-named render function derived from the block name (e.g., `renderMainMenu`, `renderPostFeed`). Avoids import aliasing when a view uses multiple components of the same type.

9. **Existing record components in Phase 2:** RecordList, RecordDetail, and RecordForm are not generated in the output (no callers). Generator source files are kept for Phase 3 to adapt.

## Behavioral Scenarios

**Scenario: Basic app with nav menu and two views**
- Setup: Wizard has two views ("Home", "Profile"). User creates a navigate-menu requirement, quick-creates a block by clicking "Menu" (setting `blockType: 'menu'`, named "Main Menu"), places it on both views. User creates a `do` requirement "view posts" on the Post data type, quick-creates a block by clicking "List" (setting `blockType: 'list'`, named "Post Feed"), places it on the Home view.
- Action: User clicks Generate/Download.
- Expected: Generated app has `src/views/Home.ts` and `src/views/Profile.ts`. Both pages render a nav menu with "Home" and "Profile" links. Home also has a typed placeholder section: heading "Post Feed", type label "List", requirement "view posts". Clicking "Profile" in the nav switches to the Profile page. Login flow works.

**Scenario: Quick-create sets blockType**
- Setup: User has a `do` requirement "create post" targeting the Post data type, shown in the unassigned section of the Blocks panel.
- Action: User clicks "+ Block" on the requirement, then clicks "Form" from the quick-create options.
- Expected: A block is created with `name: "Form"`, `blockType: 'form'`, and `requirementIds` containing this requirement.

**Scenario: Quick-create without blockType**
- Setup: User has a navigate requirement with `navType: 'direct'`, shown in the unassigned section.
- Action: User clicks "+ Block", then clicks "Link" from the quick-create options.
- Expected: A block is created with `name: "Link"`, `blockType: undefined`, and the requirement.

**Scenario: View with no blocks**
- Setup: Wizard has a "Settings" view with no blocks assigned.
- Action: User generates the app.
- Expected: `src/views/Settings.ts` is generated. The page renders a heading "Settings" and a message "No content defined for this view yet."

**Scenario: App with no menu block**
- Setup: Wizard has two views but no block with `blockType: 'menu'`.
- Action: User generates the app.
- Expected: Generated app has both view page files. The Router shows the first view after login. No nav menu is rendered. Navigation between views would require manual code additions.

**Scenario: Multiple menu blocks on different views**
- Setup: Three views: "Home", "Dashboard", "Settings". Block "Main Menu" (`blockType: 'menu'`, navigate requirement with `menuIncludeAllViews: true`) placed on Home. Block "Dashboard Nav" (`blockType: 'menu'`, navigate requirement with `menuItems` pointing to Dashboard and Settings only) placed on Dashboard and Settings.
- Action: User generates the app.
- Expected: Two NavMenu component files generated (`MainMenu.ts`, `DashboardNav.ts`). Home renders "Main Menu" with links to all three views. Dashboard and Settings render "Dashboard Nav" with links to only Dashboard and Settings.

**Scenario: Mixed blocks on a view**
- Setup: Home view has three blocks in order: "Main Menu" (`blockType: 'menu'`), "Welcome Message" (`blockType: 'text'`, containing a `know` requirement with text "Welcome to my app"), "Post Feed" (`blockType: 'list'`, containing a `do` requirement "view posts").
- Action: User generates the app.
- Expected: Home page renders three sections in order: a working nav menu, a typed placeholder showing "Text" with the welcome text, and a typed placeholder showing "List" with "view posts".

## How to Verify

### Phase 1
1. Generate an app with the existing wizard state and verify all files appear at new paths
2. Run `npm install && npm run build` in the generated app — compiles without errors
3. Run the generated app — OAuth login + CRUD works identically to before
4. Run `npx vitest run` in this project — all tests pass with updated path expectations

### Phase 2
1. Create a wizard state with 2+ views and various requirement types
2. Use quick-create to make blocks — verify `blockType` is set correctly for options that have one
3. Verify "Menu" appears as first option for navigate requirements in quick-create
4. Place blocks on views and generate
5. Verify generated app has correct view files in `src/views/` and NavMenu in `src/components/`
6. Run the generated app: login, click nav links, verify view switching
7. Verify placeholder blocks show block type labels and requirement summaries with placeholder styling
8. Run `npx vitest run` — all tests pass
