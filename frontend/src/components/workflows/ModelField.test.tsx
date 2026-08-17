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

  it("…and it does not fetch: the client module is never imported by the component", () => {
    // The `models` prop is the whole input. A fetch here would run four times per panel open.
    const src = modelFieldSource as string
    expect(occurrences(src, "getAuthorModelRegistry")).toBe(0)
    expect(occurrences(src, "fetch(")).toBe(0)
  })
})
