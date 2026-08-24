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
 * ── ⚠ 193-09: THE RESTACK LANDED, AND THE PARAGRAPH ABOVE IS KEPT RATHER THAN REWRITTEN ──
 *
 * The count it pinned did exactly its job: it went from 3 to 4 IN THE RESTACK'S OWN COMMIT,
 * so the added node had to be stated. What 193-09 changed here, and nothing else:
 *
 *  · the child-order rows now expect FOUR children — [return control] [divider] [door label]
 *    [judge badge] — with the badge still asserted LAST in BOTH variants, which is D-04's
 *    "far edge, unchanged" spelled as an assertion rather than as a hope;
 *  · two new rows: the divider is proved DECORATIVE (aria-hidden, empty, and contributing not
 *    one character to the strip's own text), and the return control's OWN node is proved to
 *    carry no border token — asserted on that node, never on the strip, because the app's band
 *    wrapper legitimately carries a border and a class check aimed at the wrong node passes or
 *    fails for entirely the wrong reason;
 *  · ONE pre-existing assertion was corrected, not weakened: the POSITIVE CONTROL below read
 *    the return control's list for `rounded-md`, which the demotion removes. It now reads
 *    `text-muted-foreground` — a token the demoted control still carries — so the control
 *    still proves what it exists to prove (that the reader really reads the named node's own
 *    list, and that `"".split(" ")` cannot masquerade as a passing absence).
 *
 * The `ml-auto` pair and the band-literal equality below were NOT touched: D-05 survives the
 * restack, and that is the point of leaving them exactly as 193-03 wrote them.
 *
 * ⚠ THE `doorVocabulary` LEG NOW EXISTS — IN THAT MODULE'S OWN SUITE, NOT HERE. 193-03 left
 * it out because the module did not exist, and `import.meta.glob` contributes the EMPTY STRING
 * for an absent path without ever throwing — the 192.1 E-2 finding, where a fence swept against
 * the empty string passed green while defending nothing. `193-05` added the leg as the
 * strictly STRONGER claim: `doorVocabulary.test.ts` asserts that module imports NOTHING AT
 * ALL, with its own non-vacuity guard. This suite's leaf case below was narrowed in the same
 * wave — see the ⚠ note inside it.
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
// 199-08: the words this strip renders, read off their ONE home rather than re-typed — this
// suite may legitimately spell them, but deriving them is what keeps a reword from needing an
// edit here too.
import * as doorVocabulary from "./doorVocabulary"

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
    // ⚠ 193-09: this read `rounded-md` until the D-04 demotion removed the box. The control's
    // JOB here is unchanged — prove the reader really reads the named node's own list — so it
    // was re-anchored on a token the demoted control still carries, never deleted. A positive
    // control that is dropped because the thing it named moved leaves the negative half of its
    // pair passing on a broken lookup forever.
    expect(getByTestId("both-doors").className.split(" ")).toContain("text-muted-foreground")
  })

  it.each([
    ["standalone", undefined],
    ["inline", true],
  ])("%s: the strip's children are [return control] [divider] [door label] [judge badge], BY CHILD ORDER", (_name, inlineProp) => {
    const { container, unmount } = render(<DoorHeaderStrip onBack={vi.fn()} inline={inlineProp} />)
    const kids = Array.from(container.children)
    // LENGTH FIRST, so an absent node reds as an AssertionError with both counts printed rather
    // than as a `getBy*` throw that names only the thing it could not find.
    // ⚠ 4 AS OF 193-09. It was 3, pinned by 193-03 precisely so the D-04 restack would have to
    // STATE the node it adds in its own commit rather than absorb it. It did; this is that
    // statement. The next author inherits the same deal.
    expect(kids).toHaveLength(4)
    // Asserted by ORDER, never by class name (the 192.1 rule) — a class-name lookup would keep
    // passing if the four nodes were re-arranged.
    expect(kids[0].getAttribute("data-testid")).toBe("both-doors")
    // The divider sits BETWEEN the escape and the door label, which is the whole of D-04's
    // shape: a person reads the way out, then a break, then where they are.
    expect(kids[1].tagName).toBe("SPAN")
    expect(kids[1].getAttribute("aria-hidden")).toBe("true")
    expect(kids[1].getAttribute("data-testid")).toBeNull()
    expect(kids[2].tagName).toBe("SPAN")
    expect(kids[2].getAttribute("data-testid")).toBeNull()
    // …and the label is NOT the divider: it carries the door's words, the divider carries none.
    expect(kids[2].textContent!.length).toBeGreaterThan(0)
    expect(kids[3].getAttribute("data-testid")).toBe("judge-locked")
    // The badge is the LAST child in BOTH variants — the far-edge position D-04 leaves alone.
    expect(kids[kids.length - 1].getAttribute("data-testid")).toBe("judge-locked")
    unmount()
  })

  it.each([
    ["standalone", undefined],
    ["inline", true],
  ])("%s: the divider is DECORATIVE — hidden, empty, and worth no character of the strip's text", (_name, inlineProp) => {
    const { container, unmount } = render(<DoorHeaderStrip onBack={vi.fn()} inline={inlineProp} />)
    const kids = Array.from(container.children)
    const divider = kids[1]
    // A decorative rule that reaches the accessibility tree is read aloud as noise (T-193-37).
    expect(divider.getAttribute("aria-hidden")).toBe("true")
    // It is a RULE, not a character: no text `│`, no glyph, no entity. A text divider would
    // satisfy every positional assertion above while being spoken by a screen reader.
    expect(divider.textContent).toBe("")
    expect(divider.childNodes).toHaveLength(0)
    // …and the strip's OWN text is exactly its other three children's, concatenated in order,
    // with nothing between them. This is the claim that actually binds: the divider could not
    // gain a character without reddening here.
    const withoutDivider = kids
      .filter((_n, i) => i !== 1)
      .map((n) => n.textContent)
      .join("")
    expect(container.textContent).toBe(withoutDivider)
    // NON-VACUITY: the equality above is between two REAL strings, not two empties — an
    // unmounted strip would satisfy `"" === ""` forever (the 192.1 E-2 lesson).
    expect(withoutDivider.length).toBeGreaterThan(10)
    unmount()
  })

  it.each([
    ["standalone", undefined],
    ["inline", true],
  ])("%s: the return control's OWN node lost its box and kept its nature (D-04)", (_name, inlineProp) => {
    const { getByTestId, container, unmount } = render(
      <DoorHeaderStrip onBack={vi.fn()} inline={inlineProp} />,
    )
    const back = getByTestId("both-doors")
    const tokens = back.className.split(" ")
    // ⚠ ASSERTED ON THE CONTROL'S OWN NODE, NEVER ON THE STRIP. In the app the band WRAPPER
    // legitimately carries a bottom border, so the same check aimed one level up would pass or
    // fail for entirely the wrong reason — which is exactly how a class assertion becomes a
    // sentence about nothing.
    expect(tokens).not.toContain("border")
    expect(tokens).not.toContain("border-border")
    expect(tokens).not.toContain("rounded-md")
    // POSITIVE CONTROL on the SAME node through the SAME reader: `"".split(" ")` contains none
    // of the three above either, so an element that was never found would read as a passing
    // absence.
    expect(tokens).toContain("text-muted-foreground")
    // The box went; the BUTTON did not (T-193-36). An escape hatch that quietly became a
    // `<span>` would be unreachable by keyboard and unreachable by role.
    expect(back.tagName).toBe("BUTTON")
    expect(back.getAttribute("type")).toBe("button")
    // …and it is a different node from the divider, so neither row above is describing the
    // other one by accident.
    expect(container.children[1]).not.toBe(back)
    expect(container.children[0]).toBe(back)
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

  it("DoorHeaderStrip imports EXACTLY ONE module — the zero-import vocabulary leaf (D-10)", () => {
    // The house naming rule in this directory is the mechanism: a PascalCase sibling is a
    // component module, a camelCase one is a plain module. So "imports no component" is
    // checkable without listing every file.
    const COMPONENT_SIBLING = /from\s+["']@\/components\/workflows\/[A-Z]/
    const REACT_IMPORT = /from\s+["']react["']/
    // ⚠ 193 REVIEW IN-02 — TWO CONSTANTS, ON PURPOSE. A single `/gm` regex used for BOTH
    // `toMatch` (which calls `regexp.test()` and ADVANCES `lastIndex`) and `String.match()`
    // makes the count below order-dependent: it is correct today only because `.match()` with
    // `/g` happens to reset `lastIndex`, so adding one more `toMatch(ANY_IMPORT)` anywhere
    // above `:338` would silently change the count. The sibling suite
    // (`doorVocabulary.test.ts:440`) already declares its matcher without `/g` for exactly
    // this reason. `/g` belongs only on the one used for counting.
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_IMPORT_G = /^\s*import\s/gm
    const IMPORT_SPECIFIER = /^\s*import\s[^\n]*?from\s+["']([^"']+)["']/gm
    const specifiersOf = (s: string) => [...s.matchAll(IMPORT_SPECIFIER)].map((m) => m[1])
    // POSITIVE CONTROLS first.
    expect('import { StepTypePicker } from "@/components/workflows/StepTypePicker"').toMatch(
      COMPONENT_SIBLING,
    )
    expect('import { useState } from "react"').toMatch(REACT_IMPORT)
    expect('import { DoorHeaderStrip } from "./DoorHeaderStrip"').toMatch(ANY_IMPORT)
    // …and the specifier extractor really extracts, in order, including a type-only import
    // and a multi-name list. Without this the equality below passes on an empty array.
    expect(specifiersOf('import { A } from "alpha"\nimport type { B, C } from "@/beta"\n')).toEqual([
      "alpha",
      "@/beta",
    ])

    expect(doorHeaderStripSource).not.toMatch(COMPONENT_SIBLING)
    expect(doorHeaderStripSource).not.toMatch(REACT_IMPORT)

    // ⚠ 193-03 ASSERTED THAT THIS FILE IMPORTS NOTHING AT ALL, AND 193-05 MAKES THAT FALSE
    // BY DESIGN. The door COPY moved to `doorVocabulary.ts` (D-10), which this strip must
    // import to render its return control and its door label; the whole point of D-24(a) is
    // that a governed word reaches JSX through that import and through nothing else. So the
    // claim is NARROWED to what actually binds rather than deleted: an EQUALITY over the
    // specifier list, which spells the one permitted import and reds on a second. Relaxing
    // it to "no component sibling" alone would have let any camelCase module in silently.
    //
    // It stays cycle-safe for a mechanical reason rather than a hopeful one:
    // `doorVocabulary.ts` imports NOTHING AT ALL (`doorVocabulary.test.ts` asserts exactly
    // that as its own leaf claim), so this edge is one hop into a data leaf and cannot close
    // a cycle in either direction.
    expect(specifiersOf(doorHeaderStripSource)).toEqual(["@/components/workflows/doorVocabulary"])
    // …and EVERY import line yielded a specifier, so a bare side-effect import (which carries
    // no `from` clause at all) cannot hide behind the equality above.
    expect(doorHeaderStripSource.match(ANY_IMPORT_G) ?? []).toHaveLength(1)

    // NON-VACUITY, anchored on what the file DOES declare — the component the negatives above
    // are supposed to be describing.
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

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 2 (DES-01 · sheet `c9-doors-describe` §2) — THE STRIP IS **ALREADY
// SHIPPED**, AND THIS RECORDS THE VERDICT RATHER THAN REBUILDING IT.
//
// APPENDED, never interleaved. Not one assertion above this line moves, and this plan
// changes NO byte of `DoorHeaderStrip.tsx` — the shipped shape (D-04's restack, Phase 193)
// already IS the sheet's §2: a return control, then the name of the door you are standing
// in. Re-drawing it would spend change budget on the one element that needed none, and it
// would move a DOM that `WorkflowDoorSwitch.baseline.test.tsx` pins byte for byte.
//
// ⚠ THE SHEET AND THE SHIPPED LANGUAGE DISAGREE ON THREE POINTS AND THE SHIPPED ONE WINS,
// which is what these cases pin so the disagreement is a decision rather than a diff:
//   1. the sheet's label is a PROGRESS word ("…ing", trailing ellipsis) — a claim that work
//      is under way, on a strip that renders while nothing is running at all;
//   2. its glyphs are Material Symbols, which are not in this project's icon convention
//      (`199-03` refused the same substitution one sheet earlier);
//   3. its return control is an ICON-ONLY button whose only name is a `title` — the shipped
//      one is a worded control, and a `title` is not an accessible name a keyboard user can
//      read without hovering.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("199-08 — sheet c9 §2: the header strip, ALREADY SHIPPED (verified, not rebuilt)", () => {
  it("both of the sheet's §2 elements are present, in the sheet's own order", () => {
    render(<DoorHeaderStrip onBack={() => {}} />)
    const back = screen.getByTestId("both-doors")
    const label = screen.getByText(doorVocabulary.STRIP_LABEL_GOVERN)
    // NON-VACUITY: two distinct real nodes, not one node matched twice.
    expect(back).not.toBe(label)
    // The sheet's order — escape first, then the door you are in. `compareDocumentPosition`
    // reads the real DOM order rather than trusting the source to have kept it.
    expect(back.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("⚠ the return control is WORDED, not an icon with a tooltip for a name", () => {
    render(<DoorHeaderStrip onBack={() => {}} />)
    const back = screen.getByTestId("both-doors")
    // The accessible name is real text, present without hovering anything.
    expect((back.textContent ?? "").trim().length).toBeGreaterThan(0)
    expect(back).toHaveTextContent(doorVocabulary.STRIP_BACK)
  })

  it("⚠ the label names the DOOR, and claims no progress the strip cannot observe", () => {
    // The sheet's caption asserts an activity in flight. This strip renders on a screen where
    // nothing is running, so that word would be a claim about state it never reads — the same
    // class of refusal `199-03` recorded for the sheet's determinate progress strip.
    const label = doorVocabulary.STRIP_LABEL_GOVERN
    expect(label.endsWith("...")).toBe(false)
    expect(label.endsWith("…")).toBe(false)
    expect(/ing\b/i.test(label)).toBe(false)
    // POSITIVE CONTROL — the sweep really fires on the sheet's own two captions.
    expect(/ing\b/i.test("Describing workflow...")).toBe(true)
    expect("Manual composition...".endsWith("...")).toBe(true)
  })

  it("199-08 modified NO byte of this component — the strip carries no marker from this phase", () => {
    // A verdict of ALREADY-SHIPPED is only honest if the file really was left alone. Cheapest
    // mechanical form of that claim: this phase's own tag appears nowhere in the component.
    expect(doorHeaderStripSource).not.toContain("199-08")
    expect(doorHeaderStripSource.length).toBeGreaterThan(1000)
  })
})
