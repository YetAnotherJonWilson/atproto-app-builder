# Spec: Inlay Template Foundation — Primitive Reconciliation + Resolution

**Status:** draft
**Date:** 2026-04-13

## What

Bring the wizard's Inlay primitive set and compile pipeline into alignment
with the wire format that community template components actually use, and
add the minimal resolution machinery needed to turn a fetched template
record into a walkable tree with binding sites preserved.

This spec is the foundation for integrating community Inlay template
components. It does **not** wire templates into the wizard state, the
generator, or the UI — that lands in a follow-up spec (see
`.specs/active/inlay-template-components.md`, which this spec partially
supersedes).

## Why

Research into real community templates (danabra.mov's `NowPlaying`,
`AviHandle`) surfaced two coupled problems that block the integration
spec from landing:

1. **Primitive shape mismatches.** Our current `Link`, `Avatar`, `Cover`,
   and `Maybe` primitives don't match the shapes community templates
   actually use. Community `Link` carries `uri` (not `href`), community
   `Avatar` carries `did` and `src` (we only support `src`), and
   community templates use `at.inlay.Maybe` with `{children, fallback}` —
   not the `org.atsui.Maybe` with `{when, then, else}` we added in the
   primitive-expansion spec. Without reconciliation, we can render
   zero real community templates.

2. **The integration spec assumed `@inlay/render` is the right
   generation-time tool.** It isn't. `render()` is a single-step
   resolver that calls `resolveBindings` internally, which
   **destructively replaces** every `at.inlay.Binding` element with
   its scope value. That's what we want at runtime, but at compile
   time we need the binding paths preserved so we can emit insertion
   markers. The right tool at compile time is `@inlay/core`'s
   `deserializeTree` plus our own walker — the `@inlay/render`
   dependency stays in the wizard for future live-preview use, but
   the generation-time path never calls `render()`.

Resolving both is a prerequisite for any real end-to-end template
rendering. Keeping it in its own spec lets the follow-on integration
spec focus purely on wizard state, UI, and codegen.

## Architecture Context

This spec sits upstream of three tree sources described in
`inlay-template-components.md` § Architecture Context: community template
components, wizard-built primitive trees, and future user-authored trees.
Every primitive shape fix here benefits all three sources. Every
walker/compiler extension here removes work from downstream specs.

## Prerequisites

- `.specs/done/inlay-render-browser-spike.md` — complete. Confirmed
  `@inlay/render` bundles cleanly in the browser, but (as this spec
  formalizes) we will not invoke `render()` from the generation path.
- `.specs/done/inlay-primitive-expansion.md` — complete. This spec
  revises several decisions from it (see Primitive Reconciliation
  below). The earlier work is not reverted wholesale — text
  primitives (Stack, Row, Title, Heading, Text, Caption, Fill) stay
  as-is.
- `.specs/done/inlay-component-discovery.md` — complete. Provides the
  author list + PDS lookup machinery that resolution reuses.

## Background: What a real template looks like

Two fetched community templates (`NowPlaying`, `AviHandle`) were the
source of the shape findings below. Full JSON in
`docs/inlay-research.md` § Real community template shapes. Key
observations:

- `body.node` is a serialized element tree using `$: "$"` as a brand
  marker. `@inlay/core`'s `deserializeTree` replaces `"$"` with the
  real `BRAND` symbol; no other transform is needed.
- Elements have `{type, key?, props}`. Bindings are inline elements
  with `type: "at.inlay.Binding"` and `props: {path: [...]}`.
- Bindings appear not just as children, but as **prop values**:
  `{ uri: Binding(...), src: Binding(...), did: Binding(...) }`.
- Binding paths may use special segments (`$did`, `$collection`,
  `$rkey`) that parse AT URIs into components.
- `at.inlay.Maybe` has the shape
  `{ children: <then-tree>, fallback: <else-tree> }`. The "when" is
  implicit — if any binding inside `children` resolves to
  `at.inlay.Missing`, the fallback is used.

## Acceptance Criteria

- [ ] **Primitive reconciliation — Link** — `org.atsui.Link` prop
  renamed from `href` to `uri` in both `host-runtime.ts` and
  `compile.ts`. URL-ish detection, `target="_blank"`, and
  `rel="noopener noreferrer"` behavior unchanged. Unit tests updated
  to match. CSS unchanged.
  - This is a breaking change to the wizard's own tree builders if
    any emit `href`. Grep-and-fix any usage.

- [ ] **Primitive reconciliation — Avatar / Cover** — both primitives
  accept an optional `did` prop in addition to `src`. Rendering
  behavior for `did`-only at runtime is out of scope (that requires
  identity-to-avatar resolution, which happens in the follow-up spec).
  For this spec: when both runtime and compile encounter `did` as a
  prop with no `src`, they render the primitive with a `data-inlay-did`
  attribute on the wrapper and an empty `<img>` inside. The follow-up
  spec wires the real resolution. This keeps the compile path
  deterministic while the binding layer evolves.
  - `size` prop (e.g., `"small"`) added to `ATTRIBUTE_PROPS`.

- [ ] **Primitive reconciliation — Maybe** — `at.inlay.Maybe` added as
  a supported NSID in `host-runtime.ts` and `compile.ts`. Shape:
  `{ children: <then-tree>, fallback: <else-tree> }`. Rendering:
  - Runtime: if the `children` branch renders without any
    `at.inlay.Missing` descendants, render children; otherwise
    render `fallback` (or nothing if absent).
  - Compile: both branches are emitted into the HTML wrapped in a
    marker element (e.g., `<at-inlay-maybe data-branch="then|fallback">`)
    that runtime code can toggle based on binding-resolution outcome.
    Initial implementation can emit both branches and let the
    data-binding layer (next spec) decide which to show; this spec
    only needs the marker structure in place.
  - The earlier `org.atsui.Maybe` primitive added by
    `inlay-primitive-expansion.md` is **removed**. No community
    template uses it, and keeping two Maybe primitives would confuse
    the compile path. If any wizard code emits `org.atsui.Maybe`,
    migrate it to `at.inlay.Maybe`. (Grep suggests none does yet.)

- [ ] **Walker handles props, not just children** — both `compile.ts`
  and `host-runtime.ts` treat every prop value as potentially
  containing elements. The walker recurses into prop values and
  renders embedded elements (most importantly `at.inlay.Binding`
  and nested primitives) wherever they appear — not only under
  `props.children`. Behavior for string/number/boolean props is
  unchanged.

- [ ] **Binding path utilities** — a small shared module
  (`src/inlay/binding-path.ts`) exports helpers for:
  - Serializing a path array to a marker string (`"record.avatar"`,
    `"props.uri.$did"`)
  - Parsing a marker string back to a path array
  - Identifying which scope a path belongs to (`record` vs `props`)
  - Splitting on special segments (`$did`, `$collection`, `$rkey`)
    for downstream runtime code
  Used by compile.ts and the next spec's data-binding.ts. Unit tests
  cover round-trip and special segments.

- [ ] **`src/inlay/resolve.ts` — minimal resolution module** — a new
  module that takes an Inlay component AT-URI and returns a resolved
  template record in a deserialized form ready for compile.ts. No
  `@inlay/render` call, no lexicon resolver, no recursive nested-
  component expansion.
  - Input: AT-URI string.
  - Output: `{ templateTree, view, imports, uri } | { error }` where
    `templateTree` is the deserialized `body.node`.
  - Fetches the component record via the same PDS lookup path that
    `src/inlay/discovery.ts` uses. Reuses
    `resolveDidToPds` from discovery to keep the path consistent.
  - Rejects records whose `body.$type` is not
    `at.inlay.component#bodyTemplate`. External-body components are
    already filtered out by discovery; resolve.ts double-checks and
    returns a structured error if asked to resolve one.
  - Calls `deserializeTree` on `body.node`.
  - Nested component references (non-primitive NSIDs inside the
    tree) are **not** resolved in this spec. If the walker encounters
    one, compile.ts emits a "nested component unsupported" fallback
    node and the resolver reports which NSIDs were seen in its result
    (so downstream specs can gate which templates qualify). NowPlaying
    and AviHandle contain zero nested components and will fully resolve.

- [ ] **`compile.ts` emits binding markers** — when the walker hits an
  `at.inlay.Binding` element, it emits a marker DOM node (not a
  replacement value). Initial shape:
  - **Child binding** (binding is a child of a host element like
    `org.atsui.Text`): emit
    `<span data-inlay-bind="<serialized path>"></span>`.
  - **Attribute binding** (binding is a prop value of a host element
    like `org.atsui.Avatar` with `src: Binding(...)`): emit a
    `data-inlay-bind-<attr>="<serialized path>"` attribute on the
    host element. The runtime layer will read these attributes and
    set the corresponding DOM property.
  - Exact marker naming is an implementation detail; keep it
    documented at the top of compile.ts.

- [ ] **Unit tests against real community fixtures** — two JSON fixture
  files checked into `tests/fixtures/inlay/` containing the full
  `at.inlay.component` records for `NowPlaying` and `AviHandle`
  (captured verbatim from each author's PDS). Tests:
  - `resolve.ts` given each fixture URI (mocked fetch) returns a
    deserialized tree with bindings preserved.
  - `compile.ts` given each resolved tree produces HTML with the
    expected marker structure. Snapshot-style assertions are fine.
  - Walker prop-recursion test: an element with a Binding in a
    non-children prop (e.g., Avatar's `src`) produces an attribute
    marker on the outer element.
  - Maybe test: an `at.inlay.Maybe` with a `record.*` binding in
    `children` and a static `fallback` produces both branches
    wrapped in the maybe marker.

- [ ] **Cross-pipeline parity** — given the same input element tree,
  `host-runtime.ts` output (rendered DOM) and `compile.ts` output
  (HTML string) agree on structure. Tests cover at least Stack,
  Link, Avatar, at.inlay.Maybe, and a Binding.

- [ ] **No regressions on existing pipeline** — all text-variant tree
  tests still pass (`tests/inlay/text-variants.test.ts` or
  equivalent). `npm run verify` is green.

## Scope

**In scope:**
- Primitive shape reconciliation (Link, Avatar, Cover, Maybe)
- Removal of `org.atsui.Maybe`
- Walker extension to recurse into prop values
- `src/inlay/binding-path.ts` helpers
- `src/inlay/resolve.ts` minimal module
- `compile.ts` binding-marker emission
- Fixture-based unit tests for NowPlaying and AviHandle
- Research-doc updates to reflect wire-format findings

**Out of scope:**
- Wizard state additions (`inlayComponentRef` field)
- Generator wiring (`ViewPage.ts` branch)
- Runtime data-binding codegen (`data-binding.ts`)
- Record-selection semantics (which record a component binds at
  runtime)
- Selector UI in `ComponentsPanel`
- Nested component resolution (Profile → ProfilePosts etc.)
- Lexicon validation (we never call `validateProps`)
- End-to-end verification with a live PDS

## Files Likely Affected

- `src/inlay/element.ts` — remove `org.atsui.Maybe` constant; add
  `at.inlay.Maybe` constant
- `src/inlay/host-runtime.ts` — primitive shape fixes, walker extension,
  Maybe/Link/Avatar/Cover rewiring
- `src/generator/inlay/compile.ts` — mirror all host-runtime changes;
  add binding-marker emission
- New: `src/inlay/binding-path.ts`
- New: `src/inlay/resolve.ts`
- New: `tests/fixtures/inlay/nowplaying.json`
- New: `tests/fixtures/inlay/avihandle.json`
- New/updated: `tests/inlay/resolve.test.ts`
- New/updated: `tests/inlay/compile.test.ts`
- Updated: `tests/inlay/host-runtime.test.ts`
- Updated: `styles/inlay-primitives.css` if any selector depends on
  the changed shapes
- Updated: `docs/inlay-research.md` to reflect wire-format findings
- Updated: `.specs/active/inlay-template-components.md` to reference
  this spec as a prerequisite (or be superseded — see below)

## Ambiguity Warnings

1. **Removing `org.atsui.Maybe`**
   The earlier primitive-expansion spec added `org.atsui.Maybe` with a
   `{when, then, else}` shape. No community template uses it, and no
   wizard code appears to emit it yet, so removal should be
   clean. If grep uncovers usage, migrate those call sites to
   `at.inlay.Maybe` as part of this spec.
   - _Likely assumption:_ no live usage; removal is safe.
   - _Please confirm or clarify:_ any known wizard-built trees that
     use the old shape?

2. **Avatar `did`-only rendering**
   When a community template sets `did` on an Avatar without a
   resolvable `src`, the primitive is supposed to fetch the avatar
   blob based on the identity. Full resolution is a downstream
   concern. This spec emits an empty `<img>` with a
   `data-inlay-did="<serialized path>"` attribute and lets the
   follow-up data-binding layer fill it in.
   - _Likely assumption:_ acceptable placeholder behavior for a
     foundation spec. Visible but unstyled.
   - _Please confirm or clarify:_ OK to ship with empty-avatar
     rendering until the binding layer catches up?

3. **Binding marker shape**
   Two competing conventions:
   - `data-inlay-bind="<path>"` on a wrapper `<span>` for children;
     `data-inlay-bind-<attr>` on the host element for attributes.
   - A single convention using wrapper nodes everywhere, with
     attribute bindings also wrapped.
   The first is lighter-weight and closer to the DOM semantics
   runtime code will want. The second is more uniform.
   - _Likely assumption:_ go with the first (per-attribute
     attributes) — it's simpler to emit and parse.
   - _Please confirm or clarify:_ OK, or prefer the uniform
     wrapper-everywhere version?

4. **Nested component encounter handling**
   When the walker hits an NSID that is neither a known primitive nor
   `at.inlay.Binding` / `at.inlay.Maybe`, it's presumably a reference
   to another Inlay component (not yet supported). This spec emits a
   visible `<div class="inlay-unresolved-component">` fallback and
   records the NSID in the resolve result so downstream code can
   decide whether to block the user from attaching a template that
   uses it.
   - _Likely assumption:_ visible fallback + structured warning is
     sufficient for the foundation; the integration spec decides
     whether to grey out incompatible templates in the selector.
   - _Please confirm or clarify:_ OK?

## How to Verify

1. `npx vitest run tests/inlay/` — all new and existing tests pass.
2. `npm run build` — TypeScript compiles.
3. `npm run verify` — build + vitest + playwright all green.
4. Manual smoke: load the wizard, open the host-runtime dev harness
   (if one exists) or render a small tree containing Link, Avatar,
   and at.inlay.Maybe; confirm DOM matches expectation.
5. Resolve `at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying`
   via `resolve.ts` in a test or scratch call; confirm the returned
   tree contains the two `at.inlay.Binding` nodes at the expected
   paths.
