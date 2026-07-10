---
phase: 134-eval-results-honest-verdict-ratings
plan: 3
subsystem: api
tags: [eval, ratings, idor, owner-scoping, upsert, pydantic, fastapi, pytest]

# Dependency graph
requires:
  - phase: 134-01
    provides: "migration 081 — eval_ratings table (id, eval_result_id, user_id, rating CHECK up/down, created_at, updated_at) with UNIQUE (eval_result_id, user_id) enabling upsert on_conflict + owner-only RLS SELECT; the stable eval_results.id FK target"
  - phase: 134-02
    provides: "verdict fields on EvalResultResponse (get_eval_run select('*') already flows them) — this plan adds the per-caller rating field alongside them"
  - phase: 133
    provides: "net-new eval router (evals.py: get_eval_run owner-scoped two-read pattern, _verify_owned_skill 404-not-403 precedent), eval_run.py Pydantic contracts, the filtering _FilterSupabase route-test fake in test_eval_runner.py"
provides:
  - "PUT /skills/{skill_id}/evals/results/{result_id}/rating — the FIRST user-initiated write in the eval domain: owner-verify (id+user_id) then upsert/clear; 404 never 403 on a cross-user id (T-134-01 IDOR); user_id from current_user never the body (T-134-03); reject non up/down with 400 (T-134-09)"
  - "RateResultBody(rating: str | None) — single-typed; carries ONLY rating (no forged user_id)"
  - "rating: str | None on EvalResultResponse — the caller's own thumb, attached by get_eval_run"
  - "get_eval_run rating merge — a second owner-scoped eval_ratings read merged onto each result (D-09 readout)"
  - "test_evals_router.py — ratings round-trip (up->down->null) + cross-user 404 integration tests (EVAL-04 machine-verifiable coverage)"
affects: [134-04, 135, 136]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-verify-then-write IDOR gate: select the target row filtered by id AND user_id, raise 404 (never 403) on empty BEFORE any service-role write (the _verify_owned_skill precedent)"
    - "Re-ratable toggle/clear: upsert(on_conflict='eval_result_id,user_id') to set/flip, DELETE-on-null to clear — DB UNIQUE constraint enforces one thumb per (user, answer)"
    - "Per-caller readout merge: a second owner-scoped read (.eq user_id) after the results read, merged in Python onto each result dict (mirrors get_eval_run's two-read owner-scoping)"

key-files:
  created:
    - "backend/tests/test_evals_router.py — API-level eval ratings tests (self-contained _FilterSupabase honoring .eq chains + upsert(on_conflict) + delete); no live DB/provider"
  modified:
    - "backend/app/api/evals.py — rate_eval_result PUT endpoint (owner-verify IDOR gate + upsert/clear) + rating merge in get_eval_run + RateResultBody import"
    - "backend/app/models/eval_run.py — RateResultBody(rating: str | None) + single-typed rating field on EvalResultResponse"

key-decisions:
  - "Ratings write is a backend service-role endpoint with an .eq(user_id) owner-verify gate, never a client-direct write (D-08); user_id sourced from current_user, never the body (T-134-03)"
  - "IDOR gate returns 404 (never 403) on a cross-user/unknown result_id so existence is not leaked (T-134-01, the T-133-01/_verify_owned_skill precedent)"
  - "Re-ratable via upsert on the (eval_result_id, user_id) UNIQUE constraint; clear = DELETE the row (D-08); invalid rating rejected with 400, the DB CHECK is the second gate (T-134-09)"
  - "get_eval_run rating read scoped by .eq(user_id) + filtered to the run's result ids in Python (not .in_(result_ids)) — functionally equivalent owner-scoped merge that keeps the existing test_eval_runner.py fake untouched and green (see Deviations)"

patterns-established:
  - "Pattern 1: owner-verify-then-write — the load-bearing security control for the first user write in a domain (404-not-403)"
  - "Pattern 2: durable per-caller readout merge — the client renders the owner-scoped route's merged rating, avoiding a stale FE store (respects BUG-260701-02)"

requirements-completed: [EVAL-04]

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 134 Plan 03: Owner-Gated Eval Ratings Summary

**The first user-initiated write in the eval domain: a `PUT .../rating` endpoint with an IDOR-safe owner-verify (404 never 403), re-ratable upsert / clear-on-null (one thumb per (user, answer)), `user_id` from the caller not the body, plus the caller's own rating merged into the durable `get_eval_run` readout — proven by round-trip + cross-user-404 router tests.**

## Performance

- **Duration:** ~30 min (dominated by a ~12-min full-suite investigation of pre-existing rot)
- **Started:** 2026-07-01T22:44:00+04:00
- **Completed:** 2026-07-01T23:14:00+04:00
- **Tasks:** 2
- **Files modified:** 2 code (+1 new test file)

## Accomplishments
- `rate_eval_result` PUT endpoint on the eval router: Step 1 owner-verifies the target `eval_results` row filtered by BOTH `id == result_id` AND `user_id == current_user["id"]` (`.limit(1)`, `run_in_threadpool`) and raises `HTTPException(404)` — NEVER 403 — on empty, so a cross-user id is not confirmed to exist (T-134-01). Step 2 writes via the service-role client: `rating is None` DELETEs the row (clear), else rejects a value not in `("up","down")` with 400 (T-134-09) and `upsert(..., on_conflict="eval_result_id,user_id")` (re-ratable toggle — D-08). `user_id` is the caller's, never `body` (T-134-03); `RateResultBody` carries only `rating`.
- `get_eval_run` now attaches the caller's own thumb to each result via a second owner-scoped `eval_ratings` read merged in Python (D-09 readout) — None when unrated; the run/results owner-scoping is unchanged.
- `RateResultBody(rating: str | None)` + a single-typed `rating: str | None` on `EvalResultResponse` (no `list[...]`/multi-type union — Gemini `type:[...]` array trap avoided).
- New `backend/tests/test_evals_router.py`: `test_rating_round_trip` proves up→down→null round-trips through the durable readout (re-rate toggles the ONE row, null clears), `test_rating_cross_user_404` proves the IDOR gate returns 404 and writes no `eval_ratings` row for the non-owner. Both hermetic (dependency-overridden fakes, no live DB/provider).

## Task Commits

Each task was committed atomically:

1. **Task 1: Ratings endpoint (owner-verify IDOR gate + upsert/clear) + RateResultBody + rating merge in get_eval_run** - `66620d03` (feat)
2. **Task 2: Router integration tests — ratings round-trip + cross-user 404** - `2e8c0837` (test)

**Plan metadata:** this SUMMARY + `deferred-items.md` (docs). STATE.md / ROADMAP.md / REQUIREMENTS.md intentionally NOT touched — the orchestrator owns those writes (per objective).

## Files Created/Modified
- `backend/app/api/evals.py` - Added the `rate_eval_result` PUT endpoint (owner-verify 404-not-403 + upsert-on-conflict / delete-on-null, all `run_in_threadpool`); added the owner-scoped `eval_ratings` rating merge onto each result in `get_eval_run`; imported `RateResultBody`.
- `backend/app/models/eval_run.py` - Added `class RateResultBody(BaseModel): rating: str | None`; added the single-typed `rating: str | None` field on `EvalResultResponse`.
- `backend/tests/test_evals_router.py` - NEW. Self-contained in-memory `_FilterSupabase`/`_FilterTable` honoring `.eq()` chains + `upsert(on_conflict=...)` + delete; `test_rating_round_trip` + `test_rating_cross_user_404`.

## Decisions Made
- **Threat-model mitigations all implemented (Rule 2 check):** T-134-01 (owner-verify id+user_id, 404-not-403), T-134-03 (`user_id` from `current_user`), T-134-09 (400 on a rating not in `up`/`down`; DB CHECK is the second gate). No new security surface beyond the plan's threat register → no Threat Flags.
- **`get_eval_run` reads `eval_ratings` scoped by `.eq(user_id)` and filters to the run's result ids in Python**, rather than the RESEARCH/plan-literal `.in_(result_ids).eq(user_id)`. See Deviations — functionally identical owner-scoped merge; deliberately chosen to keep `test_eval_runner.py` untouched and its route tests green.
- **`skill_id` stays a RESTful path anchor, not an independent gate** — the ownership check is on the `eval_results` row (the minimal `eval_ratings` row has no skill_id column, D-09), matching the RESEARCH Pattern 3 shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted the `get_eval_run` rating read from `.in_(result_ids)` to an owner-scoped `.eq(user_id)` read + Python result-id filter**
- **Found during:** Task 1 (get_eval_run rating merge)
- **Issue:** The plan action + RESEARCH code specify `supabase.table("eval_ratings").select("eval_result_id, rating").in_("eval_result_id", result_ids).eq("user_id", user_id)`. But `get_eval_run` is exercised by the existing `test_eval_runner.py::test_results_persist_after_buffer_expiry`, whose in-memory `_FilterTable` fake does NOT implement `.in_()`. Using `.in_()` would raise `AttributeError` there → a 500 → break that test. Task 1's own acceptance criteria requires "the existing test_eval_runner.py route tests still pass", and `test_eval_runner.py` is NOT in this plan's `files_modified` (and the executor constraint pins the commit to only the 3 declared files) — so the fix cannot be to edit that fake.
- **Fix:** Read `eval_ratings` owner-scoped by `.eq("user_id", user_id)` (a method the fake supports), build the id→rating map filtered to this run's `result_ids`, and merge `r["rating"] = map.get(r["id"])`. This satisfies every must_have/key_link ("a second owner-scoped read after `_read_results` merged onto each result"). The merge result is identical (owner-scoped, per-result, None when unrated). Trade-off: the DB read is scoped by user rather than by the result-id list, so it returns the caller's full (sparse — thumbs are rare) rating set, filtered in-memory; a future tightening to `.in_()` + the `idx_eval_ratings_user_id` index is a pure optimization when eval_ratings volume grows.
- **Files modified:** backend/app/api/evals.py
- **Verification:** `pytest tests/test_eval_runner.py -q` → 11 passed (incl. `test_results_persist_after_buffer_expiry` + `test_cross_user_404`); `pytest tests/test_evals_router.py -q` → 2 passed (round-trip proves the merge returns the correct rating).
- **Committed in:** `66620d03` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. The endpoint behavior, the IDOR gate, and the per-caller readout merge are exactly as specified; only the `eval_ratings` filter clause changed (user-scoped + in-memory result filter vs. `.in_()`), preserving every must_have while keeping the out-of-scope `test_eval_runner.py` untouched and green.

## Issues Encountered
- **The full backend suite (`pytest tests/ -q`) is NOT green — but the failures are pre-existing rot, not a regression from this plan.** The hermetic slice (`--ignore=tests/integration`) reports **70 failed / 1461 passed**; the full run including the live-service `tests/integration/` folder reports **125 failed / 1985 passed / 1 error** (~12 min; the extra failures are integration tests gated on a live Redis + local Supabase this run lacked). Every failing test file (`test_retrieval_service.py` ×15, `test_sql_service.py` ×12, `test_multimodal_query.py` ×5, `test_sandbox_service.py` ×3, `test_module7_tools.py` ×2, `test_phase56_iteration_start.py` ×1, `test_streaming_reliability.py` ×1, …) and its system-under-test module is **byte-identical to baseline** — `git diff --stat HEAD~1..HEAD` shows this plan changed ONLY `evals.py` + `eval_run.py`, so their pass/fail status is unchanged by 134-03. Sampled failure is mock drift (`Expected 'embed_texts' to be called once. Called 0 times.`), the same class as the documented frontend vitest rot (SEED-056) / E2E rot (SEED-049). Per the executor SCOPE BOUNDARY these unrelated pre-existing failures were NOT fixed; they are logged in `deferred-items.md` as a candidate backend test-rot cleanup pass.
- **Redis TCP probe self-inflicted hang:** my initial `/dev/tcp` PING diagnostic used `head -c 20` which blocked waiting for bytes past Redis's 7-byte `+PONG` — a false "service down" signal. Redis was up; the real full-suite slowness is the live-Postgres integration tests. Re-diagnosed by running the hermetic suite (`--ignore=tests/integration`, 86s).

## TDD Gate Compliance
- Plan frontmatter `type: execute` and neither task carries `tdd="true"` — the plan-level RED/GREEN/REFACTOR gate does not apply. Task 1 (feat, endpoint + merge) then Task 2 (test, behavior proof) is the intended order; the round-trip + IDOR-404 tests genuinely exercise the Task 1 wiring (e.g. `test_rating_cross_user_404` asserts no `eval_ratings` row is written on the 404 path). `MVP_MODE`/`TDD_MODE` not set (config `tdd_mode: false`).

## User Setup Required
None — no external service configuration required. Migration 081 (the `eval_ratings` table + UNIQUE constraint the upsert targets) was applied to the live DB in Plan 134-01; the endpoint uses the existing service-role Supabase client.

## Next Phase Readiness
- The owner-gated ratings write + the per-caller rating in the durable readout are ready for **Plan 134-04** (thin `SkillEvalSection`: two thumbs per answer calling `rateEvalResult`, re-`loadReadout` on success — the durable readout is authoritative, avoiding a stale store per BUG-260701-02).
- **Phase 135 (SI-01)** unblocked: the minimal `eval_ratings` row joins to the Plan-02 verdict for the high-value human↔judge-disagreement cue (a thumbs-DOWN on a judge-PASSED answer).
- **Live SC#10 4-axis UAT (U1–U9 in 134-VALIDATION.md) remains pending** at `/gsd:verify-work` (D-12) — U9 (ratings persistence: thumb, reload, re-rate/clear + capture a down-on-PASS disagreement) exercises this plan's surface live.
- Pre-existing backend unit-test rot is logged in `deferred-items.md` (out of scope; not a 134-03 regression).

## Self-Check: PASSED
- Created file exists: `backend/tests/test_evals_router.py` — FOUND.
- Commits exist: `66620d03` (Task 1, feat), `2e8c0837` (Task 2, test) — both FOUND.
- Eval-domain tests green: `pytest tests/test_eval_runner.py tests/test_evals_router.py -q` → 13 passed. IDOR gate returns 404 on cross-user (proven by `test_rating_cross_user_404`); round-trip up→down→null proven by `test_rating_round_trip`.
- Commit scope verified: only `backend/app/api/evals.py` + `backend/app/models/eval_run.py` + the new `backend/tests/test_evals_router.py` touched; no unrelated churn, STATE.md/ROADMAP.md untouched.

---
*Phase: 134-eval-results-honest-verdict-ratings*
*Completed: 2026-07-01*
