---
phase: 241-recall-at-corpus-scale
review_type: independent
reviewer: gemini
builder: claude
date: 2026-09-19
verdict: passed
discharges_debt_06: true
bus_item: BUS-253
---

# Phase 241: Recall at Corpus Scale — Independent §6.3 Review Report

**Reviewer:** Gemini (Google Antigravity)  
**Builder:** Claude (Claude Code)  
**Discharges:** `BUS-253` · `DEBT-06` for Phase 241  
**Verdict:** **PASSED (Audited and Verified Across 4 Plans)**  

---

## 1. Executive Summary

Phase 241 investigated and addressed vector search recall at customer scale (QUEUE-06):
1. **Harness Honesty:** Replaced `scripts/measure-recall.py` (which produced structural `MRR 1.000` false-greens) with an honest, two-layer harness (`backend/app/services/recall_eval.py`), proving that `RecallUnmeasurable` raises on bad configurations and misses are honestly recorded.
2. **Knob Isolation & G-5 Compliance:** Added runtime HNSW tuning (`SET LOCAL hnsw.ef_search` / `hnsw.iterative_scan`) in `backend/app/services/retrieval_tuning.py`. Capped the landing in `backend/app/services/retrieval_service.py` to 11 lines, preserving the G-5 extraction obligation (`SEED-224`) intact.
3. **Migration 176 & CR-01:** Authored migration 176 (`app_settings_hnsw_knobs.sql`) and shipped a column-existence gate in `settings.py` so unmigrated environments fail cleanly with HTTP 409 instead of 500.
4. **Scale Findings & RECALL-01 Disposition:** Quantified the small-tenant recall cliff on 100k-chunk benchmarks. While Phase 241 showed `ef_search = 200` restored recall, Phase 246 later proved by `EXPLAIN (ANALYZE)` that `ef_search = 200` incurred a ~1.1s sequential scan, properly refusing `RECALL-01` and reverting the default to 40.

---

## 2. Target Audits & Verifications

### 2.1 `recall_eval.py` & G-5 Disposition
- **Harness Honesty:** Verified that `compute_metrics` treats `None` as a miss, `target_missing` documents absent targets without inflating scores, and unreachable DSNs raise `RecallUnmeasurable` without leaking passwords.
- **G-5 Disposition:** Evaluated `docs/HOT-FILE-LEDGER.md` entry. Phase 241 was landing 2 (2 phases, no G-5 trigger). When Phase 246 later triggered G-5 (landing 3, 3 phases), the *safe as-is* verdict was rigorously justified: offline test/eval module, zero request-path side effects, clean two-layer structure.

### 2.2 `retrieval_service.py` Extraction Precedent
- **Landing Size:** Verified that Phase 241 added only a guard and dispatch call (11 lines) to `retrieval_service.py`, moving all knob logic into `retrieval_tuning.py`.
- **Owed Extraction (`SEED-224`):** Confirmed the extraction requirement is preserved verbatim in `docs/HOT-FILE-LEDGER.md` (`19 / 11 / 456`) and in `retrieval_service.py` inline comments (*"A third landing must propose the extraction FIRST"*).

### 2.3 `RECALL-01` Refusal & Historical Context
- Phase 241 measured that `ef_search = 200` brought recall back from ~0.04 to 1.000 on a 100k-chunk synthetic bench.
- However, Phase 241 correctly documented the steep latency penalty (~41x), and Phase 246 confirmed through query execution plans that `ef_search = 200` was forcing sequential scans. The refusal of `RECALL-01` and retention of `SEED-273` was an honest, empirical engineering decision.

### 2.4 UAT Row 5 Expiration
- UAT Row 5 tested behavior on a cloud database *prior* to migration 176 landing.
- Migration 176 has since been applied to both local and cloud environments, rendering the pre-migration cloud condition permanently expired. The local substitute was verified during the phase.

### 2.5 Unit Test Suite Verification
- Executed all 4 Phase 241 test suites:
  - `backend/tests/unit/test_241_hnsw_knobs.py`
  - `backend/tests/unit/test_241_bench_safety.py`
  - `backend/tests/unit/test_241_cr01_settings_write_without_migration.py`
  - `backend/tests/unit/test_241_recall_harness_honesty.py`
- **Result:** **117/117 passed** in 9.64s.

---

## 3. Verification Status & Debt Resolution

- **`241-VERIFICATION.md`:** Updated `verification_mode: peer-reviewed`, `independent_review: done`, `reviewer: gemini`.
- **`DEBT-06` Requirement for Phase 241:** **DISCHARGED**.
- **`BUS-253`:** Answered and closed.
