/**
 * Phase 292-02 Task 3 (I-3 · D-16 · D-18 · T-292-10 / -16) — THE RENDERER SOURCE FENCE.
 *
 * Every model string and every server excerpt in the seven new files must reach the page as a React
 * TEXT node. This reads each file's SOURCE through `?raw` and fails on any HTML-injection sink, any
 * diagram library, any code-from-string, and — in the timeline model — any clock read or any `Date`
 * built from a string (the off-by-one-day timezone trap).
 *
 * NON-VACUITY: each file is asserted non-empty and to contain its own export name, so a renamed or
 * emptied file cannot pass this fence by having nothing in it.
 */
import { describe, expect, it } from "vitest"
import diagramLayoutSrc from "../diagramLayout.ts?raw"
import diagramArtifactSrc from "../DiagramArtifact.tsx?raw"
import tooltipSrc from "../ArtifactTooltip.tsx?raw"
import comparisonModelSrc from "../comparisonModel.ts?raw"
import comparisonArtifactSrc from "../ComparisonArtifact.tsx?raw"
import timelineModelSrc from "../timelineModel.ts?raw"
import timelineArtifactSrc from "../TimelineArtifact.tsx?raw"

const FILES: Array<[string, string, string]> = [
  ["diagramLayout.ts", diagramLayoutSrc, "export function layoutDiagram"],
  ["DiagramArtifact.tsx", diagramArtifactSrc, "export function DiagramArtifact"],
  ["ArtifactTooltip.tsx", tooltipSrc, "export function ArtifactTooltip"],
  ["comparisonModel.ts", comparisonModelSrc, "export function isIdenticalTerm"],
  ["ComparisonArtifact.tsx", comparisonArtifactSrc, "export function ComparisonArtifact"],
  ["timelineModel.ts", timelineModelSrc, "export function buildRail"],
  ["TimelineArtifact.tsx", timelineArtifactSrc, "export function TimelineArtifact"],
]

const BANNED = ["dangerouslySetInnerHTML", "innerHTML", "outerHTML", "insertAdjacentHTML", "mermaid", "dagre", "elkjs", "new Function", "eval("]

describe("NON-VACUITY — every fenced file was read and is the file it claims to be", () => {
  for (const [name, src, exportName] of FILES) {
    it(`${name} is non-empty and declares ${exportName}`, () => {
      expect(src.length).toBeGreaterThan(200)
      expect(src).toContain(exportName)
    })
  }
})

describe("I-3 — no new file can render model text as markup", () => {
  it("none of the seven files contains an HTML sink, a diagram library or code-from-string", () => {
    for (const [name, src] of FILES) {
      for (const banned of BANNED) expect(src, `${name} contains ${banned}`).not.toContain(banned)
    }
  })

  it("the pure models import no UI framework", () => {
    for (const [name, src] of FILES.filter(([n]) => n.endsWith(".ts"))) {
      expect(src, name).not.toMatch(/from "react"/)
      expect(src, name).not.toMatch(/from "react-dom"/)
    }
  })
})

describe("D-18 — the timeline model reads no clock and parses no date string with Date", () => {
  it("no Date.now(), no Date built from an argument, no Intl", () => {
    expect(timelineModelSrc).not.toMatch(/Date\.now\(/)
    expect(timelineModelSrc).not.toMatch(/new Date\(\s*[^)\s]/)
    expect(timelineModelSrc).not.toContain("Intl")
  })

  it("the renderer reads the clock in exactly one place, with no argument", () => {
    expect(timelineArtifactSrc.match(/new Date\(/g)).toHaveLength(1)
    expect(timelineArtifactSrc).toContain("new Date()")
    expect(timelineArtifactSrc).not.toMatch(/Date\.now\(/)
  })
})

describe("T-292-13 — marker ids are per artifact", () => {
  it("the diagram derives its marker ids from useId and never ships a fixed one", () => {
    expect(diagramArtifactSrc).toContain("useId()")
    expect(diagramArtifactSrc).not.toContain('id="ah"')
  })
})
