/**
 * 296 G-4 row 11 (PARTIAL → fix) — the in-thread launch form's "… are required" refusal is
 * brought into view when Run is refused.
 *
 * Driven live: `New Vendor IRS W-9 Form Fill` has 13 required fields; pressing Run with them empty
 * started nothing and rendered the `role=alert` sentence ~2,000 px down the dialog's scroller,
 * under the last field, so the person saw nothing happen. jsdom lays nothing out, so the pin is
 * the call itself: the refusal element is scrolled into view (`block: "nearest"`) on every
 * refused press — including a second press with the same words, which re-renders nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ChatLaunchForm } from "../ChatLaunchForm"

const fields = Array.from({ length: 13 }, (_, i) => ({ key: `f${i}`, label: `Field ${i}` }))

let scrolled: Element[] = []
let calls: unknown[][] = []
const original = Element.prototype.scrollIntoView

beforeEach(() => {
  scrolled = []
  calls = []
  Element.prototype.scrollIntoView = function (this: Element, ...args: unknown[]) {
    scrolled.push(this)
    calls.push(args)
  } as typeof Element.prototype.scrollIntoView
})

afterEach(() => {
  cleanup()
  Element.prototype.scrollIntoView = original
})

describe("ChatLaunchForm: a refused Run brings the refusal into view (296 G-4 row 11)", () => {
  it("scrolls the required-refusal into view when it appears, and again on a repeat press", () => {
    const onConfirm = vi.fn()
    render(<ChatLaunchForm workflowName="W-9" fields={fields} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    const refusal = screen.getByTestId("chat-launch-required-refusal")
    expect(onConfirm).not.toHaveBeenCalled()
    expect(scrolled).toContain(refusal)
    expect(calls[scrolled.indexOf(refusal)]).toEqual([{ block: "nearest" }])

    const before = scrolled.filter((el) => el === refusal).length
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    expect(scrolled.filter((el) => el === refusal).length).toBeGreaterThan(before)
  })

  it("a valid press scrolls nothing", () => {
    render(
      <ChatLaunchForm
        workflowName="W-9"
        fields={[{ key: "a", label: "A" }]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } })
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    expect(scrolled).toEqual([])
  })
})
