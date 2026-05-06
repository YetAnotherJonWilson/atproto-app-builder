---
name: Grocery List demo script
description: Click-by-click walkthrough for demoing and smoke-testing the App Wizard end-to-end by building a grocery checklist app
type: demo
---

# Demo script: Grocery List app

**Status:** draft (depends on `checklist-component.md` shipping; several open questions — see bottom)
**Date:** 2026-05-02 (revised 2026-05-05)

## What this is

A literal, click-by-click script for exercising the App Wizard end-to-end. The end product is a single-view ATProtocol app with a profile component (rendered via a community Inlay template), a header, and a checklist of grocery items persisted to the user's PDS.

This doc serves two distinct purposes with **different scopes**:

1. **Live demo rehearsal (full flow).** A presenter walks the wizard end-to-end, generates a real app, runs it, and writes real PDS records during the demo. Maximum impact. Slow per run.
2. **Smoke test for wizard changes (short flow).** An internal verification that the wizard's flagship paths still work after a code change. **Stops before lexicon publishing and zip generation.** Generator-output correctness and runtime behavior are covered by separate test layers (TBD — see Open Questions).

A future Playwright spec under `e2e/grocery-list.spec.ts` could codify either mode once the surrounding decisions are made.

## Prerequisites

- Wizard is running locally (`npm run dev`) or pointed at a deployed instance.
- Demo presenter has a Bluesky / ATProtocol account they can log in with via OAuth.
- The danabra.mov Inlay profile template is reachable on the network (used in the Components step).
- `checklist-component.md` is implemented and merged.

## Walkthrough

Steps 0–4 are identical for both modes. Steps 5–6 diverge — see the per-step notes.

### Step 0 — New project

1. Open the wizard.
2. Log in via OAuth (existing flow).
3. Create a new project.
4. **App name:** `Grocery List`
5. **Description:** `A simple checklist for what I need at the store, saved to my PDS.`
6. **Author name:** demo presenter's name.

### Step 1 — Requirements

Add three requirements in this order:

**Requirement A — `know` (heading + intro):**
- Type: Information (`know`)
- Text: `A grocery checklist that saves to my PDS.`
- Variant: paragraph (default)

(One paragraph is enough; the header itself comes from the view name. If you want a styled heading too, add a second `know` requirement of variant "heading" with text `My Grocery List`.)

**Requirement B — `do` (profile):**
- Type: Interaction (`do`)
- Description: `Show my profile at the top of the app.`
- + Data Type → Adopt existing lexicon → search `app.bsky.actor.profile` → Adopt.

**Requirement C — `do` (grocery items):**
- Type: Interaction (`do`)
- Description: `Add, check off, and remove grocery items.`
- + Data Type → New lexicon → name: `groceryItem`.

### Step 2 — Data

Two record types now exist:

**`profile`** (adopted from `app.bsky.actor.profile`) — no edits needed; fields are locked by the adopted lexicon.

**`groceryItem`** (new) — define fields:
- `text` — string, required, max length ~300 (graphemes)
- `checked` — boolean, optional, default false
- `createdAt` is added automatically as a system datetime field.

> **TBD — lexicon namespace handling.** The walkthrough assumes the default `thelexfiles` user namespace, which publishes a real lexicon record to `protopunx.bsky.social` on Generate. For smoke-test mode (and for repeat live demos to avoid republishing), we need to pick one of:
> - **a.** Use a stable pre-published `groceryItem` lexicon at a fixed NSID; demos adopt it instead of creating a new one. (Smallest change — we'd add an "Adopt existing lexicon" path for grocery item too.)
> - **b.** Use the `thelexfiles-temp` auto-publish namespace (already referenced in the legacy failure-modes table) and accept that records pile up under temp.
> - **c.** Add a "dry-run publish" mode to the wizard so smoke-test mode can verify the publish is *wired up* without actually writing to a PDS.
> - **d.** Tolerate idempotent re-publish: if `groceryItem` already exists under the user's namespace with the same schema, the publish is a no-op.
>
> See Open Questions #1.

### Step 3 — Components

Three components, in the order they'll appear on the view:

**Component 1 — `Profile`:**
- Quick-create on Requirement B → choose any default name; rename to `Profile`.
- Click "Attach Inlay component" on the resulting card.
- In the picker, choose the danabra.mov profile template (NSID `app.bsky.actor.profile`, body type Template).
- Confirm the card now shows the Inlay badge.

**Component 2 — `Header`:**
- Quick-create on Requirement A → choose "Paragraph" (or "Heading" if Requirement A's text was the heading).
- (Optional) edit the component to add a second content node — e.g. heading "My Grocery List" plus the existing paragraph.

**Component 3 — `Grocery List`:**
- Quick-create on Requirement C → choose **"Checklist"**.
- The card placeholder shows the "Checklist" type label. No further config.

### Step 4 — Views

Single view:

- Click `+ New View`. Name: `Home`.
- Assign components in this order: `Profile`, `Header`, `Grocery List`.
- No navigation requirements. Skip the navigation panel.

### Step 5 — Generate (mode-dependent)

**Smoke-test mode:**

- Open the Generate panel and confirm the wizard reaches a "ready to generate" state: app config form populated (primary record type `groceryItem`, output method `zip`), Generate button enabled, no validation errors visible.
- **Stop here.** Do not click Generate. The generator's output correctness is verified by separate tests (see Open Questions #2).

> **TBD — what "ready to generate" should assert.** Concretely we want a small checklist of UI assertions (button state, summary text, lexicon list, component list) that a human or Playwright run can verify in seconds. Needs to be drafted alongside whichever generator-output test layer we adopt.

**Live demo mode:**

- App config: primary record type `groceryItem`, output method `zip` (or GitHub if a repo is wired up).
- Click Generate.
- Download / push the artifact.

> **TBD — repeat-demo zip handling.** Per-demo generation + `npm install` adds ~60–90s of friction. For live demos run frequently we'll want one of:
> - **a.** A persistent `node_modules` cache (or pnpm shared store) on the demo machine; freshly generated tree gets copied in and runs in seconds. Preserves "fresh artifact" property.
> - **b.** A pre-baked installed copy refreshed periodically (sacrifices "this is the actual code we just generated" — only acceptable if generator-output tests have caught up).
> - **c.** Accept the friction and budget the install time into the demo.
>
> See Open Questions #3.

### Step 6 — Run the generated app (live demo mode only)

Skipped entirely in smoke-test mode. Coverage of the generated app's runtime behavior is delegated to a separate test layer (TBD — see Open Questions #2).

```bash
unzip grocery-list.zip
cd grocery-list
npm install
npm run dev
```

- Open the app in a browser.
- Log in via OAuth.
- Verify:
  - Profile component renders the user's avatar + handle (via the Inlay template).
  - Header renders the heading + paragraph.
  - Checklist shows an input + Add button and an empty state message.
- Add three items: `Milk`, `Eggs`, `Bread`.
- Check off `Eggs`. Refresh — `Eggs` should still be checked.
- Delete `Bread`. Refresh — `Bread` should be gone.
- Open `pdsls.dev` (or another PDS browser) and confirm the records exist under the user's repo at the expected `groceryItem` collection.

## What to highlight during the demo

(Live demo mode only; smoke-test runs are not narrated.)

- **Three layers of "where the UI comes from":**
  1. Built-in primitive (the heading/paragraph from the text component).
  2. Community-published Inlay template (the profile component — emphasize: not coded by the wizard, fetched from another user's PDS).
  3. Wizard-generated widget (the checklist — emphasize: full CRUD against the user's own PDS, no backend).
- **No server.** The generated app talks directly to the user's PDS via OAuth.
- **The data is portable.** Switch to `pdsls.dev` mid-demo and show the same records that the checklist just wrote.

## Failure modes to be ready for

(Live demo mode. Smoke-test mode stops before any of these can occur.)

| Symptom | Likely cause | Recovery |
|---|---|---|
| Profile component shows "Inlay template … failed (...)" | Network blocked danabra.mov fetch | Show the Components panel, mention the fallback; reload and retry |
| Checklist shows "Failed to load: User not logged in" | Session expired | Log out and back in |
| Checklist add silently fails | Lexicon not yet published | If using `thelexfiles` namespace, confirm publish step succeeded; otherwise fall back to `thelexfiles-temp` namespace which auto-publishes |
| OAuth redirect loop | Stale session on demo machine | Clear site data for the wizard origin and the generated app origin |

## How to verify this script still works

**Smoke-test mode (after any wizard change touching Requirements / Data / Components / Views / Generate UI):**
1. Walk Steps 0–4.
2. Verify Step 5's "ready to generate" assertions pass.
3. If a step's UX changes (button label, placement, copy), update this doc in the same PR.

**Live demo mode (before a release or before a presentation):**
1. Walk Steps 0–6 end-to-end.
2. Verify the generated app runs and writes to PDS.
3. Update this doc if anything has shifted.

## Open Questions

1. **Lexicon publishing strategy for repeat runs.** See the TBD callout in Step 2. Options: pre-published fixed-NSID adoption, `thelexfiles-temp` auto-publish, dry-run publish mode, or idempotent re-publish. Decision needs to land before this spec moves from draft to ready.

2. **Generator-output and runtime test coverage that lets smoke-test mode legitimately skip Steps 5–6.** Today, "actually run the generated app" is the only thing exercising cross-file consistency, type correctness, and runtime wiring of the generated app. Candidate replacements (none yet specced):
   - Whole-tree generation + `tsc --noEmit` against a fixture state (catches compile + cross-file drift).
   - Snapshot tests of generator output for a known fixture.
   - In-process mount of the generated modules with a mocked PDS (catches runtime wiring without `npm install` or browser).
   - Periodic Playwright run of Step 6 (full live-demo flow) gated to release time, not per-PR.
   Until at least one of these exists, smoke-test mode is *cheaper to run* than live-demo mode but *not equivalent in coverage* — be honest about that when relying on it.

3. **Live-demo speed optimizations.** See the TBD callout in Step 5. Options: cached `node_modules` for the generated app, pnpm shared store, pre-baked installed copy, or accepting the friction. Tied to how often the demo is actually presented.

4. **Pre-seeded wizard state for repeat demos.** Out of scope here, but worth flagging: a "load demo fixture" path that pre-fills Steps 0–4 would shorten both smoke-test and live-demo runs further. No spec for this yet.
