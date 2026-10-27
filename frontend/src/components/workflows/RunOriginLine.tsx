/**
 * Phase 293-03 (START-04 / D-24): the one sentence that says how a run started.
 *
 * A LEAF — no API import, no hook — so the page that mounts it gains none (G-5). The words
 * come from `originSentence`, the only home of the six sentences; an absent or unknown origin
 * renders nothing at all (D-23). The label is rendered as a text child, never HTML.
 *
 * The tone is muted, never the accent and never a link (293-UI-SPEC Surface 4). The icon is
 * the kind's lucide mark at 14px, hidden from assistive technology because the sentence
 * already says it.
 */
import { AppWindow, CalendarClock, KeyRound } from "lucide-react"
import type { RunOrigin } from "@/types"
import { originSentence } from "./runOriginVocabulary"

const ICONS = { app: AppWindow, schedule: CalendarClock, key: KeyRound } as const

export function RunOriginLine({ origin }: { origin?: RunOrigin | null }) {
  const s = originSentence(origin)
  if (!s || !origin) return null
  const Icon = ICONS[origin.kind]
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      data-testid="run-origin"
      data-origin-kind={origin.kind}
    >
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      {s}
    </span>
  )
}
