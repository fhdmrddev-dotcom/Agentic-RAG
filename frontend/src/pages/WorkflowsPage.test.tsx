/**
 * Phase 103-06 (REQ-7 / WFAUTH-04) — WorkflowsPage tests.
 *
 * The project-filtered browse + launch home. These tests pin the locked contracts:
 *  - selecting a project re-queries listPublishedWorkflows with that
 *    project_folder_id; "All projects" calls it with no project filter.
 *  - the Drafts shelf renders ABOVE the Published shelf (DOM order) with the dashed
 *    build-card; NO draft card exposes a Run affordance; published cards DO.
 *  - the tier badge is CLIENT-derived (a draft-policy def renders a different tier
 *    than a strict-policy def) with no extra fetch for the badge.
 *  - the build-card switches the page view to the Builder.
 *  - Run opens a modal (read-only folder chip + one textarea + hint; enabled on
 *    empty) and clicking Run calls onLaunch(def, kickoff).
 *  - Tweak calls createWorkflowDraft with version = def.version + 1, same slug,
 *    status 'draft' (INSERT — never an UPDATE of the published row), then opens the
 *    Builder.
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
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))

// Mock the api seam. The page consumes listPublishedWorkflows + listDraftWorkflows
// + createWorkflowDraft; the hosted Builder consumes generate/create/update +
// listFolders/listSkills (103-ux folder/skill name maps); the Gauntlet consumes publish.
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
}))

import { WorkflowsPage } from "./WorkflowsPage"
import type { Folder } from "@/types"

const folders: Folder[] = [
  {
    id: "folder-aaa",
    user_id: "u1",
    name: "DBA Chapters",
    parent_id: null,
    is_global: false,
    created_at: "",
    updated_at: "",
  },
]

/** A strict published def (llm_emit citation_policy 'strict' + the full gate set). */
const strictPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "pull", phase_index: 0, name: "Pull", config: { phase_type: "programmatic" } },
      {
        slug: "emit",
        phase_index: 1,
        name: "Render report",
        config: { phase_type: "llm_emit", citation_policy: "strict" },
        validators: [
          { kind: "citations_required" },
          { kind: "output_file_valid" },
          { kind: "structure_check" },
          { kind: "freshness" },
          { kind: "llm_judge_rubric" },
        ],
      },
    ],
  },
}

/** A draft-policy published def (citation_policy 'draft', no floor-raising gate). */
const loosePublished = {
  id: "pub-2",
  slug: "quick-notes",
  name: "Quick notes",
  definition: {
    slug: "quick-notes",
    version: 1,
    project_folder_id: null,
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

const draftRow = {
  id: "draft-1",
  slug: "contract-clause",
  version: 1,
  name: "Contract clause review",
  definition: {
    slug: "contract-clause",
    version: 1,
    phases: [{ slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublished.mockResolvedValue([strictPublished, loosePublished])
  mockListDrafts.mockResolvedValue([draftRow])
  mockCreateDraft.mockResolvedValue({ id: "new-draft", version: 3 })
  // The hosted Builder fetches folders + skills on mount (103-ux name maps).
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

describe("WorkflowsPage — project filter rail (live ?project_folder_id= re-query)", () => {
  it("'All projects' calls listPublishedWorkflows with no project filter on mount", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    // First call (All projects, the default) is invoked with a null/undefined project arg.
    const firstArg = mockListPublished.mock.calls[0][0]
    expect(firstArg == null).toBe(true)
  })

  it("selecting a project re-queries listPublishedWorkflows with that project_folder_id", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    mockListPublished.mockClear()
    fireEvent.click(screen.getByText("DBA Chapters"))
    await waitFor(() => expect(mockListPublished).toHaveBeenCalledWith("folder-aaa"))
  })

  it("latest-wins: a STALE earlier response never paints over the current selection", async () => {
    // The "All projects" (mount) fetch resolves SLOWLY; the project fetch resolves
    // FIRST. The rendered list must match the LATER selection, not the stale mount one.
    let releaseAll: (rows: unknown[]) => void = () => {}
    const slowAll = new Promise<unknown[]>((r) => (releaseAll = r))
    // First call (All projects, mount) → the slow promise; second (project) → fast.
    mockListPublished.mockReset()
    mockListPublished
      .mockReturnValueOnce(slowAll) // mount: All projects (7 imaginary rows) — stale
      .mockResolvedValueOnce([strictPublished]) // project filter: exactly 1 row

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Switch to the project BEFORE the mount fetch resolves.
    fireEvent.click(screen.getByText("DBA Chapters"))
    // The project (later) fetch resolves first → 1 published card.
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(1))
    // Now the stale mount fetch finally resolves with a DIFFERENT (larger) list.
    releaseAll([strictPublished, loosePublished])
    // It must be DROPPED — the rendered list stays at the current selection (1 card).
    await waitFor(() => expect(mockListPublished).toHaveBeenCalledTimes(2))
    expect(screen.getAllByTestId("published-card")).toHaveLength(1)
  })
})

describe("WorkflowsPage — drafts-above-published shelves + build-card", () => {
  it("the Drafts shelf renders ABOVE the Published shelf (DOM order)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const drafts = await screen.findByTestId("drafts-shelf")
    const published = screen.getByTestId("published-shelf")
    // compareDocumentPosition: FOLLOWING (4) means `published` comes after `drafts`.
    expect(drafts.compareDocumentPosition(published) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("the dashed build-card is present in the drafts shelf and opens the Builder", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftsShelf = await screen.findByTestId("drafts-shelf")
    const buildCard = within(draftsShelf).getByTestId("build-card")
    expect(buildCard).toBeInTheDocument()
    fireEvent.click(buildCard)
    // The Builder host renders the describe-first empty screen (its hint testid).
    expect(await screen.findByTestId("describe-hint")).toBeInTheDocument()
  })

  it("NO draft card exposes a Run affordance; published cards DO", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    // A draft shows Open + Publish, never Run.
    expect(within(draftCard).queryByTestId("published-run")).not.toBeInTheDocument()
    expect(within(draftCard).getByTestId("draft-open")).toBeInTheDocument()
    expect(within(draftCard).getByTestId("draft-publish")).toBeInTheDocument()
    // The published cards carry Run.
    const published = await screen.findAllByTestId("published-card")
    expect(within(published[0]).getByTestId("published-run")).toBeInTheDocument()
  })
})

describe("WorkflowsPage — client-derived tier badge (D10, no extra fetch)", () => {
  it("a strict-policy def renders a different tier badge than a draft-policy def", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const strictBadge = within(cards[0]).getByTestId("tier-badge")
    const looseBadge = within(cards[1]).getByTestId("tier-badge")
    expect(strictBadge.getAttribute("data-tier")).toBe("STRICT")
    expect(looseBadge.getAttribute("data-tier")).toBe("LOOSE")
    expect(strictBadge.getAttribute("data-tier")).not.toBe(looseBadge.getAttribute("data-tier"))
    // The badge is derived: listPublishedWorkflows was the ONLY fetch (no per-badge call).
    expect(mockListPublished).toHaveBeenCalledTimes(1)
  })
})

describe("WorkflowsPage — tier badge picks the STRICTEST emit policy (WR-03, order-independent)", () => {
  it("a [flag, strict, partial] multi-emit def derives STRICT regardless of phase order", async () => {
    // Old logic only overwrote on 'strict' after the first emit set the policy, so a
    // 'partial' following a 'flag' was dropped and order mattered. The fix uses a
    // deterministic stricter-wins comparison: the strict emit must win here.
    const multiEmit = {
      id: "pub-multi",
      slug: "multi-emit",
      name: "Multi emit",
      definition: {
        slug: "multi-emit",
        version: 1,
        project_folder_id: null,
        phases: [
          { slug: "e1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "flag" } },
          { slug: "e2", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "strict" } },
          { slug: "e3", phase_index: 2, config: { phase_type: "llm_emit", citation_policy: "partial" } },
        ],
      },
    }
    mockListPublished.mockResolvedValue([multiEmit])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("published-card")
    expect(within(card).getByTestId("tier-badge").getAttribute("data-tier")).toBe("STRICT")
  })
})

describe("WorkflowsPage — Run launch (D-103-1) reuses onLaunch", () => {
  it("Run opens the modal: a read-only folder chip + one textarea + a hint line", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const modal = await screen.findByTestId("run-modal")
    // read-only folder chip showing the NAME (not a path), one textarea, one hint.
    expect(within(modal).getByTestId("run-folder-chip")).toHaveTextContent("DBA Chapters")
    expect(within(modal).getByTestId("run-folder-chip").textContent).not.toMatch(/[/\\]/)
    expect(within(modal).getAllByRole("textbox")).toHaveLength(1)
    expect(within(modal).getByTestId("run-hint")).toBeInTheDocument()
  })

  it("the Run button is ENABLED even on empty input", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    expect(confirm).not.toBeDisabled()
  })

  it("clicking Run calls onLaunch(def, kickoff)", async () => {
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const textarea = await screen.findByTestId("run-kickoff")
    fireEvent.change(textarea, { target: { value: "review Acme Corp" } })
    fireEvent.click(screen.getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "review Acme Corp")
  })

  it("WR-05: a double-tap of Run creates ONLY ONE launch (in-flight guard)", async () => {
    // onLaunch resolves only when we release it — the second click while in flight
    // must be ignored (one click = one thread).
    let release: () => void = () => {}
    const onLaunch = vi.fn().mockReturnValue(new Promise<void>((r) => (release = r)))
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    fireEvent.click(confirm) // first click → launch starts (still pending)
    fireEvent.click(confirm) // second tap while in flight → must be ignored
    fireEvent.click(confirm)
    expect(onLaunch).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
    release()
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
  })
})

describe("WorkflowsPage — Tweak forks a v(N+1) draft (INSERT, never UPDATE)", () => {
  it("Tweak calls createWorkflowDraft with version = def.version + 1, same slug, status 'draft'", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-tweak"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    expect(forked.slug).toBe("vendor-risk")
    expect(forked.version).toBe(3) // published def.version (2) + 1
    expect(forked.status).toBe("draft")
    // It is an INSERT (createWorkflowDraft), never updateWorkflowDraft on the published row.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("Tweak opens the FORKED copy's existing steps in the Builder (NOT the describe screen)", async () => {
    // The fork mints draft id "new-draft" (beforeEach mock). The Builder must boot
    // straight into the editing view on the forked definition's existing phases —
    // never the empty describe box.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-tweak"))
    // The forked strict def's phases render as spine nodes (pull + emit).
    expect(await screen.findByTestId("spine-node-pull")).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-emit")).toBeInTheDocument()
    // And NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
  })

  it("Tweak seeds the Builder with the NEW forked draft id → its publish gauntlet mounts on that id", async () => {
    // draftId is pre-seeded from the fork ("new-draft"), so the publish gauntlet (gated
    // on a non-null draftId in renderPublish) renders immediately in the edit view.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-tweak"))
    await screen.findByTestId("spine-node-pull")
    // The header carries the Tweak caption with the new version.
    expect(screen.getByText(/Tweak · vendor-risk v3/)).toBeInTheDocument()
  })
})

describe("WorkflowsPage — Open a draft loads it in the Builder (edit-in-place)", () => {
  it("Open passes the draft's definition + id → the Builder shows its steps, not the describe box", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    fireEvent.click(within(draftCard).getByTestId("draft-open"))
    // The draftRow's existing phase ("draft" slug) renders as a spine node.
    expect(await screen.findByTestId("spine-node-draft")).toBeInTheDocument()
    // NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
    // Edit-in-place: no fork (createWorkflowDraft) on Open.
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("the build-card opens a TRUE fresh build (the describe screen, no initial)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftsShelf = await screen.findByTestId("drafts-shelf")
    fireEvent.click(within(draftsShelf).getByTestId("build-card"))
    expect(await screen.findByTestId("describe-hint")).toBeInTheDocument()
    expect(screen.queryByTestId("spine-node-draft")).not.toBeInTheDocument()
  })
})

describe("WorkflowsPage — back-nav refreshes the library lists", () => {
  it("the ← Workflows back button refetches drafts + published", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Enter the Builder via a fresh build (does not itself refetch).
    const draftsShelf = await screen.findByTestId("drafts-shelf")
    fireEvent.click(within(draftsShelf).getByTestId("build-card"))
    await screen.findByTestId("describe-hint")
    mockListDrafts.mockClear()
    mockListPublished.mockClear()
    // Back to the library → both lists refresh (newly-created drafts appear w/o F5).
    fireEvent.click(screen.getByTestId("builder-back"))
    await waitFor(() => expect(mockListDrafts).toHaveBeenCalledTimes(1))
    expect(mockListPublished).toHaveBeenCalledTimes(1)
    // The library is back.
    expect(await screen.findByTestId("drafts-shelf")).toBeInTheDocument()
  })
})
