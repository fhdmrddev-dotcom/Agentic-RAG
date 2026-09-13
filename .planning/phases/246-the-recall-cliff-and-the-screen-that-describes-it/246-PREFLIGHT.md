---
type: preflight-review
phase: 246
phase_name: "The Recall Cliff, and the Screen That Describes It"
builder: gemini
reviewer: pending
reviewed_at: 2026-09-13
tree_state: clean at `6fc3519b5` — reviewed BEFORE any 246 execution commit
plans_reviewed: [246-01, 246-02, 246-03]
---

# Phase 246 — Pre-flight Review & Cross-Plan Seam Audit

## Executive Summary
Phase 246 addresses the small-tenant recall cliff (`RECALL-01`, `QUEUE-06`) and visual honesty of the search breadth setting (`RECALL-02`, `SEED-268`) across 3 execution plans:
* **246-01 (Wave 1)**: Backend code defaults (200 in `config.py` & `models/user_settings.py`), isolated server setting probe with TTL caching, `retrieval_tuning.py` dynamic shortcut, and Hot File Ledger sync.
* **246-02 (Wave 2)**: Frontend `SettingsPage.tsx` pre-fetch loading state (`useState<number | null>(null)` with neutral skeleton), dead `??` fallback removal, and copy calibration ("Default is 200").
* **246-03 (Wave 3)**: Dual-measurement recall and latency verification harness, asserting HNSW index execution (`idx_scan > 0`) and logging `246-VERIFICATION-DATA.md`.

All 6 findings from `BUS-200` are addressed and integrated.

---

## 1 · Cross-Plan Seam Audit

### ✅ Seam 1: Backend Setting Schema $\leftrightarrow$ Frontend State Hydration (246-01 $\leftrightarrow$ 246-02)
* **Risk (Finding 1):** Compiled-in frontend defaults (`useState(40)` or `useState(200)`) can assert a breadth before asking the server, re-creating the `SEED-268` desync on first paint.
* **Audit Result:**
  * In `246-02-PLAN.md`, `hnswEfSearch` is typed and initialized as `useState<number | null>(null)`.
  * The pre-fetch window renders a neutral pulsing skeleton (`div className="... animate-pulse"`), asserting nothing.
  * In `246-01-PLAN.md`, `GET /settings` serves `hnsw_ef_search` as an explicit non-optional integer (derived from `_val` fallback `200` on NULL rows).
  * `246-02` drops the dead `??` fallback in `setHnswEfSearch(data.hnsw_ef_search)`.
  * **Seam status: CLEAR.**

### ✅ Seam 2: Server Probe Isolation $\leftrightarrow$ In-Transaction Tuning (246-01 $\leftrightarrow$ 246-03)
* **Risk (Finding 2a):** `current_setting('hnsw.ef_search', true)` is session-scoped. Probed on a pooled connection inside a transaction that already executed `SET LOCAL`, it returns the borrower's local value rather than the server's configuration.
* **Audit Result:**
  * `246-01-PLAN.md` explicitly enforces that `get_server_ef_search` executes its probe via pool-level query (`pool.fetchval`) on a clean connection prior to or outside of request transactions.
  * Driven unit test `test_probe_not_poisoned_by_prior_set_local` verifies that a connection running `SET LOCAL hnsw.ef_search = 150` does not poison subsequent probe invocations.
  * `246-03-PLAN.md` evaluates the harness under default configuration and proves the probe correctly identifies underlying Postgres settings.
  * **Seam status: CLEAR.**

### ✅ Seam 3: Shortcut Inversion & Statement on Hot Path (246-01)
* **Risk (Finding 3):** With default `200` against standard Postgres server default `40`, `resolved_ef != server_default` evaluates to `True`, firing `SET LOCAL hnsw.ef_search = 200` on every search.
* **Audit Result:**
  * Explicitly acknowledged in `D-246-05`. The in-transaction statement cost is <1ms on an already-open asyncpg connection, which is the exact vehicle that restores small-tenant recall from 0.040 to 1.000.
  * Bounded inputs: lines `:131` and `:154` continue to refuse out-of-range or malformed values without executing statements (Finding 4).
  * **Seam status: CLEAR.**

### ✅ Seam 4: Strict Fence on `retrieval_service.py` (Phase Invariant)
* **Risk:** Incurring a third G-5 landing on `backend/app/services/retrieval_service.py` (19/11/456).
* **Audit Result:**
  * `files_modified` across all three plans does NOT include `retrieval_service.py`.
  * `retrieval_service.py:126` dynamically passes `user_settings.hnsw_ef_search if user_settings else settings.hnsw_ef_search` to `apply_hnsw_session_knobs`. It hardcodes no values.
  * Plan 01 includes `test_retrieval_service_is_byte_unchanged` to guarantee the fence holds.
  * **Seam status: CLEAR.**

---

## 2 · Plan Quality & Verification Audit

| Plan | Wave | Autonomous | Must-Haves / Truths | Verification Command |
|---|---|---|---|---|
| `246-01` | 1 | Yes | D-246-01 fence holds; config/model default 200; probe outside transaction; 60s TTL cache; non-40 simulation; ledger sync | `pytest backend/tests/unit/test_246_hnsw_server_probe.py backend/tests/unit/test_241_hnsw_knobs.py -v` |
| `246-02` | 2 | Yes | Null pre-fetch state; skeleton render; dead `??` deleted; "Default is 200" copy; SC#2 local assert | `npx vitest run frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx` |
| `246-03` | 3 | Yes | Index scan assertion (`idx_scan > 0`); recall@20 $\ge 0.99$; p95 latency before/after recorded in `246-VERIFICATION-DATA.md` | `pytest backend/tests/unit/test_246_recall_measurement.py -v` |

---

## 3 · Resolution of All Review Findings

1. **Finding 1 (Pre-fetch state):** Resolved in `246-02` via `useState<number | null>(null)` + skeleton render, eliminating dead `??` fallback.
2. **Finding 2 (Probe traps):** Resolved in `246-01` via fresh connection probe outside transaction (2a), `None` fallback on NULL (2b), and 60s TTL cache (2c).
3. **Finding 3 (Shortcut inversion):** Acknowledged and accepted in `246-01` as the vehicle delivering recall restoration.
4. **Finding 4 (_SERVER_DEFAULT_EF_SEARCH replacement):** Replacement scoped to `:155` no-op shortcut; `:131` and `:154` invalid fallbacks remain fail-safe.
5. **Finding 5 (G-2 sketch):** Formally waived in writing (`D-246-08`) for 5-word copy update + null loading state on an existing card.
6. **Finding 6 (SC#2 verification):** Scoped locally against the test database; production deploy remains deferred per `D-242-08`.
7. **Blocker A (Benchmark Target & Builder):** Resolved in `246-03-01`. `scripts/build-recall-bench.py` explicitly builds the 100,000-chunk skewed `recall_bench` database on `127.0.0.1:54322/recall_bench`. The recall harness and index scan assertions execute exclusively against `recall_bench`, leaving the live development database (`postgres`) untouched.
8. **Blocker B (`recall_eval.py` G-5 & Safe-as-Is):** Resolved in `246-03-02`. Documented that `recall_eval.py` is safe as-is (offline evaluation module, import-safe by construction, zero request-path coupling, additive instrumentation only), and its ledger row in `docs/HOT-FILE-LEDGER.md` is updated to reflect its 3rd phase landing in the same commit.

Tree is clean. Ready for independent review and execution authorization.
