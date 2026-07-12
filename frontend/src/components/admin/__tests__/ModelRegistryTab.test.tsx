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
import { render, screen, cleanup, within, fireEvent, waitFor } from "@testing-library/react"
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

  // ── D-149-04 / Test-10 — deprecated-reason commit parity with InlineNumberCell ──
  // The reproduced UAT complaint: a typed reason was reported as commit-on-blur-only and
  // could be lost on Enter (or double-written by Enter-then-blur). These lock full parity:
  // Enter commits exactly once, Escape cancels (revert, no write), and the one-shot guard
  // stops the trailing blur from double-writing.

  it("test_reason_enter_commits_once — Enter commits the typed reason exactly once (never lost)", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: null })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const input = screen.getByRole("textbox", { name: /deprecation reason for gpt-5\.6-sol/i })
    await user.click(input)
    await user.type(input, "superseded by gpt-5.6")
    await user.keyboard("{Enter}")

    expect(onSet).toHaveBeenCalledTimes(1)
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", {
      deprecated: true,
      deprecated_reason: "superseded by gpt-5.6",
    })
  })

  it("test_reason_escape_cancels — Escape reverts the draft to the stored reason and does NOT write", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: "original reason" })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const input = screen.getByRole("textbox", { name: /deprecation reason for gpt-5\.6-sol/i })
    await user.click(input)
    await user.clear(input)
    await user.type(input, "a new draft")
    expect(input).toHaveValue("a new draft")

    await user.keyboard("{Escape}")

    // Cancel semantics: no write fired, and the input reverted to the stored reason.
    expect(onSet).not.toHaveBeenCalled()
    expect(input).toHaveValue("original reason")
  })

  it("test_reason_enter_then_blur_no_double_write — Enter then the trailing blur writes at most once", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: null })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const input = screen.getByRole("textbox", { name: /deprecation reason for gpt-5\.6-sol/i })
    await user.click(input)
    await user.type(input, "superseded")
    await user.keyboard("{Enter}")
    // The blur that eventually fires must NOT re-commit (the one-shot `settled` guard).
    fireEvent.blur(input)

    expect(onSet).toHaveBeenCalledTimes(1)
  })

  // ── WR-03 (review round 2) — dirty check + busy-window commit survival ──────────

  it("test_reason_noop_blur_never_writes — focus + blur with zero edits issues NO write (no PATCH, no ✎ receipt, no refetch)", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: "original reason" })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const input = screen.getByRole("textbox", { name: /deprecation reason for gpt-5\.6-sol/i })
    // A plain tab-through: focus, no edits, blur. The dirty check must drop it —
    // every such blur used to issue a real PATCH + stamp a false audit receipt.
    await user.click(input)
    fireEvent.blur(input)

    expect(onSet).not.toHaveBeenCalled()
  })

  it("test_reason_busy_commit_not_swallowed — a commit landing during another write's busy window survives (re-commits once busy clears)", async () => {
    const user = userEvent.setup()
    let resolveFirst: (() => void) | undefined
    const onSet = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveFirst = resolve }),
      )
      .mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, deprecated_reason: null })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const input = screen.getByRole("textbox", { name: /deprecation reason for gpt-5\.6-sol/i })
    await user.click(input)
    await user.type(input, "queued reason")

    // Another control on the row starts a write → the row goes busy (in flight).
    fireEvent.click(screen.getByRole("switch", { name: /native tools for gpt-5\.6-sol/i }))
    expect(onSet).toHaveBeenCalledTimes(1)

    // The reason blur lands DURING the busy window. Before the fix this settled the
    // one-shot guard and then write() dropped the call — the typed reason was
    // swallowed permanently (no retry until a fresh keystroke).
    fireEvent.blur(input)
    expect(onSet).toHaveBeenCalledTimes(1) // still only the in-flight write

    // The in-flight write completes → busy clears…
    await waitFor(() => resolveFirst!())
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: /native tools for gpt-5\.6-sol/i }),
      ).not.toBeDisabled(),
    )

    // …and the next blur commits the still-pending reason (never lost).
    fireEvent.blur(input)
    expect(onSet).toHaveBeenCalledTimes(2)
    expect(onSet).toHaveBeenLastCalledWith("gpt-5.6-sol", {
      deprecated: true,
      deprecated_reason: "queued reason",
    })
  })

  // ── WR-05 (review round 2) — native_tools honest lock on native-SDK providers ──
  // Anthropic/Google models run the native SDK branches (agent_loop dispatches on the
  // active provider before any calling-mode read), which never consult native_tools —
  // a write would record an OVR + ✎ receipt while routing stays byte-identical. The
  // toggle is therefore GATED (aria-disabled + always-native tooltip + click no-op),
  // never silently inert (Control-Room honest-locks doctrine).

  it("test_native_tools_gated_on_native_sdk_rows — anthropic/google rows gate the toggle (no inert write); compat rows keep it live", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <ModelRegistryTab
        rows={[
          makeRow({ model_id: "claude-opus-4-8", provider: "anthropic" }),
          makeRow({ model_id: "gpt-5.6-sol", provider: "openai" }),
        ]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const gated = screen.getByRole("switch", { name: /native tools for claude-opus-4-8/i })
    // Honest lock: declared inert + the courtesy tooltip names WHY.
    expect(gated).toHaveAttribute("aria-disabled", "true")
    expect(gated.getAttribute("title")).toMatch(/always native/i)
    // Clicking it never issues the silently-inert write (no OVR, no false ✎ receipt).
    fireEvent.click(gated)
    expect(onSet).not.toHaveBeenCalled()

    // A compat-served row keeps the live toggle — the gate is provider-scoped.
    const live = screen.getByRole("switch", { name: /native tools for gpt-5\.6-sol/i })
    expect(live).not.toHaveAttribute("aria-disabled", "true")
    await user.click(live)
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", { native_tools: false })
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
