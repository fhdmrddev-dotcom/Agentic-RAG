/**
 * Phase 149 Plan 07 (MODEL-02 / sketch 071-A) — ModelDiscoveryPanel contract.
 *
 * Locks the SC#3 propose-only hero:
 *   • a capability the provider did NOT return renders as an amber "unknown — you
 *     set it" INPUT, never a value (Google returns token limits but NOT native_tools);
 *   • per-provider run cards show capabilities ✓ / IDs only / no-key / verbatim error;
 *   • a new model with unknown capabilities can NOT be enabled (the "enable now" tick
 *     is disabled) — never auto-enabled;
 *   • vanished models are flagged (mark-deprecated / disable / keep) — never a delete;
 *   • confirming routes the chosen changes through onConfirm.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ModelDiscoveryPanel } from "../ModelDiscoveryPanel"
import { DISCOVERY_UNKNOWN, type DiscoveryResult } from "@/lib/api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A representative discovery result exercising the SC#3 provider matrix: Google returns
 *  token limits but NOT native_tools; OpenAI returns IDs only; OpenRouter returns full;
 *  MiniMax rate-limited; Anthropic has no key. */
const RESULT: DiscoveryResult = {
  new: [
    {
      provider: "google",
      model_id: "gemini-3-pro",
      enabled: false,
      capabilities: { context: 2000000, max_output: 64000, native_tools: DISCOVERY_UNKNOWN },
    },
    {
      provider: "openai",
      model_id: "gpt-5.6-nova",
      enabled: false,
      capabilities: {
        context: DISCOVERY_UNKNOWN,
        max_output: DISCOVERY_UNKNOWN,
        native_tools: DISCOVERY_UNKNOWN,
      },
    },
  ],
  changed: [
    { provider: "openrouter", model_id: "z-ai/glm-5.1", changes: { context: { from: 128000, to: 200000 } } },
  ],
  vanished: [{ provider: "openai", model_id: "gpt-4-turbo" }],
  providers: [
    { provider: "openai", status: "ok", ok: true },
    { provider: "google", status: "ok", ok: true },
    { provider: "openrouter", status: "ok", ok: true },
    { provider: "minimax", status: "http-429", ok: false },
    { provider: "anthropic", status: "no_key", ok: false },
  ],
}

async function runDiscovery(onConfirm = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup()
  const onRun = vi.fn().mockResolvedValue(RESULT)
  const view = render(
    <ModelDiscoveryPanel
      onRunDiscovery={onRun}
      onConfirm={onConfirm}
      filterEnabled={false}
      onSetFilter={vi.fn().mockResolvedValue(undefined)}
    />,
  )
  await user.click(screen.getByRole("button", { name: /run discovery/i }))
  // Wait for the resolved diff to render.
  await screen.findByText(/propose-only/i)
  return { user, onRun, onConfirm, ...view }
}

describe("ModelDiscoveryPanel (071-A) — SC#3 propose-only hero", () => {
  it("renders an un-returned capability as an amber input, not a value (Google native_tools)", async () => {
    const { container } = await runDiscovery()

    // Google returned token limits → context is a VALUE (no editable input)…
    const geminiRow = container.querySelector<HTMLElement>('[data-new-model="gemini-3-pro"]')!
    expect(within(geminiRow).queryByRole("spinbutton", { name: /context for gemini-3-pro/i })).toBeNull()
    expect(within(geminiRow).getByText(/2,000k|2000k/i)).toBeInTheDocument()
    // …but native_tools was NOT returned → it is the amber "you set it" input (a select).
    expect(within(geminiRow).getByRole("combobox", { name: /tools for gemini-3-pro/i })).toBeInTheDocument()
  })

  it("shows the per-provider run-card badges (capabilities ✓ / IDs only / verbatim error / no key)", async () => {
    const { container } = await runDiscovery()

    const openai = container.querySelector<HTMLElement>('[data-provider="openai"]')!
    expect(within(openai).getByText(/ids only/i)).toBeInTheDocument()
    const google = container.querySelector<HTMLElement>('[data-provider="google"]')!
    expect(within(google).getByText(/capabilities/i)).toBeInTheDocument()
    const minimax = container.querySelector<HTMLElement>('[data-provider="minimax"]')!
    expect(within(minimax).getByText(/verbatim error/i)).toBeInTheDocument()
    expect(within(minimax).getByText(/http-429/i)).toBeInTheDocument()
    const anthropic = container.querySelector<HTMLElement>('[data-provider="anthropic"]')!
    expect(within(anthropic).getByText(/no key/i)).toBeInTheDocument()
  })

  it("disables the 'enable now' tick for an unknown-capability model with NO family default (never auto-enabled)", async () => {
    // An opaque id with no family match → no pre-fill → genuinely incomplete → not enable-able.
    // (gpt-5.6-nova now pre-fills from the openai family — see the D-159-03 suite below.)
    await runWith({
      new: [
        {
          provider: "openrouter",
          model_id: "acme/opaque-1",
          enabled: false,
          capabilities: {
            context: DISCOVERY_UNKNOWN,
            max_output: DISCOVERY_UNKNOWN,
            native_tools: DISCOVERY_UNKNOWN,
          },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "openrouter", status: "ok", ok: true }],
    })
    const tick = screen.getByRole("checkbox", { name: /enable acme\/opaque-1 now/i })
    expect(tick).toBeDisabled()
    expect(tick).not.toBeChecked()
  })

  it("flags vanished models with deprecate / disable / keep — and NO delete action", async () => {
    const { container } = await runDiscovery()

    const van = container.querySelector<HTMLElement>('[data-vanished-model="gpt-4-turbo"]')!
    expect(within(van).getByRole("button", { name: /mark deprecated/i })).toBeInTheDocument()
    expect(within(van).getByRole("button", { name: /^disable$/i })).toBeInTheDocument()
    expect(within(van).getByRole("button", { name: /keep as-is/i })).toBeInTheDocument()
    // Vanished ≠ deleted — there is NO delete affordance anywhere in the panel.
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull()
  })

  it("confirming routes the chosen changes through onConfirm (new models opt-in via Select all)", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await runDiscovery(onConfirm)

    // Opt-in: new models start UNselected — pick them (Select all covers the visible set, filter off).
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const changes = onConfirm.mock.calls[0][0] as Array<{ modelId: string }>
    // The now-selected new models + the accept-by-default changed one.
    expect(changes.map((c) => c.modelId)).toEqual(
      expect.arrayContaining(["gemini-3-pro", "z-ai/glm-5.1"]),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SC#3 / D-149-13 (Test-9 COSMETIC) — the per-model provenance suffix must be
// derived from ACTUAL per-field provenance, never the binary `!anyUnknown`. The old
// all-or-nothing basis lied whenever a provider returned SOME (not all) fields: a
// Google model whose token limits ARE returned (green) but whose native_tools is
// "unknown — you set it" read "returned IDs only" while the google provider run card
// correctly read "capabilities ✓". These lock the three states so the card can never
// again contradict the provider card + the green per-field fills.
// ─────────────────────────────────────────────────────────────────────────────

/** Run discovery against a caller-supplied diff (the shared RESULT is fixed at 2 new
 *  models; these state tests need one-model-at-a-time control of the provenance mix). */
async function runWith(result: DiscoveryResult) {
  const user = userEvent.setup()
  const onRun = vi.fn().mockResolvedValue(result)
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const view = render(
    <ModelDiscoveryPanel
      onRunDiscovery={onRun}
      onConfirm={onConfirm}
      filterEnabled={false}
      onSetFilter={vi.fn().mockResolvedValue(undefined)}
    />,
  )
  await user.click(screen.getByRole("button", { name: /run discovery/i }))
  await screen.findByText(/propose-only/i)
  return { user, onConfirm, ...view }
}

describe("ModelDiscoveryPanel (071-A) — SC#3 truthful per-model provenance suffix", () => {
  it("test_partial_provenance_not_ids_only — a partial Google model never reads 'returned IDs only'", async () => {
    const { container } = await runWith({
      new: [
        {
          provider: "google",
          model_id: "gemini-3-pro",
          enabled: false,
          // token limits RETURNED (green), native_tools NOT returned (amber) — the mixed case.
          capabilities: { context: 2000000, max_output: 64000, native_tools: DISCOVERY_UNKNOWN },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "google", status: "ok", ok: true }],
    })

    const row = container.querySelector<HTMLElement>('[data-new-model="gemini-3-pro"]')!
    // The lie is gone — the card no longer claims "IDs only" when a field WAS returned…
    expect(within(row).queryByText(/returned IDs only/i)).toBeNull()
    // …nor "full ✓" while native_tools is still unknown.
    expect(within(row).queryByText(/returned full capabilities/i)).toBeNull()
  })

  it("test_full_provenance_reads_full — every field returned → 'returned full capabilities ✓'", async () => {
    const { container } = await runWith({
      new: [
        {
          provider: "openrouter",
          model_id: "z-ai/glm-6",
          enabled: false,
          capabilities: { context: 200000, max_output: 32000, native_tools: true },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "openrouter", status: "ok", ok: true }],
    })

    const row = container.querySelector<HTMLElement>('[data-new-model="z-ai/glm-6"]')!
    expect(within(row).getByText(/returned full capabilities/i)).toBeInTheDocument()
    expect(within(row).queryByText(/returned IDs only/i)).toBeNull()
  })

  it("test_zero_provenance_reads_ids_only — no field returned → 'returned IDs only'", async () => {
    const { container } = await runWith({
      new: [
        {
          provider: "openai",
          model_id: "gpt-5.6-nova",
          enabled: false,
          capabilities: {
            context: DISCOVERY_UNKNOWN,
            max_output: DISCOVERY_UNKNOWN,
            native_tools: DISCOVERY_UNKNOWN,
          },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "openai", status: "ok", ok: true }],
    })

    const row = container.querySelector<HTMLElement>('[data-new-model="gpt-5.6-nova"]')!
    expect(within(row).getByText(/returned IDs only/i)).toBeInTheDocument()
    expect(within(row).queryByText(/returned full capabilities/i)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 159 Plan 06 (MODEL-03 / D-159-04) — the default-on suitability filter.
// The discovery panel hides known non-chat "utility" `new` models by default (with an
// honest hidden-count + a non-destructive "Show all"), persisting the toggle via
// onSetFilter. SC#3 red line (discovery proposes, humans confirm): with opt-in selection,
// NOTHING is added unless the operator ticks it, and "Select all" targets only the VISIBLE
// rows — so the filter can never silently sweep hidden utility models into the confirm payload
// (the add-one-not-all fix). Revealing them via "Show all" then selecting is the explicit path.
// ─────────────────────────────────────────────────────────────────────────────

/** A diff with two utility `new` models (utility:true) + one chat model (utility:false). */
const FILTER_RESULT: DiscoveryResult = {
  new: [
    {
      provider: "openai",
      model_id: "gpt-5.6-chat",
      enabled: false,
      utility: false,
      capabilities: { context: 400000, max_output: 32000, native_tools: true },
    },
    {
      provider: "openai",
      model_id: "text-embedding-4",
      enabled: false,
      utility: true,
      capabilities: {
        context: DISCOVERY_UNKNOWN,
        max_output: DISCOVERY_UNKNOWN,
        native_tools: DISCOVERY_UNKNOWN,
      },
    },
    {
      provider: "openai",
      model_id: "whisper-2",
      enabled: false,
      utility: true,
      capabilities: {
        context: DISCOVERY_UNKNOWN,
        max_output: DISCOVERY_UNKNOWN,
        native_tools: DISCOVERY_UNKNOWN,
      },
    },
  ],
  changed: [],
  vanished: [],
  providers: [{ provider: "openai", status: "ok", ok: true }],
}

async function runFiltered(filterEnabled: boolean, result = FILTER_RESULT) {
  const user = userEvent.setup()
  const onRun = vi.fn().mockResolvedValue(result)
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const onSetFilter = vi.fn().mockResolvedValue(undefined)
  const view = render(
    <ModelDiscoveryPanel
      onRunDiscovery={onRun}
      onConfirm={onConfirm}
      filterEnabled={filterEnabled}
      onSetFilter={onSetFilter}
    />,
  )
  await user.click(screen.getByRole("button", { name: /run discovery/i }))
  await screen.findByText(/propose-only/i)
  return { user, onRun, onConfirm, onSetFilter, ...view }
}

describe("ModelDiscoveryPanel (159) — D-159-04 default-on suitability filter", () => {
  it("hides utility 'new' models by default and shows an honest hidden-count", async () => {
    const { container } = await runFiltered(true)
    // The chat model renders; the two utility models are NOT rendered…
    expect(container.querySelector('[data-new-model="gpt-5.6-chat"]')).not.toBeNull()
    expect(container.querySelector('[data-new-model="text-embedding-4"]')).toBeNull()
    expect(container.querySelector('[data-new-model="whisper-2"]')).toBeNull()
    // …and the honest count names exactly how many were hidden.
    expect(screen.getByText(/2 utility models hidden/i)).toBeInTheDocument()
  })

  it("'Show all' reveals the hidden utility rows WITHOUT changing the persisted default", async () => {
    const { user, onSetFilter, container } = await runFiltered(true)
    await user.click(screen.getByRole("button", { name: /show all/i }))
    expect(container.querySelector('[data-new-model="text-embedding-4"]')).not.toBeNull()
    expect(container.querySelector('[data-new-model="whisper-2"]')).not.toBeNull()
    // The hidden-count line is gone (nothing hidden anymore)…
    expect(screen.queryByText(/utility models hidden/i)).toBeNull()
    // …and the persisted default was NEVER touched (Show all is an ephemeral reveal).
    expect(onSetFilter).not.toHaveBeenCalled()
  })

  it("toggling 'Filter to chat/tool models' persists the new default via onSetFilter(false)", async () => {
    const { user, onSetFilter } = await runFiltered(true)
    await user.click(screen.getByRole("checkbox", { name: /filter to chat\/tool models/i }))
    expect(onSetFilter).toHaveBeenCalledTimes(1)
    expect(onSetFilter).toHaveBeenCalledWith(false)
  })

  it("with the filter off, every 'new' row renders and no hidden-count shows", async () => {
    const { container } = await runFiltered(false)
    expect(container.querySelector('[data-new-model="gpt-5.6-chat"]')).not.toBeNull()
    expect(container.querySelector('[data-new-model="text-embedding-4"]')).not.toBeNull()
    expect(container.querySelector('[data-new-model="whisper-2"]')).not.toBeNull()
    expect(screen.queryByText(/utility models hidden/i)).toBeNull()
  })

  it("opt-in + filter on: 'Select all' confirms only the VISIBLE row — hidden utility models are NOT added (SC#3 honesty)", async () => {
    // Only gpt-5.6-chat is visible (filter on); the two utility models are hidden. Opt-in + a
    // filter-respecting "Select all" means the operator adds exactly what they can see — the
    // add-one-not-all fix: hidden utility rows are never silently swept into the payload.
    const { user, onConfirm } = await runFiltered(true)
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const ids = (onConfirm.mock.calls[0][0] as Array<{ modelId: string }>).map((c) => c.modelId)
    expect(ids).toContain("gpt-5.6-chat")
    expect(ids).not.toContain("text-embedding-4")
    expect(ids).not.toContain("whisper-2")
  })

  it("opt-in + 'Show all' then 'Select all': revealed utility rows ARE confirmable when explicitly chosen", async () => {
    const { user, onConfirm } = await runFiltered(true)
    await user.click(screen.getByRole("button", { name: /show all/i }))
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    const ids = (onConfirm.mock.calls[0][0] as Array<{ modelId: string }>).map((c) => c.modelId)
    expect(ids).toEqual(expect.arrayContaining(["gpt-5.6-chat", "text-embedding-4", "whisper-2"]))
  })

  it("leaves the changed/vanished groups intact (the filter touches only the New group)", async () => {
    const { container } = await runFiltered(true, {
      ...FILTER_RESULT,
      changed: [
        { provider: "openrouter", model_id: "z-ai/glm-6", changes: { context: { from: 128000, to: 200000 } } },
      ],
      vanished: [{ provider: "openai", model_id: "gpt-4-turbo" }],
    })
    // The filter hid the two utility New rows, but changed + vanished render untouched.
    expect(container.querySelector('[data-changed-model="z-ai/glm-6"]')).not.toBeNull()
    expect(container.querySelector('[data-vanished-model="gpt-4-turbo"]')).not.toBeNull()
    expect(screen.getByText(/2 utility models hidden/i)).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 159 (UAT follow-up) — add-one-not-all. Live testing surfaced that the ~400-model
// discovery pull came back ALL pre-selected, so Confirm would add every row. Fix: NEW models
// default UNSELECTED (opt-in); a text search narrows the list; Select all / Clear cover bulk.
// ─────────────────────────────────────────────────────────────────────────────

describe("ModelDiscoveryPanel (159) — add-one-not-all: opt-in + search", () => {
  it("new models start UNSELECTED after a scan — Confirm sends only the accept-by-default changed group", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await runDiscovery(onConfirm)
    // No selection made → new models are NOT in the payload (opt-in); the changed model still is.
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    const ids = (onConfirm.mock.calls[0][0] as Array<{ modelId: string }>).map((c) => c.modelId)
    expect(ids).not.toContain("gemini-3-pro")
    expect(ids).not.toContain("gpt-5.6-nova")
    expect(ids).toContain("z-ai/glm-5.1")
  })

  it("the search box narrows the new list and 'Select all' targets only the matches", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await runDiscovery(onConfirm)
    await user.type(screen.getByRole("textbox", { name: /search new models/i }), "gemini")
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    const ids = (onConfirm.mock.calls[0][0] as Array<{ modelId: string }>).map((c) => c.modelId)
    expect(ids).toContain("gemini-3-pro")
    expect(ids).not.toContain("gpt-5.6-nova")
  })

  it("shows a 'no matches' note when the search matches nothing", async () => {
    const { user } = await runDiscovery()
    await user.type(screen.getByRole("textbox", { name: /search new models/i }), "zzz-nonexistent")
    expect(screen.getByTestId("new-search-empty")).toBeInTheDocument()
  })

  it("'Clear' deselects the new group back to the opt-in baseline", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await runDiscovery(onConfirm)
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /^clear$/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    const ids = (onConfirm.mock.calls[0][0] as Array<{ modelId: string }>).map((c) => c.modelId)
    expect(ids).not.toContain("gemini-3-pro")
    expect(ids).toContain("z-ai/glm-5.1")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 159 Plan 06 (MODEL-03 / D-159-03) — family-default pre-fill (three-way source
// honesty). An un-returned capability with a matching family default pre-fills the amber
// input from `familyDefaults`, styled "default — confirm" — visually distinct from a blank
// "unknown — you set it" (null default) and from a green provider-returned value. CRITICAL
// SC#3: pre-fill makes isComplete true so the operator CAN opt in, but enableNow stays
// default-off, so buildChanges still yields enabled:false until they explicitly tick.
// ─────────────────────────────────────────────────────────────────────────────

/** A new model with ALL capabilities un-returned — the claude family default fills every one. */
const CLAUDE_NEO: DiscoveryResult = {
  new: [
    {
      provider: "anthropic",
      model_id: "claude-neo-1",
      enabled: false,
      capabilities: {
        context: DISCOVERY_UNKNOWN,
        max_output: DISCOVERY_UNKNOWN,
        native_tools: DISCOVERY_UNKNOWN,
      },
    },
  ],
  changed: [],
  vanished: [],
  providers: [{ provider: "anthropic", status: "ok", ok: true }],
}

describe("ModelDiscoveryPanel (159) — D-159-03 family-default pre-fill (three-way source honesty)", () => {
  it("pre-fills an un-returned capability from the family default, labeled 'default — confirm'", async () => {
    const { container } = await runWith(CLAUDE_NEO)
    const row = container.querySelector<HTMLElement>('[data-new-model="claude-neo-1"]')!
    // The claude family default (200k context) pre-fills the amber numeric input…
    expect(within(row).getByRole("spinbutton", { name: /context for claude-neo-1/i })).toHaveValue(200000)
    // …and native_tools pre-fills to "native" (true → native, NEVER "none" — SC#3 by construction).
    expect(within(row).getByRole("combobox", { name: /tools for claude-neo-1/i })).toHaveValue("native")
    // …styled distinctly as "default — confirm" (a reviewed suggestion).
    expect(within(row).getAllByText(/default — confirm/i).length).toBeGreaterThan(0)
  })

  it("keeps a null-default field blank ('unknown — you set it'), distinct from a pre-filled default", async () => {
    const { container } = await runWith({
      new: [
        {
          provider: "openrouter",
          model_id: "acme/opaque-1",
          enabled: false,
          capabilities: {
            context: DISCOVERY_UNKNOWN,
            max_output: DISCOVERY_UNKNOWN,
            native_tools: DISCOVERY_UNKNOWN,
          },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "openrouter", status: "ok", ok: true }],
    })
    const row = container.querySelector<HTMLElement>('[data-new-model="acme/opaque-1"]')!
    // No family default → the input is BLANK and carries NO "default — confirm" marker.
    expect(within(row).getByRole("spinbutton", { name: /context for acme\/opaque-1/i })).toHaveValue(null)
    expect(within(row).queryByText(/default — confirm/i)).toBeNull()
  })

  it("keeps 'Enable now' OFF even when defaults make the model complete — never auto-enabled (SC#3)", async () => {
    await runWith(CLAUDE_NEO)
    const tick = screen.getByRole("checkbox", { name: /enable claude-neo-1 now/i })
    // Complete (all fields pre-filled) → the tick is enable-ABLE…
    expect(tick).not.toBeDisabled()
    // …but NEVER pre-checked — the operator must explicitly opt in.
    expect(tick).not.toBeChecked()
  })

  it("confirms an accepted-but-un-ticked pre-filled model as enabled:false, sending the reviewed values", async () => {
    const { user, onConfirm } = await runWith(CLAUDE_NEO)
    // Opt-in: select the model (but never tick "Enable now").
    await user.click(screen.getByRole("button", { name: /select all/i }))
    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))
    const changes = onConfirm.mock.calls[0][0] as Array<{ modelId: string; patch: Record<string, unknown> }>
    const claude = changes.find((c) => c.modelId === "claude-neo-1")!
    // Pre-fill NEVER auto-enables (enableNow untouched) …
    expect(claude.patch.enabled).toBe(false)
    // … but the reviewed default values ARE sent for the accepted model.
    expect(claude.patch).toMatchObject({ context_window_tokens: 200000, native_tools: true })
  })

  it("shows the 'review the suggested defaults' warning when defaults are pre-filled", async () => {
    const { container } = await runWith(CLAUDE_NEO)
    const row = container.querySelector<HTMLElement>('[data-new-model="claude-neo-1"]')!
    expect(
      within(row).getByText(/review the suggested defaults — it will NOT be auto-enabled/i),
    ).toBeInTheDocument()
    expect(within(row).queryByText(/set the unknown fields/i)).toBeNull()
  })

  it("leaves a provider-confirmed (green) value unchanged — no input, no default marker", async () => {
    const { container } = await runWith({
      new: [
        {
          provider: "google",
          model_id: "gemini-neo",
          enabled: false,
          // context RETURNED (green); max_output un-returned → pre-fills from the google family.
          capabilities: { context: 600000, max_output: DISCOVERY_UNKNOWN, native_tools: DISCOVERY_UNKNOWN },
        },
      ],
      changed: [],
      vanished: [],
      providers: [{ provider: "google", status: "ok", ok: true }],
    })
    const row = container.querySelector<HTMLElement>('[data-new-model="gemini-neo"]')!
    // The returned context is a plain green value — NOT an editable input.
    expect(within(row).queryByRole("spinbutton", { name: /context for gemini-neo/i })).toBeNull()
    expect(within(row).getByText(/600k/i)).toBeInTheDocument()
    // The un-returned max_output DID pre-fill from the google family default (32768).
    expect(within(row).getByRole("spinbutton", { name: /max out for gemini-neo/i })).toHaveValue(32768)
  })
})
