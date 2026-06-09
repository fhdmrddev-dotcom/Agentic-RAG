---
phase: 098-project-binding-server-side-kb-scope-governance
reviewed: 2026-06-09
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/models/harness.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/scope.py
  - backend/app/services/harness_engine.py
  - backend/app/services/retrieval_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/test_098_schema_lock.py
  - backend/tests/test_098_scope_governance.py
  - backend/tests/test_harness_resume.py
  - backend/tests/test_harness_whitelist.py
  - backend/tests/test_thread_workflow_endpoint.py
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
resolved_inline: [WR-01, WR-02]
status: issues_found
---

# Phase 098: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found (2 of 3 warnings resolved inline during execute-phase; WR-03 + 3 info open as advisory)

## Summary

The core scope-governance design holds up well. The reviewer verified the four security-critical invariants the phase is built on:

- **All three ctx-build sites resolve scope from the project binding.** Kickoff (`threads.py:1199-1252`), resume (`harness_engine.py:1125-1176`), and Continue (`runs.py:894-924`) all route through the shared `resolve_project_subtree` / `assert_folder_scopes_subset` helpers, sourcing scope from `definition.project_folder_id` (not the thread folder for bound workflows). No fourth retrieval ctx-build site bypasses this — `task_service.py:593` and `phase_types._build_phase_tool_context` both inherit/narrow from the resolved parent subtree, so GOV-01 has no whole-KB re-open from a missed site.
- **RPC `p_folder_ids` remains the primary enforcement** and the runtime clip in `_handle_search_documents` is correctly gated `if ctx.folder_subtree_ids is not None` (mirrors `_handle_glob`), so the Deep/unscoped path is unchanged. `test_deep_noop` guards this.
- **The JSONB-path predicate in `db/workflows.py` is injection-safe** — only the placeholder index is f-string-built (a code-derived int); the value is bound positionally via `str(project_folder_id)`. The user-scope clause (`status='published' AND (is_global OR created_by=$1)`) is evaluated first and the project filter is AND-appended, so it can only narrow.
- **Async-safety is satisfied** — `resolve_project_subtree` awaits `fetch_visible_folders` (uses `aexec`, no raw blocking supabase-py call on the loop); the retrieval path wraps sync embed/rerank in `run_in_threadpool`.

No Critical findings — the RPC `match_user_id` filter remains intact on every path, so none of the findings is an exploitable cross-user leak.

## Warnings

### WR-01: Security-critical 098 governance tests left `xfail` after their implementations shipped — **RESOLVED INLINE**

**File:** `backend/tests/test_098_scope_governance.py`
**Issue:** `test_run_start_resolution` and `test_clip_and_emit` were marked `@pytest.mark.xfail(..., strict=False)` ("RED until Plan 04 / Plan 05 land"). Those plans landed in this same phase, so both tests XPASS — and with `strict=False`, an XPASS does not fail the suite. Net effect: the only test exercising the runtime ⊆-clip + `scope_violation` emit (the Plan-05 data-isolation backstop) gave zero regression protection.
**Resolution:** Both `xfail` decorators removed; the tests are now active green guards (verified: 13 passed, 0 xpassed, 0 xfailed). Commit follows in the same phase.

### WR-02: `ToolContext.folder_subtree_ids` annotated `set[str]` while the live contract requires `list` — **RESOLVED INLINE**

**File:** `backend/app/services/tool_dispatcher.py:69`
**Issue:** The dataclass declared `folder_subtree_ids: set[str] | None`, but every producer builds a `list` (`resolve_project_subtree` → `list[str]`; `agent_loop.py`; `_build_phase_tool_context`). The value flows to `p_folder_ids` → supabase-py `json.dumps`; a `set` raises (the codebase's documented "Pitfall 1"). The annotation contradicted the contract and invited the exact serialization fault the comments warn against.
**Resolution:** Changed to `folder_subtree_ids: list[str] | None` with an inline Pitfall-1 note.

### WR-03: Fail-open scope resolution silently degrades a bound workflow to whole-KB, with the runtime backstop also disabled and no signal — **OPEN (advisory / candidate for secure-phase)**

**File:** `backend/app/api/threads.py:1246-1252`, `backend/app/services/harness_engine.py:1171-1176`, `backend/app/api/runs.py:919-924`
**Issue:** All three sites wrap scope resolution in a broad `except Exception` that falls back to `folder_subtree_ids = None`. For a **bound** workflow, a transient failure (e.g. a DB hiccup in `fetch_visible_folders`) makes the run retrieve across the **whole KB** instead of staying inside its project — and because the Plan-05 clip + `scope_violation` emit are gated `if ctx.folder_subtree_ids is not None`, neither the primary RPC filter narrowing nor the backstop applies, with no `scope_violation` event; the only trace is a logged exception. This is within-owner only (RPC `match_user_id` still blocks cross-user rows) and the fail-open is a deliberate "never block the run" choice — hence a design-tradeoff Warning, not a crash bug.
**Recommended fix (deferred — touches the deliberate fail-open behavior; route to the user / `/gsd:secure-phase 098`):** make the degradation observable (emit a `scope_resolution_failed` / `scope_violation`-style event) rather than silently widening; consider failing closed at the kickoff site (the run hasn't started, and the validity assert already 400s for `ValueError`).

## Info (open — advisory, low severity)

### IN-01: `resolve_project_subtree._walk` has no cycle/visited guard
**File:** `backend/app/services/harness/scope.py:73-80` — recursive `parent_id` walk with no visited set; a self-parented folder or hierarchy cycle → `RecursionError`. Mirrors the Deep `_get_subtree` (RED-LINE copy) so it's consistent, and the UI doesn't normally permit cycles, but the shared helper is the right place to harden against corrupt/legacy data. Fix: thread a `seen: set[str]` through `_walk`.

### IN-02: `resolve_project_subtree` returns the root id even when the root is not owned by the user
**File:** `backend/app/services/harness/scope.py:73-80` — `_walk(root)` seeds `out = [rid]` unconditionally; descendants are owner-scoped but the root id itself isn't verified against the owner's visible set. Harmless today (RPC `match_user_id` yields 0 rows for a foreign folder) but the helper's owner-scoping guarantee isn't self-contained. Fix: verify root ∈ owner's visible set before seeding.

### IN-03: Deep-mode `search_documents` tool_result JSON now always carries `folder_id`
**File:** `backend/app/services/retrieval_service.py:133-135` — `_enrich_with_filenames` adds `folder_id` to every hit unconditionally; in Deep/unscoped mode the enriched dicts still flow into `json.dumps(results)`, so the LLM-visible payload gains `folder_id` vs pre-098 Deep output. Additive and inert (no Deep consumer reads it; citations/source_refs unaffected) but not strictly byte-identical to pre-098 Deep. Fix (if strict parity matters): strip `folder_id` on the unscoped path.

---

_Reviewer: Claude (gsd-code-reviewer), standard depth. WR-01/WR-02 resolved inline during execute-phase 098; WR-03 + IN-01..03 remain advisory._
