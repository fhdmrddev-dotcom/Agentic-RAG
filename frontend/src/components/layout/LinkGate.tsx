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
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { resolveLink, type LinkAnswer, type LinkKind, type LinkTarget } from "@/lib/api/links"
import { useOrgOptional } from "@/providers/OrgProvider"
// READ only (F4): the answering chats are snapshotted here; the store is never written.
import { useStreamsStore } from "@/stores/streamsStore"
import { OPEN_IT_AFTER_ALL, SWITCH_BACK, THIS_ORG, stayedIn, yourChatInStill } from "@/components/org/orgItemsCopy"
import type { SwitchOrgPromptProps } from "./SwitchOrgPrompt"
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

/** A bar the switch renders as the first child of the main region (the Stay notice, UI-D9, or the
 *  after-switch line, UI-D10), or `null`. */
type WithNotice = { notice: ReactNode }

type GateCore =
  | { status: "none" }
  | { status: "holding"; kind: LinkKind; sentence: string }
  | { status: "cant"; kind: LinkKind; route: AppRoute | null; exit: AppRoute }
  | { status: "prompt"; kind: LinkKind; target: LinkTarget; prompt: SwitchOrgPromptProps }
  | { status: "open"; kind: LinkKind }

/** The decision the switch renders. */
export type GateState = GateCore & WithNotice

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
  // (`orgs` is read defensively: several layout suites mock the context with only the fields they use.)
  const memberships = org?.orgs ?? []
  const orgHold = org !== null && activeOrgId === null && (org.loading || memberships.length > 0)

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

  // ── Stay / Back to it / Switch / Switch back (D-16, D-17, D-19, D-37, D-39) ──
  const address = entityLink?.address ?? null
  const currentName = memberships.find((o) => o.org_id === activeOrgId)?.name ?? THIS_ORG
  // The active org's answering chats, oldest first, titled from the active org's list.
  const answeringIn = (ids: Iterable<string>) => {
    const out: { id: string; title: string }[] = []
    for (const id of ids) {
      const t = threads.find((x) => x.id === id)
      if (t) out.push({ id: t.id, title: t.title })
    }
    return out
  }
  const streamingIds = useStreamsStore((s) => s.streamingThreads)
  const streaming = answeringIn(streamingIds)

  // The Stay notice lives from the Stay click until the address changes AGAIN after landing.
  const [stayed, setStayed] = useState<{ from: string; landed: string | null; route: AppRoute; current: string } | null>(null)
  // The after-switch line: a SNAPSHOT taken before the switch, kept until the address changes.
  const [afterSwitch, setAfterSwitch] = useState<{
    address: string
    previousOrgId: string
    previousName: string
    threadId: string
  } | null>(null)
  const [switchingKey, setSwitchingKey] = useState<string | null>(null)
  // React's "adjust state when an input changes" pattern: no frame shows a stale notice.
  if (stayed !== null && address !== null) {
    if (stayed.landed === null) {
      if (address !== stayed.from) setStayed({ ...stayed, landed: address })
    } else if (address !== stayed.landed) setStayed(null)
  }
  if (afterSwitch !== null && address !== afterSwitch.address) setAfterSwitch(null)
  if (switchingKey !== null && switchingKey !== key) setSwitchingKey(null)

  const stay = (to?: AppRoute) => {
    if (!entityLink || !entityLink.route) return
    setStayed({ from: entityLink.address, landed: null, route: entityLink.route, current: currentName })
    // ⛔ No org write and no subscription touched: Stay is an address REPLACE and nothing else.
    if (to) entityLink.leave(to)
    else entityLink.leave()
  }
  const switchTo = (t: LinkTarget) => {
    if (!org || t.org_id === null || !entityLink || key === null) return
    // F4: SNAPSHOT FIRST. The streams provider tears every run subscription down on an org change,
    // so the answering chats are read before `switchOrg`, never re-derived afterwards.
    const snapshot = answeringIn(useStreamsStore.getState().streamingThreads)
    const last = snapshot[snapshot.length - 1]
    setAfterSwitch(
      last && activeOrgId !== null
        ? { address: entityLink.address, previousOrgId: activeOrgId, previousName: currentName, threadId: last.id }
        : null,
    )
    setSwitchingKey(key)
    org.switchOrg(t.org_id)
  }
  const switchBack = () => {
    if (!org || !afterSwitch || !entityLink) return
    const back = afterSwitch
    setAfterSwitch(null)
    org.switchOrg(back.previousOrgId)
    entityLink.openThread(back.threadId)
  }

  // ── the decision ──
  let core: GateCore
  if (target === null || kind === null) core = { status: "none" }
  else if (orgHold || (kind === "thread" && threadsPending)) core = { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  else if (inList) core = { status: "open", kind }
  else if (answer === undefined) core = { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  else if (answer.status === "cant") core = { status: "cant", kind, route: entityLink?.route ?? null, exit: EXIT_ROUTE[kind] }
  else if (!sameOrg(answer.target)) {
    const t = answer.target
    core = {
      status: "prompt",
      kind,
      target: t,
      prompt: {
        target: t,
        currentOrgName: currentName,
        streaming,
        switching: switchingKey === key,
        onStay: () => stay(),
        onSwitch: () => switchTo(t),
        onBackToIt: () => {
          const latest = streaming[streaming.length - 1]
          if (latest) stay({ view: "chat", threadId: latest.id })
        },
      },
    }
  } else if (kind === "thread") {
    // Same org, not in the list: reloaded once; still absent → can't be opened.
    core =
      key !== null && reloadState.current.get(key) === "done"
        ? { status: "cant", kind, route: entityLink?.route ?? null, exit: EXIT_ROUTE[kind] }
        : { status: "holding", kind, sentence: HOLDING_SENTENCE[kind] }
  } else core = { status: "open", kind }

  let notice: ReactNode = null
  if (stayed !== null && address !== null && address !== stayed.from) {
    // UI-D9: one line at the top of the surface the person landed on, until the next navigation.
    notice = (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-card px-4 py-2 text-xs text-muted-foreground"
      >
        <span>{stayedIn(stayed.current)}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const route = stayed.route
            setStayed(null)
            entityLink?.openRoute(route)
          }}
        >
          {OPEN_IT_AFTER_ALL}
        </Button>
      </div>
    )
  } else if (afterSwitch !== null && address === afterSwitch.address && core.status === "open") {
    // UI-D10: present tense only (reattach-on-return is assumption A1, unproven until G-4 row 2).
    notice = (
      <div className="mx-6 mt-4 flex shrink-0 items-center gap-2 rounded-md border border-border/40 bg-card px-4 py-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none" />
        <span>{yourChatInStill(afterSwitch.previousName)}</span>
        <Button variant="outline" size="sm" onClick={switchBack}>
          {SWITCH_BACK}
        </Button>
      </div>
    )
  }
  const gate: GateState = { ...core, notice }

  return <>{children(gate)}</>
}
