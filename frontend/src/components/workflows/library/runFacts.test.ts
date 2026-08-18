/**
 * Phase 192.2-04 Task 3 (LIB-06 — D-08, threats T-13 / T-14 / T-15 / T-16) — `runFacts`'
 * contract, and above all the contract that its THIRD ARM CANNOT COLLAPSE.
 *
 * ⚠ THE HEADLINE CASE IS §2. Everything else here is ordinary coverage; the block that would
 * catch the defect this plan exists to prevent is the one asserting that `null` and `undefined`
 * resolve to DIFFERENT arms with DIFFERENT words, and that neither word is blank, empty, or a
 * claim of success. A two-armed implementation passes every other test in this file.
 *
 * No DOM: the module is a pure leaf, so a render here would be slower, less complete, and
 * would prove the card as well as the resolver (the reasoning `cardFace.test.ts` records).
 *
 * ⚠ `now` IS INJECTED IN EVERY CASE THAT READS A BAND. A suite that let the default
 * `Date.now()` run is a suite that passes at one instant and flakes at another (P-1) — the
 * failure mode `relativeChanged.ts` names by that number.
 */
import { describe, it, expect } from "vitest"

import runFactsSource from "./runFacts?raw"

import { runFacts, type RunFact, type RunOutcome } from "./runFacts"
import { relativeBand } from "./relativeChanged"
import {
  RUN_FAILED,
  RUN_NEVER,
  RUN_STOPPED,
  RUN_UNKNOWN,
  RUN_WORKED,
} from "./libraryVocabulary"
import { FIXTURE_NOW, libraryRowOf } from "./__fixtures__/libraryScale"

const DAY = 24 * 60 * 60 * 1000
const at = (msAgo: number) => new Date(FIXTURE_NOW - msAgo).toISOString()

/**
 * Source with every comment removed, so a source-swept negative cannot red on the very
 * paragraph that documents the rule it enforces (the 187-24 trap — met three times in this
 * subtree already, and a fourth time by this file's first draft).
 *
 * Block comments first, then whole-line `//` comments: every line comment in the module under
 * test sits on its own line, and a stripper that tried to handle trailing ones would have to
 * understand string literals, which is a parser and not a fence.
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "")

/** One row carrying exactly the two run fields under test, and nothing else that matters. */
const rowWith = (lastRunStatus: string | null | undefined, lastRunAt: string | null | undefined) =>
  libraryRowOf({ lastRunStatus, lastRunAt })

// ── 1 · the three arms exist, and each says what happened ────────────────────────────

describe("the three arms", () => {
  it("ARM 1 — it RAN: a completed run reads as worked, with its recency", () => {
    const fact = runFacts(rowWith("completed", at(2 * DAY)), FIXTURE_NOW)
    expect(fact).toEqual<RunFact>({
      kind: "ran",
      outcome: "worked",
      when: "2 days ago",
      word: "Worked 2 days ago",
    })
  })

  it("ARM 2 — NEVER RUN: the backend looked and there is no run row", () => {
    // The wire's explicit `null`, which the normalizer carries VERBATIM rather than collapsing.
    const fact = runFacts(rowWith(null, null), FIXTURE_NOW)
    expect(fact).toEqual<RunFact>({ kind: "never", word: RUN_NEVER })
  })

  it("ARM 3 — UNKNOWN: the wire did not say, because the key was not there", () => {
    // A frontend deployed AHEAD of its backend. `undefined` is the ABSENT key, not a null value.
    const fact = runFacts(rowWith(undefined, undefined), FIXTURE_NOW)
    expect(fact).toEqual<RunFact>({ kind: "unknown", word: RUN_UNKNOWN })
  })

  it.each([
    ["completed", "worked", RUN_WORKED] as const,
    ["failed", "failed", RUN_FAILED] as const,
    ["cancelled", "stopped", RUN_STOPPED] as const,
  ])("%s → %s, and leads with the shipped word", (status, outcome, word) => {
    const fact = runFacts(rowWith(status, at(2 * DAY)), FIXTURE_NOW)
    expect(fact.kind).toBe("ran")
    expect((fact as Extract<RunFact, { kind: "ran" }>).outcome).toBe<RunOutcome>(outcome)
    // Compared against the IMPORTED constant, never a re-typed literal: a test that spelled the
    // word inline would fork the acceptance bar exactly as a second copy in the source would.
    expect(fact.word.startsWith(word)).toBe(true)
  })

  it("the three run outcomes are three — no two share a word", () => {
    const words = ["completed", "failed", "cancelled"].map(
      (s) => runFacts(rowWith(s, at(2 * DAY)), FIXTURE_NOW).word,
    )
    expect(new Set(words).size).toBe(3)
  })
})

// ── 2 · ⚠ THE HEADLINE — `unknown` is NOT `never` (T-13) ─────────────────────────────

describe("⚠ T-13 — the unknown arm cannot collapse into the never-run arm", () => {
  const unknown = runFacts(rowWith(undefined, undefined), FIXTURE_NOW)
  const never = runFacts(rowWith(null, null), FIXTURE_NOW)

  it("they are DIFFERENT KINDS — a boolean or a two-armed union cannot express this", () => {
    expect(unknown.kind).toBe("unknown")
    expect(never.kind).toBe("never")
    expect(unknown.kind).not.toBe(never.kind)
  })

  it("they say DIFFERENT WORDS to the person reading the card", () => {
    // The defect this asserts against is not subtle once stated: rendering the unknown arm as
    // "Never run" makes the product claim, in writing, that a workflow which may have run a
    // hundred times has never run. The two strings must not be equal.
    expect(unknown.word).not.toBe(never.word)
    expect(unknown.word).toBe(RUN_UNKNOWN)
    expect(never.word).toBe(RUN_NEVER)
  })

  it("⚠ NEITHER ARM RENDERS BLANK — D-08 forbids silence as much as it forbids a lie", () => {
    for (const fact of [unknown, never]) {
      expect(typeof fact.word).toBe("string")
      expect(fact.word.trim()).not.toBe("")
      expect(fact.word.length).toBeGreaterThan(2)
    }
  })

  it("⚠ NEITHER ARM RENDERS AS SUCCESS — no outcome, and no success word anywhere in it", () => {
    for (const fact of [unknown, never]) {
      // Structurally: only the `ran` arm has an `outcome` at all, so neither can be read as one.
      expect("outcome" in fact).toBe(false)
      expect(fact.word).not.toContain(RUN_WORKED)
      // …and it carries no time, so it cannot read as "it worked, a while ago" either.
      expect("when" in fact).toBe(false)
    }
  })

  it("the ABSENT key and the NULL value really do arrive differently on a row", () => {
    // Non-vacuity for the whole block: if the fixture collapsed the two, every case above would
    // pass while proving nothing. This asserts the INPUTS differ, not just the outputs.
    expect(rowWith(undefined, undefined).lastRunStatus).toBeUndefined()
    expect(rowWith(null, null).lastRunStatus).toBeNull()
    expect(rowWith(null, null).lastRunStatus).not.toBe(rowWith(undefined, undefined).lastRunStatus)
  })

  it("a MIXED row — status absent but a timestamp present — is still unknown, not a run", () => {
    // The status is what carries the outcome. A timestamp alone says when something happened
    // and nothing about what it was, so inferring success from it would be inventing a fact.
    const fact = runFacts(rowWith(undefined, at(2 * DAY)), FIXTURE_NOW)
    expect(fact.kind).toBe("unknown")
    expect(fact.word).toBe(RUN_UNKNOWN)
  })
})

// ── 3 · an unrecognised status is unknown, never success (T-15) ──────────────────────

describe("T-15 — a status this build does not know is never read as success", () => {
  it.each([
    "timed_out", // a real status on the sibling `runs` table — a plausible future terminal
    "interrupted", // ditto, from `eval_runs`
    "succeeded", // ⚠ the near-miss: a synonym of success that is NOT the shipped spelling
    "COMPLETED", // ⚠ the case variant. The column is lower-case; this is not that value.
    "", // a blank status is not an outcome
    "  ", // …and neither is whitespace
  ])("%p resolves to unknown", (status) => {
    const fact = runFacts(rowWith(status, at(2 * DAY)), FIXTURE_NOW)
    expect(fact.kind).toBe("unknown")
    expect(fact.word).toBe(RUN_UNKNOWN)
    expect(fact.word).not.toBe(RUN_WORKED)
  })

  it.each(["active", "paused", "cap_paused"])(
    "the IN-FLIGHT status %p resolves to unknown — it has no outcome yet, by definition",
    (status) => {
      // These three are real values of `workflow_runs.status` and are deliberately absent from
      // the map. Mapping them to `worked` would claim a run finished that is still going; a
      // fourth *running* arm is a pixel decision with its own re-open trigger (see the source).
      expect(runFacts(rowWith(status, at(1 * DAY)), FIXTURE_NOW).kind).toBe("unknown")
    },
  )

  it("⚠ INHERITED PROPERTY NAMES do not become outcomes — the `?? fallback` trap", () => {
    // Measured in this repository, not theoretical: `phaseStatusFromDb` shipped a
    // `TABLE[key] ?? fallback` and returned `[Function Object]` for `"constructor"`, because an
    // inherited member is never nullish. The status here comes RAW off the wire.
    for (const status of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      const fact = runFacts(rowWith(status, at(1 * DAY)), FIXTURE_NOW)
      expect(fact.kind).toBe("unknown")
      expect(typeof fact.word).toBe("string")
      expect(fact.word).toBe(RUN_UNKNOWN)
    }
  })

  it("POSITIVE CONTROL — the three statuses that ARE mapped do resolve to a run", () => {
    // Without this, "everything unknown" would satisfy the block above, and the resolver could
    // be answering `unknown` to literally every input while looking perfectly safe.
    for (const status of ["completed", "failed", "cancelled"]) {
      expect(runFacts(rowWith(status, at(1 * DAY)), FIXTURE_NOW).kind).toBe("ran")
    }
  })
})

// ── 4 · the time is never fabricated (T-14) ─────────────────────────────────────────

describe("T-14 — an absent or unreadable instant is silence, never an invented time", () => {
  it.each([null, undefined])("a run with a %p timestamp still reports its OUTCOME", (stamp) => {
    const fact = runFacts(rowWith("completed", stamp), FIXTURE_NOW)
    expect(fact).toEqual<RunFact>({
      kind: "ran",
      outcome: "worked",
      when: null,
      word: RUN_WORKED,
    })
  })

  it("an UNPARSEABLE timestamp is treated the same way — no band, no throw", () => {
    const fact = runFacts(rowWith("failed", "not-a-date"), FIXTURE_NOW)
    expect(fact.kind).toBe("ran")
    expect((fact as Extract<RunFact, { kind: "ran" }>).when).toBeNull()
    expect(fact.word).toBe(RUN_FAILED)
  })

  it("⚠ and the word contains NO fabricated value — no NaN, no epoch, no `just now`", () => {
    for (const stamp of [null, undefined, "not-a-date", ""]) {
      const word = runFacts(rowWith("completed", stamp), FIXTURE_NOW).word
      expect(word).not.toMatch(/NaN/i)
      expect(word).not.toMatch(/Invalid/i)
      expect(word).not.toContain("1970")
      expect(word).not.toContain("just now")
      expect(word).not.toContain("ago")
    }
  })

  it("a row whose run is in the FUTURE reads as the first band, never as a negative duration", () => {
    // Real clock skew between a server and a browser produces this. `relativeChanged`'s bands
    // already decided what it means; this asserts the decision reaches here unchanged.
    const fact = runFacts(rowWith("completed", at(-5 * 60_000)), FIXTURE_NOW)
    expect(fact.word).toBe(`${RUN_WORKED} just now`)
    expect(fact.word).not.toMatch(/-\d/)
  })
})

// ── 5 · the bands are REUSED, not re-implemented (T-16) ─────────────────────────────

describe("T-16 — there is no second relative-time formatter", () => {
  it.each([
    30 * 60_000, // minutes
    5 * 60 * 60_000, // hours
    1 * DAY, // yesterday
    3 * DAY, // days
    7 * DAY, // last week
    21 * DAY, // weeks
    30 * DAY, // last month
    120 * DAY, // months
  ])("the band for %p ms ago is byte-identical to `relativeBand`'s", (ago) => {
    // Asserted against the shipped engine rather than against re-typed expected strings: if
    // this module ever grows its own bands, this reds even where the two happen to agree today.
    const stamp = at(ago)
    const fact = runFacts(rowWith("completed", stamp), FIXTURE_NOW)
    const band = relativeBand(stamp, FIXTURE_NOW)
    expect((fact as Extract<RunFact, { kind: "ran" }>).when).toBe(band)
    expect(fact.word).toBe(`${RUN_WORKED} ${band}`)
  })

  it("⚠ the module parses NO date and formats NO duration of its own", () => {
    // The shortcut this forbids is the obvious one: a private `d < DAY ? …` ladder beside the
    // nine bands that already ship. Swept over source, because `tsc` cannot see it.
    //
    // ⚠ SWEPT OVER CODE ONLY, AND THAT IS NOT A LOOPHOLE — IT IS THE 187-24 TRAP AVOIDED.
    // MEASURED: the raw needle red on a correct tree, because this module's own docblock says
    // *"never `new Date()`"* while explaining the rule. A fence that a file cannot document
    // itself against is a fence authors delete. Comments are stripped; the control below proves
    // the stripper eats prose and keeps query text, which is the shape `test_workflows_updated_
    // at.py`'s `_code_only()` uses in the backend for exactly this reason.
    const code = codeOnly(runFactsSource)
    expect(code).not.toContain("Date.parse")
    expect(code).not.toContain("new Date")
    // No band vocabulary is spelled here at all — `ago`, `yesterday` and the unit names live in
    // exactly one module, and it is not this one.
    for (const bandWord of ["yesterday", "last week", "last month", " ago"]) {
      expect(code).not.toContain(bandWord)
    }
    // The ONE clock reference the module may carry is the `now` default parameter, which is
    // `relativeChanged`'s own shipped signature (P-1). Asserted positively so it cannot be
    // removed by someone "tidying" this fence into a blanket ban.
    expect(code).toContain("now: number = Date.now()")
  })

  it("POSITIVE CONTROL — those needles really catch a planted formatter", () => {
    const planted = `const rel = (t: string) => { const d = Date.now() - Date.parse(t); return d < 86400000 ? "yesterday" : "2 days ago" }`
    const code = codeOnly(planted)
    expect(code).toContain("Date.parse")
    expect(code).toContain("yesterday")
    expect(code).toContain(" ago")
  })

  it("SCOPING CONTROL — the stripper eats PROSE and keeps CODE", () => {
    // Non-vacuity for the sweep above. Without it, `codeOnly` returning "" would make every
    // negative pass — the Phase-190 CR-01 shape, one layer down.
    expect(codeOnly(runFactsSource)).toContain("export function runFacts")
    expect(codeOnly(runFactsSource).length).toBeGreaterThan(400)
    expect(runFactsSource).toContain("new Date") // …it really IS in the prose,
    expect(codeOnly(runFactsSource)).not.toContain("new Date") // …and really is not in the code.
    const planted = `/** never new Date() */\n// and never Date.parse either\nexport const a = 1\n`
    expect(codeOnly(planted).trim()).toBe("export const a = 1")
  })

  it("the prefixed spelling is UNAFFECTED — `relativeChanged` still says `changed …`", () => {
    // The split moved the engine out; this proves the identity line's sentence is intact and
    // that the run truth does NOT carry that prefix. Two vocabularies, one engine.
    const stamp = at(2 * DAY)
    expect(relativeBand(stamp, FIXTURE_NOW)).toBe("2 days ago")
    expect(runFacts(rowWith("completed", stamp), FIXTURE_NOW).word).not.toContain("changed")
  })
})

// ── 6 · the vocabulary has ONE home (T-06) ──────────────────────────────────────────

describe("the words are imported, and no system spelling reaches the caller", () => {
  it("⚠ NO DATABASE SPELLING APPEARS IN ANY RETURNED WORD", () => {
    // The property, not three assertions about today's strings: `completed` / `cancelled` /
    // `active` are what the STATUS COLUMN says. They are an input to this module.
    for (const status of ["completed", "failed", "cancelled", "active", "nonsense", "", null, undefined]) {
      const word = runFacts(rowWith(status as string | null | undefined, at(DAY)), FIXTURE_NOW).word
      for (const systemWord of ["completed", "cancelled", "active", "cap_paused", "null", "undefined"]) {
        expect(word.toLowerCase()).not.toContain(systemWord)
      }
    }
  })

  it("every arm carries a NON-EMPTY word — colour is never the only carrier (D-01)", () => {
    const everyArm: RunFact[] = [
      runFacts(rowWith("completed", at(DAY)), FIXTURE_NOW),
      runFacts(rowWith("failed", at(DAY)), FIXTURE_NOW),
      runFacts(rowWith("cancelled", at(DAY)), FIXTURE_NOW),
      runFacts(rowWith(null, null), FIXTURE_NOW),
      runFacts(rowWith(undefined, undefined), FIXTURE_NOW),
      runFacts(rowWith("who-knows", null), FIXTURE_NOW),
    ]
    expect(everyArm).toHaveLength(6)
    for (const fact of everyArm) {
      expect(fact.word.trim().length).toBeGreaterThan(2)
    }
  })

  it("the module spells no word of its own — every string it returns is an import", () => {
    // The T-06 fence, swept over source: the five run words must not appear as literals here.
    for (const word of [RUN_WORKED, RUN_FAILED, RUN_STOPPED, RUN_NEVER, RUN_UNKNOWN]) {
      expect(runFactsSource).not.toContain(`"${word}"`)
    }
  })
})

// ── 7 · purity, swept over the module's own source ──────────────────────────────────

describe("the resolver is a pure leaf", () => {
  it("the source really loaded (non-vacuity)", () => {
    expect(runFactsSource.length).toBeGreaterThan(1000)
    expect(runFactsSource).toContain("export function runFacts")
  })

  /**
   * ⚠ MULTI-LINE AWARE, AND THAT MATTERS RATHER THAN BEING TIDINESS. `cardFace.test.ts`'s
   * version uses `[^\n]*?`, which cannot cross a line — MEASURED here on the first run, it read
   * `[ './libraryRow', './relativeChanged' ]` and SILENTLY DROPPED the braced five-name import
   * of the vocabulary module. An exact-set fence that cannot see a whole import form is a fence
   * with a blind spot exactly where a future author is most likely to add one.
   */
  const importedSpecifiers = (source: string): string[] =>
    Array.from(source.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)"/gm)).map((m) => m[1])

  it("imports NOTHING but its three library neighbours", () => {
    // An exact SET, the `cardFace.test.ts` idiom: a future import of a store, a component or
    // the API client is caught by this and by no needle anyone thought to write.
    expect(importedSpecifiers(runFactsSource).sort()).toEqual([
      "./libraryRow",
      "./libraryVocabulary",
      "./relativeChanged",
    ])
  })

  it.each(["react", "@/lib/api"])("imports no %s", (specifier) => {
    expect(importedSpecifiers(runFactsSource)).not.toContain(specifier)
  })

  it("POSITIVE CONTROL — the detector really catches a React import", () => {
    expect(importedSpecifiers(`import { useMemo } from "react"\n`)).toContain("react")
  })

  it("POSITIVE CONTROL — the detector really catches an api import", () => {
    expect(importedSpecifiers(`import { listWorkflowRuns } from "@/lib/api"\n`)).toContain("@/lib/api")
  })

  it("is a FUNCTION OF ITS ROW AND ITS INSTANT — two calls agree, and neither is shared", () => {
    const row = rowWith("completed", at(2 * DAY))
    expect(runFacts(row, FIXTURE_NOW)).toEqual(runFacts(row, FIXTURE_NOW))
    expect(runFacts(row, FIXTURE_NOW)).not.toBe(runFacts(row, FIXTURE_NOW))
  })

  it("reads ONLY the two run fields — nothing else on the row can change the answer", () => {
    const base = rowWith("completed", at(2 * DAY))
    const noisy = libraryRowOf({
      lastRunStatus: "completed",
      lastRunAt: at(2 * DAY),
      name: "",
      version: undefined,
      provenance: "draft",
      isMine: undefined,
      updatedAt: undefined,
      def: undefined,
    })
    expect(runFacts(noisy, FIXTURE_NOW)).toEqual(runFacts(base, FIXTURE_NOW))
  })
})
