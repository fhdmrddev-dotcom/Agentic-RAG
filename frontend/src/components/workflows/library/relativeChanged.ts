/**
 * Phase 192.1-04 Task 2 (LIB-05 / SC#3 — D-18) — the identity line's CLOCK.
 *
 * ONE FUNCTION: an ISO-8601 timestamp in, a long-form English phrase out, across NINE bands
 * — `just now` · `N min ago` · `N hour(s) ago` · `yesterday` · `N days ago` · `last week` ·
 * `N weeks ago` · `last month` · `N months ago` — prefixed by `CHANGED_PREFIX`, so a card
 * renders `changed 2 months ago`. The bands are ported VERBATIM from the fixture the approved
 * sketch runs on (`.planning/sketches/themes/library-fixture-192-1.js:352-365`), because that
 * mockup is the acceptance bar and re-deriving its arithmetic is how a build drifts from the
 * thing a human signed off.
 *
 * ⚠ THIS IS THE **THIRD** SPELLING OF A RELATIVE-TIME FORMATTER IN THIS REPOSITORY, AND SAYING
 * SO IS NOT AN APOLOGY — IT IS THE THING THAT KEEPS THE MODULE LEGIBLE.
 * `libraryFilter.ts:18-27` forbids a second implementation of a derivation BY NAME, so a new
 * formatter that does not state why the existing ones cannot serve reads to any reviewer as
 * exactly that drift. Measured, the two that already exist are:
 *
 *   · `admin/UsersAndAccess.tsx:87` — `relativeTime`, module-private.
 *   · `settings/connectionsCopy.ts:265` — `relativeTime`, exported, and its own docblock claims
 *     to be *"the shipped `UsersAndAccess.tsx:87-97` form, reused rather than re-invented"*
 *     while in fact being a byte-level COPY of it. Two spellings, not one.
 *
 * **Neither can serve this surface, for two independent reasons.** They are COMPACT — `4mo ago`,
 * `3h ago` — pitched at an operator scanning an instrument table, where this surface is
 * long-form prose inside a sentence a person reads once. And they carry FIVE bands where this
 * needs NINE: they have no `just now`-vs-`1 min` distinction at the top, no `yesterday`, and no
 * singular `last week` / `last month`. **This module does NOT widen either of them**: they have
 * their own callers and their own audience, and widening a shared formatter to serve a second
 * audience is the cross-surface change this phase does not own. Three callers, three
 * audiences, one engine each — the same trade `libraryFilter.ts` records for `matchesTitle`.
 *
 * ⚠ `now` IS A PARAMETER, AND THAT IS THE WHOLE FIX FOR P-1. The signature copies
 * `connectionsCopy.ts:280-288`'s `credentialLabel(lastCheckedAt, now = Date.now())`: the page
 * hoists ONE `const now = Date.now()` per render, so every card in a render agrees about what
 * time it is and two cards cannot straddle a band boundary; and the suite injects a fixed
 * instant, so nothing here needs a clock mock — the failure mode P-1 names is a test that
 * passes at one instant and flakes at another.
 *
 * ⚠ NO LIVE TICK, DELIBERATELY. The value refreshes when something else re-renders, and a row
 * that reads `just now` can still read `just now` a while later. That trade is ACCEPTED and
 * stated here rather than engineered around: 188's `WorkflowRunPage` tick-gate bug
 * (`vitest-count-gate.cjs:497-504`) is this project's recorded lesson that a live clock is its
 * own defect class. Do not add a timer to this module.
 *
 * ⚠ ROUNDING, NEVER TRUNCATION, AT EVERY BOUNDARY — and it is load-bearing rather than
 * stylistic. The compact formatters above truncate; ported with truncation this function
 * disagrees with the mockup at four of its eight thresholds (90 s reads `1 min ago`, a band
 * this vocabulary does not even have; 11 days reads `last week`; 32 days reads `4 weeks ago`).
 * That was OBSERVED, not reasoned: the truncating shape was written first and
 * `relativeChanged.test.ts` failed nine cases against it. `Math.round` throughout.
 *
 * ⚠ SILENCE IS A BAND TOO — the honest alternative (T-192.1-07). An absent or unparseable
 * value returns `null`, and the caller renders NO recency segment. Never `Date.now()`, never
 * a fallback to the first band, never the epoch: each of those prints a specific claim about
 * a row that nobody made. `libraryRow.ts:95-114` states the same rule for the field this reads,
 * and `credentialLabel` states it for a credential check — it is the `068-A` honest-last-active
 * rule, applied to a row's recency.
 *
 * PURE, AND A LEAF. No React, no DOM, no API client, and NO DATE LIBRARY — `frontend/package.json`
 * carries none, and acquiring one to format nine bands is a build-config change smuggled in by a
 * label (S-5). Its ONE import is the vocabulary module's prefix, which is imported rather than
 * typed so that a copy change stays the one-line diff D-14 promises.
 */
import { CHANGED_PREFIX } from "./libraryVocabulary"

/**
 * `changed <band>` for a readable timestamp, `null` for anything else.
 *
 * @param updatedAt the row's `updatedAt` — ISO-8601 as the server rendered it, INCLUDING
 *   Postgres microseconds (`2026-06-12T09:30:15.123456+00:00`), which `Date.parse` reads.
 *   `null` / `undefined` mean the wire did not say.
 * @param now the instant to measure against. Defaults to the real clock; pass one hoisted
 *   value per render so every card in that render agrees (P-1).
 */
export function relativeChanged(
  updatedAt: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!updatedAt) return null
  const t = Date.parse(updatedAt)
  if (!Number.isFinite(t)) return null

  return CHANGED_PREFIX + band(now - t)
}

/**
 * The nine bands, in the fixture's own order and with its own arithmetic.
 *
 * A NEGATIVE delta — a row stamped in the future, which real clock skew between a server and
 * a browser produces — falls into the first band and reads as the first phrase. That is
 * deliberate: it is the only reading that never prints a negative duration at a person.
 */
function band(deltaMs: number): string {
  const mins = Math.round(deltaMs / 60_000)
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`

  const hrs = Math.round(mins / 60)
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`

  const days = Math.round(hrs / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`

  const wks = Math.round(days / 7)
  if (wks < 5) return wks === 1 ? "last week" : `${wks} weeks ago`

  const mos = Math.round(days / 30)
  return mos === 1 ? "last month" : `${mos} months ago`
}
