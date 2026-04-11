# Spec: Inlay Template Components — Integration

**Status:** ready
**Date:** 2026-04-11

## What

Wire community-authored Inlay template components into the wizard's
generator so that components whose requirement is `do` + dataTypeId
can be associated with an Inlay template, and the generator produces
working code that renders that template against live AT Protocol
data. This is the integration step of the Option B initiative — it
assumes discovery, primitive support, and the `@inlay/render` browser-
compatibility question have been handled in their own specs.

This replaces the earlier block-component-rendering spec (2026-03-23),
which predated the Inlay integration decision.

## Why

Generated apps currently render non-menu, non-text components as
placeholder stubs. Option A proved out the primitive rendering
pipeline for static text. This spec is the final step of Option B —
turning a user's "display posts" or "show profile" intent into working
rendered output, using community-authored Inlay templates as the
rendering source for data-bound components.

## Architecture Context

This spec is one piece of a larger architectural model: **every
wizard component is rendered as an Inlay primitive tree**, compiled
to static HTML at generation time with runtime "holes" for dynamic
data. The tree can be sourced three ways:

1. **Community Inlay template components** — data-bound trees
   authored by the Inlay community, resolved via `@inlay/render` at
   generation time. Only meaningful for components whose requirement
   includes a data type (record collection), because templates
   declare `view.accepts` against a collection. **This spec wires
   this source into the generator.**
2. **Wizard-built primitive trees** — trees we construct directly in
   wizard code from the requirement's shape. Already used for `know`
   requirements via `src/inlay/text-variants.ts`. Covers requirements
   that don't map to a data-bound template. Follow-up spec:
   `wizard-built-primitive-trees.md`.
3. **User-authored trees** (future, out of scope).

Both sources (1) and (2) flow through the same compile pipeline
(`src/generator/inlay/compile.ts`) and the same host runtime
(`src/inlay/host-runtime.ts`). The only difference is how the tree
is built.

The current `menu` component is an exception: it uses hand-built
NavMenu code rather than a primitive tree, predating this model.
Migration is tracked in
`menu-component-primitive-tree-migration.md`.

## Prerequisites

- `inlay-render-browser-spike.md` — decision on whether
  `@inlay/render` runs in the browser, and if not, the fallback
  mechanism chosen. This spec's resolution module sits on top of the
  outcome.
- `inlay-component-discovery.md` — discovery module returning
  metadata-tagged components from known authors, consumed by the
  selection UI.
- `inlay-primitive-expansion.md` — primitives needed by the first
  target template component (and any others the selection UI will
  surface) implemented in both runtime and compile pipelines.
- `.specs/done/rename-blocks-to-components.md` — "blocks" renamed to
  "components" throughout the wizard.

## Background

Inlay template components are JSON element trees with data bindings,
stored as AT Protocol records. A template declares `view.accepts`
against a record collection; when rendered with a record URI, bindings
like `{record.displayName}` resolve against the fetched record's
fields. See `docs/inlay-research.md` for deeper background.

The strategy is **hybrid compile-time + runtime**: resolution runs at
generation time (producing a frozen primitive tree for each
component), and the generated app does only the final data fetch and
DOM insertion at runtime. The generated app ships no `@inlay/render`
dependency — it's vanilla JS that knows exactly what DOM to build
and where to plug in record fields.

## Acceptance Criteria

- [ ] **Inlay component association on wizard components** — users
  can attach an Inlay template reference to a component whose
  requirement is `do` + dataTypeId.
  - Qualifying components show an "attach Inlay component" control
    in the Components panel
  - Clicking opens a minimal picker that lists discovered components
    compatible with the component's data type (filtered by
    `view.accepts`)
  - A "browse all" fallback lists every discovered component
    regardless of compatibility
  - Selection stores the AT-URI on the wizard component as
    `inlayComponentRef`
  - The component card surfaces the associated template's name
  - The reference can be changed or cleared

- [ ] **Association restricted to `do` + dataTypeId components** —
  other requirement types don't expose the association UI.

- [ ] **Generation-time resolution** — during generate, each component
  with an `inlayComponentRef` is expanded to a fully-resolved
  primitive tree via the resolution module, which uses
  `@inlay/render` or the fallback chosen by the spike. The compile
  pipeline then produces HTML with binding sites marked.

- [ ] **Runtime data binding** — generated code for each resolved
  template includes JavaScript that reads the bound record from the
  generated app's Store and writes values into the frozen DOM
  structure at binding sites. Record fetching goes through the
  existing generated `Session`/`Api`/`Store` layer; no duplicate
  fetch code.

- [ ] **Generator wiring** — `src/generator/views/ViewPage.ts` has a
  new branch: components with an `inlayComponentRef` emit compiled
  primitive-tree HTML plus binding code, alongside the existing menu
  and text branches.

- [ ] **Fallback for unresolvable templates** — if resolution fails
  at generation time (missing author, malformed record, missing
  primitive), the generator emits a visible fallback placeholder for
  that component and logs a warning. Generation does not abort.

- [ ] **Fallback for unassociated components** — components without
  an `inlayComponentRef` continue to render as the current
  placeholder stub until another source (wizard-built trees)
  replaces it.

- [ ] **End-to-end verification** — a wizard project with a real
  community Inlay template generates and runs correctly against a
  user's PDS with live data visible.

## Scope

**In scope:**
- `src/inlay/resolve.ts` — generation-time template resolution using
  `@inlay/render` or the chosen fallback
- `src/generator/inlay/data-binding.ts` — code emission for runtime
  fetch + insert at binding sites
- `src/generator/inlay/compile.ts` — extended to emit deterministic
  markers at binding sites in compiled HTML
- `src/types/wizard.ts` — `inlayComponentRef?: string` on
  `Component`; state migration if needed
- `src/app/views/panels/ComponentsPanel.ts` — minimal selection UI
- `src/generator/views/ViewPage.ts` — new generator branch
- `src/generator/index.ts` — orchestration if new files need writing
- End-to-end verification with a real community template

**Out of scope:**
- Component discovery infrastructure — `inlay-component-discovery.md`
- Primitive expansion — `inlay-primitive-expansion.md`
- `@inlay/render` browser compatibility decision —
  `inlay-render-browser-spike.md`
- External-body components (`bodyExternal`, XRPC endpoints)
- Polished component browser UX (search, preview, filtering) —
  deferred to a follow-up
- Form components / input primitives / actions (blocked on Inlay
  ecosystem)
- Menu component migration
- Wizard-built primitive trees for other requirement types

## Code Context

**`src/inlay/resolve.ts`** (new) — takes an Inlay component AT-URI,
runs the resolution pipeline (via `@inlay/render` or the chosen
fallback), and returns a fully-resolved primitive tree with binding
locations identified. Consumed by the generator during component
compilation.

**`src/generator/inlay/compile.ts`** — already compiles an
`InlayElement` tree to HTML. For this spec, it needs to emit
deterministic markers (attribute or placeholder node) at binding
sites so runtime insertion code can find them.

**`src/generator/inlay/data-binding.ts`** (new) — given a resolved
template tree with binding locations, emits JavaScript that:
1. Reads the bound record from the generated app's Store
2. Walks the frozen DOM structure to each binding site
3. Inserts text / attribute values / image sources per the binding's
   target

**`src/generator/atproto/Session.ts` / `Api.ts` /
`src/generator/app/Store.ts`** — existing generated session, API,
and store layers. Data binding reads from the Store, not from
independent fetches.

**`src/app/views/panels/ComponentsPanel.ts`** — current panel. Adds
the minimal selector for choosing an Inlay template on qualifying
components, using results from `src/inlay/discovery.ts` (prereq
spec).

**`src/types/wizard.ts`** — add `inlayComponentRef?: string` to the
`Component` type. If existing persisted state is affected, add a
migration in `src/app/state/WizardState.ts`.

## Files Likely Affected

- `src/types/wizard.ts` — `inlayComponentRef` field
- `src/app/state/WizardState.ts` — migration if needed
- `src/app/views/panels/ComponentsPanel.ts` — minimal selector UI
- New: `src/inlay/resolve.ts`
- New: `src/generator/inlay/data-binding.ts`
- `src/generator/inlay/compile.ts` — binding site markers
- `src/generator/views/ViewPage.ts` — new branch for
  `inlayComponentRef` components
- `src/generator/index.ts` — orchestration if needed

## Implementation Approach

Suggested order (all prerequisite specs assumed complete):

1. **Wizard state + type changes** — add `inlayComponentRef` to the
   `Component` type and state migration. Unit test persistence
   round-trip.
2. **Resolution module** — build `src/inlay/resolve.ts` on top of
   whatever the spike decided. Unit test against a mocked component
   record.
3. **Binding-site markers** — extend `compile.ts` to emit
   deterministic markers at binding sites.
4. **Data-binding codegen** — build
   `src/generator/inlay/data-binding.ts` that emits runtime
   fetch+insert code from a resolved tree. Unit test against a
   fixture.
5. **ViewPage integration** — add the new branch in
   `src/generator/views/ViewPage.ts`. Generator snapshot test for
   the output shape.
6. **Minimal selection UI** — add the attach-component control and
   picker to `ComponentsPanel`.
7. **End-to-end verification** — wizard project with a real Profile
   template; generate; run; log in; verify live data renders.

## Ambiguity Warnings

1. **Hybrid approach at generation time** — RESOLVED
   Resolution at generation time, data fetching at runtime. The
   generator resolves the template, compiles to HTML with binding
   markers, and emits runtime fetch+insert code. The generated app
   ships vanilla JS and has no `@inlay/render` dependency. Templates
   are frozen at generation time; regenerating picks up template
   updates.

2. **Component browser UX** — PARTIALLY RESOLVED
   This spec ships a **minimal selector** (compatible list + browse
   all). A polished browser (search, filtering, preview) is deferred
   to a follow-up so this spec can focus on the machinery.

3. **Association scope** — RESOLVED
   Inlay template association is only available on components whose
   requirement is `do` + dataTypeId (see Architecture Context).

4. **Handling unimplemented primitives** — RESOLVED
   Fallback to a visible warning element showing the primitive's
   NSID. Primitive support expands iteratively; component selection
   is not blocked on full primitive coverage. Standardization of
   this fallback lives in `inlay-primitive-expansion.md`.

## Integration Boundaries

### Template resolution backend (@inlay/render or fallback)
- **Data flowing in:** component record (`body`, `view`, `imports`)
  plus any data needed for binding locations
- **Data flowing out:** resolved primitive tree with binding
  locations identified
- **Expected contract:** `render()`-style API returning resolved
  tree / primitive nodes, regardless of whether the spike selected
  `@inlay/render` directly or a fallback
- **Unavailability:** generation-time only; failure falls back to a
  placeholder for the affected component without aborting

### Generated app's Store / Api layer
- **Data flowing in (at generated-app runtime):** AT Protocol records
  bound to template components
- **Expected contract:** the existing typed getters the generator
  already produces for each record type
- **Unavailability:** record-fetch failures render a loading/empty
  state at the binding site (existing Store behavior)

## How to Verify

1. Create a wizard project; add a data type matching a real Inlay
   template's `view.accepts` (e.g., `app.bsky.actor.profile`)
2. Add a component with a `do` requirement targeting that data type
3. Open the component, attach an Inlay template from the selector
4. Confirm the component card shows the template's name
5. Generate the app
6. Run the generated app, log in with the PDS user
7. Verify the component renders live data using the template's
   layout
8. Change the template to a different one; regenerate; verify update
9. Remove the association; regenerate; verify placeholder fallback
10. Attach a template that uses a not-yet-implemented primitive;
    verify visible warning element
