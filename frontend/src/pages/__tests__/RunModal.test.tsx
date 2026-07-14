/**
 * Phase 152 Plan 03 Task 3 (WFIN-01 / WFIN-02) — RunModal run-input contract.
 *
 * The frontend Nyquist backstop for the Run modal's two new run inputs. It renders
 * the LIVE WorkflowsPage (the modal is internal to it), opens the modal off a
 * published card, and pins the modal→onLaunch contract deterministically:
 *
 *   1. the KB-scope <select> renders "All documents" → the author-default option
 *      tagged "workflow default" → other owner folders, in order; and the whole
 *      control HIDES when there are no folders (matches ChatArea's guard).
 *   2. picking another folder + launching calls onLaunch with that folderId override.
 *   3. staging a template File + launching calls onLaunch with that templateFile.
 *   4. the default no-input launch (no upload, folder on the "workflow default")
 *      passes NO override — { templateFile: null, folderId: null } (D-06).
 *
 * onLaunch is mocked; NO network is hit. The cross-provider SC#10 proof is the LIVE
 * UAT in 152-VALIDATION.md — it is NOT duplicated here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"

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
}))

// Mock the api seam (same set the WorkflowsPage.test harness mocks). The modal stages
// a File + a folder pick locally; onLaunch (the ChatLayout doRun) is a prop mock — no
// api call fires from the modal itself.
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
}))

import { WorkflowsPage } from "../WorkflowsPage"
import type { Folder } from "@/types"

/** The author default (folder-aaa) + a distinct override target (folder-bbb). */
const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_global: false, created_at: "", updated_at: "" },
  { id: "folder-bbb", user_id: "u1", name: "Contracts", parent_id: null, is_global: false, created_at: "", updated_at: "" },
]

/** A published workflow BOUND to folder-aaa, with NO per-phase folder_scope (so every
 *  owner folder is an eligible override — the A4 guard is exercised separately). */
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

/** An UNBOUND workflow (no project_folder_id) — here folderId:null genuinely means
 *  whole-KB, so the "" option truthfully reads "All documents" (WR-05). */
const unboundPublished = {
  id: "pub-2",
  slug: "open-scan",
  name: "Open scan",
  definition: {
    slug: "open-scan",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

/** Project P with children A and B (the backend 152-06 P/A/B shape). */
const phaseScopedFolders: Folder[] = [
  { id: "folder-p", user_id: "u1", name: "Project P", parent_id: null, is_global: false, created_at: "", updated_at: "" },
  { id: "folder-a", user_id: "u1", name: "Team A", parent_id: "folder-p", is_global: false, created_at: "", updated_at: "" },
  { id: "folder-b", user_id: "u1", name: "Team B", parent_id: "folder-p", is_global: false, created_at: "", updated_at: "" },
]

/** A workflow declaring two per-phase folder_scopes [A] and [B]. An override of A would
 *  empty phase-2 (folder_scope=[B] ∩ subtree(A) = ∅) and vice-versa, while P covers both
 *  (subtree(P) ⊇ {A,B}) — the exact WR-03 / backend-A4 case (152-06). */
const phaseScopedPublished = {
  id: "pub-3",
  slug: "two-phase",
  name: "Two-phase scan",
  definition: {
    slug: "two-phase",
    version: 1,
    project_folder_id: null, // unbound → "" is "All documents"; overrides are the offered folders
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "p1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft", folder_scope: ["folder-a"] } },
      { slug: "p2", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "draft", folder_scope: ["folder-b"] } },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublished.mockResolvedValue([boundPublished])
  mockListDrafts.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

async function openModal(pageFolders: Folder[], onLaunch = vi.fn().mockResolvedValue(undefined)) {
  render(<WorkflowsPage folders={pageFolders} onLaunch={onLaunch} />)
  const cards = await screen.findAllByTestId("published-card")
  fireEvent.click(within(cards[0]).getByTestId("published-run"))
  const modal = await screen.findByTestId("run-modal")
  return { modal, onLaunch }
}

describe("RunModal — KB-scope <select> truthful label (WR-05 / WFIN-02)", () => {
  it("bound + author folder visible: the '' option reads 'Workflow default — 📁 {folder}', with NO 'All documents'", async () => {
    const { modal } = await openModal(folders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    // The author default is no longer a separate option — the "" option IS the workflow
    // default (truthful: selecting it resolves to the author default server-side, D-06).
    expect(opts.map((o) => o.value)).toEqual(["", "folder-bbb"])
    expect(opts[0].textContent).toContain("Workflow default")
    expect(opts[0].textContent).toContain("DBA Chapters")
    // WR-05: a bound workflow NEVER shows the dishonest "All documents" option.
    expect(opts.some((o) => o.textContent === "All documents")).toBe(false)
    expect(opts[1].textContent).toContain("Contracts")
    expect(opts[1].textContent).not.toContain("workflow default")
    // Initial selection is now "" (truthfully = the workflow default for a bound wf).
    expect(scope.value).toBe("")
  })

  it("bound + author folder NOT visible: the '' option reads bare 'Workflow default' (never mislabelled whole-KB)", async () => {
    // boundPublished binds folder-aaa, but this runner only sees folder-bbb — the exact
    // mislabel case WR-05 fixes: the old code defaulted to "All documents" while the run
    // was actually author-scoped to the invisible folder.
    const { modal } = await openModal([folders[1]])
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    expect(opts[0].value).toBe("")
    expect(opts[0].textContent).toBe("Workflow default")
    expect(opts.some((o) => o.textContent === "All documents")).toBe(false)
    expect(scope.value).toBe("")
  })

  it("unbound workflow (no project_folder_id): the '' option truthfully reads 'All documents'", async () => {
    mockListPublished.mockResolvedValue([unboundPublished])
    const { modal } = await openModal(folders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    expect(opts[0].value).toBe("")
    expect(opts[0].textContent).toBe("All documents")
    // No author default to exclude → every owner folder is an override option.
    expect(opts.map((o) => o.value)).toEqual(["", "folder-aaa", "folder-bbb"])
    expect(scope.value).toBe("")
  })

  it("hides the whole scope control when there are no folders (matches ChatArea's guard)", async () => {
    const { modal } = await openModal([])
    expect(within(modal).queryByTestId("run-scope-select")).not.toBeInTheDocument()
    expect(within(modal).queryByTestId("run-scope")).not.toBeInTheDocument()
  })
})

describe("RunModal — onLaunch run-input payload (WFIN-01 / WFIN-02)", () => {
  it("picking another folder + launching passes that folderId override", async () => {
    const { modal, onLaunch } = await openModal(folders)
    fireEvent.change(within(modal).getByTestId("run-scope-select"), { target: { value: "folder-bbb" } })
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "review Acme" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(boundPublished, "review Acme", {
      templateFile: null,
      folderId: "folder-bbb",
    })
  })

  it("staging a template File + launching passes that templateFile", async () => {
    const { modal, onLaunch } = await openModal(folders)
    const file = new File(["stub"], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const input = within(modal).getByLabelText("Upload template file")
    fireEvent.change(input, { target: { files: [file] } })
    // The staged-file card renders (name + remove control) — the button is replaced.
    expect(await within(modal).findByTestId("run-template-file")).toHaveTextContent("template.docx")
    expect(within(modal).queryByTestId("run-template-upload")).not.toBeInTheDocument()

    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    const [, , extras] = onLaunch.mock.calls[0]
    expect(extras.templateFile).toBe(file)
    expect(extras.templateFile?.name).toBe("template.docx")
    // Folder left on the workflow default → no override alongside the template (D-06).
    expect(extras.folderId).toBeNull()
  })

  it("the remove control un-stages the file → the upload button returns", async () => {
    const { modal } = await openModal(folders)
    const file = new File(["stub"], "template.docx", { type: "text/plain" })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    fireEvent.click(within(modal).getByRole("button", { name: "Remove template" }))
    expect(within(modal).queryByTestId("run-template-file")).not.toBeInTheDocument()
    expect(within(modal).getByTestId("run-template-upload")).toBeInTheDocument()
  })

  it("D-06: the default no-input launch (no upload, folder on the workflow default) passes NO override", async () => {
    const { modal, onLaunch } = await openModal(folders)
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "go" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(boundPublished, "go", {
      templateFile: null,
      folderId: null,
    })
  })

  it("the honest provenance note renders verbatim, quiet", async () => {
    const { modal } = await openModal(folders)
    expect(within(modal).getByTestId("run-provenance")).toHaveTextContent(
      "Stored untrusted — never run as code, never fed to the fill engine.",
    )
  })
})

describe("RunModal — A4 per-phase override filter (WR-03 frontend mirror)", () => {
  it("drops any override whose subtree empties a declared phase folder_scope; keeps a candidate (P) that covers every phase", async () => {
    mockListPublished.mockResolvedValue([phaseScopedPublished])
    const { modal } = await openModal(phaseScopedFolders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const values = Array.from(scope.options).map((o) => o.value)
    // Phases scope [A] and [B]: offering A empties phase-2 and offering B empties phase-1
    // (subtree(A) ∩ [B] = ∅, subtree(B) ∩ [A] = ∅) → neither is a valid override.
    expect(values).not.toContain("folder-a")
    expect(values).not.toContain("folder-b")
    // Good path: P's subtree {P,A,B} intersects BOTH phase scopes → P survives the filter.
    expect(values).toContain("folder-p")
    // Unbound workflow → the "" option is the honest whole-KB "All documents" (WR-05).
    expect(values[0]).toBe("")
    expect(scope.options[0].textContent).toBe("All documents")
  })
})
