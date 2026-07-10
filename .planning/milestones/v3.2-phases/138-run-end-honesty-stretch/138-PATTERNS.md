# Phase 138: Run-End Honesty (STRETCH) - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 5 (4 modified, 1 read-only-context)
**Analogs found:** 5 / 5 (every touch site has a strong in-repo analog — this is a "mirror existing shapes" phase, no net-new architecture)

> This phase modifies ONLY existing backend Python files. No new files, no frontend, no migration (D-01). Both fixes are additive and reuse existing emit/SSE vocabulary (D-14 red line — Deep Mode stays byte-identical).

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality | This Phase's Change |
|------|------|-----------|----------------|---------------|---------------------|
| `backend/app/services/todos_service.py` | service | CRUD (full-state-replace) | `replace_todos()` (itself, lines 33-98) + `_handle_write_todos` re-select+emit | exact | **RUN-01b:** add net-new `reconcile_open_todos_on_run_end()` reconciler that reuses `replace_todos` |
| `backend/app/api/threads.py` | controller / SSE producer-shell | streaming (SSE) / request-response | `_shielded_finalize()` existing 6-step finalize (itself, 1580-1760); "one new call site" precedent (EVAL-02/SI-01) | exact | **RUN-01b:** ONE new call site only — call reconciler between step-1 persist and step-2 finalize_run. G-5 hot file — do NOT grow inline logic |
| `backend/app/services/agent_loop.py` | service (orchestration loop) | streaming / event-driven | existing `_previous_files_in_run` run-scoped threading (itself: init 1476 → ctx builds 1526/2308 → final emit 2453) | exact | **RUN-01a:** filter `final_output_files` emit against a new run-scoped "new-this-run" accumulator threaded exactly like `previous_files_in_run` |
| `backend/app/services/tool_dispatcher.py` | service (tool dispatcher / handlers) | event-driven / request-response | `_handle_write_todos()` (2455-2521, the reconciler shape); `_previous_files_in_run.update(_iter_files)` (1208, the accumulator populate site) | exact | **RUN-01a:** populate the new accumulator at the delta-merge site (1208) + add the ToolContext field (92) |
| `backend/app/services/sandbox_service.py` | service | file-I/O | n/a — READ FOR CONTEXT ONLY | reference | **NONE (D-07).** Read `harvest_output_files` 201-361 + `snapshot_output_baseline` 364-428 to understand the leak; do NOT modify |

---

## Pattern Assignments

### RUN-01b — the todo reconciler (net-new function)

#### `backend/app/services/todos_service.py` (service, CRUD)

**Analog:** `replace_todos()` (same file, 33-98) + the re-select-then-emit tail of `_handle_write_todos` (tool_dispatcher.py 2506-2516).

**The reusable full-state-replace this reconciler MUST call (do NOT partial-UPDATE):**
```python
# todos_service.py:33-37 — signature: NO ToolContext coupling → directly callable from a finalizer
async def replace_todos(
    pool: "asyncpg.Pool",
    thread_id: UUID,
    todos: list[dict],
) -> dict:
    # ... validates (61-72), then DELETE-all + INSERT-all in ONE transaction (74-98)
```
`_ALLOWED_STATUS = {"pending", "in_progress", "completed"}` (line 22) — the CHECK constraint has NO 4th value, so the marker rides on `content` text, never on `status` (D-01). Each todo dict passed back to `replace_todos` needs keys `id`, `content`, `status` (required) + optional `parent_id`, `order_index` (validation at 61-72; row projection at 81-91).

**Recommended reconciler shape** (mirrors `_handle_write_todos`'s re-SELECT ordering; lives here beside `replace_todos` per D-05 discretion + the RUN-01b hook-point note — keeps it out of the G-5 `threads.py`):
```python
_RUN_ENDED_MARKER = " (run ended — not completed)"  # D-03 exact text; leading space = suffix join

async def reconcile_open_todos_on_run_end(pool, thread_id: UUID, emit=None, redis=None, run_id=None) -> None:
    """RUN-01b: on a genuinely-clean run end, mark still-open todos as not completed.

    Full-state-replace (never a partial UPDATE — the ONLY mutation path). Appends a
    plain-text marker to each pending/in_progress todo's content (D-01/D-02/D-03),
    skipping any item already carrying the marker (D-04, no stacking). Forward-only
    (D-06). Best-effort: never raises into the finalizer.
    """
    # 1. Re-SELECT canonical list — SAME ordering as _handle_write_todos:2506-2509
    rows = await pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        thread_id,
    )
    todos = [dict(r) for r in rows]
    changed = False
    for t in todos:
        if t["status"] in ("pending", "in_progress") and not t["content"].rstrip().endswith(_RUN_ENDED_MARKER.strip()):
            t["content"] = t["content"] + _RUN_ENDED_MARKER   # D-02: same string for both statuses
            # D-01: status UNCHANGED — honesty guardrail (never silently auto-complete)
            changed = True
    if not changed:
        return                                    # nothing open, or all already marked (D-04)
    await replace_todos(pool, thread_id, todos)   # full-state-replace, completed items pass through untouched
    # 2. Re-select + emit todo_updated — SAME shape as _handle_write_todos:2506-2516
    if emit is not None:
        rows2 = await pool.fetch(
            "SELECT todo_id AS id, content, status, parent_id, order_index "
            "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
            thread_id,
        )
        await emit(redis, run_id, 'todo_updated', todos=[dict(r) for r in rows2])
```

**The `todo_updated` emit shape to mirror EXACTLY** (tool_dispatcher.py:2505-2516) — so the frontend receives a wire payload identical to any other todo update:
```python
# Re-SELECT canonical list for the SSE payload (D-085-21)
rows = await ctx.pool.fetch(
    "SELECT todo_id AS id, content, status, parent_id, order_index "
    "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
    UUID(ctx.thread_id),
)
todos_payload = [dict(r) for r in rows]
await ctx.emit(ctx.redis, ctx.run_id, 'todo_updated', todos=todos_payload)
```
Note: in the finalizer the reconciler uses the module-level `_emit` (not `ctx.emit` — there is no ToolContext at run-end); `redis`/`run_id` are closure vars in `_shielded_finalize`. Positioned before the terminal sentinel (see call-site below), the emit is still replayed to the live SSE consumer; `TodosSection.tsx` renders `content` verbatim so no frontend change is needed (D-01, confirmed in CONTEXT canonical refs). Frontend also reconciles todos via fetch, so the emit is a fast-path hint, not the only channel.

---

### RUN-01b — the reconciler call site

#### `backend/app/api/threads.py` (controller / SSE producer-shell)

**Analog:** the existing `_shielded_finalize()` 6-step ordering (1580-1760) + the "net-new function, ONE new call site" precedent (EVAL-02/SI-01, this same milestone). This file is **G-5-flagged (extraction due)** — add ONLY the single call, never grow inline logic.

**Where `_terminal_status` is classified (all reachable values):**
```python
# threads.py:1229 — the DEFAULT
_terminal_status: str = "completed"  # default — set on natural completion
# ...overridden in the except chain:
#   1542: "timed_out"   1558: "cancelled"   1566: "failed"
```

**Exact insertion point — inside `_shielded_finalize`, AFTER step-1 persist, BEFORE step-2 `finalize_run`** (integration-point note: `_terminal_status` is already known, the SSE consumer is still attached, the terminal sentinel has not fired):
```python
# threads.py — step 1 persist ends ~1608 (and system-warning persist ~1619)
#              step 2 finalize_run starts ~1656
# INSERT the reconciler call in the gap (~after 1619, before 1650):

# RUN-01b: mark still-open todos as not-completed on a genuinely-clean run end.
if _terminal_status == "completed" and _result_sink.get("cap_disposition") != "cap_paused":
    try:
        from app.services.todos_service import reconcile_open_todos_on_run_end  # noqa: PLC0415
        await reconcile_open_todos_on_run_end(
            await get_pg_pool(), UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            emit=_emit, redis=redis, run_id=run_id,
        )
    except BaseException:
        logger.exception("RUN-01b reconciler failed for run %s", run_id)
```
Everything the call needs is already in the `_shielded_finalize` closure: `get_pg_pool()` (used at 1657), `thread_id` (used at 1694), `_result_sink` (read at 1597-1601), `redis`/`run_id`/`_emit` (used throughout; `_emit` is the module emit passed to `run_agent_loop` at 1509).

> **See the CRITICAL cap_paused gate finding in Shared Patterns below — the `and _result_sink.get("cap_disposition") != "cap_paused"` clause is load-bearing, not optional.**

---

### RUN-01a — the baseline/leftover leak filter

#### `backend/app/services/agent_loop.py` (service, streaming/event-driven)

**Analog:** the existing `_previous_files_in_run` run-scoped dict — init once in `run_agent_loop`, threaded through ToolContext, mutated by reference in the dispatcher, read at the final emit. The new "new-this-run" accumulator mirrors this threading exactly.

**The unfiltered emit that leaks (the RUN-01a fix site, agent_loop.py:2442-2496):**
```python
if _previous_files_in_run:
    _emit_metas = list(_previous_files_in_run.values())   # 2453 — UNFILTERED: includes baseline/leftover metas
    _hero_set = _select_hero_filenames(_emit_metas, body.content)
    # ... re-stamp persisted rows ...
    await _emit(
        redis, run_id, 'final_output_files',
        files=[
            {"filename": meta["filename"], "url": meta.get("url") or "",
             "size": meta["size"], "is_hero": meta["filename"] in _hero_set}
            for meta in _emit_metas
        ],
    )
```

**Why "filter iteration == -1" is INSUFFICIENT (verified root cause):** the baseline seeds `_previous_files_in_run[hash] = {url:None, iteration:-1}` (sandbox_service.py:418-423), but the FIRST `execute_code` re-walks the whole dir and `_previous_files_in_run.update(_iter_files)` (tool_dispatcher.py:1208) OVERWRITES that entry with a fresh `{url:<real>, iteration:0}` — the `-1` marker is gone before the emit runs. The meta dicts also carry no content_hash (the hash is the dict KEY), so identity must be read from `.items()`.

**Recommended fix (mirror `previous_files_in_run` threading):**
1. Init a run-scoped accumulator beside line 1476:
```python
_previous_files_in_run: dict[str, dict] = {}   # existing (1476)
_new_file_hashes_in_run: set[str] = set()       # NEW — content-hashes genuinely new to THIS run
```
2. Pass it on BOTH ToolContext builds (1513-1534 resume path, 2295-2319 main loop) exactly where `previous_files_in_run=_previous_files_in_run` appears (1526, 2308):
```python
previous_files_in_run=_previous_files_in_run,
new_file_hashes_in_run=_new_file_hashes_in_run,   # NEW — same by-reference sharing
```
3. Filter the emit at 2453 by hash-key membership (use `.items()`, not `.values()`):
```python
_emit_metas = [meta for h, meta in _previous_files_in_run.items() if h in _new_file_hashes_in_run]
if _emit_metas:   # guard — a run that only surfaced leftovers emits nothing (correct)
    # ... hero + emit unchanged ...
```

#### `backend/app/services/tool_dispatcher.py` (service, event-driven)

**Analog:** the `ToolContext` dataclass field convention (line 92) + the `_previous_files_in_run.update(_iter_files)` delta-merge site (1208).

**Add the field (line 92, beside `previous_files_in_run`):**
```python
previous_files_in_run: dict | None = None  # sandbox output file tracking across execute_code calls
new_file_hashes_in_run: set | None = None  # RUN-01a — content-hashes genuinely new to THIS run (run-scoped accumulator)
```

**Populate it at the delta-merge site (tool_dispatcher.py:1200-1208) — compute BEFORE the `.update()`:**
```python
if execution_id and actual_exit_code == 0:
    delta_files, _iter_files = await run_in_threadpool(
        harvest_output_files, session, execution_id, ctx.current_user["id"],
        ctx.supabase, _previous_files_in_run, ctx.iteration,
    )
    # RUN-01a: hashes present THIS cell that weren't already tracked = genuinely new to the run.
    # Must be computed BEFORE the update below (baseline hashes seeded at 929 are already in
    # _previous_files_in_run, so they're correctly excluded; cross-cell regenerations are
    # excluded too — matching the per-cell delta panel's own "not new" semantics).
    if ctx.new_file_hashes_in_run is not None:
        ctx.new_file_hashes_in_run |= (set(_iter_files) - _previous_files_in_run.keys())
    _previous_files_in_run.update(_iter_files)   # existing (1208)
    output_file_list = delta_files
```
This keeps the final aggregate consistent with what the per-cell panels already showed during the run (`delta_files` already excludes hash-dupes at sandbox_service.py:349-350). The baseline seed site is tool_dispatcher.py:927-930 (`_previous_files_in_run.update(_baseline)`) — unchanged; because it runs before any harvest, its hashes are already in `_previous_files_in_run.keys()` when the set-difference above runs, so they never enter the accumulator.

**Sub-agent / harness ToolContext builds** pass a FRESH `previous_files_in_run={}` (task_service.py:602 — "Pitfall 7: fresh dict, NOT a reference"; harness `phase_types.py:343`). The new field's `None` default keeps those byte-identical (the dispatcher guards `if ctx.new_file_hashes_in_run is not None`), OR pass a fresh `set()` there to mirror. Either is safe; the `None`-default + guard is the lowest-touch choice.

#### `backend/app/services/sandbox_service.py` (READ-ONLY, D-07)

Context only — do NOT modify. Key facts confirmed by reading:
- `harvest_output_files` (201-361) re-walks the ENTIRE `/sandbox/output/` dir and re-uploads + re-inserts a `sandbox_files` row for EVERY file every call (297-310), stamping a fresh `iteration=N, url=<real>` meta into `current_files_dict` for all of them (341-348) — this is the leak mechanism, deliberately NOT fixed (D-07/D-08, deferred seed candidate).
- `delta_files` entries are `{filename, url, size, (supersedes?)}` — NO `content_hash` (353-360). `current_files_dict` (the 2nd return) IS keyed by content_hash (343). Hence the accumulator keys off `_iter_files`'s hash keys, not off `delta_files`.
- `snapshot_output_baseline` (364-428) seeds `{hash: {filename, url:None, size, iteration:-1}}` at run start (418-423).

---

## Shared Patterns

### S1 — Full-state-replace is the ONLY way todos mutate
**Source:** `todos_service.replace_todos` (33-98) — DELETE-all + INSERT-all in one asyncpg transaction; validation BEFORE the DELETE so a bad payload never wipes state.
**Apply to:** the RUN-01b reconciler — build the FULL list (completed items pass through unchanged, open items get the content marker) and hand the whole list to `replace_todos`. Never a partial per-row UPDATE.

### S2 — Re-select-then-emit for `todo_updated`
**Source:** `_handle_write_todos` (tool_dispatcher.py:2505-2516).
**Apply to:** the reconciler's emit — re-SELECT `ORDER BY order_index, created_at`, project `todo_id AS id, content, status, parent_id, order_index`, emit `todo_updated` with the full list. Identical wire shape to every other todo update.

### S3 — Run-scoped accumulator threaded via ToolContext (by-reference)
**Source:** `_previous_files_in_run` — `ToolContext.previous_files_in_run` field (tool_dispatcher.py:92) init once in `run_agent_loop` (agent_loop.py:1476), passed by reference on every ctx build (1526, 2308), mutated in the dispatcher via `.update()` (929, 1208), read at the final emit (2453). Mutations propagate back to the loop's local because it's the same object.
**Apply to:** the RUN-01a `new_file_hashes_in_run` accumulator — same field → init → thread → mutate → read lifecycle. Give the field a safe default (`None`) so sub-agent/harness ctx builds stay byte-identical.

### S4 — SHA-256 content-hash is the authoritative identity
**Source:** in-code note at sandbox_service.py:275-280 (PATTERNS.md §S5); baseline seed collides with harvest on the hash key (364-397).
**Apply to:** RUN-01a — track "new this run" by content-hash, never by filename (a filename can lie / be regenerated). The accumulator holds hashes; filtering reads `_previous_files_in_run.items()` where the key IS the hash.

### S5 — Shielded finalize step-order is byte-locked
**Source:** `_shielded_finalize` (threads.py:1580-1760): (1) persist → (1b) persist system-warnings → (2) `finalize_run` DB UPDATE → (3) terminal sentinel XADD → (4) EXPIRE → (5) ZREM. The order is a documented race fix (Plan 075.4-03 T-075.4-04).
**Apply to:** the RUN-01b call MUST land in the gap AFTER step 1 (persist, ~1608/1619) and BEFORE step 2 (`finalize_run`, ~1656). This puts the `todo_updated` emit before the terminal sentinel (step 3) so the live consumer still receives it, and before EXPIRE (step 4) so it isn't trimmed. Do not reorder existing steps; add one guarded call only (G-5).

### S6 — CRITICAL: the cap_paused gate (load-bearing correctness finding)
**Finding (verified in code, 2026-07-05):** In the `send_message` / `_shielded_finalize` path, `_terminal_status` defaults to `"completed"` (threads.py:1229) and is only overridden to `timed_out`/`cancelled`/`failed` (1542/1558/1566). It is **NEVER** set to `cap_paused` in this path. `cap_disposition == "cap_paused"` is surfaced by `run_agent_loop` on BOTH `_result_sink["cap_disposition"]` (agent_loop.py:2738) AND `AgentLoopResult.cap_disposition` (2751), but `_shielded_finalize` reads NEITHER (`_agent_loop_result` is assigned at threads.py:1507 and never read again; the `_result_sink` reads at 1597-1601 cover persist/warnings/tokens only). The stale comment at agent_loop.py:2736 ("_shielded_finalize reads this to override the terminal status") describes the CONTINUATION finalizer, not this one.

**Consequence:** a fresh Deep run that hits the iteration cap with a non-empty tool buffer reaches `_shielded_finalize` with `_terminal_status == "completed"` while `_result_sink["cap_disposition"] == "cap_paused"`. Gating the reconciler on `_terminal_status == "completed"` **alone would fire it on a cap-paused run** — precisely the D-05 "correctness trap." 

**Required gate at the `_shielded_finalize` call site:**
```python
if _terminal_status == "completed" and _result_sink.get("cap_disposition") != "cap_paused":
```
Both clauses are mandatory. (Fixing the broader "cap-paused Deep run finalizes as completed" question is OUT of scope — D-05 only requires the reconciler not fire; the extra clause achieves that without touching cap handling.)

**Contrast — the continuation finalizer (`spawn_continuation_run._finalize`, threads.py:2103-2107)** DOES read `cap_disposition` and sets `_terminal_status = "cap_paused"` (2105-2107), so there `_terminal_status == "completed"` alone would be sufficient. See "Parallel completion path" below.

---

## Parallel completion path (planner decision — beyond the CONTEXT-named site)

CONTEXT.md scopes the reconciler to ONE call site: `_shielded_finalize`. But `spawn_continuation_run._finalize` (threads.py:2103-2169) is a SECOND clean-completion path — a Continue that finishes cleanly also ends with possibly-open todos. It has the same 6-step shape (persist ~2116 → finalize_run ~2127 → sentinel ~2141 → expire ~2150 → zrem ~2157) and its own already-correct cap gate (`_terminal_status` becomes `cap_paused` at 2107, so `== "completed"` alone suffices there). **Flag for the planner:** decide whether RUN-01b honesty should also cover Continue-completed runs (a second guarded call in `_finalize`, gate `if _terminal_status == "completed":`). If yes, factor the reconciler so both sites call the same function (they already share `redis`/`run_id`/`thread_id`/`get_pg_pool()`/`_emit`). CONTEXT names only the first; this is an explicit scope question, not a silent omission.

---

## Test Analogs

| New test target | Analog test file | What to copy |
|-----------------|------------------|--------------|
| RUN-01b reconciler (`replace_todos` control flow, marker append, no-stack, status-unchanged) | `backend/tests/unit/test_085_todos_service.py` | `_make_pool_mock()` asyncpg pool/conn/tx mock chain (27-51); DELETE-then-INSERT ordering assert (105-134); pre-validation-before-DB assert (137-152); row-shape assert `(thread_id, id, content, status, parent_id, order_index)` (98-101) |
| RUN-01b handler-emit shape | `backend/tests/unit/test_write_todos_coercion.py` | `_handle_write_todos` mock + `todo_updated` emit assertion pattern |
| RUN-01a baseline/leftover exclusion (headline regression) | `backend/tests/unit/test_120_collision_regression.py` | `_build_mock_session_with_payloads()` (48-62) + `_build_mock_supabase()` (65-73); the "stale file on disk at run start → excluded from emit" assert shape (79-111). Extend with a `final_output_files`-level assert that a `iteration:-1` baseline whose bytes reappear as a harvested file is NOT in the accumulator |
| RUN-01a final-emit payload | `backend/tests/unit/test_075_4_final_output_files_payload.py` | the `final_output_files` payload-shape assertions (`filename`/`url`/`size`/`is_hero`) |

---

## No Analog Found

None. Every touch site mirrors an existing shape:
- The reconciler is net-new *code* but a near-verbatim structural clone of `_handle_write_todos` + `replace_todos` (S1/S2).
- The RUN-01a accumulator is net-new *state* but threaded identically to `previous_files_in_run` (S3).
- The finalizer call is a net-new *call site* following the EVAL-02/SI-01 "one guarded line, no inline growth" precedent (S5).

---

## Metadata

**Analog search scope:** `backend/app/services/` (todos_service, tool_dispatcher, agent_loop, sandbox_service, task_service, harness/phase_types), `backend/app/api/threads.py`, `backend/tests/unit/`
**Files scanned:** 6 source + 4 test files (2 read in full)
**Key correctness finding:** S6 — the cap_paused gate needs `_result_sink.get("cap_disposition") != "cap_paused"` in ADDITION to `_terminal_status == "completed"` (verified: `_shielded_finalize` never reads `cap_disposition`).
**Pattern extraction date:** 2026-07-05
