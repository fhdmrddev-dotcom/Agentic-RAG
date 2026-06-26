---
status: partial
phase: 124-workflow-studio-ux-soul-strict-loose
source: [124-VERIFICATION.md]
started: 2026-06-26T21:49:24Z
updated: 2026-06-26T21:49:24Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 046-A sketch-match — all 3 soul sizes
expected: The library card, run header, and publish summary each render the soul against operator-approved sketch 046-A — purpose as the HERO (largest text), glyph-dot phase spine (no type ribbons / no index digits), ONE tier chip (glyph + WORD), the needs line, and the output line. Switching workflows updates all three in lockstep with the SAME tier/glyphs/needs/output (SC#1 + SC#2).
result: [pending]

### 2. 047-A sketch-match — both doors
expected: The Studio authoring entry shows the two-door chooser per sketch 047-A — "Describe & run" (loose) and "Author & govern" (strict). The describe door shows the describe box + a live soul preview + the "switch to Author & govern ›" strip; the govern door is the full Builder; "‹ both doors" returns to the chooser (SC#3 + SC#4).
result: [pending]

### 3. A1 deliverable-label string
expected: The soul output atom renders the deliverable label ("<workflow name> · file" for a workflow with a terminal llm_emit phase; "produces: answer in chat" otherwise). Confirm the exact friendly copy reads honestly against sketch 046-A (mechanism is locked + tested; only the exact string is operator-confirmed per decision A1).
result: [pending]

### 4. Live deriveTier recompute + locked judge (CR-01 path included)
expected: In the govern door, changing a citation policy / gate recomputes the tier chip live; the llm_judge_rubric judge renders LOCKED / always-on and cannot be removed. Also confirm CR-01 fix: type a requirement in the loose "Describe & run" door, click "Draft the workflow" — the typed text carries into the Builder and the draft is generated (the text is NOT dropped, no empty-Builder dead-end).
result: [pending]

### 5. Deep Mode byte-identical (D-08)
expected: Open a non-harness (Deep Mode) thread — NO "This workflow" soul section appears; the live timeline / PhaseCard / PhaseTimeline render exactly as before (the run-surface soul is harness-gated via showTimeline).
result: [pending]

### 6. SC#10 cross-provider smoke (VALIDATION.md — 4-axis)
expected: Across OpenAI / Anthropic / Google / OpenRouter, run a harness workflow and confirm: the soul header mounts above the live timeline, no console errors, no soul-state bleed between parallel threads (Thread A streaming while Thread B opens), and the soul renders correctly with a long (≥50 message OR ≥5KB) prompt. Multi-tool row exercises 2+ tools in one prompt.
result: [pending]

### 7. Mobile 375px legibility
expected: At a 375px viewport, the card soul and the run-header soul remain legible and well-composed — purpose hero readable, spine dots not crowded, tier chip + needs + output not clipped.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
