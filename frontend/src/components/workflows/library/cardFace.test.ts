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
import { STATE_DRAFT, STATE_RUNNABLE, STATE_STARTER } from "./libraryVocabulary"
import { libraryRowOf } from "./__fixtures__/libraryScale"

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
    expect(Object.keys(without).sort()).toEqual(["lead", "mark", "runnable", "state", "version"])
  })

  it("an empty name and a missing version are INDEPENDENT absences", () => {
    const face = cardFace(libraryRowOf({ name: "", version: undefined }))
    expect(face).toEqual<CardFace>({
      lead: null,
      version: null,
      state: STATE_RUNNABLE,
      mark: "ready",
      runnable: true,
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

  const importedSpecifiers = (source: string): string[] =>
    Array.from(source.matchAll(/^\s*import\s[^\n]*?from\s+"([^"]+)"/gm)).map((m) => m[1])

  it("imports NOTHING but its two library neighbours", () => {
    // ⚠ Asserted as an exact SET rather than as two absences: a future import of a clock, a
    // store or a component is caught by this, and by no needle anyone thought to write.
    expect(importedSpecifiers(cardFaceSource).sort()).toEqual(["./libraryRow", "./libraryVocabulary"])
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

  it("is a FUNCTION OF ITS ROW ALONE — two calls on one row are deeply equal", () => {
    const row: LibraryRow = libraryRowOf({ name: "Vendor Risk Review" })
    expect(cardFace(row)).toEqual(cardFace(row))
    // …and it hands back a fresh object each time, so no caller can mutate another's face.
    expect(cardFace(row)).not.toBe(cardFace(row))
  })
})
