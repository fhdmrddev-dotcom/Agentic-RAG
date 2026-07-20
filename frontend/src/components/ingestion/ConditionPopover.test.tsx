/**
 * Tests for ConditionPopover (Phase 114 Plan 05, sketch 030-A).
 *
 * Locks the type-aware operator contract: operator options change with the
 * field's type (a date field offers within_next/before/between; a string field
 * offers is/contains/one-of; no number-only operators leak onto a string field),
 * the `between` editor renders two value inputs, the `one_of` editor renders a
 * multi-value input, and there is NO on-screen type/operator matrix table.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { ConditionPopover } from "@/components/ingestion/ConditionPopover"
import type { ViewCondition } from "@/types"

function operatorOptionValues(): string[] {
  const operatorSelect = screen.getByLabelText("Operator") as HTMLSelectElement
  return within(operatorSelect)
    .queryAllByRole("option")
    .map((o) => (o as HTMLOptionElement).value)
}

describe("ConditionPopover", () => {
  it("a string field offers string operators (is / contains / one_of), no number-only ops", () => {
    render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    // default field is `title` (string)
    expect((screen.getByLabelText("Field") as HTMLSelectElement).value).toBe("title")
    const ops = operatorOptionValues()
    expect(ops).toEqual(expect.arrayContaining(["eq", "contains", "one_of", "is_empty"]))
    // number-only operators must NOT appear for a string field
    expect(ops).not.toContain("gte")
    expect(ops).not.toContain("lte")
    // date-only relative operators must NOT appear either
    expect(ops).not.toContain("within_next")
  })

  it("a date field offers within_next / before / between (operators change with field_type)", () => {
    render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "date" } })
    const ops = operatorOptionValues()
    expect(ops).toEqual(
      expect.arrayContaining(["within_next", "older_than", "before", "after", "between"]),
    )
    // string free-text `contains` is not a date operator
    expect(ops).not.toContain("contains")
  })

  it("between renders two value inputs", () => {
    render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "date" } })
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "between" } })
    const editor = screen.getByTestId("between-editor")
    expect(within(editor).getByLabelText("From value")).toBeInTheDocument()
    expect(within(editor).getByLabelText("To value")).toBeInTheDocument()
  })

  it("one_of renders a multi-value input (add another)", () => {
    render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    // title (string) supports one_of
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "one_of" } })
    const editor = screen.getByTestId("one-of-editor")
    expect(within(editor).getByLabelText("Value 1")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Add another"))
    expect(within(editor).getByLabelText("Value 2")).toBeInTheDocument()
  })

  it("within_next shows the relative-date control (the operator carries the direction)", () => {
    render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "date" } })
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "within_next" } })
    // the [N][unit] stepper + the live readout
    expect(screen.getByLabelText("Amount")).toBeInTheDocument()
    expect(screen.getByLabelText("Unit")).toBeInTheDocument()
    expect(screen.getByTestId("resolved-window")).toBeInTheDocument()
  })

  it("Apply emits a ViewCondition with the composed field/op/value", () => {
    const onApply = vi.fn()
    render(<ConditionPopover onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "invoice" } })
    fireEvent.click(screen.getByText("Apply"))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ViewCondition>>({
        field: "title",
        op: "eq",
        value: "invoice",
      }),
    )
  })

  it("a between condition emits value + value2", () => {
    const onApply = vi.fn()
    render(<ConditionPopover onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "date" } })
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "between" } })
    fireEvent.change(screen.getByLabelText("From value"), { target: { value: "2026-01-01" } })
    fireEvent.change(screen.getByLabelText("To value"), { target: { value: "2026-12-31" } })
    fireEvent.click(screen.getByText("Apply"))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ViewCondition>>({
        field: "date",
        op: "between",
        value: "2026-01-01",
        value2: "2026-12-31",
      }),
    )
  })

  it("an is_empty condition needs no value and Apply is enabled immediately", () => {
    const onApply = vi.fn()
    render(<ConditionPopover onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "is_empty" } })
    // no value editor for is_empty
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Apply"))
    expect(onApply).toHaveBeenCalledWith({ field: "title", op: "is_empty" })
  })

  it("WR-01: a custom number field offers ONLY eq / is_empty — no range ops", () => {
    // Custom number ranges compare lexically on metadata->>'field' (silently wrong),
    // so range operators must not be offered (the server rejects them too).
    render(
      <ConditionPopover
        onApply={vi.fn()}
        onCancel={vi.fn()}
        customFields={[
          {
            id: "f1",
            field_key: "amount",
            field_type: "number",
            enabled: true,
            is_system_global: false,
          },
        ]}
      />,
    )
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "amount" } })
    const ops = operatorOptionValues()
    expect(ops).toEqual(expect.arrayContaining(["eq", "is_empty"]))
    expect(ops).not.toContain("gte")
    expect(ops).not.toContain("lte")
    expect(ops).not.toContain("between")
  })

  it("renders NO on-screen type/operator matrix (no static matrix table)", () => {
    const { container } = render(<ConditionPopover onApply={vi.fn()} onCancel={vi.fn()} />)
    // The deleted-in-sketch-030 matrix would be a <table>; the adaptive control has none.
    expect(container.querySelector("table")).toBeNull()
    // And no leaked type-system words on screen (string/number/boolean labels).
    expect(screen.queryByText(/operator.*matrix/i)).toBeNull()
  })
})
