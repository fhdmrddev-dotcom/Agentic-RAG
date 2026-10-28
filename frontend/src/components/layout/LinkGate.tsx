/**
 * Phase 299-03 (LINK-04 / LINK-05 / LINK-06; D-06..D-09 client, D-12..D-17, D-24) — THE ONE GATE
 * IN FRONT OF EVERY ENTITY ADDRESS.
 *
 * `/app/chat|workflows|runs|experts/<uuid>` is not opened on the address alone: the server is asked
 * once (`GET /links/{kind}/{id}`) and the answer decides what the main region shows.
 *
 *   | the answer                                  | the decision                                 |
 *   |---------------------------------------------|----------------------------------------------|
 *   | no entity address                           | `none` — the switch renders as today          |
 *   | not in yet (or the org / chat list pending) | `holding` — the kind's "Opening the …" line   |
 *   | a thread already in the active org's list   | `open` — no server call at all                |
 *   | 404 (missing ≡ forbidden, one body)         | `cant` — the one card over the generic area   |
 *   | 200, `org_id` null or the active org        | `open` (a same-org thread absent from the     |
 *   |                                             |   list: reload the list ONCE, then open/cant) |
 *   | 200, `org_id` another of the person's orgs  | `prompt` — "This is in <org> — switch?"       |
 *   | a throw (5xx, network, a 401 mid-refresh)   | `holding`, retried at 2 s, 4 s, 8 s, then 8 s |
 *
 * ⛔ A THROW NEVER SHOWS THE CARD (T-299-25 / Pitfall 5). Only the server's 404 produces "can't be
 * opened"; an outage keeps holding and retries, so a working link is never called broken.
 *
 * WHY A COMPONENT WITH A RENDER-PROP CHILD: `AppViewSwitch` owns no hooks (D-28, fenced), so the
 * state this needs (the answer cache, the retry timer) lives here and the switch receives the
 * decision as a plain value: `<LinkGate …>{(gate) => …}</LinkGate>`. LinkGate renders its child's
 * result directly — no wrapper element.
 *
 * WHY NO ROUTER HOOK (297 D-08): `useAppNavigation` is the only caller of the router hooks. Every
 * address read and write here goes through the `entityLink` object App hands down.
 *
 * WHY THE CACHE IS PER kind:id FOR THE GATE'S LIFE: the answer names the ITEM's org, so it does not
 * depend on the active org — after a Switch the same answer now matches and the item opens with no
 * second request. The kind is read off the parsed route's target, never off `activeView`, so the
 * switch keeps ONE stripped workflow-run comparison.
 *
 * D-24 (resume): once signed in, the gate consumes the remembered sign-in target ONCE on mount;
 * `entityLink.resume()` replaces the address with it only when the address on screen is chat home.
 *
 * ⛔ Never touches the streams provider or its subscriptions.
 */
import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { resolveLink, type LinkAnswer, type LinkKind, type LinkTarget } from "@/lib/api/links"
import { useOrgOptional } from "@/providers/OrgProvider"
import { COPY_LOADING } from "@/pages/WorkflowRunPage"
import type { EntityLink } from "@/hooks/useAppNavigation"
import type { AppRoute } from "@/lib/appRoutes"
import type { Thread } from "@/types"

/** UI-SPEC S2 — one sentence per kind. The run's is the run page's own, so the hand-off is invisible. */
// The run's entry is a GETTER, read when a hold renders rather than when this module loads: several
// layout suites stub the run page's module without its constant, and an eager read would fail
// their import even though they never hold a run.
// eslint-disable-next-line react-refresh/only-export-components -- the sentences live beside the one gate that picks them
export const HOLDING_SENTENCE: Readonly<Record<LinkKind, string>> = {
  thread: "Opening the chat…",
  workflow: "Opening the workflow…",
  get run() {
    return COPY_LOADING
  },
  expert: "Opening the Expert…",
}

/** Retry delays after a throw: 2 s, 4 s, 8 s, then every 8 s. */
const RETRY_MS = [2000, 4000, 8000] as const
const retryDelay = (attempt: number) => RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]

/** The card's exit per kind (D-15): a push to the generic home of that kind. */
const EXIT_ROUTE: Record<LinkKind, AppRoute> = {
  thread: { view: "chat" },
  workflow: { view: "workflows" },
  run: { view: "workflows" },
  expert: { view: "experts" },
}

/** The decision the switch renders. */
export type GateState =
  | { status: "none" }
  | { status: "holding"; kind: LinkKind; sentence: string }
  | { status: "cant"; kind: LinkKind; route: AppRoute | null; exit: AppRoute }
  | { status: "prompt"; kind: LinkKind; target: LinkTarget }
  | { status: "open"; kind: LinkKind }

export interface LinkGateProps {
  /** App's entity navigators. Absent (a suite mounting the layout alone): the gate is inert. */
  entityLink: EntityLink | undefined
  /** The active org's thread list (a thread already in it opens with no server call). */
  threads: readonly Thread[]
  /** True until the active org's list has answered. */
  threadsPending: boolean
  /** Refetch the list — once, for a same-org thread the list does not hold yet. */
  loadThreads: () => Promise<void>
  /** Select the thread that reload found (the address binding only re-selects on its own inputs). */
  selectThread?: (thread: Thread) => void
  children: (gate: GateState) => ReactNode
}

export function LinkGate({ entityLink, threads, threadsPending, loadThreads, selectThread, children }: LinkGateProps) {
  const org = useOrgOptional()
  const activeOrgId = org?.activeOrgId ?? null
  // A fresh device: the provider has not picked an org yet. Without a provider there is no org to
  // compare against (and nothing to switch to), so nothing holds on it.
  const orgHold = org !== null && activeOrgId === null && (org.loading || org.orgs.length > 0)

  const target = entityLink?.target ?? null
  const kind = target?.kind ?? null
  const key = target ? `${target.kind}:${target.id}` : null
  const inList = target !== null && target.kind === "thread" && threads.some((t) => t.id === target.id)

  // ── the answer cache, the in-flight set and the retry timer (refs + one re-render counter) ──
  const cache = useRef(new Map<string, LinkAnswer>())
  const inflight = useRef(new Set<string>())
  const wantedKey = useRef<string | null>(null)
  const mounted = useRef(false)
  const retryTimer = useRef<number | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }, [])

  // Ask only when the answer is needed: an entity address, the org known, and (for a thread) the
  // list settled without it.
  const needsAnswer = target !== null && !orgHold && !(target.kind === "thread" && (threadsPending || inList))
  const askKey = needsAnswer ? key : null
  useEffect(() => {
    wantedKey.current = askKey
    if (askKey === null || target === null) return
    if (cache.current.has(askKey) || inflight.current.has(askKey)) return
    const { kind: k, id } = target
    const attempt = (n: number) => {
      inflight.current.add(askKey)
      resolveLink(k, id).then(
        (answer) => {
          inflight.current.delete(askKey)
          cache.current.set(askKey, answer)
          if (mounted.current) bump()
        },
        () => {
          inflight.current.delete(askKey)
          if (!mounted.current || wantedKey.current !== askKey) return
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null
            if (mounted.current && wantedKey.current === askKey && !cache.current.has(askKey)) attempt(n + 1)
          }, retryDelay(n))
        },
      )
    }
    attempt(0)
    // `target` is read for its kind and id, which `askKey` already carries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askKey])

  // ── D-24: resume a remembered sign-in target, once ──
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !entityLink) return
    resumed.current = true
    entityLink.resume()
  }, [entityLink])

  // ── a same-org thread the list does not hold yet: reload the list ONCE ──
  const answer = askKey !== null ? cache.current.get(askKey) : undefined
  const sameOrg = (t: LinkTarget) => t.org_id === null || org === null || t.org_id === activeOrgId
  const reloadState = useRef(new Map<string, "loading" | "done">())
  const needsReload =
    target !== null && target.kind === "thread" && answer?.status === "ok" && sameOrg(answer.target) && !inList
  useEffect(() => {
    if (!needsReload || key === null || reloadState.current.has(key)) return
    reloadState.current.set(key, "loading")
    void loadThreads()
      .catch(() => {})
      .finally(() => {
        reloadState.current.set(key, "done")
        if (mounted.current) bump()
      })
  }, [needsReload, key, loadThreads])
  // The reload found it: select it (the address binding re-selects only on its own inputs).
  const selectedAfterReload = useRef(new Set<string>())
  useEffect(() => {
    if (key === null || target === null || !inList || !selectThread) return
    if (reloadState.current.get(key) === undefined || selectedAfterReload.current.has(key)) return
    const found = threads.find((t) => t.id === target.id)
    if (!found) return
    selectedAfterReload.current.add(key)
    selectThread(found)
  }, [key, target, inList, threads, selectThread])

  // ── the decision ──
  let gate: GateState
  if (target === null || kind === null) gate = { status: "none" }
  else if (orgHold || (kind === "thread" && threadsPending)) gate = { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  else if (inList) gate = { status: "open", kind }
  else if (answer === undefined) gate = { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  else if (answer.status === "cant") gate = { status: "cant", kind, route: entityLink?.route ?? null, exit: EXIT_ROUTE[kind] }
  else if (!sameOrg(answer.target)) gate = { status: "prompt", kind, target: answer.target }
  else if (kind === "thread") {
    // Same org, not in the list: reloaded once; still absent → can't be opened.
    gate =
      key !== null && reloadState.current.get(key) === "done"
        ? { status: "cant", kind, route: entityLink?.route ?? null, exit: EXIT_ROUTE[kind] }
        : { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  } else gate = { status: "open", kind }

  return <>{children(gate)}</>
}
