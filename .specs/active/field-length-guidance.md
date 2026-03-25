# Spec: Field Length Guidance (Graphemes + Bytes Auto-Conversion)

**Status:** draft
**Date:** 2026-03-25

## What

When users define string fields on their record types, let them enter a simple "max characters" limit. The wizard auto-converts this to both `maxGraphemes` and `maxLength` (bytes) values following AT Protocol conventions. Provide contextual guidance explaining the relationship between graphemes and bytes so users understand what they're configuring.

## Why

AT Protocol string fields have two distinct length constraints: `maxGraphemes` (visual character count, using Unicode Grapheme Clusters) and `maxLength` (storage size in UTF-8 bytes). The AT Protocol style guide recommends always setting both, with a 10:1 to 20:1 byte-to-grapheme ratio. This distinction is confusing for users who just want to say "max 100 characters." The wizard should handle the conversion automatically and educate users along the way.

## Acceptance Criteria

- [ ] TBD — user enters a "max characters" value for string fields
- [ ] TBD — wizard auto-computes maxGraphemes = entered value, maxLength = entered value × 10 (default ratio, possibly configurable)
- [ ] TBD — tooltip or inline guidance explains: "Characters" maps to grapheme clusters (what you see), "Bytes" is the storage limit (emoji and non-Latin characters use more bytes than Latin letters)
- [ ] TBD — advanced toggle to manually set maxLength/maxGraphemes independently for power users
- [ ] TBD — generated lexicon output includes both constraints

## Scope

**In scope:**
- TBD

**Out of scope:**
- TBD

## Files Likely Affected

- TBD

## How to Verify

- TBD
