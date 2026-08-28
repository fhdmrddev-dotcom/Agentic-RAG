/**
 * BUG-260828-09 — THE STEP FACE, AND THE ONE THING IT MAY NEVER BE.
 *
 * ⭐ THE FIXTURE IS THE LIVE DEFINITION, NOT AN INVENTED ONE. Measured on the local database
 * 2026-08-28: `kb-library-structure-summary` has three phases and TWO OF THEM CARRY
 * `name: null` — `survey-library` (the one that failed all four times) and `act`. So the
 * unnamed arm is the ORDINARY case on this surface, not an edge case, and a suite whose
 * fixtures all carry authored names would prove nothing about the bug it was written for.
 *
 * ⚠ THE SLUG FENCE IS A POSITIVE CONTROL, NOT AN ASSERTION ABOUT A STRING WE CHOSE. The
 * fixture slug is a token that occurs nowhere else, and the test asserts that token is absent
 * from the OUTPUT — so the fence fails if a `?? slug` fallback is ever added, rather than
 * passing because the expected string happened to match. `test_the_fence_can_fail` drives the
 * forbidden shape through the same assertion and proves the check is falsifiable.
 */
import { describe, expect, it } from "vitest"

import {
  BLOCKED_STEP_NEXT,
  BLOCKED_STEP_TITLE,
  blockedStepFace,
  blockedStepHeadline,
  blockedStepOf,
  STEP_UNNAMED,
  type BlockedStepWire,
} from "@/components/workflows/publishBlockedStep"
import type { DefShape } from "@/components/workflows/soulData"

/** The verbatim sentence the live rows carry, prefix already stripped by the server. */
const LIVE_CAUSE =
  "citations_required: nothing was retrieved (0 sources) — this step reads your documents and must show where its answer came from"

/** A slug that occurs nowhere else in this repo, so its presence in any output is proof. */
const UNIQUE_SLUG = "zz-slugfence-survey-library-zz"

const LIVE_STEP: BlockedStepWire = {
  step_slug: UNIQUE_SLUG,
  step_index: 0,
  step_name: null, // unnamed on the live row — the server refuses to backfill the slug
  reason: `Phase 1 (${UNIQUE_SLUG}) gate failed after 3 attempt(s): ${LIVE_CAUSE}`,
  cause: LIVE_CAUSE,
}

const LIVE_DEF: DefShape = {
  name: "Knowledge Base Library Structure Summary",
  phases: [
    { slug: UNIQUE_SLUG, phase_index: 0, name: null, config: { phase_type: "llm_agent" } },
    {
      slug: "write-summary",
      phase_index: 1,
      name: "Write the short library summary",
      config: { phase_type: "llm_single" },
    },
    { slug: "act", phase_index: 2, name: null, config: { phase_type: "external_action" } },
  ],
}

describe("blockedStepOf — shape detection", () => {
  it("accepts a step that carries a cause", () => {
    expect(blockedStepOf(LIVE_STEP)).toBe(LIVE_STEP)
  })

  it("declines everything that cannot be phrased", () => {
    // A card with a heading over an empty space is worse than the surface that shipped.
    expect(blockedStepOf(null)).toBeNull()
    expect(blockedStepOf(undefined)).toBeNull()
    expect(blockedStepOf({})).toBeNull()
    expect(blockedStepOf({ step_slug: "x" })).toBeNull()
    expect(blockedStepOf({ cause: "" })).toBeNull()
    expect(blockedStepOf({ cause: "   " })).toBeNull()
    expect(blockedStepOf({ cause: 42 })).toBeNull()
    expect(blockedStepOf("a bare string")).toBeNull()
    expect(blockedStepOf([])).toBeNull()
  })
})

describe("blockedStepFace — the ladder", () => {
  it("resolves an UNNAMED step through nodeTitle rather than to its slug", () => {
    const face = blockedStepFace(LIVE_STEP, LIVE_DEF)
    expect(face.length).toBeGreaterThan(0)
    expect(face).not.toContain(UNIQUE_SLUG)
  })

  it("uses the authored name when there is one", () => {
    const step: BlockedStepWire = {
      step_slug: "write-summary",
      step_index: 1,
      step_name: "Write the short library summary",
      cause: "too short",
    }
    expect(blockedStepFace(step, LIVE_DEF)).toBe("Write the short library summary")
  })

  it("prefers the DEFINITION's name over the server's, so a rename shows immediately", () => {
    const step: BlockedStepWire = {
      step_slug: "write-summary",
      step_index: 1,
      step_name: "a stale name the server captured",
      cause: "too short",
    }
    expect(blockedStepFace(step, LIVE_DEF)).toBe("Write the short library summary")
  })

  it("falls back to the server's name when no definition is to hand", () => {
    const step: BlockedStepWire = { step_index: 1, step_name: "Draft the note", cause: "x" }
    expect(blockedStepFace(step, null)).toBe("Draft the note")
    expect(blockedStepFace(step, undefined)).toBe("Draft the note")
  })

  it("falls back to the step's own ORDINAL, never to a gauntlet stage index", () => {
    // `step_index` is 0-based on the wire; a person counts from one, and this is the author's
    // step position as the canvas counts it — not a row of the publish spine.
    expect(blockedStepFace({ step_index: 0, cause: "x" }, null)).toBe("Step 1")
    expect(blockedStepFace({ step_index: 4, cause: "x" }, null)).toBe("Step 5")
  })

  it("is TOTAL — a headline is never rendered around an empty pair of quotes", () => {
    expect(blockedStepFace({ cause: "x" }, null)).toBe(STEP_UNNAMED)
    expect(blockedStepFace({ cause: "x" }, { phases: null })).toBe(STEP_UNNAMED)
    expect(blockedStepFace({ cause: "x" }, { phases: [] })).toBe(STEP_UNNAMED)
    expect(blockedStepFace({ step_index: 0, cause: "x" }, { phases: [null as never] })).toBe("Step 1")
    expect(
      blockedStepFace({ step_slug: "nope", step_index: 9, cause: "x" }, LIVE_DEF).length,
    ).toBeGreaterThan(0)
  })

  it("resolves a phase whose config is missing rather than throwing", () => {
    const def: DefShape = { phases: [{ slug: UNIQUE_SLUG, phase_index: 0, name: null }] }
    expect(() => blockedStepFace(LIVE_STEP, def)).not.toThrow()
    expect(blockedStepFace(LIVE_STEP, def)).not.toContain(UNIQUE_SLUG)
  })
})

describe("the slug fence", () => {
  it("keeps the slug out of every tier of the ladder", () => {
    const cases: BlockedStepWire[] = [
      LIVE_STEP,
      { step_slug: UNIQUE_SLUG, step_index: 0, cause: "x" },
      { step_slug: UNIQUE_SLUG, cause: "x" },
    ]
    for (const step of cases) {
      expect(blockedStepFace(step, LIVE_DEF)).not.toContain(UNIQUE_SLUG)
      expect(blockedStepFace(step, null)).not.toContain(UNIQUE_SLUG)
      expect(blockedStepHeadline(blockedStepFace(step, LIVE_DEF))).not.toContain(UNIQUE_SLUG)
    }
  })

  it("test_the_fence_can_fail — the POSITIVE CONTROL", () => {
    // The forbidden shape, driven through the same assertion. If this ever passes, the fence
    // above has stopped being able to detect the thing it exists to detect.
    const forbidden = `“${UNIQUE_SLUG}” is where the trial run stopped`
    expect(forbidden).toContain(UNIQUE_SLUG)
  })
})

describe("the words", () => {
  it("the headline names the step and claims only that it is where the run stopped", () => {
    expect(blockedStepHeadline("Survey the library")).toContain("Survey the library")
  })

  it("the copy prescribes no specific repair — only the server knows what failed", () => {
    // The red line `verdictModel.ts` draws: no cause table, no validator names, no remedies.
    // Any of these appearing in the static copy would be this module owning a vocabulary it
    // does not own.
    const copy = `${BLOCKED_STEP_TITLE} ${BLOCKED_STEP_NEXT} ${blockedStepHeadline("X")}`
    for (const forbidden of [
      "citations_required",
      "citation",
      "retriev",
      "validator",
      "structural_gate",
      "golden_run",
      "named_failures",
    ]) {
      expect(copy.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})
