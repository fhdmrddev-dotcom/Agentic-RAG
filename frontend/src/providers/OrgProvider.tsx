/**
 * Phase 166 Plan 02 (ADMIN-02/03 / D-166-06/07/08) — the app-wide org-context spine.
 *
 * The SINGLE source of the active org + memberships + role + permissions, broadcast to
 * every consumer (the profile-menu identity anchor, the role badge, the org switcher, the
 * org-admin shell) so no App→ChatLayout prop threading is needed. It composes two shipped
 * in-repo patterns:
 *   - SHARING + PERSISTENCE — modeled on `TechnicalNamesProvider.tsx:37-106`:
 *     `createContext<T | null>(null)` + a throwing `useOrg()` (writers) + a non-throwing
 *     `useOrgOptional()` (leaf reads) + a `typeof window` localStorage get/set idiom. The
 *     active org is a per-device UI preference; the SERVER re-validates the `X-Org-Id`
 *     header (D-166-06), so localStorage is only a hint.
 *   - THE PROBE — `useOrgPermissionsProbe` (a clone of `useOperatorProbe`) runs INSIDE the
 *     provider, re-keyed on `activeOrgId`, so a switch re-probes org-scoped permissions.
 *
 * MOUNT POINT (D-166-07): `<OrgProvider>` wraps OUTSIDE `<StreamsProvider>` in App.tsx so
 * an org switch can reach the streams teardown from above (StreamsProvider reads the active
 * org via `useOrgOptional` and runs the D-166-08 teardown).
 *
 * SECURITY NOTE: `canManage` / `canAuditView` here decide RENDERING ONLY. The backend
 * `require_org_manage` gate (over mig 104's `current_user_has_permission`) is the sole
 * authority — a forged flag reaches no data (T-166-07). `activeOrgId` is a client hint the
 * server re-validates against membership; a spoofed org is a 403, never trusted (T-166-05).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"
import {
  ACTIVE_ORG_STORAGE_KEY,
  provisionSso,
  setActiveOrgId as syncActiveOrgHeader,
  type OrgMembership,
} from "@/lib/api"
import { useOrgPermissionsProbe } from "@/hooks/useOrgPermissionsProbe"
import { supabase } from "@/lib/supabase"

export interface OrgValue {
  /** The active org id (the `X-Org-Id` the server re-validates). Null before any org resolves. */
  activeOrgId: string | null
  /** The caller's memberships — the org switcher renders only at 2+ (D-166-02). */
  orgs: OrgMembership[]
  /** The caller's role in the active org (drives the `◆ Org-admin` / `Member` badge). */
  role: string
  /** True while the caller holds `org:manage` — gates the shell + rail shield (render-only). */
  canManage: boolean
  /** True while the caller holds `org:audit_view` — unlocks the cross-member audit read. */
  canAuditView: boolean
  /** Phase 168 (SSO-01): true while the caller holds `sso:manage` — gates the SSO tab
   *  (render-only; `require_sso_manage` is the wall, T-168-06). Lockstep with `canManage`. */
  canManageSso: boolean
  /** True until the per-session org probe resolves. */
  loading: boolean
  /** Switch the active org: syncs the `X-Org-Id` header SYNCHRONOUSLY (D-166-08) then flips
   *  the shared state, which drives the StreamsProvider teardown + the probe re-key + the
   *  ChatLayout thread-list refetch (Plan 05). */
  switchOrg: (newOrgId: string) => void
}

/**
 * Read the initial active org from localStorage (typeof window guard, TechnicalNames idiom).
 * A per-device hint — the server re-validates it. Null (no persisted org) is the day-one case.
 */
function getInitialOrg(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
}

const OrgContext = createContext<OrgValue | null>(null)

/**
 * App-level provider. Owns the single `activeOrgId` state, persists it to localStorage on
 * change, keeps the api-client `X-Org-Id` header in lockstep, runs the org-permissions probe
 * (re-keyed on the active org), and memoizes the context value.
 *
 * @param userId The authenticated user id (or `null` when signed out) — keys the probe.
 */
export function OrgProvider({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(getInitialOrg)
  // Phase 168 (SSO-01): an opaque bump key handed to the probe. The SSO-callback JIT effect
  // increments it after `provisionSso()` so `/org/me` re-resolves with the newly-joined org's
  // memberships (a first-time SSO session's probe is empty until the provision lands, D-168-04).
  const [reprobeNonce, setReprobeNonce] = useState(0)

  // Persist to localStorage on every change AND keep the api-client header in lockstep —
  // this also runs on MOUNT, re-syncing the header to the rehydrated org (belt-and-suspenders
  // with api.ts's module-load seed, which covers the very first fetch before this effect).
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (activeOrgId) window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, activeOrgId)
      else window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
    }
    syncActiveOrgHeader(activeOrgId)
  }, [activeOrgId])

  // The org-scoped, fail-closed permissions probe (re-keyed on activeOrgId + the SSO reprobe
  // nonce). Render-only.
  const {
    orgId: resolvedOrgId,
    canManage,
    canAuditView,
    canManageSso,
    role,
    memberships,
    loading,
  } = useOrgPermissionsProbe(userId, activeOrgId, reprobeNonce)

  // WR-01 self-heal: when we hold NO active org yet (fresh device — no persisted hint), adopt
  // the org the soft `/org/me` resolved as the caller's default. This makes the `X-Org-Id`
  // header carry the honest org on the NEXT request (the probe re-keys and re-sends it), so a
  // 2+-org session that bootstrapped header-less is no longer stranded. Guarded on
  // `activeOrgId === null` so a rehydrated/switched org (a real user choice) is never
  // overridden by the server default, and so the adopt fires at most once (it self-terminates
  // when activeOrgId becomes non-null).
  useEffect(() => {
    if (resolvedOrgId && activeOrgId === null) {
      setActiveOrgIdState(resolvedOrgId)
    }
  }, [resolvedOrgId, activeOrgId])

  // Phase 168 (SSO-01 / D-168-04): silent JIT membership provision on the SSO callback.
  // A first-time SSO user's `/org/me` returns EMPTY memberships until the JIT runs — the org
  // is resolved SERVER-SIDE from the authenticated SSO provider (`auth.identities`), never a
  // client claim, and the role is hardcoded `member` (T-168-03). So on a SIGNED_IN *SSO*
  // session we call `provisionSso()` exactly once (keyed on `userId` → at most once per
  // sign-in), then bump `reprobeNonce` to re-probe `/org/me` so the newly-joined org resolves
  // (WR-01 self-heal then adopts it into the switcher). It is idempotent + a plain-password
  // session is a 200 no-op, so the SSO guard below is a network-call optimization, not a
  // security boundary. Provision failure is non-fatal for rendering — the user still lands.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      // Read the live session to detect an SSO login: the SSO identity lands as
      // `provider: 'sso:<provider_uuid>'` on `auth.identities` + `app_metadata.provider(s)`
      // (RESEARCH lines 232-249). A password session skips the network call entirely.
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      if (cancelled || !u || u.id !== userId) return
      const primary = u.app_metadata?.provider
      const providers = (u.app_metadata?.providers as string[] | undefined) ?? []
      const isSso =
        (typeof primary === "string" && primary.startsWith("sso:")) ||
        providers.some((p) => typeof p === "string" && p.startsWith("sso:")) ||
        (u.identities ?? []).some(
          (i) => typeof i.provider === "string" && i.provider.startsWith("sso:"),
        )
      if (!isSso) return
      try {
        await provisionSso()
      } catch {
        // Non-fatal: the app still renders; a later re-probe / manual retry recovers.
        return
      }
      if (!cancelled) setReprobeNonce((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const switchOrg = useCallback((newOrgId: string) => {
    // D-166-08: set the `X-Org-Id` header SYNCHRONOUSLY — before any effect keyed on the
    // active org runs (React flushes child effects on the next commit) — so the
    // StreamsProvider teardown and the ChatLayout thread-list refetch both target the NEW
    // org. The state flip then drives those effects + the probe re-key.
    syncActiveOrgHeader(newOrgId)
    setActiveOrgIdState(newOrgId)
  }, [])

  const value = useMemo<OrgValue>(
    () => ({
      activeOrgId,
      orgs: memberships,
      role,
      canManage,
      canAuditView,
      canManageSso,
      loading,
      switchOrg,
    }),
    [activeOrgId, memberships, role, canManage, canAuditView, canManageSso, loading, switchOrg],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

/**
 * The org-context hook. Throws outside an `OrgProvider` — used by WRITERS (the switcher,
 * the shell) that must be mounted inside the provider by construction (citationNav idiom).
 */
export function useOrg(): OrgValue {
  const ctx = useContext(OrgContext)
  if (ctx === null) {
    throw new Error("useOrg must be used within an OrgProvider")
  }
  return ctx
}

/**
 * Non-throwing accessor — returns null outside a provider. Used by leaf reads (StreamsProvider's
 * teardown bridge, tests, storybook) so a component can still render where no provider is mounted.
 */
export function useOrgOptional(): OrgValue | null {
  return useContext(OrgContext)
}
