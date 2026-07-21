---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
reviewed: 2026-07-21T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - backend/app/dependencies.py
  - backend/app/api/org.py
  - backend/app/main.py
  - backend/tests/test_166_org_gate.py
  - frontend/src/providers/OrgProvider.tsx
  - frontend/src/hooks/useOrgPermissionsProbe.ts
  - frontend/src/lib/api.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/org/OrgBand.tsx
  - frontend/src/components/org/OrgMembersTab.tsx
  - frontend/src/components/org/OrgSettingsTab.tsx
  - frontend/src/components/layout/ProfileMenu.tsx
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/App.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues
---

# Phase 166: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the net-new org-admin surface: the backend authz layer (`get_active_org_id` /
`require_org_manage` / `_has_org_permission` in `dependencies.py`, the `/org/*` router in
`org.py`), the frontend org-context spine (`OrgProvider`, `useOrgPermissionsProbe`,
`X-Org-Id` injection in `api.ts`), the additive `StreamsProvider` org-switch teardown, and
the org UI leaves (shell, band, members, audit, settings, profile menu, nav, layout).

**The multi-tenancy authorization boundary — the highest-priority focus — is sound.** I
traced the full path and found no cross-org or cross-member leak:

- **Spoof rejection is real.** `get_active_org_id` validates `X-Org-Id` against
  `org_members` on a user-JWT/RLS connection (`get_user_pg_connection` does `SET LOCAL ROLE
  authenticated` + both GUC claim forms), with an explicit `user_id = auth.uid()` predicate
  on top of RLS. A non-member org yields no row → 403. `_to_uuid` turns a malformed header
  into a clean 403, never a 500. (`dependencies.py:525-577`)
- **The permission check runs as the caller, never BYPASSRLS.** `_has_org_permission` calls
  `current_user_has_permission($1,$2)` on `get_user_pg_connection`. Confirmed against mig
  104:187-200: the helper is `SECURITY DEFINER ... SET search_path TO 'public'` and its body
  reads `auth.uid()`. On the BYPASSRLS pool (`postgres` role, no claims) `auth.uid()` is NULL
  and the `EXISTS` returns false — so even a mistaken service-role call fails **closed**.
- **The `/org/audit` service-role read is app-code-airtight.** `_apply_org_audit_filters`
  *always* applies `.eq("org_id", active_org)`; the own-only degrade adds
  `.eq("user_id", caller)`. `require_org_manage` gates the endpoint, so a non-manager never
  reaches it; a manager without `org:audit_view` is server-forced to `scope="own"`. It reads
  `audit_log` only — never `harness_audit` or `operator_audit_log`. (`org.py:62-77,177-228`)
- **Queries are parameterized** (`$1/$2` binds and supabase-py `.eq()`); **every blocking
  `.execute()` is `run_in_threadpool`-wrapped** (`org.py:208,220`) — D-v2.5-01 compliant.

The defects found are all in the **client-side org lifecycle** and are **latent** (they
activate once a user holds 2+ memberships — i.e., Phase 167 invitations — since mig 105
backfills exactly one personal org today). None is a security leak, but two of them break the
switcher/teardown deliverables the moment multi-org membership exists, and they are entirely
untested (every test sends a single valid `X-Org-Id`).

## Warnings

### WR-01: `/org/me` cannot bootstrap the switcher for a fresh multi-org session (circular dependency)

**File:** `backend/app/dependencies.py:560-573`, `frontend/src/hooks/useOrgPermissionsProbe.ts:78-89`, `frontend/src/components/layout/ProfileMenu.tsx:79`

**Issue:** The org switcher's membership list is delivered **only** by `GET /org/me`, but
`/org/me` inherits the router-level `get_active_org_id` gate, which raises **400** when the
`X-Org-Id` header is absent and the caller has 2+ memberships (`dependencies.py:569-573`).
On a fresh device (no `active-org-id` in localStorage) a multi-org user therefore hits this
sequence:

1. `OrgProvider` starts with `activeOrgId = null` → `getOrgPermissions()` sends **no**
   `X-Org-Id` header.
2. `get_active_org_id` header-absent branch: 2+ memberships → **400 "X-Org-Id header
   required."**
3. `useOrgPermissionsProbe`'s `.catch` fails **closed** → `memberships = []`.
4. `ProfileMenu` gates the switcher on `orgs.length >= 2` → **switcher never renders**.

The user has no header to send and no UI to set one — a deadlock. The one call that could
seed the client (`/org/me` → `memberships[]`) is the one that 400s. This makes the switcher,
a primary Phase-166 deliverable, non-bootstrappable for any multi-org session that lacks a
prior persisted org. It is masked today only because every user has exactly one membership
(mig 105); it goes live with Phase 167.

**Fix:** Make the membership/probe read resilient to an absent (or non-unique) active org.
Give `/org/me` a relaxed resolver instead of the strict router gate — return `memberships[]`
plus a deterministic default `org_id` even when the header is absent and 2+ memberships
exist, rather than 400:

```python
# /org/me should always be reachable by any member so the client can bootstrap the switcher.
# e.g. resolve active org as: header (validated) OR the first membership by created_at,
# and ALWAYS include memberships[] in the body — never 400 a member out of their own probe.
@router.get("/me")
async def get_org_me(request: Request, current_user: dict = Depends(get_current_user)):
    async with get_user_pg_connection(request, current_user) as conn:
        memberships = await conn.fetch(
            "SELECT m.org_id, o.name, m.role FROM public.org_members m "
            "JOIN public.organizations o ON o.id = m.org_id "
            "WHERE m.user_id = auth.uid() ORDER BY o.name"
        )
    # ...resolve active_org from header-if-valid-else-first-membership; compute perms;
    #    return memberships[] unconditionally.
```

Then have `OrgProvider` adopt `perms.org_id` into `activeOrgId` on first resolve so the
header self-heals on the next request.

---

### WR-02: org-switch teardown leaves stale `streamingThreads` / `subscriptionsByThread` (endless 404 watchdog probes)

**File:** `frontend/src/providers/StreamsProvider.tsx:2908-2915`

**Issue:** The teardown aborts every in-flight subscription and clears the `AbortController`
map, but a caller-initiated abort is a **silent return** in `subscribeToRun`
(`api.ts:664` — `AbortError` returns without firing `onTerminal`). The store mirrors that are
cleaned inside `onTerminal` therefore never get cleaned:

```js
for (const ctrl of subscriptionsRef.current.values()) ctrl.abort()
subscriptionsRef.current.clear()   // <-- only the ref map is cleared
```

This copies the *unmount-cleanup* shape (useEffect #3, `:2820-2827`) — which is fine on
unmount because the whole store is discarded — but on a **live** org switch the provider
stays mounted, so:

- `streamingThreads` retains the old-org thread id(s). The inactivity watchdog then probes
  `getSnapshot(oldThread)` under the **new** `X-Org-Id`, which 404s cross-org → `probeThread`
  catches and returns without finalizing (`:2764-2768`) → the entry is **never** cleared →
  a permanent phantom "streaming" state plus a wasted 404 fetch every ~20s, forever.
- `subscriptionsByThread` retains stale run ids (self-heals on the next `enforceStreamPool`
  navigation, but lingers meanwhile).

The existing `enforceStreamPool` evictor documents the exact requirement this teardown
violates (`:1204-1208`): a silent abort "must replicate the onTerminal remove pair …
`subscriptionsRef.delete` + `_removeRunFromThread`, in lockstep." The teardown omits both the
`_removeRunFromThread` mirror cleanup and the `streamingThreads` removal.

**Fix:** Replicate the lockstep the evictor uses, and clear `streamingThreads` for the torn-
down threads (guarded by `sendingThreadsRef` so an in-flight send is never finalized):

```js
const byThread = useStreamsStore.getState().subscriptionsByThread
for (const [ownerThreadId, runIds] of byThread) {
  for (const runId of runIds) {
    subscriptionsRef.current.get(runId)?.abort()
    subscriptionsRef.current.delete(runId)
    useStreamsStore.setState((s) => ({
      subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, ownerThreadId, runId),
    }))
  }
}
useStreamsStore.setState((s) => {
  const next = new Set(s.streamingThreads)
  for (const t of s.streamingThreads) if (!sendingThreadsRef.current.has(t)) next.delete(t)
  return { streamingThreads: next }
})
```

(The `clearThreadBucket` loop can stay — its 067.5 send-in-flight guard is correctly
preserved.)

---

### WR-03: persisted active org survives sign-out and is not user-scoped (prior user's org id sent for the next user)

**File:** `frontend/src/lib/api.ts:89-104`, `frontend/src/providers/OrgProvider.tsx:90-96`, `frontend/src/App.tsx:213`

**Issue:** `ACTIVE_ORG_STORAGE_KEY` ("active-org-id") is device-scoped, written by
`OrgProvider` whenever `activeOrgId` is truthy, and **never cleared on sign-out**. On a shared
device, if user A switches to org X (localStorage = X) and signs out, user B signs in and
`OrgProvider` re-seeds `activeOrgId` from that stale value (`getInitialOrg`), so user B's very
first `/org/me` (and every authed request) carries **user A's org id** in `X-Org-Id`. The
server correctly 403s it (user B is not a member) — so there is **no data leak** — but the
probe then fails closed to empty memberships (see WR-01), stranding user B with no switcher
and no recovery path. Same failure mode also strikes a single user removed from a
previously-active org.

**Fix:** Clear the key on sign-out and/or key it per user. Simplest: clear on sign-out in the
`signOut` path, e.g. `window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)`; more robust:
namespace the key by `userId` (`active-org-id:${userId}`) so a device never bleeds one user's
org selection into another's session. Pairs with WR-01 (a resilient `/org/me` lets the client
recover even if a stale value slips through).

## Info

### IN-01: `selectedThread` is not reset on org switch → old-org thread shown / 404 reconcile

**File:** `frontend/src/components/layout/ChatLayout.tsx:130-135`, `frontend/src/providers/StreamsProvider.tsx:2897-2899`

**Issue:** After `switchOrg`, `loadThreads()` repopulates the sidebar with the new org's
threads, but `selectedThread` still points at the old-org thread (not in the new list). If the
user is on the chat view, `ChatArea` shows that thread with a cleared bucket and reconciles it
via `getSnapshot(oldThread)`, which 404s cross-org. Same-user data, no leak, and the teardown
comment explicitly scopes this ("the user reconciles to the new org by navigating the
refetched list"). Noted as a UX papercut: consider clearing/reselecting on switch so the chat
view doesn't briefly show a stale thread or a silent 404.

### IN-02: duplicated role/vocabulary helpers across org + admin components

**File:** `frontend/src/components/org/OrgAuditTab.tsx:36-56`, `frontend/src/components/org/OrgBand.tsx:47-49`, `frontend/src/components/layout/ProfileMenu.tsx:58-60`, `frontend/src/components/org/OrgMembersTab.tsx:44-48`

**Issue:** `ACTION_META` is copied from the operator `AuditTab`, and `isOrgAdminRole` /
`roleBadge` are re-implemented in three org leaves. The code comments acknowledge the copy was
deliberate (avoid touching files outside the plan surface). Fine for now, but the plain-first
audit vocabulary and the role→badge mapping will drift between the org and operator surfaces;
a follow-up should extract a single shared source.

### IN-03: `request.state.active_org` stores the raw header string, not the normalized UUID

**File:** `backend/app/dependencies.py:557`

**Issue:** The header branch validates against the parsed `org_uuid` but stashes
`str(header_org)` (the raw client string). Downstream, `_apply_org_audit_filters` compares
`.eq("org_id", raw)` and `get_org_members` re-parses via `_to_uuid`. Functionally equivalent
(Postgres uuid comparison is canonical/case-insensitive), but storing `str(org_uuid)` would
keep `request.state.active_org` in one canonical form and avoid a redundant re-parse. Cosmetic.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
