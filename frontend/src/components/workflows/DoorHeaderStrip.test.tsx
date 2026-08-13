/**
 * Phase 193-03 Task 2 (D-05 / D-24(b)) — the extracted door header strip's own suite.
 *
 * TWO CONCERNS, and they are different KINDS of proof:
 *
 * 1. D-05 — ONE COMPONENT SERVES BOTH HEADER VARIANTS. The strip renders twice today: as this
 *    door's own bordered band (standalone) and inside the Builder's merged header row as
 *    `headerTrail` (`inline`). The whole risk of the 193-03 extraction is the `ml-auto` class
 *    that is already conditional on `inline` — dropped inline because `BuilderHeaderBar.tsx:53`
 *    already wraps `trail` in an `ml-auto` group, kept standalone because it is what pushes the
 *    judge badge to the far edge. Both branches are asserted here FROM THE RENDERED NODE.
 *
 *    ⚠ AND THE STANDALONE CLASS STRING IS NOT RE-TYPED. It is READ OUT OF
 *    `WorkflowBuilderPage.header.test.tsx`'s byte-exact band literal — a nine-phase-old capture
 *    of the shipped markup — through Vite's `?raw` loader, so the two guards provably agree
 *    rather than agreeing by the care of whoever typed the second one. A hand-typed copy is a
 *    second literal, and two literals drift.
 *
 * 2. D-24(b) — THE ESM-CYCLE FENCE. `WorkflowDoorSwitch` imports THIS component's VALUE at
 *    module scope, so an import back would close a live cycle that typechecks clean, lints
 *    clean and fails only at RUNTIME as a TDZ `ReferenceError` in whichever module a caller
 *    reaches first (188.1's finding on `WorkflowCanvas`, ported here). Nothing in the build can
 *    see that, so the constraint is spelled as an assertion over the module's own source.
 *
 * ⚠ THE SHAPE ASSERTED HERE IS TODAY'S, NOT THE D-04 RESTACK'S. This plan is a PURE MOVE: zero
 * user-visible text changed and no element added. The restack (a demoted return control and a
 * divider) lands in a later wave and will legitimately change the child COUNT below — that is
 * the point of pinning the count now, so the restack has to state its change rather than
 * absorb it.
 *
 * ⚠ NO `doorVocabulary` LEG IS SWEPT HERE, DELIBERATELY. That module does not exist yet
 * (`193-05` adds it), and `import.meta.glob` contributes the EMPTY STRING for an absent path
 * and never throws — the 192.1 E-2 finding, where a fence swept against the empty string passed
 * green while defending nothing. A fence is added when its subject exists, with its own
 * non-vacuity guard.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// The module SOURCES via Vite's `?raw` loader — the idiomatic vitest way to make an
// IMPORT-GRAPH constraint checkable. No rendered DOM can see an import graph.
import doorHeaderStripSource from "./DoorHeaderStrip?raw"
import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"
// The nine-phase-old byte-exact band literal, read as TEXT so the class string below is the
// one that suite holds rather than a copy of it.
import headerSuiteSource from "@/pages/WorkflowBuilderPage.header.test?raw"

import { DoorHeaderStrip } from "./DoorHeaderStrip"

/**
 * The judge badge's class attribute AS CAPTURED in `WorkflowBuilderPage.header.test.tsx`'s
 * `FLAG_OFF_HEADER_MARKUP` (its band literal, `:304` at the time of writing — located by
 * CONTENT here, never by line number). `[^>]*?` crosses the `title=` attribute, which contains
 * no `>`; the suite's other `judge-locked` mentions are `getByTestId(` calls and cannot match.
 */
const BAND_BADGE_CLASS = /data-testid="judge-locked"[^>]*?\sclass="([^"]+)"/

const badgeClassFromBandLiteral = (): string => {
  const m = headerSuiteSource.match(BAND_BADGE_CLASS)
  if (!m) throw new Error("the band literal no longer carries a judge-locked class attribute")
  return m[1]
}

describe("DoorHeaderStrip 193-03 — D-05: one component, both header variants", () => {
  it("the band literal is really loaded, and yields a class string that starts with ml-auto", () => {
    // NON-VACUITY FIRST. A `?raw` import of a moved or renamed file yields the empty string in
    // some resolvers rather than throwing, and every assertion below would then be about
    // nothing at all (the 192.1 E-2 lesson: verify a fence's SCOPE — *could it fire?*).
    expect(headerSuiteSource.length).toBeGreaterThan(1000)
    expect(headerSuiteSource).toContain("FLAG_OFF_HEADER_MARKUP")
    const captured = badgeClassFromBandLiteral()
    expect(captured.length).toBeGreaterThan(50)
    expect(captured.startsWith("ml-auto ")).toBe(true)
  })

  it("STANDALONE: the judge badge's class list matches the captured band literal, character for character", () => {
    render(<DoorHeaderStrip onBack={vi.fn()} />)
    expect(screen.getByTestId("judge-locked").getAttribute("class")).toBe(
      badgeClassFromBandLiteral(),
    )
  })

  it("⚠ THE D-05 PAIR: `ml-auto` is present STANDALONE and absent INLINE", () => {
    // Asserted as a CLASS TOKEN on the rendered node, not as a substring of the class string:
    // a substring match would also be satisfied by some future `ml-auto/50` token.
    const standalone = render(<DoorHeaderStrip onBack={vi.fn()} />)
    expect(standalone.getByTestId("judge-locked").className.split(" ")).toContain("ml-auto")
    standalone.unmount()

    const inline = render(<DoorHeaderStrip onBack={vi.fn()} inline />)
    expect(inline.getByTestId("judge-locked").className.split(" ")).not.toContain("ml-auto")

    // …and the REST of the class list is identical across the pair, so the branch above is
    // proved to change exactly one token rather than to rewrite the badge.
    const withoutMlAuto = badgeClassFromBandLiteral().replace("ml-auto ", "")
    expect(inline.getByTestId("judge-locked").getAttribute("class")).toBe(withoutMlAuto)
  })

  it("POSITIVE CONTROL — the class-token check really reads the named node's own list", () => {
    // Without this, the negative half above passes on a broken lookup: `"".split(" ")` contains
    // no "ml-auto" either, and an element that was never found would read as a passing absence.
    const { getByTestId } = render(<DoorHeaderStrip onBack={vi.fn()} inline />)
    expect(getByTestId("judge-locked").className.split(" ")).toContain("inline-flex")
    expect(getByTestId("both-doors").className.split(" ")).toContain("rounded-md")
  })

  it.each([
    ["standalone", undefined],
    ["inline", true],
  ])("%s: the strip's children are [return control] [door label] [judge badge], BY CHILD ORDER", (_name, inlineProp) => {
    const { container, unmount } = render(<DoorHeaderStrip onBack={vi.fn()} inline={inlineProp} />)
    const kids = Array.from(container.children)
    // LENGTH FIRST, so an absent node reds as an AssertionError with both counts printed rather
    // than as a `getBy*` throw that names only the thing it could not find.
    // ⚠ 3 is TODAY'S shape. The D-04 restack adds a divider in a later wave; when it does, this
    // number changes IN THAT PLAN'S COMMIT, which is the whole reason it is pinned here.
    expect(kids).toHaveLength(3)
    // Asserted by ORDER, never by class name (the 192.1 rule) — a class-name lookup would keep
    // passing if the three nodes were re-arranged.
    expect(kids[0].getAttribute("data-testid")).toBe("both-doors")
    expect(kids[1].tagName).toBe("SPAN")
    expect(kids[1].getAttribute("data-testid")).toBeNull()
    expect(kids[2].getAttribute("data-testid")).toBe("judge-locked")
    // The badge is the LAST child in BOTH variants — the far-edge position D-04 leaves alone.
    expect(kids[kids.length - 1].getAttribute("data-testid")).toBe("judge-locked")
    unmount()
  })

  it.each([
    ["standalone", undefined],
    ["inline", true],
  ])("%s: onBack fires exactly once per click of the return control", (_name, inlineProp) => {
    const onBack = vi.fn()
    const { getByTestId, unmount } = render(<DoorHeaderStrip onBack={onBack} inline={inlineProp} />)
    fireEvent.click(getByTestId("both-doors"))
    expect(onBack).toHaveBeenCalledTimes(1)
    unmount()
  })
})

// ── 193-03 — THE ESM-CYCLE FENCE (D-24(b), T-193-09) ─────────────────────────────────────
//
// WHY A TEST AND NOT A DOCBLOCK. `WorkflowDoorSwitch.tsx` imports `DoorHeaderStrip`'s component
// VALUE at module scope, so the door subtree contains a live value-level edge. If the extracted
// module imported `WorkflowDoorSwitch` back, the cycle would typecheck clean and lint clean and
// fail only at RUNTIME — a TDZ `ReferenceError` in whichever module a caller reached first,
// which under Vitest is whichever suite happens to import first. Nothing in the build can see
// that, so the constraint is spelled as an assertion over the module's own source.
//
// The forbidden shape is stated ONCE and covers every import form deliberately: a static import,
// a re-export, and `import type` all end in `from "<specifier>"`, and a type-only import back is
// forbidden too even though it is erased at build — `verbatimModuleSyntax` makes the value/type
// distinction easy to get wrong under a later edit, and a fence that permits the cheap mistake
// is not worth the line it costs. Dynamic `import()` is its own regex because it has no `from`.
//
// ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING, and it is inherited from the hole `/gsd:secure-phase 188.2`
// found in this fence's ancestor rather than rediscovered: `frontend/tsconfig.app.json:13-14`
// sets `"moduleResolution": "bundler"` WITH `"allowImportingTsExtensions": true`, so
// `from "./WorkflowDoorSwitch.tsx"` compiles, resolves, and would build a real TDZ cycle under a
// fence anchored to close immediately after `WorkflowDoorSwitch`.
const IMPORT_FROM_DOORS = /from\s+["'][^"']*WorkflowDoorSwitch(\.[jt]sx?)?["']/
const DYNAMIC_IMPORT_DOORS = /import\s*\(\s*["'][^"']*WorkflowDoorSwitch(\.[jt]sx?)?["']\s*\)/

describe("DoorHeaderStrip 193-03 — the extracted module cannot import back (D-24(b))", () => {
  it("the two regexes match the shapes they forbid, and the source is really loaded", () => {
    // POSITIVE CONTROLS, inline and first: a fence whose matcher is broken passes vacuously and
    // looks exactly like a fence that holds.
    expect('import { WorkflowDoorSwitch } from "./WorkflowDoorSwitch"').toMatch(IMPORT_FROM_DOORS)
    expect(
      'import type { WorkflowDoorSwitchProps } from "@/components/workflows/WorkflowDoorSwitch"',
    ).toMatch(IMPORT_FROM_DOORS)
    expect('export { WorkflowDoorSwitch } from "./WorkflowDoorSwitch"').toMatch(IMPORT_FROM_DOORS)
    expect('const m = await import("@/components/workflows/WorkflowDoorSwitch")').toMatch(
      DYNAMIC_IMPORT_DOORS,
    )
    // …and the SUFFIXED spelling of each, legal under `allowImportingTsExtensions: true`. One
    // per form: an optional group is only proven by exercising the branch that takes it.
    expect('import { WorkflowDoorSwitch } from "./WorkflowDoorSwitch.tsx"').toMatch(IMPORT_FROM_DOORS)
    expect('import type { WorkflowDoorSwitchProps } from "./WorkflowDoorSwitch.tsx"').toMatch(
      IMPORT_FROM_DOORS,
    )
    expect('export { WorkflowDoorSwitch } from "./WorkflowDoorSwitch.tsx"').toMatch(IMPORT_FROM_DOORS)
    expect('const m = await import("./WorkflowDoorSwitch.tsx")').toMatch(DYNAMIC_IMPORT_DOORS)
    // NEGATIVE CONTROLS — `?raw` is this very file's own spelling above, and it must keep missing
    // under BOTH branches of the optional group.
    for (const legal of [
      'import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"',
      'import src from "./WorkflowDoorSwitch.tsx?raw"',
    ]) {
      expect(legal).not.toMatch(IMPORT_FROM_DOORS)
      expect(legal).not.toMatch(DYNAMIC_IMPORT_DOORS)
    }
    // …and the subject is non-empty, so the negatives below are about a real file rather than
    // about the empty string (the 192.1 E-2 lesson, again).
    expect(doorHeaderStripSource.length).toBeGreaterThan(500)
  })

  it("the extracted module names no WorkflowDoorSwitch specifier in ANY import form", () => {
    expect(doorHeaderStripSource).not.toMatch(IMPORT_FROM_DOORS)
    expect(doorHeaderStripSource).not.toMatch(DYNAMIC_IMPORT_DOORS)
  })

  it("DoorHeaderStrip is a LEAF — it imports nothing at all, component sibling or otherwise", () => {
    // The house naming rule in this directory is the mechanism: a PascalCase sibling is a
    // component module, a camelCase one is a plain module. So "imports no component" is
    // checkable without listing every file.
    const COMPONENT_SIBLING = /from\s+["']@\/components\/workflows\/[A-Z]/
    const REACT_IMPORT = /from\s+["']react["']/
    const ANY_IMPORT = /^\s*import\s/m
    // POSITIVE CONTROLS first.
    expect('import { StepTypePicker } from "@/components/workflows/StepTypePicker"').toMatch(
      COMPONENT_SIBLING,
    )
    expect('import { useState } from "react"').toMatch(REACT_IMPORT)
    expect('import { DoorHeaderStrip } from "./DoorHeaderStrip"').toMatch(ANY_IMPORT)

    expect(doorHeaderStripSource).not.toMatch(COMPONENT_SIBLING)
    expect(doorHeaderStripSource).not.toMatch(REACT_IMPORT)
    expect(doorHeaderStripSource).not.toMatch(ANY_IMPORT)
    // ⚠ NON-VACUITY FOR A ZERO-IMPORT LEAF CANNOT BE A POSITIVE IMPORT — there is none to find.
    // So the claim is anchored on what the file DOES declare: the component the three negatives
    // above are supposed to be describing.
    expect(doorHeaderStripSource).toMatch(/export function DoorHeaderStrip\(/)
    expect(doorHeaderStripSource).toMatch(/export interface DoorHeaderStripProps/)
  })

  it("the door shell imports the strip rather than declaring it — the cut has one direction", () => {
    // The other half of "no cycle": the edge exists, and it points one way. Without this the
    // negatives above are also satisfied by a module nobody uses.
    expect(workflowDoorSwitchSource).toMatch(
      /import \{ DoorHeaderStrip \} from ["'](\.\/|@\/components\/workflows\/)DoorHeaderStrip["']/,
    )
    expect(workflowDoorSwitchSource).toContain("<DoorHeaderStrip")
    // The HARD CUT: the fragment is gone from the parent…
    expect(workflowDoorSwitchSource).not.toContain("const doorGroup = (")
    // …and no re-export shim was left behind, which is what would quietly preserve the coupling
    // this extraction exists to remove while every other assertion here stayed green.
    expect(workflowDoorSwitchSource).not.toMatch(/export \{[^}]*DoorHeaderStrip[^}]*\} from/)
  })
})
