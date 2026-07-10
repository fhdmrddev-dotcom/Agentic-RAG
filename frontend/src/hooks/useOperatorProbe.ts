import { useEffect, useRef, useState } from "react"
import { getOperatorProbe, type OperatorIdentity } from "@/lib/api"

export interface UseOperatorProbe {
  /** True only while the identity is present. Decides RENDERING ONLY — never a
   *  security boundary (see the SECURITY NOTE below). */
  isOperator: boolean
  /** The operator identity on 200, or `null` for a non-operator (404). */
  identity: OperatorIdentity | null
  /** True until the one-shot mount probe resolves. */
  loading: boolean
}

/**
 * One-shot operator probe, run once on mount. Calls `getOperatorProbe()` (which
 * returns the identity on 200 and `null` on 404) and exposes
 * `{ isOperator, identity, loading }`: `identity !== null` → `isOperator = true`;
 * a 404/null (or any error) → `isOperator = false`.
 *
 * SECURITY NOTE (Pitfall 13 / D-07): the probe result decides RENDERING ONLY —
 * whether to show the operator shield / Control Room. It is NOT the security
 * authority. The backend `require_operator` router gate returns a byte-identical
 * 404 on every `/admin` call, so a forged `isOperator=true` in the browser
 * reveals nothing and reaches no data. A non-operator's probe yields `null` so
 * their nav stays byte-identical to today (the non-discoverable contract).
 */
export function useOperatorProbe(): UseOperatorProbe {
  const [identity, setIdentity] = useState<OperatorIdentity | null>(null)
  const [loading, setLoading] = useState(true)

  // Guard against setState-after-unmount (SkillStudioPage `alive` pattern): the
  // one-shot probe may resolve after the component has already unmounted.
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    getOperatorProbe()
      .then((result) => {
        if (alive.current) setIdentity(result)
      })
      .catch(() => {
        // A probe failure (auth/network) is treated as "not an operator" for
        // rendering — the backend gate remains the real authority.
        if (alive.current) setIdentity(null)
      })
      .finally(() => {
        if (alive.current) setLoading(false)
      })
    return () => {
      alive.current = false
    }
  }, [])

  return { isOperator: identity !== null, identity, loading }
}
