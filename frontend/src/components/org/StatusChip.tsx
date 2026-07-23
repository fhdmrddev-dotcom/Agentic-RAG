/**
 * Phase 177 Plan 01 Task 1 — StatusChip (the D-08 cohesion primitive).
 *
 * ONE shared org-zone status chip COMPONENT rendering the three-tone vocabulary
 * (primary / success / muted) at every site. Extracted verbatim (D-01) from the
 * inline `CHIP_TONE_CLASS` maps that ship byte-identically in InvitationsTab.tsx:71-75
 * and SsoTab.tsx:71-75 (SsoTab's own comment: "Identical to InvitationsTab's map").
 *
 * Structural template: metadata/ConfidenceChip.tsx — a module-level BASE_CLASSES
 * const + a Record<tone,string> variant map + cn(BASE, VARIANT[tone]) on a single
 * <span> (never colour-alone — the label WORD carries the meaning; any glyph a
 * consumer adds is decorative/aria-hidden). The chip is presentational and gates
 * NOTHING — the honest-absent gate (D-06) stays at the call site.
 *
 * D-08/D-09 note: the base is the GRID-CORRECT pill (px-2 py-0.5 text-[11px]
 * font-medium). It deliberately does NOT carry `uppercase tracking-wide` or `py-1`
 * — that off-grid SsoTab.tsx:302-310 fork is exactly what this extraction retires.
 *
 * SCOPE (no overclaim): `statusChipMeta` maps the invitation + SSO **lifecycle**
 * domain (the two surfaces 177-03 consolidates). The members roster's **adoption**
 * state ("Active" reads MUTED, not green) is a DISTINCT semantic domain and keeps
 * its own `adoptionChip` mapper in 177-04 — so `statusChipMeta` does NOT define an
 * adoption-tone mapping. The cohesion win is the ONE shared COMPONENT; the tone
 * MAPPING stays domain-specific.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ChipTone = "primary" | "success" | "muted"

// The 166 chip tones — lifted VERBATIM from InvitationsTab.tsx:71-75 / SsoTab.tsx:71-75.
// primary = live/waiting (indigo) · success = positive terminal (green) · muted = calm terminal.
// Exported so consumers (and tests) reference the ONE source, never a re-typed copy.
export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted/40 text-muted-foreground",
}

// The grid-correct pill baseline (InvitationsTab.tsx:271-274). NEVER `uppercase
// tracking-wide` / `py-1` — that is the retired D-08/D-09 off-grid fork.
const BASE_CLASSES = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"

export interface StatusChipProps {
  /** The org-zone tone. Maps to the verbatim CHIP_TONE_CLASS tokens. */
  tone: ChipTone
  /** The chip label (a WORD carries the meaning — never colour-alone). */
  children: ReactNode
  /** Optional data-testid so consumers keep their stable hooks
   *  ("invitation-status" / "sso-status" / "adoption-chip"). Defaults to "status-chip". */
  testId?: string
}

export function StatusChip({ tone, children, testId }: StatusChipProps) {
  return (
    <span
      data-testid={testId ?? "status-chip"}
      data-tone={tone}
      className={cn(BASE_CLASSES, CHIP_TONE_CLASS[tone])}
    >
      {children}
    </span>
  )
}

/**
 * Pure mapper for the invitation + SSO **lifecycle** domain (D-08). Maps a
 * server-truth status string to a plain label + a tone. Unknown statuses read as
 * the calm muted chip with the raw status echoed (honest — never fabricated).
 *
 * SCOPE: lifecycle only (invitations + SSO). The roster adoption domain is
 * separate (177-04) — do NOT add adoption states here.
 */
export function statusChipMeta(status: string): { label: string; tone: ChipTone } {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "primary" }
    case "pending_approval":
      return { label: "Pending approval", tone: "primary" }
    case "accepted":
      return { label: "Accepted", tone: "success" }
    case "active":
      return { label: "Active", tone: "success" }
    case "expired":
      return { label: "Expired", tone: "muted" }
    case "revoked":
      return { label: "Revoked", tone: "muted" }
    case "disabled":
      return { label: "Disabled", tone: "muted" }
    default:
      return { label: status, tone: "muted" }
  }
}
