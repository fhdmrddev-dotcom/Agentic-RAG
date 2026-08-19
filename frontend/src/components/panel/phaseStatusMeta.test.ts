/**
 * Phase 200-07 Task 1 (DES-02 · `200-CHECKLIST.md` §4) — THE FIRST DEDICATED SUITE FOR THE
 * PANEL'S STATUS VOCABULARY.
 *
 * ⚠ THIS MODULE SHIPPED UNPINNED, and that is the finding rather than the housekeeping.
 * `phaseStatusMeta.ts` holds the nine words and the two marks the workspace panel puts in
 * front of a person, plus the own-property guard that keeps an unconstrained
 * `workflow_phases.slug`-adjacent status from resolving to a function — and every one of
 * those guarantees was exercised only TRANSITIVELY, through a `PhaseCard` or `PhaseTimeline`
 * render. The count gate's own §187-29 correction states the cost precisely: *"a pinned
 * TOTAL rising proves nothing about the NEW cases, because slack inside an already-listed
 * file absorbs them."* A guarantee with no direct case is one a refactor can delete while
 * every gate stays green.
 *
 * WHAT IS GUARDED HERE, and nowhere else directly:
 *
 *  1. **TOTALITY over all nine declared members** — every one resolves to its own row, with
 *     a distinct glyph and a distinct word. Asserted as a SET SIZE as well as a table, so
 *     the nine are provably nine measurements and not one row read nine times.
 *  2. **The prototype-key floor** — `constructor`, `toString`, `__proto__`, `valueOf` and
 *     `hasOwnProperty` each resolve to the DECLARED `unknown` row and never to a function.
 *     ⚠ This is not theoretical: `lib/phaseState.ts`'s own docblock records the observed
 *     value for `constructor` as literally `[Function Object]`, and `200-04` found the
 *     eighth live sink of this class in this tree, where React REFUSED the function child
 *     and the label rendered as NOTHING AT ALL — worse than the predicted garbage string,
 *     because nothing appears on screen to say anything went wrong.
 *  3. **WR-05** — no word a person reads is a raw union member. The nine words are checked
 *     against the nine member spellings; an overlap would mean the vocabulary layer had
 *     started echoing the wire.
 *  4. **The source shape** — the guard is an own-property test, never a coalesced bracket
 *     read. Driven with a positive control that proves the forbidden shape really does hand
 *     back a function, so the assertion is a measurement rather than a style preference.
 *
 * ⚠ THE FORBIDDEN EXPRESSION IS WRITTEN EXACTLY ONCE, in the positive control below, and
 * NEVER in prose. This plan's acceptance greps the production source for it; a comment that
 * quoted the needle would make the guard read `1` instead of `0`. That is the 187-24 trap,
 * and in this phase alone it has fired on `receiptVocabulary.ts`, `phaseDuration.ts`,
 * `toolNames.ts`, `WorkflowCanvas.tsx` and `WorkflowCanvas.test.tsx`.
 */
import { describe, it, expect } from "vitest"
import type { Phase } from "@/types"
import { statusMeta, statusWord } from "./phaseStatusMeta"
import metaSource from "./phaseStatusMeta?raw"

/**
 * The nine members, spelled out rather than derived.
 *
 * ⚠ A DELIBERATE HAND-WRITTEN LIST. `Phase["status"]` is a type and erases at build, so
 * there is no runtime value to iterate — and that is the point: a tenth member added to the
 * union WITHOUT a line here is a member this suite silently never exercises. The length
 * assertion below is what turns that silence into a red.
 */
const ALL_STATUSES: Phase["status"][] = [
  "pending",
  "running",
  "done",
  "failed",
  "retrying",
  "skipped",
  "recorded-not-sent",
  "unknown",
  "cancelled",
]

/** The prototype keys a plain object literal INHERITS. Each is a live hazard, not a shape. */
const PROTOTYPE_KEYS = ["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"]

describe("phaseStatusMeta — totality over the declared members  [owner: 200-07]", () => {
  it("resolves all NINE members to their own row, with nine distinct glyphs and nine distinct words", () => {
    // ⚠ NON-VACUITY FIRST. If the list above ever stops being the whole union, every
    // assertion under it becomes a smaller measurement wearing the same clothes.
    expect(ALL_STATUSES).toHaveLength(9)
    expect(new Set(ALL_STATUSES).size).toBe(9)

    const rows = ALL_STATUSES.map((s) => statusMeta(s))
    for (const row of rows) {
      expect(typeof row.glyph).toBe("string")
      expect(row.glyph.length).toBeGreaterThan(0)
      expect(typeof row.text).toBe("string")
      expect(row.text.length).toBeGreaterThan(0)
      expect(typeof row.textClass).toBe("string")
      expect(row.textClass.length).toBeGreaterThan(0)
    }
    // Nine ROWS, not one row nine times — the property a per-member loop cannot show.
    expect(new Set(rows.map((r) => r.glyph)).size).toBe(9)
    expect(new Set(rows.map((r) => r.text)).size).toBe(9)
  })

  it("gives `statusWord` the same word the table holds — one door, never a second copy", () => {
    for (const s of ALL_STATUSES) {
      expect(statusWord(s)).toBe(statusMeta(s).text)
    }
    // And nine distinct words come back through that door too, so the delegation is not
    // collapsing everything onto one row.
    expect(new Set(ALL_STATUSES.map(statusWord)).size).toBe(9)
  })

  it("WR-05: no rendered word is a raw union member", () => {
    // The defect this module was extracted to fix: `PhaseTimeline`'s doing-now line
    // interpolated `Phase["status"]` straight into copy, so a person read
    // `notify — recorded-not-sent` — a kebab-case internal identifier, on the one surface
    // whose whole discipline is that the STORED SLUG, the PANEL WORD and the CANVAS SENTENCE
    // are three deliberately different spellings.
    const members = new Set<string>(ALL_STATUSES)
    for (const s of ALL_STATUSES) {
      expect(members.has(statusWord(s)), `the word for ${s} is its own union member`).toBe(false)
    }
    // POSITIVE CONTROL — the predicate really does catch a member used as copy.
    expect(members.has("recorded-not-sent")).toBe(true)
  })
})

describe("phaseStatusMeta — the prototype-key floor (WR-04)  [owner: 200-07]", () => {
  it("resolves every inherited key to the DECLARED `unknown` row, never to a function", () => {
    const unknownRow = statusMeta("unknown")
    for (const key of PROTOTYPE_KEYS) {
      const row = statusMeta(key as Phase["status"])
      expect(typeof row, `${key} did not resolve to an object`).toBe("object")
      expect(typeof row.glyph, `${key} resolved to something whose glyph is not a string`).toBe(
        "string",
      )
      // ⚠ THE FALLBACK IS THE ROW THE TABLE ALREADY DECLARES, not a new invented state.
      // `unknown` was added by Phase 188 Plan 02 precisely so an unrecognised
      // `workflow_phases.status` reads as *Unknown* and never as *Complete*. This guard is
      // that same lesson applied to the KEY space rather than the VALUE space.
      expect(row).toStrictEqual(unknownRow)
    }
  })

  it("POSITIVE CONTROL: the forbidden coalesced read really does hand back a function", () => {
    // ⚠ WRITTEN EXACTLY ONCE, HERE, and this is the only place in the tree it can appear
    // without being mistaken for live code. Without this case the guard above is a style
    // preference; with it, it is a measurement.
    const TABLE: Record<string, { glyph: string }> = { unknown: { glyph: "?" } }
    const naive = TABLE["constructor"] ?? TABLE.unknown
    // The coalesce PROVABLY NEVER FIRES — an inherited member is never nullish.
    expect(typeof naive).toBe("function")
    expect(naive).not.toStrictEqual(TABLE.unknown)
    // ...and the shipped guard, given the same key, answers correctly.
    expect(typeof statusMeta("constructor" as Phase["status"])).toBe("object")
  })

  it("an unrecognised future value fails CLOSED — Unknown, never a success word", () => {
    const future = statusMeta("some-status-from-a-newer-server" as Phase["status"])
    expect(future).toStrictEqual(statusMeta("unknown"))
    // Named explicitly: it must not silently read as any of the three terminals a person
    // would act on. A fallback that claims MORE than its input supports is a fail-open.
    expect(future.text).not.toBe(statusMeta("done").text)
    expect(future.text).not.toBe(statusMeta("failed").text)
    expect(future.text).not.toBe(statusMeta("recorded-not-sent").text)
  })
})

describe("phaseStatusMeta — the source shape stays own-property  [owner: 200-07]", () => {
  it("reads the table through an own-property test, with no coalesced bracket read", () => {
    // NON-VACUITY BEFORE CONTENTS — `?raw` returning an empty string is a silent pass, and
    // this repo has measured that failure mode for real (`gutterTokens.fences.test.ts`
    // found `?raw` reading CSS as `""` under vitest).
    expect(metaSource.length).toBeGreaterThan(1000)
    expect(metaSource).toContain("STATUS_META")
    expect(metaSource).toMatch(/Object\.prototype\.hasOwnProperty\.call\(STATUS_META,/)
    // The forbidden shape, assembled rather than spelled, so this assertion cannot be the
    // thing that makes itself fail (the 187-24 trap).
    const COALESCED = new RegExp("STATUS_META\\[[^\\]]+\\]\\s*\\?\\?")
    expect(metaSource).not.toMatch(COALESCED)
    // POSITIVE CONTROL — the assembled needle finds the shape it forbids.
    expect("return STATUS_META[status] ?? STATUS_META.unknown").toMatch(COALESCED)
  })

  it("holds WORDS and no derivation — no timestamp arithmetic ever lands in this module", () => {
    // D-06's nine timing arms live in `components/workflows/phaseDuration.ts`, SHARED with
    // the run page, which is what makes it structurally impossible for the panel half and
    // the page half to disagree about a duration. A second derivation here would be that
    // disagreement's first day, and it would arrive looking like a small convenience.
    const DATE_MATH = /new Date\([^)]*\)\s*[-+]\s*new Date\(/
    expect(metaSource).not.toMatch(DATE_MATH)
    expect(metaSource).not.toMatch(/Date\.now\(\)/)
    // POSITIVE CONTROL.
    expect("const d = new Date(a) - new Date(b)").toMatch(DATE_MATH)
  })
})
