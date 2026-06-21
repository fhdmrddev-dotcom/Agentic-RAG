---
phase: 119-document-governance-health
plan: 01
subsystem: api
tags: [fastapi, supabase, governance, document-management, leak-safety, postgrest, pagination]

# Dependency graph
requires:
  - phase: 116-document-relationships
    provides: "_resolve_readable_latest + _uid (the leak-safe shared resolver imported here, one-core-no-fork)"
  - phase: 117-document-relationships-panel-ui
    provides: "test_117_route_leak.py — the two-user live leak harness cloned for test_119_leak.py"
  - phase: 118-auto-classification
    provides: "metadata._classification suggestion shape (status==suggested read-side signal)"
  - phase: 111-metadata-enrichment-extraction-backend
    provides: "metadata._confidence per-field score map"
  - phase: 049-knowledge-health
    provides: "knowledge_health.py — the router-clone target (_pagination_params, _fetch_* shape, 502 wrap)"
provides:
  - "GET /document-governance/broken-relationships — caller's own edges whose far endpoint has no current readable latest (D-119-3)"
  - "GET /document-governance/unclassified — caller's latest docs with metadata._classification.status == suggested (D-119-4)"
  - "GET /document-governance/low-confidence — caller's latest docs with any _confidence[field] < 0.5 (D-119-5)"
  - "document_governance router mounted in main.py; read-only, owner-scoped, no write path"
affects: [119-02-governance-frontend, document-governance-verify-phase, document-governance-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only governance aggregation router cloned from knowledge_health.py (3 paginated signal routes, no /summary)"
    - "Masking-vs-deletion distinction: broken = no is_latest row anywhere (deletion); alive-but-unreadable = masked, NOT broken (D-119-3)"
    - "Cross-lineage EXISTENCE probe (count-only, no content) to tell deletion from masking without a cross-user content leak"
    - "Owner-scoping .eq(user_id,_uid(caller)) as the sole gate under the service-role client; sync fetches via run_in_threadpool (D-v2.5-01)"

key-files:
  created:
    - "backend/app/api/document_governance.py — 3 read-only signal routes + _fetch_* + _latest_exists_anywhere"
    - "backend/tests/integration/test_119_leak.py — two-user live leak harness (non-vacuous, per-signal positives + masked-not-broken twin)"
    - "backend/tests/integration/test_119_broken.py — A1 CASCADE pin + orphaned-old-version broken + masked-not-broken"
    - "backend/tests/integration/test_119_unclassified.py — A3 PostgREST jsonb-path live-pin (status==suggested)"
    - "backend/tests/integration/test_119_low_conf.py — any-field-<0.5 + 0.0-counts live"
    - "backend/tests/unit/test_119_low_conf_scan.py — Python-scan edge guards (0.0/missing/non-numeric/bool)"
    - "backend/tests/test_119_governance.py — empty-shape MagicMock unit tests"
  modified:
    - "backend/app/main.py — import + include_router(document_governance.router)"

key-decisions:
  - "A1 LIVE FINDING: document_relationships.{source,target}_doc_id are ON DELETE CASCADE — a fully-deleted endpoint takes its edge with it, so the ONLY dangling state is an edge keyed on an orphaned OLD version (no current is_latest row). Broken predicate anchors on _latest_exists_anywhere, not the resolver's None (which degrades to a stale old row)."
  - "A3 PINNED LIVE: the PostgREST deep-jsonb path for the _-leading key is the DOTTED form metadata->_classification->>status; the quoted-arrow form returns nothing."
  - "Masking != deletion (D-119-3): a target whose latest is alive-but-unreadable to the caller (another user's private doc) is masked, NOT broken — never reported, to avoid re-introducing a cross-user existence signal Phase 117 suppresses."
  - "DMF-03 non-gate: router NOT gated behind document_management_enabled (matches 111-118; flag dormant at every DM surface, A8)."
  - "Low-conf cutoff is the single ConfidenceChip TIER.MED 0.5 constant; 0.0 is a legitimate low value; bool/None/non-numeric guarded."

patterns-established:
  - "Existence-probe-vs-readability: distinguish deletion (no is_latest anywhere) from masking (alive-but-unreadable) using a count-only cross-lineage probe that never surfaces foreign content."
  - "Wave-0 RED-tolerant scaffolds: unit/MagicMock files skip cleanly pre-router; live integration files RED (404) pre-router, GREEN post-router."

requirements-completed: [DGOV-01]

# Metrics
duration: 11min
completed: 2026-06-21
---

# Phase 119 Plan 01: Document Governance Health (Backend) Summary

**Read-only `document_governance` router with three owner-scoped paginated signal routes — broken-relationships (deletion-vs-masking-aware), unclassified (`_classification.status == suggested`), and low-confidence (`_confidence[field] < 0.5`) — over the already-shipped DM tables, with the app-code `.eq("user_id", _uid(caller))` as the sole gate and zero migration / write path / new package.**

## Performance

- **Duration:** ~11 min (first task commit 18:24:48 → router commit 18:36:00, +04:00)
- **Started:** 2026-06-21T18:24:48+04:00 (Task 1 commit)
- **Completed:** 2026-06-21T18:36:00+04:00 (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments
- Shipped `document_governance.py` — three read-only paginated routes mounted in `main.py`, cloning the `knowledge_health.py` shape (no deprecated `/summary`); the counter header derives its 3 counts from each list's `total`.
- The broken-relationship signal correctly distinguishes a fully-deleted target (broken) from a present-but-unreadable target (masked, NOT broken) — proven non-vacuous live two-user.
- Pinned two open questions LIVE against :54322: A1 (FK `ON DELETE CASCADE` semantics → orphaned-old-version is the real broken state) and A3 (the dotted PostgREST jsonb-path form).
- All 6 Wave-0 test files GREEN live (21 passed): the two-user leak proof is non-vacuous (seeded true positives per signal per user), masked-not-broken holds for both viewers, and the low-conf scan guards (`0.0`/missing/`bool`/non-numeric) hold in unit + live.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 test scaffolds (6 files)** — `70359c81` (test)
2. **Task 2: document_governance.py router + main.py mount (+ A1/A3-driven fixture corrections)** — `b4dba936` (feat)

## Files Created/Modified
- `backend/app/api/document_governance.py` (354 lines) — `router` (prefix `/document-governance`), `_pagination_params`, `_fetch_broken_relationships` (async; `_resolve_readable_latest` + `_latest_exists_anywhere`), `_fetch_unclassified` (sync; dotted jsonb-path `.eq`), `_fetch_low_confidence` (sync; Python scan, `LOW_CONF_CUTOFF = 0.5`), 3 `@router.get` handlers (502-wrap, `run_in_threadpool` for the 2 sync fetches).
- `backend/app/main.py` — added `document_governance` to the `from app.api import ...` line + `app.include_router(document_governance.router)`.
- `backend/tests/integration/test_119_leak.py` — two-user live leak harness; non-vacuous (broken / suggested / low-conf positive per user) + masked-not-broken twin.
- `backend/tests/integration/test_119_broken.py` — A1 CASCADE pin (full delete → edge cascades away) + orphaned-old-version broken + resolvable-not-broken + masked-not-broken.
- `backend/tests/integration/test_119_unclassified.py` — A3 dotted jsonb-path live-pin; accepted/dismissed excluded.
- `backend/tests/integration/test_119_low_conf.py` — any-field-<0.5 surfaces; all-≥0.5 doesn't; 0.0 live.
- `backend/tests/unit/test_119_low_conf_scan.py` — MagicMock unit guards.
- `backend/tests/test_119_governance.py` — empty-shape MagicMock unit tests.

## Decisions Made
- **Broken predicate anchors on existence, not the resolver's None.** `_resolve_readable_latest` returns the caller's latest accessible version BUT gracefully degrades to a stale old row when no current latest exists, so its `None` is not a reliable broken oracle for an owner's own orphaned old version. The broken predicate (`_is_broken`) therefore anchors on `_latest_exists_anywhere` (no `is_latest=True` row for the lineage) — that is the true deletion signal, and a target whose latest is alive-but-unreadable returns True there (→ masked, not broken).
- **A8 / DMF-03 non-gate confirmed** against 111-118 wiring — the router is not gated behind `document_management_enabled` (documented in a module comment, never an actual gate call).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broken-signal definition reworked after the A1 live FK finding**
- **Found during:** Task 2 (router build; the `test_masked_not_broken` and leak-non-vacuity tests failed on the first router cut).
- **Issue:** The plan's broken predicate ("`_resolve_readable_latest` yields None for the target") is insufficient on the LIVE schema. Two live findings forced the correction: (a) `document_relationships.{source,target}_doc_id` are `ON DELETE CASCADE`, so a fully-deleted target takes its edge with it — there is no dangling edge from a clean hard-delete (the plan's leak/broken fixtures seeded exactly that, which produced ZERO broken edges and failed non-vacuity); (b) the caller-scoped resolver returns `None` for BOTH "deleted" and "alive-but-unreadable-to-caller" (masking), so using its `None` alone reported a masked-but-present target as broken — violating D-119-3.
- **Fix:** Added `_latest_exists_anywhere` (a count-only, content-free cross-lineage existence probe) and reworked `_is_broken` to flag broken iff NO `is_latest=True` row exists for the endpoint's lineage anywhere (deletion), so an alive-but-unreadable latest is masked, not broken. Corrected the two test fixtures to seed the REAL dangling state the schema permits: an edge keyed on an orphaned OLD version (v1 `is_latest=False`) whose current latest (v2) was deleted.
- **Files modified:** `backend/app/api/document_governance.py`, `backend/tests/integration/test_119_leak.py`, `backend/tests/integration/test_119_broken.py`.
- **Verification:** All 6 Wave-0 files GREEN live on :54322 (21 passed); `test_masked_not_broken` + the masked twin in the leak suite GREEN; `test_a1_orphaned_old_version_edge_surfaces_as_broken` GREEN; non-vacuity (each user sees its own broken edge) GREEN.
- **Committed in:** `b4dba936` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 bug — a correctness/leak-safety correction driven by two live-DB findings).
**Impact on plan:** The correction is essential — the plan's stated broken predicate would have (a) never populated the broken card under the live CASCADE and (b) leaked a cross-user existence signal by reporting masked targets as broken. The signal definitions (broken / unclassified / low-conf), routes, owner-scoping, threadpool, and no-write-path scope are all exactly as specified. No scope creep.

## Issues Encountered
- The full system Python lacks `asyncpg`; it lives only in `backend/venv`. All pytest + DB probes were run after `source venv/Scripts/activate` per the CLAUDE.md venv rule.

## Net-new failures = 0 (base-checkout)
The only changed source files vs base are `document_governance.py` (brand-new module — no existing module imports it) and `main.py` (additive import + one `include_router` line). The `main.py`-importing test cluster (`tests/unit/test_lifespan.py`) shows IDENTICAL results with vs without the mount: 3 failed / 1 passed both ways (the same pre-existing `test_pg_pool_close_timeout_falls_back_to_terminate` / `test_supabase_aclose_after_pg_pool` rot documented in 110/111-03/116/117). No new failure is introduced by this plan.

## Threat surface scan
No NEW security surface beyond the plan's `<threat_model>`. The one structural addition — the `_latest_exists_anywhere` existence probe — is content-free (returns only a count / lineage key, never a foreign doc's id/filename/metadata to the caller) and exists precisely to honor D-119-3 (suppress the cross-user existence signal). It is covered by the declared T-119-01-01/02 disposition and proven non-vacuous by `test_119_leak.py`.

## Known Stubs
None — no stub patterns (TODO/FIXME/placeholder/NotImplementedError) in the shipped router.

## Next Phase Readiness
- The three governance routes are live + mounted, returning the `{items, total, offset, limit}` shape Plan 02's `PaginationControls` consumes. The unclassified row carries `suggested_folder_name`; the low-conf row carries `low_fields` + `min_confidence`; the broken row carries `readable_doc_id`/`document_id` (the openable link-out end) + `relationship_id` + `rel_type` + `broken_doc_id`.
- Plan 02 (frontend GovernancePage + GovernanceRow + the D-119-2 nav triad) can build directly against these contracts.
- No migration, no new package, no new write path; `threads.py` byte-untouched (G-5).

## Self-Check: PASSED

- All 7 created files present + the SUMMARY (`[ -f ]` FOUND for each).
- Both task commits present in `git log` (`70359c81`, `b4dba936`).
- `main.py` contains `document_governance.router` mount.

---
*Phase: 119-document-governance-health*
*Completed: 2026-06-21*
