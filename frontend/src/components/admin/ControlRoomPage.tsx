// ─────────────────────────────────────────────────────────────────────────────
// Control Room — the 061-B operator shell (ADMIN-01).
//
// The winning sketch-061 shape (Variant B): a full-width amber operator BAND over
// a horizontal section-tab bar (NOT a second left nav rail). Six tabs in sketch
// order — Overview + Audit are LIVE; System Controls / Users & Access / AI Models /
// API Keys render honest LockedTab refusals (D-07). Tab state is local (no router,
// the SkillStudioPage precedent).
//
// The Overview composes the Plan-05 leaves: OperatorBand (band) + HealthSignals
// (the four plain-labeled /admin/backpressure signals) + TechnicalNamesToggle (the
// LANG-01 two-audience reveal — this shell owns `showTechnical`) + RecentActionsCard
// (the 062-A ledger-is-receipt preview).
//
// THE HONESTY BEAT (D-04 / D-08): health + audit load ONCE on entry. There is NO
// auto-polling — no background timer, no timed re-fetch. The ONLY re-fetch is the
// visible ↻ Refresh: it re-reads backpressure (which the backend audit-floor records as a
// "Viewed system health" action) and THEN re-reads the audit feed, so the operator
// literally watches their own view land as a fresh top row in the ledger — the
// ledger IS the receipt. The band's recording marker pulses as it lands.
//
// SECURITY (Pitfall 13 / T-146-06): this page renders off the probe-supplied
// identity, but every data call is independently 404-gated server-side. A forged
// operator flag yields an empty shell that can fetch nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { Lock, RefreshCw } from "lucide-react"

import {
  getBackpressure,
  getOperatorAudit,
  type BackpressureSignals,
  type OperatorAuditRow,
  type OperatorIdentity,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { OperatorBand } from "./OperatorBand"
import { HealthSignals } from "./HealthSignals"
import { TechnicalNamesToggle } from "./TechnicalNamesToggle"
import { RecentActionsCard } from "./RecentActionsCard"
import { LockedTab } from "./LockedTab"
import { AuditTab } from "./AuditTab"

interface ControlRoomPageProps {
  /** The signed-in operator identity (from the App-level probe); null while loading. */
  identity: OperatorIdentity | null
  /** Return to the ordinary app surface (navigates to "chat"). */
  onBack: () => void
}

type ControlRoomTab =
  | "overview"
  | "audit"
  | "system-controls"
  | "users-access"
  | "ai-models"
  | "api-keys"

interface TabDef {
  id: ControlRoomTab
  label: string
  locked: boolean
  /** Plain, roadmap-number-free "coming soon" copy for the locked body (T-146-10). */
  lockedDescription?: string
}

// Sketch-061-B tab order: two live sections first, then the four honest locks.
const TABS: readonly TabDef[] = [
  { id: "overview", label: "Overview", locked: false },
  { id: "audit", label: "Audit log", locked: false },
  {
    id: "system-controls",
    label: "System Controls",
    locked: true,
    lockedDescription: "Live health, running agents and a kill switch are coming soon.",
  },
  {
    id: "users-access",
    label: "Users & Access",
    locked: true,
    lockedDescription: "User list, disable/enable and access control are coming soon.",
  },
  {
    id: "ai-models",
    label: "AI Models",
    locked: true,
    lockedDescription: "Model management and discovery are coming soon.",
  },
  {
    id: "api-keys",
    label: "API Keys",
    locked: true,
    lockedDescription: "Encrypted provider-key management is coming soon.",
  },
]

// The Audit tab holds the full history; the Overview shows a small recent preview.
const AUDIT_LIMIT = 200
const OVERVIEW_PREVIEW = 6

export function ControlRoomPage({ identity, onBack }: ControlRoomPageProps) {
  const [activeTab, setActiveTab] = useState<ControlRoomTab>("overview")
  const [signals, setSignals] = useState<BackpressureSignals | null>(null)
  const [auditRows, setAuditRows] = useState<OperatorAuditRow[]>([])
  // This shell owns the two-audience toggle state (LANG-01); it threads
  // showTechnical down to HealthSignals.
  const [showTechnical, setShowTechnical] = useState(false)
  // Prop-controlled recording FLASH for the band (062-A marker beat); pulsed after
  // a refresh lands the operator's own "Viewed system health" row.
  const [recordingPulse, setRecordingPulse] = useState(false)

  // Guard setState-after-unmount for the one-shot entry reads (SkillStudioPage idiom).
  const alive = useRef(true)

  // ── Entry load (D-04): fetch health + audit ONCE, independently. Each read is
  //    guarded with its own .catch so one failure never nukes the other. NO
  //    polling / NO background timer — the only re-fetch is the manual ↻ Refresh below. ──
  useEffect(() => {
    alive.current = true
    getBackpressure()
      .then((s) => {
        if (alive.current) setSignals(s)
      })
      .catch(() => {})
    getOperatorAudit(AUDIT_LIMIT)
      .then((rows) => {
        if (alive.current) setAuditRows(rows)
      })
      .catch(() => {})
    return () => {
      alive.current = false
    }
  }, [])

  // ── The honesty beat (D-04 / D-08): re-read backpressure FIRST (the backend
  //    audit-floor records this view as a "Viewed system health" action), THEN
  //    re-read the audit feed so that fresh row visibly prepends to the ledger.
  //    Pulse the band's recording marker as it lands. Manual only — never timed. ──
  const handleRefresh = useCallback(async () => {
    try {
      const s = await getBackpressure()
      if (alive.current) setSignals(s)
    } catch {
      // a health read failure is non-fatal — keep the last-known values
    }
    try {
      const rows = await getOperatorAudit(AUDIT_LIMIT)
      if (alive.current) setAuditRows(rows)
    } catch {
      // an audit read failure is non-fatal — keep the last-known ledger
    }
    if (!alive.current) return
    // The ledger just recorded this very view — flash the marker, then settle.
    setRecordingPulse(true)
    window.setTimeout(() => {
      if (alive.current) setRecordingPulse(false)
    }, 1500)
  }, [])

  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <OperatorBand identity={identity} onBack={onBack} recordingPulse={recordingPulse} />

      {/* Horizontal section tabs (061-B — NOT a second left rail). */}
      <nav
        role="tablist"
        aria-label="Control Room sections"
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
        {activeTab === "overview" ? (
          <div className="mx-auto max-w-4xl px-6 py-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="font-headline text-lg font-bold text-foreground">System health</h2>
              <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
                live
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

            <HealthSignals signals={signals} showTechnical={showTechnical} />

            <p className="mt-2 px-0.5 text-xs text-muted-foreground/70">
              Only operators can open this page — every visit is checked on the server.
            </p>

            <div className="mt-5 max-w-2xl">
              <RecentActionsCard rows={auditRows.slice(0, OVERVIEW_PREVIEW)} />
            </div>
          </div>
        ) : activeTab === "audit" ? (
          <AuditTab rows={auditRows} />
        ) : (
          <LockedTab title={active.label} description={active.lockedDescription} />
        )}
      </div>
    </div>
  )
}
