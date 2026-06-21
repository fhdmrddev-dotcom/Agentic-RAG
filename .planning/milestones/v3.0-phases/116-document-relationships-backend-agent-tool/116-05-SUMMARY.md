---
phase: 116-document-relationships-backend-agent-tool
plan: 05
subsystem: backend / document-relationships
gap_closure: true
tags: [REL-01, REL-04, leak-safety, follow-to-latest, gap-closure, cross-provider-safe]
requires:
  - "116-01 (the resolver + service substrate)"
  - "116-03 (the get_related_documents handler + dual-wiring)"
provides:
  - "CR-01 fix: _resolve_readable_latest is now own-latest ∪ global-latest (is_latest-gated global-by-id leg + post-follow visibility re-check) — no cross-user laundering of a private latest via an old-global id"
  - "CR-02 fix: get_related_documents enumerates edges over the subject's full (user_id, filename) version-id set via .in_() — a re-upload no longer orphans a link"
  - "_subject_version_ids helper (reusable lineage version-set lookup)"
  - "Two NON-VACUOUS live regression tests (RED at base, GREEN after fix) closing the IN-03 'static would false-green' gap"
affects:
  - backend/app/services/document_relationship_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/api/document_relationships.py
tech-stack:
  added: []
  patterns:
    - "own-latest ∪ global-latest mirror of list_documents (documents.py:540-561) — the canonical access model"
    - "read-side version-set edge enumeration over (user_id, filename) lineage via .in_() (no migration, no write-side re-point)"
    - "_uid() UUID-coercion guard uniform on every service-role owner-scoping predicate (WR-02)"
key-files:
  created: []
  modified:
    - backend/app/services/document_relationship_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/api/document_relationships.py
    - backend/tests/integration/test_116_tool_leak.py
    - backend/tests/integration/test_116_version_stable.py
    - backend/tests/unit/test_116_handler.py
decisions:
  - "CR-01 fixed read-side per D-116-1a mechanism (a): is_latest-gate the global-by-id leg + re-verify a global-leg match's followed-to-latest folder is STILL global-visible (else None). Own leg unchanged (caller owns its follow-to-latest target across versions)."
  - "CR-02 fixed read-side (no migration): _subject_version_ids enumerates the subject's full (user_id, filename) lineage; the handler queries edges via .in_(version_ids) scoped strictly to the subject (no cross-document widening)."
  - "WR-01 left untouched — verified non-defect (the 23505 sniff)."
metrics:
  duration: ~12 min
  tasks: 4
  commits: 4
  files_changed: 6
  completed: 2026-06-20
---

# Phase 116 Plan 05: Document Relationships Gap Closure (CR-01 leak-safety + CR-02 follow-to-latest) Summary

Closed the two confirmed BLOCKERs from `116-VERIFICATION.md` (4/6 → 6/6 must-haves) — both read-side defects, no migration: the resolver's global-by-id leg now refuses to launder a private latest version across users (CR-01 / SC#2 / REL-04 leak-safety), and `get_related_documents` enumerates edges over the subject's full version-id set so a re-upload no longer orphans a link (CR-02 / SC#1 / REL-01 LOCKED D-116-1 follow-to-latest). Both fixes are proven by NON-VACUOUS live regression tests that FAIL against the pre-fix code and PASS after.

## What Was Built

### CR-01 — leak-safe resolver (`document_relationship_service.py`)
- **Global-by-id leg now `is_latest`-gated** (`.eq("is_latest", True)`): an OLD version sitting in a global folder is no longer independently readable, mirroring `_latest_by_filename:102` and `list_documents:558`. (Folds IN-01 — the symmetric `is_latest` gate.)
- **Post-follow visibility re-check (Step 2b):** the match now tracks a `from_global` flag; after following forward to the latest `(user_id, filename, is_latest=True)` row, a GLOBAL-leg match's resolved latest is re-verified to still sit in the caller's `global_folder_ids` set — if it moved into a private folder, the resolver returns `None`. The OWN leg is unchanged (the caller owns its follow-to-latest target across versions).
- Docstring states the invariant: **readable = own-latest ∪ global-latest; a global-leg match never launders an old version into a private latest.**

### CR-02 — version-stable edge enumeration (`tool_dispatcher.py` + service helper)
- New `_subject_version_ids(subject_row)` returns ALL `documents.id` sharing the subject's `(user_id, filename)` lineage (every version, latest or not), via `aexec`; falls back to `[subject["id"]]` so the `.in_()` is never empty. Scoped strictly to the subject's own lineage (no cross-document widening).
- `_handle_get_related_documents` widens the two edge queries from `.eq("source_doc_id"|"target_doc_id", subject_id)` to `.in_(..., version_ids)`. An edge created against an OLD version id now survives a re-upload to the new latest. The per-OTHER-endpoint readability mask is unchanged — CR-01's resolver fix hardens the resolver the mask trusts.

### Nit fold-ins
- **WR-02** (`document_relationship_service.py`): `_uid()` (not bare `str()`) on the `create_relationship` insert payload `user_id` and the `delete_relationship` `.eq("user_id", ...)` — uniform owner-scoping on the service-role gate (free malformed-uuid `ValueError` guard).
- **WR-03** (`document_relationships.py`): reworded the two in-band audit comments — they are BLOCKING (error-swallowing) audit writes on the response path, NOT fire-and-forget. No restructure (inherited `document_views.py` pattern).
- **WR-04** (`document_relationships.py`): tightened the self-link ordering comments — both branches return the identical status+detail (no response ordering oracle); step 2 is the SOLE rejector for a readable self-link (NOT dead code).
- **WR-01** explicitly NOT worked (verified non-defect — the `"23505" in str(exc)` sniff).

## NON-VACUOUS Regression Proof (the IN-03 gap closed)

Both new tests were run BEFORE the fixes (RED at base) and AFTER (GREEN), against live local Supabase (`:54322`). Each carries a non-vacuity guard.

| Test | File | RED at base (pre-fix) | GREEN after fix |
|------|------|----------------------|-----------------|
| `test_global_old_version_does_not_leak_private_latest` (CR-01) | `test_116_tool_leak.py` | **FAILED** — resolver returned v2's PRIVATE row (`id`/`filename`/`metadata title="A-versioned-PRIVATE-v2"`) to non-owner B (HTTP trace confirmed the global-by-id leg matched old v1, then follow-to-latest returned private v2 with no folder re-check) | **PASSED** — B gets `None`; non-vacuity: owner A follows v1 → A's own latest v2 |
| `test_edge_survives_reupload_in_handler` (CR-02) | `test_116_version_stable.py` | **FAILED** — after re-upload the handler queried edges only by v2's id; `total == 0`, the v1-keyed edge orphaned (non-vacuity guard on the v1-subject PRE-re-upload call PASSED, so the failure was genuinely the survival assertion) | **PASSED** — the edge surfaces under the v2 subject (`total >= 1`, target id present) |

**Captured RED evidence (Task 1, pre-fix):**
- CR-01: `AssertionError: CR-01 LEAK: ... must return None for B, but returned {'id': '3f6383fa...', 'metadata': {'title': 'A-versioned-PRIVATE-v2'}, 'folder_id': None, 'is_latest': True}`
- CR-02: `AssertionError` on the post-re-upload `total >= 1` — payload was `{'documents': [], 'total': 0, 'note': "No relationships found ..."}`; the HTTP trace showed the second edge query keyed on v2's id (`source_doc_id=eq.c900dc0a...`) returning empty.

## Verification

- **Full Phase-116 test surface: 35 passed / 0 failed live on `:54322`** (`test_116_audit_live`, `_idempotency`, `_relationship_crud`, `_tool_leak`, `_tool_read`, `_version_stable` integration + `_handler`, `_tool_schema`, `_tool_wiring`, `_whitelist_guard` unit).
- The plan's named verify command (`test_116_tool_leak + _version_stable + _relationship_crud + _idempotency + unit/_tool_schema + unit/_handler`): **25 passed**.
- CR-01 fix: tool-leak masking tests (the 2 existing per-viewer rows) + the new CR-01 test all GREEN.
- CR-02 fix: the existing own-leg follow-to-latest version-stable rows (`_after_reupload`, `_after_restore`) + the new CR-02 handler test all GREEN.
- WR-02 write-path change: CRUD + idempotency rows GREEN (the 23505 re-fetch still returns the existing edge; create/delete still own-scoped).
- **`threads.py` byte-untouched** (G-5 — `git diff c6dffa06 HEAD -- backend/app/api/threads.py` = 0 lines). Shared SSE/agent-loop path unchanged.
- **Cross-provider safety:** no tool-schema change (the Gemini-safe `GET_RELATED_DOCUMENTS_TOOL` from Plan 03 is untouched — no anyOf/oneOf, no multi-type `type` arrays). The handler dispatch path adds one in-process `documents` lineage lookup; the handler still never raises into the agent loop. No per-provider branch.
- **No new migration, no new package install** (read-side fixes + tests reuse asyncpg/supabase/pytest already in the venv).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CR-02 source change broke two handler UNIT tests; fixed the stub in the same plan**
- **Found during:** Task 4 (full-suite regression gate)
- **Issue:** `_handle_get_related_documents` now calls `_subject_version_ids(subject, supabase=ctx.supabase)`, which queries `table("documents")`. The `test_116_handler.py` tier-2 stub `_EdgeClient.table()` asserted `name == "document_relationships"` and `_EdgeQuery` recorded direction off `.eq("source_doc_id"|...)` — both broke under the CR-02 widening (the new `documents` lineage query + the `.eq → .in_` change). `test_handler_returns_both_directions_with_inverse_labels` and `test_handler_masked_row_never_leaks_filename` failed.
- **Fix:** `_EdgeQuery` now records direction off `.in_(...)`; `_EdgeClient.table("documents")` routes the lineage lookup to a new `_DocVersionQuery` stub (single-version subject → `[subject.id]` fallback). Assertions unchanged — they pass on the same behavioral expectations. This is a test-stub alignment to the new (correct) query shape, NOT a weakened test.
- **Files modified:** `backend/tests/unit/test_116_handler.py`
- **Commit:** `c43405b8`
- **Note:** `test_116_handler.py` was not in the plan's Task 4 `files` list (which named the four integration files for read-only verification); the unit-stub fix was required because the CR-02 source change directly broke it (scope boundary respected — only this plan's own change is fixed).

### Out-of-scope discoveries (logged, NOT fixed)
- Pre-existing untracked / deleted working-tree artifacts unrelated to this plan (`backend/README.md` deletion, `RUN-BACKEND.md`, `scripts/115_*.json`, `settings_override.json.migrated`) — appended to `116-document-relationships-backend-agent-tool/deferred-items.md`. Left untouched per SCOPE BOUNDARY; staging was always scoped to named paths (never `git add -A`).

## Commits

- `1df5239c` — `test(116-05)`: add non-vacuous CR-01 leak + CR-02 orphan regression tests (RED)
- `36e4f2b9` — `fix(116-05)`: CR-01 — is_latest-gate the global-by-id leg + post-follow visibility re-check
- `db412c59` — `fix(116-05)`: CR-02 — enumerate edges over subject's full version set; WR-02/03/04 fold-ins
- `c43405b8` — `test(116-05)`: align handler unit stub to the CR-02 .in_() version-set query

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`), with per-task `tdd="true"`. The RED/GREEN gates were honored:
- **RED (Task 1):** `test(116-05)` commit `1df5239c` — both regression tests authored and confirmed FAILING against the pre-fix code (live `:54322`).
- **GREEN (Tasks 2-3):** `fix(116-05)` commits `36e4f2b9` (CR-01) and `db412c59` (CR-02) — the tests flip to PASSING.
- No REFACTOR commit needed.

## SC Closure

- **SC#1b (version-stable links — REL-01 / LOCKED D-116-1):** observably TRUE — `test_edge_survives_reupload_in_handler` shows the edge surviving a re-upload in `get_related_documents`.
- **SC#2b (leak-safe masking — REL-04):** observably TRUE — `test_global_old_version_does_not_leak_private_latest` shows the resolver returning `None` across the global→private follow-to-latest boundary, so the D-116-9 mask fires.

## Self-Check: PASSED

- Files: all 6 created/modified files FOUND on disk.
- Commits: all 4 (`1df5239c`, `36e4f2b9`, `db412c59`, `c43405b8`) FOUND in git.
- Contract symbols: `_subject_version_ids` (service), `is_latest` (leak test), `get_related_documents` (vstable test), `.in_(` (tool_dispatcher) all present.
