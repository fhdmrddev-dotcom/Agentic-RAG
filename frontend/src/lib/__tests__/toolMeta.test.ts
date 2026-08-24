/**
 * Phase 174 / STATE-03 — unit tests for outerBannerLabel's pre-answer honesty.
 *
 * Wave-0 gap (RESEARCH Open Q6): there was NO dedicated toolMeta test locking the
 * D-14 byte-identical default. This file is the guard.
 *
 * Two load-bearing invariants:
 *  1. D-14 byte-identical: the pre-tools/pre-planning default MUST stay
 *     "Setting up agent…" (Deep) / "Starting workflow…" (harness) — a reasoning
 *     model streaming reasoning is the ONLY new copy path.
 *  2. STATE-03: when reasoningActive is true (derived from the already-stamped
 *     cross-provider message.reasoningContent), the pre-answer label reads
 *     "Reasoning…" instead of the dead "Setting up agent…".
 *
 * Pure-lib test — imports the function directly, no React (mirrors dedupMessages.test.ts).
 * Written against the extended 5-arg signature: the reasoningActive="Reasoning…" row
 * is RED until Task 2 adds the param + branch. Do NOT weaken the byte-identical
 * assertions to make RED pass — they ARE the D-14 guard.
 */
import { describe, it, expect } from "vitest"
import { harnessBannerProgress, outerBannerLabel } from "@/lib/toolMeta"
import type { Phase, ToolCall } from "@/types"

describe("outerBannerLabel — STATE-03 pre-answer honesty + D-14 guard", () => {
  it("D-14 byte-identical: the Deep pre-tools default stays 'Setting up agent…'", () => {
    // outerBannerLabel(activeTool, hasAnyTools, isPlanning, isHarness, reasoningActive)
    expect(outerBannerLabel(null, false, false, false, false)).toBe("Setting up agent…")
  })

  it("D-14 byte-identical: the harness pre-tools path stays 'Starting workflow…'", () => {
    expect(outerBannerLabel(null, false, false, true, false)).toBe("Starting workflow…")
  })

  it("STATE-03: reasoningActive=true in the pre-tools window reads 'Reasoning…'", () => {
    expect(outerBannerLabel(null, false, false, false, true)).toBe("Reasoning…")
  })

  it("STATE-03: reasoningActive does NOT override the isPlanning arm — stays 'Thinking…'", () => {
    expect(outerBannerLabel(null, false, true, false, true)).toBe("Thinking…")
    // and the plain planning row is unchanged regardless of reasoningActive
    expect(outerBannerLabel(null, false, true, false, false)).toBe("Thinking…")
  })

  it("STATE-03: reasoningActive does NOT leak into the tool arm (hasAnyTools=true skips it)", () => {
    const searchTool = { name: "search_documents" } as ToolCall
    // Even with reasoningActive=true, once a tool exists the render hands off to the
    // tool branch (Pitfall 1: this call site always passes hasAnyTools=false in prod,
    // so a tool arm is never reached WITH reasoningActive — this proves the scoping).
    expect(outerBannerLabel(searchTool, true, false, false, true)).toBe("Searching knowledge base…")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 194 Plan 07 (RUN-01 / BUG-260815-04 / D-18 / V-07 / F-9)
//
// ⚠ EVERYTHING BELOW IS ADDITIVE. Not one assertion above was edited or moved —
// in particular the byte pin at the "harness pre-tools path" case (`:31`), which
// is the nine-phase-old D-14 guard and is the fence F-9 drives RED. If a new
// parameter ever forces THAT assertion to change, the parameter is not additive
// and must be redesigned rather than the pin relaxed.
//
// ⚠ THE TWO IMPORTS AT THE TOP ARE WIDENED IN PLACE, NOT ADDED ON NEW LINES, and
// that is a deliberate trade rather than an oversight. Adding lines above `:31`
// would have pushed the pin to `:35` — and that address is cited by
// `194-CONTEXT.md`, `194-PATTERNS.md`, `194-RESEARCH.md` and `194-07-PLAN.md`
// (CONTEXT already cites a stale `toolMeta.test.ts:30`, which is what happens
// when a pointer is allowed to rot: nothing in this repository typechecks prose).
// The pin's ADDRESS is worth more than a zero-deletion diff. The cost is two `-`
// lines in `git diff`, both imports, neither an assertion.
//
// The defect this closes is a MECHANISM, not copy: `hasAnyTools` is
// `tool_calls.length > 0` and a harness run writes NO `tool_calls`, so the
// pre-tools branch held from kickoff to terminal. `"Starting workflow…"` is the
// PRE-PHASE-1 value — correct before phase 1, stale for the other 99% of a run.
// ─────────────────────────────────────────────────────────────────────────────

/** A phase row in the shape `phasesByThread` carries (StreamsProvider demux + reconcile floor). */
function phase(overrides: Partial<Phase> & { phaseIndex: number }): Phase {
  return {
    slug: `phase-${overrides.phaseIndex}`,
    phaseType: "unknown",
    status: "pending",
    subAgents: [],
    pendingAsk: null,
    ...overrides,
  }
}

describe("harnessBannerProgress — the derivation, over the shipped Phase[] slice", () => {
  it("an empty slice carries no progress at all (pre-kickoff / a Deep thread)", () => {
    expect(harnessBannerProgress([])).toBeNull()
  })

  it("counts only `done` toward the done tally — `skipped`/`failed`/`cancelled` are NOT done", () => {
    const p = harnessBannerProgress([
      phase({ phaseIndex: 0, status: "done" }),
      phase({ phaseIndex: 1, status: "skipped" }),
      phase({ phaseIndex: 2, status: "failed" }),
      phase({ phaseIndex: 3, status: "cancelled" }),
    ])
    expect(p).toEqual({ phasesDone: 1, runningPhase: null })
  })

  it("reports the running phase as a 1-BASED ordinal off the server's phaseIndex", () => {
    const p = harnessBannerProgress([
      phase({ phaseIndex: 0, status: "done" }),
      phase({ phaseIndex: 1, status: "running" }),
      phase({ phaseIndex: 2, status: "pending" }),
    ])
    expect(p).toEqual({ phasesDone: 1, runningPhase: 2 })
  })

  it("treats `retrying` as running — a retry is the same phase still working", () => {
    const p = harnessBannerProgress([phase({ phaseIndex: 0, status: "retrying" })])
    expect(p).toEqual({ phasesDone: 0, runningPhase: 1 })
  })

  it("falls back to the array position when phaseIndex is not a usable ordinal", () => {
    // Defensive: phaseIndex is server-supplied. A negative/NaN value must never
    // produce "Working on phase 0…" or "Working on phase NaN…".
    const p = harnessBannerProgress([
      phase({ phaseIndex: 0, status: "done" }),
      phase({ phaseIndex: -1, status: "running" }),
    ])
    expect(p).toEqual({ phasesDone: 1, runningPhase: 2 })
  })
})

describe("outerBannerLabel — the harness banner ADVANCES (BUG-260815-04 / V-07)", () => {
  it("V-07 (a) BEFORE PHASE 1: harness + no progress still reads exactly 'Starting workflow…'", () => {
    // The additive default — every shipped 5-arg caller lands here.
    expect(outerBannerLabel(null, false, false, true, false)).toBe("Starting workflow…")
    // …and an EXPLICIT null progress is the same value, byte for byte.
    expect(outerBannerLabel(null, false, false, true, false, null)).toBe("Starting workflow…")
  })

  it("V-07 (a) BEFORE PHASE 1: phase 1 running with nothing finished is still 'Starting workflow…'", () => {
    // A slice that exists but has not advanced past phase 1 is genuinely still
    // "starting" — the pinned string degrades to the shipped truth (T-194-07-01).
    expect(
      outerBannerLabel(null, false, false, true, false, { phasesDone: 0, runningPhase: 1 }),
    ).toBe("Starting workflow…")
    expect(
      outerBannerLabel(null, false, false, true, false, { phasesDone: 0, runningPhase: null }),
    ).toBe("Starting workflow…")
  })

  it("V-07 (b) AFTER A PHASE COMPLETES: the label is no longer the pinned string and carries the progress", () => {
    const label = outerBannerLabel(null, false, false, true, false, {
      phasesDone: 1,
      runningPhase: 2,
    })
    expect(label).not.toBe("Starting workflow…")
    expect(label).toBe("Working on phase 2…")
  })

  it("V-07 (b) a later phase running with nothing marked done still advances (a skipped phase 1)", () => {
    expect(
      outerBannerLabel(null, false, false, true, false, { phasesDone: 0, runningPhase: 3 }),
    ).toBe("Working on phase 3…")
  })

  it("V-07 (b) BETWEEN phases (nothing running yet) reports what genuinely finished", () => {
    expect(
      outerBannerLabel(null, false, false, true, false, { phasesDone: 1, runningPhase: null }),
    ).toBe("1 phase done…")
    expect(
      outerBannerLabel(null, false, false, true, false, { phasesDone: 4, runningPhase: null }),
    ).toBe("4 phases done…")
  })

  it("the advancing copy claims NO total, NO deliverable and NO completion of the run (T-194-07-01)", () => {
    const labels = [
      outerBannerLabel(null, false, false, true, false, { phasesDone: 1, runningPhase: 2 }),
      outerBannerLabel(null, false, false, true, false, { phasesDone: 2, runningPhase: null }),
    ]
    for (const l of labels) {
      expect(l).not.toMatch(/\bof\s+\d+/) // no "phase 2 of 5" — the slice cannot prove a total
      expect(l).not.toMatch(/complete|finished|deliverable|ready|saved|output/i)
    }
  })

  it("the advancing copy carries NO workflow-author content — ordinals only (T-194-07-02)", () => {
    // The slug reaches this function nowhere: the progress object carries two
    // numbers. A regression that started interpolating `phase.slug` would have
    // to change the interface, not just the sentence.
    const label = outerBannerLabel(null, false, false, true, false, {
      phasesDone: 1,
      runningPhase: 2,
    })
    expect(label).toMatch(/^Working on phase \d+…$/)
  })

  it("D-14 byte-identical: a DEEP run ignores progress entirely and stays 'Setting up agent…'", () => {
    expect(outerBannerLabel(null, false, false, false, false)).toBe("Setting up agent…")
    // Even if a caller wrongly supplied progress on a Deep thread, the Deep copy
    // is unmoved — isHarness is the only gate on the new arm.
    expect(
      outerBannerLabel(null, false, false, false, false, { phasesDone: 3, runningPhase: 4 }),
    ).toBe("Setting up agent…")
  })

  it("reasoning still takes precedence over the harness arm (ordering unchanged)", () => {
    expect(
      outerBannerLabel(null, false, false, true, true, { phasesDone: 2, runningPhase: 3 }),
    ).toBe("Reasoning…")
  })

  it("progress never leaks past the pre-tools branch: isPlanning and the tool arm win", () => {
    expect(
      outerBannerLabel(null, false, true, true, false, { phasesDone: 2, runningPhase: 3 }),
    ).toBe("Thinking…")
    const searchTool = { name: "search_documents" } as ToolCall
    expect(
      outerBannerLabel(searchTool, true, false, true, false, { phasesDone: 2, runningPhase: 3 }),
    ).toBe("Searching knowledge base…")
  })
})
