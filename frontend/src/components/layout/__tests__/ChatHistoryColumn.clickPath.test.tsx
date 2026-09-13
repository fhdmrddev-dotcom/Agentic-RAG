/**
 * Phase 244 plan 01 Task 2 — `BUG-260911-02`, DRIVEN rather than read.
 *
 * ⛔ THIS SUITE DOES NOT CLOSE `BUG-260911-02`, and says so first so no later reader infers
 * otherwise from a green run. The report's own first instruction is *"check whether it
 * reproduces on `master` / `production`. Nobody has checked."* — and this executor could not:
 * no browser-driving tool is available to it. The bug's `status:` stays `folded` with a
 * `re_open_trigger` naming the exact steps. Full disposition:
 * `.planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md`.
 *
 * What IS driven here are `244-PATTERNS.md` § C-6's three candidate causes, at the level of
 * the real components, plus a FOURTH that C-6 did not list and that this suite found.
 *
 * ⚠ `scrollTop` is not the reader's position and a screenshot is not a measurement; likewise
 * a green assertion in jsdom is not a browser. **jsdom performs no layout and no hit-testing**,
 * so nothing here can prove which element a real pointer reaches. What it CAN prove — and
 * does — is which elements exist, what they carry, and which one a dispatched click reaches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { Thread, Folder } from "@/types"

const { streamingIds, stopThread } = vi.hoisted(() => ({
  streamingIds: new Set<string>(),
  stopThread: vi.fn(),
}))

vi.mock("@/providers/StreamsProvider", () => ({
  useStreamingThreadIds: () => streamingIds,
  useStreamActions: () => ({ stopThread }),
  getActiveRunStartMs: () => null,
}))

import { ChatHistoryColumn } from "../ChatHistoryColumn"
// The render gate C-6 candidate (c) names, read as source: `ChatArea` is too heavy to mount
// here (it pulls the whole streams/composer surface), and the property under test is a
// STRUCTURAL one — which state the welcome branch is gated on.
import chatAreaSource from "@/components/chat/ChatArea.tsx?raw"
import useThreadsSource from "@/hooks/useThreads.ts?raw"

const lf = (s: string) => s.replace(/\r\n/g, "\n")
const CHAT_AREA = lf(chatAreaSource)
const USE_THREADS = lf(useThreadsSource)

const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000

const folders: Folder[] = [
  { id: "f-fin", user_id: "u", name: "Finance", parent_id: null, is_org_shared: false, created_at: iso(0), updated_at: iso(0) },
]

const thread: Thread = {
  id: "t-1",
  user_id: "u",
  title: "Q3 revenue variance analysis",
  folder_id: "f-fin",
  created_at: iso(HOUR),
  updated_at: iso(HOUR),
}

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>

function renderColumn(overrides: Partial<ColProps> = {}) {
  const onSelectThread = vi.fn()
  const props: ColProps = {
    threads: [thread],
    selectedThread: null,
    onSelectThread,
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders,
    ...overrides,
  }
  const utils = render(<ChatHistoryColumn {...props} />)
  return { ...utils, props, onSelectThread: props.onSelectThread as ReturnType<typeof vi.fn> }
}

/** The row's primary target — the real `<button>` that carries `onClick`. */
const rowButton = () => screen.getByText(thread.title).closest("button")!

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})
afterEach(() => cleanup())

describe("BUG-260911-02 · C-6 candidate (b) — 'a re-render discards the first setState'", () => {
  /**
   * REFUTED at the handler. There is no intermediate state to discard: the row's `onClick`
   * calls the selection callback directly, once, on the FIRST click.
   */
  it("ONE click on the row calls onSelectThread exactly once, with that thread", () => {
    const { onSelectThread } = renderColumn()
    fireEvent.click(rowButton())
    expect(onSelectThread).toHaveBeenCalledTimes(1)
    expect(onSelectThread).toHaveBeenCalledWith(thread)
  })

  /**
   * And the receiver is a bare `setState` with no effect in between. Asserted on the hook's
   * own source because the property is *the absence of a second step* — a behavioural test
   * that passed would not tell you no `useEffect` had been added beside it.
   */
  it("useThreads.selectThread is a bare setState — no effect, no async, no second step", () => {
    const body = USE_THREADS.match(
      /const selectThread = useCallback\(\(thread: Thread \| null\) => \{([\s\S]*?)\}, \[\]\)/,
    )
    expect(body, "selectThread's useCallback body was not found — did the hook change shape?").not.toBeNull()
    expect(body![1].trim()).toBe("setSelectedThread(thread)")
  })
})

describe("BUG-260911-02 · C-6 candidate (c) — 'it is ChatArea's render gate, not selection'", () => {
  /**
   * REFUTED AS AN EXPLANATION, and this is the sharpest thing the trace found.
   *
   * The report observes the row HIGHLIGHTED and the pane showing *"How can I help you?"*
   * simultaneously. Those two readings cannot both come from selection state, because they
   * read the SAME value: `ChatArea`'s welcome branch is gated on `if (!thread)`, and `thread`
   * is `selectedThread` — the very value the row's highlight is derived from
   * (`selectedThread?.id === thread.id`). A highlighted row means `thread` is non-null, which
   * means the welcome branch is NOT the one rendering.
   *
   * ⭐ So the highlight the reporter saw was very likely the HOVER treatment, not selection —
   * an un-selected row carries `hover:bg-accent/40 hover:text-sidebar-foreground`, and the
   * `⋯` affordance is revealed by `group-hover`. Both appear under a resting pointer on ANY
   * row. That reframes the symptom from *"selected but not opened"* to *"the click did not
   * select at all"*, which is a different bug with a different suspect (below).
   */
  it("ChatArea's welcome branch is gated on the SAME value the row highlight reads", () => {
    // ⚠ `if (!thread)` appears three times (two are effect early-returns at :138 and :233).
    // The RENDER gate is the LAST one — the one the welcome copy sits under — so the split
    // takes the final segment rather than the first, which was measured to be wrong.
    const segments = CHAT_AREA.split("if (!thread) {")
    expect(segments.length).toBeGreaterThanOrEqual(2)
    expect(segments[segments.length - 1]).toContain("How can I help you?")
    // The welcome copy exists in exactly one place, so "the welcome pane is showing" has
    // exactly one possible source and it is that branch.
    expect(CHAT_AREA.match(/How can I help you\?/g)).toHaveLength(1)
  })

  it("an UNSELECTED row carries the hover treatment, so a hovered row looks selected", () => {
    renderColumn({ selectedThread: null })
    const shell = rowButton().parentElement!
    expect(shell.className).toContain("hover:bg-accent/40")
    expect(shell.className).not.toContain("bg-primary/15")
  })

  it("a SELECTED row carries the selected treatment, so the two states are distinguishable in the DOM", () => {
    renderColumn({ selectedThread: thread })
    const shell = rowButton().parentElement!
    expect(shell.className).toContain("bg-primary/15")
  })
})

describe("BUG-260911-02 · a FOURTH candidate C-6 did not list — the invisible click sink", () => {
  /**
   * ⭐ THE FINDING. The per-row actions container is **always rendered** and merely
   * `opacity-0` at rest (an A11Y-01 decision: CSS-gated, never render-gated, so a keyboard
   * user can Tab to Stop / Rename / Delete). It is `absolute inset-y-0 right-0` with a
   * `pl-10` scrim, so it covers the right-hand strip of every row — and it is painted AFTER
   * the row `<button>`, so it wins the hit test over that strip.
   *
   * ⛔ Its documented SIBLING — the SEED-064 resting run dot, same `absolute inset-y-0
   * right-0` geometry — carries `pointer-events-none` and says why in its own comment:
   * *"`pointer-events-none` keeps it click-through."* The actions container carries no such
   * token. **The asymmetry is the evidence**: one overlay was reasoned about and the other
   * was not.
   *
   * A pointer landing on that transparent strip hits the container, which has no handler, and
   * the row is not selected — while the hover treatment and the `⋯` reveal both fire, which
   * is exactly the reported appearance.
   *
   * ⚠ STATED AS THE LEADING CANDIDATE, NOT AS A CONFIRMED CAUSE. jsdom does no hit-testing,
   * so this suite proves the overlay EXISTS at rest and WHAT IT CARRIES; it cannot prove a
   * real pointer reaches it. The browser confirmation is owed and is written into the trace
   * file's re-open trigger.
   */
  it("the actions overlay is present at rest — CSS-gated, never render-gated", () => {
    const { container } = renderColumn()
    const overlay = container.querySelector(
      "div.absolute.inset-y-0.right-0.opacity-0",
    ) as HTMLElement | null
    expect(overlay, "the opacity-0 actions overlay was not found at rest").not.toBeNull()
    // It really is the actions container: the options button lives inside it.
    expect(overlay!.querySelector('[aria-label="Thread options"]')).not.toBeNull()
  })

  it("⛔ the actions overlay is click-through and its buttons are not", () => {
    const { container } = renderColumn()
    const overlay = container.querySelector(
      "div.absolute.inset-y-0.right-0.opacity-0",
    ) as HTMLElement
    expect(
      overlay.className,
      "the always-rendered actions overlay covers the right of the row and would swallow a click that should select the thread",
    ).toContain("pointer-events-none")
    const options = overlay.querySelector('[aria-label="Thread options"]') as HTMLElement
    expect(
      options.className,
      "a click-through container must hand pointer events BACK to its real controls",
    ).toContain("pointer-events-auto")
  })

  it("the options button still opens Rename + Delete — the click-through container did not disarm it", () => {
    renderColumn()
    fireEvent.click(screen.getByRole("button", { name: "Thread options" }))
    expect(screen.getByText("Rename")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete Thread" })).toBeInTheDocument()
  })

  /**
   * The sibling that proves the mechanism was already understood in this file — a control,
   * not a coincidence. Driven with a running thread so the dot renders.
   */
  it("the sibling run-dot overlay carries pointer-events-none — the asymmetry is the evidence", () => {
    streamingIds.add(thread.id)
    const { container } = renderColumn()
    const dot = container.querySelector('[aria-label="Run in progress"]') as HTMLElement
    expect(dot, "the SEED-064 run dot did not render for a streaming thread").not.toBeNull()
    expect(dot.className).toContain("pointer-events-none")
  })

  /**
   * The target matters, and that is why an overlay is consequential at all: React's handler
   * is on the `<button>`, so a click dispatched on the row SHELL never reaches it. The report
   * notes a `ref` click "had the same effect" — which is consistent with the ref having been
   * the shell rather than the button, and is therefore NOT evidence against a target problem.
   */
  it("a click dispatched on the row SHELL does not select — only the button's own target does", () => {
    const { onSelectThread } = renderColumn()
    fireEvent.click(rowButton().parentElement!)
    expect(onSelectThread).not.toHaveBeenCalled()
    fireEvent.click(rowButton())
    expect(onSelectThread).toHaveBeenCalledTimes(1)
  })
})
