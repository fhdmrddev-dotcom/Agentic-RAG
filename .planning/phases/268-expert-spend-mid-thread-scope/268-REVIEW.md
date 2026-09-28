---
phase: 268-expert-spend-mid-thread-scope
reviewed: 2026-09-29T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - backend/app/api/admin_spend.py
  - backend/app/api/threads.py
  - backend/app/db/rates.py
  - backend/app/db/runs.py
  - backend/app/models/message.py
  - backend/app/models/thread.py
  - backend/app/services/agent_loop.py
  - backend/app/services/expert_scope.py
  - backend/app/services/run_lifecycle.py
  - backend/app/services/run_producer.py
  - backend/app/services/scope_note.py
  - backend/app/services/tool_dispatcher.py
  - supabase/migrations/197_runs_expert_attribution.sql
  - backend/tests/integration/test_268_two_org_rows.py
  - frontend/src/components/admin/spend/AttributionDisclosures.tsx
  - frontend/src/components/admin/spend/BlindSpotsCard.tsx
  - frontend/src/components/admin/spend/ExpertFilterPills.tsx
  - frontend/src/components/admin/spend/ExpertSpendCard.tsx
  - frontend/src/components/admin/spend/expertSpendCopy.ts
  - frontend/src/components/chat/ActiveExpertChip.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/ExpertEventCard.tsx
  - frontend/src/components/chat/expertEventCopy.ts
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/ScopeChip.tsx
  - frontend/src/components/chat/scopeCopy.ts
  - frontend/src/components/chat/ScopePicker.tsx
  - frontend/src/components/experts/ScopeLedger.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/api/spend.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/pages/admin/AdminSpendPage.tsx
  - frontend/src/types/spend.ts
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 268: Code Review Report

**Reviewed:** 2026-09-29
**Depth:** standard (268 hunks against `220c82dde`, with call sites traced where a 268 change depends on them)
**Files Reviewed:** 33
**Status:** issues_found

## Summary

I reviewed the 268 diff: migration 197, the `insert_run` stamp and parent copy, the `per_root` spend CTE and its
Expert filter, the folder PATCH, the `scope-effect` route and the `scope_changed` event, the D-268-26 history note,
the D-268-20 Continue token sum, and the chat and `/admin/spend` UI.

**Things that hold up:**
- The Expert filter is always passed as a `$N` parameter and never built into the SQL string. The route also checks
  its format and lowercases it first.
- The folder PATCH authorizes the folder against the thread's org, and it checks the folder row's own org as well.
- The `per_root` CTE reaches sub-agent rows only through a root in the org. The Expert-name join is limited to the
  org.
- Continue token sums run in the `finally`, so every exit path gets them.
- The D-268-26 note goes into user-message content, never into a mid-history system row.
- I checked for double counting at the harness kickoff root (it finalizes NULL tokens) and at the placeholder shells.
  Neither double counts.

**One blocker.** D-268-22 now stamps the send path's run row with the active org. The Deep Continue path writes its
rows with a `current_user` that has no `org_id`, so for a two-org user a second cap-pause writes its carrier row
into the org the trigger guesses. The next Continue then reads the **first** pause's carrier and runs its old,
already-dropped tool calls again. This is a regression: before 268, the run row and the carrier both came from the
trigger and agreed.

## Critical Issues

### CR-01: A Continue segment writes without the active org, so a two-org user's second Continue re-runs the first pause's tool calls

**File:** `backend/app/services/agent_loop.py:1985`, `:2025`, `:2771` (the D-268-22 stamps); root cause at the call site `backend/app/api/runs.py:1405` → `backend/app/services/run_producer.py:870` (`spawn_continuation_run`)

**Issue:** The three D-268-22 stamps read `current_user.get("org_id")`. On the send path that key is set
(`threads.py:1549-1551`). On the Continue path it is not: `continue_run` passes the plain `get_current_user` dict
(`{"id", "email"}`, `dependencies.py:370`) into `spawn_continuation_run`, which puts it on the `RunContext`. So
during a Continue segment the assistant message, the system warnings and a **re-pause carrier** all fall back to the
mig-106 trigger's `LIMIT 1` guess.

For a two-org user whose run 268 now stamps into org B:
1. The first pause writes carrier C1 into B (correct, send path).
2. Continue #1 runs in B (`load_cap_paused_tool_calls(org_id=B)` finds C1). It pauses again and writes carrier C2
   into the trigger's org A.
3. Continue #2 runs `load_cap_paused_tool_calls(pool, thread, org_id=B)` with `ORDER BY created_at DESC LIMIT 1`
   (`db/runs.py:182-193`). That returns **C1**, not C2. The continuation re-drives C1's already-executed dropped tool
   calls (possibly `execute_code` or connector writes), and C2's calls are lost.

The continuation's assistant message also lands in org A while its run is in B, which is the split D-268-22 was
meant to prevent. `test_268_two_org_rows.py` only covers the first pause's carrier, so it cannot see this.

**Fix:** Give the Continue path the run's own org, the same value its carrier lookup already uses:
```python
# backend/app/api/runs.py (continue_run, Deep arm)
_cont_org_id = row.get("org_id")
...
await spawn_continuation_run(
    run_id=run_id,
    thread_id=thread_id,
    current_user={**current_user, "org_id": str(_cont_org_id)} if _cont_org_id else current_user,
    ...
)
```
Add a two-org integration case: pause, Continue, pause again. Then assert that C2 is in B and that the second
`load_cap_paused_tool_calls(org_id=B)` returns C2's calls.

## Warnings

### WR-01: A scope read or pending note from a previous thread can land on the next thread's chip

**File:** `frontend/src/components/chat/ChatArea.tsx:274-285`, `:608-635`
**Issue:** `refreshScopeEffect` drops stale answers by request counter only, not by thread. `applyScopeChange`
awaits `setThreadFolder(tid, …)` and then calls `refreshScopeEffect(tid)` for the thread it started on. If the user
switches from thread A to B during that await, B's mount read (req N) is replaced by A's post-PATCH read (req N+1).
A's `ScopeEffect` then drives B's chip, including `held` / `· not searched`. The streaming branch has the same
problem: `setScopePendingNote(...)` runs after `await effect` and can put A's "answer in progress keeps…" note on B.
The note can also stick if the run ends before `await effect` resolves: the `isStreaming → false` clear at `:295`
has already run.
**Fix:** Key the guard on the thread as well as the counter, and check it before any state write that follows an
await:
```ts
const currentTidRef = useRef<string | null>(null)
useEffect(() => { currentTidRef.current = thread?.id ?? null }, [thread?.id])
// in refreshScopeEffect .then/.catch:
if (req === scopeReqRef.current && currentTidRef.current === tid) setScopeEffect(effect)
// in applyScopeChange, after each await:
if (currentTidRef.current !== tid) return
// and only set the pending note if the thread is STILL streaming at that moment:
if (useStreamsStore.getState().streamingThreads.has(tid)) setScopePendingNote(...)
```

### WR-02: The folder PATCH is read → decide → write with no concurrency guard, so a transcript event can state a false "from"

**File:** `backend/app/api/threads.py:1042-1080` (`_apply_folder_change`), `:1015` (`_write_scope_change` UPDATE)
**Issue:** `old_folder` comes from a separate read, the event is built from it, and the UPDATE is
`WHERE id = $1 AND user_id = $2` with no condition on the current `folder_id`. Say two PATCHes race (two tabs, or a
retry after a slow response). Both read X; one writes "X → Y", the other "X → Z"; the thread ends on Z. The second
card now says "Scope X → Z" when the real move was Y → Z, and its `dropped` line is computed against the wrong
side. The D-268-26 fold then gives the model a `from` that was never in effect. The event is the durable record of
the change (SC: "survives reload"), so this is a correctness problem, not only a display one.
**Fix:** Make the UPDATE conditional on the value the event was built from, and treat 0 rows as a conflict:
```python
status = await conn.execute(
    "UPDATE public.threads SET folder_id = $3::uuid ... "
    "WHERE id = $1::uuid AND user_id = $2::uuid AND folder_id IS NOT DISTINCT FROM $N::uuid",
    ..., UUID(str(old_folder)) if old_folder else None,
)
if status.endswith(" 0"):
    raise HTTPException(409, "The folder changed while you were choosing. Try again.")  # txn rolls back the INSERT too
```
Apply the same condition to the no-event `aexec(...update(update_data))` arm.

### WR-03: A scope change made while a run is `cap_paused` applies to the Continue, but the model is never told

**File:** `backend/app/services/agent_loop.py:1118` together with `backend/app/services/scope_note.py:74-83`
**Issue:** D-268-23 lets the change apply to the Continue, and `spawn_continuation_run` does re-resolve scope. The
note is only collected by `ScopeNoteFold.take()` when a later **user** row is emitted. A Continue adds no user row,
so a `scope_changed` event after the paused segment is never collected, and the resumed model gets no note. That
model has the paused segment's old-scope tool results in context. This is the SEED-319 failure (answering from
dropped-folder results in history) on the one path D-268-23 names.
**Fix:** After the loop in `_reconstruct_history`, if the fold still has something pending, attach it to the
**last** user message in `messages`. That keeps the no-system-row rule. Alternatively, have the continuation append
the note to the resumed turn's content. Add a RED case: user → assistant(cap_paused carrier) → scope_changed →
reconstruct, and assert the note is present.

### WR-04: An unnameable folder becomes "all your documents" in the model note, and two unnamed folders suppress it

**File:** `backend/app/services/scope_note.py:52-58`, `:81`
**Issue:** `_path(ref)` returns `ref.get("path") or ref.get("name") or None`. A `ScopeFolderRef` for a folder the
caller cannot see has `id` set with `path`/`name` None (`models/message.py` "None = a folder the caller cannot
see"). `_label(None)` returns `"all your documents"`. The note therefore tells the model the thread searched
everything when it searched a specific folder. Two different unnameable folders both give `"all your documents"`,
so the `_label(src) == _label(dst)` check at `:81` drops a note for a real change. The same collapse happens when the
`from` ref is None only because the folder was deleted.
**Fix:** Tell "no ref" apart from "a ref with no name", and compare by id:
```python
def _path(ref):
    if not isinstance(ref, dict):
        return None                       # no folder → all documents
    return ref.get("path") or ref.get("name") or f"\x00unnamed:{ref.get('id')}"
# _label: map the sentinel to "a folder you can no longer see"; compare ids, not labels, in take()
```

### WR-05: A root counted as "unrated / excluded from the total" now adds its sub-agents' USD to the total

**File:** `backend/app/db/rates.py:176-190` (`per_root`), `:523-530` (totals); disclosure in `frontend/src/components/admin/spend/BlindSpotsCard.tsx:170`
**Issue:** `per_root.cost_usd = SUM(cost_usd)` over root plus sub-agents, while `input_cost_per_million` (which
decides rated/unrated) is the **root's** alone. A harness placeholder root (`model='unknown'`) has no rate, so it
counts in `unrated_runs_count`, and `excludedFromTotal` on the page counts it as excluded. Its priced sub-agents'
USD is still in `total_spend_usd`, `window_total_usd` and its Expert line. The Unrated tile says those runs "are
excluded from org dollar totals rather than falsely priced", which is now partly false. The KPI's "rated + unrated
= every root; priced = rated − unmeasured" arithmetic also stops describing where the dollars come from. The donut
has a related skew: every token of a shell's work lands on the `unknown` slice (the member filter drops sub-agent
tokens), while the dollars land on the sub-agents' models.
**Fix:** Pick one meaning and state it. Either (a) classify a root whose own rate is NULL but which has priced
members as "partially priced" and count it separately from `unrated`, or (b) keep the counters and change the
tile/KPI copy to say an unrated harness shell's sub-agent spend is included. Add a test with a placeholder root and
one priced sub-agent that pins whichever wording is chosen.

### WR-06: Harness re-drive, resume and golden shells (and their sub-agents) still take the trigger's guessed org

**File:** `backend/app/db/runs.py:91-102` (the parent copy), call sites `backend/app/api/runs.py:1172`, `backend/app/services/harness_engine.py:2795`, `backend/app/services/harness/publish_service.py:1623`
**Issue:** D-268-07 fixed the send path only. These three root INSERTs pass no `org_id`, so for a two-org user the
shell lands in the `LIMIT 1` org. The parent copy then moves **every** sub-agent under it into the same wrong org. A
re-driven harness's spend (the sub-agent USD from WR-05) therefore shows in the other org's `/admin/spend` cockpit.
That is the exact G-6 failure mode named in CONTEXT ("Expert spend appears in the wrong org's cockpit"), now through
the shell path. `runs.py:1172` is inside an authenticated request where the org is known, and the resume sweep can
read `workflow_runs.org_id`.
**Fix:** Pass `org_id=` at all three sites from the workflow run's own org (`wf_row["org_id"]` /
`run["org_id"]`), which is the org the harness already scopes by. Extend `test_268_insert_run_sites.py`'s
disposition fence so an org-less root INSERT has to be justified.

## Info

### IN-01: Folder names authored by other org members now reach the model as user-role text
**File:** `backend/app/services/scope_note.py:31-49`
**Issue:** `_label` removes brackets and line breaks and caps the length at 120, which prevents the note from being
closed or a new line being started. Org-shared folder names, though, are written by other members and now appear
inside a user turn ("…from /Ignore prior instructions and…"). The risk is low, but it is an injection path that did
not exist before.
**Fix:** Consider quoting the path (`"…"` with quotes removed from the name) and adding "folder names are data" to
the note, or refer to folders by a stable neutral label when the folder is not owned by the caller.

### IN-02: The note's "from" is "all your documents" even when a Biased Expert limited the search
**File:** `backend/app/services/scope_note.py:44-49`
**Issue:** With a Biased Expert and no thread folder, `used()` is the Expert's folders only (D-267-35), yet the note
says the change was "from all your documents". This is harmless but not accurate.
**Fix:** Build `from`/`to` from `payload["dropped"]`/`payload["now"]` rather than from the raw folder refs, or leave
the `from` clause out when an Expert was active.

### IN-03: Audit `folder_ids: []` does not distinguish "unscoped" from "empty scope"
**File:** `backend/app/services/tool_dispatcher.py:848`, `:965`
**Issue:** `ctx.folder_subtree_ids or []` records `[]` both when there was no filter (`None`) and when the scope was
empty. An SC#3-style ⊆ proof over this metadata cannot tell "searched everything" from "searched nothing".
**Fix:** Record `None` as `null`: `[...] if ctx.folder_subtree_ids is not None else None`.

### IN-04: The Expert-filtered coverage count uses a thread-level EXISTS
**File:** `backend/app/db/rates.py:560-571`
**Issue:** With a filter, a `workflow_runs` row counts toward every Expert that has **any** run in its thread (any
time, sub-agents included). After a mid-thread swap, the per-Expert "incomplete coverage" figures overlap and do not
add up to the unfiltered figure. The comment says this approximation is deliberate, but the tile does not say so.
**Fix:** Add `AND r.parent_run_id IS NULL` and the window predicate to the EXISTS, or disclose the overlap in the
tile.

### IN-05: The picker's draft and preview can drift if the saved folder changes while it is open
**File:** `frontend/src/components/chat/ScopePicker.tsx:94`, `:127-132`
**Issue:** `draft` is set once from `saved`, but the mount effect re-requests the **at-rest** preview whenever
`saved` changes (for example, a thread update from another tab). The ledger then shows the at-rest effect while the
tree still highlights the older draft, and Apply stays enabled for a draft whose effect is not the one shown.
**Fix:** When `saved` changes, reset `draft` to it (or keep the draft and re-request the draft preview).

### IN-06: Dead org-less branch in `_authorize_thread_folder`
**File:** `backend/app/api/threads.py:991-1003`
**Issue:** `threads.org_id` is `NOT NULL` (`full-schema.sql:2928`), so the `org is None` → `set()` path and the
`or ""` comparison never run. `_write_scope_change` would also fail on `UUID(str(None))` if they did.
**Fix:** Drop the branch, or assert `thread_org_id` so a future nullable column fails loudly.

---

_Reviewed: 2026-09-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
