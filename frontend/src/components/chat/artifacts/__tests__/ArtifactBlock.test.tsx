/**
 * Phase 273-02 Task 2 — ArtifactBlock, the body of the ONE MessageItem mount (D-10 · D-12 · I-1).
 *
 * guard → closed registry → per-artifact error boundary → component | notice. These tests assert
 * the TEXT a person reads (notice sentences, caption, sorted cells), not only that a test id exists.
 *
 * The chart chunk is mocked here so this suite never lays out recharts in jsdom; ChartArtifact has
 * its own suite. TableArtifact is wrapped so one test can make it throw (the boundary proof).
 */
import { Suspense, createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { ArtifactBlock } from "../ArtifactBlock"
import { ARTIFACT_COMPONENTS, lazyChartFrom, rendererFor } from "../artifactRegistry"
import { ArtifactErrorBoundary } from "../ArtifactErrorBoundary"
import { chartBar, table16, metricWithDelta, missing, mutable, clone } from "./fixtures"

const flags = vi.hoisted(() => ({ throwTable: false }))

vi.mock("../ChartArtifact", () => ({
  default: ({ record }: { record: { spec: { title: string } } }) =>
    createElement("div", { "data-testid": "chart-body" }, `plot of ${record.spec.title}`),
}))

vi.mock("../TableArtifact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../TableArtifact")>()
  return {
    ...actual,
    TableArtifact: (props: Parameters<typeof actual.TableArtifact>[0]) => {
      if (flags.throwTable) throw new Error("table exploded: {\"rows\": [1,2]}")
      return createElement(actual.TableArtifact, props)
    },
  }
})

afterEach(() => {
  flags.throwTable = false
  vi.restoreAllMocks()
})

const SPEC_KEY_LEAKS = ['{"', '"rows"', "rows:", "component", "spec", "Error", "exploded"]

function assertNoSpecLeak(text: string) {
  for (const t of SPEC_KEY_LEAKS) expect(text, `leaked ${t}`).not.toContain(t)
}

describe("artifactRegistry — closed to exactly three", () => {
  it("rendererFor resolves the three components and nothing else", () => {
    expect(rendererFor("chart")).not.toBeNull()
    expect(rendererFor("table")).not.toBeNull()
    expect(rendererFor("metric")).not.toBeNull()
    for (const k of ["pie", "__proto__", "constructor", "toString", "", undefined, null, 1, {}]) {
      expect(rendererFor(k)).toBeNull()
    }
    expect([...ARTIFACT_COMPONENTS]).toEqual(["chart", "table", "metric"])
  })
})

describe("ArtifactBlock", () => {
  it("renders nothing for an empty or absent list", () => {
    const a = render(<ArtifactBlock artifacts={[]} />)
    expect(a.container.firstChild).toBeNull()
    a.unmount()
    const b = render(<ArtifactBlock artifacts={undefined} />)
    expect(b.container.firstChild).toBeNull()
  })

  it("renders framed cards in emission order with title, kind chip, label chip and caption", async () => {
    render(<ArtifactBlock artifacts={[chartBar, table16, metricWithDelta]} />)
    // The lazy chart lands in its own frame (the busy frame is replaced, so wait first).
    expect(await screen.findByTestId("chart-body")).toHaveTextContent("plot of FY25 revenue by region · $K")
    const list = screen.getByTestId("artifact-list")
    expect(list).toHaveClass("mt-4", "flex", "flex-col", "gap-3")
    const figures = within(list).getAllByTestId("artifact-block")
    expect(figures.map((f) => f.getAttribute("data-component"))).toEqual(["chart", "table", "metric"])
    expect(figures.map((f) => f.getAttribute("data-artifact-id"))).toEqual([
      chartBar.id,
      table16.id,
      metricWithDelta.id,
    ])

    expect(screen.getByRole("figure", { name: "FY25 revenue by region · $K" })).toBe(figures[0])
    expect(screen.getByRole("figure", { name: "FY25 revenue by quarter and region" })).toBe(figures[1])

    expect(figures.map((f) => within(f).getByTestId("artifact-kind-chip").textContent)).toEqual([
      "Bar chart",
      "Table",
      "Metric",
    ])
    expect(figures.map((f) => within(f).getByTestId("artifact-label-chip").textContent)).toEqual([
      "chart 1",
      "table 1",
      "metric 1",
    ])
    expect(within(figures[1]).getByTestId("artifact-caption")).toHaveTextContent(
      "table 1Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows",
    )
    expect(within(figures[2]).getByTestId("artifact-caption")).toHaveTextContent(
      /^metric 1Data: query_tables · Quarterly_Report_FY25\.pdf p\.4$/,
    )

    expect(within(figures[0]).getByTestId("chart-body")).toBeInTheDocument()

    // The table inside the block sorts on click (text, not presence).
    const revenue = within(figures[1]).getByRole("columnheader", { name: /revenue/ })
    fireEvent.click(within(revenue).getByRole("button"))
    const firstRow = within(figures[1]).getAllByRole("row")[1]
    expect(within(firstRow).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Q1", "LATAM", "210"])
  })

  it("shows the same-size busy frame while the chart chunk loads", async () => {
    // A fresh module graph, so the lazy chart has not resolved in an earlier test.
    vi.resetModules()
    const { ArtifactBlock: Fresh } = await import("../ArtifactBlock")
    render(<Fresh artifacts={[chartBar]} />)
    const busy = screen.getByTestId("artifact-block").querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
    expect(busy).toHaveClass("h-[240px]")
    expect(busy?.textContent).toBe("")
  })

  it("the reload placeholder renders the data-missing notice", () => {
    render(<ArtifactBlock artifacts={[missing]} />)
    const n = screen.getByTestId("artifact-notice")
    expect(n).toHaveAttribute("role", "note")
    expect(n).toHaveTextContent("This artifact can't be shown")
    expect(n).toHaveTextContent("its saved data could not be found. Ask the agent to draw it again.")
    expect(n).toHaveTextContent("The rest of the answer is unaffected.")
  })

  it("an unknown component and a pie chart become notices; the valid sibling still renders", () => {
    const unknown = mutable(table16)
    unknown.id = "a_aaaaaaaaaa"
    unknown.component = "gauge_widget"
    const pie = mutable(chartBar)
    pie.id = "a_bbbbbbbbbb"
    pie.spec.chart.kind = "pie"
    const { container } = render(<ArtifactBlock artifacts={[unknown, pie, table16]} />)
    const list = screen.getByTestId("artifact-list")
    const slots = Array.from(list.children).map((el) => el.getAttribute("data-testid"))
    expect(slots).toEqual(["artifact-notice", "artifact-notice", "artifact-block"])
    const notices = screen.getAllByTestId("artifact-notice")
    expect(notices[0]).toHaveTextContent("it asked for something other than a chart, table or metric.")
    expect(notices[1]).toHaveTextContent(
      "it asked for a pie chart, which isn't one of the chart kinds we can draw.",
    )
    assertNoSpecLeak(container.textContent ?? "")
    expect(container.textContent).not.toContain("gauge_widget")
  })

  it("a component that throws becomes the render-failed notice; its siblings survive", () => {
    flags.throwTable = true
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { container } = render(<ArtifactBlock artifacts={[metricWithDelta, table16]} />)
    const list = screen.getByTestId("artifact-list")
    expect(Array.from(list.children).map((el) => el.getAttribute("data-testid"))).toEqual([
      "artifact-block",
      "artifact-notice",
    ])
    expect(screen.getByTestId("artifact-notice")).toHaveTextContent(
      "something went wrong while drawing it. Reload the page to try again.",
    )
    expect(screen.getByTestId("metric-value")).toHaveTextContent("$1,656K")
    assertNoSpecLeak(container.textContent ?? "")
    // The only console noise is React's own boundary log.
    expect(errSpy).toHaveBeenCalled()
  })

  it("a chart chunk that fails to load renders the chart-unavailable notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const Failing = lazyChartFrom(() => Promise.reject(new Error("Failed to fetch dynamically imported module")))
    const record = (await import("../artifactSpec")).parseArtifactRecord(chartBar)
    if (!record.ok) throw new Error("fixture must parse")
    const { container } = render(
      <ArtifactErrorBoundary>
        <Suspense fallback={null}>
          <Failing record={record.record} />
        </Suspense>
      </ArtifactErrorBoundary>,
    )
    expect(await screen.findByTestId("artifact-notice")).toHaveTextContent(
      "the chart viewer didn't load. Reload the page to try again.",
    )
    assertNoSpecLeak(container.textContent ?? "")
    expect(container.textContent).not.toContain("dynamically")
  })
})

/**
 * Phase 280 (DEBT-08 / D-06 / D-07, SC#5's failure mode) — retention KEEPS chat artifacts.
 *
 * Retention may delete the document a chart was built from; the artifact row stays (it is a
 * conversation record, immutable, with no document_id). The failure this pins is "says keep, and the
 * artifact then renders a broken reference with no explanation". Decision record:
 * docs/RETENTION-AND-ARTIFACTS.md.
 *
 * ⚠ 280-REVIEW IN-06 — WHAT THIS CAN AND CANNOT SEE, stated rather than implied. The client holds no
 *   signal that a source was disposed, so there is no "disposed" record to build: the fixture below is
 *   an ORDINARY artifact whose caption names `contract.pdf` (it used to be called `disposed`, which
 *   claimed a distinction the test cannot draw). What it pins is the property that makes disposal
 *   harmless for EVERY artifact: the source is plain caption text and nothing in the block is a link,
 *   so nothing can render as a broken reference. If a future caption ever links its source, this test
 *   is where that change must answer for a disposed document.
 *   The caption is asserted in pieces, not as one string glued across adjacent text nodes, so markup
 *   that is irrelevant to D-06 (the label chip sitting beside "Data:") cannot break it.
 */
describe("an artifact's source is plain text, so a disposed source cannot break it (DEBT-08)", () => {
  it("names the source file as caption text and renders no link anywhere in the block", () => {
    const sourceNamedArtifact = {
      ...clone(table16),
      id: "a_r7t280d0c8",
      caption: {
        row_count: 16,
        sources: [{ tool: "query_tables", document: "contract.pdf", page: null }],
        source_count: 1,
        lineage: null,
      },
    }
    render(<ArtifactBlock artifacts={[sourceNamedArtifact]} />)
    const figure = screen.getByTestId("artifact-block")
    const caption = within(figure).getByTestId("artifact-caption")
    expect(caption).toHaveTextContent(/Data: query_tables · contract.pdf · 16 rows/)
    expect(within(figure).getByTestId("artifact-label-chip")).toHaveTextContent("table 1")
    expect(within(figure).queryByRole("link")).toBeNull()
    expect(figure.querySelector("a")).toBeNull()
  })
})
