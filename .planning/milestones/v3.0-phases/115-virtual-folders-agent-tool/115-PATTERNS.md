# Phase 115: Virtual Folders — Agent Tool - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 6 (1 new module + 5 modified)
**Analogs found:** 6 / 6 (every new/modified file has an in-repo analog — this phase is wiring over shipped code)

> This is a **Python/FastAPI backend** phase that adds **ONE new agent tool** wrapping the
> already-shipped Phase 113/114 resolve path + closed filter compiler. There is no new query
> path, no new compiler, and **no migration** (D-115-11). Almost every "hard" part already
> exists — the planner's job is to copy these analogs verbatim, NOT re-implement.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/tool_dispatcher.py` (+1 handler `_handle_query_documents_by_view`, +1 `_TOOL_REGISTRY` line) | service / tool-handler | request-response (model→tool→result) | `_handle_search_documents` (`tool_dispatcher.py:173`) | **exact** (same handler shape: caller-scoped resolve + `source_refs` + fire-and-forget `search.query` audit) |
| `backend/app/services/openai_service.py` (+1 schema const `QUERY_DOCUMENTS_BY_VIEW_TOOL`, +1 `get_tools()` assembly entry) | config / tool-schema | request-response | `SEARCH_DOCUMENTS_TOOL` (`openai_service.py:17`) + `RENDER_TEMPLATE_TOOL` (`:528`) | **exact** (nested-object optional-arg schema; both production cross-provider) |
| `backend/app/services/document_view_resolver.py` (**NEW** — extracted `_resolve_filter` + `_relative_window` + `_build_field_meta`, raises `ResolveError` not `HTTPException`) | service | CRUD (read/resolve) | `_resolve_filter` + helpers in `document_views.py:363` | **role-match** (same logic, extracted to a non-HTTP injectable service) |
| `backend/app/api/document_views.py` (routes become thin wrappers importing the extracted core; byte-identical behavior) | route | request-response | itself (`resolve_view :294`, `resolve_adhoc :327`) | **exact** (existing call sites — regression-guarded by the live integration suite) |
| `backend/app/services/document_view_service.py` (optional small `get_view_by_name` own-or-global helper) | service | CRUD (read) | `get_view` (`document_view_service.py:113`) | **exact** (own-or-global `.or_(...)` lookup, 404-not-403 collapse) |
| Tests: `tests/unit/test_115_*.py` + `tests/integration/test_115_*.py` | test | n/a | `tests/integration/test_113_view_global_leak.py` (clone for the two-user leak proof) | role-match |

---

## Pattern Assignments

### `tool_dispatcher.py` — new handler `_handle_query_documents_by_view` (service, request-response)

**Analog:** `_handle_search_documents` (`backend/app/services/tool_dispatcher.py:173-245`) — THE closest handler. Copy four things: (1) caller-scoped resolution via `ctx.current_user["id"]`, (2) `source_refs`/`citations` accumulation, (3) the Phase 098 scope-clip + `scope_violation` emit pattern (only if the planner decides to thread-clip — see Open Q below), (4) the fire-and-forget `search.query` audit via `ctx.spawn(write_audit_entry(...))` (the **D-115-10 reuse target**).

**`<read_first>` for the planner:**
- `tool_dispatcher.py:59-125` (the `ToolContext` dataclass + `ToolResult`)
- `tool_dispatcher.py:173-245` (`_handle_search_documents`)
- `tool_dispatcher.py:2353-2382` (`_TOOL_REGISTRY`)
- `tool_dispatcher.py:2417-2439` (`dispatch_tool` + the `phase_whitelist` guard)

**ToolContext fields the handler reads** (`tool_dispatcher.py:59-114`):
```python
@dataclass
class ToolContext:
    redis: Any
    run_id: UUID
    thread_id: str
    supabase: Any                       # → pass to document_view_service + the extracted resolver
    pool: Any
    user_settings: Any
    current_user: dict                  # {"id": str, ...} → caller = ctx.current_user["id"] (VIEW-06)
    folder_subtree_ids: list[str] | None  # do NOT pass into the resolver (Pitfall 4); the view owns its scope
    ...
    emit: Callable[..., Awaitable[None]]
    spawn: Callable                     # → ctx.spawn(write_audit_entry(...)) — fire-and-forget audit
    ...
    phase_whitelist: "frozenset[str] | None" = None  # None in Deep Mode → SC#2 guard is a no-op
```

**ToolResult — the citable-answer channel** (`tool_dispatcher.py:117-125`):
```python
@dataclass
class ToolResult:
    result: str                                    # the tool_result JSON string (compact rows + true total + note)
    llm_content: str | None = None
    source_refs: list[dict] = field(default_factory=list)  # [{document_id, filename}] — D-115-4 citable channel
    citations: list[dict] = field(default_factory=list)    # a listing has no chunk passage → source_refs is the honest shape
    similarity_score: float | None = None
    sub_agent_record: dict | None = None
```

**Caller-scoped resolve + `source_refs` accumulation** (copy the shape — `_handle_search_documents:202-245`):
```python
    tool_result = json.dumps(results) if results else "No relevant documents found."
    source_refs: list[dict] = []
    citations: list[dict] = []
    if results and isinstance(results, list):
        for hit in results:
            doc_id = hit.get("document_id") or hit.get("id")
            filename = hit.get("filename") or hit.get("document_name")
            if doc_id and filename:
                source_refs.append({"document_id": doc_id, "filename": filename})
                # search appends a full chunk-citation here; a VIEW listing has no passage →
                # source_refs only (D-115-4 — planner confirms richness)
    return ToolResult(result=tool_result, source_refs=source_refs, citations=citations, ...)
```

**Fire-and-forget `search.query` audit — the D-115-10 reuse target verbatim** (`_handle_search_documents:227-238`):
```python
    # Audit: fire-and-forget inside async generator (AUDIT-02)
    _audit_doc_ids = list({
        h.get("document_id") or h.get("id")
        for h in (results or [])
        if h.get("document_id") or h.get("id")
    })
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",                # D-115-10: REUSE this action — no new enum, no migration
        metadata={"query_text": args["query"], "document_ids": _audit_doc_ids},  # 115: tag {via:"view"/"filter", view_id, ...}
        supabase=ctx.supabase,
    ))
```
`write_audit_entry` signature (`audit_service.py:57-62`) — copy exactly:
```python
async def write_audit_entry(user_id: str, action_type: str, metadata: dict, supabase: Client) -> None:
    # Exceptions are caught, logged, swallowed (D-05) — failure never breaks the answer.
```

**Pitfall 4 (load-bearing) — do NOT thread-clip by default.** `_handle_search_documents:187-201` clips results to `ctx.folder_subtree_ids` and emits `scope_violation`. The view resolver does its OWN caller+view scoping and ignores the thread subtree. **Do NOT pass `ctx.folder_subtree_ids` into the resolver** — "run the view" semantics. RESEARCH Open Q1 flags whether a folder-scoped thread should additionally intersect; v1 recommendation = do NOT thread-clip (it is a one-line `.in_("folder_id", ...)` post-filter if product later wants parity). The `scope_violation` emit block (`:187-201`) is the pattern to copy IF the planner chooses to thread-clip.

**`_TOOL_REGISTRY` one-line registration** (`tool_dispatcher.py:2353-2382` — add ONE line, mirror the `render_template` G-5 comment at `:2380-2381`):
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    "ls": _handle_ls,
    ...
    "render_template": _handle_render_template,
    # Phase 115 (VIEW-07) — agent tool over the 113/114 resolve path (G-5: handler + one line; threads.py untouched)
    "query_documents_by_view": _handle_query_documents_by_view,   # ← the +1 line
}
```

**`dispatch_tool` `phase_whitelist` guard — SC#2 is FREE** (`tool_dispatcher.py:2424-2435`). The tool must NOT be special-cased around this guard; `None` in Deep Mode = literal no-op (byte-identical):
```python
async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        allowed = sorted(ctx.phase_whitelist)
        _spawn_tool_refused_audit(ctx, tool_name, allowed)           # D-06 fire-and-forget
        return ToolResult(result=json.dumps({"error": "tool_not_available_in_phase", ...}))
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)
```

---

### `openai_service.py` — new schema constant `QUERY_DOCUMENTS_BY_VIEW_TOOL` + `get_tools()` entry (config, request-response)

**Analogs:** `SEARCH_DOCUMENTS_TOOL` (`openai_service.py:17-53`) for the optional-nested-object arg; `RENDER_TEMPLATE_TOOL` (`:528-589`) for the nested object with **`required` sub-fields**. Both are production-working across the native-7 on the **non-strict Deep chat path**.

**`<read_first>` for the planner:**
- `openai_service.py:17-96` (`SEARCH_DOCUMENTS_TOOL`, `QUERY_DOCUMENTS_TOOL` — note the description does the routing work / contrast — D-115-5)
- `openai_service.py:520-593` (`_build_render_template_tool` — the nested-object-with-`required` schema-shape exemplar)
- `openai_service.py:873-889` (`get_tools()` assembly — **the second wiring site, SC#1**)

**The nested-optional-object arg shape to model `view`-XOR-`filter` on** — `SEARCH_DOCUMENTS_TOOL`'s optional `metadata_filter` (`openai_service.py:31-51`):
```python
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "..."},
                "metadata_filter": {                       # ← OPTIONAL nested object, NOT in `required`
                    "type": "object",
                    "description": "Optional JSONB containment filter ... OMIT unless ...",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["query"],                          # ← only `query` required → metadata_filter genuinely optional
        },
```

**The nested object WITH `required` sub-fields** — `RENDER_TEMPLATE_TOOL`'s `asset` (`openai_service.py:564-577`). This is the precedent for the inline `filter` arg (a nested object whose own sub-fields are `required`, proven cross-provider — DeepSeek's `additionalProperties:false`+all-required nested-object rule is already satisfied by this shape):
```python
                    "asset": {
                        "type": "object",
                        "description": "Optional. A trusted library template reference. Omit to ...",
                        "properties": {
                            "asset_id": {"type": "string"},
                            "filename": {"type": "string"},
                            "kind": {"type": "string", "enum": ["template", "reference"]},
                            "mime": {"type": "string"},
                        },
                        "required": ["asset_id", "filename", "kind", "mime"],   # ← required ON the nested object
                    },
```

**The flat `view`-XOR-`filter` recommendation (RESEARCH §Pattern 1 — the load-bearing design).** Two genuinely-optional flat fields (`view: string`, `filter: object`, `limit: integer`), the either/or invariant in PROSE, validated at the handler edge. **No `anyOf`/`oneOf` anywhere** (Gemini rejects them in function-calling params — RESEARCH Pitfall 1). No top-level `required` → catalog mode (neither field) is reachable. The full drop-in schema is in **RESEARCH.md:144-216** — copy it; the inline-`filter` `op`/condition-`op` enums MUST match the `ViewCondition.op` Literal exactly (see the AST analog below) so the parsed object validates against `ViewFilter.model_validate(...)` without translation.

**`get_tools()` assembly — the SECOND wiring site (SC#1, guards the inverse-Phase-101 bug)** (`openai_service.py:873-889`):
```python
def get_tools(user_settings: "UserEffectiveSettings | None" = None) -> list[dict]:
    effective = user_settings if user_settings is not None else None
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
             REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL,
             WORKSPACE_WRITE_TOOL, WORKSPACE_READ_TOOL, WORKSPACE_LIST_TOOL,
             WORKSPACE_DELETE_TOOL, WORKSPACE_DIFF_TOOL,
             WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL,
             # Phase 115 (VIEW-07) — D-115-8: ADD HERE so the Deep-mode model actually SEES it (SC#1).
             QUERY_DOCUMENTS_BY_VIEW_TOOL]   # ← the +1 entry
    ...
```
> **INVERSE of `render_template`:** `render_template` is in `_TOOL_REGISTRY` but deliberately NOT in `get_tools()` (harness-only). This tool MUST be in BOTH (D-115-8). Acceptance = the model **actually invokes it live** (RESEARCH Pitfall 5), not just registry presence. Note `apply_tool_budget` (`:892`) only filters on the harness path (Google `max_tools:16`); Deep stays byte-identical.

---

### `document_view_resolver.py` — **NEW** extracted resolver (service, CRUD/resolve)

**Analog:** `_resolve_filter` + `_relative_window` + `_build_field_meta` currently inside `backend/app/api/document_views.py`. **Extract verbatim** into a service module so the handler does not import a FastAPI route or raise `HTTPException` on the agent path. The route keeps its 404/422 mapping; the agent handler maps a `ResolveError` → a calm `ToolResult` JSON string (RESEARCH Pitfall 2).

**`<read_first>` for the planner (the full resolve core):**
- `document_views.py:363-549` (`_resolve_filter` — the leak-safe core, read in full)
- `document_views.py:82-128` (`_relative_window` — server-clock window, D-114-16)
- `document_views.py:130-153` (`_build_field_meta` / `_build_whitelist` — the field whitelist)

**Current signature (the extraction target)** (`document_views.py:363-370`):
```python
async def _resolve_filter(*, caller: str, flt: ViewFilter, folder_scope: str | None,
                          count_only: bool, supabase: Client):
    """The SHARED, leak-safe resolve core (114 CR-01) — used by BOTH resolve_view AND resolve_adhoc.
    Caller MUST have already done any readability gate; every documents query leg is scoped from
    `caller` (the VIEW-06 invariant). Returns {"total": N} when count_only else {"documents": [...], "total": N}."""
```

**The ONLY behavioral change in the extraction (Pitfall 2 — load-bearing):** today the core raises `HTTPException` at TWO spots (`document_views.py:389-390` and `:401-405`):
```python
    try:
        view_filter_compiler.validate_fields(flt, whitelist)
        view_filter_compiler.validate_operands(flt, number_fields)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))   # ← :390
    ...
    for frag in fragments:
        if frag.leg == "custom" and frag.field not in whitelist:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,            # ← :402
                                detail=f"filter field {frag.field!r} is no longer available")
```
→ In the extracted module, raise a plain `ResolveError(detail, status)` here instead. The **route** re-wraps `ResolveError → HTTPException` (byte-identical route behavior); the **agent handler** catches `ResolveError → ToolResult(result=json.dumps({"status":"invalid_filter","message":e.detail}))`. This also makes a bad model-supplied filter **self-correcting** (the message points it at the catalog).

**Reuse the count-only mode for the TRUE total (D-114-15 / Pitfall 3)** — `len(capped_rows)` LIES; call the core with `count_only=True` (`document_views.py:493-517`):
```python
    if count_only:
        own_ids = {d["id"] for d in (await aexec(_apply(
            supabase.table("documents").select("id").eq("user_id", caller).eq("is_latest", True)))).data or []}
        glob_ids: set[str] = set()
        if global_folder_ids:
            glob_ids = {d["id"] for d in (await aexec(_apply(
                supabase.table("documents").select("id").in_("folder_id", global_folder_ids).eq("is_latest", True)))).data or []}
        return {"total": len(own_ids | glob_ids)}   # own+global DISTINCT dedupe — NEVER own.count + global.count
```

**The caller-scoped two-leg listing + newest-first merge (the VIEW-06 invariant — copy by reusing, never fork)** (`document_views.py:519-549`):
```python
    own = _apply(supabase.table("documents").select("*").eq("user_id", caller).eq("is_latest", True))  # CALLER, never view.user_id
    own_docs = (await aexec(own)).data or []
    global_docs: list[dict] = []
    if global_folder_ids:
        glob = _apply(supabase.table("documents").select("*").in_("folder_id", global_folder_ids).eq("is_latest", True))
        global_docs = (await aexec(glob)).data or []
    # merge, dedupe by id, sort created_at desc (newest-first, D-113-1)
    ...
    merged.sort(key=lambda d: d["created_at"], reverse=True)
    return {"documents": merged, "total": len(merged)}
```

**Relative-date window — reuse `_relative_window`, never re-derive (D-114-16 / Pitfall — "today" from server clock at resolve time)** (`document_views.py:82` + applied at `_apply :455-467`). The agent tool inherits live recompute FOR FREE by reusing the resolver (D-115-9).

**Route call sites the extraction must preserve (regression-guarded):**
- `resolve_view` (`document_views.py:294-324`) — does the readability gate (`get_view` → 404-not-403 at `:308-310`) THEN calls `_resolve_filter`.
- `resolve_adhoc` (`document_views.py:327-360`) — stateless, calls `_resolve_filter` directly with the inline `filter_expr`.
Both become thin wrappers importing the extracted core + adding the HTTP error mapping. Live integration suite is the regression guard.

---

### `document_view_service.py` — optional `get_view_by_name` helper (service, CRUD/read)

**Analog:** `get_view` (`document_view_service.py:113-127`) — the own-or-global readability lookup. The saved-view-by-NAME mode needs a name lookup (the model never sees UUIDs, D-115-1). Either add a thin `get_view_by_name` mirroring `get_view`, OR filter `list_views(...)` by case-insensitive name in the handler (planner's call — RESEARCH:361).

```python
async def get_view(view_id, user_id, supabase: Client | None = None) -> dict | None:
    """Return the view if the caller can read it (own OR global), else None.
    The 404-not-403 readability check the resolve route's leak-safety depends on (D-113-4)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE).select("*").eq("id", view_id)
        .or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")   # own OR global; not-readable → empty → None
    )
    return (result.data or [None])[0]
```
> Note `_uid(user_id)` (`document_view_service.py:51-62`) coerces to a canonical UUID string before it is interpolated into the `.or_()` filter grammar (WR-02 hardening) — keep this if cloning into `get_view_by_name`. **Unknown view name → catalog, NEVER an existence leak** (D-115-6) — the handler routes a `None` lookup to catalog mode.

---

### Tests — `tests/integration/test_115_tool_global_leak.py` (test)

**Analog:** `backend/tests/integration/test_113_view_global_leak.py` — clone it, but **drive the TOOL HANDLER** (not the route), so the agent path itself is proven leak-safe. Two users + ONE seeded global view → per-viewer result sets, counts differ, no cross-user ids, 404-not-403 on unseeable. RESEARCH §"What is automatable vs manual-UAT" enumerates the full Wave-0 test gap list (`115-RESEARCH.md:454-461`). Framework: pytest + pytest-asyncio, `:54322` live, skips when unreachable.

---

## Shared Patterns

### The 113/114 AST — the inline-`filter` arg IS this Pydantic shape (no new AST — D-113-6)
**Source:** `backend/app/models/document_view.py:34-69`
**Apply to:** the `QUERY_DOCUMENTS_BY_VIEW_TOOL` schema's `filter` arg + the handler's `ViewFilter.model_validate(inline)`.
The tool's inline-`filter` enum values MUST match these `Literal`s exactly:
```python
class ViewCondition(BaseModel):
    field: str
    op: Literal["eq", "gte", "lte", "one_of", "contains", "is_empty",
                "within_next", "older_than", "before", "after", "between"]   # ← schema enum MUST match
    value: str | int | float | bool | None = None
    value2: str | int | float | None = None      # upper bound for `between`
    values: list[str | int | float] | None = None  # membership list for `one_of`
    unit: Literal["days", "weeks", "months"] | None = None  # relative-date span unit

class ViewFilter(BaseModel):
    op: Literal["and"]                              # flat AND only (D-113-7)
    conditions: list[ViewCondition] = []            # empty = no narrowing (D-113-9)
```

### The closed compiler — the ad-hoc-filter mode compiles through this (no fork — SC#4)
**Source:** `backend/app/services/view_filter_compiler.py`
**Apply to:** reached for free by reusing `_resolve_filter` (which calls `validate_fields :263`, `validate_operands :214`, `compile_filter :175` over the closed `OPERATOR_REGISTRY :118`). The full Phase-114 operator set is already registered. Bound-literal parameterization (every value rides as a PostgREST param, every field is a whitelisted constant) is the SC#4 injection invariant — it stays green BY REUSING this compiler. `validate_operands` already rejects range ops on custom number fields (WR-01 — RESEARCH Pitfall 6); a forked query builder would re-open the leak/injection risk.

### Field whitelist — single source the catalog advertises AND the compiler validates against (no drift — D-115-2)
**Source:** `backend/app/models/metadata_field.py:17` (`_BUILTINS`) + `backend/app/services/metadata_field_service.py:34` (`list_field_definitions`)
**Apply to:** catalog mode's field list. Reuse the SAME assembly the resolver uses — `_build_field_meta` (`document_views.py:130-147`) does `_METADATA_BUILTINS | {enabled custom defs}`:
```python
_BUILTINS = {"title", "author", "date", "document_type", "topics", "language", "summary"}  # metadata_field.py:17
# document_views.py:142-147 — the whitelist the catalog must mirror:
defs = await metadata_field_service.list_field_definitions(user_id, supabase=supabase)
enabled_custom = {d["field_key"] for d in defs if d.get("enabled")}
return _METADATA_BUILTINS | enabled_custom, number_custom   # ← catalog advertises ≡ compiler accepts
```
`_`-prefixed keys are excluded by `validate_fields` itself (D-111-9 / D-113-8 — never whitelisted).

### `aexec` / `run_in_threadpool` around every sync supabase-py call (D-v2.5-01)
**Source:** `backend/app/utils/db.py` `aexec` — used throughout `_resolve_filter` and both services.
**Apply to:** every `.execute()` in the extracted resolver + any new `get_view_by_name`. Inherited free by reusing the existing functions.

### ToolContext construction — the handler runs inside the agent loop's per-iteration ctx
**Source:** `backend/app/services/agent_loop.py:2036-2064`
**Apply to:** nothing to change here — confirms `current_user`, `supabase`, `spawn`, `phase_whitelist=None` (Deep), and `folder_subtree_ids` are all already on the ctx the handler receives. `active_tools` (`:2060-2063`) is derived from `get_tools(user_settings)`, so adding the schema to `get_tools()` makes the tool advertised automatically (no agent_loop change — SC#1).

---

## No Analog Found

None. Every new/modified file maps to a shipped in-repo analog — this phase is composition over Phase 113/114, by design (RESEARCH "almost pure wiring over already-shipped code").

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | (every file has an analog) |

---

## Metadata

**Analog search scope:** `backend/app/services/` (tool_dispatcher, openai_service, document_view_service, metadata_field_service, view_filter_compiler, audit_service, agent_loop), `backend/app/api/document_views.py`, `backend/app/models/` (document_view, metadata_field), `backend/tests/integration/`.
**Files scanned:** 11
**Pattern extraction date:** 2026-06-20

**Cross-cutting reminders carried into every plan (from CONTEXT + RESEARCH):**
- **SC#1 dual-wiring:** `_TOOL_REGISTRY` (`tool_dispatcher.py:2353`) AND `get_tools()` (`openai_service.py:876-882`) — the inverse-Phase-101 bug.
- **SC#2 free:** never special-case the tool around the `dispatch_tool` `phase_whitelist` guard (`:2424`).
- **No `anyOf`/`oneOf`** in the tool schema (Gemini function-calling rejects them) — flat `view`-XOR-`filter` + prose invariant + edge validation.
- **Reuse `_resolve_filter` verbatim** (extracted) — a fork is the one thing that quietly re-opens the leak the secure-phase two-user test exists to catch (D-115-6).
- **Honesty:** TRUE total via `count_only=True` (never `len(capped_rows)`), explicit truncation note, `source_refs` for citability.
- **No migration, no new audit enum** — reuse `search.query` tagged `via:"view"` (D-115-10/11).
