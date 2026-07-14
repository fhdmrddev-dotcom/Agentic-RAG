---
phase: 152-workflow-run-inputs
reviewed: 2026-07-14T18:36:22Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/models/message.py
  - backend/app/services/harness/scope.py
  - backend/app/services/harness_engine.py
  - backend/tests/test_152_delete_cascade.py
  - backend/tests/test_152_folder_override.py
  - backend/tests/test_dual_mode_wiring.py
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
  - frontend/src/pages/__tests__/RunModal.test.tsx
  - frontend/src/pages/WorkflowsPage.test.tsx
  - frontend/src/pages/WorkflowsPage.tsx
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 152: Code Review Report

**Reviewed:** 2026-07-14T18:36:22Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 152 adds (1) a per-run folder-scope override resolved by `resolve_run_scope_root()` and honored at kickoff / resume / Continue, (2) an owner-gated destructive workflow delete cascade with a preview endpoint, and (3) the Run-modal + victim-naming delete Sheet frontend.

The security fundamentals asked for in the review brief hold up under scrutiny:

- **SQL parameterization** — every new query in `db/workflows.py` and `api/workflows.py` binds `$N` / `ANY($1::uuid[])`; no user value is interpolated into SQL. The `slug` used by the cascade is itself resolved server-side from an owner-gated `id` lookup, never taken from the client.
- **Owner gate on the cascade** — `_owned_slug_or_404` (`created_by = $2`) is the single authorization boundary; the cascade and preview both re-scope by `created_by` inside the db helpers, and the live-PG test proves a foreign slug is untouched and 404-collapsed. I could not construct a path that deletes another owner's *definitions*.
- **Folder-override drop-not-trust** — the client `folder_id` is gated through `fetch_visible_folders(owner)` at all three run-start sites; the service-role resume path passes the durable run owner's id; an unreachable id degrades to the author default. No widen path exists (the override can only move the root to a folder the owner can already see; "All documents" sends no override).
- **Blocking I/O** — all supabase-py calls in the new code go through `aexec` (`run_in_threadpool`); the cascade uses the asyncpg pool natively; `write_operator_audit` is off-loop and never raises.

However, the delete cascade's **cancel-first promise (D-LOCK-05) does not actually hold for the most common in-flight case**: `_cancel_run_internals` is invoked with the `workflow_runs.id`, but a live kickoff-started run's producer task is registered in `RUN_TASKS` under the *producer* `runs.run_id` — so nothing is cancelled and the engine keeps executing against rows the transaction then hard-deletes. That is a Critical finding. Five warnings and five info items follow.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Cascade "cancel-first" cannot cancel live kickoff-started workflow runs — engine keeps running against deleted rows

**File:** `backend/app/api/workflows.py:509-528` (with `backend/app/services/run_lifecycle.py:202-292`, `backend/app/api/threads.py:2011`, `backend/app/services/harness_engine.py:1071-1126`)
**Issue:** The cancel-first loop passes the **workflow_runs id** to `_cancel_run_internals(run_id=r["id"], ...)`. But:

1. For a run started via the normal kickoff path, the live producer task is registered as `RUN_TASKS[run_id]` where `run_id` is the **producer `runs.run_id`** (threads.py:2011) — NOT the workflow_runs id. Only Continue-re-driven runs are keyed by the workflow id (`_RUN_TASKS[wf_run_uuid]`, runs.py:1043). So `RUN_TASKS.get(<workflow_run_id>)` misses and the live task is **never cancelled**.
2. The fallback zombie-heal then targets the wrong table: `finalize_run_terminal` executes `UPDATE runs ... WHERE run_id = <workflow_run_id>` → 0 rows (there is no `runs` row with that id). The synthetic terminal sentinel is gated on `redis.exists("run:{workflow_run_id}")` — a stream nobody writes to (engine events route to `run:{producer_run_id}` per Facet B 092-07) — so no terminal event reaches the client either. The only effective side effect is the anchor-clear.
3. For a `paused` (ask_user-blocked) run, the PUBLISH-first cancel sentinel only fires on the task-found path — which misses — so the engine's SUBSCRIBE stays blocked until its own timeout, then resumes execution.

Net effect: `DELETE /{id}/cascade` hard-deletes `workflow_runs`/`workflow_phases` out from under a **still-running** engine task. `run_workflow` drives phases from an in-memory list loaded once (harness_engine.py:1071) and never re-checks the rows, so it continues making LLM/tool calls (token spend), its `mark_phase_active`/`complete_phase`/`finish_run` writes silently 0-row no-op, its SSE stream keeps streaming to the user, and `_surface_final_answer` persists a ghost assistant message into the *kept* thread of a workflow the user just watched "Delete forever" confirm. This directly defeats D-LOCK-05 ("never deleting a live run out from under the engine") and the amber banner's "cancelled safely first" copy. The same window exists for a run started between the cancel loop and the delete transaction (TOCTOU), and — with the default `WORKER_COUNT=2` — for a task living on the other worker, where the durable half of the heal (the part that is supposed to cover cross-worker) also targets the wrong table.

**Fix:** Cancel through the **producer `runs` rows**, the same identity the admin Kill path uses, and terminalize the workflow rows durably before the delete:
```python
# inside delete_workflow_cascade, replacing the inflight loop body
inflight = await pool.fetch(
    "SELECT wr.id AS wf_id, wr.status AS wf_status, wr.thread_id, "
    "       r.run_id AS producer_id, r.status AS producer_status "
    "FROM workflow_runs wr "
    "JOIN workflow_definitions wd ON wd.id = wr.definition_id "
    "LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming' "
    "WHERE wd.slug = $1 AND wd.created_by = $2 "
    "AND wr.status IN ('active', 'paused', 'cap_paused')",
    slug, user_id,
)
for r in inflight:
    # cancel the LIVE producer (RUN_TASKS is keyed by the producer runs.run_id)
    if r["producer_id"] is not None:
        await _cancel_run_internals(
            run_id=r["producer_id"], status=r["producer_status"],
            thread_id=str(r["thread_id"]), redis=redis, supabase=supabase,
        )
    # ask_user wake for harness prompts (channel is keyed by the WORKFLOW run id)
    await publish_cancel_sentinel(redis, r["wf_id"])
    # durable workflow-side terminal (covers the cross-worker case)
    await finish_run(pool, r["wf_id"], "cancelled")
```
Also verify in a live UAT row that a mid-run delete actually stops the stream (the current 152 tests only cover the db helpers, never an in-flight cancel).

## Warnings

### WR-01: Cascade on a global definition destroys and cancels OTHER users' runs — preview counts and docstring claim otherwise

**File:** `backend/app/db/workflows.py:474-477, 490-542`; `backend/app/api/workflows.py:509-528`
**Issue:** The owner gate is on the *definition* (`created_by`), but `DELETE FROM workflow_runs WHERE definition_id = ANY(...)` sweeps **all users'** runs of an `is_global` definition (any user can run a global published workflow; their `workflow_runs.user_id` is the runner, not the definition owner). The cancel-first loop likewise cancels other users' live runs, and their threads are silently detached. The preview's `runs`/`threads`/`in_flight` counts also aggregate across all users — contradicting the docstring's "no cross-user count leak (T-152-02-05) … computed over the caller's OWN definitions" claim (the *definitions* are owner-scoped; the *runs* are not). The blast radius is structurally forced by the `ON DELETE RESTRICT` FK (you cannot delete the definition without deleting all dependent runs), and today only seed-owner accounts can own `is_global` rows (`create_workflow_definition` binds `is_global=false`), but the seam is live: the seed owner deleting a starter would cancel/delete every user's runs with no signal in the sheet.
**Fix:** Either (a) refuse the cascade for `is_global` definitions with cross-user runs (409 with an honest message), or (b) split the preview counts into "yours" vs "other users'" and surface them in the sheet; at minimum correct the T-152-02-05 docstring so the next reader doesn't assume run-level owner-scoping.

### WR-02: `scope_resolution_failed` emits land on the orphan `run:{workflow_run_id}` stream — the observability signal is invisible

**File:** `backend/app/api/runs.py:958-969`; `backend/app/api/threads.py:1588-1598`; `backend/app/services/harness_engine.py:1576-1586`
**Issue:** All three run-start sites emit the WR-03 (098) fall-open signal keyed by the **workflow run id**, but per Facet B (092-07, documented at harness_engine.py:1061-1069) the frontend subscribes to `run:{producer_run_id}` — `run:{workflow_run_id}` is "a stream nobody subscribes to". So the one event whose entire purpose is making the silent whole-KB degradation OBSERVABLE in the run timeline never reaches the timeline. This predates 152 (098 secure-phase), but 152 restructured the Continue block containing one of the emits and propagated the pattern to the resume site's new layering — and at every site the correct id is already in scope (`_producer_id` at runs.py:853/harness_engine.py:1456; `run_id` at threads.py).
**Fix:** Emit on the producer stream: `await _harness_emit(redis, _producer_id, "scope_resolution_failed", ...)` (Continue/resume) and `await _harness_emit(redis, run_id, ...)` (kickoff). One identifier per site.

### WR-03: A4 guard incomplete — an in-subtree override can still silently empty a phase's `folder_scope` intersection

**File:** `backend/app/services/harness/scope.py:150-157`; mirrored at `frontend/src/pages/WorkflowsPage.tsx:1027-1031`
**Issue:** The A4 guard drops an override only when it is *outside the whole project subtree*. But the per-phase narrowing at `phase_types.py:326-329` intersects each phase's `folder_scope` with the **override's** subtree. Take project P with children A and B, phase1 `folder_scope=[A]`, phase2 `folder_scope=[B]`: the override root A is inside P's subtree, so it is honored — and phase2's intersection `[B] ∩ subtree(A)` is `[]`, i.e. that phase retrieves **nothing**, silently. This is precisely the failure mode the guard's own comment names ("would silently empty the intersection … Drop it if outside") — membership in the project subtree is a necessary but not sufficient condition. The frontend's `overrideOptions` filter has the same hole (it offers any folder in the author subtree), so the UI can steer users straight into it.
**Fix:** In the `elif _definition_has_phase_folder_scope(definition)` branch, resolve the *override's* subtree and drop the override unless every declared phase `folder_scope` still intersects it:
```python
override_subtree = set(await resolve_project_subtree(override, supabase=supabase, user_id=user_id))
for phase in definition.phases:
    scope = getattr(phase.config, "folder_scope", None)
    if scope and not ({str(f) for f in scope} & override_subtree):
        override = None  # would empty this phase's intersection → drop
        break
```
Mirror the same per-phase check in the frontend option filter (or at least warn).

### WR-04: Failed launch leaks an orphan thread per retry (template 422 makes this a common path)

**File:** `frontend/src/components/layout/ChatLayout.tsx:121-140`
**Issue:** `doRun` sequences `createThread → uploadWorkspaceTemplate → postMessage`. When the upload 422s (the deliberately-surfaced validation path the modal renders verbatim) or `postMessage` fails (409 lock, network), the already-created thread is stranded: `loadThreads()` is never called, so it doesn't even appear in the sidebar until the next refresh, and every "fix the file → Run again" retry mints another one. Pre-152 the only post-create failure was `postMessage`; 152 inserts a new, *expected* failure step (template validation happens at launch because no thread exists at stage time), so the leak rate goes from rare to routine.
**Fix:** Cache the created thread across retries within the modal session (create once, reuse on retry), or best-effort `deleteThread(thread.id)` in a catch before re-throwing:
```ts
const thread = await createThread(def.name)
try {
  if (templateFile) await uploadWorkspaceTemplate(thread.id, templateFile)
  await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id, ...(folderId ? { folderId } : {}) })
} catch (e) {
  void deleteThread(thread.id).catch(() => {})  // don't leak the launch shell
  throw e
}
```

### WR-05: Run modal's "All documents" option is dishonest for bound workflows

**File:** `frontend/src/pages/WorkflowsPage.tsx:1041-1050, 1126` (option), `989-992` (initial selection)
**Issue:** For a workflow with an author default, selecting "All documents" sends `folderId: null` → the server applies the **author default** (the override channel is narrow-only by design, D-06 — the code comment admits "'All documents' on a bound workflow keeps the author default"). The user picks an option labeled "All documents" and gets a folder-scoped run: the select lies. Worse, when the author-default folder is not in the runner's visible `folders` (global workflow bound to the author's private folder, or a deleted folder), `authorDefaultExists` is false and the select **defaults to "All documents"** while the run is actually scoped to the invisible author folder — the modal's only scope indicator misstates the run's real scope in its resting state. This violates the project's honesty-first UI contract (the same phase ships "never guessed counts" and "verbatim 422" copy).
**Fix:** For a bound workflow, replace the `""` option with the truthful label (e.g. `Workflow default{authorDefaultName ? ` — 📁 ${authorDefaultName}` : ""}`) as the `""` value, and only offer a literal "All documents" option on unbound workflows (where `folderId: null` genuinely means whole-KB).

## Info

### IN-01: Contradictory immutability-trigger docstrings in db/workflows.py

**File:** `backend/app/db/workflows.py:381-387, 413-418` vs `450-452`
**Issue:** `update_workflow_definition`/`delete_workflow_definition` docstrings claim "the immutability trigger raises 23514 on a published-row DELETE", while `delete_published_workflow_cascade` (correctly, per `full-schema.sql:2598`) states the trigger is `BEFORE UPDATE` only and "does NOT fire on DELETE". The schema confirms the latter. Pre-existing text, but now directly adjacent to new code asserting the opposite — a future reader auditing the destructive path will trip on it.
**Fix:** Correct the two older docstrings (the DELETE protection is the `status='draft'` WHERE guard, not the trigger).

### IN-02: No test covers the cascade route's security boundary or cancel-first; preview test omits `in_flight`

**File:** `backend/tests/test_152_delete_cascade.py:260-291`
**Issue:** The live-PG tests exercise only the db helpers. Untested: `_owned_slug_or_404` (the ONLY authorization boundary on a service-role path — the exact seam class where Phase 150's confirmed SQLi was caught), the 404-collapse contract of both routes, the cancel-first invocation (which CR-01 shows is broken), the `require_visible` gate, and the audit write. `test_preview_counts_match_reality` also predates the `in_flight` field and never asserts it (the D-LOCK-05 banner's driving signal).
**Fix:** Add route-level tests (httpx + dependency overrides, per the test_dual_mode_wiring pattern): foreign-id → 404 on both routes; a seeded `status='active'` run → preview `in_flight == 1` and cascade invokes the cancel helper with the *producer* identity once CR-01 is fixed.

### IN-03: Kickoff now runs the thread-folder SELECT unconditionally, enlarging the bound fail-closed surface

**File:** `backend/app/api/threads.py:1538-1541`
**Issue:** Pre-152, a bound workflow's kickoff never queried `threads.folder_id` (the thread fallback only applied to unbound). Now the `.single()` SELECT runs for every workflow kickoff before `resolve_run_scope_root`, inside the try whose failure fails a BOUND run closed (RuntimeError → terminal `failed`). A transient failure of a query whose result is irrelevant for bound-with-no-override runs can now kill the run.
**Fix:** Fetch the thread folder lazily/best-effort — e.g. wrap just that SELECT in its own try that degrades `_wf_thread_folder = None` (the fallback is optional by contract), keeping the fail-closed try focused on the resolver itself.

### IN-04: Inputs-merge expression duplicated inline at both kickoff sites; the mirror invariant is only substring-tested

**File:** `backend/app/api/threads.py:1353, 1633`
**Issue:** `{"kickoff_prompt": body.content, **({"folder_id": str(body.folder_id)} if body.folder_id else {})}` is pasted at the `create_workflow_run` persist site and the `wf_ctx.inputs` mirror site. The F8 invariant (live ctx.inputs == durable inputs) is now guarded only by a `src.count('"kickoff_prompt": body.content') >= 2` substring assertion (test_dual_mode_wiring.py:2425) that would stay green if one site's `folder_id` merge drifted.
**Fix:** Build the dict once (`_wf_inputs = {...}`) above the `create_workflow_run` call and pass the same object to both sites — the mirror invariant then holds by construction.

### IN-05: Delete sheet's error state discards the server's error detail

**File:** `frontend/src/pages/WorkflowsPage.tsx:691-701`
**Issue:** `catch { setDeletePhase("error") }` drops the thrown message; the sheet always renders the generic "Couldn't delete the workflow", even though `deleteWorkflowCascade` throws distinguishable errors (`WorkflowNotFoundError` vs status-bearing `Error`). A 404 (deleted elsewhere / permission drift) and a 500 look identical, and the phase's own copy standard elsewhere is "the server's message verbatim, never a friendlier lie".
**Fix:** Capture the error and render its message under the retry control (special-casing `WorkflowNotFoundError` → "Already deleted" + shelf refetch).

---

_Reviewed: 2026-07-14T18:36:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
