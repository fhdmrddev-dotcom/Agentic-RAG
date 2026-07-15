/**
 * Phase 155 Plan 06 Task 1 — Run modal a11y contract (152 surface, WCAG 2.1 AA / D-01).
 *
 * The net-new 152 Run modal + its two run inputs (staged template File + KB-scope
 * override) + the victim-naming workflow-delete confirm are the D-12 inventory's
 * workflow cluster. This suite locks the D-01 zero-STRUCTURAL-violations bar AND
 * asserts the ROLES/NAMES the D-09 scenario-1 keyboard drive depends on so the
 * live operator walkthrough can succeed:
 *
 *   - the file input is the CLASSIC keyboard-trap spot (D-09): the hidden
 *     `<input type="file">` carries `aria-label="Upload template file"` +
 *     `tabIndex={-1}` (Tab passes THROUGH it — not a trap) and a visible proxy
 *     `<button>` with an accessible name does the interaction;
 *   - the remove-template ✕ has `aria-label="Remove template"`;
 *   - the KB-folder scope control is reachable by role + accessible name;
 *   - the launch/upload error renders as `role="alert"`;
 *   - the workflow-delete confirm Sheet is `role="dialog"` with an accessible name
 *     + a named "Delete forever" confirm (never colour-alone).
 *
 * VERIFY (do NOT rebuild) the shipped accessible-hidden-input + proxy-button
 * pattern. STRUCTURAL axe rules only (jsdom cannot compute colour-contrast — that
 * half is the live Chrome scan in 155-VALIDATION.md). No component source is
 * modified (test-only). The Radix Sheet portal OPEN state is asserted by role/name
 * (the 155-05 convention), not axe-scanned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, fireEvent, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

const {
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
  mockListStarters,
  mockPreview,
  mockDelete,
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListStarters: vi.fn(),
  mockPreview: vi.fn(),
  mockDelete: vi.fn(),
}))

// Mock the api seam (the RunModal.test harness set + the 152-04 delete clients so
// the workflow-delete confirm renders its terminal "Delete forever" control).
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
  getWorkflowDeletePreview: mockPreview,
  deleteWorkflowCascade: mockDelete,
}))

import { WorkflowsPage } from "../WorkflowsPage"
import type { Folder } from "@/types"

/** The bound author default (folder-aaa) + a distinct override target (folder-bbb)
 *  so the KB-scope <select> renders with a real override option. */
const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_global: false, created_at: "", updated_at: "" },
  { id: "folder-bbb", user_id: "u1", name: "Contracts", parent_id: null, is_global: false, created_at: "", updated_at: "" },
]

const boundPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu / Sheet use pointer-capture + scrollIntoView APIs jsdom does
  // not implement; stub them so the ⋯-menu opens under user-event (the standard shim).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockListPublished.mockResolvedValue([boundPublished])
  mockListDrafts.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

/** Render the page + open the Run modal off the first published card. */
async function openRunModal(onLaunch = vi.fn().mockResolvedValue(undefined)) {
  render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
  const cards = await screen.findAllByTestId("published-card")
  fireEvent.click(within(cards[0]).getByTestId("published-run"))
  const modal = await screen.findByTestId("run-modal")
  return { modal, onLaunch }
}

describe("RunModal a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — the open Run modal (idle)", async () => {
    const { modal } = await openRunModal()
    expect(await axe(modal)).toHaveNoViolations()
  })

  it("no aXe structural violations — a template File staged (the file-card + remove ✕)", async () => {
    const { modal } = await openRunModal()
    const file = new File(["stub"], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    expect(await axe(modal)).toHaveNoViolations()
  })
})

describe("RunModal a11y — D-09 scenario-1 file-input trap-spot contract", () => {
  it("the hidden file input is Tab-THROUGH (tabIndex=-1 + aria-label), never a trap", async () => {
    const { modal } = await openRunModal()
    // The hidden input is queryable by its accessible name (the a11y tree carries it),
    // but tabIndex=-1 means keyboard Tab passes THROUGH it — the classic file-input
    // trap is avoided by construction.
    const input = within(modal).getByLabelText("Upload template file") as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    expect(input.getAttribute("type")).toBe("file")
    expect(input.getAttribute("tabindex")).toBe("-1")
    expect(input.className).toContain("hidden")
  })

  it("a visible proxy <button> with an accessible name drives the upload (not the hidden input)", async () => {
    const { modal } = await openRunModal()
    const proxy = within(modal).getByTestId("run-template-upload")
    expect(proxy.tagName).toBe("BUTTON")
    // The proxy button carries its own accessible name (the visible "Upload template").
    expect(proxy).toHaveAccessibleName(/upload template/i)
  })

  it("the remove-template control carries aria-label='Remove template'", async () => {
    const { modal } = await openRunModal()
    const file = new File(["stub"], "template.docx", { type: "text/plain" })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    expect(within(modal).getByRole("button", { name: "Remove template" })).toBeInTheDocument()
  })
})

describe("RunModal a11y — KB-scope control + launch error roles/names", () => {
  it("the KB-folder scope control is reachable by role + accessible name", async () => {
    const { modal } = await openRunModal()
    // A native <select> wrapped by its <label> → role=combobox, named "Knowledge base:".
    const scope = within(modal).getByRole("combobox", { name: /knowledge base/i }) as HTMLSelectElement
    expect(scope.tagName).toBe("SELECT")
    // The override option is reachable by role+name inside the control.
    expect(within(scope).getByRole("option", { name: /Contracts/i })).toBeInTheDocument()
  })

  it("a launch failure surfaces the server message VERBATIM as role='alert'", async () => {
    const onLaunch = vi.fn().mockRejectedValue(new Error("Template too large — 25 MB max"))
    const { modal } = await openRunModal(onLaunch)
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "go" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    const alert = await within(modal).findByRole("alert")
    expect(alert).toHaveTextContent("Template too large — 25 MB max")
    // Still zero structural violations with the error surfaced.
    expect(await axe(modal)).toHaveNoViolations()
  })
})

describe("RunModal a11y — workflow-delete confirm (152 WFIN-03) role/name/confirm", () => {
  it("⋯ → Delete opens a role=dialog with an accessible name + a NAMED confirm button", async () => {
    mockPreview.mockResolvedValue({
      name: "Vendor-risk review",
      versions: 2,
      runs: 5,
      threads: 3,
      in_flight: 0,
    })
    const user = userEvent.setup()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn().mockResolvedValue(undefined)} />)
    const cards = await screen.findAllByTestId("published-card")
    await user.click(within(cards[0]).getByRole("button", { name: /workflow actions/i }))
    await user.click(await screen.findByTestId("published-delete"))

    // The Radix Sheet portals OPEN as role=dialog, named by its SheetTitle.
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAccessibleName(/delete this workflow\?/i)

    // The single destructive-weighted control is NAMED (never colour-alone) — the
    // word "Delete forever" carries the action, not the red styling.
    const confirm = await within(dialog).findByTestId("delete-forever")
    expect(confirm).toHaveAccessibleName(/delete forever/i)
    // The cancel-first choice is likewise a named control.
    expect(within(dialog).getByRole("button", { name: /keep it/i })).toBeInTheDocument()
  })
})
