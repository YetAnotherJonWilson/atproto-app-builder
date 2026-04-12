# Spec: @inlay/render Browser Compatibility Spike

**Status:** ready
**Date:** 2026-04-11

## What

A short, de-risking spike: install `@inlay/render`, import it into the
wizard (a Vite-based browser app), and attempt a trivial `render()`
call. Determine whether the package works in a browser environment, and
if not, pick a fallback approach and document it.

The outcome changes what later specs in the Inlay template-components
initiative look like. This is a single-session task whose deliverable
is a decision, not a feature.

## Why

The hybrid rendering strategy in `inlay-template-components.md` assumes
generation-time template resolution via `@inlay/render`. The wizard is
a browser app, and "generation time" for us runs in that browser. If
`@inlay/render` bundles and runs fine in Vite/browser, the integration
spec proceeds as written. If it depends on Node APIs or fails to
bundle, we need a different mechanism — and that branch point affects
discovery, resolution, and codegen specs downstream.

Settling this in an isolated spike prevents blocking the rest of the
initiative on an unknown.

## Acceptance Criteria

- [ ] `@inlay/render` installed as a wizard dependency in `package.json`
- [ ] A throwaway test file or temporary import in an existing
  bootstrap path imports `render` and calls it on a minimal input
- [ ] `npm run build` succeeds — or fails with a clear, documented
  diagnostic — with the import present
- [ ] The dev server runs and the trivial render call either returns a
  sensible result or throws a clear, reproducible error in the browser
  console
- [ ] A decision is recorded in this spec's "Outcome" section:
  - **Works** → proceed with browser-side resolution as the default
    in the integration spec
  - **Doesn't work** → the preferred fallback is chosen (Cloudflare
    Worker > custom reimplementation), with a one-paragraph reason
- [ ] Throwaway test code is removed at the end of the spike. If the
  "works" outcome justifies keeping the dependency, note that here
- [ ] BACKLOG.md and `inlay-template-components.md` are updated to
  reference the outcome

## Scope

**In scope:**
- Installing the package
- A single trivial import + call
- Recording the outcome

**Out of scope:**
- Any real resolution against actual community components
- Any wizard UI
- Any generator-side work
- Implementation of the fallback if "doesn't work" — that becomes its
  own spec, informed by this outcome

## Files Likely Affected

- `package.json`, `package-lock.json` — dependency
- One throwaway file or one existing init path — temporary import
- This spec — outcome recorded below
- `.specs/active/inlay-template-components.md` — prerequisite status
  updated
- `BACKLOG.md` — marked done

## Outcome

- **Decision:** **Works.** Proceed with browser-side resolution as the default
  in `inlay-template-components.md`. Keep `@inlay/render ^0.3.1` as a wizard
  dependency.
- **Reasoning:** A throwaway `runInlayRenderSpike()` imported `render` and
  `$` from `@inlay/render` / `@inlay/core`, built an `at.inlay.Text` element,
  and called `render(element, {imports: []}, {resolver: noopResolver})` in
  `src/app.ts`'s `DOMContentLoaded` handler. `npm run build` (tsc + Vite)
  succeeded and the Vite dev server served the page cleanly. The browser
  console logged `[inlay-render-spike] OK {node: null, context, props}` —
  the expected early-return for `at.inlay.*` primitive types — with zero
  errors or warnings from the render code path. The package bundles fine
  for the browser; no Node-only APIs are reached on this path.
- **Caveats / notes for follow-up specs:**
  - Bundle impact: installing `@inlay/render` (plus transitive
    `@atproto/lexicon`, `@atproto/syntax`, `@inlay/core`) grew the main
    chunk from ~1.3 MB to ~1.47 MB gzipped-before ~333 KB. Acceptable for
    now; lazy-loading the render path is a future optimization if needed.
  - Rollup prints one harmless warning about a misplaced
    `/*#__PURE__*/` comment in
    `node_modules/@inlay/render/dist/generated/at/inlay/component.defs.js`.
    No action required.
  - Installing `@inlay/render` bumped `@atproto/common-web` 0.4.18 → 0.4.20,
    which tightens `Date.toISOString()`'s flow type to a branded template
    literal. This produced a pre-existing-style TS error at
    `src/app/services/ProjectService.ts:148`; fixed in place with a
    one-line cast (`as typeof now`). Downstream specs should expect the
    branded datetime type to show up anywhere we round-trip `createdAt`
    through `Record<string, unknown>`.
  - The trivial primitive-type path does not exercise `Resolver`. The
    template-components integration spec still needs to prove that
    resolution I/O works in the browser (fetching lexicons, records,
    and XRPC calls via the user's agent). That's in-scope for the
    integration spec, not this spike.
- **Throwaway code removed:** `src/inlay/render-spike.ts` deleted; the
  temporary call in `src/app.ts` removed. The `@inlay/render` dependency
  is retained because downstream specs will use it.
- **Date:** 2026-04-11
