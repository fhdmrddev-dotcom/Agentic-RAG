/**
 * Phase 184-07 Task 3 — StepTypePicker tests (R10b's component half, and R10's).
 *
 * Two claims are proven here, and they are deliberately different in kind:
 *
 *   R10b — a choice the definition's shape declines is OFFERED, disabled, with its
 *   sentence visible in the DOM. Six rows render at every insertion point; none is ever
 *   omitted; the disabled one cannot be activated. Sketch 139-C's finding as a build
 *   rule: an option that vanishes teaches nothing.
 *
 *   R10 — that refusal is a LOCAL SHAPE RULE and never a server judgement. Proven belt
 *   and braces: a `?raw` source fence (the component cannot NAME the server seam) and a
 *   whole-suite request spy at zero calls (nothing it calls opens one). Both carry
 *   positive controls, in the house style — an assertion that has only ever passed is
 *   not evidence.
 *
 * A NOTE ON THE DRIVER. This suite uses `@testing-library/user-event`, which is correct
 * here **because the picker sits outside the canvas plane**. Inside that plane a
 * `user-event` click also dispatches a real `mousedown`, which reaches the pan handler;
 * the drag behaviour then dereferences `event.view.document`, and jsdom's synthetic
 * MouseEvent carries a null `view` — the failure mode plan 183-01 named "a gate that
 * lies" (every assertion green, unhandled TypeErrors from outside the test body, exit
 * code 1). The picker is a plain leaf: no canvas provider is mounted, no plane helper is
 * installed, and the suite is a `render()` away from working.
 *
 * A NOTE ON THE REFUSAL BOUNDARY. `allowedTypesAt` refuses STRICTLY AFTER the last
 * deliverable, not at-or-after — see 184-02-SUMMARY.md Deviation 1. Inserting AT the
 * deliverable's position puts the new step BEFORE it, so the deliverable simply shifts
 * down one and stays terminal; refusing that slot would state a reason that is false
 * about the edit refused. The cases below assert the boundary on BOTH sides so the
 * inherited rule is visible rather than assumed.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  type MockInstance,
} from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import stepTypePickerSource from "./StepTypePicker?raw"
import { StepTypePicker } from "./StepTypePicker"
import {
  PHASE_TYPE_ORDER,
  STRANDING_REASON,
  minimalPhaseFor,
  type PhaseTypeId,
} from "./definitionOps"
import {
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  nodeTitle,
  type PhaseSpecJSON,
} from "./phaseVocabulary"

/** R10's whole-suite tripwire. Installed once, asserted LAST. */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

/** A 2-step draft with NO deliverable — nothing here can be refused. */
const twoSteps: PhaseSpecJSON[] = [
  { slug: "search", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "write", phase_index: 1, config: { phase_type: "llm_single" } },
]

/** A 3-step draft whose `llm_emit` deliverable sits at render position 2 (terminal). */
const withDeliverable: PhaseSpecJSON[] = [
  { slug: "search", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "write", phase_index: 1, config: { phase_type: "llm_single" } },
  { slug: "deliver", phase_index: 2, config: { phase_type: "llm_emit" } },
]

const noop = () => {}

const renderPicker = (
  phases: readonly PhaseSpecJSON[],
  index: number,
  handlers: { onChoose?: (t: string) => void; onDismiss?: () => void } = {},
) =>
  render(
    <StepTypePicker
      phases={phases}
      index={index}
      open
      onChoose={handlers.onChoose ?? noop}
      onDismiss={handlers.onDismiss ?? noop}
    />,
  )

/** Every rendered row, in DOM order. */
const rows = (): HTMLElement[] => screen.getAllByTestId(/^step-type-choice-/)

// ── WR-03 helpers — the row measured against the CARD, not against a literal ──
//
// The picker's own D-184-11 docblock states what happens after `onChoose`: the CALLER
// derives the slug with `slugForType` and builds the phase with `minimalPhaseFor`. So
// the honest expectation for a row is not a hand-written string — it is what the one
// title resolver says about the phase that click really creates.

/** A placeholder slug. Deliberately arbitrary: `nodeTitle` carries a never-print-a-slug
 *  floor, and the "independent of the placeholder" case below asserts that rather than
 *  assuming it, so this value cannot quietly become load-bearing. */
const PREVIEW_SLUG = "preview"

/** What the card that lands will say — resolved by THE one title resolution. */
const cardFaceFor = (type: PhaseTypeId): string =>
  nodeTitle(minimalPhaseFor(type, PREVIEW_SLUG, 0))

/**
 * The row's TITLE line, isolated from its subtitle.
 *
 * The title carries no testid of its own, so this reads the shipped row structure —
 * `[mark][text column]`, the text column's FIRST element child being the title. That
 * structure is not assumed: "each row is exactly a title line then a subtitle line"
 * below asserts it for all six types, so a future re-layout fails loudly here instead
 * of silently comparing the wrong string.
 */
const rowTitle = (type: string): string => {
  const column = document.querySelector<HTMLElement>(
    `[data-testid="step-type-mark-${type}"] + span`,
  )
  const title = column?.firstElementChild
  if (!title) throw new Error(`no title element found for the ${type} row`)
  return title.textContent ?? ""
}

// ── 1. Six rows, fixed order, plain language ──────────────────────────────────

describe("StepTypePicker — the six choices", () => {
  it("renders one row per step type, in the fixed PHASE_TYPE_ORDER", () => {
    renderPicker(twoSteps, 1)
    const order = rows().map((r) => r.getAttribute("data-phase-type"))
    expect(order).toHaveLength(6)
    expect(order).toEqual([...PHASE_TYPE_ORDER])
  })

  // RE-DERIVED for WR-03, not deleted. This case previously expected
  // `PHASE_TYPE_SENTENCES[type]`, read straight out of the vocabulary map — a SECOND
  // answer to a question with exactly one home. `nodeTitle` is the title resolution and
  // the card asks it, so a row sourced from the map directly is free to disagree with
  // the card it creates one click later. It did: the menu offered "Check with you" and
  // the card that landed said "Wait for your approval". The expectation now resolves
  // over the phase `minimalPhaseFor` really builds, so the row IS a preview of the card
  // rather than of an approximation of it.
  it("labels every row with what the card it creates will say (WR-03)", () => {
    renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      expect(screen.getByTestId(`step-type-choice-${type}`)).toHaveTextContent(
        cardFaceFor(type),
      )
    }
  })

  it("names where the step will land", () => {
    const mid = renderPicker(twoSteps, 1)
    expect(screen.getByRole("menu")).toHaveTextContent("Add a step before step 2")
    mid.unmount()

    renderPicker(twoSteps, 2)
    expect(screen.getByRole("menu")).toHaveTextContent("Add a step at the end")
  })

  it("renders NOTHING when closed — no hidden DOM", () => {
    const { container } = render(
      <StepTypePicker
        phases={twoSteps}
        index={1}
        open={false}
        onChoose={noop}
        onDismiss={noop}
      />,
    )
    expect(container.innerHTML).toBe("")
  })
})

// ── 1b. WR-03 — the row promises exactly what the card will say ───────────────
//
// The defect this block exists for is SEMANTIC, not lexical, which is why a phase built
// to stop vocabulary drift did not stop it: both strings were still imported identifiers
// from the one vocabulary module, so the `?raw` fence and the copy-identity guards were
// green while the menu and the card disagreed. The only assertion that can see this is
// one that measures the row against the RESOLVER instead of against a string.

describe("StepTypePicker — WR-03: the row is a preview of the card it creates", () => {
  it("every row's title IS nodeTitle over the phase the caller will build", () => {
    renderPicker(twoSteps, 1)
    // Compared as one frame rather than six independent assertions, so a failure prints
    // the whole shape of the disagreement instead of only its first member.
    const measured = PHASE_TYPE_ORDER.map((type) => [type, rowTitle(type)])
    const expected = PHASE_TYPE_ORDER.map((type) => [type, cardFaceFor(type)])
    expect(measured).toEqual(expected)
  })

  it("the preview is independent of the placeholder slug and index the picker passes", () => {
    // Closes the gap between the slug this suite invents and whatever placeholder the
    // component picks: if the two could ever differ in outcome, the preview would be
    // measuring a phase the caller does not build.
    for (const type of PHASE_TYPE_ORDER) {
      expect(nodeTitle(minimalPhaseFor(type, "zz-some-other-slug", 3))).toBe(
        cardFaceFor(type),
      )
    }
  })

  // THE BLAST-RADIUS CONTROL. Derived by FILTERING the shipped order — never a
  // hand-typed list of five — so a seventh type, or a renamed one, cannot leave this
  // control silently under-covering. This is what proves the fix moved one row and
  // nothing else, and it is the assertion that catches a future derived tier leaking
  // into the picker unintentionally.
  const unchangedTypes = PHASE_TYPE_ORDER.filter((type) => type !== "llm_human_input")

  it("leaves the other five rows byte-identical to their D-183-06 type sentence", () => {
    expect(unchangedTypes).toHaveLength(5)
    renderPicker(twoSteps, 1)
    for (const type of unchangedTypes) {
      expect(rowTitle(type)).toBe(PHASE_TYPE_SENTENCES[type])
    }
  })

  it("the human-input row waits for your approval, and no longer says 'Check with you'", () => {
    renderPicker(twoSteps, 1)
    const row = screen.getByTestId("step-type-choice-llm_human_input")

    // Both halves, so a revert of EITHER side is caught: the row must equal the
    // resolver's answer AND must not have fallen back to the map's.
    expect(rowTitle("llm_human_input")).toBe(cardFaceFor("llm_human_input"))
    expect(rowTitle("llm_human_input")).not.toBe(PHASE_TYPE_SENTENCES.llm_human_input)
    expect(row.textContent).not.toContain(PHASE_TYPE_SENTENCES.llm_human_input)

    // Non-vacuity: the two strings really are different, so the `not.toBe` above is a
    // measurement and not a tautology waiting to become one. D-183-06 keeps its value
    // and D-187-04 keeps its tier — this plan edits neither.
    expect(cardFaceFor("llm_human_input")).not.toBe(PHASE_TYPE_SENTENCES.llm_human_input)
  })

  it("each row is exactly a title line then a subtitle line — the shape rowTitle() reads", () => {
    renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      const title = rowTitle(type)
      expect(title.length).toBeGreaterThan(0)
      // The mark slot carries no text (section 7 asserts that separately), and the ⌥
      // reveal is off with no provider mounted, so the row's whole text is these two.
      expect(screen.getByTestId(`step-type-choice-${type}`).textContent).toBe(
        `${title}${PHASE_TYPE_SUBTITLES[type]}`,
      )
    }
  })

  it("the subtitle line is untouched — still PHASE_TYPE_SUBTITLES, still beaten by a refusal", () => {
    const enabled = renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      expect(screen.getByTestId(`step-type-choice-${type}`)).toHaveTextContent(
        PHASE_TYPE_SUBTITLES[type],
      )
    }
    enabled.unmount()

    // Refused: the reason replaces the subtitle, and the TITLE still previews the card.
    renderPicker(withDeliverable, 3)
    expect(screen.getByTestId("step-type-reason-llm_single")).toHaveTextContent(
      STRANDING_REASON,
    )
    expect(rowTitle("llm_single")).toBe(cardFaceFor("llm_single"))
    expect(screen.getByTestId("step-type-choice-llm_single").textContent).not.toContain(
      PHASE_TYPE_SUBTITLES.llm_single,
    )
  })
})

// ── 2. R10b — the refusal is offered, disabled, WITH its reason ────────────────

describe("StepTypePicker — R10b: refused choices are disabled WITH a visible reason", () => {
  it("disables every choice past the deliverable and shows the reason in the DOM", () => {
    renderPicker(withDeliverable, 3)

    for (const type of PHASE_TYPE_ORDER) {
      const row = screen.getByTestId(`step-type-choice-${type}`)
      expect(row).toHaveAttribute("aria-disabled", "true")
      expect(row).toBeDisabled()

      // The reason is REAL text in the DOM, not a title attribute.
      const reason = screen.getByTestId(`step-type-reason-${type}`)
      expect(reason).toBeInTheDocument()
      expect(reason.textContent?.length ?? 0).toBeGreaterThan(0)
      expect(row).not.toHaveAttribute("title")
    }
  })

  it("renders the reason CHARACTER-IDENTICAL to definitionOps' sentence (it authors none)", () => {
    renderPicker(withDeliverable, 3)
    expect(screen.getByTestId("step-type-reason-llm_single")).toHaveTextContent(
      STRANDING_REASON,
    )
  })

  it("wires the row to its visible reason via aria-describedby", () => {
    renderPicker(withDeliverable, 3)
    const row = screen.getByTestId("step-type-choice-llm_single")
    const describedBy = row.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const reason = document.getElementById(describedBy as string)
    expect(reason).not.toBeNull()
    expect(reason?.textContent).toBe(STRANDING_REASON)
  })

  it("does NOT call onChoose when a refused row is clicked", async () => {
    const onChoose = vi.fn()
    const user = userEvent.setup()
    renderPicker(withDeliverable, 3, { onChoose })

    await user.click(screen.getByTestId("step-type-choice-llm_single"))
    await user.click(screen.getByTestId("step-type-choice-llm_agent"))

    expect(onChoose).not.toHaveBeenCalled()
  })

  it("offers every choice AT the deliverable's position — the new step lands before it", () => {
    renderPicker(withDeliverable, 2)
    for (const type of PHASE_TYPE_ORDER) {
      expect(screen.getByTestId(`step-type-choice-${type}`)).not.toBeDisabled()
      expect(screen.queryByTestId(`step-type-reason-${type}`)).toBeNull()
    }
  })
})

describe("StepTypePicker — a definition with no deliverable refuses nothing", () => {
  it("leaves every row enabled", () => {
    renderPicker(twoSteps, 2)
    for (const type of PHASE_TYPE_ORDER) {
      expect(screen.getByTestId(`step-type-choice-${type}`)).not.toBeDisabled()
    }
  })

  it("calls onChoose with the row's own type, for all six", async () => {
    const user = userEvent.setup()
    for (const type of PHASE_TYPE_ORDER) {
      const onChoose = vi.fn()
      const view = renderPicker(twoSteps, 1, { onChoose })
      await user.click(screen.getByTestId(`step-type-choice-${type}`))
      expect(onChoose).toHaveBeenCalledTimes(1)
      expect(onChoose).toHaveBeenCalledWith(type)
      view.unmount()
    }
  })
})

// ── 3. No option is EVER hidden ───────────────────────────────────────────────

describe("StepTypePicker — nothing is ever omitted", () => {
  it.each([
    ["empty", [] as PhaseSpecJSON[], 0],
    ["two steps, start", twoSteps, 0],
    ["two steps, end", twoSteps, 2],
    ["with deliverable, before it", withDeliverable, 2],
    ["with deliverable, after it", withDeliverable, 3],
    ["out of range", withDeliverable, 99],
    ["negative", withDeliverable, -4],
  ])("renders exactly six rows: %s", (_name, phases, index) => {
    renderPicker(phases, index)
    expect(rows()).toHaveLength(6)
  })
})

// ── 4. D-184-11 — no slug is editable anywhere ────────────────────────────────

describe("StepTypePicker — D-184-11: no editable slug", () => {
  it("renders no text field of any kind", () => {
    const { container } = renderPicker(twoSteps, 1)
    expect(container.querySelectorAll("input, textarea, [contenteditable]")).toHaveLength(0)
  })

  it("renders no phase slug from the definition", () => {
    // Slugs chosen so they cannot collide with any word in the plain-language
    // vocabulary — "deliver" would have matched the sentence "Produce the
    // deliverable", and a test that passes for that reason proves nothing.
    const oddlyNamed: PhaseSpecJSON[] = [
      { slug: "zx-first-step", phase_index: 0, config: { phase_type: "llm_agent" } },
      { slug: "zx-second-step", phase_index: 1, config: { phase_type: "llm_emit" } },
    ]
    renderPicker(oddlyNamed, 1)
    const menu = screen.getByRole("menu")
    expect(menu.textContent).not.toContain("zx-first-step")
    expect(menu.textContent).not.toContain("zx-second-step")
  })
})

// ── 5. Dismissal and keyboard ─────────────────────────────────────────────────

describe("StepTypePicker — dismissal", () => {
  it("Escape calls onDismiss", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPicker(twoSteps, 1, { onDismiss })

    await user.keyboard("{Escape}")
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("a press outside the panel calls onDismiss", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPicker(twoSteps, 1, { onDismiss })

    await user.click(document.body)
    expect(onDismiss).toHaveBeenCalled()
  })

  it("a press INSIDE the panel does not dismiss it", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPicker(twoSteps, 1, { onDismiss })

    await user.click(screen.getByTestId("step-type-choice-llm_agent"))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("Enter on a focused enabled row chooses it", async () => {
    const onChoose = vi.fn()
    const user = userEvent.setup()
    renderPicker(twoSteps, 1, { onChoose })

    screen.getByTestId("step-type-choice-llm_emit").focus()
    await user.keyboard("{Enter}")

    expect(onChoose).toHaveBeenCalledWith("llm_emit")
  })
})

// ── 6. The ⌥ reveal, fail-closed outside a provider ───────────────────────────

describe("StepTypePicker — the technical-names reveal", () => {
  it("renders plain language, no reveal control and no crash with no provider mounted", () => {
    expect(() => renderPicker(twoSteps, 1)).not.toThrow()

    const menu = screen.getByRole("menu")
    expect(menu).toHaveTextContent(PHASE_TYPE_SENTENCES.llm_agent)
    // The technical discriminator is an ATTRIBUTE hook, never rendered text here.
    expect(menu.textContent).not.toContain("llm_agent")
    expect(screen.queryByRole("switch")).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
  })
})

// ── 7. The 3D mark is an element, never a text glyph ──────────────────────────

describe("StepTypePicker — the 3D mark (the locked sketch rule)", () => {
  it("renders an SVG element per row, not a unicode character", () => {
    renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      const mark = screen.getByTestId(`step-type-mark-${type}`)
      expect(mark.querySelector("svg")).not.toBeNull()
      // No bare glyph fell through: the mark slot carries no text at all.
      expect(mark.textContent).toBe("")
    }
  })

  it("marks the icon slot decorative — the sentence carries the meaning", () => {
    renderPicker(twoSteps, 1)
    expect(screen.getByTestId("step-type-mark-llm_emit")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })
})

// ── 8. R10 — the source fence (the shipped `?raw` grep idiom) ─────────────────

describe("StepTypePicker — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("never names the server validation seam and opens no network call", () => {
    expect(stepTypePickerSource).not.toMatch(/fetch\(/)
    expect(stepTypePickerSource).not.toMatch(/workflows\/validate/)
    expect(stepTypePickerSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("imports nothing from the API client", () => {
    expect(stepTypePickerSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("takes its refusals from the pure ops module rather than authoring any", () => {
    expect(stepTypePickerSource).toMatch(
      /from\s+["']@\/components\/workflows\/definitionOps["']/,
    )
    expect(stepTypePickerSource).toMatch(/allowedTypesAt/)
  })

  it("uses the OPTIONAL technical-names accessor, never the throwing one", () => {
    expect(stepTypePickerSource).toMatch(/useTechnicalNamesOptional\(\)/)
    expect(stepTypePickerSource).not.toMatch(/useTechnicalNamesContext\(/)
  })

  it("renders the shared 3D mark and declares no glyph fallback of its own", () => {
    expect(stepTypePickerSource).toMatch(/renderPhaseMark/)
    expect(stepTypePickerSource).not.toMatch(/const PHASE_GLYPHS/)
  })

  // WR-03's fence. The identifier is ASSEMBLED FROM PARTS: this guard file imports the
  // sentence map for its own byte-identity control, and a fence written as a literal
  // would then be one careless copy-paste away from grepping itself. Assembling it also
  // means a global rename cannot quietly rewrite the fence along with the thing fenced.
  const SENTENCE_MAP_IDENTIFIER = ["PHASE", "TYPE", "SENTENCES"].join("_")

  const occurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1

  it("reads NO sentence map of its own — the row title comes from the one resolver", () => {
    expect(occurrences(stepTypePickerSource, SENTENCE_MAP_IDENTIFIER)).toBe(0)
    expect(stepTypePickerSource).toMatch(/nodeTitle/)
    expect(stepTypePickerSource).toMatch(/minimalPhaseFor/)
    // And no local table smuggled in to replace the import it dropped.
    expect(stepTypePickerSource).not.toMatch(/const\s+[A-Z_]*SENTENCE[A-Z_]*\s*[:=]/)
  })

  it("those fences are real — each regex matches its planted literal", () => {
    expect(
      occurrences(`const s = ${SENTENCE_MAP_IDENTIFIER}[choice.type]`, SENTENCE_MAP_IDENTIFIER),
    ).toBe(1)
    expect("const title = nodeTitle(phase)").toMatch(/nodeTitle/)
    expect("minimalPhaseFor(choice.type, slug, 0)").toMatch(/minimalPhaseFor/)
    expect("const LOCAL_SENTENCES = {}").toMatch(/const\s+[A-Z_]*SENTENCE[A-Z_]*\s*[:=]/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect('await api.post("/workflows/validate", body)').toMatch(/workflows\/validate/)
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect("const t = useTechnicalNamesContext()").toMatch(/useTechnicalNamesContext\(/)
    expect("const PHASE_GLYPHS: Record<string, string> = {}").toMatch(/const PHASE_GLYPHS/)
  })
})

// ── 9. The whole-suite network tripwire (must run LAST) ───────────────────────

describe("StepTypePicker — zero network calls across the entire suite", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls).toHaveLength(0)
  })
})

// ── Dismissal must survive a plane that stops propagation ────────────────────────
//
// The operator found the menu inescapable: clicking the canvas did nothing, so the only
// way out was to pick a step — a forced choice, not a menu. Cause: the plane is driven
// by d3-zoom, which calls stopPropagation() on mousedown, so a BUBBLE-phase window
// listener never sees the press. Measured live: 0 bubble hits, 1 capture hit.
describe("StepTypePicker — dismissal survives a stopPropagation'd press", () => {
  it("closes on an outside press even when propagation is stopped before window", () => {
    const onDismiss = vi.fn()
    render(
      <div>
        <div
          data-testid="pane"
          // Stands in for `.react-flow__pane`: swallows the event in the bubble phase.
          onMouseDown={(e) => e.stopPropagation()}
        />
        <StepTypePicker
          phases={[]}
          index={0}
          open
          onChoose={vi.fn()}
          onDismiss={onDismiss}
        />
      </div>,
    )
    fireEvent.mouseDown(screen.getByTestId("pane"))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("a press INSIDE the panel does not dismiss it", () => {
    const onDismiss = vi.fn()
    render(
      <StepTypePicker phases={[]} index={0} open onChoose={vi.fn()} onDismiss={onDismiss} />,
    )
    fireEvent.mouseDown(screen.getByRole("menu"))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
