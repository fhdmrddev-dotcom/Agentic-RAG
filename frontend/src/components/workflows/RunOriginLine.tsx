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
import { AppWindow, Bot, CalendarClock, KeyRound } from "lucide-react"
import type { RunOrigin } from "@/types"
import { originSentence } from "./runOriginVocabulary"

// 306-04 (D-31): `mcp` — an AI tool (Bot, the icon convention's one mark for it).
const ICONS = { app: AppWindow, schedule: CalendarClock, key: KeyRound, mcp: Bot } as const

export function RunOriginLine({ origin }: { origin?: RunOrigin | null }) {
  const s = originSentence(origin)
  if (!s || !origin) return null
  const Icon = ICONS[origin.kind]
  // T-306-31: a kind this client does not know renders nothing; it never throws.
  if (!Icon) return null
  // 306-UI-SPEC §Surface 1 (truncation): a long label ends in an ellipsis where the width is
  // bounded (the history row); the full sentence stays in `title`.
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground"
      data-testid="run-origin"
      data-origin-kind={origin.kind}
      title={s}
    >
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{s}</span>
    </span>
  )
}
