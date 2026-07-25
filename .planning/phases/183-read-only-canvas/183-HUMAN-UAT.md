---
status: partial
phase: 183-read-only-canvas
source: [183-VERIFICATION.md]
started: 2026-07-26T05:10:00Z
updated: 2026-07-26T05:10:00Z
---

## Current Test

[awaiting human testing]

## Precondition (do this first)

`visual_workflow_canvas` cold-defaults to `"off"`. Flip it **On** in the Control Room before
running U-1 … U-3. U-4 is the test that flips it back Off.

## Tests

### 1. U-1: Spine ⇄ Canvas agree, in both Technical-names OFF and ON modes
expected: Open a real draft in the Builder. With the reveal OFF, flip [≣ Spine] ⇄ [⬡ Canvas] both ways — same steps, same order, same icons. Turn the reveal ON and flip both ways again — same result, and a given phase's title text is identical across the toggle at the same reveal setting.
result: [pending]

### 2. U-2: The 5-phase maximum (eval_coverage) reads at default zoom
expected: Titles not truncated to nonsense, no horizontal page overflow, the end cap visible.
result: [pending]

### 3. U-3: The empty draft (0 phases) doesn't look broken
expected: Reads as "nothing here yet" — no stray grid, zoom pills, or minimap floating in space; no ghost/placeholder node. (40 of 95 live definitions have zero phases, so this is the most common canvas state.)
result: [pending]

### 4. U-4: Flag off = yesterday's Builder, including on an operator account
expected: Operator flips `visual_workflow_canvas` to Off in the Control Room, reloads. The [Spine]/[Canvas] toggle strip is gone and no `.react-flow` subtree mounts — for every account type, including operators.
result: [pending]

### 5. Keyboard activation with a real screen reader (added after 183-08 closed CR-01)
expected: Tab to a step and press Enter, then Space. The step's details open, and what the screen reader announces matches what the surface actually does — no promise of arrow-key movement or delete-to-remove on this read-only canvas. jsdom proves the callback fires and the string is present; only a live pass proves what a user hears.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
