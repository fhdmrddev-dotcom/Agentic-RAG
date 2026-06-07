---
phase: 096-eval-harness-cross-provider-verification-concurrency
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/app/api/panel.py
  - backend/app/config.py
  - backend/app/services/harness/programmatic.py
  - backend/app/services/harness_engine.py
  - backend/app/services/task_service.py
  - backend/tests/conftest.py
  - backend/tests/integration/test_085_panel_endpoints.py
  - backend/tests/test_096_askuser_cleanup.py
  - backend/tests/test_096_ci_workflow_regression.py
  - frontend/src/__tests__/providers/streamPool.test.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
  - frontend/src/components/panel/__tests__/fixtures.ts
  - frontend/src/lib/api.ts
  - frontend/src/providers/StreamsProvider.tsx
  - scripts/conc_probe.py
  - scripts/curate_models.py
  - scripts/eval_cross_provider.py
  - scripts/restart_smoke.py
  - supabase/migrations/066_eval_coverage_seed.sql
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 096: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 096 touches four shared hot paths (harness_engine.py, panel.py, task_service.py, StreamsProvider.tsx) plus three new operator scripts, model-registry curation, the eval workflow seed migration, and test infrastructure. The additive-only / never-break-Deep constraint was verified at every shared-path edit and **holds**:

- `task_service.py` change is a single `phase_whitelist=parent_ctx.phase_whitelist` propagation — `None` (every Deep/tasks caller, the dataclass default) keeps `dispatch_tool`'s guard a literal no-op (verified against `tool_dispatcher.py:1535`).
- `panel.py` `/pending` liveness filter only NARROWS the owner-scoped result set, runs after the ownership gate, uses constant `$N`-parameterized SQL with `::text` casts (malformed ids cannot raise), and fails OPEN for legacy/unknown namespaces (verified at `panel.py:131-153` + the route loop).
- `harness_engine.py` ask_user expiry is INSERT-only (no UPDATE anywhere in `_expire_pending_ask_user`), passes a plain Python list to the pool's JSONB codec (single-encoded — correct, matching the live `/pending` correlation), and every call site is wrapped so cleanup never converts a terminalization into a crash.
- `StreamsProvider.tsx` LRU-3 pool gates every stream-open site, never touches `lastSeenOffsetRef` (the replay substrate), and the eviction replicates the onTerminal remove-pair (AbortError is silent in api.ts — correctly handled).
- `api.ts` diff is two lines (`answerAskUser` now throws `ApiError`); the sole consumer (`PendingAskCard`) handles it, and `ApiError extends Error` keeps any generic catch working.
- Migration 066 uses a fixed UUID + `ON CONFLICT (id) DO NOTHING` and re-seeds the system user idempotently.
- Scripts never print secret values: presence-only env reports, exception handling prints only `type(e).__name__` (so a requests `ConnectionError` carrying the Google `?key=` URL never reaches stdout), localhost hard-gates run before any DB connection, and `BackendUnavailable` exits cleanly without tracebacks.

Four warnings: a false-positive detector in the new restart smoke that will FAIL every healthy run against the live (double-encoded) audit writer; a missing None-guard in the resume sweep that contradicts its own documented skip behavior and lets one poison run abort all remaining resumes; a `tool_refused` audit row keyed to the wrong run-id namespace now that the 096-02 fix made the guard live-reachable; and a hardcoded overlap bound in the concurrency probe that can produce a false PASS under a non-default workflow.

## Warnings

### WR-01: restart_smoke single-completion detector false-FAILs every healthy run (double-encoded audit metadata not normalized)

**File:** `scripts/restart_smoke.py:126-130` (`_SQL_DOUBLE_COMPLETION`), consumed at `:518-528`
**Issue:** The live writer double-encodes `harness_audit.metadata`: `write_audit` (`backend/app/db/workflows.py:496`) passes `json.dumps(metadata)` to a param whose pool codec (`dependencies.py:66-71`) applies `json.dumps` AGAIN — so live metadata is a jsonb STRING (empirically verified in this same phase: `eval_cross_provider.py:229-234` cites "386/386 audit rows are jsonb_typeof = 'string'"). On a jsonb string, `metadata->>'phase'` returns NULL, so `_SQL_DOUBLE_COMPLETION` groups ALL of a run's `phase_completed` rows into one NULL bucket — for the 5-phase `eval_coverage` run, `count(*) = 5 > 1` → the detector returns a row → `assert_single_completion_audit` prints `SMOKE_ASSERT single_completion_audit FAIL phase 'None' completed 5x` on every healthy run. The sibling script written in this phase normalizes exactly this (eval's `duplicate_phase_completed`), and restart_smoke itself normalizes `workflow_phases.output` (`:553-558`) but not the audit metadata. The SC#2/#4 restart-smoke gate cannot pass as shipped.
**Fix:** Copy the normalization wrapper from `eval_cross_provider.py`'s `duplicate_phase_completed` query:
```python
_SQL_DOUBLE_COMPLETION = (
    "SELECT (CASE WHEN jsonb_typeof(metadata) = 'string' "
    "THEN (metadata #>> '{}')::jsonb ELSE metadata END)->>'phase' AS slug, "
    "count(*) AS n FROM harness_audit "
    "WHERE run_id = %s AND event_type = 'phase_completed' "
    "GROUP BY 1 HAVING count(*) > 1"
)
```
(Out-of-scope root-cause note: the double-encoding itself lives in `db/workflows.py` — `json.dumps(...)` before a codec that dumps again. Fixing the writer to pass plain dicts would be the durable fix, but both scripts already tolerate both shapes once normalized.)

### WR-02: Resume sweep crashes on a missing/unparseable definition and aborts ALL remaining stranded runs

**File:** `backend/app/services/harness_engine.py:1249-1265` (caller), `:1015-1037` (`_load_run_definition`)
**Issue:** `_load_run_definition` returns `None` when the run's definition row is gone, and its docstring promises "the sweep skips it rather than crashing startup" — but `resume_stranded_workflows` never checks for `None`: `_resume_run(run_id, None, ...)` → `run_workflow` → `definition.phases` raises `AttributeError`. Because the loop's `except Exception: _redrive_failed = True; raise` re-raises, the FIRST failing run aborts the entire sweep — every remaining stranded run stays unresumed until the next process restart (main.py:247 catches and logs, app continues, but resumption work is lost). A deleted/corrupt definition is a poison pill: the run re-becomes claimable after the lease expires and crashes the sweep again on every boot.
**Fix:** Guard before the redrive (and consider per-run isolation):
```python
definition = await _load_run_definition(pool, run_id)
if definition is None:
    logger.warning(
        "resume sweep: run %s has no loadable definition — skipping "
        "(re-claimable after lease expiry)", run_id,
    )
    continue
```
If per-run isolation is also wanted (one bad redrive should not strand the others), replace the bare `raise` with `continue` after logging — note `test_resume_finalizer_expires_on_failed_redrive` (`tests/test_096_askuser_cleanup.py:241-264`) currently locks the propagate-behavior and would need its `pytest.raises(RuntimeError)` expectation updated.

### WR-03: tool_refused audit rows are keyed to the producer `runs` id, not the workflow run id — invisible to per-run audit queries

**File:** `backend/app/services/tool_dispatcher.py:1512` (`run_id = ctx.parent_run_id or ctx.run_id`), reached via `backend/app/services/task_service.py:612-620` (the 096-02 propagation)
**Issue:** The 096-02 fix correctly makes the dispatch-time whitelist guard reachable on the live harness path (sub_ctx). But on that path `sub_ctx.parent_run_id` is the PRODUCER `runs.run_id` (set from `_build_phase_tool_context`'s `run_id=_producer_id`, `phase_types.py:180`), so the `tool_refused` audit row lands under the producer-runs namespace — while every other `harness_audit` row for the same run (`phase_started`, `gate_failed`, `phase_completed`, `run_completed`) is keyed on the `workflow_runs.id`. Any per-run audit query (e.g., the eval's `gate_failed_count`-style lookups by workflow_run_id) will never find refusals; the CI test (`test_096_whitelist_refusal`) asserts only that *a* row is written against a mock pool, so the namespace mismatch is invisible to it. `harness_audit.run_id` has no FK (059), so nothing fails loudly — the evidence just lands where no run-scoped reader looks.
**Fix:** Thread the workflow run id onto the dispatch context and prefer it in the audit. E.g., add `workflow_run_id: UUID | None = None` to `ToolContext`, set it in `_build_phase_tool_context` (`workflow_run_id=getattr(ctx, "run_id", None)`), propagate it in `task_service.run_task_sub_agent`'s `sub_ctx` build, and in `_spawn_tool_refused_audit` use `run_id = ctx.workflow_run_id or ctx.parent_run_id or ctx.run_id`. Deep mode keeps `None` defaults → byte-identical.

### WR-04: conc_probe asserts fan-out against a hardcoded 5 instead of the live max_parallel_agents it already reads

**File:** `scripts/conc_probe.py:101` (`MAX_ALLOWED_OVERLAP = 5`), `:621` (live value read), `:676` (assertion)
**Issue:** The probe resolves the batch phase's real `max_parallel_agents` from the definition (`:621`) and prints it, but the `fanout_bounded` assertion compares against the constant `5`. For the default `literature_review` seed (cap 5) this is correct, but the script exposes `--workflow-slug` — a workflow whose batch cap is lower (e.g., 3) would let an overlap of 4-5 produce a **false PASS** (silently wrong evidence, the worst failure mode for verification tooling). `EXPECTED_FANOUT` is similarly hardcoded but is defended by the prompt self-check; the overlap bound has no such guard.
**Fix:** Assert against the live value:
```python
ok = overlap <= max_parallel and len(windows) == EXPECTED_FANOUT
...
f"max_overlap={overlap} (allowed <= {max_parallel})",
```

## Info

### IN-01: Migration 066 ON CONFLICT target doesn't cover the slug+version unique constraint

**File:** `supabase/migrations/066_eval_coverage_seed.sql:61-127`
**Issue:** `ON CONFLICT (id) DO NOTHING` makes re-apply a no-op only when the conflicting row has the SAME fixed id. `workflow_definitions` also carries `workflow_definitions_slug_version_unique UNIQUE (slug, version)` (056:29) — if an `eval_coverage`/v1 row ever exists under a different id (manual reseed, environment drift), re-applying 066 raises a unique violation instead of no-op'ing.
**Fix:** Use a bare conflict clause so BOTH unique paths no-op: `ON CONFLICT DO NOTHING`.

### IN-02: PendingAskCard countdown renders "NaN:NaN" forever on a malformed created_at

**File:** `frontend/src/components/panel/PendingAskCard.tsx:184-187`
**Issue:** `Date.parse(ask.created_at)` on a malformed string returns `NaN` → `initialRemaining` is `NaN` (`Math.max(0, NaN)` is `NaN`) → the countdown effect never hits the `remaining <= 0` expiry branch (NaN comparisons are false) and the clock renders "NaN:NaN" while ticking indefinitely. The backend emits well-formed ISO strings today, so this is defensive only.
**Fix:** Guard the seed: `const parsed = ask.created_at ? Date.parse(ask.created_at) : NaN; const initialRemaining = Number.isFinite(parsed) ? Math.max(0, timeout_seconds - Math.floor((Date.now() - parsed) / 1000)) : timeout_seconds`.

### IN-03: fail_run persists the failure message AFTER the run_failed emit — brief failed-without-reason window

**File:** `backend/app/services/harness_engine.py:868-871` (and the second site `:908-912`)
**Issue:** Ordering at both failure sites is `finish_run` → audit → `_emit(run_failed)` → `_surface_failure_message`. A consumer reconciling immediately on the `run_failed` SSE can fetch `/messages` before the failure-reason row lands, rendering failed-without-reason until the next fetch. The status write honors WRITE-before-EMIT (D-v2.5-03); the message row does not. The docstring documents the chosen order, so this is a deliberate tradeoff — flagged for the record.
**Fix:** Move `await _surface_failure_message(...)` above the `run_failed` `_emit` at both sites (keeps the message durable before the terminal hint), or document the accepted race in the reconcile consumer.

### IN-04: subscribeProducerStream's rejection handler removes only half of the bookkeeping pair

**File:** `frontend/src/providers/StreamsProvider.tsx:1136-1141`
**Issue:** On a non-abort open failure, the `.catch` deletes the `subscriptionsRef` entry but not the `subscriptionsByThread` mirror entry (the onTerminal wrapper and the 096-05 evictor both remove the pair in lockstep). The ghost mirror entry persists until eviction or a terminal heals it. It cannot leak a held-open connection (the ref is the open-gate), but it weakens the pool invariant that reservation and open stay symmetric, and `useStreamSubscriptions(runId)` reads the mirror.
**Fix:** Mirror the remove-pair in the catch:
```ts
subscriptionsRef.current.delete(producerRunId)
useStreamsStore.setState((s) => ({
  subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, producerRunId),
}))
```

### IN-05: conc_probe/restart_smoke DEFAULT_MODELS drifted from the same-phase D-05 curation they claim to copy

**File:** `scripts/conc_probe.py:74-83`, `scripts/restart_smoke.py:66-75`
**Issue:** Both tables carry the comment "copied from eval_cross_provider.py PROVIDERS", but they ship `"anthropic": "claude-haiku-4-5"` (the undated alias this phase's own curation determined is NOT served live — eval was updated to `claude-haiku-4-5-20251001`), `"zhipu": "glm-4.6"` and `"minimax": "MiniMax-M2.5-highspeed"` (eval was bumped to `glm-5.1` / `MiniMax-M2.7-highspeed` in the same phase). Functional impact is near-zero today — both scripts only drive harness workflows, where `body.model` does not steer phases (Pitfall 1, `_SUB_AGENT_MODEL_DEFAULTS` decides) — but the stale IDs contradict the phase's curation deliverable, the copy-claim comments are now false, and the next `curate_models.py` pass will not flag these tables (they are not curation targets).
**Fix:** Sync the three entries with the post-curation eval `PROVIDERS` values (dated haiku ID, `glm-5.1`, `MiniMax-M2.7-highspeed`), or replace the "copied verbatim" comments with an explicit "snapshot as of <date>; not auto-curated" note.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
