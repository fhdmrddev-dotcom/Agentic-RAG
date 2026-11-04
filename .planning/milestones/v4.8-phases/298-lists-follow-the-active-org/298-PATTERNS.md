# Phase 298: Lists Follow the Active Org - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 41 new/modified (13 new, 28 modified)
**Analogs found:** 40 / 41 (the only gap is the move transaction itself, which is composed from three analogs)

> Line numbers below were measured on `develop` at `8cd31698f`, after RESEARCH.md was written, and
> several **have already drifted** from the research's numbers. Where they disagree, the number
> here is the one read today: `list_draft_workflows`' WHERE is at `db/workflows.py:1201-1203`
> (research said 1196-1203); `scheduler_service.template_refusal` call is at `:122-132` and
> `org_id = schedule.get("org_id") or row.get("org_id")` at `:134` (research said 120-130 / 132);
> `upload_document`'s minter call is at `documents.py:615-622` (research said 609-616). Re-derive at
> plan time; never quote.

## File Classification

### Backend — new

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/services/org_lists.py` | service (polarity helpers + ORG-05 refusal) | request-response transform | `harness/scope.py:126-138` (seam-contract `_org_kw`) + `dependencies.py:1020-1069` + `unattended_launch.template_refusal` `:103-113` | exact (composed) |
| `backend/app/services/org_move.py` | service (preview + pool transaction) | CRUD / batch write | `db/workflows.py:540-541` (pool txn) + `api/folders.py:152-222` (subtree BFS, hold guard, audit) + `db/api_keys.py:207-215` (membership) | role-match (composed) |
| `backend/app/api/org_moves.py` (name: discretion) | route (new router module) | request-response | `backend/app/api/api_keys.py:1-64` (Phase 293 new router) + `api/library.py:277-299` (RLS-conn read) | exact |
| `supabase/migrations/217_org_move.sql` | migration | DDL | `supabase/migrations/215_api_keys_and_run_origin.sql:136-193` | exact |
| `backend/tests/unit/test_298_list_narrowing.py` | test | — | `tests/unit/test_165_folder_utils_org_scope.py` | role-match |
| `backend/tests/unit/test_298_foreign_binding.py` | test | — | `tests/unit/test_296_kickoff_and_keys.py`, `test_296_schedule_trigger_words.py` | exact |
| `backend/tests/unit/test_298_org_matrix.py` | test | — | `test_182_publish_org_scope.py`, `test_165_folder_utils_org_scope.py` | role-match |
| `backend/tests/unit/test_298_elsewhere_counts.py` | test | — | `tests/unit/test_276_api_docs_gate.py:91-98` (401) | role-match |
| `backend/tests/unit/test_298_migration_217_shape.py` | test (SQL text) | — | `tests/unit/test_296_migration_shape.py:1-60` | exact |
| `backend/tests/integration/test_298_two_org_lists_live.py` | test (live PG) | — | `tests/integration/test_296_two_org_create.py:1-110` | exact |
| `backend/tests/integration/test_298_org_move_live.py` | test (live PG) | — | `test_296_two_org_create.py` + `test_275_policy_rls.py:129-139` (anon) + `test_110_audit_drift_guard.py` | exact |

### Backend — modified (FIRING files: one expression each, D-26)

| Modified file | Role | Data flow | Analog for the one expression | Match |
|---|---|---|---|---|
| `backend/app/api/folders.py` (`list_folders` :24-33, `list_children` :36-47) | route | request-response | same file `create_folder` :50-67 (`request: Request = None` + `resolve_active_org_or_none`) | exact |
| `backend/app/api/documents.py` (`list_documents` :867-925, `upload_document` :557-622) | route | request-response / file-I/O | same file; `create_folder` `request` param | exact |
| `backend/app/api/library.py` (`LIBRARY_SUMMARY_SQL` :160-184, route :277-299) | route | request-response (aggregate) | same file (already takes `request`) | exact |
| `backend/app/api/workflows.py` (`list_published` :403-500, `create_draft` :1194-1230, `list_drafts` :1238-1249, `update_draft` ~:1288-1393) | route | CRUD | same file `create_draft` :1214-1221 (`_active_org` → `UUID(...) if ... else None`); `stale_token` 409 detail :1375-1385 | exact |
| `backend/app/db/workflows.py` (`list_published_workflows` :716-721, `list_draft_workflows` :1091-1205) | model/db | CRUD | same file `project_folder_id` AND-append :718-721 | exact |
| `backend/app/api/threads.py` (`list_threads` :269-287) | route | request-response | `folders.create_folder` `request` param | exact |
| `backend/app/api/workflow_runs.py` (`list_workflow_runs` :665-742) | route | request-response | `runs_query` conditional narrowing :736-737 | exact |
| `backend/app/services/workflow_kickoff.py` (select string :235; check after :300-308) | service | request-response | same file's `template` refusal block :275-287 | exact |
| `backend/app/services/scheduler_service.py` (beside :122-132) | service | batch/event | same file `template_refusal` block :118-132 | exact |
| `backend/app/api/inbound.py` (beside :363-368) | route | request-response | same file `template_refusal` refusal :363-368 | exact |
| `backend/app/services/audit_service.py` (`VALID_ACTION_TYPES` :13-37) | config | — | same file :35-36 (Phase 293 lockstep entry) | exact |
| `backend/app/main.py` (one `include_router`) | config | — | `main.py:936-938` (Phase 293 lines) | exact |
| `scripts/build-public-openapi.cjs` (`TAG_GROUPS` :102+) | config | — | same file :103 | exact |
| `scripts/full-schema-supplement.sql` (grant mirror) | config | — | mig 215 :165-170 grant block | exact |
| `backend/tests/test_seed190_run_log.py:206-215` | test (fence, deliberate amend) | — | `D-206-07` retire-deliberately precedent | exact |

### Frontend — new

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `frontend/src/hooks/useActiveOrgId.ts` | hook | — | `providers/OrgProvider.tsx:215-217` `useOrgOptional` | exact |
| `frontend/src/lib/elsewhereCounts.ts` (store + `useElsewhereCounts`) | store | request-response w/ dedupe | `frontend/src/stores/citationCheckStore.ts` (zustand, generation guard, reset) | exact |
| `frontend/src/lib/api/orgMoves.ts` (client; name discretion) | api client | request-response | `frontend/src/lib/api/org.ts:13-48` | exact |
| `frontend/src/components/org/ElsewhereLine.tsx` | component | render-only | `RunLogPanel.tsx` failure/loading honesty (`:120-127`) + UI-SPEC | role-match |
| `frontend/src/components/org/MoveToOrgDialog.tsx` | component (victim-naming confirm) | request-response | `frontend/src/components/retention/ReleaseHoldDialog.tsx` (whole file, 138 L) | exact |
| `frontend/src/components/org/MoveToOrgMenuItem.tsx` (leaf) | component | event | `components/ingestion/FolderNode.tsx:207-217` (`isOwner &&` DropdownMenuItem) | exact |
| `useLibraryOrgSwitch` hook (LibraryPage extraction, move-only) | hook | event-driven | `hooks/useLibraryDocuments.ts:228-291` (the 284-01 seam taken out of LibraryPage) | role-match |
| WorkflowsPage feeds hook (extraction, move-only) | hook | request-response | `pages/WorkflowsPage.tsx:413-479` (the code that moves) | exact (move) |

### Frontend — modified

| Modified file | Role | Data flow | Analog | Match |
|---|---|---|---|---|
| `frontend/src/hooks/useFolders.ts` (state :21, load :24-27, Realtime :43-67) | hook | CRUD + Realtime | `RunLogPanel.tsx:100-139` generation guard; research "org-tagged state" | exact |
| `frontend/src/hooks/useThreads.ts` (:25-37) | hook | request-response | same | exact |
| `frontend/src/hooks/useLibraryDocuments.ts` (`sourceKey` :230, summary :276-291) | hook | request-response | same file's own cold-source rule | exact |
| `frontend/src/providers/OrgProvider.tsx` (self-heal :126-130) | provider | — | same file `switchOrg` :173-180 | exact |
| `frontend/src/lib/api/documents.ts` (`uploadDocument` :164-180) | api client | file-I/O | `_core.ts:286-291` X-Org-Id spread | exact |
| `frontend/src/lib/api/threads.ts` (`postMessage` :805-811) | api client | request-response | same; `workflows.ts:528-545` `detail.code` branch | exact |
| `frontend/src/lib/api/workflows.ts` (create :448-451, update 422 arm :541-545) | api client | CRUD | same file `stale_token` branch :533-539 | exact |
| `frontend/src/components/chat/useStartWorkflowInThread.ts` (`failureFor` :20-25) | hook | — | same function | exact |
| `frontend/src/components/workflows/history/RunLogPanel.tsx` (`load` :102-139) | component | request-response | same (generation counter) | exact |
| `frontend/src/components/workflows/DescribeKbPicker.tsx` (fetch :174-201, CR-R5-01 effect :223-228) | component | request-response | same | exact |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (:2400-2402) | page | render | same line | exact |
| `frontend/src/components/workflows/useBuilderNameMaps.ts` (:81-92) | hook | request-response | same | exact |
| `frontend/src/pages/LibraryPage.tsx` (effects :397-400, :498-511) | page | event | move into new hook | exact (move) |
| `frontend/src/pages/WorkflowsPage.tsx` (feeds :413-504) | page | request-response | move into new hook | exact (move) |
| `frontend/src/components/layout/ChatLayout.tsx` (one `loading` prop on `<ChatHistoryColumn>`) | layout | render | ChatLayout :190-199 already keyed on `activeOrgId` | exact |
| `frontend/src/components/layout/ChatHistoryColumn.tsx` ("No recent chats" :459-462) | component | render | same | exact |
| `frontend/src/components/ingestion/FolderNode.tsx` (menu :185-229) | component | event | same menu | exact |
| `frontend/src/components/workflows/library/WorkflowCardMenu.tsx` | component | event | `FolderNode.tsx` menu item | role-match |

---

## Pattern Assignments — Backend

### `backend/app/services/org_lists.py` (service, polarity helpers + refusal) — NEW

**Analog A — the seam-contract rule** (`backend/app/services/harness/scope.py:127-138`). The kwarg is forwarded
ONLY when it carries information; this is exactly what `folder_kw` must reproduce:
```python
    # THE SEAM-CONTRACT RULE (WR-05) ... The keyword is forwarded ONLY when it carries information, so an
    # UNRESTRICTED call is byte-identical ON THE WIRE, not merely in outcome. That matters
    # because these are documented MONKEYPATCH seams: ``fetch_visible_folders`` is patched as a
    # module global by the folder-override and scope-governance suites ...
    _org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
    folders = await fetch_visible_folders(supabase, user_id, **_org_kw)  # owner-scoped fetch
```
Copy it as:
```python
async def folder_kw(request, current_user) -> dict:
    org = await resolve_active_org_or_none(request, current_user)
    return {"restrict_org_ids": {org}} if org else {}   # ⛔ never set(), never restrict_org_ids=None
```

**Analog B — the org read** (`backend/app/dependencies.py:1020-1069`). Use it unchanged; note its
`request is not None` guard (line 1044) is what lets every route take `request: Request = None`:
```python
async def resolve_active_org_or_none(request: Request, current_user: dict) -> str | None:
    header_org = request.headers.get("X-Org-Id") if request is not None else None
    if not header_org:
        return None
    org_uuid = _to_uuid(header_org)
    if org_uuid is None:
        return None
    ...  # membership validated on the caller's RLS connection; non-member -> None, never 403
    return str(org_uuid)
```

**Analog C — a pure "refusal sentence or None" helper called from several doors**
(`backend/app/services/unattended_launch.py:103-113`). `foreign_binding_refusal(...)` takes the same
shape (returns a sentence or `None`; callers decide how to raise):
```python
def template_refusal(definition) -> str | None:
    """Phase 295 (D-13) — the sentence refusing a fill step with no template, else ``None``. ..."""
    from app.services.harness.reachability import lint_workflow
    _no_template = [e for e in lint_workflow(definition) if e.code == "no_template_bound"]
    return _no_template[0].message if _no_template else None
```

**Analog D — the definition-org read** (`backend/app/services/harness/publish_service.py:768-780`).
⛔ Do NOT import this private symbol and do NOT edit publish_service (D-26). Copy the SQL into the new module:
```python
    return await pool.fetchval(
        "SELECT org_id FROM workflow_definitions WHERE id = $1", definition_id
    )
```

**Analog E — the confirming rule** (`backend/app/services/harness/scope.py:283-375`):
`folder_scope_violations(definition, *, supabase, user_id, restrict_org_ids=None) -> list[FolderScopeSubsetError]`
— non-raising, already org-aware, and returns a dedicated violation when the project root itself
did not survive the restriction (`:338-355`). Call it with `restrict_org_ids={definition_org}` only
after the cheap pool read finds an offender (research §ORG-05 helper step 4). ⚠ It checks
`project_folder_id` + per-phase `folder_scope` only; D-34 adds kb_auto `inputs[].folder_scope` and
`output_target_folder` — those two need the helper's own pool read (`SELECT id, name, org_id FROM
folders WHERE id = ANY($1::uuid[])`), they are not covered by the publish rule.

**Decode note (SEED-154):** stored definitions may be JSON strings — decode the way
`workflow_kickoff.py:258-260` does (`if isinstance(_raw_def, str): _raw_def = json.loads(_raw_def)`)
or via `workflow_wire._coerce_definition`.

---

### `backend/app/api/folders.py` — `list_folders` / `list_children` (route, one keyword each)

**Analog:** same file, `create_folder` (`:50-67`):
```python
async def create_folder(
    body: FolderCreate,
    request: Request = None,  # FastAPI injects it; direct callers may omit it (no header -> None)
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    _active_org = await resolve_active_org_or_none(request, current_user)
```
Today (`:30` and `:43`): `folders = await fetch_visible_folders(supabase, current_user["id"])`.
Change both to `fetch_visible_folders(supabase, current_user["id"], **await org_lists.folder_kw(request, current_user))`.
`Request` is already imported (`:3`). ⛔ Never post-filter `visible` (`:44` comprehension stays as is).

---

### `backend/app/api/documents.py` — `list_documents` + `upload_document` (route, FIRING 99/39)

**List — one predicate inside `build()`** (`:900-918`). The closure already composes conditionally:
```python
    def build():
        q = (
            supabase.table("library_documents")
            .select(LIST_SELECT, count="exact")
            .eq("is_latest", True)
        )
        if folder_id == "root":
            q = q.is_("folder_id", "null")
        elif folder_id is not None:
            q = q.eq("folder_id", folder_id)
```
Add `request: Request = None` to the signature, resolve the org BEFORE `build()` (it is sync and
re-invoked by `aexec_page`), and add `q = org_lists.by_org(q, active_org)` (D-32: every non-folder read).

**Upload — one keyword on the existing minter call** (`:615-622`):
```python
    mint_result = await async_mint_document_row(
        raw=raw,
        filename=filename,
        mime_type=mime_type,
        user_id=current_user["id"],
        supabase=supabase,
        folder_id=folder_id,
    )
```
→ add `org_id=await org_lists.root_upload_org(request, current_user, folder_id),` (returns `None` when
`folder_id` is truthy). ⛔ `test_280_minter_sequence.py` pins exactly one minter call here — keep the call
in this file. `test_071_1_threadpool_sweep.py` slices this body for unwrapped sync calls (an awaited helper is safe).

---

### `backend/app/api/library.py` — summary narrowing (route, not firing)

**Analog:** itself. SQL `:176-181` inner select becomes
`WHERE is_latest AND ($1::uuid IS NULL OR org_id = $1)`; route `:288-289`:
```python
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(LIBRARY_SUMMARY_SQL)
```
→ `rows = await conn.fetch(LIBRARY_SUMMARY_SQL, active_org)` with `active_org` resolved first. The
module docstring (`:30-37`) states the invariant this must keep: summary == list "by construction:
both read one SQL home". Fence `test_284_summary_shape.py:113-118` (`"WHERE is_latest" in sql`).

---

### `backend/app/db/workflows.py` — published + drafts feeds (db, FIRING 63/31)

**Analog — keyword-only AND-append** (`:716-721`):
```python
            + "WHERE status = 'published' AND (is_system_global = true OR created_by = $1)"
        )
    params: list = [user_id]
    if project_folder_id is not None:
        params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
        sql += f" AND definition->>'project_folder_id' = ${len(params)}"
```
Add `org_id: UUID | None = None` and, in BOTH branches, `sql += f" AND (wd.is_system_global = true OR wd.org_id = ${len(params)}"`
after `params.append(org_id)`. Drafts (`:1196-1204`, measured today):
```python
        f"SELECT id, slug, version, name, definition, {CONCURRENCY_TOKEN_SQL} AS token, updated_at, "
        ...
        + f"WHERE status = 'draft' AND created_by = $1 "
        f"ORDER BY updated_at DESC, id DESC",
        user_id,
```
→ insert `+ (f"AND wd.org_id = $2 " if org_id is not None else "")` and `*([org_id] if org_id is not None else [])`.
⛔ Fence substrings `"WHERE status = 'draft' AND created_by = $1 "` and the published predicate
(`test_workflows_updated_at.py`, `test_library_run_facts.py`) must survive; the default call must be byte-identical
(`test_library_run_facts.py:1133-1145` runs the shipped SQL live).

---

### `backend/app/api/workflows.py` — list keywords + save refusal (route, FIRING, "split OWED")

**Analog — org from the request, passed as UUID-or-None** (`:1214-1221`):
```python
    _active_org = await resolve_active_org_or_none(request, current_user)
    try:
        row = await create_workflow_definition(
            pool, definition=body, user_id=user_id,
            org_id=UUID(_active_org) if _active_org else None,
        )
```
`list_drafts` (`:1238-1249`) gains `request: Request = None` + `org_id=...` on `list_draft_workflows`;
same for `/published`. Save check in `create_draft` goes after `assert_phase_models_registered(body)` (`:1213`).

**Analog — the coded refusal wire shape (D-36)** (`:1375-1385`):
```python
        if cause == "stale_token":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                # THE CLIENT BRANCHES ON ``code``, NEVER ON THIS PROSE. The message is
                # for a human reading a log; rewording it must never change behaviour.
                detail={
                    "code": "stale_token",
                    "message": "this draft was changed somewhere else since you loaded it",
                    "token": row.get("token"),
                },
            )
```
→ `HTTPException(status_code=422, detail={"code": "folder_in_other_org", "message": sentence})`.
⛔ No new route under `/workflows` (`test_286_workflows_seam_pins.py` pins the route table + OpenAPI).

---

### `backend/app/api/threads.py` — `list_threads` (route, FIRING 283/95)

**Today** (`:279-287`):
```python
    response = (
        supabase.table("threads")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_eval", False)
        .order("updated_at", desc=True)
        .execute()
    )
```
→ wrap the filter chain in `org_lists.by_org(<chain>, await org_lists.active_org(request, current_user))`
before `.order(...)`, plus `request: Request = None`. The comment block `:274-278` ("ADDITIVE narrowing filter
on this G-5 hot file: it only SHRINKS the result set") is the wording precedent for the new comment.
⛔ Do not copy `_authorize_thread_folder`'s `set()`-on-None polarity (`:1203`) — that is an authorizer.

---

### `backend/app/api/workflow_runs.py` — `list_workflow_runs` (route, FIRING, "extraction FIRST")

**Analog — conditional narrowing on `runs_query`** (`:728-737`):
```python
    runs_query = (
        supabase.table("workflow_runs")
        .select("id, thread_id, definition_id, status, created_at, origin_kind, origin_label", count="exact")
        .eq("user_id", current_user["id"])
    )
    if definition_ids is not None:
        runs_query = runs_query.in_("definition_id", definition_ids)
```
→ one more line `runs_query = org_lists.by_org(runs_query, active_org)`. ⛔ Fence
`backend/tests/test_seed190_run_log.py:206-215` asserts the param set exactly; amend it deliberately with the
reason in the test body (lives in `tests/`, not `tests/unit` — run it explicitly). Record the one-touch as an
audited override (296-06 precedent).

---

### Launch doors — preflight / scheduler / inbound (service + route)

**Preflight** (`backend/app/services/workflow_kickoff.py`). One token in the select (`:235`):
```python
            .select("id, definition, status, is_system_global, created_by, skill_snapshots")
```
→ add `org_id`. Place the check after the scope assert (`:300-308`), copying its raise shape:
```python
        try:
            await assert_folder_scopes_subset(
                _kickoff_definition, supabase=supabase, user_id=current_user["id"]
            )
        except ValueError as _scope_err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(_scope_err))
```
but raising 422 with the coded `detail` dict. Skip when `is_system_global`.

**Scheduler** (`backend/app/services/scheduler_service.py:118-132`) — copy this block verbatim in shape:
```python
    sentence = template_refusal(definition)
    if sentence is not None:
        from app.db.schedules import record_schedule_outcome

        logger.warning(
            "schedule %s not launched: workflow %s has a fill step with no template",
            schedule.get("id"),
            workflow_id,
        )
        await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
        raise ScheduledLaunchRefused(sentence)
```
⚠ `row.get("org_id")` at `:134` is always `None` today (`get_definition` does not project it) — the
helper must read the definition org itself (Analog D).

**Inbound** (`backend/app/api/inbound.py:363-368`) — copy:
```python
    sentence = unattended_launch.template_refusal(definition)
    if sentence is not None:
        raise await _refused(
            key, redis=redis, call="start", reason="no_template", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=sentence),
        )
```
→ `reason="foreign_folder"`, plain-string `detail` (D-36). Definition org = `key.org_id` for non-global rows
(`_SCOPE_SQL` already pins it, `:325`).

---

### `backend/app/api/org_moves.py` (route, NEW router module)

**Analog A — new-router module shape** (`backend/app/api/api_keys.py:1-64`): a security-posture docstring
listing every guarantee, `from __future__ import annotations`, `asyncpg` + `APIRouter` imports,
`router = APIRouter(prefix="/api-keys", tags=["api-keys"])`, module-level sentence constants (`_NOT_FOUND`),
a `_uuid()` coercion helper. Mount in `main.py` like `:936`:
```python
app.include_router(api_keys.router)  # Phase 293 D-18 — /api-keys: a member's own API keys (create, list, revoke)
```
and add the new tag to `TAG_GROUPS` in `scripts/build-public-openapi.cjs:102-103`
(`{ name: "Chat & runs", tags: ["threads", "runs", ...] }` shape) — else `[ungrouped-tag]`; then
`python scripts/export-openapi.py` + `node scripts/build-public-openapi.cjs` (`test_276_openapi_snapshot_fresh.py`).

**Analog B — RLS-connection read for the elsewhere counts** (`backend/app/api/library.py:277-299`):
```python
@router.get("/summary", response_model=LibrarySummary)
async def get_library_summary(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> LibrarySummary:
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(LIBRARY_SUMMARY_SQL)
```
Module-level SQL constant + Pydantic response model + a pure fold function (`fold_summary_rows`, `:238-274`)
the unit suite drives without a DB. The library.py module docstring (`:12-19`) is the wording precedent for
"RLS-ENFORCED, NOT SERVICE-ROLE — deliberately". Active org `None` → return `[]`.
⛔ Not in `org.py` (uses the 400-ing `get_active_org_id`, line 39 of api_keys.py shows that import) and not in a
`LIBRARY_MODULES` module (`test_284_route_inventory.py`).

**UUID validation:** `_uuid_or_422` precedent at `documents.py:898` (`folder_id = _uuid_or_422(folder_id, "folder_id")`).

---

### `backend/app/services/org_move.py` (service, pool transaction) — NEW

**Analog A — the transaction** (`backend/app/db/workflows.py:540-541`):
```python
    async with pool.acquire() as con:
        async with con.transaction():
```

**Analog B — subtree collect + hold refusal + audit on the item's own org** (`backend/app/api/folders.py:162-222`):
```python
    # 1. Collect this folder and all descendant folder IDs (BFS)
    all_folder_ids = [folder_id]
    queue = [folder_id]
    while queue:
        parent = queue.pop(0)
        children = await aexec(supabase.table("folders").select("id").eq("parent_id", parent))
        ...
    await hold_guard.assert_none_held(
        request, current_user, doc_ids, kind="folder", folder_ids=all_folder_ids,
        service_supabase=service_supabase,
    )
    with hold_guard.map_hold_refusal(kind="folder"):
        gone_resp = await aexec(supabase.rpc("delete_folder_tree", {"p_folder_id": folder_id}))
    # 6. One audit row, on the folder's OWN org (explicit — never the trigger's guess)
```
For the move, collect the subtree with a recursive CTE inside the transaction (`FOR UPDATE`), keep
`assert_none_held` as the pre-check and wrap the UPDATEs in `map_hold_refusal` (the DB backstop raises PT409 on an
`org_id` change — `hold_guard.py:210-225`).

**Analog C — membership** (`backend/app/db/api_keys.py:207-215`) — SQL to reuse on the transaction's `con`:
```python
    value = await pool.fetchval(
        "SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1", org_id, user_id,
    )
```
Run it for both `src` (from the row) and `dst` (from the body) INSIDE the transaction.

**Analog D — audit row, but INSIDE the transaction (D-35).** `write_audit_entry` (`audit_service.py:68-98`)
swallows every exception (`:97-98`) — ⛔ do not use it for the move. Copy only its column set and the explicit-org
rule (`:79-86`): `INSERT INTO audit_log (user_id, action_type, metadata, org_id) VALUES ($1,$2,$3::jsonb,$4)` on the
transaction's connection, `org_id` = source org, metadata `{kind, item_id, from_org, to_org, counts}`.

**Unique-violation mapping:** `workflows.py:1222-1229` (`except asyncpg.exceptions.UniqueViolationError:` → honest
409, never a 500) — reuse for the target-org hash collision.

---

### `supabase/migrations/217_org_move.sql` (migration) — NEW

**Analog:** `supabase/migrations/215_api_keys_and_run_origin.sql:172-193` (the CHECK replacement):
```sql
-- ── 5. audit_log action types (D-16) — every live literal kept (read from the live CHECK) ──
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    ...
    -- Phase 293 (D-16) — API keys
    'api_key.create', 'api_key.revoke', 'api_key.start', 'api_key.read', 'api_key.refused'
  ]::text[]));
```
Read the live CHECK first (`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname =
'audit_log_action_type_check'`), keep every literal, append the new one under a `-- Phase 298` comment.
D-31 descopes published moves → **no trigger amendment** in 217. If any function is added after all, copy the grant
block `:165-170` (`REVOKE ... FROM PUBLIC;` first, then anon, authenticated, `GRANT ... TO service_role`) and mirror it
in `scripts/full-schema-supplement.sql`. Apply via local SQL editor, then `bash scripts/regenerate-full-schema.sh`
(no `--reset`).

**Lockstep partner** (`backend/app/services/audit_service.py:35-36`):
```python
    # Phase 293 (D-16 / lockstep with migration 215 CHECK) — API keys:
    "api_key.create", "api_key.revoke", "api_key.start", "api_key.read", "api_key.refused",
```
→ add `# Phase 298 (D-20 / lockstep with migration 217 CHECK)` + the literal. ⚠ `assert_action_types_synced`
(`:40-65`) hard-fails boot when the frozenset holds a type the live CHECK lacks — paste 217 before running the backend.

---

### Backend tests

**Live two-org fixture** — copy `backend/tests/integration/test_296_two_org_create.py:45-110`:
```python
pytestmark = requires_pg
TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"

def _request(org: UUID | None):
    headers = {"X-Org-Id": str(org)} if org else {}
    return SimpleNamespace(headers=headers, state=SimpleNamespace())

@pytest.fixture
async def two_org_subject(pg_pool):
    """U in orgs A (the trigger's LIMIT-1 pick) and B."""
    require_gotrue()
    ...  # insert auth.users, second org, membership; DERIVE org_a by the trigger's own query
    yield {"uid": uid, "org_a": org_a, "org_b": org_b, "personal": personal["org_id"]}
    finally: ...  # delete folders / workflow_definitions / audit_log by user, then _drop_user
```
Its docstring's NON-VACUITY rule (trigger org ≠ active org, asserted first) and the no-header control apply to
every 298 live test. Handlers are called directly with `_request(org)`.

**Anon / RLS** — `tests/integration/test_275_policy_rls.py:129-139` (`has_table_privilege('anon', ...) is False`);
for routes, the 401 shape at `tests/unit/test_276_api_docs_gate.py:91-98` (`resp.status_code == 401`).

**Migration shape** — `tests/unit/test_296_migration_shape.py:27-57`: `_migration(prefix)` glob-exactly-one,
`_strip_comments`, `_norm`; assertions run over comment-stripped text so prose cannot satisfy them.

**Audit drift** — `tests/integration/test_110_audit_drift_guard.py` re-runs `assert_action_types_synced` live.

---

## Pattern Assignments — Frontend

### `frontend/src/hooks/useActiveOrgId.ts` (hook) — NEW

**Analog:** `frontend/src/providers/OrgProvider.tsx:211-217`:
```tsx
/**
 * Non-throwing accessor — returns null outside a provider. Used by leaf reads (StreamsProvider's
 * teardown bridge, tests, storybook) so a component can still render where no provider is mounted.
 */
export function useOrgOptional(): OrgValue | null {
  return useContext(OrgContext)
}
```
→ `export function useActiveOrgId(): string | null { return useOrgOptional()?.activeOrgId ?? null }`.

**The "sent under" tag source** — `frontend/src/lib/api/_core.ts:177-180`:
```ts
export function getActiveOrgId(): string | null {
  return _activeOrgId
}
```
Read it at request time (the header value), never the React state.

---

### `frontend/src/providers/OrgProvider.tsx` — self-heal header sync (D-36)

**Analog:** same file, `switchOrg` (`:173-180`):
```tsx
  const switchOrg = useCallback((newOrgId: string) => {
    // D-166-08: set the `X-Org-Id` header SYNCHRONOUSLY — before any effect keyed on the
    // active org runs ...
    syncActiveOrgHeader(newOrgId)
    setActiveOrgIdState(newOrgId)
  }, [])
```
Apply the same two-line order inside the WR-01 self-heal (`:126-130`, today `setActiveOrgIdState(resolvedOrgId)` alone).
OrgProvider has no ledger row — add one.

---

### List hooks — org-tagged state (`useFolders.ts`, `useThreads.ts`, `RunLogPanel.tsx`)

**Analog — the latest-wins generation guard** (`frontend/src/components/workflows/history/RunLogPanel.tsx:100-139`):
```tsx
  const generation = useRef(0)

  const load = useCallback(
    async (offset: number) => {
      const mine = ++generation.current
      if (offset === 0) {
        setLoading(true)
        setFailure(null)
      } ...
      try {
        const page = await listWorkflowRuns({ ...(scope ? { slug: scope.slug } : {}), limit: PAGE_SIZE, offset })
        if (generation.current !== mine) return
        setRows((prev) => (offset === 0 ? page.runs : [...prev, ...page.runs]))
        setTotal(page.total)
      } catch (err) {
        if (generation.current !== mine) return
        // ⚠ A FAILURE IS NEVER RENDERED AS AN EMPTY LOG.
        ...
      } finally {
        if (generation.current === mine) { setLoading(false); setLoadingMore(false) }
      }
    },
    [scope],
  )
  useEffect(() => { void load(0) }, [load])
```
RunLogPanel: add `activeOrgId` to the deps and clear `rows` at `offset === 0` so the loading state shows.

**Target shape for `useFolders` / `useThreads`** (research §Code Examples, accepted pattern):
```ts
const activeOrgId = useActiveOrgId()
const [state, setState] = useState<{ org: string | null; rows: Row[] } | null>(null)
const load = useCallback(async () => {
  const sentUnder = getActiveOrgId()
  const rows = await listX()
  setState({ org: sentUnder, rows })
}, [])
useEffect(() => { void load() }, [load, activeOrgId])
const rows = state && state.org === activeOrgId ? state.rows : NO_ROWS
const loading = !state || state.org !== activeOrgId
```
- `useFolders.ts` today: `useState<Folder[]>([])` (`:21`), no loading flag; `loadFolders` (`:24-27`) has no guard;
  Realtime handler (`:52-66`) merges INSERT/UPDATE unconditionally. Every `setFolders((prev) => ...)` writer
  (`:55, :60, :64, :86, :98, :104, :109`) must write through the tagged setter. Realtime: read active org via a ref;
  INSERT with foreign `org_id` → ignore; UPDATE with foreign `org_id` → remove (how a moved folder leaves other tabs).
- `useThreads.ts` today (`:25-37`): `loading` is `useState(false)` and `setThreads(data)` keeps old rows until the
  answer. ⛔ `selectThread` (`:39-41`) stays a bare `setSelectedThread(thread)` (`ChatHistoryColumn.clickPath.test.tsx:107-113`).
  `ChatLayout.tsx:190-199` already refetches on `activeOrgId` with a `lastOrgRef` mount-skip — do not duplicate it.

### `frontend/src/hooks/useLibraryDocuments.ts` — fold org into the source identity

**Analog:** same file `:228-291`. The page is keyed on the serialised source and the "cold" derivation does the rest:
```ts
  const sourceKey = JSON.stringify(source)
  ...
  const onScreen = settled !== null && settled.answeredKey === sourceKey
  ...
  const rows = onScreen ? settled.rows : NO_ROWS
```
→ `JSON.stringify({ source, org: activeOrgId })` (a switch is a cold source switch; `reqIdRef` drops the late answer).
Summary effect (`:276-291`, deps `[summaryTick]`): add `activeOrgId` and hold `{org, summary}`; derive `null` while
mismatched (never 0). ⚠ `summaryKnownRef` (`:282`) means "a background refetch that fails keeps the last answer" — on
an org change the last answer is the wrong org's; reset it.

---

### `frontend/src/lib/elsewhereCounts.ts` (store) — NEW

**Analog:** `frontend/src/stores/citationCheckStore.ts` (whole file). Copy:
- zustand `create<State>()((set) => ...)` (`:80`),
- the lazy client import to keep setupTests' module cache clean (`:14-20`, `:50` `const loadClient = () => import(...)`),
- the module `generation` counter so a request in flight across a reset/switch cannot write (`:56-57`, `:86`, `:100`),
- the stable-null selector rule (`:22-23`, `:155-157`),
- `reset…()` exported and registered in `setupTests.ts` (`:159-166`).
Key the cached answer by `activeOrgId`, dedupe in-flight per org (four mounts → one GET, D-16), and invalidate after a move.

### `frontend/src/lib/api/orgMoves.ts` (api client) — NEW

**Analog:** `frontend/src/lib/api/org.ts:13-48`:
```ts
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
export async function getOrgMembers(page = 1, pageSize = 50): Promise<OrgMembersPage> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ page: String(Math.max(1, page)), page_size: String(pageSize) })
  const res = await fetch(`${API_BASE}/org/members?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org members.", res.status)
  const body = (await res.json()) as Partial<OrgMembersPage>
  return { members: body.members ?? [], ... }
```
`getAuthHeaders()` already carries `X-Org-Id` (`_core.ts:286-291`). For move refusals, throw `ApiRefusal`
(`frontend/src/lib/api/refusal.ts:19-30`, `refusalOf(res, fallback)` `:36+`) — it extends `Error`, not `ApiError`, on
purpose (comment `:9-13`). ⚠ Barrel rule: `lib/api.ts` re-export discipline (`apiBarrel.test.ts`) — decide
re-export vs direct import deliberately.

---

### `frontend/src/lib/api/documents.ts` — `uploadDocument` header (D-29)

**Today** (`:164-172`):
```ts
export async function uploadDocument(file: File, folderId?: string | null): Promise<{ doc: Document; isDuplicate: boolean }> {
  const token = await getAuthToken()
  ...
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
```
**Analog** (`_core.ts:286-291`): `const orgId = getActiveOrgId()` … `...(orgId ? { "X-Org-Id": orgId } : {})`.
Keep "no Content-Type" (multipart boundary). Only this one call site is in scope.

---

### Refusal surfacing (D-36) — `threads.ts`, `workflows.ts`, `useStartWorkflowInThread.ts`

- `lib/api/threads.ts:805-811` `postMessage` picks `body.detail` only when it is a string — extend to
  `detail.message` when `detail` is an object with a string `message` (RunModal renders `e.message` verbatim).
- `lib/api/workflows.ts:528-545` — the code-branch analog to copy for the 422 arm:
  ```ts
    const body = (await res.json().catch(() => ({}))) as { detail?: { code?: string; token?: string } }
    const code = body.detail?.code
    if (code === "stale_token") throw new WorkflowStaleTokenError(body.detail?.token ?? null)
    ...
  if (res.status === 422) {
    const rawBody = await res.json().catch(() => null)
    throw new WorkflowDraftUnreadableError(rawBody)
  }
  ```
  → in the 422 arm, `if (detail?.code === "folder_in_other_org") throw new WorkflowFolderRefusedError(detail.message)`
  before the unreadable fallback; same in `createWorkflowDraft` (`:448-451`, today a generic `Error`).
- `components/chat/useStartWorkflowInThread.ts:20-25`:
  ```ts
  function failureFor(err: unknown, name: string): StartFailure {
    const status = statusOf(err)
    if (status === 409) return { kind: "locked", message: COPY.shared.startLocked(name) }
    if (status === 422) return { kind: "inputs", message: COPY.shared.startInputsRefused(name) }
    return { kind: "failed", message: COPY.shared.startFailed(name) }
  }
  ```
  → add a `kind: "folder"` branch before the 422 line that shows the server message (its docstring says "never server
  text" — record the exception and why in the comment).

### D-15 pickers — `WorkflowBuilderPage.tsx`, `useBuilderNameMaps.ts`, `DescribeKbPicker.tsx`

- `pages/WorkflowBuilderPage.tsx:2400-2402` (one expression):
  ```tsx
        {boundFolderId !== "" && !folderOptions.some((f) => f.id === boundFolderId) && (
          <option value={boundFolderId}>{UNNAMED_KB_OPTION}</option>
        )}
  ```
  → label from the folder-labels lookup (name + "lives in <org>"), `UNNAMED_KB_OPTION` as fallback.
- `components/workflows/DescribeKbPicker.tsx:223-228` — the CR-R5-01 drop to change:
  ```tsx
  useEffect(() => {
    if (state === "loading") return
    if (value === "") return
    if (options.some((f) => f.id === value)) return
    onChange("")
  }, [state, options, value, onChange])
  ```
  → "not offered → look up a label; drop only when the lookup says the caller cannot see it". Its mount fetch
  (`:174-201`, `cancelled` idiom) is the pattern for the lookup. ⛔ `DescribeKbPicker.test.tsx:795` allows exactly one
  `@/lib/api` import line; ⛔ `WorkflowBuilderPage.canvas.test.tsx:2375-2383` counts `listFolders(` — the lookup client
  must have a different name.

### Page extractions (move-only, G-5) — `LibraryPage.tsx`, `WorkflowsPage.tsx`

- `LibraryPage.tsx:397-400` and `:498-511` — the two `[]` effects that move into `useLibraryOrgSwitch` (and gain
  `activeOrgId` deps; the second is SEED-317):
  ```tsx
  useEffect(() => {
    listMetadataFields().then(setCustomFields).catch(() => setCustomFields([]))
    listViews().then(setViews).catch(() => setViews([]))
  }, [])
  ...
  useEffect(() => {
    let mounted = true
    listExpertInstalls()
      .then((rows) => { if (mounted) setFolderProvenance(provenanceByFolder(rows)) })
      .catch(() => { if (mounted) setFolderProvenance({}) })
    return () => { mounted = false }
  }, [])
  ```
  plus `dispatch({ type: "SELECT_FOLDER", folderId: null })` (existing action, `librarySelection.ts:163`) on org change.
  Fences: `LibraryPage.cloudImport.test.tsx:404/412`, `LibraryPage.tabAttention.test.tsx:447`.
- `WorkflowsPage.tsx:413-479` — `refetchPublished` / `refetchStarters` / `refetchDrafts`, each with its own
  `++seqRef.current` latest-wins ticket and `markSource(...)`; the `Promise.allSettled` effect and its long comment
  (`:481-504`) move with them, unchanged. ⛔ `WorkflowsPage.test.tsx` pins `Promise.allSettled` as SOURCE — keep the
  literal in whichever file the test reads (amend the fence's path deliberately if it moves);
  `WorkflowsPage.leaveGuard.test.tsx` pins one `useLeaveGuard(`, three `approveNextLeave()`, one `clearLeaveApproval()`
  — those stay in the page.

### `frontend/src/components/org/MoveToOrgDialog.tsx` (victim-naming confirm) — NEW

**Analog:** `frontend/src/components/retention/ReleaseHoldDialog.tsx` (copy the whole structure):
- imports `:12-27` (`AlertDialog*` from `@/components/ui/alert-dialog`, `ApiRefusal` from `@/lib/api/refusal`, a copy module);
- state `busy` / `failed` / `refused` (`:44-47`);
- the victim list capped at `MAX_NAMES = 8` with an "and N more" row (`:30`, `:49-56`, `:106-113`);
- unknown count said in words, never a substituted 0 (`:57-60`, `:103`);
- the 4xx-renders-the-server-sentence branch (`:75-80`: `if (err instanceof ApiRefusal && err.status >= 400 && err.status < 500) setRefused(err.message)`);
- `AlertDialogCancel` focused by default, consequential button outline + amber not red (`:4-7`, `:119-133`);
- a failure keeps the sheet open; after a refusal only Close remains.

### `MoveToOrgMenuItem` + `FolderNode.tsx` / `WorkflowCardMenu.tsx` (leaf menu item)

**Analog:** `frontend/src/components/ingestion/FolderNode.tsx:207-217`:
```tsx
                {isOwner && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleOrgShared(node.id)
                    }}
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    {node.is_org_shared ? "Make private" : "Share with org"}
                  </DropdownMenuItem>
                )}
```
One mount (`isOwner && orgs.length >= 2 && <MoveToOrgMenuItem … />`) before the `DropdownMenuSeparator` (`:218`).
The org list comes from `useOrgOptional()?.orgs` (render only at 2+ orgs, OrgProvider `:46-47`).

### `ChatHistoryColumn.tsx` + `ChatLayout.tsx` (D-11)

`ChatHistoryColumn.tsx:459-462` renders "No recent chats" when `filtered.length === 0` and takes no loading prop;
ChatLayout destructures `loading: _loading` (`:136`) and drops it. One prop on `<ChatHistoryColumn>` (`:623`) and one
loading branch in the column. ⚠ `useThreads.loading` starts `false`, so first paint stays as today (BUG-261027-02 untouched).

---

## Shared Patterns

### Polarity rule (every narrowed route)
**Source:** `backend/app/services/harness/scope.py:127-137`, `dependencies.py:1020-1069`
**Apply to:** folders, documents, library summary, workflows published/drafts, threads, workflow-runs
`None` org → the call is byte-identical to today (no kwarg forwarded, no predicate added). ⛔ Never `set()`, never
`restrict_org_ids=None`, never `get_active_org_id`.

### `request: Request = None` on a route
**Source:** `backend/app/api/folders.py:53`, `workflows.py:1196`
**Apply to:** every route that newly reads the header. `# FastAPI injects it; direct callers may omit it (no header -> None)`.
It is not a query/body/header param, so OpenAPI and `test_286` route tables are unchanged.

### Refusal = sentence-or-None helper, presented per door
**Source:** `unattended_launch.template_refusal` (`:103-113`) + its three callers (`workflow_kickoff.py:275-287`,
`scheduler_service.py:118-132`, `inbound.py:363-368`)
**Apply to:** ORG-05 at save (create/update draft), preflight, scheduler, inbound.

### Coded refusal on the wire, client branches on `code`
**Source:** `backend/app/api/workflows.py:1375-1385` + `frontend/src/lib/api/workflows.ts:528-539`
**Apply to:** attended preflight + both save routes (`folder_in_other_org`); scheduler and inbound keep plain strings.

### Latest-wins / org-tagged answers
**Source:** `RunLogPanel.tsx:100-139` (generation ref), `useLibraryDocuments.ts:230-257` (keyed source + `onScreen`),
`WorkflowsPage.tsx:418-441` (seq ref per feed), `citationCheckStore.ts:56-57` (module generation)
**Apply to:** every list hook in D-08 and the elsewhere-count store. Rows from another org are never painted; loading
is never "0" / "No …".

### Audit lockstep (code + CHECK + boot guard)
**Source:** `audit_service.py:13-65`, mig `215:172-193`, `tests/integration/test_110_audit_drift_guard.py`
**Apply to:** the move action type. Explicit `org_id` on the audit row (`audit_service.py:79-86` rationale); for the
move, the INSERT runs on the transaction connection (not `write_audit_entry`, which swallows).

### Function grants (if 217 adds any function)
**Source:** mig `215:165-170` — `REVOKE EXECUTE … FROM PUBLIC;` then anon, authenticated; `GRANT … TO service_role`;
mirror in `scripts/full-schema-supplement.sql`.

### Two-org live test fixture
**Source:** `backend/tests/integration/test_296_two_org_create.py:45-110` (derive the trigger org, assert
non-vacuity first, no-header control, `finally` cleanup, `-rs`).

### Victim-naming confirm
**Source:** `frontend/src/components/retention/ReleaseHoldDialog.tsx` — apply to the move confirm.

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `backend/app/services/org_move.py` (the cross-table `UPDATE org_id` cascade itself) | service | batch write | No existing code re-stamps `org_id` across folders + documents + chunk/image/table/extraction/job rows in one transaction. Compose from the three analogs above (pool txn, folder-delete subtree + hold guard, membership SQL) and follow RESEARCH.md §"Folder subtree — rows and dispositions" for the table list and refusal set. |

## Metadata

**Analog search scope:** `backend/app/{api,services,services/harness,services/retention,db}`, `backend/tests/{unit,integration}`,
`supabase/migrations`, `frontend/src/{hooks,providers,stores,lib/api,components/{org,retention,ingestion,workflows,chat,layout}},pages}`, `scripts/`
**Files scanned:** ~45 (targeted reads; no file re-read)
**Pattern extraction date:** 2026-10-28
