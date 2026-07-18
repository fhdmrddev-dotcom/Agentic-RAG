---
phase: 152
slug: workflow-run-inputs
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-15
---

# Phase 152 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified by grep/read against the implemented code — documentation/intent is NOT accepted as evidence.
> Consolidated from the 8 plan `<threat_model>` blocks (152-01..152-08). Implementation files were READ-ONLY throughout.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → threads.py kickoff | `MessageCreate.folder_id` is untrusted client input entering the run-launch path | per-run KB folder override (UUID) |
| threads.py / harness_engine.py / runs.py → retrieval | the resolved `folder_subtree_ids` binds the retrieval scope the model runs under (kickoff, resume, Continue) | folder-id list (scope root → subtree) |
| model → tool_dispatcher search_documents | the LLM issues `search_documents(query)`; scope is server-bound onto `ctx.folder_subtree_ids`, not model-supplied | query string only |
| browser → workspace upload | the picked template file is untrusted bytes uploaded to the launched (owned) thread | file bytes (OOXML/text/image) |
| client → api/workflows.py delete cascade | `definition_id` is untrusted; the cascade runs as service role (RLS bypassed) — the app-layer owner WHERE is the ONLY authz boundary | workflow id, cascade counts |
| cascade route → live engine tasks | the cancel loop must reach the producer task registry (RUN_TASKS) across WORKER_COUNT=2 | producer runs.run_id |
| cascade route → other users' runs | an `is_global` definition's runs are owned by RUNNERS, not the definition owner | cross-user run rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-152-01-01 | InfoDisc / EoP | resolve_run_scope_root / threads.py kickoff | mitigate | D-05 owner-reachability gate `str(override) in fetch_visible_folders(owner)` drops a never-owned override — `backend/app/services/harness/scope.py:159-161`; kickoff persists + resolves via helper — `backend/app/api/threads.py:1353,1543-1548` | closed |
| T-152-01-02 | Tampering | tool_dispatcher search_documents scope bind | mitigate | Scope bound server-side onto `ctx.folder_subtree_ids`; model supplies only `query`; post-query `scope_violation` clip backstop — `backend/app/services/tool_dispatcher.py:686,694-708` | closed |
| T-152-01-03 | Tampering / Integrity | resume + Continue scope re-derivation | mitigate | Override read from durable `workflow_runs.inputs` at all 3 sites: kickoff persist `threads.py:1353`; resume `harness_engine.py:1487,1547-1553`; Continue `runs.py:871,931-937` | closed |
| T-152-01-04 | DoS (silent no-retrieval) | phase_types per-phase folder_scope intersection | mitigate | A4 composition guard drops an override whose subtree misses any declared phase folder_scope — `backend/app/services/harness/scope.py:179-192` | closed |
| T-152-01-05 | Tampering (SQLi) | folder_id binding | mitigate | `folder_id: UUID \| None` on MessageCreate (422 on malformed) — `backend/app/models/message.py:24`; downstream binds `$N` / never f-string | closed |
| T-152-01-SC | Tampering (supply chain) | dependency installs | accept | No packages installed (see Accepted Risks RISK-01) | closed |
| T-152-02-01 | EoP (IDOR) | cascade DELETE route + db helper | mitigate | `_owned_slug_or_404` owner-gate `WHERE id=$1 AND created_by=$2` → 404 no leak — `backend/app/api/workflows.py:437-444`; db helper `WHERE slug=$1 AND created_by=$2` — `backend/app/db/workflows.py:465` | closed |
| T-152-02-02 | Availability | delete of a live run | mitigate | Cancel-first loop precedes the DB delete — `backend/app/api/workflows.py:548-575` (cancel), `:575` (delete) | closed |
| T-152-02-03 | Integrity (orphans) | FK cascade order | mitigate | `DELETE workflow_runs` (RESTRICT blocker) FIRST then `DELETE workflow_definitions`, one txn — `backend/app/db/workflows.py:474-481`; phases auto-cascade, thread anchors auto-SET-NULL | closed |
| T-152-02-04 | Tampering (SQLi) | slug / version_ids binding | mitigate | `$N` / `ANY($1::uuid[])` only, no f-string on user values — `backend/app/db/workflows.py:465,475,479` | closed |
| T-152-02-05 | InfoDisc | delete-preview counts | mitigate | Preview owner-gated (`_owned_slug_or_404` + `found`) → 404 on non-owner/unknown — `backend/app/api/workflows.py:452-467` | closed |
| T-152-02-SC | Tampering (supply chain) | dependency installs | accept | No packages installed (see Accepted Risks RISK-02) | closed |
| T-152-03-01 | Tampering / EoP (SSTI) | template upload → fill path | mitigate | Upload stamps `kind="template_input"` — `backend/app/api/workspace.py:267`; `resolve_template_source` Branch 2 (untrusted) routes to run_replace, NEVER docxtpl/Jinja — `backend/app/services/template_asset_service.py:182` | closed |
| T-152-03-02 | EoP | upload target thread | mitigate | doRun uploads to fresh `createThread()`'d owned thread — `frontend/src/components/layout/ChatLayout.tsx:137-149`; `upload_template` `_verify_thread_ownership` 404s non-owner — `backend/app/api/workspace.py:237` | closed |
| T-152-03-03 | DoS / Tampering | file bytes | mitigate | `validate_upload` 10MB cap pre-buffer + post-read, magic-byte gate, office-bomb guard, 422 verbatim — `backend/app/api/workspace.py:197,241-248` | closed |
| T-152-03-04 | InfoDisc | scope `<select>` | mitigate | Client only proposes `folder_id`; server owner-gate + subtree resolver (T-152-01-01) is the wall; UI additionally offers only owner-reachable/⊆-project folders — `frontend/src/pages/WorkflowsPage.tsx:1032-1063` | closed |
| T-152-03-SC | Tampering (supply chain) | dependency installs | accept | No packages installed (native `<select>` + vendored primitives) (see Accepted Risks RISK-03) | closed |
| T-152-04-01 | EoP (IDOR) | delete cascade client | mitigate | UI merely calls the route; backend owner app-gate (T-152-02-01) 404s non-owner — `frontend/src/lib/api.ts:3287-3296` | closed |
| T-152-04-02 | InfoDisc / Integrity | victim-naming counts | mitigate | Counts from `GET /delete-preview` (server truth) fetched before commit, never fabricated — `frontend/src/pages/WorkflowsPage.tsx:684` | closed |
| T-152-04-03 | Repudiation / Tampering | irreversibility signalling | mitigate | In-place lifecycle, no optimistic vanish, no undo (card leaves via server re-fetch `onDeleted`), audit-receipt footer — `frontend/src/pages/WorkflowsPage.tsx:691-702,900` | closed |
| T-152-04-04 | Availability | in-flight run | mitigate | Amber cancel-first banner gated on real `preview.in_flight > 0` — `frontend/src/pages/WorkflowsPage.tsx:835-845` | closed |
| T-152-04-SC | Tampering (supply chain) | dependency installs | accept | No packages installed (dropdown-menu/sheet vendored) (see Accepted Risks RISK-04) | closed |
| T-152-05-01 | Tampering / EoP | delete_workflow_cascade on is_global | mitigate | `count_foreign_runs_on_global` → 409 refuse when other users' runs exist, before any side effect — `backend/app/api/workflows.py:516-524`; helper `is_global=true AND user_id<>$2` — `backend/app/db/workflows.py:551-585` | closed |
| T-152-05-02 | InfoDisclosure | preview counts aggregate cross-user on is_global | accept (documented) | Docstring corrected to state cross-user run aggregation honestly; destructive path fail-closed by T-152-05-01; read counts owner-definition-scoped, low-sensitivity — `backend/app/db/workflows.py:493-510` (see Accepted Risks RISK-05) | closed |
| T-152-05-03 | Tampering (integrity) | delete-out-from-under live engine (CR-01) | mitigate | Cancel via producer `runs.run_id` (LEFT JOIN `r.status='streaming'`), `publish_cancel_sentinel(wf_id)`, `finish_run(wf_id,"cancelled")` before delete txn — `backend/app/api/workflows.py:542,559,567,572` | closed |
| T-152-05-04 | Tampering (TOCTOU) | run starts between cancel loop and delete txn | accept (residual) | Narrow window; durable `finish_run` + SET NULL FK + cancel-first minimize it (see Accepted Risks RISK-06) | closed |
| T-152-05-05 | Tampering (SQLi) | _owned_slug_or_404 service-role seam | mitigate | `$N` / `ANY($1::uuid[])` binding only; foreign id → 404 — `backend/app/api/workflows.py:437-444`; `backend/app/db/workflows.py:571-584` | closed |
| T-152-05-SC | Tampering (supply chain) | dependency installs | mitigate (no-op) | No new packages this plan (SUMMARY tech-stack.added: []) | closed |
| T-152-06-01 | Tampering / InfoDisc | in-subtree override empties phase retrieval (WR-03) | mitigate | A4 branch resolves the OVERRIDE's own subtree and drops it unless every phase folder_scope intersects — `backend/app/services/harness/scope.py:179-192` | closed |
| T-152-06-02 | EoP | untrusted client folder_id widening scope | mitigate (already shipped) | D-05 owner-reachability gate UNCHANGED — `backend/app/services/harness/scope.py:159-161` | closed |
| T-152-06-SC | Tampering (supply chain) | dependency installs | mitigate (no-op) | No new packages this plan (SUMMARY tech-stack.added: []) | closed |
| T-152-07-01 | Repudiation (UX honesty) | dishonest "All documents" label (WR-05) | mitigate | Truthful `""` label: bound → "Workflow default"/"— 📁 {folder}", unbound → "All documents" — `frontend/src/pages/WorkflowsPage.tsx:1164-1168`; server still enforces scope | closed |
| T-152-07-02 | InfoDisc (empty retrieval) | override option that empties declared phase (WR-03 mirror) | mitigate | overrideOptions drops candidates failing every-phase intersection — `frontend/src/pages/WorkflowsPage.tsx:1059-1062`; backend A4 (T-152-06-01) authoritative | closed |
| T-152-07-03 | DoS (resource leak) | orphan thread accrual per failed launch (WR-04) | mitigate | try/catch best-effort `deleteLaunchThread(thread.id)` (aliased raw api client, `:41`) then re-throw — `frontend/src/components/layout/ChatLayout.tsx:155-158` | closed |
| T-152-07-SC | Tampering (supply chain) | dependency installs | mitigate (no-op) | No new packages this plan (SUMMARY tech-stack.added: []) | closed |
| T-152-08-01 | InfoDisclosure | resolve_run_scope_root A4 branch (scope.py) | mitigate | Author-project-subtree containment restored: `resolve_project_subtree(author_root)` + drop when `override not in project_subtree`, BEFORE the per-phase loop — `backend/app/services/harness/scope.py:173-177` (loop `:179-192`); closes ancestor/sibling widen | closed |
| T-152-08-02 | Tampering | client run_inputs["folder_id"] | mitigate | D-05 owner-reachability gate KEPT unchanged (`:159-161`) with A4 containment added on top (`:173-177`) — `backend/app/services/harness/scope.py` | closed |
| T-152-08-03 | InfoDisc (UI vector) | WorkflowsPage overrideOptions `<select>` | mitigate | Client mirror: `subtreeOf(authorDefaultFolderId)` containment before per-phase filter — `frontend/src/pages/WorkflowsPage.tsx:1052-1055` | closed |
| T-152-08-SC | Tampering (supply chain) | pip/npm installs | accept | No package installs (see Accepted Risks RISK-07) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Verification note (critical focus — D-04 widen regression):** `resolve_run_scope_root`'s A4 branch was read in full. The CURRENT code contains BOTH load-bearing conditions in the correct order: (1) the D-05 owner-reachability gate against `fetch_visible_folders` (scope.py:159-161), and (2) the restored author-project-subtree containment `if override not in project_subtree: override = None` using `resolve_project_subtree(author_root)` (scope.py:173-177), which executes BEFORE the per-phase `folder_scope` intersection loop (scope.py:179-192). This confirms the check 152-06's WR-03 fix had dropped is back (152-08). The frontend mirror applies `subtreeOf(authorDefaultFolderId)` containment before the per-phase filter (WorkflowsPage.tsx:1052-1055). Cross-checked against 152-REVIEW.md (0 critical / 0 warning / 1 info).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| RISK-01 | T-152-01-SC | Plan 01 installs NO packages (RESEARCH Package Legitimacy Audit = no-op; SUMMARY tech-stack.added: []). No supply-chain surface. | gsd-security-auditor | 2026-07-15 |
| RISK-02 | T-152-02-SC | Plan 02 installs NO packages (SUMMARY tech-stack.added: []). No supply-chain surface. | gsd-security-auditor | 2026-07-15 |
| RISK-03 | T-152-03-SC | Plan 03 installs NO packages — native `<select>` + already-vendored dropdown-menu/sheet/select (UI-SPEC Registry Safety). No supply-chain surface. | gsd-security-auditor | 2026-07-15 |
| RISK-04 | T-152-04-SC | Plan 04 installs NO packages — dropdown-menu + sheet already vendored. No supply-chain surface. | gsd-security-auditor | 2026-07-15 |
| RISK-05 | T-152-05-02 | delete-preview `runs`/`threads`/`in_flight` counts aggregate cross-user for an `is_global` definition (workflow_runs.user_id is the runner). Read-only, low-sensitivity, owner-definition-scoped; the DESTRUCTIVE path is fail-closed by the T-152-05-01 409 guard. Docstring corrected to state the aggregation honestly (db/workflows.py:493-510). | gsd-security-auditor | 2026-07-15 |
| RISK-06 | T-152-05-04 | TOCTOU: a run could start between the cancel loop and the delete txn (no shared transaction). Narrow window; durable `finish_run` + SET NULL FK + cancel-first minimize it. Matches 152-REVIEW residual (non-blocking); boot-time reconciler is the backstop. | gsd-security-auditor | 2026-07-15 |
| RISK-07 | T-152-08-SC | Plan 08 (gap closure) installs NO packages — existing pytest/vitest toolchain reused. No supply-chain surface. | gsd-security-auditor | 2026-07-15 |

*Accepted risks do not resurface in future audit runs.*

**Deferred (out-of-scope, non-blocking — recorded in 152-REVIEW.md / 152-08-PLAN `<deferred_out_of_scope>`; NOT part of this phase's threat register):**
- **WR-01 (TOCTOU race):** `count_foreign_runs_on_global` 409 guard is not atomic with the cancel/cascade. Narrow window (same class as RISK-06). Fold at operator discretion in a workflows.py hardening pass.
- **WR-02 (`cap_paused` producer):** the cancel-first `LEFT JOIN runs r ... r.status='streaming'` misses a `cap_paused` producer's runs row; the `workflow_runs` row is still terminalized via `finish_run`, so the delete is not corrupted. Relies on the boot-time reconciler. Non-blocking.
- **IN-01 (152-REVIEW info):** frontend/backend disagree on the structurally-unreachable "unbound + per-phase folder_scope" shape (`WorkflowDefinition._folder_scope_requires_project` rejects it at model_validate). Latent robustness note, not a live defect — backend is strictly more conservative (drops all overrides).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-15 | 39 | 39 | 0 | gsd-security-auditor |

**Method:** each `mitigate` threat verified by grep/read at its cited file location (implementation files READ-ONLY). Each `accept` threat documented in the Accepted Risks Log. Threat Flags sections of all 8 plan SUMMARY files reviewed — every one reports no new un-modeled surface ("None new" / "None beyond the plan's `<threat_model>`"). No unregistered flags. No implementation files modified.

**Unregistered flags:** none.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (7 entries)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-15
