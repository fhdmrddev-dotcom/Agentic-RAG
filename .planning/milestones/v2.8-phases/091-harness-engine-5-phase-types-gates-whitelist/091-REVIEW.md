---
phase: 091-harness-engine-5-phase-types-gates-whitelist
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/config.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/models/harness.py
  - backend/app/services/ask_user_service.py
  - backend/app/services/harness/__init__.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/programmatic.py
  - backend/app/services/harness/reachability.py
  - backend/app/services/harness/validators.py
  - backend/app/services/harness_engine.py
  - backend/app/services/openai_service.py
  - backend/app/services/task_service.py
  - backend/app/services/tool_dispatcher.py
  - supabase/migrations/061_harness_seed_templates.sql
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: resolved
---

# Phase 091: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 15
**Status:** resolved (gap-closure plan 091-08 — see Resolution below)

## Summary

The harness engine is well-architected: the 2-phase write contract (mark-active → execute → atomic complete-with-output) is correct, the bounded-retry termination guarantee holds (attempt cap + consecutive-identical short-circuit + unknown-disposition-fails-to-fail_run all converge on `failed`), the whitelist/budget no-op-when-None invariant in `tool_dispatcher.py` and `openai_service.apply_tool_budget` is genuinely byte-identical for Deep Mode, the closed registries in `programmatic.py`/`validators.py` never `eval`, and all SQL is parameterized (`$N`) with the documented column-name contract. The subscribe-before-emit ordering in `ask_user_service._subscribe_and_block` is correct via the `on_subscribed` in-window hook.

Two correctness defects rise to Critical: (1) `claim_run` is **not** a real CAS for the resume path — both `WORKER_COUNT=2` workers will win the claim and double-execute a stranded run; (2) `_persist_output` silently destroys any phase output larger than 64 KB because no executor ever supplies the `_spilled_path` the spill branch expects. Several warnings concern resume-context completeness (programmatic + LLM phases lose their inputs on resume) and gate-routing edge cases.

## Critical Issues

### CR-01: `claim_run` CAS does not prevent double-execution under WORKER_COUNT=2

**File:** `backend/app/db/workflows.py:275-292` (consumed at `backend/app/services/harness_engine.py:578`)
**Issue:** The claim is `UPDATE workflow_runs SET status='active' WHERE id=$1 AND status IN ('active','paused') RETURNING id`. `find_resumable_runs` (workflows.py:90-104) selects runs whose status is **already** `'active'` (or `'paused'`). Setting `status='active'` does not change the value for the common `active` case, and the predicate `status IN ('active','paused')` still matches. Under two workers racing the same stranded run, Postgres serializes the two UPDATEs on the row lock, but **both** find the row matching the WHERE clause (the status never transitions out of the claimable set) and **both** get a row back from `RETURNING id` → both return `True` → both call `_resume_run` → the run is executed twice. This is the exact Pitfall-7 double-execution the claim is meant to prevent. The module docstring's "loser skips" guarantee does not hold.
**Fix:** Transition to a state that is NOT in the claimable set, so the second UPDATE matches zero rows:
```python
async def claim_run(pool, run_id):
    row = await pool.fetchrow(
        """
        UPDATE workflow_runs
        SET status = 'resuming'          -- a state OUTSIDE ('active','paused')
        WHERE id = $1 AND status IN ('active', 'paused')
        RETURNING id
        """,
        run_id,
    )
    return row is not None
```
Add `'resuming'` to the `workflow_runs.status` CHECK constraint (and have `run_workflow` flip it back to `'active'`/terminal as it proceeds), OR use an advisory lock (`pg_try_advisory_xact_lock`) scoped to the run UUID. Either way the winning worker must move the row to a value the losing worker's WHERE cannot match.

### CR-02: `_persist_output` silently discards any phase output over 64 KB

**File:** `backend/app/services/harness_engine.py:111-131` (called at line 437)
**Issue:** When `len(json.dumps(output)) > _OUTPUT_INLINE_LIMIT`, the function returns `{"_spilled_path": output.get("_spilled_path") or "workspace-files://pending"}`. No phase executor in `phase_types.py` ever writes a `_spilled_path` key (verified by grep — the only references are inside `_persist_output` itself). The bucket write is documented as "wired by the Plan 03 executors" but Plan 03's executors return `{"text": ...}` / `{"text": ..., "sub_run_ids": ...}` with no spill. Result: a large `llm_batch_agents` merge, a long `llm_single` summary, or a final chat message exceeding 64 KB is durably persisted as `{"_spilled_path": "workspace-files://pending"}` — the real content is **gone** from `workflow_phases.output`. On resume, `accumulated_outputs` is seeded from the durable row (run_workflow:339-341), so a downstream phase reads the pointer string instead of the prior text; for the final phase, a resumed run loses the chat message entirely (`ctx.final_output` would be the pointer).
**Fix:** Until the bucket-write path actually exists, do NOT silently drop content. Either (a) store the full output inline (jsonb can hold it; the 64 KB cap is an optimization, not a hard limit), or (b) fail loudly so the gap is visible:
```python
if len(serialized) > _OUTPUT_INLINE_LIMIT:
    spilled = output.get("_spilled_path") if isinstance(output, dict) else None
    if not spilled:
        # No real spill wired yet — never silently discard the payload.
        raise ValueError(
            f"phase output is {len(serialized)} bytes (> {_OUTPUT_INLINE_LIMIT}) "
            f"but no _spilled_path was provided; bucket spill is not yet wired"
        )
    return {"_spilled_path": spilled}
```
Preferred for v1: store inline and defer the spill optimization, since correctness (no lost output) outranks jsonb size.

## Warnings

### WR-01: Resume context is missing `inputs` — `programmatic` phases lose their run inputs on resume

**File:** `backend/app/services/harness_engine.py:515-535` vs `backend/app/services/harness/phase_types.py:160-172`
**Issue:** `_build_resume_context` builds a `SimpleNamespace` with `run_id/thread_id/current_user/redis/pool/emit/retry_feedback` — but NOT `inputs`. `_exec_programmatic` reads `getattr(ctx, "inputs", None) or {}` (phase_types.py:160) to resolve top-level run inputs like `topic` (the `literature_review` seed's `split_topic` reads `input_keys=["topic"]`). On resume, `run_inputs` is `{}`, so `split_topic` receives no `topic`, returns `{"sub_questions": []}`, and the downstream `llm_batch_agents` degrades to a single agent on the raw prompt. A `programmatic` phase whose input came from a prior completed phase still works (it reads `accumulated_outputs`); one whose input is a top-level run input does not.
**Fix:** Persist run inputs durably (e.g. on `workflow_runs`) and rehydrate them into the resume ctx, or seed `inputs` from the first phase's stored output. At minimum, document this as a known resume limitation rather than silently producing empty splits.

### WR-02: Resume context is missing `user_settings`/`supabase`/`model` — resumed LLM phases run with degraded settings

**File:** `backend/app/services/harness_engine.py:515-535`
**Issue:** The resume ctx omits `user_settings`, `supabase`, `model`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore`. `_exec_llm_single`/`_exec_llm_agent` read `getattr(ctx, "user_settings", None)` and `_effective_model` falls back to `""` when `ctx.model` is absent — so a resumed `llm_single`/`llm_agent` phase calls the LLM with `model=""` and `user_settings=None`. The docstring acknowledges "richer per-run fields ... are absent on resume and default to None," but `model=""` is not a safe default for an LLM call — it will fail or route unpredictably. The `llm_human_input` durable-prompt insert also no-ops because `supabase` is None (phase_types.py:313).
**Fix:** Rehydrate at least `model` and `user_settings` from the run row (`workflow_runs.model`) and the thread's effective settings during resume, so re-run LLM phases use the same model as the original execution.

### WR-03: `phase_max_retries` and the routing validator can come from different validators

**File:** `backend/app/services/harness_engine.py:228-229` vs `177-192`
**Issue:** `_run_phase_with_gates` reads the retry bound from `validators[0].max_retries`, but `_failing_on_failure` (used by `_route_on_failure`) prefers the first validator carrying a `skip_to_phase:` disposition, which may be a *different* validator with a different `max_retries`. With multiple validators where validator[0] has `max_retries=0` and validator[1] has `skip_to_phase`, the loop exhausts after validator[0]'s bound but routes per validator[1]. The single-validator seed phases are unaffected, but multi-validator phases get inconsistent retry/route pairing. The termination guarantee still holds (bound is always finite), so this is correctness-of-routing, not an infinite-loop risk.
**Fix:** Derive both the retry bound and the disposition from the SAME failing validator. Since `run_gates` returns only the first failing `GateResult` (not its index), thread the failing validator index back through `GateResult`, then index `phase.validators[failed_idx]` for both `max_retries` and `on_failure`.

### WR-04: `_tools_override` is computed but never passed to `run_task_sub_agent` — D-05 layer 1 is a no-op

**File:** `backend/app/services/harness/phase_types.py:212-214, 252-254` vs `backend/app/services/task_service.py:314-319`
**Issue:** Both `_exec_llm_agent` and `_exec_llm_batch_agents` build `_tools_override = apply_tool_budget(...)` and then discard it (leading underscore, never referenced). `run_task_sub_agent` accepts no `tools_override` parameter — it rebuilds its own schema list from `allowed_tools` (task_service.py:315-319) WITHOUT the TOOL-05 `max_tools` budget cap. So the "D-05 layer 1 — the model only SEES whitelisted, budget-capped tools" claim is only half true: the whitelist filter happens (via `allowed_tools` subset), but the Google `max_tools=16` per-provider budget cap (TOOL-05 / SEED-035) is **never applied** to what the model sees. Layer 2 (dispatch backstop) still works. The computed `apply_tool_budget` call is dead code on this path.
**Fix:** Either add a `tools_override` parameter to `run_task_sub_agent` and pass the budget-capped list, or call `apply_tool_budget` inside `run_task_sub_agent` after building `sub_tool_schemas`. Otherwise remove the dead `_tools_override` assignments and document that TOOL-05 budgeting is not wired for sub-agent phases.

### WR-05: `get_pending_ask_user` returns the latest prompt across the whole thread, not the active phase's prompt

**File:** `backend/app/db/workflows.py:164-194`
**Issue:** The query joins `messages` to `workflow_runs` on `wr.thread_id = m.thread_id` and selects the most recent `ask_user_prompt` row for the thread, `ORDER BY m.created_at DESC LIMIT 1`. If a thread has had multiple workflow runs (or multiple ask_user prompts), this returns the newest prompt for the *thread*, which may not be the prompt belonging to the stranded run being resumed. The resume path (harness_engine.py:589-598) then re-subscribes/re-emits a potentially wrong `tool_call_id`. The `tool_calls[0].run_id` is stored in the durable row (phase_types.py:331) but the query does not filter on it.
**Fix:** Filter the prompt row by the run, e.g. `AND m.tool_calls->0->>'run_id' = $1::text` (mirroring the run-scoped predicate), so resume re-emits the prompt that actually belongs to `run_id`.

### WR-06: `ask_user_response_exists` joins on thread, not run — false positives across runs in the same thread

**File:** `backend/app/db/workflows.py:127-161`
**Issue:** Like WR-05, the EXISTS query keys on `wr.thread_id = r.thread_id` and matches any `ask_user_response` row in the thread with the given `tool_call_id`. `tool_call_id` is a `uuid4().hex` so collision across runs is effectively impossible, which saves this from being Critical — but the query semantically scopes by thread, not run, so a future change that reuses or derives tool_call_ids would silently match the wrong run's answer. The comment claims "owner-scoped" via the FK chain, which is true for access control but not for run-disambiguation.
**Fix:** Add the run-scoping predicate on the stored `run_id` in the response row's `tool_calls`, consistent with WR-05, so the check is unambiguously per-run.

## Info

### IN-01: `_failing_on_failure` is always called with `gate=None`

**File:** `backend/app/services/harness_engine.py:177` (called at line 297)
**Issue:** `_route_on_failure` calls `_failing_on_failure(phase, None)` — the `gate` parameter is declared but never used inside the function (it re-derives from `phase.validators`). Dead parameter; misleading signature suggesting the gate informs the routing.
**Fix:** Drop the `gate` parameter from `_failing_on_failure` (and the `None` arg at the call site).

### IN-02: `dropped_protected`/`kept` recomputation in `apply_tool_budget` is slightly convoluted

**File:** `backend/app/services/openai_service.py:829-857`
**Issue:** The reverse-index drop logic is correct but hard to follow: `kept` is assigned twice conceptually (line 830 init `[]`, line 844 actual), `surviving = list(schemas)` duplicates `schemas`, and `dropped_protected` is set only to gate a log line. The function works (whitelist tools are always retained, order preserved) but the branch is denser than the docstring's two-stage description.
**Fix:** Simplify to a single comprehension that keeps whitelist tools plus the highest-priority non-whitelist tools up to the cap. Behavior-neutral cleanup.

### IN-03: `_prior_output_text` newline-joins ALL prior phases when there is more than one

**File:** `backend/app/services/harness/phase_types.py:75-92`
**Issue:** When `len(texts) > 1` the user-turn fed to a downstream `llm_single` is the newline-joined concatenation of *every* prior phase's text, not just the immediately preceding phase. For a 3-phase chain this means phase 3 sees phase-1 + phase-2 text concatenated. This may be intentional (full running context) but the docstring says "the LATEST phase's text (the running result)," which contradicts the `"\n\n".join(texts)` fallback. Could bloat context on longer chains.
**Fix:** Clarify intent. If only the latest is wanted, return `texts[-1]` unconditionally; if full context is wanted, update the docstring.

### IN-04: `_DEFAULT_PHASE_WALL_CLOCK`/`_DEFAULT_PHASE_MAX_STEPS` bound at import time

**File:** `backend/app/services/harness_engine.py:88-94` and `phase_types.py:70`
**Issue:** These read `settings.harness_phase_wall_clock_seconds` / `settings.harness_phase_max_steps` at module import. Because `settings` is a process-global frozen at startup (config.py:872) this is fine in production, but it means tests that monkeypatch `settings.*` after import won't see the new value for these module-level constants. Minor, and consistent with the codebase's settings pattern.
**Fix:** None required; note for test authors that these are import-time snapshots.

### IN-05: `_route_on_failure` reason text uses `attempt + 1` which can mislabel the wall-clock-timeout case

**File:** `backend/app/services/harness_engine.py:252, 298-301`
**Issue:** On a wall-clock timeout the code returns `_route_on_failure(phase, gate_error, attempt)` where `attempt` is the current (possibly 0) attempt; the reason string reports "after {attempt + 1} attempt(s)". For a first-attempt timeout this reads "after 1 attempt(s)," which is accurate, but the timeout path never increments `attempt` across retries the way the gate-failure path does, so a phase that times out on a retry attempt reports the retry count from the gate loop rather than a timeout-specific count. Cosmetic — the failure is correctly terminal.
**Fix:** Optionally distinguish timeout reasons from gate-failure reasons in the message for clearer operator audit.

---

## Resolution (091-08)

Gap-closure plan **091-08** (wave 6, `gap_closure: true`, source = this REVIEW) was planned and executed on 2026-05-31. Three task commits landed the code + migration + tests; the operator applied migration 062 via the Supabase SQL editor, then a continuation finalized the artifact and tracking. Full harness suite GREEN against the live `claimed_at` column (95 passed, 0 skipped).

**Fixed (7 findings):**

- **CR-01** — `claim_run` is now a real CAS via a `claimed_at timestamptz` lease (migration `062_workflow_run_claim_lease.sql`). The winning worker stamps `claimed_at = now()`; a racing `WORKER_COUNT=2` sibling matches 0 rows (predicate adds `claimed_at IS NULL OR claimed_at < now() - $2::interval`) → returns False → no double-execute. A crash-mid-resume run is re-claimable once the lease (engine/config constant, default 5 min) expires. Status set untouched (no new `resuming` status — lease is orthogonal to status, avoids a CHECK-constraint migration). Commit 77394956 (caller), 42cf002f (migration + lease constant).
- **CR-02** — `_persist_output` no longer returns a `workspace-files://pending` placeholder for outputs > 64 KB. The full payload is stored **inline** in `workflow_phases.output` (jsonb); the size gate may log but never discards content. No silent data loss; bucket spill remains a future optimization, not a correctness dependency. Commit 77394956.
- **WR-03** — the failing-validator index is threaded back through `GateResult`; `_run_phase_with_gates` / `_route_on_failure` now derive BOTH `max_retries` and `on_failure` from the SAME failing validator (`phase.validators[failed_idx]`), not `validators[0]` for the bound and a different one for routing. Commit 77394956.
- **WR-04** — the TOOL-05 per-provider `max_tools` budget cap is now actually applied to the tool schemas the sub-agent model sees on the `run_task_sub_agent` path (was computed-then-discarded as a dead `_tools_override`). Whitelist (HARNESS-05) still enforced; Deep-Mode byte-identical invariant preserved (no cap when whitelist is None / no active workflow). Commit 77394956.
- **WR-05 + WR-06** — `get_pending_ask_user` and `ask_user_response_exists` are now run-scoped (predicate on the stored `run_id` in `tool_calls`), not merely thread-scoped, so a multi-run thread resumes the prompt/answer belonging to the specific stranded run. Commit 77394956.
- **IN-01** — dropped the always-`None` dead `gate` parameter from `_failing_on_failure`. Commit 77394956.

Regression tests for every fix landed in commit ac1083e6 (test_harness_resume.py, test_harness_gates.py, test_tool_budget.py).

**Deferred to Phase 092 (2 findings):**

- **WR-01** (resume ctx missing `inputs`) + **WR-02** (resume ctx missing `model`/`user_settings`) — the proper fix requires persisting run inputs + model at workflow_runs **creation**, which does not exist in Phase 091 (no `INSERT INTO workflow_runs` in `backend/app`). Run creation + per-run context construction is owned by Phase 092 (dual-mode + Continue). Planted as **SEED-040** with a concrete re-open trigger: Phase 092 run-creation persists `workflow_runs.inputs` + `model`, rehydrated into the resume ctx; **Phase 096 EVAL-02 (live kill-and-resume)** is the proof gate. Until then, resumed LLM / top-level-input phases are a known live-resume limitation (the deterministic unit proof for resume mechanics stands).

**No action — cosmetic / doc-only (3 findings):**

- **IN-03** (`_prior_output_text` joins all prior phases — clarify docstring intent), **IN-04** (`_DEFAULT_PHASE_*` import-time settings snapshot — note for test authors, consistent with codebase settings pattern), **IN-05** (`_route_on_failure` reason text `attempt + 1` mislabels wall-clock-timeout case — cosmetic, failure is correctly terminal). Optional polish, no correctness impact. **IN-02** (`apply_tool_budget` reverse-index drop is convoluted) — behavior-neutral cleanup, also no-action.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Resolution: 2026-05-31 (plan 091-08)_
_Depth: standard_
