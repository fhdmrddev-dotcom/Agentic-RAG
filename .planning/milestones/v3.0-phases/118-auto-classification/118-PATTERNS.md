# Phase 118: Auto-Classification - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 14 (5 backend net-new/edit, 9 frontend net-new/edit)
**Analogs found:** 13 / 14 (1 genuinely net-new primitive — `classification_matcher.py`)

> Phase 118 is a near-pure **clone-and-compose** phase. Every surface has a shipped
> sibling in the v3.0 DM stack (110/112/113/114/115/116/117). The ONE thing with no
> precedent is the in-Python AST matcher — and even that reuses the `ViewFilter` model
> + the two validators. **No migration. No new package.** Both audit enums
> (`classification.apply`, `classification.rule.create`) are LIVE at
> `audit_service.py:23` (verified this session). Resist inventing.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/classification_rule.py` | model | request-response | `models/document_view.py` | exact (clone) |
| `backend/app/services/classification_rule_service.py` | service | CRUD | `services/document_view_service.py` | exact (clone) |
| `backend/app/services/classification_matcher.py` | service (pure) | transform (AST→bool) | `services/view_filter_compiler.py` (validators) + `view_operators_extra.py` (op semantics) | **NET-NEW** (reuses AST model + validators only) |
| `backend/app/api/classification_rules.py` | route | CRUD + request-response | `api/document_views.py` | exact (clone) |
| `backend/app/api/documents.py` (rule-eval splice in `ingest_document`) | route (BG task) | event-driven (on-upload) | the re-extract merge guard at `documents.py:1602-1624` (same single write site) | role-match (in-place edit) |
| `backend/app/api/documents.py` (accept/dismiss endpoints) | route | request-response | `move_document` (`documents.py:1304`) + `update_document_metadata` audit (`:1358`) | exact (clone) |
| `backend/app/main.py` (router mount) | config | — | `main.py:423-424` (document_views / document_relationships mounts) | exact (clone) |
| `frontend/src/components/classification/ClassificationSection.tsx` | component | request-response (own fetch) | `relationships/RelationshipsSection.tsx` | exact (clone) |
| `frontend/src/components/classification/ClassificationRulesPage.tsx` | component | CRUD page | `/document-views` page + `ViewsGroup` list | role-match |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | component | form (push/split) | the FilterBar `ViewCondition` chip strip (029/114) + push/split panel | role-match |
| `frontend/src/components/ingestion/AutomationGroup.tsx` | component | nav list | `ingestion/ViewsGroup.tsx` + `NavRow` | exact (clone) |
| `frontend/src/components/ingestion/DocumentList.tsx` (row chip) | component | request-response | row render at `DocumentList.tsx:182+` (reads `doc.metadata`) | role-match (in-place edit) |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` (3rd PanelSection) | component | composition | the Relationships `PanelSection` at `DocumentDetailPanel.tsx:244-253` | exact (clone) |
| `frontend/src/lib/api.ts` + `frontend/src/types/index.ts` | utility | request-response | the views (`api.ts:2038-2112`) + relationships (`api.ts:2172-2222`) client families; `SavedView`/`RelationshipRow` types (`types/index.ts:288,325`) | exact (clone) |
| `frontend/src/App.tsx` (`ActiveView` union) | config | — | `App.tsx:9` (`ActiveView` string union) | exact (clone) |

---

## Pattern Assignments

### `backend/app/services/classification_rule_service.py` (service, CRUD)

**Analog:** `backend/app/services/document_view_service.py` (clone verbatim, swap `_TABLE = "classification_rules"` + field names).

**Module-private helpers to copy verbatim** (`document_view_service.py:44-62`):
```python
_TABLE = "classification_rules"   # was "document_views"

def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()

def _uid(user_id) -> str:
    # Coerce to canonical UUID string BEFORE it is interpolated into a PostgREST
    # .or_() grammar (the SOLE owner-scoping gate — service-role bypasses RLS).
    # Any non-UUID raises ValueError instead of breaking the user_id.eq.<...> term.
    return str(UUID(str(user_id)))
```

**`create_rule` — `is_global` HARD-SET false** (clone of `create_view`, `document_view_service.py:65-89`):
```python
async def create_rule(user_id, name, match_expr: dict, suggest_folder_id,
                      supabase: Client | None = None) -> dict:
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "name": name,
        "match_expr": match_expr,                       # validated AST jsonb (router ran validate_fields)
        "suggest_folder_id": str(suggest_folder_id) if suggest_folder_id else None,
        "is_global": False,                             # HARD-SET — never from the caller (T-113-06 analog)
        "enabled": True,
    }
    result = await aexec(client.table(_TABLE).insert(payload))
    return result.data[0]
```

**`list_rules` — own + global via the `.or_()` leak-safe read predicate** (clone of `list_views`, `:92-110`):
```python
result = await aexec(
    client.table(_TABLE).select("*")
    .or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")   # own OR global — the SOLE gate
    .order("name")
)
# dedupe-by-id loop preserved verbatim
```

**`get_rule` — own-OR-global → None → router 404 (never 403)** (clone of `get_view`, `:113-127`):
```python
result = await aexec(
    client.table(_TABLE).select("*").eq("id", rule_id)
    .or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")   # not-readable → empty → None
)
return (result.data or [None])[0]
```

**`update_rule` / `delete_rule` — own-scoped (`.eq("user_id", caller)`)** (clone of `:166-191`): a cross-user miss returns `None`/`False` the router maps to 404. The `enabled` toggle rides the existing UPDATE path (no new endpoint — D-118 spec).

---

### `backend/app/models/classification_rule.py` (model, request-response)

**Analog:** `backend/app/models/document_view.py` (`:73-91`).

Reuse `ViewFilter` (imported) for `match_expr` — DO NOT redefine the AST. The
`Literal`-discriminated `op` (`document_view.py:42-54`) is the parse-time
reject-unknown-op layer (no `eval`, no op-ladder). Clone the create/update/response
trio:
```python
from app.models.document_view import ViewFilter   # reuse the AST verbatim

class RuleCreate(BaseModel):
    name: str
    match_expr: ViewFilter
    suggest_folder_id: UUID | None = None

class RuleUpdate(BaseModel):
    name: str | None = None
    match_expr: ViewFilter | None = None
    suggest_folder_id: UUID | None = None
    enabled: bool | None = None      # the enable/disable toggle rides UPDATE

class RuleResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    match_expr: dict
    suggest_folder_id: UUID | None = None
    is_global: bool = False
    enabled: bool = True
```
**IN-03 carry (112 CR-01 lesson):** if any rule route returns rows carrying document
`metadata`, do NOT add a `response_model` whose nested metadata strips
`_classification`/`_source`/`_confidence`. The rule rows themselves carry no doc
metadata, so a typed `RuleResponse` is safe here.

---

### `backend/app/api/classification_rules.py` (route, CRUD + audit)

**Analog:** `backend/app/api/document_views.py` (`:85-200` — the CRUD half; skip the resolve routes).

**Router prefix + DI** (clone `document_views.py:74` + the `Depends` block):
```python
router = APIRouter(prefix="/classification-rules", tags=["classification-rules"])
```

**Validate `match_expr` at CREATE and UPDATE BEFORE the write** (clone `document_views.py:106-114` + `:164-174`) — reuse the SAME two validators:
```python
from app.services import view_filter_compiler
from app.services.document_view_resolver import _build_field_meta   # builds (whitelist, number_fields)

whitelist, number_fields = await _build_field_meta(current_user["id"], supabase)
try:
    view_filter_compiler.validate_fields(body.match_expr, whitelist)       # _-prefix + whitelist → 422
    view_filter_compiler.validate_operands(body.match_expr, number_fields) # operand presence / range-on-number → 422
except ValueError as e:
    raise HTTPException(status_code=422, detail=str(e))
```
- `validate_fields` (`view_filter_compiler.py:263`) rejects `_`-prefixed + unknown fields.
- `validate_operands` (`view_filter_compiler.py:214`) rejects empty `one_of`, missing `between` bounds, range-op on a custom number field (the WR-01 lexical trap), missing scalar.

**Ownership-before-validation on UPDATE** (clone `document_views.py:154-162`): SELECT
ownership FIRST so an unowned/absent id uniformly 404s regardless of whether the
submitted `match_expr` is valid (no 422-vs-404 ordering oracle). `get_rule` is
own-OR-global, so require STRICT ownership for update (a global rule the caller does
not own is not updatable).

**Audit-after-create** (clone `document_views.py:129-134`) — fire-and-forget; the LIVE round-trip is the verification:
```python
await write_audit_entry(
    user_id=current_user["id"],
    action_type="classification.rule.create",   # LIVE in VALID_ACTION_TYPES (audit_service.py:23)
    metadata={"rule_id": created["id"], "name": body.name},
    supabase=supabase,
)
```

**Every cross-user/unseeable miss → uniform 404, NEVER 403** (clone `:162,184,199`).

**Mount in `main.py`** (clone `main.py:423`): add `classification_rules` to the `from app.api import ...` line (`:405`) + `app.include_router(classification_rules.router)` after `:424`.

---

### `backend/app/services/classification_matcher.py` (service, PURE — **the net-new primitive**)

**No analog produces a bool.** The Phase 113/114 compiler (`view_filter_compiler.compile_filter`) produces `list[Fragment]` consumed ONLY by the resolver's `_apply()` PostgREST-builder calls against a **persisted DB table** (verified: `compile_filter` returns `list[Fragment]` at `view_filter_compiler.py:175-195`; the doc is NOT persisted at the ingest call site). There is no in-memory dict evaluator anywhere (grep-verified zero matches in RESEARCH).

**What it REUSES (do not reinvent):**
- `ViewFilter.model_validate(match_expr)` — the `Literal` op-discriminator parse-reject (`document_view.py:42`).
- `view_filter_compiler.validate_fields(flt, whitelist)` — `_`-prefix + whitelist guard (`:263`).
- The operator NAMES + normalization semantics from `view_operators_extra.py` (so preview-count via SQL ≈ on-upload match).

**The signature + structure** (RESEARCH Pattern 2):
```python
from app.models.document_view import ViewFilter
from app.services import view_filter_compiler

def match_metadata(match_expr: dict, metadata: dict, whitelist: set[str]) -> bool:
    flt = ViewFilter.model_validate(match_expr)            # Literal op-reject at parse
    view_filter_compiler.validate_fields(flt, whitelist)  # _-prefix + whitelist guard (reuse)
    if not flt.conditions:
        return False    # empty rule matches nothing on upload (never auto-suggest blindly)
    return all(_match_one(c, metadata) for c in flt.conditions)   # flat AND (D-113-7)
```

**Per-operator normalization the matcher MUST mirror** (read from `view_filter_compiler.py:135-159 _op_eq` + `view_operators_extra.py`, so the preview count and the on-upload match agree — Pitfall 2):
- `eq`: case-insensitive for `document_type`/`language` (both stored lowercase — `_lower` at `view_filter_compiler.py:162`) and free-text (`title`/`author`/`summary` — the `ilike` exact leg, `:156`); exact for boolean/number.
- `one_of`: case-insensitive membership for normalized fields (`view_operators_extra.py:97-112`).
- `contains`: case-insensitive substring (`ILIKE %v%` analog, `:116-126`).
- `gte`/`lte`/`before`/`after`/`between`: comparison (ISO date strings sort correctly as text; range-on-custom-number is REJECTED at validate by `validate_operands` — never reaches the matcher).
- `is_empty`: key absent OR value in `("", [])` (`view_operators_extra.py:130-138`).
- `within_next`/`older_than`: relative window from `date.today()` (the same server-clock math the resolver uses; carries `value`=N + `unit`).
- `_confidence`/`_source`/`_classification` are nested provenance keys — NEVER a match dimension (the `_`-prefix reject already enforces this).

**`build_suggestion(rule, supabase, user_id) -> dict`** — also net-new; the suggestion object shape (D-118-5, RESEARCH Code Examples):
```python
{
    "rule_id": rule["id"],
    "rule_name": rule["name"],
    "condition_summary": "document_type = invoice AND author contains Acme",  # human-readable AST render, FROZEN
    "suggested_folder_id": rule["suggest_folder_id"],
    "suggested_folder_name": "Invoices",   # resolved FRESH; None/"(deleted)" if the folder is gone (Pitfall 5)
    "status": "suggested",                  # → "accepted" after Accept; key cleared on Dismiss
    # prior_folder_id is stamped at ACCEPT time (Undo, D-118-6), NOT here.
}
```
Resolve `suggested_folder_name` fresh (the FK is `ON DELETE SET NULL`) — use the own+global folder read pattern (clone `move_document:1326-1333`).

---

### `backend/app/api/documents.py` — rule-eval splice in `ingest_document` (route, event-driven)

**Analog:** the re-extract merge guard at `documents.py:1602-1624` (same single sync write site, same `supabase` sync `.execute()` — this is a sync `def` inside a BackgroundTask, so D-v2.5-01 does NOT fire; no `aexec`).

**Splice location — VERIFIED this session:** AFTER the re-extract merge guard ends
(`documents.py:1624`) and BEFORE the single persist UPDATE that writes
`"metadata": metadata_dict` (`documents.py:1733-1748`, the `metadata` key at `:1744`).
The pass mutates the LOCAL `metadata_dict` so the existing single write carries the
suggestion. (RESEARCH pinned this "between 1583 and 1733"; the precise insert point
is just after the merge-guard block at `:1624`, before the `chunking` step at `:1626`,
OR immediately before the final write at `:1733` — the planner picks; the invariant is
"after metadata_dict is final, before persist".)

**The pass** (RESEARCH Code Examples — read rules user-scoped, owner-before-global, first-match-wins, NEVER move):
```python
# ── NEW: classification rule-eval pass (CLASS-02 / D-118-2/3/4/8) ──────────────
if metadata_dict:                                  # no metadata → nothing to match (never blocks ingest)
    try:
        from app.services import classification_matcher   # noqa: PLC0415
        rules = (
            supabase.table("classification_rules").select("*")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")   # D-118-8: uploader own + global; NO auth.uid() here
            .eq("enabled", True)
            .order("is_global").order("created_at")           # owner(false) before global(true); oldest first (D-118-4)
            .execute()
        ).data or []
        whitelist = _METADATA_BUILTINS | {
            d["field_key"] for d in read_enabled_field_defs(supabase, user_id)   # SYNC reader (embedding_service.py:270)
        }
        for rule in rules:                                    # first-match-wins (D-118-3)
            if classification_matcher.match_metadata(rule["match_expr"], metadata_dict, whitelist):
                metadata_dict["_classification"] = classification_matcher.build_suggestion(rule, supabase, user_id)
                break
    except Exception:    # noqa: BLE001 — classification never blocks ingestion (mirror the metadata degrade at :1569)
        log.warning("classification rule-eval failed; skipping suggestion", exc_info=True)
```
- `_METADATA_BUILTINS` already exists at `documents.py:1355` (`set(DocumentMetadata.model_fields)`).
- `read_enabled_field_defs(supabase, user_id)` is SYNC (`embedding_service.py:270`) — used raw here (no `run_in_threadpool`), consistent with the surrounding sync ingest body.
- **Pitfall 4 (no silent move):** the pass writes ONLY `metadata_dict["_classification"]`. No `folder_id` write here. The move happens ONLY in the accept endpoint.
- **Pitfall 3 (no leak):** the `.or_(user_id.eq.{user_id},is_global.eq.true)` predicate is non-negotiable — an unscoped `.select("*")` returns ALL users' rules (service-role bypasses RLS).

---

### `backend/app/api/documents.py` — accept / dismiss endpoints (route, request-response)

**Analog:** `move_document` (`documents.py:1304-1347`) + `update_document_metadata` audit (`:1358-1452`).

**Accept** — clone the `move_document` owner-gate + target-folder readability check, then mark + audit (RESEARCH Pattern 3):
```python
@router.patch("/{document_id}/classification/accept", response_model=DocumentResponse)
async def accept_classification(document_id: str, current_user=Depends(get_current_user),
                                supabase: Client = Depends(get_supabase)):
    # 1. Owner SELECT (404 on miss, never 403) — clone move_document:1313-1322
    doc = (supabase.table("documents").select("folder_id, metadata")
           .eq("id", document_id).eq("user_id", current_user["id"]).maybe_single().execute())
    if not doc.data:
        raise HTTPException(404, "Document not found")
    sugg = (doc.data.get("metadata") or {}).get("_classification") or {}
    target = sugg.get("suggested_folder_id")
    if not target or sugg.get("status") != "suggested":
        raise HTTPException(404, "No active suggestion")
    # 2. Re-validate target folder readable (own+global) — clone move_document:1325-1335 (Pitfall 5)
    folder = (supabase.table("folders").select("id").eq("id", str(target))
              .or_(f"user_id.eq.{current_user['id']},is_global.eq.true").maybe_single().execute())
    if not folder.data:
        raise HTTPException(404, "Folder not found")
    # 3. Record prior folder (Undo), move, mark accepted — ONE update
    prior_folder = doc.data.get("folder_id")
    meta = dict(doc.data.get("metadata") or {})
    meta["_classification"] = {**sugg, "status": "accepted", "prior_folder_id": prior_folder}
    result = (supabase.table("documents")
              .update({"folder_id": str(target), "metadata": meta})
              .eq("id", document_id).eq("user_id", current_user["id"]).execute())
    if not result.data:
        raise HTTPException(404, "Document not found")
    # 4. Audit ONLY after the move succeeds (112/116 honesty — never optimistic)
    await write_audit_entry(
        user_id=current_user["id"], action_type="classification.apply",   # LIVE (audit_service.py:23)
        metadata={"document_id": document_id, "rule_id": sugg.get("rule_id"),
                  "from_folder": prior_folder, "to_folder": str(target)},
        supabase=supabase,
    )
    return result.data[0]
```

**Dismiss** — own-scoped UPDATE popping `_classification`; NO move, NO audit (clone the metadata-merge shape `documents.py:1417-1440`, but `meta.pop("_classification", None)`):
```python
@router.patch("/{document_id}/classification/dismiss", response_model=DocumentResponse)
# SELECT metadata (own-scoped, 404) → meta.pop("_classification", None) → UPDATE metadata → return
```

**Undo** — NO new endpoint. The frontend calls the existing `PATCH /documents/{id}/move` with `prior_folder_id` (reversible by construction, D-118-6).

**Threadpool note:** `update_document_metadata` wraps every `.execute()` in
`run_in_threadpool` (D-v2.5-01); `move_document`'s raw `.execute()` predates that
sweep. Follow the `update_document_metadata` threadpool template for the new async
accept/dismiss handlers (they are `async def`).

---

### `frontend/src/components/classification/ClassificationSection.tsx` (component, own fetch)

**Analog:** `frontend/src/components/relationships/RelationshipsSection.tsx` (clone the whole load/state machine).

**Own-fetch state machine to copy** (`RelationshipsSection.tsx:57-99`): `type LoadState = "loading" | "ready" | "error"`; `useState` rows + state + `refreshing`; `load(silent)` `useCallback` keyed on `docId`; `useEffect(() => void load(), [load])` fetch-on-mount; `onTotalChange?.(total)` lifts the count to the parent `PanelSection` badge (1 when a `"suggested"` exists, else 0/undefined).

**Re-fetch-NOT-optimistic after accept/dismiss** (clone the `handleRemove` discipline, `:104-123`): on accept/dismiss success → `void load(true)` (silent re-fetch under a `role="status"` beat), never an optimistic splice.

**Honest state set** (clone `:151-198`): `loading` (skeleton, `role="status" aria-live="polite"`) ≠ `error` (`role="alert"` + Try again) ≠ calm empty/no-match. The accepted state renders the **audit receipt + Undo**; the suggested state reads instantly as *not yet moved* (the 028/036 honesty principle — show matched rule + `condition_summary` as provenance, NEVER a confidence %).

**a11y (NON-negotiable, clone `:23-30` + `:292-309`):** accept/dismiss/Undo buttons keyboard-operable (`:focus-visible`) AND always-visible on coarse-pointer/touch (the bottom-sheet has no hover — the `.rel-x-touch` always-on pattern); icon-only controls carry `aria-label`; all copy uses the panel-AA token `text-panel-muted-foreground[-dim]`, NEVER the global muted (3.59:1).

**Props shape** (RESEARCH Code Examples):
```tsx
<PanelSection title="Classification" count={classCount ?? undefined}>
  <ClassificationSection
    docId={doc.id}
    suggestion={doc.metadata?._classification}   // own fetch or re-derive from the doc
    onChanged={onReconcile}                        // re-fetch after accept/dismiss (not optimistic)
    onTotalChange={setClassCount}                  // 1 when a "suggested" exists, else 0/undefined
  />
</PanelSection>
```

---

### `frontend/src/components/metadata/DocumentDetailPanel.tsx` (component, composition)

**Analog:** the Relationships `PanelSection` at `DocumentDetailPanel.tsx:244-253`.

Add a THIRD `<PanelSection title="Classification">` AFTER the Relationships section
(after `:253`, before the closing `</div>` at `:254`). The file's own header comment
at `:221` reserves the slot ("118 adds Classification"). Mirror the Relationships
`count={relTotal ?? undefined}` + `onTotalChange={setRelTotal}` count-lift pattern with
a new `classCount` state.

---

### `frontend/src/components/ingestion/AutomationGroup.tsx` (component, nav list)

**Analog:** `frontend/src/components/ingestion/ViewsGroup.tsx` (clone the group-header + `NavRow` list + kebab actions).

Clone the `ViewsGroup` shape (`:135-257`): an uppercase tracked group header
("Automation"), each rule row built from the SHARED `NavRow` (never a FolderNode
clone) passing a rule icon, the tooltip-labeled `G` global pill (`isGlobal={rule.is_global}`),
an `enabled` toggle, and Edit / Rename / Delete kebab actions. The rule-row anatomy
(037-A): `● name [G] · condition (mono) → 📁 action · [toggle] · ⋯` — enabled dot
green / disabled dim. The "would match N" live count reuses the lazy+cached
`fetchCount` idiom (`:75-103`) but calls `resolveAdHoc({count_only:true})` (NOT
`resolveView` — the rule isn't a saved view; see api.ts note below).

---

### `frontend/src/components/classification/RuleBuilderPanel.tsx` (component, push/split form)

**Analog:** the FilterBar `ViewCondition` chip strip (029/114) + the right-side push/split panel shell (027/112/117 — `minmax(0,1fr) <panel>`, no-router state-switch).

Reuse the `ViewCondition` chip-strip grammar verbatim (`field op value` + `＋condition`,
flat AND). Builder flow (037-A): chip-strip condition → action (📁 folder ONLY — the
🏷 tag radio is DROPPED per D-118-1) → scope segmented (👤 Only me / 🌐 Global `G`) →
live "would match N of M" preview via `resolveAdHoc({count_only:true})` with the
forward-only honesty line: *"existing docs aren't moved — rules suggest on new uploads
only."* (D-118-2).

---

### `frontend/src/components/ingestion/DocumentList.tsx` (component, row chip — in-place edit)

**Analog:** the row render at `DocumentList.tsx:182+`; reads `doc.metadata` already.

**Open Question 3 RESOLVED:** `Document.metadata` IS on the list-row type
(`types/index.ts:391`), so the chip reads `doc.metadata?._classification` with **zero
new fetch**. Add a compact `→ folder ✓ ✕` chip (036-A) on the row when a doc has a
`"suggested"` `_classification`; `✓` calls `acceptClassification`, `✕` calls
`dismissClassification`. The full provenance card lives in the panel section. Render
the chip ONLY for `status === "suggested"` (not "accepted").

> **Type addition required:** `DocumentMetadata` (`types/index.ts`) needs a
> `_classification?` field added so `doc.metadata._classification` type-checks. Mirror
> how `_source`/`_confidence` are typed there.

---

### `frontend/src/lib/api.ts` + `frontend/src/types/index.ts` (utility, request-response)

**Analog:** the views client family (`api.ts:2038-2112`) + the relationships client family (`api.ts:2172-2222`); the `SavedView`/`RelationshipRow` types (`types/index.ts:288-343`).

Clone the fetch-wrapper conventions verbatim (`getAuthHeaders()` + throw-on-non-ok +
the 404-tolerant DELETE):
- `listRules()` / `createRule(name, match_expr, suggest_folder_id)` / `updateRule(id, body)` / `deleteRule(id)` — clone `listViews`/`createView`/`updateView`/`deleteView` (`api.ts:2038-2097`). `createView`'s body omits `is_global` (server hard-sets it) — mirror that.
- `acceptClassification(docId)` / `dismissClassification(docId)` — clone the `moveDocument`/`updateDocumentMetadata` PATCH shape (`api.ts:1971,1997`). Undo reuses the existing `moveDocument(id, priorFolderId)`.
- The "would match N" preview reuses the EXISTING `resolveAdHoc` / `resolveFilterCount` (`api.ts:2125-2146`) — NO new client fn, NO new backend endpoint.

Types: clone `SavedView` → `ClassificationRule` (`types/index.ts:288-295`, swap
`filter_expr`→`match_expr`, add `suggest_folder_id`/`enabled`). Add a
`ClassificationSuggestion` type mirroring the D-118-5 object shape. Add
`_classification?: ClassificationSuggestion` to `DocumentMetadata`.

**App.tsx (`ActiveView` union):** add `"classification-rules"` to the union at
`App.tsx:9` (`"chat" | "documents" | ... | "workflows" | "classification-rules"`).

---

## Shared Patterns

### Leak-safe own+global sharing (113/115/117)
**Source:** `document_view_service.py:51-62` (`_uid`) + `:101,125` (the `.or_()` predicate)
**Apply to:** `classification_rule_service.py` (all reads), the ingest rule-eval pass, the accept folder re-check.
```python
.or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")   # own OR global — the SOLE owner gate (service-role bypasses RLS)
```
A global rule EXPOSES its definition but is evaluated against the uploader's OWN
upload only (D-118-8). Every cross-user/unseeable miss → uniform 404, NEVER 403 (no
existence leak).

### `is_global` hard-set false on create
**Source:** `document_view_service.py:86`
**Apply to:** `classification_rule_service.create_rule`
```python
"is_global": False,   # HARD-SET — never from the caller; RLS WITH CHECK forces it too (defense-in-depth)
```

### `match_expr` validation (whitelist + operands)
**Source:** `view_filter_compiler.validate_fields` (`:263`) + `validate_operands` (`:214`); router usage at `document_views.py:106-114`
**Apply to:** the rule CRUD router (create + update), AND the matcher (parse-time guard).
- `_`-prefixed + unknown fields → 422.
- empty `one_of` / missing `between` bound / range-op on custom number / missing scalar → 422.

### Audit-after-write, never optimistic
**Source:** `document_views.py:129` (rule.create) + `documents.py:1446` (the move audit)
**Apply to:** `classification.rule.create` (after create), `classification.apply` (ONLY after the accept move succeeds).
Both enums are LIVE in `VALID_ACTION_TYPES` (`audit_service.py:23`) — no enum
extension, no drift-guard change, no migration.

### Re-fetch-not-optimistic UI mutations
**Source:** `RelationshipsSection.tsx:104-123` (`handleRemove` → `load(true)`)
**Apply to:** `ClassificationSection` (accept/dismiss/Undo) + the `DocumentList` row chip.
Re-fetch / claim "audit logged" only on a 200; honest empty ≠ loading ≠ error states.

### No-backfill on config change (forward-only)
**Source:** Phase 114 precedent (no re-extraction on rule change)
**Apply to:** the builder preview honesty line + the absence of any backfill job (D-118-2).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/services/classification_matcher.py` | service (pure) | transform (AST→bool) | NO in-memory dict-vs-AST evaluator exists in the codebase (grep-verified zero). The 113/114 compiler produces `Fragment`s consumed ONLY by the resolver's `_apply()` PostgREST calls against a PERSISTED table; the doc is NOT persisted at the ingest call site. **Net-new** — but it reuses `ViewFilter.model_validate` (op-reject), `validate_fields` (whitelist), and the operator normalization semantics from `view_operators_extra.py`. The planner should add `tests/unit/test_118_matcher.py` asserting per-operator agreement with the documented SQL semantics (Pitfall 2). |

---

## Metadata

**Analog search scope:** `backend/app/{models,services,api}`, `backend/app/main.py`,
`frontend/src/{components/{relationships,metadata,ingestion,classification},lib,types}`,
`frontend/src/App.tsx`.
**Files scanned (read this session):** `document_view_service.py`, `document_views.py`,
`document_view.py`, `view_filter_compiler.py` (validators + `_op_eq`),
`view_operators_extra.py`, `documents.py` (`move_document`, `update_document_metadata`,
`ingest_document` splice region 1560-1760), `audit_service.py`,
`RelationshipsSection.tsx`, `DocumentDetailPanel.tsx`, `ViewsGroup.tsx`, `App.tsx`,
`api.ts` (views + relationships families), `types/index.ts`, `main.py` (router mounts),
`DocumentList.tsx` (row structure).
**Verifications confirmed this session:**
- Both audit enums LIVE at `audit_service.py:23` (no migration).
- The `.or_()` leak-safe read predicate at `document_view_service.py:101,125` + `_uid` UUID-coercion guard at `:51-62`.
- The `is_global` hard-false at `:86`.
- The `validate_fields`/`validate_operands` reuse points (`view_filter_compiler.py:263,214`).
- The `move_document` owner-gate + folder readability check (`documents.py:1313-1335`) + the audit-after-write shape (`:1446`).
- The ingest splice point — `metadata_dict` final after the merge guard at `:1624`, single persist write at `:1733-1748` (`metadata` key at `:1744`).
- The `RelationshipsSection` own-fetch state machine + re-fetch-not-optimistic + a11y always-on touch pattern.
- The `ViewsGroup`/`NavRow` sidebar group + lazy-cached count + `G` pill + kebab.
- The `ActiveView` union at `App.tsx:9`.
- `Document.metadata` IS on the list-row type (`types/index.ts:391`) → row chip needs zero new fetch (Open Question 3 resolved).
**Pattern extraction date:** 2026-06-21
