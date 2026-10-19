---
phase: 289-the-run-page-and-its-evidence
fixed_at: 2026-10-19T20:25:59Z
review_path: .planning/phases/289-the-run-page-and-its-evidence/289-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 289: Code Review Fix Report

**Fixed at:** 2026-10-19T20:25:59Z
**Source review:** .planning/phases/289-the-run-page-and-its-evidence/289-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, WR-01..WR-06; the eight IN-* findings are outside `critical_warning`)
- Fixed: 8
- Skipped: 0

**Method (orchestrator rule: drive before fixing).** Every finding was first reproduced by a test that failed RED, committed as `test(289-REVIEW): … RED`, then fixed and committed as `fix(289-REVIEW): …`. All eight reproduced; none was `no_change_needed`. The work ran on the main tree (`develop`), as the orchestrator directed, with every commit made by path and checked with `git show --stat HEAD`. The operator's unrelated files were never staged: `.claude/settings.local.json`, `.mcp.json`, `graphify-out/`, the two seam286 `.snap` files (still line-endings only, verified with `--ignore-cr-at-eol`), `.omc/`, `scratch/` and `screenshots/`.

**Verification per fix.** Targeted suites only. Backend suites that touch the resume path ran under the local-DB lock with `-p no_run_sweeps`, A/B'd against HEAD's version of the touched file so that the failing *set* could be compared. The frontend ran with `GSD_VITEST_MAX_WORKERS=2`. `npx tsc -p tsconfig.app.json --noEmit` stayed at **63 errors, identical set** after every frontend fix. `check-hot-file-ledger.cjs` reported OK and `check-claude-md-size.cjs` reported OK after every commit. Every touched hot file's triple was re-derived and updated, with its `docs/HOT-FILE-LEDGER.md` section, in the same commit as the fix.

## Fixed Issues

### CR-01: A masked source's content still reaches the colleague through `output_text`

**Files modified:** `backend/app/services/run_evidence.py`, `backend/app/api/workflow_run_evidence.py`, `backend/tests/unit/test_289_run_evidence.py`, `289-VALIDATION.md`, `289-03-PLAN.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** 62b8b292f (RED), 33f51fe01 (fix)
**Applied fix:** This follows the orchestrator's decision. `compose_phase_log` now takes the same `readable_ids` set as `compose_sources`. A non-owner whose step cited any document they cannot read gets `WITHHELD_OUTPUT_SENTENCE` ("This step's output draws on a document you don't have access to.") in place of `output_text`. An RLS-check failure withholds every citing step, so it fails closed. The owner path is unchanged, and a step with no masked citation keeps its text. The RED test's step output carries the private document's title, and the test asserts that title is absent from the colleague's JSON. T-289-31 is now "mitigated (masked citations) / accept (remainder)" in the plan-03 threat model and in VALIDATION S4. The originals are struck through, not deleted.
**Status:** fixed: requires human verification (a privacy rule). This was **not re-driven live**. Residual, recorded rather than claimed closed: a later step that cites nothing but builds on a withheld step's output still ships its text. The same holds for the step after an R-04-withheld human answer.

### CR-02: A card that already counted down to "expired" never comes back when the run turns `paused`

**Files modified:** `frontend/src/components/panel/PendingAskCard.tsx`, `frontend/src/components/panel/__tests__/PendingAskCard.paused.test.tsx`, `PendingAskCard.retired.baseline.test.tsx` (exact line pin 1043 → 1053, re-baselined in place), `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** 3032fc08b (RED), 467fe84ab (fix)
**Applied fix:** I added one `useEffect` and no new state (`useState` stays 7, `useEffect` goes 2 → 3). When `paused` is true and the card expired on the client clock (`expiredMessage === null`), the card returns to `pending`, which is the live-answer layout. A server-driven expiry (404/409) stays terminal, and a test pins that. The RED test mounts with `paused={false}`, advances the clock past the deadline, then re-renders with `paused`. `WorkflowRunPage.tsx` is untouched.
**Status:** fixed: requires human verification (state handling). Text typed before the clock expiry is not restored, because the clock arm still settles the draft.

### WR-01: The `_build_resume_context` failure arm strands the minted producer shell

**Files modified:** `backend/app/services/harness_engine.py`, `backend/tests/unit/test_289_redrive_failure.py`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** 19f3fc0e8 (RED), 3ed3357f9 (fix)
**Applied fix:** The `insert_run` of the `streaming` shell moved to the end of `_build_resume_context`, after every fallible step: the org-requiring `get_service_role_supabase`, scope resolution, settings and the ctx model. The org is still resolved before the insert (268-REVIEW WR-06). I chose this over a finalize-on-raise wrapper because a wrapper would have made two `inspect.getsource(_build_resume_context)` negative fences pass vacuously. The RED commit's precondition (`len(inserted) == 1`) was restated in the fix commit as the invariant itself: no `streaming` shell is ever left un-finalized. Two raise cases cover it, both RED against the unfixed engine (proven by swapping HEAD's file back in). A success-path pin checks that the build still mints exactly one shell in the run's org. A/B over five resume suites: 0 new failures. The 23 failures in both runs are inherited.

### WR-02: `_fail_redrive` is check-then-act, so it can audit `run_failed` on a run that ended `cancelled`

**Files modified:** `backend/app/api/runs.py`, `backend/tests/unit/test_289_redrive_failure.py`, `backend/tests/unit/test_256_finish_run_unchanged.py` (call-site position 589 → 605; per-file count unchanged at 1), `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** d190594f7 (RED), ca1e54df7 (fix)
**Applied fix:** One conditional `UPDATE workflow_runs SET status='failed' WHERE id=$1 AND status='active' RETURNING id` is now the guard. Only its winner writes the phase failure, the audit and a new `run_failed` emit, which goes to the resumed producer's stream (or the run's own) the way the engine's fail arm does. `finish_run` still follows for its thread-anchor clear: the call is idempotent on `failed` and its md5 pin is untouched. RED tests cover a Stop landing before the terminal write and the missing emit.
**Status:** fixed: requires human verification (a concurrency guard).

### WR-03: The evidence report counts "checks" that never ran

**Files modified:** `backend/app/services/run_evidence.py`, `frontend/src/components/workflows/evidenceView.ts`, `frontend/src/components/workflows/evidenceVocabulary.ts`, `backend/tests/unit/test_289_run_evidence.py`, `frontend/src/components/workflows/evidenceView.test.ts`, `docs/HOT-FILE-LEDGER.md`
**Commits:** c0b0f9e8e (RED), b7d7e2c3c (fix)
**Applied fix:**
- A `gate_failed` whose metadata `error` starts with `wall_clock_timeout` now composes as `gate_timed_out`. It is a composed kind, so `VERDICT_KINDS` is unchanged. Its result is `recorded` and its `checked` list is empty, and it reads "The step timed out before its checks ran".
- The Checks fact now counts each step's final attempt per check family (gate or emit), so a fail-then-pass retry reads "1 of 1 passed".
- Section 3 still lists every attempt.

**Status:** fixed: requires human verification (counting logic).

### WR-04: `kb_search_calls` counts refused searches

**Files modified:** `backend/app/services/search_documents_tool.py`, `backend/app/services/task_service.py`, `backend/tests/unit/test_289_phase_confidence.py`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** 2e89758a8 (RED), 30b6e6036 (fix)
**Applied fix:** The search tool now owns `REFUSED_SEARCH_ERRORS` and a pure `ran_retrieval(tr)` predicate for its two refusal arms. The counter in `task_service` increments only when that predicate is true, using a lazy import. The RED test drives the tool's real `_invalid_filter` and `_refused_retry` results and asserts that `phase_confidence` yields `None`, not "nothing matched". A/B over 23 related unit suites: 0 new failures. The `search_documents_tool.py` scan-list row was stale (`4 / 1 / 1163`) and has been re-derived.
**Status:** fixed: requires human verification (classification logic).

### WR-05: `?run=` is never cleared when the deep-linked run is still live

**Files modified:** `frontend/src/components/layout/ChatLayout.tsx`, `frontend/src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx` (new file), `scripts/vitest-count-gate.cjs`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** c389992a1 (RED), 925d1e76b (fix)
**Applied fix:** ChatLayout gained one `useEffect` that calls `clearRunDeepLink()` whenever `activeView !== "workflow-run"`. Every other query param is kept. The new suite renders the real ChatLayout with a live-run stub and goes RED on "Back to Workflows". Count gate: the new suite is pinned at 2 and listed file-level in TARGETS. Two pins were raised to the focused-run actuals: `PendingAskCard.paused` 4 → 6 and `evidenceView` 29 → 31. The `scripts/vitest-count-gate.cjs` ledger row was stale and has been re-derived.

### WR-06: An answered paused run whose definition cannot load stays stranded

**Files modified:** `backend/app/api/runs.py`, `backend/tests/unit/test_289_redrive_failure.py`, `backend/tests/unit/test_256_finish_run_unchanged.py` (position 605 → 618; count unchanged), `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** 14597954a (RED), 16e648201 (fix)
**Applied fix:** The `definition is None` arm now reuses `_fail_redrive` with `from_statuses=("paused",)` and the reason "Your answer was saved, but the workflow could not be loaded.". The run ends `failed` with that phase reason, a `run_failed` audit and emit, and its anchor cleared. It never flips to `active`. The guard SQL (`status = ANY($2::text[]) … RETURNING id`) was bound against real local Postgres inside a rolled-back transaction, using random ids so no rows were touched. With this, the restored "continues as soon as they answer" sentence no longer promises an outcome that this arm silently drops.
**Status:** fixed: requires human verification. **Owed, not fixed:** the `claim_run` False arm, when a dead worker's lease is still inside its window, has the same shape, and only the boot sweep re-drives it after the lease expires.

## Inherited reds seen (not caused by these fixes)

- `tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added` and `tests/test_harness_resume.py::test_sweep_reruns_active_phase`: red with and without each change (A/B).
- Resume-suite A/B (WR-01): 23 failures present at HEAD and after.
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx`: 4 failures. The suite imports neither ChatLayout nor anything touched here, and both it and its subject are provably unmodified.

## Not run (left to the verifier)

- The full backend unit baseline.
- The full vitest count gate. Per-file counts for the three changed or new suites were read from focused runs.

---

_Fixed: 2026-10-19T20:25:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
