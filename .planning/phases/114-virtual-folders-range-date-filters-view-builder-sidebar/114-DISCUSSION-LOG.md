# Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 114-virtual-folders-range-date-filters-view-builder-sidebar
**Areas discussed:** Builder shape & live preview, Relative-date semantics, Views sidebar affordance, Matching & case-sensitivity

---

## Builder — surface & authoring flow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline filter bar + Save as view | Condition bar on the Documents page; live filtering; "Save as view" persists it; sidebar view loads filter back into the bar; one mental model | ✓ |
| Dedicated builder panel | Right-side push/split panel (reuse Phase 112 shell), "+ New view"; list stays folder-only | |
| Modal dialog | Focused "+ New view" modal; overlays the list, breaks push-never-overlay | |

| Option | Description | Selected |
|--------|-------------|----------|
| Live debounced count | "N documents match" updates as you edit (resolve returns count); trustworthy no-DSL builder | ✓ |
| Save-then-see | No live count; results appear after save/open | |

| Option | Description | Selected |
|--------|-------------|----------|
| Edit in place (mutable) | Reopen pre-filled; PATCH the same view; personal convenience | ✓ |
| Immutable / save-as-copy | Editing forks a new view; original frozen | |

**User's choice:** Inline filter bar + Save-as-view; live debounced count; edit-in-place.
**Notes:** Ad-hoc filtering and saved views are one surface — ad-hoc filtering is a free byproduct. (D-114-1/2/3)

---

## Dates — relative-date semantics & indexed field

| Option | Description | Selected |
|--------|-------------|----------|
| Relative + fixed + range | within next N days / older than N days (live-recomputed) + before/after + between | ✓ |
| Fixed dates only | before/after + between; no relative-to-today (loses "expiring within N days") | |
| Full set | add within last N days / next N weeks-months | |

| Option | Description | Selected |
|--------|-------------|----------|
| Upcoming only (today → today+N) | Excludes already-overdue; "expiring" = coming due soon | ✓ |
| Include overdue (≤ today+N) | Also returns past-due docs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Promote `date` + `document_type`; cast others | SC#1 hot fields → typed btree-indexed columns; custom date/number via safe cast (non-indexed); no per-user columns | ✓ |
| Add first-class "expiry date" built-in now | Broadens data model + obligates extraction changes | |
| You decide | Defer to research | |

**User's choice:** Relative+fixed+range; upcoming-only; promote `date`+`document_type`, cast the rest.
**Notes:** No new expiry built-in; filter on whatever date field the user picks; built-in `date` is the indexed fast path. (D-114-4/5/6)

---

## Sidebar — render-as-folder affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Funnel icon + no drop target + `G` pill | "Views" group below "Folders"; funnel icon; rejects drag-drop; reuse global `G` pill | ✓ |
| Folder icon, group header only | Same icon; only the section header distinguishes; weak affordance | |
| You decide | Defer to sketch | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — lazy/cached count | "Invoices · 47"; one resolve per view, lazy + cached, refresh on open | ✓ |
| No count | Cheapest; count only when opened | |
| You decide | Defer to research | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the folder hover menu | Reuse FolderNode menu: Edit (reopens bar) / Rename / Delete | ✓ |
| Minimal: select + delete | Open + remove only | |
| You decide | Defer | |

**User's choice:** Funnel icon + no-drop + `G` pill; lazy/cached count badge; mirror the folder hover menu.
**Notes:** A view is a query, not a drop target — the affordance must say so honestly. (D-114-7/8/9)

---

## Matching — case-sensitivity & operator semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive | `document_type` eq / `contains` / `one_of` case-insensitive (lower()/citext/ILIKE); filters work on real data | ✓ |
| Case-sensitive exact | What Phase 113 ships; real data won't match (D-113-11 risk) | |
| You decide | Defer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Substring (ILIKE %v%) | "report" matches "Annual Report 2025" | ✓ |
| Whole-word / token match | "report" only as a standalone word | |
| You decide | Defer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Absent OR empty value | key absent AND ''/[] both count as empty | ✓ |
| Only truly-absent key | explicit empty string doesn't count | |
| You decide | Defer | |

**User's choice:** Case-insensitive; contains = substring/ILIKE; is-empty = absent OR empty.
**Notes:** Surfaced the consequence — case-insensitivity touches Phase 113's `@>` `eq` fast-path (logged as research flag R-114-A, with a note to update the 113 case-sensitive eq tests). (D-114-10/11/12)

---

## Final gate

**Asked:** ready for context / add sort now / explore more gray areas.
**User's choice:** "I'm ready for context." Sort stays deferred (newest-first only).

## Claude's Discretion

- Filter-bar layout, per-type operator menu rendering, relative-date input control, "Save as view" naming/scope micro-flow → resolved by the G-2 sketch.
- Live-count endpoint shape (reuse resolve vs. a count-only variant).
- Funnel/filter icon choice + Views-group empty-state copy.

## Deferred Ideas

- Custom sort / sort-by-metadata-field (newest-first only in 114).
- First-class "expiry/effective date" built-in metadata field.
- Nested OR/NOT boolean trees + metadata→pseudo-folder grouping levels (flat AND-list first).
- User-created shared/global views ("share my view") — globals stay seed-only.
- Stale-field governance signal → Phase 119.
- Agent-tool resolution of a view in chat → Phase 115.
- Reviewed-not-folded todo: `spike-nl-workflow-authoring.md`.
- Reported-bugs cross-check: 7 open Agentic-RAG reports, none overlap 114 → none folded.
