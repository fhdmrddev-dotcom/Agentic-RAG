/**
 * Phase 292-02 (D-06 · D-18 · I-3 · sketch 4A · UI-SPEC §TimelineArtifact) — the vertical rail.
 *
 * An <ol> read in order: each event row is a 96px date column (mono, tabular, right-aligned), a 24px
 * rail column (a 1px line and the dot) and the event itself; gap rows mark ≥ 6 calendar months
 * between same-side neighbours with a dashed segment; ONE Today row splits past from upcoming.
 *
 * Meaning never rides on colour alone (WCAG 1.4.1): past = filled dot, upcoming = hollow dot,
 * deadline = a thicker amber ring plus a worded pill (`in 68 days`), Today = a labelled row, and
 * every event starts with an sr-only state word.
 *
 * ⚠ THE CLOCK. Today comes from the VIEWER's local clock, read once per render here and handed to
 * the pure `buildRail` (D-18); the `today` prop exists so tests can inject a fixed day. Events, their
 * order, gaps and the caption never depend on it — only the Today row and the pills move when the
 * date changes, which is the documented exception to "same on reload".
 *
 * Every model string (title, detail, category) and every server excerpt is React text. A source
 * line exists only for an event with a resolved source; it is a plain tab stop that shows the shared
 * `ArtifactTooltip` on hover and on focus.
 */
import { useState, type CSSProperties, type KeyboardEvent } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { ArtifactTooltip } from "./ArtifactTooltip"
import {
  EVENT_STATE_WORD,
  GAP_SR_SUFFIX,
  TODAY_LABEL,
  gapLabel,
  sourceHeader,
  timelineAriaLabel,
  todaySentence,
  todaySrLead,
} from "./artifactCopy"
import { isResolvedSource, type ArtifactBodyProps } from "./artifactSpec"
import { buildRail, calendarDayOf, formatEventDate, formatToday, type CalendarDay, type RailRow } from "./timelineModel"

const GRID = "grid grid-cols-[96px_24px_minmax(0,1fr)] gap-x-2"
const CHIP = "inline-flex h-5 items-center rounded-full border border-border bg-muted px-2 text-xs font-normal text-muted-foreground"
const PILL = "rounded-full border px-2 text-xs font-normal"
const PILL_AMBER = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-warning"
const PILL_MUTED = "border-border bg-muted text-muted-foreground"
const AMBER_RING = "border-2 border-amber-600 dark:border-warning"

export interface TimelineArtifactProps extends ArtifactBodyProps {
  /** Injected in tests; otherwise the viewer's local calendar day. */
  today?: CalendarDay
}

/** The 1px rail line in a row: it starts at the first dot and ends at the last one. */
function railLineStyle(first: boolean, last: boolean): CSSProperties {
  return { top: first ? 10 : 0, bottom: last ? "calc(100% - 10px)" : 0 }
}

type EventRow = Extract<RailRow, { kind: "event" }>

function dotClass(row: EventRow): { cls: string; fill: "filled" | "hollow" } {
  if (row.event.deadline) {
    const missed = row.pill?.tone === "muted"
    return missed
      ? { cls: cn("bg-amber-600 dark:bg-warning", AMBER_RING), fill: "filled" }
      : { cls: cn("bg-card", AMBER_RING), fill: "hollow" }
  }
  return row.past
    ? { cls: "bg-muted-foreground", fill: "filled" }
    : { cls: "border-[1.5px] border-muted-foreground bg-card", fill: "hollow" }
}

export function TimelineArtifact({ record, today }: TimelineArtifactProps) {
  const spec = record.spec.timeline
  const [tip, setTip] = useState<{ index: number; el: HTMLElement } | null>(null)
  if (!spec) return null

  // The one clock read (D-18): the viewer's LOCAL calendar day, unless a test injects one.
  const day = today ?? calendarDayOf(new Date())
  const rows = buildRail(spec.events, day)
  const todayText = formatToday(day)
  const tipId = `${record.id}-tip`
  const tipSource = tip ? spec.events[tip.index]?.source ?? null : null

  const sourceHandlers = (index: number) => ({
    onPointerEnter: (e: { currentTarget: HTMLElement }) => setTip({ index, el: e.currentTarget }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: { currentTarget: HTMLElement }) => setTip({ index, el: e.currentTarget }),
    onBlur: () => setTip(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") setTip(null)
    },
  })

  return (
    <div data-testid="artifact-timeline">
      <ol className="relative m-0 list-none p-0" aria-label={timelineAriaLabel(record.spec.title, spec.events.length)}>
        {rows.map((row, i) => {
          const first = i === 0
          const last = i === rows.length - 1
          if (row.kind === "gap") {
            return (
              <li key={`gap-${i}`} data-row="gap" data-testid="timeline-gap" className={GRID}>
                <div className="text-right text-xs italic text-muted-foreground">
                  {gapLabel(row.months)}
                  <span className="sr-only">{GAP_SR_SUFFIX}</span>
                </div>
                <div className="relative" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
                </div>
                <div className="min-h-5 pb-2" />
              </li>
            )
          }
          if (row.kind === "today") {
            return (
              <li key="today" data-row="today" data-testid="timeline-today" className={GRID}>
                <div aria-hidden="true" className="text-right text-xs font-semibold text-indigo-600 dark:text-primary">
                  {TODAY_LABEL}
                </div>
                <div className="relative flex justify-center" aria-hidden="true">
                  <span className="absolute left-1/2 w-px -translate-x-1/2 bg-border" style={railLineStyle(first, last)} />
                  <span className="relative mt-1.5 size-2 rounded-full bg-indigo-600 ring-[3px] ring-card dark:bg-primary" />
                </div>
                <div className="pb-3 text-xs text-indigo-600 dark:text-primary">
                  <span data-testid="today-sr" className="sr-only">
                    {todaySrLead(todayText)}
                  </span>
                  <span>{todaySentence(todayText, row.placement)}</span>
                </div>
              </li>
            )
          }
          const ev = row.event
          const dot = dotClass(row)
          const state = ev.deadline ? "deadline" : row.past ? "past" : "upcoming"
          const sourced = isResolvedSource(ev.source)
          const showing = tip !== null && tip.index === row.index
          return (
            <li key={`event-${row.index}`} data-row="event" data-testid="timeline-event" data-state={state} className={GRID}>
              <div data-testid="event-date" className="pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {formatEventDate(row.date)}
              </div>
              <div className="relative flex justify-center" aria-hidden="true">
                <span className="absolute left-1/2 w-px -translate-x-1/2 bg-border" style={railLineStyle(first, last)} />
                <span
                  data-testid="event-dot"
                  data-fill={dot.fill}
                  className={cn("relative mt-1 size-3 rounded-full ring-[3px] ring-card", dot.cls)}
                />
              </div>
              <div className="min-w-0 pb-4">
                <span data-testid="event-state" className="sr-only">
                  {EVENT_STATE_WORD[state]}
                </span>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2 text-sm font-semibold leading-[1.4]",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  <span className="min-w-0 break-words">{ev.title}</span>
                  {ev.category && (
                    <span data-testid="event-category" className={CHIP}>
                      {ev.category}
                    </span>
                  )}
                  {row.pill && (
                    <span data-testid="deadline-pill" className={cn(PILL, row.pill.tone === "amber" ? PILL_AMBER : PILL_MUTED)}>
                      {row.pill.text}
                    </span>
                  )}
                </div>
                {ev.detail && <div className="break-words text-xs leading-[1.4] text-muted-foreground">{ev.detail}</div>}
                {sourced && ev.source && (
                  <span
                    data-testid="event-source"
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- UI-SPEC §TimelineArtifact: the source line is a plain tab stop so its hover tooltip is keyboard-reachable (WCAG 1.4.13 / 2.1.1); it has no action
                    tabIndex={0}
                    aria-describedby={showing ? tipId : undefined}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-sm text-xs leading-[1.4] text-muted-foreground"
                    {...sourceHandlers(row.index)}
                  >
                    <FileText className="size-3 shrink-0" aria-hidden="true" />
                    {sourceHeader(ev.source.document, ev.source.page)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {tip && isResolvedSource(tipSource) && (
        <ArtifactTooltip id={tipId} anchor={tip.el} source={tipSource} onDismiss={() => setTip(null)} />
      )}
    </div>
  )
}
