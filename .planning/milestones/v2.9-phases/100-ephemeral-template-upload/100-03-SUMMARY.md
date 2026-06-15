---
phase: 100-ephemeral-template-upload
plan: 03
subsystem: database
tags: [asyncpg, workspace-files, ephemeral-template, ttl, ooxml, expires-at, read-seams, run-honesty]

# Dependency graph
requires:
  - phase: 100-01
    provides: "the TDD contract file test_workspace_template.py — the agent_files_unchanged + expired-read + kind/ttl xfail stubs this plan flips/keeps green"
  - phase: 100-02
    provides: "migration 068 live columns workspace_files.kind / .expires_at (+ partial expiry index + app_settings.template_ttl_hours) this plan's INSERT/SELECT/gated-WHERE read and write"
provides:
  - "Gated asyncpg read seam: list_files_in_thread hides expired templates (expires_at <= now()) on BOTH branches; NULL-expiry agent files always pass (D-11 byte-identical)"
  - "is_expired computed flag on get_file_by_path + get_file_by_id (deliberately UNFILTERED) so the D-10 'template expired' error can distinguish expired-present from absent"
  - "upsert_workspace_file + write_file thread nullable kind/expires_at through to the row (D-12 upload sets them; agent path NULL/NULL)"
  - "OOXML MIME prefix in _BINARY_MIME_PREFIXES so a workspace_read of a docx/pptx/xlsx returns the clean binary stub (A1 hygiene)"
  - "read_file raises FileNotFoundError_('template expired') on is_expired (D-10 run-honesty)"
affects: [100-04-validate-ooxml-rest, 100-05-sweep-pin, 100-06-frontend-badge, ephemeral-template-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gated read-seam filter (expires_at IS NULL OR expires_at > now()) — a no-op for NULL-expiry agent rows, hiding only TTL-bound templates (D-11 byte-identical)"
    - "is_expired as a SQL computed column (expires_at IS NOT NULL AND expires_at <= now()) on the unfiltered by-path/by-id reads — distinguishes expired-present from absent for the D-10 honest-error path"
    - "Nullable kind/expires_at threaded through the upsert + service write signature with both defaulting None — old agent callers are byte-identical, only the upload caller opts in"

key-files:
  created:
    - .planning/phases/100-ephemeral-template-upload/100-03-SUMMARY.md
  modified:
    - backend/app/db/workspace.py
    - backend/app/services/workspace_service.py

key-decisions:
  - "get_file_by_path / get_file_by_id stay UNFILTERED on expiry (only list_files_in_thread filters) — the D-10 honest-error path needs to tell an expired-present row from a truly-absent one; the is_expired flag carries that, the service raises on it"
  - "is_expired uses <= now() (inclusive) so a row at exactly its TTL boundary reads as expired; the list gate uses the symmetric > now() so the two seams never disagree on a boundary row"
  - "write_file echoes kind + expires_at (expires_at as .isoformat()) in its returned dict so the Plan 100-04 upload handler can echo the persisted template metadata without a re-read"

patterns-established:
  - "Two-seam expiry contract: list = filtered (hide expired), get_*_by_* = unfiltered + is_expired flag (caller decides) — the SC#3-critical consumer (agent tool) reads through THIS asyncpg path, not the REST layer (Pitfall 1)"

requirements-completed: [TMPL-01]  # the asyncpg data layer for TMPL-01 lands here; the requirement marks complete at phase close (REST gates 100-04 + sweep/pin 100-05 + frontend 100-06 still pending)

# Metrics
duration: ~4min
completed: 2026-06-10
---

# Phase 100 Plan 03: Ephemeral Template Upload — asyncpg Read/Write Data Layer Summary

**The SC#3-critical asyncpg seam for ephemeral templates: list_files_in_thread now hides expired templates (gated WHERE, NULL-expiry agent files byte-identical), get_file_by_path/id expose an is_expired flag for the D-10 'template expired' honest error, write_file threads kind/expires_at to the row, and an OOXML MIME prefix makes a template workspace_read return the clean binary stub instead of a garbage UTF-8 decode.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-10T15:38:31+04:00 (first task commit)
- **Completed:** 2026-06-10T15:40:43+04:00 (last task commit)
- **Tasks:** 2 (both `auto`, `tdd="true"` — the Wave 0 RED stubs from Plan 100-01 are the pre-existing test gate)
- **Files modified:** 2 (75 insertions, 11 deletions)

## Accomplishments

- **Gated the two asyncpg read seams (Task 1):** `list_files_in_thread` adds `AND (expires_at IS NULL OR expires_at > now())` to BOTH the prefix and no-prefix branches — expired templates vanish from the listing while NULL-expiry agent files always pass (the OR short-circuits). This is the consumer SC#3 matters MOST for: the agent/workflow run reads templates through this path, and a filter on the REST layer (Plan 100-04) is invisible here (Pitfall 1).
- **D-10 expired-vs-absent distinction (Task 1 + 2):** `get_file_by_path` / `get_file_by_id` stay UNFILTERED but gain a computed `(expires_at IS NOT NULL AND expires_at <= now()) AS is_expired` column. `read_file` consumes it to raise `FileNotFoundError_("template expired")` BEFORE the binary/content branches — so the model relays honestly (run-honesty) instead of confabulating about a file the user knows they uploaded, and it is NOT collapsed into a generic not-found.
- **kind/expires_at threaded through write (Task 1 + 2):** `upsert_workspace_file` gains nullable `kind`/`expires_at` kwargs (both default None) in the INSERT column list + `ON CONFLICT DO UPDATE SET kind = EXCLUDED.kind, expires_at = EXCLUDED.expires_at`; `write_file` accepts and forwards them and echoes them in its returned dict (D-12). Every existing agent caller passes neither → NULL/NULL → byte-identical (D-11).
- **OOXML binary-MIME hygiene (Task 2):** appended `application/vnd.openxmlformats-officedocument` to `_BINARY_MIME_PREFIXES` so a `workspace_read` of a docx/pptx/xlsx returns the clean `is_binary=True` stub instead of UTF-8-decoding the OOXML ZIP bytes into garbage (A1 hygiene; also avoids leaking raw ZIP bytes into the agent context).

## Task Commits

Each task was committed atomically (worktree, `--no-verify` per parallel-executor protocol):

1. **Task 1: Gate the 2 asyncpg read seams + add kind/expires_at to INSERT/SELECT + is_expired flag** — `52fc6ad2` (feat)
2. **Task 2: Thread kind/expires_at through write_file + OOXML binary-MIME hygiene + D-10 read error** — `b8fa9d87` (feat)

_Note: both are `feat(...)` commits. The RED gate for this TDD plan is the pre-existing Wave 0 stub set (Plan 100-01's `test_workspace_template.py`); these two commits are the GREEN production code that satisfies the must_haves SQL shape + keeps the agent_files_unchanged / expired-read stubs green._

## Files Created/Modified

- `backend/app/db/workspace.py` (modified, +50/−10) — `upsert_workspace_file` nullable kind/expires_at kwargs + INSERT column list + ON CONFLICT EXCLUDED.kind/expires_at; `get_file_by_path` + `get_file_by_id` add kind, expires_at, and the `is_expired` computed column (unfiltered, D-10); `list_files_in_thread` gated WHERE on both branches (D-11). `get_storage_paths_for_file` untouched (Plan 100-05's sweep reuses it verbatim).
- `backend/app/services/workspace_service.py` (modified, +25/−1) — `_BINARY_MIME_PREFIXES` gains the OOXML prefix; `write_file` accepts/forwards/echoes kind/expires_at; `read_file` raises `FileNotFoundError_("template expired")` on is_expired; `datetime` import added for the new type hints.

## Verification Results

- `pytest tests/test_workspace_template.py -q` (full contract file): **1 passed, 6 xfailed, 5 xpassed** — no hard failures/errors. The SC#2 isolation guard passes; this plan's read-seam + dispatcher symbols xpass (tolerated by `strict=False`); Plans 100-04/05 stubs stay xfail.
- Task 1 slice `-k "agent_files_unchanged or expired"`: 3 xpassed (the read-seam stubs resolve; agent NULL-expiry path byte-identical).
- Task 2 slice `-k "kind_and_ttl or expired_tool_read"`: 1 xfailed (`test_upload_sets_kind_and_ttl` imports `upload_template` — built by Plan 100-04) + 1 xpassed (`test_expired_tool_read_errors`). Verify command also printed `ooxml prefix ok`.
- Acceptance greps (all matched):
  - `expires_at IS NULL OR expires_at > now()` → 2 hits in `list_files_in_thread` (both branches)
  - `is_expired` → in get_file_by_path AND get_file_by_id
  - `kind, expires_at` → in the upsert INSERT column list; `EXCLUDED.kind` → ON CONFLICT
  - `application/vnd.openxmlformats-officedocument` → inside `_BINARY_MIME_PREFIXES`
  - `kind=kind` + `expires_at=expires_at` → in the write_file → upsert call
  - `template expired` → the D-10 message in read_file
- Both modules import clean (`import app.db.workspace`; `import app.services.workspace_service`).

## Decisions Made

None beyond the plan — executed as specified. Two plan decisions worth reaffirming:
- **Asymmetric seam contract:** `list_files_in_thread` filters expired rows; `get_file_by_path`/`get_file_by_id` do NOT — they expose `is_expired` instead. This is deliberate (per the plan): the D-10 honest-error path must tell an expired-present row from a truly-absent one, which a filtering WHERE would erase.
- **Boundary symmetry:** `is_expired` uses `<= now()` and the list gate uses `> now()` so a row exactly at its TTL boundary is consistently treated as expired by both seams.

## Deviations from Plan

None - plan executed exactly as written. (The two TDD stubs this plan targets — `test_agent_files_unchanged` and `test_expired_tool_read_errors` — assert symbol existence + behavior shape; they xpass against the existing read-seam/dispatcher symbols, which `strict=False` tolerates, and the must_haves SQL-shape greps all match. `test_upload_sets_kind_and_ttl` stays xfail by design because its imported `upload_template` symbol is built by Plan 100-04, not this plan.)

## Issues Encountered

- **Worktree shell lacked Supabase env vars** for a standalone `import app.services.tool_dispatcher` (it triggers settings/config validation needing `supabase_service_role_key`). This is a pre-existing worktree-shell limitation, NOT caused by this plan's changes — confirmed by (a) the two touched modules importing clean standalone and (b) `tool_dispatcher` loading fine under the pytest harness (conftest sets env), where `test_expired_tool_read_errors` xpasses cleanly. No code impact.

## User Setup Required

None - no external service configuration required. (Migration 068 — the live columns this plan reads/writes — was applied operator-side in Plan 100-02 via the Supabase SQL editor; no new migration here.)

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. All four registered threats are mitigated by this plan's code (no new network endpoint, auth path, or schema change — schema landed in 100-02):
- **T-100-03-01 (Information Disclosure — expired template readable via agent tool):** `list_files_in_thread` gated WHERE hides expired rows; `read_file` raises on `is_expired`. The agent-tool asyncpg path is the SC#3-critical consumer (Pitfall 1).
- **T-100-03-02 (Tampering — agent files acquiring expiry):** `write_file`/`upsert_workspace_file` kind/expires_at default None → NULL; only the upload caller (Plan 100-04) passes them. The gated filter treats NULL as never-expires (D-11).
- **T-100-03-03 (Spoofing — confabulation on expired read):** D-10 — `is_expired` raises "template expired" (not generic not-found) so the model relays honestly.
- **T-100-03-04 (Tampering — garbage decode of OOXML bytes):** OOXML MIME prefix → binary stub; bytes never UTF-8-decoded into the agent context.

## Known Stubs

None introduced by this plan. The `test_workspace_template.py` xfail stubs that remain RED (`test_valid_ooxml_accepted`, `test_bad_file_rejected`, `test_oversized_rejected`, `test_expired_excluded_rest`, `test_cross_user_isolation`, `test_sweep_deletes_rows_and_bytes`, `test_run_pin_extends_and_noop`, `test_upload_sets_kind_and_ttl`) are owned by Plans 100-04/05 per the Wave 0 scaffold (100-01-SUMMARY.md) — they are NOT this plan's deliverable and are documented + mapped in 100-VALIDATION.md.

## Next Phase Readiness

- **Plan 100-04 (validate_ooxml + REST gates)** builds on this plan's interface: it imports the same `expires_at IS NULL OR expires_at > now()` filter into the REST list route, calls `write_file(..., kind='template_input', expires_at=...)` in its `upload_template` handler (the signature this plan defines + the returned-dict echo), and uses `get_file_by_id`'s `is_expired` flag to 404 the content route on an expired-present row (closing the signed-URL bypass).
- **Plan 100-05 (sweep + run-pin)** reuses `get_storage_paths_for_file` (untouched, verbatim) to delete every version Storage object for swept rows.
- No blockers. The asyncpg foundation (gated read filter + is_expired contract + write_file kind/ttl + OOXML stub) is in place; the worktree main-venv interpreter is the only environment note for re-running verifies inside the worktree.

## Self-Check: PASSED

- FOUND: backend/app/db/workspace.py
- FOUND: backend/app/services/workspace_service.py
- FOUND: .planning/phases/100-ephemeral-template-upload/100-03-SUMMARY.md
- FOUND commit: 52fc6ad2 (Task 1)
- FOUND commit: b8fa9d87 (Task 2)

---
*Phase: 100-ephemeral-template-upload*
*Completed: 2026-06-10*
