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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 262 plan 05 (PACK-11 / D-262-03) — the catalog's entry action.
//
// The reachability triad's third leg. A union member and a render branch are both
// invisible without a door, and Phase 257 proved the gap is real rather than
// theoretical: it shipped the spend cockpit with both of those and NO entry, so the
// only way in was typing a URL. The member and the branch are fenced by
// `lib/activeViewReachability.ts`; THIS is the leg that fence cannot see.
//
// ⛔ The array — not the rail — is what is pinned here, because `ChatLayout`'s mobile
// drawer maps the SAME array. An entry proven only on the desktop rail would leave the
// catalog desktop-only and the criterion would be closed against its own sentence.
// ─────────────────────────────────────────────────────────────────────────────
describe("NAV_ITEMS — the Expert catalog entry (Phase 262 / PACK-11)", () => {
  it("carries an experts entry, so the catalog has a door at all", () => {
    expect(NAV_ITEMS.some((item) => item.view === "experts")).toBe(true)
  })

  it("that entry is UNGOVERNED — no `feature` key (D-262-09 re-aimed)", () => {
    // `experts` is a per-ORG TIER entitlement, not a `GovernedFeature`. A tag here would
    // govern the wrong axis and could not prevent the 403 it appears to prevent; the API
    // is the wall and the catalog renders the server's refusal. Precedent: `connections`.
    const entry = NAV_ITEMS.find((item) => item.view === "experts")
    expect(entry).toBeDefined()
    expect(entry?.feature).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(entry ?? {}, "feature")).toBe(false)
  })

  it("is the EIGHTH entry — the count is recorded because a register corrected with a wrong number is the rot repeating", () => {
    // RESEARCH R-6 measured SEVEN before this phase. The operator shield and the Spend
    // entry render OUTSIDE this array, so the rail shows ten affordances and the array
    // holds eight; "three homes → four" is neither of those numbers.
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(8)
  })
})
