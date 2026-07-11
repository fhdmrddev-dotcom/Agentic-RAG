// ─────────────────────────────────────────────────────────────────────────────
// Control Plane — the recomposed operator surface (ADMIN-02 / FLAG-01).
//
// Phase 147 (D-08 / sketch 066) PROMOTES the 146 "Overview" tab into the live
// "Control Plane" landing tab. The band-tab IA is re-authored to five tabs:
//   Control Plane (live) · Users & Access (🔒) · Model Registry (🔒) ·
//   Secrets (🔒) · Audit log (live)
// "System Controls" dissolves INTO the Control Plane body; "AI Models" / "API
// Keys" become the renamed Model Registry / Secrets locked tabs. Health lives in
// exactly ONE place (here) — no duplicated Overview health.
//
// The Control Plane body composes the locked 063-B scroll from the plan-07/08
// leaves, in order:
//   pinned vitals (sticky header — can go amber/red on a poll)
//     → Health detail (HealthSignals)
//     → Active runs (ActiveRunsSection, 064-B — victim-naming Kill)
//     → Controls (CapabilityGrid + separate MaintenancePanel, 065-A)
//     → Activity (RecentActionsCard, 062-A) with "View all ›" → the Audit tab
//
// THE D-07 POLL/VISIT DISCIPLINE (supersedes the 146 "no auto-poll" beat):
//   • On mount: fetch the read-only data once AND record exactly ONE visit row
//     ("Opened the Control Plane") via recordControlPlaneEvent("visit").
//   • While mounted + visible: auto-poll backpressure + active-runs every ~10s
//     SILENTLY (the data GETs are floor-exempt — plan 02 — so polls never spam
//     the ledger). The poll PAUSES when the browser tab is hidden
//     (visibilitychange) and resumes (with an immediate refresh) when visible.
//   • The manual ↻ Refresh re-fetches AND records "refresh" (the deliberate
//     read, distinct from the silent polls) + pulses the band recording marker.
//   • Every ledger row stays a human action; the pinned vitals can still go
//     amber/red mid-scroll (the 063-B load-bearing degrade state).
//
// SECURITY (Pitfall 13 / T-147-12): this page renders off the probe-supplied
// identity, but every data + write call is independently 404-gated server-side.
// A forged operator flag yields an empty shell that can fetch nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight, Lock, RefreshCw } from "lucide-react"

import {
  getAdminActiveRuns,
  getBackpressure,
  getOperatorAudit,
  getPlatformAudit,
  getSettings,
  killRun,
  recordControlPlaneEvent,
  setFlag,
  type AdminActiveRun as ActiveRun,
  type BackpressureSignals,
  type FullAppSettings,
  type OperatorAuditRow,
  type OperatorIdentity,
  type PlatformAuditFilters,
  type PlatformAuditPage,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { OperatorBand } from "./OperatorBand"
import { HealthSignals } from "./HealthSignals"
import { TechnicalNamesToggle } from "./TechnicalNamesToggle"
import { RecentActionsCard } from "./RecentActionsCard"
import { LockedTab } from "./LockedTab"
import { AuditTab, type AuditSource } from "./AuditTab"
import { ActiveRunsSection } from "./ActiveRunsSection"
import { CapabilityGrid, type CapabilityKey } from "./CapabilityGrid"
import { MaintenancePanel } from "./MaintenancePanel"

interface ControlRoomPageProps {
  /** The signed-in operator identity (from the App-level probe); null while loading. */
  identity: OperatorIdentity | null
  /** Return to the ordinary app surface (navigates to "chat"). */
  onBack: () => void
}

type ControlRoomTab =
  | "control-plane"
  | "users-access"
  | "model-registry"
  | "secrets"
  | "audit"

interface TabDef {
  id: ControlRoomTab
  label: string
  locked: boolean
  /** Plain, roadmap-number-free "coming soon" copy for the locked body (T-146-10). */
  lockedDescription?: string
}

// The sketch-066 band-tab IA (D-08): one live landing tab, then the three honest
// locks that NAME the arriving capability (never a roadmap number — T-146-10),
// then the live Audit log. "System Controls" / "AI Models" / "API Keys" are gone —
// System Controls moved into the Control Plane body; the other two were renamed.
const TABS: readonly TabDef[] = [
  { id: "control-plane", label: "Control Plane", locked: false },
  {
    id: "users-access",
    label: "Users & Access",
    locked: true,
    lockedDescription: "User management, access control, and impersonation are coming soon.",
  },
  {
    id: "model-registry",
    label: "Model Registry",
    locked: true,
    lockedDescription: "Live model discovery and DB-managed model capabilities are coming soon.",
  },
  {
    id: "secrets",
    label: "Secrets",
    locked: true,
    lockedDescription: "Encrypted provider-key and secret management is coming soon.",
  },
  { id: "audit", label: "Audit log", locked: false },
]

// The Audit tab holds the full history; the Control Plane shows a small preview.
const AUDIT_LIMIT = 200
const ACTIVITY_PREVIEW = 6
// Platform-activity browse page size (067-A). The server clamps to ≤100; 50 keeps the
// recorded cross-user read (audit.view_platform) modest — this is a monitor, not a firehose.
const PLATFORM_PAGE_SIZE = 50
// Silent auto-poll cadence for the read-only live data (D-07). Generous floor —
// the surface is a monitor, not a firehose; polls are floor-exempt (plan 02).
const POLL_INTERVAL_MS = 10_000
// A dependency answering slower than this (while "up") reads as degraded (amber).
const SLOW_LATENCY_MS = 500

type OverallHealth = "up" | "slow" | "down" | "unknown"

/** Roll the three dependency probes up into one at-a-glance vitals state for the
 *  pinned header. `down` wins over `slow` wins over `up`; absent probes → unknown. */
function overallHealth(s: BackpressureSignals | null): OverallHealth {
  const deps = s?.dependencies
  if (!deps) return "unknown"
  const probes = [deps.redis, deps.supabase, deps.sandbox]
  if (probes.some((d) => d.state === "down")) return "down"
  if (probes.some((d) => d.state === "up" && d.latency_ms != null && d.latency_ms > SLOW_LATENCY_MS))
    return "slow"
  return "up"
}

const OVERALL_DOT: Record<OverallHealth, string> = {
  up: "bg-success",
  slow: "bg-amber-400",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/40",
}

const OVERALL_LABEL: Record<OverallHealth, string> = {
  up: "All systems healthy",
  slow: "Running slow",
  down: "Degraded",
  unknown: "Checking…",
}

export function ControlRoomPage({ identity, onBack }: ControlRoomPageProps) {
  const [activeTab, setActiveTab] = useState<ControlRoomTab>("control-plane")
  const [signals, setSignals] = useState<BackpressureSignals | null>(null)
  const [runs, setRuns] = useState<ActiveRun[] | null>(null)
  const [settings, setSettings] = useState<FullAppSettings | null>(null)
  const [auditRows, setAuditRows] = useState<OperatorAuditRow[]>([])
  // 067-A: the Audit tab is one browser over TWO ledgers. The operator source is the
  // `auditRows` feed above (this operator's own actions). The platform source is the
  // cross-user `audit_log` browse — server-paginated, fetched here (the shell owns the
  // fetch + the alive.current guard; AuditTab owns the filter state — 148-PATTERNS).
  const [auditSource, setAuditSource] = useState<AuditSource>("operator")
  const [platformResult, setPlatformResult] = useState<PlatformAuditPage | null>(null)
  const [platformLoading, setPlatformLoading] = useState(false)
  // This shell owns the two-audience toggle state (LANG-01); it threads
  // showTechnical down to HealthSignals + CapabilityGrid + the Audit tab.
  const [showTechnical, setShowTechnical] = useState(false)
  // Prop-controlled recording FLASH for the band (062-A marker beat); pulsed after
  // a manual refresh records the operator's own "refresh" row.
  const [recordingPulse, setRecordingPulse] = useState(false)

  // Guard setState-after-unmount (SkillStudioPage idiom); paired with the poll
  // interval so a late fetch never writes into an unmounted tree.
  const alive = useRef(true)
  // The visit row is recorded EXACTLY once per mount (D-07) — guarded against a
  // StrictMode double-invoke so the ledger never gets two "Opened" rows.
  const visitRecorded = useRef(false)

  // ── Stable fetchers. Each read is guarded with its own .catch so one failure
  //    never nukes the others, and a read failure keeps the last-known values
  //    (honest degrade, never a crash). ──
  const fetchSignals = useCallback(async () => {
    try {
      const s = await getBackpressure()
      if (alive.current) setSignals(s)
    } catch {
      /* keep the last-known health values */
    }
  }, [])
  const fetchRuns = useCallback(async () => {
    try {
      const r = await getAdminActiveRuns()
      if (alive.current) setRuns(r)
    } catch {
      /* keep the last-known active-runs list */
    }
  }, [])
  const fetchSettings = useCallback(async () => {
    try {
      const s = await getSettings()
      if (alive.current) setSettings(s)
    } catch {
      /* keep the last-known flag values */
    }
  }, [])
  const fetchAudit = useCallback(async () => {
    try {
      const rows = await getOperatorAudit(AUDIT_LIMIT)
      if (alive.current) setAuditRows(rows)
    } catch {
      /* keep the last-known ledger */
    }
  }, [])

  // ── Platform-activity browse (067-A source #2). AuditTab owns the filter state and
  //    calls this with the resolved filters + page whenever they change; the shell owns
  //    the guarded fetch (alive.current) + honest-degrade .catch (keeps the last-known
  //    page on a blip). Every call RECORDS `audit.view_platform` server-side — a
  //    cross-user read is never silent (SC#4). ──
  const queryPlatform = useCallback(async (filters: PlatformAuditFilters, page: number) => {
    if (alive.current) setPlatformLoading(true)
    try {
      const res = await getPlatformAudit(filters, page, PLATFORM_PAGE_SIZE)
      if (alive.current) setPlatformResult(res)
    } catch {
      /* keep the last-known platform page (honest degrade, never a crash) */
    } finally {
      if (alive.current) setPlatformLoading(false)
    }
  }, [])

  // ── D-07 entry + auto-poll. Fetch everything once on mount, record ONE visit
  //    row, then silently poll the read-only data (~10s) while visible. The poll
  //    pauses on a hidden tab and is always cleared on unmount. ──
  useEffect(() => {
    alive.current = true

    // Initial one-shot reads of everything the surface shows.
    fetchSignals()
    fetchRuns()
    fetchSettings()

    // Record ONE deliberate visit row, THEN read the ledger so the operator sees
    // their "Opened the Control Plane" row land (the D-07 honesty beat). If the
    // record fails we still read the ledger — the row simply won't be there.
    if (!visitRecorded.current) {
      visitRecorded.current = true
      recordControlPlaneEvent("visit")
        .catch(() => {})
        .finally(() => {
          void fetchAudit()
        })
    } else {
      void fetchAudit()
    }

    // Silent auto-poll — NO recordControlPlaneEvent here (the GETs are
    // floor-exempt, so polls never touch the ledger). Pauses on hidden tab.
    let intervalId: number | null = null
    const startPolling = () => {
      if (intervalId != null) return
      intervalId = window.setInterval(() => {
        void fetchSignals()
        void fetchRuns()
      }, POLL_INTERVAL_MS)
    }
    const stopPolling = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Resume with an immediate refresh so the vitals aren't stale on return.
        void fetchSignals()
        void fetchRuns()
        startPolling()
      }
    }

    if (!document.hidden) startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      alive.current = false
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchSignals, fetchRuns, fetchSettings, fetchAudit])

  // ── The manual ↻ Refresh (D-07): re-fetch AND record the deliberate "refresh"
  //    row, then re-read the ledger so it visibly lands, then pulse the marker.
  //    Distinct from the silent polls above — this is the human "I looked". ──
  const handleRefresh = useCallback(async () => {
    void fetchSignals()
    void fetchRuns()
    void fetchSettings()
    try {
      await recordControlPlaneEvent("refresh")
    } catch {
      /* a record failure is non-fatal — the manual read still refreshed the data */
    }
    await fetchAudit()
    if (!alive.current) return
    setRecordingPulse(true)
    window.setTimeout(() => {
      if (alive.current) setRecordingPulse(false)
    }, 1500)
  }, [fetchSignals, fetchRuns, fetchSettings, fetchAudit])

  // ── Write callbacks. After each write, re-fetch the affected read-only data so
  //    the surface reflects the new state (the write itself is floor-logged
  //    server-side). Kill is NOT optimistic — the leaf overlays the honest cancel
  //    state and the re-fetch is the authoritative source of truth (064-B). ──
  const handleKill = useCallback(
    async (runId: string) => {
      await killRun(runId)
      if (alive.current) void fetchRuns()
    },
    [fetchRuns],
  )
  const handleToggle = useCallback(
    async (key: CapabilityKey, value: boolean) => {
      await setFlag(key, value)
      if (alive.current) void fetchSettings()
    },
    [fetchSettings],
  )
  const handleSetMaintenance = useCallback(
    async (value: boolean) => {
      await setFlag("maintenance_mode", value)
      if (alive.current) void fetchSettings()
    },
    [fetchSettings],
  )

  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  // Flag values come from getSettings() (NOT a new flags GET). Defaults keep the
  // grid byte-identical to "everything enabled" until the settings fetch resolves.
  const capabilityFlags: Record<CapabilityKey, boolean> = {
    web_search_enabled: settings?.web_search_enabled ?? true,
    sandbox_enabled: settings?.sandbox_enabled ?? true,
    self_improve_enabled: settings?.self_improve_enabled ?? true,
    workflows_enabled: settings?.workflows_enabled ?? true,
  }
  const maintenanceOn = settings?.maintenance_mode ?? false

  // The ONLY honestly-derivable impact count is the workflows switch (active
  // workflow-run count). We never fabricate a number — while runs is still
  // loading we pass no count at all (the grid renders its plain fallback).
  const impactCounts =
    runs != null
      ? { workflows_enabled: runs.filter((r) => r.kind === "workflow").length }
      : undefined

  const health = overallHealth(signals)
  const inFlight = runs?.length ?? signals?.redis_active_runs ?? 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <OperatorBand identity={identity} onBack={onBack} recordingPulse={recordingPulse} />

      {/* Horizontal section tabs (061-B — NOT a second left rail). */}
      <nav
        role="tablist"
        aria-label="Control Plane sections"
        className="flex flex-wrap items-center gap-1 border-b border-border/60 px-6 py-2"
      >
        {TABS.map((t) => {
          const isActive = t.id === activeTab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : t.locked
                    ? "text-muted-foreground/70 hover:bg-accent/40 hover:text-muted-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              {t.locked && <Lock className="h-3 w-3 flex-none" aria-hidden="true" />}
              {t.label}
              {/* Audit count-pill — the number of loaded ledger rows (D-08). */}
              {t.id === "audit" && auditRows.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {auditRows.length}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "control-plane" ? (
          <>
            {/* Pinned vitals (063-B): stays pinned on scroll, can go amber/red on a
                poll, and hosts the ⌥ Technical-names toggle + ↻ Refresh controls. */}
            <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 flex-none rounded-full", OVERALL_DOT[health])}
                  />
                  <h2 className="font-headline text-lg font-bold text-foreground">System health</h2>
                  <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
                    live
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {OVERALL_LABEL[health]} · {inFlight} in flight
                </span>
                <span className="flex-1" />
                <TechnicalNamesToggle
                  enabled={showTechnical}
                  onToggle={() => setShowTechnical((v) => !v)}
                />
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-accent px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>
            </div>

            {/* The 063-B scroll: Health → Active runs → Controls → Activity. */}
            <div className="mx-auto max-w-4xl space-y-7 px-6 py-6">
              {/* Health detail (the ONE place health lives — D-08). */}
              <HealthSignals signals={signals} showTechnical={showTechnical} />

              {/* Active runs (064-B — victim-naming Kill, honest cancel states). */}
              <section aria-label="Active runs">
                <h3 className="mb-2.5 font-headline text-base font-bold text-foreground">
                  Active runs
                </h3>
                <ActiveRunsSection runs={runs} onKill={handleKill} />
              </section>

              {/* Controls (065-A — capability grid + the SEPARATE amber maintenance
                  panel; distinction by location). */}
              <section aria-label="Controls">
                <h3 className="mb-2.5 font-headline text-base font-bold text-foreground">Controls</h3>
                <div className="space-y-3">
                  <CapabilityGrid
                    flags={capabilityFlags}
                    impactCounts={impactCounts}
                    onToggle={handleToggle}
                    showTechnical={showTechnical}
                  />
                  <MaintenancePanel
                    maintenanceOn={maintenanceOn}
                    onSetMaintenance={handleSetMaintenance}
                  />
                </div>
              </section>

              {/* Activity (062-A ledger preview) with "View all ›" → the Audit tab. */}
              <section aria-label="Activity">
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="font-headline text-base font-bold text-foreground">Activity</h3>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setActiveTab("audit")}
                    className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    View all
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <RecentActionsCard rows={auditRows.slice(0, ACTIVITY_PREVIEW)} />
              </section>

              <p className="px-0.5 text-xs text-muted-foreground/70">
                Only operators can open this page — every visit is checked on the server, and
                every action here is recorded.
              </p>
            </div>
          </>
        ) : activeTab === "audit" ? (
          <AuditTab
            source={auditSource}
            onSourceChange={setAuditSource}
            operatorRows={auditRows}
            platformResult={platformResult}
            platformLoading={platformLoading}
            onQueryPlatform={queryPlatform}
            showTechnical={showTechnical}
            onToggleTechnical={() => setShowTechnical((v) => !v)}
          />
        ) : (
          <LockedTab title={active.label} description={active.lockedDescription} />
        )}
      </div>
    </div>
  )
}
