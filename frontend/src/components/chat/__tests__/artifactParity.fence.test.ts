/**
 * Phase 273-05 (I-1 · SC#4 · T-273-29) — ONE CLOSED VOCABULARY ACROSS TWO STACKS.
 *
 * The backend's `ComponentName` / `ChartKind` Literals (`backend/app/models/artifact.py`) and the
 * frontend's closed registry (`artifactRegistry.ts` / `artifactSpec.ts`) are two spellings of one
 * list. Both are read here from SOURCE (`?raw`), never hand-typed, so adding a component or a chart
 * kind on one side alone fails this file instead of shipping a card the other side cannot draw.
 *
 * The backend's own wire fixture (`backend/tests/unit/fixtures/artifact_record_v1.json`, the copy
 * the backend suites validate against) is fed through the frontend guard: every record must pass,
 * and the frontend fixtures must carry exactly the same top-level keys.
 */
import { describe, expect, it } from "vitest"
import modelSource from "../../../../../backend/app/models/artifact.py?raw"
import backendFixtureRaw from "../../../../../backend/tests/unit/fixtures/artifact_record_v1.json?raw"
import { ARTIFACT_COMPONENTS } from "../artifacts/artifactRegistry"
import { CHART_KINDS, parseArtifactRecord } from "../artifacts/artifactSpec"
import { ALL_VALID } from "../artifacts/__tests__/fixtures"

function literalValues(source: string, name: string): string[] {
  const m = new RegExp(`^${name}\\s*=\\s*Literal\\[([^\\]]*)\\]`, "m").exec(source)
  if (!m) return []
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

const backendFixture = JSON.parse(backendFixtureRaw) as Record<string, unknown> & {
  examples?: Record<string, unknown>[]
}
const { examples = [], ...topRecord } = backendFixture
const BACKEND_RECORDS: Record<string, unknown>[] = [topRecord, ...examples]

describe("I-1 — the backend Literals and the frontend registry are one list", () => {
  it("NON-VACUITY — both Literals were found in the backend source", () => {
    expect(literalValues(modelSource, "ComponentName").length).toBeGreaterThanOrEqual(3)
    expect(literalValues(modelSource, "ChartKind").length).toBeGreaterThanOrEqual(4)
  })

  it("ComponentName == ARTIFACT_COMPONENTS (as sets)", () => {
    expect(literalValues(modelSource, "ComponentName").slice().sort()).toEqual([...ARTIFACT_COMPONENTS].sort())
  })

  it("ChartKind == the frontend chart kinds (as sets)", () => {
    expect(literalValues(modelSource, "ChartKind").slice().sort()).toEqual([...CHART_KINDS].sort())
  })
})

describe("the backend wire fixture passes the frontend guard", () => {
  it("NON-VACUITY — the fixture holds a top-level record and examples", () => {
    expect(BACKEND_RECORDS.length).toBeGreaterThanOrEqual(2)
  })

  it("every backend record (top-level and examples) parses ok", () => {
    for (const rec of BACKEND_RECORDS) {
      const r = parseArtifactRecord(rec)
      expect(r.ok, `${String(rec.id)}: ${r.ok ? "" : r.reason}`).toBe(true)
    }
  })

  it("the frontend fixtures carry exactly the backend record's top-level keys", () => {
    const backendKeys = Object.keys(topRecord).sort()
    for (const rec of BACKEND_RECORDS) expect(Object.keys(rec).sort()).toEqual(backendKeys)
    for (const rec of ALL_VALID) expect(Object.keys(rec).sort(), rec.id).toEqual(backendKeys)
  })
})

describe("the refusal shape the rail reads", () => {
  it("the backend model names the refusal keys and the refused status", () => {
    for (const key of ['"status"', '"reason"', '"detail"']) expect(modelSource).toContain(key)
    expect(modelSource).toContain('"refused"')
  })
})
