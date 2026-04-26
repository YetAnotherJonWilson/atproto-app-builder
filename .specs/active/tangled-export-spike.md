# Spec: Tangled.sh Export — Feasibility Spike

**Status:** draft
**Date:** 2026-04-25
**Type:** spike (investigation, not implementation)
**Related:** `.specs/active/github-repo-export.md` (the GitHub equivalent — informs the framing)

## What

Investigate whether the wizard can push generated apps to [tangled.sh](https://tangled.sh) — an AT Protocol-native git collaboration platform — and produce a go/no-go decision plus a follow-up implementation spec if the answer is "go." This spike does not write any production code; the deliverable is a written decision in this spec's "Findings" section and (on go) a new sibling spec for the actual integration.

## Why

The wizard already targets AT Protocol output, so an AT Protocol-native code-hosting destination is a natural fit for users who want to stay in the ecosystem rather than crossing back to GitHub. Two motivating framings:

1. **Alternative to GitHub** — for users who prefer atproto-native infrastructure (and don't want to manage a GitHub account or PAT just to publish a wizard-generated app).
2. **Possible replacement** — if the tangled path is dramatically simpler (e.g., the user's existing atproto OAuth session is enough, no separate token), it might be the *primary* export and GitHub becomes the alternative.

Either outcome is possible, but neither can be chosen until we know what tangled actually exposes for programmatic use. Public docs (as of 2026-04-25) describe only the web UI for repo creation and SSH for push — both of which are problematic for a browser-based wizard. The spike exists to find out whether anything more is available (HTTP API, atproto-native record path, undocumented endpoints).

## Background — what we know going in

From the tangled docs and intro post:

- Repos are created via a `+` button in the web UI; **no documented public HTTP API** for repo creation exists.
- Push is **SSH-only**; users add SSH public keys through the web UI.
- The platform is built on AT Protocol — repo metadata is "relayed via the ATProto," and accounts use atproto identity.
- "Knots" are self-hostable git servers (single- or multi-tenant). The tangled.sh app view aggregates across knots.
- Tangled's source is itself hosted on tangled (`tangled.org/tangled.org/core`), so we can read its lexicons and server code if we need to.

The two unknowns that determine feasibility:

1. Is there a non-UI, non-SSH way to create a repo and push commits? (Either documented, undocumented, or planned.)
2. If repo creation is "just write some atproto records," can the wizard do it directly from the user's OAuth session against their PDS?

## Investigation Questions

Each of these is a yes/no the spike should answer with a citation to source code or docs:

- [ ] **Q1 — Public HTTP API for repo creation?** Does tangled.sh expose any HTTP endpoint that creates a repo programmatically (analogous to GitHub's `POST /user/repos`)? If yes: what auth does it accept (atproto OAuth bearer token? app password? something else)?

- [ ] **Q2 — Atproto-native repo creation path?** When a user creates a repo via the UI, what records get written, where (the user's PDS? a tangled-managed PDS? a knot?), and under which lexicon NSIDs? Could the wizard write those records itself using the user's logged-in atproto session?

- [ ] **Q3 — Push protocol options.** Is there any path other than SSH for pushing commits — git-over-HTTPS, an HTTP API for blob/tree uploads, an atproto-record-based commit history, or a knot-specific endpoint? SSH from a browser is effectively impossible without a server-side gateway.

- [ ] **Q4 — Knot vs. tangled.sh distinction.** If the wizard needs to target a knot's API rather than tangled.sh's app view, does tangled.sh expose a default knot for new users, or does the user need to choose one? Does the protocol differ between the hosted knot and self-hosted ones?

- [ ] **Q5 — Auth model end-to-end.** Walk the full happy path: wizard user is logged in to atproto via the wizard's OAuth → (some sequence of API calls) → repo exists at tangled.sh with the wizard-generated files in `main`. Where does additional auth (SSH key, app password, token) become necessary, and at which step?

- [ ] **Q6 — Cloudflare Worker as a proxy?** If the only push protocol is SSH, can the existing thelexfiles.com Worker act as a server-side git client (clone target, write tree, push) with credentials supplied by the user per-request? Cloudflare Workers don't support raw TCP/SSH cleanly — confirm whether any subset of git push works over the protocols Workers do support.

- [ ] **Q7 — API stability.** If a programmatic path exists, is tangled treating it as a stable public surface, or is it changing fast? An unstable surface argues for waiting.

- [ ] **Q8 — User-facing differences vs. GitHub.** Practical UX comparison: can a tangled URL be shared and viewed publicly the same way as a GitHub URL? Is `git clone` from tangled URLs portable to non-tangled-aware clients?

## Deliverable

A written **Findings** section (added to this spec) covering each question above with a citation, **plus** one of:

- **Go** — a follow-up spec at `.specs/active/tangled-export.md` (mirroring `github-repo-export.md`'s shape) with concrete acceptance criteria for the chosen path. Update the BACKLOG under "Independent (no blockers)" or wherever it fits given dependencies.
- **No-go (yet)** — a brief paragraph explaining the blocker and listing the conditions that would re-trigger investigation (e.g., "tangled ships an HTTP API," "tangled publishes a JS SDK," "we add a long-lived backend that can do SSH").

Either outcome moves this spec to `.specs/done/` and updates BACKLOG.

## Scope

**In scope:**
- Reading tangled.sh docs, blog, lexicon definitions
- Reading tangled's source on `tangled.org/tangled.org/core` (including any exposed XRPC routes, lexicons, or server handlers)
- Manually probing the tangled.sh UI's network traffic to see what calls happen behind the `+` button
- Asking on the tangled Discord (`chat.tangled.sh`) if docs are insufficient
- Writing the Findings section + the follow-up spec (or no-go writeup)

**Out of scope:**
- Building any production code path to tangled
- UI design for the export option in GeneratePanel
- Deciding whether tangled becomes the primary or alternative export — that's a follow-up product call once we know what's possible
- Self-hosting a knot for testing — only investigate whether the tangled.sh-hosted experience works

## Files Likely Affected

This spec only:
- `.specs/active/tangled-export-spike.md` — adds a "Findings" section, then moves to `.specs/done/`
- Possibly: `.specs/active/tangled-export.md` (the follow-up implementation spec, if go)
- `BACKLOG.md` — add the follow-up spec under the appropriate section

No source files change as part of this spike.

## Ambiguity Warnings

1. **What "alternative" means in product terms.**
   The user framed this as either "instead of GitHub" or "as an alternative for users who prefer atproto." The spike doesn't need to choose, but the follow-up implementation spec will. Two scenarios drive different designs:
   - _If tangled is the only export:_ no toggle in GeneratePanel; the export action is always tangled.
   - _If both exist:_ a destination toggle (similar to the original Step 7 ZIP/GitHub radio). UX needs design work in the follow-up spec.
   - _Likely assumption:_ both will exist for a meaningful transition period; design for the toggle case.

2. **Authentication mismatch with the rest of the wizard.**
   The wizard already has atproto OAuth for project persistence. If tangled requires a *separate* token (SSH key uploaded out-of-band, or a tangled-specific app password), the UX gets bumpier — the user logs in once for the wizard and again for the export. Worth flagging as a UX cost in the Findings even if it's technically feasible.
   - _Please confirm this is acceptable, or specify a UX bar that would make it unacceptable._

3. **Scope of "push" — initial create vs. updates.**
   The first push is "create a repo and put N files on `main`." Subsequent generations probably want to push updates (force-push to a `wizard-output` branch? open a PR? overwrite `main`?). The spike should call this out but does not need to decide — the follow-up spec will.

4. **Worker as a proxy is non-trivial.**
   If we end up needing the Worker to do the push (because SSH-only), the Worker accumulates SSH-from-browser proxy responsibilities that are well outside its current "publish lexicons and serve assets" remit. That's a real architectural shift — flag it as such if it becomes the recommended path, and weigh it against just shipping the GitHub export instead.

## Integration Boundaries

### tangled.sh / tangled.org

- **Data flowing in (during spike):** docs pages, blog posts, lexicon JSON, source code reads. No writes during the spike itself.
- **Data flowing in (if implemented):** authenticated API calls and/or atproto record writes, plus the generated files as a git tree.
- **Data flowing out:** repo metadata + commit objects + file blobs.
- **Expected contract:** TBD — that is the question.
- **Unavailability:** if tangled.sh is down, the export silently fails like any third-party push; the wizard should always offer the ZIP download as a fallback (matches the GitHub spec's posture).

### User's atproto session

- **Data flowing in:** existing OAuth session from `src/app/services/AuthService.ts` (the same one that powers `ProjectService.ts`).
- **Possible new requirement:** an additional credential (SSH key, app password) if the atproto session alone isn't sufficient for tangled.
- **Expected contract:** if tangled accepts atproto OAuth bearer tokens, this is zero-friction. If not, the wizard needs a credential-input UI.

## How to Verify

The spike is "verified" when the Findings section is filled in with evidence (URL or file:line citations from tangled's source) and a go/no-go is recorded.

Suggested investigation order (cheapest to most expensive):

1. Read `https://docs.tangled.org/` cover-to-cover, especially "Knot self-hosting guide," "Webhooks," and any "Hacking on Tangled" pages.
2. Browse `tangled.org/tangled.org/core` for `lexicons/` and `xrpc/` directories. If they exist, those are the answer to Q1/Q2.
3. Open tangled.sh in a browser, log in, open devtools network tab, click the repo `+` icon. Record every request (URL, method, headers, body). That reveals whatever API is actually used today, even if undocumented.
4. Search the tangled source for handlers of those endpoints.
5. If still unclear: ask in chat.tangled.sh — phrase it as "I'm building a tool that wants to create repos programmatically; is the API path you'd recommend documented somewhere?"
6. Fill in the Findings section.
7. Decide go / no-go. Write the follow-up spec or the no-go writeup. Update BACKLOG.

## Findings

_To be filled in during the spike._
