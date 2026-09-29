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
result: issues_found (independent review report committed in 268-REVIEW.md: CR-01 org-less thread UUID(str(None)) crash, WR-01 cross-tenant org discrepancy, WR-02 clear vs folder_id conflict)

### 2. SC#1 continued-run clause driven live
expected: A Deep run with an Expert active reaches `cap_paused`, is Continued, and on `/admin/spend` that Expert's
line counts BOTH segments' tokens (D-268-20). Today this is proven only by `test_268_continuation_tokens.py`
(RED→GREEN) and the real-Postgres fixture; two live attempts finished under the cap.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
