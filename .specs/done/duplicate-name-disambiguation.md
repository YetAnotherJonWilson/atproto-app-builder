# Spec: Record Type Name Collision Disambiguation

**Status:** done
**Date:** 2026-04-07

## What

When a user adopts a lexicon whose last NSID segment collides with an existing record type's `name` (e.g., adopting `app.bsky.post` when a record type named `post` already exists), the system auto-disambiguates by prefixing with the second-to-last NSID segment. This prevents duplicate identifier errors in the generated app.

## Why

All generated code identifiers (type names, function names, store properties, variable names) derive from `record.name`. When two record types share the same name, the generated app contains duplicate `interface`, `function`, `const`, and class method declarations — producing multiple TS2300/TS2451 build errors. Users have legitimate reasons to adopt different lexicons that share a last segment (e.g., `com.example.post` and `app.bsky.post` are genuinely different record types), so blocking adoption is not acceptable.

## Acceptance Criteria

- [ ] **Collision between adopted and custom record type** — only the adopted record is renamed
  - When a user adopts a lexicon whose last segment matches an existing custom (source='new') record type's name, the adopted record type's `name` is prefixed with the second-to-last NSID segment (e.g., `app.bsky.post` → `bskyPost`).
  - The custom record type's name is not changed.
  - Example: custom record `post` + adopted `app.bsky.post` → `post` and `bskyPost`.

- [ ] **Collision between two adopted record types** — both are renamed
  - When a user adopts a lexicon whose last segment matches an existing adopted record type's name, both record types are disambiguated using their respective second-to-last NSID segments.
  - Example: adopted `com.example.post` (currently named `post`) + newly adopted `app.bsky.post` → `examplePost` and `bskyPost`.

- [ ] **No collision** — no renaming occurs
  - When the last NSID segment does not match any existing record type name, the name is set to the last segment as it is today. No disambiguation needed.

- [ ] **Second-to-last segment also collides** — prompt user for a name
  - When auto-disambiguation produces a name that still collides with an existing record type name, the system prompts the user to enter a custom name for the record type being adopted.
  - The prompt should explain why a custom name is needed (e.g., "The auto-generated name 'fooPost' is already in use. Please enter a unique name for this record type.").

- [ ] **Disambiguated names persist** — no reverting
  - Once a record type's name has been disambiguated, it stays that way even if the colliding record type is later deleted.

- [ ] **Generated code uses `record.name` correctly** — no generator changes needed
  - All generators already derive identifiers from `record.name`. This spec only changes how `record.name` is set at adopt time; no generator modifications are required.

## Scope

**In scope:**
- Collision detection logic at adopt time in `handleAdopt`
- Auto-disambiguation using second-to-last NSID segment as prefix
- Fallback prompt when auto-disambiguation still collides
- Renaming existing adopted record types when a new adoption creates a collision

**Out of scope:**
- Collision detection for manually-renamed record types (custom name entry outside adoption flow)
- Changes to any generator files
- Changes to the legacy step-2 validator
- Reverting disambiguated names when collisions are resolved

## Files Likely Affected

- `src/app/views/panels/DataPanel.ts` — `handleAdopt` function (~line 1383): add collision detection and disambiguation logic after extracting the last NSID segment at line 1408

## Disambiguation Algorithm

```
1. Extract lastSegment from the adopted NSID (e.g., "post" from "app.bsky.post")
2. Find all other record types whose name equals lastSegment (case-insensitive match)
3. If no collisions → set name = lastSegment (current behavior, done)
4. If collisions exist:
   a. For the newly adopted record: compute disambiguated name by prefixing
      with second-to-last NSID segment in camelCase (e.g., "bsky" + "Post" → "bskyPost")
   b. For each colliding record type that is adopted (source='adopted'):
      compute disambiguated name from its adoptedNsid the same way
   c. For each colliding record type that is custom (source='new'):
      leave its name unchanged
   d. Check that all disambiguated names are unique among all record type names
   e. If a disambiguated name still collides → prompt the user to enter a
      custom name for the record being adopted
   f. Apply all name changes and save state
```

## Behavioral Scenarios

**Scenario: Adopt lexicon with unique last segment**
- Setup: One record type exists with name `recipe`
- Action: User adopts `app.bsky.feed.post`
- Expected outcome: New record type gets name `post`. No disambiguation needed.

**Scenario: Adopted lexicon collides with custom record type**
- Setup: Custom record type (source='new') exists with name `post`
- Action: User adopts `app.bsky.feed.post`
- Expected outcome: Adopted record type gets name `feedPost`. Custom record type keeps name `post`.

**Scenario: Adopted lexicon collides with another adopted record type**
- Setup: Adopted record type from `com.example.post` exists with name `post`
- Action: User adopts `app.bsky.feed.post`
- Expected outcome: Existing record type is renamed from `post` to `examplePost`. New record type gets name `feedPost`.

**Scenario: Second-to-last segment also collides**
- Setup: Record type exists with name `feedPost` (from any source)
- Action: User adopts `app.bsky.feed.post` (which would auto-disambiguate to `feedPost`)
- Expected outcome: System prompts user: "The auto-generated name 'feedPost' is already in use. Please enter a unique name for this record type." User enters a name; that name is used.

**Scenario: Three-way collision**
- Setup: Custom record type with name `post`. Adopted record type from `com.example.post` with name `post`.
- Action: User adopts `app.bsky.feed.post`
- Expected outcome: Custom record type keeps name `post`. Existing adopted record becomes `examplePost`. New adopted record becomes `feedPost`.

**Scenario: No collision after prior disambiguation**
- Setup: Two adopted record types: `examplePost` (from `com.example.post`) and `feedPost` (from `app.bsky.feed.post`) — previously disambiguated.
- Action: User deletes the `examplePost` record type.
- Expected outcome: `feedPost` retains its disambiguated name. No rename occurs.

## Ambiguity Warnings

1. **Case sensitivity of collision detection**
   NSID last segments are lowerCamelCase by convention. Custom record type names are also lowerCamelCase. Collision detection should use case-insensitive comparison to catch edge cases like `Post` vs `post`.
   - _Likely assumption:_ Compare using `.toLowerCase()` on both sides.
   - _Please confirm or clarify._

2. **displayName update**
   `RecordType` has both `name` (used for code generation) and `displayName` (human-readable label shown in UI). When we disambiguate `name`, should `displayName` also update?
   - _Likely assumption:_ Leave `displayName` unchanged — it's a human-facing label that the user set, not a code identifier. The user can change it manually if they want.
   - _Please confirm or clarify._

## How to Verify

1. Open the wizard. Create two data types.
2. Adopt `com.example.post` for the first data type. Verify name is `post`.
3. Adopt `app.bsky.feed.post` for the second data type.
4. Verify the first data type was renamed to `examplePost` and the second is `feedPost`.
5. Generate the app and run `npm run dev` — verify no duplicate identifier errors.
6. Repeat with a custom record type named `post` + an adopted lexicon ending in `post` — verify only the adopted one is renamed.
