# Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend) - Research

**Researched:** 2026-06-18
**Domain:** Saved metadata-driven views ("virtual folders") + a net-new closed-registry filter-AST → parameterized-SQL compiler (backend only)
**Confidence:** HIGH (every analog verified against live code + the live :54322 DB; near-zero new deps)

## Summary

Phase 113 is overwhelmingly composition of already-shipped seams, with exactly **one genuinely net-new component**: a filter-AST → parameterized-SQL compiler. Every other piece — the `document_views` table + its 4 RLS policies + the `view.create` audit action — is already live in migration 071 and verified present on :54322. The resolve path is a clone of `list_documents` (`documents.py:535`) extended with two predicates the codebase already understands (`metadata @>` containment + `folder_id = ANY(subtree)`). The folder-subtree resolver (`harness/scope.py resolve_project_subtree`), the field-whitelist source (`_METADATA_BUILTINS ∪ enabled metadata_field_definitions`), the audit write (`write_audit_entry` with `view.create`), and the closed-registry pattern (`harness/validators.py` + `validator_kinds.py` `@register_validator`) are all directly reusable, cited below to file:line.

**Three open questions are resolved decisively (with one loud correction to a CONTEXT assumption):**
1. **GIN-index/migration question — RESOLVED, CONTEXT was over-cautious.** `documents.metadata` ALREADY has a GIN index (`documents_metadata_gin_idx`, migration `007_document_metadata.sql:7`), **verified live on :54322**. `@>` is both correct AND index-accelerated today. D-113-13's "no new migration" is confirmed; its hedge ("if a cheap GIN add is warranted it's the only candidate") is moot — the index exists. **NO migration, candidate or otherwise.**
2. **`eq` literal-binding shape — recommendation: emit a single `metadata_filter` jsonb dict, bound as one `$1::jsonb` via supabase-py `.contains("metadata", filter_dict)`.** This rides the exact `d.metadata @> metadata_filter` predicate the RPCs already use (`full-schema.sql:108,132`) and composes cleanly with 114's additive per-literal `$n` WHERE operators (they layer ON TOP as additional `.gte()/.lte()/.in_()` builder calls without touching the `eq` path).
3. **Per-viewer leak-safety — the model is "clone `list_documents`'s caller-scoped own+global-folder query, then AND the compiler filter + folder-subtree scope."** A global view's *definition* is readable (RLS `is_global=true`), but resolution NEVER touches the owner's scope — it runs over the CALLER's visible set, so two users get different results by construction. 404-not-403 on an unseeable view id mirrors `documents.py:1391` / `metadata_field_service` exactly.

**Primary recommendation:** Build a `view_filter_compiler.py` module (closed `OPERATOR_REGISTRY` + `COMBINATOR_REGISTRY`, `@register_operator`/`@register_combinator` decorators mirroring `harness/validators.py:73`), Pydantic `ViewCondition`/`ViewFilter` AST models, and a `document_view_service.py` + `/document-views` router. The compiler's `eq` path produces a `{field: value}` dict → `metadata @> $1::jsonb`. No `eval`, no string interpolation; field names whitelist-checked at save against `_METADATA_BUILTINS ∪ enabled custom fields`, `_`-prefixed keys excluded.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | Save a metadata filter as a named view (sidebar-folder-like; sidebar render is 114) | `document_views` table live (migration 071:46); CRUD clones `metadata_fields.py` router + `metadata_field_service.py`; `name` + `filter_expr jsonb` + `folder_scope` columns exist. |
| VIEW-02 | A view's contents are live; one doc appears in multiple views, no duplication (query-not-copy) | Resolve = a query over `documents`, never a copy. Clone `list_documents` (`documents.py:535`) + add the compiler filter. Two views resolving the same doc both return it — no join table, no materialization. |
| VIEW-04 | Combine multiple equality conditions (AND) | AST `{"op":"and","conditions":[...]}`; compiler folds all `eq` conditions into ONE `metadata @> {k1:v1, k2:v2}` dict (JSONB containment is implicitly AND-of-keys). |
| VIEW-05 | Optionally scope a view to a folder subtree | `folder_scope uuid` column (migration 071:52) → `resolve_project_subtree` (`harness/scope.py:51`) → `.in_("folder_id", subtree_list)`. Unreachable scope → no narrowing (D-113-5). |
| VIEW-06 | Share a view globally without exposing docs the viewer can't see | Per-viewer resolution: definition readable via RLS `is_global=true`, results scoped to caller's own+global-folder set. 404-not-403 on unseeable id. Verified LIVE in secure-phase (two-user leak test). |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-113-1 (Complete listing, not ranked search):** Opening a view resolves to a complete listing of all matching latest-version documents (NOT top-K). Returned as `DocumentResponse` rows (same shape as `GET /documents`), **newest-first** (`created_at desc`), with a **total count**. Custom sort deferred to 114.
- **D-113-2 (Reuse the predicate seam, NOT the vector tool):** Resolution reuses `documents.metadata @> filter` + `folder_id = ANY(<subtree>)` over a plain `documents` listing (mirroring `list_documents` at `documents.py:535`). It does NOT call `match_document_chunks`. ROADMAP SC#1 "resolves through `search_documents(...)`" = "reuse that filter/scope predicate seam," not "invoke the agent's semantic-search tool."
- **D-113-3 (No user share path; globals are admin/seed-only):** v1 has no user-facing "share my view." Migration-071 RLS forces `is_global=false` on every end-user INSERT/UPDATE. Globals are service-role/migration-seeded only. A user's own views are private to them.
- **D-113-4 (Per-viewer resolution = the leak-safe model):** Resolving ANY view (incl. a seeded global one) scopes the documents query to the CALLER's own visible set (own docs + caller's globally-visible-folder docs), applies `filter_expr`, returns the caller's matches. Two users open the same global view → different result sets. No cross-user content/count/facet/existence leakage. Unseeable view id → 404 (not 403). Verified LIVE in secure-phase.
- **D-113-5 (Unreachable `folder_scope` → silently ignored):** A (global) view's `folder_scope` pointing at a folder the caller can't see contributes no narrowing (resolves over caller's full visible set), not error/empty. Seeded globals normally use `folder_scope=NULL` or a global folder.
- **D-113-6 (Explicit condition-list AST, designed once):** `filter_expr` stores `{"op":"and","conditions":[{"field":...,"op":"eq","value":...}]}`. Phase 113 implements ONLY `and` + `eq`; the closed registry REJECTS any other op. Phase 114 registers `gte`/`lte`/`one_of`/`contains`/`is_empty`/relative-date PURELY ADDITIVELY — stored shape never changes, no data migration, no compiler rewrite.
- **D-113-7 (Flat AND-of-conditions; no nested OR/NOT):** Flat AND-of-conditions list. No nested boolean trees. `one_of` (114) handles "OR over one field."
- **D-113-8 (Closed registry + field whitelist + bound literals — no eval/interpolation):** Field names validated against (built-in metadata keys ∪ enabled `metadata_field_definitions`, own+global); `_`-prefixed keys EXCLUDED (D-111-9/D-112-D02). All literals bound as parameters — `eq`-only builds a `metadata_filter` jsonb bound as `$1` for `metadata @> $1::jsonb`. No `eval`, no string interpolation of field names OR values. Injection/SSTI in a value is neutralized — first-class test (SC#4).
- **D-113-9 (Empty filter = no narrowing, valid):** Empty `conditions` is valid → resolves to all docs in `folder_scope` or all visible docs. Not rejected. Table default is `'{}'::jsonb`.
- **D-113-10 (Unknown field — reject at save, tolerate at resolve):** On save/update, every `field` validated against the live whitelist; unknown field REJECTS the write with a clear error. A field valid-at-save-but-later-deleted naturally matches zero docs via `@>` at resolve — non-fatal, no error, no leak. *Optional:* a `stale_fields`/`warnings` note in the resolve response (small, optional in 113; else 119).
- **D-113-11 (Case-sensitive exact equality for v1):** `metadata @>` JSONB containment = case-SENSITIVE exact match. Case/normalization waits for 114's typed indexed columns. Accept case-sensitive exact in 113.
- **D-113-12 (113 owns persistence + resolution):** View CRUD (owner-scoped `POST/GET/PATCH/DELETE`, `is_global=false` forced, `view.create` audit on create) + a resolve endpoint (complete listing + count). Exact route names = planner discretion.
- **D-113-13 (No new SQL migration):** `document_views` + `view.create` already live (migration 071). 113 is purely additive — compiler module + routes + Pydantic models + tests. Perf/indexing is 114's SC; 113 correctness needs no new index. *(Research confirms: GIN index already exists — see §Migration Posture.)*
- **D-113-14 (SC#10 4-axis UAT does NOT apply):** 113 touches none of streaming/agent-loop/provider-routing/UI-state. Acceptance = backend unit tests (compiler correctness + injection/SSTI test) + live :54322 integration + the live cross-user global-view leak test in secure-phase. Agent-tool cross-provider UAT is Phase 115's gate.

### Claude's Discretion
- Exact route paths/verbs; whether resolve is a dedicated endpoint vs. a query param (single resolve endpoint is the contract).
- Whether the compiler emits a `metadata_filter` jsonb riding `@>` containment vs. an equivalent `metadata @> $1::jsonb` WHERE fragment (both parameterized; pick what composes cleanest with 114). **→ Research recommends the `metadata_filter` jsonb dict (§Architecture Pattern 2).**
- Pydantic model layout (`ViewCondition` + `ViewFilter`) and the operator-registry mechanism (mirror `@register_validator` encouraged, not mandated). **→ Research recommends mirroring it (§Architecture Pattern 1).**
- Whether to ship the optional `stale_fields` resolve-warning in 113 or defer wholesale to 119.

### Deferred Ideas (OUT OF SCOPE)
- Range/date/relative-date operators, `one_of`/`contains`/`is_empty`, the view/filter builder UI, sidebar render-as-folder, typed indexed columns + `EXPLAIN` index-use, case normalization → **Phase 114**.
- Agent-tool resolution of a view in chat → **Phase 115** (SC#10 4-axis cross-provider UAT lives there).
- User-facing "share my view" (user-created global/shared views) → not in v3.0 scope; needs a deliberate RLS change + leak-safe share flow.
- Stale-field governance signal → **Phase 119** (links via the resolve-time `stale_fields` hook).
- Custom sort options / sort-by-metadata-field → Phase 114 builder (113 ships newest-first only).
- `spike-nl-workflow-authoring.md` todo — NOT folded (unrelated).
</user_constraints>

## Project Constraints (from CLAUDE.md)

The planner must verify every task complies with these (same authority as locked decisions):

- **No LangChain / no LangGraph** — raw SDK calls only. (Not relevant here — no LLM calls in 113.)
- **Use Pydantic for structured outputs** — the AST models (`ViewCondition`/`ViewFilter`) and request/response models are Pydantic. The compiler validates the AST by parsing it into Pydantic models (rejecting unknown ops via a `Literal["and"]` / `Literal["eq"]` discriminator), NOT by ad-hoc dict-walking.
- **All tables need RLS; users see only their own data (global folders/skills the only shared scope)** — `document_views` RLS is already live (migration 071:125-133). VIEW-06's per-viewer resolution is the app-layer complement to RLS.
- **Wrap blocking supabase-py I/O in `run_in_threadpool` / `aexec`** (D-v2.5-01) — every `.execute()` in the new service/router MUST go through `aexec` (`app.utils.db`) or `run_in_threadpool`. The `metadata_field_service.py` precedent uses `aexec` throughout.
- **Schema changes ship as numbered SQL migrations under `supabase/migrations/`** — N/A this phase (D-113-13; no migration; confirmed below).
- **Settings live in `user_settings`/`app_settings`** — N/A (no new settings).
- **The DM surface is gated behind `app_settings.document_management_enabled` (DMF-03, default on)** — the new routes SHOULD honor this flag the way other DM surfaces will (planner: confirm the gating pattern; the column is live at migration 071:198). NOTE: no existing 111/112 route gates on it yet — `[ASSUMED]` that gating is desired here; flag for the planner to confirm whether 113 introduces the gate or defers it with the rest of the DM surface.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| View CRUD persistence | API / Backend (`/document-views` router → service → supabase-py) | Database (RLS) | Owner-scoped writes; RLS forces `is_global=false`. Mirrors `metadata_fields` router/service. |
| Filter-AST → SQL compilation | API / Backend (pure `view_filter_compiler.py` module) | — | Net-new; pure function, no I/O, fully unit-testable. The injection/SSTI defense lives here. |
| View resolution (listing) | API / Backend (resolve endpoint → `documents` query) | Database (GIN index on `metadata`, `@>` predicate) | Reuses `list_documents` shape + the live `@>` seam + GIN index. |
| Per-viewer leak-safety (VIEW-06) | API / Backend (caller-scoped query construction) | Database (RLS on `document_views` read) | App-layer: resolution runs over the CALLER's visible set, never the owner's. RLS only gates *definition* read. |
| Folder-subtree scope (VIEW-05) | API / Backend (`resolve_project_subtree`) | Database | Reuses the shipped owner-scoped subtree walk; `folder_id = ANY(list)`. |
| Field whitelist | API / Backend (compiler validates against `_METADATA_BUILTINS ∪ enabled defs`) | Database (`metadata_field_definitions` read) | Built-in keys are a static set; custom defs fetched own+global. |
| Audit write | API / Backend (`write_audit_entry`) | Database (`audit_log` CHECK incl. `view.create`) | Fire-and-forget; action already in the live CHECK enum. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pydantic` | already installed (v2.x) | AST models (`ViewCondition`/`ViewFilter`), request/response models, op-discriminator validation | CLAUDE.md mandates Pydantic for structured outputs; project-wide convention. [VERIFIED: codebase — `models/metadata_field.py`, `models/document.py`] |
| `supabase` (`supabase-py`) | 2.29.0 | DB access via the PostgREST query builder | Already the project DB client; `.contains()` maps to `@>`. [VERIFIED: `venv` import — postgrest 2.29.0, supabase 2.29.0] |
| `postgrest` | 2.29.0 | The `.contains("metadata", dict)` builder (→ PostgREST `cs.` → `@>`) | Bundled with supabase-py; `contains` method confirmed present on the sync filter builder. [VERIFIED: `from postgrest import SyncFilterRequestBuilder; 'contains' in dir(...)` → True] |
| `fastapi` | already installed | The `/document-views` router | Project-wide. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `app.utils.db.aexec` | in-repo | `run_in_threadpool`-wrap every supabase `.execute()` | Every DB call in the new async service/router (D-v2.5-01). [VERIFIED: codebase — `metadata_field_service.py` uses it throughout] |
| `app.services.audit_service.write_audit_entry` | in-repo | Fire-and-forget `view.create` audit row | On view creation. [VERIFIED: `audit_service.py:57`; `view.create` in `VALID_ACTION_TYPES` at `:24`] |
| `app.services.harness.scope.resolve_project_subtree` | in-repo | `folder_scope` → owner-scoped subtree `list[str]` | Resolving VIEW-05's folder subtree. [VERIFIED: `harness/scope.py:51`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supabase-py `.contains("metadata", dict)` (PostgREST `@>`) | A dedicated `resolve_document_view` SQL RPC (like `match_document_chunks`) | An RPC is heavier (new migration — violates D-113-13) and unnecessary: the listing has no embedding/ranking. supabase-py `.contains()` covers `@>` natively. **Recommend supabase-py builder; no RPC.** |
| Emit a `metadata_filter` jsonb dict (`@>`) | Per-literal `WHERE metadata->>'field' = $n` fragments now | Per-literal fragments are how 114 will bind range/`one_of` ops; for `eq`-only the jsonb dict is simpler, rides the existing GIN-indexed `@>` seam, and is implicitly AND. **Recommend the jsonb dict for 113; 114 adds per-literal fragments additively on top.** |
| `Literal`-discriminated Pydantic ops (reject-by-parse) | Hand-rolled dict-walk + manual op check | Pydantic discriminated unions reject unknown ops at parse time (no eval, declarative) — strictly safer + less code. **Recommend Pydantic.** |

**Installation:** None. Zero new dependencies. [VERIFIED: all required libraries already in `venv`]

## Package Legitimacy Audit

> Not applicable — Phase 113 installs **no external packages**. Every dependency (pydantic, supabase-py/postgrest 2.29.0, fastapi) is already in the project `venv` and verified at import. No slopcheck run needed (nothing to audit). The one net-new artifact is an in-repo module, not a package.

## Architecture Patterns

### System Architecture Diagram

```
                          POST /document-views  (create)
  user (JWT) ──────────────────────────────────────────────► document_views_router
                                                                     │
                                                                     ├─► view_filter_compiler.validate_filter(filter_expr, whitelist)
                                                                     │      │  (parse AST as Pydantic; reject unknown op;
                                                                     │      │   reject unknown/_-prefixed field at SAVE — D-113-10)
                                                                     │      └─► whitelist = _METADATA_BUILTINS ∪ enabled custom defs
                                                                     │                              (read own+global, _-excluded)
                                                                     ├─► document_view_service.create_view(...)  [is_global=false forced]
                                                                     │      └─► aexec(supabase.table("document_views").insert(...))
                                                                     └─► write_audit_entry("view.create")  [fire-and-forget]

                          GET /document-views/{id}/resolve
  user (JWT) ──────────────────────────────────────────────► document_views_router
                                                                     │
                                                                     ├─► service.get_view(id, caller)  → 404 if not readable (own OR is_global)
                                                                     │                                    (NEVER 403 — no existence leak)
                                                                     ├─► compiler.compile(view.filter_expr) ─► metadata_filter dict {k:v,...}
                                                                     ├─► resolve folder_scope (if set & caller-visible) via
                                                                     │      resolve_project_subtree(folder_scope, caller) → list[str]
                                                                     │      (unreachable scope → None → no narrowing, D-113-5)
                                                                     └─► CALLER-SCOPED documents query  (clone of list_documents):
                                                                            own docs (.eq user_id=caller, .eq is_latest)
                                                                              + globally-visible-folder docs (.in folder_id, .eq is_latest)
                                                                            AND  .contains("metadata", metadata_filter)   ── metadata @> $1::jsonb
                                                                            AND  .in_("folder_id", subtree)               ── (if scope)
                                                                            ─► dedupe by id, sort created_at desc
                                                                            ─► { documents: [DocumentResponse], total: N }
```

**The leak-safety invariant (VIEW-06):** the resolve query's user/folder scoping is built from `caller`, NEVER from `view.user_id`. A global view definition is *shared*; its *results* are computed fresh over each caller's visible set. This is the same predicate the caller's own `GET /documents` uses — so a caller can never see a document via a view that they couldn't already see via the documents list.

### Recommended Project Structure
```
backend/app/
├── models/
│   └── document_view.py          # NET-NEW: ViewCondition, ViewFilter (AST), ViewCreate/Update/Response, ViewResolveResponse
├── services/
│   ├── view_filter_compiler.py   # NET-NEW: closed OPERATOR_REGISTRY + COMBINATOR_REGISTRY,
│   │                             #          @register_operator/@register_combinator, validate_filter(), compile()
│   └── document_view_service.py  # NET-NEW: CRUD + resolve data-access (clones metadata_field_service shape)
└── api/
    └── document_views.py         # NET-NEW: /document-views router (clones metadata_fields.py router shape)
backend/tests/
├── unit/
│   └── test_113_view_filter_compiler.py   # NET-NEW: eq/AND/empty/unknown-op/unknown-field/_-prefix/injection-SSTI
└── integration/
    ├── test_113_view_crud.py              # NET-NEW: live :54322 CRUD + audit row
    ├── test_113_view_resolve.py           # NET-NEW: live resolve (right docs, newest-first, count, query-not-copy)
    └── test_113_view_folder_scope.py      # NET-NEW: live folder-subtree narrowing
# secure-phase: the live two-user cross-user leak test (authored under VALIDATION.md / secure-phase)
```

### Pattern 1: Closed operator/combinator registry (mirror `harness/validators.py`)
**What:** A closed dict + a `@register_*` decorator; an unknown op is a hard reject, never `eval`/dynamic-import.
**When to use:** The compiler's op dispatch (`eq`) and combinator dispatch (`and`), so 114 registers `gte`/`lte`/`one_of`/etc. additively by import side-effect.
**Example (the in-repo analog to mirror):**
```python
# Source: backend/app/services/harness/validators.py:62-104 (VERIFIED)
VALIDATOR_REGISTRY: dict[str, Callable[..., Awaitable[GateResult]]] = {}

def register_validator(kind: str):
    def deco(fn):
        VALIDATOR_REGISTRY[kind] = fn
        return fn
    return deco

@register_validator("json_schema")
async def _validate_json_schema(output, config, ctx) -> GateResult: ...
```
```python
# RECOMMENDED for view_filter_compiler.py (113 registers ONLY eq + and):
OPERATOR_REGISTRY: dict[str, Callable[[str, object], dict]] = {}   # op -> fn(field, value) -> partial metadata_filter contribution

def register_operator(op: str):
    def deco(fn):
        OPERATOR_REGISTRY[op] = fn
        return fn
    return deco

@register_operator("eq")
def _op_eq(field: str, value) -> dict:
    # eq contributes {field: value} to the metadata_filter jsonb (bound as $1::jsonb)
    return {field: value}

# 114 ADDITIVELY: @register_operator("one_of") / ("gte") / ... — no change to eq or the AST shape.
```
**Side-effect registration:** mirror `harness/__init__.py:22-27` — import the compiler's op-module once (e.g. in the service or `app/services/__init__` or at module bottom) so the registry is populated. For 113 the ops live in the same module as the registry, so no separate import is needed; design the seam so 114 can add an `operators_extra.py` imported once.

### Pattern 2: `eq` literal binding via the `metadata @> $1::jsonb` seam (the recommended parameterization)
**What:** Fold all `eq` conditions into ONE `metadata_filter` dict; pass it to supabase-py `.contains("metadata", filter_dict)` which PostgREST renders as `metadata=cs.<json>` → `metadata @> $1::jsonb`. The dict is JSON-serialized and bound as a single parameter — the value is NEVER concatenated into SQL.
**When to use:** Every `eq`-only filter (all of 113).
**Why it composes cleanest with 114:** JSONB containment is implicitly AND-of-keys, so multi-condition AND (VIEW-04) is free. 114's range/`one_of`/`contains` operators bind per-literal as ADDITIONAL builder calls (`.gte("metadata->>field", v)` etc.) layered on top — the `eq` jsonb-dict path is untouched, satisfying D-113-6's "no compiler rewrite."
**Example:**
```python
# Source: the live predicate the RPCs use — full-schema.sql:108,132 (VERIFIED):
#   AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
# supabase-py builder equivalent over a PLAIN documents listing (NO RPC, D-113-2):
q = (
    supabase.table("documents")
    .select("*")
    .eq("user_id", caller_id)
    .eq("is_latest", True)
)
if metadata_filter:                       # {} → skip (D-113-9 empty = no narrowing)
    q = q.contains("metadata", metadata_filter)   # → metadata @> $1::jsonb (param-bound)
if subtree:                               # VIEW-05
    q = q.in_("folder_id", subtree)       # → folder_id = ANY($n)  (list, NEVER a set)
result = await aexec(q)                    # D-v2.5-01: run_in_threadpool
```
NOTE: this codebase has **no existing `.contains()` call site** (grep: 0 matches) — the `@>`-over-a-listing wiring is genuinely net-new for the app (the `@>` was previously only inside the two RPCs). The planner should treat the supabase-py `.contains()` semantics as a thing to prove with a live integration test, not assume.

### Pattern 3: Per-viewer caller-scoped resolution (clone `list_documents`)
**What:** Build the resolve query's user/folder scope from the CALLER (own docs + caller's globally-visible-folder docs), then AND the compiler filter + folder-subtree scope.
**Example (the shape to clone):**
```python
# Source: backend/app/api/documents.py:535-595 (VERIFIED) — own + global-folder + dedupe + created_at desc
own = supabase.table("documents").select("*").eq("user_id", caller).eq("is_latest", True)
global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)   # folder_utils.py:48
glob = supabase.table("documents").select("*").in_("folder_id", global_folder_ids).eq("is_latest", True)
# ...apply .contains(metadata_filter) + .in_(folder_id, subtree) to BOTH; merge, dedupe by id, sort created_at desc, count.
```

### Pattern 4: 404-not-403 owner/visibility miss (no existence leak)
**What:** A view id the caller can't see (not own AND not global) returns 404, not 403. RLS already returns no row; the service collapses a miss to None → router raises 404.
**Example:**
```python
# Source: metadata_field_service.py:100-113 + documents.py:1391 + metadata_fields.py:95-96 (VERIFIED)
view = await service.get_view(view_id, caller)   # RLS: own OR is_global; miss → None
if view is None:
    raise HTTPException(status_code=404, detail="View not found")   # NEVER 403
```

### Anti-Patterns to Avoid
- **String-interpolating field names or values into SQL / a jsonb literal.** Use the param-bound `.contains("metadata", dict)`; never `f"metadata @> '{json}'"`. (SC#4.)
- **Resolving a global view over the OWNER's scope.** Always the caller's scope (VIEW-06). The single most dangerous bug class this phase can ship.
- **Returning a `set` for the folder subtree.** `resolve_project_subtree` returns `list[str]` deliberately (Pitfall 1 — a set breaks supabase-py JSON serialization). Pass the list straight to `.in_()`.
- **Validating the AST by dict-walking with an `if op == ...` ladder.** Use Pydantic `Literal`-discriminated parsing so an unknown op is rejected at parse (declarative, no eval).
- **Filtering on `_confidence`/`_source`/any `_`-prefixed key.** Display-only nested keys (D-111-9/D-112-D02). Exclude from the whitelist; the compiler rejects `_`-prefixed fields at save like `documents.py:1401` does for PATCH.
- **Lowercasing JSONB values for case-insensitive match.** That is the seq-scan anti-pattern 114 SC#1 forbids (D-113-11). Accept case-sensitive exact in 113.
- **Adding a new SQL migration.** None needed (see Migration Posture). A GIN index already exists.
- **`.execute()` directly in an async route.** Wrap in `aexec`/`run_in_threadpool` (D-v2.5-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder-subtree walk for `folder_scope` | A new BFS/recursive parent_id walker | `harness/scope.py:51 resolve_project_subtree` | Owner-scoped, cycle-guarded (IN-01), returns `list[str]` (Pitfall 1), `None`-in→`None`-out. [VERIFIED] |
| Globally-visible folder ids for the caller | A new global-subtree query | `folder_utils.py:48 get_globally_visible_folder_ids` | The exact predicate `list_documents` uses; cached `is_in_global_subtree`. [VERIFIED] |
| `metadata @>` containment | A custom SQL RPC or raw f-string SQL | supabase-py `.contains("metadata", dict)` (postgrest 2.29.0) | Param-bound, GIN-indexed, no migration. [VERIFIED: postgrest `contains` present] |
| Field-whitelist source | A new "list of allowed fields" config | `_METADATA_BUILTINS ∪` enabled custom defs (`read_enabled_field_defs` / `list_field_definitions`) | Built-ins = `set(DocumentMetadata.model_fields)` (`documents.py:1355`); custom = own+global enabled (`embedding_service.py:270`). [VERIFIED] |
| Closed-registry dispatch | A bespoke op-dispatch with eval/getattr | `@register_validator`-style closed dict (`validators.py:73`) | Proven safe pattern; unknown op raises, never eval'd. [VERIFIED] |
| Audit write | A raw `audit_log` insert | `write_audit_entry(..., action_type="view.create")` | Fire-and-forget, swallows errors, `view.create` already valid. [VERIFIED] |
| 404-not-403 + owner-scope | New ad-hoc 403 logic | The `metadata_field_service`/`documents.py:1391` pattern (miss→None→404) | No existence leak; the DM standard. [VERIFIED] |

**Key insight:** The ONLY thing to genuinely build is the compiler (a pure, ~100-line module) and three thin CRUD/resolve wrappers that clone `metadata_fields.py`/`metadata_field_service.py`/`documents.py:535` almost verbatim. Everything load-bearing already exists.

## Runtime State Inventory

> Greenfield-additive phase (new module + new routes + new table rows). Not a rename/refactor/migration. Two state items worth noting explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `document_views` table is **live and empty on :54322** (0 rows — verified). `filter_expr jsonb DEFAULT '{}'`. | None — clean slate. New rows written by view CRUD; the empty default means the resolver MUST handle `{}` gracefully (D-113-9). |
| Live service config | None — no external service holds view state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None new. | None. |
| Build artifacts | None — pure Python module additions; no package rename, no egg-info impact. | None. |

**Nothing found in OS-registered / secrets / build-artifact categories — verified by phase scope (no rename, no installed-package change).**

## Common Pitfalls

### Pitfall 1: Resolving a global view over the owner's scope (the VIEW-06 leak)
**What goes wrong:** Building the resolve query's `user_id`/folder scope from `view.user_id` instead of the caller. Two users would then see the same (owner's) documents through a shared view — a cross-user content leak.
**Why it happens:** The view row carries `user_id` (the creator); it's a tempting but wrong scope source.
**How to avoid:** Scope EVERY resolve from the authenticated caller (own docs + caller's globally-visible-folder docs). `view.user_id` is used ONLY for the readability check, never for results.
**Warning signs:** Two users get identical resolve results for a global view. (Secure-phase test asserts they DIFFER.)

### Pitfall 2: A `set` for the folder subtree breaks supabase-py serialization
**What goes wrong:** Passing a `set` to `.in_("folder_id", ...)` raises in supabase-py's `json.dumps`.
**How to avoid:** `resolve_project_subtree` already returns `list[str]`; keep it a list end-to-end. [VERIFIED: `harness/scope.py:30-31,89`]
**Warning signs:** `TypeError: Object of type set is not JSON serializable` at resolve.

### Pitfall 3: `_`-prefixed keys leaking into the filter
**What goes wrong:** Allowing `_confidence`/`_source` as filter fields — they are nested provenance dicts, not flat dimensions; filtering on them is meaningless and breaks the D-111-9 invariant.
**How to avoid:** Exclude any `_`-prefixed field from the whitelist; reject at save with a 422 (mirror `documents.py:1401`).
**Warning signs:** A view saved with `field: "_confidence"` resolves empty or errors confusingly.

### Pitfall 4: Empty `filter_expr` rejected instead of treated as no-narrowing
**What goes wrong:** Treating `{}` (the table default) or an empty `conditions` list as invalid → a freshly-defaulted view 500s on resolve.
**How to avoid:** Empty filter is VALID → skip `.contains()` entirely, resolve over the (scoped) visible set (D-113-9).
**Warning signs:** A view with no conditions errors instead of listing all docs in scope.

### Pitfall 5: An unknown op silently passing the filter
**What goes wrong:** A `filter_expr` with `op: "regex"` (not registered) silently no-ops or, worse, gets interpreted unsafely.
**How to avoid:** Reject any op not in the closed registry at parse (Pydantic `Literal["eq"]` / `Literal["and"]`) AND at compile (registry `KeyError`). 113 registers ONLY `eq` + `and`. [Mirror `validators.py:233-241`'s "unknown kind fails closed."]
**Warning signs:** A non-`eq` op doesn't raise on save.

### Pitfall 6: Forgetting `is_latest=True` on the resolve query
**What goes wrong:** Resolving stale historical versions (VER-03) → duplicate/old docs in a view.
**How to avoid:** `.eq("is_latest", True)` on both the own and global legs (clone `list_documents`).
**Warning signs:** A view shows multiple versions of one document.

## Code Examples

### Recommended AST models (Pydantic, reject-by-parse)
```python
# RECOMMENDED — models/document_view.py
from typing import Literal
from pydantic import BaseModel

class ViewCondition(BaseModel):
    field: str
    op: Literal["eq"]          # 113: ONLY eq. 114 widens this Literal additively.
    value: str | int | float | bool   # scalar literal (bound as a param)

class ViewFilter(BaseModel):
    op: Literal["and"]         # 113: ONLY and. (114 keeps flat AND; one_of handles OR-over-field.)
    conditions: list[ViewCondition] = []   # empty = no narrowing (D-113-9)
```
An incoming `filter_expr` with `op: "or"` or a condition `op: "gte"` fails `ViewFilter.model_validate(...)` at save → 422. No eval, no manual op-ladder.

### Compiler core (eq → metadata_filter dict; field whitelist at save)
```python
# RECOMMENDED — services/view_filter_compiler.py (sketch)
OPERATOR_REGISTRY: dict[str, callable] = {}
def register_operator(op):                      # mirror @register_validator
    def deco(fn): OPERATOR_REGISTRY[op] = fn; return fn
    return deco

@register_operator("eq")
def _op_eq(field, value): return {field: value}

def validate_fields(flt: ViewFilter, whitelist: set[str]) -> None:
    """Save-time validation (D-113-10). Raises ValueError (→422) on unknown/_-prefixed field."""
    for c in flt.conditions:
        if c.field.startswith("_"):
            raise ValueError(f"field {c.field!r} is not filterable (reserved prefix)")
        if c.field not in whitelist:
            raise ValueError(f"unknown filter field {c.field!r}")

def compile_filter(flt: ViewFilter) -> dict:
    """Resolve-time: fold eq conditions into one metadata_filter jsonb (AND-of-keys)."""
    mf: dict = {}
    for c in flt.conditions:
        fn = OPERATOR_REGISTRY.get(c.op)          # closed; unknown → None
        if fn is None:
            raise KeyError(f"operator {c.op!r} not registered")   # fail closed
        mf.update(fn(c.field, c.value))           # eq → {field: value}
    return mf                                     # {} when empty → caller skips .contains()
```

### Field whitelist assembly
```python
# RECOMMENDED — own+global enabled custom fields ∪ the 7 built-ins
from app.models.document import DocumentMetadata
_BUILTINS = set(DocumentMetadata.model_fields)   # {title,author,date,document_type,topics,language,summary}
custom = {d["field_key"] for d in await metadata_field_service.list_field_definitions(caller, supabase)
          if d.get("enabled")}
whitelist = (_BUILTINS | custom)
# (do NOT add any _-prefixed key — validate_fields rejects them anyway)
```

### Injection / SSTI neutralization (the SC#4 first-class test)
```python
# A payload in a VALUE rides as JSON data, never executed:
flt = ViewFilter(op="and", conditions=[
    ViewCondition(field="document_type", op="eq",
                  value="'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}")])
mf = compile_filter(flt)          # → {"document_type": "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"}
# supabase .contains("metadata", mf) binds mf as $1::jsonb — the value is matched
# literally by @>, never parsed as SQL or a template. The test asserts: no error,
# zero matching docs (no doc has that literal type), table intact.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@>` only inside the two search RPCs | `@>` over a plain `documents` listing via supabase-py `.contains()` | Phase 113 (this phase) | No RPC/migration; reuses the GIN-indexed seam for a non-ranked complete listing. |
| Inline triplicated subtree walks (agent_loop / threads / kb) | One shared `resolve_project_subtree` | Phase 098 | Reuse, don't re-derive (D-113 cites it). |
| Free-form metadata filter dicts | Closed-registry AST compiler with field whitelist + bound literals | Phase 113 | Injection/SSTI-safe, additively extensible (114). |

**Deprecated/outdated:** none relevant. The two search RPCs remain the path for *ranked semantic search*; the view resolver deliberately does NOT use them (D-113-2).

## Migration Posture (open question — RESOLVED)

**No new SQL migration is needed — and no candidate migration either.** Confirmed against both the migration files and the LIVE :54322 DB:

- **`document_views` table:** live (migration `071_dm_foundations.sql:46-55`). Verified on :54322 (`SELECT count(*) FROM document_views` → 0 rows). DDL: `name text NOT NULL`, `filter_expr jsonb NOT NULL DEFAULT '{}'`, `folder_scope uuid REFERENCES folders ON DELETE SET NULL`, `is_global boolean DEFAULT false`, `org_id uuid` (no FK), `user_id` FK CASCADE. [VERIFIED: migration + live DB]
- **The 4 RLS policies:** live (migration 071:125-133) — SELECT `(auth.uid()=user_id OR is_global=true)`; INSERT `(auth.uid()=user_id AND is_global=false)`; UPDATE same WITH CHECK; DELETE `(auth.uid()=user_id)`. [VERIFIED: migration]
- **`view.create` audit action:** live in BOTH the DB CHECK (verified on :54322 — `'view.create' in audit_log_action_type_check` → True) and `audit_service.VALID_ACTION_TYPES` (`audit_service.py:24`). [VERIFIED: live DB + code]
- **GIN index on `documents.metadata`:** **ALREADY EXISTS** — `documents_metadata_gin_idx ... USING gin (metadata)`, from migration `007_document_metadata.sql:7` (2023), verified live on :54322 (`pg_indexes` → `documents_metadata_gin_idx`). So `@>` is correct AND index-accelerated at 113's scale. **CORRECTION to D-113-13's hedge:** the cautious "if a cheap GIN-on-metadata add is warranted it's the only candidate migration" is moot — the index is already there. No migration of any kind. (Phase 114's `EXPLAIN` index-use SC concerns *typed columns* for range/date, a different index story.) [VERIFIED: migration 007 + live `pg_indexes`]
- **`view.delete` audit action** is also live (for the DELETE route, if the planner chooses to audit deletes — D-113-12 only mandates `view.create`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) [VERIFIED: `backend/pytest.ini`] |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py tests/integration/test_113_*.py -q` |

Unit tests live in `tests/unit/` (pure, no DB — e.g. `test_validator_kinds.py` is the registry analog). Live-DB tests live in `tests/integration/` and connect to local :54322 built from `backend/.env` (the 111/112 precedent — `test_111_flat_filter_compat.py` is the `@>` flat-filter analog; conftest plants a fake cloud `SUPABASE_URL`, so integration tests supply the real local client).

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#2 / D-113-6 | `eq` compiles to `{field:value}` (correctness) | unit | `pytest tests/unit/test_113_view_filter_compiler.py::test_eq_compiles -x` | ❌ Wave 0 |
| SC#2 / VIEW-04 | multiple `eq` AND → one `metadata_filter` dict (AND-of-keys) | unit | `...::test_and_folds_conditions -x` | ❌ Wave 0 |
| D-113-9 | empty `conditions` → `{}` → no-narrowing (valid) | unit | `...::test_empty_filter_no_narrowing -x` | ❌ Wave 0 |
| D-113-6/Pitfall 5 | unknown op (`gte`/`or`) rejected at parse/compile | unit | `...::test_unknown_op_rejected -x` | ❌ Wave 0 |
| D-113-10 | unknown field rejected at SAVE (422) | unit | `...::test_unknown_field_rejected_at_save -x` | ❌ Wave 0 |
| D-113-8/Pitfall 3 | `_`-prefixed field excluded/rejected | unit | `...::test_underscore_field_excluded -x` | ❌ Wave 0 |
| **SC#4** | **injection/SSTI in a value neutralized (bound, no exec)** | unit + integration | `...::test_injection_value_neutralized -x` (unit: compiles to literal) + integration (resolve: 0 matches, table intact) | ❌ Wave 0 |
| SC#1 / VIEW-01/02 | view persists + resolves the right docs; one doc in multiple views (query-not-copy) | integration (live :54322) | `pytest tests/integration/test_113_view_resolve.py -x` | ❌ Wave 0 |
| SC#1 / D-113-1 | newest-first (`created_at desc`) + total count | integration | `...test_113_view_resolve.py::test_order_and_count -x` | ❌ Wave 0 |
| VIEW-05 / D-113-5 | folder-subtree narrowing; unreachable scope → no narrowing | integration | `pytest tests/integration/test_113_view_folder_scope.py -x` | ❌ Wave 0 |
| D-113-12 / DMF-01 | `view.create` audit row written on create (LIVE, not mocked) | integration | `pytest tests/integration/test_113_view_crud.py::test_create_writes_audit -x` | ❌ Wave 0 |
| D-113-12 | 404-not-403 on a cross-user/unseeable view id | integration | `...test_113_view_crud.py::test_cross_user_miss_404 -x` | ❌ Wave 0 |
| **SC#3 / VIEW-06** | **two users, same global view → DIFFERENT result sets; no content/count/existence leak; 404-not-403** | **secure-phase / manual live** | live two-user leak test against :54322 (see below) | ❌ Wave 0 (authored under VALIDATION.md / secure-phase) |

### Sampling Rate (Nyquist framing)
- **Per task commit:** the unit suite `pytest tests/unit/test_113_view_filter_compiler.py -x` (sub-second; covers all compiler branches — the highest-signal, fastest oracle). The compiler is pure, so unit coverage of every op/combinator/edge/injection branch is exhaustive at the function level — this is the Nyquist-sufficient sampling for the net-new logic.
- **Per wave merge:** the full 113 suite (unit + the three integration files) against live :54322.
- **Phase gate:** full suite green before `/gsd:verify-work`; the cross-user leak test green in secure-phase.

### Inherently-manual / secure-phase acceptance
- **The cross-user global-view leak test (SC#3 / VIEW-06)** is the live, secure-phase acceptance (the D-102/D-110-5 "static would false-green" lesson — an RLS policy label is NOT proof). **Shape:** seed a `document_views` row with `is_global=true` (service-role) carrying a filter (e.g. `document_type=invoice`). User A and User B each own docs (some matching, some not). Both call `GET /document-views/{seeded_id}/resolve`. Assert: (a) A sees ONLY A's matching docs, B sees ONLY B's; (b) the result sets and the `total` count DIFFER (no shared rows, no shared count); (c) neither sees the other's doc ids/filenames/metadata (no content/facet leak); (d) a user with ZERO matches gets an empty list + `total=0`, never an error or another user's data; (e) `GET /document-views/{nonexistent_or_unseeable_id}/resolve` → 404 (not 403 — no existence leak). Drive it with two real JWTs (or two service-role-scoped caller ids) against :54322, NOT a mock.
- **SC#10 4-axis cross-provider UAT does NOT apply** (D-113-14) — 113 touches no streaming/agent-loop/provider-routing/UI-state surface. The agent-tool cross-provider UAT is Phase 115's gate.

### Wave 0 Gaps
- [ ] `tests/unit/test_113_view_filter_compiler.py` — covers SC#2/SC#4 + all compiler edges (registry analog: `tests/unit/test_validator_kinds.py`).
- [ ] `tests/integration/test_113_view_crud.py` — live CRUD + audit row + 404-not-403 (analog: `tests/integration/test_111_metadata_fields_crud.py`, `test_111_audit_field_create.py`).
- [ ] `tests/integration/test_113_view_resolve.py` — live resolve correctness + newest-first + count + query-not-copy (analog: `test_111_flat_filter_compat.py`).
- [ ] `tests/integration/test_113_view_folder_scope.py` — live folder-subtree narrowing.
- [ ] Secure-phase: the two-user cross-user leak test (authored under VALIDATION.md, run in secure-phase).
- Framework install: none — pytest infra exists and is in active use.

## Security Domain

> `security_enforcement` is enabled (absent in config → enabled). This phase is security-load-bearing: the compiler is an attack surface (SC#4) and VIEW-06 is a cross-user isolation requirement (SC#3).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Closed-registry compiler; per-viewer resolution boundary (caller-scope never owner-scope). |
| V2 Authentication | no (reuses `get_current_user`) | Existing JWT dependency. |
| V4 Access Control | **yes (SC#3)** | Owner-scoped CRUD (RLS forces `is_global=false`); per-viewer resolution; 404-not-403 on miss (no existence leak). |
| V5 Input Validation | **yes (SC#4)** | Pydantic AST parse (reject unknown op/field); field whitelist; `_`-prefix exclusion; all literals param-bound. |
| V6 Cryptography | no | None. |
| V7 Error Handling/Logging | yes | `view.create` audit (DMF-01); fail-closed on unknown op/field; no error-message existence oracle (404 generic). |

### Known Threat Patterns for this stack (FastAPI + Postgres/JSONB + supabase-py)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter value | Tampering | Param-bound `.contains("metadata", dict)` → `metadata @> $1::jsonb`; no string interpolation. (SC#4) |
| SSTI via filter value | Tampering | Values are JSON data matched by `@>`, never rendered/templated. (SC#4) |
| Field-name injection (compiler) | Tampering | Field whitelist (built-ins ∪ enabled defs); reject-at-save; `_`-prefix excluded. |
| Cross-user content/count/existence leak via a global view | Information Disclosure | Per-viewer resolution over the CALLER's visible set; never the owner's. (SC#3 — live two-user test) |
| View-existence enumeration | Information Disclosure | 404-not-403 on any unseeable id; generic error message. |
| Privilege escalation to a global view | Elevation of Privilege | RLS WITH CHECK forces `is_global=false` on end-user INSERT/UPDATE; service hard-sets it (mirror `metadata_field_service.create`). |
| Unknown-op smuggling | Tampering | Closed registry + Pydantic `Literal` discriminator; unknown op fails closed (never eval'd). |
| Unbounded subtree recursion (corrupt folder data) | DoS | `resolve_project_subtree` cycle-guard (IN-01). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new `/document-views` routes SHOULD gate on `app_settings.document_management_enabled` (DMF-03). No existing 111/112 route currently gates on it, so whether 113 introduces the gate or defers it with the rest of the DM surface is unconfirmed. | Project Constraints | LOW — a missing gate is additive to add later; planner should confirm intent during planning (likely "defer the gate to the UI-bearing 114, like 111/112 did"). |
| A2 | supabase-py `.contains("metadata", dict)` renders to `metadata=cs.<json>` → `metadata @> $1::jsonb` with the value param-bound. Confirmed the method EXISTS (postgrest 2.29.0); the exact wire encoding is `[CITED: PostgREST docs — cs operator]` not run live in this session. | Pattern 2 | LOW — verify with the resolve integration test (Wave 0). The RPCs prove `@>` semantics; `.contains()` is the documented builder for it. The phase plan should include a live assertion as a belt-and-suspenders check. |

**If the planner confirms A1 (gating intent) and the resolve integration test confirms A2, both clear.** Neither blocks planning; both are cheap to verify in execution.

## Open Questions

1. **DM feature-flag gating of the new routes (A1).**
   - What we know: `app_settings.document_management_enabled` is live (migration 071:198, default on). 111/112 routes do NOT currently gate on it.
   - What's unclear: whether 113 should introduce the gate or follow 111/112 and defer it.
   - Recommendation: follow precedent — defer the gate (the column is the seam; gating likely lands with the 114 UI surface). Planner to confirm with one line in CONTEXT or treat as Claude's discretion.

2. **Ship the optional `stale_fields` resolve-warning in 113 or defer to 119? (Claude's discretion per D-113.)**
   - What we know: D-113-10 makes a since-deleted field naturally match zero docs (non-fatal). The forward hook is small.
   - Recommendation: defer to 119 unless the planner wants a cheap forward hook — it adds a tiny optional response field with no behavioral risk. Either is acceptable; leaning DEFER to keep 113 minimal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase :54322 | live integration + secure-phase leak tests | ✓ | Postgres 15 (local CLI) | — (tests require it; the project standard) |
| `documents_metadata_gin_idx` | `@>` correctness + speed | ✓ (verified live) | from migration 007 | — (none needed) |
| `document_views` table | view persistence | ✓ (verified live, 0 rows) | migration 071 | — |
| `view.create` audit action (DB CHECK) | DMF-01 audit | ✓ (verified live) | migration 071 | — |
| python venv (`backend/venv`) | running tests/code | ✓ | postgrest/supabase 2.29.0 | — |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none. Every dependency is present and verified live.

## Sources

### Primary (HIGH confidence — live code + live :54322 DB)
- `backend/app/services/harness/validators.py:62-104,233-241` — closed `VALIDATOR_REGISTRY` + `@register_validator` + fail-closed-on-unknown (the compiler registry analog).
- `backend/app/services/harness/validator_kinds.py:191,245,350,388,504` — `@register_validator` side-effect registration in practice.
- `backend/app/services/harness/__init__.py:22-27` — import-side-effect registration pattern (for 114 additive ops).
- `backend/app/services/harness/freshness.py:43-113` — `$N`/`ANY($1::uuid[])` param-bound SQL, no f-string (the parameterization model).
- `backend/app/services/harness/scope.py:51-89` — `resolve_project_subtree` (owner-scoped, cycle-guarded, `list[str]`) for `folder_scope`.
- `backend/app/api/documents.py:535-595` — `list_documents` (own + global-folder + dedupe + `created_at desc` + `is_latest`) — the resolve shape to clone; `:1355,1391,1401,1409` — `_METADATA_BUILTINS`, 404-not-403, `_`-prefix reject, whitelist-at-edit.
- `backend/app/utils/folder_utils.py:48` — `get_globally_visible_folder_ids`.
- `backend/app/services/metadata_field_service.py` + `backend/app/api/metadata_fields.py` — CRUD/service/router shape to clone; field-whitelist source (own+global enabled).
- `backend/app/services/embedding_service.py:233-296` — `_confidence`/`_source` are DISPLAY-ONLY nested keys (D-111-9); `read_enabled_field_defs` (service-role explicit own+global scoping, fail-closed).
- `backend/app/services/audit_service.py:13-26,57-74` — `write_audit_entry` + `view.create` in `VALID_ACTION_TYPES`.
- `backend/app/models/document.py:8-49` — `DocumentMetadata` (7 built-ins, `extra="allow"`) + `DocumentResponse`.
- `backend/app/models/metadata_field.py:17` — `_BUILTINS` set (matches `DocumentMetadata` fields).
- `supabase/migrations/071_dm_foundations.sql:46-55,125-133,198` — `document_views` DDL + 4 RLS policies + DM feature flag.
- `supabase/migrations/007_document_metadata.sql:7` — the existing `documents_metadata_gin_idx`.
- `supabase/full-schema.sql:108,132,1373` — `d.metadata @> metadata_filter` predicate + the live GIN index.
- **Live :54322 verification (psycopg2):** `documents_metadata_gin_idx` present; `document_views` exists (0 rows); `audit_log_action_type_check` contains `view.create`.
- **venv import:** postgrest 2.29.0 / supabase 2.29.0; `SyncFilterRequestBuilder.contains` present.
- `backend/pytest.ini` + `tests/unit/test_validator_kinds.py` + `tests/integration/test_111_flat_filter_compat.py` — test framework + the registry & `@>` flat-filter test analogs.

### Secondary (MEDIUM confidence)
- PostgREST `cs` (contains) operator → `@>` JSONB containment (the documented mapping behind supabase-py `.contains()`). [CITED: postgrest-py 2.29.0 API; verify with the resolve integration test.]

### Tertiary (LOW confidence)
- None — every load-bearing claim verified against live code or the live DB.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all libs verified at import.
- Architecture (registry + resolve + leak-safety): HIGH — every analog cited to file:line and the migration/DB verified live.
- Migration posture: HIGH — GIN index + table + audit action verified on :54322.
- Pitfalls: HIGH — drawn directly from in-repo precedents (098 subtree-set, 111 `@>`, 110/102 leak-test lesson).
- A1 (feature-flag gating) + A2 (`.contains()` wire encoding): MEDIUM — cheap to confirm in execution; neither blocks planning.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable — in-repo code + an applied migration; the only external surface is supabase-py 2.29.0, already pinned)
