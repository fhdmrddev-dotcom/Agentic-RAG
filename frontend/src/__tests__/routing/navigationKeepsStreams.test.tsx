/**
 * D-10 (Phase 297-02, LINK-01 / T-297-10) — A LIVE ANSWER SURVIVES NAVIGATION.
 *
 * The router sits ABOVE App, so the one way it can hurt a streaming answer is by remounting the
 * provider stack: StreamsProvider's unmount aborts every live subscription. One catch-all route
 * with no children and no key keeps `<App />` — and OrgProvider and StreamsProvider under it —
 * mounted across every navigation (D-07). This suite proves it on the REAL tree: the real App,
 * the real OrgProvider and the real StreamsProvider, with only ChatLayout replaced by a probe.
 *
 * The probe starts a Deep turn in thread A through the real stream actions, then the case drives
 * six navigations — Library → Workflows → Back → Forward → Settings → Back — through the hook's
 * own navigators (the props App hands ChatLayout) and the router's history. Afterwards the one
 * subscription is still the one subscription: called once, its abort signal never fired, the
 * thread still streaming, and the probe mounted exactly once and never unmounted.
 *
 * ⛔ RED-DRIVEN at 297-02: planting a path-derived key on App's streams provider turns the mount
 * counter and the abort signal red (recorded in 297-02-SUMMARY.md). Not run under StrictMode on
 * purpose: StrictMode's development double-mount would itself read as a remount here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, act, waitFor, cleanup } from "@testing-library/react"
import { useEffect } from "react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

const h = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
  probe: {
    mounts: 0,
    unmounts: 0,
    props: null as null | { activeView: string; onNavigate: (v: string) => void },
    actions: null as null | {
      setViewingThread: (id: string | null) => void
      sendMessage: (threadId: string, text: string) => Promise<unknown>
    },
  },
  THREAD_A: "thread-297-a",
  RUN: "run-297-a",
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-297" },
    session: { access_token: "tok-297" },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    getSetupStatus: vi.fn().mockResolvedValue({ needs_setup: false, finalized: true, has_token: false }),
    getMaintenanceStatus: vi.fn().mockResolvedValue(false),
    getOperatorProbe: vi.fn().mockResolvedValue(null),
    getEffectiveFeatures: vi.fn().mockResolvedValue({}),
    getOrgPermissions: vi.fn().mockResolvedValue({
      org_id: null,
      role: "member",
      can_manage: false,
      can_audit_view: false,
      can_manage_sso: false,
      memberships: [],
    }),
    provisionSso: vi.fn().mockResolvedValue(undefined),
    postMessage: h.mockPostMessage,
    subscribeToRun: h.mockSubscribeToRun,
    getMessages: h.mockGetMessages,
    getActiveRuns: h.mockGetActiveRuns,
    getSnapshot: h.mockGetSnapshot,
    getThreadWorkflow: h.mockGetThreadWorkflow,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-297" }, access_token: "tok-297" } },
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
  hydrateSupabaseFromRuntime: vi.fn().mockResolvedValue(undefined),
}))

// The probe stands where ChatLayout stands: under the real providers, fed by the real hook.
vi.mock("@/components/layout/ChatLayout", async () => {
  const { useStreamActions } = await import("@/providers/StreamsProvider")
  function ChatLayoutProbe(props: { activeView: string; onNavigate: (v: string) => void }) {
    h.probe.props = props
    const actions = useStreamActions()
    useEffect(() => {
      h.probe.mounts += 1
      return () => {
        h.probe.unmounts += 1
      }
    }, [])
    h.probe.actions = actions as unknown as typeof h.probe.actions
    return <div data-testid="probe">{props.activeView}</div>
  }
  return { ChatLayout: ChatLayoutProbe }
})

const { THREAD_A, RUN } = h

import App from "@/App"
import { useStreamsStore } from "@/stores/streamsStore"
import mainSource from "@/main.tsx?raw"
import appSource from "@/App.tsx?raw"

function resetStore() {
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
    workflowLockByThread: new Map(),
    continuingThreads: new Set(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
  h.probe.mounts = 0
  h.probe.unmounts = 0
  h.probe.props = null
  h.probe.actions = null
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
  h.mockGetMessages.mockResolvedValue([])
  h.mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  h.mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  h.mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  h.mockPostMessage.mockResolvedValue({ message_id: "msg-297", run_id: RUN })
  h.mockSubscribeToRun.mockImplementation(() => new Promise<void>(() => {}))
})

afterEach(() => {
  cleanup()
  resetStore()
  vi.unstubAllGlobals()
})

const SETUP = { timeout: 5000 }

const nav = (view: string) =>
  act(async () => {
    h.probe.props!.onNavigate(view)
  })

describe("D-10 — a live stream in thread A survives six navigations", () => {
  it("Library → Workflows → Back → Forward → Settings → Back leave the one subscription untouched", async () => {
    const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: ["/app"] })
    render(<RouterProvider router={router} />)

    // Start a Deep turn in thread A through the real stream actions (only a viewed thread opens
    // a stream — the StreamsProvider.capPausedDone harness).
    // Setup waits get a load-tolerant timeout: App boots through the setup probe and the providers
    // first, and a cold transform under a parallel run can exceed waitFor's 1 s default.
    await waitFor(() => expect(h.probe.actions).not.toBeNull(), SETUP)
    await act(async () => {
      h.probe.actions!.setViewingThread(THREAD_A)
    })
    await waitFor(() => expect(h.mockGetThreadWorkflow).toHaveBeenCalled(), SETUP)
    await act(async () => {
      void h.probe.actions!.sendMessage(THREAD_A, "research this thoroughly")
    })
    await waitFor(() => expect(h.mockSubscribeToRun).toHaveBeenCalledTimes(1), SETUP)
    const signal = h.mockSubscribeToRun.mock.calls[0][3] as AbortSignal
    expect(signal).toBeInstanceOf(AbortSignal)
    const subsBefore = useStreamsStore.getState().subscriptionsByThread.get(THREAD_A)?.size
    expect(subsBefore).toBeGreaterThan(0)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_A)).toBe(true)

    await nav("documents")
    expect(router.state.location.pathname).toBe("/app/library")
    await nav("workflows")
    expect(router.state.location.pathname).toBe("/app/workflows")
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe("/app/library")
    await act(() => router.navigate(1))
    expect(router.state.location.pathname).toBe("/app/workflows")
    await nav("settings")
    expect(router.state.location.pathname).toBe("/app/settings")
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe("/app/workflows")
    expect(h.probe.props!.activeView).toBe("workflows")

    expect(h.mockSubscribeToRun).toHaveBeenCalledTimes(1)
    expect(signal.aborted).toBe(false)
    expect(useStreamsStore.getState().subscriptionsByThread.get(THREAD_A)?.size).toBe(subsBefore)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_A)).toBe(true)
    expect(h.probe.mounts).toBe(1)
    expect(h.probe.unmounts).toBe(0)
  })
})

/** Line-anchored comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("D-07 — the tree shape that makes the above true, as source", () => {
  it("main.tsx creates exactly ONE route object, path '*', with no children", () => {
    const code = codeOf(mainSource)
    expect(code).toContain("createBrowserRouter([{ path: '*', Component: App }])")
    expect(code.match(/path:\s*['"]/g) ?? []).toHaveLength(1)
    expect(code).not.toMatch(/children/)
    expect(code).toContain("<RouterProvider router={router} />")
  })

  it("App's provider JSX carries no key=", () => {
    const code = codeOf(appSource)
    // Non-vacuity: the providers are really in this source.
    expect(code).toContain("<OrgProvider")
    expect(code).toContain("<StreamsProvider")
    // 297-REVIEW IN-04 (2026-10-28): the leave-guard provider (added 297-03, wraps ChatLayout) is
    // in the alternation too, and a planted key on it is caught (the alternation's own control).
    expect(code).toContain("<LeaveGuardContext.Provider")
    const KEYED = /<(OrgProvider|StreamsProvider|TooltipProvider|TechnicalNamesProvider|EffectiveFeaturesProvider|CitationNavProvider|LeaveGuardContext\.Provider|ChatLayout)\b[^>]*\bkey=/
    expect("<LeaveGuardContext.Provider key={pathname} value={nav.leaveGuards}>").toMatch(KEYED)
    expect(code).not.toMatch(KEYED)
  })
})
