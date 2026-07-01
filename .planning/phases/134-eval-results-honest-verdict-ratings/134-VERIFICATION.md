---
phase: 134-eval-results-honest-verdict-ratings
verified: 2026-07-02T09:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "U1 — Cross-provider verdict: OpenAI"
    expected: "Eval a skill with a gpt-5.x model; with/without arms graded; judge (claude-opus-4-8) verdict renders; verdict line reads 'X/N passed'"
    why_human: "Live cross-provider LLM behavior + rendered UI; not observable via static analysis"
  - test: "U2 — Cross-provider verdict: Anthropic (provider-under-test == judge provider)"
    expected: "Judge still independent-model-resolved; verdict honest; no self-judge shortcut even when the tested model and judge model share a vendor"
    why_human: "Requires a live completion + live judge call to observe actual routing behavior"
  - test: "U3 — Cross-provider verdict: Google"
    expected: "Single-typed verdict fields survive (no Gemini type:[...] array trap); verdict renders"
    why_human: "Gemini schema quirks only surface against a live Gemini call"
  - test: "U4 — Cross-provider verdict: OpenRouter"
    expected: "Verdict honest; OpenRouter treated as experimental (native-safe)"
    why_human: "Live provider call required"
  - test: "U5 — Multi-tool case"
    expected: "A case whose prompt exercises 2+ tools (search_documents + execute_code) with-skill is graded; verdict reflects the actual deliverable"
    why_human: "Requires live agent-loop tool execution + live judge grading of the result"
  - test: "U6 — Parallel-thread"
    expected: "Eval run streaming on skill A while chat thread B streams concurrently; no cross-talk; eval_*/verdict events only on the eval run buffer; both readouts correct"
    why_human: "Real-time concurrent-stream behavior; not verifiable from source alone"
  - test: "U7 — Long-history / long-prompt"
    expected: "A case with a >=5 KB prompt completes grading with no truncation of the verdict"
    why_human: "Requires a live long-context completion + judge call to observe truncation behavior"
  - test: "U8 — Intentional errored arm (D-12 mandatory)"
    expected: "A without-skill baseline on claude-sonnet-5 hits the known BUG-260701-01 (assistant-prefill 400); that arm renders 'not measured' (never a fabricated score); the with-skill arm, if it completes, still grades; rollup counts only measured cases"
    why_human: "Concrete proof of the D-04 honesty gate under a REAL provider error, not a mocked one; this is the load-bearing UAT row for EVAL-03 SC#1"
  - test: "U9 — Ratings persistence (live UI)"
    expected: "Thumbs up/down an answer in the browser, reload the run, re-rate (toggle/clear); rating persists across reload; a thumbs-down on a judge-PASSED answer is captured (human-judge disagreement signal for SI-01)"
    why_human: "Live click-through UI behavior + visual confirmation of persisted state; the API-level round-trip is already unit-tested, but the live browser flow is not"
---

# Phase 134: Eval Results, Honest Verdict + Ratings Verification Report

**Phase Goal:** After an eval run, the user can read an honest per-provider pass/fail verdict and a side-by-side with-skill vs without-skill comparison, and rate individual outputs to create a human preference signal.
**Verified:** 2026-07-02T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An eval run produces a per-provider pass/fail verdict the user can read, and a provider that errored shows an honest "not measured" state — never a fabricated score (EVAL-03, Roadmap SC#1) | VERIFIED | `_run_arm`'s D-04 gate (`backend/app/services/eval_runner_service.py:414-443`) grades ONLY `status=="completed" and output.strip()`; an errored/empty arm defaults `verdict_state="not_measured"`, `verdict_passed=None`, and the judge is never called. `pytest tests/test_eval_runner.py::test_errored_arm_not_measured` PASSED (asserts `_judge_eval_answer` `await_count==0`). `test_completed_arm_graded` and `test_judge_provider_independent` both PASSED. Frontend `verdictBadge()` (`SkillEvalSection.tsx:49-60`) renders PASS/FAIL only for `graded`, "not measured" for `not_measured`, "judge error" for `judge_error`. Live DB `eval_results_verdict_state_check` CHECK constraint independently confirms the 3-value enum (`graded`/`not_measured`/`judge_error`) is enforced at the schema level, not just in application code. |
| 2 | The user can read a side-by-side comparison of with-skill vs without-skill output for each test case (EVAL-03, Roadmap SC#2) | VERIFIED | `byCase` Map groups results by `test_case_id`; `VARIANTS.map` renders both "With skill" and "Without skill" arms per case (`SkillEvalSection.tsx:243-249,340-422`), each carrying the verdict badge, one-line truncated `verdict_reason`, and the raw `output`. Stays deliberately thin/undesigned (D-10) — only pre-existing `Button` + two new `lucide-react` icons imported, no new design-system chrome. |
| 3 | The user can rate individual eval outputs with thumbs up/down, and the rating persists as a human preference signal (EVAL-04, Roadmap SC#3) | VERIFIED | `PUT /{skill_id}/evals/results/{result_id}/rating` (`backend/app/api/evals.py:439-526`) owner-verifies then upserts/deletes. Live DB confirms `eval_ratings` table with `UNIQUE(eval_result_id,user_id)` (re-ratable/toggle) and `CHECK(rating IN ('up','down'))`. Frontend thumbs buttons (`SkillEvalSection.tsx:372-397`) call `handleRate` -> `rateEvalResult` -> re-`loadReadout` (durable re-read, no separate stale store). `pytest tests/test_evals_router.py::test_rating_round_trip` PASSED (up -> down -> null round-trips through the durable readout). |
| 4 | The accumulated ratings are queryable as a signal the self-improvement loop (Phase 135) can consume (EVAL-04, Roadmap SC#4) | VERIFIED | Live DB: `eval_ratings.eval_result_id` FK -> `eval_results.id` ON DELETE CASCADE confirmed. I independently executed the exact join Phase 135 will need (`eval_results LEFT JOIN eval_ratings ... WHERE verdict_passed IS TRUE AND rating='down'` — the human-judge-disagreement query) against the live local DB; it executed cleanly (0 rows, since no live ratings exist yet, but the query shape is proven to work against the real schema). |
| 5 | Verdict storage is additive, service-role-only, 3-value discriminator — no client write path (D-06, foundational to Truth 1's "honest") | VERIFIED | Live `:54322` query confirms all 5 verdict columns on `eval_results` (`verdict_state` NOT NULL DEFAULT `'not_measured'`, `verdict_passed`/`score`/`reason`/`judge_model` nullable) and 3 rollup columns on `eval_runs` (`passed_count`/`measured_count`/`verdict_summary`). `grep -nE "FOR INSERT\|FOR UPDATE\|FOR DELETE"` on the migration file for `eval_ratings` returns nothing — only one owner-only SELECT RLS policy exists (confirmed live via `pg_policies`, exactly 1 row). `grep -nE "db push\|db reset"` on the migration returns nothing (D-14 compliance). |
| 6 | The verdict is an automated LLM judge on an independent model, explicitly routed, grading BOTH arms — never the provider-under-test, never a heuristic (D-01/D-02/D-03) | VERIFIED | `_judge_eval_answer` (`eval_runner_service.py:179-254`) resolves `resolve_judge_model(settings)` and passes an EXPLICIT `provider=` kwarg to `forced_emit` — never `user_settings.active_provider`. `test_judge_provider_independent` PASSED, asserting the resolved provider is NOT the provider-under-test even when `active_provider` differs. Both `VARIANT_WITH` and `VARIANT_WITHOUT` route through the same `_run_arm` grading gate, so both arms are graded (not just one). |
| 7 | Ratings write is owner-gated; cross-user attempts 404 (never 403); user_id is never sourced from the request body (D-08/T-134-01/T-134-03) | VERIFIED | `rate_eval_result` owner-verifies `.eq("id", result_id).eq("user_id", user_id)` BEFORE any write, raising `HTTPException(404)` on a miss (`evals.py:466-487`). `pytest tests/test_evals_router.py::test_rating_cross_user_404` PASSED (asserts no `eval_ratings` row is written for the non-owner). `user_id` in both the upsert and delete payloads is sourced from `current_user["id"]`; `RateResultBody` carries only `rating`. Code review (`134-REVIEW.md`) independently traced this call chain and found no blockers. |
| 8 | Deep Mode stays byte-identical; the shared agent-loop/harness path is untouched (D-13 red line) | VERIFIED | `git diff --stat 2e45216b~1..94d6596a` (the full phase-134 commit range) shows ZERO touches to `backend/app/services/agent_loop.py` or `backend/app/services/harness/validator_kinds.py`. `git diff --quiet` on both exits 0. `pytest tests/test_eval_runner.py::test_deep_mode_byte_identical_guard` PASSED. On the frontend, the additive `eval_verdict` demux branch (`api.ts:851-852`) has NO `return` statement — the shared Deep/harness dispatch above it is untouched. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/081_eval_verdict_and_ratings.sql` | Verdict columns + rollup columns + eval_ratings table with owner-only RLS | VERIFIED | Exists, matches filename convention `<digits>_name.sql`, applied live (confirmed via independent psycopg2 query against `:54322`) |
| `supabase/full-schema.sql` | Regenerated bootstrap artifact including 081 DDL | VERIFIED | Contains `CREATE TABLE public.eval_ratings`, `verdict_state`, `passed_count`; last touched by commit `9f916a0d` (the live-DB dump regen, not a hand-edit) |
| `backend/app/services/eval_runner_service.py` | `_judge_eval_answer`, `EVAL_JUDGE_RUBRIC`, `EVENT_VERDICT`, inline grading in `_run_arm`, with-skill rollup at finalize | VERIFIED | All present and exercised by passing tests; read in full, logic traced manually |
| `backend/app/models/eval_run.py` | Single-typed verdict fields on `EvalResultResponse` + rollup fields on `EvalRunResponse` | VERIFIED (with info note) | Fields present and single-typed. Code review IN-01: these two response models are not wired via `response_model=` on any route (routes return raw dicts from `select("*")`) — informational only; does NOT affect the actual wire payload, since the raw dicts already carry the real DB columns (confirmed by data-flow trace below) |
| `backend/app/api/evals.py` | PUT ratings endpoint (owner-verify + upsert/clear) + rating merge in `get_eval_run` | VERIFIED | Read in full; IDOR gate, upsert/delete, and the `.in_()`-bound rating merge (post-WR-01-fix) all present |
| `backend/tests/test_eval_runner.py` | verdict/not_measured/rollup/judge-provider-independence + Deep byte-identical guard | VERIFIED | 11/11 tests pass, including all 4 named acceptance-criteria tests + the guard |
| `backend/tests/test_evals_router.py` | Ratings round-trip + cross-user 404 integration tests | VERIFIED | 2/2 tests pass (`test_rating_round_trip`, `test_rating_cross_user_404`) |
| `frontend/src/types/index.ts` | Verdict/rating fields on `EvalResult` + rollup fields on `EvalRun` | VERIFIED | All 6 `EvalResult` fields + 3 `EvalRun` fields present, correctly typed as narrow string-literal unions |
| `frontend/src/lib/api.ts` | `rateEvalResult()` + `onEvalVerdict` demux branch | VERIFIED | Both present; PUT targets the correct path; demux branch is additive with no `return` |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Verdict line + side-by-side pass/fail + reason + thumbs buttons | VERIFIED | All present and rendering off real state; WR-02 skill-switch race guard (`currentSkillRef`) confirmed present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `public.eval_ratings.eval_result_id` | `public.eval_results.id` | FK ON DELETE CASCADE | WIRED | Confirmed live: `eval_ratings_eval_result_id_fkey` |
| `public.eval_ratings.user_id` | `auth.users.id` (RLS) | owner-only SELECT `auth.uid()=user_id` | WIRED | Confirmed live: exactly 1 policy in `pg_policies`, SELECT-only |
| `eval_runner_service._run_arm` | `eval_runner_service._judge_eval_answer` | gated call after status/output computed, before `_persist_result` | WIRED | `status == "completed" and output.strip()` gate confirmed at line 423; `test_errored_arm_not_measured` proves the gate holds (0 judge calls on a failed arm) |
| `_judge_eval_answer` | `forced_emit(schema_model=JudgeVerdict, provider=<judge provider>)` | function-local import of `validator_kinds` (READ-ONLY) + explicit judge provider | WIRED | Confirmed at lines 195-236; `test_judge_provider_independent` proves the provider kwarg is the judge's, not the tested model's |
| `run_eval_job` finalize | `eval_runs.passed_count/measured_count/verdict_summary` | `_update_eval_run_status` extended payload (with-skill arms only, guarded by `final_status=="completed"`) | WIRED | Confirmed at lines 605-622; `test_rollup_counts` PASSED |
| `PUT rating` | `eval_results` owner-verify -> `eval_ratings` upsert/delete | `run_in_threadpool` service-role write, 404-not-403 | WIRED | Confirmed at lines 466-526; `test_rating_cross_user_404` PASSED |
| `get_eval_run` | `eval_ratings` (owner + run-scoped) merged onto each result as `r["rating"]` | second owner-scoped read, `.in_(eval_result_id, result_ids)` (WR-01 fix applied) | WIRED | Confirmed at lines 386-404; the WR-01 fix (bounding the read to this run's result ids, not the caller's full lifetime rating set) is present in the live source, not just claimed in the review |
| `SkillEvalSection` thumbs buttons | `rateEvalResult(skillId, resultId, rating)` -> `PUT .../rating` | then `loadReadout(rid)` — durable readout authoritative | WIRED | Confirmed at lines 230-238; `rid = runId ?? evalRun?.id` covers both the live and completed-on-mount cases (Rule-1 fix documented and present) |
| `SkillEvalSection` byCase readout | `r.verdict_state`/`r.verdict_passed`/`r.verdict_reason` | per-arm badge + one-line reason render | WIRED | Confirmed at lines 346-409 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SkillEvalSection` results list | `results` (state) | `loadReadout` -> `getEvalRun(skillId, rid)` -> `GET /skills/{id}/evals/runs/{run_id}` -> live Postgres `eval_results.select("*")` | Yes — real DB rows, not static/hardcoded | FLOWING |
| `SkillEvalSection` verdict line | `evalRun.passed_count`/`measured_count` | Same `getEvalRun` response -> `eval_runs` row written by `_update_eval_run_status` inside `run_eval_job`, computed from real `with_outcomes` accumulated from live `_run_arm` judge calls | Yes | FLOWING |
| `SkillEvalSection` thumbs active-state | `r.rating` | Same readout merge -> owner-scoped `eval_ratings` query (`.in_` bound to this run's result ids) | Yes | FLOWING |
| Live eval data currently in DB | `eval_results` (2 rows), `eval_runs` (1 row) | Confirmed by direct query: both rows dated 2026-06-30 (pre-Phase-134, from Phase 133's live UAT) — `verdict_state='not_measured'` here is the migration's column-default backfill, NOT evidence of the Phase 134 judge engine having run live yet | N/A (pre-existing residual data, not phase-134 evidence) | Noted — no live post-134 eval run exists in the DB yet; this is exactly what the deferred SC#10 UAT (below) will produce |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 081 physically applied to live local DB | Direct psycopg2 query against `:54322` for columns/constraints/table/RLS | 5 verdict columns + 3 rollup columns + `eval_ratings` table (FKs, UNIQUE, CHECK, RLS w/ 1 SELECT policy) all present | PASS |
| Eval-domain backend test suite | `cd backend && venv/Scripts/python -m pytest tests/test_eval_runner.py tests/test_evals_router.py -q` | `13 passed, 1 warning in 0.22s` | PASS |
| Deep Mode byte-identical (full phase commit range) | `git diff --stat 2e45216b~1..94d6596a -- backend/app/services/agent_loop.py backend/app/services/harness/validator_kinds.py` | empty output (no changes) | PASS |
| Frontend deploy-gate build | `cd frontend && npx vite build` | `built in 4.82s`, exit 0 | PASS |
| Frontend type-check regression check | `npx tsc -b` error output grepped for phase-134 files (`SkillEvalSection`, `lib/api.ts`, `types/index.ts`) | 0 matches (all 29 pre-existing errors are in unrelated files) | PASS |
| Ratings/verdict schema is queryable for Phase 135 | Direct SQL: `eval_results LEFT JOIN eval_ratings ... WHERE verdict_passed IS TRUE AND rating='down'` | Executes cleanly, 0 rows (no live ratings yet, but query shape proven against real schema) | PASS |
| All 11 claimed task commits exist | `git cat-file -t <hash>` for each of 2e45216b, 9f916a0d, 3c300930, 3a122173, 9c2599f8, 66620d03, 2e8c0837, 59fef2e9, a6079635, c39b2cf1, 94d6596a | all report `commit` | PASS |

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` files found in the repository and none declared in this phase's PLAN/SUMMARY files. This is a feature phase (backend service + API + frontend), not a migration-tooling/CLI phase that uses the probe convention.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EVAL-03 | 134-01, 134-02, 134-04 | Eval results include a per-provider pass/fail verdict and side-by-side output comparison the user can read in the UI — honest, no fabricated scores on error | SATISFIED | Truths 1, 2, 6 above |
| EVAL-04 | 134-01, 134-03, 134-04 | User can rate individual eval outputs (thumbs up/down) to create a human preference signal informing the self-improvement loop | SATISFIED | Truths 3, 4, 7 above |

No orphaned requirements — `REQUIREMENTS.md`'s Requirement Traceability table maps only EVAL-03 and EVAL-04 to Phase 134, and both are declared in at least one plan's frontmatter `requirements:` field (in fact declared redundantly across all 4 plans, consistent with the schema plan (134-01) and the frontend plan (134-04) each touching both requirements). `REQUIREMENTS.md` still shows both as unchecked `[ ]` / status "Pending" — this is expected and correct: per every plan SUMMARY, "STATE.md/ROADMAP.md/REQUIREMENTS.md intentionally NOT touched — the orchestrator owns those writes," and that update happens after verification passes, not before.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/models/eval_run.py` | 44-97 | `EvalRunResponse`/`EvalResultResponse` are defined but never wired via `response_model=` on any route (routes return raw dicts) | Info | No functional impact — the actual wire payload already carries the real DB columns via `select("*")` (confirmed in the data-flow trace); this is a maintainability note only (documented as IN-01 in 134-REVIEW.md, left unfixed by design) |
| `backend/app/services/eval_runner_service.py` | 437-443 | `resolve_judge_model` is re-resolved a second time in `_run_arm` solely to record `judge_model`, rather than `_judge_eval_answer` returning the model it actually used | Info | Deterministic today (no functional bug); latent divergence risk only if resolution becomes settings-mutable mid-run (documented as IN-02, left unfixed by design) |
| `frontend/src/components/skills/SkillEvalSection.tsx` | 115-132 vs 49-60 | The live `onEvalVerdict` SSE path renders the raw enum (`not_measured`) while the durable-readout `verdictBadge()` renders the humanized label ("not measured") — cosmetic mismatch mid-stream vs after refresh | Info | Cosmetic only, on the deliberately-undesigned `--skip-ui` surface superseded by Phase 137 (documented as IN-03, left unfixed by design) |

No debt markers (`TBD`/`FIXME`/`XXX`), no `TODO`/`HACK`/`PLACEHOLDER` stub markers, no `dangerouslySetInnerHTML`, no empty-handler stubs, and no hardcoded-empty-data anti-patterns found in any of the 7 phase-134-authored/modified source files. All three findings above are pre-existing code-review Info items (0 critical, 0 warnings remaining — both prior warnings WR-01 and WR-02 were fixed in commits `c39b2cf1` and `94d6596a`, independently confirmed present in the live source during this verification).

### Human Verification Required

The SC#10 4-axis mandatory live UAT (U1-U9) is authored in `134-VALIDATION.md` and was **deliberately deferred to this verification step** (D-12) rather than being run during plan execution — this is by design, not a gap. All 9 rows require either a live multi-provider LLM call, real-time concurrent streaming, or an actual browser click-through, none of which are observable via static analysis or the backend unit-test suite (which mocks the judge and the provider calls by design, per `134-VALIDATION.md`'s own "Test Infrastructure" section).

### 1. Cross-provider verdict honesty (OpenAI, Anthropic, Google, OpenRouter — U1-U4)

**Test:** Run an eval on a skill using a representative model from each of the 4 providers (one row per provider); observe the rendered verdict line and per-arm badges.
**Expected:** With/without arms grade; the judge (an independent model) renders a verdict; the verdict line reads "X/N passed"; for Anthropic specifically (U2), confirm the judge is NOT silently skipped/self-judged just because the tested model and the judge model share a vendor; for Google specifically (U3), confirm no Gemini `type:[...]` schema rejection breaks the verdict fields.
**Why human:** Requires live cross-provider API calls this verifier cannot make; rendering must be visually confirmed in the browser.

### 2. Multi-tool case grading (U5)

**Test:** Run a case whose prompt exercises 2+ tools (e.g., `search_documents` + `execute_code`) with-skill.
**Expected:** The multi-tool answer is graded by the judge; the verdict reflects the actual deliverable (not just the last message).
**Why human:** Requires a live agent-loop run with real tool execution.

### 3. Parallel-thread isolation (U6)

**Test:** Start an eval run on skill A while a normal chat thread B is actively streaming.
**Expected:** No cross-talk between the two streams; `eval_*`/`eval_verdict` events appear only on the eval run's buffer; both readouts (eval run + chat thread) remain correct.
**Why human:** Real-time concurrent-stream behavior cannot be verified from source alone.

### 4. Long-prompt / long-history grading (U7)

**Test:** Run a case with a >=5 KB prompt (or a long accumulated eval-thread context).
**Expected:** Grading completes without truncation of the verdict.
**Why human:** Requires a live long-context completion + judge call.

### 5. Intentional errored-arm honesty (U8 — the load-bearing row for EVAL-03 SC#1)

**Test:** Run a without-skill baseline on `claude-sonnet-5`, which is known to hit `BUG-260701-01` (assistant-prefill 400).
**Expected:** That arm renders "not measured" — never a fabricated PASS/FAIL score. The with-skill arm, if it completes, still grades normally. The rollup ("X/N passed") counts only measured cases.
**Why human:** This is the concrete proof that the D-04 honesty gate holds against a REAL provider error (not a mocked one in the unit-test suite) — the single most important UAT row for this phase's "honest" claim.

### 6. Ratings persistence in the live UI (U9)

**Test:** Click thumbs up/down on an answer in the browser, reload the run, then re-rate (toggle to the opposite thumb, then clear).
**Expected:** The rating persists across reload; re-rating updates the same row (not a duplicate); a thumbs-down on a judge-PASSED answer is captured (this is the human-judge-disagreement signal Phase 135/SI-01 will consume).
**Why human:** Live click-through UI behavior and visual confirmation of persisted state. The API-level round-trip is already unit-tested and passing (`test_rating_round_trip`), but the live browser flow — including the thumbs button visual active-state — has not been observed.

### Gaps Summary

No gaps found. All 8 observable truths are VERIFIED against the actual codebase (live database queries, passing tests I ran myself, source code read in full, and git history independently checked) — not inferred from SUMMARY.md claims. Both code-review warnings (WR-01 rating-read scoping, WR-02 skill-switch race guard) were confirmed FIXED in the live source, not just claimed fixed. The Deep Mode byte-identical red line holds across the entire phase commit range. Zero debt markers or blocking anti-patterns.

The phase goal's mechanics (honest verdict computation, honest error surfacing, side-by-side rendering, ratings persistence, ratings queryability) are all real and wired end-to-end at the code/schema/test level. What remains is the live, human-observable proof that these mechanics behave correctly under real multi-provider conditions and real browser interaction — this is the SC#10 4-axis UAT (U1-U9), which `134-VALIDATION.md` itself designed to run at this exact verification step (D-12), not earlier. This is a `human_needed` outcome by the phase's own design, not an execution shortfall.

Two known baseline cross-provider bugs (`BUG-260701-01`, `BUG-260630-01`) are intentionally NOT fixed by this phase — they are surfaced honestly via the `not_measured` mechanism (proven by Truth 1 and directly exercised by UAT row U8) and are formally deferred to `SEED-100`. This is by design (D-11), not a gap of this phase.

---

_Verified: 2026-07-02T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
