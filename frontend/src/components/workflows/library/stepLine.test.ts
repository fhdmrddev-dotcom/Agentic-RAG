/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-01 / D-03 / D-04) — `resolveStepLine`, the card's step
 * line decided as data.
 *
 * ⚠ EXACT MATCHES ONLY. Chip words are compared to `PHASE_TYPE_SENTENCES` values IMPORTED from
 * their one home, never re-typed here, and the frame words to the `libraryVocabulary.ts`
 * entries. Every negative carries a POSITIVE CONTROL that plants the needle and proves the
 * detector finds it (the Phase 187 rule).
 */
import { describe, it, expect } from "vitest"

import stepLineSource from "./stepLine?raw"
import chipLineSource from "./StepChipLine?raw"

import { resolveStepLine, STEP_LINE_VISIBLE, type StepLine } from "./stepLine"
import {
  STEP_LINE_JOINER,
  STEP_LINE_LABEL,
  STEP_LINE_LESS,
  STEP_LINE_UNTYPED,
  stepLineMore,
  stepLineMoreLabel,
} from "./libraryVocabulary"
import { PHASE_TYPE_LABELS, PHASE_TYPE_SENTENCES } from "../phaseVocabulary"
import type { DefShape } from "../soulData"

const S = PHASE_TYPE_SENTENCES

/** The `WorkflowCard.test.tsx` `DEF` shape: two steps, agent then deliverable. */
const TWO_STEPS: DefShape = {
  name: "Vendor review",
  phases: [
    { slug: "research", phase_index: 0, name: "Research", config: { phase_type: "llm_agent" } },
    { slug: "write", phase_index: 1, name: "Write", config: { phase_type: "llm_emit" } },
  ],
}

/** Seven steps, given out of order. `phase_index` decides run order. */
const SEVEN_SHUFFLED: DefShape = {
  phases: [
    { slug: "e", phase_index: 4, config: { phase_type: "llm_human_input" } },
    { slug: "a", phase_index: 0, config: { phase_type: "programmatic" } },
    { slug: "g", phase_index: 6, config: { phase_type: "external_action" } },
    { slug: "c", phase_index: 2, config: { phase_type: "llm_agent" } },
    { slug: "b", phase_index: 1, config: { phase_type: "llm_single" } },
    { slug: "f", phase_index: 5, config: { phase_type: "llm_emit" } },
    { slug: "d", phase_index: 3, config: { phase_type: "llm_batch_agents" } },
  ],
}

const wordsOf = (line: StepLine | null) => (line ? line.chips.map((c) => c.words) : null)

describe("resolveStepLine — no step, no line (D-01)", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["phases: null", { phases: null }],
    ["phases: a string", { phases: "x" } as unknown as DefShape],
    ["phases: []", { phases: [] }],
    ["phases holding only non-objects", { phases: [null, 3, "x"] } as unknown as DefShape],
  ])("%s → null", (_label, def) => {
    expect(resolveStepLine(def as DefShape | null | undefined)).toBeNull()
  })
})

describe("resolveStepLine — the words are the type sentence (D-04)", () => {
  it("a two-step definition reads its two type sentences, all shown, nothing more", () => {
    expect(resolveStepLine(TWO_STEPS)).toEqual({
      chips: [
        { type: "llm_agent", words: S.llm_agent },
        { type: "llm_emit", words: S.llm_emit },
      ],
      shown: [
        { type: "llm_agent", words: S.llm_agent },
        { type: "llm_emit", words: S.llm_emit },
      ],
      more: 0,
    })
    // …and those sentences are the shipped words, not an empty table read twice.
    expect(S.llm_agent).toBe("Work out how to do it")
    expect(S.llm_emit).toBe("Produce the deliverable")
  })

  it("never the author's name, never the slug, never a technical label", () => {
    const named: DefShape = {
      phases: [
        {
          slug: "gather",
          phase_index: 0,
          name: "Gather every vendor contract from the shared drive",
          config: { phase_type: "llm_agent" },
        },
      ],
    }
    const line = resolveStepLine(named)
    expect(wordsOf(line)).toEqual([S.llm_agent])
    const forbidden = [
      "Gather every vendor contract from the shared drive",
      "gather",
      ...Object.values(PHASE_TYPE_LABELS),
    ]
    const leaks = (words: string[]) => words.filter((w) => forbidden.includes(w))
    expect(leaks(wordsOf(line) ?? [])).toEqual([])
    // POSITIVE CONTROL — the detector finds each needle when it IS planted.
    expect(leaks(["gather"])).toEqual(["gather"])
    expect(leaks([PHASE_TYPE_LABELS.llm_agent])).toEqual([PHASE_TYPE_LABELS.llm_agent])
    expect(leaks(["Gather every vendor contract from the shared drive"])).toHaveLength(1)
  })

  it("no chip ever reads a known type id or a technical label, across all seven types", () => {
    const line = resolveStepLine(SEVEN_SHUFFLED)
    const words = wordsOf(line) ?? []
    expect(words).toHaveLength(7)
    const ids = Object.keys(S)
    const labels = Object.values(PHASE_TYPE_LABELS)
    expect(words.filter((w) => ids.includes(w) || labels.includes(w))).toEqual([])
    // POSITIVE CONTROL
    expect(["llm_agent"].filter((w) => ids.includes(w))).toEqual(["llm_agent"])
  })

  it("an unknown type echoes its raw string — including a prototype key (T-290-07)", () => {
    const def: DefShape = {
      phases: [
        { phase_index: 0, config: { phase_type: "constructor" } },
        { phase_index: 1, config: { phase_type: "future_type" } },
      ],
    }
    expect(resolveStepLine(def)?.chips).toEqual([
      { type: "constructor", words: "constructor" },
      { type: "future_type", words: "future_type" },
    ])
  })

  it("a step with no config, or no phase_type, reads the untyped floor — never an empty chip", () => {
    const def: DefShape = {
      phases: [
        { phase_index: 0 },
        { phase_index: 1, config: {} },
        { phase_index: 2, config: { phase_type: 7 as unknown as string } },
      ],
    }
    expect(resolveStepLine(def)?.chips).toEqual([
      { type: "", words: STEP_LINE_UNTYPED },
      { type: "", words: STEP_LINE_UNTYPED },
      { type: "", words: STEP_LINE_UNTYPED },
    ])
  })

  it("a non-object entry is skipped, and the rest still read", () => {
    const def = {
      phases: [null, "x", { phase_index: 0, config: { phase_type: "llm_single" } }, 4],
    } as unknown as DefShape
    expect(wordsOf(resolveStepLine(def))).toEqual([S.llm_single])
  })
})

describe("resolveStepLine — run order and the first three (D-03)", () => {
  it("sorts by phase_index, shows the first three, and counts the rest", () => {
    const line = resolveStepLine(SEVEN_SHUFFLED)
    expect(wordsOf(line)).toEqual([
      S.programmatic,
      S.llm_single,
      S.llm_agent,
      S.llm_batch_agents,
      S.llm_human_input,
      S.llm_emit,
      S.external_action,
    ])
    expect(line?.shown.map((c) => c.words)).toEqual([S.programmatic, S.llm_single, S.llm_agent])
    expect(line?.more).toBe(4)
    expect(STEP_LINE_VISIBLE).toBe(3)
  })

  it("equal phase_index keeps array order (stable sort)", () => {
    const def: DefShape = {
      phases: [
        { phase_index: 1, config: { phase_type: "llm_emit" } },
        { phase_index: 0, config: { phase_type: "llm_single" } },
        { phase_index: 0, config: { phase_type: "llm_agent" } },
      ],
    }
    expect(wordsOf(resolveStepLine(def))).toEqual([S.llm_single, S.llm_agent, S.llm_emit])
  })

  it("exactly three steps show all three and nothing more", () => {
    const def: DefShape = {
      phases: [
        { phase_index: 0, config: { phase_type: "programmatic" } },
        { phase_index: 1, config: { phase_type: "llm_single" } },
        { phase_index: 2, config: { phase_type: "llm_emit" } },
      ],
    }
    const line = resolveStepLine(def)
    expect(line?.shown).toHaveLength(3)
    expect(line?.more).toBe(0)
  })
})

describe("the frame words (libraryVocabulary.ts entries)", () => {
  it("say exactly what the UI-SPEC locks", () => {
    expect(STEP_LINE_LABEL).toBe("Steps, in run order")
    expect(STEP_LINE_JOINER).toBe("→")
    expect(stepLineMore(4)).toBe("+4 more")
    // 290 WR-05: the name starts with the visible text (WCAG 2.5.3 Label in Name).
    expect(stepLineMoreLabel(1)).toBe("+1 more step")
    expect(stepLineMoreLabel(4)).toBe("+4 more steps")
    for (const n of [1, 4, 12]) expect(stepLineMoreLabel(n).startsWith(stepLineMore(n))).toBe(true)
    expect(STEP_LINE_LESS).toBe("Show less")
    expect(STEP_LINE_UNTYPED).toBe("A step with no type")
  })
})

describe("the leaf rules (T-290-06, RESEARCH F-1)", () => {
  const importedSpecifiers = (source: string): string[] =>
    Array.from(source.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)"/gm)).map((m) => m[1])

  it.each(["react", "@/lib/api"])("stepLine.ts imports no %s", (specifier) => {
    expect(importedSpecifiers(stepLineSource)).not.toContain(specifier)
  })

  it("stepLine.ts reads the sentence table through own() (T-290-07)", () => {
    expect(stepLineSource).toMatch(/own\(PHASE_TYPE_SENTENCES/)
  })

  it("POSITIVE CONTROL — the detector really catches a React and an api import", () => {
    const planted = `import { useMemo } from "react"\nimport {\n  listWorkflows,\n} from "@/lib/api"\n`
    expect(importedSpecifiers(planted)).toEqual(["react", "@/lib/api"])
  })

  /** A JSX `title=` attribute (the library F1 rule — touch has no hover). */
  const TITLE_ATTR = /<[A-Za-z][^>]*\stitle=/

  it.each([
    ["stepLine.ts", stepLineSource],
    ["StepChipLine.tsx", chipLineSource],
  ])("%s carries no JSX title attribute", (_name, source) => {
    expect(source).not.toMatch(TITLE_ATTR)
  })

  it("POSITIVE CONTROL — the title detector catches a planted chip tooltip", () => {
    expect(`<span className="truncate" title={words}>{words}</span>`).toMatch(TITLE_ATTR)
  })

  it("the render module is real, not the empty stub (non-vacuity)", () => {
    expect(chipLineSource).toMatch(/data-testid="row-steps"/)
  })
})
