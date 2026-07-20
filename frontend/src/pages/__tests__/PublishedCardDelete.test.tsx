/**
 * Phase 152 Plan 04 Task 3 (WFIN-03 / D-LOCK-03/04/05) — PublishedCard delete contract.
 *
 * The deterministic frontend backstop for the net-new delete surface. It renders the
 * LIVE WorkflowsPage (PublishedCard is internal to it), opens the net-new ⋯-menu off a
 * published card, and pins the victim-naming Sheet's honesty + lifecycle:
 *
 *   1. ⋯ → "Delete workflow…" opens the Sheet and fetches getWorkflowDeletePreview for
 *      THIS workflow's definition id (never a guess — D-LOCK-03).
 *   2. the sheet renders the EXACT mocked counts (Removed group + Kept reassurance),
 *      including the always-rendered 0-threads variant ("No chat threads to keep.").
 *   3. the amber cancel-first banner shows ONLY when the preview reports a live run
 *      (in_flight > 0 — D-LOCK-05).
 *   4. Delete forever calls deleteWorkflowCascade and drives the in-place Deleting… →
 *      Deleted · recorded lifecycle with NO optimistic card removal (D-LOCK-04, no undo).
 *   5. a rejected cascade surfaces "Couldn't delete the workflow" + a Try again control.
 *
 * api.ts is mocked; NO network is hit. The LIVE destructive UAT (real DB counts,
 * cancel-first, no orphans) is the row in 152-VALIDATION.md — NOT duplicated here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

// Mock the api seam (the WorkflowsPage.test harness set + the two 152-04 delete clients).
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

const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

/** One published workflow — its `id` (pub-1) is the definition id the preview + cascade
 *  clients must be called with (owner-gated server-side). */
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
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
  // implement; stub them so the ⋯-menu opens under user-event (the standard shim).
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

/** Render the page, open the ⋯-menu on the first published card, click "Delete
 *  workflow…", and return the opened victim-naming Sheet (role="dialog"). */
async function openDeleteSheet() {
  const user = userEvent.setup()
  render(<WorkflowsPage folders={folders} onLaunch={vi.fn().mockResolvedValue(undefined)} />)
  const cards = await screen.findAllByTestId("published-card")
  await user.click(within(cards[0]).getByRole("button", { name: /workflow actions/i }))
  await user.click(await screen.findByTestId("published-delete"))
  const dialog = await screen.findByRole("dialog")
  return { user, dialog }
}

describe("PublishedCard delete (WFIN-03) — victim-naming sheet + exact counts", () => {
  it("⋯ → Delete opens the sheet and fetches the preview for THIS workflow's id", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    expect(within(dialog).getByText("Delete this workflow?")).toBeInTheDocument()
    // The counts come from the server preview keyed by the definition id — never guessed.
    expect(mockPreview).toHaveBeenCalledWith("pub-1")
  })

  it("renders the EXACT server counts + the Kept reassurance", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await waitFor(() => {
      expect(dialog).toHaveTextContent("Vendor-risk review")
      expect(dialog).toHaveTextContent("2 versions")
      expect(dialog).toHaveTextContent("5 run records")
    })
    expect(dialog).toHaveTextContent("3 chat threads become normal chats")
    expect(dialog).toHaveTextContent("Your knowledge base is untouched.")
    // The audit-receipt honesty footer always renders.
    expect(dialog).toHaveTextContent("Recorded with your name in the audit log.")
  })

  it("the Kept sentence ALWAYS renders — the 0-threads variant reads 'No chat threads to keep.'", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 1, runs: 0, threads: 0, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    expect(await within(dialog).findByText("No chat threads to keep.")).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent("become normal chats")
  })
})

describe("PublishedCard delete — amber cancel-first banner (D-LOCK-05)", () => {
  it("hides the banner when the preview reports NO live run", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    expect(within(dialog).queryByTestId("delete-inflight-banner")).not.toBeInTheDocument()
  })

  it("shows the amber banner ONLY when the preview reports a live run", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 1 })
    const { dialog } = await openDeleteSheet()
    const banner = await within(dialog).findByTestId("delete-inflight-banner")
    expect(banner).toHaveTextContent("still in progress")
  })
})

describe("PublishedCard delete — in-place lifecycle (D-LOCK-04, no undo)", () => {
  it("Delete forever calls the cascade + drives Deleting… → Deleted · recorded with NO optimistic removal", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    // A deferred cascade so the in-flight "Deleting…" terminal is observable before resolve.
    let resolveDelete!: () => void
    mockDelete.mockReturnValue(new Promise<void>((r) => { resolveDelete = () => r() }))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))

    // In flight: the honest Deleting… state, the server round-trip fired for THIS id…
    expect(await within(dialog).findByText(/Deleting/)).toBeInTheDocument()
    expect(mockDelete).toHaveBeenCalledWith("pub-1")
    // …and the card is NOT optimistically removed while the delete is pending.
    expect(screen.getByTestId("published-card")).toBeInTheDocument()

    // Server confirms → the recorded terminal (the card leaves the list only on re-fetch).
    resolveDelete()
    await waitFor(() => expect(dialog).toHaveTextContent("Deleted · recorded"))
  })

  it("a rejected cascade surfaces the honest error + a Try again control", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    mockDelete.mockRejectedValue(new Error("boom"))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))

    expect(await within(dialog).findByText(/Couldn.t delete the workflow/i)).toBeInTheDocument()
    expect(within(dialog).getByTestId("delete-retry")).toBeInTheDocument()
  })
})
