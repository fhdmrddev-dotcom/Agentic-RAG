/**
 * Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §6, D-12) — ProviderKeyStep contract.
 *
 * Locks the provider-key rules:
 *   • REUSES the shipped ProviderPicker (the "Default assistant model" select) — no
 *     second copy;
 *   • exactly ONE required MASKED key (Eye/EyeOff) — Continue is gated until it is
 *     non-empty;
 *   • the "We'll verify this key in the next step." note;
 *   • other providers render as NEUTRAL "Not configured" optional rows (never red);
 *   • on Continue the token-gated postProviderKey persists {provider, api_key} then
 *     advances.
 */
import { useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ProviderKeyStep } from "../ProviderKeyStep"
import { type ProviderPickerValue } from "@/components/settings/ProviderPicker"
import { postProviderKey } from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postProviderKey: vi.fn() }
})

const OPENAI: ProviderPickerValue = {
  provider: "openai",
  model: "gpt-5.4-mini",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  dimensions: 0,
  threshold: 0,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({ onContinue }: { onContinue?: () => void }) {
  const [value, setValue] = useState<ProviderPickerValue>(OPENAI)
  return (
    <ProviderKeyStep token="tok" value={value} onChange={setValue} onContinue={onContinue ?? (() => {})} />
  )
}

describe("ProviderKeyStep (D-12) — one required masked key, ProviderPicker reused", () => {
  it("reuses the ProviderPicker (default-LLM select) and shows the verify-next note", () => {
    render(<Harness />)
    // The reused ProviderPicker renders its "Default assistant model" heading + preset select.
    expect(screen.getByText(/default assistant model/i)).toBeInTheDocument()
    expect(screen.getByText(/verify this key in the next step/i)).toBeInTheDocument()
  })

  it("requires a single masked key with an Eye/EyeOff reveal, gating Continue until present", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const key = screen.getByLabelText("API key")
    expect(key).toHaveAttribute("type", "password")
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled()

    await user.type(key, "sk-test-123")
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: /show api key/i }))
    expect(key).toHaveAttribute("type", "text")
  })

  it("lists other providers as NEUTRAL 'Not configured' optional rows (never red)", () => {
    render(<Harness />)
    const notConfigured = screen.getAllByText(/not configured/i)
    expect(notConfigured.length).toBeGreaterThanOrEqual(1)
    // The chip is muted/neutral, never destructive.
    notConfigured.forEach((el) => expect(el.className).not.toContain("destructive"))
  })

  it("persists {provider, api_key} via postProviderKey then advances", async () => {
    const user = userEvent.setup()
    vi.mocked(postProviderKey).mockResolvedValue({ ok: true })
    const onContinue = vi.fn()
    render(<Harness onContinue={onContinue} />)

    await user.type(screen.getByLabelText("API key"), "sk-live-abc")
    await user.click(screen.getByRole("button", { name: /^continue$/i }))

    await waitFor(() =>
      expect(postProviderKey).toHaveBeenCalledWith("tok", { provider: "openai", api_key: "sk-live-abc" }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
