/**
 * Phase 166 Plan 02 (D-166-06/07/08 / ADMIN-02/03) — OrgProvider composed-tree tests.
 *
 * These render the REAL composed tree — <OrgProvider> wrapping the REAL
 * <StreamsProvider> (NOT OrgProvider in isolation) — so the D-166-08 org-switch
 * teardown effect inside StreamsProvider actually fires and can be observed
 * end-to-end. The StreamsProvider mount is kept off the network by partial-mocking
 * only its GET helpers (the phaseHooks/StreamsProvider.test idiom); the REAL
 * getActiveOrgId/setActiveOrgId module state flows through `...actual` so the
 * X-Org-Id header sync is observed for real.
 *
 * Contract under test:
 *   - switchOrg(newOrgId) sets activeOrgId, syncs the X-Org-Id header SYNCHRONOUSLY
 *     (D-166-08), and the StreamsProvider effect keyed on activeOrgId tears down the
 *     viewed thread's bucket THROUGH the existing 067.5 guarded clearThreadBucket
 *     (the mid-stream predicate is preserved — a non-sending thread IS cleared).
 *   - OrgProvider persists activeOrgId to localStorage on change + rehydrates on mount.
 *   - useOrgOptional() → null outside the provider; useOrg() throws outside it.
 *   - orgs (memberships) reflects the probe: 1 → switcher-hidden case; 2+ → full list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, Phase } from "@/types"

// ── Mock Supabase auth so module load + getAuthHeaders don't reach a real URL ──
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// ── Partial-mock @/lib/api: keep the REAL getActiveOrgId/setActiveOrgId module
//    state (so the header sync is observed for real) + override the org probe and
//    the StreamsProvider GET helpers so the composed mount stays off the network. ──
const { mockGetOrgPermissions, mockGetSnapshot } = vi.hoisted(() => ({
  mockGetOrgPermissions: vi.fn(),
  mockGetSnapshot: vi.fn(),
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getOrgPermissions: mockGetOrgPermissions,
    getSnapshot: mockGetSnapshot,
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadTasks: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep", phases: null }),
  }
})

import { getActiveOrgId, setActiveOrgId, ACTIVE_ORG_STORAGE_KEY, type OrgPermissions } from "@/lib/api"
import { OrgProvider, useOrg, useOrgOptional, type OrgValue } from "@/providers/OrgProvider"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"

const THREAD_A = "thread-A"

function permsWith(memberships: OrgPermissions["memberships"], canManage = true): OrgPermissions {
  return {
    org_id: "org-1",
    role: canManage ? "org-admin" : "member",
    can_manage: canManage,
    can_audit_view: canManage,
    memberships,
  }
}

// A capture harness: reads useOrg() (throws outside a provider by design) and
// exposes the live value to the test between act() calls.
let orgHandle: OrgValue | null = null
function OrgCapture() {
  orgHandle = useOrg()
  return null
}

function renderComposed(userId: string | null) {
  return render(
    <OrgProvider userId={userId}>
      <StreamsProvider>
        <OrgCapture />
      </StreamsProvider>
    </OrgProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
  setActiveOrgId(null)
  orgHandle = null
  mockGetOrgPermissions.mockResolvedValue(permsWith([{ org_id: "org-1", name: "Personal", role: "org-admin" }]))
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    todosByThread: new Map<string, Todo[]>(),
    workspaceFilesByThread: new Map<string, WorkspaceFile[]>(),
    pendingAsksByThread: new Map<string, PendingAsk[]>(),
    tasksByThread: new Map<string, TaskRunIndexItem[]>(),
    phasesByThread: new Map<string, Phase[]>(),
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("Phase 166-02 — OrgProvider switchOrg teardown (composed tree, D-166-08)", () => {
  it("switchOrg syncs the X-Org-Id header SYNCHRONOUSLY and clears the viewed thread's bucket through the 067.5 guard", async () => {
    renderComposed("user-1")
    // Let the probe + StreamsProvider mount effects settle.
    await act(async () => {})

    const actions = useStreamsStore.getState().actions
    // Make THREAD_A the viewed thread (sets activeThreadIdRef via the sole writer),
    // then flush the reconcile it fires, then seed a message into its bucket.
    act(() => {
      actions.setViewingThread(THREAD_A)
    })
    await act(async () => {})
    act(() => {
      actions.setMessagesForBucket("chat", THREAD_A, [
        { id: "m1", role: "user", content: "hi", createdAt: new Date().toISOString() } as never,
      ])
    })
    expect(useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_A)?.length).toBe(1)

    // Switch org — header must be the NEW org synchronously (before any effect runs).
    await act(async () => {
      orgHandle!.switchOrg("org-2")
    })
    expect(getActiveOrgId()).toBe("org-2")
    expect(orgHandle!.activeOrgId).toBe("org-2")

    // The viewed thread's bucket was cleared THROUGH the guarded clearThreadBucket
    // (not sending → wiped). Robust to undefined vs [] post-teardown.
    const cleared = useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_A) ?? []
    expect(cleared.length).toBe(0)
  })

  it("persists activeOrgId to localStorage on change and rehydrates it on mount", async () => {
    const first = renderComposed("user-1")
    await act(async () => {})
    await act(async () => {
      orgHandle!.switchOrg("org-2")
    })
    expect(localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)).toBe("org-2")
    first.unmount()

    // A fresh mount rehydrates the persisted org (typeof window guard reads localStorage).
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, "org-9")
    orgHandle = null
    renderComposed("user-1")
    await act(async () => {})
    expect(orgHandle!.activeOrgId).toBe("org-9")
  })
})

describe("Phase 166-02 — OrgProvider context accessors", () => {
  it("useOrgOptional() returns null outside the provider; useOrg() throws outside it", () => {
    const { result } = renderHook(() => useOrgOptional())
    expect(result.current).toBeNull()
    expect(() => renderHook(() => useOrg())).toThrow()
  })

  it("exposes exactly one membership (switcher-hidden case)", async () => {
    mockGetOrgPermissions.mockResolvedValue(
      permsWith([{ org_id: "org-1", name: "Personal", role: "org-admin" }]),
    )
    renderComposed("user-1")
    await act(async () => {})
    expect(orgHandle!.orgs.length).toBe(1)
  })

  it("exposes the full list at 2+ memberships (switcher-visible case)", async () => {
    mockGetOrgPermissions.mockResolvedValue(
      permsWith([
        { org_id: "org-1", name: "Personal", role: "org-admin" },
        { org_id: "org-2", name: "Acme", role: "member" },
      ]),
    )
    renderComposed("user-1")
    await act(async () => {})
    expect(orgHandle!.orgs.length).toBe(2)
    expect(orgHandle!.canManage).toBe(true)
  })
})
