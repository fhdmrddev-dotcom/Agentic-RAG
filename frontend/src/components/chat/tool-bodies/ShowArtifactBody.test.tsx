/**
 * Phase 273-05 (SC#2 · L-3 · L-4 · UI-D-02 · D-10) — the rail's words for `show_artifact`.
 *
 * The essence and the expanded body are built from the tool RESULT's plain facts only (component,
 * kind, stacked, series_count, row_count, from_label, same_rows, operations, label, and on a
 * refusal the people-facing `reason`). The result's model-facing explanation and its distinct
 * `values` sample are never read, so neither can reach the page. The result keys are the
 * handler's own (`show_artifact_tool.py` build_result + `models/artifact.py` refusal), read here
 * through `?raw` so a renamed key fails this file rather than silently emptying the rail.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"
import type { ToolCall } from "@/types"
import ShowArtifactBody, { summarize } from "./ShowArtifactBody"
import handlerSource from "../../../../../backend/app/services/show_artifact_tool.py?raw"
import modelSource from "../../../../../backend/app/models/artifact.py?raw"

const MODEL_FACING = "Input should be 'line', 'bar', 'area' or 'scatter' [type=literal_error, input_value='pie']"

function result(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    artifact_id: "a_k3j9x0p2qd",
    label: "chart 1",
    component: "chart",
    kind: "bar",
    stacked: false,
    series_count: 2,
    row_count: 12,
    from_label: null,
    same_rows: null,
    operations: null,
    columns: [{ name: "region", type: "string" }, { name: "revenue", type: "number" }],
    values: { region: ["Americas", "Zanzibar Holdings"] },
    note: "Shown to the user below your answer as chart 1.",
    ...extra,
  }
}

const REFUSED = { status: "refused", reason: '"pie" is not a chart kind', detail: MODEL_FACING }

function tc(res: unknown): ToolCall {
  return {
    id: "call_1",
    name: "show_artifact",
    args: {},
    status: "done",
    result: typeof res === "string" ? res : JSON.stringify(res),
  } as ToolCall
}

afterEach(() => cleanup())

describe("the result keys are the handler's (non-vacuity)", () => {
  it("every success key this file reads is emitted by build_result", () => {
    for (const key of ["label", "component", "kind", "stacked", "series_count", "row_count", "from_label", "same_rows", "operations"]) {
      expect(handlerSource, key).toContain(`"${key}"`)
    }
  })

  it("the refusal shape is the model's: status / reason, plus the model-facing field never read", () => {
    expect(modelSource).toContain('{"status": REFUSED_STATUS, "reason": r.reason')
    expect(modelSource).toContain('REFUSED_STATUS = "refused"')
  })
})

describe("summarize — the essence line", () => {
  it("first emission → `Bar chart · 12 rows`", () => {
    expect(summarize(tc(result()))).toBe("Bar chart · 12 rows")
  })

  it("follow-up, same rows → `Bar chart · same 16 rows as chart 1`", () => {
    const r = result({ label: "chart 2", row_count: 16, from_label: "chart 1", same_rows: true, operations: [] })
    expect(summarize(tc(r))).toBe("Bar chart · same 16 rows as chart 1")
  })

  it("follow-up, narrowed by filter_eq → `Bar chart · chart 1 rows filtered to Q3 (4 rows)`", () => {
    const r = result({
      label: "chart 3",
      row_count: 4,
      from_label: "chart 1",
      same_rows: false,
      operations: [{ op: "filter_eq", column: "quarter", value: "Q3" }],
    })
    expect(summarize(tc(r))).toBe("Bar chart · chart 1 rows filtered to Q3 (4 rows)")
  })

  it("a stacked bar with 3 series → `Stacked bar chart · …`", () => {
    expect(summarize(tc(result({ stacked: true, series_count: 3 })))).toBe("Stacked bar chart · 12 rows")
  })

  it("table → `Table · 16 rows`; metric → `Metric`", () => {
    expect(summarize(tc(result({ component: "table", kind: null, stacked: null, series_count: null, row_count: 16 })))).toBe("Table · 16 rows")
    expect(summarize(tc(result({ component: "metric", kind: null, stacked: null, series_count: null, row_count: 1 })))).toBe("Metric")
  })

  it("a refusal → `refused · {reason}`, built from `reason` alone", () => {
    const s = summarize(tc(REFUSED))
    expect(s).toBe('refused · "pie" is not a chart kind')
    expect(s).not.toContain("literal_error")
  })

  it("a refusal with no usable reason uses the catalogue fallback, never the model-facing text", () => {
    const s = summarize(tc({ status: "refused", reason: "", detail: MODEL_FACING }))
    expect(s).toBe("refused · its settings weren't valid")
  })

  it("unparseable / truncated / empty / non-object results → the neutral phrase, no raw text", () => {
    const truncated = JSON.stringify(result()).slice(0, 60)
    for (const raw of [truncated, "", "not json at all", "[1,2,3]", "null", '"a string"']) {
      const s = summarize(tc(raw))
      expect(s, raw).toBe("Show an artifact")
    }
    expect(summarize({ ...tc(""), result: undefined } as ToolCall)).toBe("Show an artifact")
  })

  it("an unknown component in a success result reads neutral, never the model's string", () => {
    expect(summarize(tc(result({ component: "<img src=x>" })))).toBe("Show an artifact")
  })

  it("a prototype-key component is not a component", () => {
    expect(summarize(tc(result({ component: "constructor" })))).toBe("Show an artifact")
  })
})

describe("ShowArtifactBody — the expanded body", () => {
  it("done → one worded line, never the spec", () => {
    const { container } = render(<ShowArtifactBody parsed={result()} />)
    expect(container.textContent).toBe("Bar chart · 2 series · 12 rows · chart 1. Shown below the answer.")
  })

  it("done, a table → no series segment", () => {
    const { container } = render(
      <ShowArtifactBody parsed={result({ component: "table", kind: null, series_count: null, row_count: 16, label: "table 1" })} />,
    )
    expect(container.textContent).toBe("Table · 16 rows · table 1. Shown below the answer.")
  })

  it("refused → the reason sentence, then `Sent back to the agent to fix.`", () => {
    const { container } = render(<ShowArtifactBody parsed={REFUSED} />)
    expect(container.textContent).toBe('"pie" is not a chart kind.Sent back to the agent to fix.')
    expect(container.textContent).not.toContain("literal_error")
  })

  it("no spec key, no model-facing text and no sampled value ever reaches the body", () => {
    for (const parsed of [result(), REFUSED, { ...REFUSED, error: "boom" }, null, "garbage", [1, 2]]) {
      const { container, unmount } = render(<ShowArtifactBody parsed={parsed} />)
      const text = container.textContent ?? ""
      expect(text).not.toContain('{"')
      expect(text).not.toContain('"rows"')
      expect(text).not.toContain("rows:")
      expect(text).not.toContain("detail")
      expect(text).not.toContain("Zanzibar")
      expect(text).not.toContain("Americas")
      expect(text).not.toContain("type=")
      unmount()
    }
  })

  it("an unreadable result → the neutral line", () => {
    const { container } = render(<ShowArtifactBody parsed={null} />)
    expect(container.textContent).toBe("Show an artifact")
  })
})

// ══ Phase 292-02 (UI-D-292-19 · L-3 · L-4) — the rail lines for the three encoded types ════════
// The rail reads only `row_count`, `edge_count`, `option_count`, `label`, `component` (and on a
// refusal `reason`). ⚠ `edge_count` / `option_count` are emitted by plan 292-01's build_result; the
// `?raw` non-vacuity list above is the 273 key set and is not widened here, because inside this
// plan's worktree the backend does not emit them yet — plan 292-03 proves them on the merged tree.

function encoded(component: string, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    artifact_id: "a_dg1nv0c3x8",
    component,
    kind: null,
    stacked: null,
    series_count: null,
    from_label: null,
    same_rows: null,
    operations: null,
    columns: [],
    values: {},
    note: "Shown as diagram 1. To change it, call show_artifact again with the full data.",
    ...extra,
  }
}

const DIAGRAM_RESULT = encoded("diagram", { label: "diagram 1", row_count: 8, edge_count: 9 })
const COMPARISON_RESULT = encoded("comparison", { label: "comparison 1", row_count: 7, option_count: 3 })
const TIMELINE_RESULT = encoded("timeline", { label: "timeline 1", row_count: 9 })

describe("292 — summarize, the three new essences", () => {
  it("diagram → `Flow diagram · 8 steps, 9 links`", () => {
    expect(summarize(tc(DIAGRAM_RESULT))).toBe("Flow diagram · 8 steps, 9 links")
    expect(summarize(tc({ ...DIAGRAM_RESULT, row_count: 1, edge_count: 0 }))).toBe("Flow diagram · 1 step, no links")
  })

  it("comparison → `Comparison · 3 options × 7 terms`", () => {
    expect(summarize(tc(COMPARISON_RESULT))).toBe("Comparison · 3 options × 7 terms")
  })

  it("timeline → `Timeline · 9 events` (no upcoming count: that depends on the clock)", () => {
    expect(summarize(tc(TIMELINE_RESULT))).toBe("Timeline · 9 events")
    expect(summarize(tc({ ...TIMELINE_RESULT, row_count: 1 }))).toBe("Timeline · 1 event")
  })

  it("a new-type refusal still reads `refused · {reason}`, never the detail", () => {
    const refused = { status: "refused", reason: "26 steps (max 25); group related steps first", detail: "`nodes` has 26 items" }
    expect(summarize(tc(refused))).toBe("refused · 26 steps (max 25); group related steps first")
  })

  it("missing counts degrade to the chip, never to a raw value", () => {
    expect(summarize(tc(encoded("diagram", { label: "diagram 2", row_count: "8", edge_count: -1 })))).toBe("Flow diagram")
  })
})

describe("292 — ShowArtifactBody, the three new expanded bodies", () => {
  it("diagram → `Flow diagram · 8 steps · 9 links · diagram 1. Shown below the answer.`", () => {
    const { container } = render(<ShowArtifactBody parsed={DIAGRAM_RESULT} />)
    expect(container.textContent).toBe("Flow diagram · 8 steps · 9 links · diagram 1. Shown below the answer.")
  })

  it("comparison → `Comparison · 3 options × 7 terms · comparison 1. Shown below the answer.`", () => {
    const { container } = render(<ShowArtifactBody parsed={COMPARISON_RESULT} />)
    expect(container.textContent).toBe("Comparison · 3 options × 7 terms · comparison 1. Shown below the answer.")
  })

  it("timeline → `Timeline · 9 events · timeline 1. Shown below the answer.`", () => {
    const { container } = render(<ShowArtifactBody parsed={TIMELINE_RESULT} />)
    expect(container.textContent).toBe("Timeline · 9 events · timeline 1. Shown below the answer.")
  })

  it("the body never shows the note, a spec key or the refusal detail", () => {
    const refused = { status: "refused", reason: "a link names a step that isn't in it (zz)", detail: "edges[2].to = zz; nodes = [...]" }
    for (const parsed of [DIAGRAM_RESULT, COMPARISON_RESULT, TIMELINE_RESULT, refused]) {
      const { container, unmount } = render(<ShowArtifactBody parsed={parsed} />)
      const text = container.textContent ?? ""
      for (const banned of ["{", "}", "nodes", "edges", "verdict", "events:", "component", "detail", "full data"]) {
        expect(text, banned).not.toContain(banned)
      }
      unmount()
    }
  })
})
