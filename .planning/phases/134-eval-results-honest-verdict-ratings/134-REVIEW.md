---
phase: 134-eval-results-honest-verdict-ratings
reviewed: 2026-07-01T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - backend/app/services/eval_runner_service.py
  - backend/app/models/eval_run.py
  - backend/app/api/evals.py
  - backend/tests/test_eval_runner.py
  - backend/tests/test_evals_router.py
  - frontend/src/types/index.ts
  - frontend/src/lib/api.ts
  - frontend/src/components/skills/SkillEvalSection.tsx
  - supabase/migrations/081_eval_verdict_and_ratings.sql
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 134: Code Review Report

**Reviewed:** 2026-07-01T12:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 134 authored changes (diffed against `d3fa6ebe`): the honest
verdict engine (`_judge_eval_answer` + the D-04 grading gate + with-skill rollup in
`eval_runner_service.py`), the owner-gated ratings endpoint and rating-merge readout
(`evals.py`), the `eval_verdict` SSE demux (`api.ts` + `SkillEvalSection.tsx`), the
Pydantic/TS wire mirrors, and migration `081`.

The security- and correctness-critical surfaces the phase called out are **implemented
correctly**, and I verified each by tracing the call chains rather than trusting the
docstrings:

- **IDOR gate (`rate_eval_result`)** — owner-verify on `eval_results(id, user_id)`
  returns 404 (never 403); `user_id` sourced from `current_user`, never the body;
  `RateResultBody` carries only `rating`; the upsert/delete are scoped by `user_id`.
  Cross-user write is blocked before any DB mutation. Confirmed by `test_rating_cross_user_404`.
- **Prompt-injection discipline** — `expected_behavior` is woven as delimited DATA in the
  judge system prompt; the answer-under-test rides the user message; `overall_passed` is
  schema-bound via `forced_emit(schema_model=JudgeVerdict)` (no regex-on-prose). The
  `str.format` brace claim holds — the template has exactly one `{expected_behavior}`
  placeholder and substituted values are not re-parsed.
- **D-04 honesty gate** — grading fires only for `status == "completed" and output.strip()`;
  an errored/empty arm stays `not_measured` with the judge NEVER called; a completed-but-
  ungradeable arm records `judge_error`; `verdict_passed` is NULL unless `graded`. Confirmed
  by `test_errored_arm_not_measured` (`judge.await_count == 0`).
- **Same-insert verdict persistence** — the verdict rides the SAME `eval_results` insert
  (no follow-up UPDATE; the table has no UPDATE policy anyway).
- **Judge provider independence** — `provider=` is pinned to `resolve_judge_model`'s
  registry provider; the cross-provider key copy lives inside `forced_emit`
  (verified at `forced_emit.py:386-426`). Never routes to the provider-under-test.
- **`run_in_threadpool` wrapping** — every new blocking supabase-py call (`_verify_result`,
  `_clear`, `_upsert`, `_read_ratings`) is wrapped (D-v2.5-01). Redis calls are natively async.
- **Additive `eval_verdict` demux** — the branch sits after the Deep/harness switch, carries
  NO `return` (cursor still advances), and is backward-compatible (dropped when
  `onEvalVerdict` is absent). Deep dispatch is byte-identical.

No blockers found. The two warnings are robustness fragilities (a latent-correctness
over-fetch and a stale-state race that can re-surface a known bug); the info items are
maintainability notes.

## Warnings

### WR-01: `get_eval_run` fetches ALL of the caller's ratings, then filters in Python — silent-drop risk under a PostgREST row cap

**File:** `backend/app/api/evals.py:385-398`
**Issue:** The rating-merge read is scoped only by user, not by the current run's result
ids:
```python
def _read_ratings():
    return (
        supabase.table("eval_ratings")
        .select("eval_result_id, rating")
        .eq("user_id", user_id)          # every rating the user has EVER made
        .execute()
    )
...
rating_map = {
    row["eval_result_id"]: row["rating"]
    for row in (ratings_resp.data or [])
    if row.get("eval_result_id") in result_ids   # filtered client-side
}
```
Under the current config no PostgREST `db-max-rows` cap is set (grep of `supabase/`
found none), so today this is "merely" an unbounded over-fetch that grows with the
user's lifetime rating count. But `max-rows` is a standard production hardening for a
project that explicitly "targets org-scale," and if it is ever set, this query is
truncated *server-side* — ratings for the **current run** can fall outside the returned
page, and the merge then reports a genuinely-rated answer as `rating: null` (the thumb
silently disappears). The fix is both correct and efficient.
**Fix:**
```python
def _read_ratings():
    return (
        supabase.table("eval_ratings")
        .select("eval_result_id, rating")
        .eq("user_id", user_id)
        .in_("eval_result_id", list(result_ids))   # bound to THIS run's results
        .execute()
    )
```
(The `if row.get("eval_result_id") in result_ids` guard can then be dropped.)

### WR-02: `loadReadout` never guards its `setState` against a skill switch — can re-surface the BUG-260701-02 stale-results-under-wrong-skill symptom

**File:** `frontend/src/components/skills/SkillEvalSection.tsx:81-89` (and its callers at `:123-133`, `:174`)
**Issue:** The mount effect's `cancelled` flag guards the `init()` awaits, but
`loadReadout` — which is *also* invoked from the `subscribeToRun` callbacks
(`onEvalComplete`, `onTerminal`) and awaited inside `init()` — has no such guard:
```ts
async function loadReadout(rid: string) {
  const { eval_run, eval_results } = await getEvalRun(skillId, rid)  // skillId from closure
  setEvalRun(eval_run)      // no cancellation / current-skill check
  setResults(eval_results)
}
```
If the user switches skills while a `getEvalRun` for the previous skill is in flight (or a
terminal/complete callback for the previous run's stream fires in the same tick as the
switch), the stale response resolves *after* the new effect has reset state and lands the
**old skill's** results into the new skill's view — exactly the BUG-260701-02 class the
mount-effect reset was added to fix. `abortRef.abort()` stops the SSE reader but does not
cancel an already-dispatched `loadReadout` fetch. Narrow race, but user-visible and a
known-painful symptom.
**Fix:** Thread the effect's `AbortController`/`cancelled` state (or a `currentSkillRef`)
into `loadReadout` and bail before `setState`:
```ts
async function loadReadout(rid: string, signal?: AbortSignal) {
  const { eval_run, eval_results } = await getEvalRun(skillId, rid /*, signal */)
  if (signal?.aborted) return          // dropped if the skill switched mid-fetch
  setEvalRun(eval_run); setResults(eval_results)
}
```
and pass `abortRef.current?.signal` (or compare a captured `skillId` against the live prop) at each call site.

## Info

### IN-01: `EvalRunResponse` / `EvalResultResponse` are dead code — Phase 134 added verdict/rollup/rating fields to models nothing uses

**File:** `backend/app/models/eval_run.py:44-97`
**Issue:** A backend-wide grep finds only the two class definitions — neither model is
referenced anywhere (the routes return raw untyped dicts, e.g. `return {"eval_run": ...,
"eval_results": ...}`, with no `response_model=`). Phase 134 carefully extended these
classes with `verdict_state`/`verdict_passed`/`.../rating`, but since they are never
instantiated or attached to a route, they provide **no** response validation or
serialization and can silently drift from the real wire shape. (`StartEvalRunBody` /
`RateResultBody` in the same file ARE used — this note is only about the two Response models.)
**Fix:** Either wire them in as `@router.get(..., response_model=EvalRunReadout-equivalent)`
so they actually validate the payload, or delete them to remove the maintenance illusion.

### IN-02: `resolve_judge_model` is resolved twice per graded arm (plus per-arm function-local re-imports)

**File:** `backend/app/services/eval_runner_service.py:437-443` (vs `:202`)
**Issue:** `_judge_eval_answer` already resolves the judge model internally, but `_run_arm`
re-imports `settings` + `resolve_judge_model` inside the per-arm `else` branch and resolves
it a second time solely to record `judge_model`. It is deterministic today so the recorded
model matches the one actually used, but the recorded value is derived independently of the
model the judge shot truly ran on — a latent divergence if resolution ever becomes
settings-mutable mid-run, and a redundant re-import on every graded arm.
**Fix:** Have `_judge_eval_answer` return the judge model it resolved (e.g.
`{"emitted"..., "judge_model": model}`) and read it back in `_run_arm`, so the persisted
`judge_model` is provably the model that produced the verdict.

### IN-03: Live verdict badge shows the raw enum while the durable readout humanizes it

**File:** `frontend/src/components/skills/SkillEvalSection.tsx:115-122` (vs `verdictBadge` at `:49-60`)
**Issue:** The live `onEvalVerdict` path renders the raw `verdictState` for non-graded arms
(`"not_measured"` / `"judge_error"`), while the durable readout's `verdictBadge` renders the
humanized `"not measured"` / `"judge error"`. The same arm therefore reads `"... · not_measured"`
mid-stream and `"not measured"` after refresh — a cosmetic inconsistency. Low priority (this
is the deliberately-undesigned `--skip-ui` surface superseded by Phase 137).
**Fix:** Reuse a shared label map for both the live merge and `verdictBadge` so the string is
single-sourced.

---

_Reviewed: 2026-07-01T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
