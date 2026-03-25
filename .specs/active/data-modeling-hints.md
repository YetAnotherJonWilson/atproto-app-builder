# Spec: Data Modeling Hints (AT Protocol Guidance)

**Status:** draft
**Date:** 2026-03-25

## What

Provide contextual hint text and guidance throughout the wizard to help users make good AT Protocol data modeling decisions. This includes explaining concepts that differ from traditional app development, such as: collections-as-lists (you don't need a separate "list" type — the collection of items IS the list), when to use one type vs. two, and how record types map to collections on a user's PDS.

## Why

Users coming from traditional app development will bring mental models that don't always map to AT Protocol. For example, a user building a grocery list app might create both a `groceryList` and `groceryItem` type, when only `groceryItem` is needed — the collection itself acts as the list, with `listRecords` providing listing, pagination, and cursor-based iteration for free. Without guidance, users will over-model their data or create unnecessary types, leading to more complex apps and lexicons than needed.

## Example Guidance Topics

- **Collections are lists:** "Each record type is stored as a collection on the user's PDS. You don't need a separate 'list' type — creating a `groceryItem` type automatically gives you a listable collection of grocery items."
- **Record = atomic unit:** "Each record can be independently created, updated, and deleted. Design your types around the smallest thing a user would act on individually."
- **When you DO need a parent type:** Cases where a grouping record is genuinely useful (e.g., a `playlist` that has its own metadata like name/description, with `playlistItem` records referencing it).
- **Field length (bytes vs. graphemes):** Covered in separate spec (`field-length-guidance.md`), but should be integrated into the same hint system.

## Acceptance Criteria

- [ ] TBD — identify all points in the wizard where data modeling hints would help
- [ ] TBD — write hint content for each topic
- [ ] TBD — design hint UI (inline text, tooltips, expandable sections, etc.)
- [ ] TBD — integrate hints into requirements and data panels

## Scope

**In scope:**
- TBD

**Out of scope:**
- TBD

## Files Likely Affected

- TBD

## How to Verify

- TBD
