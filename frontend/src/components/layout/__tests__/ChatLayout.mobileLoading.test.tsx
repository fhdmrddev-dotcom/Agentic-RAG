/**
 * Phase 299-05 (FIX-02 / D-27 / BUG-261027-02) — no chat list says "No recent chats" before it has
 * answered.
 *
 * Before 299 the first paint read `[]` with `switching` false, so the desktop history column and
 * the mobile drawer both said "No recent chats" for a person who has chats, until the list
 * arrived. `useThreads().pending` is true until the ACTIVE org's list has answered; ChatLayout
 * passes it as the column's `loading` (ChatHistoryColumn itself is unmodified) and gives the
 * mobile list the same "Loading your chats…" arm. The empty sentence appears only after a SETTLED
 * empty answer, unchanged in its words and style.
 *
 * Real ChatLayout + real useThreads + real ChatHistoryColumn; only `listThreads` is held on a
 * deferred promise so the before / after states are both observable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

const listThreads = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, listThreads }
})
vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({ "Content-Type": "application/json", Authorization: "Bearer tok-299" }),
  }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-299" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock("@/providers/StreamsProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/providers/StreamsProvider")>()
  return {
    ...actual,
    useStreamingThreadIds: () => new Set<string>(),
    useStreamActions: () => ({ stopThread: vi.fn() }),
    getActiveRunStartMs: () => null,
  }
})
vi.mock("@/components/org/ElsewhereLine", () => ({ ElsewhereLine: () => null }))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))
vi.mock("../NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("../ThreadCommandPalette", () => ({ ThreadCommandPalette: () => null }))
vi.mock("@/components/panel/WorkspacePanel", () => ({ WorkspacePanel: () => <aside data-testid="workspace-panel-stub" /> }))
vi.mock("@/components/chat/ChatArea", () => ({ ChatArea: () => <div data-testid="chat-area-stub" /> }))
vi.mock("@/pages/WorkflowsPage", () => ({ WorkflowsPage: () => <div data-testid="workflows-stub" /> }))

import { ChatLayout } from "../ChatLayout"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { useAppNavigation } from "@/hooks/useAppNavigation"
import { LOADING_CHATS } from "@/components/org/orgItemsCopy"
import type { Thread } from "@/types"

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
function mkThread(id: string, title: string): Thread {
  const now = new Date().toISOString()
  return { id, user_id: "u", title, folder_id: null, created_at: now, updated_at: now }
}

function Shell() {
  const nav = useAppNavigation()
  return (
    <EffectiveFeaturesProvider value={{ features: { visual_workflow_canvas: true }, loading: false, refetch: vi.fn() }}>
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
}

/** The mobile drawer opens from the md:hidden bar every non-chat view carries. */
function openDrawer() {
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))
  expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument()
}

beforeEach(() => {
  listThreads.mockReset()
  window.localStorage.clear()
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ChatLayout · desktop history column on first load (FIX-02)", () => {
  it("says Loading your chats… before the list answers, and No recent chats only after an empty answer", async () => {
    const gate = deferred<Thread[]>()
    listThreads.mockReturnValue(gate.promise)
    renderAt("/app")
    expect(await screen.findByText(LOADING_CHATS)).toBeInTheDocument()
    expect(screen.queryByText("No recent chats")).toBeNull()
    await act(async () => {
      gate.resolve([])
      await gate.promise
    })
    expect(await screen.findByText("No recent chats")).toBeInTheDocument()
    expect(screen.queryByText(LOADING_CHATS)).toBeNull()
  })

  it("a list that answers with chats shows them, never the loading line", async () => {
    listThreads.mockResolvedValue([mkThread("t1", "Quarterly plan")])
    renderAt("/app")
    expect(await screen.findByText("Quarterly plan")).toBeInTheDocument()
    expect(screen.queryByText(LOADING_CHATS)).toBeNull()
    expect(screen.queryByText("No recent chats")).toBeNull()
  })
})

describe("ChatLayout · mobile drawer list on first load (FIX-02)", () => {
  it("says Loading your chats… while pending, never No recent chats; the empty sentence after a settled empty answer", async () => {
    const gate = deferred<Thread[]>()
    listThreads.mockReturnValue(gate.promise)
    renderAt("/app/workflows")
    await screen.findByTestId("workflows-stub")
    openDrawer()
    expect(screen.getByText(LOADING_CHATS)).toBeInTheDocument()
    expect(screen.queryByText("No recent chats")).toBeNull()
    await act(async () => {
      gate.resolve([])
      await gate.promise
    })
    const empty = await screen.findByText("No recent chats")
    expect(empty.className).toContain("text-[10px]")
    expect(empty.className).toContain("italic")
    expect(screen.queryByText(LOADING_CHATS)).toBeNull()
  })

  it("after settling, a search with no match still says No chats match your search.", async () => {
    listThreads.mockResolvedValue([mkThread("t1", "Quarterly plan")])
    renderAt("/app/workflows")
    await screen.findByTestId("workflows-stub")
    openDrawer()
    expect(await screen.findByText("Quarterly plan")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "Search chats" }), { target: { value: "zzz-nothing" } })
    expect(screen.getByText("No chats match your search.")).toBeInTheDocument()
    expect(screen.queryByText(LOADING_CHATS)).toBeNull()
  })
})
