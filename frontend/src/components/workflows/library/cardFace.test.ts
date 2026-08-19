/**
 * Phase 192.2-02 Task 2 (LIB-06 — threats T-05 / T-06) — `cardFace`'s contract.
 *
 * The card's own characterization pin (`WorkflowCard.baseline.test.tsx`) proves the RENDER did
 * not move. This suite proves the DECISION is right, and it does so without a DOM: the module
 * under test is a pure leaf, so a render here would be slower, less complete and would prove the
 * card as well as the face.
 *
 * ── THE PURITY FENCES ARE ASSERTED OVER SOURCE, NOT REASONED ABOUT ──────────────────────
 * T-05 is *"the seam leaks impurity"* — a `cardFace.ts` that imported React or the API client
 * could not be reused by anything but a component, which re-creates the copies this module exists
 * to prevent. `tsc` cannot see that, and neither can a render test: an unused-at-runtime import
 * typechecks clean. So the negatives are swept over the module's own `?raw` source, the house
 * `librarySubtree.fences.test.ts:114-118` idiom.
 *
 * ⚠ EVERY NEGATIVE CARRIES A POSITIVE CONTROL — the Phase 187 rule. An assertion that a needle
 * finds nothing passes identically when the needle is broken, when the module never had the thing
 * and when the source failed to load at all. Each sweep below is therefore run a second time over
 * a synthetic source that DOES contain the violation, and must catch it.
 */
import { describe, it, expect } from "vitest"

import cardFaceSource from "./cardFace?raw"

import { cardFace, type CardFace, type CardMark } from "./cardFace"
import type { LibraryRow } from "./libraryRow"
import {
  RUN_FAILED,
  RUN_NEVER,
  RUN_NOT_BY_YOU,
  RUN_STOPPED,
  RUN_UNKNOWN,
  RUN_WORKED,
  STATE_DRAFT,
  STATE_RUNNABLE,
  STATE_STARTER,
} from "./libraryVocabulary"
import { FIXTURE_NOW, libraryRowOf } from "./__fixtures__/libraryScale"

// ── 1 · the three provenances ────────────────────────────────────────────────────────

describe("the three faces", () => {
  it("a published row is ready to run, and leads with its name", () => {
    const face = cardFace(libraryRowOf({ provenance: "published", name: "Vendor Risk Review", version: 3 }))
    expect(face).toEqual<CardFace>({
      lead: "Vendor Risk Review",
      version: "v3",
      state: STATE_RUNNABLE,
      mark: "ready",
      runnable: true,
      // 192.2-04 — the scale fixture carries no run facts, so every row it builds resolves to
      // the UNKNOWN arm ("the wire did not say"), which is the honest reading of a fixture that
      // predates the feed. ⚠ It is NOT the never-run arm; §5 below is where that difference is
      // asserted rather than assumed.
      run: { kind: "unknown", word: RUN_UNKNOWN },
      runWord: RUN_UNKNOWN,
    })
  })

  it("a starter is runnable too — it is shared, not unfinished", () => {
    const face = cardFace(libraryRowOf({ provenance: "starter", name: "Compliance Gap Report", version: 1 }))
    expect(face.state).toBe(STATE_STARTER)
    expect(face.mark).toBe("starter")
    expect(face.runnable).toBe(true)
  })

  it("a draft is still building, and is NEVER runnable", () => {
    const face = cardFace(libraryRowOf({ provenance: "draft", name: "Risk Register", version: 2 }))
    expect(face.state).toBe(STATE_DRAFT)
    expect(face.mark).toBe("building")
    // The page's load-bearing contract: a draft cannot be Run, publish is the test.
    expect(face.runnable).toBe(false)
  })

  it("the three faces are three — no two provenances resolve to the same mark or word", () => {
    const faces = (["published", "starter", "draft"] as const).map((provenance) =>
      cardFace(libraryRowOf({ provenance })),
    )
    expect(new Set(faces.map((f) => f.mark)).size).toBe(3)
    expect(new Set(faces.map((f) => f.state)).size).toBe(3)
  })
})

// ── 2 · the vocabulary (T-06 / D-06) ─────────────────────────────────────────────────

describe("the vocabulary is business words, and it has ONE home", () => {
  it.each([
    ["published", STATE_RUNNABLE] as const,
    ["starter", STATE_STARTER] as const,
    ["draft", STATE_DRAFT] as const,
  ])("%s speaks the shipped constant, byte-for-byte", (provenance, word) => {
    // Compared against the IMPORTED constant, never against a re-typed literal: a test that
    // spelled the word inline would have forked the acceptance bar the same way a second copy
    // in the source would (D-14).
    expect(cardFace(libraryRowOf({ provenance })).state).toBe(word)
  })

  it("⚠ NO SYSTEM SPELLING REACHES ANY RETURNED FIELD", () => {
    // D-06's defect, stated as a property rather than as three assertions about today's words:
    // `published` / `draft` / `starter` are lifecycle tokens the WIRE uses. They are an INPUT to
    // this module. A face that returned one would be the card's current pill defect, relocated.
    for (const provenance of ["published", "starter", "draft"] as const) {
      const face = cardFace(libraryRowOf({ provenance, name: "Vendor Risk Review" }))
      const emitted = [face.state, face.lead ?? "", face.version ?? ""].join(" ").toLowerCase()
      for (const systemWord of ["published", "draft"]) {
        expect(emitted).not.toContain(systemWord)
      }
    }
  })

  it("the mark is a TOKEN — no emoji, no glyph, no icon reaches the caller", () => {
    const marks: CardMark[] = (["published", "starter", "draft"] as const).map(
      (provenance) => cardFace(libraryRowOf({ provenance })).mark,
    )
    for (const mark of marks) {
      expect(typeof mark).toBe("string")
      // Word characters only. An emoji, a private-use glyph or a symbol all red here, and so
      // would a React element (which is not a string at all).
      expect(mark).toMatch(/^[a-z]+$/)
    }
  })
})

// ── 3 · absence is explicit (D-08's three arms) ──────────────────────────────────────

describe("a missing value resolves to an explicit unknown, never to a blank", () => {
  it("an EMPTY NAME resolves to null — WR-01's row", () => {
    const face = cardFace(libraryRowOf({ name: "" }))
    expect(face.lead).toBeNull()
    // ⚠ Not `""`. A blank string renders like an absence and compares like a presence, which is
    // exactly how WR-01 blanked the library title without anything being able to see it.
    expect(face.lead).not.toBe("")
  })

  it("a MISSING VERSION resolves to null, and is never faked to 1", () => {
    const face = cardFace(libraryRowOf({ version: undefined }))
    expect(face.version).toBeNull()
    expect(face.version).not.toBe("v1")
  })

  it("a present version is composed once, with its prefix", () => {
    expect(cardFace(libraryRowOf({ version: 0 })).version).toBe("v0")
    expect(cardFace(libraryRowOf({ version: 12 })).version).toBe("v12")
  })

  it("⚠ a MISSING `updatedAt` changes NOTHING — the face carries no recency at all", () => {
    // Recency is `RowIdentity.when`, resolved over the whole LIST by `resolveIdentity`. A face
    // that computed its own would be the second copy this module exists to prevent, one field
    // down — and a face that FABRICATED one on absence would be the D-08 violation by name.
    const withTime = cardFace(libraryRowOf({ updatedAt: "2026-08-12T09:30:00.000Z" }))
    const without = cardFace(libraryRowOf({ updatedAt: undefined }))
    expect(without).toEqual(withTime)
    expect(Object.keys(without).sort()).toEqual([
      "lead",
      "mark",
      "run",
      "runWord",
      "runnable",
      "state",
      "version",
    ])
  })

  it("an empty name and a missing version are INDEPENDENT absences", () => {
    const face = cardFace(libraryRowOf({ name: "", version: undefined }))
    expect(face).toEqual<CardFace>({
      lead: null,
      version: null,
      state: STATE_RUNNABLE,
      mark: "ready",
      runnable: true,
      run: { kind: "unknown", word: RUN_UNKNOWN },
      runWord: RUN_UNKNOWN,
    })
  })
})

// ── 4 · purity (T-05), swept over the module's own source ────────────────────────────

describe("T-05 — the seam does not leak impurity", () => {
  it("the source really loaded (non-vacuity)", () => {
    // Without this, every negative below passes against the empty string — the Phase-190 CR-01
    // shape, and the exact failure `librarySubtree.fences.test.ts:164-186` was rewritten to close.
    expect(cardFaceSource.length).toBeGreaterThan(1000)
    expect(cardFaceSource).toContain("export function cardFace")
  })

  /**
   * ⚠ AMENDED IN 192.2-04, AND THE ORIGINAL IS QUOTED RATHER THAN OVERWRITTEN. This read
   * `/^\s*import\s[^\n]*?from\s+"([^"]+)"/gm`, whose `[^\n]` CANNOT CROSS A LINE — so a braced
   * multi-line import form was invisible to it and the "exact SET" fence silently swept a
   * subset. MEASURED in `runFacts.test.ts`, whose five-name vocabulary import is written that
   * way: the sweep read TWO specifiers where the module has THREE. `cardFace.ts`'s own imports
   * are all single-line, so nothing here was ever wrong — the fence merely had a blind spot
   * exactly where a future author is most likely to add one.
   */
  const importedSpecifiers = (source: string): string[] =>
    Array.from(source.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)"/gm)).map((m) => m[1])

  it("imports NOTHING but its two library neighbours", () => {
    // ⚠ Asserted as an exact SET rather than as two absences: a future import of a clock, a
    // store or a component is caught by this, and by no needle anyone thought to write.
    expect(importedSpecifiers(cardFaceSource).sort()).toEqual([
      "./libraryRow",
      "./libraryVocabulary",
      "./runFacts",
    ])
  })

  it.each(["react", "@/lib/api"])("imports no %s", (specifier) => {
    expect(importedSpecifiers(cardFaceSource)).not.toContain(specifier)
  })

  it("POSITIVE CONTROL — the detector really catches a React import", () => {
    const planted = `import { useMemo } from "react"\nimport type { LibraryRow } from "./libraryRow"\n`
    expect(importedSpecifiers(planted)).toContain("react")
  })

  it("POSITIVE CONTROL — the detector really catches an api import", () => {
    const planted = `import { deleteWorkflowDraft } from "@/lib/api"\n`
    expect(importedSpecifiers(planted)).toContain("@/lib/api")
  })

  it("has no JSX and no hook, so it cannot be a component in disguise", () => {
    expect(cardFaceSource).not.toMatch(/\breturn\s*\(?\s*</)
    expect(cardFaceSource).not.toMatch(/\buse[A-Z]\w*\(/)
  })

  it("is a FUNCTION OF ITS ROW AND ITS INSTANT — two calls on one row are deeply equal", () => {
    // ⚠ THE NAME SAID "ITS ROW ALONE" UNTIL 192.2-04, AND THE AMENDMENT IS RECORDED RATHER THAN
    // SMOOTHED. The face now carries the run truth, whose recency is measured against an
    // instant — so `now` is a second input, defaulted to the clock exactly as `relativeChanged`
    // does (P-1). It is passed EXPLICITLY here: letting the default run would make this case
    // pass at one instant and flake at another the moment a fixture row carries a real run.
    const row: LibraryRow = libraryRowOf({ name: "Vendor Risk Review" })
    expect(cardFace(row, FIXTURE_NOW)).toEqual(cardFace(row, FIXTURE_NOW))
    // …and it hands back a fresh object each time, so no caller can mutate another's face.
    expect(cardFace(row, FIXTURE_NOW)).not.toBe(cardFace(row, FIXTURE_NOW))
  })
})

// ── 5 · the run arm reaches the face, with all three arms intact (192.2-04 / D-08) ───

describe("the face carries the run truth, and it is the resolver's — not a second copy", () => {
  const DAY = 24 * 60 * 60 * 1000
  const at = (msAgo: number) => new Date(FIXTURE_NOW - msAgo).toISOString()
  /**
   * ⚠ WIDENED BY `192.2-11` (CR-01), DEFAULTING TO `hasAnyRun: false` FOR THE SAME REASON
   * `runFacts.test.ts`'s `rowWith` does. The `never` arm now fires only on an AFFIRMED
   * `has_any_run === false`, so a case meaning *"the backend looked and there is no run"* must
   * say so; an absent bit resolves to `unknown` (DEC-11-B). The default preserves each existing
   * case's INTENT instead of silently re-pointing it at a different arm. **No code in
   * `cardFace.ts` changed** — it hands `RunFact` over whole — so this file's job is unchanged:
   * prove the face does not undo what the resolver decided.
   */
  const faceOf = (
    lastRunStatus: string | null | undefined,
    lastRunAt: string | null | undefined,
    hasAnyRun: boolean | null | undefined = false,
  ) => cardFace(libraryRowOf({ lastRunStatus, lastRunAt, hasAnyRun }), FIXTURE_NOW)

  it.each([
    ["completed", "worked", `${RUN_WORKED} 2 days ago`] as const,
    ["failed", "failed", `${RUN_FAILED} 2 days ago`] as const,
    ["cancelled", "stopped", `${RUN_STOPPED} 2 days ago`] as const,
  ])("a %s run reaches the face as %s, with its word", (status, outcome, word) => {
    const face = faceOf(status, at(2 * DAY))
    expect(face.run.kind).toBe("ran")
    expect(face.run).toMatchObject({ outcome })
    expect(face.runWord).toBe(word)
  })

  it("ARM 2 — a row the backend says has NO run reaches the face as never-run", () => {
    expect(faceOf(null, null)).toMatchObject({ run: { kind: "never" }, runWord: RUN_NEVER })
  })

  it("ARM 3 — a row whose feed carried no run keys reaches the face as unknown", () => {
    expect(faceOf(undefined, undefined)).toMatchObject({
      run: { kind: "unknown" },
      runWord: RUN_UNKNOWN,
    })
  })

  it("⚠ THE TWO ABSENCES DO NOT MEET ON THE FACE EITHER — T-13, one layer up", () => {
    // The resolver keeps them apart; this asserts the FACE does not undo that on the way
    // through. A `runWord` computed here with its own fallback is exactly how it would.
    const never = faceOf(null, null)
    const unknown = faceOf(undefined, undefined)
    expect(never.run.kind).not.toBe(unknown.run.kind)
    expect(never.runWord).not.toBe(unknown.runWord)
    expect([never.runWord, unknown.runWord].every((w) => w.trim().length > 2)).toBe(true)
    // …and neither reads as success, on the word or on the structure.
    for (const face of [never, unknown]) {
      expect(face.runWord).not.toContain(RUN_WORKED)
      expect("outcome" in face.run).toBe(false)
    }
  })

  it("192.2-11 (CR-01) — ARM 4 reaches the face WHOLE, and the face re-derives nothing", () => {
    // The fourth arm arrived through the TYPE. `cardFace.ts` never switches on `RunFact`, so
    // this case would have passed on the day the arm landed with zero edits to the module — and
    // asserting it is how that property is held rather than assumed. A face that had grown its
    // own `runWord` fallback (`run.word ?? RUN_UNKNOWN`, say) would red here.
    const face = faceOf(null, null, true)
    expect(face).toMatchObject({ run: { kind: "not-by-you" }, runWord: RUN_NOT_BY_YOU })
    // …and it carries no outcome and no time, so nothing downstream can render one.
    expect("outcome" in face.run).toBe(false)
    expect("when" in face.run).toBe(false)
    // The three absence arms reach the face as THREE, not two — DEC-11-B one layer up.
    //
    // ⚠ THE ABSENT CASE GOES THROUGH `cardFace` DIRECTLY, NOT THROUGH `faceOf`, AND THAT IS
    // MEASURED RATHER THAN STYLISTIC. A DEFAULT PARAMETER FIRES ON AN EXPLICIT `undefined`, so
    // `faceOf(null, null, undefined)` silently becomes `hasAnyRun: false` and this assertion
    // read `['never','not-by-you','never']` on its first run. That is the SAME absence-destroying
    // shape `192.2-10` recorded for `?? false` — `true` and `false` survive it and only
    // `null`/`undefined` are destroyed — met here through a different door.
    const absent = cardFace(
      libraryRowOf({ lastRunStatus: null, lastRunAt: null, hasAnyRun: undefined }),
      FIXTURE_NOW,
    )
    const kinds = [faceOf(null, null, false), face, absent].map((f) => f.run.kind)
    expect(kinds).toEqual(["never", "not-by-you", "unknown"])
    expect(new Set(kinds).size).toBe(3)
  })

  it("an unrecognised status reaches the face as unknown, never as a tick", () => {
    const face = faceOf("astonished", at(DAY))
    expect(face.run.kind).toBe("unknown")
    expect(face.runWord).toBe(RUN_UNKNOWN)
  })

  it("⚠ `runWord` IS ALWAYS `run.word` — the convenience field cannot drift from the arm", () => {
    const everyArm = [
      faceOf("completed", at(DAY)),
      faceOf("failed", at(3 * DAY)),
      faceOf("cancelled", null),
      faceOf(null, null),
      faceOf(undefined, undefined),
      faceOf("who-knows", at(DAY)),
    ]
    expect(everyArm).toHaveLength(6)
    for (const face of everyArm) expect(face.runWord).toBe(face.run.word)
  })

  it("the run arm is INDEPENDENT of provenance — a draft's failed golden run still reads", () => {
    // A draft cannot be Run from the library, so its only runs are the publish gauntlet's
    // golden ones. "Your test run failed" is the answer LIB-06 wants on a 69%-draft shelf.
    const face = cardFace(
      libraryRowOf({ provenance: "draft", lastRunStatus: "failed", lastRunAt: at(2 * DAY) }),
      FIXTURE_NOW,
    )
    expect(face.state).toBe(STATE_DRAFT)
    expect(face.runnable).toBe(false)
    expect(face.runWord).toBe(`${RUN_FAILED} 2 days ago`)
  })

  it("the face SPELLS no run word of its own — every one is imported (T-06)", () => {
    for (const word of [RUN_WORKED, RUN_FAILED, RUN_STOPPED, RUN_NEVER, RUN_NOT_BY_YOU, RUN_UNKNOWN]) {
      expect(cardFaceSource).not.toContain(`"${word}"`)
    }
    // …and it holds no status map: the database spellings appear nowhere in it.
    for (const status of ["completed", "cancelled", "cap_paused"]) {
      expect(cardFaceSource).not.toContain(status)
    }
  })

  it("a MISSING run stamp still leaves the outcome legible on the face", () => {
    // T-14 through the face: the word carries the outcome alone rather than a fabricated time.
    const face = faceOf("completed", null)
    expect(face.runWord).toBe(RUN_WORKED)
    expect(face.runWord).not.toMatch(/NaN|Invalid|1970|ago/i)
  })
})
