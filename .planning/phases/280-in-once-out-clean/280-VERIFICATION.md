---
phase: 280-in-once-out-clean
verified: 2026-10-14T00:00:00Z
status: passed
score: 4/5 success criteria verified in code and live; SC#2 live row PARTIAL (104/105)
overrides_applied: 3  # operator-delegated rulings 2026-10-14, see Operator rulings
gaps: []
human_verification:
  - test: "SC#2 OneDrive live re-drive: re-run after BUG-261014-02 (TLS download failure never retried) is ruled on/fixed, or accept 104/105"
    expected: "105/105 imported, /Team Docs/ paths decoded, rule matches, run success + complete"
    why_human: "Operator ruling owed; D-15 requires all 105 by count"
  - test: "WR-01 (retired same-bytes match is auto-restored) and WR-02 ('later upload wins', exactly one latest) rulings"
    expected: "Operator confirms or overrides these Claude rulings (D-32)"
    why_human: "Semantics choices awaiting operator confirmation"
---

# Phase 280: In Once, Out Clean - Verification Report

**Phase Goal:** A document that comes in arrives exactly once and completely, and one that goes out leaves nothing behind (no orphaned bytes, no 500, no unanswered question about artifacts).
**HEAD:** 373d1dee4 (develop). **Status:** human_needed. **Re-verification:** No.

## Success Criteria

| SC | Status | Evidence |
|---|---|---|
| 1 Same-bytes upload while in flight: one copy, no 409, in-flight row never retired (FIX-02) | VERIFIED | `ingest_splice.py::mint_document_row` has the D-24 in-flight leg, insert-then-retire, 23505 resolved to the live winner (WR-01 fix: never a retired row). `test_280_minter_sequence.py` and `test_266_mint_org_scope.py` pass. LIVE-EVIDENCE: 24 passed, 0 skipped against the real index, incl. a forced documents_dedup_idx collision. Watch import and promote go through the same minter (`test_274_promote_preview_parity`, `services/sources/` pass). |
| 2 Graph adapter: cursor raises, `?#&/('` cannot shape path, decoded paths; live OneDrive re-drive (FIX-03/04/05) | PARTIAL: code VERIFIED, live row OWED | Pins for all three re-driven RED/GREEN in plan 02; `_item_segment` (`quote(id, safe="!")`) in `microsoft_graph.py`; `services/sources/` suites pass. Live drive: 104 of 105 imported. Paging, decoded `/Team Docs/` paths, rule match, run success and listing complete all PASS. `team-note-058.txt` failed on a transient download TLS error that is never retried (BUG-261014-02). The row is recorded as OWED rather than omitted, and D-15 demands all 105. |
| 3 Both watch purge doors remove bytes after row delete; held doc refuses and keeps bytes (DEBT-10) | VERIFIED | `app/services/document_purge.py::purge_documents`: hold guard, then rows delete, then bytes from the DELETE's returned rows only; storage failure logged, not raised. `test_280_purge_bytes.py` passes. Live: both doors 2/2 paths `1 -> 0`; held `1 -> 1`, 409 `legal_hold`. G-5 extraction of `sources.py` done first. |
| 4 `DELETE /documents/{id}` unowned/nonexistent gives 404 `Document not found`; other `maybe_single` sites fixed or listed (DEBT-11) | VERIFIED | `maybe_row` in `utils/db.py`, AST fence `test_280_maybe_row_fence.py`, `test_280_delete_404.py`, `test_275_delete_paths.py` all pass. Live: foreign id and random id give an identical 404, so there is no existence oracle. The dead `main.py` patch was removed (D-30). |
| 5 Recorded DEBT-08 decision for `message_artifacts` on disposal | VERIFIED | `docs/RETENTION-AND-ARTIFACTS.md`: Decision KEEP, four reasons, no code or migration needed (enforcement arm N/A). The caption test (renamed per IN-06) passes in the suites run. The audience-facing record sits in `docs/history/v4.5-find-it-show-it.md`. |

## "How we'd know this failed" modes

| Mode | Result |
|---|---|
| Dedup swallows error but still retires first | Not present (in-flight leg, live-proven) |
| Atomic for upload door only; watch path races | Not present (single minter, shared by all callers) |
| OneDrive row reads "pass" on doubles alone | Not present: recorded PARTIAL/OWED, honestly |
| Bytes removed before row delete / purge of held doc removes bytes | Not present (order pinned, live held 1 -> 1) |
| 404 existence oracle | Not present (identical 404 live) |
| DEBT-08 says delete with no code, or keep with broken reference | Not present (KEEP, no enforcement required; rendering explained) |

## Requirements Coverage

All seven IDs appear in the plan frontmatter and in REQUIREMENTS.md (FIX-02..05, DEBT-08, DEBT-10, DEBT-11). No orphans. FIX-03/04/05: code SATISFIED, live proof for FIX-03 (every page) is 104/105 with the miss caused by a different defect. DEBT-08 SATISFIED (decision recorded). REQUIREMENTS.md checkboxes still read Pending; the orchestrator should flip them at close.

## Commands run (verbatim verdicts)

- Targeted suites: `509 passed, 3 warnings in 18.17s`.
- Full backend baseline gate, run after the review fixes under the local-DB lock (acquired, released): `Summary: 71 failed, 7381 passed, 1 skipped, 2 xfailed, 2 xpassed ... Failed tests: 71 (allowed ceiling: <= 71)` and `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` Set diff against base (72): NO new failing test. Two base failures no longer fail (`test_230 ... live_reclaim ...` flaky, and a `test_sql_service` entry whose raw line differs only by a glued warning, so it is the same test).
- `check-hot-file-ledger.cjs`: `ledger gate OK - every watched file has a row`.
- `check-claude-md-size.cjs`: `91113 chars 60.7% ... gate OK`.
- `ls supabase/migrations | tail -1`: `206_retention_hold_hardening.sql` (no migration 207 was needed).
- Debt-marker scan (TBD/FIXME/XXX) over the main modified source files: none.

## Known recorded items scored (not rediscovered)

- Vitest count gate red on unmodified `WorkflowBuilderPage.canvas.test.tsx` timeout (inherited, unproven); tsc 66 inherited errors. Not re-run here; no frontend source is in scope for this phase.
- Deferred bugs BUG-261014-03/04/05 (WR-03/04, IN-05): legitimately deferred with reasons; none is a success criterion.
- WR-01 / WR-02: behaviours fixed and live-proven, but they are Claude rulings (D-32) awaiting operator confirmation.

## Gaps Summary

No success criterion is unmet by code. Open items are operator-gated: the SC#2 live row (104/105, BUG-261014-02) and the WR-01/WR-02 rulings. Status is therefore `human_needed`.

_Verifier: Claude (gsd-verifier)_


## Operator rulings (2026-10-14)

The operator delegated all three open items: *"this is a testing environment so you take the decision that are best for production grade later"*. Claude's rulings:

1. **SC#2, 104/105: ACCEPTED.** None of the three Graph defects reproduced (4 pages, decoded `/Team Docs/` paths, rule matched 104/104, `listing_complete`). The missing file is a transient TLS download failure that is never retried. That is `BUG-261014-02`, a production-relevant reliability bug that stays **open**, recommended for the next repair phase. BUG-260910-04 is closed and 238 M-9 is flipped to PASS by ruling.
2. **WR-01, auto-restore of a retired same-name match: KEPT.** A re-upload of old bytes expresses "make this current". The alternatives are worse: a 409 is a dead end for the user, and a new version row is impossible without a migration, because `documents_dedup_idx` includes retired rows. Restore uses the existing Restore semantics.
3. **WR-02, "later upload wins": KEPT.** It guarantees exactly one latest row. The residual is a shared `version_number`, closable only by a constraint (a future migration).
