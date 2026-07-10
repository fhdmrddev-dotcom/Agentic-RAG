---
status: partial
phase: 128-chat-tool-card-unification-chat-area-reclaim
source: [128-VERIFICATION.md]
started: 2026-06-27
updated: 2026-06-27
---

## Current Test

[awaiting human testing — carried forward; operator accepted deferral at phase close 2026-06-27]

## Tests

### 1. CTC-04 long-prompt clamp — live overflow reveal
expected: Pasting a long (≥50-line / ≥5KB) user prompt collapses the violet bubble to a `-webkit-line-clamp:7` preview with a "Read more" chip; clicking toggles Read more / Show less; a short prompt renders unchanged. (Code path `MessageItem.tsx:80–122`; jsdom has no layout engine so this can't be unit-tested — needs a real browser.)
result: [pending]

### 2. CTC-04 fade color judgment
expected: The clamp fade (`from-[hsl(258_90%_66%)]`, `MessageItem.tsx:108`) dissolves into the violet bubble interior, NOT a cut to the page background.
result: [pending]

### 3. TDP-02 preparing-window description — live cross-provider SSE wire
expected: On a tool-using prompt, the "Preparing {tool}… — {description}" text appears during the prep gap when the provider emits `description` early in `argsCodeText`; the quiet `Preparing {tool}…` fallback shows when it doesn't (Google atomic ≈0 window is correct). Partial-JSON extraction proven by 6/6 unit tests; the per-provider live WIN magnitude is the deferred measurement. Part of the deferred full native-7 × 4-axis scoreboard (128-VALIDATION.md re-open trigger).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

(none failed — all 5 codebase deliverables verified in 128-VERIFICATION.md; these 3 are live-only checks carried forward by operator acceptance, with the 128-VALIDATION.md re-open trigger guarding regressions.)
