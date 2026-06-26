/**
 * Phase 124-02 Task 2 (WUX-02, sketch 047-A variant A / D-01 / D-05) —
 * WorkflowDoorSwitch tests.
 *
 * These pin the locked two-door contract:
 *  - the "both" chooser renders BOTH door cards side by side.
 *  - the describe door shows the switch-to-govern strip + a WorkflowSoul preview,
 *    and the "‹ both doors" control returns to the chooser.
 *  - GOVERN-DOOR DELEGATION (the G-5 ?raw source-grep, mirroring
 *    PhaseSpineGraph.test.tsx:153-159): the source IMPORTS and renders
 *    <WorkflowBuilderPage> and does NOT re-implement the advanced governance
 *    controls inline (no own citation_policy editor / gate-chip / deriveTier
 *    re-derivation). A shallow render asserts the Builder mounts in the govern door.
 *  - llm_judge_rubric renders LOCKED / non-removable in the govern door.
 *  - the shell adds NO new api fetch path and NO local tier re-derivation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way — the
// G-5 grep precedent at PhaseSpineGraph.test.tsx:16-19,153-159).
import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"

// The govern door mounts the real WorkflowBuilderPage, which fetches folders + skills
// on mount (103-ux name maps). Mock the api seam so the unit render is offline.
const { mockListFolders, mockListSkills } = vi.hoisted(() => ({
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: vi.fn(),
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  listFolders: mockListFolders,
  listSkills: mockListSkills,
}))

import { WorkflowDoorSwitch } from "./WorkflowDoorSwitch"

/** A strict definition (citation_policy 'strict' + the full gate set) for the soul preview. */
const strictDef = {
  slug: "vendor-risk",
  version: 2,
  name: "Vendor-risk review",
  business_requirement: "Review a vendor's risk posture and produce a cited report.",
  phases: [
    { slug: "pull", phase_index: 0, name: "Pull", config: { phase_type: "programmatic" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render report",
      config: { phase_type: "llm_emit", citation_policy: "strict" },
      validators: [{ kind: "citations_required" }, { kind: "llm_judge_rubric" }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
})

describe("WorkflowDoorSwitch — the 'both' chooser (047-A variant A)", () => {
  it("renders BOTH door cards side by side at the default 'both' state", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    const describeDoor = screen.getByTestId("door-card-describe")
    const governDoor = screen.getByTestId("door-card-govern")
    expect(describeDoor).toHaveTextContent(/describe & run/i)
    expect(governDoor).toHaveTextContent(/author & govern/i)
  })

  it("defaults to 'both' but honours initialDoor='govern' (Open/Tweak land in govern)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    expect(screen.queryByTestId("workflow-doors")).not.toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — the describe door (loose, D-05)", () => {
  it("opening the describe door shows the switch-to-govern strip AND a WorkflowSoul preview", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    // The one-click "switch to Author & govern ›" strip (D-05).
    expect(screen.getByTestId("switch-strip")).toBeInTheDocument()
    expect(screen.getByTestId("switch-to-govern")).toHaveTextContent(/author & govern/i)
    // The soul PREVIEW of the current draft/definition.
    const preview = screen.getByTestId("describe-soul-preview")
    expect(within(preview).getByTestId("workflow-soul").getAttribute("data-scale")).toBe("card")
    // The describe box (the 018-A lineage).
    expect(screen.getByTestId("describe-box")).toBeInTheDocument()
  })

  it("the persistent '‹ both doors' control returns the describe door to the chooser", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("both-doors"))
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.queryByTestId("door-describe")).not.toBeInTheDocument()
  })

  it("the switch strip opens the govern door (advanced one click away — nothing removed)", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.click(screen.getByTestId("switch-to-govern"))
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })

  it("the describe CTA forwards the describe text to the existing draft path then opens govern", () => {
    const onDescribeDraft = vi.fn()
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={onDescribeDraft} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))
    expect(onDescribeDraft).toHaveBeenCalledWith("Summarise weekly vendor risk")
    // The govern door (the existing Builder) owns the actual generate→draft flow.
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — the govern door delegates to the existing Builder (D-05, T-124-07)", () => {
  it("the govern door mounts WorkflowBuilderPage (the Builder is mounted, not cloned)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    // The Builder's own fresh-describe screen renders inside the govern door (the
    // runtime companion to the source-grep — the Builder mounts, not a re-implementation).
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    expect(screen.getByTestId("describe-hint")).toBeInTheDocument()
  })

  it("the govern door renders the llm_judge_rubric as LOCKED / always-on (non-removable)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    const lock = screen.getByTestId("judge-locked")
    expect(lock).toHaveTextContent(/judge always-on/i)
    // It is a locked affordance, NOT a removable toggle (no checkbox / switch role).
    expect(lock.querySelector('input[type="checkbox"]')).toBeNull()
    expect(lock.getAttribute("role")).not.toBe("switch")
  })

  it("GOVERN-DOOR DELEGATION source-grep (G-5): imports + renders WorkflowBuilderPage, no inline governance clone", () => {
    const src = workflowDoorSwitchSource
    // It IMPORTS and RENDERS the existing Builder (delegation, not re-implementation).
    expect(src).toMatch(/import .*WorkflowBuilderPage/)
    expect(src).toMatch(/<WorkflowBuilderPage/)
    // It does NOT re-implement the advanced governance controls inline: no own
    // citation_policy editor, no gate-chip clone, no deriveTier re-derivation.
    expect(src).not.toMatch(/citation_policy/)
    expect(src).not.toMatch(/deriveTier|tierForDefinition/)
    expect(src).not.toMatch(/PhaseFormPanel/)
  })

  it("the shell adds NO new api fetch path and NO local tier re-derivation", () => {
    const src = workflowDoorSwitchSource
    // No direct api-client import (it delegates the draft/generate path via a handler).
    expect(src).not.toMatch(/from ["']@\/lib\/api["']/)
    // No local deriveTier / tierForDefinition (tier display is delegated to WorkflowSoul).
    expect(src).not.toMatch(/deriveTier\(|tierForDefinition\(/)
  })
})
