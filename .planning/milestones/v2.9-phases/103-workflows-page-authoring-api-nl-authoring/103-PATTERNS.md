# Phase 103: Workflows Page + Authoring API + NL Authoring - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 22 (8 backend create/modify + 14 frontend create/modify/delete)
**Analogs found:** 20 / 22 (2 net-new have no in-repo analog: the read-only SVG spine graph and `deriveTier()` — see No Analog Found)

This is a COMPOSE phase. Every backend seam already exists; the analogs below are CONFIRMED against the live code at file:line (re-read this session, not copied from RESEARCH). The planner should pattern-match new files directly against these excerpts.

**G-5 RED LINE (do NOT route net-new code through these):** `backend/app/api/threads.py`, `backend/app/services/anthropic_service.py`, `frontend/src/components/panel/PhaseTimeline.tsx`, `frontend/src/components/panel/PhaseCard.tsx`. All new backend routes join the EXISTING `APIRouter(prefix="/workflows")` in `api/workflows.py`. The authoring graph is a NET-NEW component that must not import PhaseTimeline/PhaseCard.

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `backend/app/db/workflows.py` | MODIFY (+4 fns) | model / DB layer | CRUD | `db/workflows.py` `create_workflow_run` / `list_published_workflows` / `get_definition` / `publish_definition` (same file) | exact (in-file precedent) |
| `backend/app/api/workflows.py` | MODIFY (+5 routes) | controller / route | CRUD + request-response | `api/workflows.py` `get_published_workflows` + `publish_workflow` (same file, incl. 4 HTTP outcome mapping) | exact (in-file precedent) |
| `backend/app/services/workflow_authoring.py` | CREATE (suggested) | service | request-response (LLM forced gen) | `forced_emit` (`forced_emit.py:205`) + spike `authoring_feel.py` + `resolve_judge_model` (`validator_kinds.py:58`) | exact (substrate exists) |
| `backend/app/models/harness.py` | MODIFY (+1 field) | model | n/a (schema) | `PhaseSpec` (`harness.py:189`) + the 098/101.1 additive-optional precedent | exact |
| `backend/app/config.py` | MODIFY (+1 field) | config | n/a | `Settings.harness_judge_model` (`config.py:962`) | exact |
| `backend/app/services/harness/scope.py` | REUSE (read-only) | service | transform / validation | `assert_folder_scopes_subset` (`scope.py:92`) | exact (reuse as-is) |
| `backend/app/services/harness/reachability.py` | REUSE (read-only) | service | transform | `parse_skip_target` (`reachability.py:61`) + `LintError` (`:31`) | exact (reuse + client mirror) |
| `frontend/src/lib/api.ts` | MODIFY (+fns/types) | client | request-response | `listPublishedWorkflows` (`api.ts:1140`) + `createThread` (`:49`) + `sendMessage` (`:445`) | exact (in-file precedent) |
| `frontend/src/App.tsx` | MODIFY (+ActiveView member) | provider / state | event-driven | `ActiveView` union (`App.tsx:9`) | exact |
| `frontend/src/components/layout/NavPanel.tsx` | MODIFY (consume shared NAV_ITEMS) | component | event-driven | `NAV_ITEMS` (`NavPanel.tsx:44`) | exact |
| `frontend/src/components/layout/ChatLayout.tsx` | MODIFY (+render branch, consume shared NAV_ITEMS) | component | event-driven | `NAV_ITEMS_MOBILE` (`ChatLayout.tsx:18`) + the ActiveView render branch (`:255-266`) + the push grid (`:230-235`) | exact |
| `frontend/src/lib/nav-items.ts` | CREATE (suggested) | utility / config | n/a | the triplicated `NAV_ITEMS` arrays (NavPanel/AppDock/ChatLayout) | exact (extract) |
| `frontend/src/components/layout/AppDock.tsx` | DELETE | component (dead) | n/a | n/a (verified zero importers) | n/a |
| `frontend/src/pages/WorkflowsPage.tsx` | CREATE | component / page | request-response (library + launch) | `KnowledgeHealthPage` mount pattern + `createThread`/`sendMessage` launch + `getThreadWorkflow` read-back | role-match |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | CREATE | component / page | request-response (describe→draft) | the `ChatLayout` push grid (`:230-235`) for the 400px panel | role-match |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | CREATE | component | transform (render draft JSON) | plain SVG/CSS (NO graph lib); `parse_skip_target` for edge resolution | **no direct analog** (PhaseTimeline is G-5 + different data) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | CREATE | component | event-driven (form edit → PATCH) | the 6 `PhaseConfig` members (`harness.py:52-167`) | role-match (data shape only) |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | CREATE | component | request-response (render PublishVerdict) | `PublishVerdict` (`workflows.py:84-93`) + the polymorphic `named_failures` shapes (`publish_service.py:445/246/424`) | exact (data contract) |
| `frontend/src/components/workflows/deriveTier.ts` | CREATE | utility | transform | `citation_policy` + `ValidatorSpec.kind` enums (`harness.py:153`/`:178`) | **no analog** (net-new derivation) |

## Pattern Assignments

### `backend/app/db/workflows.py` (DB layer, CRUD — ADD 4 fns)

**Analog:** `db/workflows.py` itself (in-file precedent — mirror exactly). File header contract: asyncpg pool, `$N` placeholders ONLY (no f-strings on SQL), small return shapes.

**Owner-scoped read precedent** — mirror this WHERE shape for `list_draft_workflows` (`get_definition`, lines 223-230):
```python
row = await pool.fetchrow(
    "SELECT id, slug, version, name, status, definition, created_by "
    "FROM workflow_definitions "
    "WHERE id = $1 AND (created_by = $2 OR (is_global = true AND status = 'published'))",
    definition_id,
    user_id,
)
return dict(row) if row is not None else None
```
For `list_draft_workflows`, narrow to `WHERE status = 'draft' AND created_by = $1` (owner-scope only — a second user's draft must be absent; REQ-1 acceptance b).

**Project-filter / JSONB-path + `$N`-only precedent** (`list_published_workflows`, lines 185-194) — the model for binding a UUID into a JSONB predicate without f-string interpolation:
```python
sql = (
    "SELECT id, slug, name FROM workflow_definitions "
    "WHERE status = 'published' AND (is_global = true OR created_by = $1)"
)
params: list = [user_id]
if project_folder_id is not None:
    params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
    sql += f" AND definition->>'project_folder_id' = ${len(params)}"  # only the INDEX is f-string-built
sql += " ORDER BY name"
rows = await pool.fetch(sql, *params)
```

**INSERT-and-RETURNING + JSONB-dump precedent** (`create_workflow_run`, lines 128-140) — the model for `create_workflow_definition` (bind `status='draft'`, `is_global=false`, `created_by=user_id`; `json.dumps(...)` + `$N::jsonb`, NO pool codec):
```python
run_id = await con.fetchval(
    """
    INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id, is_golden_run)
    VALUES ($1, $2, 'active', $3::jsonb, $4, $5, $6)
    RETURNING id
    """,
    thread_id, definition_id, json.dumps(inputs), model, user_id, is_golden_run,
)
```

**UPDATE status-flip precedent** (`publish_definition`, lines 250-255) — the shape for `update_workflow_definition` / `delete_workflow_definition`. NOTE: a PATCH/DELETE against a published row hits the immutability trigger `workflow_definitions_block_published` (Postgres `23514`). **Catch `asyncpg.exceptions.CheckViolationError` (code 23514) in the DB fn or route → map to HTTP 409** (Pitfall 5). The trigger ALLOWS the draft→published flip (fires only when `OLD.status='published'`):
```python
row = await pool.fetchrow(
    "UPDATE workflow_definitions SET status = 'published' "
    "WHERE id = $1 AND status = 'draft' RETURNING version",
    definition_id,
)
return row["version"] if row is not None else -1
```

**Tweak fork (REQ-7, Pitfall 6):** Tweak = `create_workflow_definition` (INSERT) with `version = published_N + 1`, `status='draft'`, `slug` unchanged. NEVER an UPDATE of the published row.

---

### `backend/app/api/workflows.py` (route, CRUD + request-response — ADD 5 routes)

**Analog:** the same file's `get_published_workflows` (read) + `publish_workflow` (the 4 HTTP outcome mapping).

**Router + auth + pool precedent** (lines 29, 42-69) — new routes join THIS router (the header forbids `threads.py`):
```python
router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(
    project_folder_id: UUID | None = Query(None),
    current_user: dict = Depends(get_current_user),
) -> list[PublishedWorkflow]:
    pool = await get_pg_pool()
    user_id = current_user["id"]
    rows = await list_published_workflows(
        pool,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        project_folder_id=project_folder_id,
    )
    return [PublishedWorkflow(**r) for r in rows]
```

**The 4 HTTP-outcome mapping precedent** (lines 128-143) — the EXACT model the published-row-409 (REQ-1) mirrors and the publish-gauntlet client (REQ-6) reads:
```python
blocked = result.get("blocked_stage")
if blocked == "not_found":
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
if blocked == "already_published":
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="workflow is already published")
if blocked == "business_requirement":
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
return PublishVerdict(**result)  # 200 with the machine-renderable verdict
```
For the new PATCH/DELETE routes: catch the `23514` CheckViolation → `raise HTTPException(status_code=409, detail="workflow is published and cannot be modified")` (mirror the `already_published`→409 line).

**`POST /workflows/generate` (REQ-2):** delegates to the new `workflow_authoring` service (keep the forced-gen orchestration OUT of the route body, mirroring the `publish_service.publish` delegation at lines 120-126). Returns the draft definition object (NOT persisted — persistence is REQ-1's explicit `POST /workflows` create).

---

### `backend/app/services/workflow_authoring.py` (service, forced structured generation — CREATE)

**Analog 1 — the forced-emit substrate** (`forced_emit.py:205-364`, REUSE unchanged via `schema_model`). The CR-01 seam already generalizes it beyond `EmitFieldMap`; the judge passes `schema_model=JudgeVerdict`, NL-gen passes `schema_model=WorkflowDefinition`:
```python
async def forced_emit(
    *, messages: list[dict], model: str, provider: str, emitter: str,
    tools: list[dict], user_settings: Any, system_prompt: str = "",
    max_tokens: int | None = None, schema_model: type[BaseModel] | None = None,
) -> dict:
    cap = get_model_capability(model) or {}
    forced = bool(cap.get("forced_emission", False))  # default-SAFE — a miss is coerce
    strict = bool(cap.get("strict_json_schema", False))
    ...
    # result["emitted"] = validated model | None; result["failure"] honest-fails (provider_error / model_failed_to_emit / truncated)
```
**Pitfall 1 (HIGHEST RISK — plan FIRST):** `forced_emit` sets `strict_schema=strict` from the registry. For OpenAI/DeepSeek (`strict_json_schema:True`) the openai-compat adapter sets `"strict": true`, which requires EVERY property in `required` — but `WorkflowDefinition` is optional-heavy → 400. The default authoring model `claude-opus-4-8` (Anthropic, no strict) is unaffected, but the SC#10 OpenAI/DeepSeek rows need strict OFF for the authoring shot. RESEARCH Open Q1 recommends an additive `strict: bool | None = None` override kwarg on `forced_emit` (default `None` = current cap-derived = byte-identical for emit/judge). Plan this as the first REQ-2 task.

**Analog 2 — the model-resolution knob** (`validator_kinds.py:58-80`, mirror EXACTLY for `resolve_authoring_model`):
```python
def resolve_judge_model(settings) -> str | None:
    model = getattr(settings, "harness_judge_model", None)
    if model:
        return model
    from app.config import get_model_capability  # function-local (Pitfall 4 discipline)
    for candidate in ("claude-opus-4-8", "gpt-5.5"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None
```

**Analog 3 — schema-as-tool + discriminator strip** (`scripts/spike-097/authoring_feel.py:241-258`, REPRODUCE the logic, do NOT import the throwaway spike). Pitfall 7: strip `discriminator` keys before passing the schema to the emit tool; the `const phase_type` per `oneOf` variant still lets the model pick the right config; Pydantic re-applies the discriminator at `model_validate`:
```python
def _strip_discriminator(node):
    if isinstance(node, dict):
        node.pop("discriminator", None)
        for v in node.values():
            _strip_discriminator(v)
    elif isinstance(node, list):
        for v in node:
            _strip_discriminator(v)
    return node

WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))
```

**Analog 4 — grounding-fidelity ⊆ check** (`scope.py:92-126`, REUSE for REQ-2 acceptance d, distinct from `model_validate()` shape-only):
```python
async def assert_folder_scopes_subset(definition, *, supabase, user_id) -> None:
    subtree = await resolve_project_subtree(definition.project_folder_id, supabase=supabase, user_id=user_id)
    if subtree is None:
        return  # unbound → nothing to bound against
    allowed = set(subtree)
    for phase in definition.phases:
        scope = getattr(phase.config, "folder_scope", None)
        if scope:
            outside = {str(f) for f in scope} - allowed
            if outside:
                raise ValueError(f"phase '{phase.slug}' folder_scope is not a subset ...: {sorted(outside)}")
```
Plus a set-membership check: every `available_tools` ∈ the real tool registry and every `skill_ref` ∈ the owner/global skill set.

**Single-retry + observable attempt count (REQ-2 a/b):** emit one `nl_generation_attempt {attempt: int}` structured-log/LangSmith-span event per provider call; `forced_emit` returns `emitted=None` on validate/forcing failure → retry EXACTLY once with the error appended → honest structured failure on a second None (never a runnable/partial draft). RESEARCH Open Q2: a log/span suffices (do NOT add a `harness_audit` kind — that's a closed CHECK constraint needing a migration).

**Template grounding supply (D-103-CONF-2, REQ-2):** OPTIONAL via the request body — `template_asset_id?` (→ `resolve_template_source` at `template_asset_service.py:81` → `parse_docx_template_variables` at `template_render_service.py:356`) OR `template_placeholders?: string[]` (direct). NO new upload route.

---

### `backend/app/models/harness.py` (schema — ADD 1 field, REQ-3)

**Analog:** `PhaseSpec` itself + the 098/101.1 additive-optional JSONB precedent (the 5→6 PhaseConfig member growth). Current `PhaseSpec` (lines 189-193) — add `name`:
```python
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig  # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None   # REQ-3 — additive; serializes into definition JSONB; pre-103 rows validate with it absent
```
Zero SQL migration (serializes inside the existing `definition` jsonb column; REQ-3 acceptance d: `git diff` shows no new `*.sql`). The `_StrictBase` (`extra="forbid"`) is what makes a hallucinated key a `ValidationError` — load-bearing for REQ-2.

---

### `backend/app/config.py` (config — ADD 1 field, D-103-2)

**Analog:** `Settings.harness_judge_model` (`config.py:962`, mirror EXACTLY):
```python
# Phase 102 (D-03 / QUAL-01) — the LLM-judge model for the output-quality gate.
# Settings-not-env (a model id is a VALUE, not a secret). None = a registry default ...
harness_judge_model: str | None = None
```
Add `harness_authoring_model: str | None = None` immediately after, resolved by `resolve_authoring_model()` (above). Both `claude-opus-4-8` and `gpt-5.5` are `forced_emission:True` in `MODEL_CAPABILITIES`.

---

### `frontend/src/lib/api.ts` (client — ADD authoring fns + types, REQ-6/REQ-7)

**Analog — the workflow client fn shape** (`api.ts:1140-1147`, mirror for `createWorkflowDraft` / `updateWorkflowDraft` / `deleteWorkflowDraft` / `listDraftWorkflows` / `generateWorkflow` / `publishWorkflow`):
```typescript
export async function listPublishedWorkflows(signal?: AbortSignal): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/published`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list published workflows (status ${res.status})`)
  return (await res.json()) as PublishedWorkflow[]
}
```
For `publishWorkflow`, the client MUST distinguish the 4 HTTP outcomes (200-with-block ≠ success; 400/404/409 distinct — a binary `200=ok else=error` handler is a REQ-6 FAIL). Add `PublishVerdict`/`LintError`/draft TS types mirroring the backend (`PublishVerdict` 5 fields; `named_failures` polymorphic — see PublishGauntlet below).

**Analog — the launch sequence** (`doRun()` reuses these two existing fns verbatim, D-103-CONF-1, no bespoke route):
`createThread` (`api.ts:49-60`):
```typescript
export async function createThread(title = "New Chat", folderId?: string | null): Promise<Thread> {
  const headers = await getAuthHeaders()
  const body: Record<string, string> = { title }
  if (folderId) body.folder_id = folderId
  const res = await fetch(`${API_BASE}/threads`, { method: "POST", headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create thread")
  return res.json() as Promise<Thread>
}
```
`sendMessage` with `workflowDefinitionId` (`api.ts:447-459`) — the kickoff carries ONE free-text `content` → `kickoff_prompt`; NO structured input fields exist on the wire:
```typescript
body: JSON.stringify({
  content,
  model: options.model,
  provider: options.provider,
  agent_mode: options.agentMode ?? "default",
  ...(options.workflowDefinitionId ? { workflow_definition_id: options.workflowDefinitionId } : {}),
}),
```
Backend wire shape confirmed: `MessageCreate{content, model?, provider?, agent_mode, workflow_definition_id: UUID|None}` (`message.py:8-18`); kickoff wraps as `inputs={"kickoff_prompt": body.content}` (`threads.py:1155`). Run-kicked-off proof: `getThreadWorkflow` (`api.ts:1126`) → `mode="harness"` (REQ-7 acceptance f).

---

### `frontend/src/App.tsx` (state — ADD ActiveView member, REQ-7)

**Analog** (`App.tsx:9`) — extend the union with `"workflows"` (no router; `useState<ActiveView>` is the whole nav model):
```typescript
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health"
```

---

### `frontend/src/components/layout/ChatLayout.tsx` (component — ADD render branch + push grid + shared NAV_ITEMS, REQ-5/REQ-7)

**Analog 1 — the ActiveView render branch** (`ChatLayout.tsx:255-266`) — the `WorkflowsPage` (and Builder) branch lands BEFORE the trailing `: <KnowledgeHealthPage/>` else:
```tsx
) : (
  <main className="flex-1 overflow-hidden">
    {activeView === "documents" ? (
      <IngestionPage />
    ) : activeView === "skills" ? (
      <SkillsPage onTryInChat={handleTryInChat} />
    ) : activeView === "settings" ? (
      <SettingsPage />
    ) : (
      <KnowledgeHealthPage />
    )}
  </main>
)
```

**Analog 2 — the CSS-grid push pattern** (`ChatLayout.tsx:230-235`) — the canonical 2-state track the Builder's 400px form panel mirrors (push, NOT `position:absolute/fixed`; REQ-5 acceptance d):
```tsx
<div
  className="grid min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
  style={{
    gridTemplateColumns:
      "1fr " + (panelState === "open" ? "clamp(300px,30%,420px)" : "52px"),
  }}
>
```
For the Builder: `"minmax(0,1fr) " + (panelOpen ? "400px" : "44px")`. Acceptance: graph column width DECREASES when the panel opens; panel NOT `position:fixed`; no h-scroll ≥1100px; `<768px` = bottom-sheet.

---

### `frontend/src/components/workflows/PublishGauntlet.tsx` (component — render PublishVerdict verbatim, REQ-6)

**Analog — the verdict contract** (`workflows.py:84-93`):
```python
class PublishVerdict(BaseModel):
    published: bool
    version: int | None = None
    golden_run_id: UUID | None = None
    blocked_stage: str | None = None
    named_failures: list = Field(default_factory=list)
```
Render the 5 fields VERBATIM — never re-derive `published`/`blocked_stage`. The run link gates on `golden_run_id != null`. The judge is a hard wall: NO "publish anyway" override (its absence rendered struck-through).

**Analog — the polymorphic `named_failures` shapes (D-103-CONF-3, render by KEY-DETECTION not by `blocked_stage`):**
- `lint` → `{code, phase, message}` (codes are the 5 LOWERCASE `LintError.code` literals: `bad_index`, `unsatisfiable_skip`, `orphan_phase`, `no_terminal`, `input_unsatisfied`).
- `judge` per-criterion → `{criterion, score, evidence}` + a `{summary}` row; a judge-shot failure is a bare STRING (`publish_service.py:445-465`):
```python
def _judge_named_failures(verdict: dict) -> list:
    if verdict.get("failure"):
        return [f"the judge produced no verdict ({verdict['failure']}) — honest failure, not a silent pass"]
    failures: list = []
    for c in verdict.get("criteria") or []:
        if isinstance(c, dict) and c.get("passed") is False:
            failures.append({"criterion": c.get("criterion"), "score": c.get("score"), "evidence": c.get("evidence")})
    summary = verdict.get("summary")
    if summary:
        failures.append({"summary": summary})
    return failures or [{"summary": "overall_passed is not True"}]
```
- `interactive_phase` → `{phase, message}` (`:424-429`); `structural_gate`/early stages → bare STRING.

**Render rule (locked):** detect entry keys — `criterion`→criterion-row; `code`→lint-row; `phase`+`message`→phase-row; `summary`→summary-line; bare string→plain message. ANY string / unrecognized / missing-`criterion` shape → BLOCK, NEVER `published=true` (REQ-6 acceptance g, the G-6 silent-pass guard).

---

### `frontend/src/components/workflows/PhaseFormPanel.tsx` (component — 6 phase_type forms, REQ-5)

**Analog — the 6 `PhaseConfig` members** (`harness.py:52-167`, each form renders ONLY its real fields):
```
programmatic       → fn, input_keys
llm_single         → prompt, model?, temperature?, folder_scope?, skill_ref?
llm_agent          → + available_tools, max_steps(=12), wall_clock_seconds?
llm_batch_agents   → + max_parallel_agents(=5), merge_strategy("concat"|"concat_numbered")
llm_human_input    → prompt, options[], timeout_seconds(=300)
llm_emit           → prompt, emitter, model?, folder_scope?, skill_ref?,
                     citation_policy("strict"|"flag"|"partial"|"draft"),
                     integrity_policy("strict"|"documented_limit" — GREYED/read-only in 103)
```
`folder_scope`/`project_folder_id` render the folder NAME + bound UUID, never a path. `integrity_policy` is greyed/read-only and ONLY on `llm_emit` (`harness.py:154`).

---

## Shared Patterns

### Owner-scoped RLS-mirroring reads
**Source:** `db/workflows.py` `get_definition` (`:223-230`) / `list_published_workflows` (`:185-194`)
**Apply to:** every new DB fn (`create/update/delete_workflow_definition`, `list_draft_workflows`)
The service-role engine bypasses RLS, so each query MUST self-scope: `created_by = $N` (drafts owner-only). Cross-user collapses to 404 (no existence leak — the 101.1-09 precedent). `$N` placeholders ONLY; only the placeholder INDEX is f-string-built.

### Published-row immutability → HTTP 409
**Source:** the DB trigger `workflow_definitions_block_published` (migration 067, raises Postgres `23514`) + the `already_published`→409 mapping (`workflows.py:132-135`)
**Apply to:** `update_workflow_definition` / `delete_workflow_definition` routes
Catch `asyncpg.exceptions.CheckViolationError` (`23514`) → HTTP 409, never a silent overwrite or 500 (Pitfall 5). The trigger is the source of truth; the route maps the exception. Re-read after rejection must show the published row unchanged (REQ-1 acceptance e).

### Forced structured generation via the existing substrate
**Source:** `forced_emit` (`forced_emit.py:205`) + `resolve_judge_model` (`validator_kinds.py:58`)
**Apply to:** `workflow_authoring.py` NL-gen
Reuse `forced_emit(schema_model=WorkflowDefinition)` — NO new SDK path, NO agent loop, NO gateway change. The substrate owns provider translation, validation, truncation guard, narration recovery, and honest-fail. The ONE net-new risk is strict-mode (Pitfall 1) — plan an additive `strict` override FIRST.

### Additive-optional model fields serialize into JSONB
**Source:** the 098/101.1 precedent (`WorkflowDefinition` lines 227-239; the `llm_emit` 6th-member growth)
**Apply to:** `PhaseSpec.name` (REQ-3)
Zero SQL migration; pre-103 rows `model_validate()` with the field absent. `_StrictBase` (`extra="forbid"`) rejects unknown keys.

### Config-layer independent model knob
**Source:** `Settings.harness_judge_model` (`config.py:962`) + `resolve_judge_model` (`validator_kinds.py:58`)
**Apply to:** `Settings.harness_authoring_model` + `resolve_authoring_model` (D-103-2)
A model id is a VALUE not a secret (settings-not-env, pydantic env-overridable). NOT the composer's selected model.

### Shared `NAV_ITEMS` const (kill the triplication)
**Source:** the three identical hardcoded arrays — `NavPanel.tsx:44`, `AppDock.tsx:12` (DEAD), `ChatLayout.tsx:18` (NAV_ITEMS_MOBILE)
**Apply to:** `nav-items.ts` (new) consumed by NavPanel + the ChatLayout mobile drawer
Add the `"workflows"` entry with a distinct non-gear lucide icon (`Workflow`/`GitBranch`). Delete `AppDock.tsx` + the `// From AppDock` comment (`NavPanel.tsx:28`). No `react-router`.

### Router-less navigation
**Source:** `App.tsx:9-13` (`useState<ActiveView>` + `setActiveView`)
**Apply to:** the `"workflows"` member + the ChatLayout render branch + `doRun()` (createThread → switch activeView to "chat")
NO `react-router`/`useNavigate`/URL (REQ-7 acceptance j).

## No Analog Found

| File | Role | Data Flow | Reason / what to use instead |
|------|------|-----------|------------------------------|
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | component | transform | NO graph lib in frontend deps (no react-flow/d3/dagre). `PhaseTimeline.tsx:77` is the RUN spine — it reads live `usePhases(threadId)` (different data) and is G-5 protected; the authoring graph reads a DRAFT definition JSON. Build plain SVG/CSS: nodes per `PhaseSpec` ordered by `phase_index`, solid `i→i+1`, one dashed `skip_to_phase` (resolve the target slug client-side mirroring `parse_skip_target` at `reachability.py:61`). Static-check REQUIRES: no `onDragStart`/`onPointerDown`/`draggable=true`/connection-handle/add-node in the DOM (REQ-4 acceptance c). Phase-type glyphs: `⚙ programmatic / ✎ llm_single / 🤖 llm_agent / ⛓ llm_batch_agents / ☺ llm_human_input / ◆ llm_emit`. Ground the visual against the `sketch-findings-agentic-rag` skill (sketch-019). |
| `frontend/src/components/workflows/deriveTier.ts` | utility | transform | Net-new this phase (verified — no `deriveTier`/`TIERS` exists; only an unrelated `model-info.test.ts` hit). Derive STRICT/MIDDLE/LOOSE on EVERY render from `(citation_policy + the SET of validator kinds present)` — the real enums only (`citation_policy` at `harness.py:153`; `ValidatorSpec.kind` at `:178`, incl. `llm_judge_rubric` present even on LOOSE). NEVER a stored/JSONB/free-text label; toggling `citation_policy` strict→draft changes the badge with NO server round-trip (REQ-7 acceptance h). No invented "level 1/2/3"/"compliance mode". |

## Metadata

**Analog search scope:** `backend/app/db/`, `backend/app/api/`, `backend/app/models/`, `backend/app/services/` (+ `harness/`), `backend/app/config.py`, `scripts/spike-097/`, `frontend/src/App.tsx`, `frontend/src/components/layout/`, `frontend/src/components/panel/`, `frontend/src/lib/api.ts`.
**Files scanned (read this session at file:line):** `db/workflows.py`, `api/workflows.py`, `models/harness.py`, `models/message.py`, `config.py`, `services/forced_emit.py`, `services/harness/{reachability,scope,validator_kinds,publish_service}.py`, `api/threads.py` (kickoff lines only), `scripts/spike-097/authoring_feel.py`, `App.tsx`, `components/layout/{NavPanel,AppDock,ChatLayout}.tsx`, `components/panel/PhaseTimeline.tsx`, `lib/api.ts`.
**G-5 verification:** PhaseTimeline confirmed reads live `usePhases` (RUN data) — NOT reused for authoring; all new backend routes confirmed join `APIRouter(prefix="/workflows")` — never `threads.py`.
**Pattern extraction date:** 2026-06-14

## PATTERN MAPPING COMPLETE

**Phase:** 103 - Workflows Page + Authoring API + NL Authoring
**Files classified:** 22
**Analogs found:** 20 / 22

### Coverage
- Files with exact (in-file / direct) analog: 14
- Files with role-match analog: 6
- Files with no analog (net-new, use design contract / data shape): 2 (PhaseSpineGraph, deriveTier)

### Key Patterns Identified
- All backend seams already exist — NL-gen reuses `forced_emit(schema_model=WorkflowDefinition)`; the ONE net-new risk is strict-mode on OpenAI/DeepSeek (Pitfall 1, plan first as an additive `strict` override).
- Draft-CRUD DB fns mirror the in-file owner-scoped RLS predicate (`$N` only); published-row mutation maps `23514`→HTTP 409 (mirror the `already_published`→409 path).
- The publish-gauntlet UI renders `PublishVerdict` verbatim and the polymorphic `named_failures` by KEY-DETECTION (criterion/code/phase+message/summary/bare-string), with any unrecognized shape → block.
- The 400px form panel mirrors the shipped `ChatLayout` `gridTemplateColumns` 2-state push pattern; the read-only graph is plain SVG/CSS (no graph lib; NOT PhaseTimeline).
- The three-homes nav is a `useState<ActiveView>` extension + a shared `NAV_ITEMS` const + the AppDock deletion — no router, Deep byte-identical.

### File Created
`.planning/phases/103-workflows-page-authoring-api-nl-authoring/103-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference these analog excerpts directly in PLAN.md action sections.
