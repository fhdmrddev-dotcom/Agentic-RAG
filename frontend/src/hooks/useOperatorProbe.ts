import { useEffect, useState } from "react"
import { getOperatorProbe, type OperatorIdentity } from "@/lib/api"

export interface UseOperatorProbe {
  /** True only while the identity is present. Decides RENDERING ONLY — never a
   *  security boundary (see the SECURITY NOTE below). */
  isOperator: boolean
  /** The operator identity on 200, or `null` for a non-operator (404). */
  identity: OperatorIdentity | null
  /** True until the one-shot per-session probe resolves. */
  loading: boolean
}

/**
 * One-shot operator probe, keyed to the authenticated user (WR-01). Calls
 * `getOperatorProbe()` (which returns the identity on 200 and `null` on 404) and
 * exposes `{ isOperator, identity, loading }`: `identity !== null` →
 * `isOperator = true`; a 404/null (or any error) → `isOperator = false`.
 *
 * WR-01: the probe is keyed to `userId`, NOT to App mount. Two real flows broke
 * when it was mount-only:
 *   1. Fresh sign-in — on the login screen there is no session, so the probe
 *      resolved `null`; when the operator then signed in (SPA state change via
 *      onAuthStateChange, no page reload) a mount-only effect never re-fired, so a
 *      legitimate operator got no shield until they happened to hard-refresh.
 *   2. Same-tab user switch — after signOut → signIn as a different, non-operator
 *      user, a stale `isOperator=true` (and the previous operator's email) leaked.
 * Keying to `userId` re-probes on user change and clears operator state on
 * sign-out (`userId === null`), preserving the one-probe-per-session budget
 * (Pitfall 4) and staying fail-closed.
 *
 * SECURITY NOTE (Pitfall 13 / D-07): the probe result decides RENDERING ONLY —
 * whether to show the operator shield / Control Room. It is NOT the security
 * authority. The backend `require_operator` router gate returns a byte-identical
 * 404 on every `/admin` call, so a forged `isOperator=true` in the browser
 * reveals nothing and reaches no data. A non-operator's probe yields `null` so
 * their nav stays byte-identical to today (the non-discoverable contract).
 *
 * @param userId The authenticated user id (or `null` when signed out).
 */
export function useOperatorProbe(userId: string | null): UseOperatorProbe {
  const [identity, setIdentity] = useState<OperatorIdentity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Local per-run cancel flag (not a shared ref): the effect re-runs whenever
    // userId changes, and a late-resolving probe from a PRIOR user must never
    // set state for the CURRENT user.
    let cancelled = false

    // Signed out (or no session yet): clear any prior operator identity so the
    // shield/email never leaks across a same-tab user switch, and resolve
    // immediately — fail-closed, no probe.
    if (!userId) {
      setIdentity(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    // Re-probe for this user. Clear stale identity first so a same-tab switch
    // never briefly shows the previous operator's shield while the probe is in
    // flight.
    setIdentity(null)
    setLoading(true)
    getOperatorProbe()
      .then((result) => {
        if (!cancelled) setIdentity(result)
      })
      .catch(() => {
        // A probe failure (auth/network) is treated as "not an operator" for
        // rendering — the backend gate remains the real authority.
        if (!cancelled) setIdentity(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { isOperator: identity !== null, identity, loading }
}
