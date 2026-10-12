---
phase: 272-close-means-wrong
verified: 2026-10-03T00:00:00Z
status: human_needed
verification_mode: self-verified
score: 3/4 roadmap SCs verified; SC#4 closed by operator decision (6/8 met, not a pass)
overrides_applied: 0
re_verification:
  previous_status: none
gaps: []
human_verification:
  - test: "Restart the backend (uvicorn --reload does not respawn on this box), then re-drive the three review-fix rules live: CR-01 (a `topics eq <value>` filter returns the matching document), CR-02 (`within_next` on a custom date field is refused as kind 3, not silently run on `date`), WR-02 (after a zero-match date filter, a wide same-field retry such as open-ended `after` is refused; a disjoint or different-value retry is allowed)."
    expected: "Each rule behaves as the fix report describes, in a real agent run, with a `search.query` audit row showing filters + result_kind."
    why_human: "The ten review fixes (ba455369d..e48c4eaf9) are covered by unit tests and, for CR-01/WR-05, by live-DB integration tests. No live agent drive or board re-run happened after them; the last live evidence (board, G-4 re-runs) predates the CR-01/CR-02/WR-02 logic changes."
  - test: "Operator confirms the three logic rules the fixer flagged: CR-01 element-match rule, WR-02 widening rule, WR-06 re-create rule."
    expected: "Operator accepts each rule as the wanted one."
    why_human: "272-REVIEW-FIX.md marks all three requires_human_verification: they change logic, not shape."
  - test: "Production parity before any deploy: STEP 1 (CREATE INDEX CONCURRENTLY) alone, then STEP 2 of migration 200, then 201, both VERIFY blocks, get_advisors(security)."
    expected: "19/19 PASS on both VERIFY blocks; no new advisor findings."
    why_human: "Every production write needs per-action operator approval; production was not touched."
---

# Phase 272: Close Means Wrong - Verification Report

**Phase Goal:** When a question names a period or a dimension, retrieval is filtered to it structurally ("October revenue" cannot return March). When nothing matches, the agent says so instead of answering from the nearest wrong document.
**Verified:** 2026-10-03 (HEAD b98fef62e on develop, includes the review-fix commits)
**Status:** human_needed
**Verification mode:** self-verified (Gemini is out per CLAUDE.md; no independent reviewer)
**Re-verification:** No, initial verification

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | "October revenue": the search call carries a date filter and every cited source is in October; same for a custom-field dimension | VERIFIED | Board prompts (a) and (b) in 272-VALIDATION.md section 3: audit rows show `date between 2025-10-01 and 2025-10-31` and `legal_entity eq Acme GmbH`. Lived G4-1 re-run: citations only the two October reports, card line "Filtered: document date 1-31 Oct 2025", audit `a23161d1`. Filter reaches both arms (`p_document_ids` in migration 200 on both RPCs; `test_272_filtered_both_arms.py`). |
| SC#2 | No match: the agent says nothing matched and cites nothing; never falls back to unfiltered | VERIFIED | `search_documents_tool.py` kind-2 arm (`no_documents_matched`) returns `citations=[]`, `source_refs=[]`; empty set short-circuits with zero retrieval calls (`test_272_result_kinds.py`); D-09 lock refuses a filter-dropping retry (G4-2 audit `c8b9c9ba`, `refused_retry`). Adapter returns `[]` on `folder_ids=[]` (WR-07). G4-2 re-run: no number, no citation. Residual: grep/query_documents/read_document are not structurally locked (D-22, recorded known limit; MiniMax board (c) first run cited out-of-filter figures). |
| SC#3 | A matching filter returns its documents; measured against the SEED-273 recall cliff | VERIFIED | Recall ladder (VALIDATION section 2, 100,000 chunks, pgvector 0.8.0): recall@20 = 1.000 at every filtered point, 500 to 15,000 chunks. Thresholds `FILTERED_EXACT_MAX_CHUNKS=2000`, `FILTERED_ITERATIVE_SCAN=relaxed_order` present in `retrieval_rpc.py:47,53`. D-27 coverage fix: G4-3 re-run returned 3/3 matched documents. Migration 201 plan-cache pin found by measurement and folded into 200 by WR-04. Caveat: pre-existing unfiltered control recall 0.89 is SEED-273's open half, not a 272 change. |
| SC#4 | Holds across the full native roster + OpenRouter (8-row board), blocked rows recorded | CLOSED BY OPERATOR DECISION, NOT A PASS | Recorded as a decision in VALIDATION "Operator sign-off and the SC#4 decision": operator selected "Close with Google recorded unmet". Met on 6 of 8 rows (openai, anthropic, deepseek, zhipu, moonshot, openrouter). Google gemini-3.5-flash UNMET on (a), (b), (c): model behaviour, investigated (schema reaches Gemini intact; it prefers query_documents SQL and hits the 15-step cap). MiniMax-M3 UNSTABLE: (a) PASS to FAIL and (c) FAIL to PASS between boards, not attributable to code. Board totals 20/24 first, 20/24 after the fixes. SEED-334 (must-filter field flag) and SEED-335 planted; both files exist. No row omitted. |

Score: SC#1-3 verified, SC#4 a recorded operator decision with 2 of 8 rows not met. This is reported as a decision, not a pass.

### "How we'd know this failed" conditions

| Condition | Status | Evidence |
|---|---|---|
| Period in query text but not as a filter argument | Not observed on 6/8 rows; observed on Google and once on MiniMax | Board audit `filters` readout; covered by SC#4 decision |
| Filter reaches one arm only | Not observed | Both RPCs take `p_document_ids`; `test_272_filtered_both_arms.py` asserts the same set to both |
| Empty result silently widens | Not observed on the server side | Kind 2 short-circuit plus D-09 lock; model-initiated widening via other tools is the known D-22 limit |
| `freshness` validator absorbs the requirement | Not observed | No freshness-kind change in the phase files; filters are a tool argument |
| A provider passes by luck without emitting the filter | Guarded | Board rule: a correct answer without `filters` FAILS the row (Google rows recorded FAIL on that basis) |
| Selective filter returns zero rows through the index | Not observed | Recall ladder recall 1.000 at every filtered size; btree/exact branch, no HNSW graph walk |

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `backend/app/services/retrieval_scope.py`, `search_documents_tool.py`, `retrieval_rpc.py`, `retrieval_rank.py` | VERIFIED | Exist, substantive, wired (`tool_dispatcher.py:49` imports the handler; `agent_loop.py:77,1486` use `today_line` and vocabulary). No TBD/FIXME/XXX markers. |
| `supabase/migrations/200_*.sql`, `201_*.sql` | VERIFIED (local only) | `p_document_ids` on both RPCs; VERIFY blocks 19/19 PASS per fix report. Production not applied (owed). |
| Test suites | VERIFIED | `pytest tests/unit -k 272`: 224 passed (run by this verifier). Fix report records the baseline gate at 71 failed (ceiling 71), NEW [] and GONE []. I did not re-run the full gate. |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| FIND-07 | 272-01 to 272-05 (all five declare it) | SATISFIED for SC#1-3; SC#4 closed by operator decision | Above. No orphaned requirement IDs for Phase 272. Note: REQUIREMENTS.md still shows FIND-07 unchecked and "Pending" (lines 18, 57). The orchestrator must update it at phase close. |

### Review findings

272-REVIEW-FIX.md: 10 of 10 in-scope findings fixed (CR-01, CR-02, WR-01 to WR-08), each driven RED first. Eight Info findings out of scope. Recorded-not-fixed items: Find/Views share CR-02's compiler hole (capability decision), IN-02 `nearby_values` for topics, and `supabase db reset` replay of the CONCURRENTLY step undriven.

### Anti-Patterns

No debt markers in the four core files. No blockers found.

### Evidence staleness (flagged as requested)

- **Fix changed behaviour after the live evidence:** CR-01 (topics element match), CR-02 (relative-date operators refused off the four date fields; custom date fields restricted to a closed operator set) and WR-02 (lock widening rule) postdate the board and the G-4 re-runs. The live runs exercised date and `legal_entity` filters on the deepseek flash setting, and never a `topics` filter. Their only evidence is unit tests plus (CR-01 only) a live-DB integration test; no live agent drive. The fix report states the backend was not restarted, so none of the Python fixes are live.
- Board and G-4 evidence for SC#1/SC#2 is still valid for the date and entity paths, but it predates WR-02: the D-09 lock behaves differently now (an allowed or refused retry may differ from what G4-2 recorded). The first-run MiniMax pre-search failure (answer cited out-of-filter figures) was a pre-lock gap and is unchanged.
- WR-08 changed sub-agent prompts and tool messages; its only evidence is unit tests.

## Gaps Summary

No must-have is failed. Status is human_needed rather than passed because: (1) three logic-changing review fixes (CR-01, WR-02, WR-06) are flagged requires-human-verification and not live-driven after a backend restart; (2) SC#4 is closed by operator decision with Google unmet and MiniMax unstable, which is a recorded exception, not a pass; (3) production parity (migrations 200/201, two-step apply) is owed. G-4 G4-1 to G4-3 were operator-signed ("Approved", 2026-10-03). I ran only the 272-tagged unit tests (224 passed), not the full backend baseline, vitest gate or live drives.

---

_Verified: 2026-10-03_
_Verifier: Claude (gsd-verifier), verification_mode: self-verified_
