---
sketch: 031
name: views-sidebar-group
question: "How do saved views render in the sidebar as honest saved-queries (not droppable folders) — funnel icon vs amber folder, count badge, reused G pill, no drop target, hover Edit/Rename/Delete, empty state, active selection?"
winner: "A"
tags: [phase-114, document-management, virtual-folders, sidebar, foldernode-parity, honesty, drag-drop, count-badge]
---

# Sketch 031: Views Sidebar Group

## Design Question

D-114-7/8/9: saved views render under a **"Views" group below "Folders"** in the existing Documents sidebar. The hard part is **honesty** — a view is a *saved query*, so it must not look or behave like a folder (a container you drop files into). It mirrors `FolderNode` (`FolderNode.tsx`) for selection/active-state/hover-menu parity, but:

- **funnel icon** (vs the amber folder icon),
- **rejects drag-drop** file moves (no drop highlight — you cannot "put a file into" a query),
- seeded **global** views reuse the existing **`G` pill** (`FolderNode.tsx:183`),
- a **per-view count badge** ("Invoices · 47") fetched **lazily + cached** (D-114-8),
- hover menu = **Edit / Rename / Delete** (D-114-9).

## How to View

open .planning/sketches/031-views-sidebar-group/index.html

**Try the drag honesty:** grab a document card in the content area and drag it over the sidebar. **Folder rows turn green ("↳ move here")**; **View rows turn red and refuse ("⛛ a view is a query — can't drop files")** with a no-drop cursor. Also watch the **count badges shimmer then resolve** (the lazy/cached fetch), hover a view for the **Edit/Rename/Delete** menu, and click a view to see the **active state** + the "loads filter back into the builder" note.

## Variants

- **A — Below Folders, full FolderNode parity** ★ recommended — "Views" header mirrors "Folders"; rows match folder rows exactly except the funnel icon + no-drop + count badge + `G` pill. Feels native immediately; relies on the icon + drop-refusal to carry the "query not container" distinction.
- **B — Quieter / secondary** — views rendered smaller and muted to push the distinction harder visually. Risk: saved views become easy to overlook (they're a primary navigation affordance, not chrome).
- **C — One "Library", two labeled sub-sections** — Folders + Views framed under a single "Library" heading with a divider and per-section `＋`. Strongest conceptual framing ("two honest kinds of the same thing"); costs a little vertical space and a heavier header.

## What to Look For

- **The icon test:** at a glance, does the funnel read as "query" vs the amber folder as "container"? Is it enough, or does it need the label/treatment help from B/C?
- **Drop refusal:** does the red no-drop feedback teach the distinction without being punishing?
- **Count badge:** shimmer→number lazy load — acceptable, or does it need a cheaper count path / on-demand-only at ~10k docs (SC#3 fallback)?
- **`G` pill reuse** on the seeded global "Compliance" view — consistent with global folders?
- **Hover menu parity** with `FolderNode` (Edit reopens the 029 builder pre-filled; Rename inline; Delete).
- **Empty state** (A shows it if VIEWS is emptied): "filter documents and Save as view".

## Audit-driven notes (2026-06-19, workflow `wf_dc339594-8bb`)

- **The drag-drop demo is illustrative only.** The Documents page has **no file drag-drop today** (file moves are Health-page-only via `MoveToFolderDialog`); the folder tree has zero drag handlers. So the original D-114-7 "rejects drag-drop file moves" acceptance line guarded a behavior that doesn't exist. **Operator decision (2026-06-19, D-114-14): the dead line is STRUCK; instead 114 adds a lightweight "Move to folder" document-row action reusing `MoveToFolderDialog`** (closes the real gap — you can't move a doc into a folder from this page today). No drag-drop is built. **The honest Views-vs-Folders differentiator is the funnel icon + count badge + absence of a "new subfolder" action.**
- **Terminology locked to "saved filters"**, never "query" — copy updated across 029/031/032.
- **Count badge at scale (SC#3):** the lazy resolve should use an **additive count-only mode** (`count='exact'`, `head=True`) so per-view badges don't materialize full listings at ~10k docs — shared with the live builder count.
- The folder tree these rows mirror is itself being polished first — see **sketch 033** (build Views from the fixed `NavRow`, not a clone of the flawed `FolderNode`).
