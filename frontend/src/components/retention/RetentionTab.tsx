/**
 * Phase 275 plan 04 (S1 / D-01 / D-29) — Org admin → Retention (1B): the posture line, then the
 * sub-tabs Policies · Legal holds · Waiting for you · History.
 *
 * Self-contained like `OrgExpertsTab` (it owns its fetches), with the shell's honest-degrade rule:
 * a failed read keeps the last-known values and says `Couldn't load retention. Try again.`
 *
 * D-01: the Waiting-for-you count pill turns red ONLY when N > 0, and it is the ONLY signal that
 * something needs the admin — no banner, no count on the band's Retention tab.
 *
 * The sweep ships switched off (D-29), so the posture line says so in amber rather than claiming a
 * healthy schedule. Every recorded write below calls `onRecorded` → the band's marker pulses (062-A).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { getRetentionSummary, type RetentionSummary } from "@/lib/api/retention"
import { LegalHoldsList } from "./LegalHoldsList"
import { RetentionHistory } from "./RetentionHistory"
import { RetentionPolicies } from "./RetentionPolicies"
import { WaitingForYou } from "./WaitingForYou"
import { AMBER_TEXT_CLASS, RichCopy } from "./RetentionChip"
import { RETENTION_COPY, fillCopy, formatRetentionDateTime } from "./retentionCopy"

const C = RETENTION_COPY

type SubTab = "policies" | "holds" | "waiting" | "history"
const ORDER: SubTab[] = ["policies", "holds", "waiting", "history"]

const FAILED_STATUSES = new Set(["failed", "incomplete"])

function Posture({ summary }: { summary: RetentionSummary }) {
  const policies = summary.counts.policies ?? 0
  const holds = summary.counts.active_holds ?? 0
  const counts = (
    <span data-testid="posture-counts">
      {fillCopy(
        C.sketchTemplates.postureCounts,
        { P: policies, policies: policies === 1 ? C.ported.wordPolicy : C.ported.wordPolicies, H: holds },
        holds,
      )}
    </span>
  )
  if (!summary.sweep_enabled) {
    return (
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground" data-testid="posture">
        <span className={cn("inline-flex items-center gap-2", AMBER_TEXT_CLASS)}>
          <ShieldAlert className="h-4 w-4 flex-none" aria-hidden="true" />
          {C.contract.sweepsOff}
        </span>
        {counts}
      </div>
    )
  }
  // 275-REVIEW F-WR-04: ONLY `ok` is healthy. `running` (claimed — `last_run_at` still holds the
  // PREVIOUS run's time, whose outcome is already overwritten; a crashed worker leaves it there)
  // and any status this client does not know read as "not finished", in amber — never a claim.
  let lead
  const status = summary.last_status ?? null
  if (!summary.last_run_at && status === null) {
    lead = <span>{C.contract.neverRun}</span>
  } else if (status !== null && FAILED_STATUSES.has(status) && summary.last_run_at) {
    lead = (
      <span className={cn("inline-flex items-center gap-2", AMBER_TEXT_CLASS)}>
        <ShieldAlert className="h-4 w-4 flex-none" aria-hidden="true" />
        {fillCopy(C.specTemplates.postureNotFinished, { "date time": formatRetentionDateTime(summary.last_run_at) })}
      </span>
    )
  } else if (status !== "ok" || !summary.last_run_at) {
    lead = (
      <span className={cn("inline-flex items-center gap-2", AMBER_TEXT_CLASS)}>
        <ShieldAlert className="h-4 w-4 flex-none" aria-hidden="true" />
        {C.contract.postureNotReported}
      </span>
    )
  } else {
    lead = (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full bg-success" />
        <RichCopy text={fillCopy(C.sketchTemplates.postureHealthy, { date: formatRetentionDateTime(summary.last_run_at) })} />
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground" data-testid="posture">
      {lead}
      <span>
        <RichCopy text={fillCopy(C.sketchTemplates.postureNext, { date: formatRetentionDateTime(summary.next_run_at) })} />
      </span>
      {counts}
    </div>
  )
}

export function RetentionTab({ onRecorded }: { onRecorded?: () => void }) {
  const [summary, setSummary] = useState<RetentionSummary | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<SubTab>("policies")
  const [waiting, setWaiting] = useState<number | null>(null)
  const tabRefs = useRef<Record<SubTab, HTMLButtonElement | null>>({ policies: null, holds: null, waiting: null, history: null })
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await getRetentionSummary()
      if (!alive.current) return
      setSummary(res)
      setWaiting(res.counts.waiting ?? 0)
      setLoadError(false)
    } catch {
      if (alive.current) setLoadError(true) // keep the last-known posture and counts
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const recorded = useCallback(() => {
    onRecorded?.()
    void load()
  }, [onRecorded, load])

  const onWaitingCount = useCallback((n: number) => setWaiting(n), [])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const i = ORDER.indexOf(tab)
    const next =
      e.key === "Home"
        ? ORDER[0]
        : e.key === "End"
          ? ORDER[ORDER.length - 1]
          : ORDER[(i + (e.key === "ArrowRight" ? 1 : ORDER.length - 1)) % ORDER.length]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const policies = summary?.counts.policies ?? 0
  const holds = summary?.counts.active_holds ?? 0
  const n = waiting ?? 0

  const tabs: Array<{ id: SubTab; label: string; count: string | null; aria?: string; red?: boolean }> = [
    { id: "policies", label: C.ported.tabPolicies, count: summary ? String(policies) : null },
    {
      id: "holds",
      label: C.ported.holdsTitle,
      count: summary ? fillCopy(C.sketchTemplates.activeCount, { N: holds }) : null,
    },
    {
      id: "waiting",
      label: C.ported.tabWaiting,
      count: waiting !== null ? String(n) : null,
      aria: waiting !== null ? fillCopy(C.specTemplates.waitingAria, { N: n }) : undefined,
      red: n > 0,
    },
    { id: "history", label: C.ported.tabHistory, count: null },
  ]

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6">
      {summary ? (
        <Posture summary={summary} />
      ) : !loadError ? (
        <p aria-busy="true" className="text-sm text-muted-foreground opacity-40">
          {C.contract.loading}
        </p>
      ) : null}
      {loadError && (
        <p role="alert" className={cn("text-sm", AMBER_TEXT_CLASS)}>
          {C.contract.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            {C.contract.tryAgain}
          </button>
        </p>
      )}

      <div role="tablist" aria-label={C.ported.tabRetention} className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`retention-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`retention-panel-${t.id}`}
              aria-label={t.aria}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onKeyDown}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors",
                selected ? "border-primary font-semibold text-foreground" : "border-transparent font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== null && (
                <span
                  data-testid={`retention-count-${t.id}`}
                  className={cn(
                    "rounded-full px-2 text-[11px] font-semibold",
                    t.red ? "bg-destructive/10 text-[hsl(0_72%_40%)] dark:text-[hsl(0_80%_80%)]" : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`retention-panel-${tab}`} aria-labelledby={`retention-tab-${tab}`}>
        {tab === "policies" ? (
          <RetentionPolicies sweepHourUtc={summary?.sweep_hour_utc} onRecorded={recorded} />
        ) : tab === "holds" ? (
          <LegalHoldsList onRecorded={recorded} />
        ) : tab === "waiting" ? (
          <WaitingForYou onRecorded={recorded} onCountChange={onWaitingCount} />
        ) : (
          <RetentionHistory />
        )}
      </div>
    </div>
  )
}
