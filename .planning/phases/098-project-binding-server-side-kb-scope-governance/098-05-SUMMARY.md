---
phase: 098-project-binding-server-side-kb-scope-governance
plan: 05
subsystem: api
tags: [harness, workflow, kb-scope, governance, retrieval, scope-violation, sse, rls, pytest]

# Dependency graph
requires:
  - phase: 098-03
    provides: "backend/app/services/harness/scope.py (resolve_project_subtree + assert_folder_scopes_subset) + the cross-plan TDD contract test_098_scope_governance.py (test_clip_and_emit RED-by-design target, test_deep_noop must-stay-green)"
provides:
  - "folder_id on the enriched retrieval dict (backend/app/services/retrieval_service.py::_enrich_with_filenames) — additive, Deep-inert; return shape unchanged"
  - "Gated post-query ⊆ scope clip + scope_violation run-event emit in backend/app/services/tool_dispatcher.py::_handle_search_documents (D-05a Deep no-op gate + D-06 observability)"
  - "backend/tests/test_harness_whitelist.py::test_act_export_tool_excluded_from_read_only_phase — the D-13 act/export separability no-regression test"
affects: [harness, kb-scope, workflow-run, retrieval, observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-query ⊆ scope clip as an in-app runtime BACKSTOP to the primary RPC p_folder_ids filter — gated `if ctx.folder_subtree_ids is not None` so the shared search path is byte-identical for Deep (mirrors _handle_glob:145)"
    - "scope_violation rides the existing _emit → XADD run:{run_id} run-event channel (NO new SSE channel, NO harness_audit row); best-effort emit never breaks a clean retrieval"
    - "scope set()-ified LOCALLY only for membership (Pitfall 1) — the ctx.folder_subtree_ids channel stays a list[str]"

key-files:
  created: []
  modified:
    - "backend/app/services/retrieval_service.py"
    - "backend/app/services/tool_dispatcher.py"
    - "backend/tests/test_harness_whitelist.py"

key-decisions:
  - "Clip is inserted IMMEDIATELY after the search_documents call and BEFORE building tool_result/source_refs/citations/audit — so every downstream artifact (LLM context, citations, the search.query audit) reflects the kept (clipped) result set"
  - "Deep red line held by the `if ctx.folder_subtree_ids is not None` gate (D-05a) — when None (Deep whole-KB) the entire block is skipped and the additive folder_id enrich key is inert"
  - "scope_violation is NOT registered in db/workflows.py::_AUDIT_EVENT_TYPES — it is a run-event kind on the _emit channel, not a harness_audit DB row (D-06 observability, not durable audit)"

patterns-established:
  - "Two-class scope governance complete: Plan 03 definition-time ⊆ validator (hard ValueError) + Plan 05 runtime ⊆ clip+warn (drop + scope_violation, run continues) — distinct mechanisms (Pitfall 5)"

requirements-completed: []  # GOV-01 is multi-plan (01-05); this plan delivers SC#3 (⊆ assert) + SC#4 (clip + observable) only — completion is owned by phase verification

# Metrics
duration: ~14min
completed: 2026-06-09
---

# Phase 098 Plan 05: Runtime ⊆ Scope Clip + scope_violation Emit + D-13 Whitelist Test Summary

**The loud, observable runtime backstop: a retrieved row whose folder falls outside the bound scope is clipped from the result set AND a `scope_violation` event surfaces on `run:{run_id}` — gated `if ctx.folder_subtree_ids is not None` so the shared `search_documents` path stays byte-identical for Deep whole-KB; the per-phase act/export whitelist (D-13) is preserved unchanged and now regression-tested.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-09T14:24Z (approx)
- **Completed:** 2026-06-09T14:38Z
- **Tasks:** 2
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments
- **`retrieval_service.py::_enrich_with_filenames` — additive `folder_id` (Task 1).** The `documents` SELECT now fetches `folder_id`, and each enriched row gains `entry["folder_id"] = doc.get("folder_id")` (None for ungrouped docs). The `search_documents` return annotation `tuple[list[dict], float]` is unchanged — the only delta is one extra dict key, which Deep consumers never read (inert).
- **`tool_dispatcher.py::_handle_search_documents` — gated ⊆ clip + `scope_violation` emit (Task 2).** Immediately after the `search_documents` call: when `ctx.folder_subtree_ids is not None`, a local `set(map(str, ...))` membership test partitions hits into kept vs. dropped; if any are dropped, `results` is replaced with the kept set AND a `scope_violation` event (`dropped`, `out_of_scope_folders`, `query`) is XADDed to `run:{run_id}` via `ctx.emit`. The emit is best-effort (`try/except` → `logger.exception`) so an emit failure can never turn a clean retrieval into an exception. The RPC `p_folder_ids` filter remains the PRIMARY enforcement (this clip is ~always a no-op in a healthy run — Pitfall 4).
- **D-13 act/export separability preserved + tested (Task 2).** The `dispatch_tool` whitelist gate (`if ctx.phase_whitelist is not None`) is untouched; added `test_act_export_tool_excluded_from_read_only_phase` (selectable by `-k exclude`) — a read-only phase whitelist `{search_documents, read_document, ls, grep}` refuses the act/export tool `workspace_write` with the clean refusal envelope.
- **The Plan 03 RED contract test goes green.** `test_clip_and_emit` (xfail RED-by-design, owned by Plan 03 — not edited) now XPASSes; `test_deep_noop` (the byte-identical Deep guardrail) stays green.

## Task Commits

Each task was committed atomically (--no-verify, parallel-worktree mode):

1. **Task 1: Add folder_id to the enriched retrieval dict (additive, Deep-inert)** — `f77e35ca` (feat)
2. **Task 2: Gated ⊆ clip + scope_violation emit + D-13 whitelist test** — `52505ad2` (feat)

**Plan metadata (SUMMARY.md):** committed separately with this summary (docs: complete plan).

## Files Created/Modified
- `backend/app/services/retrieval_service.py` (modified) — `_enrich_with_filenames`: `folder_id` added to the SELECT and to the per-row `entry` dict
- `backend/app/services/tool_dispatcher.py` (modified) — `_handle_search_documents`: gated post-query ⊆ clip + best-effort `scope_violation` emit, inserted before `tool_result`/`source_refs`/citations/audit are built
- `backend/tests/test_harness_whitelist.py` (modified) — added `test_act_export_tool_excluded_from_read_only_phase` (D-13 no-regression)

## Decisions Made
- **Clip placement = immediately after the search, before all downstream artifacts.** Inserting the clip ahead of `tool_result = json.dumps(results)` (and the later `source_refs`/`citations`/`write_audit_entry` build) guarantees the LLM context, the citation objects, and the `search.query` audit all reflect the kept (clipped) result set — not the raw, pre-clip rows.
- **Deep red line via the `is not None` gate (D-05a).** The clip block is entirely skipped when `ctx.folder_subtree_ids is None` (Deep whole-KB), so the shared path is byte-identical and the additive `folder_id` key is inert. Verified by `test_deep_noop` staying green.
- **`scope_violation` is a run-event, not a harness_audit row.** It rides the existing `threads._emit` → `XADD run:{run_id}` channel (the same channel as `skill_activated`/`tool_refused`/etc.) and is deliberately NOT added to `db/workflows.py::_AUDIT_EVENT_TYPES` (confirmed by grep). This satisfies D-06 observability (surfaces in the run log/timeline; run continues) without introducing a new SSE channel or a durable audit kind.
- **Scope set()-ified LOCALLY only (Pitfall 1).** `set(map(str, ctx.folder_subtree_ids))` is built inside the handler for membership; `ctx.folder_subtree_ids` itself stays a `list[str]` (a real set on the RPC `p_folder_ids` param would raise in supabase-py `json.dumps`).

## Deviations from Plan
None - plan executed exactly as written. Source behavior matches the plan's `<action>` blocks verbatim (clip idiom, gate, emit kwargs, best-effort except); the D-13 test uses `workspace_write` as the representative act/export tool (the plan said "e.g. a write/export tool").

## Threat Model Coverage
- **T-098-01 (Tampering/EoP — out-of-scope row reaches the model):** mitigated — the post-query ⊆ clip drops any row whose `folder_id ∉ ctx.folder_subtree_ids` (server-bound scope; model `args` carry only `{query, metadata_filter}`). Verified by `test_clip_and_emit`.
- **T-098-08 (Deep red-line regression):** mitigated — the clip is gated `if ctx.folder_subtree_ids is not None` (literal no-op when None); the additive `folder_id` enrich key is inert for Deep. Verified by `test_deep_noop`.
- **T-098-12 (Repudiation/observability, D-06):** mitigated — a clip emits an observable `scope_violation` run-event on `run:{run_id}`; best-effort emit never breaks a clean retrieval; the run continues (clip-not-fail).
- **T-098-13 (EoP, D-13 act/export separability):** mitigated — the `dispatch_tool` whitelist gate is preserved unchanged; a read-only phase refuses an excluded act/export tool. Verified by `test_act_export_tool_excluded_from_read_only_phase`.

## Verification Evidence
- `pytest tests/test_098_scope_governance.py tests/test_harness_whitelist.py -rxX` → **11 passed, 1 xfailed, 1 xpassed** (exit 0). The xfail is `test_run_start_resolution` (Plan 04's target, correctly still RED); the xpass is `test_clip_and_emit` (this plan's target, now green).
- `pytest tests/test_098_scope_governance.py::test_deep_noop tests/test_098_scope_governance.py::test_clip_and_emit tests/test_harness_whitelist.py -k "exclude or clip or deep"` → **3 passed, 1 xpassed** (Task 2 acceptance command, exit 0).
- `python -c "import app.services.retrieval_service"` → ok; `search_documents` return annotation still `tuple[list[dict], float]` (Task 1 acceptance).
- grep `scope_violation` → only `tool_dispatcher.py` (the emit) + `test_098_scope_governance.py` (the test) + `harness/scope.py` (a docstring DISCLAIMING that the definition-time guard emits it). NOT in `db/workflows.py::_AUDIT_EVENT_TYPES`.
- grep `if ctx.phase_whitelist is not None` → still present (D-13 gate unchanged).

## Known Stubs
None. The `folder_id` key resolving to `None` for ungrouped documents and the clip block being skipped for Deep (`folder_subtree_ids is None`) are intentional, documented behaviors — not stubs.

## User Setup Required
None - no external service configuration required (no migration, no env var, no new dependency).

## Issues Encountered
- **Worktree had no `backend/.env`** — `app.config.Settings()` requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (read by pydantic-settings at import time). Resolved for test/import runs only by exporting the conftest's placeholder env vars inline on the command (`SUPABASE_URL=https://test.supabase.co ...`); the conftest itself `os.environ.setdefault`s these for the pytest path. No `.env` was created or committed (verification-environment setup, not a code change).

## Next Phase Readiness
- GOV-01 SC#3 (⊆ assert) + SC#4 (clip + observable) are now wired end-to-end; the two-class scope governance is complete (Plan 03 definition-time validator + Plan 05 runtime clip). `GOV-01` remains a phase-level multi-plan requirement — NOT marked complete here (phase verification owns that).
- Plan 04 (run-start scope resolution at kickoff/resume/Continue) is the remaining wiring; its target `test_run_start_resolution` stays correctly RED (xfail) — untouched by this plan.
- No blockers. STATE.md / ROADMAP.md / REQUIREMENTS.md intentionally NOT modified (orchestrator owns shared-file updates after the wave merges).

## Self-Check: PASSED
- FOUND: backend/app/services/retrieval_service.py (modified @f77e35ca)
- FOUND: backend/app/services/tool_dispatcher.py (modified @52505ad2)
- FOUND: backend/tests/test_harness_whitelist.py (modified @52505ad2)
- FOUND: .planning/phases/098-.../098-05-SUMMARY.md
- FOUND commits: f77e35ca, 52505ad2

---
*Phase: 098-project-binding-server-side-kb-scope-governance*
*Completed: 2026-06-09*
