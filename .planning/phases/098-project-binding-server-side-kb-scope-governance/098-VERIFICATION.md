---
phase: 098-project-binding-server-side-kb-scope-governance
verified: 2026-06-09T15:30:00Z
status: verified
reconciled: 2026-06-10
reconciled_by: "/gsd:verify-work 098 — human_needed resolved: 098-HUMAN-UAT.md complete 6/6 (all SC#10 live items) + /gsd:secure-phase 098 threats_open:0 (WR-03/IN-01 fixed, IN-02/IN-03 accepted)"
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run a bound workflow with each of the representative-4 providers (OpenAI, Anthropic, Google, OpenRouter). After the run completes, query Supabase to confirm every cited document_id resolves to a folder_id that is in the workflow's project folder subtree."
    expected: "Zero citations reference a document outside the project subtree. No spurious scope_violation events appear for in-scope retrievals."
    why_human: "Requires live provider API keys, a running stack, and actual KB documents scoped to a project folder. Cannot be verified from code inspection or offline tests."
  - test: "Run a bound workflow phase that invokes both search_documents and execute_code in the same prompt. Confirm the search_documents call is still scope-bound (KB results are from the project subtree) while execute_code is unaffected."
    expected: "Retrieval scope held on the multi-tool path; no scope_violation emitted for in-scope rows; execute_code succeeds normally."
    why_human: "SC#10 multi-tool axis — requires a live multi-tool agent run against a real KB folder."
  - test: "While Thread A is executing a bound workflow run (streaming), send a new prompt in Thread B. Confirm Thread B's unbound Deep run receives whole-KB search results and Thread A's bound run keeps its project-folder scope."
    expected: "No scope leakage between threads; Thread A folder_subtree_ids does not appear in Thread B's ToolContext."
    why_human: "SC#10 parallel-thread axis — requires two concurrent live runs across different threads."
  - test: "Run a bound workflow with a thread that has 50+ prior messages or a user prompt >= 5 KB. Confirm retrieval scope is still bound to the project subtree (not degraded to whole-KB)."
    expected: "folder_subtree_ids is non-null on the wf_ctx throughout a long-context run."
    why_human: "SC#10 long-message axis — requires a real large-context scenario with a live provider."
  - test: "Verify the scope_violation observability path by injecting (or simulating via a test fixture in a dev session) an out-of-scope row into a running workflow. Confirm the scope_violation event appears in the run log / timeline panel."
    expected: "The scope_violation event is visible in the run event stream with dropped count and out_of_scope_folders list."
    why_human: "The RPC p_folder_ids primary filter suppresses out-of-scope rows in a healthy live run (Pitfall 4), so the clip path is not naturally triggered in production. The automated test_clip_and_emit already verifies this via injection; the human check confirms the event surfaces in the actual UI run log."
  - test: "Run a workflow with a read-only phase whose whitelist excludes an act/export tool, then verify at the UI level that the tool is refused with the clean refusal message (not a crash or silent no-op)."
    expected: "A tool_refused event appears in the run timeline; the run continues to the next phase."
    why_human: "D-13 live enforcement — the automated test_act_export_tool_excluded_from_read_only_phase covers the refusal logic; the human check confirms the UX is non-broken (refusal message shown, run not aborted)."
---

# Phase 098: Project Binding & Server-Side KB Scope Governance Verification Report

**Phase Goal:** A workflow can be bound to a project (a folder + its subtree); its KB retrieval scope is resolved server-side from that binding at run start and the model cannot widen it.
**Verified:** 2026-06-09T15:30:00Z
**Status:** verified (reconciled 2026-06-10 — see below)
**Re-verification:** No — initial verification

> **Reconciliation (2026-06-10, `/gsd:verify-work 098`):** Status advanced from
> `human_needed` → `verified`. The 6 human-verification items below were all the
> SC#10 live-stack tests that code inspection could not cover. They are now
> **complete 6/6** in `098-HUMAN-UAT.md` (cross-provider containment, multi-tool,
> parallel-thread, long-message/restart-path, `scope_violation` observability,
> D-13 whitelist refusal — each with live DB/UI evidence). The advisory code-review
> findings (WR-03, IN-01/02/03) were dispositioned by `/gsd:secure-phase 098`:
> WR-03 + IN-01 fixed in code, IN-02 + IN-03 accepted (`098-SECURITY.md`,
> `threats_open: 0`). No gaps remain.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | A workflow can carry an optional `project_folder_id`; old unbound workflows still validate and run unchanged (zero-migration, additive). The Workflows library can be filtered to a project folder. | ✓ VERIFIED | `harness.py:155` — `project_folder_id: UUID | None = None`. `db/workflows.py:131` — `list_published_workflows` accepts `project_folder_id` optional kwarg. `api/workflows.py:40` — `project_folder_id: UUID | None = Query(None)`. `test_old_rows_validate` passes (migration 061 blobs validate with all new fields defaulting). `test_list_published_workflows_project_filter` + `test_list_published_workflows_no_filter_omits_predicate` pass. No new SQL migration file exists under `supabase/migrations/`. |
| 2 | A bound workflow's retrieval defaults to its project-folder subtree; an optional per-phase `folder_scope` narrows retrieval for that phase — scope comes from the binding, not a prompt hint. | ✓ VERIFIED | `harness.py:52,67,84` — `folder_scope: list[UUID] | None = None` on all three retrieval-family configs. `phase_types.py:186-200` — `_build_phase_tool_context` computes `_effective` as a narrow-only ∩ of the project subtree and the phase `folder_scope`, passed to `folder_subtree_ids`. The list type is preserved (Pitfall 1). `test_per_phase_narrowing` passes (all three cases: narrowing, passthrough when `folder_scope=None`, no-op when subtree is `None`). |
| 3 | Retrieval scope is resolved server-side from the user's RLS context at run start and bound to every retrieval call as a parameter the model cannot override; retrieved `folder_id`s are asserted ⊆ scope (RLS as backstop). | ✓ VERIFIED | **Site 1 (kickoff):** `threads.py:46` imports `resolve_project_subtree, assert_folder_scopes_subset`; `:871` calls `assert_folder_scopes_subset` after kickoff parse (raises 400 on non-⊆); `:1227` resolves scope from `_kickoff_definition.project_folder_id` for bound workflows, falls back to thread folder for unbound (SC#1 preserved). Inline `_wf_get_subtree` removed. **Site 2 (resume):** `harness_engine.py:1145-1170` lazy-imports both helpers; resolves `_resume_folder_subtree_ids` from `definition.project_folder_id`, owner-scoped via `run["user_id"]`; `:1254` assigns it to the resumed wf_ctx. No longer hard-codes `None`. **Site 3 (Continue):** `runs.py:809-918` lazy-imports both helpers via aliases; pre-resolves `_cont_subtree` before the async closure; `:955` assigns `folder_subtree_ids=_cont_subtree`. `test_run_start_resolution` passes (active green guard, xfail removed per WR-01 resolution). `test_resume_resolves_project_scope` + `test_resume_unbound_scope_stays_none` pass. |
| 4 | A model attempt to retrieve outside its bound scope is rejected/clipped to scope and observable in the run log. | ✓ VERIFIED | `retrieval_service.py:119,135` — `_enrich_with_filenames` selects and includes `folder_id` in each enriched row. `tool_dispatcher.py:179-193` — `_handle_search_documents` has the `if ctx.folder_subtree_ids is not None` gate; partitions `_kept` / `_dropped`; clips `results = _kept`; emits `scope_violation` to `run:{run_id}` via `ctx.emit`; best-effort try/except. Deep path (None) skips entirely. `test_clip_and_emit` passes (active green guard, xfail removed). `test_deep_noop` passes. `scope_violation` does NOT appear in `db/workflows.py::_AUDIT_EVENT_TYPES` (confirmed by grep). |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | Additive-optional schema lock fields + structural `@model_validator` + co-locked `InputFieldSpec`/`AssetRef` | ✓ VERIFIED | Contains `project_folder_id`, `output_target_folder`, `reingest_output`, `version_policy`, `provenance`, `inputs`, `assets` on `WorkflowDefinition`; `folder_scope: list[UUID] | None = None` on all three retrieval configs; `@model_validator(mode="after")` with message `folder_scope but the workflow has no`; `InputFieldSpec` and `AssetRef` classes present. `from uuid import UUID` and `model_validator` imported. |
| `backend/app/services/harness/scope.py` | Shared scope resolver + DB-aware narrow-only ⊆ validator | ✓ VERIFIED | Exports `resolve_project_subtree` (returns `list[str] | None`, calls `fetch_visible_folders`) and `assert_folder_scopes_subset` (raises `ValueError` with `is not a subset of the project subtree`). Returns list not set. |
| `backend/app/db/workflows.py` | Optional `project_folder_id` JSONB-path filter on `list_published_workflows` | ✓ VERIFIED | Signature includes `project_folder_id: UUID | None = None`; body contains `definition->>'project_folder_id'`; user-scope clause `is_global = true OR created_by = $1` preserved. |
| `backend/app/api/workflows.py` | `project_folder_id` query param on `GET /workflows/published` | ✓ VERIFIED | `project_folder_id: UUID | None = Query(None)` in route signature; passed to `list_published_workflows`. |
| `backend/app/services/harness/phase_types.py` | Per-phase `folder_scope` ∩ at `_build_phase_tool_context` | ✓ VERIFIED | `_proj` / `_phase_scope` / `_effective` narrowing logic present; `folder_subtree_ids=_effective` passed to `ToolContext`; `phase_whitelist=frozenset(phase.config.available_tools)` still present (D-13 no regression). |
| `backend/app/api/threads.py` | Kickoff site 1 sources scope from binding | ✓ VERIFIED | `resolve_project_subtree` and `assert_folder_scopes_subset` imported at top-level (:46). `assert_folder_scopes_subset` called at :871 (raises 400 on `ValueError`). `resolve_project_subtree` called at :1227. Inline `_wf_get_subtree` removed (grep returns 0 hits). |
| `backend/app/services/harness_engine.py` | Resume site 2 resolves project subtree | ✓ VERIFIED | `:1145-1170` — lazy import, resolves `_resume_folder_subtree_ids` from `definition.project_folder_id`, passes `user_id=str(_user_id)` (owner-scoped). `:1254` — `folder_subtree_ids=_resume_folder_subtree_ids` (no longer hard-coded `None`). |
| `backend/app/api/runs.py` | Continue site 3 resolves project subtree | ✓ VERIFIED | `:809-918` — aliased lazy imports; pre-resolves `_cont_subtree`; `:955` — `folder_subtree_ids=_cont_subtree`. |
| `backend/app/services/retrieval_service.py` | `folder_id` on enriched retrieval dict | ✓ VERIFIED | `.select("id, filename, metadata, version_number, folder_id")` at :119; `entry["folder_id"] = doc.get("folder_id")` at :135. Return shape `tuple[list[dict], float]` unchanged. |
| `backend/app/services/tool_dispatcher.py` | Gated ⊆ clip + `scope_violation` emit in `_handle_search_documents`; `ToolContext.folder_subtree_ids` annotated `list[str] | None` | ✓ VERIFIED | `ToolContext.folder_subtree_ids: list[str] | None` at :69 (WR-02 resolved). `if ctx.folder_subtree_ids is not None` gate at :179. `scope_violation` emit at :186-192. `dispatch_tool` whitelist gate `if ctx.phase_whitelist is not None` still present. |
| `backend/tests/test_098_schema_lock.py` | Old-row validate + new-field round-trip + structural reject | ✓ VERIFIED | 3 tests present and passing. |
| `backend/tests/test_098_scope_governance.py` | Full governance test suite — all 5 tests active (no xfail) | ✓ VERIFIED | All 5 tests pass as active green guards. `xfail` decorators removed (WR-01 resolved). |
| `backend/tests/test_harness_resume.py` | Resume scope resolution test | ✓ VERIFIED | `test_resume_resolves_project_scope` and `test_resume_unbound_scope_stays_none` present and passing. |
| `backend/tests/test_thread_workflow_endpoint.py` | JSONB filter tests | ✓ VERIFIED | `test_list_published_workflows_project_filter` and `test_list_published_workflows_no_filter_omits_predicate` present and passing. |
| `backend/tests/test_harness_whitelist.py` | D-13 act/export separability test | ✓ VERIFIED | `test_act_export_tool_excluded_from_read_only_phase` present and passing. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WorkflowDefinition.@model_validator` | `phase.config.folder_scope` / `self.project_folder_id` | structural narrow-only guard | ✓ WIRED | `harness.py:163-175` — raises `ValueError` when `folder_scope` set on a phase but `project_folder_id is None`. |
| `api/workflows.py:get_published_workflows` | `db/workflows.py:list_published_workflows` | `project_folder_id=project_folder_id` kwarg | ✓ WIRED | Route passes the query param to the DB function; confirmed at :60-64. |
| `db/workflows.py:list_published_workflows` | `definition->>'project_folder_id'` | JSONB-path predicate with positional `$N` | ✓ WIRED | SQL string built at :163; value bound as `str(project_folder_id)` — TEXT bind, not UUID serialization. |
| `threads.py kickoff` | `scope.resolve_project_subtree` + `assert_folder_scopes_subset` | `_kickoff_definition.project_folder_id` | ✓ WIRED | Import at :46; `assert` at :871; `resolve` at :1227 with `_kickoff_definition.project_folder_id` as the source. |
| `harness_engine.py:_build_resume_context` | `scope.resolve_project_subtree` | `run["user_id"]` owner-scoped | ✓ WIRED | Lazy import at :1145; `_resume_folder_subtree_ids` resolved at :1166; assigned at :1254. |
| `runs.py:_harness_continuation` | `scope.resolve_project_subtree` | `current_user["id"]` owner-scoped | ✓ WIRED | Lazy import at :809; `_cont_subtree` resolved at :914; assigned at :955. |
| `phase_types.py:_build_phase_tool_context` | `phase.config.folder_scope` | narrow-only ∩ via `_effective` | ✓ WIRED | `:186-191` — `getattr(phase.config, "folder_scope", None)` ∩ `getattr(ctx, "folder_subtree_ids", None)`; `folder_subtree_ids=_effective`. |
| `tool_dispatcher.py:_handle_search_documents` | `ctx.emit` (→ XADD `run:{run_id}`) | `scope_violation` event kind | ✓ WIRED | `:186-192` — `await ctx.emit(ctx.redis, ctx.run_id, "scope_violation", ...)` inside `if _dropped`. |
| `retrieval_service.py:_enrich_with_filenames` | `tool_dispatcher.py:_handle_search_documents` | `folder_id` key in each enriched row | ✓ WIRED | `:135` adds `folder_id`; `tool_dispatcher:181-182` reads `.get("folder_id")` for clip. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `scope.py:resolve_project_subtree` | `list[str]` subtree | `fetch_visible_folders(supabase, user_id)` — live DB | Yes — calls async function returning real folder rows | ✓ FLOWING |
| `tool_dispatcher.py:_handle_search_documents` | `results` (retrieved rows) | `search_documents(...)` — real RPC call with `folder_ids=ctx.folder_subtree_ids` | Yes — RPC with `p_folder_ids` parameter from server-resolved scope | ✓ FLOWING |
| `db/workflows.py:list_published_workflows` | workflow rows | asyncpg `pool.fetch(sql, *params)` — real DB | Yes — JSONB predicate on real `workflow_definitions` table | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Schema imports cleanly | `python -c "from app.models.harness import WorkflowDefinition, InputFieldSpec, AssetRef; print('ok')"` | ok | ✓ PASS |
| Scope module imports cleanly | `python -c "from app.services.harness.scope import resolve_project_subtree, assert_folder_scopes_subset; print('ok')"` | ok | ✓ PASS |
| All 5 governance tests pass as active guards | `pytest tests/test_098_scope_governance.py -v` | 5 passed, 0 xfail | ✓ PASS |
| All schema-lock tests pass | `pytest tests/test_098_schema_lock.py -x` | 3 passed | ✓ PASS |
| Full integration suite (80 tests) | `pytest tests/test_098_scope_governance.py tests/test_098_schema_lock.py tests/test_thread_workflow_endpoint.py tests/test_harness_resume.py tests/test_harness_whitelist.py tests/test_harness_engine.py` | 80 passed | ✓ PASS |
| Pre-existing failure is pre-existing | `pytest tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` | 1 failed (KeyError 'tool_call_id' in `_expire_pending_ask_user` — pre-existing, reproduced at base commit) | ✓ CONFIRMED PRE-EXISTING — not attributable to phase 098 |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PROJ-01 | Plans 01, 02 | Workflow can be bound to a project folder via optional `project_folder_id`; library filterable; old workflows unchanged | ✓ SATISFIED | `project_folder_id` field on `WorkflowDefinition`; JSONB-path filter on `list_published_workflows`; query param on API; old-row test passes |
| PROJ-02 | Plans 01, 03 | Bound workflow's KB retrieval defaults to project subtree; per-phase `folder_scope` narrows; scope comes from binding not prompt | ✓ SATISFIED | `folder_scope` on retrieval-family configs; `_build_phase_tool_context` narrowing logic; `resolve_project_subtree` wired at all three ctx-build sites |
| GOV-01 | Plans 03, 04, 05 | Retrieval scope resolved server-side from RLS context; bound to every retrieval call; model cannot widen; `folder_id`s asserted ⊆ scope; clip + observable | ✓ SATISFIED | `scope.py` resolver + DB-aware validator; three run-start sites wired; `folder_id` on enriched rows; gated clip + `scope_violation` XADD; all tests green |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `threads.py:1246-1252`, `harness_engine.py:1171-1176`, `runs.py:919-924` | — | `except Exception` fall-open for scope resolution in all three ctx-build sites: a transient DB failure silently degrades a bound workflow to whole-KB (`folder_subtree_ids=None`) with no `scope_violation` event and no user-visible signal (only a logged exception) | ⚠️ Warning (WR-03 from code review) | Within-owner only (RPC `match_user_id` still prevents cross-user leaks). Deliberate "never block the run" design tradeoff — NOT a crash bug. Recommended fix: emit a `scope_resolution_failed` run-event on degradation so the fallback is observable. Route to a future secure-phase. |
| `scope.py:73-80` | 73 | `_walk` has no cycle/visited guard — a self-parented or cyclic folder hierarchy → `RecursionError` | ℹ️ Info (IN-01) | UI normally prevents cycles. Low-severity data-integrity risk. Fix: thread a `seen: set[str]` through `_walk`. |
| `scope.py:73-80` | 73 | Root id seeded unconditionally in `_walk(root)` without verifying root ∈ owner's visible set | ℹ️ Info (IN-02) | Harmless today (RPC `match_user_id` yields 0 rows for a foreign folder). Self-contained owner-scoping guarantee is incomplete. |
| `retrieval_service.py:133-135` | 135 | `folder_id` added to every enriched row unconditionally, including Deep/unscoped mode — the LLM-visible payload gains a new key vs pre-098 Deep output | ℹ️ Info (IN-03) | Additive and inert (no Deep consumer reads it; citations/source_refs unaffected). Not strictly byte-identical to pre-098 Deep. Fix (if strict parity matters): strip on unscoped path. |

---

## VALIDATION.md / SC#10 Assessment

`098-VALIDATION.md` exists and explicitly authors cross-provider × multi-tool × parallel-thread × long-message rows in its "Manual-Only Verifications" section:

- **Cross-provider (4 rows):** OpenAI, Anthropic, Google, OpenRouter — in-run retrieval stays inside the project subtree per provider.
- **Multi-tool (≥1 row):** One bound phase prompts `search_documents` + second tool (`execute_code`).
- **Parallel-thread (≥1 row):** Thread A bound workflow + Thread B new prompt — scope isolation holds.
- **Long-message (≥1 row per provider):** ≥50 prior messages OR ≥5 KB user prompt with bound scope.
- **`scope_violation` observability** and **act/export whitelist** rows are also authored.

SC#10 mandate is satisfied at the documentation/planning level. Execution of these rows requires a live stack and is surfaced as human_verification items above. The automated backstops (`test_clip_and_emit`, `test_deep_noop`, `test_act_export_tool_excluded_from_read_only_phase`) cover the code paths; the live UAT rows cover the end-to-end provider behavior.

---

## Human Verification Required

### 1. Cross-provider in-run scope containment (SC#10 — representative-4)

**Test:** Run a bound workflow once each with OpenAI, Anthropic, Google, and OpenRouter as the model provider. The workflow should have at least one `llm_agent` phase with `search_documents` in its tool list.
**Expected:** After each run, query Supabase: `SELECT d.folder_id FROM runs r JOIN citations c ON c.run_id = r.run_id JOIN documents d ON d.id = c.document_id WHERE r.run_id = '<run_id>'`. All `folder_id` values should be within the project's folder subtree.
**Why human:** Requires live provider keys, running backend, and KB documents scoped to a test project folder.

### 2. Multi-tool scope holds (SC#10)

**Test:** Run a bound workflow phase that invokes `search_documents` followed by `execute_code` in the same agent turn.
**Expected:** Search results are bounded to the project subtree; execute_code runs normally without scope interference; no spurious `scope_violation` events.
**Why human:** SC#10 multi-tool axis — requires a live multi-tool agent run.

### 3. Parallel-thread scope isolation (SC#10)

**Test:** While Thread A is executing a bound workflow, open Thread B and send an unbound Deep-mode prompt that also triggers a knowledge base search.
**Expected:** Thread A's scope (`folder_subtree_ids` = project subtree) does not bleed into Thread B's context. Thread B retrieves from the whole KB normally.
**Why human:** SC#10 parallel-thread axis — requires two concurrent live threads in the running application.

### 4. Long-message scope persistence (SC#10)

**Test:** In a thread with 50+ prior messages (or a single prompt >= 5 KB), run a bound workflow.
**Expected:** The workflow's `folder_subtree_ids` is correctly resolved and non-null on the wf_ctx (not silently degraded by the exception fallback). Retrieval remains scoped.
**Why human:** SC#10 long-message axis — requires a real large-context scenario.

### 5. scope_violation observability (SC#4)

**Test:** Simulate or force an out-of-scope retrieval row (easiest via a dev-mode test fixture that bypasses the RPC filter) and confirm the `scope_violation` event appears in the run log/timeline panel in the UI.
**Expected:** The event surfaces as an observable entry in the run event stream. The run continues (clip-not-fail).
**Why human:** The RPC `p_folder_ids` primary filter suppresses out-of-scope rows in a healthy live run, so the clip is not naturally triggered (Pitfall 4). The automated `test_clip_and_emit` already covers the code path; this confirms the UX.

### 6. D-13 act/export whitelist refusal UX

**Test:** Set up a workflow with a read-only phase whose `available_tools` excludes an act/export tool. In the live UI, attempt to invoke that tool.
**Expected:** A `tool_refused` entry appears in the run timeline; the run continues to the next phase without crashing.
**Why human:** D-13 live UX enforcement — automated test covers the refusal logic; human check confirms the non-crash UX.

---

## Gaps Summary

No automated gaps. All 4 must-haves are verified. The advisory code-review findings (WR-03, IN-01, IN-02, IN-03) were dispositioned by `/gsd:secure-phase 098` (2026-06-10) — all CLOSED:
- WR-03: ✓ MITIGATED — fail-open scope resolution now emits a `scope_resolution_failed` run-event at all 3 run-start sites; kickoff fails closed for bound workflows (`098-SECURITY.md`)
- IN-01: ✓ MITIGATED — cycle/visited guard added to `scope._walk` + `test_resolve_project_subtree_cycle_guard`
- IN-02: ✓ ACCEPTED (AR-098-01) — RPC `match_user_id` is the independent backstop
- IN-03: ✓ ACCEPTED (AR-098-02) — additive-and-inert Deep output key, behavior identical

None of these were goal-blocking. The phase goal — a workflow can be bound to a project folder, scope resolved server-side, model cannot widen it — is achieved in the codebase and confirmed live.

Status advanced to `verified` (2026-06-10): the SC#10 live cross-provider × multi-tool × parallel-thread × long-message UAT rows that could not be auto-verified from code are now complete 6/6 in `098-HUMAN-UAT.md`, and the security gate is satisfied (`threats_open: 0`).

---

_Verified: 2026-06-09T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
