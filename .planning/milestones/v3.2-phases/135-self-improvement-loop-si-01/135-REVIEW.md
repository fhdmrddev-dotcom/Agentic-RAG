---
phase: 135-self-improvement-loop-si-01
reviewed: 2026-07-02T04:16:24Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/app/api/evals.py
  - backend/app/models/eval_run.py
  - backend/app/services/agent_loop.py
  - backend/app/services/eval_runner_service.py
  - backend/app/services/skill_proposer_service.py
  - backend/app/services/task_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/test_load_skill_override.py
  - backend/tests/test_promotion_gate.py
  - backend/tests/test_skill_proposals.py
  - backend/tests/test_skill_proposals_router.py
  - backend/tests/test_skill_proposer.py
  - frontend/src/components/skills/SkillEvalSection.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/lineDiff.test.ts
  - frontend/src/lib/lineDiff.ts
  - frontend/src/types/index.ts
  - supabase/full-schema.sql
  - supabase/migrations/083_skill_proposals.sql
findings:
  critical: 3
  warning: 4
  info: 6
  total: 13
status: issues_found
---

# Phase 135: Code Review Report

**Reviewed:** 2026-07-02T04:16:24Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the Phase 135 (SI-01) self-improvement loop: the `skill_proposals` persistence (mig 083 + regenerated full-schema), the evidence-bundle + forced-emission proposer service, the proposal control surface on the `/skills` router (propose / list / get / reject / approve / rerun / force-promote), the additive default-off `skill_instructions_override` seam (RunContext → ToolContext → `_handle_load_skill`, plus the eval-runner and sub-agent carriers), the promotion gate + reconcile-on-read machinery, and the frontend proposal card with the pure LCS line-diff util. For the large pre-existing files, only the phase's diff vs `c018b9d9` was in scope.

Much of the phase is solid: owner-scoping with 404-not-403 is consistent on every read/write, `promotion_gate()` math is correct and exhaustively tested, the override seam is genuinely additive/default-off at every existing call site, migration 083 and the regenerated full-schema agree, and `lineDiff` is a correct LCS implementation with meaningful round-trip tests.

However, three defects must be fixed before this ships: **force-promote is broken end-to-end from the UI** (required-but-empty Pydantic body vs a body-less fetch — verified 422 against a live FastAPI probe), **the reconcile orphan check reads the per-process `RUN_TASKS` dict under the documented WORKER_COUNT=2 default** (a healthy in-flight re-eval gets falsely persisted as `interrupted` when the GET lands on the other worker — the code in this very file documents that a per-process set is defeated by multi-worker), and **a failed re-eval launch permanently wedges the proposal in `approved`** with no backend self-heal and no frontend affordance.

## Critical Issues

### CR-01: Force-promote is broken end-to-end — required empty body vs body-less fetch (422)

**File:** `backend/app/api/evals.py:1749` and `frontend/src/lib/api.ts` (`forcePromoteProposal`)
**Issue:** `force_promote_skill_proposal` declares `body: ForcePromoteBody` with no default, which FastAPI treats as a **required** request body even though the model has zero fields. The frontend helper `forcePromoteProposal` sends `{ method: "POST", headers }` with **no body**. Verified against a live FastAPI probe (same route shape): a body-less POST — with or without `Content-Type: application/json` — returns `422 {"detail":[{"type":"missing","loc":["body"],"msg":"Field required"}]}`; only an explicit `{}` payload returns 200. The D-06 human-override feature therefore never works from the shipped UI — every click on "Force promote anyway" fails. This slipped because `test_skill_proposals.py` calls the route function directly with `ForcePromoteBody()` and `test_skill_proposals_router.py` never exercises force-promote over HTTP.
**Fix:** Either side works; safest is both:
```python
# backend/app/api/evals.py — make the empty body optional
async def force_promote_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    body: ForcePromoteBody | None = None,   # empty override body is optional
    ...
```
```typescript
// frontend/src/lib/api.ts — send the empty JSON object
const res = await fetch(
  `${API_BASE}/skills/${skillId}/proposals/${proposalId}/force-promote`,
  { method: "POST", headers, body: JSON.stringify({}) },
)
```
Add an HTTP-level force-promote row to `test_skill_proposals_router.py` so the wire contract is covered.

### CR-02: `reconcile_proposal` orphan check uses per-process `RUN_TASKS` — healthy re-evals falsely persisted as `interrupted` under the default WORKER_COUNT=2

**File:** `backend/app/api/evals.py:1208-1219` (reconcile), triggered via `list_skill_proposals`/`get_skill_proposal`; `backend/app/api/threads.py:129` (`RUN_TASKS` is a per-process dict)
**Issue:** For a `re_evaling` proposal whose run is `running`, reconcile decides "orphaned" purely by `run_key not in RUN_TASKS`. `RUN_TASKS` is an in-process dict; the project's documented default is multi-worker uvicorn (`WORKER_COUNT=2`, `backend/.env.example:58`), and this same file already warns that "WORKER_COUNT=2 defeats a per-process set" (evals.py:205). The re-eval task lives only in the worker that served the approve; the frontend fires `refetchProposal` (a GET, which reconciles) immediately after approve and again on every readout — so with two workers there is roughly a coin-flip per GET that reconcile runs on the *other* worker, sees the run absent from its `RUN_TASKS`, and persists `status='interrupted'` for a genuinely running re-eval. When the run then completes, the done-callback reconcile no-ops (`status != 're_evaling'` → returned unchanged), so the gate is never applied and a passing draft is never promoted; the user is shown "Interrupted" and the rerun affordance re-spends a full paid re-eval.
**Fix:** Use a cross-worker liveness signal instead of (or in addition to) the local dict. The Redis in-flight claim already exists and is CAS-released in `run_eval_job`'s `finally`:
```python
elif run_status == "running":
    from app.api.threads import RUN_TASKS
    try:
        run_key = UUID(str(re_eval_run_id))
    except (ValueError, TypeError):
        run_key = re_eval_run_id
    # Cross-worker liveness: the job holds eval_inflight:{skill_id} (value == run_id)
    # until its finally; TTL (1800s) bounds staleness after a hard crash.
    claim = await redis.get(_inflight_key(proposal["skill_id"]))
    claim_val = claim.decode() if isinstance(claim, bytes) else claim
    if run_key not in RUN_TASKS and claim_val != str(re_eval_run_id):
        new_status = "interrupted"
```
(Alternatively check `runs:active` membership, which the job also ZREMs in its `finally`.) Add a test for the `running` branch — it currently has none (see IN-05).

### CR-03: A failed re-eval launch permanently wedges the proposal in `approved` — no self-heal, no UI escape

**File:** `backend/app/api/evals.py:1536-1568` (approve steps 7-8), `backend/app/api/evals.py:1155-1156` (reconcile early-return), `frontend/src/components/skills/SkillEvalSection.tsx` (`approved` renders spinner only)
**Issue:** Approve commits `status='approved'` (step 7) *before* calling `_launch_reeval` (step 8). If the launch raises, the exception propagates with the proposal left at `approved`. This is easily reachable, not just a crash window: `_launch_reeval` takes the **same** `eval_inflight:{skill_id}` claim as `start_eval_run`, so approving while any normal eval is still running for the skill raises a 409 from inside the launch — after `approved` was committed. From there every door is closed: `reconcile_proposal` returns any non-`re_evaling` row unchanged (its docstring claims "approved but no re-eval linked → honestly interrupted", but that branch is only reachable for `re_evaling` rows — the docstring's crash-between-insert-and-launch scenario leaves `approved`, which never heals), re-approve 409s (`status != 'proposed'`), rerun 409s (`status != 'interrupted'`), and a new propose 409s (`approved` is in `_INFLIGHT_PROPOSAL_STATUSES`). The UI compounds it: for `approved` the card renders only the "Re-evaluating…" spinner with **no** action buttons (reject is offered only for `proposed`), so the user has no way out of a permanently wedged improvement loop for that skill.
**Fix:** Revert the state on launch failure in `approve_skill_proposal`:
```python
try:
    re_eval_run_id = await _launch_reeval(...)
except Exception:
    # The launch never happened — return the proposal to an actionable state
    # (the already-inserted self_improve draft version row is harmless).
    def _revert():
        return (
            supabase.table("skill_proposals")
            .update({"status": "proposed"})
            .eq("id", str(proposal_id)).eq("user_id", user_id)
            .eq("status", "approved")   # CAS — don't clobber a concurrent transition
            .execute()
        )
    await run_in_threadpool(_revert)
    raise
```
Additionally (defense-in-depth) let `reconcile_proposal` heal stale `approved` rows with no `re_eval_run_id` (e.g., older than a grace period) to `interrupted`, matching what its docstring already promises.

## Warnings

### WR-01: Propose destroys the previous open draft before the new proposal exists

**File:** `backend/app/api/evals.py:774-785` (step 5 supersede) vs `:799-812` (step 6 propose)
**Issue:** Lingering `proposed` drafts are flipped to `rejected` *before* the builder-model call. If `propose()` then returns `None` (424 — no builder model) or `forced_emit` raises (provider error), the user's previous reviewable draft has already been destroyed and nothing replaces it. The supersede is only needed to satisfy the one-open-proposal invariant for the *new* row, which doesn't exist yet.
**Fix:** Move the supersede after a successful emission — i.e., run `_supersede()` immediately before the `_insert()` of the new row (the in-flight 409 check can stay where it is).

### WR-02: The Pitfall-#1 override map can silently miss — keyed on the live skill name while the re-eval catalog carries the draft/base name

**File:** `backend/app/api/evals.py:1369` (`skill_instructions_override={(skill.get("name") or ""): proposed_instructions}`); `backend/app/services/eval_runner_service.py:627-632` (WITH-arm catalog uses `skill_version["name"]`); `backend/app/services/tool_dispatcher.py:713-716` (lookup keyed on the agent-supplied `skill_name`)
**Issue:** The override map is keyed on the **live** `skills.name` (from `_verify_owned_skill`), but the WITH-arm catalog injects the **draft version's** name (copied from the base version at approve). The agent calls `load_skill` with the catalog name. If the skill was renamed after the base version was captured, the override lookup misses (and the by-name DB lookup may also resolve differently) — the re-eval then silently measures the LIVE instructions while reporting a draft verdict. That is precisely the "silent no-op gate" failure mode this phase's load-bearing seam exists to prevent, and nothing surfaces it.
**Fix:** Key the map on both names so either resolution path hits:
```python
_names = {skill.get("name") or "", draft_version.get("name") or ""}
skill_instructions_override={n: proposed_instructions for n in _names if n}
```
(or assert live-name == draft-name at approve time and 409 with a clear message).

### WR-03: No compare-and-swap on proposal state transitions — read-then-write races

**File:** `backend/app/api/evals.py:1539-1551` (`_mark_approved`), `:1571-1580` (`_mark_reevaling`), `:1227-1237` (reconcile `_persist`), `:1806-1815` (`_mark_promoted`)
**Issue:** Every status transition is a read (check status) followed by an unconditional UPDATE. Two concurrent approves of the same proposal both pass the `status=='proposed'` check: both insert a `self_improve` draft version (duplicate version rows), both write `approved`, the second launch 409s on the Redis claim and — per CR-03 — wedges the row, and the surviving `new_skill_version_id` may point at the loser's draft while the re-eval measures the winner's. Two concurrent GET reconciles of a completed run both execute the promotion write (two 079-trigger dup `manual` versions). The Redis claim guards the *eval*, not the proposal row.
**Fix:** Add the expected-status predicate to each transition UPDATE (e.g. `.eq("status", "proposed")` on `_mark_approved`, `.eq("status", "re_evaling")` on reconcile's `_persist`) and treat zero affected rows as "lost the race" (409 / return the re-read row).

### WR-04: Proposal error helper renders FastAPI 422 details as garbage

**File:** `frontend/src/lib/api.ts` (`proposalError`)
**Issue:** `proposalError` assumes `detail` is a string. FastAPI validation errors (422) return `detail` as an **array of objects**; `j?.detail` is truthy, so `new Error(j.detail)` coerces to `"[object Object]"` (or a comma-joined mess) in `proposalError`'s message — which the card then displays. CR-01 makes this reachable today on every force-promote click.
**Fix:** `if (typeof j?.detail === "string") detail = j.detail` (keep the generic fallback otherwise).

## Info

### IN-01: Propose accepts a still-running source run

**File:** `backend/app/api/evals.py:737-751`
**Issue:** The D-01 guard only requires ≥1 `eval_results` row; the backend never checks the source run's `status`. A proposal (and later a gate baseline) can be built from a partial in-flight run. The frontend gates the button on `!running`, but the API does not.
**Fix:** Add `.eq`/check `status == "completed"` on the step-2 source-run read (or document partial-run proposals as intended).

### IN-02: No size cap on the evidence prompt

**File:** `backend/app/services/skill_proposer_service.py:252-324` (`_render_case` / `_render_evidence_as_data`)
**Issue:** The DATA block concatenates the full instruction body plus every case's both-arm outputs untruncated. A large corpus with long outputs can exceed the builder model's context and fail the propose with an opaque provider error (surfaced as a 424).
**Fix:** Truncate per-field (e.g., cap each output at a few KB with an honest `…(truncated)` marker), mirroring other prompt-assembly paths.

### IN-03: TS `SkillProposal.created_at/updated_at` typed non-nullable while the backend model allows `None`

**File:** `frontend/src/types/index.ts` (`SkillProposal`), `backend/app/models/eval_run.py` (`SkillProposalResponse.created_at/updated_at: datetime | None`)
**Issue:** The backend contract admits `null` timestamps (non-echoing fakes); the TS type says `string`. `pickActiveProposal`'s `(b.updated_at || b.created_at).localeCompare(...)` would throw if both were ever null.
**Fix:** Either type them `string | null` in TS with a safe fallback (`?? ""`), or make the backend fields non-nullable and stamp them app-side.

### IN-04: `_launch_reeval` failure leaves orphaned "running" rows

**File:** `backend/app/api/evals.py:1383-1387`
**Issue:** The pre-spawn exception handler releases the Redis claim but never finalizes the already-inserted `eval_runs` (status `running`), companion `runs` (status `streaming`), and thread rows — `list_eval_runs` shows a phantom forever-"running" run. Same class exists in `start_eval_run` (pre-existing), so this perpetuates a known gap rather than introducing it.
**Fix:** In the except block, best-effort update the inserted `eval_runs` row to `failed` (and finalize the runs row) before re-raising.

### IN-05: The reconcile `running`/orphan branch has no test coverage

**File:** `backend/tests/test_skill_proposals.py`
**Issue:** Reconcile is tested for `completed` (promote / not-promote) and `failed` (interrupted) runs, but not the `running` branch with the RUN_TASKS orphan heuristic — the exact code carrying CR-02.
**Fix:** Add a test seeding a `running` re-eval with (a) the task registered → stays `re_evaling`; (b) not registered/claim absent → `interrupted` (against whatever liveness signal CR-02's fix settles on).

### IN-06: `case_deleted` handling in the evidence bundle is dead code

**File:** `backend/app/services/skill_proposer_service.py:99-117`, `:258-259`
**Issue:** `eval_results.test_case_id` is `NOT NULL` with `ON DELETE CASCADE` (full-schema.sql:632, :2426) — deleting a test case deletes its result rows, so a with-arm row whose `test_case_id` misses the owner-scoped `case_map` cannot occur for the row's owner. The "(test case deleted)" render path is unreachable. Harmless defensive code; keep or note it as such.
**Fix:** Optional — comment that the branch is defensive-only given the CASCADE FK, or drop it.

---

_Reviewed: 2026-07-02T04:16:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
