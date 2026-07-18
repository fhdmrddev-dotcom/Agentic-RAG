/**
 * Phase 121 (IA-01 / SC#2) — the surviving launch path: Workflows page Run.
 *
 * Plan 01 removed the in-chat Deep/Harness pill + workflow picker, but the LAUNCH
 * capability was NOT removed (D-02/D-03): a workflow is a MODE of a thread, kicked
 * off from the Workflows page. This integration test renders ChatLayout with
 * activeView="workflows" (so WorkflowsPage mounts with onLaunch=doRun), drives the
 * page's published-card Run flow (click published-run → fill run-kickoff → click
 * run-confirm), and asserts the doRun wiring fired end to end:
 *   - createThread(def.name)                                  (always a NEW thread, D-03)
 *   - postMessage(thread.id, kickoff, { workflowDefinitionId })  (the live route, D-02)
 *   - onNavigate("chat")                                       (switches to the thread)
 *
 * No assertion on the removed in-chat picker — that is gone (covered by SC#1 in
 * ChatAreaMode.test.tsx). NavPanel + WorkspacePanel are stubbed to trivial nodes
 * so the test stays scoped to the doRun api/navigate calls (they pull StreamsProvider
 * seams that are irrelevant to the launch wiring).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"

const {
  mockCreateThread,
  mockPostMessage,
  mockUploadTemplate,
  mockDeleteThread,
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
} = vi.hoisted(() => ({
  mockCreateThread: vi.fn(),
  mockPostMessage: vi.fn(),
  mockUploadTemplate: vi.fn(),
  mockDeleteThread: vi.fn(),
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))

// The api seam: ChatLayout.doRun consumes createThread + postMessage; the hosted
// WorkflowsPage consumes the published/draft/folders/skills list fns (+ the Builder
// generate/create/update/publish) to mount and render a published-card with Run.
vi.mock("@/lib/api", () => ({
  createThread: mockCreateThread,
  postMessage: mockPostMessage,
  uploadWorkspaceTemplate: mockUploadTemplate,
  // WR-04: doRun imports the raw deleteThread (aliased deleteLaunchThread) for
  // best-effort orphan cleanup on a failed launch.
  deleteThread: mockDeleteThread,
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
}))

// ChatLayout's thread/folder/theme hooks — return the exact fns ChatLayout
// destructures (loadThreads/selectThread + the nav fns) as no-ops/empties.
vi.mock("@/hooks/useThreads", () => ({
  useThreads: () => ({
    threads: [],
    selectedThread: null,
    loading: false,
    loadThreads: vi.fn().mockResolvedValue(undefined),
    selectThread: vi.fn(),
    newThread: vi.fn().mockResolvedValue({ id: "t-new", title: "New Chat" }),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    renameThread: vi.fn().mockResolvedValue(undefined),
    updateThreadTitle: vi.fn(),
  }),
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))

// Trivial stubs for the heavy chrome that pull StreamsProvider seams — the launch
// wiring lives entirely in ChatLayout.doRun + WorkflowsPage, so these add noise only.
vi.mock("../NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({ WorkspacePanel: () => <aside data-testid="panel-stub" /> }))

import { ChatLayout } from "../ChatLayout"

/** One published def so WorkflowsPage renders a published-card with a Run button. */
const publishedDef = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // doRun resolves a NEW thread, then posts the kickoff against it.
  mockCreateThread.mockResolvedValue({ id: "thread-new", title: "Vendor-risk review" })
  mockPostMessage.mockResolvedValue(undefined)
  mockUploadTemplate.mockResolvedValue(undefined)
  mockDeleteThread.mockResolvedValue(undefined)
  mockListPublished.mockResolvedValue([publishedDef])
  mockListDrafts.mockResolvedValue([])
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
})

function renderLayout(onNavigate = vi.fn()) {
  render(
    <ChatLayout
      onSignOut={vi.fn()}
      activeView="workflows"
      onNavigate={onNavigate}
      prefillMessage={null}
      onSetPrefillMessage={vi.fn()}
    />,
  )
  return { onNavigate }
}

describe("ChatLayout — Workflows-page Run launches a workflow (SC#2, D-02/D-03)", () => {
  it("Run → doRun calls createThread + postMessage({workflowDefinitionId}) + navigates to chat", async () => {
    const { onNavigate } = renderLayout()

    // Drive the page launch: click the published card's Run, fill the kickoff, confirm.
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const kickoff = await screen.findByTestId("run-kickoff")
    fireEvent.change(kickoff, { target: { value: "review Acme Corp" } })
    fireEvent.click(screen.getByTestId("run-confirm"))

    // doRun: a NEW thread is created with the published def's name (D-03 always-new).
    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledTimes(1))
    expect(mockCreateThread).toHaveBeenCalledWith("Vendor-risk review")

    // doRun: the kickoff is posted to that thread carrying the workflowDefinitionId
    // (D-02 — the live launch route the removal kept intact).
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    expect(mockPostMessage).toHaveBeenCalledWith("thread-new", "review Acme Corp", {
      workflowDefinitionId: "pub-1",
    })

    // doRun: the user is switched to the thread to watch the run.
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("chat"))

    // WR-04 invariant: a SUCCESSFUL launch never deletes the created thread.
    expect(mockDeleteThread).not.toHaveBeenCalled()
  })

  it("WR-04: a failed launch (postMessage rejects) best-effort deletes the created thread and re-throws (the modal's 422 still surfaces)", async () => {
    // The routine 152 failure path: the launch step rejects (a template 422 or a
    // postMessage 409/network error). doRun must clean up the created thread shell so
    // retries don't accrue orphans, WITHOUT swallowing the error the modal renders.
    mockPostMessage.mockRejectedValue(new Error("template failed validation (422)"))
    renderLayout()

    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const kickoff = await screen.findByTestId("run-kickoff")
    fireEvent.change(kickoff, { target: { value: "review Acme Corp" } })
    fireEvent.click(screen.getByTestId("run-confirm"))

    // The thread was created, the launch step failed → best-effort cleanup with the
    // created thread's id (fire-and-forget: it must not block the error surfacing).
    await waitFor(() => expect(mockDeleteThread).toHaveBeenCalledWith("thread-new"))

    // Re-throw preserved: RunModal catches the re-thrown error and renders the server's
    // message VERBATIM (the inline role="alert" launch error) — surfacing must not regress.
    expect(await screen.findByTestId("run-upload-error")).toHaveTextContent(
      "template failed validation (422)",
    )
  })
})
