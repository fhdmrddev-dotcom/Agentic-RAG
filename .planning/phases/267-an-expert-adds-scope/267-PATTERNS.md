# Phase 267: An Expert Adds Scope - Pattern Map

**Mapped:** 2026-09-25
**Base read at:** `develop` HEAD (`80733c4ff`). The line numbers below were read in this session. Re-derive any figure you quote in a PLAN.
**Files analyzed:** 33 (7 new source files, 24 modified source files, plus the test suites and gate knobs)
**Analogs found:** 33 / 33. Every file has an in-repo analog. Only `thread_handoff.py` combines three analogs rather than copying one.

⛔ **Read this first. These binding constraints come from the analogs themselves, and a copy-paste that ignores them breaks a shipped fence:**
1. `agent_loop.py`: no `ast.Name`, `ast.Attribute` or function name may contain `expert` (`test_260_expert_chat_scoping.py:165-186`). Every new field or constant `agent_loop.py` touches must have a neutral name, e.g. `TRANSCRIPT_EVENT_KINDS` or `scoped_connection_keys`.
2. `expert_service.py`: no `while`, no `openai`/`anthropic`/`litellm` import and no `agent_loop` import (`test_259_closed_core_inventory.py:65-82`). So the handoff LLM call **cannot** live there.
3. `services/`: no filename may match `*expert*agent*`, `*expert*loop*`, `*expert*runtime*` or `*expert*executor*` (`test_259:55-62`). `thread_handoff.py` and `expert_scope.py` are both clear.
4. The `_TOOL_REGISTRY` count stays at 29 and `EMITTER_REGISTRY` stays at 1 (`test_259:28-45`). The handoff emitter name is passed to `forced_emit` only and is never registered.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| NEW `backend/app/services/expert_scope.py` | utility (pure) | transform | `run_producer.py:472-516` (the inline branch it replaces, moved verbatim) | exact (it is a move) |
| NEW `backend/app/services/thread_handoff.py` | service | request-response (LLM → atomic write) | `services/thread_title.py` (model resolution, threadpool) + `expert_authoring.py:363-385` (`forced_emit` + Pydantic) + `api/workspace.py:342-352` (`get_user_pg_connection` txn) | composite (3 analogs) |
| MOD `backend/app/services/run_producer.py` | service | transform (scoping → data) | itself `:383-543` | self |
| MOD `backend/app/services/agent_loop.py` | service (loop) | event-driven / streaming | itself: `RunContext :265-282`, `_reconstruct_history :1004-1082`, connector block `:1659-1671`, skill catalog `:1445-1459`, filter `:1696-1703` | self |
| MOD `backend/app/services/tool_dispatcher.py` | registry | config | itself `:4744-4775` | self (deletion) |
| MOD `backend/app/models/message.py` | model | config / constant | `RESERVED_RUN_INPUT_KEYS` in the same file `:8-27` | exact |
| MOD `backend/app/models/thread.py` | model | request-response | `ThreadCreate` / `ThreadUpdate` `:12-21` | exact |
| MOD `backend/app/services/expert_service.py` | service (pure data) | CRUD read | itself `:527-558` (extract) | self |
| MOD `backend/app/api/experts.py` | controller | request-response overlay | `_overlay_install_state_for_caller :472-489` + `overlay_install_state` (`expert_install_service.py:293-347`) | exact |
| MOD `backend/app/dependencies.py` (only if `feature_visible` is factored) | middleware | request-response | `require_visible._dep :645-660` | exact |
| MOD `backend/app/api/threads.py` | controller | CRUD + request-response | `rename_thread :706-770`, `get_snapshot :543-550`, `create_thread :662-685`, `send_message` model resolution `:1041-1060` | self |
| MOD `backend/app/models/expert.py`, `services/expert_authoring.py` | model / service | config (doc text) | itself (`tool_floor_enabled` description + drafter prompt line 140) | self |
| NEW `backend/tests/unit/test_267_*.py` (≈6 files) | test | — | `test_260_expert_chat_scoping.py`, `test_259_closed_core_inventory.py` | exact |
| MOD `frontend/src/components/experts/catalog/expertCatalog.ts` | utility (pure selectors) | transform | `INSTALL_COPY` / `installView` / `inviteGate` `:115-224` | exact |
| NEW `frontend/src/components/experts/ScopeLedger.tsx` | component (leaf) | render-only | `ExpertDetailModal.tsx` `SectionTitle`/`NamePill` `:102-133` + `ExpertCard.tsx` `ScopePill :69-76` | role-match |
| MOD `frontend/src/components/experts/catalog/ExpertCard.tsx` | component | render + event | itself: footer `:171-210`, `StatusPill :57-66`, `installBusy` prop | self |
| MOD `…/catalog/ExpertDetailModal.tsx` | component | render + event | itself: `NamePill :119-133`, `FooterLine :115-117`, `HONEST :92-100` | self |
| MOD `…/catalog/ExpertCatalogPage.tsx` | component (page) | event | itself (install in-flight state) + `ChatLayout.tsx:1033-1066` | self |
| MOD `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | component | form | itself `:1113-1122` (picker), `:890-908` / `:1504-1509` (toggle to remove) | self |
| MOD `frontend/src/lib/api/experts.ts` | api client / wire types | request-response | `ExpertInstallState :72-84` | exact |
| MOD `frontend/src/types/index.ts` | model | — | `ExpertBundle.install?` `:36`, `Message.role` `:174` | exact |
| MOD `frontend/src/components/chat/InviteExpertDialog.tsx` | component (dialog) | request-response | itself `:43-231` (`inviteGate` row gate `:186-222`) | self |
| NEW `frontend/src/components/chat/ExpertEventCard.tsx` | component (leaf) | render-only | `MessageItem.tsx` notice siblings `:639-665` + `ExpertSpotlightCard.tsx` (leaf, header shape) | role-match |
| NEW `frontend/src/components/chat/HandoffCard.tsx` | component (leaf) | render-only | same as above | role-match |
| NEW `frontend/src/components/chat/expertEventCopy.ts` | utility (vocabulary) | transform | `composerCopy.ts` (one-home copy) + `INSTALL_COPY` (`expertCatalog.ts:115-137`) | exact |
| MOD `frontend/src/components/chat/MessageItem.tsx` | component | render | `hasPendingAsk :101-107` (tool_calls discriminator) + notice siblings `:639-665` | self |
| MOD `frontend/src/components/chat/MessageList.tsx` | component | render | itself `:197,235` (`role==="assistant"` reads) | self |
| MOD `frontend/src/components/chat/ChatArea.tsx` | component (container) | event | `handleSend :433-468`, hydration `:241-258`, `onActiveExpertChange :541-545` | self |
| MOD `frontend/src/components/chat/MessageInput.tsx` | component | event | `handleSelectExpert` / `handleDismissExpert :171-198` (to consolidate) | self |
| MOD `frontend/src/lib/api/threads.ts` | api client | request-response | `createThread :23-34`, `setThreadActiveExpert :190-199`, `postMessage` error path `:582-589` | exact |
| MOD `frontend/src/hooks/useThreads.ts` | hook | CRUD | `newThread :39-44` | self |
| MOD `frontend/src/components/layout/ChatLayout.tsx` | component (shell) | event | `ChatArea` mount `:822-846`, `onStartChat` seams `:1033-1066` | self |
| NEW vitest suites + `scripts/vitest-count-gate.cjs` knobs | test / config | — | `FolderNode.test.tsx:269-287` (visible at rest), `expertCatalog.test.ts`, `MessageItem.inlineApproval.test.tsx:610-621` (`?raw` + `stripComments`) | exact |

---

## Pattern Assignments

### NEW `backend/app/services/expert_scope.py` (utility, pure transform)

**Analog:** `backend/app/services/run_producer.py:472-516`. This is a **move**, and the new function must produce byte-identical output. Tests pin `folders == (str(folder_id),)` (`test_260_expert_chat_scoping.py:139`).

**Code to lift verbatim** (`run_producer.py:480-516`):
```python
folder_map = {str(f["id"]): f for f in all_folders}

def _get_subtree(root_id: str) -> list[str]:
    res = [root_id]
    for f in all_folders:
        if str(f.get("parent_id") or "") == root_id:
            res.extend(_get_subtree(str(f["id"])))
    return res

def _get_path(fid: str) -> str:
    parts = []
    curr: str | None = fid
    while curr:                      # ⚠ a `while` — fine here, FATAL if this ever moves into expert_service.py
        f = folder_map.get(curr)
        if not f:
            break
        parts.append(f.get("name", ""))
        curr = str(f["parent_id"]) if f.get("parent_id") else None
    return ("/" + "/".join(reversed(parts))) if parts else ""

if scope_mode == "restricted":
    effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
    if expert_folder_ids:
        scoped_folder_path = _get_path(expert_folder_ids[0]) or None
else:
    if thread_folder_id:
        thread_subfolder_ids = _get_subtree(str(thread_folder_id))
        effective_folder_ids = tuple(sorted(set(thread_subfolder_ids).union(expert_folder_ids)))
        scoped_folder_path = _get_path(str(thread_folder_id)) or None
    else:
        effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
        if expert_folder_ids:
            scoped_folder_path = _get_path(expert_folder_ids[0]) or None
```
- New output: `excluded_folder_ids = tuple(sorted(set(_get_subtree(thread_folder_id)) - set(expert_folder_ids)))`, only when `scope_mode == "restricted"` and `thread_folder_id` is set. Otherwise `()`.
- The frozen dataclass shape follows `RunContext` (`agent_loop.py`, `@dataclass(frozen=True)` with tuple fields for hashability; see the `:278-281` comment "must stay hashable").
- ⛔ `ExpertScopeUnavailable` stays in `run_producer.py:378-380 / :465-470`. The pure function never raises.
- The caller fetches `all_folders` via `fetch_visible_folders(supabase, user_id)` (`utils/folder_utils.py:222`), exactly as `run_producer.py:473-478` does, so both the run and the preview share one input source.
- Ledger row **at creation** (CLAUDE.md + `docs/HOT-FILE-LEDGER.md`, same commit).

---

### NEW `backend/app/services/thread_handoff.py` (service, LLM → atomic write)

**Analog A: module shape and model resolution.** From `services/thread_title.py`.

Imports (`thread_title.py:29-41`):
```python
from __future__ import annotations
import logging
import openai
from starlette.concurrency import run_in_threadpool
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS, get_model_capability
from app.services.sub_agent_models import provider_safe_utility_model
from app.utils.db import aexec
logger = logging.getLogger(__name__)
```
- The docblock carries a **PATCH SURFACE** section (`:11-27`). Late-import anything tests will patch at `app.api.threads.*` (`:109-112`: `from app.api.threads import get_llm_client  # noqa: PLC0415`).
- Single-model vs. multi-model provider pick (`:117-145`, `_SINGLE_MODEL_PROVIDERS` at `:48`). **Research recommends the `send_message` chain instead** (see Analog D) so disabled-model fallback matches chat.
- ⚠ **Divergence from the analog:** title *degrades* on every failure (`:216-221`, returns a derived title). The handoff must **refuse**: raise a named exception, and let the route map it to 502/422 `"This chat could not be summarised."` Never write a thread with an empty summary (D-267-16).

**Analog B: structured output.** From `expert_authoring.py`.

Pydantic model with caps (`expert_authoring.py:14-23`, shape):
```python
class DraftPromptSuggestion(BaseModel):
    title: str = Field(..., min_length=3, max_length=60, description="...")
    prompt: str = Field(..., min_length=150, description="...")
```
→ `class HandoffSummary(BaseModel): items: list[constr(min_length=1, max_length=160)] = Field(min_length=3, max_length=6)`

Emit-tool builder (`expert_authoring.py:107-117`). Reuse it or copy it; it has a sibling copy at `skill_tuner_service.py:175`:
```python
def _emit_tool(emitter: str, schema_model: type[BaseModel]) -> list[dict]:
    return [{"type": "function", "function": {
        "name": emitter,
        "description": f"Emit the structured result per the {schema_model.__name__} schema.",
        "parameters": _flatten_nullable(schema_model.model_json_schema()),
    }}]
```
Call (`expert_authoring.py:363-383`):
```python
result = await forced_emit(
    messages=[{"role": "user", "content": prompt_content}],
    model=model, provider=provider,
    emitter="emit_expert_draft",               # → "emit_handoff_summary" (a NAME only; not EMITTER_REGISTRY)
    tools=_emit_tool("emit_expert_draft", ExpertDraftOutput),
    user_settings=user_settings,
    system_prompt=_EXPERT_DRAFTER_SYSTEM_PROMPT,
    schema_model=ExpertDraftOutput,
    strict=False,
)
emitted = result.get("emitted")
```
- `forced_emit` return contract (`forced_emit.py:372-386`): `{"emitted", "tier", "emit_rung", "failure": None|"model_failed_to_emit"|"provider_error", "input_tokens", "output_tokens", ...}`. Refuse when `failure` is set or `emitted` is None.
- ⚠ **Divergence:** `generate_expert_draft` swallows the exception and returns a grounded fallback (`:384-393`). The handoff has **no fallback**, so it re-raises a named refusal.

**Analog C: the atomic write as the caller.** From `api/workspace.py:342-352` and `dependencies.py:158-177`.
```python
async with get_user_pg_connection(request, current_user) as conn:   # opens conn.transaction() + SET LOCAL role
    result = await ws_write_file(conn, supabase, thread_id=UUID(thread_id), ...)
```
`get_user_pg_connection` (`dependencies.py:172-177`) already wraps `conn.transaction()`, so three `conn.fetchrow("INSERT … RETURNING …")` calls inside one `async with` commit together or roll back together. ⛔ Summarise **before** opening the context manager. Never hold the txn across the LLM call.

**Analog D: model/provider resolution identical to chat.** From `api/threads.py:1041-1060`.
```python
_user_settings = load_user_settings(current_user["id"])                  # → wrap in run_in_threadpool here
_user_settings = await _run_model_resolution.apply_user_model_default(request, current_user, _user_settings)
if body.provider and body.provider != _user_settings.active_provider:
    _user_settings = override_provider(_user_settings, body.provider)
_resolved_model, _resolved_provider, _notice, body, _user_settings = await resolve_run_model(
    body=body, user_settings=_user_settings)
```
`resolve_run_model(*, body, user_settings)` reads `body.model` / `body.provider` (`run_model_resolution.py:217-249`), so the handoff request model must carry optional `model` and `provider`, as `MessageCreate` does (`models/message.py:32-33`).

**Rows written:**
- Every row gets `org_id` explicitly from the source `threads.org_id` (D-267-34).
- The handoff user row is `role='user'`, `tool_calls=[{"kind":"handoff","source_thread_id","source_title","summary":[...]}]`, and `content` is plain text.
- The source-thread event is `role='system'`, `tool_calls=[{"kind":"expert_handoff",...}]`.

---

### MOD `backend/app/services/run_producer.py` (service, scoping → data)

**Self-analog:** `_resolve_thread_scoping :383-543`.
- **Keep the 5-tuple arity** (`:388-394`), because 5+ test sites unpack exactly five values. Return `None` in slot 2 (replace `:518-524`). Carry the OQ-1 connection keys (`resolved.effective_connections`) on `RunContext` in a neutrally named field, not as a 6th tuple element, unless every unpack site changes in the same commit.
- Replace `:472-516` with one `compose_expert_scope(...)` call.
- **D-267-32 skills ADD:** today `:526-531` builds `skill_catalog_override` = the Expert's skills only. The union must be data too: carry the Expert's skills separately (neutral name) and let `agent_loop.py:1445-1459` union them with the DB query result. Do not replace the catalog.
- The fail-closed `raise ValueError` on `not resolved` (`:446-458`) and the CR-01 refusal (`:465-470`) stay byte-unchanged.

---

### MOD `backend/app/services/agent_loop.py` (loop: G-5 FIRING, honour by construction)

**`RunContext` field pattern** (`:265-282`). Every additive field is default-off and carries a docblock stating that absence means byte-identical behaviour:
```python
# Phase 260 (PACK-02 / D-260-05) — ADDITIVE scoping inputs resolved prior to the loop.
# None = normal unrestricted chat (closed-core invariant).
effective_folder_ids: tuple[str, ...] | None = None
effective_tools: tuple[str, ...] | None = None
...
born_for_bundle_id: UUID | None = None   # "named for that COLUMN, which is why the closed-core invariant stays green"
```
→ add `scoped_connection_keys: tuple[str, ...] | None = None` (plus, for D-267-32, an additive skill tuple). **Neutral names.** Keep `effective_tools` and comment it "no producer since 267", because `test_260:146-162` constructs it.

**Connector admission** (`:1659-1660`). Widen exactly this predicate:
```python
allowed_ids = {str(cid) for cid in (getattr(body, "active_connector_ids", None) or [])}
active_conns = [c for c in conns if str(c.id) in allowed_ids and c.is_enabled]
```
→ `… if (str(c.id) in allowed_ids or (_keys and (c.service_id in _keys or c.capability in _keys))) and c.is_enabled`, where `_keys = set(ctx.scoped_connection_keys or ())`. The posture gate downstream is unchanged. Keep the `:1640-1658` "absent and empty both mean NONE" comment true: an unscoped run still gets none.

**History skip** (`_reconstruct_history :1004-1006`). Add this as the first statement inside `for msg in history_rows:`. System rows otherwise fall to the `else` at `:1075-1081` and reach the model:
```python
for msg in history_rows:
    tool_calls_data = msg.get("tool_calls")
    # ← one kind check here, reading TRANSCRIPT_EVENT_KINDS from app.models.message
```

**System-row writer to mirror** (`:1941-1948`). This is the exact existing shape of a `kind` row:
```python
await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "system",
        "content": _strip_nul(w.get("message", "")),
        "tool_calls": [{"kind": w.get("kind", "")}],
    })
)
```
The 267 writers (in `api/threads.py` / `thread_handoff.py`, **not** here) copy this shape **plus** `"org_id": <thread org_id>`. This writer omits it and relies on the `LIMIT 1` trigger, which D-267-34 forbids for new rows.

**Filter** (`:1696-1703`): it becomes unreachable. Either keep it as an inert seam or delete it together with `test_260:146-162`. State which choice was made in the ledger row.

---

### MOD `backend/app/services/tool_dispatcher.py`

**Self:** `:4744-4775` defines `EXPERT_CORE_TOOLS` and `EXPERT_DELIVERABLE_TOOLS`, each with a module-scope `assert ⊆ _TOOL_REGISTRY`. If they are deleted, the three **module-level** importers become collection errors: `test_261_expert_runtime_scoping.py:12`, `test_261_expert_authoring_scenarios.py:31` and `test_261_closed_core_inventory.py:9`. There is also a function-local importer at `test_259_closed_core_inventory.py:103-111`. Edit all four in the same commit. The comment at `:1591-1595` becomes false (`save_skill` IS advertised), and `test_264_load_skill_born_for.py:407-429` pins its tokens.

---

### MOD `backend/app/models/message.py` (constant + role widen + payload models)

**Exact analog in the same file** (`:8-27`): a one-home frozenset with a docblock naming both importers:
```python
# ONE frozenset, imported by BOTH merge sites (api/threads.py and services/workflow_kickoff.py)
# — this plan's whole complaint is a fact living in two places, so it does not add a third.
RESERVED_RUN_INPUT_KEYS: frozenset[str] = frozenset({"kickoff_prompt", "folder_id"})
```
→ `TRANSCRIPT_EVENT_KINDS: frozenset[str] = frozenset({"expert_changed", "expert_handoff"})`. The name must not contain `expert`, because `agent_loop.py` imports it. Keep `"handoff"` **out** of this set: the handoff is a user row the model must see.

**Role widen** (`:83`): `role: Literal["user", "assistant"]` → add `"system"`. The docstring at `threads.py:537-542` records why an unwidened literal 500s the snapshot (BUG-260528-01).
**Payload models:** put `ExpertChangedEvent` and friends here as Pydantic models (the CLAUDE.md "Pydantic for structured output" rule). Use generic `now`/`dropped` keys so Phase 268 adds a kind rather than a renderer.

---

### MOD `backend/app/models/thread.py`

**Analog** (`:12-21`):
```python
class ThreadCreate(BaseModel):
    title: str = "New Chat"
    folder_id: UUID | None = None
    active_expert_id: UUID | None = None
```
→ `class ThreadHandoffRequest(BaseModel): expert_id: UUID; model: str | None = None; provider: str | None = None`, and a preview response model. `ThreadResponse` (`:24-31`) is the handoff return type.

---

### MOD `backend/app/services/expert_service.py` (extract `connection_states`)

**Self:** `:527-558`. This is the ONE rule to extract; the resolver then calls the extracted function:
```python
conn_query = """
    SELECT DISTINCT service_id, capability
    FROM public.connector_connections
    WHERE org_id = $1
      AND is_enabled = true
      AND status = 'active';
"""
conn_rows = await pool.fetch(conn_query, caller_org_id)
active_conn_keys: set[str] = set()
for r in conn_rows:
    if r.get("service_id"): active_conn_keys.add(r["service_id"])
    if r.get("capability"): active_conn_keys.add(r["capability"])
for c in raw_connections:
    if c in active_conn_keys: effective_connections.append(c)
    else:
        stripped_count += 1
        stripped_details.append(f"connection:{c}")
        logger.warning("EXPERT_MEMBER_CROSS_ORG_STRIPPED: connection '%s' unconfigured or foreign to org '%s'", c, caller_org_id)
```
- The extracted function must read **all** org rows (it drops the `status`/`is_enabled` WHERE and moves both into the `connected` predicate), so a revoked service can still be **named** ("Google Workspace").
- Model shape: follow `ResolvedExpertBundle` (`:20-34`, a Pydantic `BaseModel` with `Field(default_factory=list)`). A `ConnectionState(slug, name, connected)` BaseModel fits the file's idiom.
- ⛔ The AST fence (`test_259:65-82`) means no LLM import and no `while` in this file.

---

### MOD `backend/app/api/experts.py` (overlay)

**Analog** (`:472-489`). The overlay adds a key, asks for a permission only when needed, and uses one helper for both list arms and get:
```python
async def _overlay_install_state_for_caller(request, current_user, active_org, pool, rows, org_id):
    can_install = False
    if any(r.get("is_system") for r in rows):
        can_install = await _has_org_permission(request, current_user, active_org, "experts:manage")
    return await overlay_install_state(pool, rows, org_id=org_id, can_install=can_install)
```
Call sites to extend: management arm `:458`, member arm `:469`, get `:538-541` (`(overlaid,) = await …([bundle])`).
**Overlay body rules** (`expert_install_service.py:300-316`):
- A list with nothing to overlay is returned as-is with **zero** queries.
- Every changed row is **copied** (`row = dict(r)`, `:346`) before it is changed.
- → Add a NEW key `connection_state` and never mutate `required_connections`, because org-authored rows round-trip it into `PATCH /experts/{id}`.
- `can_connect` = `_has_org_permission(..., "org:manage")` ∧ `live_connectors` visible. Ask only when some row has a missing connection. ⛔ Never `experts:manage` (UI-SPEC R-1).
- Imports already present: `_has_org_permission`, `resolve_caller_role`, `get_pg_pool` (`:22-29`).

---

### MOD `backend/app/dependencies.py` (optional `feature_visible`)

**Analog** (`require_visible._dep :645-660`). Factor the body into a non-raising `async def feature_visible(request, current_user, feature) -> bool` and let `_dep` call it and raise the 403. `is_operator` → `feature_audience` → `resolve_caller_role` + `resolve_feature_access` is the one rule. If this file is touched, add it to `files_modified` and ledger-check it.

---

### MOD `backend/app/api/threads.py` (G-5 FIRING: 252/86/1794; its row is stale, so re-derive it)

**1. The shared fail-closed Expert-binding gate (D-267-31).** Extract `rename_thread :720-750` into one helper that `PATCH`, `POST /threads` and the handoff route call:
```python
active_org_id = await resolve_active_org_or_none(request, current_user)
if active_org_id:                                  # ← D-267-31: the no-org arm REFUSES now (was fail-open skip)
    pool = await get_pg_pool()
    from app.services.entitlement_service import check_entitlement, EntitlementDeniedException
    ent = await check_entitlement(pool, active_org_id, "experts")
    if not ent.allowed:
        raise EntitlementDeniedException(ent)
    from app.services.expert_service import get_expert_service
    from app.dependencies import resolve_caller_role
    _role, _groups = await resolve_caller_role(request, current_user)   # never current_user["role"]
    caller_roles = [_role] if _role else []
    bundle = await get_expert_service(pool=pool, bundle_id=..., caller_org_id=UUID(str(active_org_id)),
                                      caller_user_id=c_uid, caller_roles=caller_roles)
    if not bundle:
        raise HTTPException(status_code=404, detail="Expert bundle not found or access denied")
```
`resolve_active_org_or_none` (`dependencies.py:998-1047`) returns `None` for an absent header or a non-member. The helper turns that into a 403 with a reason. Clearing an Expert stays ungated (`:718-719`).
⚠ `test_260_expert_chat_scoping.py:190-240` pins the fail-open path and the exact `aexec` `side_effect=[update, select]` sequence. Rewrite it in the same plan.

**2. `create_thread` (`:662-685`).** Add `request: Request` and call the gate before `:672-673` accepts `active_expert_id`. The audit via `background_tasks.add_task(write_audit_entry, …)` (`:678-684`) is the shape to keep.

**3. Event writer in `rename_thread`.** Read `active_expert_id, folder_id, org_id` **before** the update at `:753-760`. Today the route updates first and reads after (`:761-767`). Write the system row (the `agent_loop.py:1941-1948` shape + explicit `org_id`) only when the value changed **and** the thread has ≥ 1 `user`/`assistant` row.

**4. Snapshot/messages allowlist.** Replace `.neq("role", "system")` at `:548` (and the twin in `get_messages`) with a Python filter through one helper reading `TRANSCRIPT_EVENT_KINDS`. The query shape to keep (`:543-557`):
```python
msgs_resp = await aexec(
    supabase.table("messages").select("*")
    .eq("thread_id", str(thread_id)).eq("user_id", current_user["id"])
    .neq("role", "system")                     # ← remove; filter in Python by kind allowlist
    .order("created_at"))
messages = msgs_resp.data or []
messages = await _enrich_messages_with_runs(messages, ...)
```
⛔ It must stay an allowlist: `ask_user_*`, `context_truncated` and `iteration_cap_*` system rows exist in real data.

**5. Preview + handoff routes.** Ownership first, under the user JWT, with 404 before any other read (`get_thread :694-703` shape: `.eq("id", …).eq("user_id", current_user["id"]).maybe_single()`).
Document count (RLS, the same client), following `knowledge_health.py:132-137`:
```python
supabase.table("documents").select("id, filename, folder_id, ...", count="exact").eq("is_latest", True)
```
Add `.in_("folder_id", excluded)`, `.or_("source_state.is.null,source_state.neq.source_disconnected")`, `.order("filename").limit(5)`. The count and the names come from one response.
Imports already present: `get_user_pg_connection`, `resolve_active_org_or_none`, `resolve_run_model`, `override_provider`, `load_user_settings`, `_run_model_resolution` (`:36-120`).

---

### Backend tests `backend/tests/unit/test_267_*.py`

**Analog: mocks and unit shape** (`test_260_expert_chat_scoping.py`):
- Supabase chain mock (`:79-83`): `mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_query`.
- Resolver patch (`:126-127`): `with patch("app.services.expert_service.resolve_expert_bundle", new_callable=AsyncMock) as mock_resolve:`.
- Route-level (`:209-222`): `patch("app.api.threads.aexec", new_callable=AsyncMock)` with an explicit `side_effect=[...]` per call, plus `patch("app.api.threads.resolve_active_org_or_none", …)`. The handler is called directly with kwargs.
- `ResolvedExpertBundle(...)` fixture (`:112-124`).

**Analog: AST / inventory fences** (`test_259_closed_core_inventory.py`):
- `ast.parse(path.read_text(encoding="utf-8"))` + `ast.walk` (`:47-52`, `:67-82`).
- Registry counts `len(_TOOL_REGISTRY) == 29` (`:40-45`).
- A named-key guard with an explanatory failure message (`:96-100`). Copy this for "`emit_handoff_summary` not in `EMITTER_REGISTRY`/`_TOOL_REGISTRY`".
- For D-267-04 #2 ("no producer passes a non-None `effective_tools`"), copy the `:47-52` walk shape over `run_producer.py`.

---

### MOD `frontend/src/components/experts/catalog/expertCatalog.ts` (gate wording, one home)

**Self-analog** (`:103-137`, `:147-187`, `:218-224`):
```ts
export const INSTALL_COPY = {
  installAction: "Install",
  ...
  provenance: (expertName: string) => `from ${expertName}`,
} as const
```
```ts
export type InstallView =
  | { kind: "legacy" } | { kind: "chat" } | { kind: "install"; action: string }
  | { kind: "retry"; action: string; headline: string; cause: string }
  | { kind: "status"; line: string; cause?: string }
```
```ts
export function inviteGate(expert: ExpertBundle): string | null {
  const install = expert.install
  if (!install || install.state === "ready") return null
  ...
}
```
- Add `CONNECTION_COPY` beside `INSTALL_COPY` (`as const`, functions for interpolated lines, as `provenance` does).
- Add `connectionGate(expert)` returning the UI-SPEC §5.1 shape.
- Gate order is install → connection: `inviteGate` returns the install reason first.
- The docblock rule to keep (`:110-113`): "the UI never decides readiness: `state` and `can_install` are server facts". The same holds for `connected` and `can_connect`.
- "No arm is a disabled button" (`:139-141`, D-262-02).
- The unnamed-folder phrase is `UNNAMEABLE_FOLDER` (`ExpertDetailModal.tsx:89`). Import it; never re-spell it.

---

### NEW `frontend/src/components/experts/ScopeLedger.tsx` (leaf component)

**Analog A: heading voice** (`ExpertDetailModal.tsx:102-108`):
```tsx
<h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
```
**Analog B: tone-by-prop pill** (`ExpertDetailModal.tsx:119-133`):
```tsx
function NamePill({ icon, label, dim }: {...}) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
    dim ? "border-border/60 bg-muted/20 italic text-muted-foreground"
        : "border-violet-500/25 bg-violet-500/10 text-violet-200")}>{icon}{label}</span>
}
```
The file header is a docblock stating the "one payload, two lists" rule (the `expertCatalog.ts:1-20` voice). Cell tones, test ids and the `<ul aria-labelledby>` structure are fixed by UI-SPEC §5.2. Ledger row **at creation**.

---

### MOD `ExpertCard.tsx` / `ExpertDetailModal.tsx` / `ExpertCatalogPage.tsx`

**In-flight guard analog (R265-262-04):** the shipped `installBusy` prop (`ExpertCard.tsx:52-53`, `:189-190`):
```tsx
installBusy ? (
  <StatusPill label={INSTALL_COPY.starting} reason={INSTALL_COPY.starting} />
) : onInstall ? ( <button …> ) : …
```
→ a `startBusy` state for Start Chat, owned by the page, as install's is. The button renders `Loader2` + `Starting…`, is `disabled`, and has `aria-busy`.
**Footer control choice** (`ExpertCard.tsx:179-209`) branches on `installView(expert).kind` only. Add the connection arm by asking `connectionGate`, never by reading `connection_state` inline.
⚠ `StatusPill` (`:57-66`) puts its reason in `title`, which is hover-only. The visible `Requires … — not connected` line is what satisfies at-rest visibility (UI-SPEC §5.4).
**Modal missing pill:** `NamePill` (`ExpertDetailModal.tsx:119-133`) with a rose variant; `FooterLine` (`:115-117`) for the member sentence. The Required Connections section is at `:299-312`.

---

### MOD `frontend/src/components/experts/ExpertAuthoringStudio.tsx` (OQ-2 / D-267-30)

**Self** (`:1113-1122`). Today the picker toggles `c.name`:
```tsx
const isSelected = requiredConnections.includes(c.name)
... isSelected ? prev.filter((name) => name !== c.name) : [...prev, c.name]
```
→ select and deselect by `c.service_id`, display `c.name`. The server's drafter already stores `service_id` (`api/experts.py:321-324`). Remove the toggle block `:890-908` and the indicator `:1504-1509`, then check `tsc -p tsconfig.app.json` for new `TS6133` (this file already has 3 base errors).

---

### MOD `frontend/src/lib/api/experts.ts` + `frontend/src/types/index.ts`

**Wire-type analog** (`lib/api/experts.ts:72-84`):
```ts
/** Phase 266 (PACK-18 / PACK-19): … Wire type — declared HERE beside its siblings and imported by `@/types`
 *  with `import type` (elided at compile, so no runtime cycle).
 *  ⛔ The UI never decides readiness: `state` and `can_install` are server facts. */
export interface ExpertInstallState { state: ...; can_install: boolean; ... }
```
→ `export interface ExpertConnectionState { slug: string; name: string; connected: boolean }`, declared here. `ExpertBundle` (`types/index.ts:18-37`) gains `connection_state?: ExpertConnectionState[]` and `can_connect?: boolean`, mirroring `install?: ExpertInstallState | null` at `:36`.
**`Message.role`** (`types/index.ts:174`): `"user" | "assistant"` → add `"system"`. Give the event payload its own TS type; `Message.tool_calls` is `ToolCall[]`, so narrow at the kind check.

---

### MOD `frontend/src/components/chat/InviteExpertDialog.tsx` (G-5 fires; named seam "per-row action block as one component")

**Self:** row gate `:186-222`:
```tsx
{gateReason !== null ? (
  <p className="text-right text-[11px] italic text-muted-foreground">{gateReason}</p>
) : (
<button type="button" data-testid={`invite-expert-btn-${expert.slug}`}
  onClick={() => { onSelectExpert(expert); onOpenChange(false) }}
  className={cn("text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-1.5", …)}>
```
- The shipped button class (copy verbatim for `Replace …` / `New chat with … →`): `"text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-1.5"`, primary = `"bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"`.
- Error box (`:106-110`): `"p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"`. Add `role="alert"`.
- Fetch-on-open with a `mounted` guard (`:53-76`). Copy this for per-row preview fetches.
- The props interface (`:22-27`) gains optional props only.
- Width `max-w-md` → `max-w-lg` at `:82`. The description at `:93-95` is replaced (the copy is now false).
- The R9 lock ignores `onOpenChange(false)` while in flight. Wrap the `onOpenChange` handed to `<Dialog>` at `:79`.
- ⭐ Take the named seam: extract the per-row action block (R1-R10) into one component, so the dialog body stays a list.

---

### NEW `frontend/src/components/chat/ExpertEventCard.tsx` and `HandoffCard.tsx` (leaf renderers)

**Analog: the sibling-notice pattern MessageItem already uses** (`MessageItem.tsx:657-665`):
```tsx
{message.role === "assistant" && message.blockedNotice && (
  <div data-testid="blocked-notice"
    className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400/90">
    <Ban className="w-3.5 h-3.5 flex-shrink-0" aria-label="Blocked" />
    <span>{message.blockedNotice.message}</span>
  </div>
)}
```
- The docblock rule at `:653-656` applies: server strings are **React text children only**, never `dangerouslySetInnerHTML`, and every tone carries a glyph or word, never colour alone.
- Leaf file header style: `ExpertSpotlightCard.tsx:1-28` (phase tag, UI-SPEC section, what was retired and why).
- Props interface idiom: `ExpertSpotlightCard.tsx:35-40`.
- Icon import style: `import { X, ArrowRight, Folder, Wrench } from "lucide-react"` (`ExpertSpotlightCard.tsx:30`).
- `Open →` calls a passed `onOpenThread(id)`. The app has no router, so this is the `selectThread` door (`useThreads.ts:35-37`).
- Ledger rows **at creation**.

---

### NEW `frontend/src/components/chat/expertEventCopy.ts` (vocabulary, one home)

**Analog:** `composerCopy.ts:1-50` (a docblock stating what is ported and what is not, and why), plus `INSTALL_COPY` (`expertCatalog.ts:115-137`, an `as const` object with functions for interpolated strings). Mirror the backend `TRANSCRIPT_EVENT_KINDS` here as the one frontend constant, and cross-pin it to the backend with a `?raw` read of `backend/app/models/message.py` (the precedent: suites import backend `.py` via `?raw`, memory `reference_frontend_suites_import_backend_source_raw`).

---

### MOD `frontend/src/components/chat/MessageItem.tsx` (G-5 FIRING, honour by construction)

**Discriminator analog** (`:101-107`). This is how the file already reads `tool_calls`:
```ts
function hasPendingAsk(toolCalls: ToolCall[] | undefined): boolean {
  return (toolCalls?.some((tc) => tc.name === "ask_user" && (tc.status === "running" || tc.status === "interrupted")) ?? false)
}
```
→ one module-level helper (e.g. `transcriptEventKind(message)`), then **one early return placed after the hooks**. The hooks are unconditional at `:277-320`, and the Rules-of-Hooks note is at `:303-305`. Place the branch just before `if (isUser) {` at `:322`. Put the handoff-marker check in the same place (it renders `HandoffCard` instead of the user bubble). ⛔ No new `useState`/`useEffect`. The component is `memo`'d (`:265-272`).

---

### MOD `frontend/src/components/chat/ChatArea.tsx` (G-5 FIRING)

- **D-267-21 client half:** `handleSend :433-437` calls `onCreateThread(scopeFolderId)`. Add `activeExpert?.id` as an optional second argument and put `activeExpert` in the deps array at `:468`.
- **Hydration effect** (`:241-258`) is unchanged. Once the created thread carries the Expert, it reads the id instead of clearing it.
- **One PATCH home:** today `MessageInput.tsx:171-198` PATCHes and only `console.error`s on failure. Move the PATCH into ChatArea's `onActiveExpertChange` (`:541-545`), surface refusals, and refetch the snapshot afterwards (only when not streaming; RESEARCH pitfall 11).
- **Handoff navigation** follows `startScopedChat.ts:56-80`: refresh **before** select, and a failure does not navigate.
```ts
const created = await deps.createThread()
let scoped: Thread
try {
  scoped = await deps.setExpert(created.id, expert.id)
  await deps.refreshThreads()          // ⛔ BEFORE the selection, always
} catch (err) { await deps.discardThread?.(created.id).catch(() => {}); throw err }
deps.selectThread(scoped); deps.navigate()
```
For the handoff, the server creates everything in one request, so only `refreshThreads` → `selectThread` applies. There is nothing to discard.

---

### MOD `frontend/src/lib/api/threads.ts` (G-5 row stale; re-derive it)

**`createThread` analog** (`:23-34`). Extend the optional-body pattern:
```ts
export async function createThread(title = "New Chat", folderId?: string | null): Promise<Thread> {
  const headers = await getAuthHeaders()
  const body: Record<string, string> = { title }
  if (folderId) body.folder_id = folderId        // ← add: if (activeExpertId) body.active_expert_id = activeExpertId
```
**Refusal-preserving error analog** (`postMessage :582-589`). Copy it into `setThreadActiveExpert` (`:190-199`, which today throws a generic message) and into the new `handoffThread`:
```ts
if (!res.ok) {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
  throw new ApiError(
    entitlementRefusalMessage(body) ??
      (typeof body?.detail === "string" ? body.detail : "Failed to send message"),
    res.status,
  )
}
```
Imports already present at `:14`: `API_BASE, ApiError, entitlementRefusalMessage, getAuthHeaders`. The R265-audit-fixes-06 test goes in `src/lib/api/__tests__/entitlementRefusal.test.ts`; its existing cases are at `:34-41`.

---

### MOD `frontend/src/hooks/useThreads.ts`

**Self** (`:39-44`):
```ts
const newThread = useCallback(async (folderId?: string | null) => {
  const thread = await createThread("New Chat", folderId)
  setThreads((prev) => [thread, ...prev]); setSelectedThread(thread); return thread
}, [])
```
→ `(folderId?: string | null, activeExpertId?: string | null)`. The interface line at `:14` widens the same way. `ChatLayout` passes `newThread` directly (`ChatLayout.tsx:824`), so the call stays compatible.

---

### MOD `frontend/src/components/layout/ChatLayout.tsx`

**Prop-forward analog** (`:834-843`). Each new optional prop is one line with a "why" comment, e.g.:
```tsx
onOpenConnections={() => onNavigate("connections")}
onBrowseExperts={() => onNavigate("experts")}
```
→ add `selectThread` / `loadThreads` / `onOpenThread` for the handoff and the `Open →` link. The same connections door serves `Connect HubSpot →` (D-267-08).
**Wiring-test target (R265-262-03):** the `onStartChat` seams at `:1047-1059` (`createThread: newThread, setExpert: setThreadActiveExpert, refreshThreads: loadThreads, selectThread, navigate, discardThread: deleteThread`). Reuse the `ChatLayout.launch.test.tsx` harness.

---

### Frontend tests + gate knobs

**Visible-at-rest analog** (`src/__tests__/components/FolderNode.test.tsx:269-287`). This is the 266 UI-3 lesson in code:
```tsx
const caption = screen.getByTestId("navrow-caption")
expect(caption).toHaveTextContent("from Financial Analyzer")
expect(caption).toBeVisible()
// jsdom loads no Tailwind — assert no hiding utility on the node or any ancestor
const HIDING = new Set(["hidden", "sr-only", "invisible", "opacity-0"])
for (let el: HTMLElement | null = caption; el; el = el.parentElement) {
  const hiding = (el.getAttribute("class") ?? "").split(/\s+/).filter((t) => HIDING.has(t))
  expect(hiding, `<${el.tagName.toLowerCase()} class="${el.getAttribute("class")}">`).toEqual([])
}
```
Apply it to the ledger items, the gate line, the member ask, `Now`/`Dropped`, `Here`/`Open` and the handoff bullets.

**Pure-selector analog** (`experts/catalog/__tests__/expertCatalog.test.ts`):
- The `vi.mock("@/lib/api/_core", …importOriginal…)` header (`:16-26`).
- An `expert({...})` fixture builder (`:34-40`).
- Copy pins such as `expect(INSTALL_COPY.installAction).toBe("Install")` (`:207`).
- `inviteGate` table (`:284-297`).

**`?raw` source-fence analog** (`chat/__tests__/MessageItem.inlineApproval.test.tsx:610-621`) with the shared normaliser `@/lib/stripComments.testutil` (`:28-29`):
```ts
const item = stripComments((await import("../MessageItem.tsx?raw")).default as string)
expect(item.length).toBeGreaterThan(1000)                 // non-vacuity
expect([...item.matchAll(/<PendingAskStack/g)]).toHaveLength(0)
```
Use this for "one kind check / one mount" fences in `MessageItem.tsx`. ⛔ Never use it on string-content assertions (the `stripComments.testutil.ts:17-20` warning).

**Count-gate adoption** (`scripts/vitest-count-gate.cjs`):
- BASELINE is keyed by **basename** (`:172 "ComposerExpert.test.tsx": 12`, `:177`, `:206 "expertCatalog.test.ts": 27`).
- TARGETS takes **file paths** (`:4454-4471`, e.g. `"src/components/chat/__tests__/ComposerExpert.test.tsx"`). There is no bare `src/components/chat` directory entry.
- Every new suite goes into **both** knobs, using the gate's own printed `— N new` count.

---

## Shared Patterns

### Server facts, UI selectors (one home per concern)
**Source:** `expertCatalog.ts:103-113` + `expert_install_service.py:300-316`
**Apply to:** the connection overlay (PACK-22), `connectionGate`, the preview ledger, the event card.
The server computes the state (`connected`, `can_connect`, `excluded_count`). One pure TS module turns it into words. No component spells a literal or branches on a raw field.

### Org role / permission, never `current_user["role"]`
**Source:** `api/experts.py:415-419` (`_caller_roles`), `threads.py:736-738`
```python
role, _groups = await resolve_caller_role(request, current_user)
return [role] if role else []
```
**Apply to:** the shared Expert-binding gate, `can_connect`, and every handoff/preview access check. R265-audit-fixes-03 is exactly this bug class.

### Blocking I/O inside async handlers
**Source:** `thread_title.py:264-277` (`await aexec(supabase…)`, `await run_in_threadpool(title_fn, …)`)
**Apply to:** every supabase-py call (`aexec`), `load_user_settings`, and any sync LLM client in `thread_handoff.py` (D-v2.5-01).

### Explicit `org_id` on every row this phase writes
**Source:** the D-267-34 ruling. The analog writer at `agent_loop.py:1941-1948` shows what **not** to copy (it omits `org_id`).
**Apply to:** the `expert_changed` row, the `expert_handoff` row, the handoff user row and the handoff thread INSERT. Read `org_id` from the source `threads` row.

### Refusal messages survive to the UI
**Source:** `lib/api/threads.ts:582-589` + `entitlementRefusalMessage` (`lib/api/_core.ts:50`)
**Apply to:** `setThreadActiveExpert`, `createThread` (now gated), `handoffThread`. The server `detail` sentence renders as React text (UI-SPEC §6.3).

### Additive default-off fields (G-5 honour by construction)
**Source:** the `RunContext` docblocks (`agent_loop.py:240-282`); the `startScopedChat.ts` "every seam injected" rule (`:25-29`)
**Apply to:** every new `RunContext` field, prop and optional argument. The default must make behaviour byte-identical to base.

### Hot-file ledger discipline
**Apply to:**
- Every modified firing file (`agent_loop.py`, `run_producer.py`, `tool_dispatcher.py`, `api/threads.py`, `api/experts.py`, `ChatArea.tsx`, `MessageInput.tsx`, `MessageItem.tsx`, `InviteExpertDialog.tsx`, `lib/api/threads.ts`, the catalog files): re-derive the triple and update the row and its `docs/HOT-FILE-LEDGER.md` section **in the same commit**. The disposition cell is ≤ 200 chars.
- New files (`expert_scope.py`, `thread_handoff.py`, `ExpertEventCard.tsx`, `HandoffCard.tsx`, `expertEventCopy.ts`, `ScopeLedger.tsx`): add the row **at creation**.
- Gate: `node scripts/check-hot-file-ledger.cjs 267`.

---

## No Analog Found

None outright. One file has only a **composite** analog, so the planner should state which part comes from where:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/services/thread_handoff.py` | service | LLM → atomic multi-row write | No existing service both calls `forced_emit` **and** commits several rows in one `get_user_pg_connection` txn, and none *refuses* where every precedent degrades (`thread_title` derives a title, `expert_authoring` falls back to a draft). Combine Analogs A-D above. The refusal-not-fallback semantics are new, so test them first (TDD RED: forced_emit failure → zero rows). |

---

## Metadata

**Analog search scope:**
- `backend/app/services/{thread_title,forced_emit,expert_authoring,expert_service,expert_install_service,run_producer,agent_loop,tool_dispatcher,run_model_resolution}.py`
- `backend/app/api/{experts,threads,workspace,org,knowledge_health}.py`, `backend/app/dependencies.py`, `backend/app/models/{message,thread}.py`
- `backend/tests/unit/test_{259_closed_core_inventory,260_expert_chat_scoping}.py`
- `frontend/src/components/{chat,experts,layout}/…`, `frontend/src/lib/api/{threads,experts}.ts`, `frontend/src/hooks/useThreads.ts`, `frontend/src/types/index.ts`, `frontend/src/lib/stripComments.testutil.ts`
- `frontend/src/__tests__/components/FolderNode.test.tsx`, `scripts/vitest-count-gate.cjs`

**Files scanned:** ~35 (targeted ranges; no large file read whole)
**Pattern extraction date:** 2026-09-25
