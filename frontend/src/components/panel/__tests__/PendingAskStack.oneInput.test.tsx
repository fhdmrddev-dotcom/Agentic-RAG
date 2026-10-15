/**
 * Phase 282-02 (FIX-07 / D-10, D-11, D-12, D-14, D-15) — ONE `ask_user` pause, ONE answer input.
 *
 * Sketch 282 variant A, "the input follows the open panel": while a panel-home `PendingAskStack`
 * is mounted for the viewing thread, the chat-column stack renders a one-line POINTER per ask
 * (question, the current draft, a working `Answer in panel →`). With no panel home mounted (panel
 * on the rail, sheet closed, a workflow pause with no message row) the chat stack renders the full
 * card, exactly as before — BUG-260828-07's reachability is kept.
 *
 * The draft is ONE store entry keyed by `tool_call_id` (D-12), so the pointer, both homes and
 * WorkflowRunPage's direct card all read the same thing; nothing is copied.
 *
 * Mocks copied from `PendingAskCard.test.tsx` (allow-list StreamsProvider factory), with the
 * viewing thread made mutable for the two-thread case.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { mockPendingAskWithRunId } from "./fixtures"
import type { PendingAsk } from "@/types"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    answerAskUser: vi.fn().mockResolvedValue(undefined),
  }
})

const hookState: { asks: PendingAsk[]; reconcile: ReturnType<typeof vi.fn>; threadId: string | null } = {
  asks: [],
  reconcile: vi.fn().mockResolvedValue(undefined),
  threadId: "thread-1",
}
const stackState: {
  lock: { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null
  phases: unknown[]
} = {
  lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
  phases: [],
}
vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => hookState.threadId,
  useAskUserPrompt: () => ({
    data: hookState.asks,
    isLoading: false,
    error: null,
    reconcile: hookState.reconcile,
  }),
  useWorkflowLockForThread: () => stackState.lock,
  usePhases: () => ({
    data: stackState.phases,
    isLoading: false,
    error: null,
    reconcile: vi.fn(),
  }),
}))

import { PendingAskCard, PendingAskStack } from "../PendingAskCard"
import { useAskDraftStore } from "@/stores/askDraftStore"

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  hookState.asks = []
  hookState.reconcile = vi.fn().mockResolvedValue(undefined)
  hookState.threadId = "thread-1"
  stackState.lock = { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 }
  stackState.phases = []
})

const noopReconcile = () => Promise.resolve()

const ask: PendingAsk = {
  ...mockPendingAskWithRunId,
  tool_call_id: "tc-one",
  options: ["prod_sales_2026", "staging_sales", "both"],
}

/** The chat column always mounts its stack; the panel mounts one only while it shows the pause. */
function Homes({ panel }: { panel: boolean }) {
  return (
    <>
      {panel && (
        <div data-testid="panel-body">
          <PendingAskStack home="panel" />
        </div>
      )}
      <div data-testid="chat-column">
        <PendingAskStack />
      </div>
    </>
  )
}

const panelCard = (id = ask.tool_call_id) =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-ask-home="panel"]')).find(
    (el) => el.dataset.askCard === id,
  ) ?? null

describe("PendingAskStack (282-02) — one input per pause, wherever the panel is", () => {
  it("Test 1: with a panel home mounted there is exactly ONE Send Answer, radiogroup and textarea — in the panel", () => {
    hookState.asks = [ask]
    render(<Homes panel />)
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1)
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
    expect(screen.getAllByTestId("ask-pointer")).toHaveLength(1)
    const card = panelCard()
    expect(card).not.toBeNull()
    expect(within(card!).getByRole("radiogroup")).toBeInTheDocument()
    expect(within(screen.getByTestId("chat-column")).getByTestId("ask-pointer")).toHaveAttribute(
      "data-tool-call-id",
      ask.tool_call_id,
    )
    // The arrow is decoration; the accessible name is the words.
    expect(screen.getByRole("button", { name: "Answer in panel" })).toBeInTheDocument()
  })

  it("Test 2: the pointer's draft line reads the one draft — option wins, curly-quoted free text, or No answer yet", async () => {
    const user = userEvent.setup()
    hookState.asks = [ask]
    render(<Homes panel />)
    const draftLine = () => screen.getByTestId("ask-pointer-draft")
    expect(draftLine()).toHaveTextContent(/^No answer yet$/)

    const card = panelCard()!
    await user.click(within(card).getAllByRole("radio")[1])
    expect(draftLine().textContent).toBe("Draft: staging_sales")

    await user.click(within(card).getAllByRole("radio")[1]) // click-to-deselect (D-13)
    await user.type(within(card).getByRole("textbox"), "  later  ")
    expect(draftLine().textContent).toBe("Draft: “later”")
  })

  it("Test 3: the panel goes to the rail mid-draft — the chat card shows the SAME selection and text", async () => {
    const user = userEvent.setup()
    hookState.asks = [ask]
    const { rerender } = render(<Homes panel />)
    const card = panelCard()!
    await user.click(within(card).getAllByRole("radio")[0])
    await user.type(within(card).getByRole("textbox"), "because")

    rerender(<Homes panel={false} />)

    expect(screen.queryByTestId("ask-pointer")).toBeNull()
    const chat = screen.getByTestId("chat-column")
    expect(within(chat).getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true")
    expect(within(chat).getByRole("textbox")).toHaveValue("because")
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
  })

  it("Test 4 (BUG-260828-07): with no panel home a workflow pause still has a full, answerable card", async () => {
    const user = userEvent.setup()
    hookState.asks = [ask]
    render(<PendingAskStack />)
    expect(screen.queryByTestId("ask-pointer")).toBeNull()
    const send = screen.getByRole("button", { name: "Send Answer" })
    expect(send).toBeDisabled()
    await user.click(screen.getAllByRole("radio")[0])
    expect(send).toBeEnabled()
  })

  it("Test 5a (D-14): Answer in panel → focuses the roving chip in the panel card and flashes for 900 ms", () => {
    vi.useFakeTimers()
    hookState.asks = [ask]
    render(<Homes panel />)
    const card = panelCard()!
    fireEvent.click(screen.getByTestId("ask-pointer-go"))
    const active = document.activeElement as HTMLElement
    expect(card.contains(active)).toBe(true)
    expect(active).toHaveAttribute("role", "radio")
    expect(active).toHaveAttribute("tabindex", "0")
    expect(card.className).toContain("outline-[hsl(var(--warning))]")
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(card.className).not.toContain("outline-[hsl(var(--warning))]")
  })

  it("Test 5b (D-14): with no options the button focuses the panel card's textarea", () => {
    hookState.asks = [{ ...ask, options: [] }]
    render(<Homes panel />)
    fireEvent.click(screen.getByTestId("ask-pointer-go"))
    const card = panelCard()!
    expect(document.activeElement).toBe(within(card).getByRole("textbox"))
  })

  it("Test 5c (D-14): with the panel card gone the click does nothing and throws nothing", () => {
    hookState.asks = [ask]
    // A panel home is registered, but no panel card is in the DOM (the collapse race).
    useAskDraftStore.getState().addPanelHome("thread-1")
    render(<PendingAskStack />)
    const go = screen.getByTestId("ask-pointer-go")
    expect(() => fireEvent.click(go)).not.toThrow()
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("Test 6: two threads paused at once keep separate drafts", async () => {
    const user = userEvent.setup()
    const askA: PendingAsk = { ...ask, tool_call_id: "tc-A" }
    const askB: PendingAsk = { ...ask, tool_call_id: "tc-B" }
    hookState.threadId = "thread-A"
    hookState.asks = [askA]
    const { rerender } = render(<Homes panel />)
    await user.click(within(panelCard("tc-A")!).getAllByRole("radio")[0])

    hookState.threadId = "thread-B"
    hookState.asks = [askB]
    rerender(<Homes panel />)
    const cardB = panelCard("tc-B")!
    expect(within(cardB).getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true)
    expect(screen.getByTestId("ask-pointer-draft")).toHaveTextContent(/^No answer yet$/)
    await user.click(within(cardB).getAllByRole("radio")[2])

    hookState.threadId = "thread-A"
    hookState.asks = [askA]
    rerender(<Homes panel />)
    expect(within(panelCard("tc-A")!).getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("ask-pointer-draft").textContent).toBe("Draft: prod_sales_2026")
    expect(useAskDraftStore.getState().drafts["tc-B"]).toEqual({ choiceIndex: 2, freeText: "" })
  })

  it("Test 7a: once the panel card answers, the pointer renders nothing", async () => {
    const user = userEvent.setup()
    hookState.asks = [ask]
    render(<Homes panel />)
    await user.click(within(panelCard()!).getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: "Send Answer" }))
    expect(await screen.findByText(/answered · agent resumed/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId("ask-pointer")).toBeNull())
    expect(screen.queryByText("No answer yet")).toBeNull()
  })

  it("Test 7b: a retired ask (the run is over) shows no pointer", () => {
    hookState.asks = [ask]
    stackState.lock = null
    stackState.phases = [{ id: "p1" }]
    render(<Homes panel />)
    expect(screen.queryByTestId("ask-pointer")).toBeNull()
    // The panel card carries the retirement; the chat column adds no second (dead) card.
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
    expect(within(screen.getByTestId("chat-column")).queryByRole("button")).toBeNull()
  })

  it("Test 8: WorkflowRunPage's direct card and a panel stack for the same ask show the same selection", async () => {
    const user = userEvent.setup()
    hookState.asks = [ask]
    render(
      <>
        <div data-testid="direct">
          <PendingAskCard ask={ask} reconcile={noopReconcile} />
        </div>
        <PendingAskStack home="panel" />
      </>,
    )
    const direct = screen.getByTestId("direct")
    const panel = panelCard()!
    expect(direct.querySelector("[data-ask-home]")).toBeNull()

    await user.click(within(direct).getAllByRole("radio")[1])
    expect(within(panel).getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "true")

    await user.click(within(panel).getAllByRole("radio")[2])
    expect(within(direct).getAllByRole("radio")[2]).toHaveAttribute("aria-checked", "true")
    expect(within(direct).getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false")
  })
})
