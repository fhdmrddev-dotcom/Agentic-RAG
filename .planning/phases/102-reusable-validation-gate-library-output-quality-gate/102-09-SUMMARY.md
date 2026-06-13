---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 09
subsystem: api
tags: [publish-path, security, eop, asyncio, governance-receipts, harness, qual-01]

# Dependency graph
requires:
  - phase: 102-05
    provides: publish_service.publish 4-stage orchestration + get_definition + publish_definition + write_audit
  - phase: 102-06
    provides: schema_model=JudgeVerdict judge wiring + resolve_judge_model + owner_settings forwarding (shared publish_service.py)
provides:
  - "WR-02: get_definition publish read restricted to true ownership for drafts (a non-owner can no longer load/golden-run/flip another user's GLOBAL DRAFT — EoP closed)"
  - "WR-03: version==-1 sentinel routes to an honest already_published block (no false {published: True, version: -1} receipt, no false publish_succeeded governance row)"
  - "WR-04: asyncio.wait_for(harness_publish_max_seconds) deadline → golden_run_timeout block; interactive-phase (llm_human_input / ask_user) pre-run block"
  - "IN-02: write_audit run_id annotated UUID | None + nullable-receipt contract documented"
affects: [103-workflows-page-nl-authoring, 107-governance-receipts, secure-phase-102]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-only-for-drafts publish read: created_by = $2 OR (is_global = true AND status = 'published') — global PUBLISHED stays readable, global DRAFT is owner-only"
    - "Sentinel-to-honest-block: a -1 no-row UPDATE sentinel routes to a named structured block instead of a false success receipt"
    - "Synchronous-publish deadline: asyncio.wait_for wraps a request-bound long run; TimeoutError → named structured block (never a hung request / 500)"
    - "Pre-run lint-class interactive guard: scan definition for human-blocking phases BEFORE any provider call"

key-files:
  created: []
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/harness/publish_service.py
    - backend/app/config.py
    - backend/tests/unit/test_publish_service.py

key-decisions:
  - "WR-04 is the minimum-viable hardening (deadline + interactive pre-run guard), NOT the full background-job rework (deferred to Phase 103)"
  - "harness_publish_max_seconds defaults to DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 24 = 7200s (2h) — generous (publish is rare/deliberate) but bounded"
  - "The interactive guard fires PRE-RUN (lint-class, no provider call) so an unsubscribed ask_user prompt can never wedge the golden run"
  - "api/workflows.py needed NO change — the route already maps already_published->409 and routes every other block stage to the 200 structured verdict"

patterns-established:
  - "EoP-closing read: drop a bare is_global predicate that exposed unpublished cross-user rows; gate global visibility on status='published'"
  - "Honest-failure receipts: every new block stage (already_published / golden_run_timeout / interactive_phase) returns the D-08 structured verdict + a publish_blocked receipt, never a false success"

requirements-completed: [QUAL-01]

# Metrics
duration: 22min
completed: 2026-06-13
---

# Phase 102 Plan 09: Publish-Path Security + Robustness Hardening Summary

**Closed a real elevation-of-privilege on the publish read (a non-owner could golden-run + flip another user's global draft), stopped a false concurrent-double-publish success receipt, and bounded the synchronous golden run with an asyncio deadline + a pre-run interactive-phase guard — all QUAL-01.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-13
- **Completed:** 2026-06-13
- **Tasks:** 3
- **Files modified:** 4 (3 source + 1 test)

## Accomplishments

- **WR-02 (EoP closed):** `get_definition`'s publish read changed from `WHERE id = $1 AND (created_by = $2 OR is_global = true)` to `WHERE id = $1 AND (created_by = $2 OR (is_global = true AND status = 'published'))`. A non-owner can no longer load — and therefore cannot golden-run or publish-flip — another user's GLOBAL DRAFT (a privileged state change by a non-owner). A non-owner now gets `None` for any draft; the publish endpoint 404-collapses it (no existence leak).
- **WR-03 (false receipt stopped):** `publish_workflow` now checks `version == -1` after `publish_definition` and routes the sentinel to an honest `already_published` block (the route maps it to 409). A concurrent double-publish race loser no longer returns `{published: True, version: -1}` and no longer writes a false `publish_succeeded` governance row.
- **WR-04 deadline:** the `_drive_golden_run` call is wrapped in `asyncio.wait_for(timeout=settings.harness_publish_max_seconds)`; an `asyncio.TimeoutError` maps to an honest `golden_run_timeout` block (the TimeoutError handler precedes the broad `except Exception` → `golden_run_error`). The request can no longer hang for hours.
- **WR-04 interactive guard:** a new `_interactive_phase_failures(definition)` helper flags any `llm_human_input` phase OR any validator whose `on_failure == "ask_user"`; a stage-2.5 check blocks such a definition at `interactive_phase` PRE-RUN (after lint, before the golden run) so an unsubscribed ask_user prompt can never wedge the publish.
- **IN-02:** `write_audit(run_id: UUID | None)` annotated + the nullable-receipt contract documented (the NULL-run `publish_blocked` receipts rely on it; the column is nullable).
- **New config knob:** `Settings.harness_publish_max_seconds = DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 24` (7200s / 2h), env-overridable.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-02 owner-only publish read + WR-03 sentinel block + IN-02 annotation** — `1fedb596` (fix)
2. **Task 2: WR-04 publish deadline (asyncio.wait_for) + golden_run_timeout block + config knob** — `78aad9ee` (fix)
3. **Task 3: WR-04 interactive-phase pre-run block + test** — `18eff014` (fix)

_All three are single-commit fixes (the existing `test_publish_service.py` already established the mocking conventions, so each task's tests + source landed together)._

## Files Created/Modified

- `backend/app/db/workflows.py` — `get_definition` publish read restricted to true ownership for drafts (WR-02); `write_audit` `run_id: UUID | None` + nullable-receipt docstring (IN-02)
- `backend/app/services/harness/publish_service.py` — `version == -1` → `already_published` block (WR-03); `asyncio.wait_for` deadline + `golden_run_timeout` block (WR-04); `_interactive_phase_failures` helper + stage-2.5 `interactive_phase` block (WR-04)
- `backend/app/config.py` — `harness_publish_max_seconds` budget knob (WR-04)
- `backend/tests/unit/test_publish_service.py` — 10 new tests (WR-02 SQL predicate + non-owner refused; WR-03 sentinel block; IN-02 annotation; WR-04 timeout + config knob; WR-04 interactive ×2 + control + helper)

## Verification

- **Target suite:** `cd backend && venv/Scripts/python -m pytest tests/unit/test_publish_service.py -q` → **20 passed** (10 pre-existing + 10 net-new).
- **Plan-scoped verify slices:** `-k "timeout or deadline"` → 1 passed; `-k "interactive"` → 4 passed.
- **Adjacent suites:** `test_harness_audit_102.py` + `test_harness_audit_emit.py` → 3 passed (the IN-02 signature change does not break the 22-kind lockstep).
- **key_links present:** `created_by = $2` in `db/workflows.py`; `already_published` (×4) + `asyncio.wait_for` (×2) in `publish_service.py`; `harness_publish_max_seconds` in `config.py`; `_interactive_phase_failures` in `publish_service.py`.
- **G-5 RED LINE held:** `git diff --stat 2e1eb3ca HEAD -- app/api/threads.py app/services/agent_loop.py` is EMPTY — both byte-untouched. The publish hardening stays on `api/workflows.py` + `services/harness/publish_service.py`.
- **No new migration:** additive config knob only; no schema change (the migration-070 columns landed in Plan 02).

## SEED-056 Net-New-Failure Proof

- **Target suite at HEAD:** `test_publish_service.py` = 20 passed.
- **Wider harness/workflow/validator slice (`-k "publish or workflow or harness or validator or freshness or citation or emit or gate or reachability or audit"`):** 189 passed / **3 failed**.
- **The 3 failures are PRE-EXISTING ROT — proven by base-checkout:** with my 3 changed source files (`db/workflows.py`, `publish_service.py`, `config.py`) reverted to the wave base `2e1eb3ca`, the SAME 3 fail IDENTICALLY:
  - `test_075_4_final_output_files_payload.py::test_final_output_files_emit_carries_filename_url_size_keys`
  - `test_075_4_final_output_files_payload.py::test_final_output_files_emit_under_if_guard`
  - `test_phase56_iteration_start.py::...::test_threads_py_emits_iteration_start_at_loop_top`
  These are production-source-assertion tests that `inspect.getsource(threads.py / task_service.py)` and grep for string literals; they import NONE of my changed modules. Source restored clean to HEAD; the 20 target tests re-confirmed GREEN.
- **Net-new failures = 0.**

## Decisions Made

- **WR-04 scope held to minimum-viable:** the deadline + the pre-run interactive guard are the v1 cut; the full background-job publish that would VALIDATE interactive phases (a human subscriber + durable resume) stays deferred to Phase 103. Documented in the `_interactive_phase_failures` helper docstring and the config comment — this is an honest cut, not a regression.
- **`harness_publish_max_seconds` default = 7200s (2h):** generous (publish is a rare deliberate event whose golden run is a full end-to-end KB run) but bounded (the request cannot hang indefinitely). Mirrors the `harness_phase_wall_clock_seconds` knob shape.
- **`api/workflows.py` left unchanged:** the route already maps `already_published` → 409 (so WR-03 reuses it) and routes every unknown block stage (`golden_run_timeout`, `interactive_phase`) to the 200 structured `PublishVerdict` path. No route edit was needed — the plan's `files_modified` listed it defensively.

## Deviations from Plan

None - plan executed exactly as written. (The plan's `files_modified` listed `backend/app/api/workflows.py`, but no edit was required there: the route's existing `already_published`→409 mapping covers WR-03 and the existing 200 structured-verdict path covers the new `golden_run_timeout` / `interactive_phase` block stages. This is an absence-of-needed-change, not a behavioral deviation.)

## Issues Encountered

None. The existing `test_publish_service.py` mocking conventions (boundary-mocked `_drive_golden_run` / `_judge_golden_output`, patched `get_definition` / `write_audit` / `publish_definition`) extended cleanly to all 10 new tests.

## Known Stubs

None. Every new block stage returns a real structured verdict + writes a real `publish_blocked` receipt; no placeholder values, no hardcoded empties.

## User Setup Required

None - no external service configuration required. `harness_publish_max_seconds` has a sensible default (7200s); no env var is required.

## Next Phase Readiness

- The publish path is now security-hardened (EoP closed) and robust (no hung request, no false receipt, interactive phases pre-blocked) — ready for `/gsd:verify-work 102` (the SC#10 4-axis golden-run scoreboard) and `/gsd:secure-phase 102`.
- **For secure-phase 102:** all 3 STRIDE threats in this plan's register are mitigated — T-102-09-01 (EoP via WR-02 owner-only read), T-102-09-02 (false governance receipt via WR-03 sentinel block), T-102-09-03 (DoS via WR-04 deadline + interactive pre-block). No new threat surface introduced.
- **Phase 103 (Workflows page + NL authoring)** is a client of `POST /workflows/{id}/publish`; the structured verdict (including the new `golden_run_timeout` / `interactive_phase` block stages) is machine-renderable for its UI.

## Self-Check: PASSED

- Commits verified present: `1fedb596`, `78aad9ee`, `18eff014` (all FOUND in git log).
- Files verified present: `db/workflows.py`, `publish_service.py`, `config.py`, `test_publish_service.py`, `102-09-SUMMARY.md` (all FOUND).
- Target suite re-confirmed: `test_publish_service.py` → 20 passed.
- G-5 RED LINE: `threads.py` / `agent_loop.py` byte-untouched (empty diff vs base `2e1eb3ca`).

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-13*
