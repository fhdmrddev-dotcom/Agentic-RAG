/**
 * Phase 273-02 Task 3 — ChartArtifact (D-05 · SC#1 · UI-D-07 · UI-D-08 · UI-D-09).
 *
 * recharts is MOCKED here (RESEARCH Pitfall 9: jsdom has no layout, so a real ResponsiveContainer
 * measures 0 and draws nothing). Each mock series renders a marker carrying the props the contract
 * is about — `hide`, `isAnimationActive`, the colour and the bar radius — so the assertions read what
 * ChartArtifact actually handed recharts. A file-local ResizeObserver stub is installed as well, so
 * nothing here depends on setupTests. Real hover is the G-4 Chrome drive's job.
 */
import { createElement, type ReactNode } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import ChartArtifact, { ChartTooltipContent } from "../ChartArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { chartBar, chartLine, chartAreaStacked, chartScatter, chartRedrawn, chartFromFilter } from "./fixtures"

const seen = vi.hoisted(() => ({ yAxis: [] as Array<Record<string, unknown>> }))

vi.mock("recharts", () => {
  const box =
    (name: string) =>
    ({ children, stackOffset }: { children?: ReactNode; stackOffset?: string }) =>
      createElement("div", { "data-recharts": name, "data-stack-offset": String(stackOffset ?? "") }, children)
  const series = (type: string) => (props: Record<string, unknown>) =>
    createElement("div", {
      "data-testid": "series",
      "data-type": type,
      "data-key": String(props.dataKey ?? props.name ?? ""),
      "data-name": String(props.name ?? ""),
      "data-hide": String(Boolean(props.hide)),
      "data-anim": String(props.isAnimationActive),
      "data-fill": String(props.fill ?? ""),
      "data-stroke": String(props.stroke ?? ""),
      "data-stack": String(props.stackId ?? ""),
      "data-radius": String(props.radius ?? ""),
    })
  return {
    ResponsiveContainer: box("ResponsiveContainer"),
    BarChart: box("BarChart"),
    LineChart: box("LineChart"),
    AreaChart: box("AreaChart"),
    ScatterChart: box("ScatterChart"),
    Bar: series("Bar"),
    Line: series("Line"),
    Area: series("Area"),
    Scatter: series("Scatter"),
    XAxis: () => null,
    YAxis: (props: Record<string, unknown>) => {
      seen.yAxis.push(props)
      return null
    },
    CartesianGrid: () => null,
    Tooltip: () => null,
  }
})

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", RO)
})

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

function legendButtons() {
  return screen.queryAllByRole("button")
}

function seriesEl(key: string) {
  return screen.getAllByTestId("series").find((el) => el.getAttribute("data-key") === key)!
}

describe("ChartArtifact — the four kinds", () => {
  it.each([
    ["bar", chartBar, "Bar", ["Americas", "EMEA", "APAC", "LATAM"], "Bar chart: FY25 revenue by region · $K, 4 rows"],
    ["line", chartLine, "Line", ["Self-serve", "Enterprise"], "Line chart: Active accounts per month, 6 rows"],
    ["area", chartAreaStacked, "Area", ["Email", "Chat", "Phone"], "Stacked area chart: Support tickets by channel, 4 rows"],
    ["scatter", chartScatter, "Scatter", ["Mid-market", "Enterprise"], "Scatter chart: Deal size vs. sales cycle, 6 rows"],
  ] as const)("%s: a toggle per series, an accessible plot, no animation", (_kind, fixture, type, names, label) => {
    render(<ChartArtifact record={rec(fixture)} />)
    const buttons = legendButtons()
    expect(buttons.map((b) => b.textContent)).toEqual([...names])
    for (const b of buttons) {
      expect(b).toHaveAttribute("type", "button")
      expect(b).toHaveAttribute("aria-pressed", "true")
      expect(b).toHaveClass("text-foreground", "h-8", "sm:h-6")
    }
    const plot = screen.getByRole("img")
    expect(plot).toHaveAttribute("aria-label", label)
    expect(plot).toHaveClass("h-[240px]")
    const sr = document.getElementById(plot.getAttribute("aria-describedby")!)!
    expect(sr).toHaveClass("sr-only")
    expect(sr.textContent).toMatch(/^Series: /)

    const series = screen.getAllByTestId("series")
    expect(series).toHaveLength(names.length)
    for (const s of series) {
      expect(s.getAttribute("data-type")).toBe(type)
      expect(s.getAttribute("data-anim")).toBe("false")
    }
  })

  it("a single series has no legend (the title names it)", () => {
    render(<ChartArtifact record={rec(chartFromFilter)} />)
    expect(legendButtons()).toHaveLength(0)
    expect(screen.getAllByTestId("series")).toHaveLength(1)
  })

  it("series colour comes from the stored slot as var(--chart-N)", () => {
    render(<ChartArtifact record={rec(chartBar)} />)
    expect(seriesEl("s0").getAttribute("data-fill")).toBe("var(--chart-1)")
    expect(seriesEl("s2").getAttribute("data-fill")).toBe("var(--chart-3)")
    render(<ChartArtifact record={rec(chartLine)} />)
    const lines = screen.getAllByTestId("series").filter((s) => s.getAttribute("data-type") === "Line")
    expect(lines.map((l) => l.getAttribute("data-stroke"))).toEqual(["var(--chart-1)", "var(--chart-2)"])
  })
})

describe("ChartArtifact — legend toggles (SC#1)", () => {
  it("hiding EMEA strikes it through, hides its series, and never repaints the survivors", () => {
    render(<ChartArtifact record={rec(chartBar)} />)
    const emea = screen.getByRole("button", { name: "EMEA" })
    fireEvent.click(emea)
    expect(emea).toHaveAttribute("aria-pressed", "false")
    expect(emea).toHaveClass("line-through", "text-muted-foreground")
    expect(within(emea).getByTestId("legend-swatch")).toHaveClass("opacity-25")
    expect(seriesEl("s1").getAttribute("data-hide")).toBe("true")
    expect(seriesEl("s0").getAttribute("data-hide")).toBe("false")

    const apac = screen.getByRole("button", { name: "APAC" })
    expect(within(apac).getByTestId("legend-swatch")).toHaveAttribute("data-color", "var(--chart-3)")
    expect(seriesEl("s2").getAttribute("data-fill")).toBe("var(--chart-3)")

    fireEvent.click(emea)
    expect(emea).toHaveAttribute("aria-pressed", "true")
    expect(seriesEl("s1").getAttribute("data-hide")).toBe("false")
  })

  it("hiding every series says so, and the plot keeps 240px", () => {
    render(<ChartArtifact record={rec(chartLine)} />)
    for (const b of legendButtons()) fireEvent.click(b)
    expect(screen.getByText("All series hidden. Turn one back on above.")).toBeInTheDocument()
    expect(screen.getByRole("img")).toHaveClass("h-[240px]")
  })

  it("the y-domain is recomputed from the visible series, from 0 for bars", () => {
    seen.yAxis.length = 0
    render(<ChartArtifact record={rec(chartBar)} />)
    expect(seen.yAxis[seen.yAxis.length - 1].domain).toEqual([0, 2000])
    for (const name of ["Americas", "EMEA", "APAC"]) fireEvent.click(screen.getByRole("button", { name }))
    expect(seen.yAxis[seen.yAxis.length - 1].domain).toEqual([0, 300])
  })

  it("stacked bars round only the top-most VISIBLE segment", () => {
    render(<ChartArtifact record={rec(chartRedrawn)} />)
    const radii = () => ["s0", "s1", "s2", "s3"].map((k) => seriesEl(k).getAttribute("data-radius"))
    expect(radii()).toEqual(["0,0,0,0", "0,0,0,0", "0,0,0,0", "4,4,0,0"])
    expect(seriesEl("s0").getAttribute("data-stack")).not.toBe("")
    fireEvent.click(screen.getByRole("button", { name: "LATAM" }))
    expect(radii()).toEqual(["0,0,0,0", "0,0,0,0", "4,4,0,0", "0,0,0,0"])
  })

  it("grouped bars round every bar", () => {
    render(<ChartArtifact record={rec(chartBar)} />)
    expect(screen.getAllByTestId("series").map((s) => s.getAttribute("data-radius"))).toEqual(
      Array(4).fill("4,4,0,0"),
    )
    expect(seriesEl("s0").getAttribute("data-stack")).toBe("")
  })
})

describe("ChartTooltipContent", () => {
  it("lists visible series at Q3 high-first with grouped values", () => {
    render(
      <ChartTooltipContent active payload={[{ payload: { __i: 2 } }]} record={rec(chartBar)} hidden={new Set([1])} />,
    )
    const tip = screen.getByTestId("artifact-tooltip")
    expect(within(tip).getByTestId("tooltip-header")).toHaveTextContent("Q3")
    const rows = within(tip).getAllByTestId("tooltip-row")
    expect(rows.map((r) => r.textContent)).toEqual(["Americas1,402", "APAC731", "LATAM251"])
    expect(within(tip).queryByTestId("tooltip-total")).toBeNull()
  })

  it("stacked forms add a Total equal to the visible sum", () => {
    render(
      <ChartTooltipContent active payload={[{ payload: { __i: 3 } }]} record={rec(chartRedrawn)} hidden={new Set()} />,
    )
    expect(screen.getByTestId("tooltip-total")).toHaveTextContent("Total3,740")
  })

  it("renders nothing when inactive", () => {
    const { container } = render(
      <ChartTooltipContent active={false} payload={[]} record={rec(chartBar)} hidden={new Set()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("scatter names the series, then x and y with their values", () => {
    render(
      <ChartTooltipContent
        active
        payload={[{ payload: { __i: 3, __s: 1, x: 62, y: 340 } }]}
        record={rec(chartScatter)}
        hidden={new Set()}
      />,
    )
    const tip = screen.getByTestId("artifact-tooltip")
    expect(within(tip).getByTestId("tooltip-header")).toHaveTextContent("Enterprise")
    expect(within(tip).getAllByTestId("tooltip-row").map((r) => r.textContent)).toEqual([
      "cycle days62",
      "Enterprise340",
    ])
  })
})

describe("273-REVIEW WR-05 — stacked forms stack by sign", () => {
  // recharts' default stackOffset "none" stacks cumulatively: [5, -3] drew the second segment from 5
  // DOWN to 2, inside the first, while the tooltip said −3 and visibleDomain assumed sign stacking.
  const plot = (name: string) =>
    document.querySelector(`[data-recharts="${name}"]`)!.getAttribute("data-stack-offset")

  it("a stacked bar chart uses stackOffset=sign", () => {
    render(<ChartArtifact record={rec(chartRedrawn)} />)
    expect(plot("BarChart")).toBe("sign")
  })

  it("an area chart (always stacked) uses stackOffset=sign", () => {
    render(<ChartArtifact record={rec(chartAreaStacked)} />)
    expect(plot("AreaChart")).toBe("sign")
  })

  it("grouped bars are not stacked at all", () => {
    render(<ChartArtifact record={rec(chartBar)} />)
    expect(plot("BarChart")).toBe("")
  })
})
