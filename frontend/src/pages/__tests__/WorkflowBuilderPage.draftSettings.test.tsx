/**
 * Phase 288-01 (AUTH-03 / D-01..D-04 / D-06 / A-01 / A-02) — a RE-OPENED draft keeps a visible,
 * working settings row, and one draft never shows another's configuration.
 *
 * WHAT THIS PROVES
 *  - opening a stored draft (initial draft id, canvas flag on) shows `draft-settings-row`, NOT
 *    `draft-arrival-card` (the receipt is arrival-only: `showReceipt` has one setter);
 *  - expanding it shows `decision-name-input`; typing writes through `builderStore.setName` and
 *    the next autosave body carries the new name;
 *  - flag OFF: no graph column, so no slot and no row;
 *  - the A-B-A regression: draft A, then B, then A never shows B's name or step configuration
 *    inside A.
 *
 * ⚠ THE A-B-A PIN IS NOT SC#2 EVIDENCE. A-01: the store is created PER MOUNT and the Builder
 * unmounts between drafts, so bleed cannot be reproduced by reading; this pins the code path,
 * and only the S2 browser drive (plan 04) proves the lived behaviour. The `canvasNudge`
 * module-level session bucket is cosmetic and out of scope (Pitfall 9).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const {
  mockGenerate,
  mockCreate,
  mockUpdate,
  mockListFolders,
  mockListSkills,
  mockListConnections,
  mockValidate,
  mockBundle,
  mockPublish,
  mockListDrafts,
} = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListConnections: vi.fn(),
  mockValidate: vi.fn(),
  mockBundle: vi.fn(),
  mockPublish: vi.fn(),
  mockListDrafts: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
  generateWorkflow: mockGenerate,
  createWorkflowDraft: mockCreate,
  updateWorkflowDraft: mockUpdate,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listConnectorConnections: mockListConnections,
  discoverConnectorTools: () => Promise.resolve([]),
  updateConnectorGrants: () => Promise.resolve({}),
  validateWorkflow: mockValidate,
  getGroundingBundle: mockBundle,
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
  publishWorkflow: mockPublish,
  listDraftWorkflows: mockListDrafts,
}))

import { WorkflowBuilderPage, type BuilderDefinition } from "../WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false }
const FLAG_OFF = { features: {}, loading: false }

function draftDef(tag: string): BuilderDefinition {
  return {
    slug: `wf-${tag.toLowerCase()}`,
    version: 1,
    status: "draft",
    name: `${tag}-NAME`,
    business_requirement: `${tag}-REQUIREMENT`,
    phases: [
      {
        slug: "step-one",
        phase_index: 0,
        name: `${tag}-STEP`,
        config: { phase_type: "llm_single", prompt: `${tag}-PROMPT` },
      },
    ],
  } as unknown as BuilderDefinition
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  mockListConnections.mockResolvedValue([])
  mockListDrafts.mockResolvedValue([])
  mockCreate.mockResolvedValue({ id: "created-1", version: 1, token: "tok-created" })
  mockUpdate.mockResolvedValue({ id: "draft-1", version: 1, token: "tok-patched" })
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [], kb_tools: [] })
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function renderDraft(
  tag: string,
  draftId: string,
  features: { features: EffectiveFeatures; loading: boolean } = FLAG_ON,
) {
  return render(
    <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowBuilderPage initial={{ definition: draftDef(tag), draftId }} />
      </div>
    </EffectiveFeaturesProvider>,
  )
}

describe("288-01 — a re-opened draft keeps a working settings row", () => {
  it("shows the collapsed row, not the arrival card; expanding shows the name input", async () => {
    renderDraft("ALPHA", "draft-a")
    const row = await screen.findByTestId("draft-settings-row")
    expect(row).toBeTruthy()
    expect(screen.queryByTestId("draft-arrival-card")).toBeNull()
    expect(screen.queryByTestId("decision-name-input")).toBeNull()

    fireEvent.click(screen.getByTestId("draft-settings-toggle"))
    const input = (await screen.findByTestId("decision-name-input")) as HTMLInputElement
    expect(input.value).toBe("ALPHA-NAME")
  })

  it("the row occupies the card slot: the graph column has THREE children", async () => {
    renderDraft("ALPHA", "draft-a")
    await screen.findByTestId("draft-settings-row")
    const column = screen.getByTestId("builder-grid").children[0] as HTMLElement
    expect(column.children.length).toBe(3)
    expect(column.children[1]).toHaveAttribute("data-testid", "draft-settings-row")
  })

  it("renaming writes through setName and the next autosave body carries the new name", async () => {
    renderDraft("ALPHA", "draft-a")
    await screen.findByTestId("draft-settings-row")
    fireEvent.click(screen.getByTestId("draft-settings-toggle"))
    const input = (await screen.findByTestId("decision-name-input")) as HTMLInputElement
    fireEvent.change(input, { target: { value: "RENAMED-ALPHA" } })
    expect(input.value).toBe("RENAMED-ALPHA")
    await waitFor(
      () => {
        const bodies = mockUpdate.mock.calls.map((c) => JSON.stringify(c[1]))
        expect(bodies.some((b) => b.includes("RENAMED-ALPHA"))).toBe(true)
      },
      { timeout: 4000 },
    )
    // The write path never mints a second row for an existing draft.
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("flag OFF: no graph column, so no slot and no row", async () => {
    renderDraft("ALPHA", "draft-a", FLAG_OFF)
    await screen.findByTestId("builder-grid")
    expect(screen.queryByTestId("draft-settings-row")).toBeNull()
    expect(screen.queryByTestId("draft-arrival-card")).toBeNull()
  })

  it("D-04: the row is the Builder's only — a draft-only surface (no published-gate code exists)", async () => {
    // The Builder is handed draft rows only; publication returns to the library. This pins the
    // observable half: the draft's own row is present and the page prop is a plain constant.
    renderDraft("ALPHA", "draft-a")
    expect(await screen.findAllByTestId("draft-settings-row")).toHaveLength(1)
  })
})

describe("288-01 — A-B-A: one draft never shows another's configuration (A-01 regression)", () => {
  it("opening A, then B, then A never shows B's name or step configuration inside A", async () => {
    // A-01: store is per mount; the Builder unmounts between drafts. No store change was made.
    // This is a code-path pin, NOT SC#2 evidence (that is the plan-04 S2 browser drive).
    const first = renderDraft("ALPHA", "draft-a")
    fireEvent.click(await screen.findByTestId("draft-settings-toggle"))
    expect(((await screen.findByTestId("decision-name-input")) as HTMLInputElement).value).toBe(
      "ALPHA-NAME",
    )
    expect(screen.getByTestId("builder-grid").textContent ?? "").toContain("ALPHA-STEP")
    first.unmount()

    const second = renderDraft("BRAVO", "draft-b")
    fireEvent.click(await screen.findByTestId("draft-settings-toggle"))
    expect(((await screen.findByTestId("decision-name-input")) as HTMLInputElement).value).toBe(
      "BRAVO-NAME",
    )
    expect(screen.getByTestId("builder-grid").textContent ?? "").not.toContain("ALPHA")
    second.unmount()

    const third = renderDraft("ALPHA", "draft-a")
    fireEvent.click(await screen.findByTestId("draft-settings-toggle"))
    expect(((await screen.findByTestId("decision-name-input")) as HTMLInputElement).value).toBe(
      "ALPHA-NAME",
    )
    const text = screen.getByTestId("builder-grid").textContent ?? ""
    expect(text).toContain("ALPHA-STEP")
    expect(text).not.toContain("BRAVO")
    third.unmount()
  })
})
