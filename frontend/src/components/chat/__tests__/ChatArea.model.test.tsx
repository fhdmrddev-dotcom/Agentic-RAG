/**
 * Phase 196 Plan 07 Task 3 (D-18 / BUG-260718-04) — the integration half.
 *
 * The hook suite (`src/hooks/__tests__/useComposerModel.test.ts`) owns the branch coverage:
 * which message the model comes from, the `undefined` / `"unknown"` skips, the disabled
 * refusal, the ordering. THIS file asks the one question a pure derivation cannot answer —
 * does the value actually reach the control the operator looks at?
 *
 * It is deliberately THIN. `ChatArea` mounts the real `StreamsProvider`, which is expensive,
 * and being expensive to render is one of the reasons the logic lives in a hook at all.
 *
 * ⚠ THE SECOND CASE IS A CONTROL, NOT A DUPLICATE. Asserting only that the composer shows
 * `claude-5-haiku` proves nothing on its own — a picker that rendered the last item of any
 * list would satisfy it. The control renders the SAME component with the SAME providers and
 * only the messages changed, and requires the global default instead. The pair is what makes
 * the first case mean "restored" rather than "rendered".
 *
 * Harness: modelled on `ChatAreaBanner.test.tsx` one file over — real `StreamsProvider`,
 * `useMessages` and the api module stubbed so the mount touches no network.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import type { Message, Thread } from "@/types"

const GLOBAL_DEFAULT = "gpt-5.4"

/** Mutable so each case can seed the thread's history before rendering. */
let MESSAGES: Message[] = []

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

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    // ⚠ The id is spelled as a LITERAL here, not as `GLOBAL_DEFAULT`. `vi.mock` factories are
    // hoisted above every top-level binding in the file, so referencing the constant throws
    // a TDZ `ReferenceError` at module-eval time and the suite reports "no tests" rather
    // than a failing assertion. Keep the two in sync by eye; the control case below is what
    // catches a drift, since it asserts on the constant.
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-5.4",
      providers: [
        { id: "openai", name: "OpenAI", models: ["gpt-5.4", "gpt-5.5"], is_active: true },
        {
          id: "anthropic",
          name: "Anthropic",
          models: ["claude-5-sonnet", "claude-5-haiku"],
          is_active: false,
        },
      ],
      deprecated_models: [],
      disabled_models: [],
    }),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({
      mode: "deep",
      active_workflow_run_id: null,
    }),
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
// An ASSISTANT message renders run chrome that reaches for a Radix `Tooltip`, which throws
// outside a provider. The app supplies one high in its tree; the harness must too. (The
// control case below renders only a user message and never needed it — which is exactly the
// kind of asymmetry that makes a control worth having.)
import { TooltipProvider } from "@/components/ui/tooltip"

const THREAD: Thread = {
  id: "thread-A",
  title: "Test thread",
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
} as Thread

function msg(over: Partial<Message>): Message {
  return {
    id: `m-${Math.random()}`,
    role: "assistant",
    content: "hi",
    created_at: "2026-06-10T00:00:01Z",
    ...over,
  } as Message
}

function renderChatArea() {
  return render(
    <TooltipProvider>
      <StreamsProvider>
        <ChatArea
          thread={THREAD}
          onCreateThread={vi.fn().mockResolvedValue(THREAD)}
          folders={[]}
        />
      </StreamsProvider>
    </TooltipProvider>,
  )
}

beforeAll(() => {
  // jsdom implements no layout, so `Element.prototype.scrollIntoView` does not exist and
  // `MessageList`'s follow-scroll effect throws the moment a thread has ANY message. That is
  // a harness gap, not a product defect — `ChatAreaBanner.test.tsx` never hit it only because
  // it renders an EMPTY thread. Stubbed here rather than guarded in production code.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  MESSAGES = []
})

describe("ChatArea — the composer reflects the thread's restored model (D-18)", () => {
  it("shows the last run-backed message's model, NOT the global default", async () => {
    MESSAGES = [
      msg({ role: "user", content: "hello" }), // no run row → no model
      msg({ model: "claude-5-haiku", provider: "anthropic" }),
    ]

    renderChatArea()

    // The composer's Model pill renders the selected id as its own label.
    expect(await screen.findByText("claude-5-haiku")).toBeInTheDocument()
    expect(screen.queryByText(GLOBAL_DEFAULT)).toBeNull()
  })

  it("CONTROL — the same composer with no run-backed message shows the global default", async () => {
    MESSAGES = [msg({ role: "user", content: "hello" })]

    renderChatArea()

    expect(await screen.findByText(GLOBAL_DEFAULT)).toBeInTheDocument()
    expect(screen.queryByText("claude-5-haiku")).toBeNull()
  })
})
