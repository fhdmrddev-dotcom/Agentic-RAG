# Phase 102: Reusable Validation-Gate Library + Output-Quality Gate - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 13 (8 edits, 4 new, 1 migration)
**Analogs found:** 13 / 13 (every load-bearing mechanic is shipped substrate read in full this session)

This phase is ~85% composition. EVERY new file has an in-repo analog; there are no
green-field patterns. The planner should treat the excerpts below as the literal
shape to copy, honoring the red lines noted in `## Shared Patterns`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/harness/validator_kinds.py` *(NEW)* | service (validator registry entries) | transform / request-response | `backend/app/services/harness/validators.py` (the 4 shipped kinds + `@register_validator`) | exact |
| `backend/app/services/harness/freshness.py` *(NEW, optional split)* | service (deterministic KB query) | CRUD (read) | `backend/app/db/workflows.py` (asyncpg `$N` read helpers) + `validators.py` `workspace_file_exists` (ctx-pool lookup) | role-match |
| `backend/app/services/harness/publish_service.py` *(NEW)* | service (orchestration) | request-response / batch | `backend/app/services/forced_emit.py` (sealed orchestration) + `db/workflows.create_workflow_run` + `reachability.lint_workflow` | role-match (assembled from 3) |
| `backend/app/services/harness/validators.py` *(EDIT)* | service (registry core + fan-in) | transform | itself — `run_gates` gains an optional `timing` kwarg, back-compat default | exact (self) |
| `backend/app/services/harness_engine.py` *(EDIT)* | service (engine loop) | event-driven | itself — `_run_phase_with_gates` / `_parse_on_failure` / `_route_on_failure` | exact (self) |
| `backend/app/services/harness/phase_types.py` *(EDIT)* | service (phase executor) | transform | itself — `_exec_llm_emit` post-`check_coverage` branch (the D-08 ladder) | exact (self) |
| `backend/app/models/harness.py` *(EDIT)* | model (Pydantic over JSONB) | transform | itself — `LlmEmitPhaseConfig` / `ValidatorSpec` / `WorkflowDefinition` additive-optional fields (101.1 + 098 precedent) | exact (self) |
| `backend/app/api/workflows.py` *(EDIT)* | route (FastAPI) | request-response | itself — `get_published_workflows` (the 092 router + owner-scope + `Depends(get_current_user)`) | exact (self) |
| `backend/app/db/workflows.py` *(EDIT)* | db (asyncpg CRUD) | CRUD | itself — `finish_run` (status flip + txn), `create_workflow_run` (golden-run reuse), `write_audit` + `_AUDIT_EVENT_TYPES` | exact (self) |
| `backend/app/config.py` *(EDIT)* | config | — | itself — `Settings` harness knobs (`harness_phase_max_steps`, `ask_user_max_timeout_seconds`) | exact (self) |
| `supabase/migrations/070_*.sql` *(NEW)* | migration | — | `supabase/migrations/069_harness_audit_emit_kinds.sql` (CHECK ALTER) + `068_workspace_template_ephemeral.sql` (additive column) | exact |
| `backend/tests/unit/test_validator_kinds.py` *et al. (NEW)* | test | — | `backend/tests/unit/test_harness_audit_emit.py` (Wave-0 xfail stub + import-in-body convention) | exact |

---

## Pattern Assignments

### `backend/app/services/harness/validator_kinds.py` (NEW — service, the 5 first-class kinds, D-12)

**Analog:** `backend/app/services/harness/validators.py` (the 4 shipped kinds, lines 130–211)

**The registry-entry pattern to copy** — each kind is `async fn(output, config, ctx) -> GateResult` decorated with `@register_validator(<kind>)`, fails closed with a descriptive `error_message`, never raises into the run (`validators.py:130-147`):

```python
@register_validator("json_schema")
async def _validate_json_schema(output: dict, config: dict, ctx) -> GateResult:
    schema = config.get("schema")
    if schema is None:
        return GateResult(False, "json_schema validator: config.schema is missing")
    try:
        jsonschema.validate(_output_payload(output), schema)
        return GateResult(True, None)
    except jsonschema.ValidationError as e:
        return GateResult(False, str(e.message))
```

**ctx-pool lookup pattern** (for `freshness`/`output_file_valid` needing run context) — copy from `workspace_file_exists` (`validators.py:165-190`): read `getattr(ctx, "pool", None)` / `getattr(ctx, "thread_id", None)`, fail closed if missing, function-local import the db helper:

```python
pool = getattr(ctx, "pool", None)
thread_id = getattr(ctx, "thread_id", None)
if pool is None or not thread_id:
    return GateResult(False, "workspace_file_exists validator: no workspace context (pool/thread_id)")
from app.db.workspace import get_file_by_path
row = await get_file_by_path(pool, thread_id, path)
```

**Per-kind wrapping (D-12):**
- `citations_required` → wraps `check_coverage` (`template_render_service.py:416`). Reads `verdict["uncited_value_count"]` / `["invented_citation_count"]` / `["uncited_leaves"]` — exact keys returned at `template_render_service.py:486-499`. The deterministic mode mirrors the `_exec_llm_emit` gate at `phase_types.py:1235-1240`.
- `output_file_valid` → wraps `assert_integrity` (`template_render_service.py:867`). It re-opens the file (read-only oracle), returns `{opened, residual_clean, documented_limit, ...}`. Make it format-aware by extending the fmt branch (currently docx/pptx/xlsx at `:888-915`); add a PDF branch (stub OK in v1 per RESEARCH §Environment Availability).
- `structure_check` → wraps `jsonschema.validate` for strict + a loose-mode heading scan on `output.get("text")` (the `_output_text` helper, `validators.py:122-126`).
- `llm_judge_rubric` → rides `forced_emit` (see publish_service excerpt below).
- `freshness` → net-new (see `freshness.py`).

**Side-effect registration:** the module is imported in `harness/__init__.py` for its `@register_validator` side-effects, exactly as `phase_types` is imported there (`__init__.py:20`) and self-registers via `register_all()` at import time (`phase_types.py:1456-1457`).

---

### `backend/app/services/harness/freshness.py` (NEW — service, deterministic KB query, GATE-01 / D-09)

**Analog:** `backend/app/db/workflows.py` asyncpg read helpers (e.g. `load_run_phases:181`, `list_published_workflows:141`) — `$N` placeholders ONLY, never f-string SQL.

**Pattern to copy** (`db/workflows.py:181-196`):

```python
async def load_run_phases(pool: asyncpg.Pool, run_id: UUID) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT id, slug, phase_index, status, output
        FROM workflow_phases
        WHERE workflow_run_id = $1
        ORDER BY phase_index
        """,
        run_id,
    )
    return [dict(r) for r in rows]
```

**Note (RESEARCH Open Q1, A5 — MEDIUM risk):** the exact `documents`/`document_chunks` upload-date column and the folder-subtree scope query are NOT yet confirmed against the live schema. The planner MUST read `supabase/full-schema.sql` for those columns at plan time and reuse the 098 folder-scope resolution (`folder_scope` resolved-id-list, `models/harness.py:70`). Two v1 checks: newest-doc-age vs per-workflow `max_age_days` (no global default) + exact-stem filename collision.

---

### `backend/app/services/harness/publish_service.py` (NEW — service orchestration, QUAL-01 / D-07/D-08)

**Analog (orchestration shape):** `backend/app/services/forced_emit.py:194` `forced_emit(...)` — a sealed function that returns a STRUCTURED result dict, never raises into the caller (the caller branches on `result.get("failure")`).

**Composes three shipped pieces in order (the Pattern-5 sequence):**

1. **Lint** — `lint_workflow(definition)` → `list[LintError]` (pure, `reachability.py:83`). `LintError` is a `NamedTuple(code, phase_slug, message)` (`reachability.py:31-34`) — exactly the machine-renderable shape D-08 needs.
2. **Golden run** — reuse `create_workflow_run(pool, ..., is_golden_run=True)` (`db/workflows.py:69`), then drive `run_workflow`. Do NOT fork the run-insertion path (Don't-Hand-Roll). Add `is_golden_run` as a new kwarg threaded into the INSERT.
3. **Judge** — call `forced_emit(messages=..., model=<judge_model>, emitter=<judge-verdict-emitter>, ...)` (`forced_emit.py:194-204`). Branch on the result exactly as `_exec_llm_emit` does:

```python
result = await forced_emit(messages=messages, model=model, provider=..., emitter=emitter,
                           tools=_emit_forced_tool(emitter), user_settings=...)
if result.get("failure"):
    # honest failure — NOT a silent pass (the QUAL-01 trust bar)
    ...
emitted: EmitFieldMap = result["emitted"]
```
*(Source: `phase_types.py:1173-1206`.)*

4. **Flip** — `UPDATE workflow_definitions SET status='published' WHERE id=$1`. VERIFIED safe: the `workflow_definitions_block_published_update` trigger only blocks when `OLD.status='published'` (`full-schema.sql:230`), so a `draft → published` flip passes.

**Owner-check FIRST** (V4 access control) — the publish endpoint must verify `created_by = current_user` before any work (mirror the RLS predicate in `list_published_workflows`, `db/workflows.py:169`).

---

### `backend/app/services/harness/validators.py` (EDIT — `run_gates` gains `timing` filter, D-10)

**Analog:** itself — `run_gates` (`validators.py:214-238`).

**Current fan-in (the byte-compatible base):**

```python
async def run_gates(phase, output: dict, ctx) -> GateResult:
    for idx, spec in enumerate(getattr(phase, "validators", None) or []):
        validator = VALIDATOR_REGISTRY.get(spec.kind)
        if validator is None:
            return GateResult(False, f"unknown validator kind {spec.kind!r} ...", idx)
        result = await validator(output, spec.config, ctx)
        if not result.passed:
            return result._replace(validator_index=idx)   # WR-03 index threading
    return GateResult(True, None)
```

**Edit:** add an optional `timing: str | None = None` kwarg that, when set, filters to `spec.timing == timing`. Default `None` runs ALL specs → every existing caller + unit test stays byte-identical (the same back-compat discipline the `GateResult.validator_index` default used, `validators.py:55-57`). CRITICAL: the `idx` passed to `validator_index` must remain the index into the FULL `phase.validators` list (not the filtered sub-list) so `_failing_on_failure` indexing stays correct.

---

### `backend/app/services/harness_engine.py` (EDIT — `timing:pre` seam + `ask_user` 4th disposition, D-10/D-11)

**Analog:** itself — `_run_phase_with_gates` (`harness_engine.py:590`), `_parse_on_failure` (`:549`), `_route_on_failure` (`:716`).

**D-10 `timing:pre` seam** — add a pre-gate pass BEFORE the executor body inside `_run_phase_with_gates` (the existing post-gate `run_gates` call is at `:666`). The pre-failure drives the SAME `_route_on_failure` path:

```python
# NEW pre-gate pass (before the while-loop executor body at :643)
pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")
if not pre.passed:
    return _route_on_failure(phase, pre.error_message, 0, pre.validator_index)
# the existing post-gate run_gates call (line 666) filters timing="post"
gate = await run_gates(phase, output, ctx, timing="post")
```

**D-11 `ask_user` 4th disposition** — extend `_parse_on_failure` (`:549-565`). Current enum recognition:

```python
def _parse_on_failure(on_failure: str) -> _OnFailure:
    target = parse_skip_target(on_failure)
    if target is not None:
        return _OnFailure("skip_to_phase", target)
    if on_failure in ("fail_run", "retry"):
        return _OnFailure("fail_run", None)
    return _OnFailure("fail_run", None)  # unknown → fail-safe
```

Add `ask_user` as a recognized value. **Anti-pattern caught (RESEARCH Pattern 3, Assumption A4):** `_route_on_failure` is a pure SYNC mapper — it cannot await the user. Resolve the `ask_user` pause INLINE inside `_run_phase_with_gates` (where `redis`/`pool`/`ctx` are in scope — see the kwargs at `:595-600`), then return `completed`/`fail_run` based on the answer. Keeps `run_workflow` unchanged.

**The `ask_user` pause is a NEW CALLER of the shipped `_exec_llm_human_input` flow** (`phase_types.py:594-685`) — copy its ordering verbatim (SUBSCRIBE → durable prompt row → emit `ask_user_prompt` → block on `subscribe_for_response`). The block primitive is `subscribe_for_response` (`ask_user_service.py`, single-sourced from `_subscribe_and_block:53` which enforces SUBSCRIBE → SADD → on_subscribed → block, the PUBLISH-before-SUBSCRIBE race fix at `:79-81`). **Proceed** writes an audit receipt + continues; **Abort** → `fail_run`; unanswered → existing expiry → honest fail.

---

### `backend/app/services/harness/phase_types.py` (EDIT — `citation_policy` post-verdict branch, D-01)

**Analog:** itself — `_exec_llm_emit` (`phase_types.py:1050`), the citation gate at `:1222-1277`.

**The strict branch (MUST stay byte-identical)** — `citation_policy="strict"` is the default and is exactly today's code path. The verdict computation (`check_coverage` at `:1222`) is UNCHANGED; the policy gates ONLY the disposition after the verdict. Current strict rejection (`:1235-1277`):

```python
gate = check_coverage(legacy_map, retrieved_ids, placeholder_keys)
if (gate["uncited_value_count"] == 0
        and gate["invented_citation_count"] == 0
        and not (oracle and missing_keys)):
    break  # gate passed — proceed to render
# ... else: per-attempt receipt → retry-with-feedback or honest fail (state b) ...
return _emit_failure_output("citation_gate_rejected", msg, field_map=legacy_map)
```

**Edit:** when `citation_policy != "strict"`, branch the disposition (NOT the verdict): `flag` = re-render with visible marks + coverage summary; `partial` = blank `gate["uncited_leaves"]` values + gap list; `draft` = label DRAFT, deliver. **Key reuse:** re-render off the WR-02-persisted field-map on `workflow_phases.output` (`db/workflows.fail_phase:372-391` carries the `field_map`) — NO new emit shot. The deterministic driver renders the marks (red line — never model-written code).

---

### `backend/app/models/harness.py` (EDIT — additive-optional fields, D-01/D-10/D-11/D-13)

**Analog:** itself — `LlmEmitPhaseConfig` (`:123`, the 101.1 additive-optional precedent), `ValidatorSpec` (`:163`), `WorkflowDefinition` (`:203`, the 098 additive-optional lock at `:210-217`).

**Discipline (the 101.1/098 precedent):** every model subclasses `_StrictBase` (`ConfigDict(extra="forbid")`, `:27-30`); new fields are optional-with-default so old JSONB rows `model_validate()` unchanged → ZERO migration for these.

**`ValidatorSpec`** (`:163-169`) — extend the LOCKED `kind` Literal with the 5 kinds, add `timing` and the `ask_user` `on_failure` value:

```python
class ValidatorSpec(_StrictBase):
    kind: Literal["json_schema", "regex_match", "workspace_file_exists", "programmatic",
                  "citations_required", "freshness", "structure_check",
                  "output_file_valid", "llm_judge_rubric"]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"   # + ask_user (D-11); on_failure stays a str (skip_to_phase:<slug> parses)
    max_retries: int = 2
    timing: Literal["pre", "post"] = "post"   # D-10 — default post = byte-identical
```

**`LlmEmitPhaseConfig`** (`:123-147`) — add `citation_policy: Literal["strict","flag","partial","draft"] = "strict"` and `integrity_policy: Literal["strict","documented_limit"] = "strict"` (F3 sibling). `strict` defaults keep every existing row byte-identical.

**`WorkflowDefinition`** (`:203-217`) — add `business_requirement: str | None = None` alongside the 098 block. Optional on draft; the publish ENDPOINT (not the schema) enforces "required at publish" (D-13). The `llm_judge_rubric` config rides a `ValidatorSpec.config` dict (frozen-on-publish, D-04).

---

### `backend/app/api/workflows.py` (EDIT — `POST /workflows/{id}/publish` route, D-07)

**Analog:** itself — `get_published_workflows` (`workflows.py:38-65`), the only existing route on this router.

**The route shape to copy** (auth via `Depends(get_current_user)`, FastAPI UUID coercion → 422, owner-scope at the db layer, `get_pg_pool()` for the asyncpg query):

```python
router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(
    project_folder_id: UUID | None = Query(None),
    current_user: dict = Depends(get_current_user),
) -> list[PublishedWorkflow]:
    pool = await get_pg_pool()
    user_id = current_user["id"]
    rows = await list_published_workflows(pool, user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                                          project_folder_id=project_folder_id)
    return [PublishedWorkflow(**r) for r in rows]
```

**Edit:** add `@router.post("/{definition_id}/publish")` on the SAME router. The path `definition_id: UUID` is FastAPI-coerced (422 on malformed, V5). Delegate to `publish_service.publish(...)`. Return a structured verdict `{blocked_stage, named_failures, golden_run_id}` on block (D-08), 200 on success. **G-5 RED LINE: this goes on `api/workflows.py`, NEVER `api/threads.py`** (9+ phases, must not grow — CLAUDE.md hot-file ledger).

---

### `backend/app/db/workflows.py` (EDIT — publish flip + golden-run flag + new audit kinds)

**Analog:** itself — `finish_run` (`:420-449`, the status-flip-in-a-txn precedent), `create_workflow_run` (`:69-138`), `write_audit` + `_AUDIT_EVENT_TYPES` (`:44-65`, `:499-535`).

**Publish flip** — mirror `finish_run`'s `UPDATE ... SET status=$2 WHERE id=$1` (`:437-441`), keyed by the table's own `id`, `$N` placeholders only.

**Golden-run flag** — extend `create_workflow_run` (`:111-122`) to accept `is_golden_run: bool = False` and add it to the INSERT column list (default False keeps every existing caller byte-identical).

**New audit kinds — LOCKSTEP (Pitfall 6):** extend `_AUDIT_EVENT_TYPES` (`:44-65`) IN THE SAME PLAN as the migration-070 CHECK ALTER. The frozenset is the fail-fast guard `write_audit` checks BEFORE any DB call (`:523-527`):

```python
if event_type not in _AUDIT_EVENT_TYPES:
    raise ValueError(f"write_audit event_type must be one of the ... harness_audit kinds ...")
```

Likely new kinds (Claude's discretion): `judge_verdict`, `publish_attempted`, `publish_blocked`, `publish_succeeded`, `policy_applied`, `validator_ask_user_approved`. **`harness_audit.user_id` is NOT NULL** — bind the run-owner explicitly (the 092-05 F1 lesson, `:516-521`).

---

### `backend/app/config.py` (EDIT — `harness_judge_model` setting, D-03)

**Analog:** itself — `Settings` harness knobs (`config.py:953`, `harness_phase_max_steps:953`; `ask_user_max_timeout_seconds:920`). Settings-not-env discipline (CLAUDE.md): a model id is a VALUE, not a secret.

**Pattern** — a named field with a default, env-overridable via pydantic-settings for free:

```python
harness_phase_max_steps: int = 12   # config.py:953 — the shape to mirror
```

Add `harness_judge_model: str | None = None` (None = a registry default; D-03 default to a `forced_emission: True` model so the verdict is forceable — `get_model_capability(judge_model).get("forced_emission")` should be True, verify against live `/models` at plan time per `feedback_prioritize_newest_models`).

---

### `supabase/migrations/070_*.sql` (NEW — CHECK ALTER + additive column)

**Analogs:** `069_harness_audit_emit_kinds.sql` (CHECK ALTER) + `068_workspace_template_ephemeral.sql` (additive column).

**CHECK ALTER pattern (069, verbatim shape):**

```sql
ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        'gate_passed','gate_failed','tool_refused',
        'run_started','run_completed','run_failed',
        'emit_forced','emit_recovered','emit_validated','emit_rejected',
        'emit_rendered','emit_integrity_failed','emit_failed',
        -- 102 new kinds (lockstep with _AUDIT_EVENT_TYPES):
        'judge_verdict','publish_attempted','publish_blocked','publish_succeeded',
        'policy_applied','validator_ask_user_approved'
    )
);
```
*(Source: `069_harness_audit_emit_kinds.sql:15-25` — does NOT touch the INSERT-only RLS, so receipt immutability holds.)*

**Additive column pattern (068, verbatim shape):**

```sql
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS is_golden_run boolean DEFAULT false;
COMMENT ON COLUMN public.workflow_runs.is_golden_run IS '...';
```
*(Source: `068_workspace_template_ephemeral.sql:9-11` — `ADD COLUMN IF NOT EXISTS ... DEFAULT`, default keeps every pre-102 row byte-identical. `workflow_runs` has no immutability trigger, so the column is safe.)*

**Apply discipline (CLAUDE.md, both 068+069 note it):** paste into the Supabase SQL editor (NEVER `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset), commit both files.

---

### Test files under `backend/tests/unit/` (NEW — Wave-0 convention)

**Analog:** `backend/tests/unit/test_harness_audit_emit.py:1-55`.

**The Wave-0 conventions to copy:**
- **xfail(strict=False) stub** — Wave-0 RED stubs are marked `xfail(strict=False)` so the suite exits 0 before the satisfying task lands, then un-marked to GREEN (`test_harness_audit_emit.py:4-6`).
- **Imports INSIDE the test body** — so a not-yet-existing symbol never breaks COLLECTION (`test_harness_audit_emit.py:12-13`, `:35`):

```python
def test_write_audit_accepts_emit_kinds():
    from app.db.workflows import _AUDIT_EVENT_TYPES
    for kind in _EMIT_KINDS:
        assert kind in _AUDIT_EVENT_TYPES
```
- **Offline assertion of the fail-fast frozenset** — assert lockstep against `_AUDIT_EVENT_TYPES` (a `len()` count check + per-kind membership, `:38-55`), NOT a live DB write.
- **Net-new proof:** per `feedback_mock_completeness` + SEED-056, mock ALL network deps, and prove net-new failures via baseline-checkout (revert the touched source to the wave base, confirm identical failures). The publish path's REAL acceptance is the LIVE golden run (D-05, no-mock) — the live UAT is the gate, not the mocked unit test (RESEARCH §568, Pitfall 4).

---

## Shared Patterns

### Closed-registry dispatch (never eval — T-091-17)
**Source:** `backend/app/services/harness/validators.py:62-104`
**Apply to:** `validator_kinds.py` (all 5 kinds), `publish_service.py` (judge emitter resolution).
A `kind`/`fn`/`emitter` resolves a CLOSED dict; an unknown name FAILS CLOSED (raises or `GateResult(False, ...)`), never dynamically imported/eval'd. The registry doubles as 103's author-facing menu (D-12), so per-kind config schemas stay legible.
```python
def register_validator(kind: str):
    def deco(fn):
        VALIDATOR_REGISTRY[kind] = fn
        return fn
    return deco
```

### Additive-optional Pydantic over JSONB (zero migration)
**Source:** `backend/app/models/harness.py:123-147` (`LlmEmitPhaseConfig`, the 101.1 precedent), `:210-217` (the 098 lock)
**Apply to:** ALL `models/harness.py` edits.
Every new field is optional-with-default on a `_StrictBase` (`extra="forbid"`); old JSONB rows `model_validate()` to defaults. The ONLY DB migration in this phase is the `harness_audit` CHECK + the `is_golden_run` column — the schema FIELDS (`business_requirement`, `citation_policy`, `timing`, rubric config) cost zero migration.

### Forced emission for any structured LLM output (the judge rides it)
**Source:** `backend/app/services/forced_emit.py:194-266`, consumed at `phase_types.py:1173-1206`
**Apply to:** `llm_judge_rubric` validator AND the publish judge call.
`forced_emit(...)` returns a STRUCTURED result; the caller branches on `result.get("failure")` (honest fail) vs `result["emitted"]`. Inherits TIER-FORCE/COERCE tiering (`:224-227`), narrated-JSON recovery, truncation rejection, and the provider_error backstop — a coerce/weak judge can NEVER silently produce an empty "pass". The judge verdict schema is flat, depth-2, `additionalProperties:false` (mirror `EmitFieldMap`).

### Status flip inside a transaction, keyed by own id
**Source:** `backend/app/db/workflows.py:420-449` (`finish_run`)
**Apply to:** the publish flip in `db/workflows.py`.
`$N` placeholders only (T-091-03), keyed by the table's own `id`, side-effects in ONE `con.transaction()`. The `draft → published` flip is allowed by the `workflow_definitions_block_published_update` trigger (`full-schema.sql:230` — only blocks `OLD.status='published'`).

### Audit-CHECK lockstep (INSERT-only receipts)
**Source:** `backend/app/db/workflows.py:44-65` + `:523-527`, migration `069:15-25`
**Apply to:** `db/workflows.py` + migration 070.
Extend `_AUDIT_EVENT_TYPES` (code) and the CHECK constraint (migration) IN THE SAME PLAN. A typo fails fast (ValueError) BEFORE the DB call, not as a Postgres 23514 mid-run. Receipts stay INSERT-only (no UPDATE/DELETE policy), keyed to `run_id`, `user_id` NOT NULL.

### Cross-worker pause/resume (the `ask_user` disposition)
**Source:** `backend/app/services/ask_user_service.py:53-87` (`_subscribe_and_block`), caller template `phase_types.py:594-685` (`_exec_llm_human_input`)
**Apply to:** the D-11 `ask_user` disposition in `harness_engine.py`.
SUBSCRIBE → SADD → durable prompt row → emit → block (PUBLISH-before-SUBSCRIBE race fix). Durable prompt row stamps the issuing `run_id` (the `get_pending_ask_user` resume matcher keys on it, `db/workflows.py:304-342`); expiry → honest fail (never a hung run). Do NOT reinvent — it is battle-tested in `llm_human_input`.

### Owner-scope on every route + db read (V4)
**Source:** `backend/app/api/workflows.py:38-65`, `backend/app/db/workflows.py:169`
**Apply to:** the publish endpoint.
`Depends(get_current_user)`; the db predicate is `status='published' AND (is_global OR created_by=$1)`. The publish endpoint owner-checks `created_by = current_user` BEFORE any work; the golden run + audit writes bind the run-owner `user_id` (092-05 F1 NOT-NULL stamp).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(none)* | — | — | Every file in this phase has a direct in-repo analog. The only MEDIUM-confidence surface is the `freshness.py` "newest relevant document" QUERY SHAPE (RESEARCH Open Q1 / A5) — the asyncpg-read PATTERN is `db/workflows.py:181`, but the exact `documents`/`document_chunks` upload-date column must be confirmed against `supabase/full-schema.sql` at plan time. This is a query-detail gap, not a missing-pattern gap. |

---

## Metadata

**Analog search scope:** `backend/app/services/harness/`, `backend/app/services/` (forced_emit, template_render_service, ask_user_service), `backend/app/models/`, `backend/app/api/`, `backend/app/db/`, `backend/app/config.py`, `supabase/migrations/`, `supabase/full-schema.sql`, `backend/tests/unit/`.
**Files scanned:** ~18 (12 analog source files read; 6 located via Glob/Grep).
**Pattern extraction date:** 2026-06-12
