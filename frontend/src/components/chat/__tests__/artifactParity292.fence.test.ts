/**
 * Phase 292-03 (I-1 · SC#2 · T-292-22) — THE SIX-COMPONENT VOCABULARY IS ONE LIST ACROSS TWO STACKS.
 *
 * `artifactParity.fence.test.ts` (273-05) holds the v1 vocabulary and stays unedited. This file adds
 * the 292 half: the backend `ComponentName` / `NodeKind` / `Verdict` Literals and every 292 cap in
 * `backend/app/models/artifact.py` equal the frontend constants; every record of the backend's
 * `artifact_record_292.json` passes `parseArtifactRecord`; every `bad` case of the shared
 * `artifact_bad_specs_292.json` is refused by the frontend guard and every `good` case parses —
 * after the lift the fixture's own `about` field states. Everything is read from SOURCE with `?raw`,
 * never re-typed, so a rule or a name added on one side alone turns this file red.
 */
import { describe, expect, it } from "vitest"
import modelSource from "../../../../../backend/app/models/artifact.py?raw"
import handlerSource from "../../../../../backend/app/services/show_artifact_tool.py?raw"
import record292Raw from "../../../../../backend/tests/unit/fixtures/artifact_record_292.json?raw"
import recordV1Raw from "../../../../../backend/tests/unit/fixtures/artifact_record_v1.json?raw"
import badSpecs292Raw from "../../../../../backend/tests/unit/fixtures/artifact_bad_specs_292.json?raw"
import { ARTIFACT_COMPONENTS } from "../artifacts/artifactRegistry"
import * as spec from "../artifacts/artifactSpec"
import { NODE_KINDS, VERDICTS, parseArtifactRecord } from "../artifacts/artifactSpec"

function literalValues(source: string, name: string): string[] {
  const m = new RegExp(`^${name}\\s*=\\s*Literal\\[([^\\]]*)\\]`, "m").exec(source)
  if (!m) return []
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

function backendInt(source: string, name: string): number | null {
  const m = new RegExp(`^${name}\\s*=\\s*(\\d+)`, "m").exec(source)
  return m ? Number(m[1]) : null
}

/** Every 292 cap the two guards share, compared by NAME (the frontend export of the same name). */
const SHARED_CAPS = [
  "MAX_NODES",
  "MAX_EDGES",
  "MIN_OPTIONS",
  "MAX_OPTIONS",
  "MAX_TERMS",
  "MAX_EVENTS",
  "MAX_NODE_LABEL_CHARS",
  "MAX_EDGE_LABEL_CHARS",
  "MAX_OPTION_CHARS",
  "MAX_TERM_CHARS",
  "MAX_EVENT_TITLE_CHARS",
  "MAX_EVENT_DETAIL_CHARS",
  "MAX_CATEGORY_CHARS",
  "MAX_EXCERPT_CHARS",
  "MAX_CELL_CHARS",
  "MAX_TITLE_CHARS",
  "MAX_SOURCE_DOCUMENT_CHARS",
] as const

const FRONTEND = spec as unknown as Record<string, unknown>

describe("I-1 (292) — the backend Literals and caps equal the frontend constants", () => {
  it("NON-VACUITY — the 292 Literals and every cap were found in the backend source", () => {
    expect(literalValues(modelSource, "ComponentName").length).toBeGreaterThanOrEqual(6)
    expect(literalValues(modelSource, "NodeKind").length).toBe(4)
    expect(literalValues(modelSource, "Verdict").length).toBe(4)
    for (const name of [...SHARED_CAPS, "MIN_NODES", "MIN_EDGES"]) {
      expect(backendInt(modelSource, name), name).not.toBeNull()
    }
  })

  it("NON-VACUITY — the comparison can fail: a planted wrong cap is not equal", () => {
    // The control the equality below would have to survive: a cap off by one reads unequal.
    expect((backendInt(modelSource, "MAX_NODES") ?? 0) + 1).not.toBe(FRONTEND.MAX_NODES)
  })

  it("ComponentName == ARTIFACT_COMPONENTS (as sets)", () => {
    expect(literalValues(modelSource, "ComponentName").slice().sort()).toEqual([...ARTIFACT_COMPONENTS].sort())
  })

  it("NodeKind == NODE_KINDS and Verdict == VERDICTS (as sets)", () => {
    expect(literalValues(modelSource, "NodeKind").slice().sort()).toEqual([...NODE_KINDS].sort())
    expect(literalValues(modelSource, "Verdict").slice().sort()).toEqual([...VERDICTS].sort())
  })

  it("every shared cap is the same number on both sides", () => {
    for (const name of SHARED_CAPS) expect(FRONTEND[name], name).toBe(backendInt(modelSource, name))
  })

  it("MIN_NODES / MIN_EDGES: documented asymmetry — backend refuses below 2 / 1, the guard still renders 1 / 0", () => {
    expect(backendInt(modelSource, "MIN_NODES")).toBe(2)
    expect(backendInt(modelSource, "MIN_EDGES")).toBe(1)
    const one = asRecord({
      name: "one step, no links",
      component: "diagram",
      title: "Invoice approval",
      diagram: { nodes: [{ id: "a", label: "Only step" }], edges: [] },
    })
    const r = parseArtifactRecord(one)
    expect(r.ok, r.ok ? "" : r.reason).toBe(true)
  })

  it("the rail's 292 result keys are in the backend's RESULT_KEY_ORDER and emitted by the handler", () => {
    const order = /RESULT_KEY_ORDER[^=]*=\s*\(([\s\S]*?)\n\)/.exec(modelSource)
    expect(order, "RESULT_KEY_ORDER block").not.toBeNull()
    for (const key of ["edge_count", "option_count", "row_count"]) {
      expect(order?.[1] ?? "", key).toContain(`"${key}"`)
      expect(handlerSource, key).toContain(`"${key}"`)
    }
  })
})

// ── The backend's stored-record fixture through the frontend guard ──────────────────────────────

const v1 = JSON.parse(recordV1Raw) as Record<string, unknown> & { examples?: unknown[] }
const { examples: _v1Examples, ...v1Top } = v1
const V1_KEYS = Object.keys(v1Top).sort()

const rec292 = JSON.parse(record292Raw) as Record<string, unknown> & { examples?: Record<string, unknown>[] }
const { examples: rec292Examples = [], ...rec292Top } = rec292
const RECORDS_292: Record<string, unknown>[] = [rec292Top, ...rec292Examples]

describe("artifact_record_292.json passes the frontend guard", () => {
  it("NON-VACUITY — three records, one per new component", () => {
    expect(RECORDS_292.length).toBe(3)
    expect(RECORDS_292.map((r) => r.component).sort()).toEqual(["comparison", "diagram", "timeline"])
  })

  it("every record parses ok", () => {
    for (const r of RECORDS_292) {
      const p = parseArtifactRecord(r)
      expect(p.ok, `${String(r.id)}: ${p.ok ? "" : p.reason}`).toBe(true)
    }
  })

  it("every record carries exactly the v1 record's top-level keys", () => {
    expect(V1_KEYS.length).toBeGreaterThanOrEqual(10)
    for (const r of RECORDS_292) expect(Object.keys(r).sort(), String(r.id)).toEqual(V1_KEYS)
  })
})

// ── The shared adversarial fixture: the lift stated in its `about` field ────────────────────────

type FixtureCase = Record<string, unknown> & { name: string; component: string }

const parity292 = JSON.parse(badSpecs292Raw) as { about: string; bad: FixtureCase[]; good: FixtureCase[] }
const BAD = parity292.bad
const GOOD = parity292.good

const FIXTURE_SOURCE = { document: "fixture.pdf", page: null, excerpt: "Fixture excerpt." }
const ENCODINGS = ["diagram", "comparison", "timeline"] as const

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}
function lower(v: unknown): unknown {
  return typeof v === "string" ? v.toLowerCase() : v
}
function optStr(v: unknown): unknown {
  if (v === undefined || v === null) return null
  if (typeof v === "string" && v.trim() === "") return null
  return v
}
function liftSource(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === "number" && Number.isInteger(v)) return FIXTURE_SOURCE
  return v
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function liftDiagram(d: Record<string, unknown>) {
  return {
    nodes: list(d.nodes).map((n) => {
      const o = isObj(n) ? n : {}
      return { id: o.id, label: o.label, kind: o.kind === undefined ? "step" : lower(o.kind), source: liftSource(o.source) }
    }),
    edges: list(d.edges).map((e) => {
      const o = isObj(e) ? e : {}
      return { from: o.from, to: o.to, label: optStr(o.label) }
    }),
  }
}
function liftComparison(c: Record<string, unknown>) {
  return {
    options: c.options,
    terms: list(c.terms).map((t) => {
      const o = isObj(t) ? t : {}
      return {
        name: o.name,
        cells: list(o.cells).map((cell) => {
          const x = isObj(cell) ? cell : {}
          return { verdict: lower(x.verdict), text: optStr(x.text), source: liftSource(x.source) }
        }),
      }
    }),
  }
}
function liftTimeline(t: Record<string, unknown>) {
  return {
    events: list(t.events).map((e) => {
      const o = isObj(e) ? e : {}
      return {
        date: o.date,
        title: o.title,
        detail: optStr(o.detail),
        category: optStr(o.category),
        deadline: o.deadline === undefined ? false : o.deadline,
        source: liftSource(o.source),
      }
    }),
  }
}

/** The case as the server would store it (the `about` lift): spec = {title, <component>: encoding}. */
function asRecord(c: FixtureCase): Record<string, unknown> {
  const key = (ENCODINGS as readonly string[]).includes(c.component)
    ? c.component
    : ENCODINGS.find((k) => isObj(c[k])) ?? c.component
  const raw = isObj(c[key]) ? (c[key] as Record<string, unknown>) : {}
  let encoding: Record<string, unknown>
  let count = 0
  if (key === "diagram") {
    const d = liftDiagram(raw)
    encoding = d
    count = d.nodes.length
  } else if (key === "comparison") {
    const d = liftComparison(raw)
    encoding = d
    count = d.terms.length
  } else {
    const d = liftTimeline(raw)
    encoding = d
    count = d.events.length
  }
  return {
    id: "a_0000000292",
    thread_id: "5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63",
    user_id: "0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f",
    org_id: null,
    run_id: null,
    tool_call_id: null,
    parent_id: null,
    label: `${c.component} 1`,
    component: c.component,
    // the encoding sits under the case's component name, as the server stores it
    spec: { title: c.title, [c.component]: encoding },
    caption: { row_count: count, sources: [], source_count: 0, lineage: null },
    row_count: count,
    spec_version: 1,
    created_at: "2026-10-24T00:00:00+00:00",
  }
}

describe("CR-01 (292) — the shared bad-spec fixture: the frontend guard refuses what the backend refuses", () => {
  it("NON-VACUITY — the fixture holds the adversarial and the control cases, and states its lift", () => {
    expect(BAD.length).toBeGreaterThanOrEqual(20)
    expect(GOOD.length).toBeGreaterThanOrEqual(6)
    expect(parity292.about).toContain("THE LIFT")
    for (const comp of ENCODINGS) expect(GOOD.some((c) => c.component === comp), comp).toBe(true)
  })

  it("every bad case is refused by parseArtifactRecord", () => {
    for (const c of BAD) {
      const r = parseArtifactRecord(asRecord(c))
      expect(r.ok, c.name).toBe(false)
    }
  })

  it("every good case parses ok (the lift into a record is not itself what fails)", () => {
    for (const c of GOOD) {
      const r = parseArtifactRecord(asRecord(c))
      expect(r.ok, `${c.name}: ${r.ok ? "" : r.reason}`).toBe(true)
    }
  })
})

// ── 292-REVIEW CR-01: a stored source and its document name, in UTF-16 units on both sides ──────

type StoredSourceCase = { name: string; ok: boolean; source: unknown }
type DocumentNameCase = { name: string; filename: string; document: string }
const STORED_SOURCES = (parity292 as unknown as { stored_sources: StoredSourceCase[] }).stored_sources ?? []
const DOCUMENT_NAMES = (parity292 as unknown as { document_names: DocumentNameCase[] }).document_names ?? []

/** A two-step diagram record whose first node carries `source` exactly as stored. */
function withNodeSource(source: unknown): Record<string, unknown> {
  const r = asRecord({
    name: "source carrier",
    component: "diagram",
    title: "Invoice approval",
    diagram: { nodes: [{ id: "a", label: "Step a" }, { id: "b", label: "Step b" }], edges: [{ from: "a", to: "b" }] },
  })
  const spec = r.spec as { diagram: { nodes: Array<Record<string, unknown>> } }
  spec.diagram.nodes[0].source = source
  return r
}

const TOLERATED = (parity292 as unknown as { refused_then_tolerated: FixtureCase[] }).refused_then_tolerated ?? []

describe("WR-02 (292-REVIEW) — refused by the backend, tolerated and neutralised by the guard", () => {
  it("every refused_then_tolerated case parses, and no q (not stated) cell keeps a source", () => {
    expect(TOLERATED.length).toBeGreaterThanOrEqual(1)
    for (const c of TOLERATED) {
      const r = parseArtifactRecord(asRecord(c))
      expect(r.ok, `${c.name}: ${r.ok ? "" : r.reason}`).toBe(true)
      if (!r.ok) continue
      const cells = r.record.spec.comparison?.terms.flatMap((t) => t.cells) ?? []
      expect(cells.some((x) => x.verdict === "q"), c.name).toBe(true)
      for (const x of cells) {
        if (x.verdict === "q") expect(x.source, c.name).toBeNull()
        else expect(x.source, c.name).not.toBeNull()
      }
    }
  })
})

describe("CR-01 (292-REVIEW) — stored sources and document names agree with the backend", () => {
  it("every stored_sources case is accepted by the guard exactly when the backend accepts it (ok)", () => {
    expect(STORED_SOURCES.some((c) => c.ok)).toBe(true)
    expect(STORED_SOURCES.some((c) => !c.ok)).toBe(true)
    for (const c of STORED_SOURCES) expect(parseArtifactRecord(withNodeSource(c.source)).ok, c.name).toBe(c.ok)
  })

  it("every document the server stores for a raw filename passes the guard (<= 200 UTF-16 units)", () => {
    expect(DOCUMENT_NAMES.length).toBeGreaterThanOrEqual(3)
    for (const c of DOCUMENT_NAMES) {
      expect(c.document.length, c.name).toBeLessThanOrEqual(200)
      const r = parseArtifactRecord(withNodeSource({ document: c.document, page: null, excerpt: null }))
      expect(r.ok, `${c.name}: ${r.ok ? "" : r.reason}`).toBe(true)
    }
  })
})
