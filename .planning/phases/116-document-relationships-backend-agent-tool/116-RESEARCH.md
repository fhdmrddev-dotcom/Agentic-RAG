# Phase 116: Document Relationships — Backend + Agent Tool - Research

**Researched:** 2026-06-20
**Domain:** FastAPI REST CRUD + agent-tool wiring over a live Supabase RLS table; version-stable identity resolution over the `(user_id, filename, is_latest)` lineage model; cross-provider tool-schema design
**Confidence:** HIGH (this is a near-exact mirror of Phase 115's read-only agent-tool wiring; every must-resolve item is grounded in `file:line` evidence read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-116-1 (Follow-to-latest — links never go stale):** a link always surfaces the CURRENT latest version of the linked document. A re-upload (new version) or a version restore MUST NOT orphan or stale the link. *Policy locked; only the mechanism (D-116-1a) is open.*
  - Versioning model: re-upload INSERTs a NEW `documents` row with a NEW `id`, bumps `version_number`, sets old rows `is_latest=false` (kept, not deleted; `documents.py:457-463`, restore `:648-666`). Hard-delete CASCADEs the relationship away (FK `ON DELETE CASCADE`). Lineage grouped ONLY by `(user_id, filename, is_latest=true)` — NO lineage/group UUID, NO `previous_version_id`.
  - **D-116-1a (Mechanism = researcher/planner discretion):** (a) read-time resolution OR (b) re-point on version bump. **RESEARCH RESOLVES THIS BELOW.**
  - **⚠ Flagged fragility:** filename rename would break `(user_id, filename)` grouping. **RESEARCH CONFIRMS RENAME DOES NOT EXIST BELOW.**
- **D-116-2 (Both directions, inverse-labeled):** `get_related_documents` returns both outgoing (this doc is source) and incoming (this doc is target) edges; incoming surfaced with inverse phrasing.
- **D-116-3 (Tool input — `document_id` primary + exact-filename fallback):** subject identified by `document_id` (held from `search_documents`/`query_documents` `source_refs`) AND an exact filename. Filename resolves caller-scoped → latest accessible version (own-or-global). Single clear arg shape weak models can fill; honors the `minimax-m3-invalid-tool-args-400` watch item. **RESEARCH PROPOSES THE EXACT GEMINI-SAFE SCHEMA BELOW.**
- **D-116-4 (Compact, citable rows):** each related doc is a compact row — `filename` + `document_id` + `rel_type` + `direction` (+ inverse label for incoming) — mirroring the 115 compact-row + `source_refs` shape so the answer is citable. Exact field set = planner discretion within this shape.
- **D-116-5 (Visible-only — block probe-by-link):** link creation requires BOTH source AND target be documents the creator can currently see (own-or-global). Linking to an unseeable doc is rejected. Self-link already blocked by `no_self_rel` CHECK.
- **D-116-6 (Idempotent on duplicate):** creating the same `(source, target, rel_type)` twice is an idempotent no-op returning the existing edge — not a duplicate row, not an error. Table has NO unique constraint today; planner decides app-code check vs additive partial unique index. **RESEARCH RECOMMENDS BELOW.**
- **D-116-7 (Single directed edge — inverse derived, never stored):** "A supersedes B" stores EXACTLY one row; the inverse is derived at read time.
- **D-116-8 (API write, agent read-only):** create + remove are backend REST endpoints (consumed by Phase 117 panel); the agent gets ONLY the read-only `get_related_documents` tool. Agent-driven create/remove is deferred.
- **D-116-9 (Leak-safe masking — SC#2):** a relationship whose target the caller can't see renders as **"linked document (no access)"** — never the title/metadata. Same per-viewer leak-safe pattern as D-113-4 / D-115-6; verify LIVE in secure-phase. `document_relationships` RLS is user-scoped only (no `is_global`) → the tool returns only the caller's own edges; masking applies to the **target doc** access, not edge ownership.
- **D-116-10 (Agent-tool wiring contract — SC#1):** `get_related_documents` MUST be in `_TOOL_REGISTRY` AND in `get_tools()` (the inverse of harness-only `render_template`). Acceptance = the model actually invokes it live. New tool = one `_handle_*` + one `_TOOL_REGISTRY` line + one `get_tools` schema; `threads.py` untouched (G-5). `dispatch_tool` whitelist guard = SC#2 for free.
- **D-116-11 (No new migration):** composes the live `document_relationships` table + the live documents/version model. Zero schema change (a partial unique index per D-116-6, if chosen, is an additive index — planner's call).
- **D-116-12 (First-class relationship audit):** a create writes `relationship.create`; a remove writes `relationship.delete` — both already in `VALID_ACTION_TYPES` (`audit_service.py:21-22`) and the live `audit_log` CHECK (migration 071 line 33). NO frozenset-sync/boot-guard dance, NO audit migration. Fire-and-forget. SC#1 requires the `relationship.create` row to land live.

### Claude's Discretion
- The follow-to-latest **mechanism** (D-116-1a: read-time resolve vs re-point-on-upload). → **Resolved: read-time resolution (a).**
- Idempotency enforcement **site** (D-116-6: app-code check vs additive partial unique index). → **Resolved: additive partial unique index (recommended) + app-code SELECT-then-INSERT fallback.**
- Exact **inverse-label** wording per rel_type (D-116-2) and the exact **field set** on each compact row (D-116-4). → **Proposed below.**
- Tool **name** + JSON-schema arg shape for the `document_id`-XOR-`filename` discriminator (D-116-3). → **Proposed below: `get_related_documents`, two flat optional string fields, NO multi-type arrays.**
- The create/remove **route shape** + request models. → **Proposed below: `POST /document-relationships`, `DELETE /document-relationships/{id}`.**

### Deferred Ideas (OUT OF SCOPE)
- Agent-driven create/remove of relationships (the agent links documents autonomously) — out of REL-04's scope (D-116-8).
- Provenance / "linked against version N" history — D-116-1 keeps v1 navigation-only; re-open if Phase 119 governance wants it.
- Relationship types beyond the four (`supersedes`/`amends`/`references`/`attached_to`) — fixed by the table CHECK; extending is an additive migration in a later phase.
- The relationship panel UI — Phase 117 (REL-02). This phase is backend-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | User can create a typed link between two documents (supersedes / amends / references / attached-to) | `POST /document-relationships` + visible-both validation (D-116-5) + idempotency (D-116-6) + `relationship.create` audit (D-116-12). Mirrors `document_views.py:94-135` `create_view`. |
| REL-03 | User can remove a relationship | `DELETE /document-relationships/{id}` own-scoped, 404-not-403 + `relationship.delete` audit. Mirrors `document_views.py:188-199` `delete_view`. |
| REL-04 | The agent can retrieve a document's related documents via a `get_related_documents` tool | `_handle_get_related_documents` + dual-wired `_TOOL_REGISTRY` (`tool_dispatcher.py:2567`) + `get_tools()` (`openai_service.py:970`). Both-directions read (D-116-2), compact citable rows (D-116-4), leak-safe "no access" masking (D-116-9). Mirrors `_handle_query_documents_by_view` (`tool_dispatcher.py:302`). |

REL-02 (relationship panel UI) = Phase 117, out of scope.
</phase_requirements>

## Summary

Phase 116 is a low-risk, high-precedent phase: it ships TWO backend surfaces over an already-live RLS table (`document_relationships`, migration 071) whose audit actions (`relationship.create`/`relationship.delete`) are already enum-synced and boot-guarded. There is **zero net-new persistence machinery** — both surfaces are clones of patterns that shipped and were secured in Phases 113/114/115. The REST create/remove API mirrors `document_views.py` CRUD verbatim (POST/DELETE + own-scoped service + fire-and-forget audit). The read-only agent tool mirrors `_handle_query_documents_by_view` (`tool_dispatcher.py:302`) verbatim (caller-scoped resolution, compact rows, `source_refs`, calm-error contract, fire-and-forget audit, dual registry+`get_tools` wiring).

All six must-resolve items resolve cleanly from `file:line` evidence: **(1) follow-to-latest mechanism = read-time resolution (a)**, because the **filename-rename path does not exist** (confirmed: the only PATCH endpoints are `/move` and `/metadata`; `/metadata` hard-blocks any field outside `_METADATA_BUILTINS` + custom fields, and `filename` is a top-level column, not metadata — `documents.py:1304/1358`, `1401-1410`), so the re-point-on-bump coupling (b) buys nothing and adds upload-pipeline blast radius. **(2)** The Gemini-safe arg schema is trivially achievable here — unlike 115's polymorphic `value` field (which forced the a5b0b917 boundary fix), a `document_id` + `filename` discriminator is two scalar strings with **no multi-type arrays at all**. **(3)** Idempotency is best enforced with an **additive partial unique index** (concurrency-safe, race-immune) backed by an **app-code SELECT-then-INSERT** that catches the 23505 to return the existing edge. **(4)** Inverse labels and the two-query read shape are specified below.

**Primary recommendation:** Clone `document_views.py` for the REST surface and `_handle_query_documents_by_view` for the tool; use **read-time latest-version resolution** keyed on `(user_id, filename, is_latest=true)`; store one directed edge and derive the inverse at read; enforce idempotency with an additive partial unique index + a 23505-catching upsert. Keep the tool arg schema to two flat scalar strings so it is Gemini-safe and MiniMax-fillable by construction. The only genuinely net-new risk is the leak-safe target-doc masking on the read tool — verify it LIVE with a two-user test (the "static would false-green" lesson).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create/remove typed link | API / Backend (`document_relationships.py` router) | Database / Storage (RLS table + audit) | REST write surface the human-curated Phase 117 panel consumes (D-116-8). Business rules (visible-both, idempotency) live in the router/service, not the DB. |
| Version-stable link identity (follow-to-latest) | API / Backend (read-time resolver in the tool handler + GET routes) | Database (`(user_id, filename, is_latest)` index) | Read-time resolution keeps the upload pipeline untouched; the lineage lookup is a cheap indexed query. |
| Agent neighborhood traversal | API / Backend (`tool_dispatcher.py` handler) | Database (two indexed source/target queries) | The agent reads via the in-process tool surface; `threads.py` untouched (G-5). |
| Leak-safe target-doc masking | API / Backend (handler caller-scoping) | Database (RLS user-scoping is defense-in-depth, NOT the proof) | The handler scopes the target-doc readability check from the CALLER; RLS label is not the proof (verify live). |
| Audit receipt | API / Backend (fire-and-forget `write_audit_entry`) | Database (`audit_log` CHECK enum, already synced) | First-class `relationship.create`/`.delete` actions, no migration. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | (in-repo, pinned in `backend/requirements.txt`) | REST router for create/remove | Project standard; all DM CRUD routers use it (`document_views.py`, `metadata_fields.py`) |
| Pydantic v2 | (in-repo) | Request/response models for the relationship create body | CLAUDE.md mandate ("Pydantic for structured LLM outputs"); `Literal`-discriminated `rel_type` rejects unknown types at parse → 422 (mirrors `ViewCondition.op`) |
| supabase-py | (in-repo) | Service-role client; all `.execute()` wrapped in `aexec`/`run_in_threadpool` | Project standard; D-v2.5-01 (no blocking I/O in async handlers) |

**No new dependencies.** This phase composes existing modules only.

### Supporting (existing modules to clone / reuse)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `backend/app/api/document_views.py` | The CRUD route template (POST/DELETE + audit-spawn + 404-not-403) | Clone for `document_relationships.py` router |
| `backend/app/services/document_view_service.py` | The data-access service template (`_uid` UUID-coercion guard, `aexec` wrap, own-scoped delete) | Clone for `document_relationship_service.py` |
| `backend/app/services/tool_dispatcher.py:302` `_handle_query_documents_by_view` | The read-only agent-tool handler template (caller-scoped, compact rows, `source_refs`, calm-error, fire-and-forget audit) | Clone for `_handle_get_related_documents` |
| `backend/app/services/openai_service.py:107` `QUERY_DOCUMENTS_BY_VIEW_TOOL` | The tool-schema constant template | Clone for `GET_RELATED_DOCUMENTS_TOOL` |
| `backend/app/services/audit_service.py:57` `write_audit_entry` | Fire-and-forget audit writer | Reuse directly (no new action types) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Read-time latest-version resolution (a) | Re-point old_id→new_id on version bump (b) | (b) gives trivial reads but couples to the upload pipeline (`documents.py:457-463` cascade + restore `:648-666`); since rename does not exist, (a)'s `(user_id, filename, is_latest)` grouping never breaks → (b)'s only advantage (rename-robustness) is moot. **Reject (b).** |
| Additive partial unique index for idempotency | App-code SELECT-then-INSERT only | App-code-only has a TOCTOU race (two concurrent identical creates both pass the SELECT, both INSERT → two rows). The index is the only race-immune guarantee. **Use both** (index = guarantee; app-code catches 23505 → returns existing). |
| `Literal`-discriminated `rel_type` in the create body | Plain `str` + DB CHECK only | The DB CHECK rejects bad types but with a 500-ish error; the Pydantic `Literal` rejects at parse with a clean 422 (mirrors `ViewCondition.op`). **Use Literal.** |

**Installation:** None — no new packages.

**Version verification:** N/A (zero net-new dependencies; all modules are in-repo).

## Package Legitimacy Audit

> Not applicable — this phase installs **no external packages**. It composes existing in-repo modules (`fastapi`, `pydantic`, `supabase-py`) already pinned in `backend/requirements.txt` and in production use across Phases 110-115. No slopcheck / registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   Phase 117 panel UI    │  REST WRITE SURFACE (D-116-8, human-curated) │
   (future) ───POST────► │  POST /document-relationships                │
                         │   1. body: {source_doc_id, target_doc_id,    │
                         │      rel_type}  (Pydantic Literal rel_type)  │
                         │   2. visible-both gate (D-116-5):            │
                         │      both ids readable by caller? ──no──►422 │
                         │   3. idempotency (D-116-6):                  │
                         │      SELECT existing (src,tgt,type)?         │
                         │        ├─ exists ──► return existing (200)   │
                         │        └─ none ──► INSERT (catch 23505 race) │
                         │   4. fire-and-forget write_audit_entry(      │
                         │         relationship.create) ──► audit_log   │
                         └──────────────────┬──────────────────────────┘
                         ┌──────────────────┴──────────────────────────┐
   Phase 117 panel ───DELETE──►  DELETE /document-relationships/{id}    │
                         │   own-scoped delete; 404-not-403 on miss;    │
                         │   fire-and-forget relationship.delete audit  │
                         └──────────────────────────────────────────────┘

   ┌───────────────────────────── document_relationships table (migration 071) ──┐
   │  id · user_id · org_id · source_doc_id(FK CASCADE) · target_doc_id(FK CASCADE)│
   │  rel_type CHECK[4] · no_self_rel CHECK · RLS user-scoped only (no is_global)  │
   │  + (recommended additive) partial unique idx (user_id,source,target,rel_type) │
   └───────────────────────────────────────────────────────────────────────────────┘

   Deep-mode chat ──model emits──►  get_related_documents tool (REL-04, read-only)
                         ┌──────────────────────────────────────────────┐
                         │  _handle_get_related_documents(args, ctx)     │
                         │   1. resolve subject doc id:                  │
                         │      args.document_id ──► verify caller-      │
                         │        readable + map to latest version       │
                         │      else args.filename ──► exact (ilike)     │
                         │        caller-scoped → latest accessible       │
                         │      neither/unresolvable ──► calm "not found"│
                         │   2. two queries on the LATEST subject id:    │
                         │      outgoing: source_doc_id = subject        │
                         │      incoming: target_doc_id = subject        │
                         │   3. for each edge's OTHER endpoint:          │
                         │      resolve to latest version (D-116-1a)     │
                         │      + caller-readable? ──no──► mask as        │
                         │        "linked document (no access)" (D-116-9)│
                         │   4. compact rows + inverse labels (D-116-2): │
                         │      {document_id, filename, rel_type,        │
                         │       direction, label} + source_refs         │
                         │   5. fire-and-forget search.query audit OR    │
                         │      (optional) no audit on read (planner)    │
                         └──────────────┬───────────────────────────────┘
   dispatch_tool guard ───►  phase_whitelist None in Deep = byte-identical (SC#2 free)
   _TOOL_REGISTRY (+1 line)  +  get_tools() (+1 schema)  =  SC#1 dual-wiring; threads.py UNTOUCHED
```

### Recommended Project Structure
```
backend/app/
├── api/
│   └── document_relationships.py     # NEW — clone document_views.py (POST/DELETE + audit)
├── services/
│   └── document_relationship_service.py  # NEW — clone document_view_service.py (aexec, _uid guard)
│   └── tool_dispatcher.py            # EDIT — +1 handler _handle_get_related_documents, +1 _TOOL_REGISTRY line
│   └── openai_service.py             # EDIT — +1 GET_RELATED_DOCUMENTS_TOOL schema, +1 entry in get_tools() list
├── models/
│   └── document_relationship.py      # NEW — RelationshipCreate (Literal rel_type) + RelationshipResponse
└── main.py                           # EDIT — +1 include_router(document_relationships.router)
```

### Pattern 1: The REST create surface (clone `create_view`)
**What:** A thin POST router that validates the visible-both gate, enforces idempotency, persists, and fires the audit.
**When to use:** REL-01.
**Example (shape mirrors `document_views.py:94-135`):**
```python
# Source: backend/app/api/document_views.py:94 (create_view) — the template
@router.post("", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship(body: RelationshipCreate, current_user=Depends(get_current_user), supabase=Depends(get_supabase)):
    # 1. Visible-both gate (D-116-5): BOTH endpoints readable by the caller (own-or-global),
    #    each resolved to its latest version. An unseeable endpoint → 422 (closes probe-by-link).
    #    Reuse the own-or-global readability the documents list path already encodes
    #    (documents.py:540-561: own is_latest=true ∪ global-folder is_latest=true).
    # 2. no_self_rel is enforced by the table CHECK (migration 071:66); a self-link → 422 mapped.
    # 3. Idempotency (D-116-6): SELECT-then-INSERT; on 23505 (partial unique idx) return existing.
    created_or_existing = await document_relationship_service.create_relationship(...)
    # 4. Fire the governance receipt (DMF-01) — async, swallows errors → LIVE round-trip is the proof.
    await write_audit_entry(user_id=current_user["id"], action_type="relationship.create",
                            metadata={"relationship_id": created_or_existing["id"], ...}, supabase=supabase)
    return created_or_existing
```

### Pattern 2: The read-only agent tool (clone `_handle_query_documents_by_view`)
**What:** A handler that resolves the subject doc, runs two edge queries, masks unseeable targets, and returns compact citable rows.
**When to use:** REL-04.
**Example (shape mirrors `tool_dispatcher.py:302`, esp. `:425-467` compact-rows + source_refs):**
```python
# Source: backend/app/services/tool_dispatcher.py:425 (compact rows + source_refs)
async def _handle_get_related_documents(args: dict, ctx: ToolContext) -> ToolResult:
    caller = ctx.current_user["id"]
    # 1. Resolve subject → its LATEST version id (read-time resolution, D-116-1a):
    #    document_id arg → verify caller-readable, map filename→is_latest=true row;
    #    else exact filename → caller-scoped latest (own-or-global). Unresolvable → calm string.
    # 2. Two queries on the subject's latest id (outgoing + incoming).
    # 3. For each OTHER endpoint: resolve to latest + caller-readable check; if unseeable,
    #    emit {"document_id": None, "filename": "linked document (no access)", ...} (D-116-9).
    # 4. compact rows + inverse labels; source_refs = the SEEABLE endpoints only.
    # NEVER raise into the loop — a resolve miss / DB error returns a calm ToolResult string
    #   (the 115 calm-error contract; agent_loop.py:2097 catches ValueError but the handler
    #    must not depend on that — return calm strings, the 115 WR-01/WR-03 lesson).
    return ToolResult(result=json.dumps({...}), source_refs=source_refs)
```

### Pattern 3: Gemini-safe tool arg schema (NO multi-type arrays)
**What:** Two flat optional scalar-string fields — the simplest possible discriminator.
**When to use:** D-116-3.
**Example:**
```python
# Source: openai_service.py:107 (QUERY_DOCUMENTS_BY_VIEW_TOOL) — same flat-XOR-in-prose pattern,
#         but SIMPLER: no nested object, no multi-type `type` array → trivially Gemini-safe.
GET_RELATED_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "get_related_documents",
        "description": (
            "Fetch a document's typed relationships (its linked documents). Returns BOTH "
            "directions: documents THIS one points at (e.g. it supersedes/amends/references "
            "another) AND documents that point at THIS one (e.g. another supersedes it → "
            "shown as 'superseded_by'). Use for 'what supersedes this contract?', 'what is "
            "this attached to?', 'show related docs'. Identify the document by `document_id` "
            "(preferred — use an id you already have from search_documents / "
            "query_documents_by_view) OR by exact `filename`. Provide exactly one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string", "description": "The id of the document whose relationships to fetch (preferred; reuse an id from a prior search result)."},
                "filename": {"type": "string", "description": "Exact filename of the document (use when you do not have its id). Case-insensitive."},
            },
            # No top-level `required`; the either/or is stated in PROSE (never anyOf/oneOf —
            # Gemini function-calling rejects them). Both fields are SCALAR strings — NO
            # multi-type `type` arrays (the a5b0b917 trap), so the Google boundary
            # (_translate_nullable_type) is a no-op for this schema → zero Gemini risk.
        },
    },
}
```

### Anti-Patterns to Avoid
- **Multi-type `type` arrays in the arg schema** (e.g. `{"type": ["string", "null"]}`): the boundary sanitizer (`google_service.py:270` `_translate_nullable_type`) *would* collapse them, but the 115 a5b0b917 incident proves "the boundary handles it" is not "the boundary is exercised correctly under every shape." Keep the 116 schema to plain scalar strings — there is no reason to use a nullable-type array for two optional fields (omission = absent, which the handler already treats as "not provided"). **Confidence: HIGH** ([CITED: google_service.py:270-309], [VERIFIED: openai_service.py:159 is the exact 3-type field that broke Gemini]).
- **`anyOf`/`oneOf` to express the XOR**: stripped by `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` (`google_service.py:256-257`) → silently dropped on Google → the constraint vanishes. State the XOR in prose, validate in the handler (the 115 D-115-13 discipline).
- **Storing the inverse edge as a second row** (D-116-7 rejects this): double rows, sync risk on delete, double audit. Derive the inverse at read.
- **App-code-only idempotency without the index**: TOCTOU race → duplicate rows under concurrency. Add the partial unique index.
- **Raising HTTPException / ValueError from the tool handler**: `agent_loop.py:2097` catches `ValueError`/`RuntimeError` as a `Tool error:` string, but the 115 calm-error-contract lesson (WR-01/WR-03 holes) is to return a calm `ToolResult` JSON string from the handler itself, so the model gets a useful "not found, here's what to do" rather than a bare error. **Confidence: HIGH** ([VERIFIED: agent_loop.py:2097]; [CITED: tool_dispatcher.py:352-360 calm-string contract]).
- **Resolving the filename via `resolve_document_id` (`retrieval_service.py:189`)**: that helper is **own-only** (`user_id = caller`, no global) AND falls back to **partial `ilike` matching** (`:202-212`). D-116-3 requires **exact** match + **own-or-global**. Do NOT reuse it as-is; write an exact own-or-global resolver (or extend it with a flag). **Confidence: HIGH** ([VERIFIED: retrieval_service.py:189-213]).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID-into-PostgREST `.or_()` injection guard | A regex validator | `_uid()` from `document_view_service.py:51` (wraps in `UUID(str(...))`) | The service-role client bypasses RLS — app predicates are the sole owner-scoping gate; `_uid` makes the one unparameterized spot safe by construction (WR-02 hardening, already proven in 113/114/115) |
| Fire-and-forget audit | Manual `asyncio.create_task` | `write_audit_entry` (`audit_service.py:57`) + `ctx.spawn(...)` in the tool | Swallows errors (D-05), already the standard; the LIVE round-trip is the verification |
| Reject unknown `rel_type` | A manual if-ladder | Pydantic `Literal["supersedes","amends","references","attached_to"]` | Parse-time 422, mirrors `ViewCondition.op`; DB CHECK is defense-in-depth |
| Latest-version lookup | A new RPC | The `(user_id, filename, is_latest=true)` partial index (migration 025) via a `.eq("is_latest", True)` query | The index already exists; `documents.py:540-561` is the own-or-global latest pattern to mirror |
| Async blocking-I/O wrap | Bare `.execute()` | `aexec` / `run_in_threadpool` (D-v2.5-01) | Every supabase-py call in an async handler must be wrapped; the whole codebase enforces it |

**Key insight:** Every primitive this phase needs already shipped and was secured in 113/114/115. The phase's value is in correctly composing them — especially the leak-safe target-doc masking, which is the one genuinely net-new behavior and must be proven LIVE (not by reading the RLS label).

## Runtime State Inventory

> This is **NOT** a rename/refactor/migration phase — it is additive (new routes + new tool + zero schema change). This section is included only to discharge the ⚠ filename-rename flag from D-116-1a, which is a *runtime-state robustness* question.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `document_relationships` rows store `source_doc_id`/`target_doc_id` as the **creation-time** document `id` (a specific version row). With read-time resolution (a), these are resolved to latest at read — no migration of stored rows needed. | None — read-time resolution handles version drift |
| Live service config | None — no external service holds relationship identity | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Filename-rename fragility (the D-116-1a flag) | **Documents CANNOT be renamed today.** The ONLY PATCH endpoints are `/{id}/move` (folder change, `documents.py:1304`) and `/{id}/metadata` (`documents.py:1358`). `/metadata` rejects any field outside `_METADATA_BUILTINS` ∪ enabled custom fields (`:1401-1410`), and `filename` is a top-level `documents` column, NOT a metadata key → unreachable via that PATCH. There is no `PATCH /filename`, no rename mutation anywhere in `documents.py` (verified by grep over all `@router.(patch\|put\|post)` decorators). | **None.** Because rename does not exist, read-time `(user_id, filename, is_latest)` grouping never breaks → mechanism (a) is safe and simpler. If a rename endpoint is ever added, a re-point or a lineage-UUID becomes necessary — flag as a `re_open_trigger` for a future phase. |

**Verified by:** `Grep '@router\.(patch|put|post|delete|get)' documents.py` → only `/move` and `/metadata` PATCH; `Grep 'filename|rename|PATCH'` confirms no filename-mutation path. **Confidence: HIGH.**

## Common Pitfalls

### Pitfall 1: The filename resolver is own-only and partial-match
**What goes wrong:** Reusing `resolve_document_id` (`retrieval_service.py:189`) for the D-116-3 filename fallback returns a partial-match (`ilike '%name%'`) and only the caller's OWN docs — violating D-116-3's "exact filename" + "own-or-global" requirement.
**Why it happens:** It's the obvious nearby helper; `_handle_analyze_document` (`tool_dispatcher.py:476`) uses it.
**How to avoid:** Write an exact, own-or-global, latest-version resolver for the tool (or extend `resolve_document_id` with an `exact=True, include_global=True` flag). Mirror the own-or-global latest pattern from `documents.py:540-561`.
**Warning signs:** A user names a doc and gets relationships for a DIFFERENT doc whose name is a superstring; or a global doc's relationships are not found.

### Pitfall 2: Leak-safe masking verified by RLS label, not live
**What goes wrong:** The team reads the RLS policy ("user-scoped only") and concludes targets can't leak — but the tool returns the **caller's own edges**, and a target doc on one of those edges could be a doc the caller can no longer see (e.g. it was moved out of a global folder). The title/metadata of that target must be masked.
**Why it happens:** The "static would false-green" trap (D-102 / D-110-5 / D-113-4). The RLS label protects the *edge* (user-scoped); it does NOT protect the *target doc's metadata* the handler joins in.
**How to avoid:** The handler must re-check **each endpoint's** caller-readability (own-or-global) at read time and mask unseeable ones as `"linked document (no access)"` (D-116-9). Prove it with a LIVE two-user test that drives the handler (clone `test_115_tool_global_leak.py`) — NOT a unit test that asserts the RLS label.
**Warning signs:** A two-user test passes vacuously (both users own everything, so masking never triggers). Seed a target doc visible to user A, link it, then make it unseeable to user B and assert B sees the mask.

### Pitfall 3: Idempotency TOCTOU race
**What goes wrong:** App-code SELECT-then-INSERT without a DB constraint: two concurrent identical creates both pass the SELECT (no existing row), both INSERT → two duplicate edges. D-116-6 says there should be exactly one.
**Why it happens:** The table has no unique constraint today (migration 071:57-69 has only `no_self_rel` + the rel_type CHECK).
**How to avoid:** Add an **additive partial unique index** `(user_id, source_doc_id, target_doc_id, rel_type)` (a CREATE INDEX, no data migration — D-116-11 explicitly permits this). The app-code path then catches the 23505 unique-violation and returns the existing edge (exactly the pattern `documents.py:496-505` already uses for the upload dedup race). The index is the only race-immune guarantee.
**Warning signs:** Duplicate edges appear under rapid double-clicks from the Phase 117 panel.

### Pitfall 4: `no_self_rel` + visible-both ordering oracle
**What goes wrong:** Returning different status codes (404 vs 422) depending on whether the unseeable endpoint check or the self-link check fires first can leak existence ("this id exists but you can't see it" vs "this id doesn't exist").
**Why it happens:** Multiple validation gates with different error codes.
**How to avoid:** The visible-both gate (D-116-5) collapses an unseeable endpoint to a uniform 422 (or 404) regardless of why; do the readability check BEFORE the self-link/CHECK error, mirroring `update_view`'s "ownership BEFORE validation" ordering (`document_views.py:154-162`, the explicit "no 422-vs-404 ordering oracle" comment).
**Warning signs:** A probe can distinguish "id you can't see" from "id that doesn't exist."

## Code Examples

### Resolving a subject doc → its latest version (read-time, own-or-global)
```python
# Pattern (own-or-global latest), mirrors documents.py:540-561 own ∪ global merge.
# For the tool: given a document_id, find its (user_id?, filename), then the is_latest=true
# sibling readable by the caller. Wrap every .execute() in aexec (D-v2.5-01).
# Source: backend/app/api/documents.py:540 (own is_latest) + :550-561 (global folders)
```

### Idempotent insert catching the 23505 race
```python
# Source: backend/app/api/documents.py:491-505 — the established 23505-catch pattern
try:
    result = await aexec(client.table("document_relationships").insert(payload))
    return result.data[0]
except Exception as exc:
    if "23505" in str(exc):  # partial unique idx hit → fetch & return the existing edge
        existing = await aexec(client.table("document_relationships").select("*")
            .eq("user_id", uid).eq("source_doc_id", src).eq("target_doc_id", tgt).eq("rel_type", rt))
        return existing.data[0]
    raise
```

### Inverse-label map (D-116-2) and the two-query read shape
```python
# Outgoing edge (subject is source): label = rel_type as-is ("this supersedes X")
# Incoming edge (subject is target): label = INVERSE ("Y supersedes this" → "superseded_by")
_INVERSE_LABEL = {
    "supersedes":   "superseded_by",
    "amends":       "amended_by",
    "references":   "referenced_by",
    "attached_to":  "has_attachment",   # the inverse of "X is attached_to Y" is "Y has_attachment X"
}
# Two queries on the subject's LATEST id:
#   outgoing = SELECT * WHERE user_id=caller AND source_doc_id = subject_latest_id
#   incoming = SELECT * WHERE user_id=caller AND target_doc_id = subject_latest_id
# (user_id=caller because the table is user-scoped; the edges returned are the caller's own.)
# direction field: "outgoing" | "incoming"; label: rel_type | _INVERSE_LABEL[rel_type]
```

**Inverse-label recommendation (D-116-2):** use `superseded_by` / `amended_by` / `referenced_by` / `has_attachment`. Rationale: the first three are the natural passive-voice inverses (unambiguous to weak models); for `attached_to`, the directional edge "A is attached_to B" (A is the attachment, B is the parent) means the **incoming** view from B's perspective is "B **has_attachment** A" — `has_attachment` reads more naturally than `attached_to_by` and tells the agent "this doc has attachments." Document the directionality convention (source = the attachment, target = the parent) in the create-route description so the Phase 117 panel and the agent agree.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-element `[X,"null"]`-only Gemini nullable guard | Generic multi-type-array collapse in `_translate_nullable_type` | Phase 115, commit a5b0b917 | Any multi-type `type` array is now sanitized at the Google boundary — but 116 avoids them entirely (scalar strings only), so this is moot for 116 |
| `render_template` registered in `_TOOL_REGISTRY` but NOT in `get_tools` (harness-only) | Read tools dual-wired (registry AND `get_tools`) for Deep visibility | Phase 101 visibility bug → 115 D-115-8 | `get_related_documents` MUST be in BOTH (SC#1, D-116-10) |
| 115 reused the `search.query` audit (no relationship enum) | 116 has first-class `relationship.create`/`relationship.delete` already in the enum (migration 071:33, `audit_service.py:21-22`) | Phase 110 | No frozenset-sync/boot-guard dance, no audit migration (D-116-12) |

**Deprecated/outdated:** None relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The agent reliably holds `document_id` values from prior `search_documents`/`query_documents_by_view` `source_refs` and can pass them to `get_related_documents` | D-116-3 premise | LOW — verified the flow (`agent_loop.py:2087-2088` accumulates `source_refs`; `tool_dispatcher.py:464` embeds `source_refs` in the JSON the model reads). The filename fallback is the safety net when the model lacks the id. |
| A2 | "no audit on read" vs "reuse `search.query` audit" for the tool is planner discretion; D-116-12 only mandates the audit for create/remove (write surface) | Tool handler step 5 | LOW — D-116-12 names create/remove. The 115 tool DID fire a `search.query` audit (`tool_dispatcher.py:442`); 116's planner may mirror that or skip read-audit. Flagged for the planner to decide; either is acceptable (no SC requires a read audit). |
| A3 | The own-or-global readability for the visible-both gate can reuse the `documents.py:540-561` own ∪ global-folder pattern without a new RPC | D-116-5 | LOW — that pattern is the live `GET /documents` access model; extracting/mirroring it is mechanical. |

**Note:** No `[ASSUMED]` package or compliance claims exist in this research — every load-bearing claim is `[VERIFIED: file:line]` or `[CITED: file:line]` from code read this session.

## Open Questions

1. **Read-tool audit policy (A2 above)**
   - What we know: D-116-12 mandates audit ONLY for create/remove (the write surface). The 115 read tool fired a `search.query` audit tagged `via:"view"`.
   - What's unclear: Whether `get_related_documents` should fire a read audit (and under what action_type — there is no `relationship.read` in the enum; reusing `search.query` is the 115 precedent).
   - Recommendation: Planner's call. Default to **no read audit** (simplest; no SC requires it) OR reuse `search.query` tagged `via:"relationship"` if read observability is wanted. Do NOT add a new audit enum value (that would need a migration, violating D-116-11).

2. **Visible-both resolver extraction vs inline**
   - What we know: Both the create gate (D-116-5) and the tool's subject/endpoint resolution need the same "is this doc readable by the caller, and what's its latest version" logic.
   - What's unclear: Whether to extract a shared `_resolve_readable_latest(doc_id_or_filename, caller)` helper (like 115 extracted `resolve_filter`) or inline it in both sites.
   - Recommendation: Extract a small shared resolver in the new `document_relationship_service.py` — the 115 precedent (one core, no fork) avoids the leak-safe logic drifting between the write gate and the read tool. Keep it free of FastAPI imports so the tool can call it in-process.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres `:54322` | Live integration tests + the two-user leak proof | ✓ (per CLAUDE.md local-dev infra; 113/114/115 tests run against it) | 15.x | Tests skip cleanly when unreachable (the 115 pattern: `_pg_reachable` guard) |
| `document_relationships` table (migration 071) | All write/read paths | ✓ (live; verified by `test_110_dm_schema.py:43`) | — | — |
| `relationship.create`/`.delete` in audit CHECK | DMF-01 audit | ✓ (live; `test_110_dm_audit_live.py:38`; `audit_service.py:21-22`) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Live Postgres for integration tests (skips cleanly; CI-safe).

## Validation Architecture

> Nyquist validation is enabled (no `workflow.nyquist_validation: false` in config). This section maps every success criterion to observable test/verification points so the orchestrator can derive `116-VALIDATION.md`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 7.x + pytest-asyncio (`asyncio_mode = auto`) — same as 113/114/115 |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py tests/integration/test_116_*.py -q` |
| Live DB | Local Postgres `:54322`; integration tests skip cleanly when unreachable (`_pg_reachable` guard, cloned from `test_115_tool_global_leak.py`) |

### Phase Requirements → Test Map

| SC | Behavior | Req | Test Type | Automated Command | File Exists? |
|----|----------|-----|-----------|-------------------|-------------|
| SC#1 | `POST /document-relationships` creates a typed link; visible-both gate rejects an unseeable endpoint (422); self-link rejected (422) | REL-01 | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ❌ Wave 0 |
| SC#1 | Idempotency: same `(source,target,rel_type)` twice → one row, returns existing (no 409, no duplicate) | REL-01 | integration (LIVE) | `pytest tests/integration/test_116_idempotency.py -x` | ❌ Wave 0 |
| SC#1 | `DELETE /document-relationships/{id}` removes; 404-not-403 on a cross-user/absent miss | REL-03 | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ❌ Wave 0 |
| SC#1 | `relationship.create` audit row lands LIVE on create (the async round-trip is the proof) | REL-01 / DMF-01 | integration (LIVE) | `pytest tests/integration/test_116_audit_live.py -x` | ❌ Wave 0 |
| SC#1 | Version-stable: after a re-upload (new version) OR a restore, the link still resolves to the LATEST version (read-time resolution) | REL-01 | integration (LIVE) | `pytest tests/integration/test_116_version_stable.py -x` | ❌ Wave 0 |
| SC#2 | `get_related_documents` dual-wired: in `_TOOL_REGISTRY` AND in `get_tools()` | REL-04 | unit | `pytest tests/unit/test_116_tool_wiring.py -x` | ❌ Wave 0 |
| SC#2 | Tool schema is Gemini-safe: NO anyOf/oneOf, NO multi-type `type` arrays; two scalar-string fields; either/or in prose | REL-04 | unit | `pytest tests/unit/test_116_tool_schema.py -x` | ❌ Wave 0 |
| SC#2 | Handler returns BOTH directions with correct inverse labels; compact rows + `source_refs`; calm-error on unresolvable subject (no raise) | REL-04 | unit + integration (LIVE) | `pytest tests/unit/test_116_handler.py tests/integration/test_116_tool_read.py -q` | ❌ Wave 0 |
| SC#2 | **Leak-safe masking (LIVE two-user proof):** a target the caller can't see renders as `"linked document (no access)"` — never the title/metadata; drives the HANDLER, not the RLS label | REL-04 | integration (LIVE) | `pytest tests/integration/test_116_tool_leak.py -x` | ❌ Wave 0 |
| SC#2 | `dispatch_tool` whitelist guard refuses the tool when excluded / dispatches when allowed (SC#2-free, byte-identical Deep) | REL-04 | unit | `pytest tests/unit/test_116_whitelist_guard.py -x` | ❌ Wave 0 |
| SC#3 | SC#10 4-axis cross-provider UAT (native-7 × multi-tool × parallel-thread × long-message) | REL-04 | **manual-only** (live model emission) | — (authored in VALIDATION.md, tracked in `116-HUMAN-UAT.md`) | n/a |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_116_*.py -q` (schema/wiring/handler — fast, no DB)
- **Per wave merge:** full suite (adds live integration on `:54322`, including the two-user leak proof)
- **Phase gate:** full suite green + the live leak proof green (non-vacuous) before `/gsd:verify-work`
- **Max feedback latency:** ~5s (the 113/114/115 actual)

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_116_tool_wiring.py` — SC#2 dual-registration (`_TOOL_REGISTRY` AND `get_tools()`)
- [ ] `backend/tests/unit/test_116_tool_schema.py` — SC#2 schema-shape (NO anyOf/oneOf, NO multi-type `type` arrays, two scalar-string fields)
- [ ] `backend/tests/unit/test_116_handler.py` — both-directions + inverse labels + compact rows + calm-error-on-unresolvable
- [ ] `backend/tests/unit/test_116_whitelist_guard.py` — SC#2 dispatch guard (extend `test_tool_budget.py`)
- [ ] `backend/tests/integration/test_116_relationship_crud.py` — POST create + visible-both 422 + self-link 422 + DELETE 404-not-403 (LIVE)
- [ ] `backend/tests/integration/test_116_idempotency.py` — duplicate create → one row, returns existing (LIVE)
- [ ] `backend/tests/integration/test_116_audit_live.py` — `relationship.create` row lands live (LIVE)
- [ ] `backend/tests/integration/test_116_version_stable.py` — re-upload + restore → link follows latest (LIVE)
- [ ] `backend/tests/integration/test_116_tool_read.py` — handler returns both directions, source_refs (LIVE)
- [ ] `backend/tests/integration/test_116_tool_leak.py` — **the two-user leak proof, driving the HANDLER** (clone `test_115_tool_global_leak.py`); seed a target visible to A, link it, make it unseeable to B, assert B sees the mask (NON-vacuous)
- [ ] No framework install needed (pytest + pytest-asyncio present)

### Manual-Only Verifications (SC#10 — authored in VALIDATION.md, NOT PLAN tasks)
Per CLAUDE.md "UAT scoreboard recipe": the 4-axis bandwidth (native-7 cross-provider × multi-tool × parallel-thread × long-message). These do NOT block nyquist-compliance (Phase 104/111.1/115 precedent — live-model tool emission is inherently un-automatable). Tracked in `116-HUMAN-UAT.md` (status: partial).
- **Cross-provider × document_id-vs-filename:** for each native-7 provider, in a Deep chat with seeded linked docs: (1) ask "what supersedes [doc]?" → expect an incoming-edge `superseded_by` result; (2) ask "show related documents for [filename]" → expect the filename-fallback path. Record per provider: did it emit the call (yes/no), did it fill `document_id` OR `filename` correctly (yes/no). **Gemini row = the no-multi-type-array proof** (a 400 = schema regression). **MiniMax row = the `minimax-m3-invalid-tool-args-400` watch point** — confirm the two-string arg does not WORSEN it; PASS or document as a known provider limitation (NOT this phase's fix).
- **Multi-tool:** "find the indemnity clause, then show me what supersedes that contract" → expect `search_documents` THEN `get_related_documents`.
- **Parallel-thread:** Thread A streaming a relationships answer while Thread B accepts a new prompt; no cross-thread bleed in rows/`source_refs`.
- **Long-message:** ≥ 50 prior messages OR ≥ 5 KB prompt ending in "...now show related docs for [doc]" → tool still fires, arg still fills.

## Security Domain

> `security_enforcement` is enabled (absent = enabled). This phase touches access-control + input-validation directly (per-viewer leak-safety is the SC#2 core), so the section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Caller-scoped resolution at the service boundary (RLS = defense-in-depth, not the proof) |
| V2 Authentication | no | Reuses `get_current_user` JWT (unchanged) |
| V4 Access Control | **yes (core)** | Visible-both gate on create (D-116-5); per-viewer leak-safe target masking on read (D-116-9); own-scoped delete (404-not-403); RLS user-scoping (migration 071:142-150) |
| V5 Input Validation | **yes** | Pydantic `Literal` rel_type (parse-time 422); `_uid` UUID-coercion guard against PostgREST `.or_()` injection (`document_view_service.py:51`); exact-filename resolver (no partial-match probe surface) |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling | yes | 404-not-403 on cross-user miss (no existence leak); calm-string tool errors (no stack leak to the model) |

### Known Threat Patterns for FastAPI + Supabase RLS + agent-tool

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Probe-by-link (create a link to an id you can't see → existence oracle) | Information Disclosure | Visible-both gate (D-116-5): reject unseeable endpoints with a uniform code; readability check BEFORE the self-link/CHECK gate (no ordering oracle) |
| Cross-viewer target leak (related-doc title/metadata of a doc the caller can't see) | Information Disclosure | Per-viewer readability re-check at read; mask as `"linked document (no access)"` (D-116-9); **verify LIVE two-user, non-vacuous** (the "static would false-green" lesson) |
| PostgREST `.or_()` filter-grammar injection via user_id | Tampering / Elevation | `_uid()` UUID-coercion guard (`document_view_service.py:51`) — reuse verbatim |
| Idempotency race → duplicate edges | Tampering (data integrity) | Additive partial unique index + 23505-catch upsert |
| Unknown/forged `rel_type` | Tampering | Pydantic `Literal` (422) + DB CHECK (defense-in-depth) |
| Cross-user delete (remove another user's edge) | Tampering | Own-scoped delete (`.eq("user_id", caller)`) → 404-not-403 on miss |
| Audit drop (silent 23514 on a missing enum value) | Repudiation | N/A here — `relationship.create`/`.delete` already in the live CHECK + boot drift-guard (`audit_service.py:29`) |

## Sources

### Primary (HIGH confidence — read this session)
- `supabase/migrations/071_dm_foundations.sql:57-69,135-150,182-185` — table DDL, user-scoped RLS, indexes, no unique constraint
- `supabase/migrations/025_document_versioning.sql:11-14` — `(user_id, filename, is_latest)` partial index (the lineage model)
- `backend/app/api/documents.py:441-505` (version-create cascade + 23505-catch), `:540-561` (own ∪ global latest), `:628-669` (restore), `:1304-1347` (move PATCH), `:1358-1410` (metadata PATCH — confirms no filename mutation)
- `backend/app/services/audit_service.py:13-26` (`VALID_ACTION_TYPES` has relationship.create/delete), `:29-54` (boot drift-guard), `:57-75` (`write_audit_entry`)
- `backend/app/services/tool_dispatcher.py:130-138` (`ToolResult`), `:219-291` (`_handle_search_documents` — citations/audit), `:302-467` (`_handle_query_documents_by_view` — the leak-safe compact-row template), `:2567-2598` (`_TOOL_REGISTRY`), `:2633-2655` (`dispatch_tool` + whitelist guard)
- `backend/app/services/openai_service.py:17-53` (`SEARCH_DOCUMENTS_TOOL`), `:107-189` (`QUERY_DOCUMENTS_BY_VIEW_TOOL` + the multi-type `value` field at `:159`), `:967-988` (`get_tools` assembly)
- `backend/app/services/google_service.py:256-257` (anyOf/oneOf stripped), `:270-340` (`_translate_nullable_type` + `_sanitize_schema_for_google` — the a5b0b917 fix)
- `backend/app/api/document_views.py:74-199` (CRUD route template — POST/PATCH/DELETE + audit + 404-not-403)
- `backend/app/services/document_view_service.py:47-192` (service template — `_uid` guard, `aexec`, own-scoped delete, own-or-global get_by_name)
- `backend/app/models/document_view.py:34-75` (`Literal`-discriminated op + request/response model pattern)
- `backend/app/services/retrieval_service.py:189-213` (`resolve_document_id` — own-only + partial-match; the anti-pattern to avoid)
- `backend/app/services/agent_loop.py:2080-2108` (handler dispatch + source_refs accumulation + the ValueError calm-catch)
- `.planning/phases/115-virtual-folders-agent-tool/115-VALIDATION.md`, `115-CONTEXT.md`, `backend/tests/integration/test_115_tool_global_leak.py` (the leak-proof template)
- `backend/tests/integration/test_110_dm_schema.py:43,185-217`, `test_110_dm_audit_live.py:38` (substrate liveness)
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` (the watch item — triggered by a LARGE execute_code arg, not a small discriminator → 116 risk is low)

### Secondary / Tertiary
- None — every claim is grounded in primary in-repo evidence.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero net-new deps; all templates are in-repo and shipped/secured in 113/114/115
- Architecture (must-resolve items 1-5): HIGH — each resolved from `file:line` (rename-absence verified by grep over all route decorators; Gemini-safety verified against the a5b0b917 fix; idempotency race against the live `documents.py:496-505` precedent)
- Pitfalls: HIGH — derived from the 113/114/115 secure-phase lessons read this session
- Validation Architecture: HIGH — cloned from `115-VALIDATION.md` with 116-specific rows

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable — composes a frozen substrate; the only fast-moving surface is cross-provider tool behavior, observed via SC#10 UAT)
