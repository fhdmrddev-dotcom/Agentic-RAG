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
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way — the
// G-5 grep precedent at PhaseSpineGraph.test.tsx:16-19,153-159).
import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"

// The govern door mounts the real WorkflowBuilderPage, which fetches folders + skills
// on mount (103-ux name maps) and owns the generate→draft flow. Mock the api seam so
// the unit render is offline; the generate mock backstops the CR-01 auto-draft path.
const { mockGenerateWorkflow, mockListFolders, mockListSkills } = vi.hoisted(() => ({
  mockGenerateWorkflow: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerateWorkflow,
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
  // The Builder's generate→draft seam — resolve to a valid drafted definition so the
  // CR-01 auto-draft hand-off completes cleanly.
  mockGenerateWorkflow.mockResolvedValue({ ok: true, definition: { slug: "vendor-risk", phases: [] } })
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

  it("the describe CTA SEEDS the Builder and auto-runs the draft with the typed text (CR-01 — no data-loss dead-end)", async () => {
    // No onDescribeDraft handler passed — proves the door is self-sufficient and the
    // typed requirement survives the hand-off WITHOUT a parent callback (the gap CR-01
    // flagged: the only production call site never wired onDescribeDraft).
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))
    // The govern door's Builder auto-runs the EXISTING generate→draft flow with the
    // seeded text — the requirement is NOT dropped on the floor.
    await waitFor(() =>
      expect(mockGenerateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ describe: "Summarise weekly vendor risk" }),
      ),
    )
  })

  it("the switch-to-govern strip seeds the typed text but does NOT auto-draft (configure-first path)", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Configure strictness first" },
    })
    fireEvent.click(screen.getByTestId("switch-to-govern"))
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    // Choosing "Author & govern" is the configure-first path — no premature generate.
    expect(mockGenerateWorkflow).not.toHaveBeenCalled()
  })

  it("the soul preview reflects the typed business requirement live (WR-01)", () => {
    // No def passed → fresh build. The preview must track what the user types instead
    // of staying frozen on the honest empty-state.
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Draft a cited vendor-risk report" },
    })
    const preview = screen.getByTestId("describe-soul-preview")
    expect(within(preview).getByTestId("soul-purpose")).toHaveTextContent("Draft a cited vendor-risk report")
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

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-26 Task 2 (VOCAB-02 / VOCAB-03 · GAP A) — THE KB PICKER, MOUNTED, AND THE
// CHOICE CARRIED THROUGH TO THE REQUEST THE CLIENT ACTUALLY SENDS.
//
// APPENDED, never interleaved. Not one assertion above this line moves.
//
// THE MEASURED BEFORE-STATE. The operator probed this door's DOM for
// `project-folder-picker` at 1.5 s / 3 s / 5 s and found it ABSENT, with ZERO `/folders`
// requests recorded on the screen. Re-derived at HEAD before this block was written: the
// first case below was observed RED on the unmodified shell.
//
// THE FENCE THE UAT ASKS FOR is the round-trip one, and it is asserted on the REQUEST —
// `generateWorkflow`'s own argument — never on a prop being present. A prop can be
// threaded, renamed, shadowed or dropped one hop later and still look wired; the request
// is the only thing the server sees.
// ══════════════════════════════════════════════════════════════════════════════════

/** Two folders in the live `Folder` shape (`types/index.ts:470`). */
const kbFolder = (id: string, name: string) => ({
  id,
  user_id: "u-1",
  name,
  parent_id: null,
  is_org_shared: false,
  created_at: "2026-08-04T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
})

const KB_POLICIES = kbFolder("f-policies", "Policies")
const KB_CONTRACTS = kbFolder("f-contracts", "Contracts")

/** Open the describe door with folders on offer and wait for the picker to land. */
async function openDescribeDoorWithFolders() {
  mockListFolders.mockResolvedValue([KB_POLICIES, KB_CONTRACTS])
  render(<WorkflowDoorSwitch />)
  fireEvent.click(screen.getByTestId("door-card-describe"))
  return (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
}

describe("WorkflowDoorSwitch — the describe door can bind a knowledge base (GAP A)", () => {
  it("renders a KB picker ON THE DESCRIBE DOOR — the control the operator probed for and did not find", async () => {
    const select = await openDescribeDoorWithFolders()
    // Inside the describe door, not somewhere else on the page.
    expect(screen.getByTestId("door-describe").contains(select)).toBe(true)
    // …offering the opt-out first and then the real folders.
    const options = Array.from(select.querySelectorAll("option"))
    expect(options[0].value).toBe("")
    expect(options.map((o) => o.value)).toContain(KB_POLICIES.id)
  })

  it("offers NOTHING when there are no folders — the door stays exactly as it ships", async () => {
    mockListFolders.mockResolvedValue([])
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    expect(screen.queryByTestId("project-folder-picker")).toBeNull()
    // The describe box and the CTA are untouched by the picker's absence.
    expect(screen.getByTestId("describe-box")).toBeInTheDocument()
    expect(screen.getByTestId("describe-draft")).toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — THE PICKER NEVER BLOCKS (the fast path keeps its promise)", () => {
  it("with NOTHING chosen the CTA is enabled by TEXT ALONE, and one click still hands off", async () => {
    await openDescribeDoorWithFolders()

    const cta = screen.getByTestId("describe-draft")
    // Empty box ⇒ disabled, exactly as it ships. The picker did not change that rule.
    expect(cta).toBeDisabled()

    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    // Text alone enables it — no knowledge base was chosen and none was asked for.
    expect(cta).toBeEnabled()
    expect((screen.getByTestId("project-folder-picker") as HTMLSelectElement).value).toBe("")

    fireEvent.click(cta)
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })

  it("choosing NOTHING sends NO project_folder_id key at all — absent, not undefined, not ''", async () => {
    await openDescribeDoorWithFolders()
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(request.describe).toBe("Summarise weekly vendor risk")
    // The shipped `...(projectFolderId ? … : {})` spread's own property: the KEY is absent.
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })
})

describe("WorkflowDoorSwitch — THE ROUND TRIP: a loose-door workflow can be born BOUND", () => {
  it("a folder chosen on the door reaches generateWorkflow's project_folder_id", async () => {
    const select = await openDescribeDoorWithFolders()

    fireEvent.change(select, { target: { value: KB_CONTRACTS.id } })
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))

    // Asserted on the REQUEST the client sends — the only thing the server sees.
    await waitFor(() =>
      expect(mockGenerateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          describe: "Summarise weekly vendor risk",
          project_folder_id: KB_CONTRACTS.id,
        }),
      ),
    )
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(request.project_folder_id).toBe(KB_CONTRACTS.id)
    // Never the NAME, which the wire would silently fail to bind.
    expect(request.project_folder_id).not.toBe(KB_CONTRACTS.name)
  })

  it("the choice SURVIVES a look around the chooser — a pick is not lost by curiosity", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })
    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Look around first" } })

    // Back to the chooser and in again. The one-shot draft hand-off clears (today's
    // behaviour, unchanged); the folder choice does NOT. Pinned so it is CHOSEN rather
    // than inherited.
    fireEvent.click(screen.getByTestId("both-doors"))
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("door-card-describe"))

    const again = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    expect(again.value).toBe(KB_POLICIES.id)
    // …and the returning trip did NOT re-fire the generate hand-off.
    expect(mockGenerateWorkflow).not.toHaveBeenCalled()
  })

  // ── CR-R5-01 — the fence that protects THE WIRE, not just the component ──
  //
  // The case above pins that a pick survives curiosity. Its shadow is the defect: a pick
  // that survives into a world where the folder is no longer offered would be SENT while
  // no control on screen could show it, and `POST /workflows/generate` mints
  // `unbound_retrieval` on `project_folder_id is None` — so a dead id suppresses the
  // verdict and unblocks Publish. These two assert on the REQUEST, which is the only
  // thing the server sees, and they are the reason the picker retracts.

  it("a pick whose folder is GONE on re-entry never reaches the wire", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })

    // Out and back in — and this time the server no longer offers that folder
    // (deleted, or scoped away by RLS between the two visits).
    fireEvent.click(screen.getByTestId("both-doors"))
    mockListFolders.mockResolvedValue([KB_CONTRACTS])
    fireEvent.click(screen.getByTestId("door-card-describe"))

    const again = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    await waitFor(() => expect(again.value).toBe(""))

    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Vendor risk" } })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })

  it("a pick survived into a FAILED re-fetch never reaches the wire either", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })

    // The harder half: the list could not be fetched at all, so NO picker renders and
    // the author has nothing on screen that could show or clear the binding.
    fireEvent.click(screen.getByTestId("both-doors"))
    mockListFolders.mockRejectedValue(new Error("network"))
    fireEvent.click(screen.getByTestId("door-card-describe"))

    await waitFor(() => expect(screen.queryByTestId("project-folder-picker")).toBeNull())

    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Vendor risk" } })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })

  it("SOURCE: the door mounts the picker component and wires the id to the govern mount", () => {
    const src = workflowDoorSwitchSource
    expect(src).toMatch(/<DescribeKbPicker/)
    expect(src).toMatch(/import .*DescribeKbPicker/)
    expect(src).toMatch(/initialProjectFolderId=/)
    // Still no second folder source on the shell itself — the picker owns the request.
    expect(src).not.toMatch(/from ["']@\/lib\/api["']/)
    expect(src).not.toMatch(/listFolders/)
  })

  it("POSITIVE CONTROL — every source needle above matches a planted literal", () => {
    expect('<DescribeKbPicker value={x} onChange={y} />').toMatch(/<DescribeKbPicker/)
    expect('import { DescribeKbPicker } from "./DescribeKbPicker"').toMatch(/import .*DescribeKbPicker/)
    expect('<WorkflowBuilderPage initialProjectFolderId={kb} />').toMatch(/initialProjectFolderId=/)
    expect('import { listFolders } from "@/lib/api"').toMatch(/from ["']@\/lib\/api["']/)
    expect('const f = await listFolders()').toMatch(/listFolders/)
  })
})
