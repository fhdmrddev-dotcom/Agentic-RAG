/**
 * Phase 204.1 (SCHED-01 follow-up) — the ONE wire→words resolver for a row's automation.
 *
 * ⚠ WHY A LEAF AND NOT A TERNARY IN THE CARD. `WorkflowCard.tsx` fires G-5 (18 commits /
 * 5 phases / 1570 lines) and its G-5 was DISCHARGED by extracting exactly this shape once
 * before — `cardFace.ts`, the lead/defer decision. Putting a second wire-reading decision
 * back inline would undo that discharge in the commit after it was earned. This module is
 * that precedent applied a second time, deliberately.
 *
 * ⚠ IT SPELLS NO STRING. Every word comes from `libraryVocabulary.ts`, which is what keeps a
 * copy change a one-line diff in one file — the same contract `cardFace.ts` holds by naming
 * no glyph and no state word.
 *
 * ⚠ THE THREE ABSENCES ARE THREE DIFFERENT FACTS, AND FOLDING THEM IS THE DEFECT THIS FILE
 * EXISTS TO AVOID. `runFacts.ts` shipped that bug once (CR-01: `never` was a ROW-level claim
 * built from a CALLER-level fact, so the library printed *"Never run"* about workflows that
 * really had run), and `DecisionsList` shipped it again (D-20). The three here:
 *
 *   · `undefined` — the feed never mentioned schedules. Older client, drafts feed, a
 *     `response_model` that dropped the key. We know NOTHING and must say nothing.
 *   · `null`      — the feed answered, and the answer is that nothing is active. That
 *     INCLUDES a PAUSED schedule, on purpose: the modal's Pause exists to stop a schedule
 *     without deleting it, so a card still claiming "runs on its own" would contradict the
 *     button its author just pressed.
 *   · a value     — there is an active schedule and this is when it next fires.
 *
 * Only the third produces a sentence. The first two both render NOTHING, and they render
 * nothing for different reasons — which is why they are not collapsed into one branch here
 * even though their output happens to coincide today.
 */
import {
  AUTOMATION_CADENCE,
  AUTOMATION_RUNS_ITSELF,
  automationMoreCount,
  automationNextAt,
} from "./libraryVocabulary"

export interface AutomationFacts {
  /** The words for the identity line, or `null` when the row must stay silent. */
  readonly phrase: string | null
  /** `+2 more`, when this row carries more than one ACTIVE schedule. `null` otherwise. */
  readonly more: string | null
  /** 293-03 (D-25): `next Mon 26 Oct, 09:00` (or `next was due …`), off the server's instant.
   *  `null` on every silent row and when the instant cannot be read. No hover title carries
   *  more (the library's D-14 rule: touch has no hover), so the year shows when it differs. */
  readonly next: string | null
}

const SILENT: AutomationFacts = { phrase: null, more: null, next: null }

/**
 * 293-03 (D-25) — FORMAT ONLY. The instant is the server's soonest active schedule; nothing
 * here works out when a schedule fires. The viewer's own time zone, en-GB parts, 24-hour.
 */
const NEXT_SHORT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}

function partsOf(ms: number, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat("en-GB", options).formatToParts(ms)) out[p.type] = p.value
  return out
}

function nextFacts(iso: string, now: number): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const at = partsOf(ms, NEXT_SHORT)
  const nowYear = partsOf(now, { year: "numeric" }).year
  const date = `${at.weekday} ${at.day} ${at.month}${at.year === nowYear ? "" : ` ${at.year}`}`
  return automationNextAt(`${date}, ${at.hour}:${at.minute}`, ms <= now)
}

/**
 * ⚠ OWN-PROPERTY LOOKUP, NEVER `AUTOMATION_CADENCE[cron] ?? fallback`. A coalesced bracket
 * read on a plain object literal resolves inherited keys — `"constructor"` returns a
 * FUNCTION, and the nullish fallback then provably never fires. That exact shape was the
 * EIGHTH live WR-04 sink in this repo (`200-04`, where React refused the function child and
 * a tool chip rendered as nothing at all), and `toolNames.ts` and `modelFitness.ts` each
 * exist because of it. The guard is load-bearing, not defensive.
 */
function cadenceWords(cron: string | null | undefined): string | null {
  if (!cron) return null
  return Object.prototype.hasOwnProperty.call(AUTOMATION_CADENCE, cron)
    ? AUTOMATION_CADENCE[cron]
    : null
}

/**
 * Resolve a row's automation facts.
 *
 * ⚠ A CUSTOM CRON FALLS BACK TO THE GENERIC SENTENCE, IT DOES NOT PRINT THE CRON. A stepped
 * expression (minute 17, every third hour, on Tuesdays) is not something a reader parses at a
 * glance on an 11px line, and a card showing it would spend the reader's attention to say
 * something they cannot use. The modal prints the expression, because there they asked for it.
 *
 * ⚠ THE EXAMPLE ABOVE IS SPELLED IN WORDS, NOT AS A CRON STRING, AND THAT IS LOAD-BEARING:
 * a stepped cron contains the two characters that CLOSE A BLOCK COMMENT, so writing one here
 * terminates this docblock mid-sentence and the file stops parsing. Observed — it cost two
 * TS1005/TS1160 errors on the first draft of this module.
 *
 * ⚠ AN INTERVAL SCHEDULE IS ALSO GENERIC, for now. "every 900 seconds" is a worse sentence
 * than "runs on its own", and the humane form ("every 15 minutes") is a duration formatter
 * this file will not grow inline. Re-open when a second surface needs one.
 */
export function automationFacts(
  row: {
    nextScheduleAt?: string | null
    nextScheduleCron?: string | null
    nextScheduleIntervalSeconds?: number | null
    nextScheduleCount?: number | null
  },
  now: number = Date.now(),
): AutomationFacts {
  // Absence — either kind. See the docblock: two reasons, one silence, kept distinguishable
  // by comparing against each value rather than testing truthiness.
  if (row.nextScheduleAt === undefined || row.nextScheduleAt === null) return SILENT

  const phrase = cadenceWords(row.nextScheduleCron) ?? AUTOMATION_RUNS_ITSELF

  // ⚠ `> 1`, and the count is of SCHEDULES not runs. `1` is the common case and adds nothing.
  const n = row.nextScheduleCount
  const more = typeof n === "number" && n > 1 ? automationMoreCount(n - 1) : null

  return { phrase, more, next: nextFacts(row.nextScheduleAt, now) }
}
