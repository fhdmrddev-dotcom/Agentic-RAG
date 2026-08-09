/**
 * 099-08 (UAT L10) — the refusal banner.
 *
 * Durable regression coverage (checker Warning 1) for the ChatArea banner +
 * prefill recovery logic. Backend kickoff refusals (a disabled-skill 400, etc.)
 * must surface the server's descriptive `detail` in the OWNING thread's error
 * banner — never the misleading "Couldn't load latest messages" copy — with no
 * Retry control for non-retryable statuses, and the typed prompt must be fed
 * back into the composer via the existing prefill seam.
 *
 * The banner state is read from the per-thread `reconcileErrors` Map; the failed
 * draft from the per-thread `failedSendDrafts` Map (both seeded directly in this
 * file). ChatArea renders inside the REAL StreamsProvider so the real
 * useReconcileErrorForThread / useFailedSendDraftForThread selectors run; the
 * network deps (useMessages + api) are mocked to safe no-ops so the component
 * mounts without hitting Supabase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"

// ── Mock useMessages (heavy hook; ChatArea only needs the stub fns to mount) ──
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

// ── Mock the api module — resolve the mount-time fetches to safe empties and
//    re-export the REAL ApiError so production `instanceof ApiError` matches. ──
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-test",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-test"], is_active: true }],
    }),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({
      mode: "deep",
      active_workflow_run_id: null,
    }),
  }
})

// ── Mock Supabase auth (StreamsProvider listeners read it on mount) ───────────
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

import { ChatArea } from "../ChatArea"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { ApiError, getThreadWorkflow } from "@/lib/api"
import type { Thread } from "@/types"

const THREAD: Thread = {
  id: "thread-A",
  title: "Test thread",
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
} as Thread

function renderChatArea() {
  return render(
    <StreamsProvider>
      <ChatArea
        thread={THREAD}
        onCreateThread={vi.fn().mockResolvedValue(THREAD)}
        folders={[]}
      />
    </StreamsProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    failedSendDrafts: new Map<string, string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    // Phase 121: reset the per-thread workflow lock so a locked reconcile from
    // one test never bleeds into the next (the lock map is not mock-cleared).
    workflowLockByThread: new Map(),
  })
})

afterEach(() => cleanup())

describe("099-08 refusal banner", () => {
  it("a — a non-409 ApiError (400 gate refusal) renders the server message, reconcile-error testid, NO Retry", async () => {
    const detail = "phase 'assess' references skill 'risk-lens' which is disabled"
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-A", new ApiError(detail, 400)),
    }))

    renderChatArea()

    // The server detail is the banner text (NOT the cached-version fallback).
    await waitFor(() => expect(screen.getByText(detail)).toBeInTheDocument())
    expect(
      screen.queryByText("Couldn't load latest messages. Showing cached version."),
    ).not.toBeInTheDocument()

    // Non-409 gate refusal uses the reconcile-error-banner testid.
    expect(screen.getByTestId("reconcile-error-banner")).toBeInTheDocument()
    // No Retry control (400 is non-retryable); Dismiss × present.
    expect(screen.queryByRole("button", { name: "Retry loading messages" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument()
  })

  it("b — a 409 lock-refusal is byte-equivalent: lock testid, fixed copy, no Retry", async () => {
    const lockCopy = "This thread is running a workflow — cancel it to send a Deep message."
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-A", new ApiError(lockCopy, 409)),
    }))

    renderChatArea()

    await waitFor(() => expect(screen.getByText(lockCopy)).toBeInTheDocument())
    expect(screen.getByTestId("workflow-lock-error-banner")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry loading messages" })).not.toBeInTheDocument()
  })

  it("c — a plain reconcile Error keeps the cached-version copy AND shows Retry", async () => {
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-A", new Error("boom")),
    }))

    renderChatArea()

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load latest messages. Showing cached version."),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId("reconcile-error-banner")).toBeInTheDocument()
    // A reconcile failure IS retryable — the Retry button renders.
    expect(screen.getByRole("button", { name: "Retry loading messages" })).toBeInTheDocument()
  })

  it("d — a stashed failed draft pre-fills the composer once and is then cleared from the store", async () => {
    useStreamsStore.setState((s) => ({
      failedSendDrafts: new Map(s.failedSendDrafts).set("thread-A", "L10 refusal probe"),
    }))

    renderChatArea()

    // The composer textarea receives the stashed prompt via the prefill seam.
    const textarea = await screen.findByPlaceholderText("Ask anything…")
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe("L10 refusal probe"))

    // MessageInput's prefill effect invoked onClearPrefill, which clears the
    // per-thread draft so it pre-fills exactly once (not on every render).
    await waitFor(() =>
      expect(useStreamsStore.getState().failedSendDrafts.has("thread-A")).toBe(false),
    )
  })

  it("e — a non-dispatch send-drop routes through the SAME seam: banner shows the honest retry hint + the draft is restored", async () => {
    // Phase 176-04 RENDER-03 (D-10.2 / D-11): when sendMessage takes the
    // duplicate-guard non-dispatch early-return it stashes the dropped draft +
    // a quiet reconcileErrors hint (carried as an ApiError so the existing 099-08
    // banner renders the custom message — a plain Error would show the misleading
    // "Couldn't load latest messages" copy). No new toast/error channel: the same
    // reconcileErrors + failedSendDrafts Maps the ApiError rollback already uses.
    const HINT = "Couldn't send — tap to retry"
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-A", new ApiError(HINT, 400)),
      failedSendDrafts: new Map(s.failedSendDrafts).set("thread-A", "message that never dispatched"),
    }))

    renderChatArea()

    // The banner surfaces the honest hint — never the misleading reconcile copy.
    await waitFor(() => expect(screen.getByText(HINT)).toBeInTheDocument())
    expect(
      screen.queryByText("Couldn't load latest messages. Showing cached version."),
    ).not.toBeInTheDocument()
    // 400 is non-retryable → no misleading reload-Retry; the composer prefill is the
    // real recovery affordance (tap Send again with the restored text).
    expect(screen.getByTestId("reconcile-error-banner")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Retry loading messages" }),
    ).not.toBeInTheDocument()

    // The dropped draft is restored to the composer via the existing prefill seam.
    const textarea = await screen.findByPlaceholderText("Ask anything…")
    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe("message that never dispatched"),
    )
  })
})

/**
 * Phase 121 (IA-01 / SC#3 reconcile) — server truth, not a pill.
 *
 * The in-chat Deep/Harness pill is gone (Plan 01), so "is this thread locked?"
 * comes from the SOURCE OF TRUTH — the mount-time GET /threads/{id}/workflow
 * reconcile (CLAUDE.md: Realtime is a hint, reconcile on (re)connect). This pins
 * the surviving server-driven lock: a `locked:true` reconcile disables the
 * composer (running placeholder) on mount; the default `locked`-less / `deep`
 * reconcile leaves it enabled. The owner-scoped per-thread lock (never global)
 * is what keeps a background run on another thread from locking THIS composer.
 */
describe("121 reconcile-lock — getThreadWorkflow drives the per-thread composer disable (SC#3)", () => {
  const LOCKED_PLACEHOLDER = "Workflow running — Cancel to switch back"

  it("locked:true reconcile disables the composer with the running placeholder on mount", async () => {
    // Override the default deep/unlocked reconcile for this case only: a real,
    // non-stale run with an active anchor → the mount reconcile sets the lock.
    // (mockResolvedValue, not …Once — the mount effect can re-fire and a single
    //  Once value would let a follow-up undefined resolve clear the lock again.)
    vi.mocked(getThreadWorkflow).mockResolvedValue({
      locked: true,
      lock_is_stale: false,
      active_workflow_run_id: "run-1",
      cap_paused: false,
      continues_remaining: 0,
    } as Awaited<ReturnType<typeof getThreadWorkflow>>)

    renderChatArea()

    // After the reconcile resolves, the composer swaps to the running placeholder
    // and the textarea is disabled — a Deep message cannot be sent during a run.
    const textarea = await screen.findByPlaceholderText(LOCKED_PLACEHOLDER)
    await waitFor(() => expect(textarea).toBeDisabled())
  })

  it("the default (deep / locked:false) reconcile leaves the composer enabled", async () => {
    // Explicit deep/unlocked reconcile (set here, not relied on from the cleared
    // factory default) → the mount reconcile clears any lock on this thread.
    vi.mocked(getThreadWorkflow).mockResolvedValue({
      mode: "deep",
      locked: false,
      active_workflow_run_id: null,
    } as Awaited<ReturnType<typeof getThreadWorkflow>>)

    renderChatArea()

    const textarea = await screen.findByPlaceholderText("Ask anything…")
    expect(textarea).not.toBeDisabled()
    // The locked composer is NOT shown when the server says the thread is unlocked.
    expect(screen.queryByPlaceholderText(LOCKED_PLACEHOLDER)).not.toBeInTheDocument()
  })
})
