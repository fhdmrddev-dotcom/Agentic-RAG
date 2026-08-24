/**
 * Phase 192.1-04 Task 2 (LIB-05 / SC#3 — D-18) — the nine-band formatter's tests.
 *
 * The `libraryFilter.test.ts` / `deriveTier.test.ts` posture: a pure `describe` per rule, no
 * `render`, and — the point of the whole signature — **NO CLOCK MOCK**. `relativeChanged`
 * takes `now` as its last parameter (the `credentialLabel(lastCheckedAt, now = Date.now())`
 * shape at `connectionsCopy.ts:280-288`), so every case below injects a fixed instant. A suite
 * that mocked `Date.now` would pass at one instant and flake at another, which is P-1's
 * recorded warning sign.
 *
 * WHAT IS PINNED:
 *  - all NINE bands, and BOTH SIDES of every threshold between them;
 *  - that the arithmetic ROUNDS rather than truncates — the compact operator formatters
 *    truncate, this one does not, and at four of the eight thresholds the two disagree;
 *  - that an absent or unreadable timestamp yields `null`, never a fabricated time (T-192.1-07,
 *    the `068-A` honest-last-active rule), with a POSITIVE CONTROL beside every `null`
 *    assertion so the case cannot pass because the function is broken for everything;
 *  - that the prefix is IMPORTED from the vocabulary module and not spelled here or there;
 *  - determinism: the same `(value, now)` twice is the same string.
 *
 * ⚠ ONE PLAN FIGURE IS CORRECTED HERE ON MEASUREMENT, and the correction is stated rather
 * than smoothed. `192.1-04-PLAN.md`'s `<behavior>` block says *"30 days → changed last month"*.
 * Ported verbatim, the fixture's own arithmetic disagrees: at 30 days `wks = round(30 / 7) = 4`,
 * which is `< 5`, so the weeks band answers first and the value is `4 weeks ago`. The plan's
 * own `<action>` says *"port the nine bands verbatim"* and its acceptance criteria say the same,
 * so the ALGORITHM is authoritative and the example is an arithmetic slip. The real threshold is
 * measured below and pinned on both sides: **31 days is the last `weeks` day, 32 days is the
 * first `last month` day.**
 */
import { describe, it, expect } from "vitest"
import relativeChangedSource from "./relativeChanged?raw"
import { CHANGED_PREFIX } from "./libraryVocabulary"
import { relativeChanged } from "./relativeChanged"

/** A fixed instant. Nothing here reads a real clock, so nothing here can drift. */
const NOW = Date.UTC(2026, 7, 12, 9, 30)

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** An ISO-8601 string `NOW - delta` — the wire shape `LibraryRow.updatedAt` carries. */
const ago = (deltaMs: number): string => new Date(NOW - deltaMs).toISOString()

/** The band alone, with the prefix stripped — so the band table reads as bands. */
const bandOf = (deltaMs: number): string | null => {
  const full = relativeChanged(ago(deltaMs), NOW)
  if (full === null) return null
  expect(full.startsWith(CHANGED_PREFIX)).toBe(true)
  return full.slice(CHANGED_PREFIX.length)
}

// ── the nine bands ───────────────────────────────────────────────────────────────────

describe("the nine bands (D-18, ported verbatim from library-fixture-192-1.js:352-365)", () => {
  const BANDS: [label: string, delta: number, expected: string][] = [
    ["0 ms — the row changed this instant", 0, "just now"],
    ["1 min", 1 * MIN, "just now"],
    ["2 min", 2 * MIN, "2 min ago"],
    ["59 min", 59 * MIN, "59 min ago"],
    ["1 hour — singular", 1 * HOUR, "1 hour ago"],
    ["5 hours — plural", 5 * HOUR, "5 hours ago"],
    ["23 hours", 23 * HOUR, "23 hours ago"],
    ["1 day", 1 * DAY, "yesterday"],
    ["3 days", 3 * DAY, "3 days ago"],
    ["6 days", 6 * DAY, "6 days ago"],
    ["7 days — singular week", 7 * DAY, "last week"],
    ["21 days", 21 * DAY, "3 weeks ago"],
    ["32 days — singular month", 32 * DAY, "last month"],
    ["60 days", 60 * DAY, "2 months ago"],
  ]

  it.each(BANDS)("%s → %s", (_label, delta, expected) => {
    expect(bandOf(delta)).toBe(expected)
  })

  it("every band is reachable — all nine shapes appear in the table above", () => {
    // NON-VACUITY. A formatter that collapsed two bands into one would still pass every
    // row above if the table only ever exercised one of them; this counts the shapes.
    const shapes = new Set(
      BANDS.map(([, delta]) =>
        String(bandOf(delta))
          .replace(/^\d+/, "N")
          .replace(/^N (min|hour|hours|days|weeks|months) ago$/, "N $1 ago"),
      ),
    )
    expect(shapes).toEqual(
      new Set([
        "just now",
        "N min ago",
        "N hour ago",
        "N hours ago",
        "yesterday",
        "N days ago",
        "last week",
        "N weeks ago",
        "last month",
        "N months ago",
      ]),
    )
  })
})

// ── both sides of all eight thresholds ───────────────────────────────────────────────

describe("both sides of every threshold — rounding is load-bearing at each one", () => {
  const THRESHOLDS: [name: string, below: number, belowText: string, above: number, aboveText: string][] = [
    // 1 · just now → N min ago. Rounding decides at 90 s: truncation would say `1 min`,
    //     which is not even a band this formatter has.
    ["just now → min", 89_000, "just now", 91_000, "2 min ago"],
    // 2 · min → hour. 59 min stays; 60 min rounds to exactly one hour.
    ["min → hour", 59 * MIN, "59 min ago", 60 * MIN, "1 hour ago"],
    // 3 · singular hour → plural hours.
    ["hour → hours", 1 * HOUR, "1 hour ago", 2 * HOUR, "2 hours ago"],
    // 4 · hours → yesterday. 23 h stays in hours; 24 h rounds to one day.
    ["hours → yesterday", 23 * HOUR, "23 hours ago", 24 * HOUR, "yesterday"],
    // 5 · yesterday → N days.
    ["yesterday → days", 1 * DAY, "yesterday", 2 * DAY, "2 days ago"],
    // 6 · days → last week. round(7 / 7) === 1.
    ["days → week", 6 * DAY, "6 days ago", 7 * DAY, "last week"],
    // 7 · singular week → plural weeks. round(11 / 7) === 2, round(10 / 7) === 1 —
    //     truncation would put 11, 12 and 13 days in `last week` too.
    ["week → weeks", 10 * DAY, "last week", 11 * DAY, "2 weeks ago"],
    // 8 · weeks → last month. ⚠ MEASURED, NOT THE PLAN'S `30`: round(31 / 7) === 4 (< 5, so
    //     still weeks) while round(32 / 7) === 5, and round(32 / 30) === 1.
    ["weeks → month", 31 * DAY, "4 weeks ago", 32 * DAY, "last month"],
  ]

  it.each(THRESHOLDS)("%s — below stays, above crosses", (_n, below, belowText, above, aboveText) => {
    expect(bandOf(below)).toBe(belowText)
    expect(bandOf(above)).toBe(aboveText)
  })

  it("singular month → plural months, the ninth band's own edge", () => {
    // round(44 / 30) === 1 · round(45 / 30) === 2. The last threshold, exercised on both
    // sides like the eight above so no band's plural form is asserted only once.
    expect(bandOf(44 * DAY)).toBe("last month")
    expect(bandOf(45 * DAY)).toBe("2 months ago")
  })

  it("ROUNDING CONTROL — four thresholds land differently under truncation", () => {
    // The reason `Math.round` is called load-bearing rather than incidental. Each pair here
    // is a value where a truncating implementation (the shape both compact operator
    // formatters use) produces a DIFFERENT band, so this suite would catch the swap.
    expect(bandOf(90_000)).toBe("2 min ago") // truncate → 1 min, a band that does not exist
    expect(bandOf(90 * MIN)).toBe("2 hours ago") // truncate → 1 hour ago
    expect(bandOf(36 * HOUR)).toBe("2 days ago") // truncate → yesterday
    expect(bandOf(11 * DAY)).toBe("2 weeks ago") // truncate → last week
  })
})

// ── the honest alternative: silence, never a fabricated time (T-192.1-07) ────────────

describe("an absent or unreadable timestamp is SILENCE, not a guess", () => {
  // Every `null` case is paired with a POSITIVE CONTROL on the same line of reasoning: a
  // function that returned `null` for everything would satisfy the negatives alone (S-6).
  const LIVE = ago(5 * HOUR)

  it("undefined — the wire did not say", () => {
    expect(relativeChanged(undefined, NOW)).toBeNull()
    expect(relativeChanged(LIVE, NOW)).toBe(`${CHANGED_PREFIX}5 hours ago`) // positive control
  })

  it("null — the column was NULL", () => {
    expect(relativeChanged(null, NOW)).toBeNull()
    expect(relativeChanged(LIVE, NOW)).toBe(`${CHANGED_PREFIX}5 hours ago`) // positive control
  })

  it("an unparseable string", () => {
    expect(relativeChanged("not-a-date", NOW)).toBeNull()
    expect(relativeChanged(LIVE, NOW)).toBe(`${CHANGED_PREFIX}5 hours ago`) // positive control
  })

  it("the empty string, which `Date.parse` does not read either", () => {
    expect(relativeChanged("", NOW)).toBeNull()
    expect(relativeChanged(LIVE, NOW)).toBe(`${CHANGED_PREFIX}5 hours ago`) // positive control
  })

  it("POSTGRES MICROSECONDS still parse — the shape the wire really sends", () => {
    // `libraryFilter.test.ts:375` pins this exact spelling as what the three feeds render.
    // A formatter that only accepted millisecond ISO would go silent on EVERY real row while
    // every negative above stayed green.
    expect(relativeChanged("2026-08-12T04:30:00.123456+00:00", NOW)).toBe(`${CHANGED_PREFIX}5 hours ago`)
  })
})

// ── determinism and the imported prefix ──────────────────────────────────────────────

describe("the function is pure, deterministic, and spells its prefix nowhere", () => {
  it("called twice with the same (value, now) it returns the same string", () => {
    const value = ago(3 * DAY)
    expect(relativeChanged(value, NOW)).toBe(relativeChanged(value, NOW))
  })

  it("a FUTURE timestamp reads as just now rather than as a negative", () => {
    // Clock skew between a server row and a browser is real. The ported arithmetic makes the
    // delta negative, which falls into the first band — so the surface says `just now` and
    // never prints `-3 min ago`. Stated as a pinned behaviour, not left to be discovered.
    expect(bandOf(-5 * MIN)).toBe("just now")
  })

  it("`now` DEFAULTS to the real clock when the caller omits it", () => {
    // The default is what lets the page hoist ONE `Date.now()` per render while a caller
    // that does not care stays a one-argument call. Asserted loosely on purpose: this is the
    // ONE assertion in the file that touches a real clock, so it pins the SHAPE (a string
    // with the prefix), never a band.
    const label = relativeChanged(new Date().toISOString())
    expect(label).not.toBeNull()
    expect(String(label).startsWith(CHANGED_PREFIX)).toBe(true)
  })

  it("the module imports CHANGED_PREFIX and spells no prefix literal in its own CODE", () => {
    // ⚠ SCOPED TO NON-COMMENT LINES, which is this repo's recorded resolution of the 187-24
    // trap (the fences file records it twice; Waves 1 and 2 each hit it again). The module's
    // docblock necessarily discusses the prefix, and a raw whole-file needle reds on the very
    // prose that documents the rule it enforces.
    const code = relativeChangedSource
      .split("\n")
      .filter((line) => {
        const t = line.trim()
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
      })
      .join("\n")

    expect(code).toMatch(/import\s*\{[^}]*\bCHANGED_PREFIX\b[^}]*\}\s*from\s*["']\.\/libraryVocabulary["']/)
    // POSITIVE CONTROL — the needle really does catch an inlined prefix.
    const planted = 'const label = "changed " + band'
    expect(planted).toMatch(/["']changed /)
    expect(code).not.toMatch(/["']changed /)
  })

  it("it is a LEAF — no React, no DOM, no API client, no date library", () => {
    expect(relativeChangedSource.length).toBeGreaterThan(0)
    expect(relativeChangedSource).not.toMatch(/from\s+["']react["']/)
    expect(relativeChangedSource).not.toMatch(/document\./)
    expect(relativeChangedSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    // No date library: `frontend/package.json` carries none and adding one is not
    // discretionary (S-5). The four this repo would plausibly reach for, named.
    for (const lib of ["date-fns", "dayjs", "luxon", "moment"]) {
      expect(relativeChangedSource).not.toContain(`"${lib}"`)
    }
  })

  it("it ships NO LIVE TICK — the value refreshes only when something else re-renders", () => {
    // 188's `WorkflowRunPage` tick-gate bug is this project's recorded lesson that a live
    // clock is its own defect class (`vitest-count-gate.cjs:497-504`). The trade is accepted
    // and is stated in the module's own docblock rather than engineered around.
    expect(relativeChangedSource).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/)
  })

  it("the docblock admits it is the THIRD spelling, and names the other two", () => {
    // ⚠ NOT DECORATION. `libraryFilter.ts:18-27` forbids a second implementation of a
    // derivation BY NAME, so a new formatter that does not say why the two existing ones
    // cannot serve reads to a reviewer as exactly that drift. This is the assertion that
    // keeps the explanation attached to the code.
    // ⚠ CASE-INSENSITIVE ON PURPOSE. The claim is about what the docblock ADMITS, and this
    // file's house voice puts load-bearing words in caps. Observed: written case-sensitively
    // first, it reddened on `THIRD` — a fence that reds on prose satisfying its own intent
    // trains its reader to reword the prose, which is the opposite of what it is for.
    expect(relativeChangedSource).toMatch(/\bthird\b/i)
    // NON-VACUITY — the anchored needle is not satisfied by any stem.
    expect("a formatter with no admission at all, thirdly notwithstanding").not.toMatch(/\bthird\b/i)
    expect(relativeChangedSource).toContain("admin/UsersAndAccess.tsx")
    expect(relativeChangedSource).toContain("settings/connectionsCopy.ts")
  })
})
