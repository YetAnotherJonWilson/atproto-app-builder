# Spec: Inlay Template Components (Option B)

**Status:** ready
**Date:** 2026-04-09

## What

Enable generated apps to render real Inlay template components from the AT
Protocol ecosystem. Users browse existing community components (e.g.,
ProfileHeader, Post), associate them with blocks, and the generator produces
apps that resolve and render those components with live AT Protocol data.

This replaces the old block-component-rendering spec (2026-03-23), which
predated the Inlay integration decision.

## Why

The generator currently renders non-menu, non-text blocks as placeholder stubs.
Option A (completed) proved out the Inlay primitive rendering pipeline for static
text content. Option B extends this to data-bound components: blocks that display
AT Protocol records using community-authored Inlay templates. This makes
generated apps functional and connects them to the growing Inlay component
ecosystem rather than maintaining our own rendering code for each block type.

## Prerequisite

This spec assumes the rename from "blocks" to "components" has been completed
(`.specs/active/rename-blocks-to-components.md`). Throughout this spec, the
term "component" refers to the renamed wizard concept (formerly "block"), and
"Inlay component" refers specifically to a community-authored Inlay template
component fetched from a PDS. Where ambiguity could arise, the distinction is
made explicit.

## Background

See `docs/inlay-research.md` for full Inlay architecture context. Key points:

- Template components are JSON element trees with data bindings, stored as AT
  Protocol records in the `at.inlay.component` collection
- The `@inlay/render` package handles resolution, template deserialization,
  binding resolution, and recursive tree expansion
- The host (our generated app) only needs to implement the "last mile" — mapping
  primitives (org.atsui.*) to DOM elements
- Option A already implemented this last mile in `src/inlay/host-runtime.ts`
- Component discovery uses hardcoded author DIDs + `com.atproto.repo.listRecords`

Known component authors:
| Handle | DID | Components |
|--------|-----|------------|
| danabra.mov | did:plc:fpruhuo22xkm5o7ttr2ktxdo | 16 |
| dansshadow.bsky.social | did:plc:rm4mmytequowusm6smpw53ez | 4 |

## Acceptance Criteria

- [ ] **Component discovery** — The wizard can fetch and display available Inlay
  template components from known authors
  - On opening the component browser, the system fetches `at.inlay.component`
    records from each known author's PDS
  - Components are displayed with their NSID, description, and author
  - Components are filterable/browsable by what record collection they render
    (via their `view` field)

- [ ] **Component creation flow** — Creating a new data-displaying component
  starts from the data type, not from a category
  - The user picks a data type (record collection) for the new component
  - The system shows compatible Inlay components (auto-suggested by matching
    `view.accepts` against the chosen data type)
  - The user selects an Inlay component, or opens the browse fallback to
    explore all components
  - Special-case component types (menu, static content) remain creatable as
    distinct, non-data-displaying options

- [ ] **Inlay component association** — A component can be associated with an
  Inlay component reference
  - When editing a data-displaying component, the user can open the Inlay
    component browser
  - Selecting an Inlay component stores a reference (AT-URI) on the wizard
    component
  - The component card in the Components panel shows the associated Inlay
    component name
  - A component's Inlay component reference can be changed or removed

- [ ] **Generator produces working component code** — Blocks with associated
  Inlay components generate functional rendering code
  - The generator resolves the template component's element tree at generation
    time (using `@inlay/render` or equivalent resolution logic)
  - The generated code includes the compiled DOM structure from the resolved
    primitive tree
  - Data bindings become runtime fetch + insertion points (the hybrid approach)
  - The generated app fetches AT Protocol records at runtime and fills in bound
    values
  - Components render correctly with live data from the user's PDS

- [ ] **Primitives beyond text** — The host runtime and compile pipeline support
  all primitives needed by discovered template components
  - Layout primitives: Stack, Row, Fill, Grid, Clip (extend beyond current set)
  - Media primitives: Avatar, Blob, Cover
  - Navigation: Link, Timestamp
  - Framework: Maybe, Fragment, Loading

- [ ] **Fallback for unassociated blocks** — Blocks without a component
  association still render (placeholder or default)

## Scope

**In scope:**
- `@inlay/render` integration for template resolution and binding analysis
- Component discovery from hardcoded author DIDs
- UI for browsing and selecting components in the Blocks panel
- Block type additions to store component AT-URI reference
- Generator changes to produce hybrid compiled+runtime code
- Extending host-runtime.ts and compile.ts for additional primitives
- CSS for additional Inlay primitives in generated apps

**Out of scope:**
- External components (bodyExternal / XRPC endpoints) — template only for now
- Form blocks / input primitives / actions system
- Running our own firehose ingester for discovery
- User-authored custom components
- Menu blocks (already have their own rendering)
- Text blocks with contentNodes (already handled by Option A)

## Code Context

### Existing Option A code to extend

**`src/inlay/element.ts`** — Defines the `InlayElement` interface
(`{ type: string; props: Record<string, unknown> }`), the `el()` shorthand
constructor, and an `NSID` constants object. Currently exports constants for
Stack, Row, Title, Heading, Text, Caption, Fill. **Extend** the NSID constants
with the additional primitives this spec needs (Avatar, Blob, Cover, Grid,
Clip, Link, Timestamp, Maybe, Fragment, Loading).

**`src/inlay/host-runtime.ts`** — Renders an `InlayElement` tree to live DOM
elements. Used by the wizard for live previews. Has:
- `nsidToTag(nsid)` — converts `org.atsui.Stack` → `org-atsui-stack`
- `ARIA_ROLES` map for accessibility attributes
- `ATTRIBUTE_PROPS` set listing prop names that become HTML attributes
- `KNOWN_PRIMITIVES` set listing supported NSIDs (currently just Stack, Row,
  Title, Heading, Text, Caption, Fill)
- `renderToDOM(element)` — main entry point; returns an `inlay-error` div for
  unknown primitives

**Extend** by adding new primitives to `KNOWN_PRIMITIVES`, ARIA roles where
appropriate, attribute props for new prop types, and any special-case rendering
logic (Avatar needs an `<img>` child, Link needs an `<a>` wrapper, etc.).

**`src/generator/inlay/compile.ts`** — Compile-time analog of host-runtime.ts;
serializes an `InlayElement` tree to an HTML string for the generator's output.
**Mirrors** the same maps (ARIA_ROLES, ATTRIBUTE_PROPS) and rendering rules.
Keep this in sync with host-runtime.ts when adding primitives. Has
`compileToHtml(element)` as the main entry point.

**`src/inlay/text-variants.ts`** — Maps wizard `ContentNode` and `TextVariant`
types to `InlayElement` trees. Reference for how to construct trees from
typed inputs (relevant if we end up generating trees from generator code
rather than only resolving them from external Inlay components).

### AT Protocol infrastructure to plug into

**`src/generator/atproto/Api.ts`** — Generates CRUD code (create, update,
delete, get*, list with pagination). The generated app's data fetching for
Inlay components should use this same pattern — generate per-record-type
fetcher functions in the same style.

**`src/generator/atproto/Session.ts`** — Generates the session manager that
restores auth and loads all record types on app init via `loadUserData()`.
Inlay component data fetches should integrate here so they happen on app
startup, the same way other record loads do.

**`src/generator/app/Store.ts`** — Generates the global reactive store with
typed getters/setters per record type. Inlay component renderers should read
from this store rather than fetching independently.

**Identity resolution flow** (for generation-time component discovery from
PDSes — not required at runtime in generated apps):
1. Resolve handle → DID via `com.atproto.identity.resolveHandle` on
   `public.api.bsky.app`
2. Look up DID doc at `https://plc.directory/{did}`
3. Extract PDS URL from `#atproto_pds` service entry
4. Call `com.atproto.repo.listRecords?repo={did}&collection=at.inlay.component`

The user has a memory note (`feedback_bsky_public_api.md`) preferring
`public.api.bsky.app` for unauthenticated XRPC calls — apply that here.

### `@inlay/render` package

- npm package name: `@inlay/render`
- Source: tangled.sh/danabra.mov/inlay (per research doc)
- API surface: `render()` returns `{ node, props, context, cache }`;
  `node === null` means "this is a primitive — host renders the resolved
  props"
- Behavior: handles template deserialization, binding resolution against scope,
  external component XRPC calls (not needed for this spec, template-only),
  import stack resolution, recursive expansion, depth limiting (default 30)

**Browser compatibility unknown** — Must test before relying on it. If it
fails to bundle/run in the wizard's Vite/browser context, fall back per
Ambiguity 2 (Cloudflare Worker preferred, custom reimplementation as last
resort).

## Files Likely Affected

### Wizard side
- `package.json` — add `@inlay/render` dependency
- `src/types/wizard.ts` — Add `inlayComponentRef?: string` field to the
  `Component` type (renamed from `Block` per prerequisite). Stores the AT-URI
  of the associated Inlay component.
- `src/app/views/panels/ComponentsPanel.ts` (renamed from `BlocksPanel.ts` per
  prerequisite) — Add component browser UI: data type selector → suggested
  Inlay components → selection. Minimal interface this spec; polished browser
  in follow-up spec.
- New: `src/inlay/discovery.ts` — Fetch `at.inlay.component` records from
  known author PDSes via the resolution flow above. Returns metadata
  (description, view.accepts collections, body type) for browsing.
- New: `src/inlay/resolve.ts` — Generation-time template resolution. Wraps
  `@inlay/render` (or our reimplementation). Inputs an Inlay component AT-URI;
  outputs a fully-resolved primitive tree with binding locations identified.

### Inlay primitive support (extends Option A)
- `src/inlay/element.ts` — Extend `NSID` constants for new primitives
- `src/inlay/host-runtime.ts` — Extend `KNOWN_PRIMITIVES`, `ARIA_ROLES`,
  `ATTRIBUTE_PROPS`; add special-case rendering for Avatar/Link/Blob/etc.
- `src/generator/inlay/compile.ts` — Mirror the host-runtime extensions for
  compile-time rendering
- New CSS for additional primitives (location TBD; either `styles/` for the
  wizard or `src/generator/templates/Styles.ts` for generated apps, or both)

### Generator side
- `src/generator/views/ViewPage.ts` — Add a new branch in the component
  rendering loop (currently has branches for `menu`, `text`, and placeholder
  fallback). New branch: components with an `inlayComponentRef` use the
  hybrid output — emit the compiled DOM structure plus runtime data fetch
  code that fills bindings with record data.
- New: `src/generator/inlay/data-binding.ts` — Given a resolved Inlay
  template tree with bindings, emit the JavaScript code that fetches the
  bound record from the Store and inserts values at the binding sites in
  the static DOM structure.
- `src/generator/index.ts` — Top-level orchestration; ensure the new
  generator paths are wired in and any new files are written.

## Implementation Approach

Suggested order:

1. **Browser compatibility test** — Install `@inlay/render`, try importing
   it in the wizard, run a trivial render call. If it works, use it. If not,
   resolve Ambiguity 2 (Cloudflare Worker or custom reimplementation).
2. **Component discovery** — Build `src/inlay/discovery.ts` standalone first;
   verify it can fetch components from danabra.mov's PDS and parse out the
   metadata.
3. **Primitive expansion** — Extend host-runtime and compile.ts with the
   primitives needed by at least one real community component (e.g.,
   ProfileHeader from danabra.mov uses Stack, Row, Avatar, Title, Caption,
   Maybe, Text — implement those first). Add unit tests for each new primitive
   in both runtime and compile paths.
4. **Resolution pipeline** — Build `src/inlay/resolve.ts` that takes an Inlay
   component AT-URI and returns a resolved primitive tree.
5. **Data binding generator** — Build `src/generator/inlay/data-binding.ts`
   that emits runtime fetch+insert code from a resolved tree's binding sites.
6. **Wire into ViewPage.ts** — Add the new branch for components with an
   `inlayComponentRef`.
7. **Type and state changes** — Add `inlayComponentRef` to the Component type;
   update state migration if needed.
8. **Minimal selection UI** — Add a basic data-type-first selector to
   ComponentsPanel that lists compatible Inlay components and stores the
   selection on the component. Polish deferred to follow-up spec.
9. **End-to-end verification** — Create a wizard project, attach a real
   community Inlay component to a wizard component, generate, run the output
   app, verify live data renders.

## Ambiguity Warnings

1. **When does resolution happen?** — RESOLVED
   Hybrid approach: resolution at generation time, data fetching at runtime.
   The generator uses `@inlay/render` (or equivalent) to expand the Inlay
   template to a fully-resolved primitive tree, then compiles that to code with
   "holes" for data bindings. The generated app has no `@inlay/render`
   dependency — it ships vanilla JS that creates the DOM structure (frozen at
   generation time) and fetches AT Protocol records at runtime to fill in bound
   values. Components are "frozen" at generation time; regenerating the app
   picks up any updates to the source Inlay component.

2. **Does `@inlay/render` work in the browser?** — PARTIALLY RESOLVED
   Approach: try `@inlay/render` browser-side first (it runs at generation time
   in the wizard, which is a browser-based Vite app). If browser use is blocked
   by Node.js dependencies, the preferred fallback is running resolution
   server-side in our existing Cloudflare Worker infrastructure. Reimplementing
   the resolution logic ourselves remains a third option but is not preferred.
   Final decision deferred until we test browser compatibility during
   implementation.

3. **Component browser UX** — RESOLVED (partially)
   Approach: auto-suggest compatible Inlay components based on the component's
   data type, with a browse fallback for exploration. Designed assuming the
   Inlay component ecosystem will grow large (thousands of components), so the
   architecture supports both selection paths.

   This spec includes only a **minimal selection interface** sufficient to
   verify the pipeline works. The polished component browser (search,
   filtering, preview, mockups) is deferred to a follow-up spec so this spec
   can focus on the underlying machinery.

4. **What about blocks without `do` requirements?**
   Card and detail blocks for displaying data need a `do` requirement with a
   `dataTypeId` to know which record collection to fetch. If a block has no `do`
   requirement, should the component browser still be available? What data would
   the component bind to?
   - _Likely assumption:_ Component association only available on blocks that
     have a `do` requirement with a `dataTypeId`, since data bindings require
     knowing the record collection.
   - _Please confirm or clarify._

5. **Block type vs. component type** — RESOLVED
   `blockType`/`componentType` becomes obsolete for data-displaying components.
   What matters is the data type (record collection) the component can display,
   declared via the Inlay component's `view.accepts` field. Special-case
   non-data components (menu for navigation, static content for text, future
   form components for input) remain as distinct component types. After the
   rename prerequisite, the model is: most components reference an Inlay
   component and a data type; a few components are special-case types.

6. **Handling components that use unimplemented primitives** — RESOLVED
   When the generator (or generated app) encounters an Inlay primitive that our
   host runtime doesn't implement yet, render a visible fallback — a styled
   warning element showing the unsupported primitive's NSID. Primitive support
   expands iteratively: when a user picks a community component that needs
   Cluster, the first generation shows fallbacks where Cluster would be, then
   we add Cluster support and regenerate. We do not block component selection
   based on primitive support, and we do not try to implement all 19 primitives
   upfront.

## Integration Boundaries

### AT Protocol PDS (Component Discovery)
- **Data flowing in:** `at.inlay.component` records from known author PDSes
- **Expected contract:** `com.atproto.repo.listRecords` with
  `collection=at.inlay.component`; each record has `view`, `body`, `imports`,
  `description` fields per Inlay lexicon
- **Unavailability:** Show "unable to load components" message; blocks can still
  function without component association (placeholder fallback)

### @inlay/render (Template Resolution)
- **Data flowing in:** Component record (body, view, imports)
- **Data flowing out:** Resolved primitive tree with binding locations identified
- **Expected contract:** `render()` function returns
  `{ node, props, context, cache }`; `node === null` means primitive
- **Unavailability:** Generation-time only; if resolution fails, fall back to
  placeholder rendering for that block

## How to Verify

1. Open the wizard, create a block with a `do` requirement targeting a record type
2. Open the component browser, see available Inlay components
3. Filter to components that render the matching record collection
4. Select a component (e.g., a Post or ProfileHeader template)
5. Generate the app
6. Run the generated app — verify the block renders live AT Protocol data using
   the selected component's layout/structure
7. Verify blocks without component associations still render (placeholder)
8. Verify changing a block's component regenerates correctly
