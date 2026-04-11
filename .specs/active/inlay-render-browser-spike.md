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

_To be filled in after running the spike._

- **Decision:**
- **Reasoning:**
- **Date:**
