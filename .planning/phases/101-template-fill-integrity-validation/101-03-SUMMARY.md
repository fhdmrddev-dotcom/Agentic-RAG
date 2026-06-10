---
phase: 101-template-fill-integrity-validation
plan: 03
subsystem: api
tags: [template-fill, provenance, storage, workspace-files, run_in_threadpool, ephemeral-template, asset-resolution]

# Dependency graph
requires:
  - phase: 101-01
    provides: "seeded library-asset fixture (published WorkflowDefinition 00000000-0000-0000-0000-0000000101a0 + workspace-files Storage object) + uat_fixture_ids.json"
  - phase: 100
    provides: "kind='template_input' ephemeral upload rows on workspace_files + expires_at gate (migration 068)"
  - phase: 084
    provides: "workspace_service._read_from_storage / _get_file_content (inline-or-Storage byte fetch, run_in_threadpool-wrapped) + BUCKET_NAME"
provides:
  - "template_asset_service.resolve_template_source — template byte resolution by provenance (library AssetRef -> Storage; kind='template_input' -> workspace), returns bytes + filename + provenance + mime + error"
  - "the seam Plan 04's render tool calls BEFORE shipping template bytes into the sandbox"
  - "harness.py assets[] co-lock comment pointer updated intent -> implemented (D-09)"
affects: [101-04, 102, template-fill, render-tool, _handle_render_template]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin async-service shape mirroring template_service.py (all logic in the service; the Plan-04 tool handler gains only a delegating call)"
    - "Provenance-keyed branch selection by SOURCE not content (D-02): asset_ref present -> library; asset_ref None -> ephemeral"
    - "Complete result envelope (always all 5 keys) via _result(**overrides) helper — callers never destructure a partial dict"
    - "Reuse-don't-hand-roll Storage I/O: _read_from_storage / _get_file_content (run_in_threadpool, D-v2.5-01)"

key-files:
  created:
    - backend/app/services/template_asset_service.py
  modified:
    - backend/app/models/harness.py

key-decisions:
  - "User-scope the ephemeral query on workspace_files.created_by (the actual owner column write_file sets) — the schema has no user_id column; ownership is created_by + the thread RLS join"
  - "Derive the display filename from workspace_files.path (no dedicated filename column) — strip leading slash + directory segments"
  - "Two-query expired-vs-never-uploaded distinction: gated SELECT first; on no row, a second non-gated SELECT (still user-scoped) tells 'expired' (D-10) from 'no template' (D-05)"
  - "Do NOT import template_render_service (no circular import; Plan 04 composes the resolver + select_engine)"

patterns-established:
  - "Provenance routing seam: resolve bytes + a provenance tag here; the render engine is selected downstream by Plan 02's select_engine (library->docxtpl, template_input->run_replace)"
  - "Clean relay-able error strings on every failure path (download-fail / no-row / expired / cross-user) — never a raw 404, never another user's bytes (V4 / 404-not-403)"

requirements-completed: []  # plan frontmatter declares TMPL-02, but TMPL-02 is a multi-plan requirement (core 02 + resolver 03 + render tool 04 + phase admission 05). This plan delivers only the asset-resolution seam; TMPL-02 marks complete at phase verification (the 099/WFSKILL-01 convention). Stays Pending in REQUIREMENTS.md.

# Metrics
duration: 16min
completed: 2026-06-11
---

# Phase 101 Plan 03: Template Asset Resolution (Provenance-Keyed Byte Resolution) Summary

**`resolve_template_source` — fetches template bytes by provenance (library AssetRef → Storage via run_in_threadpool; ephemeral `kind='template_input'` → newest-wins, expiry-gated workspace read), returns bytes + provenance + clean relay-able errors, never raw 404s, never cross-user bytes — plus the harness.py assets[] co-lock comment flipped intent → implemented.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-10T21:35:56Z
- **Completed:** 2026-06-10T21:52:16Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 comment-only edit)

## Accomplishments
- New `backend/app/services/template_asset_service.py` with `resolve_template_source` — the byte-resolution seam the Plan-04 fill tool calls before shipping template bytes into the sandbox.
- **Library branch (trusted → docxtpl):** when an `AssetRef` is passed, downloads `asset_ref.asset_id` (a `workspace-files` Storage path) via the reused `_read_from_storage` (run_in_threadpool-wrapped, D-v2.5-01); returns `provenance="library"`. Download failure → clean relay-able error, never a raw 404.
- **Ephemeral branch (untrusted → run_replace):** when no `AssetRef`, resolves the newest non-expired `kind='template_input'` `workspace_files` row for this thread+user (user-scoped on `created_by`, expiry-gated `expires_at IS NULL OR > now()`), reads its bytes via `_get_file_content`; returns `provenance="template_input"`. Distinguishes "expired" (D-10) from "never uploaded" (D-05) via a second non-gated user-scoped SELECT.
- Every failure path returns `bytes=None` + an `error` STRING (no raise, no traceback, no cross-user bytes) — the V4 / 404-not-403 contract.
- `harness.py` assets[] co-lock comment pointer updated from "in Phase 101" → "implemented in Phase 101 (template_asset_service)" on both the comment block and the field comment. Zero schema change, zero migration, no field added/renamed.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolve_template_source — provenance-keyed template byte resolution** - `60e0da5d` (feat)
2. **Task 2: harness.py assets[] co-lock comment pointer (intent → implemented, D-09)** - `18d70589` (docs)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `backend/app/services/template_asset_service.py` - **created.** `resolve_template_source(*, pool, supabase, thread_id, user_id, asset_ref=None) -> dict`. Library branch (Storage download, run_in_threadpool) + ephemeral branch (newest-wins `template_input`, user-scoped on `created_by`, expiry-gated). Returns `{bytes, filename, provenance, mime, error}`. Reuses `_read_from_storage` / `_get_file_content` / `BUCKET_NAME` from `workspace_service`; no `template_render_service` import (no cycle); no `app.api.threads` import (G-5).
- `backend/app/models/harness.py` - **comment-only edit.** Co-lock comment block (~line 154) + the `assets:` field comment (~line 189) now point at the implemented Phase-101 behavior. AssetRef/assets[] shapes unchanged (locked in Phase 098).

## Decisions Made
- **User-scope the ephemeral query on `workspace_files.created_by`** — the plan prose said "filter by `user_id`", but the actual `054_workspace_files.sql` schema has no `user_id` column; the owner column is `created_by` (set to `user_id` by `write_file`, confirmed at `db/workspace.py:18` + `workspace_service.py:256`). A cross-user thread yields no matching row → the clean "no template" error, never another user's bytes. (This is a faithful implementation of the plan's stated security intent, not a deviation — the column name was the only adjustment.)
- **Derive the display filename from `path`** — `workspace_files` has no dedicated `filename` column; `path` (e.g. `/template.docx`) carries it. `_filename_from_path` strips the leading slash + directory segments.
- **Two-query expired-vs-never-uploaded distinction** — the gated SELECT (`expires_at IS NULL OR > now()`) returns the live row; on `None`, a second non-gated (still user-scoped) SELECT tells "expired" (a row exists but is gated out → D-10 "This template has expired") from "no template" (truly no row → D-05 "No template uploaded…"). The second query stays user-scoped so a cross-user thread never produces an "expired" leak either.
- **Did NOT import `template_render_service`** — Plan 04 composes the resolver's `provenance` with Plan 02's `select_engine`; importing it here would create a needless coupling/cycle.

## Deviations from Plan

None - plan executed exactly as written.

The only implementation adjustment was the ownership column (`created_by` vs the plan-prose `user_id`), which is the faithful realization of the plan's explicit user-scoping intent against the real `workspace_files` schema (the plan repeatedly states "user-scoped" / "cross-user → no row"). The two-query expired/no-template split is exactly what the plan's action 2 described ("a separate count to distinguish"). No new behavior, no scope creep, no schema/API surface added.

## Issues Encountered
None. All verify commands passed first try (Task 1 AST + import; Task 2 parse + import + comment presence; the plan-level combined import). The single harness-named full-suite failure (`test_bounded_retry_reaches_failed_after_3_attempts`) was proven pre-existing rot (see SEED-056 below).

## SEED-056 net-new-failure proof
Full backend suite: **115 failed / 1227 passed / 7 skipped / 3 xfailed** — exactly the documented rot baseline (matches Plan 101-02's recorded `115 failed / 1227 passed`). The one harness-named failure, `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (`KeyError: 'tool_call_id'` in `harness_engine.py:219`), was proven **pre-existing**: with my comment-only `harness.py` edit reverted to the parent commit (`b4773f03`), the test fails **identically** (1 failed, same error) — then `harness.py` was restored clean to my committed HEAD. The new `template_asset_service.py` is a brand-new file no pre-existing test imports; the `harness.py` edit changes no behavior. **Net-new failures = 0.**

## Threat coverage (STRIDE register T-101-03-01..04)
- **T-101-03-01 (EoP, ephemeral query):** every ephemeral SELECT filters on `created_by = $2` (RLS backstop) — cross-user → no row → clean "no template" error, never another user's bytes (V4 / 404-not-403). ✓
- **T-101-03-02 (Information disclosure, expired read):** read gate `(expires_at IS NULL OR expires_at > now())` (100 D-10) keeps an expired template unreadable; expired → relay-able "expired" error, never stale bytes. ✓
- **T-101-03-03 (Tampering/EoP, provenance → engine):** `template_input` always resolves `provenance="template_input"` → Plan-02 `select_engine` routes it to `run_replace` (never docxtpl/Jinja) — the SSTI structural boundary starts here. ✓
- **T-101-03-04 (DoS, blocking Storage call):** Storage download wrapped via `_read_from_storage` (run_in_threadpool) per D-v2.5-01 — never blocks the event loop. ✓

## User Setup Required
None - no external service configuration required for this plan. (Operator sandbox-image rebuild + `SANDBOX_IMAGE` bump remains a Plan 04+ live-UAT prerequisite, per Plan 01's STATE note — unchanged by this plan.)

## Next Phase Readiness
- The provenance-routing seam is complete: Plan 04's `_handle_render_template` can now call `resolve_template_source` to get `{bytes, provenance}`, then feed `provenance` to Plan 02's `select_engine` to pick docxtpl (library) vs run_replace (ephemeral), then ship the bytes into the sandbox.
- No blockers. The seeded library-asset fixture (Plan 01) lines up exactly with the library branch (`AssetRef.asset_id` = the `{user_id}/_library/...` Storage path the resolver downloads; IDs in `backend/tests/fixtures/uat_fixture_ids.json`).

## Self-Check: PASSED

- FOUND: `backend/app/services/template_asset_service.py`
- FOUND: `.planning/phases/101-template-fill-integrity-validation/101-03-SUMMARY.md`
- FOUND commit `60e0da5d` (Task 1)
- FOUND commit `18d70589` (Task 2)

---
*Phase: 101-template-fill-integrity-validation*
*Completed: 2026-06-11*
