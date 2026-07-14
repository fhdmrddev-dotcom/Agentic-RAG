---
phase: 152-workflow-run-inputs
reviewed: 2026-07-14T20:19:42Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/services/harness/scope.py
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/components/layout/ChatLayout.tsx
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 152: Code Review Report (gap-closure re-review, plans 05–07)

**Reviewed:** 2026-07-14T20:19:42Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is a **gap-closure re-review** of phase 152. The prior full review (see git history for
the earlier version of this file) found blocker CR-01 + warnings WR-01/03/04/05; gap-closure
plans 05–07 (commits `cb7cb1e4`…`a052d30d`) were executed to close them. This review is scoped
to the diff those plans introduced across the 5 listed files, and evaluates (1) whether CR-01 is
genuinely fixed and (2) whether the gap-closure code introduces any new defect.

**CR-01 (cancel-first cascade delete) — genuinely fixed for the primary case.** I traced this
end-to-end against the actual schema and call graph rather than trusting the route's comments:
`runs.run_id` really is the table's own PK (confirmed against `full-schema.sql:1042`, not
`runs.id`), and it is correctly resolved via `LEFT JOIN runs r ON r.thread_id = wr.thread_id AND
r.status = 'streaming'` and threaded into `_cancel_run_internals(run_id=r["producer_id"], ...)`
— the same identity `RUN_TASKS` is keyed by (`threads.py:2011`). The separate
`publish_cancel_sentinel(redis, r["wf_id"])` call is also correctly targeted: I verified the
`llm_human_input` phase type (`phase_types.py:_exec_llm_human_input`) subscribes with
`run_id = ctx.run_id`, where `ctx` is the harness ctx bag whose `.run_id` **is**
`workflow_runs.id` — so a workflow paused on `llm_human_input` really is reachable via the
workflow-run-id channel, not the producer-run-id channel used by the Deep-chat `ask_user` tool.
WR-01's new `count_foreign_runs_on_global` 409 guard is correctly ordered before any
cancel/delete side effect.

**However, the WR-03 fix (`scope.py` A4 override guard) introduces a new BLOCKER.** It silently
drops the "override must be within the project subtree" bound the pre-patch code enforced,
replacing it with a check that has no necessary-condition component at all — despite the
function's own updated docstring explicitly asserting that bound still holds ("Membership in the
project subtree is necessary but NOT sufficient"). This is a genuine, easily-reachable
regression introduced by this gap-closure patch (not a re-litigation of the accepted 01–04
design): a per-run KB-scope override can now widen a bound workflow's retrieval to unrelated
sibling folders/projects it was never bound to. I confirmed the resolved root flows straight
into the run's real `folder_subtree_ids` at the kickoff call site (`threads.py:1543-1552`), so
this is not theoretical. The identical logic is mirrored (and therefore also broken) in the
frontend's `overrideOptions` computation, so the UI actively offers the problematic folder as a
selectable option. The gap-closure's own test file does not exercise this case, so it ships
green.

Two WARNING-level gaps round out the review: a TOCTOU race between the WR-01 foreign-run guard
and the actual cancel/cascade (no shared transaction or lock spans the check and the delete),
and an incomplete inflight-producer match (`r.status = 'streaming'` only) that misses a workflow
paused via the harness's own iteration-cap (`cap_paused`), leaving that producer's `runs` row
un-terminalized (though the workflow_runs row itself is still correctly finalized, so the delete
is not blocked).

## Critical Issues

### CR-01: WR-03 A4 fix drops the "override ⊆ project subtree" bound — scope can escape to unrelated folders

**File:** `backend/app/services/harness/scope.py:143-170` (mirrored in
`frontend/src/pages/WorkflowsPage.tsx:1033-1050`)

**Issue:** The pre-gap-closure code enforced two conditions for a scoped workflow's per-run
override: (1) the override must be a member of the **author's own project subtree**, and (2) [the
WR-03 bug being fixed] the override's own subtree must intersect every declared phase's
`folder_scope`. The new code implements **only** (2) and never re-checks (1) — despite the
function's own updated docstring explicitly claiming "Membership in the project subtree is
necessary but NOT sufficient" (scope.py:135-136). The code no longer implements the "necessary"
half at all; it was removed, not preserved.

Concretely: if a workflow is bound to `project_folder_id = ProjectA` and declares
`phase.config.folder_scope = [SubA1]` (a legal descendant of ProjectA, enforced at
publish-time by `assert_folder_scopes_subset`), a caller can pass
`run_inputs["folder_id"] = Root` where `Root` is any owner-visible **ancestor** of `ProjectA`
that also has unrelated sibling children (e.g. `ProjectB`, a different client's folder). The
guard computes `override_subtree = resolve_project_subtree(Root, ...)`, which — because it
walks the *entire* subtree under `Root` — contains `SubA1` (so the intersection check at
scope.py:166 passes) **and also contains `ProjectB` and everything else under `Root`**. The
override is therefore accepted and returned as the scope root (scope.py:170). This root then
flows straight into `resolve_project_subtree(_wf_scope_root, ...)` at
`backend/app/api/threads.py:1550` to become `folder_subtree_ids` — the run's actual retrieval
scope — so the workflow now retrieves from `ProjectB` too, despite being explicitly bound to
`ProjectA`, and despite the caller only ever picking a folder from the KB-scope `<select>`.

This directly contradicts the documented "narrow-only" contract this whole feature (WFIN-02 /
D-06 / D-LOCK-01) is built around, and breaks the project-isolation guarantee PROJ-01/D-03 exists
to provide (a multi-project account — the stated B2B target — could leak one client's documents
into another client's workflow output, silently, with no error surfaced to the user). It is not
a cross-user issue (D-05's owner-reachability gate still holds — only the account owner's own
folders are reachable), but it is a same-account cross-project confidentiality break, and it is
trivially reachable with ordinary nested folders — no adversarial folder-tree construction
required.

The new unit test `test_a4_override_outside_subtree_dropped` only covers an override that is an
**isolated leaf** (`subtree(override) = {override}`), and
`test_a4_two_phase_empty_intersection_dropped`'s "good path" regression lock only exercises
`override = project root` exactly. Neither exercises an override that is a strict **ancestor**
of the project root with unrelated siblings, so the regression ships green.

**Fix:** Re-instate the project-subtree membership check alongside the new per-phase
intersection check — both are necessary, matching the docstring's own claim:

```python
elif _definition_has_phase_folder_scope(definition):
    project_subtree = set(
        await resolve_project_subtree(author_default, supabase=supabase, user_id=user_id) or []
    )
    if override not in project_subtree:
        override = None  # restore the "necessary" bound the pre-WR-03 code enforced
    else:
        override_subtree = set(
            await resolve_project_subtree(override, supabase=supabase, user_id=user_id) or []
        )
        for phase in definition.phases:
            scope = getattr(phase.config, "folder_scope", None)
            if scope and not ({str(f) for f in scope} & override_subtree):
                override = None  # existing WR-03 "sufficient" check
                break
```

Mirror the same `override ⊆ author project subtree` filter in `WorkflowsPage.tsx`'s
`overrideOptions` (intersect the candidate list with the already-computed author subtree before
applying the per-phase intersection filter), and add a regression test with an override that is
a **strict ancestor** of the project root carrying an unrelated sibling subtree, asserting the
override is dropped.

## Warnings

### WR-01: `count_foreign_runs_on_global` 409 guard is not atomic with the cancel/cascade — TOCTOU race

**File:** `backend/app/api/workflows.py:509-547, 575`

**Issue:** The WR-01 fix correctly refuses (409) a global-workflow delete when
`count_foreign_runs_on_global` finds another user's run at check time. But the check
(`workflows.py:516`), the cancel-first `inflight` query (`workflows.py:537`), and the FK-safe
cascade delete (`workflows.py:575`) are three separate, unsynchronized round-trips against the
pool — no shared transaction, row lock, or re-check immediately before the destructive delete.
If another user starts a run on the same global, published workflow in the window between the
guard passing (0 foreign runs) and the cascade committing, that run is silently cancelled and
its history destroyed without the 409 ever firing — precisely the outcome WR-01 was written to
prevent. The window is narrow but real, and this route is reachable by any owner of a
global-published workflow at any time.

**Fix:** Re-run `count_foreign_runs_on_global` (or an equivalent `SELECT ... FOR UPDATE`-style
check) inside the same transaction as `delete_published_workflow_cascade`, immediately before
the `DELETE FROM workflow_runs`, so the guard and the destructive write are atomic. At minimum,
take a row lock on the target `workflow_definitions` rows for the duration of the cancel+delete
sequence.

### WR-02: cancel-first inflight query only matches `runs.status = 'streaming'`, missing `cap_paused` producers

**File:** `backend/app/api/workflows.py:537-547`

**Issue:** `workflow_runs.status IN ('active', 'paused', 'cap_paused')` is the declared
"in-flight" set the route claims to heal (see the docstring at `workflows.py:491`: "CANCEL-FIRST
every in-flight run"), and `cap_paused` is a legitimate non-terminal producer-run status
(`runs_status_check` constraint, `full-schema.sql:1057`; also confirmed by
`run_reconciler.py:84` — `_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]`). But the
`LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'` only matches a
`'streaming'` producer row. A workflow run whose harness-level status is `cap_paused` (the
harness's own iteration-cap pause) will typically have its producer `runs` row also at
`cap_paused`, not `'streaming'` — so `producer_id` resolves to `NULL` for that row, and
`_cancel_run_internals` is never invoked for it. The `workflow_runs` row itself still gets
durably terminalized via the unconditional `finish_run(pool, r["wf_id"], "cancelled")` call, so
the delete cascade itself is not blocked or corrupted — but the orphaned `runs` row is left
sitting at `cap_paused` forever (never transitioned to `'cancelled'`), relying entirely on an
unrelated mechanism (the boot-time `run_reconciler` sweep) to eventually clean it up, which is
not guaranteed to run before the workflow (and its FK trail) has already been deleted.

**Fix:** Broaden the LEFT JOIN's producer-status filter to `r.status IN ('streaming',
'cap_paused')` so a cap-paused producer is resolved and passed through `_cancel_run_internals`
the same way a streaming one is:

```sql
LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status IN ('streaming', 'cap_paused')
```

(If multiple producer rows could match per thread once `cap_paused` is included, add an
`ORDER BY r.started_at DESC LIMIT 1`-style tie-break, or a `DISTINCT ON`, to keep one row per
`workflow_runs.id`.)

---

_Reviewed: 2026-07-14T20:19:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
