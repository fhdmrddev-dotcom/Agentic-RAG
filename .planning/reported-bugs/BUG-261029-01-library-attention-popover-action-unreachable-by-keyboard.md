---
id: BUG-261029-01
title: The Library attention popover's one action ("Open Library health") cannot be reached by keyboard
reported: 2026-10-29
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/navigation, frontend/a11y, frontend/attention]
folded_into: "301"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5ac85b739
  date: 2026-10-29
---

# BUG-261029-01: The Library attention popover's action cannot be reached by keyboard

## What we observed

Found while writing Phase 301's UI-SPEC (UI-D1), from the source; **not yet driven in a browser**.

- `frontend/src/components/layout/AttentionPopover.tsx:98-105` renders its only control as a plain
  `<button>` inside `DropdownMenuContent`, deliberately "rather than a menu item".
- Radix Menu cancels Tab inside menu content: `frontend/node_modules/@radix-ui/react-menu/dist/index.mjs:305`
  (`if (event.key === "Tab") event.preventDefault();`), and arrow-key focus moves only between `menuitem`s.
- So a keyboard user who opens the badge popover can see the "Open Library health" control but cannot
  focus it. Mouse and touch work.

Expected: the action is reachable by keyboard (arrow keys + Enter, like every other menu action).

## Why it matters

The badge's whole job (D-235-04) is to be a door to the Library Health tab. For a keyboard-only user the
door has no handle. Minor: the Library rail item itself still reaches Library.

## Hypothesized cause

The button was chosen so tests could find it "as a `button` by name"; Radix's Tab trap was not considered.
Fix shape (hypothesis): render it as a `DropdownMenuItem` with `onSelect`, and move the test to
`getByRole("menuitem")`. Phase 301 builds its list rows as `DropdownMenuItem`s for this reason (UI-D1).

## Surface classification

`Agentic-RAG` — this app's own shell component. Candidate for Phase 302 (close-out) or a `/gsd:fast` fix;
drive it in Chrome before fixing (`a review is a claim about code`).
