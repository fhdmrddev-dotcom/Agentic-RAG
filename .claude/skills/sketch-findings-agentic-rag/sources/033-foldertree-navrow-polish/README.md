---
sketch: 033
name: foldertree-navrow-polish
question: "The existing folder tree is 'not good' — before adding a Views group, what light polish makes Folders + Views read as peers built from one row (counts, flat Views, softened guides, labeled G, reachable actions, capped nesting)?"
winner: "A"
tags: [phase-114, document-management, folder-tree, navrow, sidebar, parity, refactor, end-user-language]
---

# Sketch 033: Folder Tree + NavRow Polish

## Design Question

Operator feedback: *"older folders and tree view ... is not good, you have to think about it."* The Phase 114 integration audit (workflow `wf_dc339594-8bb`) verified the debt in the live `FolderNode`/`FolderTree`:

- **no document count on subfolders** (only Root shows one),
- **unbounded nesting** (16px/level, no cap → deep names truncate to nothing),
- **dense hand-drawn branch guide lines** that read as noise on Deep Midnight,
- **tiny hover-only action targets** (~24px, invisible until hover, unreachable by touch/keyboard),
- **an opaque single-letter `G` pill** with no explanation.

D-114-7/8/9 tell Phase 114 to **clone this row for Views** — which would amplify every flaw *and* create a Folders-vs-Views inconsistency the operator will immediately notice. This sketch proposes the **cheapest honest fix**: extract one shared `NavRow` and build BOTH groups from it, before Views ships. (Audit verdict: refine-in-114, not a separate refactor phase — the file isn't on the G-5 hot-file ledger and 114 already touches it.)

## How to View

open .planning/sketches/033-foldertree-navrow-polish/index.html

Compare **B (today)** against **A (after)** directly. In A: every folder shows a count, Views are flat below Folders, the `G` pill has a tooltip (hover it), the action menu is faintly visible + keyboard-reachable, and one soft indent guide replaces the branch lines. Toggle folders open/closed; try the filter box.

## Variants

- **A — Unified NavRow (after)** ★ recommended — one row primitive for Folders and Views; differs only by icon (amber folder vs funnel) and which actions appear. Folders + Views are visibly peers. Counts everywhere, labeled `G`, reachable actions, a "filter folders & views" box.
- **B — Today (before)** — the current tree faithfully reproduced (no subfolder counts, branch guides, opaque `G`, hover-only tiny actions, unbounded indent) with the verified-problem list. The A/B baseline.
- **C — Deep-nesting: indent cap** — beyond ~3 levels, stop indenting and show the remaining path inline (`…/Q1/`), leaning on the existing breadcrumb for deep location so names never truncate. Otherwise identical to A.

## What to Look For

- **Peer consistency:** in A, do Folders and Views read as two kinds of the same thing, or two mismatched lists?
- **Counts everywhere:** does a per-folder count earn its place, or add clutter? (It's mandated for Views — parity matters.)
- **Guide lines:** is the single soft indent guide enough hierarchy, or do you miss the branch lines?
- **`G` tooltip:** does the labeled pill fix the "what is G?" gap?
- **Nesting strategy:** A (full indent) vs C (cap + path) — which handles a 5-deep folder better?
- **Scope check:** this is deliberately *light polish*, not a tree redesign. Is it the right amount, or does the tree need more (or less)?

## Open question for the operator

Inline this polish into Phase 114's frontend (recommended — leaner, 114 already touches `FolderNode`), or carve a tiny dedicated pre-114 refactor phase? Either way, **build Views from the fixed row, not a clone of the flawed one.**
