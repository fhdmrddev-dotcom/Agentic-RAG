/**
 * Phase 268 (UI-SPEC §5.8, D-268-09, D-268-11) — the two Blind Spots tiles. Neither has a
 * button: no filter lands on their population (the shipped CR-06 "no button, deliberately").
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { AttributionDisclosures } from "../AttributionDisclosures"
import { EXPERT_SPEND_COPY as C } from "../expertSpendCopy"

afterEach(cleanup)

describe("AttributionDisclosures", () => {
  it("says sub-agent tokens are now counted, and where to see it", () => {
    render(<AttributionDisclosures />)
    const tile = screen.getByTestId("blind-spot-subagent")
    expect(within(tile).getByText(C.subagentTile.title)).toBeVisible()
    expect(within(tile).getByText(C.subagentTile.body)).toBeVisible()
    expect(within(tile).getByText(C.subagentTile.footer)).toBeVisible()
    expect(within(tile).queryByRole("button")).not.toBeInTheDocument()
  })

  it("discloses the unmetered handoff summary call (D-268-11)", () => {
    render(<AttributionDisclosures />)
    const tile = screen.getByTestId("blind-spot-handoff")
    expect(within(tile).getByText(C.handoffTile.title)).toBeVisible()
    expect(within(tile).getByText(C.handoffTile.body)).toBeVisible()
    const footer = within(tile).getByText("Not metered yet")
    expect(footer).toBeVisible()
    expect(footer.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-amber-700", "dark:text-amber-300"]))
    expect(within(tile).queryByRole("button")).not.toBeInTheDocument()
  })
})
