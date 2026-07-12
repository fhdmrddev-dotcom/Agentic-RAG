/**
 * Phase 147 Plan 09 (ADMIN-02 / FLAG-01 / sketch 066) — ControlRoomPage contract.
 *
 * Locks the Wave-3 assembly: the D-08 five-tab band IA (Overview promoted to the
 * live "Control Plane" landing tab), the composed 063-B scroll (Health → Active
 * runs → Controls), the D-07 poll/visit discipline (exactly one "visit" row on
 * mount; silent polls that PAUSE on a hidden tab), and the "View all ›" → Audit
 * seam + the honest locked-tab refusal.
 *
 * The whole `@/lib/api` module is factory-mocked so the shell's fetch/poll/write
 * seams are observable without any network. Only the seven functions the shell
 * calls at runtime are needed (every other api export is a type, erased at build).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ControlRoomPage } from "../ControlRoomPage"
import type { BackpressureSignals, FullAppSettings } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getBackpressure: vi.fn(),
  getAdminActiveRuns: vi.fn(),
  getSettings: vi.fn(),
  getOperatorAudit: vi.fn(),
  recordControlPlaneEvent: vi.fn(),
  killRun: vi.fn(),
  setFlag: vi.fn(),
  // 149-07: the Model Registry tab lazily fetches the registry on open + writes through
  // these seams. Only getModelRegistry is called on render (tab-open); the writes fire on
  // interaction. ApiError/DISCOVERY_UNKNOWN are values the leaves import but never touch
  // on the idle/empty render path exercised here.
  getModelRegistry: vi.fn(),
  runModelDiscovery: vi.fn(),
  setModelCapability: vi.fn(),
  setModelLock: vi.fn(),
}))

import {
  getBackpressure,
  getAdminActiveRuns,
  getSettings,
  getOperatorAudit,
  getModelRegistry,
  recordControlPlaneEvent,
} from "@/lib/api"

const SIGNALS: BackpressureSignals = {
  anyio_threadpool_depth: { borrowed: 1, total: 40 },
  redis_active_runs: 0,
  postgres_pool_in_use: 2,
  per_worker_run_count: 0,
  dependencies: {
    redis: { state: "up", latency_ms: 3 },
    supabase: { state: "up", latency_ms: 12 },
    sandbox: { state: "off", latency_ms: null },
  },
}

// Only the flag fields the shell reads matter; cast the partial to the full type.
const SETTINGS = {
  web_search_enabled: true,
  sandbox_enabled: true,
  self_improve_enabled: true,
  workflows_enabled: true,
  maintenance_mode: false,
} as unknown as FullAppSettings

// document.hidden is a read-only getter in jsdom — drive it through a mutable var.
let mockHidden = false

beforeEach(() => {
  mockHidden = false
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => mockHidden,
  })
  vi.mocked(getBackpressure).mockResolvedValue(SIGNALS)
  vi.mocked(getAdminActiveRuns).mockResolvedValue([])
  vi.mocked(getSettings).mockResolvedValue(SETTINGS)
  vi.mocked(getOperatorAudit).mockResolvedValue([])
  vi.mocked(recordControlPlaneEvent).mockResolvedValue(undefined)
  vi.mocked(getModelRegistry).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

function renderPage() {
  return render(<ControlRoomPage identity={null} onBack={() => {}} />)
}

describe("ControlRoomPage (066) — the assembled Control Plane", () => {
  it("promotes Overview to the live 'Control Plane' landing tab with the five-tab band IA", () => {
    renderPage()
    const tablist = screen.getByRole("tablist")

    // Exactly the five sketch-066 tabs, in order; the landing tab is selected.
    const cp = within(tablist).getByRole("tab", { name: /control plane/i })
    expect(cp).toBeInTheDocument()
    expect(cp).toHaveAttribute("aria-selected", "true")
    expect(within(tablist).getByRole("tab", { name: /users & access/i })).toBeInTheDocument()
    expect(within(tablist).getByRole("tab", { name: /model registry/i })).toBeInTheDocument()
    expect(within(tablist).getByRole("tab", { name: /secrets/i })).toBeInTheDocument()
    expect(within(tablist).getByRole("tab", { name: /audit log/i })).toBeInTheDocument()

    // The retired 146 tabs are gone (System Controls dissolved into the body;
    // AI Models → Model Registry; API Keys → Secrets).
    expect(within(tablist).queryByRole("tab", { name: /system controls/i })).not.toBeInTheDocument()
    expect(within(tablist).queryByRole("tab", { name: /ai models/i })).not.toBeInTheDocument()
    expect(within(tablist).queryByRole("tab", { name: /api keys/i })).not.toBeInTheDocument()
  })

  it("composes the 063-B scroll — Health, Active runs, and Controls (grid + maintenance) in one surface", async () => {
    renderPage()

    // Health detail (HealthSignals plain labels).
    expect(screen.getByText(/agents working/i)).toBeInTheDocument()
    // Active runs (ActiveRunsSection — calm empty state).
    expect(await screen.findByText(/no runs in flight/i)).toBeInTheDocument()
    // Controls: the four capability switches + the separate Platform-state panel.
    expect(screen.getAllByRole("switch")).toHaveLength(4)
    expect(screen.getByRole("region", { name: /platform state/i })).toBeInTheDocument()
  })

  it("records EXACTLY one 'visit' row on mount and never records on a silent poll (D-07)", async () => {
    vi.useFakeTimers()
    try {
      renderPage()
      // Flush the mount fetches + the visit record.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(recordControlPlaneEvent).toHaveBeenCalledTimes(1)
      expect(recordControlPlaneEvent).toHaveBeenCalledWith("visit")

      // A silent poll fires the data GETs but records NOTHING.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      expect(recordControlPlaneEvent).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("auto-polls the read-only data ~10s while visible and PAUSES when the tab is hidden (D-07)", async () => {
    vi.useFakeTimers()
    try {
      renderPage()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      const afterMount = vi.mocked(getBackpressure).mock.calls.length
      expect(afterMount).toBeGreaterThanOrEqual(1)

      // One visible poll cycle → another backpressure read.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      const afterPoll = vi.mocked(getBackpressure).mock.calls.length
      expect(afterPoll).toBeGreaterThan(afterMount)

      // Hide the tab → the poll pauses; further time yields NO new reads.
      mockHidden = true
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40_000)
      })
      expect(vi.mocked(getBackpressure).mock.calls.length).toBe(afterPoll)
    } finally {
      vi.useRealTimers()
    }
  })

  it("'View all ›' switches to the Audit log tab", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /view all/i }))

    // The AuditTab full-history view is now shown (its own heading + footer note).
    expect(await screen.findByRole("heading", { name: /audit log/i })).toBeInTheDocument()
    expect(screen.getByText(/every operator action, no exceptions/i)).toBeInTheDocument()
  })

  it("a locked tab renders the honest LockedTab refusal — naming the capability, never a phase number", async () => {
    const user = userEvent.setup()
    renderPage()

    // Secrets is still locked (149 only unlocked Model Registry).
    await user.click(screen.getByRole("tab", { name: /secrets/i }))

    expect(screen.getByText(/not built yet — coming soon/i)).toBeInTheDocument()
    // The body copy names the arriving capability with NO roadmap number.
    expect(screen.getByText(/encrypted provider-key/i)).toBeInTheDocument()
    expect(screen.queryByText(/\b148\b/)).not.toBeInTheDocument()
  })

  it("the Model Registry tab is UNLOCKED (149-07) — it renders the editor + discovery, not a LockedTab", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("tab", { name: /model registry/i }))

    // The 070-A editor heading + the 071-A discovery panel render — NOT the locked refusal.
    expect(await screen.findByRole("heading", { name: /^model registry$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /run discovery/i })).toBeInTheDocument()
    expect(screen.queryByText(/not built yet — coming soon/i)).not.toBeInTheDocument()
    // The shell fetched the registry lazily on tab-open.
    expect(getModelRegistry).toHaveBeenCalled()
  })
})
