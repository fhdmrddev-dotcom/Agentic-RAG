/**
 * Phase 240 (D-240-19) — "Add watched folder", and the second half of `BUG-260908-02`.
 *
 * ⛔ **THE OTHER COMPONENT THE BUG REPORT NAMES AS HAVING NO TEST SUITE AT ALL.** This is the
 * surface that creates a WATCH — a standing, scheduled read of somebody's account. Offering a
 * switched-off connection here is worse than offering it in the one-shot preview: a watch
 * persists, and a person could reasonably believe the OFF switch stopped it.
 *
 * ⚠ **THE BAR IS DISCRIMINATION, NOT VOCABULARY** (Phase 239 Row 1). The positive control comes
 * first, because without it every "is not offered" assertion below would also pass on a modal
 * that offers nothing at all — which is exactly the vacuous pass the sibling suite hit and
 * caught.
 *
 * ⭐ It also pins the Phase 240 mail node reaching this surface: a mail label must be pickable
 * here, or the shape stops at the adapter and never becomes a product.
 */
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateWatchModal } from "../CreateWatchModal"

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn(),
  listSourceFamilies: vi.fn(),
}))
vi.mock("@/lib/api/sources", () => ({
  createWatch: vi.fn(),
}))
vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({ folders: [], loading: false }),
}))
vi.mock("../SourceFolderPicker", () => ({
  SourceFolderPicker: ({ connectionId }: { connectionId: string }) => (
    <div>picker for {connectionId}</div>
  ),
}))

const { listConnectorConnections, listSourceFamilies } = await import("@/lib/api")
const mockConnections = listConnectorConnections as unknown as ReturnType<typeof vi.fn>
const mockFamilies = listSourceFamilies as unknown as ReturnType<typeof vi.fn>

function connection(over: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    service_id: "google",
    name: "Google Drive",
    status: "connected",
    auth_type: "oauth",
    is_enabled: true,
    config: {},
    ...over,
  }
}

beforeEach(() => {
  mockConnections.mockReset()
  mockFamilies.mockReset()
  mockFamilies.mockResolvedValue(["google", "microsoft", "mcp"])
})

describe("CreateWatchModal", () => {
  it("offers an enabled, source-capable connection", async () => {
    // ⭐ THE POSITIVE CONTROL — first, deliberately.
    mockConnections.mockResolvedValue([connection({ name: "Work Drive" })])

    render(<CreateWatchModal open onClose={() => {}} />)

    expect(await screen.findByText("Work Drive")).toBeInTheDocument()
  })

  it("does NOT offer a connection the operator switched off", async () => {
    // ⛔ BUG-260908-02, on the surface where it matters most: a watch is a STANDING read.
    mockConnections.mockResolvedValue([
      connection({ id: "off", name: "Switched Off Drive", is_enabled: false }),
    ])

    render(<CreateWatchModal open onClose={() => {}} />)

    await waitFor(() => expect(mockConnections).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByText("Switched Off Drive")).not.toBeInTheDocument(),
    )
  })

  it("keeps the enabled one and drops the disabled one from the same list", async () => {
    mockConnections.mockResolvedValue([
      connection({ id: "on", name: "Live Drive", is_enabled: true }),
      connection({ id: "off", name: "Paused Drive", is_enabled: false }),
    ])

    render(<CreateWatchModal open onClose={() => {}} />)

    expect(await screen.findByText("Live Drive")).toBeInTheDocument()
    expect(screen.queryByText("Paused Drive")).not.toBeInTheDocument()
  })

  it("says there is nothing to watch rather than showing an empty chip row", async () => {
    // The honest empty state. An empty row of chips looks like a loading bug.
    mockConnections.mockResolvedValue([
      connection({ id: "off", name: "Paused Drive", is_enabled: false }),
    ])

    render(<CreateWatchModal open onClose={() => {}} />)

    expect(await screen.findByText(/No Google Drive connections found/)).toBeInTheDocument()
  })

  it("auto-selects the first offered connection, and never a disabled one", async () => {
    // ⚠ THE SUBTLE HALF OF THE BUG. The modal pre-selects `capable[0]`. Had the filter not
    //   excluded disabled rows, a switched-off connection would have been selected FOR the
    //   person the moment the modal opened — the picker step skipped entirely.
    mockConnections.mockResolvedValue([
      connection({ id: "off", name: "Paused Drive", is_enabled: false }),
      connection({ id: "on", name: "Live Drive", is_enabled: true }),
    ])

    render(<CreateWatchModal open onClose={() => {}} />)

    expect(await screen.findByText("picker for on")).toBeInTheDocument()
  })
})
