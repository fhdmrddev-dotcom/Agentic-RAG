/**
 * Phase 271-03 (FIND-01 / FIND-03 / S7 / T-271-12) — Find's request sequencing.
 *
 * Takes the wire body `toSearchRequest` (pages/findState.ts) produced — or `null` when no
 * search is active — and owns everything the pure Find state deliberately cannot: the result
 * page, the exact `total`, `older_matches`, the loading flag, the error, and the request id
 * that drops a stale answer.
 *
 * ── THE THREE RULES ───────────────────────────────────────────────────────────────────
 * 1. ZERO requests while `request` is null. The resting Documents tab is the shipped browse
 *    list and must cost nothing — every LibraryPage mount suite depends on that.
 * 2. Debounce 300 ms (FilterBar's shipped constant and `timerRef` + `reqIdRef` pattern), keyed
 *    on the serialised body, so a burst of keystrokes is ONE call with the latest body and a
 *    slow earlier answer can never overwrite a newer one.
 * 3. ⛔ S7 — on error, KEEP the previous rows and total and set `error`. This is deliberately
 *    NOT `resolveFilterIntoList` (LibraryPage): that function's catch swaps the list for the
 *    UNFILTERED folder list, which would show a person documents outside the filters they set
 *    with nothing saying so. Find shows an error box over the last good answer instead.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { DocumentSearchError, searchDocuments } from "@/lib/api/documents"
import type { DocumentSearchRequest, DocumentSearchRow } from "@/types"

export interface UseDocumentFindResult {
  rows: DocumentSearchRow[]
  /** The server's exact count; `null` until a search has answered (or at rest). */
  total: number | null
  olderMatches: number
  loading: boolean
  error: DocumentSearchError | null
  /** Re-issue the last request (the error box's "Try again"). */
  retry: () => void
}

export function useDocumentFind({
  request,
  debounceMs = 300,
}: {
  request: DocumentSearchRequest | null
  debounceMs?: number
}): UseDocumentFindResult {
  const [rows, setRows] = useState<DocumentSearchRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [olderMatches, setOlderMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<DocumentSearchError | null>(null)
  // Bumped by retry() so the effect re-runs for an unchanged body.
  const [attempt, setAttempt] = useState(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  const key = request === null ? null : JSON.stringify(request)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // Any answer still in flight is now stale, whatever happens next.
    const myReq = ++reqIdRef.current

    if (key === null) {
      // Rule 1: at rest — no call, and nothing stale left on screen.
      setRows([])
      setTotal(null)
      setOlderMatches(0)
      setLoading(false)
      setError(null)
      return
    }

    const body = JSON.parse(key) as DocumentSearchRequest
    setLoading(true)
    timerRef.current = setTimeout(() => {
      searchDocuments(body)
        .then((res) => {
          if (myReq !== reqIdRef.current) return
          setRows(res.documents)
          setTotal(res.total)
          setOlderMatches(res.older_matches)
          setError(null)
        })
        .catch((e: unknown) => {
          if (myReq !== reqIdRef.current) return
          // Rule 3: rows and total are deliberately left as they were.
          setError(
            e instanceof DocumentSearchError
              ? e
              : new DocumentSearchError("network", "Couldn't run this search."),
          )
        })
        .finally(() => {
          if (myReq === reqIdRef.current) setLoading(false)
        })
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [key, debounceMs, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { rows, total, olderMatches, loading, error, retry }
}
