/**
 * Phase 292-02 (D-06 · D-18 · UI-D-292-15..18) — the timeline's PURE model. No UI framework, no clock.
 *
 * `today` is an ARGUMENT. The renderer reads the viewer's clock exactly once per render and hands
 * the local calendar day in, so this module is deterministic and testable, and no spec field can set
 * "today" (T-292-16).
 *
 * Dates are calendar dates parsed from INTEGER PARTS (`parseCalendarDate`, the guard's own parser) —
 * never a `Date` built from the ISO string, which is UTC midnight and so shows the PREVIOUS day west of
 * Greenwich. Day counts are integer day numbers (`dayNumber`, pure arithmetic, so years 1-99 are not
 * read as 1901-1999 and no daylight-saving change can shift one). Month names come from a fixed English
 * table, so the text is byte-identical on every machine and every locale build.
 *
 * The rail:
 *   · events sorted ascending by (year, month, day ?? 0), STABLE on the stored order;
 *   · past = on or before today (a month-precision event in the current month counts as past);
 *   · exactly one Today row, between the last past and the first upcoming event (top when all are
 *     upcoming, bottom when all are past);
 *   · a gap row between two consecutive events on the SAME side of Today that are ≥ 6 calendar months
 *     apart — never drawn across the Today row.
 */
import {
  DUE_THIS_MONTH,
  DUE_TODAY,
  MONTH_ABBR,
  inDaysPhrase,
  inMonthsPhrase,
  passedDaysPhrase,
  passedMonthsPhrase,
  type TodayPlacement,
} from "./artifactCopy"
import { parseCalendarDate, type CalendarDate, type TimelineEvent } from "./artifactSpec"

/** Today as a calendar day (always day precision). */
export interface CalendarDay {
  y: number
  m: number
  d: number
}

/** A gap needs at least this many calendar months between neighbours (UI-D-292-17). */
export const GAP_MONTHS = 6

/** `YYYY-MM-DD` / `YYYY-MM` → integer parts, or null. One parser for the guard and the rail. */
export function parseEventDate(s: string): CalendarDate | null {
  return parseCalendarDate(s)
}

/** The LOCAL calendar day of a moment the caller supplies (the renderer's one clock read). */
export function calendarDayOf(moment: Date): CalendarDay {
  return { y: moment.getFullYear(), m: moment.getMonth() + 1, d: moment.getDate() }
}

function sortKey(d: CalendarDate): number {
  return d.y * 10_000 + d.m * 100 + (d.d ?? 0)
}

function todayKey(t: CalendarDay): number {
  return t.y * 10_000 + t.m * 100 + t.d
}

/**
 * The proleptic-Gregorian day number of a calendar day (days since 1970-01-01), by integer
 * arithmetic (Hinnant's days-from-civil). ⚠ Never `Date.UTC(y, …)`: for 0 ≤ y ≤ 99 it adds 1900, so
 * `0099-12-31` was read as 1999 while the month path stayed literal (292-REVIEW WR-05). No `Date`, no
 * clock, no time zone — so no daylight-saving change can shift a count either.
 */
function dayNumber(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Whole calendar days from `a` to `b` (UTC noon on both sides). */
function daysBetween(a: CalendarDay, b: { y: number; m: number; d: number }): number {
  return dayNumber(b.y, b.m, b.d) - dayNumber(a.y, a.m, a.d)
}

function monthsBetween(a: { y: number; m: number }, b: { y: number; m: number }): number {
  return (b.y - a.y) * 12 + (b.m - a.m)
}

export interface SortedEvent {
  event: TimelineEvent
  /** The event's index in the stored list. */
  index: number
  date: CalendarDate
}

/** Stable ascending sort by (year, month, day ?? 0); equal dates keep the stored order. */
export function sortEvents(events: TimelineEvent[]): SortedEvent[] {
  return events
    .map((event, index) => ({ event, index, date: parseEventDate(event.date) ?? { y: 0, m: 1, d: null } }))
    .sort((a, b) => sortKey(a.date) - sortKey(b.date) || a.index - b.index)
}

export interface DeadlinePill {
  text: string
  /** `amber` for an upcoming or today deadline, `muted` for one that has passed. */
  tone: "amber" | "muted"
}

/**
 * The deadline pill. Day precision: `in N days` / `due today` / `passed N days ago`. Month precision:
 * `in N months` / `this month` / `passed N months ago` (calendar months).
 */
export function deadlinePill(date: CalendarDate, today: CalendarDay): DeadlinePill {
  if (date.d === null) {
    const months = monthsBetween(today, date)
    if (months > 0) return { text: inMonthsPhrase(months), tone: "amber" }
    if (months === 0) return { text: DUE_THIS_MONTH, tone: "amber" }
    return { text: passedMonthsPhrase(-months), tone: "muted" }
  }
  const days = daysBetween(today, { y: date.y, m: date.m, d: date.d })
  if (days > 0) return { text: inDaysPhrase(days), tone: "amber" }
  if (days === 0) return { text: DUE_TODAY, tone: "amber" }
  return { text: passedDaysPhrase(-days), tone: "muted" }
}

/** `14 Mar 2023` (day precision) or `Mar 2023` (month precision), from the fixed month table. */
export function formatEventDate(date: CalendarDate): string {
  const month = MONTH_ABBR[date.m - 1] ?? ""
  return date.d === null ? `${month} ${date.y}` : `${date.d} ${month} ${date.y}`
}

/** Today in the same fixed format (`24 Oct 2026`). */
export function formatToday(today: CalendarDay): string {
  return formatEventDate(today)
}

export type RailRow =
  | {
      kind: "event"
      event: TimelineEvent
      index: number
      date: CalendarDate
      past: boolean
      /** The deadline pill, for a deadline only. */
      pill: DeadlinePill | null
    }
  | { kind: "gap"; months: number }
  | { kind: "today"; placement: TodayPlacement }

/** The full rail: sorted events, same-side gap rows and exactly one Today row. */
export function buildRail(events: TimelineEvent[], today: CalendarDay): RailRow[] {
  const sorted = sortEvents(events)
  const now = todayKey(today)
  const rows: RailRow[] = []
  let todayPlaced = false
  let prev: SortedEvent | null = null
  let prevPast = false

  for (const s of sorted) {
    const past = sortKey(s.date) <= now
    if (!past && !todayPlaced) {
      rows.push({ kind: "today", placement: rows.length === 0 ? "top" : "between" })
      todayPlaced = true
    } else if (prev && prevPast === past) {
      const months = monthsBetween(prev.date, s.date)
      if (months >= GAP_MONTHS) rows.push({ kind: "gap", months })
    }
    rows.push({
      kind: "event",
      event: s.event,
      index: s.index,
      date: s.date,
      past,
      pill: s.event.deadline ? deadlinePill(s.date, today) : null,
    })
    prev = s
    prevPast = past
  }
  if (!todayPlaced) rows.push({ kind: "today", placement: "bottom" })
  return rows
}
