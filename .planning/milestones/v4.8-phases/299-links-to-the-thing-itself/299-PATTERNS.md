# Phase 299: Links to the Thing Itself - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 44 (18 new, 26 modified), taken from 299-RESEARCH.md §"Recommended plan split" plus D-32..D-41
**Analogs found:** 42 / 44 (two have no close analog; see the end)

All line numbers were read on 2026-10-28 at `4797607ab`. Ledger triples come from the CLAUDE.md
FIRING table or the `docs/HOT-FILE-LEDGER.md` scan list. "no row" means F10: the row and section
are added **in the same commit as the first touch** (D-40). Run
`node scripts/check-hot-file-ledger.cjs .planning/phases/299-links-to-the-thing-itself` after each PLAN.md is written.

---

## File Classification

### Plan 299-01: resolver, run `org_id`, write-org guards (backend)

| File | New/Mod | Role | Data Flow | Closest Analog | Match | G-5 ledger |
|---|---|---|---|---|---|---|
| `backend/app/api/links.py` | new | route | request-response (read) | `backend/app/api/org_items.py` | exact | needs row |
| `backend/app/services/link_resolver.py` | new | service | read / transform | `backend/app/services/org_lists.py` + `org_items.ELSEWHERE_SQL` | role-match | needs row |
| `backend/app/services/item_org_guard.py` | new | utility | guard | `threads.py::_require_thread_org` (:833-845) | exact | needs row |
| `backend/app/main.py` | mod | config | wiring | its own `org_items` line (:887, :939) | exact | 96/70/992 FIRING ⛔ (one import token + one include_router) |
| `backend/app/api/workflow_runs.py` | mod | route/model | read | `WorkflowRunRead` lockstep (:380-420, :1046-1066) | exact | 22/16/1449 FIRING, **extraction FIRST** (one field, one select token) |
| `backend/app/api/threads.py` | mod | route | write guard | `_require_thread_org` call at :1835 | exact | 284/96/2752 FIRING ⛔ (one guard call) |
| `backend/app/services/workflow_kickoff.py` | mod | service | write guard | `raise_if_foreign(... definition_org=...)` at :311 | exact | 14/11/605 FIRING (one call) |
| `backend/app/api/workflows.py` | mod | route | write guard | `create_draft` (:1190-1215) | role-match | 53/27/1712, split OWED (one optional param + one call) |
| `backend/app/api/runs.py` | mod | route | write (row-org stamp) | its own ask_user select (:951) + insert (:1073-1088) | exact | 54/23/2050 ⛔ (one select token, one insert key) |
| `backend/app/api/schedules.py` | mod | route | write (org stamp) | `create_workflow_schedule` (:95-143) | exact | 4/4/299 FIRES (one kwarg) |
| `backend/app/db/schedules.py` | mod | data access | insert | `create_schedule` (:74-100) | exact | 1/1/359, no |
| `scripts/build-public-openapi.cjs` | mod | config | build | 298-01's `org-items` tag + FLAGGED line | exact | 11/5/472 (two lines) |
| `docs/public/api/openapi.snapshot.json` | regen | artifact | generated | `scripts/export-openapi.py` | n/a | never hand-edit |
| `backend/tests/unit/test_299_links_route.py` | new | test | — | `backend/tests/unit/test_298_org_items_routes.py` §4 | exact | test |
| `backend/tests/unit/test_299_link_resolver.py` | new | test | — | `test_298_org_items_routes.py` §1-§2 (fake `Conn`) | exact | test |
| `backend/tests/unit/test_299_write_org_guards.py` | new | test | — | `test_298_foreign_binding.py` | role-match | test |

### Plan 299-05: sign-in return, boot give-up, FIX-02

| File | New/Mod | Role | Data Flow | Closest Analog | Match | G-5 ledger |
|---|---|---|---|---|---|---|
| `frontend/src/lib/returnTo.ts` | new | utility (strict leaf) | transform | `frontend/src/lib/appRoutes.ts` (`canonicalAddress`) | exact | needs row |
| `frontend/src/hooks/useAuth.ts` | mod | hook | auth / event | itself (:36-48, :74-78) | exact | **no row, FIRES at 4 phases** (F10) |
| `frontend/src/pages/AuthPage.tsx` | mod | page | render | itself (26 lines) | exact | 4/2/26, no |
| `frontend/src/components/layout/BootScreen.tsx` | new | component | timer | `App.tsx:227-237` splash + `FilePreview.tsx:371-375` timer | role-match | needs row |
| `frontend/src/App.tsx` | mod | component | render | its splash block :227-237 | exact | 42/29/355 FIRING (one expression: `<BootScreen />`) |
| `frontend/src/hooks/useThreads.ts` | mod | hook | derived state | its `switching` line :118 | exact | 8/4/121 FIRING ⛔ (one derived const + one return key) |
| `frontend/src/components/layout/ChatLayout.tsx` | mod | component | render | `ChatHistoryColumn.tsx:469-474` loading arm | exact | 69/35/905 FIRING |
| `docs/OPERATOR.md`, `docs/DEPLOYMENT-WORKFLOW.md` | mod | docs | — | `OPERATOR.md:550-554` Redirect URLs list | exact | docs |

### Plan 299-02: entity routes, LinkGate, in-place card, open-by-id

| File | New/Mod | Role | Data Flow | Closest Analog | Match | G-5 ledger |
|---|---|---|---|---|---|---|
| `frontend/src/lib/appRoutes.ts` | mod | utility (strict leaf) | transform | its own `runs`/`skills` id arms (:121-122) | exact | 1/1/198 young, STRICT LEAF ⛔ |
| `frontend/src/hooks/useAppNavigation.ts` | mod | hook (only router-hook caller) | navigation | its own `runId`/`openRun`/`lastRunId` (:103-115, :321-332) | exact | 4/1/290 young ⛔ (only router-hook caller) |
| `frontend/src/components/layout/AppViewSwitch.tsx` | mod | component (hook-free switch) | render | its `AddressNotFound` arms (:295-296, :375-379, :453) | exact | 2/1/523 young ⛔ no hooks |
| `frontend/src/components/layout/CantBeOpened.tsx` (from `AddressNotFound.tsx`) | new/move | component | render | `frontend/src/components/layout/AddressNotFound.tsx` | exact | 1/1/51 young ⛔ no raw path prop |
| `frontend/src/components/layout/LinkGate.tsx` | new | component (stateful) | request-response | `ElsewhereLine.tsx` (useOrgOptional + fetch + render nothing until answered) | role-match | needs row |
| `frontend/src/hooks/useThreadAddress.ts` | new | hook | URL⇄state binding | `useAppNavigation.ts` normalising effect (:152-161) + `useThreads` ref idiom (:46-47) | role-match | needs row |
| `frontend/src/lib/api/links.ts` | new | api client | request-response | `frontend/src/lib/api/orgItems.ts::getFolderLabels` | exact | needs row |
| `frontend/src/lib/api.ts` | mod | barrel | re-export | its orgItems block (:468-470) | exact | 214/127/552 (one export block) |
| `frontend/src/pages/WorkflowsPage.tsx` | mod | page | render | `onOpenDraft` (:562-576) | exact | 52/22/1392 FIRING (one prop + one hook call) |
| `frontend/src/components/workflows/library/useWorkflowLinkTarget.ts` | new | hook | effect | `WorkflowsPage.onOpenDraft` + `onOrgSwitch` reset | role-match | needs row; join `LIBRARY_SUBTREE_PATHS` |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | mod | component | render | its root `data-provenance` (:1023-1025) | exact | 26/11/1373 FIRING (one `data-row-id`) |
| `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` | mod | page | render | its `inspected` state (:100) + modal mount (:351-356) | exact | 9/6/372 FIRING (one prop + one hook) |
| `.claude/skills/sketch-findings-agentic-rag/SKILL.md` | mod | docs | — | 297 D-40 correction-beside-original | exact | docs |

### Plan 299-03: switch prompt

| File | New/Mod | Role | Data Flow | Closest Analog | Match | G-5 ledger |
|---|---|---|---|---|---|---|
| `frontend/src/components/layout/SwitchOrgPrompt.tsx` | new | component | event (switch) | `frontend/src/components/org/ElsewhereLine.tsx` (Switch button) + `OrgAvatar` | exact | needs row |
| `frontend/src/components/layout/LinkGate.tsx` | mod | component | state machine | (299-02 output) | — | row from 299-02 |
| `frontend/src/components/org/orgItemsCopy.ts` | mod | copy (strict leaf) | — | itself (`switchToLabel`, `LOADING_CHATS`) | exact | 2/1/154 young, strict leaf |

### Plan 299-04: share menu and "saves in <org>"

| File | New/Mod | Role | Data Flow | Closest Analog | Match | G-5 ledger |
|---|---|---|---|---|---|---|
| `frontend/src/components/share/ShareLinkMenu.tsx` | new | component | event (clipboard) | `ScopePicker.tsx` (DropdownMenuContent body) + `FilePreview.tsx::CopyContentButton` | exact | needs row |
| `frontend/src/lib/clipboard.ts` | new | utility | browser I/O | `FilePreview.tsx:377-387` `onCopy` | exact | needs row |
| `frontend/src/lib/linkAudience.ts` | new | utility (pure leaf) | transform | `orgItemsCopy.ts` (strict leaf, string fns) | role-match | needs row |
| `frontend/src/components/chat/ChatArea.tsx` | mod | component | render | header `<h2>` (:1043) | exact | 94/44/1189 FIRING ⛔ (one mount) |
| `frontend/src/components/workflows/library/WorkflowCardMenu.tsx` | mod | component | render | the `MoveToOrgMenuItem` mount (:295) | exact | 3/3/498 now FIRES (one gated mount) |
| `frontend/src/pages/WorkflowsPage.tsx` | mod | page | render | Builder branch (:775-797) | exact | FIRING (one mount; shared with 299-02, serialise) |
| `frontend/src/pages/WorkflowRunPage.tsx` | mod | page | render | `<header>` (:1204-1365) | exact | 36/16/1605 FIRING ⛔ (one mount) |
| `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` | mod | component | render | `DialogHeader` (:243-262) | exact | 7/5/531 FIRING (one mount + one label) |
| `frontend/src/components/workflows/library/RunModal.tsx` | mod | component | render | — (one label string) | exact | 13/8/748 FIRES |
| `frontend/src/components/workflows/library/useWorkflowFork.ts` | mod | hook | write | its `createWorkflowDraft` call (:125) | exact | **no row** (F10) |

Shared across plans: `scripts/vitest-count-gate.cjs` (380/81/6808; pin every new vitest file in
BASELINE/TARGETS in the same commit, Pitfall 10) and `docs/HOT-FILE-LEDGER.md` (rows plus sections, same commit).

⛔ **Read-only, never edited:** `frontend/src/providers/StreamsProvider.tsx` (D-02, D-37),
`frontend/src/components/layout/ChatHistoryColumn.tsx` (Pattern 9: it takes `loading=` as is),
`backend/app/db/workflows.py` (re-opens 298 WR-08), `SignInForm.tsx` / `SignUpForm.tsx` (Pattern 7;
`SignInForm.test.tsx:70` pins `signInWithSSO("ssocorp.com")`). `frontend/src/stores/streamsStore.ts`
is read through `useStreamsStore.getState().streamingThreads` only (F4).

---

## Pattern Assignments

### `backend/app/api/links.py` (route, read)

**Analog:** `backend/app/api/org_items.py`

**Imports** (org_items.py:52-70). Keep the same shape and drop what is unused:
```python
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.dependencies import get_current_user, get_user_pg_connection
```
⛔ Do NOT import `get_active_org_id`, `require_capability` or `require_visible` (D-08: they 400 or 403).

**Router-level 401** (org_items.py:72-89). Copy it verbatim:
```python
_optional_bearer = HTTPBearer(auto_error=False)


async def _require_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> None:
    """D-22: no credential is a 401 with ``WWW-Authenticate: Bearer`` — checked before any read."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )


router = APIRouter(
    prefix="/org-items", tags=["org-items"], dependencies=[Depends(_require_bearer)]
)
```
→ `prefix="/links", tags=["links"]`.

**Strict UUID** (org_items.py:94-96). Validate inside the handler and answer the same 404. Never type the path param as `UUID`, which would 422:
```python
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
```

**Handler on the RLS connection** (org_items.py:195-211):
```python
@router.get("/elsewhere", response_model=ElsewhereCounts)
async def get_elsewhere_counts(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> ElsewhereCounts:
    ...
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(ELSEWHERE_SQL, active)
    return fold_elsewhere_rows(rows)
```
For links, use `conn.fetchrow(SQL_BY_KIND[kind], uid)` with **one constant SQL per kind** (Pattern 2
table and Expert SQL, RESEARCH :333-366) and **one** `NOT_FOUND` detail constant for every arm
(RESEARCH :498). The module docstring copies org_items.py:12-32's "Security posture" bullets:
RLS-enforced, not service role; member orgs only; no existence oracle; 401 without a bearer; read-only.

**Pure fold, testable without a DB** (org_items.py:150-165): `fold_elsewhere_rows(rows) -> Model`.
Mirror it as `link_resolver.to_target(kind, row) -> LinkTarget`. Include the `audience` derivation
(F1/F2) and `org_id=None` for `is_system_global` / `is_system` (F3, D-35).

---

### `backend/app/services/link_resolver.py` (service)

**Analog:** `backend/app/services/org_lists.py:36-54` (a thin service the route calls, with no FastAPI in its signature)
```python
async def active_org_uuid(request, current_user: dict) -> UUID | None:
    """``active_org`` as a ``uuid.UUID`` for asyncpg binds, or ``None``."""
    org = await active_org(request, current_user)
    return UUID(org) if org else None
```
SQL constants follow `ELSEWHERE_SQL` (org_items.py:102-119): `auth.uid()` in the predicate, an
`org_members m ON m.org_id = … AND m.user_id = auth.uid()` membership arm, positional `$1`. The
membership test for an Expert is the bundle's org (`m.org_id = b.org_id`) and never the active org (D-07).

---

### `backend/app/services/item_org_guard.py` (utility, guard)

**Analog:** `backend/app/api/threads.py:833-845`
```python
def _require_thread_org(thread_row: dict | None, active_org_id: str | None, *, expert_id, detail: str) -> None:
    """... ONE helper, called once at each of the four doors ... never a second inline compare beside it."""
    if thread_row is None or not expert_id:
        return
    if str(thread_row.get("org_id") or "") != str(active_org_id or ""):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
```
⚠ **Polarity differs:** `_require_thread_org` fails CLOSED when there is no active org, because an
Expert is in play. The new helper is a no-op when there is no active org (298 D-03, RESEARCH :519-524).
It is a separate helper, never a widening of `_require_thread_org`. Callers get the active org through
`org_lists.active_org(request, current_user)` (membership re-validated; never 400s).

**Call sites (one expression each):**
- `threads.py` send_message: directly after the existing `_require_thread_org(...)` call at :1835-1836, with
  `detail="Switch to this chat's organization to keep chatting."`.
- `workflow_kickoff.py` preflight: beside :311 (`raise_if_foreign(... definition_org=None if _def_row.get("is_system_global") else _def_row.get("org_id") ...)`). Reuse that same expression for the row org, compared against `thread_row["org_id"]`.
- `workflows.py create_draft` (:1203-1215): one optional `from_definition_id: str | None = Query(None)` plus one guard call after `pool = await get_pg_pool()`.

---

### `backend/app/api/workflow_runs.py` (one field, D-10)

**Analog:** its own lockstep rule (:380-420). Declare, select and populate in lockstep.
- `org_id` is **already selected** (`"id, thread_id, definition_id, status, org_id, created_at, ..."` at :1048-1049).
- Add `org_id: UUID | None = None` to `WorkflowRunRead` beside `metadata`, and pass it where the model is built.
- ⚠ Comment hazard (:1055-1062): never type the star-select literal in prose. `test_214_failure_reason_seam.py` counts it.
- Ledger says **extraction FIRST**, so this stays one field and one kwarg, with no new branch.

### `backend/app/api/runs.py` (ask_user row-org stamp)

**Analog:** itself. Add `org_id` to the select at :951, `.select("run_id, thread_id, status")`, then add one
key `"org_id": row["org_id"]` to the `messages` insert at :1073-1088. Note that the harness fallback
synthesises `row` (:956-959), so that synthesised dict must carry `org_id` too. Read it from the
`workflow_runs` row it already fetches.

### `backend/app/api/schedules.py` + `backend/app/db/schedules.py`

`db/schedules.py:74-100` documents "``org_id`` is NOT bound: the ``autofill_org_id_by_owner('user_id')``
trigger resolves it". Add one optional `org_id` kwarg that is bound only when given. `schedules.py`
passes the definition's org, read through `link_resolver` and never `db/workflows.get_definition` (WR-08).

---

### `backend/tests/unit/test_299_links_route.py` / `test_299_link_resolver.py`

**Analog:** `backend/tests/unit/test_298_org_items_routes.py`

**Module import per test, so RED fails each case on its own** (:39-42):
```python
@pytest.fixture
def mod():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.api.org_items")
```
**Fake RLS connection** (:117-133):
```python
    class Conn:
        async def fetch(self, sql, *args):
            calls.append((sql, args))
            return [_row(ORG_B, "Acme", folders=1, runs=2)]

    @asynccontextmanager
    async def fake_conn(request, current_user):
        assert current_user is USER
        yield Conn()

    monkeypatch.setattr(mod, "get_user_pg_connection", fake_conn)
```
Use it for: same SQL text for both missing and forbidden arms (Pitfall 2); `calls == []` for a bad kind or a non-UUID.

**Mounted plus 401 for every route, enumerated** (:229-260):
```python
def _paths(mod):
    return [r for r in mod.router.routes if getattr(r, "methods", None)]
...
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = TestClient(app)
        for route in routes:
            path = re.sub(r"\{[^}]+\}", str(uuid4()), route.path)
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                resp = client.request(method, path, headers={"X-Org-Id": ORG_A})
                assert resp.status_code == 401, f"{method} {path} -> {resp.status_code}"
                assert resp.headers.get("www-authenticate") == "Bearer"
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved
```
Add: the 404 body and headers are identical (compare `response.headers` minus `date`); no 403 or 422 on
`/links/thread/not-a-uuid` or `/links/bogus/<uuid>`. The live `anon` read (D-11) follows the 298 precedent
`tests/integration/test_298_two_org_lists_live.py` (named in that test's docstring, :16-17).

---

### `frontend/src/lib/appRoutes.ts` (strict leaf, D-01)

**Analog:** itself. Extend the union (:36-39) and `viewOf` id arms (:120-123):
```ts
  if (head === "admin" && id === "spend") return { view: "admin-spend" }
  if (head === "runs" && isStrictUuid(id)) return { view: "workflow-run", runId: id.toLowerCase() }
  if (head === "skills" && isStrictUuid(id)) return { view: "skill-studio", skillId: id.toLowerCase() }
  return NOT_FOUND
```
Then extend `formatAppRoute` (:71-75) in the same id-arm style:
```ts
  if (route.view === "workflow-run") return `${VIEW_PATHS["workflow-run"]}/${route.runId.toLowerCase()}`
```
Use `"threadId" in route` style narrowing so the id-less `{ view: "chat" }` stays id-free. Exact-equality
fences: `appRoutes.test.ts:70-71` (`toEqual({ view: "chat" })`). `/app/chat/<id>` must format to
`/app/chat/<id>`, never `/app` (`VIEW_PATHS.chat === "/app"`). Keep the docblock's ⛔ rules (:9-27) true.

### `frontend/src/hooks/useAppNavigation.ts`

**Analog:** its `runId` derivation and navigator (:103-115, :320-332):
```ts
  const runId = parsed.view === "workflow-run" ? parsed.runId : null
  ...
  const lastRunId = useRef<string | null>(null)
  useEffect(() => {
    here.current = `${location.pathname}${location.search}`
    if (runId) lastRunId.current = runId
  ...
    if (next === "workflow-run") {
      if (lastRunId.current) go({ view: "workflow-run", runId: lastRunId.current })
      return
    }
  ...
  const openRun = useCallback((id: string) => go({ view: "workflow-run", runId: id }), [go])
```
`go` (:178-191) already guards strict UUIDs per variant. Add the three new variants to that guard.
Return them as **one** `entityLink` object, which keeps App.tsx to one expression. Note the
`activeView` derivation (:101-102): the new variants keep their existing view names, so `activeView` is
unchanged. `location.hash` must keep riding every replace (:160, Pitfall 10).

### `frontend/src/components/layout/CantBeOpened.tsx` (absorbs AddressNotFound)

**Analog:** `frontend/src/components/layout/AddressNotFound.tsx` (51 lines). Copy the copy-beside-component export and the S2 holding state:
```tsx
// eslint-disable-next-line react-refresh/only-export-components -- the copy lives beside the one component that renders it ...
export const ADDRESS_NOT_FOUND_COPY = {
  heading: "This address doesn't open anything",
  body: "It may be mistyped or out of date.",
  cta: "Go to Chat",
} as const
...
export function AddressHolding({ sentence }: { sentence: string }) {
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">{sentence}</p>
    </div>
  )
}
```
⛔ Invariant (:13-14): no raw path prop. The new card accepts a **parsed `AppRoute`** (or nothing) and shows
`formatAppRoute(route)` only (F6, D-36). Keep `ADDRESS_NOT_FOUND_COPY` exported under the same name,
or re-export it, because `AppViewSwitch.tsx:26` and the admin-refusal arms (:379, :453) import it
(T-297-07: same words). The `AppViewSwitch.addressStates.test.tsx` suite is the fence to re-target.

### `frontend/src/components/layout/LinkGate.tsx` and `SwitchOrgPrompt.tsx`

**Analog:** `frontend/src/components/org/ElsewhereLine.tsx`. Org read, render nothing until answered, the Switch button:
```tsx
import { useOrgOptional } from "@/providers/OrgProvider"
import { SWITCH, elsewhereLead, switchToLabel, type ElsewhereKind } from "./orgItemsCopy"
...
  const org = useOrgOptional()
  const activeOrgId = org?.activeOrgId ?? null
...
                  <button
                    type="button"
                    aria-label={switchToLabel(o.org_name)}
                    onClick={() => {
                      wrapperRef.current?.focus()
                      org?.switchOrg(o.org_id)
                    }}
```
Org mark: `OrgAvatar({ initial })` from `frontend/src/components/org/OrgIdentity.tsx:84-94` (`aria-hidden`, no
colour field, F8/D-39). Words: add to `orgItemsCopy.ts` (strict leaf, no imports, :1-7 header), reusing
`switchToLabel`. The F4 snapshot reads `useStreamsStore.getState().streamingThreads` before `org.switchOrg(...)`.
LinkGate is a component, so AppViewSwitch stays hook-free (ledger ⛔). It receives navigators as props
and imports no router hooks (297 D-08).

### `frontend/src/lib/api/links.ts`

**Analog:** `frontend/src/lib/api/orgItems.ts:19-52`
```ts
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
...
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/org-items/folder-labels?${params}`, { headers })
    if (!res.ok) throw new ApiError("Couldn't look up those folders.", res.status)
    const body = (await res.json()) as { labels?: FolderLabel[] }
```
A 404 must resolve to a typed "cant" outcome and not a thrown generic error, so the gate can tell 404 apart from a network failure.
Barrel: one block in `frontend/src/lib/api.ts` beside :468-470:
```ts
// ── orgItems (Phase 298-04) ────────────────────────────────────────────
export { getFolderLabels, getElsewhereCounts, getMovePreview, moveOrgItem } from "./api/orgItems"
export type { FolderLabel, ElsewhereOrgCounts, MovePreview, OrgItemMoveKind } from "./api/orgItems"
```

### `frontend/src/hooks/useThreadAddress.ts`

**Analogs:** `useThreads.ts:46-47` (latest-value ref, so a refetch cannot re-fire the effect) and
`useAppNavigation.ts:152-161` (one effect keyed on the address):
```ts
  const activeOrgRef = useRef(activeOrgId)
  activeOrgRef.current = activeOrgId
```
Replace the programmatic pair at `ChatLayout.tsx:155-158`:
```ts
      openThread: (thread) => {
        selectThread(thread)
        onNavigate("chat")
      },
```
with one `openThread` (select plus `entityLink.openThread(id)`). Do the same at `:494-496` (doRun) and
`AppViewSwitch.tsx:501-503`. `selectThread` stays a bare `setState` (`useThreads.ts:84-86`, ledger 298-04).

### `frontend/src/pages/WorkflowsPage.tsx` + `useWorkflowLinkTarget.ts`

**Analog:** `onOpenDraft` (WorkflowsPage.tsx:562-576). The hook calls it with the drafts-list row, which is
the only row that carries `token`:
```ts
  const onOpenDraft = useCallback((draft: WorkflowDraftRow) => {
    setBuilderInitial({
      definition: (draft.definition ?? {}) as WorkflowDefinitionJSON,
      draftId: draft.id,
      label: `Edit · ${libraryDisplayName(draft.name, draft.slug)} v${draft.version}`,
      token: draft.token ?? null,
    })
    setPageView("builder")
  }, [])
```
The hook file lives under `components/workflows/library/`, so add it to `LIBRARY_SUBTREE_PATHS` (the
`librarySubtree` fence). It never imports the page. `WorkflowCard.tsx` gains one `data-row-id={row.id}`
beside `data-provenance` (:1023-1025).

### `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx`

**Analog:** itself. `const [inspected, setInspected] = useState<ExpertBundle | null>(null)` (:100) already
controls `<ExpertDetailModal expert={inspected} open={inspected !== null} … />` (:351-356). Add one
optional `openBundleId` prop. One hook sets `inspected` from the loaded list, or from `getExpert(id)`
(`lib/api/experts.ts:234`) when the row is absent.

---

### `frontend/src/components/share/ShareLinkMenu.tsx` (+ `lib/clipboard.ts`, `lib/linkAudience.ts`)

**Floating surface analog:** `frontend/src/components/chat/ScopePicker.tsx:20-26, 193-205`
```tsx
import {
  DropdownMenuContent,
  DropdownMenuItem,
  ...
} from "@/components/ui/dropdown-menu"
...
    <DropdownMenuContent
      side="top"
      align="start"
      sideOffset={8}
      data-testid="scope-picker"
      className="w-[380px] max-w-[calc(100vw-2rem)] p-3"
    >
      <p className="text-sm font-semibold leading-snug text-foreground">{SCOPE_COPY.title}</p>
```
No `@radix-ui/react-popover` (F9). The address goes in a `<code className="select-all">` and not an
input. A Radix menu fights a focused input (memory `reference_radix_menu_focus_kills_inline_editor`).

**Clipboard analog with an explicit failure arm:** `frontend/src/components/panel/FilePreview.tsx:366-405`
```tsx
  const onCopy = () => {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard
    if (!clip?.writeText) {
      setState("failed")
      return
    }
    clip.writeText(text).then(
      () => setState("copied"),
      () => setState("failed"),
    )
  }
  ...
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : ""}
      </span>
```
Plus the 2 s transient reset (:371-375). Extract `onCopy` into `lib/clipboard.ts` as
`copyText(text): Promise<"copied" | "refused">`. On refusal, call `getSelection().selectAllChildren(codeEl)`.

**Menu-item mount analog** for the library card: `WorkflowCardMenu.tsx:293-295`
```tsx
                {/* 298-05 (D-31 / UI-D15) — a DRAFT only ...; renders nothing unless owned at 2+ orgs. A `DropdownMenuItem`: WR-03 stays green. */}
                {row.provenance === "draft" && <MoveToOrgMenuItem kind="draft" itemId={row.id} itemName={row.name} owned={owned} />}
```
The card mount must be a `DropdownMenuItem` (WR-03 `aria-required-children` sweep). Follow
`MoveToOrgMenuItem.tsx:58-71` (lucide icon `mr-2 h-3.5 w-3.5`, `e.stopPropagation()`, truncate span).

**Header mounts (one expression each):** `ChatArea.tsx:1043` after
`<h2 className="font-headline font-semibold text-sm truncate text-foreground">{thread.title}</h2>`;
`WorkflowRunPage.tsx` inside `<header className="flex shrink-0 border-b border-border/10">` (:1204-1365);
`ExpertDetailModal.tsx` in the `DialogHeader` title row (:249-252).

**`linkAudience.ts`:** a pure leaf in the `orgItemsCopy.ts` style (no imports, string functions). Pin it with a
fixture shared with the backend `audience` derivation (RESEARCH :391).

---

### `frontend/src/lib/returnTo.ts` (strict leaf)

**Analog:** `appRoutes.ts::canonicalAddress` (:175-198). It is total, wrapped in try/catch, and builds only from `formatAppRoute`:
```ts
    if (parsed.view === "not-found" || parsed.view === "pre-auth") return null
    const target = formatAppRoute(parsed)
    ...
    return out.startsWith("/app") ? out : null
  } catch {
    return null
  }
```
RESEARCH :546-552 gives the body. sessionStorage access is wrapped in try/catch, following the
`useAuth.ts:90-94` localStorage idiom (private mode).

### `frontend/src/hooks/useAuth.ts` (SEED-312, D-24)

**Analog:** itself. The un-caught bind is at :38-42:
```ts
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
```
Add `.catch(() => setLoading(false))` and a bounded race that sets `stalled`, and never set `user=null` on a
timeout (Pitfall 6). SSO is at :74-78 (`signInWithSSO({ domain })` plus `window.location.href = data.url`):
add `options: { redirectTo }` from `returnTo`. Sign-up is at :64-67: add `options: { emailRedirectTo }`. The
interface (:7-20) gains `stalled: boolean`. `SignInForm.test.tsx:33-51` mocks `useAuth`, so the new field is
optional for that mock. The ledger row and section land in this commit (F10).

### `frontend/src/components/layout/BootScreen.tsx` + `App.tsx`

**Analog:** the splash at `App.tsx:227-237`. Its markup is carried verbatim into the `<8 s` stage:
```tsx
  if (loading || setupStatus === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div role="status" aria-label="Loading Syrel">
          <IrisAvatar state="thinking" size={56} />
        </div>
      </div>
    )
  }
```
App's change is that the inner JSX becomes `<BootScreen />`, one expression. The timer follows the
`setTimeout`/`clearTimeout` cleanup of `FilePreview.tsx:371-375` and RESEARCH :533-541. "Try again" =
`window.location.reload()`, so no History write and `noRawHistoryWrites.test.ts` stays green.

### `frontend/src/hooks/useThreads.ts` + `ChatLayout.tsx` (FIX-02, D-27)

**Analog:** `useThreads.ts:117-120`
```ts
  const threads = held !== null && held.org === activeOrgId ? held.rows : NO_THREADS
  const switching = held !== null && held.org !== activeOrgId

  return { threads, selectedThread, loading, switching, loadThreads, ... }
```
Add `const pending = held === null || held.org !== activeOrgId` and document it beside `switching` (:13-17).
The interface docblock's "BUG-261027-02 stays for Phase 299" is corrected beside the original and not deleted.

**Loading arm to copy:** `ChatHistoryColumn.tsx:469-474`
```tsx
        {loading ? (
          <SyrelLoader size="section" label={LOADING_CHATS} className="justify-center py-10 px-3 text-sm text-muted-foreground" />
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10 px-3">
            {query.trim() ? "No chats match your search." : "No recent chats"}
          </p>
```
Mirror it into the mobile ternary at `ChatLayout.tsx:711-714`:
```tsx
              {mobileFiltered.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4 italic">
                  {mobileQuery.trim() ? "No chats match your search." : "No recent chats"}
                </p>
```
In the destructure at `ChatLayout.tsx:136` (`switching: threadsSwitching,`), take `pending` and pass it as
`loading=` at :635, which is the existing prop, so ChatHistoryColumn stays unmodified. Import `SyrelLoader`
from `@/components/ui/SyrelLoader` and `LOADING_CHATS` from `@/components/org/orgItemsCopy`.

### `frontend/src/pages/AuthPage.tsx`

**Analog:** itself (26 lines). The quiet line goes inside `<AuthCardShell>` after the form ternary (:19-23),
reading `kindWord(parseAppLocation(window.location.pathname, window.location.search))`. No new prop on
`App.tsx:267` (`<AuthPage onSignIn={signIn} onSignUp={signUp} />`).

---

## Shared Patterns

### Existence hiding (missing ≡ forbidden)
**Source:** `workflow_runs.py:1040-1066`. `id` and `user_id` are filtered on the SAME query:
```python
    # ``id`` and ``user_id`` are filtered on the SAME query on purpose. A two-step
    # "fetch, then compare owner" would answer a foreign id along a different (slower,
    # separately-failing) path than a nonexistent one, which is a probe channel.
```
**Apply to:** every resolver SQL, with one constant 404 body.

### RLS connection + router-level 401
**Source:** `org_items.py:12-32, 72-89, 209`. **Apply to:** `links.py`. Membership comes from `org_members`
plus `auth.uid()` and never from the `X-Org-Id` header.

### Active org that never 400s
**Source:** `org_lists.active_org(request, current_user)` (`org_lists.py:45-48`). **Apply to:** every D-18
guard call, so a header-less caller sees no change.

### One home for words (strict leaf)
**Source:** `orgItemsCopy.ts:1-7` and `AddressNotFound.tsx:20-26`. **Apply to:** switch-prompt words, card
words, share audience lines, "saves in <org>", boot words, the quiet sign-in line. Tests assert the
rendered constant (ElsewhereLine.test.tsx header: "Asserted by the RENDERED WORDS").

### Org-aware component outside a provider
**Source:** `useOrgOptional()` with `org?.activeOrgId ?? null` (ElsewhereLine.tsx:47-49,
MoveToOrgMenuItem.tsx:43-46). **Apply to:** LinkGate, SwitchOrgPrompt, ShareLinkMenu, "saves in <org>" labels
(only at 2+ orgs).

### Frontend test harnesses
- Router: `useAppNavigation.test.tsx:12-38`, `createMemoryRouter([{ path: "*", Component: Shell }])` under `<StrictMode>`, with a `?raw` source import for import fences.
- Org-mocked component: `ElsewhereLine.test.tsx:9-35`, `vi.hoisted` org value plus `vi.mock("@/providers/OrgProvider", …)` and `vi.mock("@/lib/api/_core", …)`.
- Leaf table: `appRoutes.test.ts:67-82` exact-equality `toEqual` cases.
- Every new vitest file is pinned in `scripts/vitest-count-gate.cjs` in the same commit.

### OpenAPI drift
New route plus new `WorkflowRunRead.org_id` → regenerate with `backend/venv/Scripts/python scripts/export-openapi.py`,
add the `links` tag to a `TAG_GROUPS` entry and `/links/` to `FLAGGED_PREFIXES` in `scripts/build-public-openapi.cjs`
(298-01 did the same for `org-items`), and run `node scripts/build-public-openapi.cjs --check` (Pitfall 8).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/src/hooks/useThreadAddress.ts` | hook | two-way URL⇄selection binding | No existing two-way binding. 297 bound only URL→view. Use RESEARCH Pattern 3 and Pitfall 4 (deps `[threadId, pending]`, `threads` read through a ref) with the partial analogs above. |
| The return-to-link resume (inside LinkGate) | effect | one-shot sessionStorage consume | No prior resume-after-sign-in flow. Use RESEARCH Pattern 7 and Pitfall 7 (TTL, consume once, only on chat home after a signed-out→signed-in edge). |

## Metadata

**Analog search scope:** `backend/app/api`, `backend/app/services`, `backend/app/db`, `backend/tests/unit`,
`frontend/src/{lib,hooks,pages,components/{layout,org,chat,panel,workflows/library,experts/catalog}}`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~45
**Pattern extraction date:** 2026-10-28
