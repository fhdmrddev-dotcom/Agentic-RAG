/**
 * BUG-260829-01 — SAYING A CRON EXPRESSION BACK IN WORDS, AND COMPOSING THE COMMON ONE.
 *
 * ── THE OPERATOR'S WORDS, 2026-08-29 ─────────────────────────────────────────────────
 * *"this is very misleading to write it manually … it is not clear honestly."*
 *
 * They wanted a schedule at **04:18**. The modal ships five presets whose times are
 * HARDCODED (03:00, 08:00, 08:00, 06:00 and the top of every hour), so any other time falls
 * straight through to a bare monospace text box expecting `18 4 * * *`. That is not a missing
 * feature — it is a preset list that cannot be adjusted, with cron literacy as the only exit.
 *
 * ⚠ **AND THE FIELD COULD NOT BE CHECKED BY LOOKING AT IT.** `18 4` and `4 19` are equally
 * plausible to anyone who does not already know the field order, and a schedule that fires at
 * the wrong hour reports nothing — you find out tomorrow morning, or you do not find out.
 * The operator got theirs right; the surface gave them no way to know that before saving.
 *
 * ── WHAT THIS MODULE IS, AND THE ONE THING IT MUST NEVER DO ──────────────────────────
 * TWO directions over the SAME small grammar:
 *   · `dailyCron` COMPOSES `MM HH * * *` from a time — so "every day at HH:MM" needs no cron;
 *   · `describeCron` READS an expression back in words — so a hand-typed one is checkable.
 *
 * ⚠ **IT NEVER GUESSES.** `describeCron` recognises five shapes and returns `null` for
 * everything else, and the caller renders an honest *"we can't read this one"* rather than an
 * approximation. A confident sentence about an expression this module misparsed is strictly
 * worse than no sentence: it would license exactly the mistake the echo exists to prevent.
 * **The server, not this module, decides what is valid** — `describeCron` returning `null`
 * says only *we cannot phrase it*, never *it is wrong*.
 *
 * PURITY: no React, no DOM, no clock, no `Date.now()`. Every function is total and pure.
 */

/** The five cron fields, in the order the standard puts them. Written down because the
 *  operator's whole difficulty was that the ORDER is invisible in a bare text box. */
const MINUTE = 0
const HOUR = 1
const DOM = 2
const MONTH = 3
const DOW = 4

const DAY_NAMES: Readonly<Record<string, string>> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
  "7": "Sunday",
}

/**
 * A trimmed string, or `""` for ANYTHING that is not one.
 *
 * ⚠ IT IS `typeof`, NOT `?? ""`, AND THAT WAS FOUND BY A TEST RATHER THAN FORESEEN. The first
 * cut wrote `(expr ?? "").trim()`, which guards `null` and `undefined` and NOT `0`, `{}` or
 * `[]` — none of which are nullish, all of which reach a projection reading loose JSONB or an
 * uncontrolled prop. `cronPlain.test.ts`'s totality case drove exactly that and read
 * `TypeError: (expr ?? "").trim is not a function`. These functions feed a live-typing echo,
 * so a throw here blanks a dialog mid-keystroke.
 */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** `"4"` → `"04"`. Presentation only — a cron field is never zero-padded on the way out. */
function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** A field that is a plain non-negative integer within `[min, max]`, else `null`. */
function num(field: string | undefined, min: number, max: number): number | null {
  if (field === undefined || !/^\d+$/.test(field)) return null
  const n = Number(field)
  return n >= min && n <= max ? n : null
}

/**
 * `"04:18"` → `"18 4 * * *"` — the every-day expression, composed rather than typed.
 *
 * Accepts the exact value an `<input type="time">` produces (`HH:MM`, and `HH:MM:SS` from the
 * browsers that add seconds). Returns `null` for anything else, so a caller can never write a
 * malformed expression into the field from a control that was supposed to make that
 * impossible.
 *
 * ⚠ The output is NOT zero-padded (`18 4`, never `18 04`). Both are valid cron, and the
 * unpadded form is what every shipped preset in the modal already uses — a composer that
 * emitted a different dialect would make `CRON_PRESETS.some(p => p.expr === cron)` miss, and
 * the preset dropdown would silently fall to "Custom…" for an expression it had just written.
 */
export function dailyCron(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text(time))
  if (!m) return null
  const hour = num(m[1], 0, 23)
  const minute = num(m[2], 0, 59)
  if (hour === null || minute === null) return null
  return `${minute} ${hour} * * *`
}

/**
 * The inverse of `dailyCron`: `"18 4 * * *"` → `"04:18"`, else `null`.
 *
 * Lets the time control REFLECT an expression that is already in the field — including one a
 * preset put there — instead of resetting to a default and silently discarding what the author
 * had. `null` means "this is not an every-day-at-a-time expression", which is the caller's cue
 * to leave the time control alone rather than to blank it.
 */
export function timeOfDailyCron(expr: string): string | null {
  const f = text(expr).split(/\s+/)
  if (f.length !== 5) return null
  if (f[DOM] !== "*" || f[MONTH] !== "*" || f[DOW] !== "*") return null
  const minute = num(f[MINUTE], 0, 59)
  const hour = num(f[HOUR], 0, 23)
  if (minute === null || hour === null) return null
  return `${pad(hour)}:${pad(minute)}`
}

/**
 * The expression in words, or `null` when this module cannot read it honestly.
 *
 * FIVE SHAPES, and they are exactly the ones the shipped presets emit plus the every-day one
 * the operator wanted. Anything else — a step (a star, slash and number: written that way
 * because the literal sequence CLOSES THIS BLOCK COMMENT and took the whole module down once),
 * a list (`1,15`), a range in the hour
 * field, a named month — returns `null`. That is a deliberate floor, not an oversight: this
 * grammar is large, and a phrase that is *nearly* right about a schedule is the failure mode
 * being fixed, not a lesser version of the fix.
 *
 * The timezone is appended verbatim when given, because a time with no clock attached is the
 * other half of the same ambiguity — the field defaults to the browser's zone and the server
 * stores `UTC` when it is absent, so those two disagreeing is a four-hour error that looks
 * like nothing.
 */
export function describeCron(expr: string, timezone?: string | null): string | null {
  const f = text(expr).split(/\s+/)
  if (f.length !== 5) return null

  const minute = num(f[MINUTE], 0, 59)
  const hour = num(f[HOUR], 0, 23)
  const zone = text(timezone) ? ` (${text(timezone)})` : ""

  // (1) every hour, at a given minute — `M * * * *`
  if (minute !== null && f[HOUR] === "*" && f[DOM] === "*" && f[MONTH] === "*" && f[DOW] === "*") {
    return `Every hour, at ${pad(minute)} minutes past${zone}`
  }

  // Every remaining shape names a time of day, so both fields must read.
  if (minute === null || hour === null) return null
  const at = `${pad(hour)}:${pad(minute)}`

  // (2) every day — `M H * * *`
  if (f[DOM] === "*" && f[MONTH] === "*" && f[DOW] === "*") {
    return `Every day at ${at}${zone}`
  }

  // (3) weekdays — `M H * * 1-5`
  if (f[DOM] === "*" && f[MONTH] === "*" && f[DOW] === "1-5") {
    return `Every weekday (Mon–Fri) at ${at}${zone}`
  }

  // (4) one named day — `M H * * D`
  if (f[DOM] === "*" && f[MONTH] === "*") {
    const day = DAY_NAMES[f[DOW]]
    if (day) return `Every ${day} at ${at}${zone}`
  }

  // (5) a day of the month — `M H D * *`
  if (f[MONTH] === "*" && f[DOW] === "*") {
    const dom = num(f[DOM], 1, 31)
    if (dom !== null) return `The ${ordinal(dom)} of each month at ${at}${zone}`
  }

  return null
}

/** `1 → "1st"`. Local because no shared util owns ordinals and one row does not justify one. */
function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

// ── the words the field says ─────────────────────────────────────────────────────────

/** The label on the composed every-day control. It says WHAT IT SETS, not what cron is. */
export const DAILY_TIME_LABEL = "Every day at"

/** Shown when `describeCron` reads the expression. The lead-in matters: the author is checking
 *  their own typing against it, so it has to read as a restatement, not as a status. */
export const CRON_MEANS_PREFIX = "This means:"

/**
 * Shown when it does not.
 *
 * ⚠ IT CLAIMS NOTHING ABOUT VALIDITY, and that is the whole care in this string. The server
 * owns whether an expression is legal; this module owns only whether it can be phrased. A
 * sentence like "that isn't valid" would be this client inventing a verdict it cannot reach —
 * and plenty of perfectly good cron (a star-slash-number step, `1,15`, `MON`) lands here.
 */
export const CRON_UNREADABLE =
  "We can't put this one in words — it will still be checked when you save."

/** The field-order reminder, because the operator's difficulty was that the order is
 *  invisible: five positions, and nothing on screen said which was which. */
export const CRON_FIELD_ORDER = "minute · hour · day of month · month · day of week"
