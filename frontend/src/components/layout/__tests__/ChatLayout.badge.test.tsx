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
// 301 WR-01: every Realtime status the channel double hands the hook, in order.
const realtime = vi.hoisted(() => ({ delivered: [] as string[] }))

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
    // Phase 301-02 (F11): `useWaitingNotices` now runs inside every ChatLayout mount and opens a
    // user-scoped channel. `vi.fn()` alone returned `undefined` (the hook survives that too), but
    // a real-shaped channel — a chainable `on` and a `subscribe` — is what the shell meets in the
    // product, so the double carries one.
    // ⚠ 301 WR-01: `subscribe` DOES report "SUBSCRIBED" on a microtask, as a real join does. The
    // earlier double never fired its status callback, so the D-14 "exactly once on mount" count
    // below could not see the SUBSCRIBED refetch the product makes — a fence blind to the trigger
    // it was meant to count. `realtime.delivered` records each status handed over (non-vacuity).
    channel: vi.fn(() => {
      const ch: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = {
        on: vi.fn(),
        subscribe: vi.fn(),
      }
      ch.on.mockReturnValue(ch)
      ch.subscribe.mockImplementation((cb?: (status: string) => void) => {
        if (typeof cb === "function") {
          queueMicrotask(() => {
            realtime.delivered.push("SUBSCRIBED")
            cb("SUBSCRIBED")
          })
        }
        return ch
      })
      return ch
    }),
    removeChannel: vi.fn(),
  },
}))

// Phase 301-02 (D-14 / D-15): the waiting-notices client is NOT in the `@/lib/api` barrel either,
// so it is mocked by its own path, exactly like `@/lib/api/sources` above. Zero notices by default:
// every case below that predates 301 is a world with nothing waiting.
const { mockGetWaitingNotices } = vi.hoisted(() => ({ mockGetWaitingNotices: vi.fn() }))
vi.mock("@/lib/api/notifications", () => ({
  getWaitingNotices: mockGetWaitingNotices,
}))

// Heavy leaves that are irrelevant to the signal and pull their own seams.
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="panel-stub" />,
}))
vi.mock("@/pages/WorkflowRunPage", () => ({
  WorkflowRunPage: () => <div data-testid="run-page-stub" />,
}))
// 301-03 (D-30): a cheap non-chat view, so the non-chat mobile bar can be asserted.
vi.mock("@/pages/SkillsPage", () => ({
  SkillsPage: () => <div data-testid="skills-page-stub" />,
}))

import { ChatLayout } from "../ChatLayout"
import { REFETCH_COALESCE_MS } from "@/hooks/useWaitingNotices"
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

function renderLayout(
  overrides: {
    onOpenLibraryHealth?: (() => void) | undefined
    // 301-03: a non-chat view (its mobile bar) and the run door the waiting rows open.
    activeView?: "chat" | "skills"
    openRun?: (runId: string) => void
  } = { onOpenLibraryHealth: vi.fn() },
) {
  return render(
    <TooltipProvider>
      <StreamsProvider>
        <ChatLayout
          onSignOut={vi.fn()}
          activeView={overrides.activeView ?? "chat"}
          openRun={overrides.openRun}
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
          onOpenLibraryHealth={overrides.onOpenLibraryHealth}
        />
      </StreamsProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  realtime.delivered.length = 0
  mockGetSourceHealth.mockResolvedValue(TWO_STOPPED)
  mockGetWaitingNotices.mockResolvedValue({ notices: [], total: 0 })
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

// ══ PHASE 301-02 (D-12 / D-14) — THE LIBRARY MARK STAYS THE LIBRARY'S ════════════════════
//
// A waiting run is a SECOND tenant of the one read. It must never add to the Library's number
// (rail badge, drawer badge) — those count `library` conditions only — but a waiting run ALONE
// must still light the phone's hamburger dot, because the dot is the only signal a closed drawer
// has. The words of the waiting list are 301-03's; this block proves the counts.
const ONE_STOPPED = { ...TWO_STOPPED, stopped: [TWO_STOPPED.stopped[0]] }
const TWO_WAITING = {
  notices: [
    {
      id: "n-1",
      run_id: "run-1",
      org_id: "org-a",
      org_name: "Acme",
      workflow_name: "Quarterly review",
      kind: "question" as const,
      origin: "app" as const,
      created_at: "2026-10-30T09:00:00Z",
    },
    {
      id: "n-2",
      run_id: "run-2",
      org_id: "org-b",
      org_name: "Beta",
      workflow_name: "Contract approval",
      kind: "approval" as const,
      origin: "schedule" as const,
      created_at: "2026-10-30T08:00:00Z",
    },
  ],
  total: 2,
}

describe("301-02 — the mark partition in the shell", () => {
  it("a WAITING-ONLY world: no Library badge anywhere, and the hamburger dot IS lit", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const user = userEvent.setup()
    renderLayout()

    expect(await screen.findByTestId("drawer-trigger-dot")).toBeInTheDocument()
    expect(screen.queryByTestId("rail-badge")).toBeNull()
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(screen.queryByTestId("drawer-attention-badge")).toBeNull()
  })

  it("a MIXED world: the Library badges read 1, never 3, and the dot is lit", async () => {
    mockGetSourceHealth.mockResolvedValue(ONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const user = userEvent.setup()
    renderLayout()

    const railBadge = await screen.findByTestId("rail-badge")
    // Both fetches have landed before the count is read — otherwise "1" would be vacuous.
    await waitFor(() => expect(mockGetWaitingNotices).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("drawer-trigger-dot")).toBeInTheDocument()
    expect(railBadge).toHaveTextContent(/^1$/)
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(await screen.findByTestId("drawer-attention-badge")).toHaveTextContent(/^1$/)
  })

  it("reads each source of attention EXACTLY ONCE on mount (D-14)", async () => {
    mockGetSourceHealth.mockResolvedValue(ONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    renderLayout()
    await screen.findByTestId("rail-badge")
    // The waiting answer has LANDED (only a settled total of 2 renders this pill)…
    expect(await screen.findByTestId("rail-waiting-badge")).toHaveTextContent(/^2$/)
    // …and the channel really did report SUBSCRIBED, so the count below measures the trigger the
    // product fires rather than a double that never fires it (301 WR-01).
    expect(realtime.delivered).toContain("SUBSCRIBED")
    // Let any trailing coalesce window close before counting.
    await new Promise((r) => setTimeout(r, REFETCH_COALESCE_MS + 100))
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)
    expect(mockGetWaitingNotices).toHaveBeenCalledTimes(1)
  })

  it("the waiting dot does not depend on a Library navigator being wired", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    renderLayout({ onOpenLibraryHealth: undefined })
    expect(await screen.findByTestId("drawer-trigger-dot")).toBeInTheDocument()
  })
})

// ══ PHASE 301-03 (D-01, D-03, D-17, D-30) — THE CONTROL ON THE RAIL, IN THE DRAWER, ON EVERY BAR ══
//
// The shell's one read now feeds the waiting control too: the rail pill, the phone drawer's
// "Waiting on you" row, and the hamburger dot on the chat view AND on every non-chat view's bar.
describe("301-03 — Waiting on you in the shell", () => {
  it("waiting-only: the rail pill reads 2; the drawer row is named by the count with an inline pill; no Library badge", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const user = userEvent.setup()
    renderLayout()

    expect(await screen.findByTestId("rail-waiting-badge")).toHaveTextContent(/^2$/)
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    const row = await screen.findByTestId("drawer-waiting-row")
    expect(row).toHaveAttribute("aria-label", "2 workflow runs are waiting on you")
    expect(row).toHaveTextContent("Waiting on you")
    const pill = row.querySelector("[aria-hidden='true'].ml-auto")
    expect(pill).not.toBeNull()
    expect(pill).toHaveTextContent(/^2$/)
    expect(screen.queryByTestId("drawer-attention-badge")).toBeNull()
  })

  it("selecting a row from the drawer list opens THAT run and closes the drawer", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const openRun = vi.fn()
    const user = userEvent.setup()
    renderLayout({ onOpenLibraryHealth: vi.fn(), openRun })

    await screen.findByTestId("rail-waiting-badge")
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    await user.click(await screen.findByTestId("drawer-waiting-row"))
    const pop = await screen.findByTestId("waiting-popover")
    const rows = pop.querySelectorAll("[role='menuitem']")
    expect(rows).toHaveLength(2)
    await user.click(rows[0] as HTMLElement)
    expect(openRun).toHaveBeenCalledTimes(1)
    expect(openRun).toHaveBeenCalledWith("run-1")
    await waitFor(() => expect(screen.queryByTestId("drawer-waiting-row")).toBeNull())
  })

  it("before the first answer: named 'Waiting on you', no pill; an answer of zero opens the empty line", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    let resolve: (v: { notices: never[]; total: number }) => void = () => {}
    mockGetWaitingNotices.mockReturnValue(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    renderLayout()

    const trigger = await screen.findByTestId("rail-waiting-trigger")
    expect(trigger).toHaveAttribute("aria-label", "Waiting on you")
    expect(screen.queryByTestId("rail-waiting-badge")).toBeNull()
    await user.click(trigger)
    expect(await screen.findByText("Checking what's waiting on you…")).toBeInTheDocument()
    await user.keyboard("{Escape}")

    resolve({ notices: [], total: 0 })
    await user.click(screen.getByTestId("rail-waiting-trigger"))
    expect(await screen.findByTestId("waiting-empty")).toHaveTextContent("Nothing is waiting on you.")
    expect(screen.queryByTestId("rail-waiting-badge")).toBeNull()
  })

  it("a later failed fetch after a count of 2 keeps the pill at 2 and shows the stale line", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const user = userEvent.setup()
    renderLayout()

    expect(await screen.findByTestId("rail-waiting-badge")).toHaveTextContent(/^2$/)
    mockGetWaitingNotices.mockRejectedValue(new Error("offline"))
    window.dispatchEvent(new Event("focus"))
    await waitFor(() => expect(mockGetWaitingNotices).toHaveBeenCalledTimes(2))

    await user.click(screen.getByTestId("rail-waiting-trigger"))
    expect(await screen.findByTestId("waiting-stale")).toHaveTextContent(
      "Couldn't refresh just now. This is the last list we got.",
    )
    expect(screen.getByTestId("rail-waiting-badge")).toHaveTextContent(/^2$/)
  })

  it("a NON-CHAT view's mobile bar carries the dot when a run waits, and none when nothing does (D-30)", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    mockGetWaitingNotices.mockResolvedValue(TWO_WAITING)
    const { unmount } = renderLayout({ onOpenLibraryHealth: vi.fn(), activeView: "skills" })
    await screen.findByTestId("skills-page-stub")
    const bar = await screen.findByRole("button", { name: /open navigation/i })
    await waitFor(() => expect(bar.querySelector("[data-testid='drawer-trigger-dot']")).not.toBeNull())
    unmount()

    mockGetWaitingNotices.mockResolvedValue({ notices: [], total: 0 })
    renderLayout({ onOpenLibraryHealth: vi.fn(), activeView: "skills" })
    await screen.findByTestId("skills-page-stub")
    await waitFor(() => expect(mockGetWaitingNotices).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId("drawer-trigger-dot")).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ THE READER INVENTORY FENCE — Phase 235 plan 15 (gap-closure round 1 · verification G4)
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ── WHY A SECOND GUARD, WHEN `toHaveBeenCalledTimes(1)` ALREADY EXISTS ────────────────────
 *
 * That case is correct and stays untouched: it proves the SHELL reads once. **It is also blind
 * to the defect verification found**, because it never mounts the Library — and the Library's
 * active tab body mounts a SECOND `useSourceAttention()`. `attentionConditions.ts` shipped a
 * docblock asserting one reader per render tree while the tree carried two, and no test in the
 * repository could see it. This is that test.
 *
 * ── WHAT IT PINS, AND WHY A GREP OF THE MOUNT FILES WOULD NOT HAVE DONE ──────────────────
 *
 * This suite's own docblock above already records that the originally-proposed grep could not
 * fire: `ChatLayout.tsx` contains the literal ZERO times — it reads through the
 * `ATTENTION_PRODUCERS` registry — so grepping the mount files matches nothing in a one-reader
 * OR a two-reader world. The property that actually matters is **how many call sites exist in
 * the whole source tree**, so this sweeps every non-test `.ts`/`.tsx` under `src/` with
 * `import.meta.glob(…?raw)` and pins the inventory BY FILE, not merely the total. A fourth
 * reader anywhere reddens this.
 *
 * ⚠ Two exclusions, both deliberate and both non-vacuity-checked below:
 *   • `hooks/useSourceAttention.ts` — its own `export function useSourceAttention(` is the
 *     DEFINITION, not a call site.
 *   • test files — the hook's own suite calls it inside `renderHook` many times, which is
 *     exactly what a hook's suite should do and says nothing about the product tree.
 */
describe("source-attention reader inventory — a fourth reader cannot arrive silently", () => {
  const RAW = import.meta.glob("../../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>

  /**
   * `src/`-relative path for a glob key.
   *
   * ⚠ MEASURED, not assumed: Vite normalises each key to the SHORTEST relative path from the
   * importing file, so a single pattern yields keys of DIFFERENT depths — `../ChatLayout.tsx`,
   * `../../ui/tabs.tsx` and `../../../pages/LibraryPage.tsx` all came out of the one glob
   * above. Stripping a fixed `../` prefix therefore collapses distinct files onto colliding
   * names; the key has to be RESOLVED against this file's own directory.
   */
  const HERE = "src/components/layout/__tests__"
  const rel = (key: string): string => {
    const out = HERE.split("/")
    for (const seg of key.replace(/\\/g, "/").split("/")) {
      if (seg === "..") out.pop()
      else if (seg !== "." && seg !== "") out.push(seg)
    }
    return out.join("/").replace(/^src\//, "")
  }

  const BY_PATH: Record<string, string> = Object.fromEntries(
    Object.entries(RAW).map(([key, src]) => [rel(key), src]),
  )

  const isProductFile = (key: string) => {
    const p = rel(key)
    if (/\.test\.tsx?$/.test(p)) return false
    if (p.includes("__tests__/")) return false
    // The hook's own definition file — a declaration, never a call site.
    if (p === "hooks/useSourceAttention.ts") return false
    return true
  }

  /**
   * The LINE-ANCHORED comment stripper (`renameFence.test.ts:89`). ⚠ The `^\s*` on the line
   * comment replace is load-bearing: the unanchored variant eats live code.
   *
   * ⛔ IT IS NOT OPTIONAL HERE, AND THAT WAS MEASURED. The first version of this fence counted
   * raw text and read `attentionConditions.ts` as THREE call sites — because the docblock this
   * plan rewrote quotes `useSourceAttention()` in prose. A code measurement satisfiable (or
   * breakable) by a comment is exactly the 187-24 lesson `App.tsx:91-101` already records.
   */
  const codeOf = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  /** Call sites in one file's CODE: the identifier immediately followed by `(`. */
  const callSites = (src: string) => (codeOf(src).match(/useSourceAttention\s*\(/g) ?? []).length

  const inventory = Object.entries(RAW)
    .filter(([key]) => isProductFile(key))
    .map(([key, src]) => [rel(key), callSites(src)] as const)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  // ── SELF-GUARDS. A sweep that read nothing is green and defends nothing. ────────────────
  it("self-guard: the glob really loaded the source tree as text, and the exclusions bite", () => {
    expect(Object.keys(RAW).length).toBeGreaterThan(200)
    // The resolver works at three different key depths — the property that broke first.
    expect(BY_PATH["hooks/useSourceAttention.ts"]).toContain("export function useSourceAttention")
    expect(BY_PATH["components/layout/ChatLayout.tsx"]).toContain("ATTENTION_PRODUCERS")
    expect(BY_PATH["components/ui/tabs.tsx"]).toContain("TabsPrimitive")
    // …and the exclusions really excluded something, or the arms below are vacuous.
    expect(Object.keys(RAW).some((k) => /\.test\.tsx?$/.test(rel(k)))).toBe(true)
    expect(inventory.map(([p]) => p)).not.toContain("hooks/useSourceAttention.ts")
  })

  it("self-guard: the stripper removes PROSE and keeps CODE — the pair that reds a broken one", () => {
    const registry = BY_PATH["components/layout/attentionConditions.ts"]
    // A token that exists ONLY in that file's docblock. Present raw, absent from the code.
    expect(registry).toContain("MOUNTED SUBTREE")
    expect(codeOf(registry)).not.toContain("MOUNTED SUBTREE")
    // …and the stripper did not return "": the real call and the real export survive.
    expect(codeOf(registry)).toContain("ATTENTION_PRODUCERS")
    expect(codeOf(registry)).toContain("useSourceAttention()")
    // ⛔ THE DEFECT THIS PAIR EXISTS FOR: the docblock quotes the hook name in prose, so a
    // fence counting RAW text reads this file as 3 readers instead of 1.
    expect((registry.match(/useSourceAttention\s*\(/g) ?? []).length).toBeGreaterThan(1)
    expect(callSites(registry)).toBe(1)
  })

  it("⛔ EXACTLY THREE product call sites, and they are the three that are supposed to exist", () => {
    expect(inventory).toEqual([
      // The shell reader. `ChatLayout` reaches it through `ATTENTION_PRODUCERS` — which is why
      // grepping `ChatLayout.tsx` itself finds nothing and this fence looks at the registry.
      ["components/layout/attentionConditions.ts", 1],
      // The Library's Ingestion tab body.
      ["components/library/IngestionTab.tsx", 1],
      // The Library's Health tab body — mutually exclusive with the one above, by tab.
      ["components/library/SourcesAttentionSection.tsx", 1],
    ])
  })

  it("`ChatLayout.tsx` reads the verdict through the registry and never calls the hook itself", () => {
    const layout = BY_PATH["components/layout/ChatLayout.tsx"]
    expect(layout).toBeTypeOf("string")
    expect(callSites(layout)).toBe(0)
    // Non-vacuity: it really is the shell, and it really does resolve the registry ONCE.
    expect((layout.match(/ATTENTION_PRODUCERS\.flatMap/g) ?? []).length).toBe(1)
  })

  it("⚠ the two Library readers are mutually exclusive BY TAB — no `forceMount` anywhere", () => {
    // This is what makes the live count TWO rather than three. Radix unmounts an inactive
    // `TabsContent`; a `forceMount` on either body would mount both at once.
    expect(BY_PATH["components/ui/tabs.tsx"]).not.toContain("forceMount")
    expect(BY_PATH["pages/LibraryPage.tsx"]).not.toContain("forceMount")
  })
})
