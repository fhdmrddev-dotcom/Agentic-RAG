/**
 * The eased fraction of the way from start to target, clamped to [0, 1].
 *
 * ⚠ The rAF timestamp is the FRAME's start time, which can be EARLIER than the
 * `performance.now()` the effect captured as `startTime` when the main thread was busy. An
 * unclamped negative `elapsed` made the cubic ease negative, and a mount animation from 0 to
 * 30,000 painted "-17,721 documents" (found by the Phase 284 G-4 drive at 50k).
 */
export function easedProgress(elapsed: number, duration: number): number {
  const progress = duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 1
  return 1 - Math.pow(1 - progress, 3)
}

/** A display value split into the number it animates and the text around it. */
export interface ParsedDisplayNumber {
  prefix: string
  num: number
  suffix: string
  /** The value was written with the locale's group separator (`n.toLocaleString()`). */
  grouped: boolean
  decimals: number
}

function separators(locale?: string): { group: string; decimal: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8)
    return {
      group: parts.find((p) => p.type === "group")?.value ?? ",",
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    }
  } catch {
    return { group: ",", decimal: "." }
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * 284-REVIEW IN-05 — read a display value the way it was WRITTEN. Counts reach `AnimatedNumber`
 * as `n.toLocaleString()` strings, so a group separator is the LOCALE's, not always a comma: the
 * old comma-only strip read de-DE "10.000" as 10.000 with three decimals, and the count-up frames
 * showed "3.142…". A token is grouped only when the separator sits in grouping position
 * (`1.234.567`), so an ungrouped decimal such as "12.5 MB" keeps its meaning in every locale. A
 * `number` value is never grouped. `null` = there is no number to animate.
 */
export function parseDisplayNumber(value: number | string, locale?: string): ParsedDisplayNumber | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null
    const s = String(value)
    return { prefix: "", num: value, suffix: "", grouped: false, decimals: s.includes(".") ? s.split(".")[1].length : 0 }
  }
  const { group, decimal } = separators(locale)
  const G = escapeRe(group)
  const D = escapeRe(decimal)
  const grouped = new RegExp(`^([^0-9.,-]*)(\\d{1,3}(?:${G}\\d{3})+(?:${D}\\d+)?)(?![0-9])(.*)$`).exec(value)
  if (grouped) {
    const [, prefix, token, suffix] = grouped
    const [whole, frac = ""] = token.split(decimal)
    return {
      prefix,
      num: parseFloat(`${whole.split(group).join("")}${frac ? `.${frac}` : ""}`),
      suffix,
      grouped: true,
      decimals: frac.length,
    }
  }
  // Not grouped: the shipped parse (a plain integer or a `.` decimal), unchanged.
  const clean = group === "," ? value.replace(/,/g, "") : value
  const plain = clean.match(/^([^0-9.-]*)([0-9]+(?:\.[0-9]+)?)(.*)$/)
  if (!plain) return null
  return {
    prefix: plain[1],
    num: parseFloat(plain[2]),
    suffix: plain[3],
    grouped: false,
    decimals: plain[2].includes(".") ? plain[2].split(".")[1].length : 0,
  }
}

/** One animation frame of `parsed` at `n`, written the same way the final value is. */
export function formatDisplayNumber(n: number, parsed: ParsedDisplayNumber, locale?: string): string {
  const d = parsed.decimals
  let body: string
  if (d > 0) {
    const factor = Math.pow(10, d)
    const current = Math.round(n * factor) / factor
    body = parsed.grouped
      ? current.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })
      : current.toFixed(d)
  } else {
    const current = Math.round(n)
    body = parsed.grouped ? current.toLocaleString(locale) : current.toString()
  }
  return `${parsed.prefix}${body}${parsed.suffix}`
}
