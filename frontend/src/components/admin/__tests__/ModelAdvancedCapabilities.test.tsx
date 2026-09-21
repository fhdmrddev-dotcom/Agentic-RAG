/**
 * Phase 262 — the advanced-capability panel, and the one rule it must never break.
 *
 * ⛔ `null` IS NOT `false`. The backend overlays only non-null values, so a null field means
 * *"nobody has established this — the built-in registry or the provider inference decides"*.
 * A control that renders null as "off" states something about the model that no one has
 * measured, and the operator then reads a settled fact where there is none.
 *
 * ⚠ These are CONTENT assertions, not presence assertions. Checking that a `data-testid`
 * exists proves a block rendered; it cannot see the block saying the wrong thing. That
 * distinction has already cost this project a shipped defect behind a green fence, so the
 * cases below bind to the rendered words and to the exact patch sent on the wire.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  ADVANCED_FIELDS,
  ModelAdvancedCapabilities,
  advancedSetCount,
} from "@/components/admin/ModelAdvancedCapabilities"
import type { ModelRegistryRow } from "@/lib/api/admin"

function makeRow(overrides: Partial<ModelRegistryRow> = {}): ModelRegistryRow {
  return {
    model_id: "gpt-5.6-sol",
    provider: "openai",
    capability_source: "registry",
    enabled: true,
    deprecated: false,
    context_window_tokens: 400000,
    max_output_tokens: 128000,
    native_tools: true,
    llm_call_timeout_seconds: 600,
    emit_tier: null,
    api_surface: null,
    reasoning_first: null,
    reasoning_off: null,
    uses_max_completion_tokens: null,
    supports_parallel_tools: null,
    max_tools: null,
    is_default: false,
    is_locked: false,
    overridden_fields: [],
    ...overrides,
  } as ModelRegistryRow
}

function open(row: ModelRegistryRow, onWrite = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ModelAdvancedCapabilities
      row={row}
      busy={false}
      showTechnical={false}
      onWrite={onWrite}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: /Advanced capabilities for/ }))
  return onWrite
}

describe("advancedSetCount", () => {
  it("counts an explicit false as SET, not as absent", () => {
    // ⛔ The trap this pins: a truthiness filter would read `false` as unset, so a
    // deliberately-disabled capability would look untouched from the outside and an
    // operator would have no way to tell "I turned this off" from "nobody decided".
    expect(advancedSetCount(makeRow())).toBe(0)
    expect(advancedSetCount(makeRow({ supports_parallel_tools: false }))).toBe(1)
    expect(advancedSetCount(makeRow({ reasoning_first: false, max_tools: 12 }))).toBe(2)
  })

  it("counts every advanced field when all are set", () => {
    const row = makeRow({
      api_surface: "responses",
      reasoning_first: true,
      reasoning_off: "effort_none",
      uses_max_completion_tokens: true,
      supports_parallel_tools: false,
      max_tools: 20,
    })
    expect(advancedSetCount(row)).toBe(ADVANCED_FIELDS.length)
  })
})

describe("the panel", () => {
  it("shows every advanced field", () => {
    open(makeRow())
    for (const field of ADVANCED_FIELDS) {
      expect(screen.getByLabelText(new RegExp(field.label))).toBeInTheDocument()
    }
  })

  it("renders an unset field as 'Not set', never as a value", () => {
    open(makeRow())
    const control = screen.getByLabelText(/API surface/) as HTMLSelectElement
    expect(control.value).toBe("")
    expect(within(control).getByText("Not set")).toBeInTheDocument()
  })

  it("says what happens anyway when a field is unset", () => {
    // ⭐ The most useful sentence on the screen. Without it "Not set" reads as "nothing
    // happens", when in every case something specific happens — and it is usually a guess
    // derived from the model's NAME, which is exactly what breaks newly released models.
    open(makeRow())
    expect(
      screen.getByText(/guessed from the model's NAME/),
    ).toBeInTheDocument()
    expect(screen.getByText(/called on chat\.completions/)).toBeInTheDocument()
  })

  it("hides the unset warning once a field is asserted", () => {
    open(makeRow({ uses_max_completion_tokens: true }))
    expect(screen.queryByText(/guessed from the model's NAME/)).not.toBeInTheDocument()
  })

  it("sends the chosen value as a patch", () => {
    const onWrite = open(makeRow())
    fireEvent.change(screen.getByLabelText(/API surface/), {
      target: { value: "responses" },
    })
    expect(onWrite).toHaveBeenCalledWith({ api_surface: "responses" })
  })

  it("sends an explicit null when cleared — the Reset the backend expects", () => {
    // ⛔ An empty string here would be STORED as an empty string and would then fail the
    // SQL CHECK, or worse, pass a looser one and resolve to an unknown surface that the
    // dispatcher silently ignores. The select's "" must become `null` on the wire.
    const onWrite = open(makeRow({ api_surface: "responses" }))
    fireEvent.change(screen.getByLabelText(/API surface/), { target: { value: "" } })
    expect(onWrite).toHaveBeenCalledWith({ api_surface: null })
  })

  it("round-trips a boolean field through its three states", () => {
    const onWrite = open(makeRow())
    const control = screen.getByLabelText(/Accepts parallel_tool_calls/)
    fireEvent.change(control, { target: { value: "false" } })
    expect(onWrite).toHaveBeenCalledWith({ supports_parallel_tools: false })
    fireEvent.change(control, { target: { value: "true" } })
    expect(onWrite).toHaveBeenCalledWith({ supports_parallel_tools: true })
    fireEvent.change(control, { target: { value: "" } })
    expect(onWrite).toHaveBeenCalledWith({ supports_parallel_tools: null })
  })

  it("writes the tool ceiling as a number on blur", () => {
    const onWrite = open(makeRow())
    fireEvent.blur(screen.getByLabelText(/Tool count ceiling/), { target: { value: "20" } })
    expect(onWrite).toHaveBeenCalledWith({ max_tools: 20 })
  })

  it("clears the tool ceiling to null when emptied", () => {
    // ⚠ Its own test, and a DISTINCT model_id, on purpose. The first version drove both
    // halves in one case with two renders of the same row — and the control ids are derived
    // from model_id, so the second dialog's input carried the SAME id as the first and the
    // query resolved to the wrong element. It failed for a reason that had nothing to do
    // with the behaviour under test, which is the most expensive kind of red.
    const onWrite = open(makeRow({ model_id: "ceiling-probe", max_tools: 20 }))
    fireEvent.blur(screen.getByLabelText(/Tool count ceiling/), { target: { value: "" } })
    expect(onWrite).toHaveBeenCalledWith({ max_tools: null })
  })

  it("refuses a ceiling below 1 rather than sending it", () => {
    // ⛔ `0` would silently offer NO tools while reading as a capability setting.
    // `native_tools: false` is the control for turning tools off, and it says so on screen.
    const onWrite = open(makeRow())
    fireEvent.blur(screen.getByLabelText(/Tool count ceiling/), { target: { value: "0" } })
    expect(onWrite).not.toHaveBeenCalled()
  })

  it("marks the api_surface field as OpenAI-only", () => {
    // The field is meaningful only on a native OpenAI route; the runtime gate checks the
    // resolved provider, so a misapplied row degrades silently rather than erroring. Saying
    // so here is the only place an operator learns it before setting it.
    open(makeRow())
    expect(screen.getByText(/Only meaningful on an OpenAI provider/)).toBeInTheDocument()
  })
})
