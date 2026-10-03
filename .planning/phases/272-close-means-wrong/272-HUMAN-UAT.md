---
status: partial
phase: 272-close-means-wrong
source: [272-VERIFICATION.md]
started: 2026-10-03T00:00:00Z
updated: 2026-10-03T13:10:00Z
---

## Current Test

[test 1 done 2026-10-03; test 3 (production parity) pending]

## Tests

### 1. Live re-drive of the review-fix rules (after a backend restart)
expected: CR-01 — a `topics eq <value>` filter returns the matching document; CR-02 — `within_next` on a custom date field is refused as kind 3 (not run on `date`); WR-02 — after a zero-match date filter, a wide same-field retry (open-ended `after`) is refused while a disjoint or different-value retry is allowed. Each with a `search.query` audit row showing filters + result_kind.
result: pass — re-driven 2026-10-03 on the restarted backend (pid 30404, started 17:00:26 +04, after HEAD 23166e577), anthropic claude-sonnet-5, real runs via POST /threads/{id}/messages. CR-01 run 9450816b: `topics eq tax` → audit bc7915d8 `passages`, matched 1 = `272-uat-tax-memo.md` (["Tax","Audit"]); the "taxation" control and a "withholding tax" doc not matched. CR-02 run a38193eb: `contract_end within_next 60 days` → audit 1107efa2 `invalid_filter` naming the four relative-op fields; the model retried `between` on contract_end (audit fa15f0e4) and got the memo, whose document date is outside that window. WR-02 run 27e7f5b8: July 2026 Acme → 68ff85d8 `no_documents_matched`; open-ended `after 2026-06-30` → 9642bc15 `refused_retry`; whole-year 2026 → c464f8b3 `refused_retry`; disjoint July 2025 → 4e47eb73 allowed (searched, zero). The WR-02 retries were LED by the prompt; the unprompted run 09bc4bf2 never retried. ⚠ See Gaps G-1: the first, unforced CR-01 run (376e459a) answered from `query_documents_by_view`, which still returns the false zero. Evidence: `evidence/uat-rerun/`, log `272-UAT-LOG.md` § "HUMAN-UAT 1".

### 2. Operator confirms the three logic rules the fixer flagged
expected: CR-01 element-match rule, WR-02 widening rule and WR-06 re-create rule accepted as the wanted rules (272-REVIEW-FIX.md).
result: pass — operator selected "Accept" on all three, 2026-10-03

### 3. Production parity before any deploy
expected: migration 200 STEP 1 (CREATE INDEX CONCURRENTLY) alone, then STEP 2, then 201; both VERIFY blocks 19/19 PASS; get_advisors(security) shows no new findings. Every write operator-approved per action.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- **G-1 (open, found by test 1, outside the review-fix scope): CR-01's false zero is live on `query_documents_by_view`.**
  The prompt "Which documents are tagged tax? Use the topics filter." (run 376e459a-d708-4537-91a9-92fd91fd1f56,
  anthropic claude-sonnet-5) was answered with `query_documents_by_view {topics eq "tax"}` → `total: 0`, and the
  user was told *"No documents are tagged with the topic "tax""* while `272-uat-tax-memo.md` carries `["Tax","Audit"]`.
  Cause: the 271 compiler's `_op_eq` sends `topics` to the `@>` containment path with a scalar value
  (`view_filter_compiler.py:169-170`); the CR-01 fix rewrites `eq` only inside `retrieval_scope._compiler_condition`,
  which `search_documents` uses and this tool does not. Measured on the local DB: `metadata @> {"topics":"tax"}` and
  `{"topics":"Tax"}` both match 0; `{"topics":["Tax"]}` matches 1. Find and Views share the compiler, so they very
  likely share the hole (the same shape as CR-02's recorded "Find and Views" item). Not fixed here (verification only).
