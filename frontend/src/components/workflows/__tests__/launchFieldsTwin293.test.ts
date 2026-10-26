/**
 * Phase 293-04 (D-11) — the browser's launch-field rule and the server's twin read ONE case file.
 *
 * `soulData.launchInputFields` decides which boxes a person fills in before a run; the server's
 * `backend/app/services/inbound_inputs.declared_fields` decides which inputs an outside caller may
 * send with a key, and the start `curl` on the show-once card is built from the first. If the two
 * drifted, the copied `curl` would send a field the server refuses. `test_293_inbound_inputs.py`
 * pins the Python half to `launch_fields_cases.json`; this suite pins the TypeScript half to the
 * same file. Fix the code, never the fixture.
 */
import { describe, expect, it } from "vitest"
import casesRaw from "../../../../../backend/tests/fixtures/phase293/launch_fields_cases.json?raw"
import { launchInputFields, missingRequiredFields } from "../soulData"

interface Case {
  name: string
  definition: Parameters<typeof launchInputFields>[0]
  expected_keys: string[]
  expected_required: boolean[]
  inputs?: Record<string, string>
  expected_missing?: string[]
}

const { cases } = JSON.parse(casesRaw) as { cases: Case[] }

describe("293-04 launch-field twin (browser half)", () => {
  it("the shared case file is not empty", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8)
  })

  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const fields = launchInputFields(c.definition)
    expect(fields.map((f) => f.key)).toEqual(c.expected_keys)
    expect(fields.map((f) => f.required !== false)).toEqual(c.expected_required)
  })

  // 296-06 (287-T01): the server's `missing_required` now refuses a launch the way this
  // predicate does; the shared cases with `expected_missing` pin the two together.
  const missingCases = cases.filter((c) => Array.isArray(c.expected_missing))

  it("the shared case file carries missing-required cases", () => {
    expect(missingCases.length).toBeGreaterThanOrEqual(4)
  })

  it.each(missingCases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const missing = missingRequiredFields(launchInputFields(c.definition), c.inputs ?? {})
    expect(missing.map((f) => f.key)).toEqual(c.expected_missing)
  })
})
