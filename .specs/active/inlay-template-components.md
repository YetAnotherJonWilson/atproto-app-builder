# Spec: Inlay Template Components — Wizard Wiring, Generator, UI

**Status:** ready
**Date:** 2026-04-18 (rewritten against the foundation that landed 2026-04-16)

## What

Wire community-authored Inlay template components into the wizard. A user
can attach an Inlay template to a `do` + dataTypeId component; the generator
resolves and compiles that template to HTML at generation time, and emits
runtime code that fetches the bound record via the existing `Api`/`Store`
layer and fills the binding markers. The end result: a wizard project that
uses a real community template (NowPlaying, AviHandle) renders that
template's layout against the user's live PDS data.

This spec builds on `.specs/done/inlay-template-foundation.md`, which
already delivered the resolution module, binding-path utilities, primitive
reconciliation, and compile-time binding markers. Everything below is the
integration layer on top of that foundation.

## Why

After the foundation landed, the wizard can fetch a community template
record, deserialize it, and compile it to HTML with binding markers — but
nothing in the wizard knows how to _use_ that pipeline yet. `do` +
dataTypeId components still render as placeholder stubs. This spec turns
the foundation into a user-visible feature: choose a template, generate,
see live data.

## Architecture Context

This spec is source **(1)** in the tree-source architecture described in
`.specs/done/inlay-template-foundation.md` § Architecture Context:
community-authored data-bound templates. Sources (2) wizard-built trees
and (3) user-authored trees are separate specs
(`wizard-built-primitive-trees.md`, future).

All three sources flow through the same compile pipeline
(`src/generator/inlay/compile.ts`) and produce the same binding-marker
HTML shape. The data-binding codegen introduced here is reusable by
future sources — it reads markers, not template metadata.

The strategy remains **hybrid compile-time + runtime**:

- **Generation time:** resolve the template record (foundation's
  `resolveInlayTemplate`), compile its tree to HTML with markers, emit
  runtime JS that knows which record to fetch and which markers to fill.
- **Runtime (generated app):** fetch the bound record through the
  generated `Api`/`Store` layer, walk the DOM for binding markers,
  substitute values. No `@inlay/render` or `@inlay/core` ships in the
  generated app.

## Prerequisites

- `.specs/done/inlay-template-foundation.md` — **complete (2026-04-16).**
  Delivered: `resolveInlayTemplate`, binding-path utilities, primitive
  reconciliation (Link.uri, Avatar.did/src, at.inlay.Maybe),
  `compile.ts` binding markers, fixture coverage for NowPlaying and
  AviHandle.
- `.specs/done/inlay-component-discovery.md` — complete. Provides
  `discoverInlayComponents()` for the selector UI.
- `.specs/done/inlay-primitive-expansion.md` — complete. Primitive
  runtime + compile coverage.

## Background

A brief recap — full detail in the foundation spec and
`docs/inlay-research.md`.

- An Inlay template is an AT Protocol record at
  `at://<did>/at.inlay.component/<rkey>`. Its `body.node` is a
  serialized element tree.
- `view.accepts` declares the record type the template consumes (e.g.,
  `app.bsky.actor.profile`).
- Bindings appear as child elements (`Text > Binding`) or as prop values
  (`Avatar { src: Binding(...) }`). The foundation compiles these as:
  - Child: `<span data-inlay-bind="record.displayName"></span>`
  - Attribute: `<img data-inlay-bind-src="record.avatar">` (or
    `data-inlay-bind-href` on `<a>`)
- `at.inlay.Maybe` compiles to two wrapped branches; the fallback has
  `style="display:none"`. Branch visibility is swapped at runtime when
  the children branch has unresolved bindings.

## Acceptance Criteria

- [x] **`inlayComponentRef` field on Component** — the `Component` type
      in `src/types/wizard.ts` gains `inlayComponentRef?: string` (AT-URI).
  - Existing persisted projects load without error; the field is simply
    absent. No migration required unless validation rejects unknown
    fields (grep `WizardState.ts` — if strict, add a pass-through).
  - Field round-trips through save/load. Unit test covers this.

- [ ] **Attach control in the Components panel** — when a component's
      primary requirement is `do` with a `dataTypeIds` selection, its
      card in `ComponentsPanel` shows an "Attach Inlay component" control.
  - Clicking opens a picker dialog.
  - Picker lists discovered components whose `view.accepts` is
    compatible with the component's data type's published NSID
    (matched against the RecordType's NSID, not its display name).
  - A "Show incompatible" toggle expands the list to every discovered
    component regardless of `view.accepts`.
  - Selecting a row stores that component's AT-URI on the wizard
    component as `inlayComponentRef` and closes the picker.
  - If the component already has an `inlayComponentRef`, the card
    shows the attached component's name, a "Change" button that
    reopens the picker, and a "Remove" button that clears the field.
  - The picker is purely selection — no preview, no search, no
    filtering beyond compatibility.

- [ ] **Attach control is hidden when not applicable** — components
      whose primary requirement isn't `do` with `dataTypeIds`, or whose
      selected data type has no published NSID, do not show the control.
      The placeholder fallback continues to render for them.

- [x] **Generator resolves attached templates at generation time** —
      during `generator/index.ts` orchestration, each component with an
      `inlayComponentRef` is resolved via `resolveInlayTemplate` before
      `ViewPage.ts` runs.
  - Resolution results are collected into a map keyed by component id.
  - A single component is resolved at most once per generation run.
  - Failure (any `ResolveError` or an `unresolvedComponents` array
    with entries) is recorded on the component's entry; generation
    does **not** abort.

- [ ] **ViewPage emits a new branch for `inlayComponentRef`
      components** — `src/generator/views/ViewPage.ts` gets a branch that
      runs before the text/menu/placeholder branches:
  - Successful resolution: emit
    - the compiled HTML (via `compileToHtml`), wrapped in a
      `.app-component.inlay-root` section
    - a generated function call that binds the component at runtime,
      e.g. `bindComponent${i}(container)`
  - Resolution failure (error or unresolved nested components):
    emit a visible warning placeholder naming the failing NSID /
    error code. This is the same shape the compile path already uses
    for unresolved primitives — `<div class="inlay-unresolved-component">`.

- [x] **Runtime data-binding codegen** — a new module
      `src/generator/inlay/data-binding.ts` exports a function that, given
      a resolved template and the wizard component's chosen record type,
      emits a TypeScript snippet that:
  - Imports the existing generated getter for the record type
    (e.g. `getProfiles`) from `./atproto/Api`.
  - Imports `storeManager` from `./app/Store`.
  - Exposes a `bindComponent${i}(container: HTMLElement): Promise<void>`
    function that:
    1. Reads the record list from the store (or calls the getter if
       the list is empty — same pattern views already use to hydrate).
    2. Picks the first record (record-selection = first item in this
       spec; see Ambiguity #1).
    3. For each `[data-inlay-bind]` element in the container: replaces
       its text content with the resolved path value (escaped).
    4. For each `[data-inlay-bind-<attr>]` attribute: sets the
       corresponding DOM attribute (`src`, `href`, `did`, etc.) to
       the resolved path value.
    5. For each `<at-inlay-maybe>` wrapper: if any binding inside
       `[data-inlay-branch="children"]` resolved to missing, hide
       children (`display:none`) and show fallback (clear its inline
       style). Otherwise leave them as-emitted.
  - Handles special path segments per `parseBindingPath`:
    - `$did` / `$collection` / `$rkey` — parse them from the
      record's `uri` (it's already an AT-URI string).
    - Plain `record.<field>` — index into the record object.
    - `props.*` — not supported in this spec (no component nesting);
      resolves to missing.
  - Missing / null / undefined field values flow through the Maybe
    branch-toggle logic as "missing".
  - When a binding writes the `did` attribute on an `<img>` element
    (i.e. `data-inlay-bind-did` on `<img>`, or the as-emitted
    `data-inlay-did` from a literal Avatar), the bind function calls
    the avatar resolver (next criterion) and sets `src` to the
    returned URL instead of leaving the DID as the attribute value.
    For non-`<img>` elements, the DID is set as the attribute value
    as today.

- [x] **DID → avatar URL resolver in the generated app** — a new
      runtime helper (e.g.
      `src/generator/atproto/Identity.ts` →
      `generated-app/atproto/identity.ts`) exports
      `resolveDidToAvatar(did: string): Promise<string | null>`.
  - Calls `app.bsky.actor.getProfile` on
    `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=<did>`
    (per the public-API convention; no auth required).
  - Returns the response's `avatar` URL, or `null` if the profile
    has no avatar or the request fails (network error, 404, malformed
    response). Failures are logged but do not throw.
  - In-memory cache keyed by DID for the lifetime of the page; the
    same DID is fetched at most once per session.
  - A `null` result causes the bind function to leave `src` unset on
    the `<img>` and treat the binding as "missing" for surrounding
    Maybe branches (so a Maybe wrapper around the avatar collapses
    to its fallback as expected).

- [ ] **Runtime imports in the generated view file** — the view page
      file imports the generated `bindComponent${i}` functions and calls
      them after constructing the DOM. The bind functions ship as
      per-component inline code inside the view file (not a separate
      generated file) for locality. The view file also imports
      `resolveDidToAvatar` from `./atproto/identity` when any bind
      function in that view writes a DID to an `<img>`.

- [ ] **Data type NSID match drives picker compatibility** — the
      picker compares the wizard data type's published NSID against each
      discovered template's `view.accepts`. Matching is exact string
      equality. If the data type has no published NSID (user hasn't
      published the lexicon yet), the compatible list is empty and the
      picker opens with the incompatible toggle on by default so the
      user isn't blocked.

- [x] **Session resolution cache shared by panel and generator** — a
      new module-level cache (e.g.
      `src/inlay/resolve-cache.ts` exporting
      `resolveInlayTemplateCached(uri)` and `_resetResolveCache()`)
      memoizes `resolveInlayTemplate` results for the lifetime of the
      session. Both the ComponentsPanel render path and
      `generator/index.ts` use this cached call so a template fetched
      for the panel badge isn't re-fetched at generate time.
  - The cache stores both `ResolvedTemplate` and `ResolveError`
    outcomes — once we know a URI is broken, we don't keep retrying
    in the same session.
  - Test reset hook follows the same `_reset…` convention as
    `discovery.ts`.

- [ ] **Wizard-time broken-template badge** — when ComponentsPanel
      renders a card whose component has `inlayComponentRef`:
  - On render, kick off `resolveInlayTemplateCached(uri)`. If the
    cache already holds a result, use it synchronously; otherwise
    render a neutral "Checking template…" state and re-render the
    card when the promise resolves.
  - If the cached/fetched result is a `ResolveError` (any code:
    `network`, `not-template`, `external-body`), the card shows a red
    badge with the text **"Template no longer available"** adjacent
    to the attached template name. The Change and Remove buttons
    remain functional.
  - If the result is a successful `ResolvedTemplate`, no badge —
    even if `unresolvedComponents` is nonempty (that surfaces at
    generate time as the existing placeholder).
  - The badge is purely visual; it does not block generation. The
    generator continues to emit the existing failure placeholder for
    broken refs.
  - Re-attaching (Change → pick a working template) clears the
    badge on the next render once the new URI resolves successfully.

- [ ] **No `@inlay/*` packages in the generated app** — the generator
      output imports nothing from `@inlay/core`, `@inlay/render`, or the
      wizard's `src/inlay/*` modules. All required logic is inlined into
      the generated code or uses the existing generated `Api`/`Store`.
      (A grep in the generated `dist/` output would confirm this.)

- [ ] **End-to-end verification with two real templates** — verified
      manually against a live PDS:
  1. Wizard project with a data type published against
     `app.bsky.actor.profile` + a component with `do` requirement →
     attach `at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.AviHandle`
     → generate → run → log in → profile fields render.
  2. Same flow with a NowPlaying-compatible record type and
     `mov.danabra.NowPlaying` attached.

- [ ] **Verify pipeline is green** — `npm run verify` (build + vitest
  - playwright) passes.

## Scope

**In scope:**

- `inlayComponentRef?: string` on the `Component` type
- Picker UI in `ComponentsPanel` (minimal — compatible list, browse-all
  toggle, select / change / clear)
- `src/generator/inlay/data-binding.ts` — runtime fetch+fill codegen
- `src/generator/views/ViewPage.ts` — new branch for attached templates
- `src/generator/index.ts` — orchestrate generation-time resolution
- Runtime handling of child bindings, attribute bindings, Maybe branch
  toggle, and `$did`/`$collection`/`$rkey` special segments
- DID → avatar URL resolver in the generated app, calling
  `app.bsky.actor.getProfile` on `public.api.bsky.app`
- Session resolution cache shared by panel and generator
- Wizard-time "Template no longer available" badge for cards whose
  `inlayComponentRef` resolves to a `ResolveError`
- End-to-end verification with NowPlaying and AviHandle

**Out of scope:**

- Pluggable identity resolution (this spec hardcodes the Bluesky
  public API; future spec abstracts the resolver behind an interface)
- Record-list / looping templates (binds to first record only)
- `props.*` bindings (requires component nesting, which the foundation
  punts on — unresolved-component fallback covers this)
- Nested Inlay component resolution (Profile → ProfilePosts etc.)
  The foundation's `resolveInlayTemplate` reports these; this spec's
  generator treats any nonempty `unresolvedComponents` as a resolution
  failure for now.
- Polished picker UX (search, preview, tag filters) — follow-up spec
- External-body components (`bodyExternal`) — filtered by foundation
- Menu component migration to primitive trees — separate spec
- Wizard-built primitive trees for other requirement types — separate
  spec
- Live preview of attached templates in the wizard itself (the
  `@inlay/render` path remains available for this but is not wired
  up here)

## Files Likely Affected

- `src/types/wizard.ts` — `inlayComponentRef?: string` on `Component`
- `src/app/state/WizardState.ts` — confirm persistence round-trip; add
  migration only if current validation would reject unknown fields
- `src/app/views/panels/ComponentsPanel.ts` — attach/change/clear
  control, picker dialog invocation
- New: `src/app/dialogs/InlayComponentPickerDialog.ts` — exports
  `showInlayComponentPicker(component): Promise<string | null>`,
  following the `wizard-dialog` pattern used by `PromptDialog` /
  `ProjectPickerDialog` / `LoginDialog`
- New: `src/inlay/resolve-cache.ts` — session cache wrapping
  `resolveInlayTemplate` (mirrors the `_reset…` convention in
  `discovery.ts`); used by both the panel and the generator
- New: `src/generator/inlay/data-binding.ts`
- New: `src/generator/atproto/Identity.ts` (template
  source for `generated-app/atproto/identity.ts`, holding
  `resolveDidToAvatar`)
- `src/generator/views/ViewPage.ts` — new branch, imports, per-component
  bind-function emission
- `src/generator/index.ts` — resolve attached templates up front,
  thread results into view generation
- Updated: tests under `tests/generator/inlay/` and `tests/app/panels/`
- Updated: `BACKLOG.md` once landed

## Resolved Decisions

These came out of the rewrite against the foundation; calling them out
so the implementer doesn't re-litigate them.

1. **Resolution happens at generation time, not on attach** — the
   picker stores an AT-URI only. Validation (is it resolvable?
   compatible? uses known primitives?) runs at generate time.
   Rationale: attachment is cheap and repeatable; resolution is
   network + bundle weight we don't want on every keystroke.
2. **Single resolution pass per component per generate** — resolved
   templates are collected in a map; no re-fetch inside `ViewPage.ts`.
3. **Maybe branch toggle is runtime, not compile time** — the compile
   path already emits both branches with the fallback hidden; runtime
   only needs to flip visibility when a required binding is missing.
4. **Data-binding codegen is per-component inline, not a shared module
   in the generated app** — simpler to read in generated output, no
   cross-file coupling, trivial to tree-shake.

## Ambiguity Warnings

1. **Record selection: first record** _(resolved 2026-04-20)_ —
   Runtime binds against the **first record** in the generated list
   (falling back to empty if none exist, which triggers Maybe fallback
   branches). List/loop templates and per-record selection UI are
   deferred to a future spec.

2. **Generated app identity resolution for Avatar `did`-only**
   _(resolved 2026-04-20: wire it now)_ — DID → avatar URL resolution
   is part of this spec, via a generated `resolveDidToAvatar` helper
   that calls `app.bsky.actor.getProfile` on `public.api.bsky.app`.
   See the corresponding acceptance criterion for behavior, caching,
   and failure handling. Hardcoding a Bluesky-CDN call into an
   otherwise PDS-agnostic generator is a known tradeoff; a pluggable
   identity resolver is left as a follow-up.

3. **Picker placement — dialog** _(resolved 2026-04-20)_ — The picker
   uses a native `<dialog>` element following the existing
   `wizard-dialog` pattern (see `ProjectPickerDialog`, `PromptDialog`,
   `LoginDialog`). Implemented as an async helper
   `showInlayComponentPicker(component): Promise<string | null>` that
   resolves to the chosen AT-URI or `null` on cancel. Inline expansion
   in the card was considered and rejected to avoid pushing other
   cards around and to reuse the established dialog plumbing.

4. **Resolution failures: wizard badge + runtime placeholder**
   _(resolved 2026-04-20)_ — Both surfaces. ComponentsPanel renders a
   red "Template no longer available" badge on cards whose
   `inlayComponentRef` resolves to a `ResolveError` (any of
   `network` / `not-template` / `external-body`). The generator
   continues to emit its visible placeholder at generate time.
   Resolution results are cached per session in a shared cache so
   the panel and the generator make at most one fetch per URI per
   session.

## Integration Boundaries

### Foundation's `resolveInlayTemplate`

- **Data flowing in:** AT-URI string
- **Data flowing out:** `ResolvedTemplate` (with `templateTree`, `view`,
  `imports`, `unresolvedComponents`) or `ResolveError` (`network` |
  `not-template` | `external-body`)
- **Expected contract:** as implemented in `src/inlay/resolve.ts`
- **Unavailability:** treat any error or nonempty
  `unresolvedComponents` as a resolution failure; emit placeholder

### Foundation's `compileToHtml`

- **Data flowing in:** deserialized `InlayElement` tree
- **Data flowing out:** HTML string with `data-inlay-bind[-attr]`
  markers and Maybe branch wrappers
- **Expected contract:** as implemented in
  `src/generator/inlay/compile.ts`
- **Unavailability:** N/A (pure function)

### Generated `Api` / `Store`

- **Data flowing in (at generated-app runtime):** AT Protocol record
  of the component's bound record type
- **Expected contract:** the existing typed getter
  (`get<RecordType>s`) and `storeManager` store. The bind function
  uses the list, picks the first entry, and reads fields by name.
- **Unavailability:** empty list → every `record.*` binding is
  missing → Maybe fallbacks render; non-Maybe bindings resolve to
  empty string / unset attribute

## Behavioral Scenarios

**Scenario: Attach a compatible template to a profile component**

- Setup: wizard has a data type published as `app.bsky.actor.profile`,
  and a component with a `do` requirement referencing that data type.
- Action: open the ComponentsPanel, click "Attach Inlay component" on
  the component, select `mov.danabra.AviHandle`.
- Expected outcome: picker closes, the card shows "AviHandle" with
  Change / Remove buttons. Project state holds `inlayComponentRef =
"at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.AviHandle"`.

**Scenario: Generate and run a project with attached template**

- Setup: project from the previous scenario, user is logged into a
  PDS with a profile record.
- Action: run Generate; run the generated app; log in.
- Expected outcome: the component renders the template's layout
  (avatar + handle), populated with the logged-in user's profile.
  The avatar `<img>` has its `src` resolved to the user's actual
  avatar URL via a single `getProfile` call to `public.api.bsky.app`.

**Scenario: Avatar binding for a DID with no profile avatar**

- Setup: same project, but the logged-in user's profile record has
  no `avatar` field (or `getProfile` returns no avatar URL).
- Action: render the page.
- Expected outcome: `resolveDidToAvatar` returns `null`; the `<img>`
  has no `src`. If the avatar binding sits inside a Maybe wrapper,
  the children branch hides and the fallback shows; otherwise the
  `<img>` simply renders empty.

**Scenario: Repeated avatar bindings hit the cache**

- Setup: a template renders the same DID's avatar more than once on
  one page (e.g., header + footer both show the user's avatar).
- Action: render the page.
- Expected outcome: exactly one `getProfile` request is made; the
  second `<img>` reads its `src` from the in-memory cache.

**Scenario: Template references a nested component**

- Setup: user attaches a template whose tree contains a non-primitive
  NSID (e.g., `mov.danabra.Profile` which nests `ProfilePosts`).
- Action: generate.
- Expected outcome: generator emits a visible `.inlay-unresolved-component`
  placeholder for that component with the unresolved NSID named;
  other components in the project generate normally.

**Scenario: Data type has no published NSID yet**

- Setup: user has a draft data type (never published to PDS), a
  matching `do` component.
- Action: open the picker.
- Expected outcome: compatible list is empty; "Show incompatible"
  toggle is on by default; user can still pick a template if they
  want to preview the flow.

**Scenario: User clears an attached template**

- Setup: component has `inlayComponentRef` set.
- Action: click "Remove".
- Expected outcome: `inlayComponentRef` is undefined; card returns to
  showing the Attach control; next generate produces a placeholder
  stub again.

**Scenario: Attached template's author deleted the record**

- Setup: `inlayComponentRef` points to an AT-URI that now 404s.
- Action: generate.
- Expected outcome: `resolveInlayTemplate` returns `{ code: 'network' }`
  (or similar); generator emits a visible failure placeholder naming
  the AT-URI; generation completes.

**Scenario: Wizard surfaces a broken attached template**

- Setup: `inlayComponentRef` on a card points to an AT-URI that
  resolves to a `ResolveError` (e.g., the author deleted it).
- Action: open the ComponentsPanel.
- Expected outcome: the card briefly shows "Checking template…",
  then renders a red **"Template no longer available"** badge next
  to the attached template name. Change and Remove buttons stay
  functional. Within the same session, opening the panel again does
  not re-fetch (cached).

**Scenario: User fixes a broken attached template**

- Setup: card from the previous scenario is showing the red badge.
- Action: click Change, pick a different template that resolves
  successfully, close the picker.
- Expected outcome: the new URI is fetched (cache miss), resolution
  succeeds, the badge clears on the next render. Generating now
  produces the template's compiled HTML, not the failure placeholder.

## Implementation Approach

Suggested order. Each step is independently testable.

1. **Wizard state + type** — add `inlayComponentRef?: string`. Confirm
   persistence round-trip test covers it. One commit.
2. **Session resolution cache** — add `src/inlay/resolve-cache.ts`
   with `resolveInlayTemplateCached` and `_resetResolveCache`. Unit
   test cache hit / miss / error caching. One commit.
3. **Resolution collection in `generator/index.ts`** — resolve all
   attached templates up front via the cache, build a map. Unit test
   with mocked `resolveInlayTemplate`. One commit.
4. **DID → avatar resolver** — add the
   `generated-app/atproto/identity.ts` template with
   `resolveDidToAvatar` (cached, never throws). Unit test the
   in-memory cache and the null-on-failure path with a stubbed
   `fetch`. One commit.
5. **Data-binding codegen** — `src/generator/inlay/data-binding.ts`,
   pure function `compileBindFunction(resolved, recordType,
componentIndex)`. Special-cases `<img>`+DID by emitting a
   `resolveDidToAvatar` call. Unit test against the NowPlaying and
   AviHandle fixtures (assert on emitted code shape + a jsdom run
   through with `fetch` stubbed). One commit.
6. **ViewPage branch** — wire resolution results and bind-function
   emission into `ViewPage.ts`; conditionally import
   `resolveDidToAvatar`. Snapshot test the full generated view file
   for a minimal project with one attached template. One commit.
7. **Picker UI + broken-template badge** — `ComponentsPanel` attach
   control + picker dialog using `discoverInlayComponents()`; cards
   with `inlayComponentRef` resolve via the session cache and show
   the red "Template no longer available" badge on `ResolveError`.
   One commit.
8. **End-to-end verification** — manual run against a live PDS with
   both NowPlaying and AviHandle; capture any findings as follow-ups.
   One commit (spec + backlog update).

## How to Verify

1. `npx vitest run tests/generator/inlay/ tests/app/panels/` — all
   new unit tests pass.
2. `npm run build` — TypeScript compiles; no imports from
   `@inlay/core` or `@inlay/render` appear in `dist/generated-app/*`.
3. `npm run verify` — build + vitest + playwright all green.
4. Manual E2E per Behavioral Scenarios 1–2 above against
   `did:plc:fpruhuo22xkm5o7ttr2ktxdo`'s templates.
