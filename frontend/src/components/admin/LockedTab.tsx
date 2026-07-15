// ─────────────────────────────────────────────────────────────────────────────
// Control Room — the honest-lock refusal leaf (ADMIN-01, sketch 061-B winner).
//
// A planned-but-unbuilt section (System Controls / Users & Access / AI Models /
// API Keys) renders a calm, truthful refusal — "Not built yet — coming soon" —
// never a broken or empty screen (D-07).
//
// HARD RULE (threat T-146-10, Information Disclosure): shipped copy NEVER names an
// internal roadmap number. A locked section reads calm + truthful, never "arrives
// with <a number>". The Plan grep gate asserts the absence of any phase-number
// token in this file — keep it that way.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 06) decides WHICH
// locked section is active and passes its title (+ an optional plain description).
// ─────────────────────────────────────────────────────────────────────────────
import { Lock } from "lucide-react"

interface LockedTabProps {
  /** The section name, e.g. "System Controls". */
  title: string
  /**
   * Optional plain one-line "coming soon" description for this section. Must NOT
   * name a roadmap number (the caller owns this copy; keep it phase-number-free).
   */
  description?: string
}

/** The calm coming-soon refusal for a locked Control Room section. */
export function LockedTab({ title, description }: LockedTabProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <Lock className="h-5 w-5 text-muted-foreground/70" aria-hidden="true" />
      </div>
      <h2 className="font-headline text-lg font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">Not built yet — coming soon</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description ??
          "This part of the Control Room isn't ready yet. It'll light up right here as soon as it ships."}
      </p>
    </div>
  )
}
