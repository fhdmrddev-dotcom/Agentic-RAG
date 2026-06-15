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
import { ApiError } from "@/lib/api"
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
})
