/**
 * Phase 155 Plan 05 Task 2 — ModelDiscoveryPanel a11y contract (WCAG 2.1 AA / D-01, D-05).
 *
 * The 071-A propose→confirm panel is a PURE PRESENTATIONAL LEAF (props in, DOM out; the
 * shell owns the api calls). Its honest states are idle, running (the in-flight timer),
 * done (the ephemeral diff), and a run failure. This suite locks the D-12
 * zero-STRUCTURAL-violations bar across those states plus:
 *   - the loading + error honest-state role vocabulary (running → role="status",
 *     run failure → role="alert");
 *   - the propose→confirm controls are reachable by role + accessible NAME — the accept
 *     tick + enable-now checkbox ("Accept <id>" / "Enable <id> now"), the amber
 *     "unknown — you set it" inputs (role="spinbutton" / role="combobox" per field), and
 *     the vanished-model decision buttons;
 *   - the provider brand icons are DECORATIVE (no unnamed role="img") — the meaningful
 *     name lives on the enclosing run-card text (the Phase-127 icon convention).
 *
 * STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { ModelDiscoveryPanel } from "../ModelDiscoveryPanel"
import { DISCOVERY_UNKNOWN, type DiscoveryResult } from "@/lib/api"

/** A representative diff exercising the SC#3 provider matrix: Google returns token limits
 *  but NOT native_tools (amber input); OpenAI returns IDs only; OpenRouter returns a
 *  change; a vanished model is flagged; providers span ok / rate-limited / no-key. */
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

function assertIconsDecorativeOrLabeled(container: HTMLElement) {
  const imgRoleSvgs = Array.from(container.querySelectorAll("svg")).filter((s) =>
    ["img", "graphics-document", "graphics-symbol"].includes(s.getAttribute("role") ?? ""),
  )
  for (const svg of imgRoleSvgs) {
    const named =
      svg.hasAttribute("aria-label") ||
      svg.hasAttribute("aria-labelledby") ||
      svg.querySelector("title") != null
    expect(named).toBe(true)
  }
}

/** Render + run discovery to the resolved diff (the "done" honest state). */
async function runToDone(onConfirm = vi.fn().mockResolvedValue(undefined)) {
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
  await screen.findByText(/propose-only/i)
  return { user, ...view }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ModelDiscoveryPanel a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — idle (the Run discovery entry point)", async () => {
    const { container } = render(
      <ModelDiscoveryPanel
        onRunDiscovery={vi.fn().mockResolvedValue(RESULT)}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        filterEnabled={false}
        onSetFilter={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await screen.findByRole("button", { name: /run discovery/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — running (the in-flight timer)", async () => {
    const user = userEvent.setup()
    let resolveRun!: (r: DiscoveryResult) => void
    const onRun = vi.fn(() => new Promise<DiscoveryResult>((r) => { resolveRun = r }))
    const { container } = render(
      <ModelDiscoveryPanel
        onRunDiscovery={onRun}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        filterEnabled={false}
        onSetFilter={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await user.click(screen.getByRole("button", { name: /run discovery/i }))
    await screen.findByRole("status")
    expect(await axe(container)).toHaveNoViolations()
    // Settle the run so no interval fires outside act.
    resolveRun(RESULT)
    await screen.findByText(/propose-only/i)
  })

  it("no aXe structural violations — done (the ephemeral propose-only diff)", async () => {
    const { container } = await runToDone()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("ModelDiscoveryPanel a11y — loading + error honest-state roles", () => {
  it("the in-flight run announces itself via role=status", async () => {
    const user = userEvent.setup()
    let resolveRun!: (r: DiscoveryResult) => void
    const onRun = vi.fn(() => new Promise<DiscoveryResult>((r) => { resolveRun = r }))
    render(
      <ModelDiscoveryPanel
        onRunDiscovery={onRun}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        filterEnabled={false}
        onSetFilter={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await user.click(screen.getByRole("button", { name: /run discovery/i }))
    expect(await screen.findByRole("status")).toHaveTextContent(/querying providers/i)
    resolveRun(RESULT)
    await screen.findByText(/propose-only/i)
  })

  it("a failed discovery run is announced via role=alert (never a silent failure)", async () => {
    const user = userEvent.setup()
    const onRun = vi.fn().mockRejectedValue(new Error("boom"))
    render(
      <ModelDiscoveryPanel
        onRunDiscovery={onRun}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        filterEnabled={false}
        onSetFilter={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await user.click(screen.getByRole("button", { name: /run discovery/i }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/couldn.t run discovery/i)
  })
})

describe("ModelDiscoveryPanel a11y — D-05 propose→confirm controls (role + name)", () => {
  it("the accept tick + enable-now checkbox are reachable by role + accessible name", async () => {
    const { container } = await runToDone()
    const geminiRow = container.querySelector<HTMLElement>('[data-new-model="gemini-3-pro"]')!
    expect(within(geminiRow).getByRole("checkbox", { name: /accept gemini-3-pro/i })).toBeInTheDocument()
    expect(within(geminiRow).getByRole("checkbox", { name: /enable gemini-3-pro now/i })).toBeInTheDocument()
  })

  it("the amber 'unknown — you set it' fields are named inputs (spinbutton / combobox)", async () => {
    const { container } = await runToDone()
    // Google did NOT return native_tools → an amber select (combobox) named for the field…
    const geminiRow = container.querySelector<HTMLElement>('[data-new-model="gemini-3-pro"]')!
    expect(within(geminiRow).getByRole("combobox", { name: /tools for gemini-3-pro/i })).toBeInTheDocument()
    // …and an IDs-only model exposes named numeric inputs for every un-returned field.
    const novaRow = container.querySelector<HTMLElement>('[data-new-model="gpt-5.6-nova"]')!
    expect(within(novaRow).getByRole("spinbutton", { name: /context for gpt-5\.6-nova/i })).toBeInTheDocument()
  })

  it("vanished models expose named decision buttons (deprecate / disable / keep — never a delete)", async () => {
    const { container } = await runToDone()
    const van = container.querySelector<HTMLElement>('[data-vanished-model="gpt-4-turbo"]')!
    expect(within(van).getByRole("button", { name: /mark deprecated/i })).toBeInTheDocument()
    expect(within(van).getByRole("button", { name: /^disable$/i })).toBeInTheDocument()
    expect(within(van).getByRole("button", { name: /keep as-is/i })).toBeInTheDocument()
  })

  it("the provider brand icons are decorative-or-labeled (no unnamed image-role SVG)", async () => {
    const { container } = await runToDone()
    // The @lobehub marks ship a `<title>` (e.g. "OpenAI") — LABELED, not unnamed — and
    // carry no img role, so axe's svg-img-alt correctly ignores them; the helper confirms
    // no image-role SVG is left unnamed.
    assertIconsDecorativeOrLabeled(container)
    // The visible provider identity is the run-card text (exact lowercase match avoids the
    // capitalised `<title>` inside the mark).
    const openaiCard = container.querySelector<HTMLElement>('[data-provider="openai"]')!
    expect(within(openaiCard).getByText("openai")).toBeInTheDocument()
  })
})
