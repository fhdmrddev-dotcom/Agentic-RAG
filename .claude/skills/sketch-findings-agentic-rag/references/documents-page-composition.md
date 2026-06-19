# Documents-Page Composition & Layout (Phase 114 — sketch 032)

How the Documents page holds all its pieces at once — the left nav (Folders + Views), the inline filter bar, the filtered list, and an open Phase-112 detail panel — without crushing anything, at desktop and mobile. Winner: 032-A (sidebar collapses to a rail when the panel opens, user-pinnable). This is a **consistency / layout contract**, and it is **inherited by Phases 117/118** on the same shared shell.

## Design Decisions

- **The 4-column crunch is real.** Today the page is `w-72` (288px) sidebar + a `minmax(0,1fr) 430px` push/split grid when a doc is selected (`IngestionPage.tsx:137,146-151`). Adding the Views group (sidebar height) + the net-new filter bar (vertical) + the 430px panel squeezes the 7-column `DocumentList` to ~500–670px at 1280–1440px — too tight.
- **D-1 resolution = collapse the sidebar to an icon rail when the detail panel opens (032-A), user-pinnable (D-114-17).** Selecting a document shrinks the Folders+Views sidebar from ~288px to a ~50px icon rail so the list keeps real width beside the 430px panel; it restores on panel close. **Default-on first open, but user-pinnable and session-persisted** — auto-collapse on first panel-open, respect a manual re-expand (mirrors the workspace-panel collapse-to-rail precedent, decision #4). Pure auto-collapse would fight the scan→fix→next loop.
- **Filter bar collapses to a summary chip when the panel is open** (`⛛ 2 filters · 47 ▾`) to reclaim vertical+horizontal room; expands on click.
- **`DocumentList` column-shedding is NET-NEW.** It's a static 7-column table with `overflow-x-auto` (`DocumentList.tsx:266-276`) and no responsive logic. As the list narrows, shed Type/Date/Author first (the filter bar surfaces those anyway). Flag as net-new responsive work, not reuse.
- **Push, never overlay — the foil proves it.** Variant C (overlay drawer over the list) is a deliberate REJECTED foil; it violates the locked rule (the panel sketches 004/027), loses list context, and re-introduces the modal pattern 027 ruled out. It won't ship.
- **SHARED-SHELL inheritance (the cross-phase contract).** This is the SAME Phase-112 detail panel that **Phase 117 (relationships)** and **Phase 118 (classification)** add sections into. Whatever 114 picks for "what happens to the left nav when the panel opens" becomes their default — so the choice must **degrade gracefully for non-metadata panel content**, and must be recorded as a shared-shell decision in 114's CONTEXT/PLAN, not an implicit 114-only call.
- **Mobile (<768px):** the existing pattern holds — sidebar → drawer, detail panel → **bottom-sheet** (the 004-B / `DocumentDetailPanel` pattern), filter bar → a single `⛛ N filters` summary chip that expands to a sheet. Only ONE bottom-sheet open at a time (nav vs detail). The Folders+Views drawer needs internal sectioning since it now holds two groups.

## CSS Patterns

```css
/* push/split that animates the detail track open */
.split { display:grid; grid-template-columns:minmax(0,1fr) var(--detail-w,0px);
  transition:grid-template-columns var(--dur-slow) var(--ease-out); }
.split.open { --detail-w:430px; }

/* sidebar → icon rail on panel-open (user-pinnable) */
.side { width:230px; transition:width var(--dur-slow) var(--ease-out), padding var(--dur-slow); }
.side.rail { width:50px; padding:var(--space-4) 4px; }
.side.rail .srow .nm, .side.rail .srow .cnt, .side.rail .srow .gpill { display:none; }

/* list sheds columns as it narrows */
.split.open .when-open-hide { display:none; }

/* mobile bottom-sheet detail */
.variant.mobile .detail-col { position:absolute; left:0; right:0; bottom:0; height:78%;
  border-radius:var(--radius-xl) var(--radius-xl) 0 0; transform:translateY(110%);
  transition:transform var(--dur-slow) var(--ease-out); }
.variant.mobile .split.open .detail-col { transform:translateY(0); }
```

## HTML Structures

- **Desktop:** `nav-rail(52px) · side(230px↔50px) · main`, where `main = page-head + filter-bar + .split(list | 430px detail-col)`. The detail panel reuses the 027/028 anatomy (`detail-head` + stacked-accordion sections + `ConfidenceChip`).
- **ConfidenceChip** must match the locked order: **glyph + tier word + score%** (`✓ High · 96%`) — reuse the real component, don't re-implement the string. Don't show "chunks" in the title sub-line (vector-pipeline jargon) or phase numbers in section badges ("Coming soon", not "Phase 117").

## What to Avoid

- ❌ Overlaying the panel as a drawer over the list (the rejected foil; breaks push-never-overlay).
- ❌ Pure auto-collapse with no pin (yo-yos on every selection, fights the correction loop).
- ❌ Never-collapsing (crushes the list at ≤1280px).
- ❌ Treating column-shedding or the responsive filter bar as "free reuse" — both are net-new.
- ❌ Picking a panel-open behavior without recording it as a shared-shell decision for 117/118.

## Origin

Synthesized from sketch **032** (winner A — sidebar→rail, user-pinnable), 2026-06-19, after the integration audit (workflow `wf_dc339594-8bb`). Source file: `sources/032-documents-page-full-composition/`. Decisions: `.planning/phases/114-*/114-CONTEXT.md` (D-114-17); resolves Phase 112's open note D-1. Layout sits over the 027/028 detail shell (`references/document-detail-panel.md`) and the NavRow left nav (`references/saved-views-and-left-nav.md`).
