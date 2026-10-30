# Phase 301: The Waiting-on-You Notice - Pattern Map

**Mapped:** 2026-10-30
**Files analyzed:** 27 (13 new, 14 modified)
**Analogs found:** 27 / 27. Every file has a shipped analog. Only the minute-tick waited phrase has no exact twin (closest: `EngineHealthCard.tsx:72-80`).

Amendments D-27..D-35 override the earlier D-numbers wherever the two disagree. That means: the pool read with the caller bound as `$1` (not `run_in_threadpool`), `origin` on the wire, `DropdownMenuItem` rows, a dot on the non-chat mobile bar, a discriminated union on `mark`, and the OpenAPI snapshot regenerated in the same commit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/219_notifications_realtime.sql` (NEW) | migration | config (publication) | `supabase/migrations/032_phase56_realtime.sql:23-29` + `218_…sql:341-363` (VERIFY) | exact |
| `scripts/full-schema-supplement.sql` (MOD §4 + header `:27`) | config | bootstrap | itself, §4 `:226-236` | exact |
| `backend/app/api/notifications.py` (NEW) | route | request-response (read) | `backend/app/api/links.py` | exact |
| `backend/app/db/notifications.py` (MOD: add `LIST_OPEN_SQL` + fn), or NEW `backend/app/services/waiting_notices.py` | db helper | read (pool, `$1` caller) | `backend/app/services/link_resolver.py:102-114` (`RUN_SQL`) + `db/notifications.py:111-137` (`STILL_WAITING_SQL`) | exact |
| `backend/app/main.py` (MOD: 1 import token + 1 `include_router`) | config | wiring | `main.py:914`, `:967` | exact |
| `scripts/build-public-openapi.cjs` (MOD) + `docs/public/api/openapi.snapshot.json` (REGEN) | config | build | `build-public-openapi.cjs:81-88`, `:131` | exact |
| `backend/tests/unit/test_301_notifications_route.py` (NEW) | test | unit, fake pool | `backend/tests/unit/test_299_links_route.py` | exact |
| `backend/tests/integration/test_301_notifications_live.py` (NEW) | test | live DB, rolled back | `backend/tests/integration/test_300_notice_triggers_live.py:34-229` + `test_299_links_live.py:94-100` | exact |
| `backend/tests/unit/test_301_migration_219_shape.py` (NEW) | test | source shape | `backend/tests/unit/test_298_migration_217_shape.py` | exact |
| `frontend/src/lib/api/notifications.ts` (NEW, kept out of the barrel) | api client | request-response | `frontend/src/lib/api/links.ts` + `lib/api/sources.ts:306-313` | exact |
| `frontend/src/hooks/useWaitingNotices.ts` (NEW) | hook | poll + Realtime hint → refetch | `frontend/src/hooks/useSourceAttention.ts` + `hooks/useFolders.ts:88-152` | exact (combined) |
| `frontend/src/components/layout/attentionConditions.ts` (MOD) | registry / leaf | transform | itself (`:124-226`) | exact |
| `frontend/src/components/layout/ChatLayout.tsx` (MOD, FIRING) | layout | props fan-out | itself `:603-613`, drawer `:694-714`, `:778-803` | exact |
| `frontend/src/components/layout/NavPanel.tsx` (MOD, FIRING) | component | render | itself `:165-202`, `:277-329` | exact |
| `frontend/src/components/layout/AppViewSwitch.tsx` (MOD, reaches 3 phases) | component | render | dot from `ChatArea.tsx:923-929`; bar at `AppViewSwitch.tsx:322-333` | exact |
| `frontend/src/components/layout/AttentionPopover.tsx` (MOD, D-26 + F12 docblock) | component | render | `ProfileMenu.tsx:182-188` (`DropdownMenuItem onSelect`) | exact |
| `frontend/src/components/layout/WaitingOnYouControl.tsx` (NEW) | component | render (trigger) | `ProfileMenu.tsx:99-113` + `NavPanel.tsx:108-134` (`RailItem`) + `:191-202` (badge) | exact |
| `frontend/src/components/layout/WaitingOnYouList.tsx` (NEW) | component | render (menu content) | `AttentionPopover.tsx:64-108` + `ProfileMenu.tsx:145-156` | exact |
| `frontend/src/components/layout/waitingVocabulary.ts` (NEW) | vocabulary leaf | pure | `frontend/src/components/org/inviteDeliveryCopy.ts` + `EngineHealthCard.tsx:72-80` | role-match |
| `frontend/src/components/org/OrgIdentity.tsx` (MOD, UI-D4 `size?: "default" \| "xs"`; NO ledger row yet) | component | render | itself `:66-94` | exact |
| `frontend/src/hooks/__tests__/useWaitingNotices.test.tsx` (NEW) | test | fake timers + mocked supabase | `hooks/__tests__/useSourceAttention.test.tsx:1-90` + `__tests__/hooks/useFolders.test.ts:26-48` | exact |
| `frontend/src/components/layout/__tests__/WaitingOnYouControl.test.tsx` (NEW) | test | component | `components/layout/__tests__/NavPanel.badge.test.tsx:61-91`, `:219-268` | exact |
| `frontend/src/components/layout/waitingVocabulary.test.ts` (NEW, optional) | test | pure | `components/org/inviteDeliveryCopy.test.ts` | exact |
| `NavPanel.badge.test.tsx`, `attentionTab.test.ts`, `ChatLayout.badge.test.tsx`, `LibraryPage.tabAttention.test.tsx`, `sourceComposition.test.tsx` (MOD) | test | pins | themselves (see the research §Q4 pin table) | exact |
| `scripts/vitest-count-gate.cjs` (MOD: BASELINE + TARGETS) | config | gate | `:4426-4428` + `:6542-6544` | exact |
| `docs/HOT-FILE-LEDGER.md` + CLAUDE.md FIRING table (MOD) | docs | ledger | `HOT-FILE-LEDGER.md:12236` (row) + `:27059-27063` (section) | exact |

---

## Pattern Assignments

### `supabase/migrations/219_notifications_realtime.sql` (migration)

**Analog:** `supabase/migrations/032_phase56_realtime.sql:23-29` (the idempotent DO-block). ⛔ Do NOT copy 032's `REPLICA IDENTITY FULL` (`:39`): research §Q3 found it is needed only to filter DELETE events, and D-16 says the migration does nothing else.
```sql
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  -- Already in publication — Phase 55 5a2e237 already added it; ignore.
  NULL;
END $$;
```
**Header + VERIFY shape:** copy from `218_run_waiting_notifications.sql:1-30` (the WHAT IT DOES prose) and `:341-363` (read-only VERIFY that returns one row reading PASS/FAIL):
```sql
-- VERIFY (read-only): expect one row reading PASS.
SELECT CASE
         WHEN <predicates>
         THEN 'PASS'
         ELSE 'FAIL'
       END AS migration_218_verify;
```
For 219 the predicate is `EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications')`. Name the column `migration_219_verify`.

---

### `scripts/full-schema-supplement.sql` (§4 + the header source list)

**Analog:** the file itself. Add one block to §4 (`:226-236`), in the same form as the three blocks already there:
```sql
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```
Also extend the header source line at `:27`: `--   realtime -> migrations 002 (documents), 014 (folders), 032 (messages)` gains `, 219 (notifications)`. The privilege block for 218 (`:865-887`) needs no change. ⚠ This is a FIRING file (`26 / 18 / 888`), so update its ledger row in the same commit.

---

### `backend/app/api/notifications.py` (route, request-response)

**Analog:** `backend/app/api/links.py`

**Imports + router-level 401** (`links.py:22-52`):
```python
from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.dependencies import get_current_user, get_pg_pool

_optional_bearer = HTTPBearer(auto_error=False)

async def _require_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> None:
    """D-11: no credential is a 401 with ``WWW-Authenticate: Bearer`` — checked before any read."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

router = APIRouter(prefix="/links", tags=["links"], dependencies=[Depends(_require_bearer)])
```
→ `APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(_require_bearer)])`. The tag string must equal the one added to `build-public-openapi.cjs`.

**Pool read with the caller from the session** (`links.py:68-93`; D-27):
```python
async def resolve_link(kind: str, item_id: str, request: Request,
                       current_user: dict = Depends(get_current_user)) -> LinkTarget:
    ...
    caller = UUID(str(current_user["id"]))
    if kind in link_resolver.POOL_KINDS:
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await link_resolver.lookup(conn, kind, item, caller)
```
For 301: `GET ""` (or `"/"`), `response_model=WaitingNotices` (a Pydantic model with `notices: list[WaitingNotice]` and `total: int`; each notice is `{id, run_id, org_id, org_name, workflow_name, kind, origin, created_at}`), and the docstring written as public API prose (it lands in the OpenAPI snapshot). There is no `run_in_threadpool`, because asyncpg is already async (F5). The `X-Org-Id` header is never read. The module docblock copies `links.py:1-21` "Security posture" in shape: pool kind, `$1` predicates ARE the wall, read-only, 401 router-level. Optional `limit: int = Query(50, ge=1, le=50)` (V5); a constant 50 is simpler.

---

### `backend/app/db/notifications.py` (add `LIST_OPEN_SQL` + `list_open_notices`), or NEW `services/waiting_notices.py`

**Analog for the statement:** `link_resolver.py:102-114` (`RUN_SQL`, with the caller bound as a parameter, membership through `org_members` inside the statement, and the snapshot-name COALESCE):
```python
RUN_SQL = """
SELECT wr.id,
       COALESCE(NULLIF(t.title, ''), NULLIF(wr.definition_snapshot->>'name', ''), NULLIF(d.name, ''),
                'Workflow run') AS title,
       wr.status, wr.org_id, o.name AS org_name
FROM public.workflow_runs wr
...
WHERE wr.id = $1
  AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)
"""
```
**The second wall** (`db/notifications.py:111-118`, F10): `JOIN public.workflow_runs wr ON wr.id = n.run_id … AND wr.status IN ('active', 'paused')`.

**Statement to ship:** research §Q2's SQL verbatim (`$1` = caller, `$2` = limit, `count(*) OVER () AS total`, `ORDER BY n.created_at ASC, n.id`) plus `wr.origin_kind` (D-28). ⛔ No `auth.uid()`: it is NULL on the pool. No `tool_call_id`, no `messages` join.

**Function shape** (`db/notifications.py:278-280`, a module constant plus a thin async fn that takes the conn or pool, so the live test can run it on the rolled-back connection):
```python
async def still_waiting(pool: asyncpg.Pool, notification_id: UUID) -> bool:
    """D-13: the notice is open, its run is active or paused, and an unanswered prompt exists."""
    return bool(await pool.fetchval(STILL_WAITING_SQL, notification_id))
```
→ `async def list_open_notices(conn, caller: UUID, limit: int = 50) -> tuple[list[Record], int]`, where total = `rows[0]["total"] if rows else 0`.
**NOTE-03 docblock to copy** (`db/notifications.py:24-27`): "nothing here reads the text of a question … scans every `*_SQL` constant". If the SQL goes into `db/notifications.py`, the existing `test_300_notification_drainer` scan covers `LIST_OPEN_SQL` automatically (planner: confirm it globs `*_SQL`). ⚠ Ledger: `db/notifications.py` has a young row (`1/1/326`) and would go to 2 phases. A new `services/waiting_notices.py` needs a new young row instead.

---

### `backend/app/main.py` (one line, plus one import token)

**Analog:** `main.py:914` (append `, notifications` to the `from app.api import … links` line; ⚠ a module named `notifications` must not shadow anything already imported in `main.py`) and `:967`:
```python
app.include_router(links.router)  # Phase 299 D-06 — /links/{kind}/{id}: may I open this item, and in which org
```
→ `app.include_router(notifications.router)  # Phase 301 NOTE-01/05 — GET /notifications: the caller's open waiting-run notices across every org they belong to`

---

### `scripts/build-public-openapi.cjs` + snapshot (D-32, same commit as the route)

**Analog:** `build-public-openapi.cjs:81-88` and `:131`:
```js
const FLAGGED_EXACT = new Set([
  "/workflows/grounding-bundle",
  ...
  "/library/index-summary",
])
...
  {
    name: "Account & org",
    tags: ["org", "org-items", "links", "api-keys", "preferences", "features", "model-registry", "settings", "audit", "feedback"],
  },
```
Add `"/notifications"` to `FLAGGED_EXACT` (it is UI-internal like `/links/`) and `"notifications"` to "Account & org". Then run `backend/venv/Scripts/python scripts/export-openapi.py` and `node scripts/build-public-openapi.cjs`. This keeps `backend/tests/unit/test_276_openapi_snapshot_fresh.py` and `frontend/src/docs/__tests__/publicOpenapi.test.ts:174-196` green. FIRING file → update its ledger row.

---

### `backend/tests/unit/test_301_notifications_route.py` (unit, fake pool)

**Analog:** `backend/tests/unit/test_299_links_route.py`

- **Per-test import** (`:34-37`): `importlib.import_module("app.api.notifications")`, so a missing module makes each test fail RED on its own.
- **Recording fake pool** (`:40-82`): `_Recorder` with `fetch` (this route LISTS, so record `fetch` and make `fetchrow`/`fetchval` raise), and `_install` monkeypatching `mod.get_pg_pool`. Drop the `get_user_pg_connection` arm and assert it is never imported.
- **401 enumeration over every router route** (`:100-133`): copy verbatim, with the path substitution simplified. Assert `rec.calls == []`, i.e. no I/O before the 401.
- **Caller bound from the session** (`:187-201` pattern): `rec.calls[0][1][0] == UUID(CALLER)` where `CALLER = "00000000-0000-0000-0000-000000000001"` (`:30`). The SQL text must equal the module constant.
- **`X-Org-Id` never consulted** (`:204-214`).
- **Source scan with comments/strings stripped** (`:255-277`, `_code_only`): no `run_in_threadpool`, no `get_active_org_id`, no `auth.uid()` in the SQL constant, no `tool_call_id` or `messages` in the SQL, `$1` present.
- **Mounted** (`:104-109`): `"/notifications" in {r.path for r in app.routes}`.
- **Response shape** (`:220-229` pattern): rows → `{"notices": [...], "total": N}`; an empty fetch gives `total == 0`.

---

### `backend/tests/integration/test_301_notifications_live.py` (live, rolled back)

**Analog:** `backend/tests/integration/test_300_notice_triggers_live.py`

- **Skip guards** (`:28`, `:34-70`): `from tests.integration._rls_harness import PG_AVAILABLE, PG_TEST_DSN, requires_pg`; copy `_migration_218_applied` / `requires_218`; `pytestmark = [requires_pg, requires_218]`.
- **Seed world, always rolled back** (`:199-229`): `_world()` gives owner in A+B, `other` in B only, a thread, a published definition "Compliance Gap Report", and an active run. Copy `_user`, `_org`, `_member`, `_run` (`:88-131`, which has `org=`, `status=`, `age_minutes=` knobs for ordering) and `_prompt` / `_response` (`:134-174`). The `_prompt` trigger writes the notice. Do NOT insert notices by hand, so the test proves the real 218 path.
- **Run the module SQL on the seeded conn** (`test_299_links_live.py:94-100` pattern): call `list_open_notices(w.conn, w.owner)` or `conn.fetch(MODULE.LIST_OPEN_SQL, w.owner, 50)` directly. Cases: owner sees both orgs, oldest first, with `org_name` + `workflow_name` + `kind` + `origin`; `other` sees zero of the owner's; delete the owner's `org_members` row for B → B's notice is gone; `UPDATE workflow_runs SET status='completed'` → gone; a run with `origin_kind='schedule'` reads `origin == 'schedule'`; `total` exceeds the rows when `limit=1`.
- **Chat ask exclusion (D-19):** cite/re-run `test_300_notice_triggers_live.py:285-295` (`test_a_chat_ask_user_writes_no_notice`). Do not re-author it.
- ⚠ **Serialize per CLAUDE.md worktree rule 4:** this suite writes to the local DB (insert + rollback).

---

### `backend/tests/unit/test_301_migration_219_shape.py`

**Analog:** `backend/tests/unit/test_298_migration_217_shape.py`. Copy `_migration`, `_strip_comments`, `_norm`, `_code` (`:28-56`) and the CLI-safe name test (`:86-88`). Assertions:
- the comment-stripped SQL contains `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` inside a `duplicate_object` handler;
- negatives like `:107-119`: no `REPLICA IDENTITY`, `GRANT`, `REVOKE`, `CREATE FUNCTION`, `INSERT`, `UPDATE`, `DELETE`, `CREATE POLICY`;
- `scripts/full-schema-supplement.sql` §4 carries the same line, and the header source list names `219`.

---

### `frontend/src/lib/api/notifications.ts` (api client)

**Analog:** `frontend/src/lib/api/links.ts` (docblock, wire types) + `lib/api/sources.ts:306-313` (the signal-accepting GET that throws `ApiError`):
```ts
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

export async function getSourceHealth(signal?: AbortSignal): Promise<SourceHealth> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/health`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load source health (status ${res.status})`, res.status)
  }
  return (await res.json()) as SourceHealth
}
```
→ `getWaitingNotices(signal?)`, which returns `{ notices: WaitingNotice[]; total: number }`, with `kind: "question" | "approval"` and `origin: "app" | "schedule" | "key" | null`. ⛔ NOT added to the `@/lib/api` barrel: copy the `sources.ts:230-235` note, so suites must `vi.mock("@/lib/api/notifications")` separately.

---

### `frontend/src/hooks/useWaitingNotices.ts` (hook, poll + Realtime hint)

**Analog A, fetch truth / abort / keep last verdict:** `useSourceAttention.ts:79-131`:
```ts
const refresh = useCallback(() => {
  inFlight.current?.abort()
  const controller = new AbortController()
  inFlight.current = controller
  getSourceHealth(controller.signal)
    .then((next) => {
      if (controller.signal.aborted) return
      setVerdict(next)
      setLoading(false)
    })
    .catch(() => {
      if (controller.signal.aborted) return
      setLoading(false)          // a real failure keeps the previous verdict
    })
}, [])
...
return { ..., loading, verdictKnown: verdict !== null, refresh }
```
Also copy the `verdictKnown` docblock (`:58-74`) and the RULE 2 Realtime-is-a-hint docblock (`:17-23`). 301 is the hint it anticipates. 301 adds `failedSinceLast` (the latest fetch rejected after an answer), which the UI-SPEC "stale line" state needs: set it true in `.catch`, false in `.then`.

**Analog B, the channel lifecycle:** `useFolders.ts:95-152`:
```ts
useEffect(() => {
  let cancelled = false
  supabase.auth.getSession().then(({ data }) => {
    if (cancelled) return
    if (!data.session?.user.id) return
    const channel = supabase
      .channel("folders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, (payload) => { ... })
      .subscribe()
    channelRef.current = channel
  })
  return () => {
    cancelled = true
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
  }
}, [setFolders])
```
How 301 differs from these analogs (all locked by D-17/D-18/D-33/F11):
- filter `recipient_id=eq.${uid}`, with the channel name scoped by uid;
- the callback calls `refresh()` and NEVER reads `payload` (useFolders patches state from the payload, so do not copy that part);
- `subscribe((status) => { if (status === "SUBSCRIBED") refresh() })`;
- wrap `channel()/on()/subscribe()` in `try/catch`, and don't chain after `.subscribe()` (several suite mocks return `undefined`);
- refetch deps: `activeOrgId` from `useActiveOrgId()` (`hooks/useActiveOrgId.ts`) plus a membership key built as in `LinkGate.tsx:138`: `memberships.map((o) => o.org_id).sort().join(",")` from `useOrgOptional()?.orgs`;
- focus / `visibilitychange` listeners and a 60 s `setInterval` (`useSourceAttention.ts:115-120` shape, fixed interval);
- ⛔ no minute tick here (it would re-render the FIRING shell). The tick lives in the list rows.

---

### `frontend/src/components/layout/attentionConditions.ts` (registry, MOD)

**Analog:** itself.
- **Type** (`:124-156`): `AttentionCondition` becomes a union on a required `mark` (D-31): `LibraryCondition = {mark:"library"; id; title; detail; onOpen; tab?: LibraryTab}` | `WaitingCondition = {mark:"waiting"; id; title; detail; onOpen; runId; orgId; orgName; since; kind; origin?; total}`. Keep `id/title/onOpen` common so `AttentionPopover` compiles. Keep the `tab` docblock and amend the `SEED-231` mentions beside the original (struck through, `SEED-281`).
- **Producer signature** (`:164-167`): `use: (onOpen: () => void) => …` becomes `use: (ctx: AttentionContext) => AttentionCondition[]` with `AttentionContext = { openLibraryHealth: () => void; openRun: (runId: string) => void }`. `useStoppedSourceConditions` (`:176-192`) takes `ctx` and uses `ctx.openLibraryHealth`, and adds `mark: "library" as const` beside `tab: "health" as const` (`:188`). Its `useMemo` deps become `[stopped, ctx.openLibraryHealth]`.
- **Second tenant:** `useWaitingRunConditions(ctx)` calls `useWaitingNotices()` exactly once (D-14), then `useMemo` maps each notice to `{mark:"waiting", id:n.id, runId:n.run_id, …, total, onOpen: () => ctx.openRun(n.run_id)}`.
- **Leaf helper** (copy the `attentionCountByTab` strict-leaf docblock style, `:194-218`): `conditionsForMark(conditions, "library" | "waiting")`, plus `waitingTotal(conditions)` = `waiting[0]?.total ?? 0` (the badge reads the server total, never `.length`, F8). `attentionCountByTab` is unchanged: `if (!condition.tab) continue` already ignores waiting rows. Narrow the type with `"tab" in c` or `c.mark === "library"`.
- **Registry** (`:220-226`): append `{ key: "waiting-runs", use: useWaitingRunConditions }`. Amend the `:221` comment and the D-235-03 docblock (`:5-16`) BESIDE the original, struck through rather than deleted, naming 301 as the deliberate override.
- **Stale docblock F12** (`:132-134`, "no router (`SEED-185`) … never a URL"): amend beside the original.
- ⚠ This file reaches 3 phases with 301, so it needs a ledger row and section in the same commit as its first touch (D-22).

---

### `frontend/src/components/layout/ChatLayout.tsx` (FIRING, several small hunks)

**Analog:** itself, `:603-613`:
```ts
const openLibraryHealth = useCallback(() => onOpenLibraryHealth?.(), [onOpenLibraryHealth])
const attentionConditions = attentionRegistry.ATTENTION_PRODUCERS.flatMap((producer) =>
  producer.use(openLibraryHealth),
)
const attentionCount = attentionConditions.length
const showAttention = attentionCount > 0 && Boolean(onOpenLibraryHealth)
```
The hunks:
1. A memoised ctx: `const attentionCtx = useMemo(() => ({ openLibraryHealth, openRun: (id: string) => openRun?.(id) }), [openLibraryHealth, openRun])`, then `producer.use(attentionCtx)`. ⛔ Keep exactly ONE `ATTENTION_PRODUCERS.flatMap` (pinned by `ChatLayout.badge.test.tsx:393-399` and `LibraryPage.tabAttention.test.tsx:476`). `useMemo` is already imported (`:1`).
2. Partition: `libraryConditions = conditionsForMark(…, "library")`. `showAttention` and the drawer Library badge (`:778-803`, `{attentionCount}`) read the library count only. A new `anyAttention = attentionConditions.length > 0` feeds the dots, NOT gated on `onOpenLibraryHealth` (research Q4).
3. The drawer row mounts after the New Chat block (`:694-714`) and before the "Search chats" `px-1 mb-2` block (`:720`). It is ONE element from the new file (`WaitingOnYouControl` in its drawer variant), and selecting a row also calls `setDrawerOpen(false)`.
4. Pass the any-mark count to `AppViewSwitch` (an existing `attentionCount={showAttention ? attentionCount : 0}` site at `AppViewSwitch.tsx:289` feeds ChatArea's dot). ⛔ Keep `attentionConditions={attentionConditions}` (full list) in the `<AppViewSwitch` mount, and add new props AFTER it with no `/` character (regex pin `LibraryPage.tabAttention.test.tsx:473`, F15).

---

### `frontend/src/components/layout/NavPanel.tsx` (FIRING, mount + filter)

**Analog:** itself.
- **Filter** (`:165-168`): `const attention = attentionConditions ?? []` becomes the library-only list via `conditionsForMark(attentionConditions ?? [], "library")`. `showAttention`, the `attentionBadge` count (`:200`) and the `AttentionPopover conditions={attention}` (`:321-324`) all use it.
- **Mount** after the New chat `RailItem` (`:280-289`) and before `navItems.map` (`:291`), inside the same `flex flex-col gap-1 mt-4` div (`:277`):
  `<WaitingOnYouControl expanded={expanded} conditions={conditionsForMark(attentionConditions ?? [], "waiting")} …state />`. The control must stay presentational, with no supabase import (`NavPanel.test.tsx` mounts without mocks).
- How the loading / failed / stale state reaches the control: the conditions alone cannot carry "never answered". Options: (a) the producer always emits a state carrier, or (b) a separate optional prop threaded beside `attentionConditions`. The UI-SPEC leaves the choice open ("Data the renderers need"). Planner decides. The constraints are that the badge = `total`, no state may be inferred from `.length`, and `ChatLayout` keeps one `flatMap`.

---

### `frontend/src/components/layout/AppViewSwitch.tsx` (non-chat mobile bar dot, D-30)

**Analog for the dot:** `ChatArea.tsx:923-929` (copy byte for byte, do not edit ChatArea):
```tsx
const attentionDot = (attentionCount ?? 0) > 0 ? (
  <span
    data-testid="drawer-trigger-dot"
    aria-hidden="true"
    className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-background"
  />
) : null
```
**Where:** inside the `aria-label="Open navigation"` button at `AppViewSwitch.tsx:325-333`. Add `relative` to its class string, then render the dot. The count is the any-mark prop. AppViewSwitch owns no hooks (D-28 there), so this is pure markup. ⚠ It goes 2→3 phases, so update the ledger row and section in that commit.

---

### `frontend/src/components/layout/AttentionPopover.tsx` (D-26 / BUG-261029-01 + F12)

**Analog:** `ProfileMenu.tsx:182-188`:
```tsx
<DropdownMenuItem
  onSelect={() => onSignOut()}
>
  <LogOut className="h-4 w-4" aria-hidden="true" />
  <span>Sign out</span>
</DropdownMenuItem>
```
Replace the plain `<button data-testid="rail-open-health" onClick=…>` (`:96-105`) with `<DropdownMenuItem data-testid="rail-open-health" onSelect={onOpenLibraryHealth} className="text-primary">`, and add `DropdownMenuItem` to the import (`:36-42`). Amend the `:96-97` comment ("A plain button rather than a menu item…") and the `:18-21` "NO URL, EVER" docblock beside their originals. Test change: `NavPanel.badge.test.tsx:255` `findByRole("button", { name: COPY.popOpenHealth })` → `findByRole("menuitem", …)`. The repair-control negatives (`:244-246`) stay.

---

### `frontend/src/components/layout/WaitingOnYouControl.tsx` (NEW, rail control + drawer variant)

**Analog A, Tooltip + DropdownMenuTrigger nesting:** `ProfileMenu.tsx:99-113`:
```tsx
<DropdownMenu open={open} onOpenChange={setOpen}>
  {collapsed ? (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>{anchor}</DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent side="right" className="ml-2">Account</TooltipContent>
    </Tooltip>
  ) : (
    <DropdownMenuTrigger asChild>{anchor}</DropdownMenuTrigger>
  )}
```
Imports (`ProfileMenu.tsx:29-44`): `cn` from `@/lib/utils`; `Tooltip, TooltipContent, TooltipTrigger` from `@/components/ui/tooltip`; `DropdownMenu…` from `@/components/ui/dropdown-menu`; `Hourglass` from `lucide-react`.

**Analog B, button geometry:** `RailItem`, `NavPanel.tsx:114-123`:
```tsx
"relative flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
expanded ? "w-full justify-start gap-3 px-3" : "w-10 justify-center",
...
<Icon className="w-5 h-5 shrink-0" />
{expanded && <span className="text-sm font-medium truncate">{label}</span>}
```
Plus the UI-SPEC S1 tone: `text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 data-[state=open]:bg-accent/40 data-[state=open]:text-sidebar-foreground`. It is never `aria-current`.

**Analog C, count pill:** `NavPanel.tsx:191-202`, class string copied verbatim. Rendered only when `total > 0`, showing `99+` above 99:
```tsx
<span data-testid="rail-badge" aria-hidden="true" className={cn(
  "absolute min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-[18px] text-center",
  expanded ? "right-3 top-1/2 -translate-y-1/2" : "-top-1 -right-1",
)}>
```
→ `data-testid="rail-waiting-badge"`, trigger `data-testid="rail-waiting-trigger"`, `aria-label` = the vocabulary sentence, no `title`. Drawer variant: `data-testid="drawer-waiting-row"`, `min-h-11 px-4`, an inline (not absolute) pill with `ml-auto`, `bg-warning/10` when total > 0, and the list opened `side="bottom" align="start" sideOffset={4}` (UI-SPEC S3).

---

### `frontend/src/components/layout/WaitingOnYouList.tsx` (NEW, `DropdownMenuContent`)

**Analog A, content shell:** `AttentionPopover.tsx:81-94`:
```tsx
<DropdownMenuContent side="right" align="start" sideOffset={8} data-testid="rail-popover" className="w-72">
  <DropdownMenuLabel>{COPY.popTitle}</DropdownMenuLabel>
  {conditions.map((condition) => (
    <div key={condition.id} data-testid="rail-pop-item" className="px-2 py-1.5">
```
→ `className="w-80 max-h-[min(480px,var(--radix-dropdown-menu-content-available-height))]"`, `data-testid="waiting-popover"`, with rows as menu items.

**Analog B, row as a menu item with `onSelect`:** `ProfileMenu.tsx:145-156`:
```tsx
<DropdownMenuItem
  onSelect={() => {
    if (!isActive) org?.switchOrg(o.org_id)
    setOpen(false)
  }}
>
```
→ `<DropdownMenuItem data-testid="waiting-row" className="items-start gap-2 py-2" onSelect={() => { onAfterSelect?.(); condition.onOpen() }}>`. ⛔ It never calls `switchOrg` (D-08). Row parts: the kind square (`MessageCircleQuestion` / `CircleCheck`, `bg-warning/15 text-warning`, aria-hidden), the title (`font-semibold truncate`), and a second line of `OrgAvatar size="xs"` + org name + `aria-hidden` " · " spans + kind words + optional origin words + waited phrase.

**Org initial rule:** `SwitchOrgPrompt.tsx:69-70`:
```ts
const orgName = target.org_name?.trim() ? target.org_name : THIS_ORG
const initial = (orgName.trim().charAt(0) || "?").toUpperCase()
```
(with the fallback word from the new leaf, "Unnamed org").

**Loading:** `SyrelLoader size="section"` (import as in `ChatLayout.tsx:36`). The minute tick runs only while the content is mounted/open: a `useEffect` `setInterval(() => setNow(Date.now()), 60_000)`, with `Math.max(0, now - created)`. Empty / failed / stale / "and N more" are plain `div`s (`px-2 py-2 text-sm|text-xs text-muted-foreground`), not focusable, with the testids `waiting-empty`, `waiting-stale` and `waiting-more`.

---

### `frontend/src/components/layout/waitingVocabulary.ts` (NEW, zero-import leaf)

**Analog:** `frontend/src/components/org/inviteDeliveryCopy.ts` (whole file, 32 lines):
```ts
/**
 * Phase 300-05 (...) — the one home of what the inviter is told ...
 * ⛔ Zero imports: a pure leaf the dialog and the invitations list both read.
 */
export const INVITE_DELIVERY = {
  titles: { sent: "Invitation sent", failed: "Invitation created", not_configured: "Invitation ready" },
  ...
} as const
export type InviteDelivery = keyof typeof INVITE_DELIVERY.titles
export function deliveryTitle(delivery: InviteDelivery): string { return INVITE_DELIVERY.titles[delivery] }
```
**Age formatter analog:** `EngineHealthCard.tsx:72-80` (the minutes, hours and days ladder):
```ts
const mins = Math.round(ageMs / 60_000)
if (mins < 60) return { text: `swept ${mins}m ago`, fresh: false }
const hrs = Math.round(mins / 60)
if (hrs < 24) return { text: `swept ${hrs}h ago`, fresh: false }
```
Use `Math.floor` and the UI-SPEC words verbatim: "waiting under a minute" / "waiting {m} min" / "waiting {h} hr" / "waiting 1 day" / "waiting {d} days". Also `countSentence(n)` ("Waiting on you" / "1 workflow run is waiting on you" / "{N} workflow runs are waiting on you"), `pill(n)` → `"99+"`, `KIND_WORDS` (question → "needs your answer", approval → "needs your approval", default "needs you"), `ORIGIN_WORDS` (schedule → "scheduled", key → "started by an API key", D-28), `more(n)`, and the empty, loading, failed and stale lines, plus the fallbacks "Untitled workflow" / "Unnamed org". Take every string verbatim from the UI-SPEC Copywriting table.

---

### `frontend/src/components/org/OrgIdentity.tsx` (UI-D4, additive `size`)

**Analog:** itself, `:66-94`:
```tsx
const AVATAR_BASE = "flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold"
export interface OrgAvatarProps { initial: string; pending?: boolean }
export function OrgAvatar({ initial, pending = false }: OrgAvatarProps) {
  return (
    <div data-testid="org-avatar" aria-hidden="true"
      className={cn(AVATAR_BASE, pending ? AVATAR_PENDING : AVATAR_SOLID)}>
```
Add `size?: "default" | "xs"`. The `"xs"` value swaps `h-9 w-9 text-sm` → `h-4 w-4 text-[10px]`, and the default output stays byte-identical. ⚠ There is NO ledger scan row today (F14), so add a young row and section in this commit, or the G-5 gate fails.

---

### Frontend tests

**`useWaitingNotices.test.tsx`.** Copy the `useSourceAttention.test.tsx:21-75` harness: `vi.mock("@/lib/api/notifications", …)` (by its own path), `vi.useFakeTimers()`, and the `flush(ms)` helper `act(async () => { await vi.advanceTimersByTimeAsync(ms) })`, starting with a non-vacuity case ("called exactly once on mount"). For the Supabase channel, copy the hoisted mock from `__tests__/hooks/useFolders.test.ts:26-48` (`mockOn.mockReturnValue(mockChannel)`, `mockSubscribe`, `removeChannel`). Capture the `on` callback and the `subscribe` status callback, then drive them: event → refetch (payload ignored); `"SUBSCRIBED"` → refetch; `channel` throwing → no crash and the poll still runs; unmount → `removeChannel`. For the active-org switch, copy the flippable `orgStore` + `vi.mock("@/providers/OrgProvider")` (`useFolders.test.ts:50-75`). Also copy the `?raw` source fence (`useSourceAttention.test.tsx:28`): the hook source never reads `payload.new`.

**`WaitingOnYouControl.test.tsx`.** Copy `NavPanel.badge.test.tsx:61-91` (fixture builder plus `TooltipProvider` render wrapper) and the `:219-268` open-then-assert shape (`userEvent.setup()`, `user.click(getByRole("button", { name: sentence }))`, `findByTestId("waiting-popover")`). Rows: `getAllByRole("menuitem")`, plus keyboard checks (`user.keyboard("{ArrowDown}{Enter}")`) → `onOpen` / `openRun` called with the run id, and `switchOrg` never called. Absences checked by name (`:244-246` pattern): no dismiss, mark read, snooze or clear control. Assert rendered words, not testid presence alone.

**Pin re-baselines (same commit, never deleted):**
- `NavPanel.badge.test.tsx:113-121` and `attentionTab.test.ts:183-191`: `length` becomes 2 and the keys equal `["stopped-sources","waiting-runs"]`. Amend the comments beside the originals.
- `NavPanel.badge.test.tsx:62-69` `conditions()` fixture: add `mark: "library" as const`.
- `attentionTab.test.ts:127,139,150` + `:209`: `useStoppedSourceConditions(vi.fn())` becomes `({ openLibraryHealth: vi.fn(), openRun: vi.fn() })`.
- `attentionTab.test.ts:160-178`: the "homeless" fixture becomes a typed `mark` literal with its words / seed id updated.
- Inventory fence: copy `attentionTab.test.ts:236-300` (`import.meta.glob(..., { query: "?raw" })`, `rel()`, line-anchored `codeOf` stripper, self-guard) as a SIBLING for `useWaitingNotices\s*\(`, expecting exactly `[["components/layout/attentionConditions.ts", 1]]` (D-14).
- `ChatLayout.badge.test.tsx:94-111`: `channel: vi.fn()` becomes `vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }))`. Add `vi.mock("@/lib/api/notifications", …)` beside `:42-45`, and a waiting-only world: no `rail-badge`, no `drawer-attention-badge`, `drawer-trigger-dot` lit, and `drawer-waiting-row` reading its count.
- `LibraryPage.tabAttention.test.tsx:223-231, 412-415` and `sourceComposition.test.tsx:551-564`: add `mark: "library"` (they are typechecked).

---

### `scripts/vitest-count-gate.cjs` (two knobs)

**Analog:** `:4426-4428` (BASELINE, basename → count with a phase comment) and `:6542-6544` (TARGETS, path):
```js
  "InvitationsTab.test.tsx": 17, // 300-05 — first-ever pin: 8 shipped (...) + 9 'Email not sent' chip / resend-line cases
  "inviteDeliveryCopy.test.ts": 6, // 300-05 — the D-11 sentence verbatim, three titles, ...
...
  "src/components/org/InvitationsTab.test.tsx",
  "src/components/org/inviteDeliveryCopy.test.ts",
```
New files are pinned from the gate's printed `actual`. Existing pins (`NavPanel.badge 14` `:3876`, `ChatLayout.badge 5` `:3877`, `attentionTab 10` `:4032`) may only rise. When raising one, use the `RAISED a -> b at 301-0N` comment form from `:4489`. Basenames must be unique.

---

### Ledger (G-5): `docs/HOT-FILE-LEDGER.md` + the CLAUDE.md FIRING table

**Row analog** (`HOT-FILE-LEDGER.md:12236`, disposition ≤ 200 chars):
```
| [`backend/app/api/links.py`](docs/HOT-FILE-LEDGER.md#backendappapilinkspy) | 1 / 1 / 93 | no (young) | young (created 299-01). GET /links/{kind}/{id}: ... ⛔ no get_active_org_id / require_capability / require_visible; 401 router-level |
```
**Section analog** (`:27059-27063`): `### \`<path>\``, then "**Added AT PLANNING (Phase 301, …) with `0 / 0 / 0`**", then "**Created 301-0N (date) — measured `c / p / l` in its creating commit.**" with the binding invariants. Rows are needed for every new non-test file, plus `OrgIdentity.tsx` (and `db/notifications.py` or `services/waiting_notices.py`). Update the rows for `attentionConditions.ts` (reaches 3, so it lands on the CLAUDE.md FIRING table with a cell ≤ 80 chars), `AppViewSwitch.tsx` (reaches 3), `NavPanel.tsx`, `ChatLayout.tsx`, `AttentionPopover.tsx`, `main.py`, `build-public-openapi.cjs`, `vitest-count-gate.cjs` and `full-schema-supplement.sql`. Run `node scripts/check-hot-file-ledger.cjs <phase-dir>`.

---

## Shared Patterns

### Auth (backend)
**Source:** `backend/app/api/links.py:34-52`. **Apply to:** `api/notifications.py`. A router-level `_require_bearer` (401 + `WWW-Authenticate: Bearer` before any I/O) plus `current_user: dict = Depends(get_current_user)`, with `caller = UUID(str(current_user["id"]))`. The caller is never a request parameter.

### Pool read, with the caller as the wall
**Source:** `link_resolver.py:18-38` (docblock) + `:102-114`. **Apply to:** the list SQL. `$1` = caller in BOTH `n.recipient_id = $1` and the `org_members` join, with `wr.status IN ('active','paused')` as the second wall (F10). ⛔ No `auth.uid()` on the pool.

### Fetch is truth, Realtime is a hint (D-v2.5-03)
**Source:** `useSourceAttention.ts:17-23, 85-104` + `useFolders.ts:95-152`. **Apply to:** `useWaitingNotices`. Every trigger calls `refresh()`; a failure keeps the last verdict; `verdictKnown` separates "never answered" from "nothing waiting".

### Words-first leaf, components write no copy
**Source:** `inviteDeliveryCopy.ts`, `AttentionPopover.tsx:23-26`. **Apply to:** `WaitingOnYouControl`, `WaitingOnYouList`, the drawer row. No raw `question` / `approval` / ISO / UUID on screen.

### Badge family + amber = needs-you
**Source:** `NavPanel.tsx:191-202` (pill class string), `ChatArea.tsx:923-929` (dot). **Apply to:** the rail pill, the drawer pill and the AppViewSwitch dot. Amber only, never the danger token, always `aria-hidden`, and the sentence carried on the control's `aria-label`.

### Corrections beside the original, never overwrites
**Source:** `attentionConditions.ts:28-40` (CORRECTED blocks). **Apply to:** D-235-03, the `SEED-231`→`SEED-281` change, the F12 "no router" docblocks, and the re-baselined pin comments.

### Same-commit sync
The route, the OpenAPI snapshot and `build-public-openapi.cjs` go in one commit (D-32). The migration and supplement §4 go in one commit (D-33). The type change and every typechecked fixture go in one commit (D-31). Each file and its ledger row/section go in one commit.

## No Analog Found

None outright. Partial gaps the planner should take from RESEARCH/UI-SPEC rather than from the code:

| File / concern | Reason |
|---|---|
| The minute-tick waited phrase | No shipped live-ticking relative time inside a Radix menu. The formatter ladder is from `EngineHealthCard.tsx:72-80`; the tick placement comes from research (rows only, while open) |
| Realtime `subscribe(status)` callback | No repo precedent uses the status callback (research Q3). The shape comes from realtime-js 2.99.2 `RealtimeChannel.js:139-188` |
| How the loading/failed/stale state reaches the control | The condition list cannot carry "never answered". The UI-SPEC leaves the carrier to the planner |

## Metadata

**Analog search scope:** `backend/app/api`, `backend/app/services`, `backend/app/db`, `backend/tests/{unit,integration}`, `supabase/migrations`, `scripts/`, `frontend/src/{components/layout,components/org,components/chat,components/settings,hooks,lib/api,__tests__}`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~30 read or grepped
**Pattern extraction date:** 2026-10-30
