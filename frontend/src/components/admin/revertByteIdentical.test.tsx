/**
 * Phase 181 Plan 02 (REVERT-01 / REVERT-02, D-181-03/D-181-06) — the FRONTEND half of the
 * byte-identical revert acceptance gate. Rides the existing `frontend-tests.yml` (`npm test`)
 * — NO new CI job (REVERT-02).
 *
 * Two locks:
 *   1. NAV-SET PARITY (REVERT-01): adding `visual_workflow_canvas` to the effective map
 *      leaves `visibleNavItems(...)` byte-identical to today, because NO `NAV_ITEMS` entry
 *      is tagged `visual_workflow_canvas`. Phase 183 SHIPPED the canvas as an in-Builder
 *      `[≣ Spine] [⬡ Canvas]` view toggle on `WorkflowBuilderPage`'s existing graph column
 *      (D-183-01) — the app has no router, so no nav entry was ever needed. That formally
 *      released the 181 note which had deferred such an entry to this phase, and it makes
 *      the scope-freeze guard below a PERMANENT invariant rather than a temporary one.
 *      (Worded WITHOUT quoting the released sentence: this phase's acceptance greps for
 *      that literal, and a guard that only passes by making a comment lie is a broken
 *      guard — the recurring D-ITEM-183-02 trap.)
 *   2. THE Off|On OPERATOR CONTROL (D-181-03): the `visual_workflow_canvas` row in the
 *      reused `FeatureVisibility` card exposes EXACTLY a two-position Off | On control (two
 *      radios, never the Everyone|Operators|By-role triad), On writes audience `"everyone"`
 *      and Off writes `"off"`.
 *
 * DEFERRED (D-181 Claude's-discretion): the `ChatLayout` render-guard vitest — a stale
 * canvas `activeView` must return the fallback (never the canvas) when the map is off — was
 * intentionally NOT present here, because it had to land WITH the first canvas `ActiveView`
 * render branch and there was no canvas view to guard in 181.
 *
 * ✅ NO LONGER DEFERRED. Phase 188 mounted that first branch (`"workflow-run"`, the run's
 * own room) and shipped it UNGATED, which is exactly the hole this note anticipated: with
 * the map off, launching landed on a home that did not exist before the canvas was built
 * and then blamed the user's account for the operator's kill switch. The guard now lives in
 * `components/layout/ChatLayout.launch.test.tsx` — beside the launch-path harness it needs
 * and inside the count gate's blast radius — and covers BOTH halves (the navigation and the
 * render), because gating only the render would strand a launch on the fallback. It is
 * recorded here rather than moved here so the 181 promise and its discharge stay in one
 * reading.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, cleanup, within, fireEvent, waitFor } from "@testing-library/react"

import { NAV_ITEMS, visibleNavItems } from "@/lib/nav-items"
import { FeatureVisibility } from "./FeatureVisibility"
import type { EffectiveFeatures, FeatureAudience, GovernedFeature } from "@/lib/api"

afterEach(() => {
  cleanup()
})

// Every EXISTING nav-tagged governed feature resolved true → the full nav set renders.
// The canvas key is deliberately absent here (it is added per-assert below).
const ALL_NAV_FEATURES_TRUE: EffectiveFeatures = {
  skill_studio: true,
  model_management: true,
  workflow_authoring: true,
  governance_health: true,
}

describe("revert byte-identity — nav-set parity (REVERT-01)", () => {
  it("adding visual_workflow_canvas:false leaves visibleNavItems byte-identical", () => {
    const baseline = visibleNavItems(ALL_NAV_FEATURES_TRUE)
    const withCanvasOff = visibleNavItems({
      ...ALL_NAV_FEATURES_TRUE,
      visual_workflow_canvas: false,
    })
    expect(withCanvasOff).toEqual(baseline)
  })

  it("adding visual_workflow_canvas:true ALSO changes nothing (no canvas nav entry exists yet)", () => {
    const baseline = visibleNavItems(ALL_NAV_FEATURES_TRUE)
    const withCanvasOn = visibleNavItems({
      ...ALL_NAV_FEATURES_TRUE,
      visual_workflow_canvas: true,
    })
    // No canvas nav entry exists or ever will — 183 shipped the canvas as an in-Builder
    // view toggle (D-183-01), so ON reveals nothing here (byte-identical) by design.
    expect(withCanvasOn).toEqual(baseline)
  })

  it("no NAV_ITEMS entry is tagged visual_workflow_canvas (scope-freeze guard)", () => {
    expect(NAV_ITEMS.some((item) => item.feature === "visual_workflow_canvas")).toBe(false)
  })
})

// A full audience map for the card render. The canvas audience is set per-test so we can
// exercise both the Off-selected and On-selected states of the two-position control.
function visibilityWith(
  canvas: FeatureAudience,
): Record<GovernedFeature, FeatureAudience> {
  return {
    skill_studio: "operators",
    model_management: "operators",
    workflow_authoring: "everyone",
    governance_health: "everyone",
    visual_workflow_canvas: canvas,
    live_connectors: "off",
  }
}

function canvasCard(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-feature="visual_workflow_canvas"]')!
}

describe("revert byte-identity — the Off|On operator control (D-181-03)", () => {
  it("the visual_workflow_canvas row exposes EXACTLY two radios (Off, On), not the triad", () => {
    const { container } = render(
      <FeatureVisibility
        visibility={visibilityWith("off")}
        onSetVisibility={vi.fn().mockResolvedValue(undefined)}
        showTechnical={false}
      />,
    )
    const group = within(canvasCard(container)).getByRole("radiogroup", { name: /audience/i })
    const radios = within(group).getAllByRole("radio")
    expect(radios).toHaveLength(2)
    expect(within(group).getByRole("radio", { name: /^off$/i })).toBeInTheDocument()
    expect(within(group).getByRole("radio", { name: /^on$/i })).toBeInTheDocument()
    // The triad labels must NOT appear on this row.
    expect(within(group).queryByRole("radio", { name: /operators only/i })).toBeNull()
    expect(within(group).queryByRole("radio", { name: /by role/i })).toBeNull()
  })

  it("Off is checked when audience is 'off' (byte-identical cold default)", () => {
    const { container } = render(
      <FeatureVisibility
        visibility={visibilityWith("off")}
        onSetVisibility={vi.fn().mockResolvedValue(undefined)}
        showTechnical={false}
      />,
    )
    const group = within(canvasCard(container)).getByRole("radiogroup", { name: /audience/i })
    expect(within(group).getByRole("radio", { name: /^off$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(within(group).getByRole("radio", { name: /^on$/i })).toHaveAttribute(
      "aria-checked",
      "false",
    )
  })

  it("clicking On (from Off) writes audience 'everyone' for the canvas key", async () => {
    const onSetVisibility = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <FeatureVisibility
        visibility={visibilityWith("off")}
        onSetVisibility={onSetVisibility}
        showTechnical={false}
      />,
    )
    const group = within(canvasCard(container)).getByRole("radiogroup", { name: /audience/i })
    fireEvent.click(within(group).getByRole("radio", { name: /^on$/i }))
    await waitFor(() =>
      expect(onSetVisibility).toHaveBeenCalledWith("visual_workflow_canvas", "everyone", []),
    )
  })

  it("clicking Off (from On) writes audience 'off' — the master switch (hidden from everyone)", async () => {
    const onSetVisibility = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <FeatureVisibility
        visibility={visibilityWith("everyone")}
        onSetVisibility={onSetVisibility}
        showTechnical={false}
      />,
    )
    const group = within(canvasCard(container)).getByRole("radiogroup", { name: /audience/i })
    fireEvent.click(within(group).getByRole("radio", { name: /^off$/i }))
    await waitFor(() =>
      expect(onSetVisibility).toHaveBeenCalledWith("visual_workflow_canvas", "off", []),
    )
  })
})
