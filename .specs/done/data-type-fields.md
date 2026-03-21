# Spec: Data Type Fields — Field Editing & AT Protocol Type System

**Status:** active
**Date:** 2026-03-19
**Depends on:** `.specs/active/data-type-identity.md`

## What

Within the data type detail view (from `data-type-identity.md`), users add, edit, and delete fields that define the schema for their lexicon record type. The field editor supports AT Protocol lexicon data types with type-specific constraints. For adopted lexicons, fields are imported from the upstream schema and displayed read-only. A `createdAt` system field is auto-included for new lexicons.

## Why

Fields are the core of a data type definition — they define what data each record contains. This maps directly to the `properties` object in the generated lexicon schema. Without fields, the generated app has no data structure to work with. The field type system must align with AT Protocol's lexicon specification so that generated schemas are valid and interoperable.

## Field Types

The wizard presents AT Protocol lexicon types using user-friendly labels. Each type maps to a lexicon schema representation and shows type-specific constraint fields.

### Type Table

| User-Facing Label | Lexicon Type | Constraints Shown | Notes |
|---|---|---|---|
| Text | `string` | Format, Max length, Min length, Max graphemes, Min graphemes | Most common type. Format is optional. |
| Number | `integer` | Minimum, Maximum | Whole numbers only. |
| True/False | `boolean` | _(none)_ | |
| Date & Time | `string` (format: `datetime`) | _(none, format is pre-set)_ | Shortcut — generates `{ type: "string", format: "datetime" }` |
| Link (URI) | `string` (format: `uri`) | Max length | Shortcut — generates `{ type: "string", format: "uri" }` |
| AT Protocol Link | `string` (format: `at-uri`) | _(none, format is pre-set)_ | Reference to a record in the AT Protocol network. |
| Handle | `string` (format: `handle`) | _(none, format is pre-set)_ | An AT Protocol handle (e.g., alice.bsky.social). |
| DID | `string` (format: `did`) | _(none, format is pre-set)_ | A Decentralized Identifier. |
| Language | `string` (format: `language`) | _(none, format is pre-set)_ | BCP-47 language tag. |
| File Upload | `blob` | Accepted file types (MIME), Max file size | |
| Raw Bytes | `bytes` | Min length, Max length | Binary data. |
| Content Hash | `cid-link` | _(none)_ | Reference by content hash. |
| List of Text | `array` (items: `string`) | Max items, Min items | |
| List of Numbers | `array` (items: `integer`) | Max items, Min items | |
| Reference | `ref` | Target type | Link to another record type (internal or external NSID). |

### String Format Options

When the user selects "Text" type, an optional Format dropdown appears:

| Format | Description |
|---|---|
| _(none)_ | Plain text, no format validation |
| `datetime` | ISO 8601 date-time |
| `uri` | A URL or URI |
| `at-uri` | An AT Protocol URI (at://...) |
| `did` | A Decentralized Identifier |
| `handle` | An AT Protocol handle |
| `nsid` | A Namespaced Identifier |
| `tid` | A Timestamp Identifier |
| `record-key` | A valid record key |
| `language` | BCP-47 language tag |
| `cid` | A Content Identifier string |

Note: Date & Time, Link (URI), AT Protocol Link, Handle, DID, and Language are shortcuts that pre-set the format. Using the Text type with a Format dropdown produces the same lexicon output. The shortcuts exist for discoverability — common formats shouldn't require users to know about the Format dropdown.

### Type-Specific Constraint Fields

**Text (string):**
- Format: Select dropdown (see above)
- Max length: Number input, label "Max length (bytes)", hint "Maximum length in UTF-8 bytes"
- Min length: Number input, label "Min length (bytes)"
- Max graphemes: Number input, label "Max graphemes", hint "Maximum length in visible characters (grapheme clusters)"
- Min graphemes: Number input, label "Min graphemes"
- All constraint fields are optional.

**Number (integer):**
- Minimum: Number input, label "Minimum value"
- Maximum: Number input, label "Maximum value"

**File Upload (blob):**
- Accepted file types: Text input, label "Accepted file types", placeholder "image/*, video/mp4", hint "MIME type patterns, comma-separated. Use * for any type."
- Max file size: Number input with unit selector (KB/MB), label "Max file size"

**Raw Bytes (bytes):**
- Min length: Number input, label "Min length (bytes)"
- Max length: Number input, label "Max length (bytes)"

**List of Text / List of Numbers (array):**
- Max items: Number input, label "Maximum items"
- Min items: Number input, label "Minimum items"

**Reference (ref):**
- Target type: Combobox showing internal RecordTypes (by displayName) plus an "Enter external NSID" option. If external, a text input for the full NSID (e.g., `app.bsky.feed.post`).
- The lexicon output is `{ "type": "ref", "ref": "[target-nsid]" }` for external or `{ "type": "ref", "ref": "#[defName]" }` for local definitions.

## System Fields

New lexicons (source: 'new') automatically include a `createdAt` field:

- **Name:** `createdAt`
- **Type:** `string`, format `datetime`
- **Required:** Yes
- **System field:** Yes — displayed with a "System" badge, cannot be deleted or renamed. The user can see it but not remove it.
- **Position:** Always last in the field list.

This field is not added for adopted lexicons (their fields come from the upstream schema, which may or may not include `createdAt`).

## Field Editor UI

The Fields section appears below the Lexicon Source section in the detail view (from `data-type-identity.md`).

### Fields Section Header

```
─── Fields ─────────────────────────
[+ Add Field] button (right-aligned, hidden for adopted lexicons)
```

### Field List

Fields are displayed as a vertical list (not cards). Each field row shows:

```
[field-name]    [type-badge]    [Required badge]    [Edit] [Delete]
[description, if present — secondary text]
```

- **field-name:** The field's name in bold/primary text
- **type-badge:** Styled badge showing the user-facing type label (e.g., "Text", "Number", "List of Text")
- **Required badge:** Shown only for required fields
- **Edit/Delete buttons:** Icon buttons, right-aligned. Hidden for system fields (createdAt) and for adopted lexicons.
- **Description:** If the field has a description, shown below the name as secondary/muted text

### Empty State (new lexicons only)

When a new lexicon has no user-added fields (only the system createdAt field):

```
No fields defined yet. Click "+ Add Field" to describe what data this record stores.

[createdAt]    [Date & Time]    [Required]    [System]
```

### Read-Only State (adopted lexicons)

For adopted lexicons, the field list shows all imported fields without Edit/Delete buttons. A note at the top of the section:

"These fields are defined by the adopted lexicon ([NSID]). They cannot be modified."

If the adopted schema contains types not supported by the wizard's type system (e.g., `union`, nested `object`), those fields are displayed with a generic type badge (e.g., "Union (complex)" or "Object (nested)") and a tooltip: "This field type is not editable in the wizard. It will be preserved as-is in the generated schema."

### Add/Edit Field Form

Clicking "+ Add Field" or "Edit" opens an inline form below the field list (similar to the RequirementsPanel inline form pattern). Only one field can be edited at a time.

**Form fields:**

1. **Name** — Text input. Validation: 1–63 characters, letters and digits only, cannot start with a digit, lowerCamelCase convention. No duplicate names within the same RecordType.
   - Label: "Field name"
   - Hint: "Use lowerCamelCase (e.g., firstName, itemCount). This becomes the property name in the schema."

2. **Type** — Select dropdown with all types from the Type Table.
   - Label: "Type"
   - On change: shows/hides the type-specific constraint fields.

3. **Type-specific constraints** — Shown/hidden based on selected type (see Type-Specific Constraint Fields section above).

4. **Required** — Checkbox.
   - Label: "Required"
   - Hint: "Required fields must be present in every record."

5. **Description** — Textarea (optional).
   - Label: "Description"
   - Hint: "Briefly describe what this field stores. This appears in the lexicon schema."

**Form buttons:**
- **Save** — Validates, saves field to RecordType, closes form, re-renders field list. Disabled until form is valid (name is set and unique, type is selected).
- **Cancel** — Discards changes, closes form.

### Edit Pre-fill

When editing an existing field, the form pre-fills with all current values. The type-specific constraint fields are shown/hidden based on the current type.

### Delete Confirmation

Clicking "Delete" shows an inline confirmation: "Delete field [name]? [Confirm] [Cancel]". No modal dialog — inline, like the RequirementsPanel pattern.

## Data Model Changes

### Field (updated)

```typescript
interface Field {
  id: string;
  name: string;
  type: string;           // 'string' | 'integer' | 'boolean' | 'blob' | 'bytes' |
                          // 'cid-link' | 'array-string' | 'array-integer' | 'ref'
  format?: string;        // for string type: 'datetime' | 'uri' | 'at-uri' | 'did' |
                          // 'handle' | 'nsid' | 'tid' | 'record-key' | 'language' | 'cid'
  maxLength?: number;     // string (bytes), bytes, array (items)
  minLength?: number;     // string (bytes), bytes, array (items)
  maxGraphemes?: number;  // string
  minGraphemes?: number;  // string
  minimum?: number;       // integer
  maximum?: number;       // integer
  accept?: string[];      // blob — MIME type patterns
  maxSize?: number;       // blob — bytes
  refTarget?: string;     // ref — target NSID or internal RecordType id
  mediaType?: string;     // DEPRECATED — remove in favor of blob accept
  description?: string;
  required: boolean;
  isSystem?: boolean;     // true for auto-generated fields like createdAt
}
```

**Migration from existing Field interface:**
- `maxLength` — preserved, semantics unchanged (was used for string maxLength in bytes)
- `mediaType` — deprecated. Existing fields with `type: 'media-url'` should be migrated to `type: 'string'` with `format: 'uri'`. The `mediaType` field is ignored going forward.
- `type: 'media-url'` — deprecated. Migrated to `type: 'string'`, `format: 'uri'`.
- `type: 'array-number'` — migrated to `type: 'array-integer'` (AT Protocol uses "integer", not "number")
- New fields (`minLength`, `maxGraphemes`, `minGraphemes`, `minimum`, `maximum`, `accept`, `maxSize`, `refTarget`, `isSystem`) default to `undefined` / `false`

## Adopted Lexicon Field Import

When a lexicon is adopted (via `data-type-identity.md`), the schema's `properties` object is mapped to Field objects:

| Schema Property | Field Mapping |
|---|---|
| `{ type: "string" }` | `type: "string"` |
| `{ type: "string", format: "datetime" }` | `type: "string"`, `format: "datetime"` |
| `{ type: "integer" }` | `type: "integer"` |
| `{ type: "boolean" }` | `type: "boolean"` |
| `{ type: "blob" }` | `type: "blob"` |
| `{ type: "bytes" }` | `type: "bytes"` |
| `{ type: "cid-link" }` | `type: "cid-link"` |
| `{ type: "array", items: { type: "string" } }` | `type: "array-string"` |
| `{ type: "array", items: { type: "integer" } }` | `type: "array-integer"` |
| `{ type: "ref", ref: "..." }` | `type: "ref"`, `refTarget: "..."` |
| `{ type: "union", ... }` | `type: "union"` (unsupported — display only) |
| `{ type: "unknown" }` | `type: "unknown"` (unsupported — display only) |
| Nested `{ type: "object", ... }` | `type: "object"` (unsupported — display only) |

Constraints (maxLength, minimum, maximum, etc.) are mapped directly. The `required` array from the schema sets each field's `required` flag. Fields not in the `required` array default to `required: false`.

## Generator Updates

The existing `src/generator/Lexicon.ts` needs updates to handle:
- New field types (`ref`, new constraint fields)
- The `minLength`, `maxGraphemes`, `minGraphemes`, `minimum`, `maximum`, `accept`, `maxSize` constraints
- The `createdAt` system field (should be included in required array)
- Adopted lexicons: the generator should use `adoptedSchema` directly rather than re-generating from fields
- NSID generation from the new namespace options (not just `AppInfo.domain`)

These generator changes should be made alongside the field editing UI to keep the pipeline consistent.

## Acceptance Criteria

- [ ] Users can add fields to new lexicon data types
  - When the user clicks "+ Add Field", an inline form appears below the field list with fields for name, type, constraints, required, and description.
  - When the user selects a type, the appropriate constraint fields appear (e.g., selecting "Text" shows format, max/min length, max/min graphemes).
  - When the user saves a valid field, it appears in the field list with name, type badge, and required badge.
  - When the user saves, the field count on the card grid updates on next render.

- [ ] Users can edit existing fields
  - When the user clicks "Edit" on a field, the inline form appears pre-filled with the field's current values.
  - When the user changes the type, constraint fields update to match the new type. Constraint values from the previous type are cleared.
  - When the user saves, the field list updates to reflect changes.

- [ ] Users can delete fields (with confirmation)
  - When the user clicks "Delete" on a field, an inline confirmation appears: "Delete field [name]? [Confirm] [Cancel]".
  - When the user confirms, the field is removed from the list and state is saved.
  - System fields (createdAt) cannot be deleted — no Delete button is shown.

- [ ] System fields are auto-included for new lexicons
  - When a new lexicon data type is created, a `createdAt` field (string, format: datetime, required) is automatically present.
  - The createdAt field is displayed with a "System" badge and has no Edit/Delete buttons.
  - Adopted lexicons do not get a system createdAt — they use whatever the upstream schema defines.

- [ ] Field validation prevents invalid entries
  - When the user enters a field name that starts with a digit, contains non-alphanumeric characters, or is empty, an inline error is shown and Save is disabled.
  - When the user enters a field name that duplicates an existing field in the same RecordType, an inline error is shown: "A field with this name already exists."
  - When the form is invalid, the Save button is disabled.

- [ ] Adopted lexicons show fields as read-only
  - When viewing an adopted data type, fields from the upstream schema are listed without Edit/Delete buttons.
  - A note at the top explains the fields are defined by the adopted lexicon.
  - Unsupported types (union, nested object) are displayed with a descriptive badge and cannot be edited.

- [ ] Reference fields allow linking to internal or external types
  - When the user selects "Reference" type, a target selector appears showing internal RecordTypes by displayName.
  - When the user selects "Enter external NSID", a text input appears for the full NSID.
  - The reference is stored as `refTarget` on the Field.

- [ ] All supported field types produce valid lexicon schema output
  - When a data type with fields is passed to the generator, the output lexicon JSON is valid per the AT Protocol Lexicon specification.
  - All constraint values are correctly mapped to the schema properties.

## Behavioral Scenarios

**Scenario: Add a text field with constraints**
- Setup: User is in the detail view for "grocery item" (new lexicon, identity configured).
- Action: User clicks "+ Add Field". Enters name "itemName", selects type "Text", sets max length to 200, checks "Required", adds description "The name of the grocery item". Clicks Save.
- Expected: Field appears in list: `itemName [Text] [Required]` with description below. createdAt system field remains at the bottom.

**Scenario: Add a reference field to another data type**
- Setup: User has two data types: "grocery item" and "grocery list". Both have identities configured.
- Action: User opens "grocery item" detail view, clicks "+ Add Field". Enters name "list", selects type "Reference". In the target selector, chooses "grocery list" (internal).
- Expected: Field saved with `refTarget` set to the grocery list's NSID (or internal ID). Field appears in list: `list [Reference] → grocery list`.

**Scenario: Type change clears previous constraints**
- Setup: User is editing a field currently set to "Text" with maxLength: 200.
- Action: User changes the type to "Number".
- Expected: Text constraint fields (format, max/min length, max/min graphemes) disappear. Number constraint fields (minimum, maximum) appear with empty values. The previously set maxLength is cleared.

**Scenario: Delete a field**
- Setup: User has a "grocery item" with fields: itemName, quantity, createdAt.
- Action: User clicks Delete on "quantity".
- Expected: Inline confirmation: "Delete field quantity? [Confirm] [Cancel]". User clicks Confirm. Field is removed. List now shows: itemName, createdAt.

**Scenario: Cannot delete system field**
- Setup: User sees the createdAt field in the field list.
- Action: User looks for a Delete button on createdAt.
- Expected: No Delete button is present. The field has a "System" badge instead.

**Scenario: View adopted lexicon fields (read-only)**
- Setup: User has adopted `app.bsky.feed.post`.
- Action: User views the Fields section.
- Expected: Fields listed: text (Text, Required), facets (List — complex), embed (Union — complex), langs (List of Text), labels (Union — complex), tags (List of Text), createdAt (Date & Time, Required). No "+ Add Field" button. No Edit/Delete on any field. Note at top: "These fields are defined by the adopted lexicon (app.bsky.feed.post). They cannot be modified."

**Scenario: Duplicate field name (validation)**
- Setup: User has a field named "itemName".
- Action: User clicks "+ Add Field" and enters "itemName" as the name.
- Expected: Inline error: "A field with this name already exists." Save button is disabled.

**Scenario: Add a blob field with constraints**
- Setup: User is adding a field.
- Action: Selects type "File Upload". Enters accepted types "image/*", sets max size to 1 MB.
- Expected: Constraint fields for accepted file types and max size are shown. On save, field has `accept: ["image/*"]` and `maxSize: 1048576`.

## Scope

**In scope:**
- Field add/edit/delete inline form in the detail view
- Expanded field type system aligned with AT Protocol lexicon spec
- Type-specific constraint forms
- System field (createdAt) auto-inclusion
- Read-only field display for adopted lexicons
- Reference fields linking to internal RecordTypes or external NSIDs
- Field import mapping from adopted lexicon schemas
- Data model updates to Field interface
- Generator updates for new types and constraints

**Out of scope:**
- Union type editing (too complex for initial release — displayed read-only for adopted lexicons)
- Nested object type editing (same — displayed read-only)
- Token type definitions
- Field reordering (fields display in creation order)
- Enum / knownValues constraint for strings (future enhancement)
- Field-level guidance from data-modeling-guidance spec (Point 3 in that spec — nudge when a field looks like it should be its own type)
- Bulk field operations (select multiple, delete multiple)

## Ambiguity Warnings (all resolved)

1. **Reference field target — internal ID vs NSID** — **Resolved:** Store internal RecordType ID. Resolve to NSID at generation time. External refs store the full NSID string.

2. **Shortcut types vs Text + Format** — **Resolved:** Store canonically as `type: "string"` + `format`. Shortcuts are UI-only labels.

3. **Generator refactoring scope** — **Resolved:** Update the generator as part of this spec.

4. **Inline form vs dialog for field editing** — **Resolved:** Inline forms, consistent with RequirementsPanel.

## Files Likely Affected

### Modified Files
- `src/app/views/panels/DataPanel.ts` — Add fields section to the detail view
- `src/types/wizard.ts` — Update Field interface with new constraint fields
- `src/generator/Lexicon.ts` — Update to handle new field types and constraints
- `src/app/operations/FieldOps.ts` — Refactor for inline form pattern (or rewrite)
- `src/utils/nsid.ts` — May need updates for namespace option-aware NSID generation
- `styles.css` — Field list styling, inline form styling, type badges

### New Files
- None anticipated — field editing integrates into DataPanel.ts and FieldOps.ts

### Deprecated
- `src/app/operations/FieldOps.ts` — The current dialog-based field operations may be largely rewritten for inline forms

## How to Verify

1. Open a new-lexicon data type detail view — confirm "+ Add Field" button is visible
2. Confirm createdAt system field is present with System badge and no Edit/Delete
3. Click "+ Add Field" — confirm inline form appears with name, type, required, description
4. Select each field type — confirm type-specific constraints appear/disappear
5. Add a field with valid inputs — confirm it appears in the list
6. Add a field with invalid name (digit start, duplicate) — confirm inline error and disabled Save
7. Edit a field — confirm form pre-fills with current values
8. Delete a field — confirm inline confirmation and removal
9. Open an adopted data type — confirm fields are read-only with no Add/Edit/Delete
10. Add a reference field — confirm target selector shows internal RecordTypes
11. Verify the generator produces valid lexicon JSON for each field type
12. `npm run build` compiles without errors
13. `npx vitest run` passes
