import { useEffect, useRef } from "react"
import { getExpert } from "@/lib/api/experts"
import type { ExpertBundle } from "@/types"

export interface ExpertLinkTargetArgs {
  /** The Expert bundle id the address names (`/app/experts/<id>`), or `null`. */
  id: string | null
  /** The catalog's ONE grant-aware list read. */
  experts: readonly ExpertBundle[]
  /** True until that read has answered. */
  loading: boolean
  /** The catalog's own detail-modal state setter. */
  setInspected: (expert: ExpertBundle) => void
}

/**
 * Phase 299-02 (LINK-02 / D-04) — OPEN AN EXPERT FROM ITS ADDRESS.
 *
 * Once the catalog's list has answered, an Expert in it opens its detail modal straight from the
 * list (no second read). An Expert NOT in it — the list's default filters hide it, or it was just
 * shared — is asked for ONCE with `getExpert(id)`: the server's own grant-aware per-Expert read,
 * never the resolver arm and never the management arm. A refused read opens nothing: the catalog
 * stays as it is, and "can't be opened" is plan 299-03's gate, not this hook's.
 *
 * ⛔ READ-ONLY: the list, or one `getExpert`. ⛔ ONCE PER ID — a ref keyed on the id, so closing
 * the modal never reopens it while the address is unchanged, and a late answer for an id the
 * address has since left is dropped.
 */
export function useExpertLinkTarget({ id, experts, loading, setInspected }: ExpertLinkTargetArgs): void {
  const linked = id ? id.toLowerCase() : null
  const setRef = useRef(setInspected)
  useEffect(() => {
    setRef.current = setInspected
  })
  const handled = useRef<string | null>(null)
  const current = useRef<string | null>(linked)
  useEffect(() => {
    current.current = linked
  }, [linked])

  useEffect(() => {
    if (linked === null || loading || handled.current === linked) return
    handled.current = linked
    const listed = experts.find((e) => e.id.toLowerCase() === linked)
    if (listed) {
      setRef.current(listed)
      return
    }
    getExpert(linked)
      .then((expert) => {
        if (current.current === linked) setRef.current(expert)
      })
      .catch(() => {
        // A refused or failed read opens nothing; the catalog is left exactly as it was.
      })
  }, [linked, loading, experts])
}
