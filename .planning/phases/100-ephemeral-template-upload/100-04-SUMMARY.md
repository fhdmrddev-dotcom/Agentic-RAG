---
phase: 100-ephemeral-template-upload
plan: 04
subsystem: api
tags: [fastapi, multipart, ooxml, zipfile, workspace-files, ephemeral-template, ttl, expires-at, rest-gate, supabase-py, rls, run-honesty]

# Dependency graph
requires:
  - phase: 100-01
    provides: "the TDD contract file test_workspace_template.py — this plan flips test_valid_ooxml_accepted / test_bad_file_rejected / test_oversized_rejected / test_expired_excluded_rest / test_cross_user_isolation from xfail to green, and the OOXML byte fixtures (valid_docx/pptx/xlsx + renamed_binary + oversized) in conftest the validation tests run against"
  - phase: 100-03
    provides: "workspace_service.write_file(..., kind, expires_at) signature + returned-dict echo this plan's upload handler calls; the migration-068 live columns workspace_files.kind / .expires_at the REST .or_ filter reads; the asyncpg gated-read precedent (the symmetric supabase-py half lands here)"
provides:
  - "POST /threads/{tid}/workspace/files — the first user-facing workspace WRITE endpoint: validate_ooxml magic-byte gate (D-12) + 10MB/empty 422 guards + write_file(kind='template_input', expires_at=now+TTL); 404 on non-owner via _verify_thread_ownership (SC#1 RLS half)"
  - "validate_ooxml(filename, raw) -> ext — stdlib OOXML magic-byte validator (ext allowlist + zipfile.is_zipfile + [Content_Types].xml + per-ext part marker); raises HTTPException(422), nothing persisted"
  - "4 REST GET routes gated on template expiry (.or_('expires_at.is.null,expires_at.gt.'+now)) — list / content / versions / diff; content-route SELECT gated BEFORE the signed URL is minted (Pitfall 2, signed-URL bypass closed)"
  - "template_ttl_hours: int = 24 on UserEffectiveSettings — read from app_settings.template_ttl_hours (migration 068), safe default 24 (D-05)"
  - "list + content selects surface kind + expires_at to the panel (D-02 badge data)"
affects: [100-05-sweep-pin, 100-06-frontend-badge, ephemeral-template-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stdlib OOXML magic-byte validation: ext allowlist + zipfile.is_zipfile (validates End-of-Central-Directory — catches renamed/truncated binaries a 4-byte sniff would pass) + [Content_Types].xml + per-ext part-name marker (word/ ppt/ xl/). No new dependency (D-12)."
    - "supabase-py PostgREST gated-no-op filter .or_('expires_at.is.null,expires_at.gt.'+_now_iso()) — a literal no-op for NULL-expiry agent rows (IS-NULL branch), hides only TTL-bound templates (098 D-05a / 099 D-04 pattern; symmetric to the 100-03 asyncpg > now() gate)"
    - "Pitfall-2 ordering: gate the content route's row SELECT BEFORE the signed URL is minted — an expired row reads as None -> 404 -> no URL ever generated (closes the storage bypass that a post-mint filter would leave open)"

key-files:
  created:
    - .planning/phases/100-ephemeral-template-upload/100-04-SUMMARY.md
  modified:
    - backend/app/api/workspace.py
    - backend/app/models/user_settings.py

key-decisions:
  - "Route handler named upload_template (not the plan-prose upload_workspace_template) to satisfy the binding Plan 100-01 TDD stub import (from app.api.workspace import upload_template); upload_workspace_template kept as a module-level alias for the must_haves export name — the same TDD-contract reconciliation precedent as 099 Plans 02/03/04"
  - "uuid-hex path prefix (/{uuid4().hex[:8]}-{safe_name}) prevents duplicate-filename collisions on the (thread_id, path) unique key; safe_name strips / and \\ so write_file.validate_path never rejects the generated path"
  - "result['kind'] / result['expires_at'] re-set after write_file even though write_file already echoes them (100-03) — harmless idempotent re-affirmation, matches the plan body; keeps the upload-handler contract self-evident without a re-read"
  - "FileTooLargeError except clause ordered before WorkspaceError (FileTooLargeError subclasses WorkspaceError) so the specific 422 message wins"

patterns-established:
  - "Two-half expiry contract complete: 100-03 gated the asyncpg tool-read seam (SC#3 consumer, Pitfall 1), 100-04 gates the 4 supabase-py REST seams (panel/UI consumer) + closes the signed-URL bypass — six read seams total, all gated on expires_at, all byte-identical for NULL-expiry agent files (D-11 red line)"

requirements-completed: [TMPL-01]  # the REST write+gate half of TMPL-01 lands here; the requirement marks complete at phase close (Plan 100-05 sweep/pin + 100-06 frontend still pending)

# Metrics
duration: ~4min
completed: 2026-06-10
---

# Phase 100 Plan 04: Ephemeral Template Upload — OOXML Upload Route + REST Expiry Gates Summary

**The net-new POST /threads/{tid}/workspace/files write endpoint — validate_ooxml magic-byte gate (D-12) + app_settings TTL read (D-05) + write_file(kind='template_input', expires_at=now+TTL) — plus the supabase-py half of the two-data-layer expiry split: all 4 REST GET routes gated on (expires_at IS NULL OR expires_at > now()), with the content route's row SELECT gated before any signed URL is minted (Pitfall 2 bypass closed).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-10T15:50:07+04:00 (first task commit)
- **Completed:** 2026-06-10T15:54:16+04:00 (last task commit)
- **Tasks:** 3 (all `auto`, `tdd="true"` — the Wave 0 RED stubs from Plan 100-01 are the pre-existing test gate)
- **Files modified:** 2 (122 insertions, 4 deletions)

## Accomplishments

- **template_ttl_hours settings field (Task 1, D-05):** Added `template_ttl_hours: int = 24` to `UserEffectiveSettings` (next to `llm_max_output_tokens`) and the `_build_settings_from_row` read `template_ttl_hours=int(_val(row, "template_ttl_hours", "template_ttl_hours", 24))`. Reads the migration-068 `app_settings.template_ttl_hours` column; a cold cache / absent / NULL value safely defaults to 24. `load_app_settings().template_ttl_hours` returns an int.
- **POST upload route + OOXML validation (Task 2, D-12/D-05):** `validate_ooxml(filename, raw)` — extension allowlist (`.docx/.pptx/.xlsx`) + `zipfile.is_zipfile` (validates the End-of-Central-Directory record, so a renamed `.exe`→`.docx` / truncated / non-ZIP PDF fails where a 4-byte sniff would pass) + `[Content_Types].xml` presence + per-ext part-name marker (`word/`/`ppt/`/`xl/`); raises `HTTPException(422)` on any failure, nothing persisted (T-100-04-01). The `@router.post("/files")` handler `upload_template`: `_verify_thread_ownership` (404-not-403 on non-owner, SC#1 RLS half / T-100-04-02), empty + 10MB 422 guards (T-100-04-04), `validate_ooxml`, TTL from `load_app_settings_async()` (D-05), then `write_file(..., kind="template_input", expires_at=now+TTL)`. A uuid-hex path prefix avoids `(thread_id, path)` unique-key collisions. No SSE emit (the handler has no run_id/ctx — the panel reconciles by upserting the returned row in Plan 100-06).
- **4 REST GET routes gated (Task 3, D-06):** Added `_now_iso()` + the `.or_("expires_at.is.null,expires_at.gt." + _now_iso())` filter to all four `workspace_files` SELECTs — `list_workspace_files`, `get_workspace_file_content`, `list_workspace_file_versions`, `get_workspace_file_diff`. The content-route SELECT is gated **before** the 60s signed URL is minted, so an expired template's row reads as None → 404 → no URL is ever generated (Pitfall 2 / T-100-04-03 — the signed-URL bypass is closed). The list + content selects also add `kind, expires_at` for the panel badge (D-02). A NULL-expiry agent row matches the IS-NULL branch → returned exactly as today (D-11 red line — byte-identical).

## Task Commits

Each task was committed atomically (worktree, `--no-verify` per parallel-executor protocol):

1. **Task 1: template_ttl_hours settings field (D-05)** — `75b5f0ae` (feat)
2. **Task 2: POST upload route + OOXML magic-byte validation (D-12)** — `e8f68485` (feat)
3. **Task 3: gate 4 REST GET routes on template expiry (D-06)** — `4b84fa51` (feat)

_Note: all three are `feat(...)` commits. The RED gate for this TDD plan is the pre-existing Wave 0 stub set (Plan 100-01's `test_workspace_template.py`); these three commits are the GREEN production code that flips this plan's 5 stubs from xfail to xpass (validate_ooxml accept/reject/oversize, expired-excluded-REST, cross-user-isolation) plus the kind/ttl upload contract._

## Files Created/Modified

- `backend/app/api/workspace.py` (modified, +120/−4) — imports (`io`, `zipfile`, `datetime`/`timedelta`/`timezone`, `UUID`/`uuid4`, `File`/`UploadFile`, `get_pg_pool`, `load_app_settings_async`, `write_file`/`WorkspaceError`/`FileTooLargeError`); `validate_ooxml` helper + `_ALLOWED_EXT`/`_OOXML_MARKER` constants; the `upload_template` POST route + `upload_workspace_template` alias; `_now_iso` helper; the `.or_` expiry gate on all 4 GET routes + `kind, expires_at` on the list/content selects.
- `backend/app/models/user_settings.py` (modified, +6) — `template_ttl_hours: int = 24` on `UserEffectiveSettings`; the `_build_settings_from_row` `_val` read with default 24.

## Verification Results

- **Full contract file** `pytest tests/test_workspace_template.py -q`: **1 passed, 2 xfailed, 9 xpassed** — no hard failures. The 2 remaining xfail (`test_sweep_deletes_rows_and_bytes`, `test_run_pin_extends_and_noop`) belong to the parallel Plan 100-05 executor (template_service.py) — correctly still RED here. Baseline (this plan's pre-state) was 1 passed / 6 xfailed / 5 xpassed → 4 stubs flipped xfail→xpass (this plan's 100-04 deliverables).
- **Task 1 verify:** `load_app_settings().template_ttl_hours` printed `ttl field ok 24`. Acceptance greps `template_ttl_hours: int = 24` (model field, line 161) + `template_ttl_hours=int(_val` (builder read, line 495) both match.
- **Task 2 slice** `-k "valid_ooxml or bad_file or oversized or kind_and_ttl"`: 4 xpassed. The renamed-binary reject check (`validate_ooxml('t.docx', b'MZ\\x90\\x00')` → HTTPException) printed `reject ok`; `upload_template` + `upload_workspace_template` alias both resolve. Acceptance greps `def validate_ooxml`, `zipfile.is_zipfile`, `kind="template_input"`, `@router.post("/files")`, `load_app_settings_async` all match.
- **Task 3 slice** `-k "expired_excluded_rest or agent_files_unchanged"`: 2 xpassed; `import app.api.workspace` prints `import ok`. Acceptance grep `grep -c "expires_at.is.null,expires_at.gt"` returns **4** (one per GET route); `def _now_iso` matches; `kind, expires_at` present in the list + content selects.
- **Regression — existing workspace REST behavior:** `pytest tests/unit/test_workspace_api.py -q` → **10 passed** (the GET-route gates did not regress the existing list/content/versions/diff behavior).
- **Combined** `pytest tests/test_workspace_template.py tests/unit/test_workspace_api.py -q`: **11 passed, 2 xfailed, 9 xpassed**.
- Scope check: `git diff --stat` over the 3 commits touches only `workspace.py` (+120/−4) and `user_settings.py` (+6); **zero file deletions**; no untracked source files; no Plan 100-05 file (template_service.py / main.py / threads.py / tool_dispatcher.py) and no STATE.md / ROADMAP.md touched.

## Decisions Made

None beyond the plan's intent — executed as specified, with two TDD-contract reconciliations documented under Deviations. Reaffirming the load-bearing plan decisions:
- **Pitfall 2 ordering:** the content route's row SELECT is gated before the signed URL is minted (an expired row → None → 404, no URL) — the structural close of the signed-URL bypass.
- **Symmetric expiry boundaries:** the supabase-py REST gate uses `expires_at.gt.{now}` (strict `>`), matching the 100-03 asyncpg list gate's `> now()` so the two seams never disagree on a boundary row (100-03's `is_expired` uses the inclusive `<= now()` complement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route handler named `upload_template` (TDD-contract reconciliation)**
- **Found during:** Task 2 (upload route)
- **Issue:** The plan body names the handler `upload_workspace_template`, but the binding Plan 100-01 TDD stub `test_upload_sets_kind_and_ttl` does `from app.api.workspace import upload_template` (the plan note at test line 147 names the symbol `upload_template`). Naming the handler only `upload_workspace_template` would leave the test's import RED.
- **Fix:** Named the `@router.post("/files")` handler `upload_template` (satisfies the TDD import) and added a module-level alias `upload_workspace_template = upload_template` (satisfies the must_haves `exports` name). Both symbols resolve; every acceptance grep still matches. Same precedent as 099 Plans 02 (`_skill_block`), 03 (`materialize_skill_snapshots`), 04 (`_ensure_skill_snapshots`).
- **Files modified:** backend/app/api/workspace.py
- **Verification:** `from app.api.workspace import upload_template, upload_workspace_template` resolves; `upload_workspace_template is upload_template` → True; the `-k kind_and_ttl` test xpasses.
- **Committed in:** `e8f68485` (Task 2 commit)

**2. [Rule 1 - Bug] Inlined the literal `.or_` filter at each of the 4 call-sites (not a shared constant)**
- **Found during:** Task 3 (REST gates)
- **Issue:** A first pass factored the filter into a `_EXPIRY_GATE` constant for DRY-ness, but the plan's acceptance criterion is `grep -c "expires_at.is.null,expires_at.gt" backend/app/api/workspace.py` returns **4** (one literal per GET route). The constant produced 1 literal + 4 references, so the verbatim grep would return 1, not 4.
- **Fix:** Reverted to the plan's exact form — the literal `.or_("expires_at.is.null,expires_at.gt." + _now_iso())` inlined at each of the 4 SELECT chains; removed the constant; also removed the literal from the `_now_iso` docstring so the grep returns exactly 4 (4 route call-sites, 0 incidental).
- **Files modified:** backend/app/api/workspace.py
- **Verification:** `grep -c "expires_at.is.null,expires_at.gt"` → 4; the `-k expired_excluded_rest` test xpasses; `import ok`; the 10 existing workspace-API unit tests stay green.
- **Committed in:** `4b84fa51` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — mechanical reconciliations to the binding TDD-stub import and the verbatim acceptance grep).
**Impact on plan:** No scope creep. Both adaptations preserve the plan's exact behavioral intent; every acceptance criterion and must_haves link is satisfied.

## Issues Encountered

- **Worktree shell lacks Supabase env vars** for a standalone `import app.api.workspace` / `load_app_settings()` (config validation needs `supabase_service_role_key`). This is the pre-existing worktree-shell limitation noted in 100-03-SUMMARY.md, NOT caused by this plan. Resolved exactly as 100-03 did: ran the standalone verify after sourcing `backend/.env` into the process environment, and ran the pytest verifies under the conftest harness (which sets the env). Both `import ok` and `ttl field ok 24` print clean. No code impact.

## User Setup Required

None - no external service configuration required. (Migration 068 — the live `app_settings.template_ttl_hours` + `workspace_files.kind`/`.expires_at` columns this plan reads/writes — was applied operator-side in Plan 100-02 via the Supabase SQL editor; no new migration here.)

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. All five registered threats are mitigated by this plan's code:
- **T-100-04-01 (Spoofing/Tampering — renamed-binary upload):** `validate_ooxml` (ext allowlist + `zipfile.is_zipfile` End-of-Central-Directory check + `[Content_Types].xml` + per-ext part marker) rejects with 422 before any persistence.
- **T-100-04-02 (Information Disclosure — cross-user upload/read):** `_verify_thread_ownership` 404-not-403 on the upload route (existence-leak prevention); the 4 GET routes inherit the FK-chain RLS policy. `test_cross_user_isolation` xpasses (symbol gate; live two-user assertion is a 100-VALIDATION manual UAT row).
- **T-100-04-03 (Information Disclosure — signed-URL bypass of an expired template):** the `.or_` gate on `get_workspace_file_content`'s row SELECT runs BEFORE the signed URL is minted — an expired row → None → 404, no URL (Pitfall 2 closed).
- **T-100-04-04 (DoS — oversized upload):** 10MB guard checked immediately after `file.read()`; empty-file 422.
- **T-100-04-05 (Tampering — RAG poisoning):** upload writes ONLY to `workspace_files` via `write_file`; ingestion/embedding/search never read the table (SC#2 — pinned by the GREEN `test_workspace_files_not_in_ingestion` static guard). Bytes stored opaque, never parsed/rendered/embedded this phase.

## Known Stubs

None introduced by this plan. The 2 `test_workspace_template.py` stubs still xfail (`test_sweep_deletes_rows_and_bytes`, `test_run_pin_extends_and_noop`) are owned by the parallel Plan 100-05 (template_service.py — sweep janitor + run-pin), NOT this plan's deliverable; they are mapped in 100-VALIDATION.md.

## Next Phase Readiness

- **Plan 100-05 (sweep janitor + kickoff run-pin)** is the remaining backend half — it builds `template_service.sweep_expired_templates` + `pin_templates_for_run` on different files (template_service.py / main.py / threads.py / tool_dispatcher.py), untouched here. The expires_at rows this plan's upload route now persists are exactly what the sweep deletes and the pin extends.
- **Plan 100-06 (frontend badge/countdown)** consumes this plan's API surface: the `list_workspace_files` response now carries `kind` + `expires_at` for the Template badge + expiry countdown (D-02), and the upload route is the FilesSection upload button's backend target.
- No blockers. The two-half expiry contract is complete (100-03 asyncpg tool-read + 100-04 REST), six read seams all gated on `expires_at` and byte-identical for NULL-expiry agent files. The worktree main-venv interpreter + env-sourcing are the only environment notes for re-running verifies inside the worktree.

## Self-Check: PASSED

- FOUND: backend/app/api/workspace.py
- FOUND: backend/app/models/user_settings.py
- FOUND: .planning/phases/100-ephemeral-template-upload/100-04-SUMMARY.md
- FOUND commit: 75b5f0ae (Task 1)
- FOUND commit: e8f68485 (Task 2)
- FOUND commit: 4b84fa51 (Task 3)

---
*Phase: 100-ephemeral-template-upload*
*Completed: 2026-06-10*
