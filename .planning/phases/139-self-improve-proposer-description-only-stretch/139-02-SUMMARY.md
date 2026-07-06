---
phase: 139-self-improve-proposer-description-only-stretch
plan: 02
subsystem: api
tags: [fastapi, evals-router, skill-proposals, si-02, description-proposer, trigger-tuner, owner-scope]

# Dependency graph
requires:
  - phase: 139-01
    provides: "Migration 090 (skill_proposals kind + description columns + provenance FK + kind-gated CHECK) + extended SkillProposalResponse + ProposeDescriptionBody — the persistence + response contract these routes write"
  - phase: 135-self-improvement-loop
    provides: "SI-01 propose/reject/approve lifecycle in evals.py (evals.py:695/991/1459) + _verify_owned_skill + _proposal_response — the route shapes mirrored (minus the async re-eval arm)"
  - phase: 123.1-trigger-tuner
    provides: "tuner_runs durable scoreboard (winner_index/winner_description/candidates[]) — the MEASURED winner these routes snapshot; the proposer IS a Tuner run (D-01)"
provides:
  - "POST /skills/{id}/description-proposals — honest-winner-gated propose (kind='description', inline {winner,baseline,run_id} snapshot, NO live skills write)"
  - "GET /skills/{id}/description-proposals — owner+kind-scoped rehydration list"
  - "POST /skills/{id}/description-proposals/{pid}/reject — pure-audit flip, kind-gated (T-139-10)"
  - "POST /skills/{id}/description-proposals/{pid}/approve — synchronous live-write + trigger-versioned promote (no async arm, D-07)"
  - "Five fake-backed integration tests pinning the whole lifecycle (test_139_description_proposals.py)"
affects: [139-03, 139-05, si-02, description-proposer, evals-router]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror the SI-01 route contract, DROP the async arm (RESEARCH Pattern 2) — propose/reject/approve are synchronous; proposed -> rejected | promoted only"
    - "Snapshot-not-FK for mutable upstream evidence (RESEARCH Pattern 1) — copy {winner,baseline,run_id} inline at propose-time; tuner_runs FK is provenance only"
    - "Version-on-approval via the 079/132 trigger — write skills.description ONCE, read back MAX(version_number); never a second INSERT (Pitfall 2)"
    - "Owner-only 404-not-403 gate on every route via _verify_owned_skill; every supabase-py call run_in_threadpool-wrapped (D-v2.5-01)"

key-files:
  created:
    - "backend/tests/integration/test_139_description_proposals.py"
  modified:
    - "backend/app/api/evals.py"

key-decisions:
  - "Owner gate uses _verify_owned_skill (owner-ONLY), not _fetch_owned_or_global_skill (owner-or-global) — deviation from the plan interface note; see Deviations. The lifecycle writes skills.description WHERE id AND user_id on approve, so a proposal on a non-owned skill could never be applied; owner-only is the coherent, testable, strictly-owner-scoped gate the must_haves require."
  - "Reject + approve are kind-gated (.eq('kind','description') / an explicit 409) so an instruction proposal can never be flipped/promoted through the description routes (T-139-10)."
  - "propose returns 201 CREATED (a resource is created); approve/reject return 200."
  - "Version attribution accepts the 079/132 trigger's source='manual' (RESEARCH Discretion #2 primary) — the promoted kind='description' proposal row (with source_tuner_run_id) is the self-improve audit anchor; no GUC, no trigger change."

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-07-06
---

# Phase 139 Plan 02: SI-02 Description-Proposal Routes Summary

**Adds the four owner-scoped description-proposal routes in `evals.py` — the honest front door (D-08) that replaces the Tuner's one-click apply: propose snapshots the durable Tuner held-out winner inline (refusing when the baseline wins), reject is a pure kind-gated audit flip, and approve writes `skills.description` once and lets the 079/132 trigger version it — no async re-eval, no SSE, no shared-path touch.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-06T15:02:29Z
- **Completed:** 2026-07-06T15:08:53Z
- **Tasks:** 3 (TDD: RED → propose+reject → approve)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **Task 1 (RED):** Authored `test_139_description_proposals.py` — five fake-backed integration tests reusing `_FilterSupabase`/`_FilterTable`/`_override` from `test_evals_router` (so owner-scoping is REAL, not vacuous). Added a thin `_TriggerSupabase` subclass that mirrors the 079/132 `capture_skill_version` trigger (an `UPDATE skills.description` appends exactly ONE `skill_versions` row), so the approve test asserts one-version-not-two (RESEARCH Pitfall 2) faithfully. Confirmed RED: 4 fail on missing routes, tests collect cleanly.
- **Task 2 (propose + reject):** Added `POST /skills/{id}/description-proposals` — owner-gate FIRST, resolve the diff base (current live description + latest `skill_versions` id), read the DURABLE `tuner_runs` row (409 if the tuner re-ran since the observed `run_id`), honest-by-construction gate (400 when the held-out winner IS the baseline — D-02), kind-scoped supersede of any lingering `proposed` draft, SNAPSHOT `{winner, baseline, run_id}` inline (Pitfall 1), and service-role INSERT a `kind='description'` `proposed` row — **NO live skills write**. Added `POST .../{pid}/reject` (pure-audit flip, kind-gated to `kind='description'` — T-139-10) + `GET .../description-proposals` (owner+kind-scoped rehydration) + `_description_proposal_response` / `_read_base_description` helpers.
- **Task 3 (approve):** Added `POST .../{pid}/approve` — owner-verify + kind-gate (409 on an instruction proposal) + state-guard (`status=='proposed'`), then `UPDATE skills.description` (WRAPPED in `run_in_threadpool` — never the bare `skills.py:404` call; Pitfall 5), read back `MAX(version_number)` for `new_skill_version_id`, flip `status='promoted'`. No draft INSERT, no re-eval, no SSE, no `re_evaling`/`interrupted`/`not_promoted` (D-07). All 5 tests green.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED integration tests** — `ca59f105` (test)
2. **Task 2: propose + reject routes** — `521b8c11` (feat)
3. **Task 3: approve route** — `17457c4a` (feat)

_Plan metadata (SUMMARY) committed separately in worktree mode._

## Files Created/Modified

- `backend/tests/integration/test_139_description_proposals.py` — 5 tests: `test_propose_creates_draft_no_live_write`, `test_baseline_winner_refuses_propose`, `test_approve_writes_desc_and_version`, `test_reject_is_pure_audit` (+ reject-wrong-kind guard), `test_cross_user_404`. Includes the `{winner, baseline, run_id}` snapshot-shape assertion + a trigger-mirroring fake for the one-version-not-two check.
- `backend/app/api/evals.py` — +4 routes (propose/list/reject/approve) + 2 helpers, in a delimited SI-02 section. Imports `ProposeDescriptionBody`. `threads.py` / `agent_loop.py` untouched (D-13 red line).

## Verification Evidence

- `pytest tests/integration/test_139_description_proposals.py -q` → **5 passed**.
- Regression: `pytest tests/test_skill_proposals_router.py tests/test_skill_proposals.py tests/test_evals_router.py tests/integration/test_139_description_proposals.py -q` → **32 passed** (SI-01 + eval-router suites clean).
- `git diff --name-only <base> HEAD` → exactly `backend/app/api/evals.py` + the test file (`threads.py` / `agent_loop.py` untouched — D-13).
- Static scan of the SI-02 section: the approve route's `skills` UPDATE is inside a `run_in_threadpool` closure; the only statuses written in SI-02 executable code are `proposed`/`rejected`/`promoted` (no `re_evaling`/`interrupted`/`not_promoted`/`re_eval_run_id`/`emit_sse` in code — those appear ONLY in docstrings describing what the route does NOT do).
- The persisted `scoreboard_snapshot` has the literal top-level keys `{winner, baseline, run_id}` (asserted on both the stored row and the serialized response) — matches 139-04's `DescriptionScoreboardSnapshot`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Owner gate uses `_verify_owned_skill` (owner-only), not `_fetch_owned_or_global_skill` (owner-or-global)**
- **Found during:** Task 2 (propose route) + Task 1 (test harness).
- **Issue:** The plan's `<interfaces>` + Task 2 step 1 name `_fetch_owned_or_global_skill` for the propose/approve owner gate. That helper uses `.or_(user_id.eq,is_global.eq.true)`, which (a) the mandated `_FilterSupabase` test fake does NOT support (it has no `.or_()` — a call would raise and be caught as a 404, making the owner-can-propose test fail), and (b) is architecturally incoherent for this lifecycle: approve writes `skills.description WHERE id AND user_id`, so a proposal drafted on a non-owned GLOBAL skill could never be approved (a dead-end row). Adding `.or_()` to the shared `test_evals_router` fake would also break the plan's `files_modified` boundary (`git diff --stat` must show only `evals.py` + the test file).
- **Fix:** Used the owner-only `_verify_owned_skill` (evals.py:113, `.eq("user_id")`) for propose + approve. This is strictly owner-scoped (a superset-tightening: owner-only ⊂ owner-or-global) and fully honors the must_haves "every route is owner-scoped; cross-user access returns 404-not-403". `tuner_runs` is read `.eq("skill_id")` after the owner gate (UNIQUE(skill_id), the gate already proved ownership).
- **Files modified:** `backend/app/api/evals.py`
- **Commit:** `521b8c11`

## Known Stubs

None. `proposed_instructions=None` in the propose INSERT is the kind-gated null for a description proposal (required by the migration-090 CHECK), not a placeholder; every route carries real logic.

## Self-Check: PASSED

- FOUND: `backend/tests/integration/test_139_description_proposals.py`
- FOUND: `backend/app/api/evals.py` (4 SI-02 routes + 2 helpers, `ProposeDescriptionBody` imported)
- FOUND commit: `ca59f105` (Task 1)
- FOUND commit: `521b8c11` (Task 2)
- FOUND commit: `17457c4a` (Task 3)

## Next Phase Readiness

- The four description-proposal routes are green against the fake and ready for the live DB — but they exercise the NEW migration-090 columns, so they run correctly against real Postgres only AFTER Plan 139-03 (blocking-human) applies migration 090 to the live DB + regenerates `full-schema.sql`.
- Plan 139-05 (frontend) wires `proposeDescription()` + the `DescriptionProposalCard` to these routes and repoints `SkillTunerPage.handleConfirmWinner` from the one-click `PATCH /skills` to the propose flow (D-08). The `scoreboard_snapshot` writer shape `{winner, baseline, run_id}` is pinned on both ends (139-04's `DescriptionScoreboardSnapshot` matches).
- 4-axis SC#10 + G-4 lived-experience UAT (VALIDATION.md) is driven live at `/gsd:verify-work 139` after the full frontend + migration land.

---
*Phase: 139-self-improve-proposer-description-only-stretch*
*Completed: 2026-07-06*
