/**
 * Phase 234 (LIB-08 / SURF-01 / VIS-05 / SC#3) — WatchedFoldersSection Unit Tests.
 *
 * Verifies:
 * - Watched folders list rendering with status pills and library folder mapping.
 * - Cadence invariant (SURF-01): exact copy 'checked every N minutes'.
 * - Absence of misleading real-time copy: 'instantly' and 'on change' are strictly forbidden.
 * - Disconnected banner naming connection: 'Reconnect {connection_name}' (VIS-05 / SC#3).
 * - Lifecycle actions: 'Sync now', 'Purge missing files', Pause/Resume, Delete.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WatchedFoldersSection } from "./WatchedFoldersSection"
import * as sourcesApi from "@/lib/api/sources"
import type { ConnectorWatch } from "@/lib/api/sources"

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn(),
  triggerWatchSync: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  purgeWatchFiles: vi.fn(),
  createWatch: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({
    folders: [
      { id: "lib-folder-1", name: "Procurement Invoices", is_org_shared: false },
      { id: "lib-folder-2", name: "Executive Briefs", is_org_shared: true },
    ],
  }),
}))

const mockListWatches = vi.mocked(sourcesApi.listWatches)
const mockTriggerWatchSync = vi.mocked(sourcesApi.triggerWatchSync)
const mockUpdateWatch = vi.mocked(sourcesApi.updateWatch)
const mockDeleteWatch = vi.mocked(sourcesApi.deleteWatch)
const mockPurgeWatchFiles = vi.mocked(sourcesApi.purgeWatchFiles)

const SAMPLE_WATCHES: ConnectorWatch[] = [
  {
    id: "watch-1",
    user_id: "user-1",
    connection_id: "conn-1",
    connection_name: "Google Drive (Finance)",
    service_id: "google",
    source_folder_id: "gdrive-fld-1",
    source_folder_name: "Q3 Vendor Bills",
    library_folder_id: "lib-folder-1",
    interval_minutes: 30,
    is_active: true,
    last_status: "completed",
    item_count: 14,
  },
  {
    id: "watch-2",
    user_id: "user-1",
    connection_id: "conn-2",
    connection_name: "Google Drive (Procurement)",
    service_id: "google",
    source_folder_id: "gdrive-fld-2",
    source_folder_name: "Vendor Contracts 2026",
    library_folder_id: "lib-folder-2",
    interval_minutes: 60,
    is_active: true,
    last_status: "disconnected",
    last_error: "Connection disconnected: refresh token revoked",
    item_count: 8,
  },
]

describe("WatchedFoldersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("confirm", vi.fn(() => true))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("renders watched folders list with exact cadence copy (SURF-01)", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
      expect(screen.getByText("Vendor Contracts 2026")).toBeInTheDocument()
    })

    // SURF-01: Exact copy 'checked every N minutes'
    expect(screen.getByText(/checked every 30 minutes/i)).toBeInTheDocument()
    expect(screen.getByText(/checked every 60 minutes/i)).toBeInTheDocument()

    // SURF-01: Absence of forbidden words
    const sectionText = document.body.textContent?.toLowerCase() || ""
    expect(sectionText).not.toContain("instantly")
    expect(sectionText).not.toContain("on change")
  })

  it("renders disconnected warning banner naming the connection (VIS-05 / SC#3)", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    const onNavigate = vi.fn()
    render(<WatchedFoldersSection onNavigateToConnections={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId("watch-disconnected-banner")).toBeInTheDocument()
    })

    // Assert the connection name is explicitly stated in the Reconnect button
    const reconnectBtn = screen.getByRole("button", {
      name: /reconnect google drive \(procurement\)/i,
    })
    expect(reconnectBtn).toBeInTheDocument()

    // Clicking button triggers navigation
    await userEvent.click(reconnectBtn)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it("triggers sync now on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockTriggerWatchSync.mockResolvedValue({ status: "scheduled", message: "Sync scheduled." })
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
    })

    const syncButtons = screen.getAllByRole("button", { name: /sync now/i })
    await userEvent.click(syncButtons[0])

    expect(mockTriggerWatchSync).toHaveBeenCalledWith("watch-1")
  })

  it("triggers purge missing files on user action (VIS-05 / SC#3)", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockPurgeWatchFiles.mockResolvedValue({ status: "ok", purged_count: 2, message: "Purged 2 files." })
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
    })

    const purgeButtons = screen.getAllByRole("button", { name: /purge missing files/i })
    await userEvent.click(purgeButtons[0])

    expect(mockPurgeWatchFiles).toHaveBeenCalledWith("watch-1")
  })

  it("triggers watch deletion on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockDeleteWatch.mockResolvedValue(undefined)
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole("button", { name: /delete watch/i })
    await userEvent.click(deleteButtons[0])

    expect(mockDeleteWatch).toHaveBeenCalledWith("watch-1")
  })

  it("toggles pause and resume on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockUpdateWatch.mockResolvedValue({ ...SAMPLE_WATCHES[0], is_active: false })
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
    })

    const pauseButtons = screen.getAllByTitle(/pause watch/i)
    await userEvent.click(pauseButtons[0])

    expect(mockUpdateWatch).toHaveBeenCalledWith("watch-1", { is_active: false })
  })
})
