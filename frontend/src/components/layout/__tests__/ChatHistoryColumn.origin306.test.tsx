// @vitest-environment jsdom
/**
 * Phase 306-04 (MCP-05; D-09 / D-31; 306-UI-SPEC §Surface 1a, §Surface 8) — an ask from an AI tool is
 * a MARKED thread in the member's history.
 *
 * * A thread whose `origin` is `{kind: "mcp", label}` renders, INSIDE its row button and after the
 *   title line, one more line: the Bot mark and "Started by AI tool key {label}". It is part of the
 *   button's accessible name (title, then the sentence).
 * * ⛔ A thread with no origin renders EXACTLY the DOM it rendered before 306-04 — pinned by the
 *   in-app row's HTML captured on the plan base (`IN_APP_ROW_AT_BASE`), not by a presence check.
 * * The selected row's origin line stays muted; the title filter matches titles only; both
 *   grouping modes show the line.
 * * The Waiting-on-you list's words for an mcp start (`originWords`, §Surface 8).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { Thread } from "@/types"
import columnRaw from "../ChatHistoryColumn.tsx?raw"
import { originWords } from "../waitingVocabulary"

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

const NOW = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12, 0, 0, 0).getTime()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
const LABEL = "claude-code-laptop"
const SENTENCE = `Started by AI tool key ${LABEL}`

const asked: Thread = {
  id: "t-mcp",
  user_id: "u",
  title: "What changed in the Q3 pricing policy?",
  folder_id: null,
  created_at: iso(HOUR),
  updated_at: iso(HOUR),
  origin: { kind: "mcp", label: LABEL, actor_name: null },
}

const typed: Thread = {
  id: "t-app",
  user_id: "u",
  title: "Old prototype brainstorm",
  folder_id: null,
  created_at: iso(2 * HOUR),
  updated_at: iso(2 * HOUR),
}

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>

function renderColumn(threads: Thread[], selected: Thread | null = null) {
  const props: ColProps = {
    threads,
    selectedThread: selected,
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders: [],
  }
  return render(<ChatHistoryColumn {...props} />)
}

const rowButton = (title: string) => screen.getByText(title).closest("button")!

/** The in-app row's outerHTML on the 306-04 plan base (4aef4374b), BEFORE the mount: this test
 *  was run green against the base in the RED commit, so the literal IS the base's DOM. */
const IN_APP_ROW_AT_BASE =
  '<button type="button" class="w-full py-1.5 cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><div class="px-3 flex items-center gap-2 overflow-hidden whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path></svg><span class="text-sm truncate flex-1 min-w-0" title="Old prototype brainstorm">Old prototype brainstorm</span></div></button>'

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})
afterEach(() => cleanup())

describe("the history row of an ask from an AI tool (306-04, §Surface 1a)", () => {
  it("renders one origin line inside the row button, after the title line", () => {
    renderColumn([asked, typed])
    const btn = rowButton(asked.title)
    const line = btn.querySelector('[data-testid="run-origin"]')
    expect(line).not.toBeNull()
    expect(line!.textContent).toBe(SENTENCE)
    expect(line!.getAttribute("data-origin-kind")).toBe("mcp")
    expect(line!.querySelector("svg")!.getAttribute("class")).toContain("lucide-bot")
    const children = Array.from(btn.children)
    expect(children).toHaveLength(2)
    expect(children[0].textContent).toContain(asked.title)
    expect(children[1].contains(line)).toBe(true)
    expect(screen.getAllByTestId("run-origin")).toHaveLength(1)
  })

  it("the sentence is part of the row's accessible name, after the title", () => {
    renderColumn([asked])
    expect(screen.getByRole("button", { name: `${asked.title} ${SENTENCE}` })).toBeInTheDocument()
  })

  it("an in-app row is byte-identical to the base", () => {
    renderColumn([typed])
    expect(rowButton(typed.title).outerHTML).toBe(IN_APP_ROW_AT_BASE)
  })

  it("a selected mcp row keeps the origin line muted", () => {
    renderColumn([asked], asked)
    const line = rowButton(asked.title).querySelector('[data-testid="run-origin"]')!
    expect(line.className).toContain("text-muted-foreground")
    expect(line.className).not.toContain("text-primary")
  })

  it("the title filter matches titles only, never the key label", () => {
    renderColumn([asked, typed])
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: LABEL } })
    expect(screen.queryByText(asked.title)).toBeNull()
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "Q3 pricing" } })
    expect(screen.getAllByTestId("run-origin")).toHaveLength(1)
  })

  it("both grouping modes show the line", () => {
    renderColumn([asked, typed])
    expect(screen.getAllByTestId("run-origin")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "folder" }))
    expect(screen.getAllByTestId("run-origin")).toHaveLength(1)
    expect(screen.getByTestId("run-origin").textContent).toBe(SENTENCE)
  })

  it("an unknown origin kind renders no line and no empty row", () => {
    const odd = { ...asked, origin: { kind: "carrier-pigeon", label: "x", actor_name: null } } as unknown as Thread
    renderColumn([odd])
    expect(screen.queryByTestId("run-origin")).toBeNull()
    expect(rowButton(asked.title).children).toHaveLength(1)
  })

  it("the mount is one conditional line with no new hook (G-5)", () => {
    expect(columnRaw.split("<RunOriginLine origin={thread.origin}").length - 1).toBe(1)
    // measured on the plan base: 3 and 1 — the mount adds neither
    expect(columnRaw.split("useState(").length - 1).toBe(3)
    expect(columnRaw.split("useEffect(").length - 1).toBe(1)
  })
})

describe("the Waiting-on-you words for an mcp start (§Surface 8)", () => {
  it("names an AI tool; app and absent stay silent; schedule and key are unchanged", () => {
    expect(originWords("mcp")).toBe("started by an AI tool")
    expect(originWords("app")).toBeNull()
    expect(originWords(null)).toBeNull()
    expect(originWords("schedule")).toBe("scheduled")
    expect(originWords("key")).toBe("started by an API key")
  })
})
