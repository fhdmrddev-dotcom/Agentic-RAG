# Phase 099: Workflow ↔ Skill Composition - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 6 (5 modify + 1 new source + 1 new test)
**Analogs found:** 6 / 6 (every file has a verified in-repo analog — this phase is ~95% wiring of shipped seams)

> This phase is a **composition-of-shipped-primitives** phase. Every new file copies a pattern that already exists in the codebase (the 098 `folder_scope` work is the byte-for-byte template). The single net-new file (`harness/skill_snapshot.py`) clones the shape of `harness/scope.py`. No new libraries.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/harness.py` (modify) | model (Pydantic config) | transform (JSONB ⇄ typed) | same file — `folder_scope` field on the 3 LLM configs + `_folder_scope_requires_project` validator | exact (in-file template) |
| `backend/app/services/harness/phase_types.py` (modify) | service (phase executor) | request-response (LLM call framing) | same file — `_exec_llm_single`/`_exec_llm_agent`/`_exec_llm_batch_agents` + `_build_phase_tool_context` + `_retry_suffix` | exact (in-file seam) |
| `backend/app/services/tool_dispatcher.py` (modify) | service (tool handler) | request-response (gated branch) | same file — `_handle_search_documents` 098 gated-no-op (`if ctx.folder_subtree_ids is not None:`) + `ToolContext` field | exact (098 D-05a pattern) |
| `backend/app/services/harness/skill_snapshot.py` (NEW) | service (validate + materialize) | file-I/O + CRUD (Storage copy + JSONB write) | `backend/app/services/harness/scope.py` (two-function service shape) + `skills.py` Storage download/upload | role+flow match |
| `backend/app/api/threads.py` (modify — ONE LINE, G-5 hot file) | route (kickoff call-site) | request-response | same file — the `assert_folder_scopes_subset` call at lines 870–878 (ValueError→400) | exact (098 call-site) |
| `backend/tests/test_099_skill_composition.py` (NEW) | test | — | `backend/tests/test_098_scope_governance.py` (esp. `test_deep_noop`, offline fixtures) | exact (sibling phase) |

---

## Pattern Assignments

### `backend/app/models/harness.py` (model, transform)

**Analog:** same file — the 098 `folder_scope` additive-optional field on all three LLM configs, plus the `WorkflowDefinition` 098 additive block and its structural `@model_validator`.

**Additive-optional field pattern** (the byte-for-byte template — `harness.py:52,67,84`):
```python
class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]
    max_steps: int = 12
    wall_clock_seconds: int | None = None
    model: str | None = None
    folder_scope: list[UUID] | None = None  # 098 PROJ-02: resolved id list, NOT a prompt hint
    # 099 WFSKILL-01 lands HERE — same shape, on all THREE LLM configs (D-08):
    #   skill_ref: UUID | None = None          # D-09 resolved id, NOT a name
    #   skill_snapshot: SkillSnapshot | None = None   # materialized at first kickoff (D-01/D-02)
```

**`_StrictBase` (`extra="forbid"`) — why every new field MUST be optional with a default** (`harness.py:27-30`):
```python
class _StrictBase(BaseModel):
    """Base for all harness config models — rejects unknown keys (D-07)."""
    model_config = ConfigDict(extra="forbid")
```
Because `extra="forbid"`, an old published JSONB row only `model_validate()`s if the new field defaults cleanly. `skill_ref` / `skill_snapshot` MUST default to `None` (Pitfall 2). A nested `SkillSnapshot(_StrictBase)` model may have required inner fields — it only exists when present.

**Structural `@model_validator` pattern (pure-shape ONLY, NO DB)** (`harness.py:163-175`):
```python
@model_validator(mode="after")
def _folder_scope_requires_project(self) -> "WorkflowDefinition":
    # D-07 STRUCTURAL half only — the DB-aware ⊆ check lives in scope.py (a SERVICE),
    # NOT here. A validator has no supabase/user_id.
    for phase in self.phases:
        scope = getattr(phase.config, "folder_scope", None)
        if scope and self.project_folder_id is None:
            raise ValueError(...)
    return self
```
099 analog (Claude's Discretion #2): a pure structural validator may assert `skill_snapshot present ⇒ skill_ref present`. The DB-aware publish gate (skill exists/visible/enabled) goes in `skill_snapshot.py`, NEVER here (see Anti-Patterns).

**098 additive block on `WorkflowDefinition`** (`harness.py:154-161`) shows the zero-migration co-lock precedent — old rows `model_validate()` to defaults.

---

### `backend/app/services/harness/phase_types.py` (service, request-response)

**Analog:** same file — the `system_prompt =` framing seam (3 executors), the two-layer whitelist wiring, and `_build_phase_tool_context` (the single ToolContext-build seam where 098's `folder_scope` narrowing already attaches).

**The framing seam (D-05 — identical in all 3 executors)** (`phase_types.py:258, 302, 364`):
```python
# _exec_llm_single (line 258) and _exec_llm_agent (line 302):
system_prompt = phase.config.prompt + _retry_suffix(ctx)
# _exec_llm_batch_agents (line 364):
base_prompt = phase.config.prompt + _retry_suffix(ctx)
# 099 inserts the skill block BEFORE the retry suffix (lean per D-05 discretion):
#   system_prompt = phase.config.prompt + _skill_block(phase, ctx) + _retry_suffix(ctx)
# _skill_block returns "" when no snapshot (no-op); else a delimited "## Skill: {name}" block.
# llm_single (D-07): compose WITHOUT the file list (tools=[], read_skill_file inert).
```

**`_retry_suffix` — the exact "" -on -absent helper pattern `_skill_block` should mirror** (`phase_types.py:135-143`):
```python
def _retry_suffix(ctx) -> str:
    feedback = getattr(ctx, "retry_feedback", None)
    return ("\n\n" + feedback) if feedback else ""
```
`_skill_block(phase, ctx)` copies this shape: `getattr(phase.config, "skill_snapshot", None)` → `""` when absent (no-op), else the delimited block. Compose the trio `{name, instructions, files:[names]}` exactly as `load_skill` returns (D-06; see tool_dispatcher analog below).

**Two-layer whitelist wiring (D-04 auto-whitelist) — layer 1 (`_exec_llm_agent`)** (`phase_types.py:283-293`):
```python
whitelist = frozenset(phase.config.available_tools)
model = _effective_model(phase, ctx)
tools_override = apply_tool_budget(
    get_tools(getattr(ctx, "user_settings", None)), model, whitelist
)
# 099: when skill_ref present, compute effective = available_tools ∪ {"read_skill_file"}
#      and feed THAT to the whitelist + apply_tool_budget. read_skill_file is already a
#      registered handler (tool_dispatcher.py:1579). apply_tool_budget never drops a
#      whitelisted tool, so it survives the per-provider max_tools cap.
```

**Two-layer whitelist wiring — layer 2 + the snapshot-ctx attach seam (`_build_phase_tool_context`)** (`phase_types.py:208-215`):
```python
return ToolContext(
    ...
    folder_subtree_ids=_effective,          # 098 narrowing already attaches here
    available_tools=list(phase.config.available_tools),
    phase_whitelist=frozenset(phase.config.available_tools),  # D-05 layer 2 backstop
    workflow_run_id=getattr(ctx, "run_id", None),
)
# 099: when skill_ref present, add "read_skill_file" to BOTH available_tools and
#      phase_whitelist, AND attach the skill_snapshot onto a new ToolContext field
#      (e.g. skill_snapshot=...) — this is the SINGLE seam where snapshot ctx joins
#      the per-phase ToolContext (mirrors how folder_subtree_ids attaches at :186-191).
```

**098 `folder_scope` narrowing inside `_build_phase_tool_context`** (`phase_types.py:178-191`) is the exact precedent for "read a new `phase.config.*` field, compute a per-phase value, thread it onto the ToolContext." `skill_snapshot` attaches at the same seam.

**Substrate is unchanged** — `_exec_llm_agent` delivers the framing via `system_prompt_override` on `run_task_sub_agent` (`phase_types.py:315-323`); `llm_batch_agents` reuses the same substrate per branch.

---

### `backend/app/services/tool_dispatcher.py` (service, gated branch)

**Analog:** same file — the 098 D-05a gated-no-op in `_handle_search_documents`, the `ToolContext` dataclass (where new gated fields land), and `_handle_load_skill` (the D-06 composition vocabulary).

**The 098 gated-no-op (the D-04 red-line template)** (`_handle_search_documents`, `tool_dispatcher.py:179-193`):
```python
# Gated on `folder_subtree_ids is not None` so the shared search path is
# byte-identical for Deep whole-KB (D-05a). The block is inert when skipped.
if ctx.folder_subtree_ids is not None:
    _scope = set(map(str, ctx.folder_subtree_ids))
    _kept = [h for h in (results or []) if str(h.get("folder_id")) in _scope]
    ...
    # else: existing path runs unchanged (the red line)
```
099 analog in `_handle_read_skill_file`: add a gate at the TOP of the handler —
```python
snapshot = getattr(ctx, "skill_snapshot", None)   # the new ToolContext field
if snapshot is not None:
    # resolve args["filename"] against snapshot.file_manifest; download from snapshot prefix
    ... return ToolResult(result=...)
# ELSE: the existing live-skill resolution (lines 421-487) is UNCHANGED, byte-identical (SC#3)
```

**`_handle_read_skill_file` — the live path that must stay byte-identical** (`tool_dispatcher.py:420-487`). Key facts the gated branch mirrors:
- Live storage path scheme: `storage_path = f"{row['user_id']}/{row['id']}/{filename}"` (`:448`). Snapshot branch uses a `{def_id}/{version}/{filename}`-style prefix instead.
- Download: `ctx.supabase.storage.from_("skill-files").download(storage_path)` (`:450`) — **un-wrapped** (pre-existing pattern). Per Open Question 4, the gated READ branch may match this un-wrapped read for byte-symmetry (single small file); only the multi-file WRITE materializer needs `run_in_threadpool`.
- Ext-decode logic (`docx`/`xlsx`/`pptx`/text/binary, `:453-485`) is reusable verbatim on the snapshot bytes.
- **DO NOT touch lines 421-487** (Pitfall 4 — the SC#3 red line).

**`ToolContext` — where the new gated field lands** (`tool_dispatcher.py:59-106`). The 098 fields are the template: `folder_subtree_ids: list[str] | None` (`:69`), `phase_whitelist: "frozenset[str] | None" = None` (`:97`), `workflow_run_id: "UUID | None" = None` (`:106`) — each defaults so Deep dispatch is byte-identical. 099 adds `skill_snapshot: <shape> | None = None` the same way.

**`_handle_load_skill` — the D-06 composition vocabulary `_skill_block` mirrors** (`tool_dispatcher.py:376-380`):
```python
return ToolResult(result=json.dumps({
    "name": row["name"],
    "instructions": row["instructions"],
    "files": file_names,   # [filename, ...] — names only, NOT contents (D-06)
}))
```

**The owned-or-global + enabled skill resolution query (the D-09/D-10 publish-gate query, adapt `.eq("name")` → `.eq("id")`)** (`tool_dispatcher.py:338-345`):
```python
ctx.supabase.table("skills")
    .select("id, name, description, instructions, user_id")
    .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")  # owned-or-global (D-10)
    .eq("name", skill_name)        # 099 gate uses .eq("id", str(skill_ref))  (D-09)
    .eq("is_enabled", True)        # D-10 enabled gate
    .order("is_global")
```

---

### `backend/app/services/harness/skill_snapshot.py` (NEW — service, file-I/O + CRUD)

**Analog:** `backend/app/services/harness/scope.py` (the two-function async-service shape + module-doc threat posture) for the structure; `skills.py` Storage download/upload for the file-copy primitives.

**Service shape (clone `scope.py`'s two-function pattern)** (`scope.py:92-126`):
```python
# scope.py:92 — assert_folder_scopes_subset(definition, *, supabase, user_id) -> None
#   - a SERVICE, NOT a Pydantic validator (it needs supabase + user_id — scope.py:32-35
#     documents this exact anti-pattern)
#   - owner-scoped query, raises ValueError on violation → caller maps to 400
async def assert_folder_scopes_subset(definition, *, supabase, user_id) -> None:
    ...
    for phase in definition.phases:
        scope = getattr(phase.config, "folder_scope", None)
        if scope:
            outside = {str(f) for f in scope} - allowed
            if outside:
                raise ValueError(f"phase '{phase.slug}' ... not a subset ...")
```
099 mirrors this as TWO functions on `skill_snapshot.py` (RESEARCH Pattern 4):
- `validate_skill_refs(definition, *, supabase, user_id) -> None` — D-10 publish gate (skill exists/visible/enabled), raises `ValueError` on miss using the owned-or-global+enabled query above.
- `materialize_skill_snapshots(definition, *, supabase, user_id) -> WorkflowDefinition` (or an `..._if_needed` idempotent variant per D-03a) — copies instructions/name/description into the JSONB + Storage-copies each skill file.

**Storage download primitive (verified — `skills.py:553`, export path)**:
```python
raw = supabase.storage.from_("skill-files").download(f["file_path"])
```

**Storage upload primitive (verified — `skills.py:445-452`, file upload)**:
```python
supabase.storage.from_("skill-files").upload(
    path=storage_path,                              # {user_id}/{skill_id}/{filename} live;
    file=raw,                                       #   099 snapshot → {user_id}/_snapshots/{def_id}/{version}/{filename}
    file_options={
        "content-type": file.content_type or "application/octet-stream",
        "upsert": "true",                           # idempotent re-write (D-03a re-snapshot safe)
    },
)
```
**There is NO `.copy()` primitive** — the Storage-to-Storage copy is a `download()` then `upload()` pair (RESEARCH §Standard Stack; `[VERIFIED: no storage.*copy call anywhere in the repo]`).

**`run_in_threadpool` wrapping (D-v2.5-01 — Pitfall 1)** — `from starlette.concurrency import run_in_threadpool` is already imported in `tool_dispatcher.py:26`. The materializer's `.download()`/`.upload()` calls MUST be wrapped (NEW code does it right; the multi-file copy would otherwise block the event loop). Example call shape for a supabase-py blocking call wrapped: `await run_in_threadpool(lambda: supabase.storage.from_("skill-files").download(path))`.

**Idempotency / no-op contract** (D-03a): if the published definition's skill-bearing phases already carry `skill_snapshot`, return unchanged (the snapshot lives in DB JSONB + Storage — shared across workers, never an in-process cache; Pitfall 3).

**Storage prefix / RLS decision (Claude's Discretion — Pitfall 7):** recommended `{user_id}/_snapshots/{def_id}/{version}/{filename}` in the existing `skill-files` bucket — the existing first-segment-= -auth.uid RLS (`017_skills.sql:102-116`) still grants the author read; harness runs as service role anyway (`scope.py:24-26`). Note for Phase 109 that global publish needs a global-readable variant. NO bucket migration on the recommended path.

---

### `backend/app/api/threads.py` (route, request-response — ONE LINE ONLY, G-5 hot file)

**Analog:** same file — the 098 `assert_folder_scopes_subset` call-site at kickoff (the ValueError→400 mapping). 099 adds exactly one analogous call into `skill_snapshot.py`; it must NOT grow `threads.py` (G-5 — extraction still due, 9+ touches).

**The kickoff call-site + ValueError→400 mapping (the verbatim template)** (`threads.py:870-878`):
```python
try:
    await assert_folder_scopes_subset(
        _kickoff_definition, supabase=supabase, user_id=current_user["id"]
    )
except ValueError as _scope_err:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(_scope_err),
    )
# 099: the snapshot service is called the SAME way, right after model_validate()
#      (line 863) / alongside the 098 assert. validate_skill_refs raises ValueError →
#      same 400 mapping; materialize_skill_snapshots_if_needed runs lazily (D-03a).
```

**Import line** (`threads.py:46`): `from app.services.harness.scope import resolve_project_subtree, assert_folder_scopes_subset` — 099 adds one analogous import from `app.services.harness.skill_snapshot`.

**The published-definition resolution this slots after** (`threads.py:836-863`): the `model_validate()` of the owned-or-global, `status='published'` definition (drafts can't run — D-03's simplifying fact, `:854`). The snapshot call goes between `_kickoff_definition = WorkflowDefinition.model_validate(_raw_def)` (`:863`) and the existing 098 assert.

---

### `backend/tests/test_099_skill_composition.py` (NEW — test)

**Analog:** `backend/tests/test_098_scope_governance.py` — the sibling-phase test file. Same offline-fixture conventions, the `test_deep_noop` red-line proof, the `SimpleNamespace` minimal-config helpers.

**Offline-fixture convention (module doc, `test_098_scope_governance.py:23-25`):** unit tests use conftest fakes — `_FakeRedis` / `make_tool_context` / `fake_redis` / `mock_asyncpg_pool` — no live Redis/Postgres. `[VERIFIED in conftest.py: make_tool_context:621, fake_redis:615, mock_asyncpg_pool:507, _FakeRedis:551]`. `make_tool_context` already returns a `SimpleNamespace` carrying every `ToolContext` field; pass `skill_snapshot=...` as an override the same way 098 used `folder_subtree_ids=...`.

**The `test_deep_noop` red-line template (SC#3 — copy this exactly)** (`test_098_scope_governance.py:128-149`):
```python
async def test_deep_noop(make_tool_context, fake_redis, monkeypatch):
    """Deep path emits NO new behavior when the new ctx field is absent — byte-identical (D-05a)."""
    monkeypatch.setattr(td, "search_documents", _fake_search)
    ctx = make_tool_context(folder_subtree_ids=None, emit=_emit, spawn=_close_spawn)
    await _handle_search_documents({"query": "q"}, ctx)
    emitted = [json.loads(f["data"]) for _s, f in fake_redis.xadds if "data" in f]
    assert not any(p.get("type") == "scope_violation" for p in emitted)
```
099 analog: `ctx = make_tool_context(skill_snapshot=None)`; call `_handle_read_skill_file({...}, ctx)` and assert it returns byte-identical to the pre-099 live path (no snapshot routing fires).

**Minimal-config `SimpleNamespace` helpers (clone `_phase` / `_harness_ctx`)** (`test_098_scope_governance.py:53-71`):
```python
def _phase(folder_scope):
    return SimpleNamespace(config=SimpleNamespace(
        folder_scope=folder_scope, available_tools=["search_documents"], model=None))
def _harness_ctx(folder_subtree_ids):
    return SimpleNamespace(producer_run_id=uuid4(), run_id=uuid4(),
        folder_subtree_ids=folder_subtree_ids, model="m")
```
099 clones these for `skill_ref` / `skill_snapshot` to drive `_build_phase_tool_context` (auto-whitelist) and `_skill_block` (framing compose).

**Faked-Storage recorder for `test_snapshot_materialize`** (Wave 0 gap): no such fixture exists yet — add a download/upload recorder modeled on the conftest `_FakeRedis` XADD-recorder pattern (`conftest.py:551`). The 8 unit tests map to SC#1/#2/#3 per RESEARCH §Validation Architecture.

---

## Shared Patterns

### Additive-optional `_StrictBase` field (zero-migration)
**Source:** `backend/app/models/harness.py:27-30` (`_StrictBase`), `:52,67,84` (`folder_scope`), `:154-161` (098 `WorkflowDefinition` block)
**Apply to:** `harness.py` (`skill_ref`, `skill_snapshot` on all 3 LLM configs)
Every new field MUST default to `None`/a value so old published JSONB rows `model_validate()` cleanly under `extra="forbid"` (Pitfall 2). Nested `SkillSnapshot(_StrictBase)` may have required inner fields.

### Gated no-op on a shared path (098 D-05a — the Deep red line)
**Source:** `backend/app/services/tool_dispatcher.py:179` (`if ctx.folder_subtree_ids is not None:`)
**Apply to:** `_handle_read_skill_file` (gate on `ctx.skill_snapshot is not None`), every new `ToolContext` field (default `None`)
Absent context ⇒ existing behavior runs byte-identical. Proven by a `test_deep_noop`-style unit test + the live SSE byte-identical diff (SC#3).

### DB-aware validation as an async SERVICE, never a Pydantic validator
**Source:** `backend/app/services/harness/scope.py:32-35` (the documented anti-pattern) + `:92` (`assert_folder_scopes_subset`)
**Apply to:** `skill_snapshot.validate_skill_refs` (the D-10 publish gate)
A validator has no `supabase`/`user_id`. DB-aware checks (skill exists/visible/enabled) belong in `skill_snapshot.py`; only pure-shape checks (`skill_snapshot ⇒ skill_ref`) may live in a `@model_validator`.

### `ValueError → 400` at the kickoff call-site
**Source:** `backend/app/api/threads.py:870-878`
**Apply to:** the one-line `skill_snapshot` call in `threads.py` kickoff
A definition-validity failure maps to a 400 the same way the 098 scope assert does. The call is a ONE-LINER into the service (G-5 — do not grow `threads.py`).

### Owned-or-global + enabled skill resolution query
**Source:** `backend/app/services/tool_dispatcher.py:338-345` (`_handle_load_skill`)
**Apply to:** `skill_snapshot.validate_skill_refs` (adapt `.eq("name")` → `.eq("id", str(skill_ref))`, D-09)
`.or_(f"user_id.eq.{uid},is_global.eq.true").eq("is_enabled", True)` — the visibility predicate workflow kickoff already uses; a non-visible id raises `ValueError` → 400, never leaks existence (IDOR mitigation).

### Storage-to-Storage copy via download()+upload() (no native .copy)
**Source:** `backend/app/api/skills.py:553` (download) + `:445-452` (upload with `"upsert":"true"`)
**Apply to:** `skill_snapshot.materialize_skill_snapshots` (per-file copy into the snapshot prefix)
Wrap both calls in `run_in_threadpool` (D-v2.5-01; `run_in_threadpool` already imported at `tool_dispatcher.py:26`). The existing un-wrapped read in `_handle_read_skill_file:450` is a pre-existing pattern — match it on the gated READ branch for byte-symmetry, wrap only the multi-file WRITE.

### `load_skill` composition vocabulary `{name, instructions, files:[names]}`
**Source:** `backend/app/services/tool_dispatcher.py:376-380`
**Apply to:** `_skill_block` in `phase_types.py` (the framing compose, D-06 — names only, contents on demand)

### Offline test fixtures + `test_deep_noop` red-line proof
**Source:** `backend/tests/conftest.py:621` (`make_tool_context`), `:615` (`fake_redis`), `:507` (`mock_asyncpg_pool`), `:551` (`_FakeRedis`); `backend/tests/test_098_scope_governance.py:128` (`test_deep_noop`)
**Apply to:** `test_099_skill_composition.py` (all 8 unit tests)
No live Redis/Postgres; `make_tool_context(skill_snapshot=...)` drives the gated branch; the live cross-provider round-trip stays manual UAT in VALIDATION.md.

---

## No Analog Found

None. Every file in this phase has a verified in-repo analog. The one net-new module (`harness/skill_snapshot.py`) is structurally cloned from `harness/scope.py` (two-function async service) with Storage primitives from `skills.py`; it is "new file" but not "no analog."

---

## Metadata

**Analog search scope:** `backend/app/models/harness.py`, `backend/app/services/harness/{scope,phase_types}.py`, `backend/app/services/tool_dispatcher.py`, `backend/app/api/{threads,skills}.py`, `backend/tests/{test_098_scope_governance,conftest}.py`
**Files scanned:** 9 (all `[VERIFIED]` against live code this session; line numbers confirmed)
**Pattern extraction date:** 2026-06-10
**Note for planner:** the snapshot HOST decision (D-03a — snapshot-at-first-kickoff, lazy + idempotent, via a standalone `skill_snapshot.py` service callable later by the Phase 103 publish endpoint) is locked in CONTEXT. The `threads.py` call must stay one line (G-5). Storage prefix/RLS is Claude's Discretion (Pitfall 7 — recommended `{user_id}/_snapshots/{def_id}/{version}/...`).
