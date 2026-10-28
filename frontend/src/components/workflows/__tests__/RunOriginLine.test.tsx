// @vitest-environment jsdom
/**
 * Phase 293-03 (START-04 / D-24) — the one origin sentence as a leaf, and the two run-surface
 * mounts that use it. The mounts are pinned by SOURCE so the G-5 budget holds: exactly one
 * `<RunOriginLine` in each hot file and no new hook there.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import runPageRaw from "@/pages/WorkflowRunPage.tsx?raw"
import reportRaw from "../RunEvidenceReport.tsx?raw"
import lineRaw from "../RunOriginLine.tsx?raw"
import { RunOriginLine } from "../RunOriginLine"

const count = (src: string, needle: string) => src.split(needle).length - 1

describe("RunOriginLine (293-03)", () => {
  it("renders nothing when the origin is absent or unknown", () => {
    const { container, rerender } = render(<RunOriginLine />)
    expect(container.innerHTML).toBe("")
    rerender(<RunOriginLine origin={null} />)
    expect(container.innerHTML).toBe("")
    rerender(
      <RunOriginLine
        origin={{ kind: "manual", label: null, actor_name: null } as unknown as never}
      />,
    )
    expect(container.innerHTML).toBe("")
  })

  it("a key origin: the sentence, its kind, a hidden icon, muted not accent", () => {
    render(<RunOriginLine origin={{ kind: "key", label: "n8n-prod", actor_name: null }} />)
    const el = screen.getByTestId("run-origin")
    expect(el.textContent).toBe("Started by key n8n-prod")
    expect(el.getAttribute("data-origin-kind")).toBe("key")
    expect(el.className).toContain("text-muted-foreground")
    expect(el.className).not.toContain("text-primary")
    const icon = el.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute("aria-hidden")).toBe("true")
    expect(icon!.getAttribute("class")).toContain("lucide-key-round")
  })

  it("a schedule origin uses the calendar clock, an app origin the app window", () => {
    const { rerender } = render(
      <RunOriginLine origin={{ kind: "schedule", label: "Monday digest", actor_name: null }} />,
    )
    let el = screen.getByTestId("run-origin")
    expect(el.textContent).toBe("Started by schedule Monday digest")
    expect(el.querySelector("svg")!.getAttribute("class")).toContain("lucide-calendar-clock")
    rerender(<RunOriginLine origin={{ kind: "app", label: null, actor_name: "Dana Whitfield" }} />)
    el = screen.getByTestId("run-origin")
    expect(el.textContent).toBe("Started in the app by Dana Whitfield")
    expect(el.getAttribute("data-origin-kind")).toBe("app")
    expect(el.querySelector("svg")!.getAttribute("class")).toContain("lucide-app-window")
  })

  it("renders a hostile label as literal text, never as HTML", () => {
    const evil = '<img src=x onerror="alert(1)">'
    const { container } = render(
      <RunOriginLine origin={{ kind: "key", label: evil, actor_name: null }} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByTestId("run-origin").textContent).toBe(`Started by key ${evil}`)
  })

  it("is a leaf: no API import and no hook", () => {
    expect(lineRaw).not.toMatch(/from "@\/lib\/api/)
    expect(lineRaw).not.toMatch(/\buse[A-Z]\w*\(/)
  })

  it("the run page and the evidence report mount it exactly once, with no new hook (G-5)", () => {
    expect(count(runPageRaw, "<RunOriginLine")).toBe(1)
    expect(runPageRaw).toContain("<RunOriginLine origin={run?.origin} />")
    expect(count(runPageRaw, "useState(")).toBe(1)
    expect(count(runPageRaw, "useEffect(")).toBe(4)
    expect(count(reportRaw, "<RunOriginLine")).toBe(1)
    expect(reportRaw).toContain("<RunOriginLine origin={view.origin} />")
    expect(count(reportRaw, "useState(")).toBe(2)
    // D-297-12 (Phase 297-02, D-18 / D-33): RE-TARGETED 2 -> 1, not loosened. The report's
    // `?run=` writer effect was DELETED (the route owns the run's address now), so one effect
    // is left: the evidence fetch. The fence's job — no NEW hook — is unchanged and still exact.
    expect(count(reportRaw, "useEffect(")).toBe(1)
  })
})
