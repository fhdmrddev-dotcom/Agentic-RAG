# Phase 092: Dual-Mode Wiring + Continue Button - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 12 concerns (backend run-path + migration + frontend)
**Analogs found:** 11 with concrete analog / 12 (1 net-new: the Deep-run "consume dropped tool calls" continuation)

This is a WIRING phase. Almost every concern has a faithful in-repo analog and the risk strategy is "match the analog exactly." Two patterns carry the most regression risk:
- **SC#3 — per-thread keyed Map/Set** (never a global boolean). Analog is verbatim copy-then-mutate.
- **SC#2 — lock-clear in the SAME transaction** as the terminal-status write (no dangling lock).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/db/workflows.py` (`create_workflow_run`) | db helper | CRUD / transactional | `backend/app/db/runs.py` (`insert_run`) + `db/workflows.py` (`complete_phase`, `claim_run`) | exact (same file + sibling) |
| `backend/app/api/threads.py` (producer mode-branch, ~1049) | api / producer | request-response | the current `run_agent_loop` call site (threads.py:1049) | exact (same site) |
| `backend/app/api/runs.py` (cancel lock-clear, ~702) | api | request-response | `cancel_run` zombie-heal UPDATE (runs.py:702-709) + `finalize_run` (db/runs.py:91) | exact (same fn) |
| `backend/app/api/runs.py` (`POST /runs/{id}/continue`) | api / route | request-response | `submit_ask_user_response` POST (runs.py:496) + `cancel_run` ownership SELECT (runs.py:633) | role-match (same file) |
| `backend/app/services/agent_loop.py` (persist buffer at cap, ~1842) | service | event-driven | the current drop site itself (agent_loop.py:1842-1856) | exact (the site being changed) |
| `backend/app/api/threads.py` (`GET /threads/{id}/workflow`) | api / route | request-response | `get_pending_ask_user` GET (panel.py:103) + get_snapshot ownership (threads.py:341) | exact (same shape) |
| `supabase/migrations/063_dual_mode_continue.sql` | migration | DDL | `062_workflow_run_claim_lease.sql` | role-match (column add; 063 also alters CHECKs) |
| `frontend/src/providers/StreamsProvider.tsx` (per-thread lock Map) | provider / store | event-driven | `_addRunToThread`/`_removeRunFromThread` (:717-748) + `useStreamingForThread` (:1886) | **exact (BUG-260523-01 fix)** |
| `frontend/src/components/chat/MessageInput.tsx` (Deep/Harness toggle) | component | request-response | agent-mode selector (MessageInput.tsx:238-272) | exact (same idiom) |
| `frontend/src/lib/api.ts` (`continueRun`, `getThreadWorkflow`) | client | request-response | `cancelRun` (:857) + `getThreadPendingAsks` (:740) + `postMessage` (:338) | exact |
| `frontend/src/lib/api.ts` (`cap_paused` SSE callback) | client | event-driven / SSE | the SSE dispatch switch (api.ts:600-616) | exact (same switch) |
| `frontend/src/components/chat/MessageItem.tsx` (Continue card) | component | event-driven | the Resume button host (MessageItem.tsx:341-352) | exact (additive sibling) |

---

## Pattern Assignments

### `create_workflow_run` in `backend/app/db/workflows.py` (db helper, transactional CRUD)

**Analog:** `backend/app/db/runs.py:insert_run` (single INSERT idiom) + `backend/app/db/workflows.py:complete_phase` / `claim_run` (JSONB + `pool.fetchrow` in-file idiom).

**asyncpg single-INSERT idiom** (`db/runs.py:52-66`):
```python
await pool.execute(
    """
    INSERT INTO runs (run_id, thread_id, user_id, status, model, provider,
                      spawned_by_worker, parent_run_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """,
    run_id, thread_id, user_id, status, model, provider,
    spawned_by_worker, parent_run_id,
)
```

**JSONB write idiom — plain dict → `json.dumps(...)` + `$N::jsonb`** (`db/workflows.py:240-244`):
```python
await pool.execute(
    "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1",
    phase_id,
    json.dumps(output),
)
```
NOTE: `db/runs.py` relies on a pool-level JSONB codec (passes plain dicts); `db/workflows.py` does NOT — it uses explicit `json.dumps(...)` + `$N::jsonb`. **For the new helper, mirror `db/workflows.py`** (`json.dumps(inputs)` + `$3::jsonb`) since it lives in that file. There is NO `async with pool.acquire() as con, con.transaction():` block anywhere in `db/workflows.py` today — every existing write is a single statement. The multi-write transaction is net-new mechanics (see below).

**RETURNING idiom** (`db/runs.py:137-147` — fetchval returns the new id):
```python
return await pool.fetchval(
    """INSERT INTO messages (...) VALUES (...) RETURNING id""",
    ...,
)
```

**`$N` discipline + module security contract** (file header, `db/workflows.py:19-22`): "the engine runs as service role (bypasses RLS). Every run-keyed query is scoped by `workflow_run_id` (owner-scoped through the workflow_runs → threads.user_id FK chain); the engine never accepts a run_id it did not receive from the owning thread's producer spawn." **Replicate this RLS invariant: the new helper trusts a `thread_id` the route already ownership-checked (threads.py:341 pattern); owner-scoping lives UPSTREAM in the route, never in the service-role helper.**

**Replicate this:** mirror `db/workflows.py` style — typed kwargs, `$N` placeholders only, `json.dumps(...)+$N::jsonb` for the `inputs` column, `pool.fetchval(... RETURNING id)` for the new run id. **NEW mechanics:** wrap the three writes (INSERT workflow_runs → loop INSERT workflow_phases → UPDATE threads) in `async with pool.acquire() as con: async with con.transaction():` and use `con.execute`/`con.fetchval` (not `pool.*`) inside — FK ordering forces workflow_runs INSERT before the threads UPDATE (Landmine 9). The `con.transaction()` block has no exact in-repo precedent in these two files — it is standard asyncpg; flag for the planner as the one net-new mechanic in an otherwise faithful copy.

---

### Producer mode-branch in `backend/app/api/threads.py` (api / producer, request-response)

**Analog:** the CURRENT `run_agent_loop` call site (threads.py:1049-1056), inside the `try` at :1037.

**Current call site** (threads.py:1038-1056):
```python
ctx = RunContext(
    run_id=run_id,
    thread_id=thread_id,
    current_user=current_user,
    user_settings=user_settings,
    body=body,
    redis=redis,
    supabase=supabase,
    resolved_model=_resolved_model,
    resolved_provider=_resolved_provider,
)
_agent_loop_result = await run_agent_loop(
    ctx,
    emit=_emit,
    emit_terminal=_emit_terminal,
    spawn=_spawn,
    timeout_ctx=_timeout_ctx,
    result_sink=_result_sink,
)
```

**Replicate this:** the `if active_workflow_run_id is not None:` branch slots ABOVE this `run_agent_loop` call, inside the SAME `try` (threads.py:1037). The Deep (`else`) branch stays this exact `RunContext(...) + run_agent_loop(...)` call BYTE-IDENTICAL. The Harness branch must NOT pass `RunContext` — it builds the loose engine ctx (Landmine 7: `run_workflow` takes a SimpleNamespace-style bag with `run_id/thread_id/current_user/redis/pool/emit/retry_feedback`, mirror `_build_resume_context` at harness_engine.py:559-579). The surrounding `except asyncio.TimeoutError / CancelledError / Exception` + `finally: _shielded_finalize` (threads.py:1064-1122+) STAYS mode-agnostic — do NOT touch it. The mode branch is purely additive at this one site; NEVER inside provider streaming branches (075.x cascade rule).

---

### Cancel lock-clear in `backend/app/api/runs.py` (api, request-response)

**Analog:** the `cancel_run` zombie-heal UPDATE (runs.py:702-709) for the direct-write case + `db/runs.py:finalize_run` (:91-109) for the happy-path terminal txn.

**Zombie-heal terminal UPDATE** (runs.py:703-709) — extend this statement to also clear the anchor:
```python
await aexec(
    supabase.table("runs").update({
        "status": "cancelled",
        "error": "cancelled_by_user",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("run_id", str(run_id))
)
```

**Happy-path terminal write** (`db/runs.py:91-101`) — the producer's `_shielded_finalize` calls this; the lock-clear must ride here for a live cancel:
```python
await pool.execute(
    """
    UPDATE runs
    SET status = $2, error = $3, completed_at = $4,
        message_id = $5, input_tokens = $6, output_tokens = $7
    WHERE run_id = $1
    """,
    run_id, status, error, completed_at, message_id, input_tokens, output_tokens,
)
```

**Cancel idempotency guard** (runs.py:650) — `cap_paused` must fall THROUGH this (it is non-terminal, so cancellable):
```python
if row["status"] in ("completed", "failed", "cancelled", "timed_out"):
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**Replicate this:** add `UPDATE threads SET active_workflow_run_id = NULL WHERE active_workflow_run_id = <run/workflow-run>` in the SAME transaction/statement as the terminal-status write — happy path: extend `finalize_run` (db/runs.py) inside its existing single UPDATE or add a sibling statement in the SAME `con.transaction()`; zombie-heal: extend the runs.py:703 supabase UPDATE chain. DO NOT add `cap_paused` to the runs.py:650 terminal set (it must remain cancellable). Landmine 5: trace the TWO run rows (runs + workflow_runs) so the lock-clear fires exactly once. Harness terminal path: extend `harness_engine.finish_run` (db/workflows.py:285-295) to clear the anchor in its UPDATE, keeping WRITE-before-EMIT order.

---

### `POST /runs/{run_id}/continue` in `backend/app/api/runs.py` (api / route, request-response)

**Analog:** `submit_ask_user_response` POST route (runs.py:496-...) for the signature/auth/body shape; `cancel_run` ownership SELECT (runs.py:633-645) for the 404 idiom.

**Route signature + body + auth deps** (runs.py:496-503):
```python
@router.post("/{run_id}/ask_user_response", status_code=200)
async def submit_ask_user_response(
    run_id: UUID,
    body: AskUserResponseBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
```

**Ownership SELECT → 404 (never 403 — don't leak existence)** (runs.py:633-645):
```python
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**Replicate this:** `@router.post("/{run_id}/continue", status_code=200)`, same 3 deps, same ownership SELECT (also fetch `continues_used`). Refuse (clean 200 message or 409) when `continues_used >= max_continues_per_run` (config knob, D-06). Increment `continues_used` transactionally. For re-registering the continuation run (RUN_TASKS + ZADD sorted sets + SSE re-attach), mirror the run-spawn block at threads.py:871-890. Deep vs Harness branch per RESEARCH Q1. The "spawn a continuation that pre-loads dropped tool calls" body is NET-NEW — see "No Analog" below.

---

### Persist buffered tool calls at the cap in `backend/app/services/agent_loop.py` (service, event-driven)

**Analog:** the current drop site itself (agent_loop.py:1842-1856) — this is the exact code that must change from DROP to PERSIST.

**Current drop site** (agent_loop.py:1842-1856) — `tool_calls_buffer = {}` DESTROYS them today:
```python
if force_no_tools and tool_calls_buffer:
    _dropped_count = len(tool_calls_buffer)
    _tool_names = [tc.get("name", "?") for tc in tool_calls_buffer.values()]
    logger.warning(
        "iteration_cap_dropped_tool_calls run=%s iteration=%d dropped=%d tool_names=%s",
        run_id, iteration, _dropped_count, _tool_names,
    )
    await _emit(redis, run_id, 'system_warning',
                kind="iteration_cap_dropped_tool_calls",
                message=f"⚠ Reached iteration limit — didn't run the last {_dropped_count} tool(s) the model requested.")
    _persisted_system_warnings.append({
        "kind": "iteration_cap_dropped_tool_calls",
        "message": f"⚠ Reached iteration limit — didn't run the last {_dropped_count} tool(s) the model requested.",
    })
    tool_calls_buffer = {}   # belt-and-suspenders — skip the tool execution round
```

**Carrier-row persistence shape to mirror** — the durable `role='system'` row with `tool_calls` jsonb (runs.py:531-543, the ask_user_response insert):
```python
supabase.table("messages").insert({
    "thread_id": ..., "user_id": ..., "role": "system",
    "content": body.response_text,
    "tool_calls": [{ "kind": "ask_user_response", "tool_call_id": ..., ... }],
})
```

**Replicate this:** BEFORE `tool_calls_buffer = {}`, persist the buffered `tool_calls_buffer.values()` (names + args + ids) durably — attach them to the `_persisted_system_warnings` carrier with `kind="iteration_cap_paused"` and the tool_calls payload (A1: reuse the `messages.tool_calls` jsonb on the `role='system'` carrier row — same shape as ask_user_prompt/response rows, which `db/workflows.py:get_pending_ask_user` proves is queryable out-of-band). Set `runs.status = 'cap_paused'` instead of finalizing `completed` when a Continue is offered (Landmine 8 — scope strictly to the cap-with-dropped-tools case; Deep WITHOUT a cap-drop stays byte-identical). Emit a DISTINCT non-terminal `cap_paused` SSE event (NOT a terminal sentinel — Landmine 6) carrying tool names + `continues_used`/`continues_remaining`. Mirror the existing `await _emit(redis, run_id, 'system_warning', kind=..., message=...)` call shape for the new event.

---

### `GET /threads/{thread_id}/workflow` in `backend/app/api/threads.py` (api / route, request-response)

**Analog:** `get_pending_ask_user` GET (panel.py:103-132) for the thread sub-resource GET shape (ownership gate → asyncpg pool joined read) + get_snapshot ownership (threads.py:341-350).

**Thread sub-resource GET: ownership gate → asyncpg pool read** (panel.py:103-122):
```python
@router.get("/ask_user/pending")
async def get_pending_ask_user(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    await _verify_thread_ownership(thread_id, current_user, supabase)
    pool = await get_pg_pool()
    rows = await pool.fetch(
        """SELECT ... FROM messages m WHERE m.thread_id = $1 ... """,
        thread_id,
    )
```

**Ownership SELECT (supabase-py maybe_single → 404)** (threads.py:341-350):
```python
thread_resp = await aexec(
    supabase.table("threads").select("id")
    .eq("id", str(thread_id)).eq("user_id", current_user["id"]).maybe_single()
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

**Replicate this:** `@router.get("/{thread_id}/workflow")` returning the `ThreadWorkflowState` Pydantic model (RESEARCH Q3, defined in `backend/app/models/thread.py`). Ownership-gate first (threads.py:341 idiom), then `pool = await get_pg_pool()` joined read of `threads.active_workflow_run_id → workflow_runs → workflow_phases`. PURE READ — never writes (lock-clear is owned by cancel/terminal); compute `lock_is_stale` diagnostically. `$N` placeholders only.

---

### Migration `063_dual_mode_continue.sql` (migration, DDL)

**Analog:** `supabase/migrations/062_workflow_run_claim_lease.sql` (column-add style) — but 063 ALSO drops+recreates two CHECK constraints (062 did not). For the CHECK-recreate style, mirror the idempotent `IF NOT EXISTS` / explicit drop-then-add discipline.

**Column-add + idempotent + comment style** (062:26-33):
```sql
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;  -- nullable, default NULL

COMMENT ON COLUMN public.workflow_runs.claimed_at IS
  'Resume CAS lease (Phase 091 CR-01): ...';
```

**Header doc-block convention** (062:1-24): a `-- NNN_name.sql` title line, a PROBLEM/FIX narrative, an "Idempotent (ADD COLUMN IF NOT EXISTS) — safe to paste-replay" note, and "Apply via the Supabase SQL editor (per CLAUDE.md — never `supabase db push`/`db reset`)."

**Replicate this:** filename `063_dual_mode_continue.sql` (digits-underscore — letter suffixes silently skipped). DDL per RESEARCH "Migration (063)": `ADD COLUMN IF NOT EXISTS inputs jsonb NOT NULL DEFAULT '{}'::jsonb`, `model text`, `continues_used integer NOT NULL DEFAULT 0` on `workflow_runs`; `continues_used` on `runs`; drop+recreate `workflow_runs_status_check` to include `cap_paused`; drop+recreate `runs_status_check` to include `cap_paused`. Header doc-block + COMMENT ON COLUMN per 062. NO `supabase db push` task — apply via SQL editor, then `bash scripts/regenerate-full-schema.sh`.

---

### Per-thread lock state in `frontend/src/providers/StreamsProvider.tsx` (provider / store, event-driven) — HIGHEST RISK (SC#3)

**Analog:** `_addRunToThread` / `_removeRunFromThread` (StreamsProvider.tsx:717-748) — the BUG-260523-01 per-thread keyed Map copy-then-mutate helpers + `useStreamingForThread` selector (:1886).

**Copy-then-mutate per-thread keyed helpers** (StreamsProvider.tsx:717-748):
```typescript
function _addRunToThread(
  current: Map<string, Set<string>>,
  threadId: string,
  runId: string,
): Map<string, Set<string>> {
  const next = new Map(current)
  const innerCur = next.get(threadId) ?? new Set<string>()
  const inner = new Set(innerCur)
  inner.add(runId)
  next.set(threadId, inner)
  return next
}

function _removeRunFromThread(
  current: Map<string, Set<string>>,
  threadId: string,
  runId: string,
): Map<string, Set<string>> {
  const innerCur = current.get(threadId)
  if (!innerCur || !innerCur.has(runId)) return current
  const next = new Map(current)
  const inner = new Set(innerCur)
  inner.delete(runId)
  if (inner.size === 0) {
    next.delete(threadId)   // GC: drop the key when its Set empties
  } else {
    next.set(threadId, inner)
  }
  return next
}
```

**Thread-keyed selector idiom** (StreamsProvider.tsx:1886-1887):
```typescript
export const useStreamingForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.streamingThreads.has(threadId) : false))
```

**The OWNING-thread-id lesson** (useMessages.ts:80-86): the composer `disabled` derives from the OWNING thread id (not `viewedThreadId`) via `useStreamingForThread(thread?.id)` — a background-streaming thread must NOT lock the viewed thread's composer.

**Replicate this:** add a per-thread keyed `workflowLockByThread: Map<threadId, {runId, mode, ...}>` and a `useWorkflowLockForThread(threadId)` selector. Mutate via copy-then-mutate helpers in the EXACT :717-748 shape (new Map → new inner → set/GC-delete). **NEVER a global boolean** — this is the single most-likely regression (SC#3 parallel-thread UAT is the binding gate). The toggle/composer-disabled derives from the OWNING thread id, never `viewedThreadId` (useMessages.ts:80-86 lesson).

---

### Deep/Harness toggle + workflow picker in `frontend/src/components/chat/MessageInput.tsx` (component, request-response)

**Analog:** the agent-mode (General/Explorer) selector (MessageInput.tsx:238-272).

**Selector idiom: DropdownMenu trigger button + active-state styling + items** (MessageInput.tsx:239-272):
```tsx
{onAgentModeChange && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          agentMode === "explorer" && "text-primary bg-primary/10",
        )}
        data-testid="agent-mode-selector"
      >
        <Compass className="h-3 w-3 shrink-0" />
        <span>{agentMode === "explorer" ? "Explorer" : "General"}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
      <DropdownMenuItem onSelect={() => onAgentModeChange("default")} ...>General ...</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onAgentModeChange("explorer")} ...>Explorer ...</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Replicate this:** add a sibling Deep/Harness toggle (same `rounded-full px-3 py-1.5 text-xs` button + DropdownMenu) alongside this selector; when Harness is chosen, a published-workflow dropdown (same DropdownMenuItem shape). Disable-with-tooltip when workflow-locked: add `disabled` + a `title`/Tooltip ("Workflow running — Cancel to switch back" for the toggle, D-05; "Controlled by the active workflow" for the General/Explorer selector, D-03). Disable, do NOT hide (avoids layout jump). The `disabled` derives from `useWorkflowLockForThread(owningThreadId)`. Give the new control a `data-testid` (mirror `agent-mode-selector`) for Chrome MCP UAT. Follow `Skill("sketch-findings-agentic-rag")` for placement/copy/amber-paused tokens.

---

### `continueRun` / `getThreadWorkflow` + `cap_paused` SSE callback in `frontend/src/lib/api.ts` (client)

**Analog:** `cancelRun` (api.ts:857) for the mutation-client shape; `getThreadPendingAsks` (api.ts:740) for the GET-sub-resource client; the SSE dispatch switch (api.ts:600-616) for the new callback; `postMessage` (api.ts:338-356) for extending the kickoff body.

**Mutation client** (api.ts:857-867):
```typescript
export async function cancelRun(runId: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}`, { method: "DELETE", headers, signal })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to cancel run (status ${res.status})`)
  }
}
```

**GET sub-resource client** (api.ts:740-748):
```typescript
export async function getThreadPendingAsks(threadId: string, signal?: AbortSignal): Promise<PendingAsk[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/ask_user/pending`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list pending asks")
  return (await res.json()) as PendingAsk[]
}
```

**SSE dispatch switch — add a new branch** (api.ts:611-616):
```typescript
} else if (t === "fallback_model" && callbacks.onFallbackModel) {
  callbacks.onFallbackModel(
    parsed.original_model as string,
    parsed.fallback_model as string,
  )
}
```

**Kickoff body extension** (api.ts:351-356) — add `workflow_definition_id` next to `agent_mode`:
```typescript
body: JSON.stringify({
  content,
  model: options.model,
  provider: options.provider,
  agent_mode: options.agentMode ?? "default",
}),
```

**Replicate this:** `continueRun(runId)` → `POST /runs/{id}/continue` (cancelRun shape). `getThreadWorkflow(threadId)` → `GET /threads/{id}/workflow` returning `ThreadWorkflowState` (getThreadPendingAsks shape). Add a `cap_paused`/`system_warning` `else if (t === "cap_paused" && callbacks.onCapPaused)` branch in the SSE switch (mirror the `fallback_model` branch). Extend `postMessage` to send `workflow_definition_id` (mirror the `agent_mode` line). Add `listPublishedWorkflows()` GET (verify the backend list route exists during planning — A4).

---

### Continue card host in `frontend/src/components/chat/MessageItem.tsx` (component, event-driven)

**Analog:** the Resume button host for failed/timed_out runs (MessageItem.tsx:341-352).

**Resume button host — conditional inline action on a run status** (MessageItem.tsx:341-352):
```tsx
{!isStreaming && message.role === "assistant" && (message.runStatus === "failed" || message.runStatus === "timed_out") && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => onResume?.(message)}
    className="mt-2 text-xs"
    aria-label="Resume run"
  >
    <RotateCcw className="w-3 h-3 mr-1.5" />
    Resume
  </Button>
)}
```

**Replicate this:** the Continue card is the additive SIBLING — a parallel conditional gated on `cap_paused` (delivered out-of-band, NOT from `message.runStatus` since `role='system'` carrier rows are filtered from /messages — Landmine 2). Render from (a) the live `cap_paused` SSE callback and (b) the mount-time `getThreadWorkflow` `cap_paused`/`continues_*` fields. Same `<Button variant="ghost" size="sm" onClick={() => continueRun(...)}>` shape, inline near where the run paused. Show `continues_remaining`. Keep additive (rides the Phase 095 unification surface — don't reshape the Resume host).

---

## Shared Patterns

### asyncpg `$N`-only parameterization (SQL injection impossible at this layer)
**Source:** `backend/app/db/runs.py:14-17` header + every helper; `backend/app/db/workflows.py:19-22`.
**Apply to:** `create_workflow_run`, the GET reconcile read, every Continue-endpoint DB write.
```python
# ALL value substitutions use $N positional placeholders. No f-strings on SQL strings, ever.
await pool.execute("UPDATE workflow_runs SET status = $2 WHERE id = $1", run_id, status)
```

### Ownership SELECT → 404 (never leak existence)
**Source:** `backend/app/api/runs.py:633-645` (cancel_run), threads.py:341-350 (get_snapshot).
**Apply to:** the new `POST /continue` and `GET /threads/{id}/workflow` routes.
```python
row_resp = await aexec(supabase.table("...").select(...).eq("id", str(id)).eq("user_id", current_user["id"]).maybe_single())
if (row_resp.data if row_resp is not None else None) is None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="... not found")
```

### Per-thread keyed Map/Set state (NEVER a global boolean)
**Source:** `frontend/src/providers/StreamsProvider.tsx:717-748` + selector :1886; the OWNING-thread-id lesson useMessages.ts:80-86.
**Apply to:** the workflow-lock state AND every UI `disabled` derivation. SC#3 binding gate.

### WRITE-before-EMIT terminal ordering / non-terminal SSE for cap_paused
**Source:** `db/workflows.py:285-295` (finish_run "this durable UPDATE happens BEFORE the terminal SSE sentinel"); threads.py TERMINAL_TYPES (:124/:131).
**Apply to:** the cap-pause path — durable `cap_paused` status write BEFORE the SSE event, and the event must NOT be a terminal sentinel (Landmine 6).

### Migration discipline (SQL editor, never db push; regen after)
**Source:** `supabase/migrations/062_workflow_run_claim_lease.sql:23-24` + CLAUDE.md.
**Apply to:** migration 063 — idempotent `IF NOT EXISTS`, header doc-block, COMMENT ON COLUMN, no `db push` task.

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `agent_loop.py` Deep-run continuation that CONSUMES persisted dropped tool calls (re-runs them with results fed back into a fresh `max_iterations` budget) | service | event-driven | **NO ANALOG — net-new, planner must design.** Today the loop only `force_no_tools` on the LAST iteration and drops the buffer; there is no "pre-load a tool-dispatch round from persisted calls" entry-point anywhere. RESEARCH A3/Q2 recommends an additive `resume_dropped_tool_calls` flag on `RunContext` (off by default → Deep Mode byte-identical), but the re-feed mechanics against `_stream_one_iteration`'s tool-dispatch shape are a genuine planning spike. The Harness-phase Continue half DOES have an analog (re-drive `run_workflow` on the `status='active'` phase — harness_engine.py idempotent-resume), but the Deep-run half does not. |
| The multi-write `con.transaction()` block in `create_workflow_run` | db helper | transactional | **PARTIAL — net-new mechanic.** `db/runs.py` and `db/workflows.py` contain ONLY single-statement writes today; no `async with pool.acquire() as con: async with con.transaction():` precedent exists in these files. The idiom is standard asyncpg (and the planner can lift it from any asyncpg doc), but it is NOT copied from an in-repo sibling — flag so the planner writes + tests it explicitly (FK ordering INSERT-then-UPDATE, Landmine 9; phase-row inserts, Landmine 3). |

---

## Metadata

**Analog search scope:** `backend/app/db/` (runs.py, workflows.py), `backend/app/api/` (threads.py, runs.py, panel.py), `backend/app/services/agent_loop.py`, `supabase/migrations/`, `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/hooks/useMessages.ts`, `frontend/src/components/chat/{MessageInput,MessageItem}.tsx`, `frontend/src/lib/api.ts`.
**Files scanned:** 11 source files at the cited line ranges (no whole-file loads of large files; targeted offset reads only).
**Pattern extraction date:** 2026-05-31

## PATTERN MAPPING COMPLETE
