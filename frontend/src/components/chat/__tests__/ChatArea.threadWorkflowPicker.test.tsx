/**
 * Phase 287-03 Task 3 (START-01 / D-02, A-03) - ChatArea's ONE mount of ThreadWorkflowPicker.
 *
 *   - With a thread, the picker is rendered (once); on the welcome screen (no thread) it is not.
 *   - Its `locked` prop is ChatArea's existing `workflowLocked` value, not a second derivation.
 *   - The mount adds no network call (the picker fetches only when opened).
 *
 * Harness: the `ChatArea.expertThread.test.tsx` shape. The picker is stubbed for the prop cases
 * so they read ChatArea's wiring and nothing else; one case uses the REAL picker for the
 * no-fetch-on-mount claim.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Thread } from "@/types"

const h = vi.hoisted(() => ({
  listPublishedWorkflows: vi.fn(),
  getThreadWorkflow: vi.fn(),
  stub: { on: true },
}))

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

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-5.4",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-5.4"], is_active: true }],
      deprecated_models: [],
      disabled_models: [],
    }),
    listPublishedWorkflows: h.listPublishedWorkflows,
    getThreadWorkflow: h.getThreadWorkflow,
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    listExperts: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
  }
})

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

vi.mock("../ThreadWorkflowPicker", async (importActual) => {
  const actual = await importActual<typeof import("../ThreadWorkflowPicker")>()
  return {
    ThreadWorkflowPicker: (props: { thread: Thread; locked: boolean }) =>
      h.stub.on ? (
        <div data-testid="tw-stub" data-thread={props.thread.id} data-locked={String(props.locked)} />
      ) : (
        <actual.ThreadWorkflowPicker {...props} />
      ),
  }
})

import { ChatArea } from "../ChatArea"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { TooltipProvider } from "@/components/ui/tooltip"

const THREAD = {
  id: "thread-A",
  title: "Board prep",
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
} as Thread

function shell(ui: ReactNode) {
  return (
    <TooltipProvider>
      <StreamsProvider>{ui}</StreamsProvider>
    </TooltipProvider>
  )
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  h.stub.on = true
  h.listPublishedWorkflows.mockResolvedValue([])
  h.getThreadWorkflow.mockResolvedValue({ mode: "deep", active_workflow_run_id: null })
})

afterEach(() => {
  cleanup()
  useStreamsStore.setState({ workflowLockByThread: new Map() })
})

describe("ChatArea - the ThreadWorkflowPicker mount", () => {
  it("renders the picker once when a thread is open", async () => {
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={[]} />))
    const all = await screen.findAllByTestId("tw-stub")
    expect(all).toHaveLength(1)
    expect(all[0]).toHaveAttribute("data-thread", "thread-A")
    expect(all[0]).toHaveAttribute("data-locked", "false")
  })

  it("renders no picker on the welcome screen (no thread)", async () => {
    render(shell(<ChatArea thread={null} onCreateThread={vi.fn()} folders={[]} />))
    await screen.findByRole("textbox")
    expect(screen.queryByTestId("tw-stub")).toBeNull()
  })

  it("locked equals the existing workflowLocked value (a harness lock on this thread)", async () => {
    // The lock arrives the way it does in the product: the server's answer on mount.
    h.getThreadWorkflow.mockResolvedValue({
      mode: "harness",
      locked: true,
      active_workflow_run_id: "wr-live-1",
      run_status: "running",
      cap_paused: false,
      continues_used: 0,
      continues_remaining: 3,
      latest_producer_run_id: null,
    })
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={[]} />))
    const el = await screen.findByTestId("tw-stub")
    await waitFor(() => expect(el).toHaveAttribute("data-locked", "true"))
  })

  it("a lock on ANOTHER thread does not lock this one", async () => {
    useStreamsStore.setState({
      workflowLockByThread: new Map([["thread-B", { runId: "r-9", mode: "harness" } as never]]),
    })
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={[]} />))
    expect(await screen.findByTestId("tw-stub")).toHaveAttribute("data-locked", "false")
  })

  it("the real picker adds no fetch on mount", async () => {
    // Baseline: the welcome screen has no picker, so whatever the composer itself fetches shows here.
    render(shell(<ChatArea thread={null} onCreateThread={vi.fn()} folders={[]} />))
    await act(async () => {})
    const baseline = h.listPublishedWorkflows.mock.calls.length
    cleanup()
    h.listPublishedWorkflows.mockClear()

    h.stub.on = false
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={[]} />))
    await screen.findByTestId("thread-workflow-trigger")
    await act(async () => {})
    expect(h.listPublishedWorkflows.mock.calls.length).toBeLessThanOrEqual(baseline)
  })
})
