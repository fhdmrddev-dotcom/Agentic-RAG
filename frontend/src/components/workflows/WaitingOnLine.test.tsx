// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { WaitingOnLine } from "./WaitingOnLine"

describe("WaitingOnLine (288-03)", () => {
  it("renders nothing when absent", () => {
    const { container, rerender } = render(<WaitingOnLine />)
    expect(container.innerHTML).toBe("")
    rerender(<WaitingOnLine waitingOn={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders the server sentence verbatim under a stable testid", () => {
    render(
      <WaitingOnLine
        waitingOn={{
          sentence: 'Waiting on Dana (you) to answer "Approve?".',
          window_passed: false,
        }}
      />,
    )
    const el = screen.getByTestId("run-waiting-on")
    expect(el.textContent).toBe('Waiting on Dana (you) to answer "Approve?".')
    expect(el.getAttribute("data-window-passed")).toBe("false")
  })

  it("carries the window-passed state for the paused wording", () => {
    render(<WaitingOnLine waitingOn={{ sentence: "Still waiting on Dana.", window_passed: true }} />)
    expect(screen.getByTestId("run-waiting-on").getAttribute("data-window-passed")).toBe("true")
  })

  it("renders hostile markup as text, never as HTML", () => {
    const evil = '<img src=x onerror="alert(1)"><b>bold</b>'
    const { container } = render(
      <WaitingOnLine waitingOn={{ sentence: evil, window_passed: false }} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByTestId("run-waiting-on").textContent).toBe(evil)
  })
})
