# Phase 116: Document Relationships — Backend + Agent Tool - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 7 (3 NEW backend modules, 3 MODIFIED, 1 POSSIBLY-NEW migration)
**Analogs found:** 7 / 7 (every file has an exact or role-match analog already shipped + secured in 113/114/115)

> This phase is a near-exact mirror of Phase 115's read-only agent-tool wiring plus a
> create/remove REST surface that clones the Phase 113/114 `document_views` CRUD. Every
> line number RESEARCH.md cited was re-verified this session against current code (see
> the per-file "verified" notes). One correction to RESEARCH: the next migration number is
> **075** (074 is the highest on disk), not "NNN".

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/document_relationships.py` | route (router) | request-response / CRUD | `backend/app/api/document_views.py:74-199` | exact (CRUD POST/DELETE) |
| `backend/app/services/document_relationship_service.py` | service | CRUD | `backend/app/services/document_view_service.py:47-192` | exact |
| `backend/app/models/document_relationship.py` | model | request-response | `backend/app/models/document_view.py:33-91` | exact |
| `backend/app/services/tool_dispatcher.py` (MOD) | service (tool handler) | request-response (agent read) | `_handle_query_documents_by_view` `tool_dispatcher.py:302-467` | exact |
| `backend/app/services/openai_service.py` (MOD) | config (tool schema) | n/a (static schema) | `SEARCH_DOCUMENTS_TOOL` `openai_service.py:17-53` (shape) + `get_tools` `:967-988` (assembly) | exact |
| `backend/app/main.py` (MOD) | config (router mount) | n/a | `document_views.router` mount `main.py:405,423` | exact |
| `supabase/migrations/075_*.sql` (POSSIBLY NEW) | migration | n/a (DDL) | `043_documents_dedup_unique_index.sql` (partial unique index) | role-match |

---

## Pattern Assignments

### `backend/app/api/document_relationships.py` (route, CRUD)

**Analog:** `backend/app/api/document_views.py:74-199` — verified: `create_view` at `:94-135`, `update_view` (the ownership-before-validation / 404-not-403 ordering oracle) at `:138-185`, `delete_view` at `:188-199`. RESEARCH's cited `:94-135` / `:188-199` are accurate.

**Router prefix + imports pattern** (`document_views.py:47-74`):
```python
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document_relationship import (  # NEW model module
    RelationshipCreate, RelationshipResponse,
)
from app.services import document_relationship_service          # NEW service module
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/document-relationships", tags=["document-relationships"])
```

**POST create pattern — clone `create_view`** (`document_views.py:94-135`):
```python
@router.post("", response_model=ViewResponse, status_code=status.HTTP_201_CREATED)
async def create_view(
    body: ViewCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. validation gate (here: the field-whitelist; for 116: the VISIBLE-BOTH gate, D-116-5)
    #    raise HTTPException(422) on failure
    created = await document_view_service.create_view(
        user_id=current_user["id"], name=body.name,
        filter_expr=body.filter_expr.model_dump(), folder_scope=body.folder_scope,
        supabase=supabase,
    )
    # 3. fire-and-forget governance receipt; write_audit_entry SWALLOWS errors →
    #    the LIVE round-trip is the verification (SC#1 needs the relationship.create row live)
    await write_audit_entry(
        user_id=current_user["id"], action_type="view.create",
        metadata={"view_id": created["id"], "name": body.name}, supabase=supabase,
    )
    return created
```
For 116: `action_type="relationship.create"`, `metadata={"relationship_id": created["id"], "source_doc_id": ..., "target_doc_id": ..., "rel_type": ...}`. The visible-both gate (D-116-5) replaces the field-whitelist gate; resolve BOTH endpoints' readability BEFORE persisting → uniform 422 on an unseeable endpoint (no probe-by-link oracle).

**DELETE own-scoped, 404-not-403 pattern** (`document_views.py:188-199`):
```python
@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_view(
    view_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    removed = await document_view_service.delete_view(
        current_user["id"], view_id, supabase=supabase
    )
    if not removed:
        raise HTTPException(status_code=404, detail="View not found")  # NEVER 403
```
For 116: `DELETE /document-relationships/{relationship_id}` → `relationship.delete` audit after a successful own-scoped delete. (DELETE in `document_views` returns 204 with no audit; 116 must ADD the `relationship.delete` audit-spawn after the delete succeeds — D-116-12.)

**Ordering-oracle guard pattern** (`document_views.py:154-162` — the "ownership BEFORE validation, no 422-vs-404 oracle" comment). Mirror this in `create_relationship`: run the readability/visible-both check BEFORE the self-link/CHECK error so an unseeable id and a malformed body collapse to the same code (Pitfall 4).

---

### `backend/app/services/document_relationship_service.py` (service, CRUD)

**Analog:** `backend/app/services/document_view_service.py:47-192` — verified: `_client` `:47-48`, the `_uid` PostgREST-injection guard `:51-62`, `create_view` `:65-89`, `get_view` (own-or-global readability) `:113-127`, `update_view` `:166-179`, `delete_view` (own-scoped) `:182-192`. RESEARCH's cited `:47-192` is accurate.

**The `_uid` injection guard — reuse VERBATIM** (`document_view_service.py:51-62`):
```python
def _uid(user_id) -> str:
    """Coerce user_id to a canonical UUID string before it is interpolated into a
    PostgREST .or_() filter grammar (WR-02 hardening). The service-role client bypasses
    RLS → these app predicates are the SOLE owner-scoping gate."""
    return str(UUID(str(user_id)))
```
Copy this into the new service unchanged (`from uuid import UUID`). It guards any `.or_()`/`.eq()` that interpolates a runtime UUID.

**Own-scoped delete pattern** (`document_view_service.py:182-192`):
```python
async def delete_view(user_id, view_id: str, supabase: Client | None = None) -> bool:
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE).delete().eq("id", view_id).eq("user_id", str(user_id))
    )
    return bool(result.data)   # False on a cross-user miss → router maps to 404
```
For 116 `delete_relationship`: identical shape, `_TABLE = "document_relationships"`, `.eq("id", rel_id).eq("user_id", caller)`.

**Idempotent insert catching the 23505 race** — clone the established `documents.py:491-505` pattern (verified: the 23505-catch is at `documents.py:496-505`, raising 409; for 116 the catch instead RE-FETCHES and returns the existing edge):
```python
# Pattern (documents.py:491-505 is the in-repo 23505-catch precedent):
try:
    result = await aexec(client.table("document_relationships").insert(payload))
    return result.data[0]
except Exception as exc:                      # supabase-py surfaces 23505 in the message
    if "23505" in str(exc):                   # partial unique idx hit → return existing edge
        existing = await aexec(
            client.table("document_relationships").select("*")
            .eq("user_id", _uid(uid))
            .eq("source_doc_id", src).eq("target_doc_id", tgt).eq("rel_type", rt)
        )
        return existing.data[0]
    raise
```

**Own-or-global latest-version resolver (read-time resolution, D-116-1a mechanism (a))** — mirror `documents.py:535-561` (verified: own `is_latest=True` at `:540-548`; global-folder docs at `:550-561`). This is the live `GET /documents` access model. The new resolver `_resolve_readable_latest(doc_id_or_filename, caller)` must:
```python
# own leg: documents WHERE user_id = caller AND is_latest = True
# global leg: documents WHERE folder_id IN get_globally_visible_folder_ids(...) AND is_latest = True
# every .execute() wrapped in aexec (D-v2.5-01). Filename match must be EXACT + own-or-global.
```
RESEARCH Open Question 2 recommendation: extract this as a small shared helper in the new service (FastAPI-import-free) so both the create gate AND the tool handler call it in-process — the 115 "one core, no fork" precedent.

**ANTI-PATTERN — do NOT reuse `retrieval_service.py:189-213` `resolve_document_id`** (verified: own-only `.eq("user_id", user_id)` at `:195`, NO global leg; partial-match `ilike("filename", f"%{filename}%")` fallback at `:208`). D-116-3 requires EXACT match + own-or-global. Write the exact own-or-global resolver above instead.

---

### `backend/app/models/document_relationship.py` (model, request-response)

**Analog:** `backend/app/models/document_view.py:33-91` — verified: the `Literal`-discriminated `op` at `:42-54`, `ViewCreate`/`ViewUpdate`/`ViewResponse` at `:73-91`.

**`Literal`-discriminated enum pattern** (`document_view.py:34-54`) — the parse-time reject-unknown mechanism (422, no if-ladder):
```python
from typing import Literal
from pydantic import BaseModel

class ViewCondition(BaseModel):
    op: Literal["eq", "gte", "lte", "one_of", ...]   # unknown op → ValidationError at parse → 422
```
For 116:
```python
class RelationshipCreate(BaseModel):
    source_doc_id: str            # creation-time doc id (resolved to latest at read, D-116-1a)
    target_doc_id: str
    rel_type: Literal["supersedes", "amends", "references", "attached_to"]  # mirrors the DB CHECK (migration 071:68)

class RelationshipResponse(BaseModel):
    id: str
    user_id: str | None = None
    source_doc_id: str
    target_doc_id: str
    rel_type: str
    created_at: str | None = None
```
The `Literal` rejects a forged `rel_type` at parse (clean 422); the DB CHECK at `migration 071:67-68` is defense-in-depth. (RESEARCH cited `document_view.py:34-75`; the response/ad-hoc models extend to `:91`/`:111` — `:33-91` is the load-bearing request/response slice for 116.)

---

### `backend/app/services/tool_dispatcher.py` (MODIFIED — add `_handle_get_related_documents` + 1 registry line) (service, agent read)

**Analog:** `_handle_query_documents_by_view` at `tool_dispatcher.py:302-467` — verified EXACT. The leak-safe compact-row + `source_refs` + calm-error template.

**Compact-rows + `source_refs` pattern** (`tool_dispatcher.py:425-467`):
```python
rows = (full.get("documents") or [])[:limit]
compact = [{
    "document_id": d["id"],
    "filename": d["filename"],
    "document_type": (d.get("metadata") or {}).get("document_type"),
    ...
} for d in rows]
source_refs = [{"document_id": d["id"], "filename": d["filename"]} for d in rows]
# ... fire-and-forget audit via getattr-guarded ctx.spawn ...
return ToolResult(
    result=json.dumps({
        "mode": "results", "total": total, "shown": shown, "truncated": total > shown,
        "documents": compact,
        "source_refs": source_refs,   # citable channel, ALSO embedded so the model can cite by id+filename
    }),
    source_refs=source_refs,
)
```
For 116: each compact row adds `rel_type` + `direction` ("outgoing"|"incoming") + `label` (rel_type as-is for outgoing, inverse for incoming). `source_refs` = the SEEABLE endpoints only (masked targets contribute no citable ref).

**Calm-error contract — NEVER raise into the loop** (`tool_dispatcher.py:352-360, 418-423`):
```python
except Exception as e:  # noqa: BLE001 — calm-string contract; never raise into the loop
    return ToolResult(result=json.dumps({
        "status": "catalog_unavailable",
        "message": f"...: {e}",
        "hint": "...",
    }))
...
except ResolveError as e:   # extracted core raises ResolveError, NOT HTTPException
    return ToolResult(result=json.dumps({"status": "invalid_filter", "message": e.detail, "hint": "..."}))
```
For 116: an unresolvable subject (bad `document_id`, unknown `filename`, neither provided) returns a calm JSON `ToolResult` string ("not found, here's what to do") — NOT a raise. The 115 WR-01/WR-03 lesson. The agent loop's catch at `agent_loop.py:2097` (`except (ValueError, RuntimeError)` → `f"Tool error: {e}"`, verified) is a backstop the handler must NOT depend on.

**Leak-safe masking (D-116-9, SC#2 core — the one genuinely net-new behavior)**: for each edge's OTHER endpoint, re-check caller-readability (own-or-global via the shared resolver) at read time; if unseeable, emit `{"document_id": None, "filename": "linked document (no access)", "rel_type": ..., "direction": ...}` — never the masked doc's real title/metadata. The `document_relationships` RLS is user-scoped only (verified `migration 071:142-150`, no `is_global`), so the EDGES returned are already the caller's own; masking applies to the TARGET DOC access, not the edge. Verify LIVE two-user, non-vacuous (Pitfall 2).

**Inverse-label map** (RESEARCH recommendation, D-116-2):
```python
_INVERSE_LABEL = {
    "supersedes":  "superseded_by",
    "amends":      "amended_by",
    "references":  "referenced_by",
    "attached_to": "has_attachment",   # incoming view of "A attached_to B" → "B has_attachment A"
}
# outgoing query: WHERE user_id = caller AND source_doc_id = subject_latest_id  → label = rel_type
# incoming query: WHERE user_id = caller AND target_doc_id = subject_latest_id  → label = _INVERSE_LABEL[rel_type]
```

**`_TOOL_REGISTRY` line — add EXACTLY ONE** (`tool_dispatcher.py:2567-2598`, verified — the 115 line is `:2596-2597`):
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    ...
    # Phase 115 (VIEW-07) — registry + get_tools BOTH; threads.py untouched (G-5)
    "query_documents_by_view": _handle_query_documents_by_view,
    # Phase 116 (REL-04) — ADD THIS LINE:
    "get_related_documents": _handle_get_related_documents,
}
```

**Dispatch whitelist guard = SC#2 free** (`tool_dispatcher.py:2640-2655`, verified): `dispatch_tool` refuses any tool not in `ctx.phase_whitelist` when a workflow is active; `phase_whitelist is None` in Deep Mode → byte-identical dispatch. No 116 change needed here — the new tool inherits the guard.

**`ToolContext` fields available to the handler** (`tool_dispatcher.py:80-126`, verified): `current_user` (`{"id": str}`), `folder_subtree_ids` (list | None — do NOT thread into the relationship read; the tool is whole-KB like the 115 view path), `supabase`, `spawn` (getattr-guard it like 115 does at `:439`), `emit`, `model`. `ToolResult` (`:129-137`): `result` (str), `source_refs`, `citations`, `similarity_score`.

**Read-audit policy (RESEARCH Open Question 1 / A2 — planner's call)**: D-116-12 mandates audit ONLY for create/remove. The 115 read tool fired a `search.query` audit tagged `via:"view"` (`tool_dispatcher.py:442`). For 116 the planner may either skip the read audit (simplest, no SC requires it) OR reuse `search.query` tagged `via:"relationship"`. Do NOT add a new audit enum value (would need a migration, violating D-116-11).

---

### `backend/app/services/openai_service.py` (MODIFIED — add `GET_RELATED_DOCUMENTS_TOOL` + 1 `get_tools` entry) (config, static schema)

**Shape analog:** `SEARCH_DOCUMENTS_TOOL` at `openai_service.py:17-53` (verified — flat scalar `query` + `required: ["query"]`). **Assembly analog:** `get_tools()` at `:967-988` (verified).

**⚠ THE MULTI-TYPE LANDMINE — DO NOT COPY IT** (`openai_service.py:159`, verified):
```python
# QUERY_DOCUMENTS_BY_VIEW_TOOL has this at :159 — the a5b0b917 Gemini-breaker:
"value": {"type": ["string", "number", "boolean", "null"]},   # multi-type array → google-genai 400 on the WHOLE tool
```
The 116 tool MUST use **flat scalar-string fields only** — NO multi-type `type` arrays, NO `anyOf`/`oneOf` (stripped silently on Google → constraint vanishes). Two optional scalar strings; the either/or stated in PROSE, validated in the handler:
```python
GET_RELATED_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "get_related_documents",
        "description": (
            "Fetch a document's typed relationships (its linked documents). Returns BOTH "
            "directions: documents THIS one points at (supersedes/amends/references/attached_to) "
            "AND documents that point at THIS one (shown with inverse labels: superseded_by, "
            "amended_by, referenced_by, has_attachment). Use for 'what supersedes this contract?', "
            "'what is this attached to?', 'show related docs'. Identify the document by `document_id` "
            "(preferred — reuse an id from search_documents / query_documents_by_view) OR by exact "
            "`filename`. Provide exactly one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string", "description": "Id of the document whose relationships to fetch (preferred; reuse an id from a prior search result)."},
                "filename": {"type": "string", "description": "Exact filename of the document (use when you do not have its id). Case-insensitive."},
            },
            # No top-level `required` (so a missing/ambiguous arg → calm catalog-style error, not a hard schema reject).
            # The either/or is PROSE-only. Both fields are scalar strings → the Google boundary
            # (_translate_nullable_type, google_service.py:270) is a no-op → zero Gemini risk.
        },
    },
}
```

**`get_tools()` assembly — add ONE entry** (`openai_service.py:970-977`, verified):
```python
tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, QUERY_DOCUMENTS_BY_VIEW_TOOL,
         GET_RELATED_DOCUMENTS_TOOL,   # ← ADD HERE (Phase 116 REL-04 — Deep-visible, SC#1)
         LS_TOOL, TREE_TOOL, ...]
```
SC#1 / D-116-10: the tool MUST be in BOTH `_TOOL_REGISTRY` AND this `get_tools()` list (the INVERSE of `render_template`, which is registry-only / harness-only). The 115 inline comment at `:978-981` documents exactly this contract — mirror it.

---

### `backend/app/main.py` (MODIFIED — mount the new router) (config)

**Analog:** the `document_views.router` mount, verified at `main.py:405` (import) and `:423` (include):
```python
# :405 — add document_relationships to the import line:
from app.api import (..., metadata_fields, document_views, document_relationships)  # noqa: E402
# :423 — add after the document_views mount:
app.include_router(document_relationships.router)  # Phase 116 REL-01/03 — typed-link create/remove CRUD
```

---

### `supabase/migrations/075_*.sql` (POSSIBLY NEW — additive partial unique index, D-116-6) (migration)

**Analog:** `043_documents_dedup_unique_index.sql` (verified — the partial-unique-index precedent). Note: 043 is DESTRUCTIVE (it pre-deletes duplicates); the 116 index is purely ADDITIVE (no existing relationship rows to dedupe in dev, and even if some exist the planner decides whether to pre-clean). **Next migration number is 075** (074 is the highest on disk — RESEARCH's "NNN" → 075).

**Pattern** (mirror 043 part (b), the additive index only):
```sql
-- Migration 075: document_relationships idempotency unique index (Phase 116, REL-01, D-116-6).
-- ADDITIVE — race-immune idempotency for (source, target, rel_type) per user.
-- Apply MANUALLY (paste into Supabase SQL editor / psycopg2-direct) — NEVER `supabase db push`.
CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx
  ON public.document_relationships (user_id, source_doc_id, target_doc_id, rel_type);
```
The app-code SELECT-then-INSERT catches the 23505 this index throws and returns the existing edge (see the service section). The index is the only race-immune guarantee (TOCTOU otherwise — Pitfall 3). **Planner's call** whether to add the index or rely on app-code-only (RESEARCH recommends both: index = guarantee, app-code = graceful return).

**Migration discipline (CLAUDE.md, MANDATORY):** filename must match `<digits>_name.sql`; apply by pasting into the Supabase SQL editor (NEVER `supabase db push`/`db reset` — preserves dev data); then regenerate `supabase/full-schema.sql` via `bash scripts/regenerate-full-schema.sh`.

---

## Shared Patterns

### Authentication / DI
**Source:** `document_views.py:50, 87-89` (`get_current_user`, `get_supabase` Depends)
**Apply to:** Both REST routes (`create_relationship`, `delete_relationship`). The agent tool uses `ctx.current_user["id"]` instead (no FastAPI DI in the handler).
```python
current_user: dict = Depends(get_current_user)
supabase: Client = Depends(get_supabase)
```

### PostgREST injection guard (`_uid`)
**Source:** `document_view_service.py:51-62`
**Apply to:** The new service — copy `_uid` verbatim; wrap every runtime UUID interpolated into a `.or_()`/`.eq()` predicate. The service-role client bypasses RLS, so app predicates are the sole owner-scoping gate (WR-02 hardening, proven in 113/114/115).

### Async blocking-I/O wrap (`aexec` / `run_in_threadpool`)
**Source:** `document_view_service.py:88` (`aexec`), `documents.py:436,457` (`run_in_threadpool`)
**Apply to:** EVERY supabase-py `.execute()` in the new service and tool handler (D-v2.5-01). The service uses `aexec(client.table(...)...)`; never bare `.execute()` in an async handler.

### Fire-and-forget audit (`write_audit_entry`)
**Source:** `audit_service.py:57-75` (writer, swallows errors at `:73-74`); route-side `await write_audit_entry(...)` at `document_views.py:129-134`; tool-side getattr-guarded `ctx.spawn(write_audit_entry(...))` at `tool_dispatcher.py:439-449`
**Apply to:** Create (`relationship.create`) + remove (`relationship.delete`) — both action types already in `VALID_ACTION_TYPES` (`audit_service.py:22`, verified) and the live `audit_log` CHECK (`migration 071:33`, verified). NO frozenset-sync/boot-guard dance, NO audit migration (D-116-12). SC#1 requires the `relationship.create` row to land LIVE (the swallow-on-failure means the live round-trip is the only real proof).

### 404-not-403 (no existence leak)
**Source:** `document_views.py:162,184,199` (`raise HTTPException(status_code=404, ...)  # NEVER 403`)
**Apply to:** `delete_relationship` (cross-user/absent miss → 404), and the visible-both gate on create (an unseeable endpoint → uniform 422/404, no ordering oracle — Pitfall 4).

### Calm-string tool errors (never raise into the agent loop)
**Source:** `tool_dispatcher.py:352-360, 418-423`; backstop catch at `agent_loop.py:2097` (verified)
**Apply to:** `_handle_get_related_documents` — every failure path (unresolvable subject, DB error, bad arg) returns a calm `ToolResult(result=json.dumps({...}))`, never a raise (the 115 WR-01/WR-03 lesson).

---

## No Analog Found

None. Every file has an exact or close role-match analog shipped + secured in Phases 113/114/115. The one genuinely net-new BEHAVIOR (not a missing analog) is the leak-safe target-doc masking on the read tool (D-116-9) — its pattern is the 115 per-viewer caller-scoping, but the specific "linked document (no access)" masking on a JOINed target must be proven LIVE two-user, non-vacuous (the "static would false-green" lesson, Pitfall 2).

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/models/`, `supabase/migrations/`, `backend/app/main.py`
**Files scanned (read this session):** `document_views.py`, `document_view_service.py`, `document_view.py`, `tool_dispatcher.py` (4 ranges), `openai_service.py` (4 ranges), `documents.py` (4 ranges), `audit_service.py`, `retrieval_service.py`, `agent_loop.py`, `main.py`, `migration 071`, `migration 043`
**Line-number verification:** all RESEARCH.md citations re-verified against current code; deltas noted inline (handler `:302-467` ✓, registry `:2567-2598` ✓ with the 115 line at `:2596-2597`, `get_tools` `:967-988` ✓ with assembly at `:970-977`, multi-type landmine `:159` ✓, CRUD `:74-199` ✓, service `:47-192` ✓). One correction: next migration number is **075** (RESEARCH said "NNN").
**Pattern extraction date:** 2026-06-20
