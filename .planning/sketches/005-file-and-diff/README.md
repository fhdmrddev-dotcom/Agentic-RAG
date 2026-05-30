---
sketch: 005
name: file-and-diff
question: "In a narrow ~30% column, how does browse file → preview (md/code/csv/image) → compare two versions flow without feeling cramped?"
winner: "A"
tags: [files, diff, preview, versions, PANEL-03, PANEL-07]

# Decision: A (full-replace drill-in). C folded into A — at ~384px a "drawer
# sliding over a dimmed list" is visually identical to "replace the body," so
# the distinction was cosmetic. B (inline expand) rejected: caps preview height
# and makes the list jump. Diff stays IN-COLUMN (unified, +/- coloring) by
# default; an opt-in `⤢ expand` button pops ONLY the diff into a wide overlay
# over the chat for rare gnarly diffs. No auto-widen (would reflow chat
# unpredictably and fight the calm-instrument promise).
---

# Sketch 005: File &amp; Diff

## Design Question

The Files + Versions area of the stacked panel (sketch 004 winner) has to do three jobs in **~384px**: list the workspace files, preview text/markdown/code/image (SC#3 — reusing the app's `MarkdownRenderer` + syntax highlighting), and let the user compare any two versions of a file (SC#5). Side-by-side diff doesn't fit a 30% column, so the real sub-question is *which navigation model* keeps it from feeling cramped — and the diff is a **unified inline** diff, not split.

## How to View

```
open .planning/sketches/005-file-and-diff/index.html
```

Tap **summary.md** (markdown table), **analysis.py** (highlighted code), **yoy_by_segment.csv** (table), **chart_q3.png** (image). On `summary.md` / `analysis.py` use **⇄ Compare** to see the unified diff with +/− line coloring.

## Variants

- **A: Drill-in (push)** — tapping a file replaces the panel body with a full-height preview + a `‹ Files` back button. One thing at a time, max reading room. Trade-off: you lose sight of the file list.
- **B: Inline expand** — the file row expands in place to show the preview inside the list (accordion). Keeps list context; preview is height-capped and scrolls. Trade-off: less room for big previews; list can get tall.
- **C: Preview drawer** — preview slides over the dimmed list as a sheet within the panel. Feels layered (back returns to list underneath). Trade-off: an extra surface to dismiss.

## What to Look For

1. **Reading room vs context:** does losing the file list (A) hurt, or is keeping it (B) worth the cramped preview?
2. **Unified diff legibility:** the `v2 → v3` diff with `+12 / −3` summary — is a single-column +/− diff readable at this width, or does it need a "compare" that temporarily widens the panel?
3. **Version picker:** tapping version pills (`v1 v2 v3`) selects the two endpoints (red = base, green = target). Is the two-tap "pick A, pick B" model clear, or is the one-click "Compare v2↔v3" default enough?
4. **Type coverage:** md renders rich, code highlights, csv becomes a table, image gets a framed placeholder — confirm every workspace file type has a sane preview (no raw bytes dumped).

## How we'd know this failed (G-6)

- **Cramped preview:** code or a markdown table needs horizontal scrolling to read a single line at 384px.
- **Lost-place navigation:** user previews a file, wants the next one, and can't find their way back to the list quickly.
- **Diff illegibility:** the unified diff's +/− lines wrap so hard that an added line is indistinguishable from a removed one.
- **Type gap:** a real workspace file (e.g. `.json`, `.pptx`, a 5MB binary) dumps raw content or breaks the panel layout instead of showing a graceful "no preview / too large" notice.
- **Version confusion:** user can't tell which version is the "before" and which is the "after" in the comparison.
