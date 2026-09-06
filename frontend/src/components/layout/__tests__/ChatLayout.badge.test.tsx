/**
 * Phase 235 plan 09 (SURF-03) — THE SIGNAL REACHES A MOBILE USER, AND IT IS READ ONCE.
 *
 * ── ⛔ WHY THIS SUITE EXISTS AT ALL, IN ONE SENTENCE ──────────────────────────────────
 *
 * `NavPanel.tsx` is `hidden md:flex` — **desktop only**. Closing SURF-03 against a rail badge
 * alone would close it against its own sentence (*"a broken watch reaches a person who is not
 * already looking at the page"*), which is the same class of error D-235-01 already rejected
 * once when it refused to let the Library Health tab carry the requirement by itself. So the
 * mobile home is built, and it is fenced HERE rather than asserted in a summary:
 *
 *   • the drawer's Library nav button carries the same badge, and still answers to "Library"
 *   • the drawer-OPENING control carries a dot, so a CLOSED drawer still signals
 *
 * ── ⛔ ONE READ, TWO RENDERERS — THE ASSERTION THAT MATTERS ───────────────────────────
 *
 * `ChatLayout` resolves the producer registry ONCE and hands the result to the rail, the
 * drawer row and the hamburger. A second `useSourceAttention()` anywhere in this tree means two
 * polls and, eventually, two disagreeing answers about the same source — the exact failure
 * D-235-05 exists to prevent.
 *
 * ⚠ THE ASSERTION IS `toHaveBeenCalledTimes(1)`, NEVER `toHaveBeenCalled()`. The second is
 * true of a two-reader world as well as a one-reader world, so it would pass in precisely the
 * situation it is supposed to catch.
 *
 * ⚠ THE GREP THAT WAS ORIGINALLY PROPOSED FOR THIS COULD NOT HAVE FIRED: the literal
 * `useSourceAttention` lives only inside `attentionConditions.ts`, so grepping the two mount
 * files for it matches nothing whether there is one reader or two. The runtime call count is
 * the real property.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageSquare, FileText } from "lucide-react"
import type { NavItem } from "@/lib/nav-items"

const { mockGetSourceHealth } = vi.hoisted(() => ({ mockGetSourceHealth: vi.fn() }))

// ⛔ `@/lib/api/sources` IS NOT IN THE `@/lib/api` BARREL (235-RESEARCH P-10): a
// `vi.mock("@/lib/api", …)` alone NEVER intercepts it, and this suite's whole subject is how
// many times ONE of its functions is called.
vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: mockGetSourceHealth,
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))

// The barrel. ⚠ A mock factory is an ALLOW-LIST — an export it omits does not fall back to the
// real module, it throws at mount (196-08: nine suites, 249 red cases, none about the subject).
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    createThread: vi.fn(),
    postMessage: vi.fn(),
    deleteThread: vi.fn(),
    uploadWorkspaceTemplate: vi.fn(),
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-test",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-test"], is_active: true }],
    }),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep", active_workflow_run_id: null }),
  }
})

vi.mock("@/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: [],
    loadMessages: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    setViewingThread: vi.fn(),
    resumeFromFailed: vi.fn(),
  }),
}))
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
vi.mock("@/lib/supabase", () => ({
  // ⚠ `useAuth` re-binds on this window event after a client rehydrate; the mock must carry
  // the constant as well as the client, or the effect throws at mount.
  SUPABASE_CLIENT_REHYDRATED: "supabase-client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
      // The rail footer's ProfileMenu reads `useAuth`, which subscribes here on mount.
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// Heavy leaves that are irrelevant to the signal and pull their own seams.
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="panel-stub" />,
}))
vi.mock("@/pages/WorkflowRunPage", () => ({
  WorkflowRunPage: () => <div data-testid="run-page-stub" />,
}))

import { ChatLayout } from "../ChatLayout"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Library" },
]

/** Two stopped sources, shaped exactly as `/sources/health` answers. */
const TWO_STOPPED = {
  stopped: [
    {
      watch_id: "w-1",
      source_folder_name: "Rate sheets",
      connection_name: "Drive · finance",
      cause: "token_revoked" as const,
      hard: true,
      stopped_since: "2026-09-05T09:00:00Z",
      last_good_at: "2026-09-04T09:00:00Z",
    },
    {
      watch_id: "w-2",
      source_folder_name: "Contracts",
      connection_name: "Drive · legal",
      cause: "folder_gone" as const,
      hard: true,
      stopped_since: "2026-09-05T10:00:00Z",
      last_good_at: null,
    },
  ],
  reader_running: true,
  poll_interval_seconds: 600,
}

const NONE_STOPPED = { stopped: [], reader_running: true, poll_interval_seconds: 600 }

function renderLayout() {
  return render(
    <TooltipProvider>
      <StreamsProvider>
        <ChatLayout
          onSignOut={vi.fn()}
          activeView="chat"
          onNavigate={vi.fn()}
          navItems={navItems}
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
          onOpenLibraryHealth={vi.fn()}
        />
      </StreamsProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSourceHealth.mockResolvedValue(TWO_STOPPED)
})
afterEach(() => cleanup())

// ══ NON-VACUITY FIRST ═════════════════════════════════════════════════════════════════
describe("ChatLayout attention signal — the harness", () => {
  it("mounts and renders the drawer-opening control the dot attaches to", async () => {
    renderLayout()
    expect(
      await screen.findByRole("button", { name: /open navigation/i }),
    ).toBeInTheDocument()
  })
})

// ══ ONE READ, TWO RENDERERS (D-235-05 · T-235-30) ═════════════════════════════════════
describe("ChatLayout attention signal — exactly one reader per render tree", () => {
  it("fetches the verdict EXACTLY ONCE while rail, drawer and hamburger all render it", async () => {
    const user = userEvent.setup()
    renderLayout()

    // The rail renderer (desktop) — present in jsdom, where `hidden md:flex` hides nothing.
    expect(await screen.findByTestId("rail-badge")).toBeInTheDocument()
    // The hamburger renderer — a CLOSED drawer still signals.
    expect(screen.getByTestId("drawer-trigger-dot")).toBeInTheDocument()
    // The drawer renderer.
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(await screen.findByTestId("drawer-attention-badge")).toBeInTheDocument()

    // ⛔ Three renderers, ONE read. A count of 2 is the two-reader world this fails.
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)
  })
})

// ══ THE MOBILE HOME ═══════════════════════════════════════════════════════════════════
describe("ChatLayout attention signal — the mobile drawer", () => {
  it("the drawer's Library button carries the badge and KEEPS its accessible name", async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(await screen.findByRole("button", { name: /open navigation/i }))

    const badge = await screen.findByTestId("drawer-attention-badge")
    expect(badge).toHaveAttribute("aria-hidden", "true")
    expect(badge).toHaveTextContent("2")

    // ⚠ The badge decorates the control; it must not rename it. `IngestionTab.tsx:176-188`
    // measured six broken cases the one time this rule was missed.
    const owner = badge.closest("button")
    expect(owner).not.toBeNull()
    expect(owner).toHaveAttribute("aria-label", "Library")
  })

  it("the drawer-opening control shows a dot, aria-hidden, so a CLOSED drawer still signals", async () => {
    renderLayout()
    const hamburger = await screen.findByRole("button", { name: /open navigation/i })
    const dot = screen.getByTestId("drawer-trigger-dot")
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(hamburger).toContainElement(dot)
    // The dot did not rename the control — it is still reachable by its own name.
    expect(hamburger).toHaveAttribute("aria-label", "Open navigation")
  })
})

// ══ SILENCE WHEN NOTHING IS WRONG (SC#4) ══════════════════════════════════════════════
describe("ChatLayout attention signal — a healthy instance is silent", () => {
  it("renders no badge and no dot anywhere when the server reports nothing stopped", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    const user = userEvent.setup()
    renderLayout()

    await screen.findByRole("button", { name: /open navigation/i })
    await waitFor(() => expect(mockGetSourceHealth).toHaveBeenCalledTimes(1))

    expect(screen.queryByTestId("rail-badge")).toBeNull()
    expect(screen.queryByTestId("drawer-trigger-dot")).toBeNull()
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(screen.queryByTestId("drawer-attention-badge")).toBeNull()
    // The Library door is still there — silence is the absence of a SIGNAL, not of the nav.
    expect(screen.getAllByRole("button", { name: "Library" }).length).toBeGreaterThan(0)
  })
})
