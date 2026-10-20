/**
 * Phase 286-02 Task 1 (REG-07 / D-10 / D-12) — THE CHARACTERIZATION PIN FOR THE BUILDER'S
 * TWO SEAMS, WRITTEN ON THE UNMOVED PAGE.
 *
 * D-10 cuts two clusters out of `WorkflowBuilderPage.tsx`: (a) the id-to-name lookup maps and
 * their one mount read, and (b) the exported copy constants. This file was committed BEFORE
 * either moved, so a later red here means the move changed behaviour rather than a new test
 * finding its feet. The move commits must leave this file and its `.snap` byte-unchanged
 * (`git diff --numstat` empty).
 *
 * WHAT IS PINNED, AND WHY EACH ONE:
 *  - the page module's EXPORT SET and every copy constant's exact string, written here as
 *    literals ON PURPOSE (this is the one place a re-typed copy is the point: it is the value
 *    the move must preserve, compared against what the page still exports);
 *  - the three id-to-name reads each fire EXACTLY ONCE on mount (a doubled effect would be a
 *    doubled request on every Builder open — T-286-11);
 *  - the resolved faces show the folder, skill and connection NAMES, never the raw ids;
 *  - a connectors refusal cannot blank the skill names (the separate-`try` rule);
 *  - the read-only banner reads the SERVER'S annotation and fails closed on silence (T-286-09);
 *  - the drafted header bands and the graph column, as DOM, flag on and flag off.
 *
 * The api factory mirrors `WorkflowBuilderPage.canvas.test.tsx`'s, so this pin intercepts the
 * same `@/lib/api` specifier the page (and, after the move, the hook) imports.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

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

const FOLDER_ID = "aaaaaaaa-0000-4000-8000-000000000001"
const FOLDER_NAME = "Vendor Contracts"
const SKILL_ID = "bbbbbbbb-0000-4000-8000-000000000002"
const SKILL_NAME = "Invoice Checker"
const CONN_ID = "cccccccc-0000-4000-8000-000000000003"
const CONN_NAME = "Team Slack"
const READ_TOOL = "list_channels"

/** Three steps, one per lookup: a sole `folder_scope`, a `skill_ref`, and an
 *  `external_action` bound to a connection and a tool. Bound to the folder at definition
 *  level too, so the header chip has a name to resolve. */
function definitionFor(toolName: string): BuilderDefinition {
  return {
    slug: "vendor-brief",
    version: 1,
    status: "draft",
    business_requirement: "summarize vendor risk",
    project_folder_id: FOLDER_ID,
    phases: [
      {
        slug: "find",
        phase_index: 0,
        config: { phase_type: "llm_agent", prompt: "find", folder_scope: [FOLDER_ID] },
      },
      {
        slug: "assess",
        phase_index: 1,
        config: { phase_type: "llm_agent", prompt: "assess", skill_ref: SKILL_ID },
      },
      {
        slug: "post",
        phase_index: 2,
        config: {
          phase_type: "external_action",
          capability: "post_message",
          connection_id: CONN_ID,
          tool_name: toolName,
        },
      },
    ],
  } as unknown as BuilderDefinition
}

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false }
const FLAG_OFF = { features: {}, loading: false }

function connections(readOnlyHint: boolean | undefined) {
  return [
    {
      id: CONN_ID,
      name: CONN_NAME,
      mcp_server_url: null,
      discovered_tools: [
        readOnlyHint === undefined
          ? { name: READ_TOOL }
          : { name: READ_TOOL, annotations: { readOnlyHint } },
      ],
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
  mockListSkills.mockResolvedValue([{ id: SKILL_ID, name: SKILL_NAME }])
  mockListConnections.mockResolvedValue(connections(true))
  mockListDrafts.mockResolvedValue([])
  mockCreate.mockResolvedValue({ id: "created-1", version: 1, token: "tok-created" })
  mockUpdate.mockResolvedValue({ id: "draft-1", version: 1, token: "tok-patched" })
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function renderBuilder(
  features: { features: EffectiveFeatures; loading: boolean },
  toolName = READ_TOOL,
) {
  return render(
    <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowBuilderPage initial={{ definition: definitionFor(toolName), draftId: "draft-1" }} />
      </div>
    </EffectiveFeaturesProvider>,
  )
}

const spineText = () => screen.getByTestId("builder-grid").textContent ?? ""

/** Wait until every face that reads a map has settled to its NAME. */
async function settled() {
  await waitFor(() => {
    const text = spineText()
    expect(text).toContain(FOLDER_NAME)
    expect(text).toContain(SKILL_NAME)
    expect(text).toContain(CONN_NAME)
  })
}

/** Every element stacked ABOVE the graph column inside the render root — the header
 *  bands, outermost first (the `headerBandsAbove` walk the header suite uses). */
function headerBands(root: Element): string {
  const bands: Element[] = []
  let node: Element | null = screen.getByTestId("builder-grid")
  while (node !== null && node !== root) {
    let sib = node.previousElementSibling
    while (sib !== null) {
      bands.push(sib)
      sib = sib.previousElementSibling
    }
    node = node.parentElement
  }
  return bands
    .reverse()
    .map((b) => b.outerHTML)
    .join("\n")
}

// ── (b) the copy-constant exports ────────────────────────────────────────────────────

describe("286-02 pin — the page module's export set and copy values", () => {
  it("exports exactly the base set of names", async () => {
    const mod = await import("../WorkflowBuilderPage")
    expect(Object.keys(mod).sort()).toEqual([
      "EMPTY_DRAFT_INVITATION",
      "PUBLISHED_CONFLICT_MESSAGE",
      "REQUIREMENT_AI_MARK_EXPLANATION",
      "REQUIREMENT_AI_MARK_LABEL",
      "REQUIREMENT_INVITATION",
      "SAVED_STILL_A_DRAFT",
      "SAVING_PUBLISH_WAIT",
      "UNBOUND_KB_INVITATION",
      "UNSAVED_LEAVE_PROMPT",
      "WorkflowBuilderPage",
      "default",
      "useCanvasGate",
    ])
  })

  it("every copy constant keeps its exact base string", async () => {
    const mod = (await import("../WorkflowBuilderPage")) as unknown as Record<string, unknown>
    expect({
      EMPTY_DRAFT_INVITATION: mod.EMPTY_DRAFT_INVITATION,
      SAVING_PUBLISH_WAIT: mod.SAVING_PUBLISH_WAIT,
      UNBOUND_KB_INVITATION: mod.UNBOUND_KB_INVITATION,
      REQUIREMENT_INVITATION: mod.REQUIREMENT_INVITATION,
      REQUIREMENT_AI_MARK_LABEL: mod.REQUIREMENT_AI_MARK_LABEL,
      REQUIREMENT_AI_MARK_EXPLANATION: mod.REQUIREMENT_AI_MARK_EXPLANATION,
      UNSAVED_LEAVE_PROMPT: mod.UNSAVED_LEAVE_PROMPT,
    }).toEqual({
      EMPTY_DRAFT_INVITATION: "Add a step to get started",
      SAVING_PUBLISH_WAIT: "Saving your last change — Publish will be ready in a moment",
      UNBOUND_KB_INVITATION: "No knowledge base · searches everything",
      REQUIREMENT_INVITATION: "What must this workflow deliver? · required to publish",
      REQUIREMENT_AI_MARK_LABEL: "AI-proposed",
      REQUIREMENT_AI_MARK_EXPLANATION:
        "The generator proposed this line when this workflow was created. Edit it and this mark clears.",
      UNSAVED_LEAVE_PROMPT: "This draft has unsaved changes. Leave without saving?",
    })
  })

  it("the module-local unnameable-binding option still renders its words", async () => {
    // `UNNAMED_KB_OPTION` is NOT exported, so it is pinned through the DOM: a binding to a
    // folder outside the author's list renders the neutral sentence, never the raw id.
    mockListFolders.mockResolvedValue([])
    renderBuilder(FLAG_ON)
    const picker = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    const labels = Array.from(picker.options).map((o) => o.textContent)
    expect(labels).toContain("A knowledge base outside your folders")
    expect(labels.join(" ")).not.toContain(FOLDER_ID)
  })
})

// ── (a) the id-to-name maps and their one mount read ─────────────────────────────────

describe("286-02 pin — the id-to-name maps", () => {
  it("each of the three reads fires EXACTLY once on mount, and nothing re-fetches", async () => {
    renderBuilder(FLAG_ON)
    await settled()
    expect(mockListFolders).toHaveBeenCalledTimes(1)
    expect(mockListSkills).toHaveBeenCalledTimes(1)
    expect(mockListConnections).toHaveBeenCalledTimes(1)
    // UNNARROWED: the connections read takes no capability argument.
    expect(mockListConnections.mock.calls[0]).toEqual([])
  })

  it("the faces and the header chip show NAMES, never the raw ids", async () => {
    renderBuilder(FLAG_ON)
    await settled()
    const text = spineText()
    for (const id of [FOLDER_ID, SKILL_ID, CONN_ID]) expect(text).not.toContain(id)
    expect(text).toContain(`${CONN_NAME} · ${READ_TOOL}`)
    const picker = screen.getByTestId("project-folder-picker") as HTMLSelectElement
    expect(picker.value).toBe(FOLDER_ID)
    expect(picker.options[picker.selectedIndex]?.textContent).toBe(FOLDER_NAME)
  })

  it("flag OFF: the display-only chip reads the folder NAME", async () => {
    renderBuilder(FLAG_OFF)
    await waitFor(() =>
      expect(screen.getByTestId("builder-bound-folder").textContent).toContain(FOLDER_NAME),
    )
    expect(screen.getByTestId("builder-bound-folder").textContent).not.toContain(FOLDER_ID)
  })

  it("a connectors REFUSAL cannot blank the skill names (its own try)", async () => {
    mockListConnections.mockRejectedValue(new Error("no_encryption_key"))
    renderBuilder(FLAG_ON)
    await waitFor(() => expect(spineText()).toContain(SKILL_NAME))
    expect(spineText()).toContain(FOLDER_NAME)
    // The external step falls back to its destination-free face (the tool name alone).
    expect(spineText()).not.toContain(CONN_NAME)
    expect(spineText()).not.toContain(CONN_ID)
    expect(spineText()).toContain(READ_TOOL)
  })

  it("an explicit readOnlyHint=true reads ONLY READS (the server's own claim)", async () => {
    renderBuilder(FLAG_ON)
    await settled()
    await waitFor(() => expect(spineText()).toContain("ONLY READS"))
    expect(spineText()).not.toContain("CHANGES SOMETHING OUTSIDE")
  })

  it("NO annotation fails CLOSED to CHANGES SOMETHING OUTSIDE", async () => {
    mockListConnections.mockResolvedValue(connections(undefined))
    renderBuilder(FLAG_ON)
    await settled()
    expect(spineText()).toContain("CHANGES SOMETHING OUTSIDE")
    expect(spineText()).not.toContain("ONLY READS")
  })
})

// ── DOM captures ─────────────────────────────────────────────────────────────────────

describe("286-02 pin — the drafted Builder's DOM, after the reads resolve", () => {
  it("flag ON: header bands and graph column", async () => {
    const { container } = renderBuilder(FLAG_ON)
    await settled()
    await waitFor(() => expect(spineText()).toContain("ONLY READS"))
    expect(headerBands(container)).toMatchSnapshot("header-flag-on")
    expect(screen.getByTestId("builder-grid").innerHTML).toMatchSnapshot("grid-flag-on")
  })

  it("flag OFF: header bands and graph column", async () => {
    const { container } = renderBuilder(FLAG_OFF)
    await waitFor(() =>
      expect(screen.getByTestId("builder-bound-folder").textContent).toContain(FOLDER_NAME),
    )
    expect(headerBands(container)).toMatchSnapshot("header-flag-off")
    expect(screen.getByTestId("builder-grid").innerHTML).toMatchSnapshot("grid-flag-off")
  })
})
