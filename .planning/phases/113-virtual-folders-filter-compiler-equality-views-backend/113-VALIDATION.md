---
phase: 113
slug: virtual-folders-filter-compiler-equality-views-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
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
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py tests/integration/test_113_*.py -q` |
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

> Task IDs are finalized by the planner; this map binds each Requirement/SC to its runnable oracle so the planner can attach `<automated>` blocks directly. `❌ W0` = test file is a Wave 0 gap (does not exist yet).

| Req / SC | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#2 / D-113-6 | `eq` compiles to `{field:value}` (correctness) | — | N/A | unit | `pytest tests/unit/test_113_view_filter_compiler.py::test_eq_compiles -x` | ❌ W0 | ⬜ pending |
| SC#2 / VIEW-04 | multiple `eq` AND → one `metadata_filter` dict (AND-of-keys) | — | N/A | unit | `...::test_and_folds_conditions -x` | ❌ W0 | ⬜ pending |
| D-113-9 | empty `conditions` → `{}` → no-narrowing (valid, not rejected) | — | N/A | unit | `...::test_empty_filter_no_narrowing -x` | ❌ W0 | ⬜ pending |
| D-113-6 / Pitfall 5 | unknown op (`gte`/`or`) rejected at parse/compile (fails closed) | T-unknown-op | unknown op never eval'd; 422 | unit | `...::test_unknown_op_rejected -x` | ❌ W0 | ⬜ pending |
| D-113-10 | unknown field rejected at SAVE (422); valid-then-deleted matches 0 at resolve (non-fatal) | T-field-injection | reject-at-save; resolve-tolerant | unit | `...::test_unknown_field_rejected_at_save -x` | ❌ W0 | ⬜ pending |
| D-113-8 / Pitfall 3 | `_`-prefixed field (`_confidence`/`_source`) excluded/rejected | T-field-injection | display-only keys never a filter dimension (D-111-9) | unit | `...::test_underscore_field_excluded -x` | ❌ W0 | ⬜ pending |
| **SC#4** | **injection/SSTI in a value neutralized (bound literal, no exec)** | T-sqli / T-ssti | value param-bound; table intact, 0 matches | unit + integration | `...::test_injection_value_neutralized -x` + resolve integration (0 matches, table intact) | ❌ W0 | ⬜ pending |
| SC#1 / VIEW-01/02 | view persists + resolves the right docs; one doc in multiple views (query-not-copy) | — | N/A | integration (live :54322) | `pytest tests/integration/test_113_view_resolve.py -x` | ❌ W0 | ⬜ pending |
| SC#1 / D-113-1 | complete listing, newest-first (`created_at desc`) + total count | — | N/A | integration | `tests/integration/test_113_view_resolve.py::test_order_and_count -x` | ❌ W0 | ⬜ pending |
| VIEW-05 / D-113-5 | folder-subtree narrowing; unreachable scope → no narrowing (not error/empty) | — | N/A | integration | `pytest tests/integration/test_113_view_folder_scope.py -x` | ❌ W0 | ⬜ pending |
| D-113-12 / DMF-01 | `view.create` audit row written on create (LIVE, not mocked) | T-audit | audit row present | integration | `tests/integration/test_113_view_crud.py::test_create_writes_audit -x` | ❌ W0 | ⬜ pending |
| D-113-12 | 404-not-403 on a cross-user/unseeable view id (no existence leak) | T-enum | generic 404 | integration | `tests/integration/test_113_view_crud.py::test_cross_user_miss_404 -x` | ❌ W0 | ⬜ pending |
| **SC#3 / VIEW-06** | **two users, same global view → DIFFERENT result sets; no content/count/existence leak; 404-not-403** | T-leak | per-viewer resolution; caller-scope never owner-scope | **secure-phase / manual live** | live two-user leak test against :54322 (see Manual-Only) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_113_view_filter_compiler.py` — SC#2/SC#4 + all compiler edges (registry analog: `tests/unit/test_validator_kinds.py`)
- [ ] `tests/integration/test_113_view_crud.py` — live CRUD + `view.create` audit row + 404-not-403 (analogs: `tests/integration/test_111_metadata_fields_crud.py`, `test_111_audit_field_create.py`)
- [ ] `tests/integration/test_113_view_resolve.py` — live resolve correctness + newest-first + count + query-not-copy (analog: `test_111_flat_filter_compat.py`)
- [ ] `tests/integration/test_113_view_folder_scope.py` — live folder-subtree narrowing
- [ ] Secure-phase: the two-user cross-user leak test (authored here, run in secure-phase)
- [ ] Framework install: **none** — pytest infra exists and is in active use

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-user global-view leak test | SC#3 / VIEW-06 | An RLS policy label is NOT proof (D-102 / D-110-5 "static would false-green" lesson); requires two real callers against live :54322 | Seed a `document_views` row with `is_global=true` (service-role) carrying a filter (e.g. `document_type=invoice`). Give User A and User B each some matching + non-matching docs. Both call `GET /document-views/{seeded_id}/resolve`. Assert: (a) A sees ONLY A's matches, B sees ONLY B's; (b) result sets AND `total` count DIFFER; (c) neither sees the other's ids/filenames/metadata; (d) a zero-match user gets empty list + `total=0`, never an error or another user's data; (e) `GET /document-views/{nonexistent_or_unseeable_id}/resolve` → 404 (not 403). Drive with two real JWTs (or two service-role-scoped caller ids), NOT a mock. |

> **SC#10 4-axis cross-provider UAT does NOT apply** (D-113-14) — Phase 113 touches no streaming / agent-loop / provider-routing / UI-state surface. The agent-tool cross-provider UAT is Phase 115's gate.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
