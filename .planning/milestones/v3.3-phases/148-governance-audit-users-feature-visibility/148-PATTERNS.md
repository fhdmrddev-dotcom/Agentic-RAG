# Phase 148: Governance — Audit, Users & Feature Visibility - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 16 (8 backend, 1 migration, 7 frontend)
**Analogs found:** 16 / 16 (this phase is almost entirely additive plumbing on 146/147 seams — every target has a live analog)

> RESEARCH.md already carries the verified wiring map, exact signatures, and the
> five architecture patterns. This file pins each target file to its closest
> **existing** analog with copy-from line numbers, so the planner can write
> "copy X from file:lines" instead of re-deriving shapes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/admin.py` (+7 endpoints) | route/controller | CRUD + request-response + file-I/O (CSV) | `admin.py` `kill_run` / `set_flag` / `get_operator_audit_feed` (self) | exact |
| `backend/app/services/governance_service.py` (NEW) | service | CRUD + transform + file-I/O | `operator_service.py` reads + `audit.py` CSV writer | role-match |
| `backend/app/services/operator_service.py` (+grant/revoke/roster) | service | CRUD | `operator_service.py` `seed_operators_from_env` / `is_operator` (self) | exact |
| `backend/app/models/user_settings.py` (+feature_visibility resolver/writer) | model/config | config + CRUD | `user_settings.py` flag fields + `save_app_settings` + TTL cache (self) | exact |
| `backend/app/dependencies.py` (+`require_visible`, ban check) | middleware | request-response | `dependencies.py` `require_operator` + `operator_audit_floor` + `get_current_user` (self) | exact |
| `backend/app/api/features.py` (NEW `GET /features`) | route/controller | request-response | `admin.py` `GET /me` probe | role-match |
| `backend/app/api/{evals,skill_tuner,skill_test_cases,settings,workflows,document_governance}.py` (+`Depends`) | route | request-response | router-level `Depends(require_operator)` in `admin.py:68-72` | role-match |
| `supabase/migrations/098_feature_visibility.sql` (NEW) | migration | config | `supabase/migrations/097_operator_flags.sql` | exact |
| `frontend/src/hooks/useEffectiveFeatures.ts` (NEW) | hook | request-response + event-driven | `frontend/src/hooks/useOperatorProbe.ts` | exact |
| `frontend/src/lib/api.ts` (+`getEffectiveFeatures`, platform-audit/users/visibility) | utility/service | request-response | `api.ts` `getOperatorProbe` + `ApiError` (self) | exact |
| `frontend/src/App.tsx` (nav filter + 403 bounce) | provider/component | event-driven | `App.tsx` `useOperatorProbe` wiring (self) | exact |
| `frontend/src/lib/nav-items.ts` (nav gating source) | config | — | `nav-items.ts` `NAV_ITEMS` (self) | exact |
| `frontend/src/components/admin/AuditTab.tsx` (source switch + chip filters + pager + CSV) | component | CRUD + file-I/O | `AuditTab.tsx` (self) + `ingestion/FilterBar.tsx` chip-strip | role-match |
| `frontend/src/components/admin/UsersAndAccess.tsx` (NEW roster) | component | CRUD | `LockedTab.tsx` (current) → `ActiveRunsSection` victim-naming Kill | role-match |
| `frontend/src/components/admin/FeatureVisibility.tsx` (NEW audience rows) | component | CRUD | `CapabilityGrid` / `MaintenancePanel` toggle rows | role-match |
| `frontend/src/components/admin/ControlRoomPage.tsx` (unlock Users&Access tab) | component/shell | request-response | `ControlRoomPage.tsx` tab-render switch (self) | exact |

## Pattern Assignments

### `backend/app/api/admin.py` — +7 operator endpoints (route, CRUD/request-response/file-I/O)

**Analog:** the file itself — `kill_run` (`admin.py:323-416`), `set_flag` (`admin.py:427-477`), `get_operator_audit_feed` (`admin.py:534-549`).

**Router already carries the gate — do NOT re-add per-endpoint** (`admin.py:68-72`):
```python
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
```
Every new endpoint inherits `require_operator` (byte-identical 404 to non-operators, no RLS backstop). The ban check does NOT belong here — it goes in `get_current_user` (shared path).

**Per-write floor + server-owned label/action** — copy the `set_flag` shape (`admin.py:427-477`). Attach `_floor: None = Depends(operator_audit_floor)` and stamp `request.state.audit_label` / `audit_action` / `audit_is_write` (never free text from the client):
```python
@router.post("/users/{user_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(user_id: UUID, request: Request, _floor: None = Depends(operator_audit_floor)):
    # ... GoTrue ban + in-flight cancel ...
    request.state.audit_label = f"Disabled {victim}'s account"   # 064-B victim naming, like kill_run:414
    request.state.audit_action = "user.disable"
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**Read-that-crosses-users records a deliberate row** — the platform-audit browse GET and CSV export are floor-ATTACHED with `audit_is_write=False` (a receipt, not a mutation), exactly like `record_control_plane_event` (`admin.py:498-515`):
```python
request.state.audit_label = "Viewed platform activity"
request.state.audit_action = "audit.view_platform"
request.state.audit_is_write = False
```
Poll-style GETs stay floor-EXEMPT (the `/backpressure` / `/runs` / `/me` precedent, `admin.py:75,180,518`).

**Cross-user asyncpg read via the live module attribute** (`admin.py:110`, `admin.py:213`, CR-02 note):
```python
pool = deps._pg_pool   # NEVER `from app.dependencies import _pg_pool` (import snapshot stays None)
if pool is None: raise HTTPException(404, ...)
```

**Kill delegation for disable's in-flight cancel** — copy `kill_run`'s delegation (`admin.py:395-416`): fetch the victim's active runs, call the SHARED `_cancel_run_internals` per killable run; never re-implement. Outcome discriminator picks the audit verb.

---

### `backend/app/services/governance_service.py` — NEW (service, query-builder + CSV + roster)

**Analog:** `operator_service.py` (asyncpg read helpers + swallow posture) + `audit.py:80-112` (CSV writer).

**Parameterized, explicitly-scoped, paginated audit query** — RESEARCH Pattern 3 (verbatim SQL in 148-RESEARCH.md §Pattern 3). Column names are code constants; every filter is `$N`; NULL param = "all users" (deliberate cross-user), a value = single-user. `LIMIT`/`OFFSET` always present. Never `SELECT *` unbounded.

**Roster query = ONE join** — RESEARCH §Code Examples "Roster read" (verbatim SQL). `auth.users LEFT JOIN operator_users + doc/thread counts`, `ORDER BY last_sign_in_at DESC NULLS LAST`. Honest last-active (`last_sign_in_at` NULL → "never signed in"). Confirm `documents`/`threads` carry `user_id` (Assumption A1) — the `email_by_user` enrich in `admin.py:261-265` already reads `auth.users` this way.

**CSV export = capped, exact filtered set** — copy the writer shape from `audit.py:95-112`:
```python
output = io.StringIO()
writer = csv.writer(output, lineterminator="\n")
writer.writerow(["timestamp", "action_type", "details", "metadata_json"])
for row in rows:
    writer.writerow([...])
output.seek(0)
return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                         headers={"Content-Disposition": "attachment; filename=platform-audit.csv"})
```
DIFFERENCE from the analog (`audit.py`): drop the `.eq("user_id")` owner filter (operator read), COUNT-first with the SAME WHERE, and **refuse-if-over-cap** (413/422 "Too many rows — narrow the filter") instead of a silent truncate. Use asyncpg (not the supabase builder `audit.py` uses) to stay consistent with the other cross-user reads.

**Swallow-and-log read posture** — copy `get_recent_operator_audit` (`operator_service.py:89-109`): `try/… return resp.data or [] / except: logger.error(...); return []`.

---

### `backend/app/services/operator_service.py` — +grant/revoke/roster helpers (service, CRUD)

**Analog:** the file itself — `seed_operators_from_env` (`operator_service.py:134-166`) for the `INSERT … ON CONFLICT` idempotent grant, `is_operator` (`:29-44`) for the parameterized membership read.

**Grant populates `granted_by` (D-01)** — copy the `seed_operators_from_env` INSERT (`operator_service.py:161-165`), swap `NULL, 'env-bootstrap'` for `$2 (acting operator), 'granted via roster'` and add `ON CONFLICT (user_id) DO UPDATE SET granted_by = EXCLUDED.granted_by` (RESEARCH §Code Examples "Grant / revoke operator").

**Revoke refuses self BEFORE the delete (lockout-proof, Pitfall 7)**:
```python
if target_id == current_operator_id:
    raise HTTPException(409, "You cannot remove your own operator access.")
await pool.execute("DELETE FROM operator_users WHERE user_id = $1", target_id)
```
Same self-guard on `/users/{id}/disable`. Past operator actions stay in `operator_audit_log` forever (`operator_user_id` is a plain uuid, no FK — mig 095).

**Import discipline** — lazy `from app.dependencies import get_pg_pool` INSIDE each function (`operator_service.py:38`, `:119`, `:143`) to avoid the `dependencies ↔ operator_service` cycle.

---

### `backend/app/models/user_settings.py` — +`feature_visibility` resolver + JSONB-merge writer (model/config)

**Analog:** the file itself — the 147 flag fields (`user_settings.py:141-143`), the JSONB read for `provider_model_lists` (`:403-413`), the `_build_settings_from_row` builder (`:493-541`), the TTL cache + `save_app_settings` (`:224-315`), `invalidate_settings_cache` (`:253-256`).

**Add the field to the model + builder** — mirror the flag fields exactly:
- model (like `:141-143`): `feature_visibility: dict = {}`
- builder (like `:538-540`): `feature_visibility=row.get("feature_visibility") or {}` — but handle the double-serialization defensively the way `provider_model_lists` does (`:407-413`: `if isinstance(x, str): json.loads`).

**`feature_audience()` resolver + `_GOVERNED_FEATURES` cold-default map** — RESEARCH §Pattern 4 (verbatim). The `_GOVERNED_FEATURES` dict is the ONLY place D-06 polarity lives (deny skill_studio/model_management, allow workflow_authoring/governance_health). Reads through the sync `load_app_settings()` (`:602-609`) so it never blocks; `try/except → hardcoded default` mirrors `document_management_enabled` (`:669+`) and `maintenance_mode` (`:721-731`).

**`set_feature_visibility()` = atomic per-key JSONB `||` merge, NOT `save_app_settings`** — RESEARCH §Pattern 4 (verbatim). `save_app_settings` (`:259-315`) does `SET col = $N` (whole-column) → lost-update clobber under concurrent toggles (Pitfall 4). Use `feature_visibility = coalesce(feature_visibility,'{}'::jsonb) || $1::jsonb`. Validate `feature`/`audience` against code allowlists (never free text — mirrors `set_flag`'s `_FLAG_KEYS` guard at `admin.py:443-447`). Call `invalidate_settings_cache()` (`:253`) after the write.

**TTL substrate is already correct — do NOT build new flag infra.** The 30s per-worker cache (`:219-250`) + `invalidate_settings_cache` is exactly what 147 chose over pub-sub; audience flips propagate "on their next call" within the window.

---

### `backend/app/dependencies.py` — +`require_visible(feature)` + ban check in `get_current_user` (middleware)

**Analog:** the file itself — `require_operator` (`dependencies.py:201-218`) for the gate shape, `operator_audit_floor` (`:221-257`) for the yield-dependency idiom, `get_current_user` (`:107-118`) as the seam being modified, `get_pg_pool` (`:78-104`) for the asyncpg read.

**`require_visible(feature)` factory** — RESEARCH §Pattern 1 (verbatim). A closure returning an async `_dep`. `is_operator(uid)` → no-op; `feature_audience(feature) == "everyone"` → no-op; else 403 with the plain body (D-03 — NOT 404; `/admin` keeps its 404). This mirrors the 091/147 whitelist-gate no-op pattern. `is_operator` is the ONE swappable boundary (SEED-115 forward-compat).

**Ban check INSIDE `get_current_user` (closes the JWT window, Pitfall 1)** — modify the shared path at `dependencies.py:107-118`, AFTER `supabase.auth.get_user(token)` validates, BEFORE returning the identity:
```python
# after response.user resolves, before `return {"id": ..., "email": ...}`:
if await _is_banned(response.user.id):
    raise HTTPException(403, "This account is disabled — contact your administrator.")
```
`_is_banned` FAILS OPEN on DB error (RESEARCH §Pattern 2 verbatim) — a blip must never lock out every user (the `maintenance_mode` "no self-inflicted outage" polarity, same as 097 `:22-24`). Do NOT trust `supabase.auth.get_user` to reject bans (Pitfall/anti-pattern — it does not on a live token). This is the ONLY shared-path edit in the phase; keep it one asyncpg `fetchrow` (~1ms, Assumption A3).

**Do NOT touch** `authenticate_operator_request` (`:171-198`) or `require_operator` — the /admin 404 contract stays byte-identical.

---

### `backend/app/api/features.py` — NEW `GET /features` (route, request-response)

**Analog:** `admin.py:518-531` `get_operator_me` — a thin authed GET, but gated by `get_current_user` NOT `require_operator` (non-operators MUST reach `/features` to learn their map — see anti-patterns).

RESEARCH §Pattern 5 (verbatim): `{"features": {f: (op or feature_audience(f)=="everyone") for f in _GOVERNED_FEATURES}}`. Operator → all True; end user → True only for Everyone features. Mount the router in `main.py` alongside the other feature routers (not under `/admin`).

---

### Governed feature routers — +`Depends(require_visible("..."))` (route, request-response)

**Analog:** the router-level `Depends(require_operator)` usage in `admin.py:68-72` — but here it is attached **per-endpoint**, NOT at the router level (Pitfall 3 / anti-pattern: router-gating `settings.py`/`workflows.py` 403s the chat model picker + workflow Run carve-outs).

**Exact wiring map (verified in 148-RESEARCH.md §Pattern 1 table):**

| Feature key | Router(s) | Gate | CARVE-OUT (leave ungated) |
|-------------|-----------|------|---------------------------|
| `skill_studio` | `evals.py`, `skill_tuner.py`, `skill_test_cases.py` | all endpoints | — |
| `model_management` | `settings.py` | `GET ""`, `PUT ""`, `GET /reembed-progress`, `POST /reembed` | **`GET /settings/providers`** (chat model picker) |
| `workflow_authoring` | `workflows.py` | `POST ""`, `GET /drafts`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/publish`, `POST /generate` | **`GET /published`, `GET /starters`** + the workflow launch in `threads.py:937` |
| `governance_health` | `document_governance.py` | all endpoints | `knowledge_health.py` stays ungated (Open Q2 / A4 — confirm at planning) |

Attach as a second dependency alongside the endpoint's existing `Depends(get_current_user)`.

---

### `supabase/migrations/098_feature_visibility.sql` — NEW (migration)

**Analog:** `supabase/migrations/097_operator_flags.sql` (exact — same app_settings additive-column shape, same apply/parity header).

Copy 097's header verbatim (APPLY via SQL editor, THEN `bash scripts/regenerate-full-schema.sh` no-reset, THEN commit migration + full-schema together; CLOUD PARITY note). Body per RESEARCH §Pattern 4: `ADD COLUMN IF NOT EXISTS feature_visibility jsonb NOT NULL DEFAULT '{}'::jsonb` + the D-05 day-one `UPDATE … jsonb_build_object(...)` seed + `INSERT … ('global') ON CONFLICT DO NOTHING` (097 `:32`). Next free number confirmed **098** (live tree tops out at 097). Add `feature_visibility` to `main._DIRECT_COLUMNS`? — NO: it is written by the dedicated JSONB-merge, not `save_app_settings`; it does NOT join the `_DIRECT_COLUMNS` set (`main.py:98-111`). It only needs the model field + builder read.

---

### `frontend/src/hooks/useEffectiveFeatures.ts` — NEW (hook)

**Analog:** `frontend/src/hooks/useOperatorProbe.ts` (exact — mirror the whole file).

One-shot per-session fetch keyed to `userId` (WR-01 — NOT App mount; re-probes on user switch, clears on sign-out). Copy the `cancelled` local-flag guard (`useOperatorProbe.ts:45-83`), the fail-closed catch (`:71-75`). DIFFERENCE: resolve to a features map `{}` (hide governed features) on error instead of `null` identity. Add a `refetch()` for the graceful-bounce re-check (D-04).

---

### `frontend/src/lib/api.ts` — +client functions (utility/service)

**Analog:** the file itself — `getOperatorProbe` (`api.ts:3563-3569`), `ApiError` (`:20-22`), the `OperatorAuditRow` interface (`:3548-3556`).

`getEffectiveFeatures()` mirrors `getOperatorProbe` (`:3563-3569`) but is a plain 200 fetch (not 404→null — every user has a map). Platform-audit browse/export, roster, disable/enable, grant/revoke, and visibility-set calls follow the `getBackpressure`/`killRun` shape already in this file. The **graceful-bounce** relies on `ApiError.status` (`:20-22`): governed pages `catch (err.status === 403)`.

---

### `frontend/src/App.tsx` — nav filter + ActiveView 403 bounce (provider/component)

**Analog:** the file itself — the `useOperatorProbe(user?.id ?? null)` wiring (`App.tsx:102`) threaded as `isOperator` into `ChatLayout` (`:126`).

Add `useEffectiveFeatures(user?.id ?? null)` alongside the operator probe (`:102`). Filter `NAV_ITEMS` (nav-items.ts) by the effective map before passing to the nav; gate the `<ActiveView>` render for governed views. The 403 graceful bounce: a governed page's next data fetch throws `ApiError.status === 403` → show plain refusal + `setActiveView("chat")` (`activeView` state already at `:71`).

---

### `frontend/src/components/admin/AuditTab.tsx` — source switch + chip filters + pager + CSV (component)

**Analog (structure):** the current `AuditTab.tsx` (presentational leaf, props-in-DOM-out) + `ControlRoomPage.tsx` as the fetch owner. **Analog (chip-filter grammar, 029-A):** `frontend/src/components/ingestion/FilterBar.tsx`.

The current `AuditTab` (`AuditTab.tsx:36-84`) is a pure leaf that renders `rows` + a "search, date filters & export coming soon" note (`:77-79`) — this phase DELIVERS exactly that deferred affordance. The shell (`ControlRoomPage`) owns the fetch (mirror `fetchAudit` at `ControlRoomPage.tsx:197-204`); AuditTab gains local filter state.

**Chip-strip grammar — copy from `FilterBar.tsx`:**
- the chip render + remove-X shape (`FilterBar.tsx:225-255`): `rounded-full border pl-3 pr-1.5`, an editable label button + an `X` remove button, plus a dashed `+ condition` chip.
- the live debounced count → reuse for the "N entries match" beat that names the export count (`FilterBar.tsx:118-155`, `:257-274`).
- the source switch (operator | platform) is a new 2-position toggle; the amber-at-zero count signal (`FilterBar.tsx:262-263`) is the trust cue.
- CSV button triggers the api.ts export call; on switch-to-Platform show the quiet "looking at user activity is itself recorded" note.

The `✎ … recorded` write-mark + `formatWhen` timestamp rendering already exist in the current AuditTab (`AuditTab.tsx:24-33`, `:58-69`) — keep them.

---

### `frontend/src/components/admin/UsersAndAccess.tsx` — NEW roster (unlocks the locked tab)

**Analog (unlock seam):** `ControlRoomPage.tsx:468-472` renders `<LockedTab>` for `users-access` today; this phase swaps it for `<UsersAndAccess />`. **Analog (victim-naming guard/table):** `ActiveRunsSection.tsx` (the 064-B victim-naming Kill row) + `admin.py kill_run`'s victim vocabulary.

Flip `TABS[users-access].locked` false (`ControlRoomPage.tsx:92-97`) and add the tab-body branch next to `activeTab === "audit"` (`:468`). The roster is an instrument table: last-active honesty (`never signed in` italic), Disable = a victim-naming confirm SHEET ("loses access immediately… their documents/chats kept… reversible… recorded"), Enable = direct (deliberate asymmetry). Self-rows disabled with tooltip (courtesy; the server self-guard is the real wall). Grant/revoke = AMBER sheet naming blast radius (068-A). Every write flips the row to a `✎ … · recorded` receipt + band-marker flash (062-A) — same receipt vocabulary the CapabilityGrid toggle already uses.

---

### `frontend/src/components/admin/FeatureVisibility.tsx` — NEW audience rows (component)

**Analog:** `CapabilityGrid.tsx` + `MaintenancePanel.tsx` — the toggle-row + consequence-line grammar (rendered together at `ControlRoomPage.tsx:432-442`).

Audience rows: Everyone | ⛨ Operators only (extensible-audience contract — the UI reads/writes an enum, NEVER a boolean). Operators-only styling = amber-warmed, NEVER kill-switch red, and it never sits next to the kill switches (the rejected 069-C in-Controls placement). Flipping to Operators-only reveals the concrete consequence line ("End users no longer see X — and their API calls to it are refused server-side") + expandable "what exactly this controls". Lives on Users & Access, below the roster.

---

### `frontend/src/components/admin/ControlRoomPage.tsx` — unlock + thread fetchers (shell)

**Analog:** the file itself — the tab-def array (`:90-111`), the fetcher pattern (`:173-204`), the tab-render switch (`:378-472`).

Unlock `users-access` (`:92-97` → `locked: false`), add its render branch (`:468-472`), and add roster/visibility fetchers mirroring `fetchAudit` (`:197-204`) with the same `alive.current` guard + per-fetch `.catch` honest-degrade posture.

## Shared Patterns

### Authorization gate (operator)
**Source:** `backend/app/dependencies.py:201-218` (`require_operator`) + `:171-198` (`authenticate_operator_request`)
**Apply to:** all 7 new `admin.py` endpoints — inherited from the router gate (`admin.py:68-72`), NOT re-added per-endpoint.
```python
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
# byte-identical 404 to non-operators; SOLE authority (no RLS backstop on service-role reads)
```

### Feature-visibility gate (`require_visible`)
**Source:** RESEARCH §Pattern 1 (new; models `require_operator` + the 091/147 whitelist no-op)
**Apply to:** the governed feature routers per the wiring table — per-endpoint, with hard Run carve-outs. 403 (D-03), not 404.

### Append-only audit floor
**Source:** `backend/app/dependencies.py:221-257` (`operator_audit_floor`) + `operator_service.py:47-86` (`write_operator_audit`)
**Apply to:** every new WRITE endpoint (`user.disable/enable`, `operator.grant/revoke`, `visibility.set`) and the two cross-user READS (`audit.view_platform`, `audit.export` — `audit_is_write=False`). Server owns the label/action (never client free text — `admin.py:490-495` precedent). Poll GETs stay floor-EXEMPT.
```python
@router.post(".../disable", ...)
async def _(..., _floor: None = Depends(operator_audit_floor)):
    request.state.audit_label = f"Disabled {victim}'s account"
    request.state.audit_action = "user.disable"   # is_write inferred from POST (dependencies.py:151,244-246)
```
Action vocabulary (free-text `action`, plain-sentence `label`): RESEARCH §Code Examples "_ACTIONS" map.

### Off-loop DB I/O (`run_in_threadpool` / asyncpg)
**Source:** `operator_service.py` `aexec(...)` wrapper (supabase-py, D-v2.5-01) + `admin.py:110,213` live-pool asyncpg reads
**Apply to:** all new endpoints. GoTrue admin `update_user_by_id` (blocking httpx) → `run_in_threadpool` (RESEARCH §Pattern 2). asyncpg reads via `deps._pg_pool` (live attribute, never an import snapshot — CR-02).

### app_settings 30s TTL cache (read audience) + JSONB-merge (write audience)
**Source:** `user_settings.py:224-250` (`_load_settings_from_db`), `:253-256` (`invalidate_settings_cache`), `:602-609` (sync `load_app_settings`)
**Apply to:** `feature_audience()` reads the sync cache; `set_feature_visibility()` writes via atomic `||` merge (NOT `save_app_settings`'s whole-column `SET`, `:294-307`) then invalidates. Per-worker skew ≤30s is the honest "on their next call".

### CSV export
**Source:** `backend/app/api/audit.py:80-112` (`export_audit_logs` — `csv.writer` + `io.StringIO` + `StreamingResponse`)
**Apply to:** the platform-audit CSV. Copy the writer/stream shape; DROP the owner `.eq(user_id)`, ADD count-first cap + refuse-if-exceeded, RECORD `audit.export` with the exact count.

### Shared cancel discipline (disable's in-flight kill)
**Source:** `backend/app/services/run_lifecycle.py:158-...` (`_cancel_run_internals`) — used by `admin.py kill_run:399-407`
**Apply to:** `disable_user` — look up the victim's `runs:active`, delegate per killable run; never re-implement (D-062 discipline must not drift).

### Frontend session probe → render gating
**Source:** `frontend/src/hooks/useOperatorProbe.ts` (whole file) + `App.tsx:102` wiring + `api.ts:20-22` `ApiError`
**Apply to:** `useEffectiveFeatures` (mirror), nav filtering in `App.tsx`, and the 403 graceful bounce (`catch err.status === 403`). RENDER-ONLY — the API is the security authority.

### Chip-strip filter grammar (029-A)
**Source:** `frontend/src/components/ingestion/FilterBar.tsx:225-274` (chips + remove-X + `+ condition` + live count)
**Apply to:** the AuditTab action-type/date-range chip strip + the "N entries match" count that the CSV export names.

### Locked-tab → unlocked-tab seam
**Source:** `ControlRoomPage.tsx:90-111` (tab defs) + `:468-472` (`<LockedTab>` fallback branch)
**Apply to:** flip `users-access` `locked: false`, add the `<UsersAndAccess/>` render branch. `LockedTab.tsx` stays for `model-registry` (149) / `secrets` (150).

## No Analog Found

None. Every target composes an existing 146/147/031/114 seam. The two "net-new" items still model an analog:

| File | Role | Data Flow | Modeled on |
|------|------|-----------|------------|
| `governance_service.py` (platform audit query) | service | CRUD | RESEARCH §Pattern 3 SQL + `operator_service.py` posture |
| `require_visible` factory | middleware | request-response | `require_operator` + 091/147 whitelist no-op |
| `_is_banned` in `get_current_user` | middleware | request-response | new per-request check; fail-open like the 097 cold-read polarity |

## Metadata

**Analog search scope:** `backend/app/{api,services,models}`, `supabase/migrations`, `frontend/src/{components/admin,components/ingestion,hooks,lib}`
**Files scanned (read in full-relevant part):** `admin.py`, `audit.py`, `dependencies.py`, `operator_service.py`, `run_lifecycle.py`, `user_settings.py`, `main.py`, `097_operator_flags.sql`, `useOperatorProbe.ts`, `nav-items.ts`, `api.ts` (operator section), `LockedTab.tsx`, `AuditTab.tsx`, `ControlRoomPage.tsx`, `FilterBar.tsx`
**Migration numbering confirmed:** live tree tops out at `097_operator_flags.sql` → next free **098**
**Pattern extraction date:** 2026-07-11
