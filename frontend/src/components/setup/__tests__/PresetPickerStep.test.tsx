/**
 * Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §3, D-09) — PresetPickerStep contract.
 *
 * Locks the preset-pick rules:
 *   • a real role="radiogroup" with three role="radio" cards;
 *   • one-box is the prominent "Recommended" card, selected by DEFAULT (aria-checked);
 *   • arrow keys move selection (ARIA radiogroup semantics — Phase 155 AA bar);
 *   • aria-checked reflects the selection — never colour-alone;
 *   • selecting Managed/On-prem shows an inline honesty banner linking the matching
 *     OPERATOR.md variant section (they pre-fill + link, not a multi-preset engine);
 *   • Continue emits onContinue.
 */
import { useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PresetPickerStep, type SetupPreset } from "../PresetPickerStep"

afterEach(() => cleanup())

/** A stateful harness so arrow-key selection re-renders with the new value. */
function Harness({ onChange, onContinue }: { onChange?: (p: SetupPreset) => void; onContinue?: () => void }) {
  const [value, setValue] = useState<SetupPreset>("onebox")
  return (
    <PresetPickerStep
      value={value}
      onChange={(p) => {
        setValue(p)
        onChange?.(p)
      }}
      onContinue={onContinue ?? (() => {})}
    />
  )
}

describe("PresetPickerStep (D-09) — one-box-default radiogroup", () => {
  it("renders a radiogroup with three radios; one-box is Recommended + checked by default", () => {
    render(<Harness />)
    const group = screen.getByRole("radiogroup", { name: /deployment preset/i })
    const radios = within(group).getAllByRole("radio")
    expect(radios).toHaveLength(3)

    const oneBox = screen.getByRole("radio", { name: /one-box self-host/i })
    expect(oneBox).toHaveAttribute("aria-checked", "true")
    // The prominent "Recommended" default marker sits on the one-box card.
    expect(within(oneBox).getByText(/recommended/i)).toBeInTheDocument()
    // The secondary cards start unchecked.
    expect(screen.getByRole("radio", { name: /managed/i })).toHaveAttribute("aria-checked", "false")
  })

  it("arrow keys move the selection (ARIA radiogroup semantics)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const oneBox = screen.getByRole("radio", { name: /one-box self-host/i })
    oneBox.focus()
    await user.keyboard("{ArrowDown}")

    expect(onChange).toHaveBeenCalledWith("managed")
    expect(screen.getByRole("radio", { name: /managed/i })).toHaveAttribute("aria-checked", "true")
    expect(oneBox).toHaveAttribute("aria-checked", "false")
  })

  it("selecting Managed shows the honesty banner linking the OPERATOR.md variant section", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("radio", { name: /managed/i }))

    // The banner announces the pre-fill-not-engine honesty + links the runbook variant.
    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent(/one-box is the only fully guided path/i)
    const link = within(banner).getByRole("link", { name: /home a — managed saas/i })
    expect(link).toHaveAttribute("data-runbook-section", "Home A — managed SaaS")
  })

  it("Continue emits onContinue", async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(<Harness onContinue={onContinue} />)

    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
