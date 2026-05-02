---
name: Grocery List demo script
description: Click-by-click walkthrough for demoing the App Wizard end-to-end by building a grocery checklist app
type: demo
---

# Demo script: Grocery List app

**Status:** ready (depends on `checklist-component.md` shipping)
**Date:** 2026-05-02

## What this is

A literal, click-by-click script for demoing the App Wizard end-to-end. The end product is a single-view ATProtocol app with a profile component (rendered via a community Inlay template), a header, and a checklist of grocery items persisted to the user's PDS.

This doc serves three purposes:
1. **Demo rehearsal** — what to type and click during a live walkthrough.
2. **Smoke test** — a manual checklist for verifying that the wizard's flagship paths still work after changes.
3. **Future Playwright fixture** — concrete copy and field names that a future e2e spec can codify.

## Prerequisites

- Wizard is running locally (`npm run dev`) or pointed at a deployed instance.
- Demo presenter has a Bluesky / ATProtocol account they can log in with via OAuth.
- The danabra.mov Inlay profile template is reachable on the network (used in the Components step).
- `checklist-component.md` is implemented and merged.

## Walkthrough

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

Confirm the namespace setting (likely `thelexfiles` user namespace, which is the default for new lexicons).

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

### Step 5 — Generate

- App config: primary record type `groceryItem`, output method `zip` (or GitHub if a repo is wired up).
- Generate.
- Download / push.

### Step 6 — Run the generated app

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

- **Three layers of "where the UI comes from":**
  1. Built-in primitive (the heading/paragraph from the text component).
  2. Community-published Inlay template (the profile component — emphasize: not coded by the wizard, fetched from another user's PDS).
  3. Wizard-generated widget (the checklist — emphasize: full CRUD against the user's own PDS, no backend).
- **No server.** The generated app talks directly to the user's PDS via OAuth.
- **The data is portable.** Switch to `pdsls.dev` mid-demo and show the same records that the checklist just wrote.

## Failure modes to be ready for

| Symptom | Likely cause | Recovery |
|---|---|---|
| Profile component shows "Inlay template … failed (...)" | Network blocked danabra.mov fetch | Show the Components panel, mention the fallback; reload and retry |
| Checklist shows "Failed to load: User not logged in" | Session expired | Log out and back in |
| Checklist add silently fails | Lexicon not yet published | If using `thelexfiles` namespace, confirm publish step succeeded; otherwise fall back to `thelexfiles-temp` namespace which auto-publishes |
| OAuth redirect loop | Stale session on demo machine | Clear site data for the wizard origin and the generated app origin |

## How to verify this script still works

After any wizard change that touches Requirements, Data, Components, Views, or Generate:

1. Walk the script start-to-finish in `npm run dev`.
2. Verify every step produces the screen described.
3. If a step's UX changes (button label, placement, copy), update this doc in the same PR.

If the demo is run regularly, consider promoting this script to a Playwright e2e spec under `e2e/grocery-list.spec.ts` once the checklist component is stable.
