/**
 * Phase 232 (SRC-01 / SRC-02) — SourceFolderPicker Unit Tests.
 *
 * Tests hierarchical folder tree rendering, expanding/collapsing, lazy child loading,
 * folder selection callback contract, error states, and empty states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SourceFolderPicker } from "./SourceFolderPicker"
import * as api from "@/lib/api"
import { UNKNOWN_SOURCE_FAILURE_SENTENCE } from "./sourceHealthVocabulary"
import type { SourceNode } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    browseSourceFolders: vi.fn(),
  }
})

const mockBrowseSourceFolders = vi.mocked(api.browseSourceFolders)

const ROOT_NODES: SourceNode[] = [
  {
    id: "my_drive",
    name: "My Drive",
    kind: "drive",
    drive_id: null,
    has_children: true,
  },
  {
    id: "shared_drives",
    name: "Shared Drives",
    kind: "drive",
    drive_id: null,
    has_children: true,
  },
]

const SHARED_DRIVES_CHILDREN: SourceNode[] = [
  {
    id: "drive-team",
    name: "Engineering Team Drive",
    kind: "drive",
    drive_id: "drive-team",
    has_children: true,
  },
]

const TEAM_DRIVE_CHILDREN: SourceNode[] = [
  {
    id: "folder-arch",
    name: "Architecture Specs",
    kind: "folder",
    drive_id: "drive-team",
    parent_id: "drive-team",
    has_children: false,
  },
]

describe("SourceFolderPicker", () => {
  beforeEach(() => {
    mockBrowseSourceFolders.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders loading state then root folders on mount", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    expect(screen.getByTestId("folder-picker-loading")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123")
  })

  it("expands a folder node lazily and displays its children", async () => {
    const user = userEvent.setup()

    mockBrowseSourceFolders.mockImplementation(async (_connId, folderId) => {
      if (!folderId) {
        return { items: ROOT_NODES, next_page_token: null }
      }
      if (folderId === "shared_drives") {
        return { items: SHARED_DRIVES_CHILDREN, next_page_token: null }
      }
      if (folderId === "drive-team") {
        return { items: TEAM_DRIVE_CHILDREN, next_page_token: null }
      }
      return { items: [], next_page_token: null }
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    // Click chevron to expand Shared Drives
    const expandSharedBtn = screen.getByTestId("expand-btn-shared_drives")
    await user.click(expandSharedBtn)

    await waitFor(() => {
      expect(screen.getByText("Engineering Team Drive")).toBeInTheDocument()
    })
    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123", "shared_drives")

    // Expand the child Engineering Team Drive
    const expandTeamBtn = screen.getByTestId("expand-btn-drive-team")
    await user.click(expandTeamBtn)

    await waitFor(() => {
      expect(screen.getByText("Architecture Specs")).toBeInTheDocument()
    })
    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123", "drive-team")
  })

  it("collapses an expanded node when toggle is clicked again", async () => {
    const user = userEvent.setup()

    mockBrowseSourceFolders.mockImplementation(async (_connId, folderId) => {
      if (!folderId) {
        return { items: ROOT_NODES, next_page_token: null }
      }
      if (folderId === "shared_drives") {
        return { items: SHARED_DRIVES_CHILDREN, next_page_token: null }
      }
      return { items: [], next_page_token: null }
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    const expandBtn = screen.getByTestId("expand-btn-shared_drives")
    await user.click(expandBtn)

    await waitFor(() => {
      expect(screen.getByText("Engineering Team Drive")).toBeInTheDocument()
    })

    // Click again to collapse
    await user.click(expandBtn)

    expect(screen.queryByText("Engineering Team Drive")).not.toBeInTheDocument()
  })

  it("calls onSelectFolder with correct folder and drive metadata when clicked", async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(
      <SourceFolderPicker
        connectionId="conn-123"
        onSelectFolder={handleSelect}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })

    const myDriveRow = screen.getByTestId("folder-row-my_drive")
    await user.click(myDriveRow)

    expect(handleSelect).toHaveBeenCalledWith({
      folderId: "my_drive",
      folderName: "My Drive",
      driveId: null,
      driveName: "My Drive",
    })
  })

  it("indicates currently selected folder", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(
      <SourceFolderPicker
        connectionId="conn-123"
        selectedFolderId="my_drive"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })

    const myDriveRow = screen.getByTestId("folder-row-my_drive")
    expect(myDriveRow.className).toContain("bg-primary/10")
    expect(myDriveRow.getAttribute("aria-selected")).toBe("true")
  })

  it("renders error state when root fetch fails and allows retry", async () => {
    const user = userEvent.setup()

    // ⚠ CHANGED DELIBERATELY (BUG-260912-01), and the change is the point rather than a
    //   repair. This case used to assert `"Network connection dropped"` appeared VERBATIM —
    //   i.e. it pinned the pass-through of an arbitrary thrown message onto the screen. That
    //   is exactly the leak `sourceHealthVocabulary` exists to refuse: on 2026-09-12 the
    //   string arriving here was the backend's sentence with a JSON dict and an OAuth error
    //   code appended, and this branch would have printed all of it.
    //   ⭐ The message now goes through `sourceFailureSentence`, which passes a string
    //     through only on POSITIVE proof of plainness. `"Network connection dropped"` has no
    //     terminal punctuation, so it fails that proof and degrades to the honest fallback —
    //     the shipped `UNKNOWN_SOURCE_FAILURE_SENTENCE`. A plain, punctuated sentence still
    //     survives intact; the case below this one drives that half.
    mockBrowseSourceFolders.mockRejectedValueOnce(new Error("Network connection dropped"))

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByTestId("folder-picker-error")).toBeInTheDocument()
      expect(screen.getByText(UNKNOWN_SOURCE_FAILURE_SENTENCE)).toBeInTheDocument()
    })
    expect(screen.queryByText("Network connection dropped")).toBeNull()

    // Setup success for retry
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    const retryBtn = screen.getByRole("button", { name: /retry/i })
    await user.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })
  })

  it("renders empty state when source has no folders", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: [],
      next_page_token: null,
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByTestId("folder-picker-empty")).toBeInTheDocument()
      expect(
        screen.getByText("No folders or drives found for this connection."),
      ).toBeInTheDocument()
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// BUG-260912-01 — A FAILED CHILD LOAD IS NOT AN EMPTY FOLDER
//
// ⭐ MEASURED 2026-09-12. Google rejected every token refresh (`invalid_client`), so
// `GET /connectors/connections/{id}/browse?folder_id=my_drive` answered **502** with the
// backend's own authored sentence. `handleToggleExpand` caught it, called `console.error`,
// and set NOTHING — so `childrenMap[node.id]` stayed undefined, `children` resolved to `[]`,
// `isLoading` went false, and the tree rendered the literal **"No subfolders"**.
//
// ⛔ THE DEFECT IS NOT THE MISSING MESSAGE, IT IS THE WRONG CLAIM. "No subfolders" is a
// STATEMENT ABOUT THE USER'S DRIVE, asserted from a request that never got an answer. The
// operator read it, believed Drive was empty, reconnected Google twice, and had to read the
// token endpoint's body out of a script to find out what was actually wrong.
//
// ⚠ The root branch ALREADY renders its error correctly (`folder-picker-error`). This is
// the same fact one level down, and it was silent.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("BUG-260912-01 — a child load that failed never claims the folder is empty", () => {
  /** What the backend really answered on 2026-09-12, quoted rather than invented. */
  const THE_502 = new Error(
    "Source provider browse returned an error. The provider said: Token refresh failed at " +
      'google: 401 {"error": "invalid_client", "error_description": "The provided client ' +
      'secret is invalid."}',
  )

  const expandMyDrive = async () => {
    const user = userEvent.setup()
    await user.click(await screen.findByTestId("expand-btn-my_drive"))
  }

  it("⭐ THE BUG: the words 'No subfolders' do not appear when the load failed", async () => {
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockRejectedValueOnce(THE_502)

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    await expandMyDrive()

    await waitFor(() => {
      expect(screen.getByTestId("folder-children-error-my_drive")).toBeInTheDocument()
    })
    expect(screen.queryByText(/no subfolders/i)).toBeNull()
  })

  it("⭐ it says WHAT is wrong, in this app's own words", async () => {
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockRejectedValueOnce(THE_502)

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    await expandMyDrive()

    const row = await screen.findByTestId("folder-children-error-my_drive")
    // The shared vocabulary's sentence for this cause — named by the connection, and telling
    // the reader whose problem it is. NOT a generic "something went wrong".
    expect(row).toHaveTextContent(/credentials this server uses to reach Google Workspace/i)
  })

  it("⛔ the provider's machine text never reaches the screen", async () => {
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockRejectedValueOnce(THE_502)

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    await expandMyDrive()

    const row = await screen.findByTestId("folder-children-error-my_drive")
    const shown = row.textContent ?? ""
    expect(shown).not.toContain("invalid_client")
    expect(shown).not.toContain("{")
    expect(shown).not.toContain("401")
  })

  it("the failed row offers a retry, and the retry actually re-asks", async () => {
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockRejectedValueOnce(THE_502)
      .mockResolvedValueOnce({ items: TEAM_DRIVE_CHILDREN, next_page_token: null })

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    await expandMyDrive()

    const retry = await screen.findByTestId("folder-children-retry-my_drive")
    await userEvent.setup().click(retry)

    await waitFor(() => {
      expect(screen.getByText("Architecture Specs")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("folder-children-error-my_drive")).toBeNull()
  })

  it("⛔ CONTAINMENT — a genuinely empty folder still says 'No subfolders'", async () => {
    // The honest empty state must survive. A fix that replaced it with an error row would
    // have swapped one wrong claim for another.
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockResolvedValueOnce({ items: [], next_page_token: null })

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    await expandMyDrive()

    expect(await screen.findByText("No subfolders")).toBeInTheDocument()
    expect(screen.queryByTestId("folder-children-error-my_drive")).toBeNull()
  })

  it("⛔ CONTAINMENT — one folder's failure does not poison its siblings", async () => {
    // Each expandable node owns its own outcome. A single shared `error` would make a
    // recoverable per-folder fault look like a whole-connection one.
    mockBrowseSourceFolders
      .mockResolvedValueOnce({ items: ROOT_NODES, next_page_token: null })
      .mockRejectedValueOnce(THE_502)
      .mockResolvedValueOnce({ items: SHARED_DRIVES_CHILDREN, next_page_token: null })

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)
    const user = userEvent.setup()
    await user.click(await screen.findByTestId("expand-btn-my_drive"))
    await screen.findByTestId("folder-children-error-my_drive")
    await user.click(await screen.findByTestId("expand-btn-shared_drives"))

    expect(await screen.findByText("Engineering Team Drive")).toBeInTheDocument()
    expect(screen.getByTestId("folder-children-error-my_drive")).toBeInTheDocument()
    expect(screen.queryByTestId("folder-children-error-shared_drives")).toBeNull()
  })

  it("the ROOT error is put through the same vocabulary, not printed raw", async () => {
    // The root branch renders `{error}` verbatim today — the same leak, one level up, and
    // fixing only the child half would leave the provider's dict reachable.
    mockBrowseSourceFolders.mockRejectedValueOnce(THE_502)

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)

    const panel = await screen.findByTestId("folder-picker-error")
    const shown = panel.textContent ?? ""
    expect(shown).not.toContain("invalid_client")
    expect(shown).not.toContain("{")
    expect(shown).toMatch(/credentials this server uses to reach Google Workspace/i)
  })
})

describe("BUG-260912-01 — the pass-through is gated on plainness, not banned", () => {
  it("the backend's OWN authored sentence survives intact", async () => {
    // ⛔ THE OTHER HALF OF THE PREVIOUS CASE. A vocabulary that swallowed every message would
    //    have traded a leak for a silence, and the honest fallback says less than a sentence
    //    the backend deliberately wrote for a person. Positive proof of plainness — a
    //    punctuated, machine-tell-free string — passes through unchanged.
    mockBrowseSourceFolders.mockRejectedValueOnce(
      new Error("This connection is switched off, so nothing can be read through it."),
    )

    render(<SourceFolderPicker connectionId="conn-123" connectionName="Google Workspace" />)

    const panel = await screen.findByTestId("folder-picker-error")
    expect(panel).toHaveTextContent(
      "This connection is switched off, so nothing can be read through it.",
    )
    expect(panel).not.toHaveTextContent(UNKNOWN_SOURCE_FAILURE_SENTENCE)
  })
})
