import { useCallback, useEffect, useState } from "react"
import { getEffectiveFeatures, type EffectiveFeatures } from "@/lib/api"

export interface UseEffectiveFeatures {
  /** The caller's effective feature→visible map. Fails CLOSED to `{}` (every
   *  governed feature hidden) on any error AND before the first resolve — a blip
   *  never flashes an operators-only feature to an end user (T-148-FAILCLOSED).
   *  RENDER-ONLY: the `require_visible` API gates (148-05) are the security wall. */
  features: EffectiveFeatures
  /** True until the one-shot per-session fetch resolves. */
  loading: boolean
  /** Re-fetch the map — the D-04 graceful-bounce re-sync after a mid-session
   *  audience flip (the nav re-syncs within the ~30s app_settings TTL window). */
  refetch: () => void
}

/**
 * One-shot effective-features fetch, keyed to the authenticated user (WR-01) — the
 * DIRECT sibling of `useOperatorProbe`. Calls `getEffectiveFeatures()` (the authed
 * `GET /features` — every user gets a 200 map) and exposes `{ features, loading,
 * refetch }`. App.tsx filters the nav by `features` (a false/absent key → the nav
 * item simply does not render — the sketch 069-A vanish, never a locked/badged item).
 *
 * WR-01: keyed to `userId`, NOT to App mount — the exact fix `useOperatorProbe`
 * documents. Two real flows break under mount-only keying:
 *   1. Fresh SPA sign-in (no page reload) — a mount-only effect never re-fires, so a
 *      just-signed-in operator would get a stale end-user map until a hard refresh.
 *   2. Same-tab user switch (signOut → signIn as a different user) — a stale prior
 *      map would leak. Keying to `userId` re-probes on user change and clears the map
 *      on sign-out (`userId === null`), preserving the one-fetch-per-session budget.
 *
 * FAIL-CLOSED (T-148-FAILCLOSED / Pitfall 13): resolves to `{}` (hide every governed
 * feature) on ANY error — NOT a `null`/identity sentinel — and starts `{}`, so a
 * fetch blip or the pre-resolve window never flashes an operators-only feature. The
 * hide is render-only; the backend `require_visible` gate is the real authority.
 *
 * @param userId The authenticated user id (or `null` when signed out).
 */
export function useEffectiveFeatures(userId: string | null): UseEffectiveFeatures {
  const [features, setFeatures] = useState<EffectiveFeatures>({})
  const [loading, setLoading] = useState(true)
  // A refetch nonce (the D-04 bounce re-sync) — bumping it re-runs the effect for
  // the SAME user, re-reading the (possibly tightened) map within the TTL window.
  const [nonce, setNonce] = useState(0)
  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    // Local per-run cancel flag (not a shared ref): the effect re-runs whenever
    // userId (or the refetch nonce) changes, and a late-resolving fetch from a PRIOR
    // user must never set state for the CURRENT user.
    let cancelled = false

    // Signed out (or no session yet): clear any prior map so it never leaks across a
    // same-tab user switch, and resolve immediately — fail-closed, no fetch.
    if (!userId) {
      setFeatures({})
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    // Re-fetch for this user. Clear the stale map first (fail-closed) so a same-tab
    // switch never briefly shows the previous user's features while in flight.
    setFeatures({})
    setLoading(true)
    getEffectiveFeatures()
      .then((map) => {
        if (!cancelled) setFeatures(map)
      })
      .catch(() => {
        // A fetch failure (auth/network) is treated as "hide every governed feature"
        // for rendering — fail CLOSED to `{}`; the backend gate remains the authority.
        if (!cancelled) setFeatures({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, nonce])

  return { features, loading, refetch }
}
