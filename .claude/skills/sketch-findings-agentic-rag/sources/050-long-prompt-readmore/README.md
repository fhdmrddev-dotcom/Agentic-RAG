---
sketch: 050
name: long-prompt-readmore
question: >
  How does a long USER prompt collapse to a clamped preview + "Read more" —
  clamp height, fade, expander placement — without breaking the right-aligned
  gradient bubble? (CTC-04)
winner: "A"
tags: [phase-128, long-prompt, read-more, ctc-04, message-item, user-bubble, clamp]
---

# Sketch 050 — Long User Prompt → Read more (CTC-04)

## Design Question

A pasted 600-word spec renders today at full height inside the right-aligned
`gradient-primary` user bubble (`MessageItem.tsx:205-217`) and shoves the whole
conversation down. CTC-04 collapses long prompts to a **clamped preview + "Read
more"** — but the clamp, the fade, and the expander all have to work *with* the
right-aligned gradient bubble (fade matched to the bubble bg, not the page bg),
and short prompts must render **unchanged**. This sketch forks the three clamp
treatments so the operator can pick how the collapse feels.

## How to View

Open `index.html` (it links `../themes/default.css`). Then:

- **Variant tabs** (top): A / B / C — switch the clamp treatment.
- **"Prompt length" control**: cycle **Short (1 line) → Long (~150 words) →
  Pasted spec (~600 words)** to feel the threshold. Short renders unchanged (no
  clamp, no fade, no Read-more). The mono hint on the right reports word/line
  count and how many lines are hidden. With "Short" selected, the column still
  shows a long + an x-long bubble below so you can compare clamped vs unclamped
  in place.
- Click **Read more** / the **pill** to expand a single bubble in place; it
  flips to **Show less**. Each bubble toggles independently.
- **Toolbar** (bottom-right): theme select (Default) + Phone 400 / Tablet 720 /
  Desktop 860 viewport buttons — shrink to Phone to confirm the clamp + fade +
  expander still read correctly at `max-w-[70%]` on a narrow column.

## Variants

- **A · line-clamp + gradient fade + inline Read more** — CSS `-webkit-line-clamp: 7`,
  a fade at the bottom edge **matched to the violet end of the bubble's 135°
  gradient**, and an inline "Read more" chip below the clamp (toggles to "Show
  less", chevron rotates). Lowest chrome; the chip lives inside the bubble.
- **B · fixed max-height + centered Read-more pill** — a `max-height` container
  (animated expand) with a taller fade, and a **gradient pill that overlaps the
  fade** ("Read more ⌄"), right-aligned under the bubble. The pill flips to "Show
  less" and its chevron rotates on expand, like A/C. Most discoverable affordance;
  the pill reads as a clear "there's more" handle. **Build note:** B's pill lives
  *outside* the bubble (so it can overlap the fade), so its open-state is driven by
  an `.open` class toggled on the **pill itself** (`#pill-<id>`), not by the
  bubble's `.clampB.open` — both the bubble and the pill flip together in
  `toggleClamp`. A/C chips are bubble descendants and need no such bridge.
- **C · clamp + count hint** — A's treatment plus a muted mono **"· 612 words"**
  hint beside Read more, so the user knows *how much* is hidden before expanding.

## What to Look For

- **The fade is the whole game.** It must dissolve the text into the **bubble**
  (the dark-violet lower corner of the 135° gradient), never into a page-color
  band. Check the fade against the bubble edge, both themes, both expanded and
  collapsed (it animates to `opacity: 0` on expand).
- **Right-alignment + tail survive.** The bubble stays `justify-end`,
  `rounded-2xl rounded-br-md`, `max-w-[70%]`, with the round User avatar to its
  right — in all three variants, collapsed and expanded.
- **Short = unchanged.** The 1-line prompt has no clamp, no fade, no Read-more.
  The threshold should feel right (clamp fires above ~7 lines).
- **`pre-wrap` + `break-words` hold.** Newlines in the pasted spec are preserved;
  long unbroken tokens wrap instead of overflowing the bubble.
- **Expander placement.** A's inline chip vs B's overlapping pill vs C's chip +
  count — which one is most obviously "there's more here" without fighting the
  right-aligned geometry?

## Build Handover

**Reuse vs net-new — this is a contained, pure-FE clamp. No net-new wire.**

| Concern | Real file / component | What changes |
|---|---|---|
| The user bubble | `MessageItem.tsx:205-217` (the `isUser` branch) | Wrap `<p class="whitespace-pre-wrap break-words">{message.content}</p>` in a clamp container; add the fade + Read-more affordance; gate on a length threshold so short prompts render unchanged. |
| Bubble styling | `gradient-primary` (`index.css:198` → `linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))`) | Unchanged. The fade gradient is **derived from** this (the violet end), authored as a CSS `::after` matched to the bubble, not the page. |
| Avatar / geometry | `User` icon, `w-7 h-7 rounded-full`, `max-w-[70%]`, `items-end gap-2.5`, `justify-end` | Unchanged — preserved in all variants. |

**Net-new:** none. This is client-side clamp state (one boolean per message,
local component state) over content that is **already in `message.content`**. No
new wire field, no backend, no migration — hence **no `.nn-flag` anywhere** in
this sketch (the honesty convention only flags missing wire/assets, and there
are none here).

**Scope guard (stated on the surface):** **USER prompts ONLY.** Assistant answers
are explicitly out of scope — they already have their own preview/expand path,
so this clamp must not be applied to the assistant branch of `MessageItem`.

**Threshold decision for the planner:** the clamp predicate (line-count vs
char-count vs rendered-height) is a build choice. The sketch uses a ~7-line
clamp; in React, `-webkit-line-clamp` clamps purely in CSS, so the cheapest
honest implementation is "always render the clamp container; the fade + Read-more
only appear when the content actually overflows" (detect overflow via
`scrollHeight > clientHeight` on mount/resize, or accept the CSS-only clamp and
show Read-more unconditionally above a content-length heuristic). Variant choice
A/B/C decides the affordance shape, not the predicate.

**Related real files (named for the build map, untouched by 050):**
`RunCard.tsx`, `ToolCallPanel.tsx`, `RunStatusStrip.tsx`, `MessageList.tsx`,
`ChatArea.tsx` (`StickyTimerBar`) — these belong to sketches 048/049 of the same
Phase 128 bundle; 050 touches only `MessageItem.tsx`.
