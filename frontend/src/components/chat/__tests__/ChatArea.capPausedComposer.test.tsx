/**
 * Phase 244 plan 03 Task 1 (SHELL-02 / BUG-260904-05) — the composer at a cap-pause.
 *
 * ⛔ THE DEFECT THIS FENCES. A Deep run that hits its iteration cap renders a message on
 * screen that says *"Start a new message to keep going"* — and the composer it names is
 * DISABLED, because `ChatArea.tsx:116` read `workflowLocked = workflowLock !== null` and the
 * cap-pause reconcile branch at `ChatArea.tsx:184` sets a lock. The UI instructed an action it
 * forbade.
 *
 * ⛔ C-1 — D-244-08's PROPOSED GATE IS A NO-OP, and this suite is why the plan took the
 * decision's SECOND arm instead. D-244-08 offered `workflowLock?.mode === "harness"`.
 * `WorkflowLock.mode` is the LITERAL type `"harness"` (`streamsStore.ts:89`) with exactly one
 * member, and `ChatArea.tsx:184-192` hard-codes `mode: "harness"` for the DEEP cap-paused
 * branch — so that gate is TRUE for precisely the run it was meant to unlock. `capPaused` is
 * the only working discriminator on the shipped type.
 *
 * ⛔ WHAT MUST NOT CHANGE, fenced here rather than trusted:
 *   · a GENUINE harness lock still disables the composer AND still renders
 *     "Workflow running — Cancel to switch back" in BOTH the placeholder and the title
 *     (D-244-10 — the harness copy is untouched);
 *   · `MessageItem.tsx:576`'s Continue-limit sentence SURVIVES. The ROADMAP names deleting it
 *     as the anti-fix: the point is to make the sentence TRUE, not to remove it. Case 3 below
 *     is the executable form of that guarantee.
 *
 * ⚠ WHAT THIS SUITE DOES NOT CLOSE. `D-244-09` ("drive it; do not reason about it") asks
 * whether POSTING a message at a cap-pause actually starts a run, or whether the server
 * re-locks the thread on the next reconcile. That is a `244-VALIDATION.md` row driven in a
 * real browser AFTER A RELOAD (ROADMAP criterion 2). A jsdom mount cannot stand in for it,
 * and this file claims no part of it. The SERVER half of the fix is fenced separately in
 * `backend/tests/unit/test_244_cap_paused_lock_bound.py`.
 *
 * HARNESS SHAPE: `ChatArea` renders inside the REAL `StreamsProvider`, so the real
 * `useWorkflowLockForThread` selector and the real mount reconcile effect run — the lock is
 * produced by `getThreadWorkflow`'s answer travelling through `ChatArea.tsx:170-200`, never
 * by hand-seeding the store. That is deliberate: hand-seeding would fence the selector and
 * leave the branch that actually mislabels a Deep pause `"harness"` untested.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"

// ── Mock useMessages (heavy hook; ChatArea only needs stub fns to mount) ──────
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

// ── `@/lib/api` — spread the ACTUAL module, never an allow-list factory. ──────
// ⚠ ChatAreaBanner.test.tsx records the trap verbatim: a mock factory is an ALLOW-LIST, and
// an export it omits does not fall back to the real module — it throws at import binding. The
// composer mounts `ConnectorsFlyout`, `MessageItem` imports `continueRun`, and both would be
// missing from a hand-written factory. Spreading `importOriginal()` makes the surface total.
const { getThreadWorkflow } = vi.hoisted(() => ({
  getThreadWorkflow: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getThreadWorkflow,
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-test",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-test"], is_active: true }],
    }),
  }
})

// ── Supabase auth (StreamsProvider listeners read it on mount) ────────────────
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
import { MessageItem } from "../MessageItem"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Thread, Message } from "@/types"

const THREAD: Thread = {
  id: "thread-cap",
  title: "Capped deep run",
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
} as Thread

/** The server answer for a DEEP run paused at its iteration cap (ChatArea.tsx:184). */
const CAP_PAUSED_STATE = {
  thread_id: THREAD.id,
  mode: "deep" as const,
  locked: false,
  active_workflow_run_id: null,
  run_status: null,
  definition_slug: null,
  definition_name: null,
  current_phase_slug: null,
  current_phase_index: null,
  total_phases: null,
  lock_is_stale: false,
  cap_paused: true,
  continues_used: 1,
  continues_remaining: 2,
  latest_producer_run_id: "run-deep-capped",
}

/** The server answer for a GENUINE, live harness run (ChatArea.tsx:176). */
const HARNESS_LOCKED_STATE = {
  ...CAP_PAUSED_STATE,
  mode: "harness" as const,
  locked: true,
  active_workflow_run_id: "wr-live-1",
  run_status: "running",
  cap_paused: false,
  continues_used: 0,
  continues_remaining: 3,
  latest_producer_run_id: null,
}

function renderChatArea() {
  return render(
    <StreamsProvider>
      <ChatArea thread={THREAD} onCreateThread={vi.fn().mockResolvedValue(THREAD)} folders={[]} />
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
    workflowLockByThread: new Map(),
  })
})

afterEach(() => cleanup())

describe("SHELL-02 / BUG-260904-05 — a cap-paused Deep run leaves the composer usable", () => {
  it("1 — with capPaused, the composer is ENABLED and offers the ordinary prompt", async () => {
    getThreadWorkflow.mockResolvedValue(CAP_PAUSED_STATE)
    renderChatArea()

    // The lock must actually have landed — otherwise this case passes vacuously on a
    // thread that was never locked at all, which is the failure mode a presence
    // assertion cannot see.
    await waitFor(() =>
      expect(useStreamsStore.getState().workflowLockByThread.get(THREAD.id)?.capPaused).toBe(true),
    )

    const box = await screen.findByPlaceholderText("Ask anything…")
    expect(box).not.toBeDisabled()
    // ⛔ The harness sentence must NOT be on screen for a cap-pause — it is the wrong
    // explanation for this pause and the one the operator was told to obey.
    expect(screen.queryByPlaceholderText("Workflow running — Cancel to switch back")).toBeNull()
  })

  it("2 — a GENUINE harness run still locks it, with BOTH the placeholder and the title unchanged", async () => {
    getThreadWorkflow.mockResolvedValue(HARNESS_LOCKED_STATE)
    renderChatArea()

    await waitFor(() =>
      expect(useStreamsStore.getState().workflowLockByThread.get(THREAD.id)?.capPaused).toBe(false),
    )

    // ⚠ Assert the SENTENCE, byte-for-byte, on BOTH axes — not that a `disabled`
    // attribute exists. D-244-10 keeps the harness copy; a fence that only checked
    // `disabled` could not see the copy being rewritten underneath it.
    const box = await screen.findByPlaceholderText("Workflow running — Cancel to switch back")
    expect(box).toBeDisabled()
    expect(box).toHaveAttribute("title", "Workflow running — Cancel to switch back")
    expect(screen.queryByPlaceholderText("Ask anything…")).toBeNull()
  })

  it("5 — a harness run whose OWN status is cap_paused stays LOCKED (T-244-03-01)", async () => {
    // ⛔ THE STATE CASE 2 COULD NOT SEE, AND THE REASON THE DEFECT SURVIVED A GREEN FENCE.
    //
    // `HARNESS_LOCKED_STATE` sets `cap_paused: false`, so every earlier case reads the
    // discriminator on a run that is locked OR paused — never one that is BOTH. The plan's
    // declared mitigation for `T-244-03-01` is verbatim: *"the discriminator is `capPaused`,
    // which is set only on the `state.cap_paused` reconcile branch"*. It was ALSO set on the
    // genuine-lock branch (`ChatArea.tsx:205`), and `workflowLocked` then evaluated FALSE for
    // a live harness run — the composer unlocking mid-run.
    //
    // ⚠ THIS STATE IS LATENT, NOT IMPOSSIBLE, AND THAT IS WHY THE CASE CONSTRUCTS IT DIRECTLY
    // RATHER THAN WAITING FOR A WRITER. `244-SECURITY.md` OPEN-1 records that no writer of
    // `'cap_paused'` onto `workflow_runs.status` could be found — but the value is schema-valid
    // (`063_dual_mode_continue.sql:57` adds it to BOTH status columns), `threads.py:1238` sets
    // `cap_paused = run_status == "cap_paused"` straight off that column, and
    // `_TERMINAL_WORKFLOW_STATUSES` (`threads.py:1095`) does not contain it — so the row is
    // simultaneously `locked: true` and `cap_paused: true`. A fence that waits for the first
    // writer is a fence that arrives after the defect ships.
    //
    // ⛔ FAIL-CLOSED IS THE CHOSEN DIRECTION. Keeping a genuine harness lock costs a person one
    // Cancel click; unlocking during a live run is the EoP this threat names.
    getThreadWorkflow.mockResolvedValue({
      ...HARNESS_LOCKED_STATE,
      run_status: "cap_paused",
      cap_paused: true,
      continues_used: 1,
      continues_remaining: 2,
    })
    renderChatArea()

    // The lock must have LANDED first — otherwise everything below passes vacuously on a
    // thread that was never locked at all, which is the failure a presence assertion cannot
    // see (Phase 235's lesson, one surface over).
    await waitFor(() =>
      expect(useStreamsStore.getState().workflowLockByThread.has(THREAD.id)).toBe(true),
    )

    // CAUSE — the discriminator itself.
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD.id)?.capPaused).toBe(false)

    // CONSEQUENCE — what the person actually sees. Both are asserted because the cause alone
    // would let a future refactor satisfy the flag while the composer unlocked some other way.
    const box = await screen.findByPlaceholderText("Workflow running — Cancel to switch back")
    expect(box).toBeDisabled()
    expect(screen.queryByPlaceholderText("Ask anything…")).toBeNull()
  })

  it("4 — a non-empty draft can be SENT while capPaused (Send is not gated by the pause)", async () => {
    getThreadWorkflow.mockResolvedValue(CAP_PAUSED_STATE)
    renderChatArea()

    await waitFor(() =>
      expect(useStreamsStore.getState().workflowLockByThread.get(THREAD.id)?.capPaused).toBe(true),
    )

    const box = (await screen.findByPlaceholderText("Ask anything…")) as HTMLTextAreaElement
    // `canSend = !disabled && !workflowLocked && value.trim().length > 0`
    // (MessageInput.tsx:287) — type a real draft and read the Send control's state.
    const { fireEvent } = await import("@testing-library/react")
    fireEvent.change(box, { target: { value: "keep going please" } })

    const send = await screen.findByTestId("composer-send")
    await waitFor(() => expect(send).not.toBeDisabled())
  })
})

describe("the ROADMAP's named ANTI-FIX — MessageItem.tsx:576's sentence survives", () => {
  /**
   * ⛔ NEGATIVE-REGRESSION FENCE. The wrong fix for BUG-260904-05 is to delete the message
   * that tells the operator to start a new message — that makes the contradiction go away by
   * removing the true half. Deleting either arm of `MessageItem.tsx:576-578` must turn this
   * red.
   *
   * Rendered inside the REAL provider with the lock seeded on the store, because this case is
   * about the CARD's copy and not about how the lock got there (case 1 above covers that).
   */
  function renderPausedItem(continuesRemaining: number) {
    useStreamsStore.setState((s) => ({
      workflowLockByThread: new Map(s.workflowLockByThread).set(THREAD.id, {
        runId: "run-deep-capped",
        mode: "harness",
        capPaused: true,
        continuesRemaining,
      }),
    }))
    const message = {
      id: "m-capped",
      thread_id: THREAD.id,
      user_id: "u-1",
      role: "assistant",
      content: "Partial analysis before the iteration cap.",
      created_at: "2026-09-11T00:00:00Z",
      updated_at: "2026-09-11T00:00:00Z",
    } as Message
    return render(
      <StreamsProvider>
        <TooltipProvider>
          <MessageItem message={message} isLastAssistant />
        </TooltipProvider>
      </StreamsProvider>,
    )
  }

  it("3 — capPaused with 0 continues left still reads the Continue-limit sentence, verbatim", () => {
    renderPausedItem(0)
    expect(
      screen.getByText(
        "Reached the Continue limit — this run is stopped. Start a new message to keep going.",
      ),
    ).toBeInTheDocument()
  })

  it("3b — capPaused with continues left still reads the iteration-limit sentence, verbatim", () => {
    renderPausedItem(2)
    expect(
      screen.getByText("Reached the iteration limit — some tools haven't run yet."),
    ).toBeInTheDocument()
  })
})
