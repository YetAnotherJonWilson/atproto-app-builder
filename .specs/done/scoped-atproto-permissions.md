# Spec: Scoped AT Protocol OAuth Permissions

**Status:** done
**Date:** 2026-04-02

## What

Replace the broad `atproto transition:generic` OAuth scope with the minimum permissions the app wizard actually needs. Also update the code generator so generated apps request only the scopes their configured record types require.

## Why

Currently the app wizard and every generated app request `atproto transition:generic`, which grants full read/write access to the user's entire PDS repository — equivalent to an App Password. The app wizard only needs to:

1. Read the user's profile (display name, handle) — this is public data and doesn't require auth
2. CRUD records in a single collection (`com.thelexfiles.appwizard.project`)

Requesting broad permissions erodes user trust and violates the principle of least privilege. The AT Protocol spec defines granular scopes that can limit access to specific collections and actions.

## Research Findings

### AT Protocol Scope System

The AT Protocol defines two layers of scopes:

**Transition scopes** (temporary, broad):
| Scope | Grants |
|---|---|
| `atproto` | Identity only (DID). Required for all sessions. No read/write access. |
| `transition:generic` | Broad PDS access — equivalent to App Password. Repo writes, blob uploads, preferences, API proxying. Excludes account management and DMs. |
| `transition:chat.bsky` | Chat access (requires `transition:generic`). |
| `transition:email` | Read account email via `com.atproto.server.getSession`. |

**Granular scopes** (the intended long-term model):
| Scope Pattern | Example | Purpose |
|---|---|---|
| `repo:<collection>?action=<actions>` | `repo:com.thelexfiles.appwizard.project?action=create&action=update&action=delete` | Write access to specific collections with specific actions |
| `rpc:<method>?aud=<service-did>` | `rpc:app.bsky.actor.getProfile?aud=*` | Authenticated RPC calls to specific endpoints |
| `blob:<mime-type>` | `blob:image/*` | Blob/media upload access |
| `account:<attr>?action=<action>` | `account:email?action=read` | Account management |
| `identity:<attr>` | `identity:handle` | Identity/DID control |

### Production Status

bsky.social's `scopes_supported` metadata only lists the four transition scopes. However, **granular scopes are implemented and enforced on the server** — they work even though they aren't advertised.

**Known issues with granular scopes (as of 2026-04):**
- `rpc:` scopes have bugs with `aud` parameter matching (atproto#4479)
- `blob:` scopes fail with `@atproto/lex` client due to content-type mismatch (atproto#4475)
- Older self-hosted PDSes may reject clients that declare granular scopes in client-metadata.json (atproto#4132)
- Consent screen misrepresents narrow `repo:` scopes with broad descriptions (atproto#4424)
- `repo:` scopes for record CRUD appear to work correctly

### What the App Wizard Needs

| Operation | Current scope | Minimum scope needed |
|---|---|---|
| Read user profile | `transition:generic` | None — `getProfile` is a public endpoint |
| List/get project records | `transition:generic` | `repo:com.thelexfiles.appwizard.project` (read is implicit) |
| Create/update/delete projects | `transition:generic` | `repo:com.thelexfiles.appwizard.project?action=create&action=update&action=delete` |

**Ideal wizard scope:** `atproto repo:com.thelexfiles.appwizard.project`

This grants identity + full CRUD on the project collection only. No access to posts, likes, follows, blobs, or anything else in the user's PDS.

## Current State

The scope `atproto transition:generic` is hardcoded in **four** places:

| Location | Context |
|---|---|
| `src/config/environment.ts:2` | App wizard dev/prod config |
| `worker/index.ts:84` | Cloudflare Worker client-metadata.json |
| `src/generator/config/Environment.ts:8` | Generated app environment config |
| `src/generator/config/ViteConfig.ts:44` | Generated app client-metadata.json |

## Acceptance Criteria

- [ ] The app wizard requests only `atproto repo:com.thelexfiles.appwizard.project` instead of `atproto transition:generic`
  - The scope string is changed in `src/config/environment.ts` and `worker/index.ts`.
  - Profile reads use an unauthenticated fetch or gracefully fall back, since `getProfile` is a public endpoint.
  - Project CRUD (list, get, create, update, delete) continues to work with the narrower scope.

- [ ] Generated apps derive their scope from their configured record types
  - The generator reads the wizard state's record type NSIDs and builds a scope string like `atproto repo:<nsid1> repo:<nsid2>`.
  - The scope is injected into both the generated `environment.ts` and the Vite config's `client-metadata.json`.
  - If the generated app defines no record types (read-only app), the scope is just `atproto`.

- [ ] Auto-fallback to `transition:generic` for older PDSes
  - When `signIn()` fails during PAR with error code `invalid_client_metadata` and a description matching `"Unsupported scope"`, the app automatically retries with `transition:generic`.
  - The fallback requires serving a second client-metadata.json URL (e.g., `/client-metadata-compat.json`) with `scope: "atproto transition:generic"`, since the client_id is the metadata URL and the PDS validates scopes listed in that document.
  - On the happy path (up-to-date PDS), the fallback logic adds zero overhead — it only runs when `signIn()` throws.
  - The error-matching logic is narrow: only the specific `invalid_client_metadata` + scope-related description triggers a retry. Other errors (network, rate limit, user cancellation, malformed metadata) propagate normally.
  - If the retry also fails, the error propagates to the user as normal.

- [ ] The scope is defined in one place per app, not scattered across files
  - App wizard: export the scope constant from `src/config/environment.ts`. The worker can't import it (different runtime), so use a build-time env var or shared constant file that both runtimes can consume.
  - Generated apps: the scope is computed in the generator and passed to both `Environment.ts` and `ViteConfig.ts` templates.

- [ ] Existing users are not broken by the scope change
  - Users with active sessions continue to work (the OAuth client library handles token refresh with the original scope).
  - On next sign-in, users see the updated (narrower) permission request.

- [ ] Dev mode (loopback client) uses the same scope as production

## Scope

**In scope:**
- Changing scope strings in all four locations
- Centralizing scope definition to reduce duplication
- Updating the generator to derive scope from wizard state record types
- Adding a fallback mechanism for PDS compatibility
- Switching profile reads to unauthenticated calls

**Out of scope:**
- Changing the OAuth flow itself (DPoP, grant types, etc.)
- Adding a UI for users to review/approve permissions
- Migrating existing PDS records or sessions
- Supporting `rpc:` or `blob:` granular scopes (these have known bugs)

## Files Likely Affected

- `src/shared/scopes.ts` — new file; single source of truth for scope constants (granular + compat)
- `src/config/environment.ts` — import scope from shared module
- `worker/index.ts` — import scope from shared module
- `src/generator/config/Environment.ts` — accept scope parameter, generate from record types
- `src/generator/config/ViteConfig.ts` — accept scope parameter instead of hardcoded string
- `src/app/auth/AuthService.ts` — switch `getUserProfile()` to unauthenticated fetch; add fallback retry logic to `signIn()`
- `worker/index.ts` — add `/client-metadata-compat.json` route serving `transition:generic` scope

## Ambiguity Warnings

1. ~~**Fallback strategy for older PDSes**~~ **RESOLVED:** Option (a) — auto-fallback. Attempt granular scope, catch `invalid_client_metadata` + `"Unsupported scope"` error, retry with `transition:generic` via a compat client-metadata.json URL. Zero overhead on happy path. Affects ~5% of users at most (self-hosted PDSes running pre-August 2025 versions).

2. ~~**Worker scope synchronization**~~ **RESOLVED:** Option (b) — shared constants file (e.g., `src/shared/scopes.ts`) that both the app and worker import. Both are TypeScript, so a plain module with exported constants works for both runtimes.

3. ~~**Should generated apps include the fallback mechanism too?**~~ **RESOLVED:** Yes — generated apps include the same auto-fallback (~25 lines across auth module and Vite plugin). The Vite plugin generates both `client-metadata.json` (granular scopes) and `client-metadata-compat.json` (`transition:generic`). The auth module retries with the compat client_id on scope rejection.

## Integration Boundaries

### AT Protocol Authorization Servers (bsky.social, self-hosted PDS)
- **Data flowing in:** Scope string in client-metadata.json and in the OAuth authorization request
- **Data flowing out:** Access token with granted scopes
- **Expected contract:** The authorization server must recognize the `repo:<collection>` scope syntax and grant appropriate access. bsky.social supports this; older self-hosted PDSes may not.
- **Unavailability:** If the authorization server rejects the granular scope, the fallback mechanism retries with `atproto transition:generic`.

## Behavioral Scenarios

**Scenario: Fresh sign-in on bsky.social**
- Setup: User has never signed into the app wizard before. Their PDS is bsky.social.
- Action: User enters their handle and clicks Sign In.
- Expected outcome: OAuth consent screen shows narrow permissions (project collection access only, not "full account access"). After authorizing, profile loads and project CRUD works.

**Scenario: Fresh sign-in on older self-hosted PDS (auto-fallback)**
- Setup: User's PDS is running `@atproto/pds` < 0.4.166 (pre-August 2025), which rejects unknown scopes in client-metadata.json.
- Action: User enters their handle and clicks Sign In.
- Expected outcome: PAR request fails with `invalid_client_metadata` / `"Unsupported scope"`. The app catches this, switches client_id to `/client-metadata-compat.json` (which lists `atproto transition:generic`), and retries `signIn()`. User sees the broader consent screen but auth succeeds. The fallback is invisible to the user — no error flash or extra interaction required.

**Scenario: Auth failure for non-scope reason (no false fallback)**
- Setup: User's PDS is unreachable, or client-metadata.json URL returns a 404.
- Action: User enters their handle and clicks Sign In.
- Expected outcome: `signIn()` fails with a non-scope error (e.g., network error, `invalid_client_metadata` with non-scope description). The fallback does NOT trigger. The error propagates to the user normally.

**Scenario: Existing session after scope change**
- Setup: User has an active session from before the scope change (granted `transition:generic`).
- Action: User opens the app wizard.
- Expected outcome: Session continues to work normally. Token refresh uses the original scope. No re-auth required.

**Scenario: Generated app with two record types**
- Setup: User creates an app with record types `com.example.app.post` and `com.example.app.comment`.
- Action: User generates the app code.
- Expected outcome: Generated `environment.ts` contains `SCOPE = 'atproto repo:com.example.app.post repo:com.example.app.comment'`. Generated `client-metadata.json` contains the same scope string.

**Scenario: Generated read-only app**
- Setup: User creates an app that only reads public data, with no record types that require write access.
- Action: User generates the app code.
- Expected outcome: Generated scope is just `'atproto'`. No `transition:generic` or `repo:` scopes requested.

## How to Verify

1. **Granular scope test:** Change the app wizard scope to `atproto repo:com.thelexfiles.appwizard.project` and sign in with a bsky.social account. Verify project CRUD works.
2. **Profile without auth:** Verify `app.bsky.actor.getProfile` works with an unauthenticated HTTP call.
3. **Fallback test (unit):** Mock the OAuth client to throw `invalid_client_metadata` + `"Unsupported scope"` → verify retry with compat client_id. Mock other error types (network, rate limit, non-scope `invalid_client_metadata`) → verify fallback does NOT trigger.
4. **Fallback test (integration):** If possible, test against a real older PDS or a local PDS instance running a pre-0.4.166 version to verify the full auto-fallback flow end-to-end.
4. **Generated app scopes:** Create apps with different record type configurations and verify the generated scope strings are correct.
5. **Dev mode:** Verify loopback auth works with the granular scope locally.
6. **Existing sessions:** Sign in with the old scope, deploy the new code, and verify the session still works.
