import { useEffect, useState } from "react"
import { getOrgPermissions, type OrgMembership, type OrgPermissions } from "@/lib/api"

export interface UseOrgPermissionsProbe {
  /** The server-RESOLVED active org id (WR-01). On a fresh 2+-org session that sent no
   *  `X-Org-Id`, the soft `/org/me` resolves the caller's default org and returns it here so
   *  `OrgProvider` can adopt it — self-healing the header. Null on the fail-closed default. */
  orgId: string | null
  /** True only while `org:manage` is present. Decides RENDERING ONLY (shell + rail
   *  shield) — never a security boundary (see the SECURITY NOTE below). */
  canManage: boolean
  /** True only while `org:audit_view` is present — unlocks the cross-member audit read. */
  canAuditView: boolean
  /** Phase 168 (SSO-01): true only while `sso:manage` is present — gates the SSO tab.
   *  RENDER-ONLY, fail-closed (a blip never flashes the tab to a non-manager); the backend
   *  `require_sso_manage` gate is the wall (T-168-06). Lockstep sibling of `canManage`. */
  canManageSso: boolean
  /** The caller's role in the active org (`super-admin`/`org-admin`/`dept-admin`/`member`). */
  role: string
  /** The caller's memberships — feeds the org switcher (renders only at 2+, D-166-02). */
  memberships: OrgMembership[]
  /** True until the per-session probe resolves. */
  loading: boolean
}

/** The fail-CLOSED default. Every non-200 (or a signed-out user) resolves to this —
 *  a blip never flashes a manage-only surface to a member (useEffectiveFeatures `{}`
 *  polarity). `org_id: null` is the "no active org resolved" sentinel. */
const CLOSED: OrgPermissions = {
  org_id: null,
  role: "member",
  can_manage: false,
  can_audit_view: false,
  // Phase 168 (SSO-01): fail-CLOSED default — a blip must never flash the SSO tab to a
  // non-manager (same load-bearing polarity as can_manage/can_audit_view, T-168-06).
  can_manage_sso: false,
  memberships: [],
}

/**
 * One-shot org-permissions probe — the DIRECT sibling of `useOperatorProbe`, re-keyed
 * on the active org as well as the user. Calls `getOrgPermissions()` (the floor-exempt
 * `GET /org/me`) and exposes `{ canManage, canAuditView, role, memberships, loading }`.
 *
 * KEYED ON `userId` AND `activeOrgId` (not just `userId`): permissions are ORG-SCOPED,
 * so an org switch MUST re-probe — the same-user-different-org case is why this hook
 * takes a second key that `useOperatorProbe` does not. As with its sibling, keying to
 * `userId` re-probes on a fresh SPA sign-in and clears state on sign-out, and a local
 * `cancelled` flag stops a late resolve from a PRIOR user/org from setting current state.
 *
 * FAIL-CLOSED (mirror of `useEffectiveFeatures`): resolves to the `CLOSED` default on a
 * signed-out user OR any error, and STARTS closed, so a fetch blip or the pre-resolve
 * window never shows a manage-only surface to a member.
 *
 * SECURITY NOTE (Pitfall 13 / D-07, from `useOperatorProbe:32-37`): this result decides
 * RENDERING ONLY — whether to show the org-admin shell / rail shield / audit-all rows. It
 * is NOT the security authority. The backend `require_org_manage` gate (over mig 104's
 * `current_user_has_permission`) is the wall; a forged `canManage=true` reaches no data.
 *
 * @param userId       The authenticated user id (or `null` when signed out).
 * @param activeOrgId  The active org id (the `X-Org-Id` the server re-validates).
 * @param reprobeKey   Phase 168 (SSO-01): an opaque bump key — changing it forces a fresh
 *                     `GET /org/me` without a user/org switch. `OrgProvider` bumps it after
 *                     the SSO-callback JIT provision so the newly-joined org's memberships +
 *                     permissions resolve (D-168-04). Defaults to `0` — a caller that never
 *                     passes it keeps the exact pre-168 re-key behavior (userId/org only).
 */
export function useOrgPermissionsProbe(
  userId: string | null,
  activeOrgId: string | null,
  reprobeKey = 0,
): UseOrgPermissionsProbe {
  const [perms, setPerms] = useState<OrgPermissions>(CLOSED)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Local per-run cancel flag: the effect re-runs whenever userId OR activeOrgId
    // changes, and a late-resolving probe from a PRIOR user/org must never set state
    // for the CURRENT one.
    let cancelled = false

    // Signed out: clear any prior permissions (fail-closed) and resolve immediately.
    if (!userId) {
      setPerms(CLOSED)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    // Re-probe for this user + org. Clear stale permissions first (fail-closed) so a
    // same-tab switch never briefly shows the previous org's chrome while in flight.
    setPerms(CLOSED)
    setLoading(true)
    getOrgPermissions()
      .then((p) => {
        if (!cancelled) setPerms(p)
      })
      .catch(() => {
        // A probe failure (auth/network/403) is "not a manager" for rendering —
        // fail CLOSED; the backend gate remains the real authority.
        if (!cancelled) setPerms(CLOSED)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, activeOrgId, reprobeKey])

  return {
    orgId: perms.org_id,
    canManage: perms.can_manage,
    canAuditView: perms.can_audit_view,
    // Phase 168 (SSO-01): fail-closed render flag for the SSO tab (lockstep with canManage).
    canManageSso: perms.can_manage_sso,
    role: perms.role,
    memberships: perms.memberships,
    loading,
  }
}
