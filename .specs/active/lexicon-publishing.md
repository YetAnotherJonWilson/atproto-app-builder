# Spec: Lexicon Publishing (temp namespace)

**Status:** draft
**Date:** 2026-03-24
**Depends on:** Generate Panel (Phase 6, done)

## What

Add lexicon publishing to the wizard's generate flow. When the user generates their app, a confirmation dialog explains that their lexicon schemas will be published as experimental (`.temp`) versions, alongside the ZIP download. Lexicons are published the AT Protocol way: as `com.atproto.lexicon.schema` records in the `protopunx.bsky.social` PDS repository, with `_lexicon` DNS TXT records at Cloudflare pointing resolvers to that repository's DID. The Cloudflare Worker that serves the wizard app is extended with an API endpoint that handles both the PDS write and DNS record creation. A first-visit welcome dialog sets expectations about the tool's alpha state. The namespace UI hides the stable `thelexfiles` option but keeps `.temp` (default) and BYO domain available.

## Why

Generated AT Protocol apps use lexicon NSIDs to organize records in the user's PDS. Publishing lexicon schemas makes them resolvable by other apps and tools via standard AT Protocol lexicon resolution (NSID → authority domain → `_lexicon` DNS TXT → DID → PDS → schema record). This follows the protocol spec rather than inventing a custom storage mechanism.

Using `protopunx.bsky.social` as the hosting PDS avoids running custom infrastructure. The AT Protocol spec explicitly supports moving schema resolution to different repositories later by changing DNS records — so this is a low-commitment starting point that can migrate to a self-hosted PDS when needed.

Restricting to `.temp` signals that schemas are experimental and may change. This matches the wizard's alpha state.

## Design Decisions

1. **Spec-compliant publishing** — Lexicons are stored as `com.atproto.lexicon.schema` records in an AT Protocol repository, resolvable via `_lexicon` DNS TXT records. This follows the [Lexicon Resolution RFC](https://github.com/bluesky-social/atproto/discussions/3074) and the [Lexicon spec](https://atproto.com/specs/lexicon).

2. **`protopunx.bsky.social` as lexicon host** — A dedicated Bluesky account hosts all published lexicon schemas in its repository. DID: `did:plc:deh4u7fsoeqtrbtkf5eptizr`. This avoids running a PDS. DNS records can be updated later to point to a different DID/PDS.

3. **Worker as intermediary** — The client calls `POST /api/publish` on the Cloudflare Worker. The Worker holds the PDS credentials (app password) and Cloudflare DNS API token as secrets, then writes to the PDS and creates DNS records. Client-side code never touches credentials.

4. **Per-username DNS records** — Each username gets a `_lexicon` DNS TXT record at `_lexicon.temp.<username>.thelexfiles.com` → `did=did:plc:deh4u7fsoeqtrbtkf5eptizr`. This is required because each username creates a different NSID authority domain, and the spec says resolution does not recurse to parent domains. The Worker creates these automatically on first publish per username via Cloudflare's DNS API.

5. **Confirmation dialog before generate** — The user clicks "Download ZIP" and sees a dialog explaining both actions (publish + download) before anything happens. Transparent about the publish side-effect, includes a privacy warning.

6. **Publish then download** — Lexicons are published first, then the ZIP is generated. If publishing fails, the user can still download the ZIP.

7. **`.temp` and BYO domain only** — The stable `thelexfiles` namespace is hidden (publishing stable lexicons is a commitment not yet supported). BYO domain remains available for advanced users — those record types are skipped during publishing.

8. **Open publishing, no user auth** — Anyone can publish a `.temp` lexicon without logging in. The Worker authenticates to the PDS on the user's behalf. The `.temp` namespace signals impermanence, and the barrier to entry should be zero.

9. **Only `source: 'new'` with `thelexfiles-temp` namespace are published** — Adopted lexicons already exist elsewhere. BYO domain lexicons are the user's responsibility.

## Architecture

```
┌──────────┐      POST /api/publish       ┌──────────────────┐
│  Wizard  │  ──────────────────────────►  │ Cloudflare Worker│
│ (client) │                               │                  │
└──────────┘                               │  1. Authenticate │
                                           │     with PDS     │
                                           │                  │
                                           │  2. Write schema │
                                           │     records      │──► protopunx.bsky.social PDS
                                           │                  │    (com.atproto.lexicon.schema)
                                           │  3. Create DNS   │
                                           │     TXT records  │──► Cloudflare DNS API
                                           │     (if new user)│    (_lexicon.temp.<user>.thelexfiles.com)
                                           └──────────────────┘
```

**Resolution flow (by any AT Protocol client):**
1. NSID `com.thelexfiles.alice.temp.groceryItem` → authority domain `temp.alice.thelexfiles.com`
2. DNS lookup: `_lexicon.temp.alice.thelexfiles.com` TXT → `did=did:plc:deh4u7fsoeqtrbtkf5eptizr`
3. DID resolution → PDS endpoint for `protopunx.bsky.social`
4. `com.atproto.repo.getRecord` with collection `com.atproto.lexicon.schema`, rkey `com.thelexfiles.alice.temp.groceryItem`
5. Returns the lexicon schema

## Worker API

### `POST /api/publish`

Publishes lexicon schemas to the PDS and ensures DNS records exist.

**Request:**
```json
{
  "lexicons": [
    {
      "nsid": "com.thelexfiles.alice.temp.groceryItem",
      "schema": {
        "lexicon": 1,
        "id": "com.thelexfiles.alice.temp.groceryItem",
        "defs": {
          "main": {
            "type": "record",
            "key": "tid",
            "record": {
              "type": "object",
              "required": ["name"],
              "properties": {
                "name": { "type": "string" }
              }
            }
          }
        }
      }
    }
  ]
}
```

**Response (200):**
```json
{
  "published": [
    { "nsid": "com.thelexfiles.alice.temp.groceryItem", "uri": "at://did:plc:.../com.atproto.lexicon.schema/com.thelexfiles.alice.temp.groceryItem" }
  ],
  "failed": []
}
```

**Response (partial failure):**
```json
{
  "published": [
    { "nsid": "com.thelexfiles.alice.temp.groceryItem", "uri": "at://..." }
  ],
  "failed": [
    { "nsid": "com.thelexfiles.alice.temp.recipe", "error": "PDS write failed: 500" }
  ]
}
```

**Validation rules:**
- Each `nsid` must match the pattern `com.thelexfiles.*.temp.*` (only `.temp` namespace)
- Each `schema.id` must match its `nsid`
- Each `schema` must have `lexicon: 1`
- Request body must contain a `lexicons` array with at least one entry
- Maximum 50 lexicons per request

**Error responses:**
- `400` — invalid request body or validation failure. Body: `{ "error": "description" }`
- `413` — request body exceeds 1MB
- `500` — internal error (PDS unreachable, DNS API failure, etc.)

**Worker implementation steps:**

1. **Validate** the request body and each lexicon entry.
2. **Authenticate with PDS** — call `com.atproto.server.createSession` on `bsky.social` using the stored app password for `protopunx.bsky.social`. (Create a fresh session per request for simplicity; optimize with caching later if needed.)
3. **Write schema records** — for each lexicon, call `com.atproto.repo.putRecord` with:
   - `repo`: `did:plc:deh4u7fsoeqtrbtkf5eptizr`
   - `collection`: `com.atproto.lexicon.schema`
   - `rkey`: the NSID (e.g., `com.thelexfiles.alice.temp.groceryItem`)
   - `record`: the schema object, with `$type: "com.atproto.lexicon.schema"` added
   - Use `putRecord` (not `createRecord`) so re-publishing overwrites the previous version.
4. **Ensure DNS records exist** — extract unique usernames from the published NSIDs. For each username, check if `_lexicon.temp.<username>.thelexfiles.com` TXT record exists via Cloudflare DNS API. If not, create it with value `did=did:plc:deh4u7fsoeqtrbtkf5eptizr`.
5. **Return results** — aggregate published/failed arrays.

### Worker secrets (environment variables)

| Secret | Purpose |
|--------|---------|
| `PDS_HANDLE` | `protopunx.bsky.social` |
| `PDS_APP_PASSWORD` | App password for the PDS account |
| `CF_ZONE_ID` | Cloudflare zone ID for `thelexfiles.com` |
| `CF_DNS_API_TOKEN` | Cloudflare API token with DNS edit permission for the zone |

Set via `wrangler secret put <NAME>` (not committed to the repo).

## Wizard UI Changes

### First-visit welcome dialog

When the user enters the wizard for the first time (no saved wizard state exists, or a `hasSeenWelcome` flag is `false`), a dismissable dialog appears before any panel content is interactive.

**Dialog structure:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Welcome to the AT Protocol App Builder         │
│                                                 │
│  A few things to know before you start:         │
│                                                 │
│  This tool is experimental. The apps it         │
│  generates are scaffolded starting points,      │
│  with placeholders for content that cannot      │
│  yet be generated automatically.                │
│                                                 │
│  Your data schemas (lexicons) will be           │
│  published under a .temp namespace,             │
│  signaling that they are experimental and       │
│  may change. This is the right choice while     │
│  you're prototyping.                            │
│                                                 │
│  Data stored in AT Protocol Personal Data       │
│  Servers is not yet private. Don't use          │
│  these apps to store anything sensitive —       │
│  treat them as experiments.                     │
│                                                 │
│                          [ Got it, let's go ]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- Appears once per browser (persisted via `hasSeenWelcome: true` in wizard state).
- Single dismiss button: "Got it, let's go".
- No close-X button — the user must acknowledge by clicking the button.
- Clicking the button sets `wizardState.hasSeenWelcome = true`, saves state, and closes the dialog.
- The dialog uses the standard `wizard-dialog` pattern but with no cancel/secondary action.
- On subsequent visits (state already has `hasSeenWelcome: true`), the dialog does not appear.

**Maps to:** `WizardState.hasSeenWelcome` (new boolean field, default `false`).

### Namespace restriction (Data Panel)

In the data type identity detail view, the namespace radio group is modified:

- **Show "theLexFiles.com — experimental" (default, recommended) and "My own domain"**
- Hide the stable "theLexFiles.com" option
- Default new record types to `namespaceOption: 'thelexfiles-temp'`
- Record types that already have `namespaceOption: 'thelexfiles'` from prior sessions: their existing namespace is preserved in state and the NSID still computes correctly, but the UI shows only `.temp` and BYO domain for editing. A note explains: "Stable namespace publishing is not yet available."

### Confirmation dialog

When the user clicks "Download ZIP", instead of immediately generating, a confirmation dialog appears.

**Dialog structure:**
```
┌─────────────────────────────────────────────────┐
│  ×                                              │
│                                                 │
│  Generate & Publish                             │
│                                                 │
│  This will:                                     │
│                                                 │
│  • Download a scaffolded version of your app,   │
│    with placeholders for content that cannot     │
│    be generated                                  │
│                                                 │
│  [If publishable lexicons exist:]               │
│  • Publish your lexicons as experimental         │
│    (.temp) versions via the AT Protocol:         │
│                                                 │
│    com.thelexfiles.alice.temp.groceryItem        │
│    com.thelexfiles.alice.temp.recipe             │
│                                                 │
│  ⚠ Data stored in AT Protocol Personal Data     │
│  Servers is not yet private. Use these apps      │
│  for experimentation, not for storing            │
│  private data.                                   │
│                                                 │
│         [ Generate & Publish ]  [ Cancel ]      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**When no publishable lexicons exist** (all adopted, all BYO domain, or no record types):
- The "Publish your lexicons..." bullet and NSID list are omitted
- The confirm button text is "Download ZIP" (no publish action)
- The dialog still appears for the privacy warning and scaffolding explanation

**Publishable lexicons** are record types where `source === 'new'` AND `namespaceOption === 'thelexfiles-temp'` AND `lexUsername` is non-empty AND `name` is non-empty.

### Generate + publish flow

After the user clicks "Generate & Publish" in the dialog:

1. Dialog stays open. Confirm button disables. Text changes to "Publishing..."
2. If publishable lexicons exist: call `POST /api/publish` with all publishable record type schemas
3. On publish success: button text changes to "Generating..."
4. Generate the ZIP via existing `generateApp()` flow. ZIP downloads via browser.
5. On complete success: dialog shows a success state:
   - "Your app has been downloaded and N lexicons published."
   - "OK" button to dismiss
   - Sets `wizardState.hasGenerated = true`
6. On publish failure (partial or full):
   - Dialog shows which lexicons failed
   - Offers "Download ZIP Anyway" button (proceeds with ZIP generation despite publish failure) and "Cancel" button
   - If user chooses "Download ZIP Anyway", generate and download ZIP normally
7. On ZIP generation failure: show error message in dialog, "OK" to dismiss

### Vite dev proxy

Add a proxy rule in `vite.config.ts` for development:
```typescript
'/api': {
  target: 'https://thelexfiles.com',
  changeOrigin: true,
}
```

This lets the wizard call `/api/publish` in development without CORS issues, proxied to the production Worker.

## Infrastructure Setup (manual steps)

These steps are performed by the project owner, not implemented in code:

### 1. Create protopunx.bsky.social app password
Already done. Create an app password in Bluesky Settings → Privacy and Security → App Passwords. Store it as a Worker secret.

### 2. Create Cloudflare API token
In Cloudflare dashboard → My Profile → API Tokens → Create Token. Use the "Edit zone DNS" template, scoped to the `thelexfiles.com` zone. Store as a Worker secret.

### 3. Set Worker secrets
```bash
npx wrangler secret put PDS_HANDLE        # protopunx.bsky.social
npx wrangler secret put PDS_APP_PASSWORD   # the app password from step 1
npx wrangler secret put CF_ZONE_ID         # zone ID from Cloudflare dashboard
npx wrangler secret put CF_DNS_API_TOKEN   # API token from step 2
```

### 4. Update wrangler.jsonc
```jsonc
{
  "name": "atproto-app-builder",
  "main": "worker/index.ts",
  "compatibility_date": "2025-09-27",
  "observability": { "enabled": true },
  "assets": {
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "compatibility_flags": ["nodejs_compat"]
}
```

Key changes from current config:
- Added `"main": "worker/index.ts"` — Worker entry point
- Added `"binding": "ASSETS"` to assets — allows Worker to serve static files
- No KV needed — the PDS is the storage

### 5. Install Worker types
```bash
npm install --save-dev @cloudflare/workers-types
```

### 6. Deploy
Cloudflare's GitHub integration will deploy on push. Verify that the build command in Cloudflare dashboard runs `npm run build` (for the Vite app) and that wrangler picks up the Worker entry point.

## Acceptance Criteria

- [ ] The Cloudflare Worker serves both the wizard app and the publish API
  - When a request hits `POST /api/publish`, the Worker handles it (validates, writes to PDS, creates DNS records).
  - When a request hits any other path, the Worker serves the static wizard app (existing SPA behavior).

- [ ] Lexicons are published as `com.atproto.lexicon.schema` records in the PDS
  - When a valid publish request is sent, schema records are written to the `protopunx.bsky.social` repository via `com.atproto.repo.putRecord`.
  - When a schema with the same NSID already exists, it is overwritten (putRecord upsert behavior).
  - When the PDS write fails for a lexicon, it appears in the `failed` array with an error message.

- [ ] DNS TXT records are created for new usernames
  - When a username is published for the first time, a `_lexicon.temp.<username>.thelexfiles.com` TXT record is created with value `did=did:plc:deh4u7fsoeqtrbtkf5eptizr`.
  - When a username has already been published, no duplicate DNS record is created.
  - When DNS record creation fails, the lexicon publish still succeeds (DNS is best-effort; resolution will work once the record propagates).

- [ ] Published lexicons are resolvable via AT Protocol lexicon resolution
  - When a resolver looks up NSID `com.thelexfiles.alice.temp.groceryItem`, it finds the `_lexicon.temp.alice.thelexfiles.com` TXT record, resolves the DID to the PDS, and retrieves the schema record.

- [ ] A welcome dialog appears on first visit to the wizard
  - When the user enters the wizard and `hasSeenWelcome` is `false` (or absent), a dialog appears explaining the experimental nature of the tool, the use of `.temp` lexicons, placeholder-based generation, and the lack of private data in PDS.
  - When the user clicks "Got it, let's go", the dialog closes, `hasSeenWelcome` is set to `true`, and the wizard is usable.
  - When the user returns on a subsequent visit, the dialog does not appear.

- [ ] The namespace UI offers `.temp` and BYO domain options only
  - When creating a new record type, "theLexFiles.com — experimental" (default) and "My own domain" appear in the namespace radio group. The stable "theLexFiles.com" option is hidden.
  - When editing a record type that previously had the stable `thelexfiles` namespace, the UI shows only `.temp` and BYO domain. The existing stable namespace is preserved in state. A note explains: "Stable namespace publishing is not yet available."

- [ ] The "Download ZIP" button triggers a confirmation dialog
  - When the user clicks "Download ZIP", a dialog appears explaining that the app will be downloaded and lexicons will be published.
  - When publishable lexicons exist, the dialog lists the specific NSIDs that will be published.
  - When no publishable lexicons exist (all adopted, BYO domain, or no record types), the publish section is omitted and the button says "Download ZIP".
  - The dialog includes a privacy warning about PDS data.

- [ ] Lexicons are published before the ZIP is downloaded
  - When the user confirms the dialog and publishable lexicons exist, lexicons are published via `POST /api/publish` before ZIP generation begins.
  - When publishing succeeds, the ZIP is generated and downloaded, and a success message is shown.
  - When publishing fails (partially or fully), the user is offered "Download ZIP Anyway" to proceed without successful publishing.

- [ ] The Worker code lives in `worker/` and deploys with the existing Cloudflare GitHub integration
  - The `wrangler.jsonc` references `worker/index.ts` as the Worker entry point.
  - The Worker is TypeScript and handles routing between API and static assets.
  - Secrets (PDS password, DNS API token) are set via `wrangler secret put`, not committed to the repo.

## Scope

**In scope:**
- Worker API endpoint: `POST /api/publish`
- Worker routing: API route + static asset fallback
- PDS authentication and `com.atproto.lexicon.schema` record writes
- Cloudflare DNS TXT record creation per username
- Welcome dialog (first-visit)
- Confirmation dialog in Generate panel
- Publish flow integrated into generate action
- Namespace UI: hide stable option, keep `.temp` and BYO domain
- Vite dev proxy for `/api`
- `wrangler.jsonc` updates
- `worker/index.ts` — Worker entry point
- `src/app/services/LexiconPublisher.ts` — client-side publish function
- Updates to `GeneratePanel.ts` — dialog and publish flow
- Updates to `DataPanel.ts` — namespace restriction
- Tests for Worker API handlers and publish service

**Out of scope:**
- Stable (`thelexfiles`) namespace publishing — future spec when wizard exits alpha
- BYO domain publishing infrastructure — users who choose BYO manage their own DNS and publishing
- Read/list API endpoints for published lexicons — can be added later, but resolvers fetch directly from the PDS via `com.atproto.repo.getRecord`
- User accounts, authentication, or rate limiting — future spec
- Landing page or browse UI at thelexfiles.com — future spec
- Publishing adopted lexicons — they already exist elsewhere
- Migrating from `protopunx.bsky.social` to a self-hosted PDS — future work, requires only DNS TXT record updates

## Files Likely Affected

### New Files
- `worker/index.ts` — Worker entry point: routing, PDS auth, record writes, DNS creation
- `worker/tsconfig.json` — Worker-specific TypeScript config (no DOM types, Workers types)
- `src/app/services/LexiconPublisher.ts` — client-side function to call `POST /api/publish`
- `tests/services/LexiconPublisher.test.ts` — tests for the publish service
- `tests/worker/index.test.ts` — tests for Worker API handlers

### Modified Files
- `wrangler.jsonc` — add `main`, `assets.binding`
- `vite.config.ts` — add `/api` proxy rule
- `src/app/views/panels/GeneratePanel.ts` — confirmation dialog, publish-then-download flow
- `src/app/views/panels/DataPanel.ts` — restrict namespace radio to `.temp` and BYO domain only
- `src/app/views/WorkspaceLayout.ts` or `src/app/bootstrap/Initialization.ts` — trigger welcome dialog on first visit
- `src/types/wizard.ts` — add `hasSeenWelcome` to `WizardState`
- `package.json` — add `@cloudflare/workers-types` dev dependency
- `.gitignore` — add `.wrangler/`

## Integration Boundaries

### Bluesky PDS (protopunx.bsky.social)
- **Data flowing out:** `com.atproto.lexicon.schema` records via `com.atproto.repo.putRecord`
- **Data flowing in:** Session tokens via `com.atproto.server.createSession`
- **Expected contract:** PDS accepts `com.atproto.lexicon.schema` records with NSID as rkey (verified — `validationStatus: "valid"`)
- **Unavailability:** PDS is down → publish fails → user offered "Download ZIP Anyway". Worker returns the error in the `failed` array.

### Cloudflare DNS API
- **Data flowing out:** TXT record creation requests for `_lexicon.temp.<username>.thelexfiles.com`
- **Data flowing in:** Existing record checks
- **Expected contract:** Cloudflare API v4 — `GET /zones/{zone_id}/dns_records`, `POST /zones/{zone_id}/dns_records`
- **Unavailability:** DNS API is down → DNS record not created → lexicon publish still succeeds (schema is in PDS), but resolution won't work until DNS record is created (can be retried on next publish). Worker logs the failure but does not include it in the `failed` array (the lexicon itself was published successfully).

### GeneratePanel → LexiconPublisher
- **Data flowing out:** Array of `{ nsid, schema }` objects for publishable record types
- **Expected contract:** `publishLexicons()` returns a result with `published` and `failed` arrays
- **Unavailability:** Network failure → all lexicons fail → user offered "Download ZIP Anyway"

### GeneratePanel → OutputGenerator (existing)
- **No changes** to the existing `generateApp()` flow. The publish step is added before `generateApp()` is called, not inside it.

## Behavioral Scenarios

**Scenario 0: First visit — welcome dialog**
- Setup: Fresh browser, no saved wizard state (or `hasSeenWelcome` is `false`).
- Action: User clicks "Start Building" on the landing page.
- Expected: Wizard layout appears. Welcome dialog is shown immediately, explaining the experimental nature, `.temp` lexicons, placeholders, and PDS privacy. User clicks "Got it, let's go". Dialog closes. Wizard is interactive. On next visit, dialog does not appear.

**Scenario 1: Happy path — generate with publishable lexicons**
- Setup: User has 2 new record types (groceryItem, recipe) with `thelexfiles-temp` namespace, username "alice". App name and domain filled in.
- Action: User clicks "Download ZIP".
- Expected: Confirmation dialog appears showing both NSIDs (`com.thelexfiles.alice.temp.groceryItem`, `com.thelexfiles.alice.temp.recipe`), privacy warning, and "Generate & Publish" / "Cancel" buttons. User clicks "Generate & Publish". Button disables, shows "Publishing...". Worker authenticates with PDS, writes both schema records, creates `_lexicon.temp.alice.thelexfiles.com` TXT record (if new). Button shows "Generating...". ZIP downloads. Dialog shows success: "Your app has been downloaded and 2 lexicons published."

**Scenario 2: Generate with no publishable lexicons (all adopted)**
- Setup: User has 1 adopted record type (`app.bsky.feed.post`). No new record types.
- Action: User clicks "Download ZIP".
- Expected: Confirmation dialog appears WITHOUT the publish section. Button says "Download ZIP" (not "Generate & Publish"). Privacy warning still shown. On confirm, ZIP downloads normally (no publish API call).

**Scenario 3: Publish failure — user downloads anyway**
- Setup: User has 1 new record type. PDS is unreachable.
- Action: User clicks "Download ZIP", confirms dialog.
- Expected: Publishing attempted, fails. Dialog shows error: "Failed to publish 1 lexicon: com.thelexfiles.alice.temp.groceryItem". Two buttons: "Download ZIP Anyway" and "Cancel". User clicks "Download ZIP Anyway". ZIP generates and downloads. `hasGenerated` is set to true.

**Scenario 4: Partial publish failure**
- Setup: User has 3 new record types. PDS write fails for 1.
- Action: User confirms the dialog.
- Expected: API returns 200 with 2 published, 1 failed. Dialog shows: "2 lexicons published. 1 failed: [NSID]." "Download ZIP Anyway" and "Cancel" buttons.

**Scenario 5: Cancel the dialog**
- Setup: User has record types and filled in app info.
- Action: User clicks "Download ZIP", sees the dialog, clicks "Cancel".
- Expected: Dialog closes. Nothing is published. No ZIP is generated. State unchanged.

**Scenario 6: Namespace options in Data Panel**
- Setup: User opens a new record type's detail view.
- Action: User looks at the namespace options.
- Expected: "theLexFiles.com — experimental" (default, recommended) and "My own domain" are available. The stable "theLexFiles.com" option is not shown. A note says: "Stable namespace publishing is not yet available."

**Scenario 7: BYO domain record type not published**
- Setup: User has 2 record types: one with `thelexfiles-temp` namespace, one with `byo-domain` namespace.
- Action: User clicks "Download ZIP".
- Expected: Confirmation dialog lists only the `.temp` NSID for publishing. The BYO domain record type is not listed (publishing is the user's responsibility). Both record types are included in the generated ZIP.

**Scenario 8: Existing record type with stable namespace**
- Setup: User has a record type from a prior session with `namespaceOption: 'thelexfiles'` (stable).
- Action: User opens that record type's detail view.
- Expected: The namespace radio shows `.temp` and BYO domain options. The existing stable namespace is preserved in state (code generation still uses it correctly). A note explains stable publishing isn't available yet. The NSID preview reflects the actual stored namespace option.

**Scenario 9: Re-publishing overwrites**
- Setup: User previously generated and published `com.thelexfiles.alice.temp.groceryItem`. User has since added a field to groceryItem.
- Action: User clicks "Download ZIP" and confirms.
- Expected: The updated lexicon is published via `putRecord`, overwriting the previous version in the PDS. DNS record already exists for username "alice" — no new DNS record created.

**Scenario 10: Record type missing username or name**
- Setup: User has a record type with `namespaceOption: 'thelexfiles-temp'` but no `lexUsername` set (incomplete identity).
- Action: User clicks "Download ZIP".
- Expected: That record type is excluded from the publishable list (it doesn't meet the publishable criteria). If it's the only record type, the dialog omits the publish section.

**Scenario 11: No record types at all**
- Setup: User has no record types. App name and domain filled in.
- Action: User clicks "Download ZIP".
- Expected: Confirmation dialog with no publish section. Privacy warning shown. "Download ZIP" button. On confirm, ZIP downloads (empty app scaffold).

**Scenario 12: Multiple users publishing (different usernames)**
- Setup: User A publishes with username "alice", user B publishes with username "bob" (different browser sessions).
- Expected: Both sets of lexicons are stored in the same PDS repository (protopunx.bsky.social). Two DNS TXT records exist: `_lexicon.temp.alice.thelexfiles.com` and `_lexicon.temp.bob.thelexfiles.com`, both pointing to the same DID.

## Ambiguity Warnings

1. **Cloudflare build pipeline**
   The repo is connected to Cloudflare via GitHub. It's unclear whether the current build command in Cloudflare dashboard needs to change to accommodate the Worker entry point, or if wrangler handles it automatically.
   - _Likely assumption:_ Cloudflare's Worker deployment reads `wrangler.jsonc` and handles both the Worker and assets. The build command (`npm run build`) produces the `dist/` directory, and wrangler serves it via the `assets` config.
   - _Please confirm after deploying the first Worker version._

2. **Worker TypeScript compilation**
   Wrangler uses esbuild internally to bundle the Worker entry point, separate from the project's Vite/tsc build. The Worker code in `worker/` may need its own `tsconfig.json` (different runtime — no DOM types, needs `@cloudflare/workers-types`).
   - _Likely assumption:_ Add a minimal `worker/tsconfig.json` for IDE support. Wrangler handles actual compilation.
   - _Decide during implementation._

3. **`putRecord` availability**
   The Worker uses `com.atproto.repo.putRecord` for upsert behavior (create or overwrite). If the PDS does not support `putRecord`, fall back to checking `getRecord` first, then using `createRecord` or `deleteRecord` + `createRecord`.
   - _Likely assumption:_ `putRecord` is supported on Bluesky's PDS. Test during implementation.

4. **DNS wildcard vs per-user records**
   Each username needs its own `_lexicon.temp.<username>.thelexfiles.com` TXT record. Cloudflare's standard wildcard (`*`) only matches one DNS label level. A wildcard like `_lexicon.temp.*.thelexfiles.com` may not work as expected.
   - _Likely assumption:_ Create individual TXT records per username via Cloudflare DNS API. This is automatable and correct.
   - _Confirmed approach: per-user records._

## How to Verify

1. Deploy Worker — verify thelexfiles.com still serves the wizard app
2. Set all Worker secrets via `wrangler secret put`
3. Test publish via curl:
   ```bash
   curl -X POST https://thelexfiles.com/api/publish \
     -H 'Content-Type: application/json' \
     -d '{"lexicons":[{"nsid":"com.thelexfiles.test.temp.hello","schema":{"lexicon":1,"id":"com.thelexfiles.test.temp.hello","defs":{"main":{"type":"record","key":"tid","record":{"type":"object","properties":{"text":{"type":"string"}}}}}}}]}'
   ```
4. Verify the record exists in the PDS:
   ```bash
   curl 'https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=did:plc:deh4u7fsoeqtrbtkf5eptizr&collection=com.atproto.lexicon.schema&rkey=com.thelexfiles.test.temp.hello'
   ```
5. Verify DNS TXT record was created:
   ```bash
   dig TXT _lexicon.temp.test.thelexfiles.com
   ```
6. Open wizard, create a new record type — verify only `.temp` and BYO domain namespace options shown
7. Fill in app info and record type identity, click "Download ZIP" — verify confirmation dialog appears with NSID list and privacy warning
8. Click "Generate & Publish" — verify lexicons are published and ZIP downloads
9. Verify resolution chain: DNS TXT → DID → PDS → schema record
10. Disconnect network, attempt generate — verify publish failure is handled gracefully with "Download ZIP Anyway" option
11. `npm run build` compiles without errors
12. `npx vitest run` passes
