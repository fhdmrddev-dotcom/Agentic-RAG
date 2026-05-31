---
status: research
phase: 092-dual-mode-wiring-continue-button
plan: 07
gap_closure: true
source: 092-06-UAT-FINDINGS.md
---

# 092-07 — F4 id-routing gap-closure research

> Implementation-ready research for the gsd-planner to author `092-07-PLAN.md`.
> Closes **F4** (sub-agent `parent_run_id` `ForeignKeyViolationError`) **and** its
> confirmed sibling, the **SSE-routing facet** (harness progress events emitted to
> a stream nobody watches). Both share ONE root cause and ONE fix family.
>
> Read alongside `092-06-UAT-FINDINGS.md § Regression guardrails`. Six adversarial
> surfaces were probed; **two did NOT hold** (SSE routing, resume path) — their holes
> are baked into the design below (see `## Resume-path handling` and the ask_user
> sub-section under `## Edit sites`). The other four hold (Deep byte-identical,
> F1/F2, cross-provider native-7, thread-switch holds in part — its one failing leg
> is the same resume-finalizer hole).

---

## Root cause

F4 is **two facets of one defect**: the harness engine threads the **`workflow_runs.id`**
(e.g. `e358e5f7`) as `ctx.run_id`, but two consumer classes semantically require the
**producer `runs.run_id`** (e.g. `b5e85c73`).

### Facet A — sub-agent `parent_run_id` FK violation (the live crash)

- Producer `runs` shell row is minted at `backend/app/api/threads.py:902`
  (`run_id = _uuid_mod.uuid4()`) and INSERTed at `threads.py:942` (`insert_run(... run_id=run_id, status='streaming')`). This is the canonical `runs.run_id` (`b5e85c73`).
- `_active_workflow_run_id = await create_workflow_run(...)` at `threads.py:986` returns a **`workflow_runs.id`** (`e358e5f7`) — a separate table, NOT a `runs` row.
- **Root wiring site:** `threads.py:1158-1167` builds `wf_ctx = SimpleNamespace(run_id=_active_workflow_run_id, ...)` — the engine `ctx.run_id` is the workflow_run id.
- **Propagation:** `_build_phase_tool_context` (`backend/app/services/harness/phase_types.py:120-139`) copies `run_id=getattr(ctx,'run_id',None)` into the sub-agent parent `ToolContext`.
- **Crash:** `run_task_sub_agent` (`backend/app/services/task_service.py:264-273`) calls `insert_run(... parent_run_id=parent_ctx.run_id)`. `runs.parent_run_id` FKs to `runs.run_id` (`runs_parent_run_id_fkey`, `supabase/full-schema.sql:1614-1618`, added by `supabase/migrations/055_todos_table.sql:39-42`). `parent_ctx.run_id` = the workflow_run id, which is **not** in `runs` → `asyncpg.exceptions.ForeignKeyViolationError`. Live evidence: sub_run parent = `e358e5f7`.
- The fresh `sub_run_id = uuid4()` (`task_service.py:248`) is its OWN brand-new `runs` row and is **correct** — only its `parent_run_id` is wrong.

### Facet B — SSE routing (CONFIRMED a real second bug)

The adversarial SSE verdict **held=false** but its core thesis is correct and confirmed against live code:

- The frontend subscribes `GET /runs/{run_id}/stream` with the **producer** id returned by `POST /messages` (`threads.py:1455` returns `str(run_id)` = producer id). The endpoint (`backend/app/api/runs.py:386-407`) does an ownership SELECT against **`public.runs`** keyed on `run_id`, then reads `run:{run_id}` (`runs.py:417`). A `workflow_runs` id **404s** there — the endpoint **structurally cannot serve any id except a `public.runs` id**, foreclosing alternatives.
- But `_emit` (`backend/app/services/harness_engine.py:104-111`) does `XADD run:{run_id}` where `run_id` is whatever `run_workflow` was called with = `_active_workflow_run_id` = the workflow_run id. Every `phase_started / phase_completed / phase_transition / gate_failed / run_completed / run_failed` lands on `run:{workflow_run_id}` — **a stream nobody watches**.
- The **only** event the watched producer stream sees in harness mode is the terminal sentinel from `_shielded_finalize` (`threads.py:1360`, on the producer id).
- The sub-agent sub-tree is internally consistent (`sub_agent_start/done` on `parent_ctx.run_id`, sub internals on `sub_run_id`) but the **whole tree is rooted on the orphaned workflow stream**.

**Correct stream id = the producer `runs` id** — the SAME value that fixes Facet A, so both facets share one fix.

---

## Id-routing design

Three distinct ids flow through the harness path. The fix is **additive**: introduce a
second field (`producer_run_id`) on the harness ctx bag; **do NOT reassign `ctx.run_id`**
(the workflow_run id is legitimately required by audit / terminal / definition / resume-match consumers).

| Role / consumer | Id needed | File:anchor | Notes |
|---|---|---|---|
| Sub-agent `insert_run(parent_run_id=...)` (FK target) | **producer** | `task_service.py:264-273` → fed from `phase_types.py:122` | FKs `runs.run_id`; the live crash |
| `sub_agent_start` / `sub_agent_done` parent-stream emits | **producer** | `task_service.py:283-291`, `:464-465` | Same value as `parent_run_id`; both must be producer id |
| Harness engine `_emit` (phase/gate/run events) | **producer** | `harness_engine.py:104-111` + call sites `277,314,436,479,496,518,533,557` | Route to producer stream so frontend (watching `run:{producer}`) sees them |
| `ask_user_prompt` emit **transport** | **producer** | `phase_types.py:347-359` | DIRECT executor emit — NOT an engine `_emit` site (see hole below) |
| `write_audit(run_id=...)` | **workflow_run** | `harness_engine.py:273,289,310,429,465,475,492,511,526,553` | `harness_audit.run_id` has **no FK** (`full-schema.sql` index-only); rows are workflow-run-keyed. F1 (092-05) `user_id` from `ctx.current_user` is orthogonal |
| `finish_run(pool, run_id, status)` (workflow_runs terminal + anchor clear) | **workflow_run** | `harness_engine.py:464,491,552` + F2 terminalize `threads.py:1390-1405` | Keys `workflow_runs.id`, clears `threads.active_workflow_run_id` (FK) |
| `mark_phase_active / complete_phase / fail_phase / advance_current_phase` | **workflow_run** | `harness_engine.py:427,461,474,504,510` | Engine resolves phases via the workflow_run id |
| `_load_run_definition` (JOIN `WHERE wr.id=$1`) | **workflow_run** | `harness_engine.py:561-583` | Both live and resume |
| Resume ctx identity (`find_resumable_runs` aliases `wr.id AS run_id`) | **workflow_run** | `workflows.py:188-202` → `harness_engine.py:586-606` | On resume `ctx.run_id` = workflow_run id |
| ask_user durable prompt-row tag + `subscribe_for_response` channel + resume matcher | **workflow_run** | `phase_types.py:335` (`str(run_id)`), `:363`, `workflows.py get_pending_ask_user` filter `tool_calls->0->>'run_id'` | Must stay INTERNALLY CONSISTENT live↔resume — keep the embedded VALUE on workflow_run id (only the emit transport moves) |
| Sub-agent's own runs row + its own stream | **fresh `sub_run_id`** | `task_service.py:248,296-323,363-364` | `uuid4()`; unchanged, correct |

**ask_user is genuinely cross-cutting and split.** The durable prompt-row run_id VALUE,
the `subscribe_for_response` pub/sub channel key, and the `get_pending_ask_user` resume
matcher MUST all stay on the **workflow_run id** (live↔resume answer-channel consistency).
ONLY the `ask_user_prompt` emit **transport** (which Redis stream the event lands on) must
move to `run:{producer}` so the frontend renders the question — **without** changing the
run_id value embedded in the prompt row / subscribe channel. See the dedicated hole below.

---

## Edit sites (additive, harness-scoped)

All edits are on the harness side. The Deep `else` branch (`threads.py:1175-1194`),
`RunContext` (`agent_loop.py:83`), the Deep `ToolContext` (`agent_loop.py:2178`), and
`task_service.insert_run` ordering stay **byte-identical** (Deep already threads the
producer `runs` id end-to-end and already resolves the FK + watched stream).

### 1. `backend/app/api/threads.py:1158-1167` — add `producer_run_id` to `wf_ctx`
ADD `producer_run_id=run_id` (the in-scope producer-shell id minted at `:902`, INSERTed at `:942`). Do **NOT** change `run_id=_active_workflow_run_id`. `wf_ctx` is a loose `SimpleNamespace`, so a new attr is non-breaking. `run_id` is in scope here as the `agent_runner(run_id)` param (`threads.py:1052`, spawned at `:1430`).

### 2. `backend/app/services/harness/phase_types.py:120-139` — source sub-agent parent id from producer
Change `run_id=getattr(ctx,'run_id',None)` → `run_id=getattr(ctx,'producer_run_id',None) or getattr(ctx,'run_id',None)`. This single chokepoint fixes BOTH `_exec_llm_agent` (`:217`) and `_exec_llm_batch_agents` (`:268`). Leave `parent_run_id=None` here (this ToolContext IS the parent; the sub-agent's `parent_run_id` is set downstream from `parent_ctx.run_id`).

> **Fail-closed guard (recommended over silent fallback):** the `or getattr(ctx,'run_id',None)` fallback silently reverts to the workflow_run id if `producer_run_id` is absent — which re-triggers the FK on any resume site that wasn't patched. Per the cross-provider verdict's hole, prefer a guard that **raises** when a harness ctx reaches the sub-agent insert with a parent that is not a `runs.run_id` (or explicitly resolves to `None`), rather than letting the FK violation re-surface for all seven providers.

### 3. `backend/app/services/harness_engine.py` — route engine emits to the producer stream
Thread a `stream_run_id` (= `ctx.producer_run_id`, defaulting to the workflow_run id when absent) through `run_workflow` **AND `_run_phase_with_gates`**, and use it for every `_emit(redis, stream_run_id, ...)`. Keep `write_audit / finish_run / load_run_phases / _load_run_definition` on the workflow_run id.
- **Hole baked in (F1/F2 verdict):** the named edit_sites in the brief omit `_run_phase_with_gates`, which ALSO emits `gate_failed` (`harness_engine.py:277,314`) off the same `run_id` arg that feeds its `write_audit`. Its signature already takes `run_id` + `_audit_user_id` as separate kwargs, so adding a `stream_run_id` kwarg is clean. **Both** functions must thread `stream_run_id` or the event tree splits (phase_* on producer stream, gate_failed on orphan stream).
- `_emit` and `write_audit` are separate call sites taking the same `run_id` arg in both functions — decoupling is mechanically clean, no coupling to break (closes open-question #4).

### 4. `backend/app/services/harness/phase_types.py:347-359` — ask_user_prompt emit transport (NEW — verdict hole)
The SSE verdict held=false specifically because this site was left unrouted. `_exec_llm_human_input` emits `ask_user_prompt` via `emit(redis, run_id, ...)` where `run_id` = workflow_run id (`getattr(ctx,'run_id')`) — a **DIRECT executor emit, NOT an engine `_emit` site**, so threading `stream_run_id` through `run_workflow` does NOT reach it. The brief's "rides the same bridge" premise is **false**. Without fixing this, any workflow with an `llm_human_input` phase emits an INVISIBLE prompt to `run:{workflow_run_id}`; the frontend (`onAskUserPrompt` wired into `subscribeToRun(producer_id)`) never renders it, the user can't answer, and `subscribe_for_response` blocks to its (up to 1800s) timeout — a hard functional regression.
- **Required change:** emit the `ask_user_prompt` event on the **producer stream transport** (`run:{producer}`) while keeping the run_id VALUE embedded in the durable prompt row (`phase_types.py:335`), the `subscribe_for_response` channel (`ask_user:{run_id}:{tcid}`, `:363`), and the `get_pending_ask_user` matcher on the **workflow_run id**. i.e. add an explicit producer-stream transport arg to the emit; do not change the pub/sub key value.
- **Audit for sibling escapes:** confirm no other executor (`_exec_programmatic / _exec_llm_single / _exec_llm_agent / _exec_llm_batch_agents`) emits `todo_updated / workspace_file_written` via `emit(ctx.run_id, ...)` directly — the same invisibility regression would apply to panel updates.

### 5. `backend/app/services/harness_engine.py:586-606` (`_build_resume_context`) — see `## Resume-path handling`
### 5b. `backend/app/api/runs.py:734-754` (`_harness_continuation`) — see `## Resume-path handling`
BOTH resume ctx build sites must apply identical `producer_run_id` handling. They are built independently (verified live).

### 6. `backend/app/services/task_service.py:248-291` — NO CHANGE
`task_service` is mode-agnostic and trusts the caller (it does NOT validate `parent_ctx.run_id` membership in `runs`). Once `parent_ctx.run_id` carries the producer id (via edit #2), `insert_run(parent_run_id=...)` resolves the FK and `sub_agent_start` emits land on the watched stream automatically. An optional `None`-guard is defense-in-depth (`insert_run` already accepts `parent_run_id=None`).

---

## Resume-path handling

**The resume verdict held=false. This is the load-bearing section.** F4 is **NOT
live-kickoff-only** — it recurs on BOTH resume paths because all three feed the
workflow_run id into the engine ctx, and neither resume path mints a producer `runs` row.

### Confirmed facts (live code)
- **No producer link persisted.** `workflow_runs` (`full-schema.sql:747-762`) has no producer-run column; `runs` (`:547-566`) has no `workflow_run_id` column. The startup sweep **cannot recover** the original producer id (`b5e85c73`) — that run was finalized and its `run:{id}` stream EXPIREd.
- **Zero `insert_run` on resume.** `harness_engine.py` has no `insert_run` call; `runs.py` `_harness_continuation` has none. Resume re-drives `run_workflow` with no new `runs` row. A resumed `llm_agent` / `llm_batch_agents` phase forks a fresh `sub_run_id` and calls `insert_run(parent_run_id=parent_ctx.run_id=workflow_run_id)` → the SAME FK violation.
- **Continue path inbound id is WRONG after reload (verified).** `MessageItem.tsx:397` calls `continueRun(workflowLock.runId)`. `workflowLock.runId` is seeded from the **producer** id at kickoff (`StreamsProvider.tsx:1235`) BUT from `wf.active_workflow_run_id` = the **workflow_run id** on the mount/reconcile path (`StreamsProvider.tsx:1145-1147`). So after a page reload the Continue button POSTs the **workflow_run id** to `/runs/{id}/continue`, whose ownership SELECT (`runs.py:627-636`) is against the **`runs` table** → no row → **404 "Run not found"**, BEFORE the harness re-drive ever runs. The brief's claim that the Continue path parameter "IS a public.runs id" is **false** post-reconcile.
- **No resume finalizer.** `run_workflow` writes only `workflow_runs` via `finish_run`; there is NO `_shielded_finalize` equivalent. The F2 terminalize (`threads.py:1390-1405`) runs ONLY in the live `agent_runner` finally — it does NOT cover `resume_stranded_workflows → _resume_run` or `_harness_continuation`.

### Chosen handling — Option A (mint-fresh producer-shell row), fully specified

Per the operator no-regression directive and the SSE/thread-switch surfaces, the FK-safe
`None` fallback is an explicit downgrade (resumed sub-agents become top-level → loses
panel drill-down via `idx_runs_parent`; resume has no live SSE stream → defeats
thread-switch/reattach). **Choose Option A and close its holes**:

1. **Mint a fresh producer-shell `runs` row** at each resume ctx build site (`_build_resume_context` + `_harness_continuation`): `insert_run(run_id=uuid4(), thread_id, user_id=run['user_id']/current_user['id'], status='streaming', model=<placeholder>, provider=<placeholder>, parent_run_id=None)`. Set `producer_run_id` = that fresh id.
   - **`model`/`provider` are NOT NULL** (`db/runs.py:42-43`). Resume `user_settings=None`, so supply a concrete placeholder (e.g. `"unknown"/"unknown"`) or read the persisted `workflow_runs` row. The shell is never used for an LLM call, so the placeholder cannot misroute any provider's sub-agent (cross-provider verdict confirmed orthogonal) — but a missing value raises `NotNullViolationError` and strands the resume.
2. **Terminalize the fresh producer row on EVERY resume exit path** (incl. exception/cancel) — add a resume-side `_shielded_finalize` equivalent mirroring `threads.py:1407-1410`. **This is mandatory, not optional.** Without it, a crashed/cancelled resume strands a `status='streaming'` row that becomes the thread's latest `runs` row, so the reconcile F2 self-heal (`threads.py:1551-1562`, `SELECT status ... ORDER BY started_at DESC LIMIT 1`) reads `streaming` → `producer_terminal=False` → `lock_is_stale=False` → **re-wedges the thread** — the exact class F2 (092-05) was built to close. (This is the single failing leg of the thread-switch verdict.)
3. **Surface the fresh producer `run_id` back to the frontend** so it can re-subscribe `GET /runs/{new_producer}/stream`. The frontend only holds the (now-finalized/EXPIRED) original id. Options: have the `/continue` response return the new producer id, and/or expose it via `get_thread_workflow` reconcile so mount re-attach finds the live stream. (Open question — see below; required for resume SSE visibility but not for the FK fix itself.)
4. **Continue path 404 — fix independently of F4.** Because `workflowLock.runId` carries the workflow_run id after reload, `/runs/{id}/continue`'s ownership SELECT must either (a) accept a workflow_run id (look up the anchor → `workflow_runs`) or (b) the frontend must send a `runs` id. The current code already branches on `active_workflow_run_id` read from the `threads` anchor (`runs.py:651-705`), but it 404s at Step 1 before reaching that branch when the inbound id is a workflow_run id. **The plan must confirm/repair whether harness Continue currently 404s post-reload independent of F4**, then mint the fresh producer row inside the `_harness_continuation` branch.

### Three build sites must all be patched
| Site | File:anchor | Producer id available? |
|---|---|---|
| Live kickoff | `threads.py:1158` | YES — `run_id` in scope |
| Startup sweep | `harness_engine.py:598-606` (`_build_resume_context`) | NO — must mint |
| POST /continue | `runs.py:735-744` (`_harness_continuation`) | NO — must mint (and fix the 404) |

The mint+finalize machinery is only needed at the two resume sites; the live site already has the producer id.

---

## Regression guardrails

Cross-reference **`092-06-UAT-FINDINGS.md § Regression guardrails`**. The operator
**no-regression directive** is binding: every item below must be preserved/verified.

| Guardrail | Status from adversarial probe | What the plan must hold |
|---|---|---|
| **Deep byte-identical** | HOLDS | No edits to Deep `else` (`threads.py:1175-1194`), `RunContext`, Deep `ToolContext` (`agent_loop.py:2178`), `_handle_task`, or `task_service.insert_run` ordering. Add ONE Deep-path regression row proving the RunContext + sub-agent `parent_run_id` are unchanged after the `wf_ctx` edit (verdict hole: byte-identical currently argued from reachability only). Confirm `_build_phase_tool_context` stays unreachable from Deep. |
| **Cross-provider native-7** (OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax) | HOLDS | `resolve_sub_agent_model_safely` + provider/model/tools resolution never consult `run_id` (`task_service.py:251-374`). The edit feeds an id used ONLY for FK + stream identity. The fail-closed guard (edit #2) protects all 7 providers from the silent-fallback FK re-trigger. |
| **Thread-switch mid-run + per-thread lock keying (BUG-260523-01)** | HOLDS EXCEPT the resume-finalizer leg | Lock keying is on `threads.active_workflow_run_id` (workflow_run id), preserved. The ONE failing leg is the stranded-`streaming`-row re-wedge — closed by resume-finalizer (Resume §2). |
| **Reload-reconcile (F2 self-heal)** | Same leg as above | The fresh resume producer row must be terminalized so `ORDER BY started_at DESC LIMIT 1` self-heal isn't defeated. |
| **Sub-agent demux (R9)** | HOLDS | `sub_ctx.run_id = sub_run_id` (`task_service.py:298`) untouched; sub internals stay on their own stream. |
| **F1 (harness_audit user_id, workflow-run keyed)** | HOLDS | `write_audit(run_id=workflow_run_id, user_id=_audit_user_id)` call shape unchanged; `_audit_user_id` resolution untouched on live + resume. |
| **F2 (failed/timeout terminalizes workflow_runs + clears anchor)** | HOLDS | `_active_workflow_run_id` never reassigned; F2 block (`threads.py:1390-1405`) + `_shielded_finalize` F1/F2 blocks untouched. |
| **CONT-01 (cap_paused Continue within bounded budget)** | Must verify | `continues_used` cap logic (`runs.py:666-702`) operates on `workflow_runs.id`/`runs` row as today; the fresh-producer-row mint must NOT disturb the durable cap counter. |
| **Test baselines** | Must verify | Existing mock-pool tests (`test_085_sub_agent_emit.py:58-93`, `test_harness_engine.py:575-616`) patch `insert_run`/`run_task_sub_agent` so the FK is never enforced — the SAME blind spot that hid F1. Add the live-DB FK test (below) without breaking these. |

---

## Open questions for discuss/plan (RESOLVED)

> All six resolved in `092-07-PLAN.md` (see the inline pointer under each).

1. **Resume SSE re-attach contract.** If resume mints a fresh producer row, what id does the frontend re-subscribe to? The `/continue` response currently returns the OLD `run_id` (`runs.py:775`); `get_thread_workflow` reads `workflow_runs`, not the fresh producer id. Decide: return the new producer id from `/continue` and/or expose via reconcile.
   - **RESOLVED (Task 3 + Task 4):** BOTH surfacing paths are guaranteed. `/continue` 200 returns `producer_run_id` (Task 3 edit #5b → Task 4 frontend re-subscribe), AND `get_thread_workflow` surfaces `latest_producer_run_id` by adding `run_id` to the EXISTING F2 self-heal SELECT (`threads.py:1551-1562` — pure additive read, no new query, no write) so the startup-sweep path re-attaches on mount/reconcile (Task 4 backend (B) + frontend reconcile). must_haves truth #7.
2. **Continue 404 repair scope.** Is the post-reload Continue 404 (`workflowLock.runId` = workflow_run id) fixed inside F4's plan, or is it a separate defect? It is currently masked only because pre-reload kickoff seeds the producer id. The plan must decide whether `/runs/{id}/continue` accepts a workflow_run id (anchor lookup) or the frontend sends a `runs` id.
   - **RESOLVED (Task 4 backend (A)):** fixed inside F4's plan. `continue_run` gets a two-stage owner-scoped resolve — the existing `runs` SELECT, then a `workflow_runs WHERE id=$1 AND user_id=current_user` resolve confirmed against the `threads.active_workflow_run_id` anchor — so a post-reload workflow_run id no longer 404s, with the IDOR mitigation preserved (T-092-07-02).
3. **Placeholder model/provider on the minted resume shell.** `"unknown"/"unknown"` vs reading the persisted `workflow_runs` row. The shell is never used for an LLM call, so either is safe for routing — but must be NON-NULL.
   - **RESOLVED (Task 3 edit #5):** mint with `model="unknown", provider="unknown"` (NON-NULL placeholders per `db/runs.py:42-43`); the shell never makes an LLM call so the placeholder cannot misroute any provider (acceptance criterion `model='unknown', provider='unknown'`).
4. **Engine `_emit` refactor surface.** Confirm threading `stream_run_id` through `run_workflow` **and** `_run_phase_with_gates` does not couple `gate_failed` emit to `write_audit`'s `run_id` (they are separate call sites — verified clean, but assert in plan).
   - **RESOLVED (Task 2 edit #3):** two independent `_emit` site groups are routed via `stream_run_id` (7 in `run_workflow` + 2 `gate_failed` in `_run_phase_with_gates` = 9 total), while every `write_audit` stays on `run_id`; the decoupling is asserted by the `gate_failed_stream` test and the acceptance criterion that no `write_audit(... stream_run_id ...)` exists.
5. **Backfill.** In-flight `workflow_runs` created before this fix have no recoverable producer id — they MUST take the mint-fresh-row path (no migration recovers historical producer ids). Confirm no lookup is assumed.
   - **RESOLVED (objective OUT OF SCOPE + Task 3):** no migration/persistence column is added; both resume paths take the mint-fresh producer-shell path (no historical-producer-id lookup is assumed anywhere).
6. **Top-level assumption sweep.** `parent_run_id` was added in 055 for Phase 085 sub-agents (Deep already sets it), so the harness path is just a new caller. Verify `runs:active` cleanup, `runs_by_thread` ZADD, and snapshot-listing queries don't break when a harness sub-agent's parent is the short-lived (EXPIRE-able Redis, persisted Postgres) producer shell — including the transient extra producer-shell row a Deep thread snapshot could observe on a resume.
   - **RESOLVED (Task 3 resume finalizer + sibling-escape audit):** the resume finalizer terminalizes the minted shell on every exit path (so it is a normal terminal `runs` row, not a stranded one — Task 2's sibling-escape audit + Task 3 confirm no cleanup/ZADD/snapshot query breaks); the transient extra shell is a terminalized `runs` row indistinguishable from any finalized run to `runs:active`/`runs_by_thread`/snapshot listings (Task 5 live-DB JOIN proves the FK target persists).

---

## Test plan

### Live-DB FK regression test (mirror `test_092_harness_audit_live.py`)
ADD `backend/tests/integration/test_092_subagent_parent_fk_live.py` (or similar), mirroring
the F1 live-DB pattern that closed the 091 mock blind spot:
- `PG_AVAILABLE` skipif + function-scoped `pg_pool` fixture (jsonb codec) + `test_thread_user` fixture seeding real `auth.users` + `threads` with FK-safe teardown — copy the shape from `test_073_concurrency.py:71-135` and `test_092_harness_audit_live.py:1-27,170-232`.
- **Happy path:** `insert_run` with `parent_run_id` = a real producer `runs` row (seed one first) **succeeds**.
- **Bug path:** `insert_run` with `parent_run_id` = a non-`runs` uuid (a `workflow_runs` id) **raises `asyncpg.exceptions.ForeignKeyViolationError`** (sibling of the `NotNullViolationError` used in `test_092`).
- **Success-path end-to-end assertion** (per schema-fk-tests risk #6): assert the SUCCESS path actually inserts a child with a resolvable parent, not merely that the error is gone.
- **Resume coverage (verdict hole — currently test-blind):** add a case for (a) a startup-sweep/Continue resume `insert_run` where `producer_run_id` was minted → parent resolves, and/or (b) the FK-safe `parent_run_id=None` path. Without this the resume surface stays in the same mock-pool blind spot that hid F1.
- **Deep-path guard row:** one assertion that a Deep `RunContext` → sub-agent `parent_run_id` is unchanged (byte-identical guard against future drift).
- Teardown deletes children before/with parent (`test_073` `DELETE FROM runs WHERE thread_id` covers both in one statement). Confirm `finalize_run` is UPDATE-not-DELETE so the FK target persists.
- CI caveat: skips without Postgres (local/operator gate, same as `test_073`/`test_092`). Mock-pool tests alone will NOT catch F4 — the live test is the backstop.

### 4-axis live UAT (per CLAUDE.md UAT scoreboard recipe — author under VALIDATION.md, not PLAN tasks)
Seed real harness runs; do not defer "if data permits":
- **Cross-provider:** kick a harness workflow whose `llm_agent` phase spawns a sub-agent on EACH representative — OpenAI, Anthropic, Google, OpenRouter (plus DeepSeek/Moonshot/GLM/MiniMax per native-7). Confirm: (a) no `ForeignKeyViolationError` (Facet A), (b) phase + sub_agent + gate events appear in the panel on the watched producer stream (Facet B), (c) `harness_audit` rows still keyed by workflow_run id with the right `user_id` (F1).
- **Multi-tool:** a phase exercising 2+ tools (e.g. `search_documents` + `execute_code`) inside the sub-agent — confirm sub-agent demux (R9) intact.
- **Parallel-thread:** Thread A harness streaming while Thread B accepts a new prompt — confirm per-thread lock keying (BUG-260523-01) and no global lockout.
- **Long-message:** ≥50 prior messages OR ≥5 KB prompt feeding the harness.
- **ask_user phase (verdict-driven, mandatory):** a workflow with an `llm_human_input` phase — confirm the prompt RENDERS in the frontend (Facet B transport fix) and the answer round-trips (durable row + subscribe channel still on workflow_run id, no desync / no double-ask / no 1800s hang).
- **Resume × Continue (verdict-driven, mandatory):** (a) kill the worker mid-harness-run → startup sweep resumes → the resumed `llm_agent` spawns a sub-agent → no FK crash, panel shows live events on the fresh producer stream (re-attached via `latest_producer_run_id` with no page action); (b) reload the page mid-run → click Continue → no 404, re-drive succeeds (frontend re-subscribes to the `/continue` 200 `producer_run_id`); (c) crash a resume mid-flight → confirm the fresh producer row is terminalized (thread NOT wedged on reload — F2 self-heal still fires).
