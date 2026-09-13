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

// ── Phase 244-11 (G-3): the transcript's EMPTINESS is now a variable, not a constant ──
//
// The banner's non-ApiError sentence depends on whether anything is actually on screen
// ("Showing cached version" is a claim ABOUT THE SCREEN). Before 244-11 this suite pinned
// one sentence with a hard-coded `messages: []`, i.e. it asserted the cached-version copy
// in the one state where that copy is FALSE. The hook mock now reads a mutable holder so a
// case can declare which of the two states it is in. ⛔ Reset in `beforeEach`.
const hookState = vi.hoisted(() => ({ messages: [] as unknown[] }))

// ── Mock useMessages (heavy hook; ChatArea only needs the stub fns to mount) ──
vi.mock("@/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: hookState.messages,
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
    // ⚠ THE COMPOSER MOUNTS `ConnectorsFlyout`, WHICH CALLS THIS ON MOUNT. Phase 216
    // added that component to `MessageInput` and did not widen the three suites that mock
    // this module, so they have failed with `No "listConnectorConnections" export is
    // defined on the "@/lib/api" mock` ever since — 10 red tests, none of them about
    // connectors. A mock factory is an ALLOW-LIST: an export it omits does not fall back
    // to the real module, it throws.
    listConnectorConnections: vi.fn().mockResolvedValue([]),
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
    // ⚠ Phase 244-12 (G-6) — THE SAME TRAP THE COMMENT ABOVE ALREADY DESCRIBES, FIRING AGAIN
    // FOR THE SAME REASON, which is why it is recorded here rather than quietly patched.
    // `MessageList` now mounts `PendingAskStack` at LIST level (the workflow-raised approval
    // had no reachable mount — SHELL-03 / BUG-260828-07), and that stack calls
    // `useAskUserPrompt` → `usePanelReconcile` → `getThreadPendingAsks`. This factory is an
    // ALLOW-LIST, so the omission threw at import binding and took SEVEN cases red — none of
    // them about approvals. ⭐ The durable repair is the `{ ...actual, … }` spread this project
    // adopted in Phase 196; it is not applied here because widening a byte-unchanged suite
    // beyond its own defect is not this gap-closure round's to do (G-7). ⛔ A THIRD occurrence
    // should take the spread rather than add a fourth line.
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
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

// ⚠ 244-11: jsdom implements NO layout, so `Element.prototype.scrollIntoView` does not
// exist. The moment this suite mounts a NON-EMPTY transcript, `MessageList`'s follow-scroll
// effect (MessageList.tsx:160) throws `bottomRef.current?.scrollIntoView is not a function`
// and takes the whole case down before any assertion runs. Stubbed here for the same reason
// `MessageList.test.tsx:61-65` stubs it. ⛔ This suite therefore says NOTHING about the
// scroll effect — `src/__tests__/components/chat/MessageList.scroll.test.tsx` owns that, and
// it is deliberately a separate file so this stub cannot reach it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {}
}

/** One persisted message — i.e. there IS something cached on screen to be "showing". */
const CACHED_TRANSCRIPT = [
  {
    id: "m-cached-1",
    thread_id: "thread-A",
    user_id: "user-1",
    role: "user",
    content: "a message that is already on screen",
    created_at: "2026-06-10T00:00:00Z",
    updated_at: "2026-06-10T00:00:00Z",
    tool_calls: [],
  },
]

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
  // 244-11: default to the EMPTY transcript the suite has always mounted. A case that
  // needs cached content on screen declares it (case c, Test 6).
  hookState.messages = []
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
    // ⚠ 244-11 (G-3): this case declares a NON-EMPTY transcript, which it always meant.
    // It was written against a hard-coded `messages: []` and so asserted "Showing cached
    // version" in the ONE state where that sentence is false. The claim under test —
    // *a plain reconcile Error keeps the cached-version copy* — is unchanged; what changed
    // is that the fixture now actually has a cached version to be showing.
    hookState.messages = CACHED_TRANSCRIPT
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
 * Phase 244 plan 11 (SHELL-01 / UAT gap G-3) — THE SENTENCE MUST MATCH THE SCREEN.
 *
 * `"Couldn't load latest messages. Showing cached version."` is a claim ABOUT THE SCREEN.
 * When the snapshot fails on a thread that has nothing rendered yet, there IS no cached
 * version — the banner would be telling the person that the empty pane in front of them is
 * their conversation. The bug report this phase folds in names that exact misreading:
 * *"the natural reading is 'this conversation is empty'"*, followed by typing into it.
 *
 * ⛔ THESE CASES ASSERT RENDERED CONTENT, NEVER A `data-testid`. This project's own
 * recorded lesson: *presence assertions cannot see content drift* — a green fence on
 * `getByTestId("reconcile-error-banner")` would have passed happily against the wrong
 * sentence, which is how this phase's G-6 shipped green.
 */
describe("244-11 / G-3 — the non-ApiError banner sentence is true of what is on screen", () => {
  const EMPTY_COPY = "Couldn't load this conversation. It's still there — try again."
  const CACHED_COPY = "Couldn't load latest messages. Showing cached version."

  it("Test 5 (THE GAP) — an EMPTY transcript does not claim a cached version, and Retry is offered", async () => {
    hookState.messages = []
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set(
        "thread-A",
        // The client's REAL throw for a snapshot 503 — a bare Error, not an ApiError
        // (frontend/src/lib/api/threads.ts:1067), so the banner takes its non-ApiError arm.
        new Error("Failed to fetch snapshot (status 503)"),
      ),
    }))

    renderChatArea()

    await waitFor(() => expect(screen.getByText(EMPTY_COPY)).toBeInTheDocument())
    // ⛔ The sentence that is FALSE here must be absent, not merely "some banner present".
    expect(screen.queryByText(CACHED_COPY)).not.toBeInTheDocument()
    // A 503 is not in NON_RETRYABLE, so the shipped Retry control is the recovery.
    expect(screen.getByRole("button", { name: "Retry loading messages" })).toBeInTheDocument()
  })

  it("Test 6 (CONTROL) — with a transcript on screen the SHIPPED sentence survives byte-exactly", async () => {
    // ⛔ This plan changes copy in ONE state only. Changing it everywhere would be a
    // redesign, not a gap fix (G-7).
    hookState.messages = CACHED_TRANSCRIPT
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-A", new Error("boom")),
    }))

    renderChatArea()

    await waitFor(() => expect(screen.getByText(CACHED_COPY)).toBeInTheDocument())
    expect(screen.queryByText(EMPTY_COPY)).not.toBeInTheDocument()
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
