/**
 * Phase 156 (POLISH-01, Wave 2) — ThreadCommandPalette ⌘K live contract (SC#2 global
 * finder).
 *
 * Replaces the Wave-0 `it.todo` scaffold: the palette now exists (hand-rolled on the
 * existing Radix ui/dialog.tsx — NO cmdk). These tests lock the open/filter behavior,
 * the roving keyboard (↑↓ move the active option, ↵ opens → onSelectThread + navigate +
 * close), the honest empty-state, and the dialog/listbox/option a11y roles. The palette
 * is StreamsProvider-free, so it renders here with NO provider wrapper.
 *
 * Radix Dialog owns Esc + focus-trap + focus-restore — those are the vendored library's
 * contract (not re-tested here); this file asserts only the hand-owned listbox roving +
 * the ARIA surface the palette exposes.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { axe } from "vitest-axe"
import type { Thread } from "@/types"
import { ThreadCommandPalette } from "../ThreadCommandPalette"

const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
const DAY = 86_400_000

function mkThread(id: string, title: string, msAgo: number): Thread {
  return { id, user_id: "u", title, folder_id: null, created_at: iso(msAgo), updated_at: iso(msAgo) }
}

// Flat DOM/visual order after groupByDate: Today (t-today-1 [1h] DESC-first, t-today-2
// [2h]) → Last 7 days (t-week) → Older (t-older). So the roving index 0..3 maps to
// [t-today-1, t-today-2, t-week, t-older].
const threads: Thread[] = [
  mkThread("t-today-1", "Q3 revenue variance analysis", 1 * HOUR),
  mkThread("t-today-2", "Debug embedding drift", 2 * HOUR),
  mkThread("t-week", "Compare GPT-5.6 vs Opus", 3 * DAY),
  mkThread("t-older", "Old prototype brainstorm", 60 * DAY),
]

type PaletteProps = React.ComponentProps<typeof ThreadCommandPalette>

function renderPalette(overrides: Partial<PaletteProps> = {}) {
  const props: PaletteProps = {
    open: true,
    onOpenChange: vi.fn(),
    threads,
    onSelectThread: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  }
  const utils = render(<ThreadCommandPalette {...props} />)
  return { ...utils, props }
}

afterEach(() => cleanup())

describe("ThreadCommandPalette — open + filter (SC#2)", () => {
  it('exposes role="dialog" with an accessible name (/search all chats/i)', () => {
    renderPalette()
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/search all chats/i)
  })

  it("renders every loaded thread as an option when open", () => {
    renderPalette()
    expect(screen.getAllByRole("option")).toHaveLength(4)
    expect(screen.getByText("Q3 revenue variance analysis")).toBeInTheDocument()
    expect(screen.getByText("Old prototype brainstorm")).toBeInTheDocument()
  })

  it("typing filters the options to title-substring matches over ALL threads", () => {
    renderPalette()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "revenue" } })

    // only the matching thread survives; the matched slice is a <mark> text node
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.queryByText("Debug embedding drift")).not.toBeInTheDocument()
    expect(screen.getByText("revenue").tagName).toBe("MARK")
  })

  it('shows the honest empty-state "No chats match your search." when nothing matches', () => {
    renderPalette()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz-no-such-chat" } })
    expect(screen.getByText("No chats match your search.")).toBeInTheDocument()
    expect(screen.queryAllByRole("option")).toHaveLength(0)
  })
})

describe("ThreadCommandPalette — keyboard roving + select (SC#2)", () => {
  it("ArrowDown / ArrowUp move the active option (aria-selected + aria-activedescendant)", () => {
    renderPalette()
    const input = screen.getByRole("combobox")
    const options = screen.getAllByRole("option")

    // first option active at rest
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id)

    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1].id)

    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true")
  })

  it("does not move past the last option (clamped)", () => {
    renderPalette()
    const input = screen.getByRole("combobox")
    for (let n = 0; n < 8; n++) fireEvent.keyDown(input, { key: "ArrowDown" })
    const options = screen.getAllByRole("option")
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true")
  })

  it("Enter opens the active thread → onSelectThread + onNavigate('chat') + onOpenChange(false)", () => {
    const { props } = renderPalette()
    const input = screen.getByRole("combobox")

    fireEvent.keyDown(input, { key: "ArrowDown" }) // active → t-today-2
    fireEvent.keyDown(input, { key: "Enter" })

    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: "t-today-2" }))
    expect(props.onNavigate).toHaveBeenCalledWith("chat")
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("clicking an option selects it the same way", () => {
    const { props } = renderPalette()
    fireEvent.click(screen.getByText("Old prototype brainstorm"))
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: "t-older" }))
    expect(props.onNavigate).toHaveBeenCalledWith("chat")
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe("ThreadCommandPalette — a11y roles + lifecycle + no new dependency", () => {
  it('the results expose role="listbox" with role="option" rows', () => {
    renderPalette()
    expect(screen.getByRole("listbox")).toBeInTheDocument()
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0)
  })

  it("no aXe AA violations on the open palette", async () => {
    renderPalette()
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations()
  })

  it("re-rendering with open={false} removes the dialog content", async () => {
    const { rerender, props } = renderPalette()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    rerender(<ThreadCommandPalette {...props} open={false} />)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
