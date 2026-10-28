/**
 * 289-REVIEW WR-05 — `?run=<id>` must not outlive the run page.
 *
 * Only `RunEvidenceReport` wrote or cleared the link. A deep link to a run that is still ACTIVE
 * or PAUSED renders the live surface, which never mounts the report, so "‹ Back to Workflows" (or
 * any nav-rail jump) left `?run=<id>` in the address bar. App's view initializer turns any valid
 * link into the run page, so the next reload dropped the person back on that run instead of
 * where they had navigated: the address bar no longer named the record on screen.
 *
 * D-297-10 (Phase 297-02, D-16 / D-18): RE-TARGETED, not retired. The run now has its own address,
 * `/app/runs/<id>`, held by the router, and nothing writes `?run=` any more. The property WR-05
 * protected is unchanged — the address names the record on screen, before AND after leaving it —
 * so the cases drive the real hook + ChatLayout under a memory router: a cold run address shows the
 * live run and stays put, Back to Workflows lands on `/app/workflows` with no `run` anywhere, and
 * the legacy `?run=` link still opens the run on its new address.
 *
 * The run page itself is stubbed here as a LIVE run (no report, so nothing of its own touches the
 * address).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({
      "Content-Type": "application/json",
      Authorization: "Bearer tok-289",
    }),
  }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-289" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))
vi.mock("../NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("../ChatHistoryColumn", () => ({ ChatHistoryColumn: () => <div data-testid="history-stub" /> }))
vi.mock("../ThreadCommandPalette", () => ({ ThreadCommandPalette: () => <div data-testid="palette-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="workspace-panel-stub" />,
}))
vi.mock("@/components/chat/ChatArea", () => ({ ChatArea: () => <div data-testid="chat-area-stub" /> }))
vi.mock("@/pages/WorkflowsPage", () => ({ WorkflowsPage: () => <div data-testid="workflows-stub" /> }))
// A LIVE run: the live surface, with its own Back control, and no evidence report.
vi.mock("@/pages/WorkflowRunPage", () => ({
  WorkflowRunPage: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="live-run-stub">
      <button type="button" onClick={onBack}>
        Back to Workflows
      </button>
    </div>
  ),
}))

import { ChatLayout } from "../ChatLayout"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { useAppNavigation } from "@/hooks/useAppNavigation"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"

/** App's wiring, minus auth and the provider stack: the hook feeds ChatLayout's props. */
function Shell() {
  const nav = useAppNavigation()
  return (
    <EffectiveFeaturesProvider
      value={{ features: { visual_workflow_canvas: true }, loading: false, refetch: vi.fn() }}
    >
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={nav.activeView}
        onNavigate={nav.onNavigate}
        navItems={[]}
        isOperator={false}
        operatorIdentity={null}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={nav.studioSkillId}
        studioTab={nav.studioTab}
        onOpenStudio={nav.handleOpenStudio}
        onReviewEvals={nav.handleReviewEvals}
        onStudioTabChange={nav.handleStudioTabChange}
        onTuneSkill={nav.handleTuneSkill}
        activeRunId={nav.runId}
        openRun={nav.openRun}
        addressNotFound={nav.addressNotFound}
      />
    </EffectiveFeaturesProvider>
  )
}

function renderAt(entry: string) {
  const router = createMemoryRouter([{ path: "*", Component: Shell }], { initialEntries: [entry] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ChatLayout · the run address follows the view (289-REVIEW WR-05, D-297-10)", () => {
  it("a cold /app/runs/<id> shows the live run and the address stays on it", async () => {
    const router = renderAt(`/app/runs/${RUN_ID}`)
    await screen.findByTestId("live-run-stub")
    expect(router.state.location.pathname).toBe(`/app/runs/${RUN_ID}`)
    expect(router.state.location.search).toBe("")
  })

  it("Back to Workflows lands on /app/workflows with no run anywhere in the address", async () => {
    const router = renderAt(`/app/runs/${RUN_ID}`)
    fireEvent.click(await screen.findByRole("button", { name: "Back to Workflows" }))
    await screen.findByTestId("workflows-stub")
    expect(router.state.location.pathname).toBe("/app/workflows")
    expect(router.state.location.search).toBe("")
    expect(`${router.state.location.pathname}${router.state.location.search}`).not.toContain(RUN_ID)
  })

  it("the legacy /app?run=<id> link still opens the run, on its new address (replaced, D-16)", async () => {
    const router = renderAt(`/app?run=${RUN_ID}&keep=1`)
    await screen.findByTestId("live-run-stub")
    await waitFor(() => expect(router.state.location.pathname).toBe(`/app/runs/${RUN_ID}`))
    expect(new URLSearchParams(router.state.location.search).get("run")).toBeNull()
    expect(new URLSearchParams(router.state.location.search).get("keep")).toBe("1")
    expect(router.state.historyAction).toBe("REPLACE")
  })
})
