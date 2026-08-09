# Phase 166: Org-Admin Shell + Org Switcher + Profile-Menu Anchor - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 16 (9 new · 7 modified)
**Analogs found:** 16 / 16 (every new/modified file composes a shipped v3.3 pattern — this phase invents almost nothing structurally)

> **This is a COMPOSITION phase.** The org surface is the *user-side mirror* of the shipped operator Control-Room surface (Phase 146–149). Almost every new file is a near-clone of an operator analog with the amber → indigo re-tint and the authority swapped from `require_operator` / `is_operator` to `current_user_has_permission(active_org, 'org:manage'|'org:audit_view')`. **No new migration** — mig 104's `current_user_has_permission()` SECDEF helper + seeded `role_permissions` are the substrate (read-only reference).

---

## ⚠️ TWO LANDMINES — read before planning any backend/streams work

### LANDMINE 1 — `audit_log` has NO authenticated SELECT policy (backs ADMIN-04)
`public.audit_log` has RLS **ENABLED** but **only an authenticated INSERT policy** (mig 108 / full-schema.sql:4502) — **there is NO authenticated SELECT policy**. A per-request user-JWT read is RLS-DENIED and returns an **empty page**, silently breaking the audit browser. This is documented verbatim in the header of the EXISTING member-facing reader `backend/app/api/audit.py:13-21`.

**Consequence for the new org-scoped audit endpoint (D-166-04):** it MUST be **service-role client + explicit app-code authz**, NOT a pure-RLS read:
- Caller holds `org:audit_view` → return **all org rows** via `.eq("org_id", active_org)`.
- Caller lacks it → **own rows only** via `.eq("org_id", active_org).eq("user_id", caller_id)` + the RLS-honest "you see only your own" banner (never a silent empty list — D-166-04 / sketch 080-A).
- Exclude `harness_audit` + `operator_audit_log` (D-166-04). Source is `public.audit_log` ONLY.

Copy the query-builder shape (`_apply_filters`, `_since_to_dt`) from `audit.py` and ADD an org predicate. Mark the `Depends(get_supabase)` with the `# service-role: audit_log has NO authenticated SELECT policy…` comment exactly as `audit.py:94,131` does.

### LANDMINE 2 — `StreamsProvider.tsx` is a G-5 HOT FILE — preserve the 067.5 Branch-D3 guard (D-166-08)
`frontend/src/providers/StreamsProvider.tsx` (3204 lines) is on the **G-5 hot-file ledger**. The org-switch teardown (tear down subscriptions → clear thread buckets → refetch) MUST reuse the **Phase-067.5 Branch-D3 `clearThreadBucket` guard at lines 1331-1348** — the predicate that refuses to wipe a bucket whose thread is mid-stream (`tid && !sendingThreadsRef.current.has(tid)`). Do NOT re-implement a bucket wipe; do NOT regress the per-thread clear. The L-068-01 comment at line 24 and the acceptance-criterion grep both lock this predicate verbatim. Any new switch-org teardown routes THROUGH this existing action, it does not replace it.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `frontend/src/providers/OrgProvider.tsx` | React provider (context) | event-driven (switchOrg → teardown/refetch) | `providers/TechnicalNamesProvider.tsx` (context shape) + `hooks/useAuth.ts` (localStorage/session) | role-match (compose 2) |
| **NEW** `frontend/src/hooks/useOrgPermissionsProbe.ts` | hook (probe) | request-response (fail-closed) | `hooks/useOperatorProbe.ts` | exact |
| **NEW** `frontend/src/components/org/OrgAdminShell.tsx` | component (band+tabs shell) | request-response (lazy per-tab fetch) | `components/admin/ControlRoomPage.tsx` | exact |
| **NEW** `frontend/src/components/org/OrgBand.tsx` | component (presentational leaf) | props-in/DOM-out | `components/admin/OperatorBand.tsx` | exact (indigo re-tint) |
| **NEW** `frontend/src/components/org/OrgMembersTab.tsx` | component (roster, read-only) | CRUD-read | `components/admin/UsersAndAccess.tsx` | role-match (strip writes) |
| **NEW** `frontend/src/components/org/OrgAuditTab.tsx` | component (audit list) | request-response (paged) | `components/admin/AuditTab.tsx` | role-match (lighter cut) |
| **NEW** `frontend/src/components/org/OrgSettingsTab.tsx` | component (light org-config home) | CRUD | `pages/SettingsPage.tsx` (personal sliver) | partial |
| **NEW** `frontend/src/components/layout/ProfileMenu.tsx` | component (rail-footer popover) | request-response | `components/layout/NavPanel.tsx` footer + `hooks/useAuth.ts` | role-match (compose 2) |
| **NEW** `backend/app/api/org.py` | FastAPI router | request-response | `backend/app/api/admin.py` | exact (gate swap) |
| **MODIFIED** `backend/app/dependencies.py` | FastAPI dependencies | request-response (authz) | `require_operator` / `authenticate_operator_request` / `require_visible` factory (same file) | exact |
| **MODIFIED** `frontend/src/App.tsx` | provider tree + probe host | — | self (`useOperatorProbe` mount pattern) | exact |
| **MODIFIED** `frontend/src/components/layout/NavPanel.tsx` | left rail (footer) | — | self (operator shield, lines 181-198) | exact |
| **MODIFIED** `frontend/src/providers/StreamsProvider.tsx` ⚠️G-5 | React provider | event-driven | self (`clearThreadBucket` 1331-1348) | exact (reuse, don't regress) |
| **MODIFIED** `frontend/src/lib/api.ts` | API client | request-response | self (`getAuthHeaders` 75-83 + `getOperatorProbe`/`getUsersRoster`/`getPlatformAudit`) | exact |
| **MODIFIED** `frontend/src/components/layout/ChatLayout.tsx` | layout / view switch | — | self (ControlRoomPage mount branch, lines 18/575/583) | exact |
| **REUSED AS-IS** `frontend/src/components/admin/LockedTab.tsx` | presentational leaf | — | itself (import + wire 4 locked tabs) | exact (no new file) |

---

## Pattern Assignments

### NEW `frontend/src/providers/OrgProvider.tsx` (React provider, event-driven)

**Analogs:** `providers/TechnicalNamesProvider.tsx` (the context-sharing shape) + `hooks/useAuth.ts` (session/persistence) + the D-166-08 teardown hook into StreamsProvider.

**Context shape — copy verbatim from `TechnicalNamesProvider.tsx:39-83`** (throwing writer hook + non-throwing optional accessor + memoized value):
```tsx
const OrgContext = createContext<OrgValue | null>(null)
export function OrgProvider({ children }: { children: ReactNode }) {
  const [activeOrgId, setActiveOrgId] = useState<string | null>(getInitialOrg)
  // persist to localStorage on every change (TechnicalNamesProvider:68-71 idiom)
  const value = useMemo<OrgValue>(() => ({ activeOrgId, orgs, switchOrg }), [activeOrgId, orgs, switchOrg])
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
export function useOrg(): OrgValue { /* throw-if-null — writers */ }
export function useOrgOptional(): OrgValue | null { /* leaf reads */ }
```
Expose `{ activeOrgId, orgs (membership set), role, switchOrg() }`. Persistence key mirrors `TechnicalNamesProvider.tsx:37` (`STORAGE_KEY` + `typeof window` guard) — the active org is a per-device UI preference; the **server** re-validates `X-Org-Id` (D-166-06), so localStorage is only a hint.

**Mount point (D-166-07):** `App.tsx:209` currently mounts `<StreamsProvider>` as the outer wrapper. `<OrgProvider>` goes **ABOVE** `<StreamsProvider>` so a switch can reach into the streams teardown from outside.

**switchOrg teardown (D-166-08 — the load-bearing beat):** `switchOrg()` must (1) set the new `X-Org-Id` source, (2) tear down in-flight subscriptions + call the existing StreamsProvider `clearThreadBucket` guarded action (StreamsProvider.tsx:1331-1348 — DO NOT bypass its `!sendingThreadsRef.current.has(tid)` predicate), (3) refetch. Realtime is best-effort, never the isolation boundary — the fetch-on-reconnect is the source of truth (CLAUDE.md D-v2.5-03).

---

### NEW `frontend/src/hooks/useOrgPermissionsProbe.ts` (hook, request-response, fail-closed)

**Analog:** `hooks/useOperatorProbe.ts` (86 lines) — **clone it near-verbatim.** This is an exact-shape reuse: one-shot per-session probe, keyed to `userId` (WR-01, not App mount), fail-closed on error, cancel-flag guard against a late resolve from a prior user.

Copy the effect skeleton verbatim from `useOperatorProbe.ts:45-83`:
```ts
useEffect(() => {
  let cancelled = false
  if (!userId) { setPerms(CLOSED); setLoading(false); return () => { cancelled = true } }
  setPerms(CLOSED); setLoading(true)
  getOrgPermissions(activeOrgId)                         // NEW api.ts fn (mirrors getOperatorProbe)
    .then((p) => { if (!cancelled) setPerms(p) })
    .catch(() => { if (!cancelled) setPerms(CLOSED) })   // fail-closed (useEffectiveFeatures:71-75)
    .finally(() => { if (!cancelled) setLoading(false) })
  return () => { cancelled = true }
}, [userId, activeOrgId])
```
Return `{ canManage, canAuditView, loading }` (both `org:manage` and `org:audit_view` come back in one probe — mirror `useEffectiveFeatures.ts`'s single-map return rather than two separate hooks). **Re-key on `activeOrgId` too** (not just `userId`) — permissions are org-scoped, so switching org must re-probe. Fail-closed default = `{ canManage: false, canAuditView: false }` (the `useEffectiveFeatures.ts:40` `{}` polarity).

**SECURITY NOTE to carry into the JSDoc (from `useOperatorProbe.ts:32-37`):** the probe is RENDER-ONLY. The backend `require_org_manage` gate is the sole authority — a forged `canManage=true` reaches no data.

---

### NEW `frontend/src/components/org/OrgAdminShell.tsx` (component, band+tabs shell)

**Analog:** `components/admin/ControlRoomPage.tsx` (797 lines) — the **direct composition source** (sketch 080-A reuses the 061-B band+tabs shape).

**Tab-def table — copy the `TABS` const shape from `ControlRoomPage.tsx:104-135`.** 7 tabs: 3 live + 4 locked (D-166-01):
```tsx
const TABS: readonly TabDef[] = [
  { id: "members",  label: "Members",  locked: false },   // OrgMembersTab (read-only)
  { id: "audit",    label: "Audit",    locked: false },   // OrgAuditTab (lighter)
  { id: "settings", label: "Settings", locked: false },   // OrgSettingsTab (org-config home)
  { id: "invitations", label: "Invitations & Roles", locked: true, lockedDescription: "Inviting people and managing roles is coming soon." },
  { id: "sso",          label: "SSO",          locked: true, lockedDescription: "Single sign-on setup is coming soon." },
  { id: "subscription", label: "Subscription", locked: true, lockedDescription: "Plan and billing management is coming soon." },
  { id: "retention",    label: "Retention",    locked: true, lockedDescription: "Data-retention controls are coming soon." },
]
```
**No roadmap numbers in `lockedDescription`** (T-146-10 / LockedTab.tsx:5-11 HARD RULE — the plan grep gate asserts phase-number absence).

**Tablist render — copy `ControlRoomPage.tsx:594-628` verbatim** (`role="tablist"` on a `<div>` host not `<nav>` — the A11Y-01 note at line 590; the `Lock` glyph on locked tabs at line 617; the active `bg-primary/10` treatment). Re-tint the active/band accents to org-indigo (NOT amber — sketch 080-A: amber stays reserved for the operator zone).

**Shell = owner of fetch, tabs = pure leaves** (the 148-PATTERNS split, `ControlRoomPage.tsx:200-310`): the shell holds `alive.current` guard (`ControlRoomPage.tsx:231`), the lazy per-tab fetch (`ControlRoomPage.tsx:392-395` — fetch Members on tab-open, Audit on tab-open), and the honest-degrade `.catch` that keeps last-known values (`ControlRoomPage.tsx:239-293`). Tabs receive rows + callbacks as props.

**Body switch — copy `ControlRoomPage.tsx:630-793`** (`activeTab === "members" ? <OrgMembersTab…/> : activeTab === "audit" ? <OrgAuditTab…/> : … : <LockedTab title={active.label} description={active.lockedDescription} />`). The final `<LockedTab>` fallthrough at line 792 is the exact wiring for the 4 locked tabs.

**Entry-point mount (reachability triad — the Phase-118 built-but-unreachable lesson):** mount it in `ChatLayout.tsx` exactly as `ControlRoomPage` is mounted (see the ChatLayout modify below), gated on `canManage`.

---

### NEW `frontend/src/components/org/OrgBand.tsx` (presentational leaf)

**Analog:** `components/admin/OperatorBand.tsx` (87 lines) — **near-verbatim clone, amber → indigo.**

Copy the whole leaf from `OperatorBand.tsx:36-87` and change:
- `<Shield className="…text-amber-400"/>` → indigo tint (sketch 079-C/080-A org-indigo; matches the rail shield).
- Border/gradient `border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07]` (line 38) → indigo equivalents.
- The `OPERATOR` chip (lines 46-48) → an `ORG ADMIN` chip (indigo) + the `◆ Org-admin` / `Member` **role badge** (D-166-05 copy: indigo `admin` chip / muted `member` chip).
- Add org name to the label (line 41-44 region).
- **KEEP** the "every action recorded" 062-A recording marker (lines 58-74) verbatim — sketch 080-A rejects variant C precisely because it drops this honesty beat. `recordingPulse` stays prop-controlled (pure leaf, no state — the `OperatorBand.tsx:22-33` prop contract).

Pure presentational leaf — props in, DOM out, no fetch/auth (the `OperatorBand.tsx:11-15` contract).

---

### NEW `frontend/src/components/org/OrgMembersTab.tsx` (component, read-only roster)

**Analog:** `components/admin/UsersAndAccess.tsx` (518 lines) — the 068-A instrument-table roster. **Take the render + search, DROP every write** (D-166-01: Members is read-only; invite/role editing is Phase 167).

Reuse from `UsersAndAccess.tsx`:
- The section header + client-side search-over-loaded-page (`UsersAndAccess.tsx:128-148`) — search never triggers an unbounded fetch.
- The `rows == null` loading placeholder + empty state (`UsersAndAccess.tsx:150-165`).
- The row identity block (avatar + email + joined sub-line, `UsersAndAccess.tsx:242-265`).
- The role chip (`UsersAndAccess.tsx:292-300`) → re-map to the mig-104 4-tier role (`super-admin`/`org-admin`/`dept-admin`/`member`) with the `◆ Org-admin` / `Member` copy (D-166-05). Indigo, not amber.

**DELETE** the graded action guards + confirm sheets (`UsersAndAccess.tsx:314-484`) and the `onDisable`/`onEnable`/`onGrant`/`onRevoke` prop contract (`UsersAndAccess.tsx:49-64`) — none of those exist here. Per sketch 080-A: the invite/edit affordances must be **absent** (not disabled buttons that lie), with the banner pointing at the locked Invitations tab.

**Data source:** `org_members` (mig 104:89-99) joined for email/last-active. The roster read is member-facing — `org_members` RLS lets a member read their own org (mig 104 policies via `current_user_org_ids()`), so this CAN be a user-JWT read (unlike audit). Confirm the join surface at plan time.

---

### NEW `frontend/src/components/org/OrgAuditTab.tsx` (component, audit list — LIGHTER cut)

**Analog:** `components/admin/AuditTab.tsx` (763 lines) — take a **lighter first cut** (D-166-04 / sketch 080-A: list + chip filters, **NO CSV**, single source).

Reuse from `AuditTab.tsx`:
- The plain-first action vocabulary map `PLATFORM_ACTION_META` (`AuditTab.tsx:66-92`) — the raw `audit_log` code → plain label + group. This is the *same* `audit_log` vocabulary, reuse it directly.
- The 029-A chip-filter strip (action-type chip + date chip) (`AuditTab.tsx:470-616`) and `resolvePreset`/`windowReadout`/`DATE_CHIP_LABEL` (`AuditTab.tsx:140-181`).
- The paged platform-row table (`AuditTab.tsx:702-730`) + pager (`AuditTab.tsx:735-755`).
- The live match-count "amber at zero" trust cue (`AuditTab.tsx:633-645`) + `showTechnical` raw-code reveal (`AuditTab.tsx:532-534,722-726`).

**STRIP for the lighter cut:**
- The **source switch** (`AuditTab.tsx:414-440`) — org audit is single-source (`audit_log` only), no operator/platform toggle.
- The **CSV export** button + `handleExport` + `operatorCsv`/`downloadCsv` (`AuditTab.tsx:206-233,375-452`) — CSV is deferred within-phase (D-166-04).

**ADD the RLS-honest degrade (load-bearing — sketch 080-A):** when `canAuditView` is false, render an explicit "you see only your own activity (RLS)" banner + own-only rows — **never a silent empty list.** Model the visible-honesty banner on `AuditTab.tsx:455-461` (the "Looking at user activity is itself recorded" amber strip) but re-tinted/re-worded for the member-sees-own case.

---

### NEW `frontend/src/components/org/OrgSettingsTab.tsx` (component, light org-config home)

**Analog:** `pages/SettingsPage.tsx` (1374 lines) — partial match. This is the **light Settings IA split** (ADMIN-05 / D-166-03): stand up an org-config home behind `org:manage`; **defer the bulk global-knob relocation to v3.5** (SEED-117 §1). Carve only the obviously-org-config sliver here.

Guidance for the planner: read `.planning/notes/settings-control-room-boundary.md` (the three-surface boundary + F1 reframe) and `.planning/notes/dynamic-control-inventory.md` (the per-knob decision table) BEFORE deciding which knobs land here. The rule (D-166-03): **establish the three homes now, move the obviously-personal/obviously-org bits, don't build the split twice.** Keep this tab thin — its center is tenancy identity, not a config console.

---

### NEW `frontend/src/components/layout/ProfileMenu.tsx` (component, rail-footer popover — the 079-C merged menu)

**Analogs:** `components/layout/NavPanel.tsx` footer (lines 171-207 — where "Sign out" lives today) + `hooks/useAuth.ts` (identity source) + `providers/OrgProvider.tsx` (org switcher data).

This is the **079-C Hybrid merged popover**: ONE rail-footer identity button opens a popover holding identity + org-scoped role badge + the org-switcher section (**renders only at 2+ orgs** — D-166-02; solo = a quiet name button, no switcher chrome) + theme + sign out.

- **Identity source:** `useAuth.ts` — `user.email` / `user.id` (`useAuth.ts:15-18`, the `UseAuth` shape). Do NOT re-fetch; App already holds `user`.
- **Popover primitive:** reuse the shadcn Sheet/Popover already in the repo (`UsersAndAccess.tsx:39-44` imports `@/components/ui/sheet`; a Popover is the lighter fit for a rail-footer menu — confirm which primitive at plan time).
- **Collapsed-rail behavior:** the anchor must still work icon-only (sketch 079-C "What to Look For" — the real rail collapses to 58px). Mirror the `RailItem` collapsed/expanded dual-render (`NavPanel.tsx:56-93`).
- **org switch action:** calls `OrgProvider.switchOrg()` (which owns the D-166-08 teardown) — the menu is presentational, it does not tear down streams itself.
- **Role badge copy (D-166-05):** `◆ Org-admin` / `Member` in the menu header (also shown in the shell band).

---

### NEW `backend/app/api/org.py` (FastAPI router, request-response)

**Analog:** `backend/app/api/admin.py` (1615 lines) — mirror the **router-level default-deny gate** shape; swap the authority.

**Router construction — copy `admin.py:133-138`:**
```python
router = APIRouter(
    prefix="/org",
    tags=["org"],
    dependencies=[Depends(require_org_manage)],   # gate on org:manage, NOT require_operator
)
```
The single load-bearing security line is the router-level `dependencies=[...]` (Pattern 1 — attach at ROUTER level so a future endpoint can't forget it; `admin.py:6-8,133`).

**Endpoint shapes to mirror:**
- `GET /org/me` (or `/org/permissions`) — the probe backing `useOrgPermissionsProbe`. Mirror `admin.py:604-617` (`get_operator_me` reads `request.state.operator` → return identity). Here read `request.state.active_org` + `request.state.org_role` set by the gate, return `{ org_id, role, can_manage, can_audit_view }`. Floor-EXEMPT (probes must not spam any ledger — `admin.py:606,17`).
- `GET /org/members` — the read-only roster. Mirror `admin.py:819-831` (`list_users`: 1-based pagination, `page_size` clamp, delegate to a service). Scope to `active_org`.
- `GET /org/audit` — the org-scoped audit read. **See LANDMINE 1** — this is service-role + app-code authz, NOT a router-gate-only read. Model on `audit.py:124-154` (`list_audit_logs`) + add `.eq("org_id", active_org)` and the `org:audit_view` branch.

**Register in `main.py`** alongside the others: add to the `from app.api import …` line (`main.py:657`) + an `app.include_router(org.router)` line (`main.py:659-685` block). `backend/app/api/__init__.py` is empty (0 lines) — routers are wired in `main.py`, not the package init.

---

### MODIFIED `backend/app/dependencies.py` (new authz dependencies)

**Analogs (same file):** `require_operator` (390-407), `authenticate_operator_request` (347-387), the `require_visible(feature)` **dependency factory** (449-475), and the Phase-163 user-JWT client seams (`get_user_pg_connection` 156-175, `get_user_supabase_client` 289-294).

**New dep 1 — `get_active_org_id(request, current_user)` (validates `X-Org-Id` — D-166-06, threat-model item):**
Read the `X-Org-Id` header and **validate it against the caller's membership** — never trust the client's claimed active org. The validation runs through the mig-104 substrate: check membership via `current_user_org_ids()` (or a direct `org_members` lookup) on a **user-JWT connection** (`get_user_pg_connection`, `dependencies.py:156-175` — RLS-enforced, role-swapped). Reject a non-member org with a refusal (choose 403 vs 404 at plan time — the `/admin` surface uses byte-identical 404 for non-discoverability, but the org surface is a legitimate product feature like `require_visible`'s 403, `dependencies.py:471-474`). Stash the validated org on `request.state.active_org`.

**New dep 2 — `require_org_manage` (the router gate — mirror `require_operator:390-407`):**
```python
async def require_org_manage(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
) -> dict:
    if not await current_user_has_permission(active_org, "org:manage"):   # mig 104:187 SECDEF helper
        raise <refusal>
    request.state.active_org = active_org
    request.state.org_role = <role>       # for the band / probe (mirrors request.state.operator:406)
    return current_user
```
The `current_user_has_permission(p_org_id, p_permission_key)` call must run **as the caller** (its body reads `auth.uid()` — mig 104:197) — invoke it through the user-JWT connection (`get_user_pg_connection`) or user-JWT supabase RPC, NOT the service-role/BYPASSRLS pool (which has no `auth.uid()`). **D-166-09: no route calls this helper yet — the enforcement layer is net-new this phase.**

**New dep 3 (optional) — a `require_org_permission(key)` FACTORY** for `org:audit_view`, mirroring the `require_visible(feature)` closure factory (`dependencies.py:449-475`) so the audit endpoint can gate/branch on `org:audit_view` without a second hand-written dep. The `is_operator` "one swappable boundary" note (`dependencies.py:457`) is the precedent for keeping the permission check a single seam.

---

### MODIFIED `frontend/src/App.tsx` (provider tree + org probe host)

**Analog:** self — the exact `useOperatorProbe` hosting pattern already in this file.

- **Host the org probe ONCE at App level, keyed to `user?.id`** — mirror `App.tsx:131-137` (`const { isOperator } = useOperatorProbe(user?.id ?? null)`). Add `const { canManage, canAuditView } = useOrgPermissionsProbe(user?.id ?? null, activeOrgId)`. Thread `canManage` to the nav (gates the indigo rail shield) exactly as `isOperator` threads (`App.tsx:245`).
- **Mount `<OrgProvider>` OUTSIDE `<StreamsProvider>` (D-166-07):** the current outer wrapper is `<StreamsProvider>` at `App.tsx:209`. Wrap it: `<OrgProvider> <StreamsProvider> … </StreamsProvider> </OrgProvider>`. (The probe hook must read `activeOrgId` — so either the probe lives inside a small child under OrgProvider, or OrgProvider exposes activeOrgId via a ref/context the probe reads. Resolve the ordering at plan time; the constraint is OrgProvider-above-StreamsProvider.)

---

### MODIFIED `frontend/src/components/layout/NavPanel.tsx` (rail footer — the indigo Shield-mirror + profile anchor)

**Analog:** self — the probe-gated **amber operator shield** at `NavPanel.tsx:181-198`, rendered OUTSIDE `navItems`.

- **Add the indigo org-admin Shield-mirror** directly parallel to the amber operator shield (079-C), in the footer block (`NavPanel.tsx:171-207`). Copy the `{isOperator && (<RailItem icon={Shield} …/>)}` pattern at lines 185-198, gate it on `canManage`, and re-tint amber → indigo (`amber-500/15 text-amber-400` → indigo equivalents). Render **only when `canManage`**; honestly ABSENT (never disabled) for a member (079-C "What to Look For").
- **Add the ProfileMenu anchor** in the footer (where the bare "Sign out" `RailItem` is today, `NavPanel.tsx:200-206`) — 079-C merges identity + role + switcher + sign-out into the popover. Sign-out moves INTO the menu.
- Keep the `RailItem` collapsed/expanded dual-render contract (`NavPanel.tsx:56-93`) so both new elements work icon-only at 58px.
- A regression test locks "shield lives OUTSIDE `NAV_ITEMS`" (`NavPanel.tsx:35-38`) — keep the indigo shield out of the shared array too.

---

### MODIFIED `frontend/src/providers/StreamsProvider.tsx` ⚠️ G-5 HOT FILE (see LANDMINE 2)

**Analog:** self — the `clearThreadBucket` guarded action at `StreamsProvider.tsx:1331-1348`.

Expose (or reuse) the existing teardown so `OrgProvider.switchOrg()` can drive: tear down subscriptions → **call the existing guarded `clearThreadBucket`** (lines 1331-1348, its `!sendingThreadsRef.current.has(tid)` predicate intact) → refetch. Do NOT add a second bucket-wipe path; do NOT drop the L-068-01 predicate (line 24 + acceptance grep). If a new "clear all buckets on org switch" action is needed, it must loop the SAME guard, not bypass it. G-5: minimize the surface area of change in this file.

---

### MODIFIED `frontend/src/lib/api.ts` (X-Org-Id header injection + new org fns)

**Analog:** self — `getAuthHeaders()` (75-83) is the header-injection seam; `getOperatorProbe` (3723-3729) / `getUsersRoster` (3948-3962) / `getPlatformAudit` (3843-3861) are the fn shapes to clone.

**X-Org-Id injection (D-166-06) — add to `getAuthHeaders:75-83`:**
```ts
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  const orgId = getActiveOrgId()               // NEW: module-level read (localStorage), written by OrgProvider
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(orgId ? { "X-Org-Id": orgId } : {}),   // server RE-VALIDATES against membership (never trusted)
  }
}
```
The active org is read module-level here (like the token is read from `supabase.auth.getSession()`), so every existing authed call auto-carries `X-Org-Id` with **zero call-site churn**. OrgProvider persists the active org to localStorage (TechnicalNamesProvider persistence idiom); this reads it. **Server-side validation is the real boundary** — the header is a hint (D-166-06 threat-model item).

**New API fns — clone the shapes:**
- `getOrgPermissions(orgId)` → mirror `getOperatorProbe:3723-3729` (typed GET, `ApiError` on non-OK). Returns `{ can_manage, can_audit_view, role }`.
- `getOrgMembers(page, pageSize)` → mirror `getUsersRoster:3948-3962` (envelope unwrap `{ users, page, page_size }`, `pageSize` clamp).
- `getOrgAudit(filters, page, pageSize)` → mirror `getPlatformAudit:3843-3861` (params builder + `has_more` paging envelope).
Reuse the `PlatformAuditFilters`/`PlatformAuditPage` types (`api.ts:3798-3861`) or narrow clones for the single-source lighter cut.

---

### MODIFIED `frontend/src/components/layout/ChatLayout.tsx` (view switch — reachability triad)

**Analog:** self — the `ControlRoomPage` mount branch (`ChatLayout.tsx:18` import, `575` view branch, `583` mount).

Add an `"org-admin"` branch to the `ActiveView` switch exactly as `control-room` is handled: `activeView === "org-admin" ? <OrgAdminShell … /> : …` (mirror line 575/583). Thread `canManage` + org identity as props (mirror how `isOperator`/`operatorIdentity` thread, lines 60-64, 303). Also extend the `ActiveView` union in `App.tsx:82` (add `"org-admin"`) — the reachability triad (union + ChatLayout mount branch + the NavPanel entry action) must be owned in-phase (the Phase-118 built-but-unreachable lesson).

---

### REUSED AS-IS `frontend/src/components/admin/LockedTab.tsx` (no new file)

Import and wire directly for the 4 locked tabs (D-166-01). The shell passes each locked tab's `title` + `description` (LockedTab.tsx:18-26 prop contract). **HARD RULE (LockedTab.tsx:5-11 / T-146-10):** the `description` copy must NEVER name a roadmap phase number — a plan grep gate asserts phase-number absence. Wire it exactly as `ControlRoomPage.tsx:792` does (`<LockedTab title={active.label} description={active.lockedDescription} />`).

---

## Shared Patterns

### Authz gate (router-level default-deny)
**Source:** `backend/app/dependencies.py:390-407` (`require_operator`) + `backend/app/api/admin.py:133-138` (router `dependencies=[...]`).
**Apply to:** `backend/app/api/org.py` (the whole router) — gate on `current_user_has_permission(active_org,'org:manage')` (mig 104:187), stash on `request.state`. `org:audit_view` gates/branches the audit endpoint via a `require_org_permission` factory (mirror `require_visible:449-475`).

### `X-Org-Id` server validation (never trust the client)
**Source:** the threat-model note D-166-06 + the Phase-163 user-JWT connection seams `dependencies.py:156-175` (`get_user_pg_connection`, RLS-enforced) / `_apply_rls_user_context:125-153`.
**Apply to:** `get_active_org_id` dep — validate the header against `current_user_org_ids()` / `org_members` on a **user-JWT (RLS) connection**, not the BYPASSRLS service-role pool. `current_user_has_permission` reads `auth.uid()` (mig 104:197) so it MUST run as the caller.

### `audit_log` service-role + app-code authz (NOT pure RLS) — LANDMINE 1
**Source:** `backend/app/api/audit.py:13-21` (the header policy comment) + `audit.py:38-46` (`_apply_filters`) + `audit.py:27-35` (`_since_to_dt`) + the `# service-role:` Depends comment (`audit.py:94,131`).
**Apply to:** `GET /org/audit` — service-role client, `.eq("org_id", active_org)`, then `org:audit_view` → all-org rows / else own-only, RLS-honest banner. Copy `_apply_filters` + `_since_to_dt` and add the org predicate.

### Fail-closed per-session probe (render-only, keyed to userId)
**Source:** `frontend/src/hooks/useOperatorProbe.ts:41-86` + `hooks/useEffectiveFeatures.ts:39-86` (the `{}`/CLOSED default polarity + refetch nonce).
**Apply to:** `useOrgPermissionsProbe` — re-key on `userId` AND `activeOrgId`; default closed; cancel-flag guard; RENDER-ONLY (backend gate is the wall).

### Shell-owns-fetch / tab-is-pure-leaf (148-PATTERNS split)
**Source:** `frontend/src/components/admin/ControlRoomPage.tsx:200-395` (alive.current guard, lazy per-tab fetch, honest-degrade `.catch`) + the `OperatorBand`/`UsersAndAccess`/`AuditTab`/`LockedTab` "props in, DOM out" leaf contract.
**Apply to:** `OrgAdminShell` owns the fetch; `OrgBand`/`OrgMembersTab`/`OrgAuditTab`/`LockedTab` are pure leaves.

### Context-provider sharing (single source, no per-consumer drift)
**Source:** `frontend/src/providers/TechnicalNamesProvider.tsx:58-106` (createContext + throwing `useX()` + non-throwing `useXOptional()` + memoized value + localStorage persist).
**Apply to:** `OrgProvider` — one shared `activeOrgId`/`orgs`/`role`/`switchOrg`; flipping org anywhere flips everywhere.

### Streams teardown on context switch (G-5, reuse the guard) — LANDMINE 2
**Source:** `frontend/src/providers/StreamsProvider.tsx:1331-1348` (`clearThreadBucket` Branch-D3 guard) + CLAUDE.md D-v2.5-03 (Realtime is a hint, reconcile-via-fetch is truth).
**Apply to:** `OrgProvider.switchOrg` — subscriptions down → guarded `clearThreadBucket` → refetch. Never bypass the mid-stream predicate.

### Amber → indigo re-tint (zone identity)
**Source:** sketch 080-A / 079-C — amber is RESERVED for the operator zone; the org home is the user's OWN home, indigo. Amber operator shield `NavPanel.tsx:194-196`; operator band `OperatorBand.tsx:38,42,46`.
**Apply to:** `OrgBand`, the indigo rail Shield-mirror, the shell active-tab accents, the role badge chip. Never amber.

---

## No Analog Found

None. Every new/modified file maps to a shipped analog (this is by design — Phase 166 is the user-side mirror of the Phase 146–149 operator surface). The only "partial" is `OrgSettingsTab.tsx` (the light Settings split has no exact precedent), and its shape is governed by the boundary notes rather than a code analog:
- `.planning/notes/settings-control-room-boundary.md`
- `.planning/notes/dynamic-control-inventory.md`

---

## Metadata

**Analog search scope:** `frontend/src/{providers,hooks,components/admin,components/layout,pages,lib}`, `backend/app/{api,dependencies.py,services}`, `supabase/migrations/104_org_dept_role_schema.sql`.
**Files scanned (read):** App.tsx · useOperatorProbe.ts · useEffectiveFeatures.ts · useAuth.ts · LockedTab.tsx · OperatorBand.tsx · ControlRoomPage.tsx · NavPanel.tsx · UsersAndAccess.tsx · AuditTab.tsx · TechnicalNamesProvider.tsx · StreamsProvider.tsx (targeted) · lib/api.ts (targeted) · ChatLayout.tsx (targeted) · dependencies.py · admin.py (targeted) · audit.py · operator_service.py (targeted) · migration 104 (targeted) · main.py (targeted).
**Pattern extraction date:** 2026-07-21
