# Spec: Data Modeling Guidance — Entity vs. Field Decision Aid

**Status:** draft
**Date:** 2026-03-19

## What
Contextual guidance within the wizard that helps users make correct data modeling decisions — specifically, whether a concept should be its own data type (RecordType) or a field within another data type. This includes hints in the requirements form, contextual tips in the Data panel, and potentially a lightweight decision-aid checklist.

## Why
Non-technical users commonly struggle with the entity-vs-field decision. This is the single most reported point of confusion in no-code/low-code app builders (Airtable, Bubble, AppSheet, etc.). The root cause is a mental model mismatch: most users think in spreadsheets (one flat table) rather than relational data (multiple linked types). Without guidance, users will:
- Create data types that should be fields (e.g., "banana" instead of "grocery item")
- Create flat types that should be decomposed (e.g., a "grocery list" with item1, item2, item3 fields instead of a separate "grocery item" type)
- Name types as specific instances rather than the general concept (e.g., "my workout playlist" instead of "playlist")

In the AT Protocol context, this matters because each RecordType maps to a Lexicon schema and a PDS collection. Getting the data model wrong means the generated app will have structural problems that are hard to fix later.

## Research Summary

### The problem is bounded
The entity-vs-field decision almost always falls into one of six recognizable relationship patterns:

1. **Parent-Child (one-to-many)** — A grocery list has many items; a project has many tasks. The child should be its own type. *This is the most common pattern.*
2. **Lookup/Reference** — A category, status, or tag. Simple fixed labels are fields (enum/select); growing lists with their own properties are types.
3. **Many-to-Many** — Students take courses; products have tags. Both sides are types, with a linking relationship.
4. **Ownership** — A user creates posts. Specific case of one-to-many.
5. **Hierarchical/Self-referential** — Categories with subcategories. An entity references itself.
6. **One-to-One Extension** — User/Profile. Usually should just be merged into one type.

### The core heuristic
Across database design education and no-code tool documentation, the decision converges on: **"Does this thing have its own life?"**

Signals it should be a **separate data type**:
- It has its own properties beyond just a name (e.g., a grocery item has name, quantity, checked status, category)
- One parent can have many of them (e.g., a list has many items)
- It's shared/referenced by multiple other types
- The list of them grows over time as users add data
- You'd want to search, filter, or view them independently

Signals it should be a **field**:
- It's a simple label or category from a short, fixed list (e.g., status: active/inactive)
- It's a single value that describes something (name, date, count, boolean)
- It only has meaning in the context of its parent

### What works in other tools
- **Airtable:** "Start as a single select field, upgrade to a linked record when you need more." Progressive disclosure — defer the decision until the user hits the limit.
- **AppSheet:** Field type encodes the decision — Enum for fixed labels, Ref for linked records. The decision is made at the field level.
- **Xano:** AI schema generation from natural language descriptions. Takes the decision away from the user entirely.
- **Adalo/Knack:** "List your nouns — each noun becomes a table." Simple pedagogical framing.
- **Bubble:** "Use lists for simple relationships, separate data types for complex/many-to-many/attribute-rich ones."

### Key insight for implementation
The grocery list example illustrates the most common pattern (parent-child). A grocery *item* has its own properties (name, quantity, checked-off status), one list has many items, and you want to interact with individual items (check them off). So "grocery item" should be a separate type, and the grocery list should reference a collection of them.

The "banana" example illustrates a different problem — naming an instance instead of the type. This is addressed by better framing in the form hint rather than a structural decision aid.

### Compound actions — requirements that involve two data types
Users often describe actions that involve two data types at once. These are **compound actions** — a verb applied to a primary type in the context of a secondary type. Common patterns:

| User says | Verb | Primary type | Context type |
|-----------|------|-------------|--------------|
| "add an item to a list" | add | item | list |
| "assign a task to a person" | assign | task | person |
| "share a document with a user" | share | document | user |
| "move a card from one column to another" | move | card | column |
| "tag a post with a category" | tag | post | category |

The pattern is always: **primary type** (the thing being acted on) + **context type** (the container/target/recipient). The verb applies to the primary type; the context type is a separate data type connected via a relationship.

In our system, compound actions decompose into:
1. A requirement for the primary type: "I need to **add** a **grocery item**"
2. A requirement for the context type (if one doesn't already exist): "I need to **create** a **grocery list**"
3. A relationship between them (expressed as a field in the Data panel, future spec)

This decomposition works with the current verb + single data type form. Users need guidance to recognize compound actions and split them — they should not enter "an item to a grocery list" as the data type.

Sources consulted: Airtable blog/community (base design guides, single-select vs linked-record threads), Bubble.io data documentation, Google AppSheet column type docs, Adalo relational database guide, Knack database design guide, Microsoft Access database design basics, Jeff Smith's entity-vs-attribute analysis, Red Gate entity/attribute article, Metabase data model mistakes guide, Xano AI schema generator.

## Guidance Points

### Point 1: Requirements form — data type naming and compound action hint
**Where:** The form hint below the Data Type combobox in the "do" requirement form.
**Current text (from requirements-data-type-combobox spec):** "What kind of thing does this action work with? Select an existing type or enter a new one. Focus on the thing being acted on — if your action involves two things (like 'add an item to a list'), the item is the data type. The list is a separate type you'll connect later."
**Enhancement:** The hint already covers compound actions (added as part of the requirements-data-type-combobox spec). This guidance point adds reinforcement through examples visible elsewhere — see Point 5.

### Point 2: Data panel — contextual tip for parent-child pattern
**Where:** The Data panel, shown when a user has 2+ data types and one might be a child of another.
**Trigger:** Heuristic TBD — could be based on naming patterns, or simply shown as a static tip.
**Content (draft):**
> "Tip: If one of your data types is a *list of things* that each have their own details (like items in a grocery list, or tasks in a project), those things should be their own data type. You can connect them later."

### Point 3: Field-level nudge (future, when field editing is added)
**Where:** Inline hint shown when a user adds a field that looks like it should be its own type.
**Trigger:** User adds a field with a name suggesting plurality or nested structure (e.g., "items", "tasks", "comments") or with a type that suggests a list.
**Content (draft):**
> "This sounds like it might be a list of things with their own details. Consider making it a separate data type instead of a field."

### Point 4: Compound action decomposition example
**Where:** The Data panel or a help/tips section accessible from the requirements form.
**Purpose:** Show users how a compound action ("add an item to a list") becomes multiple requirements and connected data types.
**Content (draft):**
> **Does your action involve two things?**
>
> *"I need to add an item to my grocery list"* becomes:
> - I need to **add** a **grocery item** *(the thing being acted on)*
> - I need to **create** a **grocery list** *(the container — a separate data type)*
> - Then connect them: a grocery item belongs to a grocery list
>
> Focus each requirement on one type of thing. You'll connect them in the Data section.

### Point 5: Decision-aid checklist (optional, may not be needed)
A lightweight modal or expandable section accessible from the Data panel:

> **Should this be its own data type, or a field?**
>
> It should probably be its **own data type** if:
> - [ ] It has its own properties beyond just a name
> - [ ] One thing can have many of them (e.g., a list has many items)
> - [ ] Multiple data types reference it
> - [ ] The list of them grows as users add data
> - [ ] Users would want to view or search them on their own
>
> It should probably be a **field** if:
> - [ ] It's a simple label (like a status or category)
> - [ ] It's a single value (a name, date, number, yes/no)
> - [ ] It only makes sense attached to something else

## Acceptance Criteria

- [ ] The requirements form data type hint guides users toward naming types and decomposing compound actions
  - When the user sees the "do" requirement form, the hint text beneath the Data Type combobox includes guidance on naming the type of thing (not instances) and focusing on the thing being acted on (not the container).
  - Note: The basic hint text ships with the requirements-data-type-combobox spec. This spec adds reinforcement through examples and tips.
- [ ] The Data panel includes a contextual tip about the parent-child pattern
  - When the user views the Data panel with 2+ data types, a non-blocking tip is visible explaining that lists of things with their own details should be separate types.
  - The tip is dismissible and does not reappear once dismissed.
- [ ] A compound action decomposition example is accessible to users
  - When the user needs help, they can see an example of how "add an item to a list" becomes two requirements and two connected data types.
  - Placement TBD: could be in the Data panel tips, a help section, or the requirements empty state.
- [ ] A decision-aid reference is accessible from the Data panel
  - When the user wants help deciding, they can access a checklist (via a help link, expandable section, or similar) that walks through the entity-vs-field signals.

## Scope
**In scope:**
- Form hint text improvement for the data type combobox
- Contextual tip in the Data panel (static or lightly heuristic-based)
- Decision-aid checklist content and placement
- Dismissal persistence for tips (localStorage flag)

**Out of scope:**
- AI-powered schema suggestion or automatic entity detection
- Automatic detection of fields that should be types (beyond simple naming heuristics)
- Relationship/linking UI between data types (separate spec)
- Template-based starter schemas for common app types

## Ambiguity Warnings

1. **Timing relative to data type editing**
   The Data panel contextual tip and decision-aid checklist are most useful when users are actively editing data types (adding fields, naming them). Since data type editing is a separate future spec, the timing of this guidance spec may need to align with that work.
   - _Likely assumption:_ The form hint (Point 1) can ship with the requirements-data-type-combobox spec. Points 2-4 ship alongside or after the data-type-editing spec.
   - _Please confirm or clarify._

2. **Checklist as modal vs. inline**
   The decision-aid checklist could be a modal dialog, an expandable section within the Data panel, a tooltip, or a link to external documentation. The right choice depends on how much it disrupts the flow.
   - _Likely assumption:_ An expandable section or "help" link within the Data panel, not a modal.
   - _Please confirm or clarify._

3. **Tip trigger heuristic**
   Point 2 says "shown when a user has 2+ data types and one might be a child of another." Detecting parent-child relationships from names alone is fragile. A simpler trigger (e.g., always show the tip the first time a user has 2+ types) may be more reliable.
   - _Likely assumption:_ Show the tip once when the user first has 2+ data types. Don't try to detect patterns.
   - _Please confirm or clarify._

## Files Likely Affected
- `src/app/views/panels/RequirementsPanel.ts` — Updated hint text for data type combobox
- `src/app/views/panels/DataPanel.ts` — Contextual tip rendering and dismissal logic
- `styles/workspace/data-panel.css` — Tip styling (if not covered by existing classes)

## How to Verify
1. Open the "do" requirement form — confirm the data type hint includes type-vs-instance guidance
2. Create 2+ data types — confirm the contextual tip appears in the Data panel
3. Dismiss the tip — confirm it does not reappear on re-render or page reload
4. Access the decision-aid checklist — confirm it displays the entity-vs-field signals
