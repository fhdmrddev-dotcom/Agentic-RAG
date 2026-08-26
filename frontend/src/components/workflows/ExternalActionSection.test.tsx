/**
 * Phase 189-14 Task 1 — the capability picker's proofs.
 *
 * A NET-NEW suite, mirroring `GovernanceSection.test.tsx`'s shape and for its stated
 * reason: the section is a LEAF with a flat, total prop contract, so driving it directly
 * means a red says which of the two surfaces moved. The panel's own obligation — that the
 * mount is gated on `phase_type` and reaches nothing else — is asserted in
 * `PhaseFormPanel.rails.test.tsx`, where the D-189-DEF-02 boundary guard already lives.
 * Testing the same rule through two prop paths is how a 1100-line panel grows a second
 * home for it.
 *
 * ⚠ THE FILE IS REGISTERED WITH `scripts/vitest-count-gate.cjs` IN THE COMMIT THAT
 * CREATES IT. `src/components/workflows` is already a TARGETS directory entry, so this
 * suite RUNS the moment it exists; the `BASELINE` pin is what makes it GUARDED rather
 * than merely executed (188-12's correction of the "leave a growing file unpinned"
 * exemption — an unpinned file is not lightly guarded, it is unguarded).
 *
 * THREE THINGS THIS SUITE EXISTS TO CATCH, each a named threat:
 *  - T-189-11 the client mirror drifting from the backend `Literal` — the cross-language
 *    fence at the bottom, OBSERVED RED against a planted mismatch before it was trusted.
 *  - T-189-39 a fabricated selection for a capability the client does not know.
 *  - T-189-43 the component authoring a sentence, which makes drift untestable.
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import externalActionSectionSource from "./ExternalActionSection?raw"
// The CROSS-LANGUAGE half of D-23, read through the same `?raw` loader
// `definitionOps.test.ts:29` uses. ⚠ The obvious `node:fs` spelling is wrong here:
// `tsconfig.app.json` sets `types: ["vite/client"]` and nothing else, so a `node:*`
// import would add NEW errors to the tsc baseline every plan in this phase measures.
import harnessModelsSource from "../../../../backend/app/models/harness.py?raw"
import { ExternalActionSection, type ExternalActionSectionProps } from "./ExternalActionSection"
import {
  EXTERNAL_ACTION_HEADING,
  EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
} from "./definitionOps"
import { EXTERNAL_CAPABILITY_SENTENCES } from "./phaseVocabulary"

/**
 * The CLIENT MIRROR, read from its ONE home rather than from the component.
 *
 * ⚠ `ExternalActionSection.tsx` cannot EXPORT its derived tuple — a runtime export beside
 * a component is a `react-refresh/only-export-components` lint error (measured; the
 * analog `GovernanceSection.tsx` exports two components and two TYPES and no const). It
 * reads exactly this object, and the source fence below proves it: the mirror is
 * `Object.keys(EXTERNAL_CAPABILITY_SENTENCES)` in both places, so nothing is re-typed and
 * nothing here is a second copy. The RENDER cases are the other half of the proof — they
 * assert the rows the component actually paints equal these members, in this order.
 */
const EXTERNAL_ACTION_CAPABILITIES: readonly string[] = Object.keys(EXTERNAL_CAPABILITY_SENTENCES)

function renderSection(over: Partial<ExternalActionSectionProps> = {}) {
  const props: ExternalActionSectionProps = {
    capability: "",
    // 206.2-03 — the two props the shape axis adds. Defaulted here so every SHIPPED case
    // above and below keeps its exact meaning: no tool named, and a shape writer nobody
    // calls. ⚠ THIS IS AN ADDITION TO A HELPER, NOT AN EDIT TO A CASE — the file's
    // zero-deletion diff is the assertion, and no assertion moved.
    toolName: "",
    onChangeShape: () => {},
    onChange: () => {},
    onPersist: () => {},
    ...over,
  }
  return render(<ExternalActionSection {...props} />)
}

const options = () => screen.getAllByTestId("external-action-option")

const chosenLabels = () =>
  options()
    .filter((el) => el.getAttribute("aria-checked") === "true")
    .map((el) => el.textContent ?? "")

// ── 1. THE FIVE STATES (UI-SPEC §7b) ──────────────────────────────────────────────────

describe("ExternalActionSection — the five picker states", () => {
  it("nothing chosen: three unselected rows under the heading, plus the honest note", () => {
    renderSection({ capability: "" })

    // Character-identity against the IMPORTED names — the component cannot drift a word
    // without going red, and it authors no sentence it could drift.
    expect(screen.getByText(EXTERNAL_ACTION_HEADING)).toBeInTheDocument()
    expect(options()).toHaveLength(3)
    expect(chosenLabels()).toEqual([])
    expect(screen.getByText(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)).toBeInTheDocument()
  })

  it.each(Object.entries(EXTERNAL_CAPABILITY_SENTENCES))(
    "%s chosen: that ONE row is selected, and the no-capability note is gone",
    (capability, sentence) => {
      renderSection({ capability })

      expect(chosenLabels()).toEqual([sentence])
      expect(screen.queryByText(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)).toBeNull()
      expect(screen.queryByTestId("external-action-nothing-chosen")).toBeNull()
    },
  )

  it("an UNRECOGNISED stored value selects NO row and fabricates nothing (T-189-39)", () => {
    // The `send_email` default `requiredConfigFor` emits means a PLACED node always
    // arrives with a real capability — so §7b's "no row selected" state is reached by
    // exactly this: a stored value the client does not know. It must never guess.
    renderSection({ capability: "send_carrier_pigeon" })

    expect(options()).toHaveLength(3)
    expect(chosenLabels()).toEqual([])
    // …and no row grew a label for it.
    expect(screen.queryByText(/pigeon/i)).toBeNull()
    expect(screen.getByText(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)).toBeInTheDocument()
  })

  it("an INHERITED key selects no row either — `constructor` is not a capability", () => {
    // WR-04's probe, in the shape this file can reach it: the membership test is
    // `Array.prototype.includes`, never a bare object lookup, so an inherited name can
    // never resolve to a row. A table MISS behaved correctly and always did; only an
    // inherited key distinguishes the guard from its absence.
    for (const inherited of ["constructor", "toString", "__proto__"]) {
      const { unmount } = renderSection({ capability: inherited })
      expect(chosenLabels()).toEqual([])
      expect(screen.getAllByTestId("external-action-option")).toHaveLength(3)
      unmount()
    }
  })

  it("the section RENDERS in every state it can reach — never an empty branch", () => {
    // A state that renders nothing reads as a build that forgot its control (the
    // D-185-16 rule, copied). Five states, five renders, all non-empty.
    for (const capability of ["", ...EXTERNAL_ACTION_CAPABILITIES, "not_a_capability"]) {
      const { unmount } = renderSection({ capability })
      expect(screen.getByTestId("external-action-section")).toBeInTheDocument()
      expect(screen.getByText(EXTERNAL_ACTION_HEADING)).toBeInTheDocument()
      expect(screen.getAllByTestId("external-action-option")).toHaveLength(3)
      unmount()
    }
  })
})

// ── 2. THE WRITE SEAM ─────────────────────────────────────────────────────────────────

describe("ExternalActionSection — choosing a capability", () => {
  it("writes the capability NAME (never the sentence) and commits it", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "", onChange, onPersist })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_CAPABILITY_SENTENCES.create_ticket }))

    expect(onChange).toHaveBeenCalledWith("create_ticket")
    // The commit follows the patch. A set of rows has no blur event to hang it on, and
    // the store's patch is synchronous, so the panel's `dirty` read sees the new value.
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("pressing the ALREADY-chosen row writes nothing — no redundant patch, no save", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "send_email", onChange, onPersist })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_CAPABILITY_SENTENCES.send_email }))

    expect(onChange).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it("every row is reachable, and each writes its own name", () => {
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      const onChange = vi.fn()
      const { unmount } = renderSection({ capability: "", onChange })
      fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_CAPABILITY_SENTENCES[name] }))
      expect(onChange).toHaveBeenCalledWith(name)
      unmount()
    }
  })

  it("is a single-choice group — `radiogroup` labelled by its own heading", () => {
    renderSection({ capability: "post_message" })
    const group = screen.getByRole("radiogroup", { name: EXTERNAL_ACTION_HEADING })
    expect(group).toBeInTheDocument()
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3)
  })
})

// ── 2b. THE ROLE'S PROMISE IS KEPT (review WR-04) ─────────────────────────────────────
//
// THE ROLE WAS A CLAIM NOTHING CHECKED. The container declared `radiogroup` and each row
// `radio` + `aria-checked`, but the rows were plain buttons with no tabIndex management and
// no key handling — three tab stops and no arrow behaviour, i.e. ARIA announcing a widget
// the DOM did not implement. `vitest-axe` is BLIND to it (`aria-required-children` and
// `aria-checked` are both satisfied), and the case above asserts only the role and the child
// count, so the whole a11y story passed straight over the gap. These cases are the missing
// half: what the APG radio-group pattern actually requires, driven as behaviour.
describe("ExternalActionSection — the radiogroup behaves like one (WR-04)", () => {
  const tabStops = () =>
    options().filter((el) => el.getAttribute("tabindex") === "0")

  it("ONE tab stop, and it is the chosen row — not three", () => {
    renderSection({ capability: "create_ticket" })
    const stops = tabStops()
    expect(stops, "an APG radiogroup is a single tab stop for the whole group").toHaveLength(1)
    expect(stops[0].textContent).toBe(EXTERNAL_CAPABILITY_SENTENCES.create_ticket)
    // ...and every other row is explicitly removed from the tab order rather than merely
    // un-marked (an absent tabindex would leave a native <button> focusable).
    for (const el of options()) {
      if (el === stops[0]) continue
      expect(el.getAttribute("tabindex")).toBe("-1")
    }
  })

  it("with NOTHING chosen the group is still reachable — the first row holds the stop", () => {
    renderSection({ capability: "" })
    const stops = tabStops()
    expect(stops, "a group with no selection must still be tabbable exactly once").toHaveLength(1)
    expect(stops[0].textContent).toBe(EXTERNAL_CAPABILITY_SENTENCES.send_email)
  })

  it("an UNRECOGNISED stored value behaves like nothing chosen, not like a fourth row", () => {
    renderSection({ capability: "wire_transfer" })
    expect(tabStops()).toHaveLength(1)
    expect(chosenLabels()).toEqual([])
  })

  it("ArrowDown moves the selection to the next row and writes it", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "send_email", onChange, onPersist })

    fireEvent.keyDown(options()[0], { key: "ArrowDown" })

    expect(onChange).toHaveBeenCalledWith(EXTERNAL_ACTION_CAPABILITIES[1])
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("ArrowUp from the FIRST row wraps to the last — the APG default, not a dead end", () => {
    const onChange = vi.fn()
    renderSection({ capability: "send_email", onChange })

    fireEvent.keyDown(options()[0], { key: "ArrowUp" })

    expect(onChange).toHaveBeenCalledWith(
      EXTERNAL_ACTION_CAPABILITIES[EXTERNAL_ACTION_CAPABILITIES.length - 1],
    )
  })

  it("ArrowRight / ArrowLeft are the same axis — a vertical list still answers both", () => {
    const right = vi.fn()
    const { unmount } = renderSection({ capability: "send_email", onChange: right })
    fireEvent.keyDown(options()[0], { key: "ArrowRight" })
    expect(right).toHaveBeenCalledWith(EXTERNAL_ACTION_CAPABILITIES[1])
    unmount()

    const left = vi.fn()
    renderSection({ capability: "create_ticket", onChange: left })
    fireEvent.keyDown(options()[1], { key: "ArrowLeft" })
    expect(left).toHaveBeenCalledWith(EXTERNAL_ACTION_CAPABILITIES[0])
  })

  it("Home and End jump to the ends", () => {
    const end = vi.fn()
    const { unmount } = renderSection({ capability: "send_email", onChange: end })
    fireEvent.keyDown(options()[0], { key: "End" })
    expect(end).toHaveBeenCalledWith(
      EXTERNAL_ACTION_CAPABILITIES[EXTERNAL_ACTION_CAPABILITIES.length - 1],
    )
    unmount()

    const home = vi.fn()
    renderSection({ capability: "post_message", onChange: home })
    fireEvent.keyDown(options()[2], { key: "Home" })
    expect(home).toHaveBeenCalledWith(EXTERNAL_ACTION_CAPABILITIES[0])
  })

  it("NEGATIVE CONTROL — an unhandled key writes nothing and is not swallowed", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "send_email", onChange, onPersist })

    // `Tab` must reach the browser (it is how the user LEAVES the group), and a printable
    // key is not a selection. Without this the handler could be a catch-all that moved on
    // anything and the arrow cases above would still be green.
    const tab = fireEvent.keyDown(options()[0], { key: "Tab" })
    fireEvent.keyDown(options()[0], { key: "x" })

    expect(onChange).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
    // fireEvent returns false when preventDefault() was called — Tab must NOT be.
    expect(tab, "Tab must not be preventDefault()ed — it is how the group is exited").toBe(true)
  })

  it("arrowing onto the ALREADY-chosen row writes nothing — the click rule, by keyboard", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    // Two rows in a three-row group: ArrowDown twice from row 0 lands on row 2; arrow ONCE
    // from row 2 backwards lands on row 1. Drive the no-op directly instead: End from the
    // last row is a move onto itself.
    renderSection({ capability: "post_message", onChange, onPersist })

    fireEvent.keyDown(options()[2], { key: "End" })

    expect(onChange).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })
})

// ── 3. THE RAW ID NEVER REACHES THE DOM (the D-20 boundary, restated) ─────────────────

describe("ExternalActionSection — the author reads sentences, never wire values", () => {
  it("no capability id appears in the rendered HTML, in ANY state", () => {
    for (const capability of ["", ...EXTERNAL_ACTION_CAPABILITIES, "nonsense"]) {
      const { container, unmount } = renderSection({ capability })
      for (const name of EXTERNAL_ACTION_CAPABILITIES) {
        expect(container.innerHTML).not.toContain(name)
      }
      // NON-VACUITY: the sentences DID render, so the absence above is a scope decision
      // rather than an empty component.
      expect(container.innerHTML).toContain(EXTERNAL_CAPABILITY_SENTENCES.send_email)
      unmount()
    }
  })

  it("nothing is struck through — a required value is not an author-fixable error", () => {
    // `ToolOptionSet` paints an unregistered name struck through and still pressable,
    // which is right for a tool the author chose by mistake and WRONG for a value the
    // author may not author at all. D-189-DEF-02 in one assertion.
    const { container } = renderSection({ capability: "send_email" })
    expect(container.innerHTML).not.toContain("line-through")
  })
})

// ── 4. THE COPY LOCK — it authors NO sentence (T-189-43) ─────────────────────────────

describe("ExternalActionSection — every sentence is an imported identifier", () => {
  it("renders the three labels the NODE FACE reads, from the same constant", () => {
    renderSection({ capability: "" })
    const labels = options().map((el) => el.textContent)
    expect(labels).toEqual(EXTERNAL_ACTION_CAPABILITIES.map((n) => EXTERNAL_CAPABILITY_SENTENCES[n]))
  })

  it("names the imported identifiers in source and declares no sentence of its own", () => {
    expect(externalActionSectionSource).toMatch(/EXTERNAL_ACTION_HEADING/)
    expect(externalActionSectionSource).toMatch(/EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE/)
    expect(externalActionSectionSource).toMatch(/EXTERNAL_CAPABILITY_SENTENCES/)
    // The three sentences themselves are NOWHERE in this component's source — a copy is
    // exactly the drift the one-constant-read-twice rule exists to prevent.
    for (const sentence of Object.values(EXTERNAL_CAPABILITY_SENTENCES)) {
      expect(externalActionSectionSource).not.toContain(sentence)
    }
    expect(externalActionSectionSource).not.toContain(EXTERNAL_ACTION_HEADING)
    expect(externalActionSectionSource).not.toContain(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)
  })

  it("does not re-type the capability ids — the mirror is DERIVED from the one map", () => {
    // `Object.keys(EXTERNAL_CAPABILITY_SENTENCES)`, not a second tuple. A hand-typed
    // triple is a fourth-entry-on-one-side-only waiting to happen.
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      expect(externalActionSectionSource).not.toContain(`"${name}"`)
    }
    expect(externalActionSectionSource).toMatch(
      /Object\.keys\(\s*EXTERNAL_CAPABILITY_SENTENCES,?\s*\)/,
    )
  })

  it("the sentence map is declared in exactly ONE place outside tests", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>

    const declarations = Object.entries(modules)
      .filter(([path]) => !path.includes(".test."))
      .filter(([, source]) => /const\s+EXTERNAL_CAPABILITY_SENTENCES\s*[:=]/.test(source))
      .map(([path]) => path)

    expect(declarations).toEqual(["/src/components/workflows/phaseVocabulary.ts"])
    // POSITIVE CONTROL — the glob is not empty and the matcher really matches.
    expect(Object.keys(modules).length).toBeGreaterThan(50)
    expect(/const\s+EXTERNAL_CAPABILITY_SENTENCES\s*[:=]/.test(
      "export const EXTERNAL_CAPABILITY_SENTENCES: Record<string, string> = {",
    )).toBe(true)
  })
})

// ── 5. THE SOURCE FENCE (the shipped `?raw` house idiom) ─────────────────────────────

describe("ExternalActionSection — source purity", () => {
  it("imports nothing from the API client and opens no request", () => {
    expect(externalActionSectionSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(externalActionSectionSource).not.toMatch(/fetch\(/)
    expect(externalActionSectionSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    // Nor any route string: the option set is a mirror, never a read.
    expect(externalActionSectionSource).not.toMatch(/["'`]\/(workflows|api)\//)
  })

  it("is a LEAF — no context, no store, no effect", () => {
    expect(externalActionSectionSource).not.toMatch(/useContext|useStore|useEffect|zustand/)
  })

  it("carries NO title attribute — guidance cannot regress into a tooltip", () => {
    expect(externalActionSectionSource).not.toMatch(/title=/)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect('const r = get("/workflows/grounding-bundle")').toMatch(/["'`]\/(workflows|api)\//)
    expect("const s = useStore(store)").toMatch(/useContext|useStore|useEffect|zustand/)
    expect('<span title="why">x</span>').toMatch(/title=/)
    // …and the haystack really is this component's source.
    expect(externalActionSectionSource.length).toBeGreaterThan(1000)
    expect(externalActionSectionSource).toContain("export function ExternalActionSection")
  })
})

// ── 6. D-23 — THE CROSS-LANGUAGE MIRROR FENCE ────────────────────────────────────────
//
// The anti-drift guarantee must be MECHANICAL, NOT EDITORIAL. The block below reads the
// SERVER's own source and asserts the client mirror names the same three members, in the
// same order — so a capability renamed, reordered, added or dropped in `harness.py` is a
// RED TEST HERE rather than a 422 in the running app or, worse, a picker offering a name
// the server refuses.
//
// ⚠ OBSERVED RED BEFORE IT WAS TRUSTED — a fourth member was planted into the client map
// and this block failed; the plant was removed and md5-verified. Recorded in
// `189-14-SUMMARY.md` with its output.

describe("ExternalActionSection — the client mirror agrees with the backend Literal (D-23)", () => {
  /** The closed `capability` Literal `ExternalActionPhaseConfig` declares. */
  const backendCapabilities = (source: string): string[] => {
    const match = source.match(/^\s*capability:\s*Literal\[([^\]]*)\]/m)
    if (!match) return []
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  }

  it("reads the server source at all — the fence is not comparing two empty lists", () => {
    expect(typeof harnessModelsSource).toBe("string")
    expect(harnessModelsSource.length).toBeGreaterThan(1000)
    expect(harnessModelsSource).toContain("class ExternalActionPhaseConfig(_StrictBase):")
  })

  it("the reader is falsifiable — it returns nothing on a source without the Literal", () => {
    // Without this, a regex that stopped matching would make the case below green forever.
    expect(backendCapabilities("nothing to see here")).toEqual([])
    expect(backendCapabilities('    capability: Literal["a", "b"]')).toEqual(["a", "b"])
  })

  it("EXACTLY the same members, EXACTLY the same count, in the union's own order", () => {
    const backend = backendCapabilities(harnessModelsSource)

    expect(backend).toHaveLength(3) // D-15 — the set is exactly three
    expect([...EXTERNAL_ACTION_CAPABILITIES]).toEqual(backend)
    // Belt and braces on the two failure modes an `toEqual` on arrays already covers but
    // which a later refactor to a Set would silently drop: no extra, no missing.
    expect(EXTERNAL_ACTION_CAPABILITIES).toHaveLength(backend.length)
    for (const name of backend) expect(EXTERNAL_ACTION_CAPABILITIES).toContain(name)
    for (const name of EXTERNAL_ACTION_CAPABILITIES) expect(backend).toContain(name)
  })

  it("and every mirrored member has a sentence — the picker can label all of them", () => {
    for (const name of backendCapabilities(harnessModelsSource)) {
      expect(EXTERNAL_CAPABILITY_SENTENCES[name]).toBeTruthy()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ ADDED, NEVER RE-BASELINED — every case above this banner is untouched by 206.2.
//
// 206.2-03 — THE SHAPE AXIS. What the cases below are for, in one sentence each:
//
//  · the shape control exists, is its OWN radiogroup with its OWN name and its OWN testid,
//    and holds exactly TWO buttons — so the five `=== 3` assertions above stay true for a
//    STRUCTURAL reason rather than by luck. That they pass with a ZERO-DELETION diff is the
//    assertion, and it is checked as a diff rather than merely by re-running them.
//  · `data-shape` derives from two props plus one session fact, and `unset` leaves BOTH
//    segments unchecked — the plausible wrong answer being a default-checked segment A.
//  · the two patches clear the OTHER shape's keys, asserted by SET EQUALITY over
//    `Object.keys` rather than by `toMatchObject`, because a superset passes a PARTIAL clear
//    and a partial clear is the defect.
//  · RESEARCH assumption A1 — `{k: undefined}` is dropped by serialization — is FALSIFIED
//    against a real store here, not deferred.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { createBuilderStore } from "./builderStore"
import {
  EXTERNAL_SHAPE_CAPABILITY_LABEL,
  EXTERNAL_SHAPE_GROUP_LABEL,
  EXTERNAL_SHAPE_MCP_LABEL,
} from "./externalShapeVocabulary"

const shapeOptions = () => screen.getAllByTestId("external-action-shape-option")

const shapeOf = () => screen.getByTestId("external-action-section").getAttribute("data-shape")

const checkedShapes = () =>
  shapeOptions()
    .filter((el) => el.getAttribute("aria-checked") === "true")
    .map((el) => el.textContent ?? "")

// ── 7. THE SHAPE GROUP IS A SECOND AXIS, NOT A FOURTH ROW ────────────────────────────

describe("ExternalActionSection — the shape control (206.2 / D-206.2-01)", () => {
  it("is its OWN radiogroup, with its OWN accessible name and exactly TWO positions", () => {
    renderSection()
    const group = screen.getByRole("radiogroup", { name: EXTERNAL_SHAPE_GROUP_LABEL })
    expect(group).toBeInTheDocument()
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(2)
    expect(shapeOptions().map((el) => el.textContent)).toEqual([
      EXTERNAL_SHAPE_CAPABILITY_LABEL,
      EXTERNAL_SHAPE_MCP_LABEL,
    ])
  })

  it("⚠ THE TWO GROUPS ARE DISJOINT — neither segment is a member of the capability one", () => {
    // D-206.2-21's whole subject. If a segment ever carried the capability testid or became
    // a `role="radio"` child of that group, the five shipped `=== 3` assertions would go red
    // — and this case names WHY before they do.
    renderSection()
    const capabilityGroup = screen.getByRole("radiogroup", { name: EXTERNAL_ACTION_HEADING })
    const shapeGroup = screen.getByRole("radiogroup", { name: EXTERNAL_SHAPE_GROUP_LABEL })
    expect(capabilityGroup).not.toBe(shapeGroup)
    expect(capabilityGroup.querySelectorAll('[role="radio"]')).toHaveLength(3)
    for (const segment of shapeOptions()) {
      expect(capabilityGroup.contains(segment)).toBe(false)
      expect(segment.getAttribute("data-testid")).toBe("external-action-shape-option")
    }
    // POSITIVE CONTROL — the two names really are different strings, which is what keeps
    // the shipped EXACT accessible-name query unambiguous.
    expect(EXTERNAL_SHAPE_GROUP_LABEL).not.toBe(EXTERNAL_ACTION_HEADING)
  })

  it("ONE tab stop for the shape group, and with NEITHER checked the first holds it", () => {
    renderSection()
    const stops = shapeOptions().filter((el) => el.getAttribute("tabindex") === "0")
    expect(stops).toHaveLength(1)
    expect(stops[0].textContent).toBe(EXTERNAL_SHAPE_CAPABILITY_LABEL)
  })

  it("arrow keys wrap on both axes, Home/End jump, and an unhandled key is not swallowed", () => {
    const onChangeShape = vi.fn()
    const first = renderSection({ onChangeShape })
    fireEvent.keyDown(shapeOptions()[0], { key: "ArrowRight" })
    expect(onChangeShape).toHaveBeenCalledTimes(1)
    first.unmount()

    const up = vi.fn()
    const second = renderSection({ onChangeShape: up })
    fireEvent.keyDown(shapeOptions()[0], { key: "ArrowUp" })
    expect(up, "ArrowUp from the first position WRAPS to the last").toHaveBeenCalledTimes(1)
    second.unmount()

    const end = vi.fn()
    const third = renderSection({ onChangeShape: end })
    fireEvent.keyDown(shapeOptions()[0], { key: "End" })
    expect(end).toHaveBeenCalledTimes(1)
    third.unmount()

    // NEGATIVE CONTROL — Tab must reach the browser, and a printable key is not a choice.
    const quiet = vi.fn()
    renderSection({ onChangeShape: quiet })
    const tab = fireEvent.keyDown(shapeOptions()[0], { key: "Tab" })
    fireEvent.keyDown(shapeOptions()[0], { key: "x" })
    expect(quiet).not.toHaveBeenCalled()
    expect(tab, "Tab must not be preventDefault()ed — it is how the group is exited").toBe(true)
  })
})

// ── 8. THE THREE STATES ──────────────────────────────────────────────────────────────

describe("ExternalActionSection — the three derived states", () => {
  it("⚠ UNSET leaves BOTH segments unchecked — a default is not a way through a gate", () => {
    // The plausible wrong answer is a default-checked segment A, and it would make a
    // brand-new step assert that it does one of three actions before anyone said so.
    renderSection({ capability: "", toolName: "" })
    expect(shapeOf()).toBe("unset")
    expect(checkedShapes()).toEqual([])
    for (const segment of shapeOptions()) {
      expect(segment.getAttribute("aria-checked")).toBe("false")
    }
  })

  it("a recognised stored capability derives the capability shape", () => {
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      const { unmount } = renderSection({ capability: name })
      expect(shapeOf()).toBe("capability")
      expect(checkedShapes()).toEqual([EXTERNAL_SHAPE_CAPABILITY_LABEL])
      unmount()
    }
  })

  it("an UNRECOGNISED stored capability derives NOTHING — it is still unset", () => {
    renderSection({ capability: "wire_transfer" })
    expect(shapeOf()).toBe("unset")
    expect(checkedShapes()).toEqual([])
  })

  it("a non-empty tool_name derives the mcp shape and OUTRANKS a stored capability", () => {
    // The executor branches on `tool_name` FIRST, so a step carrying both really runs as
    // MCP. The surface must say what the run will do, not what the config wishes.
    renderSection({ capability: "send_email", toolName: "ask_question" })
    expect(shapeOf()).toBe("mcp")
    expect(checkedShapes()).toEqual([EXTERNAL_SHAPE_MCP_LABEL])
  })

  it("a WHITESPACE-ONLY tool_name is not an answer", () => {
    renderSection({ capability: "", toolName: "   " })
    expect(shapeOf()).toBe("unset")
  })

  it("under MCP the capability radiogroup is ABSENT and the picker is mounted", () => {
    renderSection({ toolName: "ask_question" })
    expect(screen.queryAllByTestId("external-action-option")).toHaveLength(0)
    expect(screen.queryByTestId("external-action-options")).toBeNull()
    expect(screen.queryByTestId("external-action-nothing-chosen")).toBeNull()
    expect(screen.getByTestId("connection-picker")).toBeInTheDocument()
  })

  it("under UNSET and CAPABILITY the capability radiogroup is PRESENT — the five pins' reason", () => {
    for (const props of [{ capability: "" }, { capability: "send_email" }]) {
      const { unmount } = renderSection(props)
      expect(screen.getAllByTestId("external-action-option")).toHaveLength(3)
      unmount()
    }
  })

  it("pressing a segment follows through to the derived shape", () => {
    renderSection()
    fireEvent.click(shapeOptions()[1])
    expect(shapeOf()).toBe("mcp")
    fireEvent.click(shapeOptions()[0])
    expect(shapeOf()).toBe("capability")
  })

  it("a session press does NOT leak across steps — the caller's per-step key is the reset", () => {
    // No lifecycle hook is available on this leaf (its own source fence forbids the four
    // names), so the ONLY mechanism is a remount, and the panel spends one JSX attribute on
    // it. A `key` change is exactly what a remount looks like from here.
    const { unmount } = renderSection({ capability: "", toolName: "" })
    fireEvent.click(shapeOptions()[1])
    expect(shapeOf()).toBe("mcp")
    unmount()

    renderSection({ capability: "", toolName: "" })
    expect(shapeOf(), "a fresh mount reads only what the props say").toBe("unset")
  })

  it("⚠ UNSET renders BYTE-IDENTICALLY to today's empty-capability render, below the control", () => {
    // ⚠ THE FIRST DRAFT OF THIS CASE CLAIMED IN WRITING THAT NO ID NORMALIZATION WAS NEEDED
    // — "both sides are produced by the SAME component in the SAME run, so the generated ids
    // cannot differ" — AND IT WAS OBSERVED RED. The claim is kept here rather than deleted,
    // because the correction is the useful part: React's `useId` counter advances per MOUNT,
    // not per commit, so two SEQUENTIAL mounts in one run carry DIFFERENT ids. Wave 2 needed
    // a counted normalization for a reason it stated (its two sides are separated by a
    // commit); this case needs one for a different reason, and needing one either way is
    // what makes the counted form the house idiom rather than a wave-2 detail.
    //
    // The needle is READ OFF A REAL RENDER, never assumed: the emitted form on this tree is
    // `_r_0_` — underscores, no guillemets — because React changed the format so the value
    // is a valid CSS selector. A regex written against the guillemet form would replace
    // NOTHING, the count below would read 0, and the case would go red for a reason that has
    // nothing to do with this component.
    const REACT_ID = /_r_[0-9a-z]+_/g
    const normalize = (html: string) => {
      let replaced = 0
      const out = html.replace(REACT_ID, () => {
        replaced += 1
        return "«id»"
      })
      return { out, replaced }
    }

    const first = renderSection({ capability: "", toolName: "" })
    const unsetHtml = screen.getByTestId("external-action-options").outerHTML
    const unsetNote = screen.getByTestId("external-action-nothing-chosen").outerHTML
    first.unmount()

    // The state the shipped suite drives everywhere — `capability: ""`, no tool.
    renderSection({ capability: "" })
    const shippedHtml = screen.getByTestId("external-action-options").outerHTML
    const shippedNote = screen.getByTestId("external-action-nothing-chosen").outerHTML

    // NON-VACUITY FIRST — two empty strings compare equal, and would prove nothing.
    expect(unsetHtml.length).toBeGreaterThan(200)
    expect(shippedHtml.length).toBeGreaterThan(200)
    expect(unsetNote.length).toBeGreaterThan(20)

    const a = normalize(unsetHtml)
    const b = normalize(shippedHtml)
    // COUNTED — the capability group reaches the DOM with exactly ONE generated id
    // (`aria-labelledby` on the group; the heading carries the same value on `id`, which is
    // outside this subtree). A count of 0 here would mean the needle stopped matching.
    expect(a.replaced, "the options subtree carries exactly one generated id").toBe(1)
    expect(b.replaced).toBe(1)
    expect(a.out).toBe(b.out)

    // The note carries NO generated id at all, so it compares raw — and that asymmetry is
    // asserted rather than assumed.
    expect(normalize(unsetNote).replaced).toBe(0)
    expect(unsetNote).toBe(shippedNote)
  })
})

// ── 9. THE PATCHES, EXACTLY ──────────────────────────────────────────────────────────

describe("ExternalActionSection — the multi-key clear (D-206.2-17 / AR-05)", () => {
  it("press A emits ONE patch clearing tool_name, tool_args and connection_id", () => {
    // ⚠ THE ASYMMETRY: a stranded `capability` on an MCP step is INERT, but a stranded
    // `tool_name` on a capability step SILENTLY turns an email step into an MCP step. This
    // is the direction that must not be skipped.
    const onChangeShape = vi.fn()
    const onPersist = vi.fn()
    renderSection({ toolName: "ask_question", onChangeShape, onPersist })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_SHAPE_CAPABILITY_LABEL }))

    expect(onChangeShape).toHaveBeenCalledTimes(1)
    const patch = onChangeShape.mock.calls[0][0] as Record<string, unknown>
    // SET EQUALITY, never `toMatchObject` — a superset passes a PARTIAL clear, and a
    // partial clear is the whole defect (arguments for a tool that no longer exists).
    expect(Object.keys(patch).sort()).toEqual(["connection_id", "tool_args", "tool_name"])
    expect(patch.tool_name).toBeUndefined()
    expect(patch.tool_args).toBeUndefined()
    // `null`, NOT `undefined` — it is what the shipped unbind writes, and two spellings of
    // "unbound" is how two readers come to disagree.
    expect(patch.connection_id).toBeNull()
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("press B emits ONE patch clearing capability and connection_id", () => {
    const onChangeShape = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "send_email", onChangeShape, onPersist })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_SHAPE_MCP_LABEL }))

    expect(onChangeShape).toHaveBeenCalledTimes(1)
    const patch = onChangeShape.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(["capability", "connection_id"])
    expect(patch.capability).toBeUndefined()
    expect(patch.connection_id).toBeNull()
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("⚠ AR-05 — BOTH directions clear connection_id, and no upstream document named it", () => {
    // A left-behind id points at a row of the OTHER shape. The picker shows its unbound
    // reading (the id is not in the newly-filtered list) while the SAVED definition still
    // carries it, and the executor really resolves a connection of the wrong kind.
    for (const props of [
      { toolName: "ask_question", index: 0 },
      { capability: "send_email", index: 1 },
    ]) {
      const onChangeShape = vi.fn()
      const { unmount } = renderSection({ ...props, onChangeShape })
      fireEvent.click(shapeOptions()[props.index])
      const patch = onChangeShape.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(patch)).toContain("connection_id")
      expect(patch.connection_id).toBeNull()
      unmount()
    }
  })

  it("pressing the ALREADY-chosen segment writes nothing — the capability row's rule", () => {
    const onChangeShape = vi.fn()
    const onPersist = vi.fn()
    renderSection({ capability: "send_email", onChangeShape, onPersist })
    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_SHAPE_CAPABILITY_LABEL }))
    expect(onChangeShape).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it("⚠ THE WIRES ARE NOT CROSSED — both directions, because either alone would miss it", () => {
    const onChange = vi.fn()
    const onChangeShape = vi.fn()
    const { unmount } = renderSection({ capability: "", onChange, onChangeShape })
    fireEvent.click(shapeOptions()[1])
    expect(onChange, "a shape press must not reach the single-key writer").not.toHaveBeenCalled()
    expect(onChangeShape).toHaveBeenCalledTimes(1)
    unmount()

    const rowChange = vi.fn()
    const rowShape = vi.fn()
    renderSection({ capability: "", onChange: rowChange, onChangeShape: rowShape })
    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_CAPABILITY_SENTENCES.create_ticket }))
    expect(rowChange).toHaveBeenCalledWith("create_ticket")
    expect(rowShape, "a capability row must not reach the multi-key writer").not.toHaveBeenCalled()
  })
})

// ── 10. RESEARCH ASSUMPTION A1 — FALSIFIED HERE, NOT DEFERRED ────────────────────────

describe("ExternalActionSection — the clear survives SERIALIZATION (A1)", () => {
  /** A store already in the DRAFTED view — the shipped `patchConfig` bails otherwise, so a
   *  store built from `null` could never record the write these cases are about. */
  const draftedStore = (config: Record<string, unknown>) =>
    createBuilderStore({
      slug: "vendor-brief",
      version: 1,
      phases: [
        {
          slug: "reach-out",
          phase_index: 0,
          config: { phase_type: "external_action", ...config },
        },
      ],
    } as Parameters<typeof createBuilderStore>[0])

  it("A1 — an undefined value leaves the key in MEMORY and is DROPPED on the wire", () => {
    // RESEARCH logs this as assumption A1, UNFALSIFIED, with its falsification step named.
    // It moves to FALSIFIED-AT-T1 here; the T4 browser confirmation is still owed to 206.2-04.
    //
    // ⚠ BOTH HALVES ARE ASSERTED, because the difference between them IS the assumption.
    // If only the serialized half were checked, a merge that had started deleting keys
    // would pass identically and nobody would learn which mechanism is load-bearing.
    const store = draftedStore({
      capability: "send_email",
      tool_name: "ask_question",
      tool_args: '{"q":"x"}',
      connection_id: "conn-mcp",
    })

    renderSection({
      capability: "send_email",
      toolName: "ask_question",
      onChangeShape: (patch) => store.getState().patchConfig("reach-out", patch),
    })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_SHAPE_CAPABILITY_LABEL }))

    const inMemory = store.getState().phases[0].config as unknown as Record<string, unknown>
    // HALF ONE — the merge is a pure spread, so the KEYS are still present in memory.
    expect(Object.keys(inMemory)).toContain("tool_name")
    expect(Object.keys(inMemory)).toContain("tool_args")
    expect(inMemory.tool_name).toBeUndefined()
    expect(inMemory.tool_args).toBeUndefined()

    // HALF TWO — and serialization, which is what the server is handed, drops them.
    const onTheWire = JSON.parse(JSON.stringify(store.getState().phases)) as Array<{
      config: Record<string, unknown>
    }>
    expect(Object.keys(onTheWire[0].config)).not.toContain("tool_name")
    expect(Object.keys(onTheWire[0].config)).not.toContain("tool_args")
    // NON-VACUITY — the serialized config is not simply empty, and `connection_id` really
    // survives as an explicit null rather than being dropped alongside them.
    expect(onTheWire[0].config.phase_type).toBe("external_action")
    expect(onTheWire[0].config).toHaveProperty("connection_id", null)
  })

  it("the OTHER direction lands the same way — a stranded capability is dropped too", () => {
    const store = draftedStore({ capability: "send_email", connection_id: "conn-mail" })

    renderSection({
      capability: "send_email",
      onChangeShape: (patch) => store.getState().patchConfig("reach-out", patch),
    })

    fireEvent.click(screen.getByRole("radio", { name: EXTERNAL_SHAPE_MCP_LABEL }))

    const onTheWire = JSON.parse(JSON.stringify(store.getState().phases)) as Array<{
      config: Record<string, unknown>
    }>
    expect(Object.keys(onTheWire[0].config)).not.toContain("capability")
    expect(onTheWire[0].config).toHaveProperty("connection_id", null)
  })
})

// ── 11. THE SHAPE CONTROL'S OWN FENCES ───────────────────────────────────────────────

describe("ExternalActionSection — the shape control spends nothing it may not", () => {
  it("AR-07 — no mark span and no accent ink on the segments", () => {
    renderSection()
    for (const segment of shapeOptions()) {
      expect(segment.querySelector('[aria-hidden="true"]'), "no second dot mark").toBeNull()
      const cls = segment.getAttribute("class") ?? ""
      expect(cls).not.toMatch(/\b(bg|text|border)-primary\b/)
    }
    // POSITIVE CONTROL — the capability rows DO carry the mark, so the absence above is a
    // scope decision rather than a selector that matches nothing.
    expect(options()[0].querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it("no forbidden spacing value, weight or dead colour utility enters this file", () => {
    for (const needle of [
      "p-0.5",
      "gap-0.5",
      "py-2.5",
      "space-y-",
      "font-semibold",
      "font-bold",
      "text-panel-",
      "text-muted-foreground-dim",
    ]) {
      expect(externalActionSectionSource, needle).not.toContain(needle)
    }
    // POSITIVE CONTROL — a needle really can match.
    expect('class="p-0.5 font-semibold"').toContain("p-0.5")
  })

  it("the shape vocabulary is a TRUE LEAF and spells no capability id", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    const source = modules["/src/components/workflows/externalShapeVocabulary.ts"]
    expect(typeof source, "the glob really resolved this module").toBe("string")
    expect(source.length).toBeGreaterThan(500)
    expect(source).not.toMatch(/^import\s/m)
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      expect(source, name).not.toContain(`"${name}"`)
    }
    // POSITIVE CONTROL — both patterns really match.
    expect('import { x } from "y"').toMatch(/^import\s/m)
    expect('const a = "send_email"').toContain('"send_email"')
  })

  it("the group label is NOT the section heading — the shipped exact-name query stays sharp", () => {
    expect(EXTERNAL_SHAPE_GROUP_LABEL).not.toBe(EXTERNAL_ACTION_HEADING)
    // …and no segment label names a capability id.
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      expect(EXTERNAL_SHAPE_CAPABILITY_LABEL).not.toContain(name)
      expect(EXTERNAL_SHAPE_MCP_LABEL).not.toContain(name)
    }
  })
})
