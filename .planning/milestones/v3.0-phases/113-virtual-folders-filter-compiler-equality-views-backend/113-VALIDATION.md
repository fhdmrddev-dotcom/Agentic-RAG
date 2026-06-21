---
phase: 113
slug: virtual-folders-filter-compiler-equality-views-backend
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-18
validated: 2026-06-19
---

# Phase 113 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 113-RESEARCH.md §"Validation Architecture" (HIGH confidence; analogs cited to file:line).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (`asyncio_mode = auto`) [VERIFIED: `backend/pytest.ini`] |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_*.py tests/integration/test_113_*.py -q` (23 tests: 10 unit + 13 integration) |
| **Estimated runtime** | ~15–30 seconds (unit sub-second; integration hits live :54322) |

Unit tests live in `tests/unit/` (pure, no DB — registry analog: `tests/unit/test_validator_kinds.py`). Live-DB tests live in `tests/integration/` and connect to local :54322 built from `backend/.env` (111/112 precedent — `@>` flat-filter analog: `tests/integration/test_111_flat_filter_compat.py`; conftest plants a fake cloud `SUPABASE_URL`, so integration tests supply the real local client).

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py -x` (sub-second; the compiler is pure → unit coverage of every op/combinator/edge/injection branch is exhaustive at the function level — Nyquist-sufficient sampling for the net-new logic)
- **After every plan wave:** Run the full 113 suite (unit + the three integration files) against live :54322
- **Before `/gsd:verify-work`:** Full suite must be green; the cross-user leak test green in secure-phase
- **Max feedback latency:** < 30 seconds

---

## Per-Task Verification Map

> Each Requirement/SC binds to its runnable oracle. `File Exists`/`Status` reconciled against the executed reality (validate-phase 2026-06-19): all test files now exist and run green live. Test function names match the source.

| Req / SC | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#2 / D-113-6 | `eq` compiles to `{field:value}` (correctness) | — | N/A | unit | `pytest tests/unit/test_113_view_filter_compiler.py::test_eq_compiles -x` | ✅ | ✅ green |
| SC#2 / VIEW-04 | multiple `eq` AND → one `metadata_filter` dict (AND-of-keys) | — | N/A | unit | `...::test_and_folds_conditions -x` | ✅ | ✅ green |
| D-113-9 | empty `conditions` → `{}` → no-narrowing (valid, not rejected) | — | N/A | unit | `...::test_empty_filter_no_narrowing -x` | ✅ | ✅ green |
| D-113-6 / Pitfall 5 | unknown op (`gte`/`or`) rejected at parse/compile (fails closed) | T-unknown-op | unknown op never eval'd; 422 | unit | `...::test_unknown_op_rejected -x` | ✅ | ✅ green |
| D-113-10 | unknown field rejected at SAVE (422); valid-then-deleted matches 0 at resolve (non-fatal) | T-field-injection | reject-at-save; resolve-tolerant | unit | `...::test_unknown_field_rejected_at_save -x` | ✅ | ✅ green |
| D-113-8 / Pitfall 3 | `_`-prefixed field (`_confidence`/`_source`) excluded/rejected | T-field-injection | display-only keys never a filter dimension (D-111-9) | unit | `...::test_underscore_field_excluded -x` | ✅ | ✅ green |
| **SC#4** | **injection/SSTI in a value neutralized (bound literal, no exec)** | T-sqli / T-ssti | value param-bound; table intact, 0 matches | unit + integration | `...::test_injection_value_neutralized -x` + `test_113_view_resolve.py::test_injection_value_neutralized_live` (0 matches, table intact) | ✅ | ✅ green |
| D-113-11 (WR-02) | `_uid` rejects any non-UUID before PostgREST `.or_()` DSL interpolation (own-scoping gate safe-by-construction) | T-or-grammar-breakout | service-role client → `user_id.eq.<uuid>` is the SOLE scoping gate; non-UUID raises | unit | `tests/unit/test_113_view_service_guards.py` (3: accepts uuid, rejects `.or_()` breakout, rejects non-uuid) | ✅ | ✅ green |
| SC#1 / VIEW-01/02 | view persists + resolves the right docs; one doc in multiple views (query-not-copy) | — | N/A | integration (live :54322) | `tests/integration/test_113_view_resolve.py::test_query_not_copy_one_doc_two_views -x` | ✅ | ✅ green |
| SC#1 / D-113-1 | complete listing, newest-first (`created_at desc`) + total count | — | N/A | integration | `test_113_view_resolve.py::test_order_and_count -x` | ✅ | ✅ green |
| SC#1 / D-113-9 | empty filter resolves all in scope; only `is_latest` versions resolve | — | N/A | integration | `test_113_view_resolve.py::test_empty_filter_resolves_all_in_scope` + `::test_only_latest_versions_resolve` | ✅ | ✅ green |
| VIEW-05 / D-113-5 | folder-subtree narrowing; unreachable scope → no narrowing (not error/empty) | — | N/A | integration | `test_113_view_folder_scope.py::test_folder_scope_narrows_to_subtree` + `::test_unreachable_scope_contributes_no_narrowing` | ✅ | ✅ green |
| D-113-12 / DMF-01 | `view.create` audit row written on create (LIVE, not mocked) | T-audit | audit row present | integration | `test_113_view_crud.py::test_create_writes_audit -x` | ✅ | ✅ green |
| D-113-12 | 404-not-403 on a cross-user/unseeable view id (no existence leak) | T-enum | generic 404 | integration | `test_113_view_crud.py::test_cross_user_miss_404 -x` | ✅ | ✅ green |
| D-113-12 (WR-01) | cross-user PATCH with an INVALID filter still 404 (validity oracle closed — no 422-vs-404 leak) | T-enum | whitelist-validate after ownership; uniform 404 | integration | `test_113_view_crud.py::test_cross_user_invalid_filter_patch_404` | ✅ | ✅ green |
| **SC#3 / VIEW-06** | **two users, same global view → DIFFERENT result sets; no content/count/existence leak; 404-not-403** | T-leak | per-viewer resolution; caller-scope never owner-scope | integration (live :54322) — **NOW AUTOMATED** | `test_113_view_global_leak.py` (3: per-viewer no-leak, zero-match-empty, nonexistent/unseeable→404) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **SC#3 was promoted from manual-only to automated.** The plan-time draft deferred the two-user global-view leak proof to secure-phase as a manual live test. It was authored + run live in secure-phase (commit `51280152`) as `tests/integration/test_113_view_global_leak.py` and now runs green in the standard suite — it is an automated oracle, no longer manual.

---

## Wave 0 Requirements

- [x] `tests/unit/test_113_view_filter_compiler.py` — SC#2/SC#4 + all compiler edges (7 tests green) (registry analog: `tests/unit/test_validator_kinds.py`)
- [x] `tests/unit/test_113_view_service_guards.py` — `_uid` PostgREST-DSL guard, WR-02 hardening (3 tests green) **[net-new beyond plan-time map]**
- [x] `tests/integration/test_113_view_crud.py` — live CRUD + `view.create` audit row + 404-not-403 + cross-user-invalid-filter-404 (3 tests green) (analogs: `tests/integration/test_111_metadata_fields_crud.py`, `test_111_audit_field_create.py`)
- [x] `tests/integration/test_113_view_resolve.py` — live resolve correctness + newest-first + count + query-not-copy + injection-live + is_latest (5 tests green) (analog: `test_111_flat_filter_compat.py`)
- [x] `tests/integration/test_113_view_folder_scope.py` — live folder-subtree narrowing + unreachable-scope (2 tests green)
- [x] `tests/integration/test_113_view_global_leak.py` — the two-user cross-user GLOBAL-view leak test (authored in VALIDATION §Manual-Only, run live in secure-phase, commit `51280152`; **now automated**, 3 tests green)
- [x] Framework install: **none** — pytest infra exists and is in active use

---

## Manual-Only Verifications

**None.** The only behavior originally listed here — the cross-user global-view leak test (SC#3 / VIEW-06) — has been **automated** and now runs green in the standard integration suite (see below). Phase 113 has **zero** remaining manual-only verifications.

> _Resolved (was manual-only at plan time):_ Cross-user global-view leak test (SC#3 / VIEW-06). The plan-time draft required two real callers against live :54322 because an RLS policy label is NOT proof (D-102 / D-110-5 "static would false-green" lesson). It was authored + run live in secure-phase and is now the automated `tests/integration/test_113_view_global_leak.py` (3 tests): (a) A sees ONLY A's matches, B sees ONLY B's; (b) result sets AND `total` DIFFER; (c) neither sees the other's ids/filenames; (d) zero-match caller gets `{documents:[], total:0}`; (e) nonexistent/unseeable id → 404-not-403. Drives the REAL `resolve_view` coroutine with two distinct caller ids — not a mock.

> **SC#10 4-axis cross-provider UAT does NOT apply** (D-113-14) — Phase 113 touches no streaming / agent-loop / provider-routing / UI-state surface. The agent-tool cross-provider UAT is Phase 115's gate.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (validate-phase 2026-06-19 — 23/23 green live, zero gaps)

---

## Validation Audit 2026-06-19

State A audit: reconciled the plan-time draft (all rows `❌ W0` / pending) against the executed + secured reality. All test files now exist and run green live; SC#3/VIEW-06 was promoted from manual-only to an automated oracle. No auditor spawn required (zero gaps).

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Requirements COVERED | 13/13 (was 0/13 in stale draft) |
| Manual-only remaining | 0 (SC#3 promoted to automated) |

**Live suite result (validate-phase):** `pytest tests/unit/test_113_*.py tests/integration/test_113_*.py` → **23 passed** (10 unit + 13 integration against live :54322), 0 failed.

| Suite | File | Tests |
|-------|------|-------|
| unit | `test_113_view_filter_compiler.py` | 7 |
| unit | `test_113_view_service_guards.py` | 3 |
| integration | `test_113_view_crud.py` | 3 |
| integration | `test_113_view_resolve.py` | 5 |
| integration | `test_113_view_folder_scope.py` | 2 |
| integration | `test_113_view_global_leak.py` | 3 |
