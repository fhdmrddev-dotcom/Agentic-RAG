---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
audit_date: 2026-07-21
asvs_level: 2
threats_total: 19
threats_closed: 19
threats_open: 0
disposition: SECURED
block_on: open
---

# Phase 166 — Security Verification

**Phase:** 166 — Org-Admin Shell + Org Switcher + Profile-Menu Anchor
**Threats Closed:** 19/19 (0 open)
**ASVS Level:** 2
**Scope:** the human-facing surface of the v3.4 multi-tenancy model **plus** its thin
authz-enforcement layer — the FIRST routes to ever call mig 104's
`current_user_has_permission()` SECDEF helper (D-166-09). This is a security-core phase for
the milestone's "one-way RLS door." No migration authored (substrate = mig 104/105/108).

Every mitigation below was located in the shipped code (grep + line-cited read) and, where a
regression test was declared, confirmed green — not accepted on documentation or intent.

---

## Verification method

| Disposition | How verified |
|-------------|--------------|
| `mitigate` | Located the declared mitigation pattern in the cited implementation file + line; ran the declared regression test where one exists. |
| `accept`   | Confirmed the residual risk is real, the true gate lives elsewhere (server-side), and the acceptance is documented in code (see Accepted-Risk Log). |

**Substrate facts independently confirmed** (load-bearing for T-166-03 / T-166-04):
- `public.current_user_has_permission(p_org_id, p_permission_key)` reads `auth.uid()`
  (`supabase/migrations/104_org_dept_role_schema.sql:187-197`) — so it MUST run as the caller
  on a user-JWT connection; a BYPASSRLS connection would evaluate `postgres`'s permissions.
- `public.audit_log` has RLS enabled with **only an authenticated INSERT policy, no SELECT
  policy** (`030_missing_tables.sql:27-31`, `108_rls_membership_rewrite.sql:615-616`). A
  user-JWT read is RLS-denied → empty; therefore the `/org/audit` read must use service-role,
  and app-code authz is the SOLE gate (correctly implemented — see T-166-03).

**Test evidence:**
- `backend/tests/test_166_org_gate.py` — **5 passed** (spoof-reject, default-deny roster,
  audit own-only degrade, audit all-org, `/org/me` shape).
- `frontend`: OrgProvider / OrgAuditTab / ProfileMenu / NavPanel / OrgAdminShell / OrgMembersTab
  test suites — **38 passed** (org-switch teardown reuse, fail-closed probe, scope degrade,
  shield gate, switchOrg delegation, no-phase-number locked copy, read-only roster).

---

## Threat Verification Table

### Plan 01 — backend authz-enforcement layer

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-166-01 | Spoofing | mitigate | CLOSED | `backend/app/dependencies.py:525-577` — `get_active_org_id` reads `X-Org-Id` (`:538`), validates it against `org_members WHERE org_id=$1 AND user_id=auth.uid()` on a user-JWT/RLS connection (`:539,548-551`), 403 on non-member (`:552-556`); malformed header → 403 via `_to_uuid` (`:542-547`). Header-absent path resolves default org (1→use, 0→403, 2+→400) (`:560-577`). Test-locked: `test_166_org_gate.py:81-89`. |
| T-166-02 | Elevation | mitigate | CLOSED | Router-level membership default-deny `dependencies=[Depends(get_active_org_id)]` (`backend/app/api/org.py:43-47`); `require_org_manage` (`dependencies.py:580-597`, 403 on false `org:manage`) attached on `/org/members` (`org.py:131`) AND `/org/audit` (`org.py:185`). Test-locked: `test_166_org_gate.py:92-102`. |
| T-166-03 | Information Disclosure | mitigate | CLOSED | `backend/app/api/org.py:177-228` — service-role read via `_get_org_audit_supabase` (`:80-84`, `get_service_role_supabase(active_org)`); `_apply_org_audit_filters` ALWAYS `.eq("org_id", active_org)` and `.eq("user_id", own_user_id)` ONLY on the degrade branch (`:62-77`); `org:audit_view` branch sets `scope="all"` vs own-only `scope="own"` (`:198-202`); source is `audit_log` ONLY — `harness_audit`/`operator_audit_log` never queried; `run_in_threadpool`-wrapped (`:208,220`). Test-locked both branches: `test_166_org_gate.py:105-139`. |
| T-166-04 | Tampering | mitigate | CLOSED | `backend/app/dependencies.py:504-522` — `_has_org_permission` runs `current_user_has_permission($1,$2)` on `get_user_pg_connection` (`:516`), parameterized binds, NEVER the BYPASSRLS pool. Helper reads `auth.uid()` (mig 104:197), so it evaluates the CALLER's permissions. |
| T-166-SC | Tampering (supply-chain) | accept | CLOSED | No new packages — pure app code over shipped mig-104 substrate + existing supabase/asyncpg clients. No install task in the plan; verified no requirements change. |

### Plan 02 — frontend org-context substrate

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-166-05 | Spoofing | accept | CLOSED | Client is not a trust boundary — `X-Org-Id` is a per-device hint the server re-validates (T-166-01). Injected in the SHARED `getAuthHeaders` so every authed call carries it (`frontend/src/lib/api.ts:106-117`). Documented `frontend/src/providers/OrgProvider.tsx:20-23` + `api.ts:76-79`. See Accepted-Risk Log AR-1. |
| T-166-06 | Information Disclosure | mitigate | CLOSED | `frontend/src/providers/StreamsProvider.tsx:2884-2916` — org-switch effect keyed on `activeOrgId` (via `useOrgOptional`) aborts in-flight subscriptions then loops the EXISTING `clearThreadBucket(surface)` action; the 067.5 guard predicate `!sendingThreadsRef.current.has(tid)` (`:1340`) is byte-unchanged — no new bucket-wipe path. `switchOrg` sets the header synchronously (`OrgProvider.tsx:104-111`); isolation boundary is the server-validated refetch. Test-locked (OrgProvider.test.tsx). |
| T-166-07 | Elevation | mitigate | CLOSED | `frontend/src/hooks/useOrgPermissionsProbe.ts` — fail-CLOSED `CLOSED` default (`:18-27`), signed-out clears (`:66-72`), any catch → CLOSED (`:82-86`); render-only per the SECURITY NOTE (`:44-47`). The backend `require_org_manage` gate (T-166-02) is the wall. |
| T-166-SC | Tampering (supply-chain) | accept | CLOSED | No new packages — clones of shipped providers/hooks + existing supabase client. |

### Plan 03 — presentational leaves

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-166-08 | Information Disclosure | mitigate | CLOSED | `frontend/src/components/org/OrgAuditTab.tsx` — renders `result.scope` server truth (`:121`); `scope==='own'` shows the explicit "you see only your own activity" banner above own rows (`:170-182`), never a silent empty list; no client-side "show everyone" widening (rows come straight from `result.entries`). Test-locked (OrgAuditTab.test.tsx). |
| T-166-09 | Repudiation | mitigate | CLOSED | `frontend/src/components/org/OrgMembersTab.tsx` — write affordances ABSENT (not disabled): grep for `onDisable\|onGrant\|onRevoke\|onInvite\|confirm` in code = 0; the only invite/disable mentions are the comment (`:6`) and the read-only banner pointing at the locked Invitations tab (`:82`). Test-locked (OrgMembersTab.test.tsx, 5 passed). |
| T-166-10 | Elevation | accept | CLOSED | Role/badge are display-only from server data; no write path exists in these leaves. Backend gate (Plan 01) is the wall. See Accepted-Risk Log AR-2. |

### Plan 04 — the shell (fetch owner)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-166-11 | Information Disclosure | mitigate | CLOSED | `frontend/src/components/org/OrgAdminShell.tsx:150-160` — `fetchAudit` stores the server page unchanged; `:274-282` threads `result={auditResult}` (carrying `scope`) straight to `OrgAuditTab`. No client scope override. Test-locked (OrgAdminShell.test.tsx). |
| T-166-12 | Spoofing | accept | CLOSED | Client mount is not the boundary — the shell mounts only behind the `canManage`-gated rail entry (Plan 05) AND every fetch is server-gated on `org:manage` (Plan 01). Honest client guard refuses to paint chrome for a non-manager (`OrgAdminShell.tsx:202-220`). See Accepted-Risk Log AR-3. |
| T-166-13 | Tampering | mitigate | CLOSED | `frontend/src/components/org/OrgAdminShell.tsx:77-100` — the 4 `lockedDescription` strings ("Inviting people and managing roles…", "Single sign-on setup…", "Plan and billing management…", "Data-retention controls…") name NO roadmap phase number (T-146-10). Test-locked (regex assertion in OrgAdminShell.test.tsx). |

### Plan 05 — human-facing entry (nav wiring)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-166-14 | Elevation | mitigate | CLOSED | `frontend/src/components/layout/NavPanel.tsx:190-203` — indigo org-admin shield rendered ONLY when `canManage` (`useOrgOptional()?.canManage`, `:116`), honestly absent otherwise, kept OUTSIDE the shared `navItems` array (footer block, not `navItems.map`), fires `onNavigate("org-admin")`. Forged `canManage` shows chrome but the shell's fetches 403 server-side. Test-locked (NavPanel.test.tsx). |
| T-166-15 | Information Disclosure | mitigate | CLOSED | `frontend/src/components/layout/ProfileMenu.tsx:64-65` — identity read LIVE from `useAuth()` + `useOrgOptional()` (no cached state); both are keyed to `userId`, and `useOrgPermissionsProbe` fail-closes on sign-out (`useOrgPermissionsProbe.ts:66-72`), so no prior user's org/role leaks across a same-tab switch. Test-locked (ProfileMenu.test.tsx). |
| T-166-16 | Tampering | mitigate | CLOSED | `frontend/src/components/layout/ProfileMenu.tsx:161` — picking an org calls `org?.switchOrg(o.org_id)`, delegating the D-166-08 teardown to OrgProvider; the menu never wipes buckets — grep for `clearThreadBucket` in ProfileMenu = 0. Test-locked (ProfileMenu.test.tsx). |
| T-166-SC | Tampering (supply-chain) | accept | CLOSED | No new packages — reuses shipped shadcn DropdownMenu/Popover + RailItem. |

---

## Accepted-Risk Log

The `accept` dispositions below are genuine residual risks whose true enforcement lives
server-side. Each is recorded here per the audit contract and documented in code.

- **AR-1 (T-166-05) — `X-Org-Id` is a client-supplied hint.** A user can forge/replay any
  `X-Org-Id` from localStorage. Accepted because the client is not a trust boundary: the
  server re-validates the header against `org_members` on a user-JWT/RLS connection
  (`get_active_org_id`, T-166-01) and a forged/stale org is a 403 that reaches no data.
  Documented `OrgProvider.tsx:20-23`, `api.ts:76-79`.
- **AR-2 (T-166-10) — client-side role/badge display is not authoritative.** The `◆ Org-admin`
  / `Member` badge is render-only from server data; the leaves contain no write path. Any
  privileged action is gated server-side (require_org_manage / current_user_has_permission).
- **AR-3 (T-166-12) — the org-admin shell can be force-mounted client-side.** Accepted because
  a forced mount shows only chrome: every data fetch (`/org/members`, `/org/audit`) is
  server-gated on `org:manage` (Plan 01) and 403s for a non-manager; an honest client guard
  additionally refuses to paint the surface (`OrgAdminShell.tsx:202-220`).
- **AR-SC (T-166-SC across Plans 01/02/05) — no new dependencies.** The phase adds zero npm/pip
  packages; supply-chain surface is unchanged from the shipped substrate.

---

## Unregistered Flags

**None.** SUMMARY `## Threat Flags` sections (Plans 04 & 05) both declare "None" — no new
network endpoint, auth path, or schema surface beyond the registered threat model. Plans 01–03
introduce no attack surface not already in their STRIDE registers. The one net-new backend
surface (the `/org/*` router + the first caller of `current_user_has_permission`) is fully
covered by T-166-01..04 and is the security-core intent of the phase, not an unmapped flag.

---

## Disposition

**SECURED — 19/19 threats CLOSED, 0 open.** Phase 166 may ship. The tenancy-isolation boundary
holds: the `X-Org-Id` header is server-validated against membership on an RLS connection, the
manager reads are default-deny over `current_user_has_permission` run as the caller, the audit
read degrades honestly by `org:audit_view` with app-code authz as the sole gate over the
service-role read, and the org-switch teardown reuses the 067.5 guard without regression. All
frontend privilege flags are render-only and fail-closed with the backend gate as the wall.
