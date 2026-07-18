# Phase 152: Workflow Run Inputs - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 10 modified + 4 net-new test files
**Analogs found:** 10 / 10 (every net-new/modified file has a concrete in-repo analog)

> This phase is ~85% assembly of shipped seams (per RESEARCH). Where CONTEXT and
> RESEARCH disagree, **RESEARCH wins**: `project_folder_id` is ALREADY the
> retrieval default (no migration), template discovery is by `kind` on the thread
> (not `inputs`), and the `⋯`-menu on `PublishedCard` is genuinely net-new UI.
> Every excerpt below is copied from a file read this session with line numbers.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/message.py` (MOD) | model | request-response | in-file `workflow_definition_id` optional field | exact |
| `backend/app/api/threads.py` (MOD — WFIN-02) | route/controller | request-response | in-file kickoff scope block `:1537` + `assert_folder_scopes_subset` call `:1129` | exact |
| `backend/app/services/harness/scope.py` (MOD — optional helper) | service | transform | in-file `resolve_project_subtree` / `assert_folder_scopes_subset` | exact |
| `backend/app/services/harness_engine.py` (MOD — resume override) | service | event-driven | in-file resume scope read `:1515` | role-match |
| `backend/app/api/runs.py` (MOD — Continue override) | route | request-response | in-file Continue scope read `:918` | role-match |
| `backend/app/api/workflows.py` (NEW cascade endpoint — WFIN-03) | route/controller | CRUD (delete) | in-file `delete_draft` `:372` + `admin.py` `kill_run` cancel-first `:410` | role-match (compose two) |
| `backend/app/db/workflows.py` (NEW cascade + preview helpers — WFIN-03) | db/repository | CRUD (delete) | in-file `create_workflow_run` txn `:126` + `delete_workflow_definition` `:404` | role-match |
| `frontend/src/pages/WorkflowsPage.tsx` (MOD — 3 surfaces) | component/page | request-response | `ChatArea.tsx:407` select · `TemplateUpload.tsx` · `FolderNode.tsx:138` ⋯-menu · `ActiveRunsSection.tsx:285` sheet | exact (per surface) |
| `frontend/src/components/layout/ChatLayout.tsx` (MOD — `doRun`) | component | request-response | in-file `doRun` `:114` | exact |
| `frontend/src/lib/api.ts` (MOD — cascade + preview client) | utility/client | request-response | in-file `deleteWorkflowDraft` `:3231` · `uploadWorkspaceTemplate` `:1377` · `postMessage` `:530` | exact |
| `backend/tests/test_152_*.py` (NEW ×4) | test | — | `test_098_scope_governance.py:154`, `test_workspace_template.py` | role-match |

**WFIN-01 backend has NO net-new file** — `upload_template` (`workspace.py:222`), `validate_upload` (`:176`), `pin_templates_for_run`, and `resolve_template_source` Branch 2 are reused **verbatim** (D-02). The only WFIN-01 code lands in the frontend (sequencing) + optional `inputs.template_input` echo.

---

## Pattern Assignments

### `backend/app/models/message.py` (model, request-response) — WFIN-01/02

**Analog:** in-file `MessageCreate` (same file, `:8`)

The launch input arrives on `MessageCreate`. Add optional fields the same way `workflow_definition_id` was added (nullable, default `None`, so every existing Deep send stays byte-identical — D-06). Existing shape (`:8-18`):
```python
class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    provider: str | None = None
    agent_mode: str = "default"
    # Phase 092 D-02 (MODE-01): when set, THIS message kicks off the named workflow
    workflow_definition_id: UUID | None = None
```
**New field(s) to add (Claude's discretion on names — CONTEXT D-01):** `folder_id: UUID | None = None` (WFIN-02 per-run override) and optionally `run_inputs: dict | None = None` or a template handle field (WFIN-01 echo). A malformed UUID → FastAPI 422 for free (V5). Keep them nullable — the absence path IS D-06.

---

### `backend/app/api/threads.py` (route, request-response) — WFIN-02 override read + D-05 gate

**Analog:** the kickoff scope block in the SAME file, `:1537` (author-default read) + the `assert_folder_scopes_subset` call site `:1129` (owner-scoped resolve at kickoff).

**Where the override is persisted** — `create_workflow_run` call `:1343`, today:
```python
_active_workflow_run_id = await create_workflow_run(
    await get_pg_pool(),
    thread_id=...,
    definition_id=...,
    definition=_kickoff_definition,
    inputs={"kickoff_prompt": body.content},   # ← ADD folder override here (D-01)
    model=_resolved_model,
    user_id=UUID(current_user["id"]) ...,
)
```
Add the override to the `inputs` dict: `inputs={"kickoff_prompt": body.content, "folder_id": str(body.folder_id)}` (only when present). It persists to `workflow_runs.inputs` jsonb — **no migration**.

**Where the scope root is resolved** — the kickoff scope block `:1536-1553`, today (author default → thread fallback):
```python
try:
    if _kickoff_definition.project_folder_id is not None:
        _wf_scope_root = str(_kickoff_definition.project_folder_id)   # author default (EXISTING)
    else:
        _wf_thread_data = await aexec(
            supabase.table("threads").select("folder_id").eq("id", thread_id).single()
        )
        _wf_scope_root = _wf_thread_data.data.get("folder_id") if _wf_thread_data.data else None
    if _wf_scope_root:
        _wf_folder_subtree_ids = await resolve_project_subtree(
            _wf_scope_root, supabase=supabase, user_id=current_user["id"]
        )
```
**Change (RESEARCH §WFIN-02, precedence `override ?? author-default ?? thread`):** layer the owner-gated `inputs.folder_id` override on TOP. **G-5: `threads.py` must shrink, not grow** — extract this into a helper in `scope.py` (see next section) rather than adding inline branches. RESEARCH's proposed shape:
```python
# override > author default > thread folder  (WFIN-02)
_override = (run_inputs or {}).get("folder_id")
if _override is not None:                                       # D-05 owner gate (NET-NEW)
    _visible = {f["id"] for f in await fetch_visible_folders(supabase, current_user["id"])}
    if str(_override) not in _visible:
        _override = None    # never-owned / unreachable → no narrowing (refuse the override)
_wf_scope_root = (
    str(_override) if _override is not None
    else str(_kickoff_definition.project_folder_id) if _kickoff_definition.project_folder_id is not None
    else _thread_folder_id
)
```

**Owner-gate analog** — the existing `fetch_visible_folders` import is already present in this file (`:53`), and `assert_folder_scopes_subset` is already called at kickoff `:1128-1131`:
```python
await assert_folder_scopes_subset(
    _kickoff_definition, supabase=supabase, user_id=current_user["id"]
)
```
The D-05 gate sits at this SAME route/resolver boundary (owner known via `current_user["id"]`).

**The consumption echo** — `wf_ctx.inputs` at `:1634` is `{"kickoff_prompt": body.content}`; RESEARCH notes it must mirror EXACTLY what was persisted (so live ctx == durable inputs the resume builders read back). If `folder_id` goes into persisted `inputs`, mirror it here too.

**Composition landmine (A4):** if the definition declares per-phase `folder_scope`, the override must be ⊆ `project_folder_id` or the intersection at `phase_types.py:326` silently empties. Planner picks the rule; the UI must not offer out-of-project options for scoped workflows.

---

### `backend/app/services/harness/scope.py` (service, transform) — new `resolve_run_scope_root()` helper (G-5 shrink-not-grow)

**Analog:** the two functions ALREADY in this file — `resolve_project_subtree` (`:51`) and `assert_folder_scopes_subset` (`:92`). A new helper mirrors their signature (async, `*`-kwargs, `supabase` + `user_id`, owner-scoped, returns a `list`/`str` never a `set` — Pitfall 6/T-098-11).

**Owner-gate excerpt to reuse** — `resolve_project_subtree` `:68-89` shows the exact owner-scoped fetch + cycle-guarded walk:
```python
if project_folder_id is None:
    return None  # unbound workflow → whole-KB (unchanged behavior)
root = str(project_folder_id)
folders = await fetch_visible_folders(supabase, user_id)  # owner-scoped fetch
def _walk(rid, seen=None):
    seen = seen if seen is not None else set()
    if rid in seen: return []
    seen.add(rid); out = [rid]
    for f in folders:
        if f["parent_id"] == rid: out.extend(_walk(f["id"], seen))
    return out
return _walk(root)  # list[str] — NEVER a set
```
**Key gap RESEARCH flags (Pitfall 4 / Landmine 3):** `resolve_project_subtree` does NOT validate the root is owner-reachable — `_walk(root)` returns `[root]` even for a non-owned root. So the new `resolve_run_scope_root` (or the threads.py gate) MUST add the explicit `str(override) in {f["id"] for f in fetch_visible_folders(...)}` check. The module header already documents the owner-scoped threat posture (T-098-02) — follow it.

---

### `backend/app/services/harness_engine.py` (service, event-driven) + `backend/app/api/runs.py` (route) — override persistence on resume/Continue

**Analog:** their EXISTING `project_folder_id` reads (`harness_engine.py:1515` `_resume_folder_subtree_ids`, `runs.py:918` `_cont_subtree`), which mirror the kickoff block above.

**Pitfall 5 (RESEARCH):** resume + Continue re-derive scope from `definition.project_folder_id` ONLY — they do NOT read `inputs.folder_id`, so a stranded/Continued run silently reverts to the author default. Fix: read the durable override from `run.inputs` at both sites (resume already loads `run.inputs` at `harness_engine.py:1571`). If the planner scopes only kickoff, document the revert-on-resume limitation explicitly (Open Question 4).

---

### `backend/app/api/workflows.py` (route, CRUD-delete) — WFIN-03 net-new cascade endpoint (D-08 red line)

**Analog A — the endpoint shape:** in-file `delete_draft` `:372-401`:
```python
@router.delete(
    "/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def delete_draft(definition_id: UUID, current_user: dict = Depends(get_current_user)):
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    try:
        deleted = await delete_workflow_definition(pool, definition_id, user_id=user_id)
    except asyncpg.exceptions.CheckViolationError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="workflow is published and cannot be modified")
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")
    return None
```
**Do NOT overload this route** (Pitfall 7 / RESEARCH Landmine 6 — client `deleteWorkflowDraft` already calls `DELETE /workflows/{id}`). Add a **DISTINCT** route: `DELETE /workflows/{id}/cascade` or `POST /workflows/{id}/delete`. Carry `Depends(require_visible("workflow_authoring"))` (A2 recommendation). Owner gate is the app-layer WHERE (service role → **no RLS backstop**, Landmine 10). Non-owner → 404, no existence leak (the `get_definition` 404-collapse precedent, `db/workflows.py:271`).

**Analog B — cancel-first (D-LOCK-05):** `admin.py` `kill_run` `:479-487` delegates to the shared zombie-heal discipline:
```python
from app.services.run_lifecycle import _cancel_run_internals
outcome = await _cancel_run_internals(
    run_id=run_id,
    status=row["status"],
    thread_id=str(row["thread_id"]) if row["thread_id"] else None,
    redis=get_redis(),
    supabase=supabase,
)
```
`_cancel_run_internals` (`run_lifecycle.py:158`, signature `*, run_id, status, thread_id, redis, supabase`) returns `"terminal_noop" | "task_cancelled" | "zombie_healed"`, atomically co-writes the terminal state, clears `threads.active_workflow_run_id`, and EXPIREs the Redis buffer. Loop it over every in-flight run (`status active/paused/cap_paused`) BEFORE the DB delete. This cancel step lives in the SERVICE/route layer, NOT inside the db-helper txn (RESEARCH Code Example note).

**The victim-naming counts:** the sheet needs exact Removed/Kept counts before commit. Add a preview read — a `GET /workflows/{id}/delete-preview` (or dry-run) returning `{versions, runs, threads}`. Query shape: `COUNT(*)` on `workflow_runs WHERE definition_id = ANY($versions)` + `COUNT(DISTINCT thread_id)` for kept threads (A6 — endpoint shape is discretion).

---

### `backend/app/db/workflows.py` (db/repository, CRUD-delete) — WFIN-03 cascade + preview helpers

**Analog A — the atomic transaction shape:** in-file `create_workflow_run` `:126-156` is the canonical `acquire() → transaction()` FK-ordered multi-write:
```python
async with pool.acquire() as con:
    async with con.transaction():
        run_id = await con.fetchval("INSERT INTO workflow_runs (...) VALUES ($1,$2,'active',$3::jsonb,...) RETURNING id", ...)
        for ps in sorted(definition.phases, key=lambda p: p.phase_index):
            await con.execute("INSERT INTO workflow_phases (...) VALUES ($1,$2,$3,'pending')", run_id, ps.phase_index, ps.slug)
        await con.execute("UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1", thread_id, run_id)
```

**Analog B — the owner-scoped `$N`-only delete:** in-file `delete_workflow_definition` `:404-427` (owner WHERE + RETURNING → bool):
```python
row = await pool.fetchrow(
    "DELETE FROM workflow_definitions WHERE id = $1 AND created_by = $2 AND status = 'draft' RETURNING id",
    definition_id, user_id,
)
return row is not None
```

**New helper (RESEARCH Code Example — FK-safe order, one txn):**
```python
async def delete_published_workflow_cascade(pool, *, slug: str, user_id: UUID) -> dict:
    async with pool.acquire() as con:
        async with con.transaction():
            version_ids = [r["id"] for r in await con.fetch(
                "SELECT id FROM workflow_definitions WHERE slug=$1 AND created_by=$2", slug, user_id)]
            if not version_ids:
                return {"deleted": False}   # → route maps to 404 (no existence leak)
            # cancel in-flight runs happens in the SERVICE layer BEFORE this txn (D-LOCK-05)
            await con.execute("DELETE FROM workflow_runs WHERE definition_id = ANY($1::uuid[])", version_ids)
            await con.execute("DELETE FROM workflow_definitions WHERE id = ANY($1::uuid[])", version_ids)
    return {"deleted": True, "versions": len(version_ids)}
```
**FK-safe order (verified, RESEARCH):** runs FIRST (`workflow_runs.definition_id` is `ON DELETE RESTRICT`, `full-schema.sql:3203` — the blocker) → deleting runs auto-cascades `workflow_phases` (`ON DELETE CASCADE :3195`) and auto-detaches threads (`threads.active_workflow_run_id ON DELETE SET NULL :3131` — "threads become normal chats" is partly free, D-LOCK-04) → then definition versions. The immutability trigger is `BEFORE UPDATE` only — it does NOT block DELETE (`:2598`), so **no trigger amendment, no migration**. Ignore the misleading `db/workflows.py:414` comment. Two open decisions to close: all-versions-by-slug vs single-version (A1), and `harness_audit` disposition (A3 — recommend KEEP as append-only; it has no FK on `run_id`).

**Detach belt-and-braces (`run_lifecycle.py:253` mechanic):** the SET NULL FK does the detach automatically; the exact `.update({"active_workflow_run_id": None})` pattern (used in the zombie-heal anchor clear) is available if an explicit clear is wanted before the delete.

---

### `frontend/src/pages/WorkflowsPage.tsx` (component, request-response) — 3 surfaces

**Surface 1 — RunModal scope `<select>` (WFIN-02, D-LOCK-01).**
**Analog:** `ChatArea.tsx:405-421` (the shipped chat scope selector — byte-match its "All documents / {folder}" vocab):
```tsx
{folders.length > 0 && (
  <div className="mt-3">
    <select
      value={scopeFolderId ?? ""}
      onChange={(e) => setScopeFolderId(e.target.value || null)}
      className="text-sm rounded-lg px-4 py-2 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
    >
      <option value="">All documents</option>
      {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
    </select>
  </div>
)}
```
Replace the **read-only** `run-folder-chip` currently at `WorkflowsPage.tsx:794-800`:
```tsx
<div data-testid="run-folder-chip" className="flex items-center gap-2 text-[12px] text-muted-foreground">
  <span className="font-medium text-foreground">Knowledge base:</span>
  <span className="rounded-md border border-border bg-muted px-2 py-1">📁 {folderName ?? "Bound to the workflow"}</span>
</div>
```
Option order (UI-SPEC §1): `All documents` (`""`) → `📁 {authorDefault} — workflow default` → other owner-reachable folders. Keep the "workflow default" tag on the author `project_folder_id` option. Use a NATIVE `<select>` (not the shadcn `Select` popover) to match ChatArea. The modal already includes `select` in its focus-trap `querySelectorAll` (`WorkflowsPage.tsx:761`) so the a11y contract survives.

**Surface 2 — RunModal template button + provenance note (WFIN-01, D-LOCK-02).**
**Analog:** `TemplateUpload.tsx` (whole file, esp. `:61-79`) — copy the quiet button shape verbatim:
```tsx
<button type="button" disabled={!threadId || uploading} onClick={() => fileInputRef.current?.click()}
  className={cn("flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5",
    "text-[12px] font-medium text-foreground/80 transition-colors",
    "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50")}>
  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
  {uploading ? "Uploading…" : "Upload template"}
</button>
{uploadError && (<p role="alert" className="px-0.5 text-[11px] text-destructive">{uploadError}</p>)}
```
The 422 error renders the server message **verbatim** (`e instanceof Error ? e.message : …`). Difference from the analog: `TemplateUpload` uses `useViewingThread()` (a live thread already exists); the Run modal has NO thread until launch — so the upload must be sequenced in `doRun` (createThread → upload → send), NOT fired on button-click. The button here just stages the `File` in modal state; `doRun` uploads it. Add the 12px muted provenance note below (copy: `Stored untrusted — never run as code, never fed to the fill engine.`).

**Surface 3 — PublishedCard `⋯`-menu + victim-naming Sheet (WFIN-03, D-LOCK-03).**
**Analog A (⋯-menu):** `FolderNode.tsx:138-182` — the exact `MoreHorizontal` trigger → `DropdownMenuContent align="end"` → destructive item pattern (`dropdown-menu` is already installed, no registry add):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" ... onClick={(e) => e.stopPropagation()}>
      <MoreHorizontal className="h-3 w-3" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-40">
    ...
    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={...}>
      <Trash2 className="h-3.5 w-3.5 mr-2" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
The `⋯` button goes in the `PublishedCard` header (`WorkflowsPage.tsx:628-644`), top-right, left of the `published` pill, `aria-label="Workflow actions"`. Single item `Delete workflow…` opens the Sheet. The footer `⑂ Tweak` / `▶ Run` pair (`:650-668`) is UNCHANGED. RESEARCH Pitfall 8: this menu is **net-new** — `PublishedCard` has only Tweak+Run today.

**Analog B (victim-naming Sheet):** `ActiveRunsSection.tsx:285-313` — the shipped 064-B confirm sheet (SAME `Sheet side="bottom" className="mx-auto max-w-lg"` primitive, SAME lifecycle):
```tsx
<Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
  <SheetContent side="bottom" aria-describedby={descId} className="mx-auto max-w-lg">
    <SheetHeader><SheetTitle>End this run?</SheetTitle></SheetHeader>
    <div className="px-4 pb-4">
      <p id={descId} className="text-sm text-foreground">End {userLabel}'s run on {modelLabel}, {elapsedLabel} in — cancels immediately, recorded with your name.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setConfirmOpen(false)} className="... border border-border ...">Keep running</button>
        <button onClick={handleConfirm} className="... bg-destructive ... text-destructive-foreground ...">End it now</button>
      </div>
    </div>
  </SheetContent>
</Sheet>
```
**The in-place lifecycle (NO optimistic removal)** — copy the `KillPhase` state machine at `ActiveRunsSection.tsx:125-173` + the right-rail terminal states `:252-279`:
```tsx
type KillPhase = "idle" | "cancelling" | "cancelled" | "error"
// cancelling: <Loader2 className="animate-spin"/> role="status"  "Deleting…"
// cancelled:  <Check className="text-success"/> role="status"    "Deleted · recorded"
// error:      text-destructive "Couldn't delete the workflow" + Try again button
```
Adapt the copy per UI-SPEC §4: title "Delete this workflow?", Removed group (`{name} · {N} versions · {N} run records`), Kept group (`{N} chat threads become normal chats…`), amber in-flight banner (only when a run is live, D-LOCK-05), `Delete forever` / `Keep it`, `✎ Recorded with your name` footer. Counts come from the server preview read — never guessed. Card transitions in place, then the list re-fetches (mirror `ActiveRunsSection`); NO undo.

---

### `frontend/src/components/layout/ChatLayout.tsx` (component, request-response) — `doRun` sequencing

**Analog:** the in-file `doRun` `:114-123` (the whole launch closure this phase extends):
```tsx
const doRun = useCallback(
  async (def: PublishedWorkflow, kickoff: string) => {
    const thread = await createThread(def.name)
    await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id })
    await loadThreads()
    selectThread(thread)
    onNavigate("chat")
  },
  [loadThreads, selectThread, onNavigate],
)
```
**Extend (RESEARCH — the ONLY net-new WFIN-01 orchestration):** widen `onLaunch`'s signature to carry the staged template `File` + the selected `folderId`, then slot the upload BETWEEN createThread and postMessage:
```tsx
const thread = await createThread(def.name)
if (templateFile) await uploadWorkspaceTemplate(thread.id, templateFile)  // NET-NEW (Landmine 8: upload to THIS thread by kind)
await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id, folderId })  // + folder override
```
The comment at `:112-113` ("we never pass a folder here") is now stale — this phase adds the per-run folder. `onLaunch` type is declared at `WorkflowsPage.tsx:83` and must widen in lockstep.

---

### `frontend/src/lib/api.ts` (utility/client, request-response)

**Analog A — the delete client:** `deleteWorkflowDraft` `:3231-3241`:
```tsx
export async function deleteWorkflowDraft(id: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, { method: "DELETE", headers, signal })
  if (res.status === 409) throw new WorkflowConflictError()
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to delete workflow draft (status ${res.status})`)
}
```
Add `deleteWorkflowCascade(id)` hitting the NEW distinct route (`DELETE /workflows/{id}/cascade`), plus a `getWorkflowDeletePreview(id)` for the sheet counts. Same `getAuthHeaders` + status-mapped-error shape.

**Analog B — the upload client (reuse as-is):** `uploadWorkspaceTemplate` `:1377` (FormData + Bearer, no Content-Type so the browser sets the multipart boundary — load-bearing). `doRun` calls this verbatim.

**Analog C — the launch call:** `postMessage` `:530-537` (the options bag) — extend the body with `folder_id` the same additive way `workflow_definition_id` is included only when present:
```tsx
...(options.workflowDefinitionId ? { workflow_definition_id: options.workflowDefinitionId } : {}),
// ADD: ...(options.folderId ? { folder_id: options.folderId } : {}),
```

---

## Shared Patterns

### Owner authorization at the service boundary (NO RLS backstop)
**Source:** `db/workflows.py` header (`:19-23`) + `get_definition` `:279-285` (404-collapse) + `scope.py` `fetch_visible_folders` gate.
**Apply to:** the WFIN-03 cascade endpoint/helper AND the WFIN-02 override gate.
The harness + delete run as **service role (RLS bypassed)** — every owner check MUST be an explicit app-layer `WHERE created_by = $user` (or `str(id) in fetch_visible_folders(...)`). A non-owner collapses to 404, never 403 (no existence leak):
```python
"WHERE id = $1 AND (created_by = $2 OR (is_global = true AND status = 'published'))"
```

### `$N`-only parameterized SQL (never f-string on user values)
**Source:** `db/workflows.py` module header (T-073-02 / T-091-03) + every helper in the file.
**Apply to:** the cascade + preview helpers. `slug`/`folder_id`/`version_ids` bind as `$N` / `ANY($1::uuid[])`. The one allowed f-string is a JSONB-path predicate on a CONSTANT (`definition->>'project_folder_id' = ${len(params)}` at `:221` binds the VALUE positionally — copy that shape if a preview query filters by folder).

### Cancel-first via the shared zombie-heal (never delete a live run)
**Source:** `run_lifecycle.py:_cancel_run_internals` (`:158`), used by `admin.py:kill_run` (`:479`).
**Apply to:** WFIN-03 step 3 (D-LOCK-05). Delegate to the shared discipline — do NOT hand-roll cancel logic; it atomically co-writes the terminal state, clears the thread anchor, and EXPIREs the Redis buffer. Returns an outcome discriminator (`terminal_noop`/`task_cancelled`/`zombie_healed`) for honest audit copy.

### Untrusted-template provenance (SSTI mitigation — D-07, reuse verbatim)
**Source:** `workspace.py:validate_upload` (`:176`) + `upload_template` (`:222`, stamps `kind='template_input'` at `:267`) + `resolve_template_source` Branch 2 (`template_asset_service.py:120`).
**Apply to:** WFIN-01 — no backend change. `asset_ref=None` → Branch 2 → `run_replace` engine (NEVER `docxtpl`/Jinja). The 10MB DoS cap (`:241,246`), magic-byte gate, TTL, and `_verify_thread_ownership` (`:237`) are all already in place. Discovery is by `kind` on the thread (Landmine 8) — the frontend MUST upload to the launched thread; an `inputs.template_input` echo is OPTIONAL (display only, A5).

### Server-boundary scope (never a prompt) — SC#10 cross-provider for free
**Source:** `tool_dispatcher.py:682` search-scope bind + `scope.py:resolve_project_subtree`.
**Apply to:** WFIN-02. The resolved `folder_subtree_ids: list[str]` is bound onto the tool context server-side; the RPC filters on `p_folder_ids` AND `match_user_id`; a post-query `scope_violation` clip is the backstop. The model calls `search_documents(query)` and the constraint is applied AROUND it identically for OpenAI/Anthropic/Google/OpenRouter. Keep the channel a `list` (Pitfall 6 — a `set` breaks supabase-py `json.dumps`).

### Test scaffolds
**Source:** `test_098_scope_governance.py:154` (patches `scope.resolve_project_subtree`, asserts run-start binding) + `test_workspace_template.py` (upload validation patterns).
**Apply to:** the 4 net-new `test_152_*` files. Measure against the captured baseline (~63 backend + ~14-17 vitest pre-existing ROT — SEED-056/049), NOT zero-fail.

---

## No Analog Found

None. Every net-new/modified file has a concrete in-repo analog. The two pieces with the LEAST direct precedent are still composable from existing code:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `backend/app/db/workflows.py` cascade helper | db | CRUD-delete | No single "multi-table cascade delete" precedent exists, but it is a mechanical compose of `create_workflow_run`'s txn shape (`:126`) + `delete_workflow_definition`'s owner-scoped delete (`:404`) + the verified FK order. |
| `PublishedCard` `⋯`-menu | component | request-response | Net-new on THIS card (Pitfall 8), but `FolderNode.tsx:138` is a verbatim `DropdownMenu` + destructive-item analog. |

---

## Metadata

**Analog search scope:** `backend/app/{api,db,services,models}`, `frontend/src/{pages,components,lib}`, `supabase/full-schema.sql` (FK/trigger lines cited from RESEARCH — verified this session).
**Files scanned this session:** `db/workflows.py`, `api/workflows.py`, `api/threads.py`, `api/workspace.py`, `api/admin.py`, `models/message.py`, `services/harness/scope.py`, `services/run_lifecycle.py`, `pages/WorkflowsPage.tsx`, `components/panel/TemplateUpload.tsx`, `components/chat/ChatArea.tsx`, `components/admin/ActiveRunsSection.tsx`, `components/ingestion/FolderNode.tsx`, `components/layout/ChatLayout.tsx`, `lib/api.ts`.
**Pattern extraction date:** 2026-07-14
