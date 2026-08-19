/**
 * Phase 196 Plan 05 Task 2 (AUTH-04 / D-04 … D-15) — the registry-backed picker's suite.
 *
 * ⚠ THE API CLIENT MODULE IS DELIBERATELY NOT STUBBED IN THIS FILE, AND THAT ABSENCE IS
 * THE POINT. `ModelField` takes `models` and `runDefaultModel` as PROPS, so there is
 * nothing to stub: it cannot fetch, because it is never given a way to. Every other picker
 * in this tree stubs the client because every other picker fetches its own rows. If a
 * later change to the component makes a stub necessary here, that change has moved the
 * fetch back into a component that mounts four times inside one panel — and this paragraph
 * is the notice that doing so is the regression, not the test.
 *
 * ⚠ The stubbing call itself is not spelled anywhere in this file, deliberately: this
 * plan's acceptance is a GREP for it, and prose quoting the pattern it bans is what makes
 * such a grep unreadable (the 187-24 lesson, which plan 196-04 met three times in one
 * afternoon). A grep for that call over this file must come back EMPTY.
 *
 * ── THE THREE THINGS THIS SUITE PROVES THAT NO SHIPPED SUITE PROVES ──────────────────────
 *
 * 1. ZERO WRITES ON OPEN (D-07 / T-196-TAMP1). No shipped picker test in this repository
 *    asserts that mounting a form performs no write. `ModelDefaultPreference` and
 *    `JudgeModelPicker` both happen to have the property — they persist only inside their
 *    own select handler — but "happens to" is not "is guaranteed to", and a form that
 *    rewrites a stored value as a side effect of being LOOKED AT is a silent integrity
 *    change to a saved definition. Transposed from the backend's own idiom
 *    (`assert not pool.calls, "the guard must 409 BEFORE any write"`) into call-count
 *    assertions on both callbacks, plus the select's own `.value`, because a component
 *    that rendered nothing would also call nothing.
 *
 * 2. THE SOURCE FENCE, WITH A POSITIVE CONTROL AND A VACUITY FLOOR. A component with no
 *    effect CANNOT fire a write on mount, so the behavioural assertions above are made
 *    structural by greping the component's own `?raw` text. ⚠ A fence with no observed
 *    control is not evidence: the control below runs the SAME extractor over a fixture
 *    string that does contain the forbidden tokens, so a broken extractor reds instead of
 *    reporting a clean file.
 *
 * 3. BLUR IDEMPOTENCE (A6 / T-196-TAMP2). The panel persists on blur, and a user tabbing
 *    PAST the field must not alter what is stored. `SelectField` has wired that since
 *    Phase 185, but "the old field did it too" is not the same claim as "it is correct",
 *    so it is asserted for the new field rather than inherited.
 *
 * ── THE FIXTURE IS BUILT FROM THE INTERESTING ROWS, ON PURPOSE ───────────────────────────
 *
 * A registry-known, enabled, strongest-tier model passes every check this plan adds and
 * proves nothing. So the fixture is: a DISABLED row, a code-registry row, two DB-only rows
 * whose tier is NULL (the dominant shape — migration 120 shipped the column nullable and
 * every row is null today), a natively weakest-tier row, and a DEPRECATED-but-enabled row.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { AuthorModelRow } from "@/lib/api"

import { ModelField } from "./ModelField"
import { MODEL_FITNESS_WORD } from "./modelFitness"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import modelFieldSource from "./ModelField?raw"

/** One registry row. Defaults are the SAFE/uninteresting values; every case overrides the
 *  one field it is actually about, so a reader can see what each row is for. */
function row(over: Partial<AuthorModelRow> & { model_id: string }): AuthorModelRow {
  return {
    provider: "openai",
    capability_source: "registry",
    enabled: true,
    deprecated: false,
    emit_tier: null,
    ...over,
  }
}

/** A DISABLED row — offered nowhere, but retained as `(current)` when already stored. */
const DISABLED_ID = "gpt-5.2"
/** A code-registry row carrying the STRONGEST tier. */
const STRICT_ID = "gpt-5.5"
/** Two DB-only rows with NO tier at all — the dominant shape, and both resolve weakest. */
const NULL_TIER_A = "glm-4.7-flash"
const NULL_TIER_B = "gemini-3.6-flash"
/** The only natively weakest-tier family in the registry. */
const COERCE_ID = "kimi-k2.6"
/** Deprecated is NOT disabled — this row stays offered and selectable. */
const DEPRECATED_ID = "claude-opus-4-8"

const MODELS: AuthorModelRow[] = [
  row({ model_id: DISABLED_ID, enabled: false, emit_tier: "force_strict" }),
  row({ model_id: STRICT_ID, capability_source: "code", emit_tier: "force_strict" }),
  row({ model_id: NULL_TIER_A, provider: "zhipu", capability_source: "db", emit_tier: null }),
  row({ model_id: NULL_TIER_B, provider: "google", capability_source: "db", emit_tier: null }),
  row({ model_id: COERCE_ID, provider: "moonshot", emit_tier: "coerce" }),
  row({ model_id: DEPRECATED_ID, provider: "anthropic", emit_tier: "force", deprecated: true }),
]

/** Every id the picker may offer — derived from the fixture, never re-typed. */
const OFFERABLE = MODELS.filter((m) => m.enabled).map((m) => m.model_id)

/** The run default a resolved server read would supply. Deliberately NOT a hardcoded
 *  house model: the three real candidates measured on this tree do not agree with each
 *  other, which is the whole argument for the value being computed rather than written
 *  down. Any id will do here — what is asserted is that the LABEL carries whatever the
 *  server said. */
const RESOLVED_DEFAULT = "deepseek-v4-flash"

/** The locked leading label, spelled literally exactly once so the assertions below
 *  FALSIFY the component rather than copy it. */
const INHERIT_BARE = "Use the run's model"
const UNKNOWN_CAPTION =
  "not in the registry — forced emission unavailable, document steps run best-effort"

type Handlers = { onChange: ReturnType<typeof vi.fn>; onPersist: ReturnType<typeof vi.fn> }

function mount(
  props: Partial<Parameters<typeof ModelField>[0]> = {},
): Handlers & { select: HTMLSelectElement } {
  const onChange = vi.fn()
  const onPersist = vi.fn()
  render(
    <ModelField
      value=""
      onChange={onChange}
      onPersist={onPersist}
      models={MODELS}
      runDefaultModel={null}
      {...props}
    />,
  )
  const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
  return { onChange, onPersist, select }
}

/** Option TEXT, in rendered order. */
function optionTexts(select: HTMLSelectElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "")
}

describe("ModelField 196-05 — registry-only: there is no free-text path (AUTH-04)", () => {
  it("offers exactly the inherit option plus the ENABLED rows, and nothing else", () => {
    const { select } = mount()
    const texts = optionTexts(select)
    expect(texts).toHaveLength(OFFERABLE.length + 1)
    for (const id of OFFERABLE) {
      expect(within(select).getByRole("option", { name: id })).toBeInTheDocument()
    }
    // NON-VACUITY: the fixture really does contain rows, so "exactly these" is a claim
    // about a populated list rather than about an empty one.
    expect(OFFERABLE.length).toBeGreaterThan(3)
  })

  it("a DISABLED row is not offered, and a model absent from the prop is unreachable", () => {
    const { select } = mount()
    expect(within(select).queryByRole("option", { name: DISABLED_ID })).toBeNull()
    expect(within(select).queryByRole("option", { name: "not-a-real-model" })).toBeNull()
  })

  it("renders NO text input of any kind — the requirement, asserted on the DOM", () => {
    // AUTH-04 in one sentence: the control that sets a step's model offers only ids the
    // live registry knows. A stray textbox anywhere in this subtree would defeat it.
    mount()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(document.querySelectorAll("input")).toHaveLength(0)
  })

  it("dedupes and sorts the offered ids by localeCompare", () => {
    const duplicated = [...MODELS, row({ model_id: STRICT_ID, emit_tier: "force_strict" })]
    const onChange = vi.fn()
    render(
      <ModelField
        value=""
        onChange={onChange}
        onPersist={vi.fn()}
        models={duplicated}
        runDefaultModel={null}
      />,
    )
    const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
    const values = within(select)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
      .filter((v) => v !== "")
    expect(new Set(values).size).toBe(values.length)
    expect(values).toEqual([...values].sort((a, b) => a.localeCompare(b)))
  })
})

describe("ModelField 196-05 — the inherit option HEDGES, and never asserts (D-05 / D-06)", () => {
  it("is a NAMED leading option with the empty value, not an empty slot (D-05)", () => {
    const { select } = mount()
    const first = within(select).getAllByRole("option")[0] as HTMLOptionElement
    expect(first.value).toBe("")
    expect(first.textContent?.trim().length).toBeGreaterThan(0)
    expect(first.textContent).toContain(INHERIT_BARE)
  })

  it("names the id the run would actually inherit, IN THE LABEL (D-06)", () => {
    const { select } = mount({ runDefaultModel: RESOLVED_DEFAULT })
    const first = within(select).getAllByRole("option")[0] as HTMLOptionElement
    expect(first.textContent).toBe(`${INHERIT_BARE} — today that would be ${RESOLVED_DEFAULT}`)
    // …and the hedge really is a hedge: the sentence says "today", not "the default".
    expect(first.textContent).toContain("today")
  })

  it("degrades to the BARE sentence when the server resolved none — never a guess", () => {
    const { select } = mount({ runDefaultModel: null })
    const first = within(select).getAllByRole("option")[0] as HTMLOptionElement
    expect(first.textContent).toBe(INHERIT_BARE)
    expect(first.textContent).not.toContain("today")
    // POSITIVE CONTROL — the clause really is reachable, so its absence here is a
    // measurement of the null branch rather than a label that never carries one.
    expect(first.textContent).not.toBe(
      `${INHERIT_BARE} — today that would be ${RESOLVED_DEFAULT}`,
    )
  })

  it("⚠ renders NO always-on footer asserting a default — the shape D-06 forbids", () => {
    // Both shipped pickers carry an `Effective model: …` footer. It asserts a fixed default
    // the code does not implement: a run inherits whatever model STARTED it, which is
    // knowable at run time and not at authoring time. The hedge lives in the label instead.
    const { container } = render(
      <ModelField
        value=""
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={RESOLVED_DEFAULT}
      />,
    )
    expect(container.textContent).not.toMatch(/Effective/i)
  })
})

describe("ModelField 196-05 — it KEEPS what it cannot offer (D-07 / D-08)", () => {
  it("a DISABLED stored value is retained as `(current)` and stays selected (D-07)", () => {
    const { select } = mount({ value: DISABLED_ID })
    expect(within(select).getByText(`${DISABLED_ID} (current)`)).toBeInTheDocument()
    expect(select.value).toBe(DISABLED_ID)
    // It is retained, not re-offered: the id appears exactly once in the whole list.
    const withId = optionTexts(select).filter((t) => t.includes(DISABLED_ID))
    expect(withId).toHaveLength(1)
  })

  it("an UNKNOWN stored value is retained, NAMES its consequence, and does not block (D-08)", () => {
    const { select } = mount({ value: "not-a-real-model" })
    expect(
      within(select).getByText("not-a-real-model (current) — not in the registry"),
    ).toBeInTheDocument()
    expect(select.value).toBe("not-a-real-model")
    // The consequence is stated in USER words, beside the field — an operator retiring a
    // registry row must not make an existing workflow unsaveable, so nothing is disabled.
    expect(screen.getByText(UNKNOWN_CAPTION)).toBeInTheDocument()
    expect(select).not.toBeDisabled()
  })

  it("the caption appears ONLY for the unknown case — a disabled row is a known row", () => {
    const { select } = mount({ value: DISABLED_ID })
    expect(screen.queryByText(UNKNOWN_CAPTION)).toBeNull()
    expect(select.value).toBe(DISABLED_ID)
  })

  it("…and never for a value the registry offers", () => {
    mount({ value: STRICT_ID })
    expect(screen.queryByText(UNKNOWN_CAPTION)).toBeNull()
    expect(screen.queryByText(/\(current\)/)).toBeNull()
  })
})

describe("ModelField 196-05 — ⚠ opening the form WRITES NOTHING (D-07, T-196-TAMP1)", () => {
  it("renders with a DISABLED stored value and calls neither callback", () => {
    const { onChange, onPersist, select } = mount({ value: DISABLED_ID })
    expect(onChange).toHaveBeenCalledTimes(0)
    expect(onPersist).toHaveBeenCalledTimes(0)
    // …and it really did render the stored value, so the zero counts are a property of a
    // working component rather than of one that rendered nothing.
    expect(select.value).toBe(DISABLED_ID)
  })

  it("renders with an UNKNOWN stored value and calls neither callback", () => {
    const { onChange, onPersist, select } = mount({ value: "not-a-real-model" })
    expect(onChange).toHaveBeenCalledTimes(0)
    expect(onPersist).toHaveBeenCalledTimes(0)
    expect(select.value).toBe("not-a-real-model")
  })

  it("POSITIVE CONTROL — the callbacks CAN be called, so zero is a measurement", () => {
    const { onChange, select } = mount({ value: "" })
    fireEvent.change(select, { target: { value: STRICT_ID } })
    expect(onChange).toHaveBeenCalledWith(STRICT_ID)
  })
})

describe("ModelField 196-05 — the two write paths, and only those two", () => {
  it("onChange fires from the select's OWN change event, with the picked id", async () => {
    const user = userEvent.setup()
    const { onChange, onPersist, select } = mount({ value: "" })
    await user.selectOptions(select, STRICT_ID)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(STRICT_ID)
    expect(onPersist).toHaveBeenCalledTimes(0)
  })

  it("onPersist fires on BLUR", () => {
    const { onPersist, select } = mount({ value: STRICT_ID })
    fireEvent.blur(select)
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("A6 — blurring WITHOUT changing anything leaves the value untouched", () => {
    // The panel persists on blur, so a user tabbing past this field triggers a write path.
    // What must not happen is the value changing underneath them.
    const { onChange, onPersist, select } = mount({ value: DISABLED_ID })
    expect(select.value).toBe(DISABLED_ID)
    fireEvent.blur(select)
    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(0)
    expect(select.value).toBe(DISABLED_ID)
  })
})

describe("ModelField 196-05 — deprecated is NOT disabled (D-149-04)", () => {
  it("a deprecated-but-enabled row stays offered and selectable", () => {
    const { select } = mount()
    expect(within(select).getByRole("option", { name: DEPRECATED_ID })).toBeInTheDocument()
    // POSITIVE CONTROL — the fixture row really is flagged deprecated, so this is a
    // statement about deprecation rather than about a row that carries no flag.
    expect(MODELS.find((m) => m.model_id === DEPRECATED_ID)?.deprecated).toBe(true)
    expect(MODELS.find((m) => m.model_id === DEPRECATED_ID)?.enabled).toBe(true)
  })

  it("…and it can be picked", async () => {
    const user = userEvent.setup()
    const { onChange, select } = mount({ value: "" })
    await user.selectOptions(select, DEPRECATED_ID)
    expect(onChange).toHaveBeenCalledWith(DEPRECATED_ID)
  })
})

describe("ModelField 196-05 — fitness is STRUCTURAL, and only on the deliverable step (D-12)", () => {
  /** The rendered group labels, read off the DOM in document order. */
  function groupLabels(select: HTMLSelectElement): string[] {
    return Array.from(select.querySelectorAll("optgroup")).map((g) => g.getAttribute("label") ?? "")
  }

  /** The group label a given option sits under — `null` when it sits under none. */
  function groupOf(select: HTMLSelectElement, id: string): string | null {
    const option = within(select).getByRole("option", { name: new RegExp(`^${id}`) })
    const parent = option.parentElement
    return parent && parent.tagName.toLowerCase() === "optgroup"
      ? parent.getAttribute("label")
      : null
  }

  it("with showFitness, a weakest-tier model can NEVER sit adjacent to a strongest-tier one", () => {
    const { select } = mount({ showFitness: true })
    const strictGroup = groupOf(select, STRICT_ID)
    const coerceGroup = groupOf(select, COERCE_ID)
    expect(strictGroup).not.toBeNull()
    expect(coerceGroup).not.toBeNull()
    expect(strictGroup).not.toBe(coerceGroup)
    // The labels are the USER sentences from the vocabulary module, not engine tokens.
    expect(strictGroup).toBe(MODEL_FITNESS_WORD.force_strict)
    expect(coerceGroup).toBe(MODEL_FITNESS_WORD.coerce)
  })

  it("a NULL tier groups with the weakest — the read-time default, rendered", () => {
    const { select } = mount({ showFitness: true })
    expect(groupOf(select, NULL_TIER_A)).toBe(MODEL_FITNESS_WORD.coerce)
    expect(groupOf(select, NULL_TIER_B)).toBe(MODEL_FITNESS_WORD.coerce)
  })

  it("the groups run STRONGEST FIRST", () => {
    const { select } = mount({ showFitness: true })
    const labels = groupLabels(select)
    expect(labels[0]).toBe(MODEL_FITNESS_WORD.force_strict)
    expect(labels[labels.length - 1]).toBe(MODEL_FITNESS_WORD.coerce)
    expect(labels).toHaveLength(3)
  })

  it("WITHOUT showFitness there are no groups at all and no tier text anywhere", () => {
    // D-12's reason, asserted: on the other three step types the tier predicts nothing, and
    // a warning that predicts nothing trains people to ignore the ones that do.
    const { container } = render(
      <ModelField
        value=""
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={null}
      />,
    )
    const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
    expect(select.querySelectorAll("optgroup")).toHaveLength(0)
    for (const sentence of Object.values(MODEL_FITNESS_WORD)) {
      expect(container.textContent).not.toContain(sentence)
    }
    expect(container.innerHTML).not.toContain(MODEL_FITNESS_WORD.coerce)
    // …and every offerable row is still there: flat, not filtered.
    expect(within(select).getAllByRole("option")).toHaveLength(OFFERABLE.length + 1)
  })
})

describe("ModelField 196-05 — engine words stay behind the ⌥ reveal (D-15, SEED-085)", () => {
  it("the tier TOKEN appears nowhere without showTechnical", () => {
    const { container } = render(
      <ModelField
        value=""
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={null}
        showFitness
      />,
    )
    expect(container.innerHTML).not.toContain("emit_tier")
  })

  it("with showTechnical the GROUP LABEL carries it — and the option text does not change", () => {
    const { container } = render(
      <ModelField
        value=""
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={null}
        showFitness
        showTechnical
      />,
    )
    const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
    const labels = Array.from(select.querySelectorAll("optgroup")).map(
      (g) => g.getAttribute("label") ?? "",
    )
    expect(labels.some((l) => l.includes("emit_tier: force_strict"))).toBe(true)
    expect(labels.some((l) => l.includes("emit_tier: coerce"))).toBe(true)
    // ⚠ THE OPTION TEXT IS STILL THE BARE MODEL ID. The reveal ADDS a technical line, it
    // does not translate the value a person is choosing — so what they pick is never
    // ambiguous between the two audiences.
    expect(within(select).getByRole("option", { name: STRICT_ID }).textContent).toBe(STRICT_ID)
    // …and the plain sentence is still there beside it, not replaced by the token.
    expect(container.innerHTML).toContain(MODEL_FITNESS_WORD.force_strict)
  })

  it("showTechnical WITHOUT showFitness still shows no token — there is no group to carry it", () => {
    const { container } = render(
      <ModelField
        value=""
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={null}
        showTechnical
      />,
    )
    expect(container.innerHTML).not.toContain("emit_tier")
  })
})

// ── THE SOURCE FENCE ─────────────────────────────────────────────────────────────────────
//
// A component with NO effect cannot fire a write on mount. The behavioural cases above
// observe that it does not; this fence makes it structural.

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The fixture the POSITIVE CONTROL runs the same extractor over. It is a string, not a
 *  file, so nothing in the tree can accidentally make the control pass. */
const FIXTURE_WITH_BOTH = [
  "const [x, setX] = useState(0)",
  "useEffect(() => { setX(1) }, [])",
].join("\n")

describe("ModelField 196-05 — SOURCE fence: no component state, no effect, by construction", () => {
  it("POSITIVE CONTROL — the extractor really can find both tokens", () => {
    // ⚠ Without this, a typo'd needle or an empty import would report a clean file and the
    // fence would pass while measuring nothing.
    expect(occurrences(FIXTURE_WITH_BOTH, "useState")).toBe(1)
    expect(occurrences(FIXTURE_WITH_BOTH, "useEffect")).toBe(1)
  })

  it("NON-VACUITY — the source really was loaded, and really is the picker", () => {
    const src = modelFieldSource as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(500)
    expect(src).toContain("<select")
    expect(src).toContain("ModelField")
  })

  it("the component source contains ZERO occurrences of either token", () => {
    const src = modelFieldSource as string
    expect(occurrences(src, "useState")).toBe(0)
    expect(occurrences(src, "useEffect")).toBe(0)
  })

  it("…and it cannot fetch: the api client is reached ONLY as an erased type import", () => {
    // The `models` prop is the whole input. A read here would run four times per panel open.
    //
    // ⚠ ASSERTED AS "NO RUNTIME IMPORT OF THE CLIENT", NOT AS A GREP FOR ONE FUNCTION NAME,
    // and the widening is deliberate in two directions at once. It is STRONGER — a token
    // grep forbids one call and waves through the other ~200 exports of that module, while
    // this forbids the whole surface. And it spells no forbidden token: this plan's
    // acceptance greps the components tree for the registry reader's name, and a fence whose
    // own needle trips the criterion it defends is the 187-24 trap plan 196-04 hit three
    // times in one afternoon. A grep for that name over this file must come back EMPTY.
    const src = modelFieldSource as string
    expect(occurrences(src, 'from "@/lib/api"')).toBe(1)
    expect(src).toContain('import type { AuthorModelRow } from "@/lib/api"')
    expect(occurrences(src, "fetch(")).toBe(0)
    expect(occurrences(src, "await ")).toBe(0)
  })

  it("POSITIVE CONTROL — the import fence really can find a runtime import", () => {
    // Without this, the assertion above passes on a needle that matches nothing. The fixture
    // is a string, so no file in the tree can accidentally make the control pass.
    const runtimeImport = 'import { somethingThatFetches } from "@/lib/api"'
    const typeImport = 'import type { AuthorModelRow } from "@/lib/api"'
    expect(occurrences(runtimeImport, 'from "@/lib/api"')).toBe(1)
    expect(runtimeImport.startsWith("import type")).toBe(false)
    expect(typeImport.startsWith("import type")).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-06 Task 3 (DES-01, sheet c4) — THE PICKER CAN NOW SAY IT COULD NOT READ THE
// REGISTRY, AND THAT IS A DIFFERENT SENTENCE FROM "there are no models".
//
// The hot-file ledger's row for this component read, for one whole phase: *"⚠ it cannot
// express 'I could not read the registry'"*. `useModelRegistry` had resolved three readings
// since the day it shipped; this component took only rows, so the caller's only honest move
// was to remove the field. That is what changes here, and the matrix below is the point of
// the change: THREE readings, driven separately, asserted to render three different things.
//
// ⚠ THE MATRIX REACHES THE EMPTY-BUT-ANSWERED CASE ON PURPOSE. A two-row matrix (failed vs
// populated) would pass on a component that collapsed "answered with nothing" into "could
// not be answered", which is exactly the substitution `useModelRegistry`'s own docblock was
// written to make unconstructable — and the one this component would have re-created.
// ═══════════════════════════════════════════════════════════════════════════════════════

const REGISTRY_UNAVAILABLE_SENTENCE =
  "We couldn't load the list of models. Nothing is offered here rather than a list that would be wrong."
const REGISTRY_LOADING_SENTENCE = "Loading the list of models…"
const REGISTRY_EMPTY_SENTENCE = "This workspace offers no models for this step."

describe("ModelField 199-06 — three readings, three different things on screen", () => {
  it("A FAILED read says so, and offers NO control at all — not an empty dropdown", () => {
    render(
      <ModelField value="" onChange={vi.fn()} onPersist={vi.fn()} models={[]} runDefaultModel={null} noAnswer="unavailable" />,
    )
    expect(screen.getByTestId("model-no-answer").getAttribute("data-reading")).toBe("unavailable")
    expect(screen.getByText(REGISTRY_UNAVAILABLE_SENTENCE)).toBeInTheDocument()
    // The sheet's whole complaint: an empty dropdown reads as a correct control.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    // …and AUTH-04's core claim survives the new arm — there is still no typed path.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    // The technical term stays reachable exactly when the plain answer is missing.
    expect(screen.getByLabelText(/^model — the registry id/i)).toBeInTheDocument()
  })

  it("A read IN FLIGHT says something ELSE — 'still asking' is not 'failed'", () => {
    render(
      <ModelField value="" onChange={vi.fn()} onPersist={vi.fn()} models={[]} runDefaultModel={null} noAnswer="loading" />,
    )
    expect(screen.getByTestId("model-no-answer").getAttribute("data-reading")).toBe("loading")
    expect(screen.getByText(REGISTRY_LOADING_SENTENCE)).toBeInTheDocument()
    // ⚠ The load-bearing negative: a request in flight must never accuse the server.
    expect(screen.queryByText(REGISTRY_UNAVAILABLE_SENTENCE)).not.toBeInTheDocument()
  })

  it("⚠ AN EMPTY SUCCESSFUL READ IS A THIRD THING — a control, and its own sentence", () => {
    render(<ModelField value="" onChange={vi.fn()} onPersist={vi.fn()} models={[]} runDefaultModel={null} />)
    // It KEEPS its control, because there is a real answer to offer the inherit option from.
    const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
    expect(optionTexts(select)).toEqual([INHERIT_BARE])
    expect(screen.getByText(REGISTRY_EMPTY_SENTENCE)).toBeInTheDocument()
    // Neither of the other two sentences appears. Three readings, three renders.
    expect(screen.queryByText(REGISTRY_UNAVAILABLE_SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByText(REGISTRY_LOADING_SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByTestId("model-no-answer")).not.toBeInTheDocument()
  })

  it("⚠ 199 CR WR-01 — an empty read that STILL HOLDS a stored model does NOT claim emptiness", () => {
    // THE DEFECT THIS PINS, which shipped in 199-06 and was caught by review rather than by
    // any test here: the sentence was gated on `offered.length === 0` alone, and the retained
    // `(current)` option is rendered from that SAME emptiness. The two were mutually IMPLIED,
    // never exclusive — so the select held a choosable model while the line beneath it said
    // the workspace offers none. Both resolved in ONE render; that is the contradiction.
    render(
      <ModelField
        value={DISABLED_ID}
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={[]}
        runDefaultModel={null}
      />,
    )
    const select = screen.getByRole("combobox", { name: /ai model/i }) as HTMLSelectElement
    // NON-VACUITY FIRST — the retained option really is on screen, so the negative below is a
    // claim about a populated control rather than about an empty one. Without this line the
    // assertion would also pass on a component that rendered nothing at all.
    const retained = within(select).getByRole("option", { name: new RegExp(DISABLED_ID) })
    expect(retained).toBeInTheDocument()
    expect(select.value).toBe(DISABLED_ID)
    // …and therefore the emptiness sentence must NOT be there. A model you can pick and a
    // sentence saying there are none cannot both be true of the same screen.
    expect(screen.queryByText(REGISTRY_EMPTY_SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByTestId("model-registry-empty")).not.toBeInTheDocument()
  })

  it("the three renders are pairwise DISTINCT — asserted, not assumed", () => {
    const html = (props: Partial<Parameters<typeof ModelField>[0]>) => {
      const { container, unmount } = render(
        <ModelField value="" onChange={vi.fn()} onPersist={vi.fn()} models={[]} runDefaultModel={null} {...props} />,
      )
      const out = container.innerHTML
      unmount()
      return out
    }
    const failed = html({ noAnswer: "unavailable" })
    const loading = html({ noAnswer: "loading" })
    const empty = html({})
    expect(failed).not.toBe(loading)
    expect(failed).not.toBe(empty)
    expect(loading).not.toBe(empty)
  })

  it("⚠ A FAILED read does NOT consult the rows, so it can never call a known model unknown", () => {
    // The mitigation for T-199-06-01, driven rather than described. The rows here are the
    // full fixture and the stored value IS in them — if the failed arm fell through to the
    // retention branch it would print `(current) — not in the registry` about a model the
    // registry knows perfectly well, and invite the author to change it.
    render(
      <ModelField
        value={STRICT_ID}
        onChange={vi.fn()}
        onPersist={vi.fn()}
        models={MODELS}
        runDefaultModel={RESOLVED_DEFAULT}
        noAnswer="unavailable"
      />,
    )
    expect(screen.queryByText(UNKNOWN_CAPTION)).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    // Nothing from the rows reached the screen at all — not even the resolved run default,
    // which is the other thing a fall-through would have leaked.
    expect(screen.queryByText(new RegExp(RESOLVED_DEFAULT))).not.toBeInTheDocument()
    // …but a failed read is NOT a wipe: what the step already names is still printed, and
    // it comes from the STORED value, which is why it is true without any row arriving.
    expect(screen.getByTestId("model-no-answer-current")).toHaveTextContent(
      `This step currently names: ${STRICT_ID}.`,
    )
  })

  it("POSITIVE CONTROL — the retention branch really CAN print that caption, so zero means something", () => {
    // Without this, the assertion above passes on a component that never prints it at all.
    render(
      <ModelField value="retired-9" onChange={vi.fn()} onPersist={vi.fn()} models={MODELS} runDefaultModel={null} />,
    )
    expect(screen.getByText(UNKNOWN_CAPTION)).toBeInTheDocument()
  })

  it("a blank step on a failed read says nothing about a value it does not have", () => {
    render(
      <ModelField value="" onChange={vi.fn()} onPersist={vi.fn()} models={MODELS} runDefaultModel={null} noAnswer="unavailable" />,
    )
    expect(screen.queryByTestId("model-no-answer-current")).not.toBeInTheDocument()
  })

  it("SOURCE — the discriminator is compared EXPLICITLY, never against emptiness", () => {
    const src = modelFieldSource as string
    // The guard reads the prop, not the row array's length or its truthiness. Either of the
    // forbidden forms would fold the honest empty registry into the failed read — the one
    // defect this whole branch exists to prevent.
    //
    // ⚠ THE NEEDLES ARE BUILT, NEVER SPELLED. This assertion's first draft named them in the
    // comment above it and turned itself red: a fence that greps a file for a token is also
    // grepping every comment that describes it (the 187-24 trap). The component's own
    // docblock had to lose the literals for the same reason.
    const LEN = "models." + "length"
    expect(occurrences(src, "noAnswer !== undefined")).toBe(1)
    expect(occurrences(src, "!" + LEN)).toBe(0)
    expect(occurrences(src, LEN + " === 0")).toBe(0)
    // …and the words come from module scope, not from a literal typed into the markup: each
    // name appears at its declaration and at its ONE use site. ⚠ `REGISTRY_EMPTY` reads THREE
    // because `noAnswer`'s docblock points a reader at it by name — a deliberate cross
    // reference, recorded here rather than "fixed" by loosening the other two to `>= 2`.
    expect(occurrences(src, "REGISTRY_UNAVAILABLE")).toBe(2)
    expect(occurrences(src, "REGISTRY_LOADING")).toBe(2)
    expect(occurrences(src, "REGISTRY_EMPTY")).toBe(3)
    // The real claim underneath those counts: no sentence is spelled twice in this file.
    for (const sentence of [REGISTRY_UNAVAILABLE_SENTENCE, REGISTRY_LOADING_SENTENCE, REGISTRY_EMPTY_SENTENCE]) {
      expect(occurrences(src, sentence)).toBe(1)
    }
  })

  it("POSITIVE CONTROL — the emptiness needles really can find what they forbid", () => {
    const LEN = "models." + "length"
    const planted = "  if (!" + LEN + ") return <p>failed</p>"
    expect(occurrences(planted, "!" + LEN)).toBe(1)
    const planted2 = "  if (" + LEN + " === 0) return <p>failed</p>"
    expect(occurrences(planted2, LEN + " === 0")).toBe(1)
  })
})
