---
status: partial
phase: 281-a-refusal-names-its-cause
source: [281-VERIFICATION.md, 281-LIVE-EVIDENCE.md]
started: 2026-10-15T09:00:00Z
updated: 2026-10-15T09:00:00Z
---

## Current Test

[awaiting human testing — owed by the operator's decision of 2026-10-15 ("approved"); run A first]

## Tests

### 1. Row A — emit miss at publish (D-17 / D-06 live / D-32)
expected: Publish a draft whose emit reliably misses a template field (a weaker model than deepseek-v4-flash, or a template with a field the KB cannot fill). WHAT STOPPED IT names the missing keys under the step's canvas name; "citation" absent unless `uncited_value_count > 0`; the chat failure message names the step by canvas name or "This step", never the slug. Also carries row B's leftover: the run panel's failed-step reason equals this cause. Re-drive recipe: `281-LIVE-EVIDENCE.md` § Row A.
result: [pending]

### 2. Row C — describe-door `connection_not_allowed` (D-19)
expected: With a drafting model that reaches the connection check, a step needing an unchosen service shows the table's sentence + next step with technical names OFF, and the small `connection_not_allowed · no_service_chosen` code with them ON. Re-drive recipe: `281-LIVE-EVIDENCE.md` § Row C.
result: [pending]

### 3. Row D — freshness with an archived document (D-20)
expected: Needs a NEW operator approval for the reversible `archived_at` write and one freshly uploaded document in the freshness workflow's folder. The archived document's date does not decide the verdict; `archived_at` is restored and the restore read is shown. Re-drive recipe: `281-LIVE-EVIDENCE.md` § Row D.
result: [pending]

### 4. WR-02 policy confirmation
expected: The operator accepts that an all-archived scope passes freshness exactly like an empty scope (Phase 102's design, pinned by `test_281_freshness_retrievable.py`), or asks for fail-closed (a one-line `validator_kinds.py` change that also flips the empty-scope verdict).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
