# Phase 092: Dual-Mode Wiring + Continue Button — Research

**Researched:** 2026-05-31
**Domain:** Backend run-path wiring (producer mode-branch + atomic workflow-run creation), run-lifecycle/cancel extension, a net-new Continue endpoint, and frontend per-thread lock + composer toggle + inline Continue carrier.
**Confidence:** HIGH (all findings cite the actual current code at specific line numbers; this is a wiring phase against a frozen, verified substrate)

This is a "what you need to know to plan" doc. The engine (091) is DONE — 092 only branches to it, creates its runs, extends cancel, and adds Continue. Every claim below is `[VERIFIED: <file>:<line>]` against the live code unless tagged `[ASSUMED]`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Toggle + workflow picker.** Deep/Harness toggle near the existing agent-mode (General/Explorer) selector in the composer toolbar; choosing Harness reveals a dropdown of **published** workflows (`workflow_definitions WHERE is_global / published`). Mirror the existing selector idiom.
- **D-02 — Next chat message is the workflow input/kickoff.** Pick workflow → type prompt → send starts the run with that prompt as the workflow input. No dedicated inputs form in v1; no auto-start-on-selection. Naturally persists `workflow_runs.inputs` + `model` at creation (closes SEED-047).
- **D-03 — General/Explorer selector: disabled + tooltip** while a workflow is locked ("Controlled by the active workflow"). Disable, don't hide (avoids layout jump).
- **D-04 — Reuse the existing Stop button** (`DELETE /runs/{run_id}`) to cancel a workflow. Backend cancel additionally clears `threads.active_workflow_run_id` in the SAME transaction as the terminal-status write (SC#2).
- **D-05 — Lock feedback = disabled toggle + tooltip** ("Workflow running — Cancel to switch back"). Client disable is courtesy; **server-side refusal at run creation is the authoritative backstop**.
- **D-06 — Cap at 3 Continues per run.** Each Continue grants a fresh bounded step budget; after 3 the run stops with a clear message. Track `continues_used` per run. Applies to BOTH a Deep run and a Harness phase.
- **D-07 — Continue lives inline in chat**, by extending the 075.4 iteration-cap system-message carrier (`kind: iteration_cap_paused`) into an actionable card with a Continue button. Least new UI surface; avoids coupling to the unbuilt Phase 094 panel.
- **D-08 (locked by SC#4) — Continue CONSUMES the previously-dropped tool calls** (does NOT re-drop, does NOT start fresh), resuming the SAME run/phase. For a Harness phase it re-reads `workflow_phases.available_tools` from Postgres before resuming. Never blindly bumps a global cap unbounded — the bounded extra budget is the unit of resumption.

### Claude's Discretion (the 5 open questions resolved below)
- Exact toggle/picker component shape and placement (follow the agent-mode selector idiom).
- Continue reuses existing resume path vs new `POST .../continue` endpoint.
- New run-lifecycle status value(s) for cap-paused.
- Exact tooltip/message copy.
- `GET /threads/{id}/workflow` response shape.

### Deferred Ideas (OUT OF SCOPE)
- Dedicated structured inputs form per workflow (only if a future workflow needs typed multi-field inputs).
- Continue surfaced in the panel timeline (Phase 094's surface).
- Per-user / per-org Continue quota (v3.0+).
- Continue telemetry dashboard (later analytics).
- Restart-mid-workflow independent kill-and-resume verification (Phase 096 / EVAL-02).
- **Out of scope for 092 entirely:** live panel phase-timeline rendering (094), chat tool-card unification (095), Anthropic parity (093), eval CI gate / fair-share / restart-resume (096).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, REQUIREMENTS.md:33–35) | Research Support |
|----|-------------|------------------|
| **MODE-01** | A user can switch a thread between **Deep Mode** (default, unchanged free chat) and **Harness Mode** (locked workflow); mode is per-thread (`threads.active_workflow_run_id IS NULL` = Deep). | Producer mode-branch above `run_agent_loop` (threads.py:1049) + atomic `create_workflow_run` helper (new, in db/workflows.py) + frontend toggle/picker in MessageInput.tsx (selector idiom at :238–259). |
| **MODE-02** | Once a workflow starts, the thread is **workflow-locked** — switching back to Deep is refused server-side until the run completes or the user cancels; Cancel clears the lock in the same transaction as the terminal-status write; lock state is **per-thread** (never a global boolean — BUG-260523-01 pattern). | Server-side lock check at run creation (send_message route) + cancel/terminal clears `active_workflow_run_id` (runs.py:702 zombie-heal + threads.py:1198 finalize) + per-thread keyed `Map/Set` lock state (StreamsProvider :717–748 helpers). |
| **CONT-01** | When an agent run hits its step cap (a Deep run OR a Harness phase), a **"Continue" affordance** resumes the same run/phase with a bounded additional step budget instead of silently dropping tool calls. *(SEED-029)* | New `POST /runs/{run_id}/continue` endpoint + persist buffered tool calls at the cap (agent_loop.py:1842) + `continues_used` column + 075.4 carrier extended to actionable Continue card. |
</phase_requirements>

## Summary

092 is **pure wiring** onto a frozen substrate. The mode branch is one additive `if active_workflow_run_id is not None:` at the producer (threads.py, just above the `run_agent_loop` call at :1049). Deep Mode (the NULL branch) must stay byte-identical. The hard parts are NOT the branch — they are three gaps the substrate leaves open:

1. **There is NO live-app path that creates a workflow run.** `harness_engine.run_workflow` is only invoked from tests and the startup sweep. There is no `INSERT INTO workflow_runs` AND no `INSERT INTO workflow_phases` anywhere in `backend/app`. 092 owns BOTH inserts plus the atomic `threads.active_workflow_run_id` write. `workflow_runs` has no `inputs` and no `model` column today — both must be added by migration (closes SEED-047).
2. **The Continue affordance has no substrate to reuse.** There is NO existing `POST .../resume` or `/continue` endpoint; the frontend's `resumeFromFailed` just re-POSTs the preceding user message as a brand-new run. And critically, the iteration-cap drop point (agent_loop.py:1842) currently **clears the buffered tool calls** (`tool_calls_buffer = {}`) and persists only a text warning — the actual dropped tool calls are logged, never stored. SC#4 ("consume, not re-drop") therefore requires 092 to first **persist the buffered tool calls durably** at the cap, then build a new resume endpoint that re-feeds them.
3. **The 075.4 "carrier" is currently filtered out of every read path.** `role='system'` rows are explicitly excluded from both `/messages` (threads.py:364) and `/snapshot` (threads.py:728) by BUG-260528-01 — `MessageResponse.role` is `Literal["user","assistant"]` and a system row would 500 the thread. The live `system_warning` SSE event is ALSO not wired into any frontend callback (api.ts only handles `fallback_model`, `delta`, etc.). So "extend the carrier" really means: add a delivery channel for the Continue affordance — a frontend `system_warning` SSE callback for the live case AND mount-time delivery via the new `GET /threads/{id}/workflow` reconcile (mirroring the `ask_user/pending` out-of-band query pattern).

**Primary recommendation:** Plan in 4 backend concerns (run-creation helper + producer branch, cancel/terminal lock-clear, Continue endpoint + cap-persist, GET reconcile endpoint), 1 migration (063 — `workflow_runs.inputs`/`model`/`continues_used`, a `cap_paused` status, and the cap-buffer persistence shape), and 3 frontend concerns (toggle+picker, per-thread lock state, Continue carrier+reconcile client). Keep every change additive to Deep Mode and provider-agnostic at the producer; zero provider-branch edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mode decision (Deep vs Harness) | API / Backend (producer) | DB (`threads.active_workflow_run_id`) | The branch reads the durable anchor; SC#1 mandates the branch lives at the producer above the loop, never client-side. |
| Workflow lock enforcement | API / Backend (run creation) | Frontend (courtesy disable) | SC#2: server-side refusal at run creation is authoritative; the grayed toggle is UX only. |
| Workflow-run + phase-row creation | DB helper (asyncpg) | API (producer spawn) | Net-new atomic transaction (INSERT runs + INSERT phases + UPDATE threads). Mirrors db/runs.py. |
| Cancel → clear lock | API / Backend (cancel + finalize) | DB | Must be same transaction as terminal-status write (SC#2). |
| Continue (resume with budget) | API / Backend (new endpoint) | DB (`continues_used`, persisted buffer) | No reusable resume surface exists; new endpoint owns the lifecycle. |
| Per-thread lock UI state | Frontend (StreamsProvider keyed Map) | — | SC#3: per-thread keyed, never global boolean (BUG-260523-01). |
| Mode/lock reconcile on mount | API (`GET /threads/{id}/workflow`) | Frontend (api.ts client) | D-v2.5-03: Realtime is a hint; fetch is truth. |
| Continue button host | Frontend (chat carrier) | — | D-07: inline in chat, extends 075.4 system-message carrier. |

---

## Open-Question Resolutions (evidence-backed)

### Q1 — Continue API surface: NEW `POST /runs/{run_id}/continue` (not a reused resume)

**Resolution: build a new `POST /runs/{run_id}/continue` endpoint. There is no existing resume path to reuse.**

Evidence:
- runs.py has only three routed verbs in the relevant range: `GET /{run_id}/stream`, `POST /{run_id}/ask_user_response` (runs.py:496), and `DELETE /{run_id}` (runs.py:618). There is **no** `POST .../resume` and **no** `reset_iteration_count` flag anywhere `[VERIFIED: backend/app/api/runs.py — grep resume|/continue|reset_iteration returned only the ask_user_response route]`.
- The frontend "Resume" (`resumeFromFailed`) re-POSTs the preceding user message via `sendMessage` — a brand-new `run_id`, not a budget-reset of the same run `[VERIFIED: frontend/src/providers/StreamsProvider.tsx:1370–1395, "resume retries via sendMessage"]`.
- The harness engine's only "resume" is the startup sweep (`resume_stranded_workflows` → `_resume_run` → `run_workflow`), which re-runs a `status='active'` phase **from the top** — it does NOT carry a budget or consume dropped tool calls `[VERIFIED: backend/app/services/harness_engine.py:582–654]`.

So SEED-029 §2's "reuse preferred" cannot apply — there is nothing to reuse. A dedicated `POST /runs/{run_id}/continue` is the minimal correct surface.

**CRITICAL — SC#4 "consume, not re-drop" requires a code change at the drop point.** Today, when the cap fires:
```
# agent_loop.py:1842
if force_no_tools and tool_calls_buffer:
    ... logger.warning(...) ; emit system_warning ; append persisted warning ...
    tool_calls_buffer = {}   # belt-and-suspenders — DROPS the calls
```
`[VERIFIED: backend/app/services/agent_loop.py:1842–1856]`. The buffered tool calls (names + args) are logged only, then the buffer is zeroed. They are **not** persisted anywhere a resume could read them. Therefore Continue cannot "consume" them unless 092 changes this point to **durably persist the buffered tool_calls** before clearing the in-memory buffer.

- **For a Deep run:** at the cap, persist the dropped `tool_calls_buffer` (with `run_id`, iteration, names+args) into a durable carrier row (the same `role='system'` system-warning row, with the tool_calls attached, OR a dedicated column — see Q5/migration). On Continue, the new endpoint must spawn a fresh `run_agent_loop`-style continuation that PRE-LOADS those tool calls as the next iteration's tool-dispatch round (re-running them with their results fed back to the model) within a fresh `max_iterations` budget. This is the "consume" semantic.
- **For a Harness phase:** the cap lives INSIDE the phase executor (`run_task_sub_agent`'s `max_steps`, per harness_engine.py:432 comment "step cap is enforced INSIDE the executor"). Continue resumes the SAME phase (the `status='active'` workflow_phases row — `get_active_phase` at workflows.py:107) and must **re-read `workflow_phases.available_tools`** (D-08) before re-running. NOTE: `available_tools` is a field on the parsed phase config (`LlmAgentPhaseConfig.available_tools` at harness.py:53), persisted inside `workflow_definitions.definition` JSONB, NOT a column on `workflow_phases`. "Re-read from Postgres" = re-parse the definition (`_load_run_definition` at harness_engine.py:534) → `spec_by_slug[active_phase.slug].config.available_tools`. The planner must reconcile D-08's wording ("re-read `workflow_phases.available_tools`") with the actual storage: it lives in the definition JSONB, reachable via the run's `definition_id`.

**Landmine:** the Deep-run "consume the dropped tool calls and re-run them with results fed back" path is genuinely new agent-loop behavior (the loop today only force_no_tools on the LAST iteration). The planner should scope a focused, additive continuation entry-point in `agent_loop.py` (e.g. a `resume_from_dropped_tools` flag on `RunContext`) rather than re-using the cap branch — and must keep Deep Mode byte-identical when the flag is absent.

### Q2 — Cap-paused status value: add `cap_paused` to BOTH enums via migration (do NOT reuse `paused`)

**Resolution: add a new non-terminal status `cap_paused` (or `iteration_cap_paused`) to both `runs.status` and `workflow_runs.status` via migration 063. Do NOT reuse `workflow_runs`'s existing `paused`.**

Verbatim current enums:
- `runs.status` CHECK: `('streaming','completed','failed','cancelled','timed_out')` `[VERIFIED: supabase/full-schema.sql:564]`.
- `workflow_runs.status` CHECK: `('active','paused','completed','failed','cancelled')` `[VERIFIED: supabase/full-schema.sql:749]`.
- `workflow_phases.status` CHECK: `('pending','active','completed','failed','skipped')` `[VERIFIED: supabase/full-schema.sql:724]`.

Reasoning:
- A cap-paused run is **non-terminal** (Continue must resume it) and must **not** clear `active_workflow_run_id` (the lock holds during the pause). The terminal sets are `runs`: {completed,failed,cancelled,timed_out} and `workflow_runs`: {completed,failed,cancelled}. A cap-paused state needs a value OUTSIDE those sets so the cancel idempotency check (runs.py:650) and the lock-clear logic both treat it as "still live."
- `workflow_runs` already has `paused`, but it is overloaded by `find_resumable_runs` (which sweeps `status IN ('active','paused')` at workflows.py:95) — reusing `paused` for cap-pause would make the startup sweep try to auto-resume cap-paused runs (wrong: a cap-pause waits on a USER Continue click, not an automatic re-run). So a **distinct** `cap_paused` value is required to keep the two pause semantics separate.
- For `runs.status`, the Deep-run cap-pause also needs a non-terminal value; today the run would finalize as `completed` (the force_no_tools text response). 092 must keep the run row non-terminal when a Continue is pending. Add `cap_paused` to `runs.status` too.

**Migration consequence:** also update the in-code mappings that mirror these CHECKs:
- `MessageResponse.run_status: Literal[...]` (message.py:44) — add the new value or keep it nullable-tolerant.
- `TERMINAL_TYPES` / `_RUN_STATUS_TO_TERMINAL_TYPE` (threads.py:124, :131) — `cap_paused` is NOT terminal, so it must NOT map to an SSE terminal sentinel; the producer must emit a distinct non-terminal `cap_paused` SSE event so the consumer keeps the stream attachable for the Continue.
- The cancel idempotency guard (runs.py:650) — `cap_paused` is cancellable (must NOT 204-silent); cancel must transition it to `cancelled` AND clear the lock.

### Q3 — `GET /threads/{id}/workflow` response shape (Pydantic model)

**Resolution: a new `ThreadWorkflowState` Pydantic model returned by `GET /threads/{thread_id}/workflow`.** Carries enough for the panel/composer to reconcile mode + lock + current phase + terminal/absent-run detection + Continue budget. Mirrors the D-v2.5-03 reconcile-via-fetch contract (CLAUDE.md; CONTEXT canonical_refs).

```python
class ThreadWorkflowState(BaseModel):
    thread_id: UUID
    mode: Literal["deep", "harness"]          # derived: harness iff active_workflow_run_id IS NOT NULL
    locked: bool                              # True iff a non-terminal workflow run holds the lock
    active_workflow_run_id: UUID | None       # the thread anchor (NULL = Deep)
    run_status: str | None                    # workflow_runs.status (active/cap_paused/completed/...); None when absent
    definition_slug: str | None               # which workflow (for the picker to show "running: X")
    definition_name: str | None
    current_phase_slug: str | None            # workflow_runs.current_phase_id → workflow_phases.slug
    current_phase_index: int | None
    total_phases: int | None
    # SC#5 dangling-lock heal signal: lock set but run is terminal/absent → frontend should treat as Deep + offer heal
    lock_is_stale: bool                        # True iff active_workflow_run_id set BUT run row missing or terminal
    # CONT-01 / D-06 carrier:
    cap_paused: bool                           # True iff a Continue affordance is currently pending
    continues_used: int                        # 0..3
    continues_remaining: int                   # 3 - continues_used
```

Notes:
- `lock_is_stale` is the SC#5 self-heal: "a thread is never stuck Harness-locked with a terminal/absent run." When the panel/composer sees `lock_is_stale=true` it renders as Deep and may PATCH-clear the anchor (or the GET itself can lazily clear it — cleaner: have the cancel/terminal path always clear it, and make this GET purely diagnostic so it never writes on a read).
- `run_status` is read from `workflow_runs` for a Harness lock; for the Deep-run Continue case (a `runs` row at `cap_paused`), the same endpoint should also report `cap_paused`/`continues_*` even when `active_workflow_run_id IS NULL` (a Deep run can hit the cap without being a workflow). The planner must decide whether GET keys off the thread's latest `runs` row too, or whether the Deep-run Continue surfaces only via the live SSE event + persisted carrier. **Recommendation:** GET reports workflow lock state; Deep-run Continue is carried by the persisted system row + SSE, reconciled by the same endpoint reading the latest non-terminal `runs` row for the thread.

### Q4 — `continues_used` tracking: a new column (persistence, not in-memory)

**Resolution: persist `continues_used` as a column. Add it to BOTH `runs` and `workflow_runs` (the cap applies to BOTH a Deep run and a Harness phase per D-06).**

Reasoning:
- In-memory is wrong: WORKER_COUNT=2 (CLAUDE.md) means the Continue-handling worker may differ from the one that hit the cap; the producer task that hit the cap is gone by the time the user clicks Continue (the run finalized to `cap_paused`). The enforcement count MUST survive across requests/workers → durable column.
- A Deep run's cap lives on the `runs` row; a Harness run's cap lives on the phase (but the per-run cap of 3 is naturally tracked on `workflow_runs`). Simplest: `continues_used INTEGER NOT NULL DEFAULT 0` on both `runs` and `workflow_runs`. The Continue endpoint increments it transactionally and refuses (clean stop message) when it would exceed 3.
- `[VERIFIED: no continues_used column exists — full-schema.sql workflow_runs (739–750) and runs (CHECK at 564) have no such column]`.

### Q5 — `create_workflow_run` helper + atomic transaction (closes SEED-047)

**Resolution: a net-new `create_workflow_run` async helper in `backend/app/db/workflows.py` (asyncpg, mirroring `db/runs.py:insert_run`), wrapping INSERT workflow_runs + INSERT workflow_phases (one per PhaseSpec) + UPDATE threads.active_workflow_run_id in ONE transaction.**

Why all three in one transaction:
- There is no `INSERT INTO workflow_runs` AND no `INSERT INTO workflow_phases` anywhere in `backend/app` — `run_workflow` READS phases via `load_run_phases` (workflows.py:56) but nothing creates them in the live app `[VERIFIED: grep "INSERT INTO workflow_phases" across backend/app = only test fixtures + the template seed for workflow_definitions]`. So 092 owns phase-row creation too.
- FK ordering: `threads.active_workflow_run_id → workflow_runs.id ON DELETE SET NULL` (full-schema.sql:1634) and `workflow_runs.thread_id → threads.id ON DELETE CASCADE` (full-schema.sql:1698). The workflow_run must exist BEFORE the thread can reference it → INSERT-then-UPDATE inside one `async with pool.acquire() as con, con.transaction():`.

Proposed signature:
```python
async def create_workflow_run(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    definition_id: UUID,
    definition: WorkflowDefinition,   # already parsed/validated (immutable-on-publish)
    inputs: dict,                     # {"kickoff_prompt": <body.content>, ...}  (SEED-047)
    model: str,                       # resolved model at creation (SEED-047)
) -> UUID:                            # returns the new workflow_run id
    async with pool.acquire() as con:
        async with con.transaction():
            run_id = await con.fetchval(
                """INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model)
                   VALUES ($1, $2, 'active', $3::jsonb, $4) RETURNING id""",
                thread_id, definition_id, json.dumps(inputs), model)
            # one phase row per PhaseSpec, in phase_index order, status='pending'
            for ps in sorted(definition.phases, key=lambda p: p.phase_index):
                await con.execute(
                    """INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status)
                       VALUES ($1, $2, $3, 'pending')""",
                    run_id, ps.phase_index, ps.slug)
            # set current_phase_id to the first phase (optional; run_workflow can also derive)
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1",
                thread_id, run_id)
    return run_id
```
- `inputs` and `model` are NEW columns on `workflow_runs` (migration 063) — they do not exist today `[VERIFIED: full-schema.sql:739–750]`. Persisting them at creation is exactly SEED-047's resume-ctx rehydration close-out (CONTEXT line 21; STATE SEED-047 deferral).
- The published-workflow lookup (D-01 picker → kickoff) reads `workflow_definitions WHERE status='published' AND (is_global OR created_by = :user)` `[VERIFIED: workflow_definitions has status, is_global, created_by, slug, definition — full-schema.sql:686–699]`, then parses `definition` JSONB via `WorkflowDefinition.model_validate` (the pattern at harness_engine.py:534–556) to get `definition_id` + parsed phases.
- RLS: the helper runs as service role (engine pattern, workflows.py:19). Owner-scoping is enforced UPSTREAM in the route (the send_message handler already verifies thread ownership at threads.py:766–774) — the helper trusts the caller-supplied `thread_id`. Keep that invariant: the route resolves the definition under the user's RLS before calling the service-role helper.

---

## Files to Modify (grouped by concern)

### Backend — run creation + producer mode-branch (MODE-01)
- `backend/app/db/workflows.py` — ADD `create_workflow_run` (above). Mirror the asyncpg + `$N` placeholder discipline already in this file (T-091-03).
- `backend/app/models/message.py` — ADD a field to `MessageCreate` to carry the chosen published workflow on the kickoff message (e.g. `workflow_definition_id: UUID | None = None`). D-02: the next message kicks it off `[VERIFIED: message.py:8–12]`.
- `backend/app/api/threads.py` — in `send_message` (route at ~:760):
  - After thread-ownership check, if `body.workflow_definition_id` is set: resolve+parse the published definition (RLS-scoped read), call `create_workflow_run`, and treat THIS run as a harness run. The atomic anchor write happens here, BEFORE the producer spawns (CONTEXT integration point).
  - **Server-side lock enforcement (SC#2/MODE-02):** before creating any run, read `threads.active_workflow_run_id`; if non-null and its run is non-terminal, REFUSE a Deep send / a different-workflow send (409) — this is the authoritative backstop, not the grayed button.
  - The mode branch goes **inside `agent_runner`, just above the `run_agent_loop` call at threads.py:1049** (CONTEXT hard constraint — ABOVE the loop, NEVER in provider branches). Shape:
    ```python
    if active_workflow_run_id is not None:        # Harness
        definition = await _load_run_definition(pool, active_workflow_run_id)
        wf_ctx = <build engine ctx>               # see landmine below
        await run_workflow(active_workflow_run_id, definition, wf_ctx, pool=pool, redis=redis)
    else:                                          # Deep — BYTE-IDENTICAL to today
        _agent_loop_result = await run_agent_loop(ctx, emit=_emit, ...)
    ```
  - `_shielded_finalize` (threads.py:1122–1246) STAYS mode-agnostic. NOTE the landmine: for the Harness branch, `run_workflow` already calls `finish_run` + terminal `_emit` internally (harness_engine.py:528–530); the producer-shell finalizer's `finalize_run` write is keyed to the `runs` table, not `workflow_runs`. The planner must decide how the two run rows relate (the `runs` row created at threads.py:871 vs the `workflow_runs` row) — likely the harness branch should still finalize the `runs` row to a terminal status for SSE-terminal consistency, while `run_workflow` owns the `workflow_runs` row. Trace both terminal writes so SC#2 (lock clear) fires exactly once.

### Backend — cancel + terminal clears the lock (MODE-02 / SC#2)
- `backend/app/api/runs.py` — `cancel_run` (DELETE, :618):
  - **Happy path (:660–681):** today it only `task.cancel()`s and returns 204; the actual terminal write happens in the producer's `_shielded_finalize`. So the lock-clear for a live cancel must live in `_shielded_finalize` (threads.py:1198 `finalize_run`), in the SAME UPDATE/transaction as the terminal-status write. Extend `finalize_run` (db/runs.py:69) — or add a sibling call within the same transaction — to also `UPDATE threads SET active_workflow_run_id = NULL WHERE active_workflow_run_id = <this run / this workflow_run>`.
  - **Zombie-heal path (runs.py:702–709):** this UPDATE is a direct `runs` status write — extend it to clear `active_workflow_run_id` in the same statement (or same `aexec`/transaction).
  - **`cap_paused` is cancellable:** the idempotency guard at runs.py:650 currently 204-silents only terminal statuses; `cap_paused` is non-terminal so it correctly falls through to cancel — and cancel must clear the lock.
- `backend/app/services/harness_engine.py` — `finish_run` (harness_engine.py:528 + workflows.py:285) is the Harness terminal write. Extend the harness terminal path so the SAME transaction clears `threads.active_workflow_run_id` (the workflow-run-side SC#2 close). Keep the WRITE-before-EMIT ordering (harness_engine.py:37, :526).

### Backend — Continue endpoint + cap-persist (CONT-01 / SC#4 / D-06 / D-08)
- `backend/app/services/agent_loop.py` — at the cap drop point (:1842): BEFORE `tool_calls_buffer = {}`, **persist the buffered tool_calls durably** (attach to the `role='system'` cap row, or a dedicated payload) so Continue can consume them. Set `runs.status = cap_paused` instead of finalizing `completed` when a Continue is offered. Emit a distinct non-terminal `cap_paused` SSE event (NOT a terminal sentinel) carrying `kind="iteration_cap_paused"`, the dropped tool names, `continues_used`, `continues_remaining`.
- `backend/app/api/runs.py` — ADD `POST /runs/{run_id}/continue`:
  - Ownership SELECT (mirror cancel_run:633–645).
  - Refuse (clean message) if `continues_used >= 3` (D-06).
  - Increment `continues_used` transactionally.
  - Deep run: spawn a continuation `run_agent_loop` with a fresh `max_iterations` budget that PRE-LOADS the persisted dropped tool_calls as the first tool-dispatch round (consume, not re-drop — SC#4). Re-register in `RUN_TASKS`, re-ZADD sorted sets (mirror threads.py:871–890), re-attach SSE.
  - Harness phase: re-read the definition → active phase's `available_tools` (D-08), reset the phase's step budget, re-drive `run_workflow` (the active phase re-runs from the top — harness_engine.py:585 idempotent-resume contract already supports this).
- `backend/app/config.py` — REUSE existing knobs: `harness_phase_max_steps=8`, `harness_phase_wall_clock_seconds=2400`, `harness_resume_lease_seconds=300` `[VERIFIED: config.py:861,862,870]`. Add a `max_continues_per_run: int = 3` knob (D-06) rather than a magic literal.

### Backend — GET reconcile endpoint (SC#5 / D-v2.5-03)
- `backend/app/api/threads.py` — ADD `GET /threads/{thread_id}/workflow` returning `ThreadWorkflowState` (Q3). Ownership-scoped (mirror get_snapshot:341–350). Reads `threads.active_workflow_run_id` → `workflow_runs` (status, definition, current_phase_id → `workflow_phases.slug`) → computes `mode`/`locked`/`lock_is_stale`/`cap_paused`/`continues_*`. PURE READ (never writes — the lock-clear is owned by cancel/terminal). Wrap blocking supabase-py in `run_in_threadpool` if used; prefer the asyncpg pool (`get_pg_pool`) for the joined read.
- `backend/app/models/thread.py` — ADD the `ThreadWorkflowState` model.

### Migration (063 — the next free number; head is 062)
`[VERIFIED: latest migration is supabase/migrations/062_workflow_run_claim_lease.sql; 060/061/062 present]`. Apply by PASTING into the Supabase SQL editor (NEVER `db push`/`db reset` — CLAUDE.md), then `bash scripts/regenerate-full-schema.sh` (no-reset live dump). Filename must match `<digits>_name.sql`.

`063_dual_mode_continue.sql` must:
1. `ALTER TABLE workflow_runs ADD COLUMN inputs jsonb NOT NULL DEFAULT '{}'::jsonb;` (SEED-047)
2. `ALTER TABLE workflow_runs ADD COLUMN model text;` (SEED-047; nullable — older rows have none)
3. `ALTER TABLE workflow_runs ADD COLUMN continues_used integer NOT NULL DEFAULT 0;` (D-06)
4. `ALTER TABLE runs ADD COLUMN continues_used integer NOT NULL DEFAULT 0;` (D-06, Deep-run cap)
5. Drop+recreate `workflow_runs_status_check` to include `cap_paused`: `('active','paused','cap_paused','completed','failed','cancelled')`.
6. Drop+recreate `runs_status_check` to include `cap_paused`: `('streaming','cap_paused','completed','failed','cancelled','timed_out')`.
7. (If the dropped-tool-calls buffer needs its own column rather than riding the system-warning `tool_calls` jsonb) — decide at plan time; reusing the existing `messages.tool_calls` jsonb on the `role='system'` carrier row avoids new columns.

Do NOT emit a `supabase db push` task — that violates project rules (memory: `feedback_apply_migrations_via_sql_editor`).

### Frontend — toggle + published-workflow picker (MODE-01 / D-01 / D-02)
- `frontend/src/components/chat/MessageInput.tsx` — add a Deep/Harness toggle alongside the agent-mode selector (the dropdown-button idiom at :238–259, `data-testid="agent-mode-selector"`). When Harness is chosen, show a published-workflow dropdown. Disable the toggle when the thread is workflow-locked (D-05 tooltip "Workflow running — Cancel to switch back"). Disable the General/Explorer selector while locked (D-03 tooltip "Controlled by the active workflow") — disable, don't hide.
- `frontend/src/lib/api.ts` — extend `postMessage` to send `workflow_definition_id` (mirror the `agent_mode` field at api.ts:355). ADD `listPublishedWorkflows()` (GET — backend route TBD: a `GET /workflows?published=1` or reuse an existing definitions list endpoint; verify whether one exists during planning).
- Follow `Skill("sketch-findings-agentic-rag")` for placement/copy — the composer toolbar is the documented home; Aether Deep Midnight tokens; amber=paused color language for the locked/Continue states.

### Frontend — per-thread lock state (MODE-02 / SC#3 — the highest-regression-risk surface)
- `frontend/src/providers/StreamsProvider.tsx` — add a per-thread keyed `workflowLockByThread: Map<threadId, {runId, mode, ...}>` following the EXACT copy-then-mutate shape of `_addRunToThread`/`_removeRunFromThread` (:717–748) and expose a `useWorkflowLockForThread(threadId)` selector mirroring `useStreamingForThread` (useMessages.ts:86). **NEVER a global boolean** (BUG-260523-01). The composer `disabled` + toggle-disabled derive from the OWNING thread id (not viewedThreadId) — same lesson as useMessages.ts:80–84.
- `frontend/src/hooks/useMessages.ts` — thin-reader passthrough if a public surface is needed (mirror :86).

### Frontend — Continue carrier + reconcile client (CONT-01 / D-07 / SC#5)
- `frontend/src/lib/api.ts` — ADD `getThreadWorkflow(threadId)` (calls the new `GET /threads/{id}/workflow`) for mount-time reconcile (D-v2.5-03) AND `continueRun(runId)` (calls `POST /runs/{id}/continue`). Mirror `cancelRun` shape.
- `frontend/src/lib/api.ts` (`subscribeToRun`) — ADD a `system_warning` / `cap_paused` SSE callback (today only `fallback_model` et al are handled — api.ts:611). The live Continue affordance needs the SSE event surfaced to a callback.
- **Continue button host (D-07):** the 075.4 "carrier" is NOT currently rendered — `role='system'` rows are filtered from `/messages` (threads.py:364) and `/snapshot` (threads.py:728) by BUG-260528-01, and no frontend system-warning renderer exists. So the carrier must be delivered out-of-band: render the Continue card from (a) the live `cap_paused` SSE event, and (b) the mount-time `GET /threads/{id}/workflow` `cap_paused`/`continues_*` fields. Place the card inline in chat near where the run paused — `MessageItem.tsx` already hosts the Resume button for failed/timed_out runs (MessageItem.tsx:341); the Continue card is the additive sibling for `cap_paused`. Keep this change additive — it rides the same surface Phase 095 will later unify (CONTEXT deferred note).

---

## Landmines (verification must target these)

1. **Continue cannot "consume" dropped tool calls today — the buffer is destroyed.** agent_loop.py:1856 does `tool_calls_buffer = {}` and persists only a text warning; the tool calls are logged, never stored `[VERIFIED: agent_loop.py:1842–1856]`. SC#4 REQUIRES persisting the buffered tool_calls before clearing. This is the single biggest hidden-work item.
2. **The 075.4 carrier is filtered out of every read path.** BUG-260528-01 excludes `role='system'` rows from `/messages` (threads.py:364) and `/snapshot` (threads.py:728) because `MessageResponse.role` is `Literal["user","assistant"]`. The Continue affordance needs an out-of-band delivery channel (SSE callback + the new GET), exactly like `ask_user/pending` is delivered out-of-band.
3. **No `INSERT INTO workflow_phases` exists in the live app.** `run_workflow` reads phases (`load_run_phases`, workflows.py:56) but nothing creates them — `create_workflow_run` must insert one phase row per PhaseSpec, or `run_workflow`'s `load_run_phases` returns empty and the loop no-ops `[VERIFIED: grep INSERT INTO workflow_phases = test fixtures only]`.
4. **`workflow_runs` has no `inputs`/`model` columns.** Persisting them is a migration, not just a code change `[VERIFIED: full-schema.sql:739–750]`. Missing this silently breaks SEED-047 resume rehydration.
5. **Two run rows per harness send.** The producer creates a `runs` row (threads.py:871) AND 092 creates a `workflow_runs` row. Their terminal writes both exist (`finalize_run` at threads.py:1198 + `finish_run` at harness_engine.py:528). The lock-clear (SC#2) must fire exactly once and in the same transaction as ONE of them — trace carefully to avoid a double-clear or a missed-clear.
6. **`cap_paused` must NOT map to an SSE terminal sentinel.** `_RUN_STATUS_TO_TERMINAL_TYPE` (threads.py:131) and `TERMINAL_TYPES` (:124) drive the consumer's stream-break. A cap-paused run is resumable — emit a distinct non-terminal event or the frontend will treat the pause as a completed run and the Continue stream can't re-attach.
7. **Engine ctx ≠ RunContext.** `run_workflow` takes a loose `ctx` bag (SimpleNamespace-style — see `_build_resume_context`, harness_engine.py:559–579) with `run_id/thread_id/current_user/redis/pool/emit/retry_feedback`, NOT the frozen `RunContext` the agent loop uses (threads.py:1038–1048). The producer's Harness branch must build the engine-flavored ctx, not pass `RunContext`.
8. **Deep-run-cap-pause changes the `runs` finalize status.** Today a force_no_tools run finalizes `completed` (the text answer). When a Continue is offered, the run must finalize `cap_paused` (non-terminal) — a behavior change scoped strictly to the cap-with-dropped-tools case. Deep Mode WITHOUT a cap-drop must stay byte-identical.
9. **FK insert ordering.** `workflow_runs` must be INSERTed before `threads.active_workflow_run_id` UPDATE (the FK points threads→workflow_runs). One transaction, INSERT-then-UPDATE (full-schema.sql:1634/1698).

---

## Validation Architecture

Nyquist validation is ENABLED. Test infra: **pytest** under `backend/tests/` (e.g. `test_harness_engine.py`, `test_harness_gates.py`, `test_harness_resume.py`) with asyncpg-mock fixtures `[VERIFIED: backend/tests/test_harness_*.py invoke run_workflow with mock_asyncpg_pool/fake_redis]`. Frontend has Playwright E2E + Chrome DevTools MCP (CLAUDE.md memory `feedback_chrome_mcp_testing`). Supabase CLI + supabase-py + LangSmith are the live evidence tools (memory `reference_evidence_tools_inventory`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend, async) + Playwright/Chrome MCP (frontend UAT) |
| Config file | `backend/` pytest (existing `test_harness_*.py` suite) |
| Quick run command | `cd backend && venv\Scripts\python -m pytest tests/test_harness_engine.py tests/test_dual_mode_wiring.py -x -q` |
| Full suite command | `cd backend && venv\Scripts\python -m pytest tests/ -q` |

### Success-Criteria + REQ → Verification Map
| SC / REQ | Observable signal proving it | Evidence tool | Sampling rate |
|----------|------------------------------|---------------|---------------|
| **SC#1 / MODE-01** — mode per-thread; branch above loop; switch only on NEXT run | `agent_runner` branches on `active_workflow_run_id`; a mode switch mid-stream does not mutate the in-flight run | pytest (branch unit) + Chrome MCP (toggle mid-stream → in-flight run unchanged) | per task commit (unit); phase gate (UAT) |
| **SC#2 / MODE-02** — no dangling lock; cancel/terminal clears anchor in SAME txn | After Cancel AND after natural terminal, `SELECT active_workflow_run_id FROM threads WHERE id=...` is NULL | Supabase SQL query (the binding proof) + pytest txn test | per wave merge + phase gate |
| **SC#3** — per-thread lock, never global boolean | **Parallel-thread UAT:** Thread A streaming a workflow; Thread B's mode toggle + composer remain free | Chrome MCP (two threads) — the binding gate | phase gate (mandatory) |
| **SC#4 / CONT-01** — Continue consumes, not re-drops; bounded budget; Harness re-reads available_tools | Persisted dropped tool_calls exist at cap; after Continue, those exact tool_calls execute (results in the transcript), run resumes same run_id/phase; 4th Continue refused | pytest (persist+consume unit) + LangSmith (tool calls actually ran) + Chrome MCP (Continue button → tools run) | per task commit + phase gate |
| **SC#5** — reconcile via fetch; never stuck locked | `GET /threads/{id}/workflow` returns correct mode/lock/phase; `lock_is_stale=true` when run terminal/absent | pytest (endpoint unit) + Chrome MCP (reload mid-workflow → panel/composer reconcile) | per wave merge + phase gate |
| **Deep Mode byte-identical** (additive-only) | SSE event sequence for a Deep multi-tool run is identical pre/post (snapshot diff empty); `active_workflow_run_id IS NULL` path unchanged | The 089 SSE capture/normalize harness (run1-vs-run1 structural diff) | phase gate |
| **SC#10 4-axis (phase gate)** — native-7 × multi-tool × parallel-thread × long-message | A workflow kickoff + a Deep multi-tool prompt across native providers; parallel-thread (SC#3); ≥50-msg/≥5KB long-message; **both `agent_mode` values** | Chrome MCP UAT scoreboard under VALIDATION.md (not PLAN tasks) | phase gate (mandatory) |
| **091 cross-provider workflow UAT unblock** | A persisted `workflow_runs` row now exists (092 created it) → 091's cross-provider workflow run can finally be triggered and observed | Supabase (workflow_runs row) + LangSmith (per-provider workflow run) | phase gate |

- **Sampling rate** — per task commit: quick run; per wave merge: full backend suite; phase gate: full suite green + Chrome MCP 4-axis + the Supabase lock-clear queries before `/gsd-verify-work`.
- **SC#3 is the binding lived-experience gate** (memory `feedback_uat_lived_experience_gap`, `feedback_exhaustive_ui_state_sweep`): exercise the toggle bidirectionally on two live threads, not just wire-format.
- **SC#2 proof is a Supabase query**, not a log line: the anchor must be NULL after both cancel and natural terminal.

### Wave 0 Gaps
- [ ] `backend/tests/test_dual_mode_wiring.py` — covers SC#1 (branch), SC#2 (lock-clear txn), Q5 (`create_workflow_run` atomicity incl. phase-row inserts + FK ordering).
- [ ] `backend/tests/test_continue.py` — covers SC#4 (persist-then-consume dropped tool_calls; 3-cap refusal; Harness available_tools re-read), CONT-01.
- [ ] `backend/tests/test_thread_workflow_endpoint.py` — covers SC#5 (`ThreadWorkflowState` shape, `lock_is_stale` heal).
- [ ] Frontend: a Playwright/Chrome-MCP parallel-thread scenario (SC#3) + a reload-mid-workflow reconcile scenario (SC#5).
- [ ] `verify_092.sql` live-DB gate (mirror the 090 `verify_090.sql` precedent): assert migration 063 columns + CHECK values applied, and a sample lock round-trips to NULL.

---

## Project Constraints (from CLAUDE.md)

- Raw SDK only — NO LangChain/LangGraph (the engine is already hand-rolled asyncio; keep the Continue path raw).
- Pydantic for structured outputs (`ThreadWorkflowState`, `MessageCreate` extension).
- RLS on all tables — the GET endpoint and the kickoff definition read must be owner-scoped; the asyncpg service-role helper trusts an already-ownership-checked `thread_id`.
- `run_in_threadpool` for blocking supabase-py (D-v2.5-01) — prefer the asyncpg pool for the joined GET read.
- Realtime is a hint; reconcile via fetch (D-v2.5-03) — directly drives `GET /threads/{id}/workflow`.
- Multi-worker default (WORKER_COUNT=2) — per-thread keyed state, no global singletons; `continues_used` MUST be durable (a column), never in-memory.
- Migrations: numbered SQL, applied via Supabase SQL editor, then `regenerate-full-schema.sh` (no reset). Next number: 063.
- One UX, N adapters — the mode branch + lock are provider-agnostic at the producer; ZERO provider-branch edits; Deep Mode byte-identical (075.x cascade rule).
- G-2 not flagged for 092 (UI reuses existing idioms); if the kickoff UX grows beyond toggle+dropdown, escalate to `/gsd:sketch`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reusing the existing `messages.tool_calls` jsonb on the `role='system'` cap row (vs a new column) is sufficient to persist the dropped tool calls for Continue consumption. | Q1 / migration | If a dedicated column is cleaner for the consume path, a small migration delta is needed. Low risk — both are viable. |
| A2 | A single `runs` row + a separate `workflow_runs` row per harness send is the intended model (the producer's `runs` row stays for SSE-terminal consistency; `workflow_runs` is the engine's row). | Landmine 5 | If the planner instead wants one unified row, the finalize/lock-clear wiring differs. The roadmap's "branches to the engine and creates its runs" implies two rows; confirm in plan-phase. |
| A3 | The Deep-run Continue (re-running dropped tool calls with results fed back into a fresh budget) is implementable as an additive `RunContext` flag without touching provider branches. | Q1 / files-to-modify | If the agent loop's force_no_tools structure can't cleanly pre-load a tool round, this becomes a larger agent-loop change. Verify against `_stream_one_iteration` tool-dispatch shape during planning. |
| A4 | A published-workflows LIST endpoint for the picker either exists or is a trivial add. | Frontend toggle/picker | If none exists, add a `GET /workflows?published=1` (small). Verify at plan-phase. |

## Open Questions

1. **One run row or two?** (A2) — does the harness send keep the producer's `runs` row terminal-finalized for SSE consistency while `workflow_runs` is the engine row, or unify? Recommendation: keep two (matches "creates its runs"); confirm the single lock-clear site.
2. **Deep-run-cap consume mechanics** — exact entry-point in `agent_loop.py` to re-feed dropped tool calls within a fresh budget without disturbing Deep Mode. Recommendation: an additive `resume_dropped_tool_calls` flag on `RunContext`, off by default.
3. **Published-workflow LIST endpoint** (A4) — confirm presence; add if absent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (Postgres) | migration 063 apply + RLS + Supabase-query proofs | ✓ | CLI v2.101 (memory) | — |
| Redis (local) | producer SSE + run registry + cap_paused event | ✓ | docker-compose.dev.yml | — |
| asyncpg pool | `create_workflow_run`, GET reconcile, continues_used | ✓ | in-code (`get_pg_pool`) | — |
| Chrome DevTools MCP | SC#3 parallel-thread + SC#5 reconcile + SC#10 UAT | ✓ | MCP (memory) | — |
| LangSmith | SC#4 tool-calls-actually-ran evidence | ✓ | SDK/API (no MCP) | backend logs |
| Native-7 provider keys | SC#10 4-axis | ✓ | backend/.env (memory: GLM/MiniMax added 2026-05-30) | OpenRouter best-effort |

## Sources

### Primary (HIGH — verified against live code this session)
- `backend/app/services/harness_engine.py` — `run_workflow` signature/ctx, `finish_run`, `_load_run_definition`, resume-sweep semantics, no live caller.
- `backend/app/db/workflows.py` — existing reads; column-name contract; no `create_workflow_run`; no phase INSERT.
- `backend/app/db/runs.py` — `insert_run`/`finalize_run` asyncpg precedent to mirror.
- `backend/app/api/threads.py` — send_message route (:760), run INSERT (:871), producer/`agent_runner` (:957), `run_agent_loop` call (:1049), `_shielded_finalize` (:1122–1246), system-row filters (:364/:728).
- `backend/app/services/agent_loop.py` — cap point `force_no_tools` (:1181), drop+clear (:1842–1856), max_iterations (Deep=8/Explorer=15, :846/:850).
- `backend/app/api/runs.py` — cancel happy path (:660) + zombie heal (:702); no resume/continue endpoint.
- `supabase/full-schema.sql` — runs CHECK (:564), threads anchor + FK + index (:634/:1634/:1218), workflow_runs (:739–750, no inputs/model/continues_used), workflow_phases (:714–725), workflow_definitions (:686–699).
- `backend/app/models/harness.py` — `WorkflowDefinition`/`PhaseSpec`/`available_tools`.
- `backend/app/models/message.py` — `MessageCreate` (extend for kickoff).
- `backend/app/config.py` — harness knobs (:861/:862/:870).
- `frontend/src/providers/StreamsProvider.tsx` — per-thread keyed Map helpers (:717–748).
- `frontend/src/hooks/useMessages.ts` — `useStreamingForThread` selector idiom (:86).
- `frontend/src/components/chat/MessageInput.tsx` — agent-mode selector idiom (:238–259).
- `frontend/src/lib/api.ts` — `postMessage` (:338), SSE handlers (:611).
- `frontend/src/components/chat/MessageItem.tsx` — Resume-button host for failed/timed_out (:341).

### Secondary (HIGH — binding design docs)
- `.planning/phases/092-.../092-CONTEXT.md` (D-01..D-08, canonical refs, critical-risk surfaces).
- `.planning/seeds/SEED-029-...md` (Continue design §1–§5).
- `.planning/ROADMAP.md` Phase 092 (5 SCs, :112–117) + REQUIREMENTS.md (MODE-01/02, CONT-01, :33–35).
- `CLAUDE.md` (migrations, D-v2.5-01/03, WORKER_COUNT, UAT scoreboard) + `.claude/skills/sketch-findings-agentic-rag/SKILL.md`.

## Metadata

**Confidence breakdown:**
- Run-creation + producer branch: HIGH — exact line numbers; gap (no INSERT) verified by grep.
- Cancel/lock-clear: HIGH — both cancel paths + both finalize sites traced.
- Continue + cap-persist: HIGH on the diagnosis (buffer is destroyed today), MEDIUM on the exact consume mechanics (A3 — agent-loop re-feed entry-point needs a planning spike).
- Migration: HIGH — head is 062, schema columns/CHECKs verified absent.
- Frontend: HIGH — per-thread keyed pattern + selector idiom + carrier-filter gap all verified.

**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (stable substrate; the only fast-moving risk is the agent-loop consume mechanics if 093/095 touch the same surface first).

## RESEARCH COMPLETE
