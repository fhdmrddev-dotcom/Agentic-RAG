---
phase: 268-expert-spend-mid-thread-scope
reviewed: 2026-09-29T00:00:00Z
depth: standard
iteration: 2
scope: "fix commits 9c2be128d..6bdef87a8 (CR-01, WR-01..WR-06)"
files_reviewed: 14
files_reviewed_list:
  - backend/app/api/admin_spend.py
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/db/rates.py
  - backend/app/services/agent_loop.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness_engine.py
  - backend/app/services/scope_note.py
  - frontend/src/components/admin/spend/BlindSpotsCard.tsx
  - frontend/src/components/admin/spend/expertSpendCopy.ts
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/lib/api/spend.ts
  - frontend/src/pages/admin/AdminSpendPage.tsx
  - frontend/src/types/spend.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 268: Code Review Report (iteration 2, re-review of the fix commits)

**Reviewed:** 2026-09-29
**Depth:** standard. The scope is the hunks in `git diff 9c2be128d..HEAD`, with call sites traced where a fix depends on them. The tests those commits added or changed were read to check they can actually fail.
**Files Reviewed:** 14 source files, plus the fix commits' tests
**Status:** issues_found

## Summary

All seven iteration-1 findings were checked against the code itself, not against the fixer's report.

| Finding | Verdict | Evidence |
|---|---|---|
| CR-01 | **Closed** | `runs.py:1420` passes `{**current_user, "org_id": row.org_id}`. The only other `run_agent_loop` entry points are the send producer and the eval runner, so no Deep re-entry path is left without the org. I drove `test_268_continue_org.py` against simulated pre-fix behaviour (a pytest plugin that removes `org_id` before `spawn_continuation_run`). It fails at `consumed[1] == ["call_2"]`, so the test can fail. |
| WR-01 | **Closed** | `currentTidRef` is set in the reset effect, which is declared **before** the re-read effect, so it is current when the refresh runs. Every state write after an await is gated. A stale write that lands before the passive effects flush is cleared by the reset effect. |
| WR-02 | **Closed, but it adds a new defect (WR-01 below)** | The conditional `UPDATE … IS NOT DISTINCT FROM $4` sits inside `get_user_pg_connection`'s transaction. `ScopeChangeConflict` is raised before the event INSERT and becomes a 409. Under READ COMMITTED, a concurrent loser re-checks the committed row and matches 0 rows. The race suite on real Postgres has a control case. |
| WR-03 | **Closed** | `resuming` is the boolean `ctx.resume_dropped_tool_calls`, which is set `True` only at `run_producer.py:954`. The synthetic user turn is appended after the history and before the pre-dispatched `assistant(tool_calls)` → `tool` messages, so the tool_use/tool_result pairing stays valid for OpenAI, Anthropic and Gemini. The send path is unchanged. |
| WR-04 | **Closed** | `None` still means "all your documents", because `_scope_ref(None)` stays `None`. An id-only ref gets the unnameable label and is compared by id. |
| WR-05 | **Only partly closed (WR-02 below)** | The CTE count is correct. `BOOL_OR(is_box_shell)` is the root's own flag, `priced_subagents` matches `cost_usd`'s NULL rule, and there are no ambiguous column references in the three joined queries. The disclosure covers harness shells only. |
| WR-06 | **Closed** | All three shell sites pass the workflow run's org. The resume org read only moved above the INSERT and its meaning did not change. The new root-site fence passes, and `evals.py` is named as a known gap. |

Gates I ran myself:
- Targeted backend unit tests: 110 passed.
- The four new or extended real-Postgres suites: 15 passed on :54322.
- The touched frontend suites: 8 files, 94 passed.

No blockers. Two warnings:
- The WR-02 fix adds a 409 whose refusal text names the losing folder as the one in effect.
- The WR-05 disclosure leaves out the non-harness form of the same mispricing, which the fixer named.

## Warnings

### WR-01: The new 409 refusal tells the user the chat "still searches" a folder that is no longer in effect

**File:** `backend/app/api/threads.py:1099-1104` (the new 409). The false sentence is built at `frontend/src/components/chat/ScopePicker.tsx:139,160` and `frontend/src/components/chat/scopeCopy.ts:52-53`. No refresh happens at `frontend/src/components/chat/ChatArea.tsx:620-627`.

**Issue:** The 409 fires only when the thread's folder is no longer the one this client last saw. Another tab or request has already moved it from X to Y. On that refusal:
- `applyScopeChange` re-throws without refreshing the thread.
- `ScopePicker` shows `SCOPE_COPY.refusal(reason, savedLabel)`, where `savedLabel` comes from the stale `savedFolderId` (X).

The picker therefore says: *"Couldn't change the folder. The folder changed while you were choosing. Try again. This chat still searches X."* That sentence is false in every case where this 409 is reachable, since the thread searches Y. The chip also keeps showing X until something else refetches the thread.

The durable record stays correct: a retry is re-read on the server and writes "Y → Z". The user-facing statement is wrong, though, and this path did not exist before the WR-02 fix.

**Fix:** On a scope-PATCH refusal, reconcile before stating the reason. Fetch the thread, hand it to the list owner and re-read the effect, so `savedFolderId` (and therefore `savedLabel`) is the winner's folder:
```ts
// ChatArea.applyScopeChange
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    const fresh = await getThread(tid).catch(() => null)
    if (fresh) { onThreadUpdated?.(fresh); if (currentTidRef.current === tid) void refreshScopeEffect(tid) }
  }
  throw new Error(...)
}
```
Alternatively, have the 409 detail carry the current folder and give the refusal copy a conflict-specific variant that names it. Add a case: 409 → the refusal names Y, not X.

### WR-02: WR-05 is closed only for harness shells. An unrated Deep root with priced sub-agents is still labelled "excluded" while its sub-agent USD is in the total

**File:** `backend/app/db/rates.py:545-550` (the `partly_priced_harness_runs` filter requires `pr.is_box_shell`). Copy at `frontend/src/components/admin/spend/BlindSpotsCard.tsx:173` ("excluded from org dollar totals").

**Issue:** `per_root.cost_usd` sums every priced member, and `rates.py`'s own header says a sub-agent "may run on the provider's FAST default", which is a different, rated model. So a Deep root on a model with no registered rate, with sub-agents on a rated default, has this shape:
- It counts in `unrated_runs_count`, which the Unrated tile and the KPI "* … unrated excluded" footnote both describe as excluded from the total.
- Its sub-agents' USD **is** in `total_spend_usd`, `window_total_usd` and its Expert line.

That is iteration-1 WR-05's defect, still present for this population. The fixer named this gap ("no copy was ruled for it"), so it is not hidden. But D-268-28's wording covers only harness placeholder roots, so the page still makes a false "excluded" claim for these runs. The same condition is reachable by any user who picks a newly added model before an operator registers its rate.

**Fix:** This needs an operator ruling, because the copy is operator-ruled. Two options:
- (a) Widen the count to `pr.input_cost_per_million IS NULL AND pr.priced_subagents > 0`, dropping the `is_box_shell` requirement, and give the copy a non-harness wording ("N unrated runs partly priced — sub-agent costs included").
- (b) Keep the harness-only count and add a second counter for non-shell roots.

Either way, add a real-Postgres fixture with an unrated non-shell root that has one priced sub-agent, and assert it is disclosed.

## Info

### IN-01: `_Side.same_as` treats a named side and an unnameable side as different even when they are the same folder id

**File:** `backend/app/services/scope_note.py:98-103`

**Issue:** The fold takes `from` from the first event and `to` from the last. Each event snapshots names against the visibility at the time it was written. So for A→B then B→A, where A became unnameable to the caller between the two writes, the fold compares `path="…/A"` against `unnamed_id=A`. It returns "different" and emits a note for what is really a net no-op. This is low impact, since it produces an extra note and never a missing one.

**Fix:** When both sides carry an id, compare by id first and fall back to labels only when an id is missing. That requires `_Side` to keep `ref["id"]` for named refs as well.

### IN-02: On a Continue with no loaded dropped calls, the synthetic note becomes the model's final prompt

**File:** `backend/app/services/agent_loop.py:1129-1132` together with `:2121`

**Issue:** The trailing note turn is appended whenever `resuming` is true. The pre-dispatch that normally follows it runs only `if ctx.resume_dropped_tool_calls and ctx.dropped_tool_calls`. A cap pause always has dropped calls when it is written (`force_no_tools and tool_calls_buffer`). But `load_cap_paused_tool_calls` returns `[]` when the carrier is not found under the run's org. That can happen for a carrier written before the CR-01 fix, which is in the trigger's org. In that case the message list ends on `user: "[Search scope changed …]"`, and the model answers the note instead of resuming. The note is also re-sent on every later Continue of the same run. That repeat is harmless, but it is not stated anywhere.

**Fix:** Append the tail note only when there is something to resume into (`resuming and ctx.dropped_tool_calls`). Alternatively, place it before the last assistant row. In either case, add a case with `dropped_tool_calls=[]` to pin the behaviour.

---

_Reviewed: 2026-09-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 2, fix-commit scope)_
