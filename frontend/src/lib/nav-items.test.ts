import { describe, it, expect } from "vitest"
import { NAV_ITEMS } from "./nav-items"

// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 (ADMIN-01 / D-07) — the NAV_ITEMS byte-identity regression lock.
//
// D-07 contract: the operator Control Room is NON-DISCOVERABLE. The shield entry
// renders OUTSIDE the shared NAV_ITEMS array (probe-gated, in the NavPanel footer +
// the mobile drawer) so a non-operator's nav is byte-identical to today.
//
// RESEARCH anti-pattern this test locks out: "Adding the shield to NAV_ITEMS shows
// it to everyone." NAV_ITEMS is consumed by BOTH the desktop rail (NavPanel) AND the
// mobile drawer (ChatLayout) — any control-room entry in the array would leak the
// surface's existence to every user, on both surfaces. This test fails the build if
// anyone ever adds one.
// ─────────────────────────────────────────────────────────────────────────────
describe("NAV_ITEMS — D-07 non-discoverability contract", () => {
  it("carries no control-room view entry", () => {
    expect(NAV_ITEMS.some((item) => item.view === "control-room")).toBe(false)
  })

  it("carries no 'Control Room' label", () => {
    expect(NAV_ITEMS.some((item) => item.label.includes("Control Room"))).toBe(false)
  })
})
