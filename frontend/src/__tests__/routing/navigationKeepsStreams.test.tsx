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
    // Phase 299-03: when set, the probe also renders the REAL link gate and its prompt (the Stay case).
    gate: false,
    gateThreads: [] as { id: string; title: string }[],
    props: null as null | {
      activeView: string
      onNavigate: (v: string) => void
      // Phase 299-02: App's one entity navigator object (D-02).
      entityLink?: { openThread: (id: string) => void; target: { kind: string; id: string } | null }
      // Phase 299-03: the gate reads the whole navigator object.
      [k: string]: unknown
    },
    actions: null as null | {
      setViewingThread: (id: string | null) => void
      sendMessage: (threadId: string, text: string) => Promise<unknown>
    },
  },
  THREAD_A: "thread-297-a",
  RUN: "run-297-a",
  // Phase 299-02: thread ADDRESSES take strict UUIDs (D-01), so the address case streams in these.
  THREAD_U: "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e71",
  THREAD_V: "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e72",
  // Phase 299-03: a run that lives in ANOTHER of the person's orgs (the switch prompt's case).
  RUN_B: "8b2c4d1e-5f3a-4b6c-9d7e-0f1a2b3c4d5e",
  resolveLink: vi.fn(),
}))

// Phase 299-03: the link resolver answers "this run is in Acme Legal" for the Stay case.
vi.mock("@/lib/api/links", () => ({ resolveLink: h.resolveLink }))

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
  const { LinkGate } = await import("@/components/layout/LinkGate")
  const { SwitchOrgPrompt } = await import("@/components/layout/SwitchOrgPrompt")
  function ChatLayoutProbe(props: NonNullable<typeof h.probe.props>) {
    h.probe.props = props
    const actions = useStreamActions()
    useEffect(() => {
      h.probe.mounts += 1
      return () => {
        h.probe.unmounts += 1
      }
    }, [])
    h.probe.actions = actions as unknown as typeof h.probe.actions
    if (!h.probe.gate) return <div data-testid="probe">{props.activeView}</div>
    const threads = h.probe.gateThreads.map((t) => ({ ...t, user_id: "user-297", folder_id: null, created_at: "", updated_at: "" }))
    return (
      <div data-testid="probe">
        <LinkGate
          entityLink={props.entityLink as never}
          threads={threads}
          threadsPending={false}
          loadThreads={async () => {}}
        >
          {(gate) => (
            <>
              {gate.notice}
              {gate.status === "prompt" ? <SwitchOrgPrompt {...gate.prompt} /> : <span>{gate.status}</span>}
            </>
          )}
        </LinkGate>
      </div>
    )
  }
  return { ChatLayout: ChatLayoutProbe }
})

const { THREAD_A, RUN, THREAD_U, THREAD_V, RUN_B } = h

import App from "@/App"
import { screen, fireEvent } from "@testing-library/react"
import * as api from "@/lib/api"
import { ACTIVE_ORG_STORAGE_KEY, getActiveOrgId, setActiveOrgId } from "@/lib/api/_core"
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
  h.probe.gate = false
  h.probe.gateThreads = []
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

// Phase 299-02 (D-02 / T-299-21): the selected thread now lives in the address, so a thread change
// is a NAVIGATION. It must be the same kind of navigation as the six above: no key, no remount, the
// one subscription untouched. Driven through App's own `entityLink` (the prop ChatLayout receives).
describe("D-02 — a live stream survives thread-address navigation (299-02)", () => {
  it("/app/chat/U → /app/chat/V → Back keeps the one subscription, never aborted, probe mounted once", async () => {
    const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: [`/app/chat/${THREAD_U}`] })
    render(<RouterProvider router={router} />)

    await waitFor(() => expect(h.probe.actions).not.toBeNull(), SETUP)
    expect(h.probe.props!.entityLink?.target).toEqual({ kind: "thread", id: THREAD_U })
    await act(async () => {
      h.probe.actions!.setViewingThread(THREAD_U)
    })
    await waitFor(() => expect(h.mockGetThreadWorkflow).toHaveBeenCalled(), SETUP)
    await act(async () => {
      void h.probe.actions!.sendMessage(THREAD_U, "research this thoroughly")
    })
    await waitFor(() => expect(h.mockSubscribeToRun).toHaveBeenCalledTimes(1), SETUP)
    const signal = h.mockSubscribeToRun.mock.calls[0][3] as AbortSignal
    const subsBefore = useStreamsStore.getState().subscriptionsByThread.get(THREAD_U)?.size
    expect(subsBefore).toBeGreaterThan(0)

    await act(async () => {
      h.probe.props!.entityLink!.openThread(THREAD_V)
    })
    expect(router.state.location.pathname).toBe(`/app/chat/${THREAD_V}`)
    expect(h.probe.props!.entityLink?.target).toEqual({ kind: "thread", id: THREAD_V })
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(`/app/chat/${THREAD_U}`)
    await nav("documents")
    expect(router.state.location.pathname).toBe("/app/library")
    await nav("chat")
    // Chat returns to the last thread address (D-02).
    expect(router.state.location.pathname).toBe(`/app/chat/${THREAD_U}`)

    expect(h.mockSubscribeToRun).toHaveBeenCalledTimes(1)
    expect(signal.aborted).toBe(false)
    expect(useStreamsStore.getState().subscriptionsByThread.get(THREAD_U)?.size).toBe(subsBefore)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_U)).toBe(true)
    expect(h.probe.mounts).toBe(1)
    expect(h.probe.unmounts).toBe(0)
  })
})

// Phase 299-03 (D-17 / D-37 / T-299-27): "Stay in <org>" on the switch prompt is NOT a switch. The
// active org, the one subscription and its abort signal are untouched — four-axis: a live stream in
// the active org, a link into another org, the prompt, Stay. StreamsProvider is not edited.
describe("D-17 — Stay on the switch prompt keeps the live stream (299-03)", () => {
  it("a stream in A, a link into B, Stay: org A, one subscription, never aborted, address REPLACED", async () => {
    window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, "org-a")
    const memberships = {
      org_id: "org-a",
      role: "owner",
      can_manage: false,
      can_audit_view: false,
      can_manage_sso: false,
      memberships: [
        { org_id: "org-a", name: "Northwind", role: "owner" },
        { org_id: "org-b", name: "Acme Legal", role: "member" },
      ],
    }
    vi.mocked(api.getOrgPermissions).mockResolvedValue(memberships as never)
    h.resolveLink.mockResolvedValue({
      status: "ok",
      target: { kind: "run", id: RUN_B, org_id: "org-b", org_name: "Acme Legal", title: "Contract review", state: null, audience: "only_you" },
    })
    h.probe.gate = true
    h.probe.gateThreads = [{ id: THREAD_A, title: "Renewal clause comparison" }]
    try {
      const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: ["/app"] })
      render(<RouterProvider router={router} />)
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
      const subsBefore = useStreamsStore.getState().subscriptionsByThread.get(THREAD_A)?.size
      expect(subsBefore).toBeGreaterThan(0)

      await act(async () => {
        await router.navigate(`/app/runs/${RUN_B}`)
      })
      await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "This is in Acme Legal" })).toBeInTheDocument(), SETUP)
      expect(screen.getByText("“Renewal clause comparison” is still answering")).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
      })
      await waitFor(() => expect(router.state.location.pathname).toBe("/app"))
      expect(router.state.historyAction).toBe("REPLACE")
      expect(screen.getByText("You stayed in Northwind. The link wasn't opened.")).toBeInTheDocument()

      expect(getActiveOrgId()).toBe("org-a")
      expect(window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)).toBe("org-a")
      expect(h.mockSubscribeToRun).toHaveBeenCalledTimes(1)
      expect(signal.aborted).toBe(false)
      expect(useStreamsStore.getState().subscriptionsByThread.get(THREAD_A)?.size).toBe(subsBefore)
      expect(useStreamsStore.getState().streamingThreads.has(THREAD_A)).toBe(true)
      expect(h.probe.mounts).toBe(1)
      expect(h.probe.unmounts).toBe(0)
    } finally {
      window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
      setActiveOrgId(null)
      vi.mocked(api.getOrgPermissions).mockResolvedValue({
        org_id: null,
        role: "member",
        can_manage: false,
        can_audit_view: false,
        can_manage_sso: false,
        memberships: [],
      } as never)
    }
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
