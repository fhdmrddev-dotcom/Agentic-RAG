# Phase 115: Virtual Folders — Agent Tool - Research

**Researched:** 2026-06-20
**Domain:** Cross-provider LLM tool/function-calling schema design + in-process reuse of the shipped Phase 113/114 leak-safe document-view resolver (Python / FastAPI backend, no migration)
**Confidence:** HIGH (code seam verified in source; cross-provider schema risk verified against official function-calling docs + the in-repo production precedents)

## Summary

Phase 115 adds exactly **one** agent tool that is almost pure wiring over already-shipped code. The two genuine wiring sites are confirmed in source: `_TOOL_REGISTRY` (`tool_dispatcher.py:2353`) gets one handler line, and the `get_tools()` default assembly (`openai_service.py:876-882`) gets one `*_TOOL` schema — exactly the SC#1 dual-wiring that guards the Phase 101 inverse-visibility bug. The leak-safe resolver the tool must reuse **already exists as a shared, route-local async function** — `_resolve_filter(*, caller, flt, folder_scope, count_only, supabase)` in `document_views.py:363` — which BOTH the saved-view `GET /{id}/resolve` and the stateless `POST /resolve` endpoints already delegate to. It already does caller-scoped own+global two-leg resolution (VIEW-06), the additive count-only mode (D-114-15), the server-clock relative-date window (D-114-16), and binds every value as a PostgREST param (SC#4). The agent tool reuses this same function in-process — **no HTTP self-call, no compiler fork, no new query path, no migration.**

The one load-bearing design risk is the **cross-provider polymorphic argument** (D-115-1: saved-view-by-name XOR inline filter XOR catalog). Official-docs research resolves this decisively: **Gemini function-calling rejects `anyOf`/`oneOf` in tool parameter schemas and imposes a union/enum complexity ceiling** — so a discriminated-union/`oneOf` shape is OUT. The robust, Gemini-safe, weak-model-friendly shape is **two flat genuinely-optional fields — `view` (string) and `filter` (object) — with the either/or invariant stated in prose in the description, validated at the handler edge with a recoverable structured error.** This exact pattern is already proven in this codebase across the native-7: `search_documents` ships an optional nested `metadata_filter` object and `render_template` ships a deep nested `field_map`+`asset` object, both on the non-strict Deep chat path, both production-working cross-provider. The catalog mode is the same tool called with neither field (empty args) — no second tool, no system-prompt seam.

**Primary recommendation:** Add `query_documents_by_view` as one handler (`_handle_query_documents_by_view`) + one `QUERY_DOCUMENTS_BY_VIEW_TOOL` schema with **flat optional `view: string` and `filter: object` fields (no `anyOf`/`oneOf`), an optional `limit: integer`**, calling the **extracted** `_resolve_filter` core in-process. Extract `_resolve_filter` (and `_relative_window`/`_build_field_meta`) into a `document_view_resolver` service module so the handler does not import a FastAPI route or raise `HTTPException` on the agent path; map readability/validation failures to a calm tool-result string, not an HTTP error.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool registration + dispatch guard | API / Backend (`tool_dispatcher.py`) | — | Tools live in the dispatch registry; `phase_whitelist` guard is the SC#2 boundary |
| Tool schema advertisement | API / Backend (`openai_service.py get_tools`) | — | The model only "sees" tools advertised in the assembled schema list (SC#1) |
| View-name → filter_expr lookup | API / Backend (`document_view_service.get_view`/`list_views`) | Database (RLS + app-scoping) | Own-or-global read with 404-not-403 collapse; the service is the scoping gate (service-role client bypasses RLS) |
| Filter AST → bound WHERE fragments | API / Backend (`view_filter_compiler`) | — | Pure, closed-registry compile; no I/O, no eval (SC#4) |
| Caller-scoped resolve (own+global, count, relative-date) | API / Backend (`_resolve_filter`) | Database (PostgREST bound params) | THE leak-safe core; every value bound, every leg scoped from caller (VIEW-06) |
| Field whitelist / catalog field list | API / Backend (`metadata_field_service` + `_BUILTINS`) | — | Single source the compiler validates against AND the catalog advertises — no drift |
| Audit receipt | API / Backend (`audit_service.write_audit_entry` via `ctx.spawn`) | Database (`audit_log`) | Reuse `search.query` action tagged `via:"view"` — no new enum, no migration (D-115-10) |

## Standard Stack

This phase introduces **no new packages.** It composes shipped modules. The "stack" here is the in-repo seam.

### Core (existing modules reused — zero install)
| Module | Symbol | Purpose | Why Standard |
|--------|--------|---------|--------------|
| `app/services/tool_dispatcher.py` | `_TOOL_REGISTRY`, `dispatch_tool`, `ToolContext`, `ToolResult` | Tool seam + per-call dependency carrier + dispatch guard | The G-5 extension contract — new tool = handler + one registry line; `threads.py` untouched `[VERIFIED: source tool_dispatcher.py:2353,2417]` |
| `app/services/openai_service.py` | `get_tools()`, `SEARCH_DOCUMENTS_TOOL`, `RENDER_TEMPLATE_TOOL` | Advertised tool-schema assembly + schema-shape precedents | The Deep-visible default tool list (SC#1) `[VERIFIED: source openai_service.py:873-889]` |
| `app/api/document_views.py` | `_resolve_filter`, `_relative_window`, `_build_field_meta` | The leak-safe resolve core + relative-date + whitelist | Already shared by two endpoints; the in-process reuse target `[VERIFIED: source document_views.py:363-549]` |
| `app/services/view_filter_compiler.py` | `compile_filter`, `validate_fields`, `validate_operands`, `OPERATOR_REGISTRY` | Closed AST→fragment compiler with full 114 operator set | Pure, closed, bound-literal — SC#4 invariant `[VERIFIED: source view_filter_compiler.py]` |
| `app/models/document_view.py` | `ViewFilter`, `ViewCondition`, `AdHocResolve` | The flat-AND AST the inline `filter` arg parses into | The tool's inline-filter arg IS this Pydantic shape — no new AST (D-113-6) `[VERIFIED: source document_view.py]` |
| `app/services/document_view_service.py` | `get_view`, `list_views` | Saved-view lookup (own-or-global; `is_global` forced false) | The lookup-by-name source for the saved-view mode `[VERIFIED: source document_view_service.py]` |
| `app/services/metadata_field_service.py` + `app/models/metadata_field.py` | `list_field_definitions`, `_BUILTINS` | The single field whitelist source | Catalog advertises ≡ compiler validates against — no drift (D-115-2) `[VERIFIED: source metadata_field_service.py, metadata_field.py:17]` |
| `app/services/audit_service.py` | `write_audit_entry` | Fire-and-forget governance receipt | Reuse `search.query` action; no new enum (D-115-10) `[VERIFIED: source tool_dispatcher.py:233-238]` |

**Installation:** None. `openai>=2.0.0` already present `[VERIFIED: backend/requirements.txt]`; no new dependency.

### Supporting (helpers reused)
| Module | Symbol | When to Use |
|--------|--------|-------------|
| `app/utils/folder_utils.py` | `get_globally_visible_folder_ids`, `fetch_visible_folders` | The own+global two-leg scoping (already called inside `_resolve_filter`) `[VERIFIED: source folder_utils.py:48]` |
| `app/utils/db.py` | `aexec` | `run_in_threadpool` wrapper around every sync supabase-py call (D-v2.5-01) `[VERIFIED: source — used throughout the resolve core]` |
| `app/services/harness/scope.py` | `resolve_project_subtree` | folder_scope subtree resolution (already called inside `_resolve_filter`) `[VERIFIED: source document_views.py:421]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extract `_resolve_filter` to a service module + call in-process | HTTP self-call to `GET /document-views/{id}/resolve` | Self-call re-pays auth/serialization, needs a JWT the agent loop doesn't hold, and couples the tool to the running web server — REJECT (CONTEXT D-115-2/3 explicitly prefer in-process). |
| Two flat optional fields (`view` XOR `filter`) | `oneOf`/`anyOf` discriminated union | **Gemini rejects `anyOf`/`oneOf` in function-calling parameter schemas** — REJECT (see Pitfall 1). |
| Reuse `search.query` audit tagged `via:"view"` | New `view.run` audit action_type | New enum = a migration + the Phase 110 frozenset-sync/boot-guard dance — deferred to Phase 119 (D-115-10). |

**Version verification:** No package versions to verify — phase installs nothing. `openai>=2.0.0` confirmed present in `backend/requirements.txt` `[VERIFIED: source]`.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero external packages.** It composes already-shipped, already-audited in-repo modules. No registry lookup, no slopcheck needed.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No external dependency added |

## Architecture Patterns

### System Architecture Diagram

```
Chat turn (any of native-7 providers, Deep Mode)
        │
        ▼
agent_loop.py  ── builds ToolContext (current_user, folder_subtree_ids,
        │          user_settings, supabase, pool, spawn, phase_whitelist=None)
        │          and active_tools = get_tools(user_settings)   ← QUERY_DOCUMENTS_BY_VIEW_TOOL advertised here (SC#1)
        ▼
model emits tool_call: query_documents_by_view(view? / filter? / limit?)
        │
        ▼
dispatch_tool(name, args, ctx)        ← phase_whitelist guard (None in Deep = no-op → SC#2 free)
        │
        ▼
_handle_query_documents_by_view(args, ctx)
        │
        ├─ neither view nor filter, OR unknown view name ──► CATALOG MODE
        │      list_views(caller)  +  list_field_definitions(caller) ∪ _BUILTINS
        │      → {views:[{name,description,count?}], fields:[{key,type}]}
        │      (no resolve, no source_refs)
        │
        ├─ view name given ──► get_view-by-name (own-or-global) → filter_expr AST
        │                       (not found → fall through to catalog / "no such view")
        │
        ├─ filter object given ──► ViewFilter.model_validate(filter)
        │
        ▼ (concrete mode)
_resolve_filter(caller=ctx.current_user["id"], flt, folder_scope, count_only, supabase)
        │   [EXTRACTED to document_view_resolver service — no HTTPException on this path]
        │   ├─ validate_fields + validate_operands (whitelist; ValueError → tool-result string, not 422)
        │   ├─ compile_filter → list[Fragment] (closed registry, bound literals)
        │   ├─ count-only leg → TRUE total (own+global DISTINCT)  (D-114-15)
        │   ├─ relative-date window from server clock at resolve time (D-114-16)
        │   └─ caller-scoped own + globally-visible-folder legs, merge, newest-first
        ▼
ToolResult(result=<compact newest-N rows + true total + truncation note>,
           source_refs=[{document_id, filename}, ...])     ← citable (D-115-4)
        │
        └─ ctx.spawn(write_audit_entry(action_type="search.query",
                     metadata={via:"view", view_id/filter, document_ids}))   (D-115-10)
```

The reader can trace the headline use case ("how many contracts expire in 90 days?") top to bottom: provider-agnostic tool call → dispatch guard → handler → the SAME shared resolver → compact citable answer.

### Recommended Module Structure
```
backend/app/services/
├── document_view_resolver.py   # NEW (thin): extracted _resolve_filter + _relative_window +
│                               #   _build_field_meta, returning plain dicts and raising a
│                               #   small ResolveError (NOT HTTPException) so both the route
│                               #   and the agent tool can call it. Route keeps its 404/422
│                               #   mapping; tool maps ResolveError → calm tool-result string.
├── tool_dispatcher.py          # +1 handler (_handle_query_documents_by_view) + 1 registry line
└── openai_service.py           # +1 schema constant (QUERY_DOCUMENTS_BY_VIEW_TOOL) + 1 assembly entry
backend/app/api/
└── document_views.py           # import the extracted core; routes become thin wrappers that
                                #   add the HTTP error mapping. Byte-identical behavior for the
                                #   existing 113/114 endpoints (regression-guarded by the live
                                #   integration suite).
```

**Extraction note (load-bearing):** `_resolve_filter` currently lives inside `document_views.py` and raises `fastapi.HTTPException` on validation failure (`:390,402`). The agent handler must NOT raise HTTP errors into the agent loop. Two options for the planner:
- **(Recommended) Extract** the core into `document_view_resolver.py`, have it raise a plain `ResolveError(detail, status)` (or return a typed result), and let the route wrap it back into `HTTPException`. The agent handler catches `ResolveError` → returns a `ToolResult(result=json.dumps({"status":"...", "message":...}))`. This is the cleanest in-process reuse and keeps the existing routes byte-identical.
- **(Acceptable, lower-effort) Call the existing route function** and catch `HTTPException` in the handler. Works, but couples the tool to a module that imports FastAPI and is slightly more fragile. The leak test (`test_113_view_global_leak.py`) already calls `resolve_view` as a coroutine and catches `HTTPException`, so this pattern has precedent — but prefer the extraction for cleanliness.

Either way: **the resolve LOGIC is reused verbatim — no fork.**

### Pattern 1: Flat optional-field polymorphic tool argument (THE recommended schema)
**What:** Express "saved-view-by-name XOR inline-filter XOR catalog" with two genuinely-optional flat fields, the invariant stated in prose, validated at the handler edge.
**When to use:** Any cross-provider tool that needs a "this OR that OR neither" argument and must work on Gemini (no `anyOf`/`oneOf`).
**Recommended schema (drop-in for `openai_service.py`):**
```python
# Source pattern: mirrors SEARCH_DOCUMENTS_TOOL (:17) optional nested object +
#   RENDER_TEMPLATE_TOOL (:528) nested object with required sub-fields, both
#   production-working across the native-7 on the non-strict Deep chat path.
QUERY_DOCUMENTS_BY_VIEW_TOOL = {
    "type": "function",
    "function": {
        "name": "query_documents_by_view",   # final name — see "Tool naming" below
        "description": (
            "List ALL documents matching a saved view or exact metadata criteria — "
            "complete, deterministic, newest-first, NO semantic ranking and NO search "
            "query string. Use this for 'show me all X', 'how many X', 'list my "
            "contracts', 'open my Invoices view', 'which docs expire within 90 days'. "
            "This is NOT search_documents (which needs a natural-language query and "
            "returns ranked top-K passages) and NOT query_documents (free SQL). "
            "Provide EXACTLY ONE of: `view` (a saved view name) OR `filter` (inline "
            "metadata conditions). Provide NEITHER to discover what saved views and "
            "filterable fields exist (a catalog is returned — then call again with a "
            "concrete choice). Never provide both."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "view": {
                    "type": "string",
                    "description": (
                        "Name of a saved view to run (e.g. 'Invoices', 'Expiring "
                        "Contracts'). Case-insensitive. Omit to use `filter` or to "
                        "request the catalog."
                    ),
                },
                "filter": {
                    "type": "object",
                    "description": (
                        "An inline metadata filter (use INSTEAD of `view`). A flat "
                        "AND-list of conditions; every condition matches exactly."
                    ),
                    "properties": {
                        "op": {"type": "string", "enum": ["and"]},
                        "conditions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": {"type": "string",
                                        "description": "A filterable field (call with no args to see the catalog of fields)."},
                                    "op": {"type": "string",
                                        "enum": ["eq","gte","lte","one_of","contains",
                                                 "is_empty","within_next","older_than",
                                                 "before","after","between"]},
                                    "value": {"type": ["string","number","boolean","null"]},
                                    "value2": {"type": ["string","number","null"],
                                        "description": "Upper bound for 'between'."},
                                    "values": {"type": "array", "items": {"type": "string"},
                                        "description": "Membership list for 'one_of'."},
                                    "unit": {"type": "string", "enum": ["days","weeks","months"],
                                        "description": "Span unit for within_next/older_than."},
                                },
                                "required": ["field", "op"],
                            },
                        },
                    },
                    "required": ["op", "conditions"],
                },
                "limit": {
                    "type": "integer",
                    "description": "Max rows to return (default 20, hard cap 50). The TRUE total is always reported.",
                },
            },
            # No top-level required → catalog mode (neither field) is reachable.
        },
    },
}
```
**Why this exact shape:**
- **No `anyOf`/`oneOf` anywhere** → Gemini-safe (Pitfall 1).
- `view` and `filter` are genuinely optional (non-strict path) → neither = catalog mode reachable.
- The nested `filter` mirrors `render_template`'s nested `field_map`/`asset` (`required` on nested sub-objects), which is production-proven cross-provider in this repo.
- The `op`/condition-`op` enums match the `ViewCondition.op` Literal **exactly** so the parsed object validates against `ViewFilter.model_validate(...)` without translation `[VERIFIED: source document_view.py:42-64]`.
- `value` uses a JSON-Schema type-union array `["string","number","boolean","null"]` (NOT `anyOf`) — type arrays are in Gemini's supported subset; `anyOf` is not `[CITED: ai.google.dev / firebase function-calling subset]`.

**Anti-Patterns to Avoid**
- **`oneOf`/`anyOf` discriminator for view-vs-filter** — breaks Gemini function-calling; do not use (Pitfall 1).
- **A second separate tool for the catalog** — costs a toolbox slot against Google's `max_tools:16` cap (the default toolbox is already ~24 tools `[VERIFIED: get_tools assembly + config.py max_tools:16 for google]`). Catalog is a MODE of the one tool (D-115-2).
- **Raising `HTTPException` into the agent loop** — the handler must return a calm `ToolResult` string on any failure, never throw an HTTP error.
- **Re-deriving relative-date windows** — reuse `_relative_window` (server clock at resolve, D-114-16); never bake "today" in the tool.
- **Scoping any leg from `view["user_id"]`** — every leg scopes from `caller` (VIEW-06). Reusing `_resolve_filter` makes this correct by construction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter AST → SQL | A new query builder / string SQL | `view_filter_compiler.compile_filter` + `_resolve_filter._apply` | Closed registry + bound params = SC#4 holds; a fork re-opens injection risk |
| Own+global leak-safe scoping | Custom user-scoping in the handler | `_resolve_filter` (caller-scoped, own+global merge, DISTINCT dedupe) | VIEW-06 correct by construction; hand-rolling re-introduces the leak the secure-phase test exists to catch |
| TRUE total count | `len(rows)` after capping at N | `_resolve_filter(count_only=True)` (D-114-15) | `len(capped_rows)` lies; count-only does own+global DISTINCT without materializing |
| Relative-date windows | `date.today()` math in the tool | `_relative_window` inside `_resolve_filter` | Server-clock recompute at resolve time (D-114-16); a baked window drifts wrong |
| Field whitelist for the catalog | A hardcoded field list | `_BUILTINS ∪ enabled custom defs` via `metadata_field_service` | Single source ≡ what the compiler validates against → no drift (D-115-2) |
| View lookup by name | A new query | `document_view_service.list_views`/`get_view` (own-or-global) | 404-not-403 collapse + own-or-global scoping already correct |
| Audit receipt | A new `view.run` action + migration | `write_audit_entry("search.query", via:"view")` via `ctx.spawn` | No enum change, no frozenset-sync/boot-guard dance (D-115-10) |

**Key insight:** Almost every "hard" part of this phase is already solved and shipped. The risk is NOT re-implementing — it is (a) the cross-provider arg schema, and (b) accidentally forking the resolver and re-opening a leak. Both are mitigated by reusing `_resolve_filter` verbatim.

## Common Pitfalls

### Pitfall 1: Gemini rejects `anyOf`/`oneOf` in function-calling parameter schemas
**What goes wrong:** A discriminated-union schema (the "obvious" way to express view-XOR-filter) makes Gemini either reject the request or ignore the union, and trips Gemini's union/enum complexity ceiling.
**Why it happens:** Gemini function declarations use a restricted OpenAPI subset. Supported keywords include `type, nullable, required, format, description, properties, items, enum, $ref, $defs, minItems, maxItems, minimum, maximum` — but **`anyOf` is not supported for tool parameters, `oneOf` is explicitly unsupported, and large union/enum/`anyOf` constructs are refused over a complexity threshold** `[CITED: ai.google.dev function-calling subset; github.com/colinhacks/zod#5807; firebase.google.com function-calling]`. OpenAI supports `anyOf` in structured outputs but `oneOf` is limited; the project's chat path is **non-strict** anyway.
**How to avoid:** Use two flat optional fields + a JSON-Schema type-array (`["string","number","null"]`, which IS supported) instead of `anyOf`. State the either/or invariant in the description; validate at the handler edge.
**Warning signs:** A 400 from Google, or the Gemini UAT row silently misfilling the union.

### Pitfall 2: `_resolve_filter` raises `HTTPException` — leaks an HTTP error into the agent loop
**What goes wrong:** The handler calls the resolver, an unknown field / unparseable filter raises `HTTPException(422)`, and the agent loop sees an exception instead of a tool result.
**Why it happens:** The shared core was written for a route; it maps `ValueError` → `HTTPException` at `document_views.py:390,402`.
**How to avoid:** Extract the core to raise a plain `ResolveError`; the route re-wraps to `HTTPException`, the handler maps to a calm `ToolResult` JSON string (e.g. `{"status":"invalid_filter","message":"unknown field 'foo'; call with no arguments to see filterable fields"}`). This also makes a bad model-supplied filter SELF-CORRECTING (the message points it at the catalog).
**Warning signs:** A run failure / 500 traceback originating in `dispatch_tool` rather than a tool-result string.

### Pitfall 3: Counting `len(capped_rows)` instead of the TRUE total
**What goes wrong:** The tool caps at N=20 and reports "20 documents" when 47 match — a dishonest answer (the honesty invariant in D-115-3 / Specifics).
**Why it happens:** Materializing rows and counting them after the cap.
**How to avoid:** Call the resolver twice (or once in a combined mode): `count_only=True` for the TRUE total, then a capped materialization for the rows; emit `"47 match; 20 newest shown"`. Reuse D-114-15, do not reinvent.
**Warning signs:** Total equals the row count whenever the cap is hit.

### Pitfall 4: Thread folder-scope vs. view folder-scope confusion
**What goes wrong:** When a chat thread is folder-scoped (`ctx.folder_subtree_ids` is not None), an implementer might assume the view resolve should also be clipped to the thread's subtree — or might pass `folder_subtree_ids` into the resolver.
**Why it happens:** `_handle_search_documents` clips to `ctx.folder_subtree_ids`; `_resolve_filter` does its OWN caller-scoping (own + globally-visible) and applies the VIEW's `folder_scope`, not the thread's.
**How to avoid:** Do NOT pass `ctx.folder_subtree_ids` into `_resolve_filter` — the view's own `folder_scope` is the only scope narrowing inside the resolver, and caller-scoping is automatic. **Open question for the planner:** decide explicitly whether a folder-scoped thread should additionally intersect view results with the thread subtree (likely yes for consistency with search_documents, but it is a deliberate decision, not a default). See Open Questions Q1.
**Warning signs:** A folder-scoped thread returning docs outside its folder via the view tool (inconsistent with search_documents) — OR over-narrowing a saved view to the thread's folder unexpectedly.

### Pitfall 5: Registered but not advertised — the inverse Phase 101 bug (SC#1)
**What goes wrong:** Handler added to `_TOOL_REGISTRY` but NOT to `get_tools()` assembly → the model never sees the tool → "registered" passes but the model never calls it. (This is exactly the `render_template` harness-only shape, deliberate THERE but a bug HERE.)
**Why it happens:** Forgetting the second wiring site.
**How to avoid:** Add to BOTH `_TOOL_REGISTRY` (`:2353`) AND the `get_tools()` list (`:876-882`). Acceptance is the model **actually invoking it live**, not just registry presence (SC#1).
**Warning signs:** Tool dispatches fine in a unit test but no provider ever emits the call in live UAT.

### Pitfall 6: `sanitize_param`/`::numeric` and range-on-custom-number
**What goes wrong:** An inline `filter` with a range op (`gte`/`between`) on a CUSTOM number field would compare `metadata->>'field'` lexically ("9" > "100").
**Why it happens:** PostgREST can't express a `::numeric` cast on a json-path selector.
**How to avoid:** This is ALREADY handled — `validate_operands` rejects range ops on custom number fields (WR-01) at resolve time, raising `ValueError`. Reusing the resolver inherits this guard for free. Just ensure that `ValueError` becomes a calm tool-result message (Pitfall 2).
**Warning signs:** Wrong rows for numeric range filters (won't happen if the resolver is reused; would happen if forked).

## Code Examples

### Catalog mode (no concrete selection)
```python
# Source pattern: mirrors metadata_field_service.list_field_definitions + document_view_service.list_views
async def _handle_query_documents_by_view(args: dict, ctx: ToolContext) -> ToolResult:
    view_name = (args.get("view") or "").strip()
    inline = args.get("filter")
    caller = ctx.current_user["id"]

    # CATALOG MODE — neither selection, or an unknown view name (resolved below).
    async def _catalog() -> ToolResult:
        views = await document_view_service.list_views(caller, supabase=ctx.supabase)
        defs = await metadata_field_service.list_field_definitions(caller, supabase=ctx.supabase)
        fields = sorted(_BUILTINS | {d["field_key"] for d in defs if d.get("enabled")})
        return ToolResult(result=json.dumps({
            "mode": "catalog",
            "views": [{"name": v["name"]} for v in views],     # counts: see Open Q2 (lazy by default)
            "filterable_fields": fields,                         # ≡ what the compiler accepts (no drift)
            "hint": "Call again with `view` (a name above) or `filter` (using a field above).",
        }))

    if not view_name and inline is None:
        return await _catalog()
    # ... concrete modes below ...
```

### Concrete resolve + citable rows + true total + audit
```python
    # Resolve the filter_expr (saved view by name, or inline)
    if view_name:
        view = await document_view_service.get_view_by_name(view_name, caller, supabase=ctx.supabase)  # NEW thin helper
        if view is None:
            return await _catalog()  # unknown view → catalog, NEVER an existence leak (D-115-6)
        flt = ViewFilter.model_validate(view["filter_expr"] or {"op": "and", "conditions": []})
        folder_scope = view.get("folder_scope")
        via_meta = {"via": "view", "view_id": view["id"], "view_name": view["name"]}
    else:
        flt = ViewFilter.model_validate(inline)     # ValueError → calm tool-result (Pitfall 2)
        folder_scope = None
        via_meta = {"via": "filter", "filter": inline}

    limit = max(1, min(int(args.get("limit") or 20), 50))   # default 20, hard cap 50 (D-115-3)

    try:
        total = (await resolve_filter(caller=caller, flt=flt, folder_scope=folder_scope,
                                      count_only=True, supabase=ctx.supabase))["total"]
        full = await resolve_filter(caller=caller, flt=flt, folder_scope=folder_scope,
                                    count_only=False, supabase=ctx.supabase)
    except ResolveError as e:   # extracted core raises this, NOT HTTPException
        return ToolResult(result=json.dumps({"status": "invalid_filter", "message": e.detail}))

    rows = full["documents"][:limit]
    compact = [{
        "document_id": d["id"],
        "filename": d["filename"],
        "document_type": (d.get("metadata") or {}).get("document_type"),
        "date": (d.get("metadata") or {}).get("date"),
        "author": (d.get("metadata") or {}).get("author"),
    } for d in rows]
    source_refs = [{"document_id": d["id"], "filename": d["filename"]} for d in rows]

    ctx.spawn(write_audit_entry(
        user_id=caller, action_type="search.query",
        metadata={**via_meta, "document_ids": [d["id"] for d in rows]},
        supabase=ctx.supabase,
    ))
    return ToolResult(result=json.dumps({
        "mode": "results",
        "total": total,
        "shown": len(compact),
        "truncated": total > len(compact),
        "note": (f"{total} match; {len(compact)} newest shown." if total > len(compact)
                 else f"{total} match."),
        "documents": compact,
    }), source_refs=source_refs)
```
*(`get_view_by_name` is a small new own-or-global lookup helper mirroring `get_view`; or filter `list_views(...)` by case-insensitive name in the handler — planner's call. `resolve_filter` is the extracted `_resolve_filter`.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `oneOf`/`anyOf` for union tool args | Flat optional fields + prose invariant + edge validation | Gemini function-calling subset (stable) | The only cross-provider-safe shape for view-XOR-filter |
| Gemini Structured Outputs gained `anyOf` (2025) | …but **function-calling** parameter schemas still exclude `anyOf`/`oneOf` | 2025 structured-outputs update | Do not conflate structured-outputs support with function-calling support — they differ |
| All-required + nullable-union (OpenAI strict) | This phase uses the **non-strict** Deep chat path | n/a | Genuinely-optional fields work; no nullable-union gymnastics needed (matches `search_documents`) |

**Deprecated/outdated:**
- Treating "Gemini supports JSON Schema now" as license to use `anyOf` in tool params — false for function-calling.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Gemini OpenAI-compatibility endpoint (the project's Gemini route) applies the SAME function-calling schema subset as the native Gemini endpoint (no `anyOf`/`oneOf`) | Pitfall 1 | LOW — the recommended schema uses neither `anyOf` nor `oneOf`, so it is safe under BOTH the strict and the lenient reading. The recommendation is robust regardless. The UAT Gemini row confirms empirically. |
| A2 | Reusing `search.query` audit tagged `via:"view"` is acceptable to product for v1 (vs a first-class `view.run`) | Don't Hand-Roll / D-115-10 | LOW — explicitly locked in CONTEXT D-115-10; Phase 119 can add `view.run` additively later. |
| A3 | Per-view live counts in the catalog are NOT required for v1 (lazy/omitted is acceptable) | Catalog code / Open Q2 | LOW — CONTEXT marks eager-vs-lazy counts as Claude's discretion; omitting avoids N resolves per catalog call at ~10k docs. |
| A4 | The compact-row metadata set (`document_type`, `date`, `author`) is the right default | Code Examples / D-115-3 | LOW — CONTEXT marks "which key metadata fields ride each row" as discretion; these are the highest-signal built-ins. |

**No assumed package names** — phase installs nothing, so the slopsquatting vector is absent.

## Open Questions

1. **Folder-scoped-thread interaction (Pitfall 4).**
   - What we know: `_handle_search_documents` clips results to `ctx.folder_subtree_ids` when the thread is folder-scoped; `_resolve_filter` does its own caller+view scoping and ignores the thread subtree.
   - What's unclear: Should the view tool, on a folder-scoped thread, additionally intersect results with the thread subtree (for consistency with `search_documents`)?
   - Recommendation: For v1, resolve over the caller's full visible set + the view's own `folder_scope` (do NOT thread-clip) — this is the literal "run the view" semantics and matches how a user expects "open my Invoices view" to behave even inside a scoped thread. Flag in the plan as a deliberate decision; if product wants thread-clip parity, it is a one-line `.in_("folder_id", ctx.folder_subtree_ids)` post-filter. The secure-phase leak test is unaffected either way (caller-scoping is the leak boundary, not folder-scoping).

2. **Catalog per-view counts: eager vs lazy at ~10k docs.**
   - What we know: An eager catalog would run one count-only resolve PER saved view. Count-only is a single id-set query per view (`select id`, own+global) — cheap individually, but N views × 2 legs per catalog call.
   - What's unclear: Whether product wants counts in the catalog at all.
   - Recommendation: **Lazy/omit counts in the catalog v1** (mirror D-114-8's lazy sidebar-count posture). Return view names + descriptions + fields only; the model re-calls with a concrete view to get the count. If counts are wanted, cap the eager path (e.g. only when the caller has ≤ ~10 views) to bound cost. Confirm at discuss/plan.

3. **Final tool name.**
   - What we know: Working name `query_documents_by_view`; must read as "exhaustive metadata listing," never "search," and not collide with `search_documents`/`query_documents` (D-115-5/12).
   - Recommendation: **`query_documents_by_view`** is acceptable and already distinct ("by_view" + the description's explicit contrast). A marginally clearer alternative is `list_documents_by_filter` (leads with "list" = exhaustive, and "filter" covers both modes), but `query_documents_by_view` is fine given the strong description. Lock at plan time; the description does the routing work either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase `:54322` | Live integration + two-user leak tests | ✓ (project default) | Postgres 15 | Tests skip cleanly when unreachable (`_pg_reachable`) `[VERIFIED: test_113_view_global_leak.py:48]` |
| `document_views` / `documents` / `metadata_field_definitions` tables | Resolve + catalog | ✓ (shipped 110/111/113/114) | live | — |
| native-7 provider API keys | SC#10 cross-provider UAT | ✓ (in `backend/.env` per memory) | — | OpenRouter as experimental backstop |

**Missing dependencies with no fallback:** None — phase composes live, shipped substrate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) `[VERIFIED: backend/pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && python -m pytest tests/unit/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -q` |
| Live integration | `tests/integration/*` against `:54322` (skip when unreachable) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#1 (registry) | `query_documents_by_view` in `_TOOL_REGISTRY` AND in `get_tools()` schema | unit | `pytest tests/unit/test_115_tool_wiring.py -x` | ❌ Wave 0 |
| SC#1 (schema-shape) | Tool schema has NO `anyOf`/`oneOf`; `view`+`filter` optional; enums match `ViewCondition.op` | unit | `pytest tests/unit/test_115_tool_schema.py -x` | ❌ Wave 0 |
| SC#1 (catalog mode) | Empty args → catalog dict (views + `_BUILTINS ∪ enabled defs`); fields ≡ compiler whitelist | unit/integration | `pytest tests/integration/test_115_catalog.py -x` | ❌ Wave 0 |
| SC#1 (inline filter) | `filter` arg → `ViewFilter.model_validate` → `_resolve_filter`; bad field → calm tool-result, not HTTPException | unit | `pytest tests/unit/test_115_handler_modes.py -x` | ❌ Wave 0 |
| SC#1 (saved view) | `view` name → own-or-global lookup → resolve; unknown name → catalog (no leak) | integration | `pytest tests/integration/test_115_saved_view_run.py -x` | ❌ Wave 0 |
| SC#1 (honesty) | TRUE total via count-only; truncation note when capped; `source_refs` present | integration | `pytest tests/integration/test_115_result_shape.py -x` | ❌ Wave 0 |
| SC#2 (whitelist free) | `phase_whitelist` containing the tool → dispatches; excluding it → refusal ToolResult; `None` → no-op | unit | `pytest tests/unit/test_115_whitelist_guard.py -x` | ❌ Wave 0 (extends `test_tool_budget.py` pattern) |
| SC#2 (leak-safe) | Two users, ONE seeded global view → per-viewer result sets; counts differ; no cross-user ids; 404-not-403 on unseeable | integration (LIVE, secure-phase) | `pytest tests/integration/test_115_tool_global_leak.py -x` | ❌ Wave 0 (clone `test_113_view_global_leak.py`) |
| SC#3 (4-axis UAT) | native-7 × multi-tool × parallel-thread × long-message | manual UAT (Chrome MCP / live) | authored in VALIDATION.md | n/a |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/ -x -q` (schema/wiring/handler-mode — fast, no DB)
- **Per wave merge:** `pytest tests/ -q` (adds live integration on `:54322`)
- **Phase gate:** Full suite green + the two-user leak integration green BEFORE `/gsd:verify-work`; the LIVE leak proof + the SC#10 4-axis UAT run in/around secure-phase (the "static would false-green → verify leak-safety LIVE" lesson — the schema/wiring unit tests can pass while the live leak boundary is broken).

### What is automatable vs manual-UAT
- **Automatable (unit, no DB):** tool wiring (both sites), schema-shape (no `anyOf`/`oneOf`, optional fields, enum match), handler mode-routing, whitelist guard, calm-error-on-bad-filter.
- **Automatable (live integration `:54322`):** catalog content ≡ compiler whitelist, saved-view + inline resolve correctness, TRUE-total/truncation honesty, **the two-user global-view leak proof** (clone `test_113_view_global_leak.py`, but drive the TOOL HANDLER, not the route, so the agent path itself is proven leak-safe).
- **Manual-UAT only (SC#3, VALIDATION.md):** the 4-axis matrix below — "the model actually CALLS the tool" (SC#1 acceptance) is only observable with a live model.

### SC#10 4-Axis UAT Matrix (author in VALIDATION.md, NOT in PLAN tasks)
| Axis | Required coverage for this tool |
|------|-------------------------------|
| Cross-provider | native-7: OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax (+ OpenRouter backstop). Each must (a) actually emit a `query_documents_by_view` call and (b) fill the polymorphic arg correctly. **Gemini row = the `anyOf`/`oneOf`-free schema proof. MiniMax row = the `minimax-m3-invalid-tool-args-400` watch point — confirm the inline-`filter` object does not worsen it; pass OR document as a known provider limitation (it is NOT this phase's fix).** |
| Multi-tool | One prompt exercising `query_documents_by_view` + `search_documents` together (e.g. "list all my contracts, then find the indemnity clause in them") — proves the two retrieval lanes coexist and the model routes correctly between them (D-115-5). |
| Parallel-thread | Thread A streaming a view-tool answer while Thread B accepts a new prompt — no cross-thread bleed in the tool result or `source_refs`. |
| Long-message | ≥ 50 prior messages OR a ≥ 5 KB prompt with the view-tool call at the end — the tool still fires and the polymorphic arg still fills. |

### Wave 0 Gaps
- [ ] `tests/unit/test_115_tool_wiring.py` — SC#1 dual-registration
- [ ] `tests/unit/test_115_tool_schema.py` — SC#1 schema-shape (no `anyOf`/`oneOf`, optional fields, enum parity)
- [ ] `tests/unit/test_115_handler_modes.py` — mode routing + calm-error-on-bad-filter
- [ ] `tests/unit/test_115_whitelist_guard.py` — SC#2 guard (extends `test_tool_budget.py`)
- [ ] `tests/integration/test_115_catalog.py` — catalog ≡ whitelist
- [ ] `tests/integration/test_115_saved_view_run.py` + `test_115_result_shape.py` — resolve + honesty
- [ ] `tests/integration/test_115_tool_global_leak.py` — the LIVE two-user leak proof (clone of `test_113_view_global_leak.py`, driving the tool handler)
- [ ] No framework install needed (pytest + pytest-asyncio present)

## Security Domain

> `security_enforcement` not set to `false` in config → included. This phase's security posture is INHERITED from 113/114 by reusing the same resolver/compiler — the new surface is the agent-tool entry point.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Caller-scoped own+global resolve (VIEW-06); 404-not-403 on unseeable view (`get_view`/`get_view_by_name`); the `dispatch_tool` `phase_whitelist` guard (SC#2) |
| V5 Input Validation | yes | `ViewFilter.model_validate` (Literal-discriminated op reject) + `validate_fields`/`validate_operands` (whitelist, `_`-prefix reject, range-on-custom-number reject) — reused from the compiler |
| V6 Cryptography | no | No crypto in scope |
| V7 Error Handling | yes | A bad model-supplied filter → calm `ToolResult` JSON (no stack trace, no HTTP error into the loop); audit write is fire-and-forget (failure never breaks the answer) |
| V13 API/Tool | yes | Single additive tool; shared chat/SSE path untouched (no cross-provider regression); audit receipt on every call |

### Known Threat Patterns for the agent-tool surface
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user document leak via a seeded global view | Information Disclosure | Reuse `_resolve_filter` — every leg scoped from `caller`, never `view["user_id"]`; **proven LIVE by the two-user leak test, NOT the RLS label** (D-115-6, the "static would false-green" lesson) |
| Existence leak (probing for another user's view names) | Information Disclosure | Unknown/unseeable view name → catalog / "no such view", never a 403 or a distinguishable error (D-115-6) |
| SQL/SSTI injection via an inline `filter` value | Tampering | Every value compiled to a bound PostgREST param via the closed registry — no f-string SQL (SC#4, inherited from the compiler) |
| Prompt-injected filter from untrusted doc content driving an over-broad query | Tampering | `validate_fields`/`validate_operands` reject unknown fields/malformed operands; empty conditions = no narrowing (not "match all and exfiltrate") — bounded by caller scope regardless |
| Audit-log evasion | Repudiation | Every concrete call fires `search.query` audit tagged `via:"view"` with matched ids (D-115-10) |
| Tool callable in a workflow phase that didn't allow it | Elevation of Privilege | `dispatch_tool` `phase_whitelist` guard refuses a non-whitelisted tool with a `tool_refused` audit (SC#2, free — do NOT special-case the tool around the guard) |

**Secure-phase note (the load-bearing one):** the unit/wiring tests will pass while the resolver is correctly reused — but ONLY the live two-user leak test against `:54322`, driving the actual tool handler (not the route), proves the agent path is leak-safe. Author it under VALIDATION.md §Manual-Only and run it in secure-phase, exactly as Phase 113 did (`test_113_view_global_leak.py`). Reusing `_resolve_filter` verbatim is what makes this non-vacuous: a fork would be the thing that quietly re-opens the leak.

## Sources

### Primary (HIGH confidence — in-repo source, verified this session)
- `backend/app/services/tool_dispatcher.py` — `_TOOL_REGISTRY` (:2353), `dispatch_tool` + guard (:2417/:2424), `ToolContext` (:59-114), `ToolResult` (:118), `_handle_search_documents` (:173)
- `backend/app/services/openai_service.py` — `get_tools` (:873-889), `SEARCH_DOCUMENTS_TOOL` (:17), `RENDER_TEMPLATE_TOOL` (:528), `apply_tool_budget` (:892)
- `backend/app/api/document_views.py` — `_resolve_filter` (:363-549), `_relative_window` (:82), `_build_field_meta` (:130), the count-only path (:493)
- `backend/app/services/view_filter_compiler.py` — `compile_filter`, `validate_fields`, `validate_operands`, `OPERATOR_REGISTRY`
- `backend/app/models/document_view.py` — `ViewFilter`/`ViewCondition` (:34-69), `AdHocResolve`
- `backend/app/services/document_view_service.py` — `get_view` (:113), `list_views` (:92)
- `backend/app/services/metadata_field_service.py` + `backend/app/models/metadata_field.py:17` (`_BUILTINS`)
- `backend/app/config.py` — `max_tools:16` for google models (:257+); native-7 provider hosts
- `backend/app/services/agent_loop.py` — `ToolContext` construction (:2036), `active_tools` (:2060)
- `backend/tests/integration/test_113_view_global_leak.py` — the two-user leak test pattern; `backend/pytest.ini`

### Secondary (MEDIUM-HIGH confidence — official function-calling docs)
- ai.google.dev / firebase.google.com function-calling — Gemini OpenAPI schema subset; `anyOf`/`oneOf` unsupported in tool params; union/enum complexity ceiling
- platform.openai.com / developers.openai.com structured-outputs — `anyOf` supported, `oneOf` limited; strict-mode all-required/nullable-union (the project's chat path is NON-strict, so not triggered)
- api-docs.deepseek.com function-calling — nested objects require `additionalProperties:false` + all-required (informs the nested `filter` shape; the in-repo `render_template` precedent already satisfies this)
- platform.kimi.ai / platform.moonshot.ai tool-calling — OpenAI-compatible tool schema; nested objects supported

### Tertiary (LOW confidence — community, used only to corroborate)
- github.com/colinhacks/zod#5807 (Gemini `anyOf` incompatibility), cline#7897 ("too complex json"), LLM function-calling best-practice posts (flat schema + edge validation for either/or args)

## Metadata

**Confidence breakdown:**
- Code seam / reuse target: **HIGH** — `_resolve_filter` read in full; both wiring sites and the `ToolContext`/audit pattern verified in source.
- Cross-provider arg schema: **HIGH** — the negative constraint (Gemini no `anyOf`/`oneOf`) is documented AND the recommended shape is already production-proven in this repo across the native-7 (`search_documents`/`render_template`).
- Leak-safety / security: **HIGH** — inherited by verbatim reuse of the shipped, secure-phase-proven resolver; the live two-user test pattern exists to clone.
- Catalog count cost at 10k / folder-scope interaction: **MEDIUM** — flagged as Open Questions with concrete recommendations.

**Research date:** 2026-06-20
**Valid until:** ~2026-07-20 (stable in-repo seam; the Gemini schema-subset fact is stable — recheck only if Google announces `anyOf` for function-calling parameters)
