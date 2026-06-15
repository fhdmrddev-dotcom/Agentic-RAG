---
phase: 103
slug: workflows-page-authoring-api-nl-authoring
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-14
---

# Phase 103 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Workflows page + authoring API + NL workflow authoring (the Workflow Studio).

State B run (no prior SECURITY.md): register built from the six PLAN `<threat_model>`
blocks + SUMMARY Threat-Surface sections, then **verified against the shipped HEAD
code** (not plan-time intent) by the gsd-security-auditor and independently
hand-spot-checked by the orchestrator. The Phase 102 lesson — *static / plan-time
"mitigated" can false-green* — was applied: every `mitigate` was grepped/read to a
`file:line`, and the four highest-stakes controls were read in full.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → POST/PATCH/DELETE `/workflows` | untrusted draft body + a `definition_id` a caller may not own | WorkflowDefinition JSONB, `definition_id` (UUID) |
| route → DB (service-role asyncpg) | the engine bypasses RLS, so every query MUST self-scope `created_by=$N` | owner-scoped SQL parameters |
| DB immutability trigger → route | the `23514` trigger is the source of truth for the published-row freeze | published-row mutation attempts |
| client describe box → `/workflows/generate` | untrusted NL prompt (prompt-injection vector) | natural-language prompt |
| KB content / template placeholders → generation prompt | untrusted document content the model reads (injection / scope-widening) | KB text, template placeholders |
| model output → grounding fidelity | a shape-valid but ungrounded/hallucinated definition crosses here | generated WorkflowDefinition JSONB |
| route → provider gateway | the SEALED single forced shot (`forced_emit`), never the open agent loop | one forced model call |
| server `PublishVerdict` → client render | the client must render the verdict verbatim and never re-derive pass/block | PublishVerdict (5 fields) |
| polymorphic `named_failures` → render | an unrecognized/bare-string entry must fail CLOSED (block), never a pass | named_failures list (mixed shapes) |
| Run launch → POST `/threads/{id}/messages` | a user may only launch a workflow they own/can see | `workflow_definition_id` |
| project filter → GET `/workflows/published` | the filter must only narrow, never widen, owner scope | `project_folder_id` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified `file:line`) | Status |
|-----------|----------|-----------|-------------|------------------------------------|--------|
| T-103-01-01 | Elevation of Privilege | draft list/update/delete owner-scope | mitigate | `db/workflows.py:312-313` (`status='draft' AND created_by=$1`), `:341-343`, `:369-372` — second user's row absent; cross-user → None/False → 404 | closed |
| T-103-01-02 | Tampering | update/delete a published row | mitigate | `status='draft'` WHERE guard (`db/workflows.py:343,371`) makes it a 0-row no-op→404; trigger `23514` propagates → `api/workflows.py:300-304` (PATCH) / `:328-332` (DELETE) map `CheckViolationError`→409; never a silent overwrite/500 | closed |
| T-103-01-03 | Spoofing/Tampering | client sets `status='published'`/`is_global` on create | mitigate | `db/workflows.py:288-289` binds `'draft'` + `false` as SQL literals + `created_by=$5` (trusted id); route also forces `body.status='draft'` (second backstop) | closed |
| T-103-01-04 | Tampering | injected/hallucinated keys in the draft JSONB | mitigate | `models/harness.py:27-30` `_StrictBase` `ConfigDict(extra="forbid")`; `WorkflowDefinition`/`PhaseSpec` subclass it → unknown key 422 before any write | closed |
| T-103-01-05 | Information Disclosure | SQL injection via draft/`definition_id` | mitigate | `db/workflows.py` all queries `$N`-only; the sole f-string is `${len(params)}` (a code-derived int, `:197`); `definition_id: UUID` path param → 422 on malformed | closed |
| T-103-01-06 | Tampering | Tweak fork UPDATEs the frozen published row | mitigate | `db/workflows.py:287-297` `create_workflow_definition` is an INSERT (version=N+1); published row never UPDATEd; `UNIQUE(slug,version)`; `WorkflowsPage.tsx onTweak` → `createWorkflowDraft` | closed |
| T-103-02-01 | Tampering / EoP | model invents a `folder_scope` UUID outside the bound subtree | mitigate | `workflow_authoring.py:337-342` `assert_folder_scopes_subset` (owner-scoped) raises → `_grounding_failed`, NOT a draft; `_folder_scope_requires_project` model-validator forces a binding | closed |
| T-103-02-02 | Tampering | model references a non-registered tool/skill | mitigate | `workflow_authoring.py:346-347` (`tool not in tool_names`) + `:351-352` (`skill_ref not in skill_ids`) → `_grounding_failed` | closed |
| T-103-02-03 | Tampering / Spoofing | prompt injection via describe box / KB / placeholders | mitigate | `workflow_authoring.py:279-281` valid tool/skill SETS computed server-side from `get_tools(None)` + owner reads (KB can't whitelist itself); `extra="forbid"` blocks injected keys; grounding fidelity is the backstop | closed |
| T-103-02-04 | Tampering | a shape-valid but ungrounded "draft" reaches the user | mitigate | `workflow_authoring.py:316-319` `_grounding_failed` is DISTINCT from `model_validate`; fidelity checked AFTER validate (`:473`) → returns the failure dict, never the draft | closed |
| T-103-02-05 | Denial of Service | unbounded retries / provider hang | mitigate | `workflow_authoring.py:378,430` exactly one retry (`_shot` attempt 1 then 2, no third); `forced_emit` SEALED single shot, never the open agent loop | closed |
| T-103-02-06 | Information Disclosure | secret leakage in the `nl_generation_attempt` log | mitigate | `workflow_authoring.py:433` `logger.info("nl_generation_attempt", extra={"attempt": attempt})` — integer index is the ONLY payload; no prompt/secret | closed |
| T-103-02-07 | Denial of Service | OpenAI/DeepSeek strict-mode 400 on the optional-heavy schema | mitigate | `workflow_authoring.py:443` `strict=False` (force-without-strict); SC#10 cross-provider NL-gen rows assert no strict 400 | closed |
| T-103-03-01 | Tampering | `publishWorkflow` client re-derives pass/block | mitigate | `api.ts publishWorkflow` reads the server verdict verbatim; the 4 HTTP outcomes (200/400/404/409) are distinct; a binary `200=ok` handler is forbidden (comment-asserted) | closed |
| T-103-03-02 | Tampering | tier badge reads a stored/free-text strictness label | mitigate | `deriveTier.ts:102-129` pure client function from the real `citation_policy` + validator-kind enums; no stored label; safe `TIERS.LOOSE` default (`:127`) | closed |
| T-103-03-03 | Information Disclosure | client widens owner scope via the project filter | **accept** | server enforces owner-scope first (`db/workflows.py:192`), project filter AND-appended as a positional param (`:195-197`) — narrows only; client holds no scope authority — see Accepted Risks | closed |
| T-103-03-04 | Tampering | a 409/404 mutation is swallowed as success | mitigate | `api.ts updateWorkflowDraft`/`deleteWorkflowDraft` throw typed `WorkflowConflictError`/`WorkflowNotFoundError` on 409/404; the UI surfaces them | closed |
| T-103-04-01 | Tampering | a broken/ungrounded generate renders as a "draft" | mitigate | `WorkflowBuilderPage.tsx:179-197` renders a draft ONLY on `ok:true`; `ok:false`/thrown → honest "could not generate" + ZERO phase nodes (the "drafted" phase gates the graph) | closed |
| T-103-04-02 | Tampering | the read-only graph offers a drag/edit affordance | mitigate | `PhaseSpineGraph.tsx` — no `draggable`/drag handler/`onPointerDown` drag/connection-handle/add-node; only `<button onClick=onSelectNode>` (`:189`); refinement is form-only | closed |
| T-103-04-03 | Tampering | a form edit silently overwrites a published row | mitigate | `WorkflowBuilderPage.tsx onPersist` → `updateWorkflowDraft` throws `WorkflowConflictError` on 409 → `saveState:"error"`; published refinement is Tweak→fork (Plan 06), never an in-place edit | closed |
| T-103-04-04 | Information Disclosure | `folder_scope` renders a filesystem path | **accept→mitigate** | `PhaseFormPanel.tsx:274-316` `FolderScopeField` renders `📁 {name ?? id}` (folder NAME + UUID via `title`), never a path — see Accepted Risks | closed |
| T-103-05-01 | Tampering | client re-derives an optimistic verdict | mitigate | `PublishGauntlet.tsx:193-208` `VerdictFields` renders the 5 fields verbatim; `isSuccess` (`:383`) is exclusively `verdict.published===true`; a 200-with-block stays a block | closed |
| T-103-05-02 | Tampering | a binary `200=ok/else=error` handler mislabels a 200-with-block | mitigate | `api.ts` maps 200→`verdict`, 400→`business_requirement`, 404→`not_found`, 409→`already_published`; `PublishGauntlet.tsx:445-511` switches on `PublishOutcome.kind`, never binary | closed |
| T-103-05-03 | Elevation of Privilege | a judge block exposes a "publish anyway"/override | mitigate | `PublishGauntlet.tsx:242-261` `HardWall` renders only "Fix & re-publish"; `<s>publish anyway</s>` (`:250`) is struck-through text with NO handler; no enabled override anywhere | closed |
| T-103-05-04 | Tampering | an un-producible/bare-string judge verdict defaults to `published=true` | mitigate | `PublishGauntlet.tsx:155-165` `renderFailure` key-detection: any string / missing-criterion / unrecognized → `BlockMessage` ("treated as a block, never a pass") | closed |
| T-103-05-05 | Information Disclosure | a cross-user/not-found publish leaks existence | **accept** | `db/workflows.py:228-235` `get_definition` collapses cross-user + not-found to None → `api/workflows.py:199-201` uniform 404; client shows the same "not found" — see Accepted Risks | closed |
| T-103-06-01 | Elevation of Privilege | a user launches a workflow they cannot see | mitigate | the Run list is owner-scoped `list_published_workflows` (`db/workflows.py:191-192`); the kickoff route owner-checks the definition server-side; the client only passes a served id | closed |
| T-103-06-02 | Information Disclosure | the project filter widens visibility by guessing a `project_folder_id` | mitigate | `db/workflows.py:195-197` AND-appends the filter to the owner-scope clause (narrows-only, T-098-09); bound as a positional `$N` param (T-098-10) | closed |
| T-103-06-03 | Tampering | Tweak UPDATEs the frozen published row | mitigate | `WorkflowsPage.tsx onTweak` → `createWorkflowDraft` INSERT (version=N+1); the published row is never UPDATEd; the DB trigger `23514`s anyway | closed |
| T-103-06-04 | Tampering | Run switches the view but never kicks off a server-side run | mitigate | `doRun` (`ChatLayout.tsx`) → `createThread` + `postMessage({workflowDefinitionId})` → backend sets `active_workflow_run_id` atomically (`create_workflow_run`); proof = GET `/threads/{id}/workflow`→harness | closed |
| T-103-06-05 | Tampering | a bespoke `/workflows/{id}/run` route is introduced | mitigate | `api/workflows.py` has no `/run` route (grep-asserted); `doRun` reuses `createThread`+`postMessage`; `threads.py` byte-identical to base | closed |
| T-103-06-06 | Spoofing | a draft is run directly, bypassing the publish gauntlet (QUAL-01) | mitigate | `WorkflowsPage.tsx` `DraftCard` exposes only Open + Publish — NO Run affordance; Run (`published-run`) lives only on `PublishedCard` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Totals: 32 threats — 29 mitigate (verified in shipped code) + 3 accept (residual controls confirmed) = `threats_open: 0`.**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-103-01 | T-103-03-03 | The project filter is owner-scoped **server-side**: `list_published_workflows` evaluates `status='published' AND (is_global=true OR created_by=$1)` FIRST, then AND-appends the project filter as a positional param (`db/workflows.py:191-197`) — it can only NARROW. The client (`api.ts`) merely passes an `encodeURIComponent`-bound query param and holds no scope authority. Residual: a client-supplied filter value cannot widen visibility; worst case is a self-scoped narrowing. Residual control confirmed in code. | orchestrator (gsd:secure-phase) | 2026-06-14 |
| AR-103-02 | T-103-04-04 | `folder_scope`/`project_folder_id` are rendered as the folder NAME + bound UUID (via `title`), never a filesystem path (`PhaseFormPanel.tsx:274-316` `FolderScopeField`). Residual: a folder name is owner-visible metadata, not a sensitive path; no path-disclosure site exists in the component. Residual control confirmed in code. | orchestrator (gsd:secure-phase) | 2026-06-14 |
| AR-103-03 | T-103-05-05 | Cross-user and not-found publish targets are indistinguishable: `get_definition` returns None for both (`db/workflows.py:228-235`) → uniform 404 (`api/workflows.py:199-201`) → client maps to `{kind:"not_found"}` with one message. Residual: an attacker cannot distinguish "exists but not yours" from "does not exist" (the 101.1-09 / 102 404-collapse precedent). Residual control confirmed in code. | orchestrator (gsd:secure-phase) | 2026-06-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Hand-Inspected (4 highest-stakes — read in full, not grep-only)

1. **Judge hard wall, no override (T-103-05-03)** — `PublishGauntlet.tsx:242-261`. `HardWall` renders one forward affordance (`Fix & re-publish`, `:252-258`). The "publish anyway" string (`:250`) is inside `<s>` with no event handler — decorative crossed-out text. `HardWall` is rendered only on a block (`isBlock && <HardWall/>`). No enabled override button exists in the file. Genuine hard wall.
2. **Owner-scoping on every DB function (T-103-01-01)** — `db/workflows.py:308-376`. `list_draft_workflows` (`WHERE status='draft' AND created_by=$1`), `update`/`delete` (`WHERE id=$1 AND created_by=$2 AND status='draft'`). Owner-scoping is structural at the SQL layer, not post-hoc Python filtering. `$N`-only.
3. **Published-row immutability — 409 map + Tweak-as-INSERT (T-103-01-02 / -06)** — three-layer: `status='draft'` WHERE guard makes a published PATCH/DELETE a 0-row no-op→404; the `23514` trigger is the source of truth; the route catches `CheckViolationError`→409 (`api/workflows.py:300-304,328-332`). Tweak forks via `createWorkflowDraft` INSERT — the frozen row's id never reaches a PATCH/DELETE.
4. **Prompt-injection grounding fidelity — server-computed scope sets (T-103-02-01..04)** — `workflow_authoring.py:279-281,322-352`. Folder/tool/skill sets are computed via owner-scoped reads (`get_tools(None)`, owner skill registry with the CR-01 fail-closed fallback). KB/describe text influences only the LLM prompt, never the validation sets. `_check_grounding_fidelity` runs after `model_validate`; a non-None result is returned instead of the draft. Injection cannot widen scope.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-14 | 32 | 32 (29 mitigate + 3 accept) | 0 | gsd-security-auditor (sonnet) + orchestrator hand-spot-check |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-103-01..03)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-14
