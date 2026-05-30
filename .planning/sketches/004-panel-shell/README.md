---
sketch: 004
name: panel-shell
question: "How are the 4 panel sections organized, and how does the panel collapse / behave on mobile — without overloading an already-dense app?"
winner: "B"
tags: [layout, panel, structure, density, PANEL-01, PANEL-02]
---

# Sketch 004: Panel Shell

## Design Question

Phase 087 adds a right-side panel (push/split, ~30% width) holding **4 content areas** — Todos, Files, Pending question (`ask_user`), Versions/Diff. The app is *already* dense (left nav + chat with run-cards, 13 tool-body renderers, STDOUT/STDERR, output cards). So the real question isn't just "where do the sections go" — it's **how do we add a second column without breaking the calm-instrument promise**, and how does it behave when empty (the common case) and on mobile.

## How to View

```
open .planning/sketches/004-panel-shell/index.html
```

Use the **State** strip (top) to cycle: Empty · Loading · Error · Populated · **Live composite**. Use the viewport buttons (Desktop / 768 / 390) to feel the mobile bottom-sheet. Toggle the panel with the header button or **⌘.** / **Ctrl+.**

## Variants

- **A: Tabs** — one section at a time (Todos / Files / Ask), tab bar with count badges. Most compact; pending question force-selects the Ask tab. Trade-off: can't watch todos *and* files at once.
- **B: Stacked accordion** — all sections in one scroll, each collapsible; a pending question pins as a section at the very top. See-everything; can get tall during a busy run.
- **C: Hybrid rail** — an always-visible 3-chip status strip (Todos 2/3 · Files 4 · Ask) + one expanded detail section below. Glanceable counts always; detail is one click. Pending question lights the Ask chip amber.

## What to Look For

1. **Live composite (the acceptance bar):** flip to Live. Todo in-progress (spinner) + `summary.md` just written (green flash) + a pending question, with the chat *narrowed* beside an active run-card. **Can you instantly tell what to read first?** Which variant keeps the two columns from competing?
2. **Empty is the common case:** flip to Empty. Every variant short-circuits to one calm empty state with a "collapse to rail" affordance — the panel should never hog 30% to show nothing.
3. **Collapse behavior:** collapsing on desktop leaves a thin **rail** with count badges (so you don't lose the pending-question signal); the chat reclaims the width. On mobile it slides fully away as a bottom-sheet.
4. **Pending-question loudness:** note this sketch only shows the *shell* treatment (tab auto-select / pinned section / amber chip + toggle dot). The full interrupt model is sketch 006.

## How we'd know this failed (G-6)

Concrete, observable failure conditions — the UAT bar this sketch must clear:

- **Two-column overload:** during a live run, a user can't tell whether to read the chat run-card or the panel — eyes bounce, nothing is clearly "the live thing."
- **Empty-panel tax:** a plain Q&A chat (no workspace activity) still surrenders ~30% of width to four empty sections.
- **Lost signal on collapse:** the panel is collapsed and a question goes pending, but nothing on the toggle/rail tells the user the agent is blocked → run silently stalls.
- **Laptop squeeze:** at ~1024px the push/split narrows the chat run-card so far that tool output wraps illegibly.
- **Mobile occlusion:** the bottom-sheet covers the composer or can't be dismissed back to chat.
