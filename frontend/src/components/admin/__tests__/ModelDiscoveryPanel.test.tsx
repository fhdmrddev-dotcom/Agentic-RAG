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
  const view = render(<ModelDiscoveryPanel onRunDiscovery={onRun} onConfirm={onConfirm} />)
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

  it("disables the 'enable now' tick for a new model with unknown capabilities (never auto-enabled)", async () => {
    await runDiscovery()
    // gpt-5.6-nova is IDs-only with nothing filled → cannot be enabled.
    const tick = screen.getByRole("checkbox", { name: /enable gpt-5\.6-nova now/i })
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

  it("confirming routes the chosen changes through onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await runDiscovery(onConfirm)

    await user.click(screen.getByRole("button", { name: /apply confirmed changes/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const changes = onConfirm.mock.calls[0][0] as Array<{ modelId: string }>
    // New + changed default to accepted → at least the two new models + the changed one.
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
  const view = render(<ModelDiscoveryPanel onRunDiscovery={onRun} onConfirm={onConfirm} />)
  await user.click(screen.getByRole("button", { name: /run discovery/i }))
  await screen.findByText(/propose-only/i)
  return { user, ...view }
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
