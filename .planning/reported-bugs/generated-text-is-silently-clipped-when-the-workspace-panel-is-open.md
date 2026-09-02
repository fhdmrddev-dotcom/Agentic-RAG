---
id: BUG-260902-02
title: With the workspace panel open, ~99px of EVERY line of generated text is silently clipped — no scrollbar, no ellipsis, no indication
reported: 2026-09-02
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [frontend/chat, frontend/panel, frontend/layout, markdown-rendering]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-240, SEED-128]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 0e0987719
  date: 2026-09-02
---

# BUG-260902-02: the message column refuses to shrink, and the overflow is thrown away

**Operator-reported, 2026-09-02:** *"even generated text is extending beyond the available space."*
Reproduced, measured, and confirmed with a negative control on the same message.

## What we observed

Thread **"UAT-B · multi-tool + wide table"**, viewport **1536 × 639**, one assistant message
containing a fenced code block and a paragraph.

**With the workspace panel OPEN**, the visible text ends mid-token:

- code: `cleaned = ['' if v is None else str(v).replace('\n', ' ').replace('|', '\\|') for v in` ⟵ **cut**
- prose: *"…the sheet's own cell content is unchanged from what the search index showed — this run co"* ⟵ **cut**

**With the panel CLOSED**, the identical message renders in full — `…for v in r]`, and
*"…with exactly 4 columns and 7 data rows."*

### The measurement

| | scroll viewport | message column | outcome |
|---|---|---|---|
| panel **closed** | **974 px** | 896 px | fits — 39 px of slack |
| panel **open** | **718 px** | **865 px** | ⛔ **99 px clipped** |

## The mechanism

Ancestry above the paragraph, panel open:

```
p / div.markdown            right = 1327
div.max-w-4xl.mx-auto       width  = 865   max-width: 896px   ← wants 896
div (min-width: 100%)       width  = 865                      ← REFUSES to shrink
div.h-full.w-full           width  = 718   overflow-x: HIDDEN ← the scroll viewport
div.relative.overflow-hidden.flex-1  width = 718
```

⚠ **`max-w-4xl` (896 px) is a CAP, not a floor — but the column never goes below ~865 px anyway**,
because the wrapper beneath it carries **`min-width: 100%`**. So when the panel takes the column
from 974 px to 718 px, the content does not reflow; it stays ~865 px and the viewport's
`overflow-x: hidden` **discards the difference**.

⚠ **`hidden` is what makes this severe rather than ugly.** `auto` would have produced a
horizontal scrollbar and the text would merely be awkward to read. `hidden` means there is **no
scrollbar, no ellipsis, and no way to reach the text at all** — it is simply not on the screen,
and nothing tells the reader that a third of the line is missing.

⚠ **The panel is `position: static` with an opaque background**, so it also paints over part of
the overflow. That is a second, cosmetic contributor — **not the cause**. Removing the background
would expose clipped text, not restore it.

## Why it matters

- **It is silent.** The reader has no signal. A truncated number, filename, or code line reads as
  complete. On this very message the clipped fragment was `for v in r]` — code a person might
  copy.
- **It hits the default configuration.** The panel opens by itself whenever the agent writes
  files, tracks todos, or asks for input, and 1536 px is an ordinary laptop width.
- ⚠ **It defeats the panel's own purpose.** The panel exists so a person can watch the work while
  reading the answer; having it open is what destroys the answer.

## Not yet determined

- ⚠ **Whether it worsens on narrower viewports.** At 1536 the loss is 99 px; a 1366 px laptop
  would give the column ~548 px against the same ~865 px content, implying a far larger loss —
  **but that was NOT measured and must not be quoted as though it were.**
- Whether tables, long URLs and inline code clip identically to prose and fenced code (only the
  latter two were observed).
- Whether the mobile/stacked layout is affected at all.

## For whoever fixes it

⚠ **Do not simply flip `overflow-x: hidden` to `auto`.** That trades a silent failure for a
horizontal scrollbar on every message, which is a different bad answer. **The column should
shrink** — find why `min-width: 100%` is on that wrapper and what it was protecting, because
removing it blindly is how the next layout defect gets introduced.

⚠ **`SEED-240` records the presentation faults found in the same session** (a raw `WRITE_TODOS`
card, a step orphaned outside its run frame, a 308 px panel crowding its own badges). **This bug
is not those**, and folding them together would bury a blocking defect inside a polish pass.
