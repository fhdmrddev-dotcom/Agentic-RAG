/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-09 / D-267-11 / D-267-16 / UI-SPEC §5.6-5.7) — the
 * transcript's record of an Expert change, and the source thread's pointer to a handoff.
 *
 * ⛔ IT DRAWS; IT DOES NOT DECIDE. Every word comes from `expertEventCopy.ts` (`eventCardModel` /
 * `handoffEventModel`), which reads the payload the server stored — never the row's `content`
 * sentence. Mounted from `MessageItem` by ONE kind check (its single early return).
 *
 * ⛔ EVERY WORD IS VISIBLE AT REST (266 UI-3): keys and values are plain text, never `aria-hidden`,
 * never behind a hover. ⛔ Server strings are React text children only (T-267-40).
 *
 * ⛔ THE OPEN CONTROL EXISTS ONLY WHEN IT CAN DO SOMETHING (T-267-46): inside a navigation context
 * that resolves the target it is a real `<button>`; a target the loaded list does not hold, or no
 * context at all, is the title as text and no control. (267-REVIEW WR-09: it used to add a
 * "· deleted" suffix — a claim the in-memory list cannot support.)
 */
import { useState, type ReactNode } from "react"
import { ArrowUpRight, Plug, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExpertChangedEvent, ExpertHandoffEvent } from "@/lib/api/threads"
import {
  EVENT_COPY,
  eventCardModel,
  eventTimeLabel,
  handoffEventModel,
  type ScopeLineModel,
} from "./expertEventCopy"
import { useThreadNavigation } from "./threadNavigation"

/** A change this recent is a live append; anything older is history and does not animate. */
const LIVE_APPEND_MS = 15_000

function isLiveAppend(iso: string): boolean {
  const t = Date.parse(iso)
  return Number.isFinite(t) && Math.abs(Date.now() - t) < LIVE_APPEND_MS
}

function Shell({
  at,
  tone,
  header,
  icon,
  children,
}: {
  at: string
  tone: "violet" | "neutral"
  header: string
  icon: ReactNode
  children: ReactNode
}) {
  // Decided once at mount: a reload renders history, so it never animates (UI-SPEC §5.6 Motion).
  const [live] = useState(() => isLiveAppend(at))
  const time = eventTimeLabel(at)
  return (
    <div
      data-testid="expert-event-card"
      role="note"
      aria-label={EVENT_COPY.ariaLabel(time)}
      className={cn(
        "w-full rounded-[10px] border px-3 py-3 text-xs",
        tone === "violet" ? "border-violet-500/35 bg-violet-500/[0.06]" : "border-border bg-card",
        live && "animate-in fade-in duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="flex items-center gap-1">
        {icon}
        <span
          className={cn(
            "font-semibold leading-relaxed",
            tone === "violet" ? "text-violet-200" : "text-foreground",
          )}
        >
          {header}
        </span>
        <time dateTime={at} className="ml-auto font-mono text-[11px] text-muted-foreground">
          {time}
        </time>
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{children}</div>
    </div>
  )
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase leading-relaxed tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

function ScopeValue({ line, tone }: { line: ScopeLineModel; tone: "yes" | "no" }) {
  if (line.empty) {
    return <span className="text-muted-foreground">{line.items[0]}</span>
  }
  const color = tone === "yes" ? "text-emerald-300" : "text-rose-300"
  const parts: ReactNode[] = []
  line.items.forEach((label, i) => {
    parts.push(
      <span key={`f-${i}`} className={color}>
        {label}
      </span>,
    )
  })
  line.connections.forEach((name, i) => {
    parts.push(
      <span key={`c-${i}`} className={cn("inline-flex items-center gap-1", color)}>
        <Plug className="h-3 w-3 flex-none" aria-hidden="true" />
        <span>{name}</span>
      </span>,
    )
  })
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1 leading-relaxed">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-x-1">
          {i > 0 && <span className="text-muted-foreground">·</span>}
          {p}
        </span>
      ))}
    </span>
  )
}

function ChangedCard({ event }: { event: ExpertChangedEvent }) {
  const m = eventCardModel(event)
  const icon =
    m.tone === "violet" ? <Sparkles className="h-3 w-3 flex-none text-violet-300" aria-hidden="true" /> : null
  return (
    <Shell at={m.at} tone={m.tone} header={m.header} icon={icon}>
      <div data-testid="expert-event-now" className="contents">
        <Key>{EVENT_COPY.keys.now}</Key>
        <ScopeValue line={m.now} tone="yes" />
      </div>
      <div data-testid="expert-event-dropped" className="contents">
        <Key>{EVENT_COPY.keys.dropped}</Key>
        <span className="min-w-0">
          <ScopeValue line={m.dropped} tone="no" />
          {m.excludedSubline && (
            <span className="mt-1 block font-mono text-[11px] leading-snug text-muted-foreground">
              {m.excludedSubline}
            </span>
          )}
        </span>
      </div>
    </Shell>
  )
}

function HandoffPointer({ event }: { event: ExpertHandoffEvent }) {
  const m = handoffEventModel(event)
  const nav = useThreadNavigation()
  const target = nav ? nav.findThread(m.targetThreadId) : null
  let open: ReactNode
  if (nav && target) {
    open = (
      <button
        type="button"
        data-testid="handoff-event-open"
        onClick={() => nav.openThread(target)}
        className="text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
      >
        {m.openLabel}
      </button>
    )
  } else {
    // 267-REVIEW WR-09: not in the loaded list (or no navigation context) is NOT evidence of a
    // deletion — the title as words, and no control, since a link to nothing does nothing.
    open = <span className="text-foreground">{m.title}</span>
  }
  return (
    <Shell
      at={m.at}
      tone="violet"
      header={m.header}
      icon={<ArrowUpRight className="h-3 w-3 flex-none text-violet-300" aria-hidden="true" />}
    >
      {m.here && (
        <>
          <Key>{EVENT_COPY.keys.here}</Key>
          <span className="text-foreground">{m.here}</span>
        </>
      )}
      <Key>{EVENT_COPY.keys.open}</Key>
      <span className="min-w-0">
        {open}
        {m.folderLine && (
          <span className="mt-1 block text-[11px] text-muted-foreground">{m.folderLine}</span>
        )}
      </span>
    </Shell>
  )
}

export function ExpertEventCard({ event }: { event: ExpertChangedEvent | ExpertHandoffEvent }) {
  if (event.kind === "expert_handoff") return <HandoffPointer event={event} />
  return <ChangedCard event={event} />
}
