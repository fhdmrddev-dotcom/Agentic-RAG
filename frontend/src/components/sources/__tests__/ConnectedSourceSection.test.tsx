/**
 * Phase 240 (D-240-19) — the Library's connected-source picker, and what it must NOT offer.
 *
 * ⛔ **THE FIRST TEST SUITE THIS COMPONENT HAS EVER HAD, AND THAT IS THE ROOT CAUSE
 * `BUG-260908-02` NAMES.** The report says it plainly: *"`ConnectedSourceSection` and
 * `CreateWatchModal` have NO test suite at all."* The defect it carries — a **disabled**
 * connection still offered as a Library source — is the same SHAPE as `HI-01` (which was about
 * capability) and reached the same surface through the same hole. Phase 240 adds a mail node to
 * this exact picker, so the hole would have swallowed that too.
 *
 * ⚠ **THE BAR IS DISCRIMINATION, NOT VOCABULARY.** Phase 239's Row 1 closed on five distinct
 * verdicts across five connection shapes rather than on the right words appearing once. A suite
 * that only proved "a disabled connection is absent" would also pass on a picker that offers
 * nothing at all, so the positive controls below carry as much weight as the negative one.
 */
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ConnectedSourceSection } from "../ConnectedSourceSection"

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn(),
  listSourceFamilies: vi.fn(),
}))

vi.mock("../SourceFolderPicker", () => ({
  SourceFolderPicker: () => <div>folder picker</div>,
}))
vi.mock("../SourcePreviewPanel", () => ({
  SourcePreviewPanel: () => <div>preview</div>,
}))

const { listConnectorConnections, listSourceFamilies } = await import("@/lib/api")
const mockConnections = listConnectorConnections as unknown as ReturnType<typeof vi.fn>
const mockFamilies = listSourceFamilies as unknown as ReturnType<typeof vi.fn>

function connection(over: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    service_id: "google",
    // ⚠ `name`, not `display_name`. The option label reads `c.name`, and a fixture using the
    //   wrong key made every NEGATIVE assertion here pass vacuously — nothing rendered, so
    //   nothing was "not offered". The positive control is what caught it, which is why it is
    //   the first case in the file rather than an afterthought.
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

describe("ConnectedSourceSection", () => {
  it("offers an enabled, source-capable connection", async () => {
    // ⭐ THE POSITIVE CONTROL. Without it, every negative assertion below would also pass on a
    //    picker that offers nothing at all.
    mockConnections.mockResolvedValue([connection({ name: "Work Drive" })])

    render(<ConnectedSourceSection />)

    expect(await screen.findByText(/Work Drive/)).toBeInTheDocument()
  })

  it("does NOT offer a connection the operator switched off", async () => {
    // ⛔ BUG-260908-02. The disabled state was enforced on the Connections page and on the server
    //    (`SourceConnectionDisabled`, Phase 239) and NOT on the surface that starts an ingest.
    mockConnections.mockResolvedValue([
      connection({ id: "off", name: "Switched Off Drive", is_enabled: false }),
    ])

    render(<ConnectedSourceSection />)

    await waitFor(() => expect(mockConnections).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByText(/Switched Off Drive/)).not.toBeInTheDocument(),
    )
  })

  it("keeps the enabled one and drops the disabled one from the same list", async () => {
    // ⚠ DISCRIMINATION, not vocabulary: two rows in, exactly one out.
    mockConnections.mockResolvedValue([
      connection({ id: "on", name: "Live Drive", is_enabled: true }),
      connection({ id: "off", name: "Paused Drive", is_enabled: false }),
    ])

    render(<ConnectedSourceSection />)

    expect(await screen.findByText(/Live Drive/)).toBeInTheDocument()
    expect(screen.queryByText(/Paused Drive/)).not.toBeInTheDocument()
  })

  it("does NOT offer a connection no adapter is registered for", async () => {
    // The Phase 238 capability rule, still holding — a different reason for the same absence.
    mockConnections.mockResolvedValue([
      connection({ id: "slack", service_id: "slack", name: "Slack Workspace" }),
    ])

    render(<ConnectedSourceSection />)

    await waitFor(() => expect(mockConnections).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Slack Workspace/)).not.toBeInTheDocument())
  })

  it("renders nothing at all when there is nothing to offer", async () => {
    // An empty picker that explains itself is still a control somebody has to read past — the
    // component's own shipped rule, pinned so a refactor cannot quietly turn it into an
    // empty-state card.
    mockConnections.mockResolvedValue([])

    const { container } = render(<ConnectedSourceSection />)

    await waitFor(() => expect(mockConnections).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent?.trim()).toBe(""))
  })
})
