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
import { ArrowUpRight, Folder, Plug, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExpertChangedEvent, ExpertHandoffEvent, ScopeChangedEvent } from "@/lib/api/threads"
import {
  EVENT_COPY,
  SCOPE_EVENT_COPY,
  eventCardModel,
  eventTimeLabel,
  handoffEventModel,
  scopeEventModel,
  type ScopeLineModel,
  type TranscriptEvent,
} from "./expertEventCopy"
import { useThreadNavigation } from "./threadNavigation"

/** A change this recent is a live append; anything older is history and does not animate. */
const LIVE_APPEND_MS = 15_000

function isLiveAppend(iso: string): boolean {
  const t = Date.parse(iso)
  return Number.isFinite(t) && Math.abs(Date.now() - t) < LIVE_APPEND_MS
}

/** Phase 268 (UI-SPEC §5.5): one lookup, four tones — both themes paired (the 267-ui light rule). */
const TONES = {
  violet: { box: "border-violet-500/35 bg-violet-500/[0.06]", header: "text-violet-700 dark:text-violet-200" },
  neutral: { box: "border-border bg-card", header: "text-foreground" },
  scope: {
    box: "border-indigo-600/40 dark:border-indigo-500/40 bg-indigo-500/[0.06]",
    header: "text-indigo-700 dark:text-indigo-200",
  },
  held: {
    box: "border-amber-600/40 dark:border-amber-500/30 bg-amber-500/10",
    header: "text-amber-700 dark:text-amber-300",
  },
} as const

function Shell({
  at,
  tone,
  header,
  icon,
  children,
  testId = "expert-event-card",
  ariaLabel = EVENT_COPY.ariaLabel,
  footer,
  truncateHeader = false,
}: {
  at: string
  tone: keyof typeof TONES
  header: string
  icon: ReactNode
  children: ReactNode
  /** 268: the scope kind carries its own id, so no 267 suite changes its population. */
  testId?: string
  ariaLabel?: (time: string) => string
  /** 268: a line BELOW the grid (the grid's children are keys and values). */
  footer?: ReactNode
  /** 268: a folder-path header can be long — it truncates, with its full text in `title`. */
  truncateHeader?: boolean
}) {
  // Decided once at mount: a reload renders history, so it never animates (UI-SPEC §5.6 Motion).
  const [live] = useState(() => isLiveAppend(at))
  const time = eventTimeLabel(at)
  return (
    <div
      data-testid={testId}
      role="note"
      aria-label={ariaLabel(time)}
      className={cn(
        "w-full rounded-[10px] border px-3 py-3 text-xs",
        TONES[tone].box,
        live && "animate-in fade-in duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="flex items-center gap-1">
        {icon}
        <span
          title={truncateHeader ? header : undefined}
          className={cn(
            "font-semibold leading-relaxed",
            truncateHeader && "min-w-0 truncate",
            TONES[tone].header,
          )}
        >
          {header}
        </span>
        <time dateTime={at} className="ml-auto font-mono text-[11px] text-muted-foreground">
          {time}
        </time>
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{children}</div>
      {footer}
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
  const color = tone === "yes" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
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
    m.tone === "violet" ? <Sparkles className="h-3 w-3 flex-none text-violet-700 dark:text-violet-300" aria-hidden="true" /> : null
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
      icon={<ArrowUpRight className="h-3 w-3 flex-none text-violet-700 dark:text-violet-300" aria-hidden="true" />}
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

/** Phase 268 (CHAT-08 · UI-SPEC §5.5): a live thread's folder scope changed. ⛔ Reads `held` from the
 *  server's snapshot — never the Expert's mode. Held values are neither gained nor lost yet, so they
 *  are `text-foreground`, not emerald / rose. */
function ScopeChangedCard({ event }: { event: ScopeChangedEvent }) {
  const m = scopeEventModel(event)
  const glyph = m.held ? "text-amber-700 dark:text-amber-300" : "text-indigo-600 dark:text-indigo-300"
  return (
    <Shell
      at={m.at}
      tone={m.tone}
      header={m.header}
      icon={<Folder className={cn("h-3 w-3 flex-none", glyph)} aria-hidden="true" />}
      testId="scope-event-card"
      ariaLabel={SCOPE_EVENT_COPY.ariaLabel}
      truncateHeader
      footer={
        <p data-testid="scope-event-when" className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {m.footer}
        </p>
      }
    >
      {m.held ? (
        <>
          <div data-testid="scope-event-saved" className="contents">
            <Key>{SCOPE_EVENT_COPY.keys.saved}</Key>
            <span className="min-w-0 text-foreground">{m.saved}</span>
          </div>
          <div data-testid="scope-event-searching" className="contents">
            <Key>{SCOPE_EVENT_COPY.keys.searching}</Key>
            <span className="min-w-0 text-foreground">{m.searching}</span>
          </div>
        </>
      ) : (
        <>
          <div data-testid="scope-event-now" className="contents">
            <Key>{SCOPE_EVENT_COPY.keys.now}</Key>
            <ScopeValue line={m.now} tone="yes" />
          </div>
          <div data-testid="scope-event-dropped" className="contents">
            <Key>{SCOPE_EVENT_COPY.keys.dropped}</Key>
            <ScopeValue line={m.dropped} tone="no" />
          </div>
        </>
      )}
    </Shell>
  )
}

export function ExpertEventCard({ event }: { event: TranscriptEvent }) {
  if (event.kind === "expert_handoff") return <HandoffPointer event={event} />
  if (event.kind === "scope_changed") return <ScopeChangedCard event={event} />
  return <ChangedCard event={event} />
}
