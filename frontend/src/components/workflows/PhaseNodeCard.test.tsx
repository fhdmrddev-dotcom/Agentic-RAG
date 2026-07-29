/**
 * Phase 184-03 Task 3 (D-184-06 / D-184-08, VALID-03) — PhaseNodeCard tests.
 *
 * THE PROVIDER-LESS RENDER PROOF. Every render below is a plain `render()` from
 * `@testing-library/react` with NO canvas provider and NO jsdom shim for the graph
 * library — the `PhaseSpine.test.tsx` leaf-render analog, deliberately, rather than
 * the `WorkflowCanvas.test.tsx` shape which needs a file-local prototype mock before
 * its first render. If this suite ever needs either, the D-184-06 extraction is
 * wrong and the card is not presentational.
 *
 * It pins four things:
 *  1. the card renders, and renders its data-attribute contract, outside any provider;
 *  2. no focusable control exists inside it — the LEAF-level mirror of the shipped
 *     canvas-level walk at `WorkflowCanvas.test.tsx:231-238`, so the one-tab-stop-per-
 *     node invariant is now guarded at BOTH levels;
 *  3. the badge row honours the 137-D two-badge budget at 0, 1 and 2;
 *  4. the slots Phase 185 / Phase 188 will fill render NOTHING today —
 *     the assertion that proves Wave 0 added the seam without adding behaviour.
 *     (184-08 filled the `verdict` slot, so that one now has its own describe block at
 *     the foot of this file rather than living inside the byte-identical proof.)
 *
 * Plus the `?raw` source fences, in the `canvasModel.purity.test.ts:14-17` house
 * idiom, each with a POSITIVE CONTROL so a broken guard is visible rather than
 * vacuously green.
 *
 * A NOTE ON HOW THE GRAPH-PACKAGE TOKEN IS SPELLED HERE. The card's whole point is
 * that its source does not name the canvas graph package. A guard that spells the
 * token in this file would make "this suite names no canvas package" false of the
 * guard itself — the D-ITEM-183-02 trap, where the only way a check passes is by
 * making a neighbouring claim lie. So the token is ASSEMBLED from halves in exactly
 * one place below, and its correctness is proved POSITIVELY against the adapter's
 * real import rather than asserted. A typo in the assembly turns that control red.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import phaseNodeCardSource from "./PhaseNodeCard?raw"
// The adapter's + the const-table module's sources, read here so the 184-03 module
// boundary is asserted from ONE place (the `PhaseSpine.test.tsx:16-18` precedent).
import phaseNodeSource from "./PhaseNode?raw"
import nodePresentationSource from "./nodePresentation?raw"
import { PhaseNodeCard, type BadgeSlot, type BadgeSlots } from "./PhaseNodeCard"
import { DEFAULT_TINT, ICON_TINT } from "./nodePresentation"
// 184-08's additions land as a SEPARATE import statement rather than by widening the
// line above, so this file's whole 184-08 diff reads as added lines plus the two
// narrowed assertions whose reasons are written at the assertions themselves (D-184-08).
import { VERDICT_DESTRUCTIVE_TOKEN, VERDICT_MARK } from "./nodePresentation"
// 185-01's occupancy block reads the node box's dimensions from the ONE frozen table
// the component itself reads, so a layout change moves the computed boxes rather than
// silently disagreeing with them. Its own import line, same convention as 184-08's.
import { CANVAS_LAYOUT } from "./canvasModel"
// 185-09: the seal's accessible label and the panel dial's strict side, imported from
// the ONE home the card also imports from — the pair is asserted still-in-agreement
// below, which is what stops Req 7's locked words drifting between panel and canvas.
import { GOVERNANCE_SEAL_LABEL, GROUNDING_DIAL_STRICT_LABEL } from "./definitionOps"

/** The minimal slot set — everything else on the contract is optional by design. */
function renderCard(overrides: Partial<React.ComponentProps<typeof PhaseNodeCard>> = {}) {
  return render(
    <PhaseNodeCard
      slug="summarize"
      phaseType="llm_single"
      icon={<span data-testid="probe-icon">◆</span>}
      title="Summarise the findings"
      tint={ICON_TINT.llm_single}
      {...overrides}
    />,
  )
}

const groundingBadge: BadgeSlot = {
  testId: "canvas-grounding",
  tone: "success",
  glyph: "🔒",
  label: "Grounded in your files",
  dataAttr: { "data-grounding": "strict" },
}

const waitsBadge: BadgeSlot = {
  testId: "canvas-waits-for-you",
  tone: "primary",
  label: "Waits for you",
  dataAttr: { "data-waits-for-you": "true" },
}

/** The governance seal's stable hook (185-09). Module scope because BOTH the 185-01
 *  occupancy block and the 185-09 block below select on it, and a second spelling of a
 *  test id is how two halves of one suite start measuring different elements. */
const SEAL_TEST_ID = "canvas-node-seal"

describe("PhaseNodeCard — renders with no provider at all (D-184-06)", () => {
  it("renders the data-attribute contract outside any provider, without throwing", () => {
    const { container } = renderCard()
    const node = screen.getByTestId("canvas-node-summarize")
    expect(node).toBeInTheDocument()
    expect(node.getAttribute("data-slug")).toBe("summarize")
    expect(node.getAttribute("data-phase-type")).toBe("llm_single")
    expect(node.getAttribute("data-selected")).toBe("false")
    expect(node.className).toBe("relative")
    // The card painted its own body, not just its wrapper.
    expect(screen.getByText("Summarise the findings")).toBeInTheDocument()
    expect(container.querySelector('[data-testid="probe-icon"]')).not.toBeNull()
  })

  it("needs no edge anchors to render — the `anchors` slot is optional", () => {
    const { container } = renderCard()
    // Nothing from the graph library is mounted, so no handle element exists.
    expect(container.querySelectorAll(".react-flow__handle")).toHaveLength(0)
    expect(screen.getByTestId("canvas-node-summarize")).toBeInTheDocument()
  })

  it("renders the anchors slot as the FIRST child when one is supplied", () => {
    const { container } = renderCard({
      anchors: <i data-testid="probe-anchors" />,
    })
    const node = screen.getByTestId("canvas-node-summarize")
    expect(node.firstElementChild?.getAttribute("data-testid")).toBe("probe-anchors")
    expect(container.querySelectorAll('[data-testid="probe-anchors"]')).toHaveLength(1)
  })

  it("flips data-selected to \"true\" when selected is passed", () => {
    renderCard({ selected: true })
    expect(screen.getByTestId("canvas-node-summarize").getAttribute("data-selected")).toBe("true")
  })

  it("renders the subtitle when present and nothing when it is the empty string", () => {
    const withSubtitle = renderCard({ subtitle: "Writes one paragraph" })
    expect(screen.getByText("Writes one paragraph")).toBeInTheDocument()
    withSubtitle.unmount()

    const { container } = renderCard({ subtitle: "" })
    expect(container.querySelectorAll("p")).toHaveLength(1) // the title only
  })
})

describe("PhaseNodeCard — the ⌥ technical line", () => {
  it("renders the technical line when the slot is filled", () => {
    renderCard({ technicalLine: "llm_single · summarize" })
    const line = screen.getByTestId("canvas-node-technical-line")
    expect(line).toBeInTheDocument()
    expect(line.textContent).toBe("llm_single · summarize")
  })

  it("renders nothing extra when it is omitted (the 184 adapter never passes it)", () => {
    const { container } = renderCard()
    expect(container.querySelector('[data-testid="canvas-node-technical-line"]')).toBeNull()
  })

  it("the title is whatever the caller resolved — the card owns no reveal state", () => {
    // The adapter decides plain-language vs technical, so there is exactly ONE
    // technical-names state in the app. The card just paints the string it is given.
    renderCard({ title: "Summarise · summarize" })
    expect(screen.getByText("Summarise · summarize")).toBeInTheDocument()
  })
})

describe("PhaseNodeCard — ONE TAB STOP PER NODE (the leaf-level mirror)", () => {
  it("contains NO focusable control of any kind", () => {
    const { container } = renderCard({
      subtitle: "Writes one paragraph",
      technicalLine: "llm_single · summarize",
      badges: [groundingBadge, waitsBadge],
      selected: true,
    })
    expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
  })

  it("registers no click handler on the card root (selection is the canvas's job)", () => {
    const { container } = renderCard()
    expect(container.querySelectorAll("[onclick]")).toHaveLength(0)
    expect(phaseNodeCardSource).not.toMatch(/onClick=/)
  })
})

describe("PhaseNodeCard — the 137-D two-badge budget", () => {
  it("renders no badge row at all for zero badges", () => {
    const empty: BadgeSlots = []
    const { container } = renderCard({ badges: empty })
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(0)
    expect(container.querySelector('[data-testid="canvas-grounding"]')).toBeNull()
  })

  it("renders no badge row when the slot is omitted entirely", () => {
    const { container } = renderCard()
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(0)
  })

  it("renders exactly one chip for one badge", () => {
    const { container } = renderCard({ badges: [groundingBadge] })
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(1)
    const chip = screen.getByTestId("canvas-grounding")
    expect(chip.getAttribute("data-tone")).toBe("success")
    expect(chip.textContent).toBe("🔒Grounded in your files")
  })

  it("renders exactly two chips for two badges, in slot order", () => {
    const { container } = renderCard({ badges: [groundingBadge, waitsBadge] })
    const chips = Array.from(container.querySelectorAll("[data-tone]"))
    expect(chips).toHaveLength(2)
    expect(chips.map((c) => c.getAttribute("data-testid"))).toEqual([
      "canvas-grounding",
      "canvas-waits-for-you",
    ])
  })

  it("lands each badge's dataAttr pairs on its WRAPPER, not on the chip", () => {
    renderCard({ badges: [groundingBadge, waitsBadge] })
    const grounding = screen.getByTestId("canvas-grounding")
    const waits = screen.getByTestId("canvas-waits-for-you")
    expect(grounding.getAttribute("data-grounding")).toBeNull()
    expect(grounding.closest("[data-grounding]")?.getAttribute("data-grounding")).toBe("strict")
    expect(waits.closest("[data-waits-for-you]")?.getAttribute("data-waits-for-you")).toBe("true")
  })

  it("renders the decorative glyph aria-hidden, and omits it when absent", () => {
    const { container } = renderCard({ badges: [groundingBadge, waitsBadge] })
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    // The grounding glyph plus the floating-mark well; the "Waits for you" chip has
    // no glyph, so the WORD carries the meaning alone (never colour-alone).
    expect(hidden.some((el) => el.textContent === "🔒")).toBe(true)
    expect(screen.getByTestId("canvas-waits-for-you").textContent).toBe("Waits for you")
  })
})

describe("PhaseNodeCard — the absent slots render NOTHING (Wave 0 adds the seam only)", () => {
  it("carries no verdict and no status element when both are omitted", () => {
    const { container } = renderCard({ badges: [groundingBadge] })
    const testIds = Array.from(container.querySelectorAll("[data-testid]")).map((el) =>
      el.getAttribute("data-testid"),
    )
    expect(testIds.some((id) => id?.includes("verdict"))).toBe(false)
    expect(testIds.some((id) => id?.includes("status"))).toBe(false)
  })

  it("renders BYTE-IDENTICAL DOM whether status / stepNumber are passed or not", () => {
    // This is the assertion that proves the extraction is behaviour-preserving:
    // Phase 188 adds DATA to a declared slot, not layout to the card.
    //
    // 184-08 NARROWED THIS ASSERTION, and the narrowing is the point rather than an
    // erosion of it. As written in 184-03 it also passed `verdict: "error"`, because
    // in Wave 0 that slot was declared and unrendered. 184-08 is the plan chartered to
    // FILL it, so the sentence "passing a verdict changes nothing" is exactly what
    // this plan had to make false — keeping it green would have required 184-08 not to
    // exist. The two slots still unrendered are still guarded here, and the `verdict`
    // slot's two remaining contracts are guarded below, more strongly than before:
    // absent still renders nothing, and present renders a mark that CHANGES when only
    // the server-derived value does (VALID-03's headline proof).
    const without = renderCard({ badges: [groundingBadge] })
    const before = without.container.innerHTML
    without.unmount()

    const withSlots = renderCard({
      badges: [groundingBadge],
      status: "running",
      stepNumber: 3,
    })
    expect(withSlots.container.innerHTML).toBe(before)
  })
})

/**
 * The icon-well background, read back from the DOM.
 *
 * Asserted RELATIVELY, never against a literal. jsdom's cssstyle normalises the
 * project's modern `hsl(H S% L% / A)` syntax into `rgba(...)` before it lands on the
 * element, so a literal comparison would either fail or force a second, re-encoded
 * copy of the tint table into this file — a copy that could silently drift from
 * `nodePresentation`. Comparing two renders keeps the assertion about the thing that
 * matters: WHICH tint reached the card.
 */
function wellBackground(tint: string): string {
  const { container, unmount } = render(
    <PhaseNodeCard slug="probe" phaseType="probe" icon={null} title="probe" tint={tint} />,
  )
  const well = container.querySelector('[style*="radial-gradient"]')
  const background = well?.getAttribute("style") ?? ""
  unmount()
  return background
}

describe("PhaseNodeCard — forward-compat on an unrecognised phase type", () => {
  it("renders an unknown phase_type without throwing, at the DEFAULT tint", () => {
    // The adapter's exact resolution, reproduced here: an unknown discriminator is a
    // MISS on the tint table, never a crash (the panel/PhaseCard UNKNOWN_PHASE_META
    // discipline). The card itself performs no lookup, so it cannot throw at all.
    const unknown = "llm_time_travel"
    const tint = ICON_TINT[unknown] ?? DEFAULT_TINT
    expect(tint).toBe(DEFAULT_TINT)

    const { container } = renderCard({ slug: "future", phaseType: unknown, tint })
    const node = screen.getByTestId("canvas-node-future")
    expect(node.getAttribute("data-phase-type")).toBe(unknown)
    expect(container.querySelector('[style*="radial-gradient"]')).not.toBeNull()
    expect(wellBackground(tint)).toBe(wellBackground(DEFAULT_TINT))
  })

  it("paints the resolved tint it is handed, never one it looked up", () => {
    // A known type paints a DIFFERENT well from the default — so the prop is really
    // reaching the DOM and the previous test is not passing vacuously.
    expect(wellBackground(ICON_TINT.llm_emit)).not.toBe(wellBackground(DEFAULT_TINT))
    // The card performs NO tint lookup: it neither imports the tint tables nor indexes
    // them. Anchored on the import + index forms, not the bare identifiers — the card's
    // docblock has to be free to name `nodePresentation.DEFAULT_TINT` when explaining
    // who resolves the tint (D-ITEM-183-02, as above).
    //
    // 184-08 NARROWED THIS FENCE from a blanket ban on the module PATH to a ban on the
    // two TINT identifiers, which is what its own name ("never one it looked up") was
    // always about. The card now imports the verdict-mark table from the same module,
    // and it had to: `react-refresh/only-export-components` forbids a component file
    // from exporting the shared constant, so the table has exactly one legal home and
    // the card has exactly one legal way to read it. The property under guard is
    // unchanged and is asserted twice below — the card looks up no tint, and paints
    // only the resolved string it is handed.
    expect(phaseNodeCardSource).not.toMatch(
      /import[^;]*\b(ICON_TINT|DEFAULT_TINT)\b[^;]*from\s+["'][^"']*nodePresentation["']/,
    )
    expect(phaseNodeCardSource).not.toMatch(/ICON_TINT\[/)
    expect(phaseNodeCardSource).not.toMatch(/DEFAULT_TINT\s*[,)\]]/)
    // Positive controls: the ADAPTER is where all three forms live, so none of the
    // three regexes above can be silently vacuous.
    expect(phaseNodeSource).toMatch(
      /import[^;]*\b(ICON_TINT|DEFAULT_TINT)\b[^;]*from\s+["'][^"']*nodePresentation["']/,
    )
    expect(phaseNodeSource).toMatch(/ICON_TINT\[/)
    expect(phaseNodeSource).toMatch(/DEFAULT_TINT\s*[,)\]]/)
  })
})

/**
 * The source fences. `?raw` + a grep is the shipped house idiom for a scope boundary
 * that must be machine-checkable (`canvasModel.purity.test.ts:14-17`,
 * `WorkflowCanvas.test.tsx:30-32`). Each fence below carries a positive control.
 */
const GRAPH_PKG = ["@xy", "flow/react"].join("")
const GRAPH_PKG_SCOPE = ["@xy", "flow"].join("")

describe("PhaseNodeCard — the scope fences (source guard)", () => {
  it("the assembled package token is REAL — the adapter imports exactly it", () => {
    // The positive control for both fences below. A typo in the assembly, or a rename
    // of the dependency, turns this red instead of turning the fences vacuous.
    expect(phaseNodeSource).toContain(GRAPH_PKG)
    expect(phaseNodeSource).toContain(`from "${GRAPH_PKG}"`)
  })

  it("the card names the canvas graph package NOWHERE (D-184-06)", () => {
    expect(phaseNodeCardSource).not.toContain(GRAPH_PKG_SCOPE)
  })

  it("the card constructs none of the library's elements or types", () => {
    // Anchored on the USE FORM — a JSX element, or a type annotation — never on the
    // bare identifier. The card's docblock has to be free to SAY what it does not
    // import: it names the library's provider component and its node-props type when
    // explaining why the card renders outside both. A bare-identifier grep would only
    // pass by making that explanation lie, which is the D-ITEM-183-02 trap this
    // project has already hit five times. Same convention as the HTML-sink fence.
    expect(phaseNodeCardSource).not.toMatch(/<Handle[\s/>]/)
    expect(phaseNodeCardSource).not.toMatch(/<ReactFlow/)
    expect(phaseNodeCardSource).not.toMatch(/:\s*NodeProps</)
    // Positive control: the adapter DOES construct them, so the forms are real.
    expect(phaseNodeSource).toMatch(/<Handle[\s/>]/)
    expect(phaseNodeSource).toMatch(/:\s*NodeProps</)
  })

  it("the card imports nothing from the API client", () => {
    expect(phaseNodeCardSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    // Positive control: the same regex DOES match a planted import line.
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("the card renders authored strings as text children — never the HTML sink", () => {
    // Anchored on the JSX PROP FORM, so the docblock may quote the identifier
    // verbatim (the shipped `threadGroups`/`PhaseCard` guard convention).
    expect(phaseNodeCardSource).not.toMatch(/dangerouslySetInnerHTML=/)
    expect('<p dangerouslySetInnerHTML={{ __html: x }} />').toMatch(/dangerouslySetInnerHTML=/)
  })

  it("the card reads no DOM, no clock and no randomness", () => {
    expect(phaseNodeCardSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })
})

describe("nodePresentation — the 184-03 hard cut (source guard)", () => {
  // `GROUNDING_TONE` stays in the regex below even though Phase 185 deleted it: the
  // guard's job flips from "no second copy" to "no resurrection" and the assertion is
  // identical either way.
  it("PhaseNode declares no second copy of the tint table, the tone map or the mark resolver", () => {
    expect(phaseNodeSource).not.toMatch(/const (ICON_TINT|DEFAULT_TINT|GROUNDING_TONE)\b/)
    expect(phaseNodeSource).not.toMatch(/function renderPhaseMark/)
  })

  it("PhaseNode imports them instead — no re-export shim was left behind", () => {
    expect(phaseNodeSource).toMatch(/from "@\/components\/workflows\/nodePresentation"/)
    expect(phaseNodeSource).not.toMatch(/export \{[^}]*ICON_TINT/)
  })

  it("the control: nodePresentation IS where the surviving three are declared", () => {
    expect(nodePresentationSource).toMatch(/export const ICON_TINT/)
    expect(nodePresentationSource).toMatch(/export const DEFAULT_TINT/)
    expect(nodePresentationSource).toMatch(/export function renderPhaseMark/)
    // Phase 185 (SPEC Req 6): the grounding tone map went with the word-badge it
    // coloured. Governance spends no colour and no badge slot, so a live
    // three-face-in-colour table is a resurrection risk, not harmless dead code.
    // Asserted as an ABSENCE here — the `:377` guard above independently forbids a
    // local copy reappearing in `PhaseNode.tsx`.
    expect(nodePresentationSource).not.toMatch(/export const GROUNDING_TONE/)
    // Positive control: the regex still matches a planted declaration.
    expect("export const GROUNDING_TONE = {}").toMatch(/export const GROUNDING_TONE/)
  })

  it("the tint values did not drift on the move", () => {
    expect(ICON_TINT.llm_agent).toBe("hsl(239 90% 70% / 0.40)")
    expect(ICON_TINT.llm_batch_agents).toBe("hsl(170 80% 55% / 0.34)")
    expect(DEFAULT_TINT).toBe("hsl(220 30% 100% / 0.18)")
    expect(Object.keys(ICON_TINT)).toHaveLength(6)
  })
})

/**
 * ── 184-08 (VALID-03 · R8 · R9) — the server's verdict mark ──────────────────────
 *
 * APPENDED, not woven in: everything above this line is Wave 0's and stays Wave 0's.
 * Exactly one assertion above was narrowed — the byte-identical proof no longer passes
 * `verdict`, because this plan renders it — and the reason is written at that
 * assertion rather than here, where a later reader would not find it.
 */
describe("PhaseNodeCard — the verdict mark comes from the SERVER (VALID-03)", () => {
  it('verdict="error" renders the ✕ mark with its accessible label', () => {
    renderCard({ verdict: "error" })
    const mark = screen.getByTestId("canvas-node-verdict")
    expect(mark.getAttribute("data-verdict")).toBe("error")
    expect(mark.textContent).toContain(VERDICT_MARK.error.glyph)
    expect(mark.textContent).toContain(VERDICT_MARK.error.label)
    expect(VERDICT_MARK.error.glyph).toBe("✕")
    expect(VERDICT_MARK.error.label.length).toBeGreaterThan(0)
  })

  it('verdict="incomplete" renders the DASHED ○ with its own label', () => {
    renderCard({ verdict: "incomplete" })
    const mark = screen.getByTestId("canvas-node-verdict")
    expect(mark.getAttribute("data-verdict")).toBe("incomplete")
    expect(mark.textContent).toContain("○")
    expect(mark.textContent).toContain(VERDICT_MARK.incomplete.label)
    // The dashed border is the non-colour visual carrier that separates it from ✕.
    expect(mark.className).toContain("border-dashed")
  })

  it('verdict="unknown" renders a degraded mark whose words do NOT read as clean', () => {
    renderCard({ verdict: "unknown" })
    const mark = screen.getByTestId("canvas-node-verdict")
    expect(mark.getAttribute("data-verdict")).toBe("unknown")
    expect(mark.textContent).toContain(VERDICT_MARK.unknown.label)
    // "We could not check" must never render as "fine" (sketch 139, What to Look For 3).
    expect(mark.textContent).not.toMatch(/\bok\b|clean|fine|pass(ed|es)?\b|all good|✓/i)
    // …and it is not silently absent either, which would read as clean by omission.
    expect((mark.textContent ?? "").trim().length).toBeGreaterThan(0)
  })

  it("every mark is an aria-hidden glyph PLUS a real accessible label (never colour alone)", () => {
    for (const kind of ["error", "incomplete", "unknown"] as const) {
      const { container, unmount } = renderCard({ verdict: kind })
      const mark = container.querySelector('[data-testid="canvas-node-verdict"]')
      const glyph = mark?.querySelector('[aria-hidden="true"]')
      const label = mark?.querySelector(".sr-only")
      expect(glyph?.textContent).toBe(VERDICT_MARK[kind].glyph)
      expect(label?.textContent).toBe(VERDICT_MARK[kind].label)
      expect(VERDICT_MARK[kind].label.trim().length).toBeGreaterThan(0)
      // Never the dimmed muted variant for meaningful text (PhaseCard.tsx:17-20).
      expect(VERDICT_MARK[kind].className).not.toContain("muted-foreground-dim")
      unmount()
    }
  })

  it("VALID-03's headline proof: identical props except the verdict produce DIFFERENT marks", () => {
    // Nothing local differs — same slug, same type, same title, same tint, same badges.
    // The ONLY input that changed is the value the server derived.
    const shared = { badges: [groundingBadge] as BadgeSlots, slug: "draft" }

    const a = renderCard({ ...shared, verdict: "incomplete" })
    const incompleteHtml = a.container.innerHTML
    const incompleteMark = a.container
      .querySelector('[data-testid="canvas-node-verdict"]')
      ?.getAttribute("data-verdict")
    a.unmount()

    const b = renderCard({ ...shared, verdict: "error" })
    const errorHtml = b.container.innerHTML
    const errorMark = b.container
      .querySelector('[data-testid="canvas-node-verdict"]')
      ?.getAttribute("data-verdict")

    expect(incompleteMark).toBe("incomplete")
    expect(errorMark).toBe("error")
    expect(errorHtml).not.toBe(incompleteHtml)
  })

  it("the verdict slot ABSENT still renders no verdict element (the Wave-0 half that survives)", () => {
    const { container } = renderCard({ badges: [groundingBadge], status: "running" })
    expect(container.querySelector('[data-testid="canvas-node-verdict"]')).toBeNull()
    const testIds = Array.from(container.querySelectorAll("[data-testid]")).map((el) =>
      el.getAttribute("data-testid"),
    )
    expect(testIds.some((id) => id?.includes("verdict"))).toBe(false)
  })

  it("a card carrying a verdict mark still contains NO focusable control", () => {
    // One tab stop per node. A pressable mark would make it two, and the shipped
    // canvas-level walk (WorkflowCanvas.test.tsx:231-238) would go red.
    for (const kind of ["error", "incomplete", "unknown"] as const) {
      const { container, unmount } = renderCard({
        verdict: kind,
        badges: [groundingBadge, waitsBadge],
        selected: true,
      })
      expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
      unmount()
    }
  })

  it("the mark does not animate — motion keys off run state, never selection", () => {
    const { container } = renderCard({ verdict: "error", selected: true })
    const mark = container.querySelector('[data-testid="canvas-node-verdict"]')
    expect(mark?.className ?? "").not.toMatch(/animate-|transition-|motion-safe:/)
  })
})

describe("PhaseNodeCard — R9: the colour budget, scanned rather than eyeballed", () => {
  it("3 incomplete cards and 0 error cards emit the destructive token ZERO times", () => {
    // The exact state sketch 139 calls "Mid-build": three things not finished, nothing
    // broken, ok:false. If this reads as alarming, the surface is wrong — that is the
    // state a canvas spends most of its life in.
    const { container } = render(
      <>
        <PhaseNodeCard
          slug="gather"
          phaseType="programmatic"
          icon={null}
          title="Gather the inputs"
          tint={ICON_TINT.programmatic}
          verdict="incomplete"
        />
        <PhaseNodeCard
          slug="draft"
          phaseType="llm_single"
          icon={null}
          title="Draft the section"
          tint={ICON_TINT.llm_single}
          verdict="incomplete"
        />
        <PhaseNodeCard
          slug="emit"
          phaseType="llm_emit"
          icon={null}
          title="Write the deliverable"
          tint={ICON_TINT.llm_emit}
          verdict="incomplete"
        />
      </>,
    )

    expect(container.querySelectorAll('[data-testid="canvas-node-verdict"]')).toHaveLength(3)
    const occurrences = container.innerHTML.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1
    expect(occurrences).toBe(0)
  })

  it("the POSITIVE CONTROL: one error card DOES emit it", () => {
    // Without this, the scan above would pass just as happily on a typo'd token, on an
    // empty render, or on a mark that stopped rendering at all.
    const { container } = renderCard({ verdict: "error" })
    const occurrences = container.innerHTML.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(1)
  })

  it("the token literal is REAL — it is the one the error mark's classes actually name", () => {
    expect(VERDICT_MARK.error.className).toContain(VERDICT_DESTRUCTIVE_TOKEN)
    expect(VERDICT_MARK.incomplete.className).not.toContain(VERDICT_DESTRUCTIVE_TOKEN)
    expect(VERDICT_MARK.unknown.className).not.toContain(VERDICT_DESTRUCTIVE_TOKEN)
  })

  it("no card body, badge or icon well spends the destructive token either", () => {
    // The scan is only meaningful if the rest of the card is neutral to begin with —
    // otherwise a stray destructive class elsewhere would mask a regression in the mark.
    const { container } = renderCard({ badges: [groundingBadge, waitsBadge], selected: true })
    expect(container.innerHTML).not.toContain(VERDICT_DESTRUCTIVE_TOKEN)
  })
})

/**
 * ── 185-01 (GOVERN-02 · D-185-17 · SPEC acceptance criterion 23) — MARK OCCUPANCY ──
 *
 * APPENDED, not woven in: everything above this line belongs to 184-03 and 184-08 and
 * stays theirs. Exactly one assertion in this file was touched by 185-01 — none — and
 * exactly one constant moved beneath it (`CANVAS_LAYOUT.NODE_MIN_HEIGHT`, 96 → 104),
 * which this block reads rather than re-types.
 *
 * WHAT THIS PROVES. SPEC criterion 23 reads: *"Verdict mark at the card's LEFT; zone
 * check over {icon, verdict, seal, stepNumber, run-state} = 0 overlaps."* A bounding-box
 * zone check is exactly how sketch 147 computed the 3×17px seal/verdict collision it
 * reported, so this is that same audit, moved from a sketch into the suite.
 *
 * THE BOXES ARE DERIVED FROM THE COMPONENT, NOT RE-TYPED. `boxOf` parses the Tailwind
 * placement classes off the ELEMENTS THE CARD ACTUALLY RENDERS, and its container
 * dimensions come from `CANVAS_LAYOUT`. Editing a placement class in `PhaseNodeCard.tsx`
 * therefore moves these boxes — which is what makes the check falsifiable rather than a
 * second, drift-prone copy of the geometry. The falsification block at the foot of this
 * file feeds the PRE-REBUILD 137-D classes through the same parser and pins the 14×8px
 * overlap D-185-17 computed, so the checker is provably able to go red.
 *
 * WHAT IS AND IS NOT IN THE TABLE. The zone check runs over marks this plan RENDERS:
 * the icon well and the verdict mark. The `stepNumber` slot is in the table flagged
 * `rendered: false` — D-183-07 keeps `phase_index` off the face, so it paints nothing —
 * and its known graze against the relocated verdict is pinned separately and on purpose,
 * as a residual with a written remedy rather than as a silent tolerance. The governance
 * seal (185-09) and the run-state slot (Phase 188) do not exist yet; adding either is a
 * ONE-LINE table edit — 185-09 adds `{ name: "governance seal", rendered: true, box:
 * { x0: 227, y0: 11, x1: 248, y1: 32 } }` (the sketch-143-A 21×21 mark at the card's
 * top-right) and this file's assertions then cover it with no other change.
 */

/** A mark's axis-aligned box, in NODE-BOX coordinates: the origin is the top-left of
 *  the `position: relative` wrapper every mark is absolutely positioned against. */
interface MarkBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface MarkZone {
  name: string
  /** False for a slot that is DECLARED but paints nothing (D-183-07's `stepNumber`). */
  rendered: boolean
  box: MarkBox
}

/** Tailwind's 4px spacing scale. `1.5` → 6px, `14` → 56px. */
function twSpacing(token: string): number {
  const n = Number(token)
  if (!Number.isFinite(n)) throw new Error(`not a Tailwind spacing token: ${token}`)
  return n * 4
}

/** A size from `h-[62px]` / `w-14`. Throws rather than defaulting — a silent 0 would
 *  make every overlap vanish, i.e. it would make this whole check pass by accident. */
function sizeOf(className: string, axis: "h" | "w"): number {
  const arbitrary = new RegExp(`(?:^|\\s)${axis}-\\[(\\d+)px\\]`).exec(className)
  if (arbitrary) return Number(arbitrary[1])
  const scale = new RegExp(`(?:^|\\s)${axis}-(\\d+(?:\\.\\d+)?)(?:\\s|$)`).exec(className)
  if (scale) return twSpacing(scale[1])
  throw new Error(`no ${axis}- size class in: ${className}`)
}

/** The x of a mark's LEFT edge. Handles the six placement forms this card spends:
 *  `left-1/2` + `-translate-x-1/2` (centred), `left-N`, `-left-N`, `-right-N`, and —
 *  added by 185-09 for the governance seal — the ARBITRARY forms `left-[Npx]` /
 *  `right-[Npx]`. The arbitrary branches are checked FIRST because the token regexes
 *  below require a digit immediately after the dash and would otherwise fall through to
 *  the throw, turning a real placement into "no horizontal placement class". */
function xOf(className: string, width: number, containerWidth: number): number {
  if (/(?:^|\s)left-1\/2(?:\s|$)/.test(className)) {
    if (!/(?:^|\s)-translate-x-1\/2(?:\s|$)/.test(className)) {
      throw new Error(`left-1/2 without -translate-x-1/2 is not a centring form: ${className}`)
    }
    return containerWidth / 2 - width / 2
  }
  const arbitraryLeft = /(?:^|\s)left-\[(-?\d+)px\](?:\s|$)/.exec(className)
  if (arbitraryLeft) return Number(arbitraryLeft[1])
  const arbitraryRight = /(?:^|\s)right-\[(-?\d+)px\](?:\s|$)/.exec(className)
  if (arbitraryRight) return containerWidth - Number(arbitraryRight[1]) - width
  const negLeft = /(?:^|\s)-left-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (negLeft) return -twSpacing(negLeft[1])
  const left = /(?:^|\s)left-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (left) return twSpacing(left[1])
  const negRight = /(?:^|\s)-right-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (negRight) return containerWidth + twSpacing(negRight[1]) - width
  const right = /(?:^|\s)right-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (right) return containerWidth - twSpacing(right[1]) - width
  throw new Error(`no horizontal placement class in: ${className}`)
}

/** The y of a mark's TOP edge. Handles `top-1/2` + `-translate-y-1/2`, `top-[-26px]`,
 *  `-top-N` and `top-N`. */
function yOf(className: string, height: number, containerHeight: number): number {
  if (/(?:^|\s)top-1\/2(?:\s|$)/.test(className)) {
    if (!/(?:^|\s)-translate-y-1\/2(?:\s|$)/.test(className)) {
      throw new Error(`top-1/2 without -translate-y-1/2 is not a centring form: ${className}`)
    }
    return containerHeight / 2 - height / 2
  }
  const arbitrary = /(?:^|\s)top-\[(-?\d+)px\](?:\s|$)/.exec(className)
  if (arbitrary) return Number(arbitrary[1])
  const negTop = /(?:^|\s)-top-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (negTop) return -twSpacing(negTop[1])
  const top = /(?:^|\s)top-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className)
  if (top) return twSpacing(top[1])
  throw new Error(`no vertical placement class in: ${className}`)
}

function boxOf(className: string, containerWidth: number, containerHeight: number): MarkBox {
  const width = sizeOf(className, "w")
  const height = sizeOf(className, "h")
  const x0 = xOf(className, width, containerWidth)
  const y0 = yOf(className, height, containerHeight)
  return { x0, y0, x1: x0 + width, y1: y0 + height }
}

/** Intersection area in px². Zero when the boxes merely touch — a shared edge is not
 *  an overlap, and treating it as one would forbid perfectly legal adjacency. */
function overlapArea(a: MarkBox, b: MarkBox): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 ? w * h : 0
}

/** Read the three rendered marks' classes back off a real render of the card.
 *
 *  185-09 added the seal, which means this render must pass `grounded` — a card that is
 *  not grounded paints no seal at all, and a silently-empty class string would make
 *  every seal box collapse to `no size class` and throw rather than pass vacuously
 *  (`sizeOf` refuses to default). The verdict and icon classes are unaffected by it. */
function renderedMarkClasses(): { icon: string; verdict: string; seal: string } {
  const { container, unmount } = renderCard({ verdict: "error", grounded: true })
  // The icon well is the PARENT of the radial-gradient tint layer — the same handle
  // `wellBackground` above already uses, so there is one way to find it in this file.
  const well = container.querySelector('[style*="radial-gradient"]')?.parentElement
  const verdict = container.querySelector('[data-testid="canvas-node-verdict"]')
  const seal = container.querySelector(`[data-testid="${SEAL_TEST_ID}"]`)
  const classes = {
    icon: well?.className ?? "",
    verdict: verdict?.className ?? "",
    seal: seal?.className ?? "",
  }
  unmount()
  return classes
}

/** The 137-B `.stepn` slot (`themes/canvas-184.css`: `top: 12px; left: 12px`, 22×22).
 *  Declared here rather than read from the DOM because the card renders NOTHING for it
 *  — which is precisely the fact the residual assertion below turns on. */
const STEP_NUMBER_BOX: MarkBox = { x0: 12, y0: 12, x1: 34, y1: 34 }

/**
 * The four marks criterion 23 names, three of them measured off the DOM.
 *
 * WHAT IS STILL NOT IN THE TABLE, and where Phase 188 must add it: the RUN-STATE slot.
 * `status` is declared on `PhaseNodeCardProps` and renders NOTHING today, so it has no
 * box to measure and listing it with an invented one would be a geometry claim nobody
 * has made. Phase 188 adds a `{ name: "run state", rendered: true, box: boxOf(...) }`
 * row HERE, from the classes of the element it renders, and every assertion below then
 * covers it with no other change — exactly how 185-09 added the seal to the table
 * 185-01 built. The one corner it may NOT use is top-right: SPEC Req 6 claims it for
 * governance, and the seal's own docblock in `PhaseNodeCard.tsx` says so.
 */
function markTable(): MarkZone[] {
  const { icon, verdict, seal } = renderedMarkClasses()
  const w = CANVAS_LAYOUT.NODE_WIDTH
  const h = CANVAS_LAYOUT.NODE_MIN_HEIGHT
  return [
    { name: "icon well", rendered: true, box: boxOf(icon, w, h) },
    { name: "verdict", rendered: true, box: boxOf(verdict, w, h) },
    { name: "governance seal", rendered: true, box: boxOf(seal, w, h) },
    { name: "stepNumber", rendered: false, box: STEP_NUMBER_BOX },
  ]
}

describe("PhaseNodeCard — 137-B mark occupancy (SPEC criterion 23)", () => {
  it("the verdict mark is on the card's LEFT — top-right is CLAIMED for governance", () => {
    const { verdict } = renderedMarkClasses()
    expect(verdict).toContain("-left-2")
    expect(verdict).not.toContain("-right-2")
  })

  it("the icon well FLOATS above the card's top edge, centred on the 260px node box", () => {
    const table = markTable()
    const icon = table.find((z) => z.name === "icon well")?.box
    // 62px wide, centred in the 260px node box ⇒ 99…161; 26px above the top edge ⇒
    // −26…36. Both numbers are `body.card-b .node .icowrap`, verbatim.
    expect(icon).toEqual({ x0: 99, y0: -26, x1: 161, y1: 36 })
  })

  it("the verdict mark straddles the 248px card's left border", () => {
    const table = markTable()
    const verdict = table.find((z) => z.name === "verdict")?.box
    expect(verdict).toEqual({ x0: -8, y0: 6, x1: 14, y1: 28 })
    // The card is 248px centred in the 260px box, so its left border sits at x = 6 —
    // strictly INSIDE the mark's span. On 137-D the border was at x = 24 and the mark
    // floated 10px clear of it, which is half of why D-185-17 exists.
    const cardLeftBorder = (CANVAS_LAYOUT.NODE_WIDTH - 248) / 2
    expect(cardLeftBorder).toBe(6)
    expect(verdict!.x0).toBeLessThan(cardLeftBorder)
    expect(verdict!.x1).toBeGreaterThan(cardLeftBorder)
  })

  it("every pair of RENDERED marks reports ZERO overlap (acceptance criterion 23)", () => {
    const rendered = markTable().filter((zone) => zone.rendered)
    // Guard against a vacuous pass: if the card ever stops rendering a mark, this
    // check would trivially succeed over an empty or one-element set. 185-09 widened
    // the expected set from two names to three — the seal joined the rendered marks,
    // so a seal that silently stops painting fails HERE rather than in a screenshot.
    expect(rendered.map((z) => z.name)).toEqual(["icon well", "verdict", "governance seal"])

    const collisions: string[] = []
    for (let i = 0; i < rendered.length; i += 1) {
      for (let j = i + 1; j < rendered.length; j += 1) {
        const area = overlapArea(rendered[i].box, rendered[j].box)
        if (area > 0) collisions.push(`${rendered[i].name} × ${rendered[j].name} = ${area}px²`)
      }
    }
    expect(collisions).toEqual([])
  })

  it("records the residual: the verdict grazes the UNRENDERED stepNumber slot by 2×16px", () => {
    // Not a tolerance and not a bug — a written residual (sketch 147 §RESOLVED item 2).
    // The slot paints nothing today, so criterion 23's "between rendered marks" is met;
    // this pins the exact number so bringing `phase_index` to the face cannot land the
    // two on top of each other unnoticed.
    const table = markTable()
    const verdict = table.find((z) => z.name === "verdict")!
    const stepNumber = table.find((z) => z.name === "stepNumber")!
    expect(stepNumber.rendered).toBe(false)
    expect(overlapArea(verdict.box, stepNumber.box)).toBe(32) // 2px × 16px

    // The slot really does render nothing — the `rendered: false` flag is a fact about
    // the component, not an assumption this table makes about it.
    const { container } = renderCard({ verdict: "error", stepNumber: 3 })
    expect(container.textContent).not.toContain("3")

    // The written remedy, asserted rather than promised: at `left: 16` the graze clears.
    const movedToLeft16: MarkBox = { x0: 16, y0: 12, x1: 38, y1: 34 }
    expect(overlapArea(verdict.box, movedToLeft16)).toBe(0)
  })
})

/**
 * ── THE FALSIFICATION ────────────────────────────────────────────────────────────
 *
 * A zone check that has never been red is not evidence. This block feeds the PRE-REBUILD
 * 137-D placement classes — quoted verbatim from the parent commit of the 185-01 rebuild
 * — through the SAME `boxOf` / `overlapArea` the green check above uses, and pins the
 * collision D-185-17 computed by hand. If the parser ever silently starts returning
 * empty boxes, this goes red before the green check can go vacuous.
 *
 * The executor ALSO performed the physical falsification during 185-01 Task 2: the card
 * was temporarily reverted to the 137-D icon well (and `NODE_MIN_HEIGHT` to 96, since
 * the well's `top-1/2` placement is a function of it) while keeping the SPEC's left
 * verdict, and the suite was run. It reported, verbatim:
 *
 *     FAIL  src/components/workflows/PhaseNodeCard.test.tsx > PhaseNodeCard — 137-B
 *     mark occupancy (SPEC criterion 23) > every pair of RENDERED marks reports ZERO
 *     overlap (acceptance criterion 23)
 *     AssertionError: expected [ 'icon well × verdict = 112px²' ] to deeply equal []
 *
 *     FAIL  … > the icon well FLOATS above the card's top edge, centred on the 260px
 *     node box
 *     AssertionError: expected { x0: +0, y0: 20, x1: 56, y1: 76 } to deeply equal
 *     { x0: 99, y0: -26, x1: 161, y1: 36 }
 *
 * 112px² = 14 × 8, which is exactly the overlap 185-CONTEXT §F D-185-17 computed against
 * the shipped card, and `{0, 20, 56, 76}` is exactly the icon well it computed it from.
 * That is the number this whole plan exists to remove.
 */
const PRE_REBUILD_137D = {
  /** `PhaseNodeCard.tsx` before 185-01 — the icon well pinned to the card's left edge. */
  icon: "pointer-events-none absolute left-0 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center",
  /** SPEC Req 6's left verdict, as it would have landed on the un-rebuilt card. */
  verdict: "pointer-events-none absolute -left-2 top-1.5 z-[8] grid h-[22px] w-[22px]",
  /** `CANVAS_LAYOUT.NODE_MIN_HEIGHT` before 185-01 raised it. */
  minHeight: 96,
} as const

describe("PhaseNodeCard — the occupancy check CAN go red (falsification control)", () => {
  it("the same checker reports a 14×8px collision on the pre-rebuild 137-D card", () => {
    const w = CANVAS_LAYOUT.NODE_WIDTH
    const h = PRE_REBUILD_137D.minHeight
    const icon = boxOf(PRE_REBUILD_137D.icon, w, h)
    const verdict = boxOf(PRE_REBUILD_137D.verdict, w, h)

    // The two boxes D-185-17 computed by hand, reproduced by the parser.
    expect(icon).toEqual({ x0: 0, y0: 20, x1: 56, y1: 76 })
    expect(verdict).toEqual({ x0: -8, y0: 6, x1: 14, y1: 28 })
    expect(overlapArea(icon, verdict)).toBe(112) // 14px × 8px

    // …and it is REALLY gone on the shipped card, measured by the same function.
    const shipped = markTable().filter((z) => z.rendered)
    expect(overlapArea(shipped[0].box, shipped[1].box)).toBe(0)
  })

  it("the pre-rebuild card could not straddle its own left border either", () => {
    // The second half of D-185-17: on 137-D the frosted card was pushed 24px right, so
    // a mark at `-left-2` (x −8…14) floated 10px clear of the border at x = 24 — it was
    // not "on the card's left edge" in any sense. No left placement was reachable.
    const verdict = boxOf(PRE_REBUILD_137D.verdict, CANVAS_LAYOUT.NODE_WIDTH, PRE_REBUILD_137D.minHeight)
    const preRebuildCardLeftBorder = 24
    expect(verdict.x1).toBeLessThan(preRebuildCardLeftBorder)
    expect(preRebuildCardLeftBorder - verdict.x1).toBe(10)
  })
})

/**
 * ── 185-09 (GOVERN-02 · SPEC Req 6 · sketch 143-A) — THE GOVERNANCE SEAL ─────────────
 *
 * APPENDED, not woven in: everything above belongs to 184-03 / 184-08 / 185-01 and stays
 * theirs. Exactly ONE shipped assertion was touched — the zero-overlap check's
 * non-vacuity NAME LIST grew from two entries to three — and it had to be: this plan
 * renders a third mark, so a list that still said two would have had to be wrong for the
 * check to pass. Nothing was deleted and no expectation was weakened.
 *
 * WHAT jsdom CAN AND CANNOT PROVE HERE. Criterion 16 reads *"the corner seal renders
 * identically across idle / running / needs-you / failed"*. jsdom computes no paint, so
 * the VISUAL half is operator UAT — `185-VALIDATION.md` §"G-4 lived-experience UAT"
 * scenario 2, *"the seal survives a live run"*, whose failure condition is the seal
 * dimming, hiding, shifting or being swallowed by the status colour. What IS mechanically
 * checkable is stronger than a screenshot of any one state: **the seal markup cannot read
 * run state at all.** Two guards below say so — a `?raw` props fence over the seal's own
 * JSX block, and a four-value render asserting the rendered class list and text are
 * identical. A surface that cannot express a dependency cannot regress into one.
 *
 * CRITERION 17 IS OPERATOR UAT ONLY, deliberately not simulated. *"A colour-stripped
 * render still distinguishes grounded from open"* needs computed paint — a greyscale
 * screenshot of the real canvas — and it is recorded as manual in `185-VALIDATION.md`
 * §"Acceptance Criteria → Cheapest Honest Proof" row 17. A jsdom test that inspected
 * class names and CLAIMED to have checked a greyscale render would be worse than no test:
 * it would retire a manual check without performing it. What this file contributes toward
 * it instead is the colour scan below — the seal spends no colour token, so there is
 * nothing for greyscale to take away.
 */

/**
 * The run-state prop's name, ASSEMBLED from fragments rather than spelled.
 *
 * The point of the fence is that the seal's MARKUP never reads run state. The card's
 * docblock, by contrast, must be free to SAY that — it explains the whole reason the seal
 * exists. A guard that searched this file's own literal, or that scanned the component
 * whole, could only pass by making that explanation disappear: the D-ITEM-183-02 trap
 * this project has now hit half a dozen times. So the needle is assembled, and the
 * haystack is the extracted BLOCK rather than the file.
 */
const STATUS_PROP = ["sta", "tus"].join("")

/** A fresh regex per call — a shared one carries `lastIndex` state between assertions. */
function statusIdentifier(): RegExp {
  return new RegExp(`\\b${STATUS_PROP}\\b`)
}

const SEAL_GUARD_OPEN = "{grounded ? ("
const SEAL_GUARD_CLOSE = ") : null}"

/**
 * Carve the seal's JSX block out of a component source: from the guard that opens it to
 * the guard that closes it, anchored on the seal's test id so it cannot latch onto the
 * verdict mark's structurally identical block above it.
 *
 * Throws rather than returning `""` on a miss. A silently empty slice would make every
 * absence assertion below pass vacuously, which is the one failure mode a source fence
 * has to be built against.
 */
function sealJsxBlock(source: string): string {
  const anchor = source.indexOf(SEAL_TEST_ID)
  if (anchor < 0) throw new Error(`no ${SEAL_TEST_ID} in the source under guard`)
  const start = source.lastIndexOf(SEAL_GUARD_OPEN, anchor)
  const end = source.indexOf(SEAL_GUARD_CLOSE, anchor)
  if (start < 0 || end < 0) throw new Error("could not carve the seal's JSX block")
  return source.slice(start, end + SEAL_GUARD_CLOSE.length)
}

/** The positive control: a seal that DOES read run state, in the same shape as the real
 *  one so the extractor carves it identically. Built from the same assembled token, so
 *  this file still never spells the prop name. */
const PLANTED_SEAL_SOURCE = `
      {/* a docblock, which the fence must NOT be reading */}
      ${SEAL_GUARD_OPEN}
        <span
          data-testid="${SEAL_TEST_ID}"
          data-grounded="true"
          className={cn(
            "pointer-events-none absolute right-[17px] top-[11px]",
            ${STATUS_PROP} === "running" ? "opacity-40" : "",
          )}
        >
          <span aria-hidden="true">S</span>
          <span className="sr-only">{GOVERNANCE_SEAL_LABEL}</span>
        </span>
      ${SEAL_GUARD_CLOSE}
`

describe("PhaseNodeCard — the seal cannot READ run state (props fence, criterion 16)", () => {
  it("the extractor really carves the seal's block — a slice, not nothing and not the file", () => {
    const block = sealJsxBlock(phaseNodeCardSource)
    expect(block).toContain(SEAL_TEST_ID)
    expect(block).toContain("aria-hidden")
    expect(block).toContain("sr-only")
    expect(block.startsWith(SEAL_GUARD_OPEN)).toBe(true)
    expect(block.endsWith(SEAL_GUARD_CLOSE)).toBe(true)
    // Not the whole file — otherwise the fence would be scanning the docblocks it is
    // deliberately scoped to exclude, and would go red for the wrong reason.
    expect(block.length).toBeLessThan(phaseNodeCardSource.length / 4)
  })

  it("the seal's JSX block never names the run-state prop", () => {
    expect(sealJsxBlock(phaseNodeCardSource)).not.toMatch(statusIdentifier())
  })

  it("the POSITIVE CONTROL: a seal that DID read run state turns this fence red", () => {
    // Without this, the assertion above would pass just as happily on a typo'd needle,
    // on an extractor that returned the wrong slice, or on a regex that matched nothing.
    expect(sealJsxBlock(PLANTED_SEAL_SOURCE)).toMatch(statusIdentifier())
  })

  it("the fence is SCOPED — the card's docblock is still free to name the prop", () => {
    // The component explains, at length, why the seal must not depend on run state. It
    // cannot do that without naming it. This asserts the needle is real against the real
    // file, and pins that the scoping is intentional rather than an accident of spelling.
    expect(phaseNodeCardSource).toMatch(statusIdentifier())
  })

  it("renders a BYTE-IDENTICAL seal at all four run states (the strongest jsdom form)", () => {
    // The visual claim is UAT (G-4 #2). This is the part a machine can hold: the seal's
    // whole rendered element, whatever the run says. `status` is typed as an open string
    // in 184, so these are the four states criterion 16 names, not a library union.
    //
    // IT COMPARES `outerHTML`, AND THAT IS A CORRECTION THIS PLAN'S OWN FALSIFICATION
    // FORCED. Written first as `{ className, textContent }`, it stayed GREEN while a
    // planted `data-run={props.status}` sat on the seal — an attribute-level dependency
    // on run state is invisible to both of those readings. The props fence caught it and
    // this did not, so the two guards were not the complementary pair they were meant to
    // be. `outerHTML` closes it: every attribute, class and character is in the compare.
    const readings = ["idle", "running", "needs-you", "failed"].map((runState) => {
      const { container, unmount } = renderCard({ grounded: true, status: runState })
      const seal = container.querySelector(`[data-testid="${SEAL_TEST_ID}"]`)
      expect(seal).not.toBeNull()
      const reading = seal!.outerHTML
      unmount()
      return reading
    })

    expect(readings).toHaveLength(4)
    for (const reading of readings) expect(reading).toBe(readings[0])
    // Non-vacuity: the value being compared is a real seal, not an empty string.
    expect(readings[0].length).toBeGreaterThan(0)
    expect(readings[0]).toContain(GOVERNANCE_SEAL_LABEL)
    expect(readings[0]).toContain(SEAL_TEST_ID)
  })
})

/** The frosted card's own class list — the element the sealed EDGE lives on. It is the
 *  wrapper's first `div` child; the marks around it are all `span`s. */
function frostedCardClasses(
  overrides: Partial<React.ComponentProps<typeof PhaseNodeCard>> = {},
): string {
  const { container, unmount } = renderCard(overrides)
  const card = container.querySelector('[data-testid="canvas-node-summarize"] > div')
  const className = card?.className ?? ""
  unmount()
  if (className.length === 0) throw new Error("did not find the frosted card element")
  return className
}

/** 143-A's reinforcement colour, as the card spends it. Read from the DOM below rather
 *  than trusted from here — this literal is only the needle. */
const SEALED_EDGE_TOKEN = "border-[hsl(220_30%_100%/0.34)]"

describe("PhaseNodeCard — the seal is made of SHAPE, and the edge only reinforces it", () => {
  it("renders NO seal when grounded is omitted, and none when it is explicitly false", () => {
    for (const overrides of [{}, { grounded: false }]) {
      const { container, unmount } = renderCard(overrides)
      expect(container.querySelector(`[data-testid="${SEAL_TEST_ID}"]`)).toBeNull()
      expect(container.querySelectorAll("[data-grounded]")).toHaveLength(0)
      unmount()
    }
  })

  it("renders one seal with an aria-hidden glyph PLUS a real accessible label", () => {
    renderCard({ grounded: true })
    const seal = screen.getByTestId(SEAL_TEST_ID)
    expect(seal.getAttribute("data-grounded")).toBe("true")
    expect(seal.querySelector('[aria-hidden="true"]')?.textContent).toBe("⛨")
    expect(seal.querySelector(".sr-only")?.textContent).toBe(GOVERNANCE_SEAL_LABEL)
    // The glyph is decoration; the WORDS carry the meaning (WCAG 1.4.1, never shape or
    // colour alone) — so a screen-reader user hears the same claim a sighted one reads.
    expect(GOVERNANCE_SEAL_LABEL.trim().length).toBeGreaterThan(0)
  })

  it("speaks Req 7's BINDING words, and the panel's dial still speaks the same ones", () => {
    // The vocabulary is a LOCK: an unrun step is never "proven", because nothing is
    // proven until a run's citation gate passes. This is the assertion `definitionOps`'
    // own docblock promises exists, so the two homes cannot be edited apart silently.
    expect(GOVERNANCE_SEAL_LABEL).toBe("Must prove it")
    expect(GROUNDING_DIAL_STRICT_LABEL.endsWith(GOVERNANCE_SEAL_LABEL)).toBe(true)

    const { container } = renderCard({ grounded: true, verdict: "incomplete" })
    expect(container.textContent ?? "").not.toMatch(/\bproven\b|\bungoverned\b|\bunchecked\b/i)
  })

  it("spends NO colour — a grounded card emits the destructive token zero times", () => {
    // 137-B banks all colour for Phase 188's run status, so governance is shape only.
    // Scanned rather than eyeballed, the R9 way, and over the loudest card the contract
    // allows: grounded, selected, badged.
    const { container } = renderCard({ grounded: true, badges: [waitsBadge], selected: true })
    expect(container.innerHTML).not.toContain(VERDICT_DESTRUCTIVE_TOKEN)
    const seal = screen.getByTestId(SEAL_TEST_ID)
    expect(seal.className).not.toMatch(/destructive|success|warning|amber|emerald|rose|green|red-/)
  })

  it("costs NO badge slot — a grounded card renders no extra chip (SPEC Req 6)", () => {
    // The three-face word-badge 185-08 deleted must not come back through this door.
    // Slot 1 stays empty for 188 / 189; the seal is not a badge and does not become one.
    const { container } = renderCard({ grounded: true, badges: [waitsBadge] })
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(1)
    expect(container.querySelector('[data-testid="canvas-grounding"]')).toBeNull()
  })

  it("a grounded card still contains NO focusable control (one tab stop per node)", () => {
    // A pressable seal would make it two, and the canvas-level walk in
    // `WorkflowCanvas.test.tsx` would go red. Arming and escalating happen in the panel.
    const { container } = renderCard({
      grounded: true,
      verdict: "error",
      badges: [waitsBadge],
      selected: true,
      status: "running",
    })
    expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    const seal = screen.getByTestId(SEAL_TEST_ID)
    expect(seal.getAttribute("role")).toBeNull()
    expect(seal.getAttribute("tabindex")).toBeNull()
    expect(seal.className).toContain("pointer-events-none")
  })

  it("does not animate — motion keys off run state, and the seal keys off nothing", () => {
    const seal = renderedMarkClasses().seal
    expect(seal).not.toMatch(/animate-|transition-|motion-safe:/)
  })

  it("the sealed EDGE lifts an unselected grounded card's border", () => {
    const open = frostedCardClasses()
    const grounded = frostedCardClasses({ grounded: true })
    expect(open).toContain("border-border/50")
    expect(open).not.toContain(SEALED_EDGE_TOKEN)
    expect(grounded).toContain(SEALED_EDGE_TOKEN)
    expect(grounded).not.toContain("border-border/50")
  })

  it("the edge is REINFORCEMENT: a selected grounded card keeps its primary border", () => {
    // This IS the degradation 143-A verified, not a bug: the edge is expected to be
    // overwritten — by selection today, by Phase 188's run status tomorrow — and the
    // reading survives because the seal carries its own background and border. Two
    // carriers become one; never zero.
    const selectedGrounded = frostedCardClasses({ grounded: true, selected: true })
    expect(selectedGrounded).toContain("border-primary")
    expect(selectedGrounded).not.toContain(SEALED_EDGE_TOKEN)

    // …and the surviving carrier is really still there, with its own border and its own
    // background. That is the whole argument for the corner seal over the edge alone.
    renderCard({ grounded: true, selected: true })
    const seal = screen.getByTestId(SEAL_TEST_ID)
    expect(seal.className).toContain(SEALED_EDGE_TOKEN)
    expect(seal.className).toContain("bg-[hsl(220_30%_100%/0.1)]")
  })
})

describe("PhaseNodeCard — the seal's zone (criterion 23, extended to four marks)", () => {
  it("sits at the card's top-right, 21×21, exactly 11px inside the CARD's right border", () => {
    const seal = markTable().find((z) => z.name === "governance seal")?.box
    expect(seal).toEqual({ x0: 222, y0: 11, x1: 243, y1: 32 })

    // THE NUMBER THE SKETCH LOCKED IS THE CLEARANCE A READER SEES, not the Tailwind
    // token. 143-A places the seal `top: 11px; right: 11px` inside the 248px CARD; the
    // element is a sibling of the verdict mark, so its containing block is the 260px NODE
    // BOX, whose right edge sits 6px outside the card's border. `right-[17px]` is that
    // composite. Asserting the CLEARANCE is what stops the 17 drifting from the 11 it is
    // derived from — if either number is edited alone, this goes red.
    const cardRightBorder = (CANVAS_LAYOUT.NODE_WIDTH + 248) / 2
    expect(cardRightBorder).toBe(254)
    expect(cardRightBorder - seal!.x1).toBe(11)
    expect(seal!.y0).toBe(11)
    expect(seal!.x1 - seal!.x0).toBe(21)
    expect(seal!.y1 - seal!.y0).toBe(21)

    // Unlike the verdict mark, the seal sits fully INSIDE the card — it is a property of
    // the card's face, not a flag pinned to its edge.
    expect(seal!.x1).toBeLessThan(cardRightBorder)
  })

  it("all FOUR marks are pairwise clear — the only nonzero pair is the recorded residual", () => {
    const table = markTable()
    // Non-vacuity first: four zones, in the order criterion 23 names them.
    expect(table.map((z) => z.name)).toEqual([
      "icon well",
      "verdict",
      "governance seal",
      "stepNumber",
    ])

    const collisions: string[] = []
    for (let i = 0; i < table.length; i += 1) {
      for (let j = i + 1; j < table.length; j += 1) {
        const area = overlapArea(table[i].box, table[j].box)
        if (area > 0) collisions.push(`${table[i].name} × ${table[j].name} = ${area}px²`)
      }
    }

    // The verdict × stepNumber graze is 185-01's WRITTEN residual against a slot that
    // paints nothing (D-183-07 keeps `phase_index` off the face), pinned above with its
    // remedy. Every other pair — and therefore every pair of marks a person can actually
    // SEE — is zero, which is what criterion 23 asks for.
    expect(collisions).toEqual(["verdict × stepNumber = 32px²"])
  })

  it("the seal clears the UNRENDERED stepNumber slot too, with room to spare", () => {
    const table = markTable()
    const seal = table.find((z) => z.name === "governance seal")!
    const stepNumber = table.find((z) => z.name === "stepNumber")!
    expect(stepNumber.rendered).toBe(false)
    expect(overlapArea(seal.box, stepNumber.box)).toBe(0)
    // Bringing `phase_index` to the face therefore cannot collide with governance: the
    // step number is top-LEFT and the seal is top-RIGHT, 188px of card between them.
    expect(seal.box.x0 - stepNumber.box.x1).toBe(188)
  })
})

/**
 * ── THE SEAL'S FALSIFICATION ────────────────────────────────────────────────────────
 *
 * A zone check that has never been red about the SEAL is not evidence about the seal.
 *
 * ⚠ THE PLAN'S STATED FALSIFICATION CANNOT GO RED, and the reason is worth recording
 * rather than quietly substituting: it asks for the seal to be placed at *"the verdict's
 * old `-right-2 top-1.5`"*. That corner is now EMPTY — 185-01 moved the verdict to
 * `-left-2` — so a seal placed there collides with nothing at all, which the second test
 * below asserts. The meaningful falsification is the verdict's CURRENT corner, and the
 * first test pins the 21×21 = 441px² collision it produces.
 *
 * The executor ALSO performed the physical falsification: the component's seal was
 * temporarily moved to `-left-2 top-1.5` and the suite run. Its verbatim output is quoted
 * in `185-09-SUMMARY.md`, and the seal was then restored.
 */
const SEAL_ON_THE_VERDICTS_CORNER =
  "pointer-events-none absolute -left-2 top-1.5 z-[6] grid h-[21px] w-[21px] place-items-center"
const SEAL_ON_THE_VERDICTS_OLD_CORNER =
  "pointer-events-none absolute -right-2 top-1.5 z-[6] grid h-[21px] w-[21px] place-items-center"

describe("PhaseNodeCard — the seal's zone check CAN go red (falsification control)", () => {
  it("the same checker reports a 21×21 collision when the seal takes the verdict's corner", () => {
    const w = CANVAS_LAYOUT.NODE_WIDTH
    const h = CANVAS_LAYOUT.NODE_MIN_HEIGHT
    const { verdict: verdictClasses } = renderedMarkClasses()
    const verdict = boxOf(verdictClasses, w, h)
    const planted = boxOf(SEAL_ON_THE_VERDICTS_CORNER, w, h)

    expect(planted).toEqual({ x0: -8, y0: 6, x1: 13, y1: 27 })
    expect(overlapArea(planted, verdict)).toBe(441) // 21px × 21px — the whole seal

    // …and it is REALLY zero where the seal actually ships, measured by the same
    // function on the same render. Both halves, or neither means anything.
    const shipped = markTable()
    const shippedSeal = shipped.find((z) => z.name === "governance seal")!
    const shippedVerdict = shipped.find((z) => z.name === "verdict")!
    expect(overlapArea(shippedSeal.box, shippedVerdict.box)).toBe(0)
  })

  it("records WHY the plan's stated falsification is inert: that corner is now empty", () => {
    const w = CANVAS_LAYOUT.NODE_WIDTH
    const h = CANVAS_LAYOUT.NODE_MIN_HEIGHT
    const planted = boxOf(SEAL_ON_THE_VERDICTS_OLD_CORNER, w, h)
    expect(planted).toEqual({ x0: 247, y0: 6, x1: 268, y1: 27 })

    // Against every other zone in the table: nothing. 185-01 vacated this corner, so a
    // seal parked here is merely WRONG (it hangs off the card's right edge instead of
    // sitting inside it) — it is not a collision, and a zone check is the wrong
    // instrument for it. The `right-[17px]` clearance assertion above is the one that
    // catches this class of mistake.
    for (const zone of markTable()) {
      expect(overlapArea(planted, zone.box)).toBe(0)
    }
  })
})
