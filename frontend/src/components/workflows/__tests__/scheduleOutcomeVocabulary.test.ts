/**
 * 300-01 Task 3 (D-15, D-26; BUG-261027-03) — a schedule's `last_status` becomes ONE sentence.
 *
 * The raw wire value never reaches the screen: every known token has a sentence, a recorded
 * server sentence is prefixed "Didn't run — ", and an unknown token reads a neutral sentence
 * rather than itself. The fixture table below IS UI-SPEC §S6a, row for row.
 */
import { describe, expect, it } from "vitest"

import { scheduleOutcomeLine } from "../scheduleOutcomeVocabulary"
import vocabularySource from "../scheduleOutcomeVocabulary?raw"

const BLANK_INPUT =
  "Client name is required and has no value. Add a new schedule with it filled in, then delete this one."

const CASES: ReadonlyArray<[string, string, "muted" | "warning" | "error"]> = [
  ["completed", "Finished.", "muted"],
  ["failed", "Started, but the run failed.", "error"],
  ["launch_failed", "Didn't start. Press Run now to see why.", "error"],
  ["waiting", "Waiting on you — answer in the run.", "warning"],
  ["cancelled", "Started, then stopped before it finished.", "muted"],
  [
    "cadence_error",
    "Didn't run — the schedule's timing couldn't be read. Add a new schedule, then delete this one.",
    "warning",
  ],
  [BLANK_INPUT, `Didn't run — ${BLANK_INPUT}`, "warning"],
  [
    "Workflows are currently disabled by the administrator",
    "Didn't run — Workflows are currently disabled by the administrator.",
    "warning",
  ],
  ["some_future_code", "Last run ended in a way this version doesn't describe.", "muted"],
  ["paused", "Last run ended in a way this version doesn't describe.", "muted"],
]

describe("scheduleOutcomeLine — every row of UI-SPEC §S6a", () => {
  it.each(CASES)("%s", (status, text, tone) => {
    expect(scheduleOutcomeLine(status)).toEqual({ text, tone })
  })

  it.each([null, undefined, ""])("%s reads no outcome line", (status) => {
    expect(scheduleOutcomeLine(status as string | null | undefined)).toBeNull()
  })

  it("a token never renders as itself", () => {
    for (const [status] of CASES) {
      if (status.includes(" ")) continue
      const text = scheduleOutcomeLine(status)?.text ?? ""
      expect(text).not.toBe(status)
      // a snake_case wire token never appears inside the sentence either
      if (status.includes("_")) expect(text).not.toContain(status)
    }
  })

  it("a sentence that already ends in a full stop gains no second one", () => {
    expect(scheduleOutcomeLine(BLANK_INPUT)?.text.endsWith("one.")).toBe(true)
    expect(scheduleOutcomeLine(BLANK_INPUT)?.text.endsWith("..")).toBe(false)
  })
})

describe("scheduleOutcomeVocabulary is a zero-import leaf (the decisionsVocabulary rule)", () => {
  it("imports nothing", () => {
    // Non-vacuity: a `?raw` import that resolved to nothing would pass every negative below.
    expect(vocabularySource).toContain("export function scheduleOutcomeLine")
    expect(vocabularySource).not.toMatch(/^\s*import\s/m)
    expect(vocabularySource).not.toMatch(/import\s*\(/)
    // positive control for the pattern itself
    expect('import { x } from "./y"').toMatch(/^\s*import\s/m)
  })
})
