# File Browser & Diff Viewer

The Files + Versions area inside the panel (sketch 004's stacked frame). Three jobs in **~384px**: list workspace files, preview md/code/csv/image, and compare any two versions of a file — all without feeling cramped.

## Design Decisions

### D1 — Full-replace drill-in (Winner A; C folded in)
Tapping a file **replaces the panel body** with a full-height preview + a `‹ Files` back button. Maximum reading room in a narrow column. At ~384px a "drawer sliding over a dimmed list" (variant C) is visually identical to a full replace, so C collapsed into A.

- **Won over B (inline expand/accordion):** B caps preview height and makes the list jump as rows expand. In a 30% column the capped preview was unreadable for code/tables.

### D2 — Per-type preview routing (reuse existing renderers)
Every workspace file type routes to a graceful preview — **no raw byte dumps**:
- `.md` → the app's existing **`MarkdownRenderer`** (SC#3 says reuse it)
- code (`.py`, `.ts`, `.json`, …) → existing **syntax highlighting**
- `.csv` → rendered as a table
- images (`.png`, …) → framed preview
- **anything else / too-large / binary** → a calm "no preview available · download" or "file too large to preview" notice. This fallback is mandatory (a `.pptx` or a 5MB binary must not break the layout).

### D3 — Versions compare as in-column unified diff
Side-by-side split doesn't fit 30%. The diff is a **unified inline diff** (`+`/`−` line coloring, hunk headers) that stays **in-column by default**. A `+N / −M` summary sits above it.

### D4 — Opt-in expand overlay, never auto-widen
A `⤢ expand` button pops **only the diff** into a wide overlay over the chat for rare gnarly diffs. The panel itself never auto-widens — auto-widening would reflow the chat unpredictably and fight the calm-instrument promise. Expand is user-initiated and pops a single focused surface, not a layout change.

### D5 — Two-endpoint version picker (red base, green target)
Version pills (`v1 v2 v3`); selecting two sets the comparison endpoints — **red `.a` = base (before)**, **green `.b` = target (after)** — color-coded so "which is before / which is after" is never ambiguous. A one-click `Compare v2↔v3` default covers the common "latest two" case.

## CSS Patterns

```css
/* File rows (selectable) */
.file { display: flex; align-items: center; gap: 8px; padding: 8px 9px; border-radius: var(--radius-sm);
        font-size: var(--text-sm); cursor: pointer; transition: all var(--dur-fast); border: 1px solid transparent; }
.file:hover { background: var(--color-accent); }
.file.sel  { background: var(--color-primary-dim); border-color: var(--color-primary-glow); }
.file .fname { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: var(--text-xs);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file .meta  { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.file.flash  { animation: fileFlash 1.4s var(--ease-out); }   /* green flash when freshly written */
@keyframes fileFlash { 0% { background: var(--color-success-dim); } 100% { background: transparent; } }

/* Full-replace preview (D1) — overlays the panel body, back button returns */
.preview-head { display: flex; align-items: center; gap: 8px; padding: var(--space-2) var(--space-3);
                border-bottom: 1px solid var(--color-border-soft); background: var(--color-surface); }
.preview-head .pf { flex: 1; font-family: var(--font-mono); font-size: var(--text-xs);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Version picker (D5) — red base / green target */
.ver-strip { display: flex; gap: 6px; padding: var(--space-2) var(--space-3);
             border-bottom: 1px solid var(--color-border-soft); flex-wrap: wrap; align-items: center; }
.vchip { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted);
         border-radius: var(--radius-sm); padding: 4px 9px; font-size: 11px; font-family: var(--font-mono); cursor: pointer; }
.vchip.a { border-color: var(--color-danger);  color: var(--color-danger);  background: var(--color-danger-dim);  }  /* base / before */
.vchip.b { border-color: var(--color-success); color: var(--color-success); background: var(--color-success-dim); }  /* target / after */

/* Unified in-column diff (D3) */
.diff-meta { padding: 7px 12px; font-size: 11px; font-family: var(--font-mono); color: var(--color-text-muted);
             border-bottom: 1px solid var(--color-border-soft); display: flex; gap: 10px; align-items: center; }
.diff-meta .add { color: var(--color-success); } .diff-meta .del { color: var(--color-danger); }
.diff { font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6; overflow-x: auto; padding: 6px 0 16px; }
.diff .dl { display: flex; padding: 0 6px; white-space: pre; }
.diff .dl .sign { width: 16px; flex: none; color: var(--color-text-dim); }
.diff .dl.add { background: var(--color-success-dim); } .diff .dl.add .sign { color: var(--color-success); }
.diff .dl.del { background: var(--color-danger-dim);  } .diff .dl.del .sign { color: var(--color-danger);  }
.diff .dl.ctx { color: var(--color-text-muted); }
.diff .hunk   { color: var(--color-primary); padding: 4px 6px; background: var(--color-primary-dim); }

/* Opt-in wide diff overlay (D4) — pops over chat, never auto-widens the panel */
.expand { background: var(--color-surface); border: 1px solid var(--color-border-soft);
          max-height: 320px; overflow-y: auto; animation: fadeSlideUp var(--dur-base) var(--ease-out); }
```

## HTML Structure

```html
<!-- List state -->
<div class="sec-body">
  <div class="file"><span class="fico">📄</span><span class="fname">summary.md</span><span class="meta">2.1kb · v3</span></div>
  <div class="file flash"><span class="fico">🐍</span><span class="fname">analysis.py</span><span class="meta">v2</span></div>
</div>

<!-- Drill-in preview state (replaces sec-body) -->
<div class="preview">
  <div class="preview-head"><button class="back">‹ Files</button><span class="pf">summary.md</span><button>⇄ Compare</button></div>
  <div class="md"> … MarkdownRenderer output … </div>
</div>

<!-- Compare state -->
<div class="ver-strip"><span class="vlbl">Compare</span>
  <button class="vchip a">v2</button><button class="vchip b">v3</button>
  <button class="expand-btn">⤢</button></div>
<div class="diff-meta"><span class="add">+12</span><span class="del">−3</span></div>
<div class="diff">
  <div class="dl hunk">@@ -1,5 +1,7 @@</div>
  <div class="dl ctx"><span class="sign"> </span>… context …</div>
  <div class="dl del"><span class="sign">−</span>old line</div>
  <div class="dl add"><span class="sign">+</span>new line</div>
</div>
```

## What to Avoid
- **Cramped preview** — code or a markdown table needing horizontal scroll to read one line at 384px. Full-replace (D1) buys the width; keep mono code wrapping sane.
- **Lost-place navigation** — previewing a file with no fast way back to the list. The `‹ Files` back button is mandatory; don't bury it.
- **Diff illegibility** — `+`/`−` lines wrapping so hard an addition reads like a deletion. Keep the sign gutter fixed-width (`.sign { width: 16px }`) and let `.diff` scroll-x rather than wrap.
- **Type gap** — a `.json`/`.pptx`/binary dumping raw content or breaking layout. The graceful "no preview / too large" fallback (D2) is non-negotiable.
- **Version confusion** — user can't tell before from after. The red-base/green-target color coding is the fix; don't render both pills the same.
- **Auto-widen** — never grow the panel column to fit a diff; that reflows the chat. Use the opt-in `⤢` overlay (D4) instead.

## Origin
Synthesized from sketch 005 (winner A, C folded in). Source: `sources/005-file-and-diff/index.html`. Maps to PANEL-03, PANEL-07 and Phase 087 SC#3, SC#5.
