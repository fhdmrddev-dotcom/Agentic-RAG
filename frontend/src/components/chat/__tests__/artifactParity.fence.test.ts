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
import badSpecsRaw from "../../../../../backend/tests/unit/fixtures/artifact_bad_specs_v1.json?raw"
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

/**
 * 273 CR-01 — ONE fixture of adversarial specs, read by BOTH validators
 * (`backend/tests/unit/test_273_review_fixes.py` runs the same file through `validate_args`).
 * Every `bad` spec must be refused here AND there; every `good` spec accepted by both — so a rule
 * added to one guard alone turns one of the two suites red instead of telling the model "shown"
 * for a card that renders as "This artifact can't be shown".
 */
type FixtureCase = Record<string, unknown> & { name: string; component: string }

function expand(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(expand)
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 2 && keys.includes("$repeat") && keys.includes("times")) {
      return String(o.$repeat).repeat(Number(o.times))
    }
    return Object.fromEntries(keys.map((k) => [k, expand(o[k])]))
  }
  return v
}

const parityRaw = JSON.parse(badSpecsRaw) as { bad: unknown[]; good: unknown[] }
const BAD = parityRaw.bad.map(expand) as FixtureCase[]
const GOOD = parityRaw.good.map(expand) as FixtureCase[]

/** The spec as the server would store it: slots by series index, stacked defaulted, caption built. */
function asRecord(c: FixtureCase): Record<string, unknown> {
  const rows = Array.isArray(c.rows) ? c.rows : []
  const chart = c.chart as Record<string, unknown> | undefined
  const metric = c.metric as Record<string, unknown> | undefined
  return {
    id: "a_0000000001",
    thread_id: "5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63",
    user_id: "0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f",
    org_id: null,
    run_id: null,
    tool_call_id: null,
    parent_id: null,
    label: `${c.component} 1`,
    component: c.component,
    spec: {
      title: c.title,
      columns: (Array.isArray(c.columns) ? c.columns : []).map((col: Record<string, unknown>) => ({
        name: col.name,
        type: col.type,
        unit: col.unit ?? null,
      })),
      rows,
      chart: chart
        ? {
            kind: chart.kind,
            x: chart.x,
            y: chart.y,
            stacked: chart.stacked ?? chart.kind === "area",
            slots: (Array.isArray(chart.y) ? chart.y : []).map((_: unknown, i: number) => i),
          }
        : null,
      metric: metric
        ? {
            value_column: metric.value_column,
            compare_column: metric.compare_column ?? null,
            label: metric.label ?? null,
            compare_label: metric.compare_label ?? null,
          }
        : null,
    },
    caption: { row_count: rows.length, sources: [], source_count: 0, lineage: null },
    row_count: rows.length,
    spec_version: 1,
    created_at: "2026-10-04T00:00:00+00:00",
  }
}

describe("CR-01 — the shared bad-spec fixture: the frontend guard refuses what the backend refuses", () => {
  it("NON-VACUITY — the fixture holds the adversarial and the control specs", () => {
    expect(BAD.length).toBeGreaterThanOrEqual(20)
    expect(GOOD.length).toBeGreaterThanOrEqual(5)
  })

  it("every bad spec is refused by parseArtifactRecord", () => {
    for (const c of BAD) expect(parseArtifactRecord(asRecord(c)).ok, c.name).toBe(false)
  })

  it("every good spec parses ok (the lift into a record is not itself what fails)", () => {
    for (const c of GOOD) {
      const r = parseArtifactRecord(asRecord(c))
      expect(r.ok, `${c.name}: ${r.ok ? "" : r.reason}`).toBe(true)
    }
  })
})

describe("the refusal shape the rail reads", () => {
  it("the backend model names the refusal keys and the refused status", () => {
    for (const key of ['"status"', '"reason"', '"detail"']) expect(modelSource).toContain(key)
    expect(modelSource).toContain('"refused"')
  })
})
