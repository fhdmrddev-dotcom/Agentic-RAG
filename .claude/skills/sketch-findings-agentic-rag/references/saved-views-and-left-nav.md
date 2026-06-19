# Saved Views & the Left Nav — the shared NavRow (Phase 114 — sketches 031, 033)

How saved views render in the Documents sidebar, and the light polish of the existing folder tree so Folders and Views read as peers built from ONE row. Winners: 031-A (Views group, full parity) + 033-A (unified NavRow). The operator flagged the existing tree as "not good"; a 5-investigator audit verified the debt. **The governing rule: extract one `NavRow`, build BOTH Folders and Views from it — never clone the flawed `FolderNode`.**

## Design Decisions

### The shared `NavRow` primitive (033-A, D-114-13 — ships inside Phase 114, before Views)
Extract one row from today's `FolderNode`: **icon slot · name · count · reachable hover menu**. Folders and Views differ ONLY by:
- **icon** — amber folder (`text-amber-500/70`, a container) vs **funnel** (`text-primary`, a saved filter);
- **which actions appear** — folders: New-subfolder + Rename/Delete; views: Edit/Rename/Delete (no New-subfolder).

Fixes the verified debt (all in the live `FolderNode.tsx`/`FolderTree.tsx`):
- **Counts on every row** — today only Root shows a count (`FolderTree.tsx:147-149`); `FolderNode` renders none. Add a per-folder count in the same slot Views use, so the two groups are consistent (D-114-8 mandates View counts — parity is non-negotiable).
- **Flat Views** — a saved filter never nests; render Views as a flat list, never the recursive tree.
- **Softened + capped nesting** — replace the two hand-drawn 1px branch-guide divs (`FolderNode.tsx:91-108`) with a single soft indent guide; cap meaningful indent at ~3 levels and lean on the existing `FolderBreadcrumb` beyond, so deep names never truncate.
- **Labeled `G` pill** — give the bare uppercase `G` (`FolderNode.tsx:183`) a tooltip ("Global — shared with everyone"); reuse the labeled affordance on global Views.
- **Reachable actions** — the hover menu is faintly visible at rest + keyboard/touch reachable (today it's `opacity-0`, ~24px, hover-only — undiscoverable on touch).
- Optional **"filter folders & views" box** at the top once there are many of either.

### Views as honest saved-filters (031-A, D-114-7)
- A **"Views" group below "Folders"** in the sidebar, built from the NavRow. Mirrors folder selection/active-state so it feels native.
- **Differentiator = funnel icon + count badge + absence of a "new subfolder" action.** NOT drop rejection.
- **Per-view count badge** ("Invoices · 47"), fetched **lazily + cached** via the count-only resolve (D-114-8); shimmer → number on first sight.
- **Seeded global views reuse the labeled `G` pill** (read-only indicator — globals stay seed-only; no user "share/make-global" path).
- **Hover menu = Edit / Rename / Delete** (D-114-9). Edit reopens the 029 filter bar pre-filled (PATCHes in place). Inline rename = the `InlineEdit` (FolderNode) pattern.
- **Empty state:** "No saved views yet — filter documents and Save as view."
- **Terminology is "saved filters," never "query."**

### File moves — the struck criterion + the real fix (D-114-14)
There is **no file drag-drop on the Documents page today** (folder tree has zero drag handlers; moves are Health-page-only via `MoveToFolderDialog`). The original "Views reject drag-drop" criterion guarded a non-existent behavior → **struck**. Instead, add a lightweight **"Move to folder" document-row menu action reusing the existing `MoveToFolderDialog`** — closes the real gap (you can't currently move a doc into a folder from this page). No drag-drop interaction is built.

## CSS Patterns

```css
/* shared NavRow — Folders + Views from one row */
.nr { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:var(--radius-md);
  color:var(--color-text-muted); }
.nr:hover, .nr:focus-within { background:var(--color-accent); color:var(--color-text); }
.nr.active { background:var(--color-primary-dim); color:var(--color-primary); box-shadow:inset 2px 0 0 var(--color-primary); }
.nr .ico.folder { color:hsl(38 92% 60% / 0.75); }  /* amber — container */
.nr .ico.view   { color:var(--color-primary); }     /* funnel — saved filter */
.nr .cnt { font-family:var(--font-mono); font-size:10px; color:var(--color-text-dim); margin-left:auto; }
.nr .gpill { font-size:9px; text-transform:uppercase; color:var(--color-text-muted);
  background:var(--color-muted); padding:1px 6px; border-radius:var(--radius-full); cursor:help; } /* tooltip-labeled */
.nr .menu { opacity:.25; }                            /* faintly visible at rest */
.nr:hover .menu, .nr:focus-within .menu { opacity:1; }
.nr .menu button:focus { outline:1px solid var(--color-primary-glow); }  /* keyboard reachable */
.nr-wrap.indented { border-left:1px solid var(--color-border-soft); margin-left:14px; } /* ONE soft guide */
/* lazy count badge */
.cnt.dot-load { background:linear-gradient(90deg,var(--color-muted),var(--color-accent),var(--color-muted));
  background-size:200% 100%; animation:shimmer 1.1s linear infinite; }
```

## HTML Structures

- **Sidebar:** `Folders` group header (+ New-folder) → NavRows (tree) → `Views` group header (+ New-view → opens the filter bar) → flat NavRows. Both headers match the existing `text-[10px] uppercase tracking-wider` style.
- **NavRow:** `chev · icon · name · [G pill] · count · menu(＋/⋯ or ✎/⋯)`.
- **Capped nesting (033-C alt):** beyond ~3 levels, stop indenting and prefix the path inline (`…/Q1/`); the breadcrumb carries deep location.

## What to Avoid

- ❌ Cloning today's `FolderNode` for Views (propagates no-count / dense-guides / opaque-G / tiny-targets and creates Folders-vs-Views inconsistency).
- ❌ Nesting Views, or letting them inherit the unbounded-indent recursion.
- ❌ Drop-rejection affordances / drag-drop plumbing (none exists; use the Move-to-folder menu action instead).
- ❌ The word "query"; a bare unexplained `G`; counts on Views but not Folders.
- ❌ A full standalone tree-redesign phase — this is *light polish*, inlined into 114 (the file isn't on the G-5 hot-file ledger; G-3 says a 1-file refactor doesn't need full ceremony).

## Origin

Synthesized from sketches **031** (winner A — Views group / NavRow parity) + **033** (winner A — unified NavRow, with a Before/After of the current tree), 2026-06-19, after operator feedback + the integration audit (workflow `wf_dc339594-8bb`). Source files: `sources/031-views-sidebar-group/`, `sources/033-foldertree-navrow-polish/`. Decisions: `.planning/phases/114-*/114-CONTEXT.md` (D-114-7/8/9/13/14). Reuse targets: `FolderNode.tsx`, `FolderTree.tsx`, `InlineEdit.tsx`, `MoveToFolderDialog`.
