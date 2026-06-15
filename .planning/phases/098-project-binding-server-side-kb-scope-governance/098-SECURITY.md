---
phase: 098
slug: project-binding-server-side-kb-scope-governance
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-10
---

# Phase 098 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase goal: a workflow can be bound to a project (a folder + its subtree); its KB
> retrieval scope is resolved **server-side** from that binding at run start and the
> model cannot widen it.

Auditor: `gsd-security-auditor` (independent re-grep of live code, not a re-read of
VERIFICATION.md). Live corroboration: all 6 HUMAN-UAT scope/governance tests PASS
(cross-provider containment, multi-tool, parallel-thread, restart-path resolution,
`scope_violation` observability, D-13 whitelist refusal).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| stored definition → typed model | `workflow_definitions.definition` JSONB (authored / seeded) crosses into the strict Pydantic layer at `model_validate()`. Untrusted/typo'd keys must be rejected. | Workflow definition JSONB → `WorkflowDefinition` |
| authoring intent → bound scope field | A `folder_scope` is a *resolved id list* the engine binds, not a free-text prompt hint the model could widen. | Per-phase folder id list |
| client query param → SQL | `project_folder_id` arrives from the HTTP query string; it must filter, never widen, the user-scoped result set. | UUID query param → JSONB-path predicate |
| project binding → resolved subtree | `project_folder_id` is resolved to a concrete id list **server-side** from the owner's folder tree; the model never participates. | folder id → `list[str]` subtree |
| declared phase scope → validity | A per-phase `folder_scope` is untrusted authoring input; it must be proven ⊆ the project subtree before it can bound retrieval. | folder id list → validity verdict |
| service-role resume/Continue path → owner scope | Resume/Continue use the service-role client (RLS bypassed); the resolver's `user_id` (durable run owner) is the only thing keeping retrieval owner-scoped. | run owner id → owner-scoped fetch |
| run start → bound scope | At kickoff/resume/Continue the server resolves the allowed subtree from the binding before any retrieval; the model never supplies it. | binding → `folder_subtree_ids` |
| caller → another user's workflow | Kickoff must not let a caller start a workflow they cannot see (IDOR). | workflow id → ownership check |
| retrieved rows → result set | Rows returned from retrieval are asserted ⊆ the bound scope before they reach the model; an out-of-scope row (bug/future path) is clipped. | retrieval rows → clipped result set |
| shared search path → Deep vs workflow | `search_documents` / `_handle_search_documents` is dispatched by BOTH Deep and workflows; the new guard must be a no-op for Deep. | shared dispatch path |
| read phase → act/export | A read-untrusted-content phase must not be able to invoke act/export tools (per-phase whitelist). | phase tool whitelist |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-098-01 | Tampering / EoP (V4) | `_handle_search_documents` + per-phase narrowing | mitigate | Scope from `ctx.folder_subtree_ids` (server-bound); model args carry only `{query, metadata_filter}`; post-query ⊆ clip drops out-of-scope rows (`tool_dispatcher.py:171,179-193`); `phase_types.py:186-191` narrows from the bound list, not a prompt. Tests: `test_clip_and_emit`, `test_per_phase_narrowing`. | closed |
| T-098-02 | Information Disclosure (V4) | `resolve_project_subtree` / service-role resolver | mitigate | `fetch_visible_folders(supabase, user_id)` is owner-scoped (`scope.py:71`); callers pass the run owner id (`harness_engine.py:1164` `str(_user_id)`, `runs.py:912`, `threads.py:1228`). Cannot reach another user's folders. | closed |
| T-098-03 | EoP / IDOR (V4) | kickoff workflow fetch | mitigate | RLS-mirrored `.or_(is_global.eq.true,created_by.eq.{user})` + published check preserved (`threads.py:845,854`); a caller cannot start another user's private workflow. | closed |
| T-098-04 | Information Disclosure (V4) | resume + Continue ctx-build | mitigate | Both previously hard-coded `folder_subtree_ids=None` (whole-KB after restart). Now resolved from `definition.project_folder_id` (`harness_engine.py:1154-1170,1254`; `runs.py:908-918,955`). Tests: `test_resume_resolves_project_scope`, `test_resume_unbound_scope_stays_none`. | closed |
| T-098-05 | Tampering (self-feedback amplification) | output-side provenance fields | mitigate (shape only) | `provenance: Literal["source","derived"] = "source"` shape locked (`harness.py:159`); behavior deferred to Phase 100/101/102 (D-08). | closed |
| T-098-06 | Tampering / Input Validation (V5) | `WorkflowDefinition` parse | mitigate | `_StrictBase` `ConfigDict(extra="forbid")` (`harness.py:27-30`); new fields optional-with-default so old rows validate but unknown keys raise. Test: `test_old_rows_validate`. | closed |
| T-098-07 | EoP (V4) | `assert_folder_scopes_subset` + structural validator | mitigate | Structural `@model_validator` raises when `folder_scope` set with no `project_folder_id` (`harness.py:163-175`); DB-aware ⊆ validator raises on non-⊆ (`scope.py:83-116`); called at all 3 run-start sites (`threads.py:871`, `harness_engine.py:1161`, `runs.py:911`). Tests: `test_structural_scope_requires_project`, `test_narrow_only_reject`. | closed |
| T-098-08 | Tampering / regression (Deep RED LINE) | shared `search_documents` path | mitigate | Clip gated `if ctx.folder_subtree_ids is not None` (literal no-op when None) (`tool_dispatcher.py:179`) → Deep byte-identical. Test: `test_deep_noop`. | closed |
| T-098-09 | Information Disclosure (V4) | `list_published_workflows` filter | mitigate | `is_global = true OR created_by = $1` user-scope clause first + untouched; project filter AND-appended only when supplied (`db/workflows.py:157-164`). Tests: `test_list_published_workflows_project_filter`, `_no_filter_omits_predicate`. | closed |
| T-098-10 | Tampering / Injection (V5) | JSONB-path predicate | mitigate | Value bound as asyncpg positional `$N` via `str(project_folder_id)` (`db/workflows.py:162-163`); only the int placeholder index is f-string-built; FastAPI coerces the query param to `UUID` (`api/workflows.py:40`). | closed |
| T-098-11 | DoS / serialization fault | scope channel type | mitigate | Subtree returned as `list[str]`, never a `set` (`scope.py:73-80`); `ToolContext.folder_subtree_ids: list[str] \| None` (`tool_dispatcher.py:69`). A `set` would raise in supabase-py `json.dumps` on the RPC `p_folder_ids` channel (Pitfall 1). | closed |
| T-098-12 | Repudiation / observability (D-06) | `scope_violation` emit | mitigate | Clip observable via `ctx.emit` → XADD `run:{run_id}` (`tool_dispatcher.py:185-193`); run continues (clip-not-fail); best-effort emit; `scope_violation` NOT in `db/workflows.py::_AUDIT_EVENT_TYPES`. Test: `test_clip_and_emit`. | closed |
| T-098-13 | EoP (V4, D-13) | per-phase whitelist | mitigate | `dispatch_tool` whitelist gate preserved (`tool_dispatcher.py:1636`); a read-only phase that excludes an act/export tool refuses it; `phase_whitelist` still wired (`phase_types.py:210`). Test: `test_act_export_tool_excluded_from_read_only_phase`. | closed |
| WR-03 | Information Disclosure (within-owner) | fail-open scope resolution (3 ctx-build sites) | mitigate | **Fixed in this secure-phase.** A scope-resolution failure on a BOUND workflow is now OBSERVABLE: a `scope_resolution_failed` run-event is emitted at all three sites (`threads.py` kickoff, `harness_engine.py` resume, `runs.py` Continue). Kickoff **fails closed** for a bound workflow (emit + `raise` → clean `failed` terminal via the producer's outer handler) — the run has not started, so it refuses rather than silently widening to whole-KB. Resume/Continue stay fail-open (in-flight re-drives must not be stranded) but now emit the signal. Within-owner only regardless (RPC `match_user_id` blocks cross-user rows). | closed |
| IN-01 | DoS | `resolve_project_subtree._walk` | mitigate | **Fixed in this secure-phase.** Threaded a `seen: set[str]` visited guard through `_walk` (`scope.py:73-86`) so a self-parented / cyclic folder hierarchy resolves to a finite, de-duplicated subtree instead of `RecursionError`. The Deep copy (`agent_loop.py`) is the RED LINE and is intentionally left untouched. Test: `test_resolve_project_subtree_cycle_guard`. | closed |
| IN-02 | Information Disclosure / owner-scoping incompleteness | `resolve_project_subtree` root seeding | accept | `_walk(root)` seeds the root id without verifying root ∈ owner's visible set. Harmless in production: the RPC `match_user_id` filter yields 0 document rows for a foreign folder id, so a non-owned root in `folder_subtree_ids` cannot disclose another user's documents. See Accepted Risks Log. | closed |
| IN-03 | Deep red-line drift (additive, inert) | `retrieval_service._enrich_with_filenames` | accept | `folder_id` is added to every enriched row including Deep/unscoped mode, so the LLM-visible payload gains one key vs pre-098 Deep. Additive and inert — no Deep consumer reads it; citations/source_refs/return signature unchanged; behavior is identical. Not strictly byte-identical at the JSON-payload level. See Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-098-01 | IN-02 | Root-id seeding in `resolve_project_subtree._walk` is not self-contained owner-scoped, but the RPC `match_user_id` filter is an independent, always-present backstop: a foreign root id in `folder_subtree_ids` returns 0 document rows, so no cross-user disclosure is possible. Defense-in-depth only; not exploitable today. Re-open if the RPC owner filter is ever removed/weakened or the resolver output is consumed by a path that does not pass through `match_user_id`. | fhdmrd (operator), 2026-06-10 | 2026-06-10 |
| AR-098-02 | IN-03 | Deep `search_documents` payload gains an inert `folder_id` key vs pre-098. No Deep consumer reads it; citations, source_refs, and the return signature are unchanged; runtime behavior is identical. The cost of strict byte-identical parity (threading caller context into `_enrich_with_filenames` to strip the key on the unscoped path) is not justified by the (zero) behavioral impact. Re-open if a Deep consumer ever begins reading `folder_id` from the tool_result, or if a strict byte-identical-Deep contract is introduced. | fhdmrd (operator), 2026-06-10 | 2026-06-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-10 | 17 | 17 | 0 | gsd-security-auditor (verify) + orchestrator (WR-03 + IN-01 mitigations, IN-02 + IN-03 accepted) |

**This audit:** 13 planned threats verified CLOSED (independent re-grep + active green tests + 6/6 live UAT). 4 code-review findings dispositioned: WR-03 + IN-01 mitigated in code (additive, RED-LINE-safe; 81/81 tests pass incl. the new `test_resolve_project_subtree_cycle_guard`); IN-02 + IN-03 accepted as documented risks (RPC backstop / inert key).

**Files changed by this secure-phase (mitigations only — no behavior change to the success path except the deliberate WR-03 kickoff fail-closed for bound workflows):**
- `backend/app/services/harness/scope.py` — IN-01 cycle/visited guard in `_walk`
- `backend/app/api/threads.py` — WR-03 kickoff: emit + fail-closed (bound only)
- `backend/app/services/harness_engine.py` — WR-03 resume: emit on fail-open (bound only)
- `backend/app/api/runs.py` — WR-03 Continue: emit on fail-open (bound only)
- `backend/tests/test_098_scope_governance.py` — `test_resolve_project_subtree_cycle_guard` (IN-01 guard)

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-10
