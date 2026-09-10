---
status: partial
phase: 241-recall-at-corpus-scale
source: [241-VERIFICATION.md]
started: 2026-09-10
updated: 2026-09-10
---

## Current Test

[awaiting human testing]

⛔ **Why this file exists.** Phase 241 shipped two new operator controls on Settings → Search →
Retrieval. They are wired correctly in source and covered by unit tests with a mocked backend, and
the count gate pins their programmatic contracts — **but no human has clicked them in a live
browser.** Project guardrail **G-4** says wire format and a screenshot are insufficient for a
user-visible surface, and this phase paid for exactly that lesson in its own review: **CR-01 was a
shipped HTTP 500 on this very tab**, invisible to 4,400+ passing tests because every one of them
exercised reads, not the write path.

⚠ This is stated as an owed item and a DECISION, never as a claim that UAT ran.

## Tests

### 1. The two controls are present and legible on the Retrieval card
expected: Settings → Search → Retrieval shows a *search breadth* control (10–1000) and a
*keep scanning* control offering off / strict_order / relaxed_order. Both read their bounds and
enum members from the server, never from a private copy in the component. Labels say what the
setting COSTS, not merely its range.
result: [pending]

### 2. Saving a valid value round-trips and survives a reload
expected: set search breadth to 200 and keep-scanning to relaxed_order, save, hard-reload the page.
Both values come back. The database row shows `hnsw_ef_search = 200`,
`hnsw_iterative_scan = 'relaxed_order'`.
result: [pending]

### 3. An out-of-range value is REFUSED with a worded message, not a silent clamp
expected: attempt 9999 (and 5). The API refuses with HTTP 400 and a sentence stating what a bigger
search breadth costs — more vectors walked per query, slower searches, more memory. ⚠ `BUG-260909-01`
records that `save_app_settings` SWALLOWS a CHECK violation and returns as if the write succeeded,
so the **API refusal is the load-bearing arm** and the DB CHECK is only a backstop. If the UI
appears to accept 9999, that is the defect.
result: [pending]

### 4. ⛔ The rest of the Search tab still saves — the CR-01 regression guard
expected: change ONLY the reranker (or `rrf_k`, or the retrieval threshold) and save. It succeeds.
This is the exact interaction that returned HTTP 500 before the fix, and it will be the first thing
to break if the column gate is ever removed.
result: [pending]

### 5. ⛔ CLOUD — the same tab saves where migration 176 is NOT applied
expected: on cloud (176 still owed there), saving the Search tab's other settings SUCCEEDS, and
attempting to CHANGE search breadth or keep-scanning returns a worded **409** naming
`supabase/migrations/176_app_settings_hnsw_knobs.sql` — never a blanket 500, and never a silent
accept-then-discard.
⚠ **This row is the one that cannot be skipped**, because it is the only one that exercises the
production shape. Run it BEFORE applying 176 to cloud; once 176 is applied this row is
unreproducible.
result: [pending]

### 6. Turning the knobs actually changes retrieval behaviour
expected: with search breadth at 40 vs 200, the same question in chat returns results that differ
(or measurably does not, on a corpus too small for the index to be used at all — see
`241-VERDICT-CORRECTION-PLAN-PATH.md`: at 7,959 chunks the planner uses a Seq Scan and the HNSW
index has never been scanned, so **no visible difference here is the EXPECTED result on this
corpus** and is not a defect).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
