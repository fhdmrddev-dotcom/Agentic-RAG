/**
 * Phase 290-03 (VIS-01, D-06 / D-07, RESEARCH F-6) — the `Steps | Team` switch on the canvas.
 *
 * What this suite proves, and only this: the switch appears when, and only when, the builder
 * passes the `team` prop; Team replaces the plane and its regions with the read-only picture
 * and Steps brings them back; the header stops promising edits while Team is shown; and the
 * read-only view can never reorder the definition from the keyboard. The picture's own
 * content is `TeamPicture.test.tsx`'s; the header bytes with no `team` prop are pinned by
 * `__tests__/WorkflowCanvas.headerPin.test.tsx`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// FILE-LOCAL, never setupTests.ts (WorkflowCanvas.test.tsx:26-28).
import { mockReactFlow } from "@/test-utils/mockReactFlow"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import runPageSource from "@/pages/WorkflowRunPage?raw"
import { WorkflowCanvas, type CanvasNotice } from "./WorkflowCanvas"
import type { CanvasNode } from "./canvasModel"
import type { PhaseSpecJSON } from "./phaseVocabulary"
import { emptyDraft, evalCoverage } from "./__fixtures__/canvasFixtures"
import {
  TEAM_EMPTY_HEADING,
  TEAM_HEADER_HINT,
  TEAM_SWITCH_LABEL,
  TEAM_SWITCH_STEPS,
  TEAM_SWITCH_TEAM,
  teamFigureLabel,
} from "./teamVocabulary"

mockReactFlow()

beforeEach(() => {
  window.localStorage.clear()
})

const NAME = "Eval coverage"

function renderCanvas(
  phases: PhaseSpecJSON[],
  opts: {
    team?: { workflowName: string }
    editable?: boolean
    selectedSlug?: string | null
    onCommitNodes?: (nodes: readonly CanvasNode[]) => void
    notice?: CanvasNotice
  } = {},
) {
  return render(
    <TechnicalNamesProvider>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowCanvas
          phases={phases}
          selectedSlug={opts.selectedSlug ?? null}
          onSelectNode={vi.fn()}
          onClearSelection={vi.fn()}
          editable={opts.editable}
          onCommitNodes={opts.onCommitNodes}
          notice={opts.notice}
          team={opts.team}
        />
      </div>
    </TechnicalNamesProvider>,
  )
}

const switchList = () => screen.queryByRole("tablist", { name: TEAM_SWITCH_LABEL })
const teamFigure = () => screen.queryByRole("figure", { name: teamFigureLabel(NAME) })

describe("WorkflowCanvas — no team prop (the run-page path)", () => {
  it("renders no switch and mounts the plane", () => {
    const { container } = renderCanvas(evalCoverage)
    expect(switchList()).toBeNull()
    expect(screen.queryByTestId("canvas-view-team")).toBeNull()
    expect(container.querySelector(".react-flow")).not.toBeNull()
  })

  it("the run page mounts the canvas without a team prop (source fence)", () => {
    const calls = runPageSource.match(/<WorkflowCanvas\b[\s\S]*?\/>/g) ?? []
    // Positive control: the call is really found, so a zero below is not vacuous.
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).not.toMatch(/\bteam=/)
  })
})

describe("WorkflowCanvas — with the team prop (the builder)", () => {
  it("shows the switch before the ⌥ toggle, Steps selected, the plane mounted", () => {
    const { container } = renderCanvas(evalCoverage, { team: { workflowName: NAME } })
    const list = switchList()
    expect(list).not.toBeNull()
    const tabs = within(list!).getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual([TEAM_SWITCH_STEPS, TEAM_SWITCH_TEAM])
    expect(tabs[0].getAttribute("aria-selected")).toBe("true")
    expect(tabs[1].getAttribute("aria-selected")).toBe("false")
    const toggle = screen.getByRole("button", { name: /Technical names/ })
    expect(list!.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector(".react-flow")).not.toBeNull()
    expect(teamFigure()).toBeNull()
  })

  it("Team replaces the plane and regions; the header stops promising edits; Steps restores", async () => {
    const user = userEvent.setup()
    const { container } = renderCanvas(evalCoverage, {
      team: { workflowName: NAME },
      editable: true,
      notice: { kind: "refusal", text: "That step cannot move there." },
    })
    expect(screen.getByText("✎ Editing")).toBeTruthy()
    expect(screen.getByTestId("canvas-notice-refusal")).toBeTruthy()

    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_TEAM }))
    expect(teamFigure()).not.toBeNull()
    expect(container.querySelector(".react-flow")).toBeNull()
    expect(screen.queryByTestId("canvas-notice-refusal")).toBeNull()
    expect(screen.queryByTestId("canvas-bottom-region")).toBeNull()
    expect(screen.queryByText("✎ Editing")).toBeNull()
    expect(screen.getByText("👁 View only")).toBeTruthy()
    expect(screen.getByText(TEAM_HEADER_HINT)).toBeTruthy()
    expect(screen.getByTestId("canvas-view-team").getAttribute("aria-selected")).toBe("true")

    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_STEPS }))
    expect(teamFigure()).toBeNull()
    expect(container.querySelector(".react-flow")).not.toBeNull()
    expect(screen.getByText("✎ Editing")).toBeTruthy()
    expect(screen.queryByText(TEAM_HEADER_HINT)).toBeNull()
    expect(screen.getByTestId("canvas-notice-refusal")).toBeTruthy()
  })

  it("a 0-step definition: Team shows the empty state and no orchestrator", async () => {
    const user = userEvent.setup()
    renderCanvas(emptyDraft, { team: { workflowName: NAME }, editable: true })
    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_TEAM }))
    expect(screen.getByText(TEAM_EMPTY_HEADING)).toBeTruthy()
    expect(screen.queryByTestId("team-orchestrator")).toBeNull()
    expect(screen.queryByTestId("canvas-empty")).toBeNull()
  })

  it("read-only canvases get the switch too, and Team works (D-07)", async () => {
    const user = userEvent.setup()
    renderCanvas(evalCoverage, { team: { workflowName: NAME }, editable: false })
    expect(switchList()).not.toBeNull()
    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_TEAM }))
    expect(teamFigure()).not.toBeNull()
    expect(within(teamFigure()!).getAllByTestId("team-step")).toHaveLength(evalCoverage.length)
    expect(screen.getByText(TEAM_HEADER_HINT)).toBeTruthy()
  })
})

describe("WorkflowCanvas — the Team view never reorders (RESEARCH F-6)", () => {
  it("⌥→ commits in Steps, does nothing in Team, and commits again back in Steps", async () => {
    const user = userEvent.setup()
    const onCommitNodes = vi.fn()
    renderCanvas(evalCoverage, {
      team: { workflowName: NAME },
      editable: true,
      selectedSlug: "fanout",
      onCommitNodes,
    })

    // Positive control: the same event, fired the same way, reorders in Steps.
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true })
    expect(onCommitNodes).toHaveBeenCalledTimes(1)
    onCommitNodes.mockClear()

    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_TEAM }))
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true })
    fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true })
    expect(onCommitNodes).not.toHaveBeenCalled()

    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_STEPS }))
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true })
    expect(onCommitNodes).toHaveBeenCalledTimes(1)
  })
})
