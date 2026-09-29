---
phase: 268-expert-spend-mid-thread-scope
fixed_at: 2026-09-28T21:45:27Z
review_path: .planning/phases/268-expert-spend-mid-thread-scope/268-REVIEW.md
iteration: 3
findings_in_scope: 8
fixed: 8
skipped: 0
seeded: 1
accepted: 2
status: all_fixed
---

# Phase 268: Code Review Fix Report

**Fixed at:** 2026-09-28T21:45:27Z (2026-09-29 local)
**Source review:** .planning/phases/268-expert-spend-mid-thread-scope/268-REVIEW.md
**Iteration:** 3, final and G-7-capped. Iteration 1: 5 fixed, 2 deferred. Iteration 2: fixed both after operator rulings D-268-27 / D-268-28. Iteration 3: re-review iteration 2 found 0 critical, 2 warning and 2 info; the operator ruled fast-fix WR-01, seed WR-02, accept IN-01/IN-02.
**Scope:** critical_warning (CR-01, WR-01 to WR-06). The six Info findings were not attempted.

**Summary:**
- Findings in scope: 8. Seven from the first review, plus re-review iteration 2's WR-01. Re-review WR-02 was seeded and IN-01/IN-02 accepted, by operator ruling.
- Fixed: 8 (CR-01, WR-01 to WR-06, and re-review WR-01). Each was driven RED first, then fixed GREEN, in separate commits.
- Seeded: 1 (re-review WR-02 → SEED-322).
- Accepted: 2 (re-review IN-01, IN-02).
- Skipped: 0.
- Not reproduced: 0.

Every fix was made in an isolated worktree and fast-forwarded onto `develop`:
- Iteration 1: `9c2be128d..41c1ea7a1`, 11 commits.
- Iteration 2: `6347014a5..ff148c13f`, 4 commits. It was based on the operator's D-268-27/28 commit.
- Iteration 3: `fcf90dee1..83c299583`, 4 commits. It was based on the committed re-review.

## Gates — iteration 3 (measured at `83c299583`)

- **Backend:** untouched in iteration 3, so no backend gate was run (per the ruling).
- **Frontend:**
  - Touched suites at `GSD_VITEST_MAX_WORKERS=2`: `src/components/chat` gives **54 files / 630 passed**. `src/lib/api` plus `src/lib/__tests__/apiBarrel.test.ts` give **10 files / 102 passed**.
  - `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` gives `total 9102 · failed 0 · pinned total 8354`, **count gate OK — 346/346 pinned files present, no per-file decrease, 0 failing**. Pins raised to the measured counts: `scopeCopy.test.ts 13 → 15` and `ChatArea.scopeChange.test.tsx 9 → 15`. The second includes iteration 1's +3, which that pass left unraised.
  - `npx tsc -p tsconfig.app.json --noEmit` reports **70 errors**, a set equal to base. No error is in a line this pass wrote. The two `lib/api.ts` errors, `FolderIndexRow` and `IndexSummary`, are pre-existing re-exports.
- **Registers:**
  - `node scripts/check-seeds-register.cjs` gives **seeds register gate OK — 329/329 parsed, 0 duplicate ids, 329/329 carry all 5 required keys**.
  - `node scripts/check-hot-file-ledger.cjs 268` gives ledger gate OK. Every touched file already carries a 268 cell.

## Gates — iteration 2 (measured at `ff148c13f`)

- **Backend baseline:** `node scripts/check-backend-unit-baseline.cjs` gives `71 failed, 5974 passed, 1 skipped, 2 xfailed, 2 xpassed`, **GATE PASSED**.
  - The failed SET is all 71 `268-BASELINES.md` ids.
  - `xfailed` is back to 2, because the WR-03 pin is now a passing test.
- **Frontend:**
  - Touched suites at `GSD_VITEST_MAX_WORKERS=2`: `src/components/admin/spend`, `AdminSpendPage.test.tsx`, `spendSummaryMapper.test.ts` and `expertThemeContrast.test.tsx` give **8 files / 95 passed**.
  - `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` gives `total 9097 · failed 0 · pinned total 8346`, **count gate OK — 346/346 pinned files present, no per-file decrease, 0 failing**. The new pins read exactly: `AdminSpendPage.test.tsx 38`, `expertSpendCopy.test.ts 10`, `spendSummaryMapper.test.ts 2`.
  - `npx tsc -p tsconfig.app.json --noEmit` reports **70 errors**, a set equal to base. The only delta against the RED commit was the 6 errors the RED tests themselves introduced, all gone.
- **Registers:** every file touched in iteration 2 already carries a 268 ledger cell, so no register edits were needed.

## Gates — iteration 1 (measured at `41c1ea7a1`)

- **Backend baseline:** `node scripts/check-backend-unit-baseline.cjs` gives `71 failed, 5966 passed, 1 skipped, 3 xfailed, 2 xpassed`, **GATE PASSED**.
  - The failed SET equals `268-BASELINES.md`'s 71 ids. Two ids only look different because of parsing: the baselines file truncates `test_no_unwrapped_sync_calls_in_route[async def upload_document(]` at the space, and a RuntimeWarning was glued onto the `test_harvest_files_storage_path_format` line.
  - `xfailed` goes from 2 to 3. The extra one is WR-03's strict-xfail pin (see below).
- **Frontend:**
  - `GSD_VITEST_MAX_WORKERS=2`-equivalent `--maxWorkers=2` over `src/components/chat` gives **54 files / 625 tests passed**.
  - `npx tsc -p tsconfig.app.json --noEmit` reports **70 errors**, the same as base. None are in a file this pass touched; the 4 ChatArea-named errors are the existing `ChatAreaMode.test.tsx` ones.
- **Registers:**
  - `node scripts/check-claude-md-size.cjs` passes (OK).
  - `node scripts/check-hot-file-ledger.cjs 268` passes (OK).
  - `runs.py`, `harness_engine.py` and `publish_service.py` were re-derived in both registers, in the same commit as their fix. Each carried no 268 cell before this pass.
- **Real-Postgres suites (:54322):** these all pass:
  - `test_268_continue_org.py`
  - `test_268_scope_patch_race.py`
  - `test_268_shell_org.py`
  - `test_268_two_org_rows.py`
  - `test_267_transcript_rows_rls.py`

## Fixed Issues

### CR-01: A Continue segment writes without the active org, so a two-org user's second Continue re-runs the first pause's tool calls

**Files modified:** `backend/app/api/runs.py` (plus ledger rows in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`)
**Commits:** RED `12ff2c3fc` · GREEN `8ea99f216`
**Status:** fixed
**Driven:** `backend/tests/integration/test_268_continue_org.py` runs on real Postgres:
- The subject is a two-org user whose run is stamped B. The sequence is pause, `continue_run`, pause again, `continue_run`.
- The test goes through the **real** `continue_run` and `spawn_continuation_run`. The stubbed loop writes with `agent_loop`'s own stamp expression, and a source pin holds that expression to the file.
- **RED at base:** `the second Continue re-drove ['call_1']`. The carrier C2 had landed in the trigger's org A.
- **GREEN:** Continue #2 consumes `call_2`. Every continuation-segment message and carrier is in B, and the next lookup returns `call_3`.

**Applied fix:** The Deep arm passes `{**current_user, "org_id": str(row["org_id"])}` into `spawn_continuation_run`. This is the run's own org, the same value the carrier lookup already reads. The change is one expression with no new branch. As a side effect, the Continue's scope resolution now sees the same org as the send path.

### WR-01: A scope read or pending note from a previous thread can land on the next thread's chip

**Files modified:** `frontend/src/components/chat/ChatArea.tsx`
**Commits:** RED `ad14cbf57` · GREEN `48a7fa8d1`
**Status:** fixed: requires human verification (a UI race, driven in jsdom only and not in Chrome)
**Driven:** three new cases in `ChatArea.scopeChange.test.tsx`, all RED at base:
- **(10)** Switch A→B while A's PATCH is in flight. B's chip showed A's `· not searched`.
- **(11)** A's streaming pending note appeared on B.
- **(12)** The note stuck after the run ended before the post-PATCH read resolved.

**Applied fix:** A `currentTidRef` (set in the existing `[thread?.id]` reset effect) gates every scope write that follows an await.
- `refreshScopeEffect` does not start a read for a thread that is off screen. Starting one would also bump the counter and drop the on-screen thread's own read.
- `applyScopeChange` still hands the server's thread to `onThreadUpdated`, then stops if the user switched away.
- The pending note is set only if that thread is still on screen and still streaming.

### WR-02: The folder PATCH is read → decide → write with no concurrency guard, so a transcript event can state a false "from"

**Files modified:** `backend/app/api/threads.py`, `backend/tests/unit/test_268_scope_patch.py` (fence updated deliberately)
**Commits:** RED `fdf608eea` · GREEN `4f1f37000`
**Status:** fixed
**Driven:** `test_268_scope_patch_race.py` runs on real Postgres, using the route's own `_apply_folder_change` / `_write_scope_change` under RLS:
- It simulates the second of two racing PATCHes: the database already holds Y, and the route's read is pinned to the stale X.
- **RED at base:** a `scope_changed` event was committed, built from X, and the thread was moved to Z.
- A control with a current read commits exactly one event.

**Applied fix:**
- `_write_scope_change` takes `expected_folder_id` and makes the UPDATE `… AND folder_id IS NOT DISTINCT FROM $4::uuid`.
- If 0 rows update, it raises `ScopeChangeConflict` before the event INSERT, so the transaction writes nothing. The route answers **409 "The folder changed while you were choosing. Try again."**
- The D-268-12a fence `test_the_folder_arm_region_raises_no_409` was **updated deliberately**. It now uses AST to allow exactly one 409, reachable only from `except ScopeChangeConflict`. Any other 409 in the folder arm still fails it, so streaming and `cap_paused` are still never refused.
- **Partial, by decision:** the no-event arm (a thread with no messages) is unchanged. It writes no durable record that a race could falsify, and a conditional there would need the PostgREST update to report its row count. That is recorded here rather than done silently.

### WR-04: An unnameable folder becomes "all your documents" in the model note, and two unnamed folders suppress it

**Files modified:** `backend/app/services/scope_note.py`
**Commits:** RED `e5a6f7272` · GREEN `8d5aa47eb`
**Status:** fixed
**Driven:** three new cases in `test_268_scope_history_note.py`:
- An unnameable `from` read "all your documents" (RED).
- Two different unnameable folders dropped the note (RED).
- A round trip to the same unnameable folder says nothing. This was green at base and is kept as a guard.

**Applied fix:**
- Each side of a change is now a `_Side`. A `None` ref means all documents. A ref with an `id` but no `name`/`path` is labelled "a folder that cannot be named here" and compared **by id**. Nameable sides compare by label, as before.
- The note's words are unchanged: `scope_history_note` and its pinned string are untouched.
- The module still never reads the payload's `expert` key.

### WR-06: Harness re-drive, resume and golden shells (and their sub-agents) still take the trigger's guessed org

**Files modified:** `backend/app/api/runs.py`, `backend/app/services/harness_engine.py`, `backend/app/services/harness/publish_service.py` (plus ledger rows in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`)
**Commits:** RED `b18d59b12` · GREEN `41c1ea7a1`
**Status:** fixed: requires human verification (the Continue and golden-run sites are held by the fence only. The resume site is driven on real Postgres.)
**Driven:**
- A new fence case in `test_268_insert_run_sites.py`: every ROOT `insert_run(` must pass `org_id` or be named with a reason.
  - RED named exactly `api/runs.py:1`, `services/harness_engine.py:1` and `services/harness/publish_service.py:1`.
- `test_268_shell_org.py` runs the **real** `_build_resume_context` on real Postgres.
  - RED: the shell landed in the trigger's A, not the workflow run's B.

**Applied fix:**
- **Harness Continue** (`runs.py`): the existing RLS `workflow_runs` select gains `org_id`, and the shell passes it.
- **Resume** (`harness_engine.py`): the run-org read the builder already did, to scope its service-role client, **moved** above the INSERT. The shell passes it.
- **Golden run** (`publish_service.py`): the shell passes `_golden_run_org_id`, the definition org that `_resolve_publish_supabase` already returns and scopes the client by. The validation ctx still withholds `org_id`, so the Phase 190 fence is unchanged.
- The disposition map is unchanged. The new `_ORG_LESS_ROOT_JUSTIFIED` map names only `api/evals.py:1-3`, as a **known gap outside this finding**: an eval's thread and run both take the trigger's org.
- **Also named, not fixed:** the golden run's ephemeral validation thread and its `workflow_runs` row still take the trigger's org.

### WR-03: A scope change made while a run is `cap_paused` applies to the Continue, but the model is never told

**Files modified:** `backend/app/services/agent_loop.py`, `backend/tests/unit/test_267_tool_floor_union.py` (harness stub only)
**Commits:** RED `7bfe123b1` · GREEN `8c1dbd7e6` (iteration 2, after operator ruling **D-268-27**; the iteration-1 strict-xfail pin was `1037bfcf8`)
**Status:** fixed
**Driven:**
- The iteration-1 pin (user → paused assistant segment → cap carrier → `scope_changed`) had already reproduced the defect: 0 messages carried the note.
- It is now a real test. With `resuming=True`, the last message is exactly `{"role": "user", "content": scope_history_note(...)}`, it is the only message carrying the note, and the earlier user message is untouched.
- Edge cases:
  - an event followed by a user message adds no extra turn;
  - nothing pending adds nothing;
  - a held trailing change adds nothing.
- An AST call-site pin requires the loop's one `_reconstruct_history(` call to pass `resuming=ctx.resume_dropped_tool_calls`.
- RED at base: four cases raised `TypeError` (no Continue mode existed), and the call-site pin failed on an assertion.
- 268-04's `test_an_event_with_no_following_user_message_emits_nothing` is kept, and its docstring now states it holds for the non-Continue (default) path only.

**Applied fix:**
- `_reconstruct_history` gains a keyword-only `resuming: bool = False`. When it is true and the fold still has a note pending after the last row, it appends **one** synthetic `{"role": "user", "content": <scope_note.py words>}` turn at the end. It is never system-role, it never rewrites an earlier user message, and the send path is byte-identical.
- The synthetic turn lands before the Continue's pre-dispatched `assistant(tool_calls)` → `tool` messages, so the sequence stays valid for every provider.
- No identifier contains "expert", and the AST fence stays green.
- `test_267_tool_floor_union.py`'s stand-in for `_reconstruct_history` had the old signature and raised `TypeError` on the new keyword (9 cases). The stand-in was widened to `**_kw`; no assertion changed.

### WR-05: A root counted as "unrated / excluded from the total" now adds its sub-agents' USD to the total

**Files modified:**
- Backend: `backend/app/db/rates.py`, `backend/app/api/admin_spend.py`
- Frontend: `frontend/src/types/spend.ts`, `frontend/src/lib/api/spend.ts`, `frontend/src/components/admin/spend/expertSpendCopy.ts`, `frontend/src/components/admin/spend/BlindSpotsCard.tsx`, `frontend/src/pages/admin/AdminSpendPage.tsx`
- Tests and gate: `scripts/vitest-count-gate.cjs`, plus test files

**Commits:** RED `8b1d61275` · GREEN `ff148c13f` (iteration 2, after operator ruling **D-268-28**)
**Status:** fixed
**Driven:** reproduced on real Postgres in iteration 1 (filtered to one Expert: `rated 0 · unrated 1 · total 0.0001`, where `0.0001` is the sub-agent's price). RED cases:
- **Real Postgres** (`test_268_spend_rollup_pg.py`): R8, the unrated `unknown` shell with a priced sub-agent S8, counts as exactly **1** partly priced harness run, and R6, a rated root with an unpriced sub-agent, does not. Filtered to E3 it reads `(unrated 1, partly 1)` with the total still S8's price. Filtered to E1 it reads 0.
- **Unit:** the dataclass carries the field, and it defaults to 0 for older mock rows.
- **Route:** the summary payload carries `partly_priced_harness_runs`.
- **Frontend:**
  - the fenced copy (1 case);
  - a new wire-mapper suite `spendSummaryMapper.test.ts` (2 cases, added to both count-gate knobs in the same commit);
  - the Unrated tile note and the KPI footnote (2 cases, one a guard that is green at base).

**Applied fix:**
- `per_root` gains `BOOL_OR(is_box_shell)` and `priced_subagents`. The totals query counts `partly_priced_harness_runs` = shell roots with no rate of their own and at least one priced sub-agent. **No pricing change (D-268-21).**
- The count rides the summary payload → `SpendSummaryData.partlyPricedHarnessRuns`.
- The Unrated tile and the KPI footnote render `EXPERT_SPEND_COPY.partlyPricedHarness(n)`, which reads *"N harness runs partly priced — sub-agent costs included, orchestrator cost not"* (singular "1 harness run"). `expertThemeContrast` is untouched, because no new component file was added.
- **Scope, per the ruling's literal words:** only **harness placeholder** roots are counted. An unrated **Deep** root whose sub-agents run on a rated model has the same shape, but no copy was ruled for it, so it is named here rather than folded in.

### Re-review WR-01 (iteration 2): The new 409 refusal tells the user the chat "still searches" a folder that is no longer in effect

**Files modified:** `frontend/src/components/chat/ChatArea.tsx`, `frontend/src/components/chat/ScopePicker.tsx`, `frontend/src/components/chat/scopeCopy.ts`, `frontend/src/lib/api/threads.ts`, `frontend/src/lib/api.ts`, plus `scripts/vitest-count-gate.cjs` (pins)
**Commits:** RED `d25fecdc5` · GREEN `c00b36ed5` · pins `5a5fe7e8c`
**Status:** fixed
**Driven:** new jsdom cases in `ChatArea.scopeChange.test.tsx`. Each test uses a real list owner that feeds `onThreadUpdated` back into the thread prop. All were RED at base, which showed *"Couldn't change the folder. … This chat still searches /Client ACME."* with the chip stuck on the stale folder.
- **(13)** The PATCH 409s and the server's folder is now Q3. The chip shows `/Client ACME/Q3 Contracts`, the refusal names it, the effect is re-read, and there is still exactly one PATCH.
- **(14)** The held variant, under a Restricted Expert, says the folder is "saved for when HR Advisor leaves".
- **(15)** When the re-read fails, the refusal claims no folder.
- `scopeCopy.test.ts` pins the three sentences and a `getThread` wire case.

**Applied fix:**
- A new `getThread(id)` client call (`GET /threads/{id}`, the existing owner-scoped route), re-exported from the barrel.
- On a 409, the one scope PATCH home (`applyScopeChange`):
  - re-reads the thread;
  - hands it to the list owner through the same `onThreadUpdated` path as a success;
  - re-reads the effect, gated by iteration 1's `currentTidRef`;
  - throws a `ScopeConflictError` whose message is the finished sentence.
- The sentences, in `scopeCopy.ts`:
  - "The folder changed while you were choosing — this chat now searches {current}. Pick again."
  - The held variant: "… {current} is now saved for when {expert} leaves. Pick again."
  - When the re-read fails: "The folder changed while you were choosing. Pick again."
- `ScopePicker` shows a `ScopeConflictError` message as-is and never appends the "still searches" line. Every other refusal keeps its old wording. There is no new PATCH and no backend change.

## Skipped Issues

None. Both iteration-1 deferrals were fixed in iteration 2 after the operator's rulings (D-268-27, D-268-28).

## Seeded and accepted (iteration 3, operator ruling under G-7)

- **Re-review WR-02 → SEED-322 (planted, commit `83c299583`).** An unrated **Deep** root whose sub-agents run on a rated model is still labelled "excluded", while its sub-agent USD is in the total. D-268-28's partly-priced disclosure covers harness shells only. `trigger_paths`: `backend/app/db/rates.py` and `frontend/src/components/admin/spend/**`. Both fix options are recorded in the seed.
- **Re-review IN-01, accepted.** `_Side.same_as` compares a named side and an unnameable side of the same folder id as different. At most this emits one extra note for a net no-op round trip; it never drops a note.
- **Re-review IN-02, accepted.** On a Continue whose carrier is not found under the run's org (for example, a carrier written before CR-01), `dropped_tool_calls` is empty and the synthetic note turn becomes the last message the model sees. A cap pause always writes dropped calls, so this needs a pre-CR-01 carrier.

## Notes for the orchestrator

- **Not done:** `graphify update .` was not run. It rewrites the tracked `graphify-out/`, which this pass must not commit, and the main tree already carries an unrelated `graphify-out/GRAPH_REPORT.md` modification.
- **New suites:** three new integration files and the extended unit files are all under `backend/tests`. None are frontend suites, so the vitest count gate's pins are unaffected. `ChatArea.scopeChange.test.tsx` gained 3 cases, an increase and never a decrease.

---

_Fixed: 2026-09-28T21:45:27Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
