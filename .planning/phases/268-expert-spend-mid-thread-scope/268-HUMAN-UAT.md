---
status: partial
phase: 268-expert-spend-mid-thread-scope
source: [268-VERIFICATION.md]
started: 2026-09-29T00:00:00Z
updated: 2026-09-29T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Independent (non-builder) review of phase 268 — AGENTS.md (requested: BUS-305 → gemini)
expected: A reviewer that did not shape the build (Gemini via `.agent-bus/`, per AGENTS.md) reviews the 268 diff
(`220c82dde..HEAD`) and either confirms it or files findings over the bus. The in-session review (268-REVIEW.md,
3 iterations, all_fixed) came from the same build lineage and does not discharge this.
result: passed — Gemini's review (268-REVIEW.md iteration 4) was checked by Claude 2026-09-29: CR-01 and WR-01 refuted, WR-02 confirmed as Info only; 0 blocking findings.

### 2. SC#1 continued-run clause driven live
expected: A Deep run with an Expert active reaches `cap_paused`, is Continued, and on `/admin/spend` that Expert's
line counts BOTH segments' tokens (D-268-20). Today this is proven only by `test_268_continuation_tokens.py`
(RED→GREEN) and the real-Postgres fixture; two live attempts finished under the cap.
result: passed (seeded pause) — 2026-09-29 after the D-2 fix: a real Continue added +139,903 / +297 to the run and exactly the same to the HR Advisor line (8 runs unchanged; independent SUM agrees). D-1 and D-3 remain open. See 268-UAT-LOG.md.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
