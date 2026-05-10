# Spec: @atcute OAuth migration spike

**Status:** draft
**Date:** 2026-05-09

## What
Investigate replacing `@atproto/oauth-client-browser` with `@atcute/oauth-browser-client` to reduce bundle size in (a) the wizard itself and (b) generated apps. Output is a written recommendation backed by a working throwaway prototype — not production code. The spike answers: should we switch the default, offer atcute as an opt-in template variant, or keep the official client?

## Why
A measured bundle comparison run on 2026-05-09 (this spike's seed result) showed:

| Library | Raw | Gzipped | Modules |
|---|---|---|---|
| `@atproto/oauth-client-browser` | 490 KB | 110 KB | 491 |
| `@atcute/oauth-browser-client` | 24 KB | 7.8 KB | 53 |

Atcute is ~14× smaller gzipped. The methodology was isolated lib-mode Vite builds of two equivalent entries exercising the same OAuth API surface. The delta is real code, not polyfills. For generated apps shipped to end users, ~100 KB gzipped of OAuth dominates the OAuth-relevant portion of the wire weight.

Before committing to a migration we need to confirm API parity for everything our codebase actually uses, validate the scoped-permissions flow, and quantify the risks of moving to a single-maintainer community library. A spike is the right size: small write-up + throwaway prototype, no production changes.

## Acceptance Criteria

- [ ] Bundle measurement reproduced and documented in this spec's "Findings" section
- [ ] Throwaway prototype branch builds a working `AuthService.ts` on `@atcute/oauth-browser-client` covering every flow the current implementation supports
  - Init (dev loopback path) — equivalent to `new BrowserOAuthClient({ clientMetadata: atprotoLoopbackClientMetadata(...) })`
  - Init (prod metadata-load path) — equivalent to `BrowserOAuthClient.load({ clientId, handleResolver })`
  - Sign-in — equivalent to `client.signIn(handle, { state, signal })`
  - Callback handling — equivalent to `client.initCallback(params)`, including the early-capture-from-URL pattern in `AuthService.ts` lines 17–27
  - Session restore — equivalent to `client.init()`
  - Sign-out / token revocation — equivalent to `client.revoke(session.sub)`
  - Authenticated XRPC — equivalent of using `@atproto/api`'s `Agent(session)`; verify `@atcute/client` covers the calls in `getUserProfile()` and any other XRPC the wizard makes
- [ ] Scoped-permissions flow is verified end-to-end on a real PDS
  - Granular scopes (the default `clientId` path) succeed against a modern PDS
  - The compat-fallback path (`isScopeRejection` in `AuthService.ts:70-74` retrying with `compatClientId`) is reproduced or shown unnecessary; if atcute's error shape differs, document the equivalent detection
- [ ] Generated-app implications are spot-checked: confirm the same migration mechanically applies to `src/generator/atproto/Auth.ts` and `src/generator/atproto/Api.ts`, and produce a bundle measurement for a hello-world generated app on each library
- [ ] Risk register completed in "Findings" covering: solo-maintainer bus factor, license shift (MIT → 0BSD), atcute-stack lock-in (XRPC client must change too), version-pinning strategy
- [ ] Recommendation written: one of {switch default, ship as opt-in template variant, no-go} with stated reasons
- [ ] If the recommendation is to proceed, a follow-up implementation spec is drafted (separate file under `.specs/active/`) with phased steps; this spec moves to `.specs/done/`
- [ ] If the recommendation is no-go, the seed conditions that would re-trigger the question are written down (e.g. "atcute reaches N maintainers", "official client drops core-js", "bundle budget ratchets to X")

## Scope

**In scope:**
- A throwaway branch that ports `src/app/auth/AuthService.ts` to atcute and runs locally end-to-end against a real PDS
- A throwaway diff for `src/generator/atproto/Auth.ts` + `src/generator/atproto/Api.ts` + `src/generator/config/PackageJson.ts`, built and bundle-measured but not run
- A second isolated bundle measurement for the generated-app case (separate from the wizard-app case)
- Written findings appended to this spec
- Decision on default vs opt-in vs no-go

**Out of scope:**
- Production code changes (any successful prototype is reverted before this spec is marked done)
- UI for choosing between OAuth libraries in the wizard (that belongs in the follow-up implementation spec, if any)
- Migrating the wizard off `@atproto/api` for non-OAuth purposes (only the calls coupled to the session)
- Adding atcute as a template option without first finishing this spike

## Files Likely Affected
*(spike output, all reverted before merge)*
- `src/app/auth/AuthService.ts` — port target during prototype
- `src/generator/atproto/Auth.ts` — port target during prototype
- `src/generator/atproto/Api.ts` — port target during prototype
- `src/generator/config/PackageJson.ts` — emitted dep list
- `package.json` / `package-lock.json` — temporary devDep additions
- `.specs/active/atcute-oauth-spike.md` — Findings section gets filled in

## Ambiguity Warnings

1. **XRPC client pairing.**
   `@atproto/oauth-client-browser` is used alongside `@atproto/api`'s `Agent` for XRPC calls. Atcute pairs naturally with `@atcute/client`, which has its own type system. The spike must decide whether to swap both or attempt to use `@atcute/oauth-browser-client` while keeping `@atproto/api` for XRPC.
   - _Likely assumption:_ swap both; mixing is brittle because atcute's `Session` type doesn't conform to what `@atproto/api`'s `Agent` expects.
   - _Confirm during prototype._

2. **Generated-app measurement methodology.**
   The seed measurement was a lib-mode Vite build of an isolated entry. For the generated-app case, the more honest measurement is to actually run `npm run build` inside a generated hello-world app on each library and diff the output.
   - _Likely assumption:_ generate two trivial wizard outputs (one per library), build each, compare `dist/`.
   - _Please confirm._

3. **PDS used for live verification.**
   Scoped-permissions verification needs a real PDS. The reference for this is `reference_scoped_permissions_manual_tests.md`.
   - _Likely assumption:_ reuse the existing manual-test PDS targets (Bluesky main + a known-older PDS for the compat fallback).
   - _Please confirm._

4. **License sensitivity.**
   Atcute is 0BSD vs the official client's MIT. 0BSD is more permissive (effectively public-domain-equivalent) but is not on every legal allowlist.
   - _Likely assumption:_ Jon's projects don't have a license allowlist; flag but don't block.
   - _Please confirm._

## Behavioral Scenarios

**Scenario: Wizard sign-in on prototype branch**
- Setup: prototype branch with atcute-based `AuthService.ts`; dev server running on `localhost:8080`; user not signed in
- Action: user enters their Bluesky handle and clicks sign in
- Expected outcome: redirect to Bluesky's authorization page, return with `?code&state` to the wizard, session restored, sidebar shows authenticated user

**Scenario: Restore on reload**
- Setup: signed-in session exists in atcute's storage
- Action: user reloads the page
- Expected outcome: session restored without redirect, no flash of unauthenticated UI

**Scenario: Older-PDS scope rejection**
- Setup: prototype branch; user has account on a PDS that does not support granular scopes
- Action: user signs in
- Expected outcome: scope rejection detected, fallback client used, sign-in completes successfully — OR documented evidence that atcute makes this fallback unnecessary

**Scenario: Generated-app smoke test**
- Setup: generate a wizard output configured to use atcute; install + build it
- Action: open the built app, sign in
- Expected outcome: same flows as the wizard's own auth work; bundle size of the generated app's `dist/` is recorded

## How to Verify
- Bundle measurement: reproduce by following the procedure logged in this spec's Findings section. Numbers should be within 10% of seeded values.
- Wizard prototype: run scenarios above against a real PDS.
- Generated-app prototype: build + run smoke flow against a real PDS.
- Findings section is filled in with: numbers, scenario outcomes, risk register, recommendation, follow-up spec link (if any).
- Prototype branch deleted (or kept locally, never merged) once Findings is complete.

## Findings
*(filled in during the spike)*

### Bundle measurements
*To be reproduced.*

### Prototype outcomes
*To be filled in per scenario.*

### Risks
*To be filled in.*

### Recommendation
*To be filled in.*
