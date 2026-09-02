/**
 * Phase 224-04 (SC#4 / sketch 226 winner A) — THE INVARIANT THAT KEEPS ONE DECISION
 * FROM RENDERING TWICE.
 *
 * ⚠ WHY THIS FILE EXISTS. Plan 224-03 docked the pending approval card above the composer
 * so it is reachable while the clock runs, and left the SETTLED card rendering inline in
 * the transcript. Two components can therefore draw the same approval, and what stops them
 * is a pair of conditions in TWO DIFFERENT FILES that happen to be exact complements:
 *
 *   ChatArea.tsx   `pendingApproval` → `if (!isStreaming) return null`
 *   MessageItem.tsx inline guard     → `decision || !isStreaming`
 *
 * Streaming shows only the docked card; not-streaming (a reload mid-pause, or any settled
 * turn) shows only the inline one. **Neither file states that the other exists.** Delete the
 * `!isStreaming` line from `ChatArea` and a person gets TWO live sets of Approve / Reject
 * buttons for one decision, with the whole suite still green — measured 2026-09-03, when a
 * grep for `docked-tool-approval` across every test file returned nothing at all.
 *
 * A guard nobody has seen fire is not a guard, so the third case below is a NEGATIVE
 * CONTROL: it asserts the docked card is genuinely ABSENT when not streaming, which is the
 * half that fails first if either condition drifts.
 *
 * Harness copied from `ChatArea.model.test.tsx` one file over — real `StreamsProvider`,
 * `useMessages` and the api module stubbed so the mount touches no network. The one addition
 * is `useStreamingForThread`, spied per case, because `isStreaming` IS the axis under test.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import type { Message, Thread } from "@/types"

/** Mutable so each case seeds history before rendering. */
let MESSAGES: Message[] = []
/** Mutable so each case chooses the arm of the complement under test. */
let STREAMING = false

vi.mock("@/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: MESSAGES,
    loadMessages: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    setViewingThread: vi.fn(),
    resumeFromFailed: vi.fn(),
  }),
}))

// ⚠ Only `useStreamingForThread` is replaced; every other export stays REAL, including the
// `StreamsProvider` the mount needs. Replacing the whole module would remove the provider
// and the failure would read as a context error rather than as this invariant breaking.
vi.mock("@/providers/StreamsProvider", async (importActual) => {
  const actual = await importActual<typeof import("@/providers/StreamsProvider")>()
  return { ...actual, useStreamingForThread: () => STREAMING }
})

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    ApiError: actual.ApiError,
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-5.4",
      providers: [
        { id: "openai", name: "OpenAI", models: ["gpt-5.4"], is_active: true },
      ],
      deprecated_models: [],
      disabled_models: [],
    }),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep", active_workflow_run_id: null }),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
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

import { ChatArea } from "../ChatArea"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

const THREAD: Thread = {
  id: "thread-A",
  title: "Test thread",
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
} as Thread

const CALL_ID = "call-abc"

/** An assistant turn carrying an UNDECIDED approval — the state both surfaces can draw. */
function pendingTurn(): Message {
  return {
    id: "m-1",
    role: "assistant",
    content: "",
    created_at: "2026-06-10T00:00:01Z",
    toolApproval: {
      callId: CALL_ID,
      serviceId: "google_workspace",
      serviceName: "Google Workspace",
      toolName: "search_files",
      args: { query: "rate sheet" },
    },
  } as unknown as Message
}

function renderChatArea() {
  return render(
    <TooltipProvider>
      <StreamsProvider>
        <ChatArea thread={THREAD} onCreateThread={vi.fn().mockResolvedValue(THREAD)} folders={[]} />
      </StreamsProvider>
    </TooltipProvider>,
  )
}

/** Every approval card in the tree, docked or inline — the number under test is its length. */
function allApprovalCards() {
  return screen.queryAllByTestId(`tool-approval-card-${CALL_ID}`)
}

beforeAll(() => {
  // jsdom has no layout, so MessageList's follow-scroll effect throws on any message.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  MESSAGES = []
  STREAMING = false
})

describe("ChatArea — one pending approval renders exactly ONE card (224-03 / SC#4)", () => {
  it("while STREAMING: the docked card, and no inline duplicate", async () => {
    MESSAGES = [pendingTurn()]
    STREAMING = true

    renderChatArea()

    expect(await screen.findByTestId("docked-tool-approval")).toBeTruthy()
    expect(allApprovalCards()).toHaveLength(1)
  })

  it("NOT streaming (a reload mid-pause): the inline card, and no docked duplicate", async () => {
    MESSAGES = [pendingTurn()]
    STREAMING = false

    renderChatArea()

    // ⚠ The NEGATIVE CONTROL. `pendingApproval` returns null off `!isStreaming`; if that
    // line is ever removed this is the assertion that fails, and it fails before any
    // count does — which is why it is asserted explicitly rather than inferred from the
    // total below.
    expect(screen.queryByTestId("docked-tool-approval")).toBeNull()
    expect(allApprovalCards()).toHaveLength(1)
  })

  it("a turn with NO approval draws no card at all — the control that makes the pair mean something", async () => {
    MESSAGES = [
      { id: "m-0", role: "user", content: "hello", created_at: "2026-06-10T00:00:00Z" } as Message,
    ]
    STREAMING = true

    renderChatArea()

    expect(screen.queryByTestId("docked-tool-approval")).toBeNull()
    expect(allApprovalCards()).toHaveLength(0)
  })
})
