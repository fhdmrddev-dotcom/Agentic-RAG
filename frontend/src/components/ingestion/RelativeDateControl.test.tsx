/**
 * Tests for RelativeDateControl (Phase 114 Plan 05, sketch 030-A).
 *
 * Locks the direction-carrying relative-date contract: a [N][unit] stepper, a
 * live resolved-window readout that updates as N/unit change, and the
 * overdue-excluded note that appears ONLY for `within next…`. The readout is
 * PREVIEW-only (D-114-16) — these tests assert it renders + updates, never that
 * it is the authoritative window (the server derives that).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RelativeDateControl } from "@/components/ingestion/RelativeDateControl"

describe("RelativeDateControl", () => {
  it("renders the [N][unit] stepper and a live resolved-window readout", () => {
    render(
      <RelativeDateControl direction="within_next" value={30} unit="days" onChange={vi.fn()} />,
    )
    // The N amount input + the unit select are present.
    expect(screen.getByLabelText("Amount")).toHaveValue(30)
    expect(screen.getByLabelText("Unit")).toHaveValue("days")
    // The resolved-window readout renders.
    expect(screen.getByTestId("resolved-window").textContent).toBeTruthy()
  })

  it("the + stepper increments N via onChange", () => {
    const onChange = vi.fn()
    render(
      <RelativeDateControl direction="within_next" value={30} unit="days" onChange={onChange} />,
    )
    fireEvent.click(screen.getByLabelText("Increase"))
    expect(onChange).toHaveBeenCalledWith({ value: 31, unit: "days" })
  })

  it("the − stepper decrements N (clamped at 1)", () => {
    const onChange = vi.fn()
    render(
      <RelativeDateControl direction="within_next" value={2} unit="days" onChange={onChange} />,
    )
    fireEvent.click(screen.getByLabelText("Decrease"))
    expect(onChange).toHaveBeenCalledWith({ value: 1, unit: "days" })
  })

  it("changing the unit emits onChange with the new unit", () => {
    const onChange = vi.fn()
    render(
      <RelativeDateControl direction="within_next" value={3} unit="days" onChange={onChange} />,
    )
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "months" } })
    expect(onChange).toHaveBeenCalledWith({ value: 3, unit: "months" })
  })

  it("the resolved-window readout updates when N / unit change", () => {
    const { rerender } = render(
      <RelativeDateControl direction="within_next" value={7} unit="days" onChange={vi.fn()} />,
    )
    const first = screen.getByTestId("resolved-window").textContent
    rerender(
      <RelativeDateControl direction="within_next" value={90} unit="days" onChange={vi.fn()} />,
    )
    const second = screen.getByTestId("resolved-window").textContent
    // A wider window resolves to a different end date — the readout is live.
    expect(second).not.toEqual(first)
  })

  it("shows the overdue-excluded note for within_next", () => {
    render(
      <RelativeDateControl direction="within_next" value={90} unit="days" onChange={vi.fn()} />,
    )
    expect(
      screen.getByText(/Already-overdue items are not included/i),
    ).toBeInTheDocument()
  })

  it("does NOT show the overdue note for older_than", () => {
    render(
      <RelativeDateControl direction="older_than" value={90} unit="days" onChange={vi.fn()} />,
    )
    expect(
      screen.queryByText(/Already-overdue items are not included/i),
    ).not.toBeInTheDocument()
  })

  it("always shows the recomputed-live note (the window drifts with the calendar)", () => {
    render(
      <RelativeDateControl direction="older_than" value={30} unit="days" onChange={vi.fn()} />,
    )
    expect(screen.getByText(/Updates automatically/i)).toBeInTheDocument()
  })
})
