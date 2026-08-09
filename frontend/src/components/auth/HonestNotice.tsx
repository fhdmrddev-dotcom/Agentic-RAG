/**
 * Phase 177 Plan 01 Task 3 — HonestNotice (the D-11 severity-keyed auth callout).
 *
 * ONE shared severity→callout for the auth surfaces. Replaces the 6 ad-hoc per-state
 * callouts (AcceptInvitePage.tsx:137-204), the bare text-destructive line
 * (SignInForm.tsx:127), and the danger-weight victim-naming callout (SsoTab.tsx:340-360).
 *
 * The honesty contract (D-12): danger weight is EARNED. A recoverable dead-end
 * (expired / revoked / invalid / missing-token) reads CALM — muted tokens + an Info
 * glyph — NEVER an alarming red AlertTriangle. Only a genuine, non-recoverable
 * system failure gets `severity="error"` (destructive tokens + AlertTriangle +
 * role="alert"). Never colour-alone — a glyph is always present beside the copy.
 *
 * Pure presentational callout — no auth/behavior logic (the Wave-2 entry plan wires it).
 * Structural template: metadata/ConfidenceChip.tsx (cn(BASE, VARIANT[key])).
 */
import type { ReactNode } from "react"
import { Info, Loader2, CheckCircle2, AlertTriangle, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type NoticeSeverity = "calm" | "progress" | "success" | "error"

const BASE = "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm"

// One severity → {tokens, glyph, spin} mapping. Tokens lifted verbatim from the
// interfaces block: calm=StatusChip muted · progress=InvitationsTab:311 indigo well ·
// success=StatusChip success · error=SsoTab:342 danger. Glyph decoupled from colour.
const VARIANT: Record<NoticeSeverity, string> = {
  calm: "border-border bg-muted/40 text-muted-foreground",
  progress: "border-primary/30 bg-primary/[0.06] text-primary",
  success: "border-success/30 bg-success/10 text-success",
  error: "border-destructive/30 bg-destructive/[0.06] text-foreground",
}

const GLYPH: Record<NoticeSeverity, LucideIcon> = {
  calm: Info,
  progress: Loader2,
  success: CheckCircle2,
  error: AlertTriangle,
}

export interface HonestNoticeProps {
  /** The notice severity. `error` earns the danger weight + role="alert"; the other
   *  three read as calm/in-progress/success and announce as role="status". */
  severity: NoticeSeverity
  /** The notice copy. */
  children: ReactNode
}

export function HonestNotice({ severity, children }: HonestNoticeProps) {
  const Glyph = GLYPH[severity]
  return (
    <div
      data-testid="honest-notice"
      data-severity={severity}
      role={severity === "error" ? "alert" : "status"}
      className={cn(BASE, VARIANT[severity])}
    >
      <Glyph
        aria-hidden="true"
        className={cn("mt-0.5 h-4 w-4 flex-none", severity === "progress" && "animate-spin")}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
