---
status: partial
phase: 290-the-card-and-the-team-picture
source: [290-VERIFICATION.md, 290-VALIDATION.md]
started: 2026-10-22T00:00:00Z
updated: 2026-10-22T00:00:00Z
---

## Current Test

[awaiting human testing — run S1 first]

Drive each row in Chrome with a screenshot AND a rendered-text read (G-4). Rows that plant
drafts write the local DB: run serially under the local-DB lock (planting recipe in
290-VALIDATION.md). Cover a real 2-3 step workflow and the planted 7-step "Vendor risk review",
in dark and light.

## Tests

### 1. SC#1 — library card matches sketch 290-card-chip-line winner B
expected: bordered pills with glyph + type sentence joined by `→`; first 3 steps, then `+N more` that expands in place and ends in `Show less`; the card does not lead with a paragraph
result: [pending]

### 2. S1 — chips never show type ids
expected: only the seven type sentences, in run order; `+4 more` on the 7-step card; pressing it names all 7 in visible words; nothing clipped at 375 px
result: [pending]

### 3. S2 — no line between two steps
expected: handoff lines from the orchestrator only; on Vendor risk review the only step-to-step line is the ⤳ from the step-2 check to step 5, labelled `⤳ only if the check fails`; gate lines (WR-03/WR-04 fix) do not read as links between gates
result: [pending]

### 4. S3 — 1-step workflow shows no invented worker
expected: orchestrator, one step, its own gates and `One step, so there is no team to coordinate.` — nothing else
result: [pending]

### 5. S4 — no-judge workflow says so in words
expected: `Nothing checks this work.` on the two-step no-gate workflow; `Checked by rule, not by a judge.` on Plan → Execute → Verify; each said once, no empty slot
result: [pending]

### 6. S5 — real size, dark and light
expected: legible at both sizes; no clipped text or overlapping titles; lines point at the right node; the 7-step row scrolls inside the plane
result: [pending]

### 7. WR-02 — operator decision (deferred review finding)
expected: choose one — (a) accept as known, fixed when `WorkflowCanvas.tsx` gets its G-5 refactor (recommended); (b) reword the "View only" header; (c) clear selection while Team is shown
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
