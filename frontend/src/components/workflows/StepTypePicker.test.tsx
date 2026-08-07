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
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

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
  EXTERNAL_CAPABILITY_SENTENCES,
  derivedFaceOf,
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

// ── Phase 189 — the two vocabulary entries the 7th type does not have YET ──────
//
// `external_action` became PLACEABLE in plan 189-12 (it joined `PHASE_TYPE_ORDER`, so the
// picker offers it), while its plain-language vocabulary and its 3D mark belong to LATER
// plans in the same phase. This file therefore renders a row that is deliberately
// unfinished, and the two lists below are how that is stated OUT LOUD instead of being
// papered over with a `?? ""` nobody notices.
//
// ⚠ EACH LIST IS FALSIFIABLE, WHICH IS THE ONLY REASON IT IS ALLOWED TO EXIST. The cases
// that exclude these types also ASSERT that the entry really is missing — so the day the
// owing plan lands its vocabulary, the exclusion goes RED and has to be emptied. An
// exclusion nothing re-checks is how a temporary gap becomes permanent (189-08's
// declined-`PHASE_TYPE_LABEL` slot is pinned by a behavioural test for the same reason).
//
// The intermediate state is HONEST rather than wrong, and that was measured, not argued:
// the picker's own resolvers floor to `?? ""` and `?? DEFAULT_TINT`, and `nodeTitle`
// echoes the raw discriminator rather than fabricating a sentence, so the row reads
// `external_action` with the "•" fallback mark — never a made-up promise about what the
// step does. The same shape 189-08 shipped when `CanvasReading` grew a member the canvas
// vocabulary had not yet worded.

/**
 * ⚠ DISCHARGED by plan 189-13 — kept EMPTY rather than deleted, for the same reason as
 * its sibling below.
 *
 * 189-12 recorded this debt as *"owed by plan 189-14"*. Measured, it was **189-13's**:
 * that plan owns all three per-type vocabulary maps (`PHASE_TYPE_SENTENCES` /
 * `_SUBTITLES` / `_LABELS`) and 189-14 owns the capability PICKER. Both cases that read
 * this list went RED the moment the sentence landed, exactly as their comments promised,
 * and both are rewritten to the finished claim.
 */
const TYPES_AWAITING_A_VOCABULARY_ENTRY: readonly PhaseTypeId[] = []

/**
 * ⚠ DISCHARGED by plan 189-13 — kept EMPTY rather than deleted, and that is deliberate.
 *
 * This list owed the `outbox-tray` 3D mark (UI-SPEC §5a). The mark landed, the two cases
 * that read this list went RED exactly as their comments promised they would, and both
 * were rewritten to assert the FINISHED state instead of the gap. The constant stays at
 * `[]` so the mechanism is still here and visible the next time a phase type arrives
 * ahead of its mark — and so the cases below keep a live non-vacuity floor rather than
 * silently looping over nothing.
 */
const TYPES_AWAITING_A_3D_MARK: readonly PhaseTypeId[] = []

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

// ── 1. One row per type, fixed order, plain language ──────────────────────────

describe("StepTypePicker — the step-type choices", () => {
  it("renders one row per step type, in the fixed PHASE_TYPE_ORDER", () => {
    renderPicker(twoSteps, 1)
    const order = rows().map((r) => r.getAttribute("data-phase-type"))
    // DERIVED from the order, not re-pinned at 7 (Phase 189): the property is
    // one-row-per-type, and a literal makes the NEXT type read as a regression. The
    // element-by-element compare below is what stops a derived length from being weaker.
    expect(order).toHaveLength(PHASE_TYPE_ORDER.length)
    expect(order).toEqual([...PHASE_TYPE_ORDER])
  })

  it("offers the 7th type LAST — a bare count would pass an insert (Phase 189)", () => {
    renderPicker(twoSteps, 1)
    const order = rows().map((r) => r.getAttribute("data-phase-type"))
    // POSITION, not presence. `PHASE_TYPE_ORDER` is a fixed presentation tuple precisely
    // because "the picker's third option moved" is a UX regression, so the row that
    // arrived must be at the END and every shipped row must still be where it was.
    expect(order[order.length - 1]).toBe("external_action")
    expect(order.slice(0, order.length - 1)).toEqual([
      "programmatic",
      "llm_single",
      "llm_agent",
      "llm_batch_agents",
      "llm_human_input",
      "llm_emit",
    ])
    // It is a real, pressable row rather than a placeholder: offered, not disabled, in a
    // definition that strands nothing.
    expect(screen.getByTestId("step-type-choice-external_action")).not.toBeDisabled()
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
  // ⚠ REWRITTEN AT 189-13, from a hand-named exclusion to a DERIVED one. The rows that do
  // NOT read their type sentence are exactly the rows whose CONFIG-DERIVED tier fires on a
  // freshly-placed step — `llm_human_input` (the tier the WR-03 repair added) and, since
  // 189-13, `external_action` (D-13's capability tier, which fires because
  // `minimalPhaseFor` emits a real `capability`). Deriving it from the resolver itself is
  // what stops a THIRD such type from silently escaping this control, and the derivation
  // is pinned to its expected members below so it cannot quietly widen either.
  const typesWithADerivedFace = PHASE_TYPE_ORDER.filter(
    (type) => derivedFaceOf(minimalPhaseFor(type, PREVIEW_SLUG, 0)) !== null,
  )
  const unchangedTypes = PHASE_TYPE_ORDER.filter(
    (type) => !typesWithADerivedFace.includes(type),
  )

  it("leaves every other shipped row byte-identical to its D-183-06 type sentence", () => {
    // The exclusion is PINNED, not merely derived: a new type whose derived tier fires
    // must be a deliberate change to this line rather than a silent shrinking of the
    // blast-radius control below.
    expect(typesWithADerivedFace).toEqual(["llm_human_input", "external_action"])
    expect(unchangedTypes).toHaveLength(PHASE_TYPE_ORDER.length - 2)
    expect(TYPES_AWAITING_A_VOCABULARY_ENTRY).toHaveLength(0)
    // ⚠ THE EXCLUSION IS STILL FALSIFIABLE, in the other direction now: every excluded
    // type must genuinely HAVE a sentence (the gap 189-12 pinned is closed), so a
    // regression that deleted one would fail here rather than hide inside the filter.
    for (const type of typesWithADerivedFace) {
      expect(PHASE_TYPE_SENTENCES[type]?.length ?? 0).toBeGreaterThan(0)
    }
    renderPicker(twoSteps, 1)
    for (const type of unchangedTypes) {
      expect(rowTitle(type)).toBe(PHASE_TYPE_SENTENCES[type])
    }
  })

  it("previews the 7th row from the resolver — the face a placed step really carries", () => {
    // ⚠ THIS CASE WENT RED WHEN 189-13 LANDED THE VOCABULARY, exactly as its previous
    // comment promised, and the new claim is a DECISION recorded rather than a drift
    // accepted. Its old text asserted the row was NOT any of the three capability
    // sentences, on the reasoning that "a picker row is keyed by TYPE". Measured, a step
    // placed from this row arrives with `capability: "send_email"` — 189-12's
    // `requiredConfigFor` emits a REAL capability because the backend `Literal` is closed
    // and an empty placeholder would 422 the whole definition on first save — so D-13's
    // tier-4 face fires and the row reads "Sends an email".
    //
    // UI-SPEC §6d predicted "Reach outside" here. That prediction PREDATES 189-12's
    // decision, and the property that actually binds is WR-03, the one this whole describe
    // exists for: THE ROW PREVIEWS THE CARD THAT LANDS. Making the row say "Reach outside"
    // while the placed card says "Sends an email" would break it.
    renderPicker(twoSteps, 1)
    expect(rowTitle("external_action")).toBe(cardFaceFor("external_action"))
    expect(rowTitle("external_action")).toBe("Sends an email")
    // Never a FABRICATED verb: whatever the row says is a member of the closed set the
    // node face and the 189-14 picker both read — one constant, never an invented phrase.
    expect(Object.values(EXTERNAL_CAPABILITY_SENTENCES)).toContain(rowTitle("external_action"))
    // The tier-3 floor is NOT retired and is still the honest face of a step with no
    // recognised capability — driven from stored data in `phaseVocabulary.test.ts`.
    expect(PHASE_TYPE_SENTENCES.external_action).toBe("Reach outside")
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
      // The mark slot carries no text FOR A TYPE THAT HAS A 3D MARK (section 7 asserts
      // that, and its own exclusion), and the ⌥ reveal is off with no provider mounted,
      // so the row's whole text is these two — plus the "•" fallback for a type whose
      // mark has not shipped.
      //
      // ⚠ `?? ""` MIRRORS THE SHIPPED RESOLVER, it is not a test-side patch: the picker
      // renders `PHASE_TYPE_SUBTITLES[choice.type] ?? ""` (StepTypePicker.tsx), so an
      // absent subtitle is an EMPTY subtitle line by construction. Writing the lookup
      // bare here asserted a `undefined` string into the expectation and failed with
      // `'external_actionundefined'` — a test asserting the resolver's floor is wrong.
      const mark = TYPES_AWAITING_A_3D_MARK.includes(type) ? "•" : ""
      expect(screen.getByTestId(`step-type-choice-${type}`).textContent).toBe(
        `${mark}${title}${PHASE_TYPE_SUBTITLES[type] ?? ""}`,
      )
    }
  })

  it("the subtitle line is untouched — still PHASE_TYPE_SUBTITLES, still beaten by a refusal", () => {
    const enabled = renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      // A type whose subtitle has not shipped renders an EMPTY subtitle line — the
      // shipped `?? ""` floor. `toHaveTextContent("")` is vacuous, so that case is
      // asserted as an absence instead, and the absence is re-checked so 189-14's
      // arrival turns this red rather than sliding past it.
      if (TYPES_AWAITING_A_VOCABULARY_ENTRY.includes(type)) {
        expect(PHASE_TYPE_SUBTITLES[type]).toBeUndefined()
        continue
      }
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
  it("refuses every choice past the deliverable, shows the reason, and stays FOCUSABLE", () => {
    renderPicker(withDeliverable, 3)

    for (const type of PHASE_TYPE_ORDER) {
      const row = screen.getByTestId(`step-type-choice-${type}`)
      expect(row).toHaveAttribute("aria-disabled", "true")
      // ⚠ REWRITTEN IN PLACE BY `BUG-260807-02`'s KEYBOARD HALF, never deleted — the
      // claim changed and the case is re-stated rather than dropped. This read
      // `toBeDisabled()` while the row carried the NATIVE `disabled` attribute, which
      // cannot receive focus — so a keyboard or screen-reader author could never reach
      // the row and therefore never heard the reason this component exists to teach
      // (its own docblock: "an option greyed out mutely is worse"). WAI-ARIA APG says a
      // disabled menu item SHOULD stay focusable precisely so it stays discoverable, so
      // the native attribute is gone and only `aria-disabled` announces the refusal.
      // `jest-dom`'s `toBeDisabled` does NOT consult `aria-disabled`, which is exactly
      // why this assertion had to be re-stated instead of quietly passing.
      expect(row).not.toBeDisabled()
      expect(row).toHaveAttribute("tabindex")

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
  ])("renders one row per step type, never fewer: %s", (_name, phases, index) => {
    renderPicker(phases, index)
    // DERIVED (Phase 189). The rule R10b states is "nothing is ever hidden" — a refused
    // choice is disabled WITH its reason, never omitted (139-C). That rule is about the
    // WHOLE order, not about the number six, and it read `6` until the 7th type landed.
    expect(rows()).toHaveLength(PHASE_TYPE_ORDER.length)
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
      if (TYPES_AWAITING_A_3D_MARK.includes(type)) continue
      const mark = screen.getByTestId(`step-type-mark-${type}`)
      expect(mark.querySelector("svg")).not.toBeNull()
      // No bare glyph fell through: the mark slot carries no text at all.
      expect(mark.textContent).toBe("")
    }
    // Non-vacuity: the loop above must still be measuring most of the order.
    expect(PHASE_TYPE_ORDER.length - TYPES_AWAITING_A_3D_MARK.length).toBeGreaterThan(1)
  })

  it("EVERY offered type now has a real mark — no row is still on the '•' floor", () => {
    // ⚠ THIS CASE WENT RED WHEN 189-13 LANDED `outbox-tray`, exactly as its previous
    // comment promised: it used to assert that `external_action` rendered the "•"
    // fallback and NO `<svg>`, which was Phase 189's honest intermediate state. The
    // exclusion has been discharged rather than left to outlive its reason, and the case
    // is REWRITTEN to the finished claim instead of deleted — deleting it would drop the
    // only assertion that no row is quietly sitting on the floor.
    expect(TYPES_AWAITING_A_3D_MARK).toHaveLength(0)
    renderPicker(twoSteps, 1)
    for (const type of PHASE_TYPE_ORDER) {
      const mark = screen.getByTestId(`step-type-mark-${type}`)
      expect(mark.querySelector("svg")).not.toBeNull()
      expect(mark.textContent).not.toBe("•")
      // Still decorative, and still no wrong icon borrowed from another type.
      expect(mark).toHaveAttribute("aria-hidden", "true")
    }
    // The "•" floor is NOT retired — `renderPhaseMark` stays total over an
    // author-supplied discriminator (188.1-04's WR-04 property, pinned in
    // `soulData.test.ts` and `PhaseNode.test.tsx`). What is retired is the EXCLUSION:
    // no type this picker OFFERS is awaiting a mark.
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

// ── 8b. BUG-260807-02 — the measured bound, and the wheel that makes it real ───
//
// ⚠ EVERY ASSERTION IN THIS BLOCK IS ABOUT THE CONTRACT, NEVER ABOUT THE DEFECT.
// jsdom applies no CSS, computes no overflow clipping and no stacking contexts, and
// `.click()` bypasses hit-testing — which is precisely why this suite was green while
// row 7 (`external_action`, the type Phase 189 exists to ship) was unreachable from all
// three insertion doors. So what is pinned here is what a renderer with no layout CAN
// see: the two library opt-out class tokens, the two overflow tokens, the inline bound
// arriving from the CALLER, and the wheel not escaping to a parent. The acceptance is a
// DRIVEN `elementFromPoint` probe at a small viewport, recorded on the bug report.
//
// The panel measures NOTHING itself and must not start: it is a leaf that renders with no
// `ReactFlowProvider`, imports nothing from `@xyflow/react` and reads no DOM. The budget
// is a NUMBER computed by `PlaneEditingLayer` from `pickerPlacement`.

describe("StepTypePicker — BUG-260807-02: the caller's bound and the wheel opt-out", () => {
  const panel = () => screen.getByTestId("step-type-picker")

  it("carries the library's OWN opt-out classes, on the panel element itself", () => {
    renderPicker(twoSteps, 1)
    // `nowheel` is the half that actually works. `@xyflow/system`'s
    // `createZoomOnScrollHandler` short-circuits with `return null` — no `preventDefault`,
    // so the native scroll proceeds on the scrollable element — whenever
    // `isWrappedWithClass(event, noWheelClassName)` is true, and that helper is an
    // ANCESTOR WALK from the event target (`event.target.closest('.' + className)`).
    // `nopan` ships beside it so dragging the panel's own scrollbar cannot pan the canvas.
    // Asserted on the panel ITSELF rather than on any ancestor: the walk starts at the
    // event target and an ancestor of the canvas is not on that path.
    expect(panel().classList.contains("nowheel")).toBe(true)
    expect(panel().classList.contains("nopan")).toBe(true)
  })

  it("scrolls its own overflow rather than clipping it away", () => {
    renderPicker(twoSteps, 1)
    expect(panel().classList.contains("overflow-y-auto")).toBe(true)
    // `overscroll-contain` so reaching the menu's end does not hand the gesture onward.
    expect(panel().classList.contains("overscroll-contain")).toBe(true)
  })

  it("renders the CALLER's budget as an inline max-height", () => {
    render(
      <StepTypePicker
        phases={twoSteps}
        index={1}
        open
        maxHeightPx={240}
        onChoose={noop}
        onDismiss={noop}
      />,
    )
    expect(panel().style.maxHeight).toBe("240px")
  })

  it.each([
    ["the prop omitted", {}],
    ["an explicit null — the unmeasured container", { maxHeightPx: null }],
  ])("renders NO inline max-height at all with %s", (_name, extra) => {
    // The shipped, unbounded panel is what jsdom keeps seeing, which is what keeps every
    // case above this one measuring the component it was written against. `null` is
    // `pickerPlacement`'s DO-NOT-BOUND answer for a container the library has not
    // measured yet — jsdom always, and a browser's very first paint.
    render(
      <StepTypePicker
        phases={twoSteps}
        index={1}
        open
        onChoose={noop}
        onDismiss={noop}
        {...extra}
      />,
    )
    expect(panel().style.maxHeight).toBe("")
    expect(panel().getAttribute("style") ?? "").not.toContain("max-height")
  })

  it("swallows a wheel before it reaches a parent — WITH the control that says so", () => {
    const onParentWheel = vi.fn()
    render(
      // Stands in for `.react-flow`, which is itself a static element carrying a wheel
      // listener. It draws no `jsx-a11y/no-static-element-interactions` error — that rule
      // fires on pointer/key handlers, not on `onWheel`, which is why the shipped `pane`
      // stand-in below (an `onMouseDown`) does and this one does not.
      <div role="presentation" onWheel={onParentWheel}>
        <div data-testid="outside-the-panel" />
        <StepTypePicker
          phases={twoSteps}
          index={1}
          open
          onChoose={noop}
          onDismiss={noop}
        />
      </div>,
    )

    fireEvent.wheel(panel())
    expect(onParentWheel).not.toHaveBeenCalled()

    // ⚠ THE POSITIVE CONTROL, in the SAME case so it cannot drift away from the claim it
    // props up: without it, "the wheel does not reach the parent" is equally satisfied by
    // a harness where no wheel reaches anything.
    fireEvent.wheel(screen.getByTestId("outside-the-panel"))
    expect(onParentWheel).toHaveBeenCalledTimes(1)
  })
})

// ── 8c. BUG-260807-02, the KEYBOARD half — the APG vertical-`menu` contract ────
//
// ⚠ WHAT THIS BLOCK CAN AND CANNOT SEE, stated before the first assertion. jsdom applies
// no CSS and computes no layout, so it cannot observe the one thing that can go wrong in
// the SCROLL half — arrow-keying to row 7 scrolling an ANCESTOR instead of the panel,
// which `.react-flow`'s `overflow: hidden` makes possible and which manufactured a false
// 7/7 in the clipping half's first probe. That is measured by DRIVING real key presses,
// and the readings live on the bug report.
//
// What jsdom IS honest about is FOCUS: `document.activeElement`, `tabindex` and the order
// in which the two move are real here. So the roving half is a unit test, and every case
// below asserts BOTH the focused element AND the whole tabindex array — a component that
// moved focus without moving the roving stop, or the reverse, fails.
//
// THE DEFECT THIS CLOSES, measured live on this build (2026-08-08, `Compliance Gap
// Report` draft at 1280 × 666, door `canvas-insert-0`): after opening the menu
// `document.activeElement` was the `＋` itself, a REAL `ArrowDown` moved it NOWHERE, and a
// REAL `Tab` jumped straight PAST the open menu to the next door. All seven menuitems
// carried `tabindex: null`.

describe("StepTypePicker — BUG-260807-02: focus enters the menu, and roves", () => {
  /** Every row's `tabindex`, in DOM order, as ONE array — never a spot check. */
  const tabindexes = (): (string | null)[] => rows().map((r) => r.getAttribute("tabindex"))

  /** The roving order with the stop at `i`: exactly one `0`, every other `-1`. */
  const rovingAt = (i: number): string[] =>
    PHASE_TYPE_ORDER.map((_, k) => (k === i ? "0" : "-1"))

  const LAST = PHASE_TYPE_ORDER.length - 1
  const testidAt = (i: number) => `step-type-choice-${PHASE_TYPE_ORDER[i]}`

  it("moves focus INTO the menu on open — the measured inverse of the defect", () => {
    renderPicker(twoSteps, 1)
    const panel = screen.getByTestId("step-type-picker")

    expect(panel.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(0)))
  })

  it("is ONE tab stop — exactly one row carries tabindex 0, asserted as a whole array", () => {
    renderPicker(twoSteps, 1)
    expect(tabindexes()).toEqual(rovingAt(0))
    // Non-vacuity: the array really has the shape the claim describes, so a component
    // that emitted seven `0`s (seven tab stops — the WR-04 defect) could not pass.
    expect(tabindexes().filter((t) => t === "0")).toHaveLength(1)
    expect(tabindexes()).toHaveLength(PHASE_TYPE_ORDER.length)
  })

  it("ArrowDown walks every row to the LAST one and then WRAPS to the first", async () => {
    const user = userEvent.setup()
    renderPicker(twoSteps, 1)

    for (let i = 1; i <= LAST; i++) {
      await user.keyboard("{ArrowDown}")
      expect(document.activeElement).toBe(screen.getByTestId(testidAt(i)))
      expect(tabindexes()).toEqual(rovingAt(i))
    }
    // Row 7 is `external_action` — the capability Phase 189 exists to ship, and the row
    // this bug is named for. Named explicitly so a shrinking order cannot quietly make
    // this walk shorter.
    expect(document.activeElement).toBe(screen.getByTestId("step-type-choice-external_action"))

    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(0)))
    expect(tabindexes()).toEqual(rovingAt(0))
  })

  it("ArrowUp from the first row WRAPS to the last — the cheap route to row 7", async () => {
    const user = userEvent.setup()
    renderPicker(twoSteps, 1)

    await user.keyboard("{ArrowUp}")
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(LAST)))
    expect(tabindexes()).toEqual(rovingAt(LAST))

    await user.keyboard("{ArrowUp}")
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(LAST - 1)))
    expect(tabindexes()).toEqual(rovingAt(LAST - 1))
  })

  it("Home lands on the first row and End on the last", async () => {
    const user = userEvent.setup()
    renderPicker(twoSteps, 1)

    await user.keyboard("{End}")
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(LAST)))
    expect(tabindexes()).toEqual(rovingAt(LAST))

    await user.keyboard("{Home}")
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(0)))
    expect(tabindexes()).toEqual(rovingAt(0))
  })

  it("ArrowRight and ArrowLeft move NOTHING — and ArrowDown, here, moves it", async () => {
    // ⚠ THE CONTROL, IN THE SAME CASE AS THE CLAIM IT PROPS UP. Without the pair,
    // "the arrow keys work" is equally satisfied by a harness in which every key moves
    // focus. Left/Right are unmapped BECAUSE this is a vertical `menu`;
    // `ExternalActionSection` maps them because it is a `radiogroup`, where APG makes
    // them synonyms of Down/Up. The difference between the two ARIA patterns is
    // deliberate, and this is what keeps it deliberate.
    const user = userEvent.setup()
    renderPicker(twoSteps, 1)

    const before = document.activeElement
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(before)
    expect(tabindexes()).toEqual(rovingAt(0))

    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(before)
    expect(tabindexes()).toEqual(rovingAt(0))

    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).not.toBe(before)
    expect(document.activeElement).toBe(screen.getByTestId(testidAt(1)))
  })

  it("NEVER calls scrollIntoView — the ancestor-scrolling cheat, fenced on source", () => {
    // ⚠ `scrollIntoView` walks up and scrolls the NEAREST SCROLLABLE ANCESTOR, and
    // `.react-flow` is `overflow: hidden` — programmatically scrollable with no scrollbar
    // and no user gesture that can move it. The clipping half's first probe used it and
    // manufactured a FALSE 7/7 reachability reading on 2026-08-07; the tell was that its
    // falsification control refused to swing. The same trap lives in the DEFAULT
    // `focus()` scroll, which is why the fix focuses with `preventScroll` and moves the
    // panel's own `scrollTop` by hand.
    // ⚠ THE FENCE MATCHES A CALL, NOT A MENTION, and that scoping is deliberate rather
    // than a loosening: written bare as `/scrollIntoView/` it went RED against the fix's
    // OWN DOCBLOCK, which names the trap three times so the next author sees why the
    // panel is scrolled by hand. A fence that forbids explaining itself is a fence that
    // gets deleted. `.scrollIntoView(` is the only spelling that can actually scroll an
    // ancestor, so it is the only spelling forbidden.
    expect(stepTypePickerSource).not.toMatch(/\.scrollIntoView\s*\(/)
    expect(stepTypePickerSource).toMatch(/preventScroll:\s*true/)
    expect(stepTypePickerSource).toMatch(/scrollTopToReveal/)
    // The fence is real — the regex matches its planted literal, and the prose form the
    // docblock uses is genuinely NOT matched, so the narrowing is measured not asserted.
    expect('row.scrollIntoView({ block: "nearest" })').toMatch(/\.scrollIntoView\s*\(/)
    expect("the default focus scroll — like `scrollIntoView` — walks ancestors").not.toMatch(
      /\.scrollIntoView\s*\(/,
    )
  })

  it("Escape still dismisses WITH focus inside the menu — the shipped listener unswallowed", async () => {
    // ⚠ RE-STATED AS A NEW CASE rather than by editing the shipped one. The shipped
    // "Escape calls onDismiss" fires the key with focus on the BODY, so it cannot see a
    // container handler that swallows the key before it reaches the gated `window`
    // listener — which is exactly the regression the new handler could introduce.
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPicker(twoSteps, 1, { onDismiss })

    const panel = screen.getByTestId("step-type-picker")
    await user.keyboard("{ArrowDown}")
    expect(panel.contains(document.activeElement)).toBe(true)

    await user.keyboard("{Escape}")
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

/**
 * A real opener, so focus RETURN is measured rather than assumed. The picker captures
 * `document.activeElement` at open time, which is what lets ONE design cover BOTH mount
 * sites — the `＋` doors in `PlaneEditingLayer` and the empty-state door in
 * `WorkflowCanvas` — without either caller passing a ref down.
 */
function OpenerHarness({
  onChoose,
  onDismiss,
}: {
  onChoose?: (t: string) => void
  onDismiss?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" data-testid="the-opener" onClick={() => setOpen(true)}>
        ＋
      </button>
      <StepTypePicker
        phases={twoSteps}
        index={1}
        open={open}
        onChoose={(t) => {
          onChoose?.(t)
          setOpen(false)
        }}
        onDismiss={() => {
          onDismiss?.()
          setOpen(false)
        }}
      />
    </div>
  )
}

describe("StepTypePicker — BUG-260807-02: focus comes back to the opener", () => {
  it("returns focus to the ＋ after Escape, and never strands it on the body", async () => {
    const user = userEvent.setup()
    render(<OpenerHarness />)

    const opener = screen.getByTestId("the-opener")
    await user.click(opener)
    expect(document.activeElement).toBe(screen.getByTestId("step-type-choice-programmatic"))

    await user.keyboard("{Escape}")
    // The restore lands on the NEXT animation frame, deliberately — awaited, never
    // assumed synchronous.
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect(document.activeElement).not.toBe(document.body)
  })

  it("returns focus to the ＋ after CHOOSING a row", async () => {
    const onChoose = vi.fn()
    const user = userEvent.setup()
    render(<OpenerHarness onChoose={onChoose} />)

    const opener = screen.getByTestId("the-opener")
    await user.click(opener)
    await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")

    expect(onChoose).toHaveBeenCalledWith("llm_single")
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect(document.activeElement).not.toBe(document.body)
  })
})

// ── 8d. The consequence of dropping the native `disabled`, stated as tests ─────
//
// ⚠ THE ACTIVATION GUARD IS NOW LOAD-BEARING, and it never had to be before. A natively
// disabled button swallows a click in the BROWSER, and React's own
// `shouldPreventMouseEvent` filters `onClick` for one on top of that — so the shipped
// "does NOT call onChoose when a refused row is clicked" was satisfied by a harness in
// which nothing was clicked at all. After this change a real mouse user can physically
// press a refused row and a real keyboard user can press Enter or Space on one, and the
// ONLY thing stopping the choice is `onClick`'s `if (refused) return`. So each case below
// carries a POSITIVE CONTROL proving the event genuinely reached the row.

describe("StepTypePicker — a refused row is reachable, announced, and still unchoosable", () => {
  it("is reachable BY THE ARROW WALK — which is how the author finally hears the reason", async () => {
    const user = userEvent.setup()
    renderPicker(withDeliverable, 3)

    // Every row is refused at this insertion point, so walking to the LAST one exercises
    // the whole order and lands on `external_action`.
    for (let i = 1; i < PHASE_TYPE_ORDER.length; i++) {
      await user.keyboard("{ArrowDown}")
    }
    const row = screen.getByTestId("step-type-choice-external_action")
    expect(document.activeElement).toBe(row)
    expect(row).toHaveAttribute("aria-disabled", "true")
    expect(row).not.toBeDisabled()

    // …and the reason it announces is REAL DOM text, wired by `aria-describedby`.
    const describedBy = row.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent?.length ?? 0)
      .toBeGreaterThan(0)
  })

  it("shows that it holds focus — a row that can be focused must say so (WCAG 2.4.7)", () => {
    // Refused rows carried `cursor-not-allowed opacity-[0.42]` and NO focus style at all,
    // because they could not take focus. They can now, so they must show it.
    const refusedView = renderPicker(withDeliverable, 3)
    const refused = screen.getByTestId("step-type-choice-llm_single")
    expect(refused.className).toMatch(/cursor-not-allowed/)
    expect(refused.className).toMatch(/focus-visible:/)
    refusedView.unmount()

    // The positive control, in the same case: the ENABLED row's own focus token, so this
    // is measuring the refused row's branch rather than a class every row shares.
    renderPicker(twoSteps, 1)
    const enabled = screen.getByTestId("step-type-choice-llm_single")
    expect(enabled.className).not.toMatch(/cursor-not-allowed/)
    expect(enabled.className).toMatch(/focus-visible:/)
  })

  it("does NOT choose on a real click — WITH the control proving the click landed", async () => {
    const onChoose = vi.fn()
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPicker(withDeliverable, 3, { onChoose, onDismiss })

    const row = screen.getByTestId("step-type-choice-llm_single")
    const reached = vi.fn()
    row.addEventListener("click", reached, true)

    await user.click(row)

    expect(onChoose).not.toHaveBeenCalled()
    // ⚠ THE POSITIVE CONTROL. Without it, "onChoose was not called" is equally satisfied
    // by a harness where the click never reached anything — the exact vacuity that kept
    // the shipped case green while the row was natively disabled and unclickable.
    expect(reached).toHaveBeenCalledTimes(1)
    // And a second, independent witness that the press landed INSIDE the panel: the
    // outside-press dismissal did not fire.
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("does NOT choose on Enter or Space with the refused row focused", async () => {
    const onChoose = vi.fn()
    const user = userEvent.setup()
    renderPicker(withDeliverable, 3, { onChoose })

    const row = screen.getByTestId("step-type-choice-llm_single")
    const reached = vi.fn()
    row.addEventListener("click", reached, true)

    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(row)

    await user.keyboard("{Enter}")
    await user.keyboard(" ")

    expect(onChoose).not.toHaveBeenCalled()
    // The control again: both keys really did activate the button — the guard is what
    // stopped the choice, not an inert harness.
    expect(reached.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("an ENABLED row still chooses on Enter and on Space", async () => {
    const user = userEvent.setup()

    const withEnter = vi.fn()
    const a = renderPicker(twoSteps, 1, { onChoose: withEnter })
    await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")
    expect(withEnter).toHaveBeenCalledWith("llm_single")
    a.unmount()

    const withSpace = vi.fn()
    renderPicker(twoSteps, 1, { onChoose: withSpace })
    await user.keyboard("{End}")
    await user.keyboard(" ")
    expect(withSpace).toHaveBeenCalledWith("external_action")
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
