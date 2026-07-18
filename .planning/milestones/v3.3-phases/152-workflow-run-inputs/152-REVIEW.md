---
phase: 152-workflow-run-inputs
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - backend/app/services/harness/scope.py
  - frontend/src/pages/WorkflowsPage.tsx
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 152: Code Review Report (gap-closure re-review, plan 152-08)

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (INFO-only — the gap fix itself is correct and ships-ready)

## Summary

Scope: the 152-08 gap-fix diff only (`59c8968b^ → HEAD`; commits 59c8968b scope.py + a6edab25 WorkflowsPage.tsx). The fix restores the author-project-subtree containment check that 152-06's WR-03 fix dropped, which had re-opened the D-04 widen blocker (an owner-visible strict ANCESTOR/SIBLING override widening a bound run into unrelated sibling projects).

**The widen regression is correctly closed.** I traced all four review questions:

1. **Necessary AND sufficient — confirmed.** In `resolve_run_scope_root` the restored `if override not in project_subtree: override = None` (NECESSARY, author-subtree membership, scope.py:176-177) sits in front of, and the per-phase intersection loop lives in the `else` branch (SUFFICIENT, scope.py:185-192). Both conditions must hold — an override is kept only if it is inside the author subtree AND every declared phase `folder_scope` still intersects the override's own subtree. Verified against the P/A1/P2/R ancestor case in `test_a4_ancestor_override_dropped` (resolver returns author `p`, not the widening ancestor `r`) and the two-phase empty-intersection case in `test_a4_two_phase_empty_intersection_dropped`. All pre-existing A4 tests remain green under the new ordering.

2. **`author_root` None — handled safely.** When `author_root is None`, `resolve_project_subtree(None)` returns `None → set()`, so `override not in project_subtree` is always true and the override is dropped (fail-safe → `thread_folder_id`). Never a crash, never a widen. In practice the A4 branch is unreachable with `author_root is None`: `_definition_has_phase_folder_scope(...)` can only be true when `project_folder_id` is set, because `WorkflowDefinition._folder_scope_requires_project` (models/harness.py:252-263) rejects any per-phase `folder_scope` on an unbound workflow. Confirmed no `WorkflowDefinition.model_construct` bypass exists in production code (only `model_validate` at the run-start load path).

3. **Frontend mirror guards `authorDefaultFolderId == null` — correct for the reachable path.** `overrideOptions` applies the containment filter only when `authorDefaultFolderId != null` (the bound path, WorkflowsPage.tsx:1052-1054). For a bound folder_scope workflow it keeps only descendants of the author folder that also pass the per-phase intersection, so no ancestor/sibling widen option is ever offered. The unbound branch is retained but is dead for validly-published definitions (see IN-01).

4. **Return type — `str | None`, never a set.** `return override or author_root or thread_folder_id` (scope.py:194) — all three are `str | None`; the intermediate `set(...)` values are used only for membership tests and never returned. `test_returns_str_or_none_and_fetches_once` locks this. Pitfall 6 satisfied.

Per the review brief, I did NOT re-flag the deferred/intentional items: WR-01 TOCTOU and WR-02 `cap_paused` producer-match (both live in api/workflows.py, out of scope), and the no-per-phase-folder_scope general bound path (owner-gated override deliberately honored per `<decision_general_bound_path>`).

## Narrative Findings (AI reviewer)

### Info

#### IN-01: Frontend/backend disagree on the (currently unreachable) unbound + per-phase-folder_scope shape

**File:** `frontend/src/pages/WorkflowsPage.tsx:1052-1054`, `backend/app/services/harness/scope.py:173-177`
**Issue:** 152-08 introduced an asymmetry for the "unbound workflow that nonetheless declares per-phase `folder_scope`" shape:
- Backend: `project_subtree = set(await resolve_project_subtree(author_root=None ...) or []) = set()`, so `override not in project_subtree` is always true → **every** override is dropped (falls to `thread_folder_id`).
- Frontend: when `authorDefaultFolderId == null` the containment filter is skipped (`contained = candidates`) and only the per-phase intersection is applied → it **offers** override candidates that satisfy the intersection.

So for this shape the UI would present folder options the backend silently ignores (a "picked folder had no effect" UX inconsistency). It is *not* a security issue — the backend is strictly more conservative (drops → no widen).

This shape is currently **unreachable**: `WorkflowDefinition._folder_scope_requires_project` (models/harness.py:259-263) rejects any per-phase `folder_scope` on a workflow with `project_folder_id is None`, and every run-start definition flows through `model_validate`. The frontend's `authorDefaultFolderId == null` branch is therefore effectively dead code for a validly-published workflow. Flagged as INFO (latent robustness note, not a live defect): if that structural validator is ever loosened, the two sides would diverge with no compile-time link between them.

**Fix (optional, defense-in-depth):** make the frontend match the backend's fail-safe posture for the unbound case rather than skipping containment — offer no override options (mirroring the backend's empty `project_subtree`):
```ts
const contained =
  authorDefaultFolderId != null
    ? candidates.filter((cand) => subtreeOf(authorDefaultFolderId).has(cand.id))
    : [] // unbound + folder_scope is structurally rejected; match backend (drops all overrides)
```
Alternatively, leave as-is and rely on the model validator as the single source of truth — acceptable given the shape cannot be constructed today.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
