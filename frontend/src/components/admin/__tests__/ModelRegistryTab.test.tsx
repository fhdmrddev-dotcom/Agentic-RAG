/**
 * Phase 149 Plan 07 (MODEL-01 / sketch 070-A) — ModelRegistryTab contract.
 *
 * Locks the 070-A instrument-table honesty rules:
 *   • the derived enabled→picker coupling chip (`✓ in picker` / `✕ hidden`);
 *   • inline numeric cells write through onSetCapability with the field patch;
 *   • OVR vs DEF is visually distinct and a Reset appears ONLY on an overridden
 *     field — Reset sends an explicit `null` (clears to DEF);
 *   • the deprecated toggle writes `{ deprecated }` and the row stays enabled/
 *     selectable (deprecated ≠ disabled — the coupling chip is unchanged);
 *   • on a `✕ hidden` (disabled) row the lock control is GATED (clicking it does NOT
 *     call onLock — the 148 self-row disabled-affordance courtesy);
 *   • a 409 rejection surfaces the server `detail` in-row (never a silent failure).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ModelRegistryTab } from "../ModelRegistryTab"
import { ApiError, type ModelRegistryRow } from "@/lib/api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const noop = () => Promise.resolve()

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
    is_default: false,
    is_locked: false,
    overridden_fields: [],
    ...overrides,
  }
}

describe("ModelRegistryTab (070-A) — instrument table + the two-layer coupling", () => {
  it("derives the coupling chip from `enabled` — ✓ in picker when on, ✕ hidden when off", () => {
    const { container } = render(
      <ModelRegistryTab
        rows={[
          makeRow({ model_id: "m-on", enabled: true }),
          makeRow({ model_id: "m-off", enabled: false }),
        ]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const onRow = container.querySelector<HTMLElement>('[data-model="m-on"]')!
    const offRow = container.querySelector<HTMLElement>('[data-model="m-off"]')!
    expect(onRow.getAttribute("data-coupling")).toBe("shown")
    expect(within(onRow).getByText(/in picker/i)).toBeInTheDocument()
    expect(offRow.getAttribute("data-coupling")).toBe("hidden")
    expect(within(offRow).getByText(/hidden/i)).toBeInTheDocument()
  })

  it("editing a numeric cell writes the field patch through onSetCapability", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab rows={[makeRow()]} onSetCapability={onSet} onLock={noop} showTechnical={false} />,
    )

    await user.click(screen.getByRole("button", { name: /edit context for gpt-5\.6-sol/i }))
    const input = screen.getByRole("spinbutton", { name: /^context for gpt-5\.6-sol/i })
    await user.clear(input)
    await user.type(input, "500000")
    await user.keyboard("{Enter}")

    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", { context_window_tokens: 500000 })
  })

  it("toggling `deprecated` writes { deprecated: true } and the row stays enabled/selectable", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <ModelRegistryTab
        rows={[makeRow({ enabled: true, deprecated: false })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    await user.click(screen.getByRole("switch", { name: /deprecated for gpt-5\.6-sol/i }))

    // The deprecated write fired with the deprecated patch (no `enabled` in it)…
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", { deprecated: true })
    // …and the row stays selectable — the coupling chip is unchanged (deprecated ≠ disabled).
    const row = container.querySelector<HTMLElement>('[data-model="gpt-5.6-sol"]')!
    expect(row.getAttribute("data-coupling")).toBe("shown")
    expect(within(row).getByText(/in picker/i)).toBeInTheDocument()
  })

  it("gates the lock control on a ✕ hidden (disabled) row — clicking it does NOT call onLock", async () => {
    const user = userEvent.setup()
    const onLock = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ model_id: "m-off", enabled: false, is_locked: false })]}
        onSetCapability={noop}
        onLock={onLock}
        showTechnical={false}
      />,
    )

    const lock = screen.getByRole("button", { name: /lock m-off as org default/i })
    // Courtesy tooltip names the pre-condition…
    expect(lock).toHaveAttribute("title", expect.stringMatching(/enable this model before locking/i))
    expect(lock).toHaveAttribute("aria-disabled", "true")
    // …and clicking the gated control is inert (the Plan-06 lock-path 409 is the real wall).
    await user.click(lock)
    expect(onLock).not.toHaveBeenCalled()
  })

  it("an enabled row's lock control IS clickable and calls onLock(true)", async () => {
    const user = userEvent.setup()
    const onLock = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ model_id: "m-on", enabled: true, is_locked: false })]}
        onSetCapability={noop}
        onLock={onLock}
        showTechnical={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: /lock m-on as org default/i }))
    expect(onLock).toHaveBeenCalledWith("m-on", true)
  })

  it("surfaces the server 409 detail in-row on a rejected write (never a silent failure)", async () => {
    const user = userEvent.setup()
    const onSet = vi
      .fn()
      .mockRejectedValue(new ApiError("Pick a new default first — this model is the org default.", 409))
    render(
      <ModelRegistryTab
        rows={[makeRow({ enabled: true, is_default: true })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    await user.click(screen.getByRole("switch", { name: /^enabled for gpt-5\.6-sol/i }))

    expect(await screen.findByText(/pick a new default first/i)).toBeInTheDocument()
  })

  it("seeds the deprecation-reason input from the stored reason (IN-02) — re-edit preserves the note", () => {
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: "superseded by gpt-5.6" })]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const reasonInput = screen.getByRole("textbox", {
      name: /deprecation reason for gpt-5\.6-sol/i,
    })
    expect(reasonInput).toHaveValue("superseded by gpt-5.6")
  })

  it("renders a null numeric capability as “—” (not a concrete 0) — WR-04 honesty", () => {
    render(
      <ModelRegistryTab
        rows={[
          makeRow({
            context_window_tokens: null,
            max_output_tokens: null,
            llm_call_timeout_seconds: null,
          }),
        ]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    // The Context cell shows the em-dash "not tracked" placeholder, never a false "0".
    const ctxBtn = screen.getByRole("button", { name: /edit context for gpt-5\.6-sol/i })
    expect(ctxBtn).toHaveTextContent("—")
    expect(ctxBtn).not.toHaveTextContent("0")
  })

  it("shows a Reset ONLY on an overridden field, and Reset sends an explicit null (clears to DEF)", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ overridden_fields: ["context_window_tokens"] })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    // The overridden field carries a Reset…
    const reset = screen.getByRole("button", { name: /reset context for gpt-5\.6-sol/i })
    expect(reset).toBeInTheDocument()
    // …a non-overridden field (max out) does NOT.
    expect(screen.queryByRole("button", { name: /reset max out for gpt-5\.6-sol/i })).not.toBeInTheDocument()

    await user.click(reset)
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", { context_window_tokens: null })
  })
})
