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

import type { ReactElement } from "react"

import { ModelRegistryTab } from "../ModelRegistryTab"
import { ApiError, type ModelRegistryRow } from "@/lib/api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const noop = () => Promise.resolve()

/** Render the tab and OPEN every provider section.
 *
 *  ⚠ The shipped tab lands FOLDED — an operator opens the provider they came for. So a test
 *  that queries a row control has to expand first, exactly as a user does; rendering and
 *  querying straight into a `tbody` would assert against a state nobody sees on load.
 *  Scoped to the provider headers (`[data-provider] > button`) on purpose: the add-by-ID
 *  form is ALSO an aria-expanded disclosure, and a blanket expand would silently open it and
 *  change the preconditions of every test in that describe block. */
function renderTab(ui: ReactElement) {
  const result = render(ui)
  document
    .querySelectorAll<HTMLButtonElement>('[data-provider] > button[aria-expanded="false"]')
    .forEach((btn) => fireEvent.click(btn))
  return result
}

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
    // Phase 196 (AUTH-04): `null` is the shipped state for every pre-migration-120 row —
    // the control renders it as the read-time `coerce` default, never as blank.
    emit_tier: null,
    overridden_fields: [],
    ...overrides,
  }
}

describe("ModelRegistryTab (070-A) — instrument table + the two-layer coupling", () => {
  it("derives the coupling chip from `enabled` — ✓ in picker when on, ✕ hidden when off", () => {
    const { container } = renderTab(
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
    renderTab(
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
    const { container } = renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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
    renderTab(
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

// ── Phase 159 Plan 05 (MODEL-03 / D-159-02 / D-159-03) — the + Add model by ID form ──
// Locks the add-by-ID vertical: the 070-A affordance appears only when the shell wires
// onAddModel; opening it reveals model_id + the 8-cloud provider select + the 3 capability
// knobs; the caps pre-fill from familyDefaults with three source-honest labels; the submit
// builds the body by conditional inclusion (NEVER `enabled`; OMIT native_tools on "unknown"),
// lands the model disabled per the copy, and surfaces a server refusal in-form.
describe("ModelRegistryTab (070-A) — the + Add model by ID form (D-159-02 / D-159-03)", () => {
  const baseRows = [makeRow()]

  async function openForm(onAddModel = vi.fn().mockResolvedValue(undefined)) {
    const user = userEvent.setup()
    renderTab(
      <ModelRegistryTab
        rows={baseRows}
        onSetCapability={noop}
        onLock={noop}
        onAddModel={onAddModel}
        showTechnical={false}
      />,
    )
    await user.click(screen.getByRole("button", { name: /add model by id/i }))
    return { user, onAddModel }
  }

  it("renders NO add affordance when the shell wires no onAddModel (the leaf stays byte-identical)", () => {
    renderTab(<ModelRegistryTab rows={baseRows} onSetCapability={noop} onLock={noop} showTechnical={false} />)
    expect(screen.queryByRole("button", { name: /add model by id/i })).not.toBeInTheDocument()
  })

  it("opening the form shows model_id + a provider select with the 8-cloud roster + the 3 capability inputs", async () => {
    await openForm()
    expect(screen.getByRole("textbox", { name: /model id/i })).toBeInTheDocument()
    const providerSelect = screen.getByRole("combobox", { name: /provider/i })
    expect(within(providerSelect).getAllByRole("option")).toHaveLength(8)
    expect(screen.getByRole("spinbutton", { name: /context window tokens/i })).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: /max output tokens/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /native tools/i })).toBeInTheDocument()
  })

  it("selecting moonshot pre-fills the caps as amber 'default — confirm'; editing a field flips it to 'you set it'", async () => {
    const { user } = await openForm()
    await user.selectOptions(screen.getByRole("combobox", { name: /provider/i }), "moonshot")

    // Kimi family defaults pre-fill the numeric caps + the tools select…
    expect(screen.getByRole("spinbutton", { name: /context window tokens/i })).toHaveDisplayValue("256000")
    expect(screen.getByRole("spinbutton", { name: /max output tokens/i })).toHaveDisplayValue("65536")
    expect(screen.getByRole("combobox", { name: /native tools/i })).toHaveValue("native")
    // …each labeled amber "default — confirm".
    expect(screen.getAllByText(/default — confirm/i).length).toBeGreaterThanOrEqual(1)

    // Editing the context flips ITS label to the operator-typed style.
    const ctx = screen.getByRole("spinbutton", { name: /context window tokens/i })
    await user.clear(ctx)
    await user.type(ctx, "300000")
    expect(screen.getByText(/you set it/i)).toBeInTheDocument()
  })

  it("a null-family provider (openrouter) shows a blank numeric input + the tools select resting on 'unknown' (never a defaulted false)", async () => {
    const { user } = await openForm()
    await user.selectOptions(screen.getByRole("combobox", { name: /provider/i }), "openrouter")

    expect(screen.getByRole("spinbutton", { name: /context window tokens/i })).toHaveDisplayValue("")
    expect(screen.getByRole("combobox", { name: /native tools/i })).toHaveValue("unknown")
    // No family default anywhere → no amber "default — confirm" badge.
    expect(screen.queryByText(/default — confirm/i)).not.toBeInTheDocument()
  })

  it("submitting sends {model_id, provider} + the family caps and NO enabled key (native_tools=true when native)", async () => {
    const { user, onAddModel } = await openForm()
    await user.type(screen.getByRole("textbox", { name: /model id/i }), "kimi-k3")
    await user.selectOptions(screen.getByRole("combobox", { name: /provider/i }), "moonshot")
    await user.click(screen.getByRole("button", { name: /^add model$/i }))

    expect(onAddModel).toHaveBeenCalledTimes(1)
    const body = onAddModel.mock.calls[0][0]
    expect(body).toMatchObject({
      model_id: "kimi-k3",
      provider: "moonshot",
      context_window_tokens: 256000,
      max_output_tokens: 65536,
      native_tools: true,
    })
    expect(body).not.toHaveProperty("enabled")
  })

  it("an unknown-family add with native_tools left 'unknown' OMITS native_tools from the body (SC#3 — never a bare false)", async () => {
    const { user, onAddModel } = await openForm()
    await user.type(screen.getByRole("textbox", { name: /model id/i }), "opaque-model-1")
    await user.selectOptions(screen.getByRole("combobox", { name: /provider/i }), "openrouter")
    await user.click(screen.getByRole("button", { name: /^add model$/i }))

    expect(onAddModel).toHaveBeenCalledTimes(1)
    const body = onAddModel.mock.calls[0][0]
    expect(body).toEqual({ model_id: "opaque-model-1", provider: "openrouter" })
    expect(body).not.toHaveProperty("native_tools")
    expect(body).not.toHaveProperty("enabled")
  })

  it("a rejected submit (ApiError) renders the server detail in-form — no crash, no silent success", async () => {
    const onAddModel = vi.fn().mockRejectedValue(new ApiError("kimi-k3 is already in the registry.", 409))
    const { user } = await openForm(onAddModel)
    await user.type(screen.getByRole("textbox", { name: /model id/i }), "kimi-k3")
    await user.click(screen.getByRole("button", { name: /^add model$/i }))

    expect(await screen.findByText(/already in the registry/i)).toBeInTheDocument()
    // The form stays open (not collapsed) so the operator can correct + retry.
    expect(screen.getByRole("textbox", { name: /model id/i })).toBeInTheDocument()
  })

  it("the form copy states the model is added disabled and enabled from the table", async () => {
    await openForm()
    expect(screen.getByText(/enable it from the table/i)).toBeInTheDocument()
  })
})

// ── Phase 216 — the override marker IS the Reset, + the row-level "reset everything" ──
// Two gaps this locks, both structural rather than cosmetic:
//   1. `native_tools` has always landed in `overridden_fields` like any other column, but the
//      Tools cell rendered only the EFFECTIVE value — no OVR/DEF, no Reset. An operator who
//      flipped it could neither see it was an override nor get back to the built-in default.
//   2. A Reset was per-field only, so putting one model back how you found it took up to four
//      separate writes (and four audit rows for one intention).
describe("ModelRegistryTab — the OVR marker as Reset + the row-level reset", () => {
  it("the Tools column carries its own OVR marker, and it resets native_tools to DEF", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    renderTab(
      <ModelRegistryTab
        rows={[makeRow({ provider: "openai", overridden_fields: ["native_tools"] })]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const reset = screen.getByRole("button", { name: /reset tools for gpt-5\.6-sol/i })
    await user.click(reset)
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", { native_tools: null })
  })

  it("on a native-SDK provider the Tools marker is READ-ONLY — an inert Reset is never offered", () => {
    renderTab(
      <ModelRegistryTab
        rows={[
          makeRow({
            model_id: "claude-opus-4-8",
            provider: "anthropic",
            overridden_fields: ["native_tools"],
          }),
        ]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    // The stored override is still VISIBLE (the operator can see one exists)…
    const row = document.querySelector('[data-model="claude-opus-4-8"]') as HTMLElement
    expect(within(row).getAllByText("OVR").length).toBeGreaterThan(0)
    // …but clearing it would change no routing on this provider, so it is not a button.
    expect(
      screen.queryByRole("button", { name: /reset tools for claude-opus-4-8/i }),
    ).not.toBeInTheDocument()
  })

  it("the row-level reset ARMS on the first click and writes nothing", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    renderTab(
      <ModelRegistryTab
        rows={[
          makeRow({
            overridden_fields: ["context_window_tokens", "max_output_tokens", "native_tools"],
          }),
        ]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const rowReset = screen.getByRole("button", {
      name: /reset 3 overridden values for gpt-5\.6-sol/i,
    })
    await user.click(rowReset)
    expect(onSet).not.toHaveBeenCalled()
    // Armed state is VISIBLE — the control says what the next click will do.
    expect(rowReset).toHaveTextContent(/reset 3\?/i)
    // …and the accessible name does NOT change underneath an assistive-tech user.
    expect(
      screen.getByRole("button", { name: /reset 3 overridden values for gpt-5\.6-sol/i }),
    ).toBe(rowReset)
  })

  it("the second click clears every overridden CAPABILITY in ONE patch — and never touches enabled/deprecated", async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(undefined)
    renderTab(
      <ModelRegistryTab
        rows={[
          makeRow({
            // Five stored overrides — but only THREE of them are capabilities.
            overridden_fields: [
              "context_window_tokens",
              "llm_call_timeout_seconds",
              "emit_tier",
              "enabled",
              "deprecated",
            ],
          }),
        ]}
        onSetCapability={onSet}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const rowReset = screen.getByRole("button", {
      name: /reset 3 overridden values for gpt-5\.6-sol/i,
    })
    await user.click(rowReset)
    await user.click(rowReset)

    // ONE request, not three — the endpoint clears every key present in the body.
    expect(onSet).toHaveBeenCalledTimes(1)
    expect(onSet).toHaveBeenCalledWith("gpt-5.6-sol", {
      context_window_tokens: null,
      llm_call_timeout_seconds: null,
      emit_tier: null,
    })
    // ⚠ THE EXCLUSION IS THE POINT: a null `enabled` resolves to TRUE server-side
    // (`_registry_row`), so clearing it would SHOW a model the operator deliberately hid.
    const patch = onSet.mock.calls[0][1]
    expect(patch).not.toHaveProperty("enabled")
    expect(patch).not.toHaveProperty("deprecated")
  })

  it("a row with no capability overrides shows no row-level reset (an action with no effect is not an affordance)", () => {
    renderTab(
      <ModelRegistryTab
        rows={[
          // Stored overrides, but ONLY the excluded lifecycle ones → nothing to reset.
          makeRow({ model_id: "m-lifecycle-only", overridden_fields: ["enabled", "deprecated"] }),
          // ⚠ NON-VACUITY CONTROL, in the same render: without this the assertion below would
          // also pass on a build where the row-level reset does not exist AT ALL — a fence
          // with nothing defending it. This row proves the query CAN find one.
          makeRow({ model_id: "m-has-caps", overridden_fields: ["max_output_tokens"] }),
        ]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    expect(
      screen.getByRole("button", { name: /reset 1 overridden value for m-has-caps/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /overridden value.* for m-lifecycle-only/i }),
    ).not.toBeInTheDocument()
  })
})

// ── The tab lands FOLDED ────────────────────────────────────────────────────────────
// Pinned with the RAW `render` (never `renderTab`, which exists precisely to open these
// sections): every other test in this file expands first, so without this one nothing would
// notice the default flipping back — the helper would absorb it silently.
describe("ModelRegistryTab — provider sections are FOLDED on arrival", () => {
  it("renders no capability rows until the operator opens a provider, and the header stays readable", async () => {
    const user = userEvent.setup()
    render(
      <ModelRegistryTab
        rows={[
          makeRow({ model_id: "gpt-5.6-sol", provider: "openai" }),
          makeRow({ model_id: "claude-opus-4-8", provider: "anthropic" }),
        ]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    // Both provider sections exist and both are shut.
    const headers = document.querySelectorAll('[data-provider] > button')
    expect(headers).toHaveLength(2)
    headers.forEach((h) => expect(h).toHaveAttribute("aria-expanded", "false"))

    // No row control is reachable — the table body is not rendered at all.
    expect(
      screen.queryByRole("button", { name: /edit context for gpt-5\.6-sol/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: /enabled for gpt-5\.6-sol/i })).not.toBeInTheDocument()

    // The folded header still carries the count, so a shut section is not a blank one.
    // (Both sections hold one model each, hence two matches — the point is that a folded
    // header still states its count rather than going blank.)
    expect(screen.getAllByText(/1 model · 1 shown to users/i)).toHaveLength(2)

    // Opening ONE provider reveals only that provider's rows.
    await user.click(screen.getByRole("button", { name: /openai/i }))
    expect(screen.getByRole("button", { name: /edit context for gpt-5\.6-sol/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /edit context for claude-opus-4-8/i }),
    ).not.toBeInTheDocument()
  })
})
