/**
 * Phase 301-03 (NOTE-01 / D-02, D-06, D-10, D-28; UI-SPEC Copywriting Contract, UI-D13, UI-D14) —
 * the one home of every word the "Waiting on you" rail control, its list and the phone's drawer
 * row show. Components write no copy; they compose these.
 *
 * ⛔ Zero imports: a pure leaf. Its types are declared here, never imported from
 *   attentionConditions.ts.
 * ⛔ No raw wire value ever reaches the screen — not "question" or "approval", not an ISO time,
 *   not a UUID. A kind becomes words, a created_at becomes a waited phrase.
 * ⛔ No dismiss, mark-read or snooze words exist here, because no such control exists (D-09).
 */

export const WAITING_COPY = {
  /** The expanded rail label and the drawer row's label. */
  label: "Waiting on you",
  /** The list header. */
  header: "Waiting on you",
  empty: "Nothing is waiting on you.",
  loading: "Checking what's waiting on you…",
  failed: "Couldn't check right now. Trying again shortly.",
  stale: "Couldn't refresh just now. This is the last list we got.",
  untitledWorkflow: "Untitled workflow",
  unnamedOrg: "Unnamed org",
} as const

/** The control's accessible name and tooltip (D-02). Always contains the visible label. */
export function countSentence(total: number | null): string {
  if (total === null || !Number.isFinite(total) || total <= 0) return WAITING_COPY.label
  if (total === 1) return "1 workflow run is waiting on you"
  return `${total} workflow runs are waiting on you`
}

/** The amber pill (UI-D6): the server's total, capped on screen. */
export function pillText(total: number): string {
  return total > 99 ? "99+" : String(total)
}

/** What the run needs from the person (D-06). The DB allows two kinds; anything else is defensive. */
export function kindWords(kind: string): string {
  if (kind === "question") return "needs your answer"
  if (kind === "approval") return "needs your approval"
  return "needs you"
}

/** How the run started, only when that is worth saying (D-28). */
export function originWords(origin: string | null | undefined): string | null {
  if (origin === "schedule") return "scheduled"
  if (origin === "key") return "started by an API key"
  return null
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * How long the run has waited (UI-D14), recomputed on a minute tick. A future created_at (clock
 * skew) or an unparseable one reads "under a minute", never a negative number or NaN.
 */
export function waitedPhrase(createdAtIso: string, nowMs: number): string {
  const created = Date.parse(createdAtIso)
  const raw = nowMs - created
  const elapsed = Number.isNaN(raw) ? 0 : Math.max(0, raw)
  if (elapsed < MINUTE_MS) return "waiting under a minute"
  if (elapsed < HOUR_MS) return `waiting ${Math.floor(elapsed / MINUTE_MS)} min`
  if (elapsed < DAY_MS) return `waiting ${Math.floor(elapsed / HOUR_MS)} hr`
  const days = Math.floor(elapsed / DAY_MS)
  return days === 1 ? "waiting 1 day" : `waiting ${days} days`
}

/** The plain line after the last row when the server holds more than it returned (D-10). */
export function moreLine(n: number): string {
  return `and ${n} more`
}

/** The org mark's letter: the name's first character, upper-cased, or "?" (SwitchOrgPrompt's rule). */
export function orgInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase()
}
