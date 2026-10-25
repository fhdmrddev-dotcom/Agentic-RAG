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
import { launchInputFields } from "../soulData"

interface Case {
  name: string
  definition: Parameters<typeof launchInputFields>[0]
  expected_keys: string[]
  expected_required: boolean[]
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
})
