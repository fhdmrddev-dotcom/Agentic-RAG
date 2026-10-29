/**
 * Phase 301-02 (NOTE-01 / NOTE-05 · D-15, D-17, D-18, D-33) — THE ONE CLIENT-SIDE READER OF
 * "WHICH RUNS ARE WAITING ON ME".
 *
 * ── ⛔ RULE 2 · D-v2.5-03 — REALTIME IS A HINT, NEVER TRUTH ───────────────────────────
 *
 * `useSourceAttention.ts` wrote this rule down before any hook needed it: *"If one is ever added
 * as a hint, it MUST fetch-reconcile on (re)connect rather than trusting"* what arrives on the
 * socket. **This hook is the hint that rule anticipated.** The list is learned from
 * `GET /notifications` and from nowhere else. A Realtime event on the person's own notices only
 * asks for a refetch; its body is never read, so a forged or out-of-order event cannot become the
 * list (T-301-11). A missed event costs at most one poll interval, because every other freshness
 * trigger refetches too: first mount, every SUBSCRIBED (a join or a rejoin after a dropped
 * socket), window focus, the tab becoming visible, an active-org or membership change, and the
 * 60 s poll (D-17).
 *
 * ── ⛔ HAS A VERDICT EVER ARRIVED? (`verdictKnown`, the T-235-39 shape) ─────────────────
 *
 * After a rejected FIRST fetch `loading` is false and `notices` is `[]` — identical to the server
 * saying *nothing is waiting*. A surface reading only those would print an all-clear it never
 * received. So:
 *
 *   loading            → we have not looked yet
 *   !loading && !known → we could not ask
 *   known              → the server answered, and `notices` / `total` are its whole answer
 *
 * A LATER failure keeps the previous answer (`verdictKnown` stays true) and sets
 * `failedSinceLast`, so a renderer can say the list may be out of date instead of blanking it.
 * The next successful fetch clears it.
 *
 * ── WHERE IT LIVES, AND WHERE IT IS CALLED ────────────────────────────────────────────
 *
 *   • Called from EXACTLY ONE place — `components/layout/attentionConditions.ts`'s
 *     `useWaitingRunConditions` (D-14). An inventory fence in `attentionTab.test.ts` pins it.
 *   • It lives OUTSIDE `StreamsProvider` (D-18): the subscription is user-scoped
 *     (`recipient_id=eq.<uid>`), not org-scoped, and does not tear down on an org switch.
 *   • A missing or throwing Supabase client degrades to poll + focus; it never crashes the shell
 *     (D-33, T-301-14).
 *   • It has NO minute tick. The "waited N min" phrase ticks inside 301-03's list rows only, so
 *     the shell that reads this hook does not re-render every minute.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { getWaitingNotices, type WaitingNotice, type WaitingNotices } from "@/lib/api/notifications"
import { supabase } from "@/lib/supabase"
import { useActiveOrgId } from "@/hooks/useActiveOrgId"
import { useOrgOptional } from "@/providers/OrgProvider"

/** D-17: within the 30-120 s band. Realtime makes the usual case immediate; this is the floor. */
const POLL_MS = 60_000

export interface WaitingNoticesState {
  /** The server's rows, verbatim. Possibly capped — see `total`. */
  notices: WaitingNotice[]
  /** The server's count of ALL open notices. A badge reads this, never `notices.length`. */
  total: number
  /** True until the first fetch settles, success or failure. */
  loading: boolean
  /** Has the server ever answered? Stays true through a later failure. */
  verdictKnown: boolean
  /** The latest fetch failed after an answer had landed; the list shown may be stale. */
  failedSinceLast: boolean
  /** Re-fetch now, aborting whatever is in flight. */
  refresh: () => void
}

type ChannelLike = { on?: unknown; subscribe?: unknown } | null | undefined

export function useWaitingNotices(): WaitingNoticesState {
  const [verdict, setVerdict] = useState<WaitingNotices | null>(null)
  const [loading, setLoading] = useState(true)
  const [failedSinceLast, setFailedSinceLast] = useState(false)

  const inFlight = useRef<AbortController | null>(null)
  const answered = useRef(false)

  const refresh = useCallback(() => {
    // The newest ask wins: whatever is still open is abandoned rather than raced.
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    getWaitingNotices(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        answered.current = true
        setVerdict(next)
        setLoading(false)
        setFailedSinceLast(false)
      })
      .catch(() => {
        // An abort is not a failure — the replacement fetch owns the outcome.
        if (controller.signal.aborted) return
        // A real failure keeps the previous answer; it is only "stale" if there was one.
        setLoading(false)
        if (answered.current) setFailedSinceLast(true)
      })
  }, [])

  // The refetch keys (D-17 / F17): the active org, and the SET of orgs the person belongs to.
  const activeOrgId = useActiveOrgId()
  const orgs = useOrgOptional()?.orgs
  const membershipKey = (orgs ?? []).map((o) => o.org_id).sort().join(",")

  useEffect(() => {
    refresh()
  }, [refresh, activeOrgId, membershipKey])

  useEffect(() => {
    return () => {
      inFlight.current?.abort()
    }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    return () => {
      clearInterval(id)
    }
  }, [refresh])

  useEffect(() => {
    const onFocus = () => refresh()
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh])

  // The Realtime hint. Everything inside is defensive: a broken socket must cost freshness, never
  // the shell (D-33). The event callback calls refresh() and ignores its argument entirely.
  const channelRef = useRef<ChannelLike>(null)
  useEffect(() => {
    let cancelled = false

    const attach = (uid: string) => {
      try {
        const channel = supabase.channel(`waiting-notices:${uid}`) as unknown as ChannelLike
        if (!channel) return
        channelRef.current = channel
        const on = channel.on as
          | ((event: string, filter: Record<string, string>, cb: () => void) => unknown)
          | undefined
        const subscribe = channel.subscribe as ((cb: (status: string) => void) => unknown) | undefined
        // Separate statements on the channel variable — never chained after subscribe().
        on?.call(
          channel,
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` },
          () => refresh(),
        )
        subscribe?.call(channel, (status: string) => {
          if (status === "SUBSCRIBED") refresh()
        })
      } catch {
        // Realtime is a hint: the poll and the focus listeners still keep the list fresh.
      }
    }

    try {
      const auth = (supabase as unknown as { auth?: { getSession?: unknown } }).auth
      const getSession = auth?.getSession
      if (typeof getSession === "function") {
        const pending = (getSession as () => unknown).call(auth) as
          | Promise<{ data?: { session?: { user?: { id?: string } } | null } }>
          | undefined
        if (pending && typeof pending.then === "function") {
          pending
            .then((result) => {
              if (cancelled) return
              const uid = result?.data?.session?.user?.id
              if (uid) attach(uid)
            })
            .catch(() => {
              // No session, no hint — the poll still runs.
            })
        }
      }
    } catch {
      // A missing or throwing client degrades to poll + focus.
    }

    return () => {
      cancelled = true
      const channel = channelRef.current
      channelRef.current = null
      if (channel) {
        try {
          supabase.removeChannel(channel as unknown as Parameters<typeof supabase.removeChannel>[0])
        } catch {
          // Tearing down a hint never throws into React.
        }
      }
    }
  }, [refresh])

  return {
    notices: verdict?.notices ?? [],
    total: verdict?.total ?? 0,
    loading,
    verdictKnown: verdict !== null,
    failedSinceLast,
    refresh,
  }
}
