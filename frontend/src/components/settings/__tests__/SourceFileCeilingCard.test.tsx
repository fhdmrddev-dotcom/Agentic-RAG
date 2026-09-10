/**
 * SEED-258 (Phase 239-10) — the source file-size ceiling becomes reachable AND legible.
 *
 * ⭐ WHAT THIS SUITE IS FOR, because a weaker version of it would pass over the defect.
 *
 * Phase 239-09 shipped the whole backend: `app_settings.source_max_file_size_mb`, bounded
 * 1..50, served with its bounds, refused out-of-range with a sentence that says what raising
 * it costs. **None of that is reachable by a person**, which is the half SEED-258's headline
 * requirement actually depends on:
 *
 *   > *"the problem was never the number"* — SEED-258
 *   > *"this should be dynamic in the settings somewhere WITH INFORMATION ON IT AND
 *   >  RECOMMENDATIONS"* — the operator, verbatim
 *
 * ⛔ **A bare number input FAILS this task**, and SEED-258's own "answered badly" list names
 * it: *"A knob is exposed with no statement of what raising it costs — the original defect,
 * now clickable."* So these cases assert the rendered **CONTENT**, never block presence.
 *
 * ⚠ THAT DISTINCTION IS THIS PROJECT'S OWN FINDING, not a style preference. Phase 235
 * measured a green fence sitting beside a shipped defect because it asserted block PRESENCE
 * by `data-testid` while the content drifted underneath it. **Here the words ARE the
 * deliverable**, so a case that only proved "a spinbutton exists" would pass over a control
 * with no explanation — precisely the failure mode.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SourceFileCeilingCard } from "../SourceFileCeilingCard"

/**
 * ⚠ NON-DEFAULT BOUNDS ON PURPOSE — this fixture is a fence, not a convenience.
 *
 * The backend SERVES `source_max_file_size_mb_floor` / `_ceiling` specifically so the form
 * does not re-type them (`api/settings.py:79`: *"a form carrying its own copy of `50` is a
 * fourth private constant, which is the defect this replaced"*). Rendering with 1/50 would
 * be indifferent to a card that ignored the props and hardcoded the shipped numbers — the
 * assertions would pass either way. **3 and 44 can only appear on screen if the props are
 * the source**, which is the property under test.
 */
const SERVED = { floor: 3, ceiling: 44 } as const

function renderCard(props: Partial<React.ComponentProps<typeof SourceFileCeilingCard>> = {}) {
  return render(
    <SourceFileCeilingCard
      value={25}
      floor={SERVED.floor}
      ceiling={SERVED.ceiling}
      onChange={() => {}}
      {...props}
    />,
  )
}

/** Every visible string in the card, flattened — content assertions read this. */
function visibleText(): string {
  return document.body.textContent ?? ""
}

describe("SourceFileCeilingCard — the value, and why", () => {
  it("renders the STORED value in the input rather than a blank or a default", async () => {
    // HI-02, from this same phase: a control that renders blank over a stored value turns
    // "open the page and press Save" into a silent wipe. 37 is neither the shipped default
    // (25) nor either bound, so only the prop can produce it.
    renderCard({ value: 37 })

    const input = await screen.findByRole("spinbutton")
    expect(input).toHaveValue(37)
  })

  it("says the limit applies to EVERY connected source, not one vendor", () => {
    // SEED-258: "State the current value, that it applies to every connected source".
    // The knob is one setting read by three adapters (google_drive, microsoft_graph,
    // mcp_source) — copy naming only Drive would misdescribe what the operator is changing.
    renderCard()

    const text = visibleText()
    expect(text).toMatch(/every connected source/i)
    expect(text).toMatch(/Google Drive/)
    expect(text).toMatch(/MCP/)
  })

  it("states what RAISING it costs — the sentence the whole seed exists for", () => {
    // ⭐ SEED-258, verbatim: "what raising it costs: more memory buffered per in-flight
    // request from a server we do not control". Without this the control is the constant
    // again, only clickable.
    renderCard()

    const text = visibleText()
    expect(text).toMatch(/memory/i)
    expect(text).toMatch(/server we do not control/i)
  })

  it("carries a RECOMMENDATION beside the tradeoff, with a number in it", () => {
    // The operator asked for "recommendations". A recommendation with no number is not one.
    renderCard()

    const text = visibleText()
    expect(text).toMatch(/Recommended/i)
    expect(text).toMatch(/25 MB/)
    expect(text).toMatch(/most document workloads/i)
  })

  it("states the BOUNDS from the SERVED numbers, so 3 and 44 are not discovered by refusal", () => {
    // Two properties in one case, and the second is the fence: the bounds are stated
    // (not learned from a 400), AND they are the served ones.
    renderCard()

    const text = visibleText()
    expect(text).toContain(String(SERVED.floor))
    expect(text).toContain(String(SERVED.ceiling))
  })

  it("⛔ carries NO private copy of the shipped 1/50 bounds", () => {
    // The negative half of the case above. If the card re-typed the shipped ceiling, "50"
    // would appear on screen even though the server said 44 — a fourth private constant,
    // the exact defect 239-09 removed from three Python files.
    renderCard()

    expect(visibleText()).not.toContain("50 MB")
  })

  it("passes the served bounds to the input as min/max — a guide, never the boundary", () => {
    // The input may GUIDE. It must not be the only thing stopping an out-of-range value:
    // the API refuses and a backend test pins that. min/max here is affordance, and the
    // page surfaces the server's refusal verbatim (asserted in the SettingsPage suite).
    renderCard()

    const input = screen.getByRole("spinbutton")
    expect(input).toHaveAttribute("min", String(SERVED.floor))
    expect(input).toHaveAttribute("max", String(SERVED.ceiling))
  })

  it("reports edits as a NUMBER to its owner", async () => {
    const onChange = vi.fn()
    renderCard({ value: 25, onChange })

    const input = await screen.findByRole("spinbutton")
    await userEvent.clear(input)
    await userEvent.type(input, "30")

    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(typeof last).toBe("number")
  })
})

describe("SourceFileCeilingCard — ⛔ there is ONE knob and there must never be a second", () => {
  /**
   * SEED-258's FIRST named way of answering this badly:
   *
   *   > *"Two fields appear (file size AND envelope size) — the original defect, now
   *   >  user-operable."*
   *
   * The MCP JSON-RPC envelope cap is DERIVED server-side (`ceiling x 4/3` + 1 MB headroom).
   * A backend test already asserts no `*_body_bytes` / `*_envelope` field can exist on the
   * settings model; this is the surface half of that same fence.
   */
  it("renders exactly ONE editable number — the file size", () => {
    renderCard()
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1)
  })

  it("does not offer the envelope / body-bytes cap as an editable value", () => {
    renderCard()

    const text = visibleText()
    expect(text).not.toMatch(/body[ _-]?bytes/i)
    expect(text).not.toMatch(/envelope size/i)
  })

  it("may EXPLAIN that the transport limit follows automatically — explaining is not exposing", () => {
    // Deliberately asserting the honest half: the operator should learn that raising this
    // one number moves the transport cap too, WITHOUT being handed a second control. This
    // case would fail if the explanation were dropped in an over-zealous reading of the
    // "no second field" rule.
    renderCard()
    expect(visibleText()).toMatch(/never a second setting|follows this number/i)
  })
})
