/**
 * 289-REVIEW WR-05 — `?run=<id>` must not outlive the run page.
 *
 * Only `RunEvidenceReport` wrote or cleared the link. A deep link to a run that is still ACTIVE
 * or PAUSED renders the live surface, which never mounts the report, so "‹ Back to Workflows" (or
 * any nav-rail jump) left `?run=<id>` in the address bar. App's view initializer turns any valid
 * link into the run page, so the next reload dropped the person back on that run instead of
 * where they had navigated: the address bar no longer named the record on screen.
 *
 * The run page itself is stubbed here as a LIVE run (no report, so nothing of its own clears the
 * link); the case is that leaving the view clears it.
 */
import { useState } from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

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
import type { ActiveView } from "@/App"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"

function Harness() {
  const [view, setView] = useState<ActiveView>("workflow-run")
  return (
    <EffectiveFeaturesProvider
      value={{ features: { visual_workflow_canvas: true }, loading: false, refetch: vi.fn() }}
    >
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={view}
        onNavigate={(v: ActiveView) => setView(v)}
        navItems={[]}
        isOperator={false}
        operatorIdentity={null}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={null}
        studioTab="evals"
        onOpenStudio={vi.fn()}
        onReviewEvals={vi.fn()}
        onStudioTabChange={vi.fn()}
        onTuneSkill={vi.fn()}
      />
    </EffectiveFeaturesProvider>
  )
}

beforeEach(() => {
  window.history.replaceState(null, "", `/app?run=${RUN_ID}&keep=1`)
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/")
})

describe("ChatLayout · the run deep link follows the view (289-REVIEW WR-05)", () => {
  it("keeps ?run= while the live run page is on screen", async () => {
    render(<Harness />)
    await screen.findByTestId("live-run-stub")
    expect(new URLSearchParams(window.location.search).get("run")).toBe(RUN_ID)
  })

  it("clears ?run= when the person leaves a LIVE run's page, and keeps every other param", async () => {
    render(<Harness />)
    fireEvent.click(await screen.findByRole("button", { name: "Back to Workflows" }))
    await screen.findByTestId("workflows-stub")

    const q = new URLSearchParams(window.location.search)
    expect(q.get("run")).toBeNull()
    expect(q.get("keep")).toBe("1")
  })
})
